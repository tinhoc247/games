/* Kiểm thử Tank War bằng trình duyệt thật + Firebase giả lập (không đụng Firebase thật).
 *   node tools/loadtest/tank-test.js [thư-mục-gốc-dự-án]            (mặc định: thư mục gốc chứa tools/)
 * Biến môi trường:
 *   SCEN=move,combat,chase,join,sync,net   chọn kịch bản (mặc định: tất cả)
 *   LAT=300  JIT=150  LOSS=0.02      độ trễ 1 chiều (ms) cộng thêm, dao động, tỉ lệ yêu cầu bị mất
 *   BW=0                              giới hạn băng thông KB/s (0 = không giới hạn)
 * Kịch bản:
 *   move    phím WASD / mũi tên / gõ tiếng Việt (IME: key="Process") có di chuyển được ngay khi vào trận không
 *   combat  bắn đối phương đứng yên ở 2 khoảng cách (gần/xa) → bao nhiêu phát trúng được ghi nhận
 *   chase   bắn đối phương đang chạy xa dọc đường bắn (kiểm tra bù độ trễ)
 *   join    thời gian từ lúc bấm "Vào chiến trường" tới lúc lái được (khi trận đang chạy), qua mạng chậm
 *   sync    ghi vị trí lên Firebase: có bị ghi đè lỗi thời (sai thứ tự) khi mạng chậm không
 *   net     băng thông + số yêu cầu / giây khi 4 máy cùng chơi
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const LAT = +(process.env.LAT || 0), JIT = +(process.env.JIT || 0), LOSS = +(process.env.LOSS || 0), BW = +(process.env.BW || 0);
const WANT = (process.env.SCEN || 'move,combat,chase,join,sync,net').split(',');
const CODE = 'TEST1', DBHOST = 'minigame-70bef-default-rtdb.asia-southeast1.firebasedatabase.app';
const sleep = ms => new Promise(r => setTimeout(r, ms)), T0 = Date.now();

/* ---------- máy chủ tĩnh ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve() {
  return new Promise(ok => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    }).listen(0, () => ok(s));
  });
}

/* ---------- Firebase giả (có kiểm tra Rules tối thiểu như Rules thật) ---------- */
let DB = {};
const segs = p => p.split('/').filter(Boolean);
const get = p => { let n = DB; for (const s of segs(p)) { if (n == null || typeof n !== 'object') return null; n = n[s]; } return n === undefined ? null : n; };
const set = (p, v) => { const s = segs(p); let n = DB; for (let i = 0; i < s.length - 1; i++) { if (n[s[i]] == null || typeof n[s[i]] !== 'object') n[s[i]] = {}; n = n[s[i]]; } if (v === null) delete n[s[s.length - 1]]; else n[s[s.length - 1]] = v; };
const sv = v => { if (v && typeof v === 'object') { if (v['.sv'] === 'timestamp') return Date.now(); for (const k in v) v[k] = sv(v[k]); } return v; };
let pushN = 0;
function allowed(m, p, body, uid) {   /* tank/players/<mã>/<uid>: chỉ chủ; tank/events/<mã>/*: f hoặc to phải là chính mình */
  const s = segs(p);
  if (s[0] === 'tank' && s[1] === 'players' && s.length >= 4 && s[3] !== uid) return false;
  if (s[0] === 'tank' && s[1] === 'events' && m === 'POST') { const ok = b => b && b.ts !== undefined && b.t && b.f && ((b.t === 'f' && b.f === uid) || (b.t === 'h' && b.to === uid)); return ok(body); }
  return true;
}
const NET = { bytes: {}, req: {}, paths: {} };
async function wire(ctx, id) {
  let uid = null;
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === 'localhost') return route.continue();
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'etag' };
    if (u.hostname === 'identitytoolkit.googleapis.com') { uid = 'u' + id; return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 'tok-' + uid, refreshToken: 'r', localId: uid }) }); }
    if (u.hostname === 'securetoken.googleapis.com') return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ id_token: 'tok-' + uid, refresh_token: 'r', user_id: uid }) });
    if (u.hostname !== DBHOST) return route.abort();
    const m = req.method(); if (m === 'OPTIONS') { NET.req[id + ':preflight'] = (NET.req[id + ':preflight'] || 0) + 1; await sleep(LAT * 2); return route.fulfill({ status: 204, headers: { ...CORS, 'access-control-max-age': '3600' } }); }
    const lat = () => LAT + Math.random() * JIT, tReq = Date.now();
    if (LOSS && Math.random() < LOSS) { await sleep(lat()); return route.abort('failed'); }
    await sleep(lat());                                                         /* đi */
    const p = u.pathname.replace(/\.json$/, '').replace(/^\//, ''), q = u.searchParams, silent = q.get('print') === 'silent';
    const tok = q.get('auth') || '', who = tok.replace(/^tok-/, ''), raw = req.postData() || '';
    let out = null, st = 200;
    try {
      let b = null; if (raw) b = JSON.parse(raw);
      if (m !== 'GET' && !allowed(m, p, b, who)) { st = 403; out = { error: 'Permission denied' }; }
      else if (m === 'GET') {
        let v = get(p);
        if (q.get('orderBy') === '"$key"' && v && typeof v === 'object') {
          const sa = q.get('startAt'); let ks = Object.keys(v).sort().filter(k => !sa || k >= JSON.parse(sa));
          if (q.get('limitToLast')) ks = ks.slice(-(+q.get('limitToLast'))); v = Object.fromEntries(ks.map(k => [k, v[k]]));
        }
        out = v;
      } else if (m === 'PUT') { b = sv(b); set(p, b); out = b; }
      else if (m === 'PATCH') { b = sv(b); for (const k in b) set(p + '/' + k, b[k]); out = b; }
      else if (m === 'DELETE') { set(p, null); out = null; }
      else if (m === 'POST') { b = sv(b); const idn = '-N' + String(++pushN).padStart(9, '0'); set(p + '/' + idn, b); out = { name: idn }; }
    } catch (e) { st = 400; out = { error: String(e) }; }
    const body = (st === 200 && silent && m !== 'GET') ? '' : JSON.stringify(out);
    const hdr = { ...CORS, 'content-type': 'application/json' };
    const down = Buffer.byteLength(body) + 300, up = Buffer.byteLength(raw) + 300;
    NET.bytes[id] = NET.bytes[id] || { down: 0, up: 0 }; NET.bytes[id].down += down; NET.bytes[id].up += up;
    const k = (m === 'GET' ? 'GET ' : m + ' ') + segs(p).slice(0, 2).join('/'); NET.paths[k] = NET.paths[k] || { n: 0, down: 0 }; NET.paths[k].n++; NET.paths[k].down += down;
    await sleep(lat() + (BW ? (down / 1024 / BW) * 1000 : 0));                  /* về */
    if (process.env.TRACE) console.log('   [net] +' + String(Date.now() - T0).padStart(6) + ' ms  ' + id + ' ' + m.padEnd(5) + segs(p).slice(0, 4).join('/') + (u.search ? ' ?' + u.search.slice(1, 40) : '') + '  (' + (Date.now() - tReq) + ' ms)');
    if (st === 200 && silent && m !== 'GET') return route.fulfill({ status: 204, headers: hdr });
    return route.fulfill({ status: st, headers: hdr, body });
  });
}

