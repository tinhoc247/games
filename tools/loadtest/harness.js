/* Giả lập Firebase RTDB (REST) + trình duyệt thật, đo băng thông tải xuống của từng game */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.argv[2], GAME = process.argv[3], N = +(process.argv[4] || 40), R = +(process.argv[5] || 6);
const WAIT = +(process.env.WAIT || 30), PLAY = +(process.env.PLAY || 60);
const CODE = 'TEST1';
const DBHOST = 'minigame-70bef-default-rtdb.asia-southeast1.firebasedatabase.app';

/* ---- DB giả ---- */
let DB = {};
const segs = p => p.split('/').filter(Boolean);
function get(p) { let n = DB; for (const s of segs(p)) { if (n == null || typeof n !== 'object') return null; n = n[s]; } return n === undefined ? null : n; }
function set(p, v) { const s = segs(p); if (!s.length) { DB = v || {}; return; } let n = DB; for (let i = 0; i < s.length - 1; i++) { if (n[s[i]] == null || typeof n[s[i]] !== 'object') n[s[i]] = {}; n = n[s[i]]; } if (v === null) delete n[s[s.length - 1]]; else n[s[s.length - 1]] = v; }
const sv = v => { if (v && typeof v === 'object') { if (v['.sv'] === 'timestamp') return Date.now(); for (const k in v) v[k] = sv(v[k]); } return v; };
let pushN = 0;

/* ---- thống kê ---- */
let phase = 'load';
const stats = {};                           // phase -> cat -> {n, bytes}
const cl = {};                               // client -> bytes
function cat(p) { const s = segs(p); let k = s[0] === 'gold' || s[0] === 'race' ? s[0] + '/' + s[1] : s[0]; return k + (s[0] === 'libimg' ? '' : ''); }
function rec(c, path, bytes, kind) { const st = stats[phase] = stats[phase] || {}; const k = cat(path) + (kind ? ' (' + kind + ')' : ''); const e = st[k] = st[k] || { n: 0, bytes: 0 }; e.n++; e.bytes += bytes; cl[c] = (cl[c] || 0) + bytes; }

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'etag', 'access-control-allow-private-network': 'true' };
let uid = 0;
async function wire(ctx, c) {
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname === 'identitytoolkit.googleapis.com') { return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 't', refreshToken: 'r', localId: 'u' + (++uid) }) }); }
    if (u.hostname === 'securetoken.googleapis.com') return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ id_token: 't', refresh_token: 'r', user_id: 'x' }) });
    if (u.hostname !== DBHOST) return route.abort();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = u.pathname.replace(/\.json$/, '').replace(/^\//, ''), q = u.searchParams, m = req.method();
    const silent = q.get('print') === 'silent';
    let out = null;
    if (m === 'GET') {
      let v = get(path);
      if (q.get('shallow') === 'true' && v && typeof v === 'object') v = Object.fromEntries(Object.keys(v).map(k => [k, true]));
      else if (q.get('orderBy') === '"$key"' && v && typeof v === 'object') { const st = q.get('startAt'); const ks = Object.keys(v).sort().filter(k => !st || k >= JSON.parse(st)); v = Object.fromEntries(ks.map(k => [k, v[k]])); }
      out = v;
    } else if (m === 'PUT') { const b = sv(JSON.parse(req.postData() || 'null')); set(path, b); out = b; }
    else if (m === 'PATCH') { const b = sv(JSON.parse(req.postData() || '{}')); for (const k in b) set(path + '/' + k, b[k]); out = b; }
    else if (m === 'DELETE') { set(path, null); out = null; }
    else if (m === 'POST') { const b = sv(JSON.parse(req.postData() || 'null')), id = '-N' + String(++pushN).padStart(8, '0'); set(path + '/' + id, b); out = { name: id }; }
    const body = JSON.stringify(out);
    const hdr = { ...CORS, 'content-type': 'application/json' };
    const reqH = req.headers();
    if (m === 'GET' && !process.env.NOETAG && reqH['x-firebase-etag'] === 'true') {
      const et = crypto.createHash('md5').update(body).digest('hex'); hdr.etag = et;
      if (reqH['if-none-match'] === et) { rec(c, path, 200, '304'); return route.fulfill({ status: 304, headers: hdr }); }
    }
    if (m !== 'GET' && silent) { rec(c, path, 0, 'write'); return route.fulfill({ status: 204, headers: hdr }); }
    rec(c, path, Buffer.byteLength(body) + 300, m === 'GET' ? '' : 'echo ' + m);   // +300 B header ước lượng
    return route.fulfill({ status: 200, headers: hdr, body });
  });
}

