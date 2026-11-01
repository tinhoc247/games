/* ==========================================================================
   hub.js – lõi dùng chung cho dashboard (admin.html) và cổng học sinh (index.html)

   1. Kết nối Firebase (cùng Realtime Database với 3 game, không cần đổi Rules)
   2. DANH SÁCH GAME  → muốn thêm game mới chỉ cần thêm 1 mục vào GAMES (xem HUONG-DAN.md)
   3. Lấy ngân hàng câu hỏi từ thư viện chung, tạo mã, tra mã
   ========================================================================== */
(function () {
  'use strict';

  const FB = {
    apiKey: 'AIzaSyD3hT273CawvQGlKMSHNbvhKzlqh9V_F2k',
    databaseURL: 'https://minigame-70bef-default-rtdb.asia-southeast1.firebasedatabase.app',
    adminEmail: 'sparklv12026@gmail.com'
  };
  const DB = FB.databaseURL.replace(/\/$/, '');
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const rid = n => Array.from({ length: n }, () => ALPHA[Math.random() * 31 | 0]).join('');
  const S = { tok: null, rt: null, me: null, admin: false, pw: null };

  /* ---------- Firebase (REST, giống cách 3 game đang dùng) ---------- */
  function authError(m) {
    if (/INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND/.test(m || '')) return 'Mật khẩu chưa đúng.';
    if (/TOO_MANY_ATTEMPTS/.test(m || '')) return 'Nhập sai nhiều lần. Chờ vài phút rồi thử lại.';
    return m || 'Không đăng nhập được.';
  }
  async function auth() {
    const body = S.admin ? { email: FB.adminEmail, password: S.pw, returnSecureToken: true } : { returnSecureToken: true };
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:' + (S.admin ? 'signInWithPassword' : 'signUp') + '?key=' + FB.apiKey, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!r.ok) throw Error(authError(j.error && j.error.message));
    S.tok = j.idToken; S.rt = j.refreshToken; S.me = j.localId;
  }
  async function refresh() {
    if (!S.rt) return auth();
    const r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + FB.apiKey, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(S.rt)
    });
    const j = await r.json();
    if (!r.ok) return auth();
    S.tok = j.id_token; S.rt = j.refresh_token;
  }
  /* fb(đường dẫn, phương thức, dữ liệu, query thêm) */
  let AP = null;                                  /* nhiều request song song chỉ đăng nhập 1 lần */
  const ensureAuth = () => AP || (AP = auth().finally(() => { AP = null; }));
  const warm = () => S.tok ? Promise.resolve() : ensureAuth().catch(() => {});
  async function fb(p, m, b, q, again) {
    if (!S.tok) await ensureAuth();
    const r = await fetch(DB + '/' + p + '.json?' + (q ? q + '&' : '') + 'auth=' + S.tok, {
      method: m || 'GET', headers: { 'Content-Type': 'application/json' },
      body: b === undefined ? undefined : JSON.stringify(b)
    });
    if (r.status === 401 && !again) { await refresh(); return fb(p, m, b, q, 1); }
    if (!r.ok) {
      let e = ''; try { const j = await r.json(); e = j && j.error || ''; } catch (_) {}
      throw Error(r.status === 401 || r.status === 403
        ? 'Không có quyền truy cập dữ liệu (' + (e || r.status) + '). Kiểm tra Rules của Realtime Database và việc đăng nhập.'
        : 'Database ' + r.status + (e ? ': ' + e : ''));
    }
    return r.json();
  }

  /* ---------- Đăng nhập admin (1 lần, các game tự nhận lại qua sessionStorage) ---------- */
  async function login(pw) {
    S.admin = true; S.pw = pw; S.tok = null; S.rt = null;
    try { await auth(); } catch (e) { S.admin = false; S.pw = null; throw e; }
    try { sessionStorage.setItem('hubPw', pw); localStorage.setItem('hubPwL', JSON.stringify({ p: pw, t: Date.now() + 432e5 })); } catch (_) {}
  }
  async function restore() {
    let pw = null; try { const j = JSON.parse(localStorage.getItem('hubPwL') || 'null'); if (j && j.p && j.t > Date.now()) pw = j.p; } catch (_) {} if (!pw) { try { pw = sessionStorage.getItem('hubPw'); } catch (_) {} }
    if (!pw) return false;
    try { await login(pw); return true; } catch (_) { try { sessionStorage.removeItem('hubPw'); localStorage.removeItem('hubPwL'); } catch (__) {} return false; }
  }
  function logout() { try { sessionStorage.removeItem('hubPw'); localStorage.removeItem('hubPwL'); } catch (_) {} S.tok = S.rt = S.me = S.pw = null; S.admin = false; }

  /* ==========================================================================
     DANH SÁCH GAME
     Mỗi game khai báo:
       id, name, icon, tone, blurb   – hiển thị trên dashboard
       dir                           – thư mục chứa game (trang học sinh = dir + 'index.html')
       ns                            – "vùng" Firebase của game: '' (gốc) hoặc 'gold/'
                                       → phiên chơi nằm ở  <ns>sessions/<mã>, câu hỏi ở <ns>quiz/<mã>
       match(keys)                   – nhận ra phiên của game này từ danh sách tên trường (dự phòng
                                       cho mã tạo trực tiếp trong trang admin của game, chưa có trường game)
       options[]                     – các ô cài đặt hiện ở bước 3 (dashboard tự vẽ form từ đây)
       create(ctx)                   – ghi phiên chơi lên Firebase, trả về { control: 'đường dẫn phòng điều khiển' }
     ========================================================================== */
  const dt = ms => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

  const GAMES = [
    {
      id: 'kho-bau', name: 'Truy Tìm Kho Báu', icon: '🗺️', tone: '#1D7A8C',
      blurb: 'Đi qua các trạm trả lời câu hỏi để tìm kho báu. Chơi online cùng lớp hoặc làm bài tập về nhà.',
      dir: 'games/kho-bau/', ns: '',
      match: k => !!(k.q || k.seed),
      options: [
        { key: 'mode', label: 'Chế độ', type: 'select', def: 'online', choices: [['online', 'Online: cả lớp cùng chơi, có xếp hạng'], ['offline', 'Offline: bài tập về nhà, có báo cáo']] },
        { key: 'dur', label: 'Thời gian chơi (phút)', type: 'number', def: 45, min: 1, showIf: o => o.mode === 'online' },
        { key: 'from', label: 'Mở từ', type: 'datetime', def: () => dt(Date.now()), showIf: o => o.mode === 'offline' },
        { key: 'to', label: 'Đóng lúc', type: 'datetime', def: () => dt(Date.now() + 7 * 864e5), showIf: o => o.mode === 'offline' },
        { key: 'k', label: 'Số hướng', type: 'select', def: '4', choices: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] },
        { key: 'm', label: 'Trạm mỗi hướng', type: 'number', def: 5, min: 1 },
        { key: 'pt', label: 'Lối đi', type: 'select', def: 'mix', choices: [['mix', 'Ngẫu nhiên'], ['grass', 'Cỏ xanh'], ['stone', 'Đá']] },
        { key: 'live', label: 'Người chơi thấy nhau di chuyển', type: 'checkbox', def: true, showIf: o => o.mode === 'online' }
      ],
      async create(c) {
        const o = c.o, on = o.mode === 'online';
        let st = c.now, en = c.now + (on ? 120 : o.dur) * 60000, dm = Math.max(1, +o.dur || 45);
        if (!on) {
          st = new Date(o.from).getTime(); en = new Date(o.to).getTime();
          if (!(st > 0) || !(en > 0)) throw Error('Chọn thời điểm mở và đóng cho bài tập.');
          if (en <= st) throw Error('Thời điểm đóng phải sau thời điểm mở.');
          if (en <= c.now) throw Error('Thời điểm đóng đã qua.');
          dm = Math.max(1, Math.round((en - st) / 60000));
        }
        await fb('sessions/' + c.code, 'PUT', {
          code: c.code, title: c.title, mode: o.mode, start: st, status: on ? 'waiting' : 'running', dur: dm, end: en,
          k: +o.k || 4, m: Math.max(1, +o.m || 5), q: c.qs, admin: c.me, lib: c.bank.id, nq: c.nq,
          seed: Math.random() * 2147483647 | 0, pt: o.pt || 'mix', live: !!o.live, game: 'kho-bau'
        });
        return { control: 'admin.html?' + (on ? 'ctl=' : 'rep=') + c.code };
      }
    },
    {
      id: 'doi-vang', name: 'Đổi Vàng', icon: '🪙', tone: '#C98A00',
      blurb: 'Trả lời đúng để nhận vàng, mở rương và đổi quà. Mỗi bạn một nhân vật.',
      dir: 'games/doi-vang/', ns: 'gold/', fallback: true,
      match: k => !k.ts && !k.ini,
      options: [
        { key: 'dur', label: 'Thời gian chơi (phút)', type: 'number', def: 15, min: 1 }
      ],
      async create(c) {
        await fb('gold/quiz/' + c.code, 'PUT', c.qs);
        await fb('gold/sessions/' + c.code, 'PUT', {
          code: c.code, title: c.title, dur: Math.max(1, +c.o.dur || 15), status: 'waiting', nq: c.nq, extra: 0,
          admin: c.me, created: c.now, lib: c.bank.id, game: 'doi-vang'
        });
        return { control: 'admin.html?ctl=' + c.code };
      }
    },
    {
      id: 'bao-ve', name: 'Bảo vệ vương quốc', icon: '🏰', tone: '#7A3FA0',
      blurb: 'Các đội xây khiên, rèn kiếm để giữ thành và bắt thành viên đội khác. Thầy cô chia đội trong phòng điều khiển.',
      dir: 'games/bao-ve/', ns: 'gold/',
      match: k => !!(k.ts || k.ini),
      options: [
        { key: 'dur', label: 'Thời gian chơi (phút)', type: 'number', def: 15, min: 1 }
      ],
      async create(c) {
        await fb('gold/quiz/' + c.code, 'PUT', c.qs);
        await fb('gold/sessions/' + c.code, 'PUT', {
          code: c.code, title: c.title, dur: Math.max(1, +c.o.dur || 15), status: 'waiting', ts: 2, ini: 0, nq: c.nq, extra: 0,
          admin: c.me, created: c.now, lib: c.bank.id, game: 'bao-ve'
        });
        return { control: 'admin.html?ctl=' + c.code };
      }
    }
    ,{
      id: 'chay-dua', name: 'Chạy đua', icon: '🏁', tone: '#E8590C',
      blurb: 'Cả lớp chạy đua online: trả lời đúng để tiến bước, đến mỗi 3 câu đúng (3, 6, 9, 12, …) nhận năng lực kéo lùi hoặc đóng băng đối thủ. Không tính thời gian.',
      dir: 'games/chay-dua/', ns: 'race/',
      match: k => !!k.game,
      options: [],
      async create(c) {
        await fb('race/quiz/' + c.code, 'PUT', c.qs);
        await fb('race/sessions/' + c.code, 'PUT', {
          code: c.code, title: c.title, status: 'waiting', nq: c.nq,
          admin: c.me, created: c.now, lib: c.bank.id, game: 'chay-dua'
        });
        return { control: 'admin.html?ctl=' + c.code };
      }
    }
    /* ---- MẪU THÊM GAME MỚI (bỏ comment, sửa lại) ----
    ,{
      id: 'ten-game', name: 'Tên game', icon: '🎲', tone: '#2A6F4E',
      blurb: 'Mô tả ngắn 1 câu.',
      dir: 'games/ten-game/', ns: 'ten-game/',
      match: k => !!k.game,
      options: [ { key: 'dur', label: 'Thời gian (phút)', type: 'number', def: 20, min: 1 } ],
      async create(c) {
        await fb('ten-game/quiz/' + c.code, 'PUT', c.qs);
        await fb('ten-game/sessions/' + c.code, 'PUT', { code: c.code, title: c.title, dur: +c.o.dur, status: 'waiting',
          nq: c.nq, admin: c.me, created: c.now, lib: c.bank.id, game: 'ten-game' });
        return { control: 'admin.html?ctl=' + c.code };
      }
    } */
  ];

  /* ---------- Thư viện câu hỏi: MỘT nơi lưu duy nhất ở gốc Firebase ----------
     lib/<id> = thông tin bộ, libq/<id> = câu hỏi (chuỗi JSON), libimg/<id>/<key> = ảnh.
     Cả 3 game dùng chung; phiên chơi vẫn nằm ở vùng riêng của game (sessions/ hoặc gold/sessions/). */
  const BK = 'hubBanks', BK_TTL = 120e3;
  const bankCacheDrop = () => { try { sessionStorage.removeItem(BK); } catch (_) {} };
  async function listBanks(force) {
    const errs = [], out = [];
    if (!force) { try { const c = JSON.parse(sessionStorage.getItem(BK) || 'null'); if (c && Date.now() - c.t < BK_TTL) return { banks: c.banks, errors: [] }; } catch (_) {} }
    try {
      const v = (await fb('lib')) || {};
      Object.entries(v).forEach(([id, x]) => { if (x && x.name) out.push({ ns: '', id, name: x.name, nq: x.nq | 0, ni: x.ni | 0, created: x.created | 0, src: 'Thư viện chung' }); });
    } catch (e) { errs.push('Thư viện: ' + e.message); }
    out.sort((a, b) => b.created - a.created);
    if (!errs.length) { try { sessionStorage.setItem(BK, JSON.stringify({ t: Date.now(), banks: out })); } catch (_) {} }
    return { banks: out, errors: errs };
  }
  /* Đổi tên bộ câu hỏi trong thư viện chung (chỉ sửa lib/<id>/name). */
  async function renameBank(id, name) {
    if (!S.admin) throw Error('Cần đăng nhập admin.');
    name = String(name || '').trim().slice(0, 80);
    if (!name) throw Error('Tên bộ không được để trống.');
    if (!id || typeof (await fb('lib/' + id + '/name')) !== 'string') throw Error('Bộ này không còn trong thư viện (có thể đã bị xoá).');
    await fb('lib/' + id + '/name', 'PUT', name);
    await fb('lib/' + id + '/edited', 'PUT', Date.now());
    bankCacheDrop();
    return name;
  }
  /* Xoá hẳn một bộ khỏi hệ thống lưu trữ: ảnh, câu hỏi, rồi thông tin bộ (xoá lib SAU CÙNG để lỡ lỗi giữa chừng vẫn bấm xoá lại được). */
  async function deleteBank(id) {
    if (!S.admin) throw Error('Cần đăng nhập admin.');
    if (!id) throw Error('Không rõ bộ cần xoá.');
    for (const p of ['libimg', 'libq', 'lib']) await fb(p + '/' + id, 'DELETE');
    bankCacheDrop();
  }
  async function loadQs(bank) {
    const qs = await fb('libq/' + bank.id);
    if (typeof qs !== 'string') throw Error('Không đọc được câu hỏi của bộ “' + bank.name + '” (có thể đã bị xoá).');
    let a; try { a = JSON.parse(qs); } catch (_) { throw Error('Bộ câu hỏi bị lỗi định dạng.'); }
    if (!Array.isArray(a) || !a.length) throw Error('Bộ câu hỏi đang trống.');
    return { qs, nq: a.length };
  }


  /* ---------- Nạp bộ câu hỏi mới THẲNG vào thư viện chung (không cần chọn game) ----------
     Cùng định dạng file và cách lưu ảnh với trang admin của 3 game:
     Excel/CSV (cột: Câu hỏi, A–D, Đáp án, Ảnh; hoặc JSON ở cột thứ 9) hoặc JSON (mảng câu hỏi / {questions:[]}).
     Ghi ra lib/<id> (thông tin), libq/<id> (câu hỏi), libimg/<id>/<key> (ảnh). */
  const IMG_BASE = 'https://cdn.jsdelivr.net/gh/tinhoc247/ic3-images@main/';
  const repoUrl = s => { s = String(s || '').trim().replace(/\\/g, '/').replace(/^\.?\//, ''); if (!/^image\//i.test(s)) s = 'image/' + s.split('/').pop(); return IMG_BASE + encodeURI(s); };
  const nm = s => { let f = String(s).split(/[\\/]/).pop(); try { f = decodeURIComponent(f); } catch (_) {} return f.toLowerCase(); };

  function parseJ(s) {                         /* JSON có chú thích // và dấu phẩy thừa */
    let o = '', q = false, i = 0;
    for (; i < s.length; i++) {
      const c = s[i];
      if (q) { o += c; if (c == '\\') o += s[++i]; else if (c == '"') q = false; }
      else if (c == '"') { q = true; o += c; }
      else if (c == '/' && s[i + 1] == '/') { while (i < s.length && s[i] != '\n') i++; o += '\n'; }
      else o += c;
    }
    return JSON.parse(o.replace(/,\s*([\]}])/g, '$1'));
  }
  function toQ(r) {                            /* 1 dòng Excel → câu 1 đáp án */
    r = r.map(x => x == null ? '' : String(x).trim());
    const o = r.slice(1, 5).filter(Boolean), a = r[5]; let i = -1;
    if (/^[A-Da-d]$/.test(a)) i = a.toUpperCase().charCodeAt(0) - 65; else if (/^[1-4]$/.test(a)) i = +a - 1; else i = o.findIndex(x => x == a);
    return (!r[0] || o.length < 2 || i < 0 || i >= o.length) ? null : { type: 'single', question: r[0], options: o, answer: i, image: r[6] || '' };
  }
  const arr = Array.isArray;
  function validQ(x) {                         /* cùng điều kiện nhận câu với các game */
    if (!x || typeof x !== 'object') return false;
    switch (x.type) {
      case 'single': case 'multiple': return arr(x.options);
      case 'dragfill': case 'selectfill': return true;
      case 'list': case 'classify': case 'classify2': case 'ordering': return arr(x.items);
      case 'matching': return arr(x.left) && arr(x.right) && x.correctMap != null;
      case 'position': return true;
      case 'imagepoint': return arr(x.points);
      default: return false;
    }
  }
  function loadScript(src) {
    return new Promise((ok, no) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = () => no(Error('Không tải được thư viện đọc Excel (kiểm tra mạng).')); document.head.appendChild(e); });
  }
  /* Đọc file → dữ liệu thô { json:[...] } hoặc { rows:[[...]] } */
  async function readQFile(f) {
    if (/\.json$/i.test(f.name)) { const j = JSON.parse(await f.text()); return { json: arr(j) ? j : (j.questions || []) }; }
    if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const wb = XLSX.read(await f.arrayBuffer());
    return { rows: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) };
  }
  /* Dữ liệu thô → danh sách câu hợp lệ. onlyYes: bỏ dòng cột B = "Không" (kiểu file xuất có cột Có/Không + JSON ở cột 9) */
  function buildQs(raw, onlyYes) {
    let list = [], total = 0;
    if (raw.json) raw.json.forEach(x => { total++; list.push(x && x.type ? x : toQ([x && (x.q || x.question), ...(((x && (x.options || x.o)) || []).concat(['', '', '', '']).slice(0, 4)), x && (x.answer ?? x.a), x && (x.image || x.img)])); });
    else {
      let first = true;
      raw.rows.forEach(r => {
        if (!arr(r) || !r.some(c => c != null && String(c).trim() !== '')) return;
        const head = first; first = false;
        const js = r[8];
        if (typeof js == 'string' && js.trim()[0] == '{') {
          if (onlyYes && String(r[1]).trim() == 'Không') return;
          total++; try { list.push(parseJ(js)); } catch (_) {}
        } else {
          const q = toQ(r);
          if (head && !q) return;               /* dòng tiêu đề (Câu hỏi, A, B…) không tính là câu lỗi */
          total++; list.push(q);
        }
      });
    }
    const items = list.filter(validQ);
    return { items, total, skipped: Math.max(0, total - items.length) };
  }
  function imgPaths(items) {
    const s = new Set();
    items.forEach(x => {
      [x.image, x.preImage].forEach(v => { if (v && typeof v == 'string' && !/^(data:|lib:|https?:)/.test(v)) s.add(v); });
      const oi = x.optionImages; if (oi) Object.values(oi).forEach(o => { const v = o && (o.src || o); if (typeof v == 'string' && v && !/^(data:|lib:|https?:)/.test(v)) s.add(v); });
    });
    return [...s];
  }
  /* Thư mục ảnh người dùng chọn → bảng tra theo tên file (không phân biệt hoa thường, có/không đuôi) */
  function indexImages(files) {
    const IM = {};
    [...files].forEach(f => {
      if (!/^image\//.test(f.type) && !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.name)) return;
      const u = URL.createObjectURL(f), n = f.name.toLowerCase(), b = '~' + n.replace(/\.[^.]+$/, '');
      IM[n] = u; IM[b] = IM[b] || u;
    });
    return IM;
  }
  const findImg = (IM, p) => IM[nm(p)] || IM['~' + nm(p).replace(/\.[^.]+$/, '')];
  async function packImg(src) {                /* thu nhỏ ảnh về tối đa 1280px trước khi lưu */
    let b; try { b = await (await fetch(src)).blob(); } catch (_) { throw Error('Không đọc được 1 ảnh'); }
    const rd = () => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
    if (/svg/.test(b.type) || (/gif/.test(b.type) && b.size < 500000)) return rd();
    try {
      const bmp = await createImageBitmap(b), k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const x = c.getContext('2d');
      if (b.type == 'image/png') { x.drawImage(bmp, 0, 0, c.width, c.height); const p = c.toDataURL('image/png'); if (p.length < 600000) return p; }
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', .82);
    } catch (_) { return rd(); }
  }
  function thumb(src, w = 360, h = 225) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(Error('timeout')), 5000), im = new Image();
      im.onload = () => { clearTimeout(t); try { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), k = Math.max(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k; x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh); res(c.toDataURL('image/jpeg', .72)); } catch (e) { rej(e); } };
      im.onerror = () => { clearTimeout(t); rej(Error('img')); };
      im.src = src;
    });
  }
  /* Lưu 1 bộ vào thư viện chung. Ghi lib/ SAU CÙNG: có trong danh sách = đã đủ câu hỏi và ảnh. */
  async function saveBank(a) {
    if (!S.admin) throw Error('Cần đăng nhập admin.');
    const items = a.items || []; if (!items.length) throw Error('Chưa có câu hỏi hợp lệ để lưu.');
    const prog = a.progress || (() => {}), IM = a.images || {};
    const q = JSON.parse(JSON.stringify(items)), id = rid(8), bySrc = {}, imgs = [], cache = {};
    const ref = p => {
      if (!p || typeof p != 'string' || /^(lib:|https?:)/.test(p)) return p;
      if (cache[p] !== undefined) return cache[p];
      const src = /^(data|blob):/.test(p) ? p : findImg(IM, p);
      if (!src) return cache[p] = repoUrl(p);                 /* không có trong thư mục ảnh → lấy từ kho ảnh chung */
      if (!bySrc[src]) { const key = 'i' + imgs.length; imgs.push({ key, src }); bySrc[src] = 'lib:' + id + ':' + key; }
      return cache[p] = bySrc[src];
    };
    q.forEach(o => {
      for (const k of ['image', 'preImage']) if (o[k]) o[k] = ref(o[k]);
      const oi = o.optionImages;
      if (oi) Object.keys(oi).forEach(i => { const v = oi[i]; if (typeof v == 'string') oi[i] = ref(v); else if (v && v.src) v.src = ref(v.src); });
    });
    let n = 0;
    for (let i = 0; i < imgs.length; i += 4)
      await Promise.all(imgs.slice(i, i + 4).map(async m => { const d = await packImg(m.src); await fb('libimg/' + id + '/' + m.key, 'PUT', d); prog('Đang lưu ảnh ' + (++n) + '/' + imgs.length + '…'); }));
    prog('Đang lưu câu hỏi…');
    await fb('libq/' + id, 'PUT', JSON.stringify(q));
    let cover = ''; if (imgs.length) { try { cover = await thumb(imgs[0].src); } catch (_) {} }
    const info = { name: (a.name || 'Bộ câu hỏi').trim().slice(0, 80), nq: q.length, ni: imgs.length, created: Date.now(), edited: Date.now(), plays: 0, cover, admin: S.me };
    await fb('lib/' + id, 'PUT', info);
    bankCacheDrop();
    return { ns: '', id, name: info.name, nq: info.nq, ni: info.ni, created: info.created, src: 'Thư viện chung' };
  }

  /* ---------- Chuyển thư viện cũ gold/lib* về thư viện chung (chạy 1 lần, an toàn chạy lại) ---------- */
  async function legacyCount() {
    const v = await fb('gold/lib', 'GET', undefined, 'shallow=true');
    return v && typeof v === 'object' ? Object.keys(v).length : 0;
  }
  async function migrateLegacy(progress, removeOld) {
    const ids = Object.keys((await fb('gold/lib', 'GET', undefined, 'shallow=true')) || {});
    const rootIds = new Set(Object.keys((await fb('lib', 'GET', undefined, 'shallow=true')) || {}));
    const r = { moved: 0, skipped: [], images: 0 };
    for (let n = 0; n < ids.length; n++) {
      const id = ids[n];
      if (progress) progress('Đang chuyển bộ ' + (n + 1) + '/' + ids.length + '…');
      if (rootIds.has(id)) { r.skipped.push(id); continue; }          /* trùng mã (rất hiếm): giữ bản ở gốc */
      const [info, qs] = await Promise.all([fb('gold/lib/' + id), fb('gold/libq/' + id)]);
      if (!info || typeof qs !== 'string') { r.skipped.push(id); continue; }
      const keys = Object.keys((await fb('gold/libimg/' + id, 'GET', undefined, 'shallow=true')) || {});
      for (let i = 0; i < keys.length; i += 3) {
        await Promise.all(keys.slice(i, i + 3).map(async k => {
          const d = await fb('gold/libimg/' + id + '/' + k);
          if (d != null) await fb('libimg/' + id + '/' + k, 'PUT', d);
        }));
        if (progress) progress('Bộ ' + (n + 1) + '/' + ids.length + ': ảnh ' + Math.min(i + 3, keys.length) + '/' + keys.length + '…');
      }
      await fb('libq/' + id, 'PUT', qs);
      await fb('lib/' + id, 'PUT', info);                              /* ghi lib sau cùng: có trong danh sách = đã đủ dữ liệu */
      bankCacheDrop();
      r.moved++; r.images += keys.length;
      if (removeOld) for (const p of ['libimg', 'libq', 'lib']) await fb('gold/' + p + '/' + id, 'DELETE');
    }
    return r;
  }

  /* ---------- Tạo mã ---------- */
  async function freeCode() {
    for (let i = 0; i < 8; i++) {
      const c = rid(5);
      const [a, b, d] = await Promise.all([fb('gold/sessions/' + c, 'GET', undefined, 'shallow=true'), fb('sessions/' + c, 'GET', undefined, 'shallow=true'), fb('race/sessions/' + c, 'GET', undefined, 'shallow=true').catch(() => null)]);
      if (a == null && b == null && d == null) return c;
    }
    throw Error('Không tìm được mã trống, thử lại.');
  }
  async function createSession(a) {
    const g = GAMES.find(x => x.id === a.gameId);
    if (!g) throw Error('Chưa chọn game.');
    if (!a.bank) throw Error('Chưa chọn bộ câu hỏi.');
    if (!S.admin) throw Error('Cần đăng nhập admin.');
    const { qs, nq } = await loadQs(a.bank);
    if (a.progress) a.progress('Đang tạo mã…');
    const code = await freeCode();
    const title = (a.title || '').trim() || a.bank.name + ' ' + new Date().toLocaleDateString('vi-VN');
    const res = await g.create({ code, qs, nq, title, o: a.opts || {}, bank: a.bank, me: S.me, now: Date.now() });
    try {
      const p = await fb('lib/' + a.bank.id + '/plays');
      await fb('lib/' + a.bank.id + '/plays', 'PUT', (p | 0) + 1);
    } catch (_) {}
    const item = { code, game: g.id, title, control: g.dir + res.control, t: Date.now() };
    remember(item);
    return item;
  }

  /* ---------- Danh sách mã gần đây (lưu trên máy này) ---------- */
  function recent() { try { return JSON.parse(localStorage.getItem('hubCodes') || '[]'); } catch (_) { return []; } }
  function remember(it) { try { const a = recent().filter(x => x.code !== it.code); a.unshift(it); localStorage.setItem('hubCodes', JSON.stringify(a.slice(0, 60))); } catch (_) {} }
  function forget(code) { try { localStorage.setItem('hubCodes', JSON.stringify(recent().filter(x => x.code !== code))); } catch (_) {} }
  async function codeStatus(it) {
    const g = GAMES.find(x => x.id === it.game); if (!g) return null;
    const [s, e] = await Promise.all([fb(g.ns + 'sessions/' + it.code + '/status'), fb(g.ns + 'sessions/' + it.code + '/end')]);
    if (s == null) return 'gone';
    if (s === 'ended' || (e && Date.now() > e + 3e5 && s === 'running')) return 'ended';
    return s;
  }


  /* ---------- Báo cáo: TẤT CẢ lượt chơi của mọi game (đọc từ Firebase, không phụ thuộc máy đang dùng) ---------- */
  function sessState(g, s) {
    const now = Date.now();
    if (g.id === 'kho-bau') {
      if (s.mode === 'offline') return now > s.end ? 'ended' : now < s.start ? 'waiting' : 'running';
      return s.status === 'ended' || (s.end && now > s.end + 3e5) ? 'ended' : s.status === 'running' ? 'running' : 'waiting';
    }
    return s.status === 'ended' || (s.status === 'running' && s.end && now >= s.end) ? 'ended' : s.status === 'running' ? 'running' : 'waiting';
  }
  /* Vùng gốc (Kho báu): mỗi phiên chứa cả bộ câu hỏi (q), tải hết sẽ rất nặng.
     Chỉ lấy vài trường tóm tắt; phiên đã kết thúc (không đổi nữa) được nhớ trên máy này. */
  const SC = 'hubSessSum';
  async function sessionsLight() {
    const codes = Object.keys((await fb('sessions', 'GET', undefined, 'shallow=true')) || {});
    let cache = {}; try { cache = JSON.parse(localStorage.getItem(SC) || '{}'); } catch (_) {}
    const out = {}, todo = [], FIELDS = ['title', 'mode', 'status', 'start', 'end', 'created'], kb = GAMES.find(g => g.id === 'kho-bau');
    codes.forEach(c => { if (cache[c]) out[c] = cache[c]; else todo.push(c); });
    for (let i = 0; i < todo.length; i += 6) {
      await Promise.all(todo.slice(i, i + 6).map(async c => {
        const v = await Promise.all(FIELDS.map(k => fb('sessions/' + c + '/' + k)));
        const s = { game: 'kho-bau' }; FIELDS.forEach((k, j) => { if (v[j] != null) s[k] = v[j]; });
        out[c] = s;
        if (sessState(kb, s) === 'ended') cache[c] = s;
      }));
    }
    try { const keep = {}; codes.forEach(c => { if (cache[c]) keep[c] = cache[c]; }); localStorage.setItem(SC, JSON.stringify(keep)); } catch (_) {}
    return out;
  }
  async function listSessions() {
    const errs = [], out = [];
    const seen = new Set();
    for (const ns of [...new Set(GAMES.map(g => g.ns))]) {
      let v = null;
      try { v = ns === '' ? await sessionsLight() : ((await fb(ns + 'sessions')) || {}); } catch (e) { errs.push((ns ? 'Vùng ' + ns : 'Vùng chung') + ': ' + e.message); continue; }
      Object.entries(v).forEach(([code, s]) => {
        if (!s || typeof s !== 'object') return;
        const keys = {}; Object.keys(s).forEach(k => keys[k] = 1);
        let g = s.game ? GAMES.find(x => x.id === s.game && x.ns === ns) : null;
        if (!g) g = GAMES.find(x => x.ns === ns && x.match(keys)) || GAMES.find(x => x.ns === ns && x.fallback) || GAMES.find(x => x.ns === ns);
        if (!g || seen.has(ns + code)) return;
        seen.add(ns + code);
        out.push({
          code, game: g.id, title: s.title || '', t: s.created || s.start || 0, state: sessState(g, s),
          mode: s.mode || '',
          /* kho-bau online → phòng điều khiển (ctl), còn lại → báo cáo (rep); game khác có cả hai */
          rep: g.dir + 'admin.html?rep=' + code,
          ctl: (g.id === 'kho-bau' && s.mode !== 'online') ? '' : g.dir + 'admin.html?ctl=' + code
        });
      });
    }
    out.sort((a, b) => b.t - a.t);
    return { sessions: out, errors: errs };
  }
  async function deleteSession(it) {
    if (!S.admin) throw Error('Cần đăng nhập admin.');
    const g = GAMES.find(x => x.id === it.game); if (!g) throw Error('Không rõ game.');
    /* xoá sạch mọi nhánh của mã; 'sessions' để CUỐI để nếu lỗi giữa chừng vẫn còn trong danh sách và bấm xoá lại được */
    const parts = g.id === 'kho-bau' ? ['results', 'live', 'sessions'] : g.id === 'chay-dua' ? ['players', 'logs', 'quiz', 'events', 'sessions'] : g.id === 'bao-ve' ? ['players', 'logs', 'quiz', 'moves', 'events', 'sessions'] : ['players', 'logs', 'quiz', 'events', 'sessions'];
    for (const p of parts) await fb(g.ns + p + '/' + it.code, 'DELETE');
    forget(it.code);
    /* Hết phiên của Đổi Vàng / Bảo vệ thì dọn luôn gold/ts (mỗi học sinh 1 mục giờ máy chủ, không gắn với mã) */
    if (g.ns === 'gold/') { try { const left = await fb('gold/sessions', 'GET', undefined, 'shallow=true'); if (!left || !Object.keys(left).length) await cleanTs(); } catch (_) {} }
  }
  /* Dọn gold/ts: an toàn, học sinh đang chơi chỉ ghi lại mục này khi vào phòng/nối lại. */
  async function cleanTs() {
    if (!S.admin) throw Error('Cần đăng nhập admin.');
    await fb('gold/ts', 'DELETE');
  }

  /* ---------- Tra mã cho học sinh: mã này thuộc game nào? ---------- */
  async function resolve(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(code)) return null;
    const spaces = [...new Set(GAMES.map(g => g.ns))];
    const found = await Promise.all(spaces.map(async ns => {
      const [keys, id] = await Promise.all([fb(ns + 'sessions/' + code, 'GET', undefined, 'shallow=true'), fb(ns + 'sessions/' + code + '/game').catch(() => null)]);
      if (!keys || typeof keys !== 'object') return null;
      let g = null;
      if (keys.game) g = GAMES.find(x => x.id === id && x.ns === ns) || null;   /* có ghi rõ game → chỉ tin đúng game đó, không đoán */
      else g = GAMES.find(x => x.ns === ns && x.match(keys)) || GAMES.find(x => x.ns === ns && x.fallback) || null;
      return g;
    }));
    const hit = found.filter(Boolean);
    /* Cùng một mã tồn tại ở 2 vùng dữ liệu (chỉ xảy ra khi mã tạo thẳng trong trang admin của game):
       không chọn bừa, báo để thầy cô tạo lại mã, tránh học sinh vào nhầm game. */
    if (hit.length > 1) { const e = Error('Mã này đang bị trùng giữa các game. Em báo thầy cô tạo mã mới nhé.'); e.dup = true; throw e; }
    const g = hit[0];
    return g ? { game: g, code, url: g.dir + 'index.html?code=' + code + '&ok=1' } : null;
  }

  /* Trang học sinh CHUNG cho mọi game: link chỉ khác nhau ở mã (?code=ABCDE). Game nào do mã quyết định (resolve). */
  const studentLink = (code) => { const u = new URL('index.html', location.href); if (code) u.searchParams.set('code', code); return u.href; };
  /* link có kèm game (g=...) thì biết ngay game nào, không cần tra mã trên mạng */
  const quick = (code, gid) => { const g = GAMES.find(x => x.id === gid); code = String(code || '').trim().toUpperCase(); return g && /^[A-Z0-9]{3,8}$/.test(code) ? { game: g, code, url: g.dir + 'index.html?code=' + code } : null; };

  window.Hub = { FB, GAMES, S, fb, warm, login, restore, logout, listBanks, legacyCount, migrateLegacy, createSession, recent, forget, codeStatus, resolve, quick, studentLink, rid,
    readQFile, buildQs, imgPaths, indexImages, findImg, saveBank, renameBank, deleteBank, listSessions, deleteSession, cleanTs };
})();