/* ---------- dữ liệu mẫu ---------- */
const quiz = () => JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ type: 'single', question: 'Câu ' + (i + 1), options: ['SAI 1', 'ĐÚNG', 'SAI 2', 'SAI 3'], answer: 1 })));
const AVS = ['dog', 'cat', 'mouse', 'hamster', 'rabbit', 'fox', 'bear', 'panda'];
function seed(status, extra) {
  DB = {}; pushN = 0;
  set('tank/quiz/' + CODE, quiz());
  set('tank/sessions/' + CODE, { code: CODE, title: 'Thử nghiệm', mode: 'multi', status, dur: 10, bots: 4, teams: 0, seed: SEED, nq: 6, admin: 'adm', created: Date.now(), game: 'tank-war', map: 'city', ...(extra || {}) });
}

/* ---------- bản đồ thành phố: tìm hạt giống có hành lang y=425 trống (sao chép đúng thuật toán sinh bản đồ của game) ---------- */
const W = 2600, HH = 1700, SHOP = 210, CW = W / 5, CH = HH / 4, RM = 65, cl = (v, a, b) => Math.max(a, Math.min(b, v));
const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const shopAt = (x, y) => (x < SHOP || x > W - SHOP) && (y < SHOP || y > HH - SHOP) ? 1 : -1;
function cityOB(seedv) {
  const r = rng(seedv), OB = [], okSpot = (x, y, m) => shopAt(x, y) < 0 && shopAt(x + m, y + m) < 0 && shopAt(x - m, y - m) < 0 && shopAt(x + m, y - m) < 0 && shopAt(x - m, y + m) < 0;
  const blocked = (x, y, rad) => { if (x < rad || y < rad || x > W - rad || y > HH - rad) return 1; for (const o of OB) { if (o.w) { const dx = x - cl(x, o.x, o.x + o.w), dy = y - cl(y, o.y, o.y + o.h); if (dx * dx + dy * dy < rad * rad) return 1; continue; } const dx = x - o.x, dy = y - o.y, rr = rad + o.r; if (dx * dx + dy * dy < rr * rr) return 1; } return 0; };
  const spot = () => [60 + r() * (W - 120), 60 + r() * (HH - 120)], cols = [1, 2, 3, 4, 5];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    const ix = i * CW + RM, iy = j * CH + RM, iw = CW - 2 * RM, ih = CH - 2 * RM, w = Math.min(iw, 190 + r() * 120), h = Math.min(ih, 120 + r() * 100);
    if (r() < .12) continue;
    const x = ix + r() * (iw - w), y = iy + r() * (ih - h); if (!okSpot(x, y, 30) || !okSpot(x + w, y + h, 30) || !okSpot(x + w, y, 30) || !okSpot(x, y + h, 30) || !okSpot(x + w / 2, y + h / 2, 30)) continue;
    OB.push({ x, y, w, h, c: cols[r() * cols.length | 0], k: r() });
  }
  for (let i = 0; i < 60; i++) { const [x, y] = spot(), rr2 = 13 + r() * 8; if (okSpot(x, y, 50) && !blocked(x, y, rr2 + 46)) OB.push({ x, y, r: rr2 }); }
  return blocked;
}
let SEED = 1;
for (let s = 1; s < 500; s++) { const b = cityOB(s); let ok = 1; for (let x = 250; x <= 1500; x += 10) if (b(x, 425, 30)) { ok = 0; break; } if (ok) { SEED = s; break; } }