/* ---- dữ liệu mẫu: 20 câu, 6 ảnh 150 KB ---- */
const AV = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦆', '🦉', '🦄', '🐝', '🦋', '🐌', '🐞', '🐢', '🐍', '🦖', '🐙', '🐠', '🐬', '🐳', '🦈', '🐘', '🦒', '🦀', '🐊', '🐲', '🦕', '🦜', '🐺'];
function quiz() {
  const q = [];
  for (let i = 0; i < 40; i++) q.push({ type: 'single', question: 'Câu hỏi số ' + (i + 1) + ': ' + 'Nội dung câu hỏi khá dài để giống thực tế '.repeat(4), options: ['Đáp án A dài dòng ' + i, 'Đáp án B dài dòng ' + i, 'Đáp án C dài dòng ' + i, 'Đáp án D dài dòng ' + i], answer: i % 4, explain: 'Giải thích chi tiết '.repeat(6), image: i < 6 ? 'lib:BANK1:i' + i : '' });
  return JSON.stringify(q);
}
function seed(status) {
  DB = {};
  const img = 'data:image/jpeg;base64,' + 'A'.repeat(150000);
  for (let i = 0; i < 6; i++) set('libimg/BANK1/i' + i, img);
  const q = quiz(), now = Date.now();
  const base = { code: CODE, title: 'Lớp thử nghiệm', admin: 'adm', created: now, lib: 'BANK1', nq: 40 };
  const players = {};
  for (let i = 0; i < N; i++) players['p' + i] = { name: 'Học sinh ' + i, av: AV[i % AV.length], gold: 100 + i, ok: i % 7, bad: i % 3, wq: 0, pos: i % 9, qn: 5, joined: now };
  if (GAME === 'doi-vang') { set('gold/quiz/' + CODE, q); set('gold/sessions/' + CODE, { ...base, dur: 15, status, extra: 0, game: 'doi-vang', ...(status === 'running' ? { start: now, end: now + 9e5 } : {}) }); set('gold/players/' + CODE, players); }
  if (GAME === 'bao-ve') { set('gold/quiz/' + CODE, q); set('gold/sessions/' + CODE, { ...base, dur: 15, status, ts: 2, ini: 0, extra: 0, game: 'bao-ve' }); set('gold/players/' + CODE, players); }
  if (GAME === 'chay-dua') { set('race/quiz/' + CODE, q); set('race/sessions/' + CODE, { ...base, status, game: 'chay-dua' }); set('race/players/' + CODE, players); }
  if (GAME === 'kho-bau') {
    set('sessions/' + CODE, { ...base, mode: 'online', start: now, status, dur: 45, end: now + 120 * 60000, k: 4, m: 5, q, seed: 12345, pt: 'mix', live: true, game: 'kho-bau', ...(status === 'running' ? { startAt: now, end: now + 45 * 60000 } : {}) });
    for (let i = 0; i < N; i++) { set('results/' + CODE + '/p' + i, { id: 'p' + i, name: 'Học sinh ' + i, av: AV[i % AV.length], ok: i % 7, bad: i % 3, gold: 100 + i, done: false, code: CODE, log: Array.from({ length: 12 }, (_, k) => ({ i: k, o: k % 2 == 0 })) }); set('live/' + CODE + '/p' + i, { n: 'Học sinh ' + i, a: AV[i % AV.length], p: i % 4, s: i % 6, g: 100 + i, z: 0 }); }
  }
}
const SK = { 'doi-vang': 'goldgame', 'bao-ve': 'kingdomgame', 'chay-dua': 'raceGame', 'kho-bau': 'mgsave' };
const URLP = { 'doi-vang': 'games/doi-vang/index.html', 'bao-ve': 'games/bao-ve/index.html', 'chay-dua': 'games/chay-dua/index.html?code=' + CODE, 'kho-bau': 'games/kho-bau/index.html' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MB = b => (b / 1048576).toFixed(2);

(async () => {
  const browser = await chromium.launch();
  const status0 = 'waiting';
  seed(status0);
  const ctxs = [], pages = [];
  for (let i = 0; i < R; i++) {
    const ctx = await browser.newContext(); await wire(ctx, 'c' + i);
    const val = GAME === 'kho-bau' ? { code: CODE, rt: 'r', id: 'p' + i, name: 'Học sinh ' + i, av: AV[i % AV.length] } : { code: CODE, rt: 'r', id: 'p' + i };
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, [SK[GAME], val]);
    const pg = await ctx.newPage(); pg.on('pageerror', e => { if (process.env.DEBUG) console.log('pageerror', i, e.message); });
    pages.push(pg); ctxs.push(ctx);
  }
  phase = 'load';
  await Promise.all(pages.map(p => p.goto('http://localhost:' + BASE + '/' + URLP[GAME]).catch(() => {})));
  await sleep(+(process.env.LOADW||12)*1000);
  phase = 'reload'; await Promise.all(pages.map(p => p.reload().catch(() => {}))); await sleep(+(process.env.LOADW||12)*1000);
  const loadBytes = Object.values(stats.load || {}).reduce((a, x) => a + x.bytes, 0);
  phase = 'lobby'; await sleep(WAIT * 1000);
  /* chuyển sang đang chơi */
  const now = Date.now();
  if (GAME === 'doi-vang') set('gold/sessions/' + CODE + '/status', 'running'), set('gold/sessions/' + CODE + '/start', now), set('gold/sessions/' + CODE + '/end', now + 9e5);
  if (GAME === 'chay-dua') set('race/sessions/' + CODE + '/status', 'running');
  if (GAME === 'kho-bau') { set('sessions/' + CODE + '/status', 'running'); set('sessions/' + CODE + '/startAt', now); set('sessions/' + CODE + '/end', now + 45 * 60000); }
  if (GAME === 'bao-ve') { /* cần chia đội: chỉ đo phòng chờ */ }
  await sleep(4000);
  phase = 'play';
  /* mô phỏng học sinh khác trả lời: ~3 lượt ghi/giây */
  const mut = setInterval(() => { const i = Math.random() * N | 0; const pre = GAME === 'kho-bau' ? 'results/' + CODE + '/p' : (GAME === 'chay-dua' ? 'race/players/' + CODE + '/p' : 'gold/players/' + CODE + '/p'); const cur = get(pre + i); if (cur) { cur.ok = (cur.ok | 0) + 1; cur.pos = (cur.pos | 0) + 0; cur.gold = (cur.gold | 0) + 10; } if (GAME === 'kho-bau') { const l = get('live/' + CODE + '/p' + i); if (l) l.s = (l.s | 0) + 1; } }, 300);
  await sleep(PLAY * 1000);
  clearInterval(mut);
  try{ console.log('[DOM] '+JSON.stringify((await pages[0].evaluate(()=>document.body.innerText)).replace(/\s+/g,' ').slice(0,140))+' | Quota: '+JSON.stringify(await pages[0].evaluate(()=>window.Quota&&Quota.stats))); }catch(e){console.log('[DOM] err '+e.message)}
  await browser.close();
  const out = { game: GAME, N, R, WAIT, PLAY, loadBytes, phases: {} };
  for (const ph of ['load', 'reload', 'lobby', 'play']) {
    const st = stats[ph] || {}, tot = Object.values(st).reduce((a, x) => ({ n: a.n + x.n, bytes: a.bytes + x.bytes }), { n: 0, bytes: 0 });
    out.phases[ph] = { tot, cats: st };
  }
  const secs = { lobby: WAIT, play: PLAY };
  console.log('\n=== ' + GAME + '  (N=' + N + ' học sinh, đo ' + R + ' trình duyệt thật, nhân lên N) @' + BASE + ' ===');
  for (const ph of ['load', 'reload', 'lobby', 'play']) {
    const { tot, cats } = out.phases[ph];
    const perClient = tot.bytes / R;
    if (ph === 'load' || ph === 'reload') { console.log((ph === 'load' ? 'Vào phòng lần đầu' : 'Tải lại trang / vào lại') + ' (câu hỏi + ảnh): ' + MB(perClient) + ' MB / học sinh → cả lớp ' + MB(perClient * N) + ' MB'); continue; }
    const rate = perClient / secs[ph];            // B/s mỗi học sinh
    console.log((ph === 'lobby' ? 'Phòng chờ' : 'Đang chơi') + ': ' + (rate / 1024).toFixed(1) + ' KB/s mỗi học sinh · ' + (tot.n / R / secs[ph]).toFixed(2) + ' req/s · cả lớp ' + MB(rate * N * 3600) + ' MB/giờ');
    Object.entries(cats).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 5).forEach(([k, v]) => console.log('     ' + k.padEnd(22) + String(v.n).padStart(6) + ' req  ' + (v.bytes / 1024 / R).toFixed(0).padStart(7) + ' KB/client'));
  }
  require('fs').writeFileSync(process.env.OUT || ('/tmp/res-' + GAME + '-' + BASE + '.json'), JSON.stringify(out));
})();