/* ---------- điều khiển trình duyệt ---------- */
let browser, server, PORT;
async function newClient(id, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); await wire(ctx, id);
  await ctx.addInitScript(() => {
    /* cho phép bài test chọn chỗ xuất hiện: chỉ ảnh hưởng các lần gọi Math.random() từ spawnPos() */
    const r0 = Math.random; window.__spawn = [];
    Math.random = function () { if (window.__spawn.length && /spawnPos/.test(new Error().stack)) return window.__spawn.shift(); return r0(); };
    window.__errs = []; addEventListener('error', e => window.__errs.push(String(e.message)));
  });
  const pg = await ctx.newPage(); pg.on('pageerror', e => { if (process.env.DEBUG) console.log('  [pageerror]', id, e.message); });
  pg.__id = id; pg.__ctx = ctx; return pg;
}
const spawnAt = (pg, x, y) => { const a = [(x - 80) / (W - 160), (y - 80) / (HH - 160)]; return pg.url() === 'about:blank' ? pg.__ctx.addInitScript(v => { window.__spawn.push(v[0], v[1]); }, a) : pg.evaluate(v => { window.__spawn.push(v[0], v[1]); }, a); };
async function join(pg, name) {
  await pg.goto(`http://localhost:${PORT}/games/tank-war/index.html?code=${CODE}`);
  await pg.waitForSelector('#jN', { timeout: 30000 }); await pg.fill('#jN', name); await pg.click('#jB');
}
const players = () => get('tank/players/' + CODE) || {};
const pos = pg => { const p = players()['u' + pg.__id]; return p ? { x: p.x, y: p.y, k: p.k | 0, d: p.d | 0, g: p.g | 0, ar: p.ar | 0, al: p.al } : null; };
async function waitPlay(pg, ms) { const t = Date.now(); while (Date.now() - t < (ms || 30000)) { if (await pg.evaluate(() => getComputedStyle(document.querySelector('#cv')).display === 'block').catch(() => false)) return Date.now() - t; await sleep(100); } return -1; }
async function startMatch(clients, names) {
  await Promise.all(clients.map((c, i) => join(c, names[i])));
  await sleep(300 + LAT * 8);
  set('tank/sessions/' + CODE + '/status', 'running'); set('tank/sessions/' + CODE + '/startedAt', Date.now());
  await Promise.all(clients.map(c => waitPlay(c, 40000 + LAT * 30)));
  await sleep(500 + LAT * 3);
}
async function answerIfDead(pg) {
  for (let i = 0; i < 3; i++) {
    if (!(await pg.locator('#modal').isVisible().catch(() => false))) return;
    const o = pg.locator('#modal .opt:has-text("ĐÚNG")').first(); if (await o.count()) await o.click({ timeout: 2000 }).catch(() => {});
    await sleep(150); const nx = pg.locator('#modal button:has-text("Tiếp tục")').first(); if (await nx.count()) await nx.click({ timeout: 2000 }).catch(() => {});
    await sleep(300);
  }
}
const out = (k, v) => console.log('  ' + k.padEnd(46) + v);

/* ---------- kịch bản ---------- */
async function tMove() {
  console.log('\n[move] Lái xe ngay khi vào trận');
  const modes = [
    ['phím WASD thường', pg => pg.keyboard.down('d'), pg => pg.keyboard.up('d')],
    ['mũi tên →', pg => pg.keyboard.down('ArrowRight'), pg => pg.keyboard.up('ArrowRight')],
    ['gõ tiếng Việt (Unikey/Telex: key="Process")', pg => pg.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', code: 'KeyD', keyCode: 229, bubbles: true }))), pg => pg.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { key: 'Process', code: 'KeyD', keyCode: 229, bubbles: true })))],
    ['gõ tiếng Việt (key="đ", không có mã phím)', pg => pg.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'đ', code: '', keyCode: 229, bubbles: true }))), pg => pg.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { key: 'đ', code: '', keyCode: 229, bubbles: true })))],
    ['bàn phím AZERTY (phím chữ "q" = vị trí A)', pg => pg.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyA', bubbles: true }))), pg => pg.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { key: 'q', code: 'KeyA', bubbles: true })))],
    ['cảm ứng: kéo cần lái nửa trái màn hình', async pg => { await pg.evaluate(() => { const cv = document.querySelector('#cv'); const mk = (t, x) => new Touch({ identifier: 1, target: cv, clientX: x, clientY: 400 }); cv.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(0, 150)], changedTouches: [mk(0, 150)], bubbles: true, cancelable: true })); cv.dispatchEvent(new TouchEvent('touchmove', { touches: [mk(0, 230)], changedTouches: [mk(0, 230)], bubbles: true, cancelable: true })); }); }, pg => pg.evaluate(() => { const cv = document.querySelector('#cv'); const t = new Touch({ identifier: 1, target: cv, clientX: 230, clientY: 400 }); cv.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true })); })]
  ];
  for (const [name, down, up] of modes) {
    seed('waiting'); const a = await newClient(1); await spawnAt(a, 500, 425);
    await startMatch([a], ['An']);
    const p0 = pos(a); await sleep(400); await down(a); await sleep(1800 + LAT * 4); await up(a); await sleep(800 + LAT * 3);
    const p1 = pos(a), dx = p1 && p0 ? p1.x - p0.x : NaN;
    out(name, Number.isFinite(dx) && Math.abs(dx) > 60 ? '✅ đi được ' + Math.round(Math.abs(dx)) + ' px' + (dx < 0 ? ' (sang trái — đúng phím A)' : '') : '❌ KHÔNG di chuyển (' + dx + ')');
    await a.__ctx.close();
  }
}

async function tCombat() {
  console.log('\n[combat] Bắn đối phương đứng yên (mạng: trễ ' + LAT + '±' + JIT + 'ms)');
  for (const dist of (process.env.DIST || '150,300,600').split(',').map(Number)) {
    seed('waiting'); const a = await newClient(1), b = await newClient(2);
    await spawnAt(a, 400, 425); await spawnAt(b, 400 + dist, 425);
    await startMatch([a, b], ['An', 'Binh']); await sleep(3000);   /* qua thời gian bất tử 2,5 s lúc xuất hiện */
    let hits = 0, shots = 0, lat = [];
    for (let i = 0; i < 6; i++) {
      await spawnAt(b, 400 + dist, 425);
      if (!pos(a) || !pos(b)) { console.log('   ⚠ thiếu bản ghi người chơi:', Object.keys(players()).join(','), '| A:', JSON.stringify(await a.evaluate(() => document.body.innerText.slice(0, 100)).catch(e => e.message)), '| B:', JSON.stringify(await b.evaluate(() => document.body.innerText.slice(0, 100)).catch(e => e.message))); shots++; continue; }
      const k0 = pos(a).k, d0 = pos(b).d; await a.mouse.move(1270, 360); const t0 = Date.now();
      await a.mouse.down(); await sleep(120); await a.mouse.up(); shots++;
      let got = false; while (Date.now() - t0 < 5000 + LAT * 6) { const pa = pos(a), pb = pos(b); if (pa && pb && pa.k > k0 && pb.d > d0) { got = true; break; } await sleep(50); }
      if (got) { hits++; lat.push(Date.now() - t0); }
      if (process.env.DEBUG) console.log('   phát ' + (i + 1), got ? 'trúng' : 'trượt', JSON.stringify(pos(a)), JSON.stringify(pos(b)), 'modal=' + await b.locator('#modal').isVisible().catch(() => '?'));
      await sleep(400 + LAT * 2); await answerIfDead(b); await sleep(3200);       /* hồi sinh + hết thời gian bất tử 2,5 s */
      const pb2 = pos(b); if (!pb2 || pb2.al !== 1) await sleep(1500);
    }
    out('khoảng cách ' + dist + ' px', hits + '/' + shots + ' phát được tính' + (lat.length ? ' · trễ ghi nhận TB ' + Math.round(lat.reduce((x, y) => x + y, 0) / lat.length) + ' ms' : ''));
    await a.__ctx.close(); await b.__ctx.close();
  }
}

async function tChase() {
  console.log('\n[chase] Bắn đối phương đang CHẠY XA dọc đường bắn (mạng: trễ ' + LAT + '±' + JIT + 'ms)');
  seed('waiting'); const a = await newClient(1), b = await newClient(2);
  await spawnAt(a, 400, 425); await spawnAt(b, 650, 425);
  await startMatch([a, b], ['An', 'Binh']); await sleep(3000);
  let hits = 0, shots = 6;
  for (let i = 0; i < shots; i++) {
    await spawnAt(b, 650, 425);
    const k0 = pos(a).k, d0 = pos(b).d; await a.mouse.move(1270, 360);
    await b.keyboard.down('d'); await sleep(200); const t0 = Date.now();
    await a.mouse.down(); await sleep(120); await a.mouse.up();
    let got = false; while (Date.now() - t0 < 6000 + LAT * 6) { const pa = pos(a), pb = pos(b); if (pa.k > k0 && pb.d > d0) { got = true; break; } await sleep(50); }
    await b.keyboard.up('d'); if (got) hits++;
    if (process.env.DEBUG) console.log('   phát ' + (i + 1), got ? 'trúng' : 'trượt', JSON.stringify(pos(b)));
    await sleep(400 + LAT * 2); await answerIfDead(b); await sleep(3200);
    const pb2 = pos(b); if (!pb2 || pb2.al !== 1) await sleep(1500);
  }
  out('mục tiêu chạy 190 px/s cách xa', hits + '/' + shots + ' phát được tính');
  await a.__ctx.close(); await b.__ctx.close();
}

async function tJoin() {
  console.log('\n[join] Vào phòng khi trận đang chạy (trễ ' + LAT + '±' + JIT + 'ms)');
  seed('running', { startedAt: Date.now() - 60000 });
  const a = await newClient(1); await spawnAt(a, 500, 425);
  await a.goto(`http://localhost:${PORT}/games/tank-war/index.html?code=${CODE}`); await a.waitForSelector('#jN'); await a.fill('#jN', 'An');
  const t0 = Date.now(); await a.click('#jB'); const ms = await waitPlay(a, 60000);
  if (ms < 0) return out('vào trận', '❌ không vào được');
  for (let w = 0; w < 300 && !(pos(a) && pos(a).al === 1); w++) await sleep(100);   /* chờ bản ghi vị trí đầu tiên tới máy chủ */
  const p0 = pos(a); await a.keyboard.down('d'); await sleep(1500 + LAT * 3); await a.keyboard.up('d'); await sleep(600 + LAT * 6);
  const p1 = pos(a);
  out('từ lúc bấm vào đến lúc hiện bản đồ', ms + ' ms');
  out('lái được ngay không', p1 && p0 && p1.x - p0.x > 60 ? '✅' : '❌');
  await a.__ctx.close();
}

async function tSync() {
  console.log('\n[sync] Ghi vị trí khi mạng chậm (trễ ' + LAT + '±' + JIT + 'ms)');
  seed('waiting'); const a = await newClient(1); await spawnAt(a, 300, 425);
  await startMatch([a], ['An']);
  const samples = []; const iv = setInterval(() => { const p = pos(a); if (p) samples.push(p.x); }, 50);
  await a.keyboard.down('d'); await sleep(3000); await a.keyboard.up('d'); await sleep(3500 + LAT * 6); clearInterval(iv);
  let back = 0, mx = -1e9; for (const x of samples) { if (x < mx - 1) back++; mx = Math.max(mx, x); }
  const fin = samples[samples.length - 1], settle = samples.slice(-20).every(x => x === fin);
  out('số lần vị trí trên Firebase bị ghi lùi (lỗi thời)', back === 0 ? '✅ 0' : '❌ ' + back);
  out('vị trí cuối ổn định sau khi dừng', settle ? '✅' : '❌ còn thay đổi');
  const sp = NET.paths['PATCH tank/players']; if (sp) out('số lần ghi vị trí', sp.n);
  await a.__ctx.close();
}

async function tNet() {
  console.log('\n[net] 4 máy cùng chơi 20 giây (trễ ' + LAT + '±' + JIT + 'ms)');
  seed('waiting'); const cs = [1, 2, 3, 4].map(i => newClient(i)); const pgs = await Promise.all(cs);
  for (const [i, p] of pgs.entries()) await spawnAt(p, 400 + i * 200, 425);
  await startMatch(pgs, ['A', 'B', 'C', 'D']);
  NET.bytes = {}; NET.paths = {}; NET.req = {};
  await Promise.all(pgs.map(p => p.keyboard.down('d')));        /* mọi người cùng chạy; mỗi máy là 1 context riêng nên bàn phím độc lập */
  await sleep(10000); await Promise.all(pgs.map(p => p.keyboard.up('d'))); await sleep(10000);
  const tot = Object.values(NET.bytes).reduce((a, x) => ({ down: a.down + x.down, up: a.up + x.up }), { down: 0, up: 0 });
  out('tải xuống mỗi máy', (tot.down / 4 / 20 / 1024).toFixed(1) + ' KB/s'); out('tải lên mỗi máy', (tot.up / 4 / 20 / 1024).toFixed(1) + ' KB/s');
  Object.entries(NET.paths).sort((a, b) => b[1].down - a[1].down).slice(0, 5).forEach(([k, v]) => out('  ' + k, (v.n / 4 / 20).toFixed(1) + ' req/s/máy · ' + (v.down / 4 / 20 / 1024).toFixed(1) + ' KB/s'));
  out('OPTIONS (preflight) mỗi máy', Object.entries(NET.req).filter(([k]) => /preflight/.test(k)).map(([, v]) => v).reduce((a, x) => a + x, 0) / 4);
  for (const p of pgs) await p.__ctx.close();
}

(async () => {
  server = await serve(); PORT = server.address().port; browser = await chromium.launch();
  console.log('Gốc dự án: ' + ROOT + ' · hạt giống bản đồ ' + SEED);
  const T = { move: tMove, combat: tCombat, chase: tChase, join: tJoin, sync: tSync, net: tNet };
  for (const s of WANT) { try { await T[s](); } catch (e) { console.log('  ⚠️ lỗi kịch bản ' + s + ': ' + e.message.split('\n')[0]); } }
  await browser.close(); server.close(); process.exit(0);
})();
