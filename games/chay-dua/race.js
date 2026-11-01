/* ==========================================================================
   race.js – phần dùng chung của game Chạy đua (trang học sinh + trang admin)
   - Firebase REST (vùng riêng race/), âm thanh (WebAudio), avatar, xếp hạng, bảng tóm tắt
   ========================================================================== */
const RACE_CFG = {
  apiKey: 'AIzaSyD3hT273CawvQGlKMSHNbvhKzlqh9V_F2k',
  databaseURL: 'https://minigame-70bef-default-rtdb.asia-southeast1.firebasedatabase.app',
  adminEmail: 'sparklv12026@gmail.com'
};
const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RNS = 'race/';
const G = p => RNS + p;
const RACE_ADMIN = window.APPMODE === 'admin';
let TOK = null, RT = null, ME = null, ADMPW = null;
const FREEZE_MS = 3000;
const POWERS = {
  step:   { icon: '🚀', name: 'Tiến thêm 1 bước',        need: false, desc: 'Em được tiến thêm 1 bước ngay lập tức!' },
  back:   { icon: '⏪', name: 'Kéo lùi đối phương 1 bước', need: true,  desc: 'Chọn một bạn để kéo lùi 1 bước.' },
  freeze: { icon: '🧊', name: 'Đóng băng đối phương 3 giây', need: true, desc: 'Chọn một bạn để đóng băng trong 3 giây.' }
};
/* trả lời đúng (lần đầu) câu thứ 3, 6, 9, 12, 15… (mỗi bội số của 3) → nhận năng lực */

/* ---------- Firebase ---------- */
async function fbAuth() {
  const b = RACE_ADMIN ? { email: RACE_CFG.adminEmail, password: ADMPW, returnSecureToken: true } : { returnSecureToken: true };
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:' + (RACE_ADMIN ? 'signInWithPassword' : 'signUp') + '?key=' + RACE_CFG.apiKey,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const j = await r.json();
  if (!r.ok) {
    const m = (j.error && j.error.message) || '';
    throw Error(/INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND/.test(m) ? 'Mật khẩu chưa đúng.' : (m || 'Không đăng nhập được.'));
  }
  TOK = j.idToken; RT = j.refreshToken; ME = j.localId;
}
async function fbRefresh() {
  if (!RT) return fbAuth();
  const r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + RACE_CFG.apiKey, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(RT)
  });
  const j = await r.json();
  if (!r.ok) return fbAuth();
  TOK = j.id_token; RT = j.refresh_token;
  if (j.user_id) ME = j.user_id;
}
/* fb(đường dẫn, phương thức, dữ liệu, query thêm, lần thử lại) */
async function fb(p, m, b, q, again) {
  if (!TOK) await fbAuth();
  const r = await fetch(RACE_CFG.databaseURL.replace(/\/$/, '') + '/' + p + '.json?' + (q ? q + '&' : '') + 'auth=' + TOK, {
    method: m || 'GET', headers: { 'Content-Type': 'application/json' },
    body: b === undefined ? undefined : JSON.stringify(b)
  });
  if (r.status === 401 && !again) { await fbRefresh(); return fb(p, m, b, q, 1); }
  if (!r.ok) {
    let e = ''; try { const j = await r.json(); e = j && j.error || ''; } catch (_) {}
    throw Error(r.status === 401 || r.status === 403
      ? 'Không có quyền truy cập dữ liệu (' + (e || r.status) + '). Cần thêm Rules cho vùng "race" (xem HUONG-DAN.md của game Chạy đua).'
      : 'Database ' + r.status + (e ? ': ' + e : ''));
  }
  return r.json();
}
/* các sự kiện năng lực mới (key tăng dần theo thời gian), chỉ lấy từ key đã biết trở đi */
async function fbEvents(code, lastKey) {
  const q = 'orderBy=' + encodeURIComponent('"$key"') + (lastKey ? '&startAt=' + encodeURIComponent('"' + lastKey + '"') : '');
  return (await fb(G('events/' + code), 'GET', undefined, q)) || {};
}

/* ---------- Đếm ngược xuất phát đồng bộ (3-2-1-GO) ----------
   Mọi máy cùng đếm theo MỐC GIỜ MÁY CHỦ (session.startedAt) nên "GO!" xảy ra cùng lúc, câu đầu tiên hiện sau GO.
   startedAt + CD_LEAD = giây GO; 3 giây trước đó là 3-2-1; phần dư đầu là "Sẵn sàng" (đủ cho máy vào chậm nhịp cập nhật). */
const CD_LEAD = 5000, CD_GO = 900;
/* độ lệch đồng hồ máy này so với máy chủ: ghi một mốc giờ máy chủ rồi đọc lại */
async function fbClockOffset(path) {
  try {
    const t0 = Date.now(), r = await fb(path, 'PATCH', { ping: { '.sv': 'timestamp' } }), t1 = Date.now();
    return r && +r.ping > 0 ? +r.ping - (t0 + t1) / 2 : 0;
  } catch (_) { return 0; }
}
const raceInCountdown = (startAt, off) => !!startAt && Date.now() + off < startAt + CD_LEAD + CD_GO;
function raceCountdown(startAt, off, ov, n, done) {
  const goAt = startAt + CD_LEAD, endAt = goAt + CD_GO; let last = '', timer = null;
  const set = (txt, cls) => {
    n.textContent = txt; n.style.fontSize = cls === 'rdy' ? 'min(14vw,90px)' : ''; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
  };
  const frame = () => {
    const t = Date.now() + off, rem = goAt - t;
    if (t >= endAt) { ov.style.display = 'none'; return done(); }
    const k = rem > 3000 ? 'R' : rem > 2000 ? '3' : rem > 1000 ? '2' : rem > 0 ? '1' : 'GO!';
    if (k !== last) {
      last = k;
      if (k === 'R') set('Sẵn sàng…', 'rdy'); else set(k);
      if (k === 'GO!') Snd.go(); else if (k !== 'R') Snd.beep();
    }
    timer = setTimeout(frame, 40);
  };
  ov.style.display = 'flex'; frame();
  return () => clearTimeout(timer);
}

/* ---------- Avatar (emoji) ---------- */
const AVS = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🦆','🦉','🦄','🐝','🦋','🐌','🐞','🐢','🐍','🦖','🐙','🐠','🐬','🐳','🦈','🐘','🦒','🦀','🐊'];
const avOf = a => AVS.includes(a) ? a : '🐾';

/* ---------- Xếp hạng ---------- */
/* Về đích trước xếp trên (theo mốc giờ máy chủ); chưa về đích thì theo số bước, rồi theo số câu đúng */
function rankPlayers(P) {
  return Object.entries(P || {}).filter(([, v]) => v && v.name).map(([id, v]) => ({ id, ...v })).sort((a, b) => {
    const fa = a.fin > 0, fb_ = b.fin > 0;
    if (fa !== fb_) return fa ? -1 : 1;
    if (fa && fb_ && a.fin !== b.fin) return a.fin - b.fin;
    return (b.pos | 0) - (a.pos | 0) || (b.ok | 0) - (a.ok | 0) || String(a.name).localeCompare(String(b.name));
  });
}
const acc = r => { const t = (r.ok | 0) + (r.wq | 0); return t ? Math.round((r.ok | 0) * 100 / t) : 0; };

/* ---------- Bảng tóm tắt: xếp hạng, độ chính xác, câu hỏi cần lưu ý ---------- */
function hardList(LG) {
  const w = {};
  Object.values(LG || {}).forEach(a => {
    const seen = {};
    (a || []).forEach(x => {
      if (!x) return;
      const r = w[x.i] = w[x.i] || { n: 0, w: 0, wp: 0 };
      if (!x.o) { r.w++; if (!seen[x.i]) { seen[x.i] = 1; r.wp++; } }
    });
  });
  const players = Object.values(LG || {}).length || 1;
  return Object.entries(w).map(([i, r]) => ({ i: +i, w: r.w, wp: r.wp, p: Math.round(r.wp * 100 / players) })).filter(r => r.w > 0).sort((a, b) => b.wp - a.wp || b.w - a.w).slice(0, 6);
}
function sumHtml(P, LG, QS, nq, me) {
  const L = rankPlayers(P), md = ['🥇', '🥈', '🥉'], hard = hardList(LG);
  const qtext = i => { const x = QS && QS[i]; return ((x && (x.question || x.q || x.template)) || 'Câu ' + (i + 1)).toString().slice(0, 160); };
  return `<h3>🏆 Bảng xếp hạng</h3>
  <table class="sb"><tr><th>#</th><th>Người chơi</th><th>Quãng đường</th><th>Trả lời chính xác</th></tr>${L.map((r, i) => {
    const t = (r.ok | 0) + (r.wq | 0);
    return `<tr class="${r.id === me ? 'me' : ''}"><td>${md[i] || i + 1}</td><td>${avOf(r.av)} ${esc(r.name || '')}</td>
      <td>${r.fin > 0 ? '🏁 Về đích' : (r.pos | 0) + '/' + nq}</td><td>${r.ok | 0}/${t} (${acc(r)}%)</td></tr>`;
  }).join('') || '<tr><td colspan="4">Chưa có người chơi.</td></tr>'}</table>
  <p class="hint">Câu trả lời sai phải làm lại; câu làm lại không được tính là câu đúng.</p>
  <h3>❗ Câu hỏi cần lưu ý (sai nhiều)</h3>${hard.length ? hard.map(x => `<div class="hq"><div>${esc(qtext(x.i))}</div>
    <div class="bar" style="width:${Math.max(4, x.p)}%"></div><span class="hint">${x.wp} bạn làm sai (${x.p}%), tổng ${x.w} lượt sai</span></div>`).join('') : '<p class="hint">Chưa có câu nào bị sai.</p>'}`;
}

/* ---------- Đường đua (thanh tiến độ). opt: {me, nq, frozen:{id:true}} ---------- */
function trackHtml(P, nq, me, fz, onlyMe) {
  const L = rankPlayers(P).filter(r => !onlyMe || r.id === me), rows = Math.min(4, Math.max(1, L.length));
  const items = L.map((r, i) => {
    const pct = Math.min(1, (r.pos | 0) / Math.max(1, nq)), mine = r.id === me;
    return `<div class="rn${mine ? ' me' : ''}${fz && fz[r.id] ? ' fz' : ''}${r.fin > 0 ? ' fin' : ''}" style="left:calc(7% + ${(pct * 86).toFixed(2)}%);top:${(((i % rows) + 0.5) * 100 / rows).toFixed(2)}%" title="${esc(r.name || '')}">
      <span class="ra">${avOf(r.av)}</span>${mine ? '<b class="rl">Bạn</b>' : ''}${fz && fz[r.id] ? '<i class="ri">❄️</i>' : ''}</div>`;
  }).join('');
  const ticks = Array.from({ length: Math.max(0, nq - 1) }, (_, k) => `<s style="left:calc(7% + ${((k + 1) / nq * 86).toFixed(2)}%)"></s>`).join('');
  return `<div class="trk" style="height:${onlyMe ? 52 : Math.max(96, 8 + 30 * rows)}px"><div class="grass"></div><div class="lane"></div><div class="start">START</div><div class="finish"></div>${ticks}${items}</div>`;
}

/* ---------- Âm thanh (WebAudio, không cần file): kèn xuất phát + tiếng reo hò, âm lượng vừa phải ---------- */
const Snd = (() => {
  let C = null, M = null, mute = false, NB = null;
  try { mute = localStorage.getItem('raceMute') === '1'; } catch (_) {}
  function ctx() {
    if (!C) {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      C = new A(); M = C.createGain(); M.gain.value = mute ? 0 : .8;
      const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;   /* cắt bớt âm chói */
      M.connect(lp); lp.connect(C.destination);
    }
    if (C.state === 'suspended') C.resume();
    return C;
  }
  function noise(c) {
    if (NB) return NB;
    NB = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return NB;
  }
  function tone(f, t0, dur, type, vol, lpf, vib) {
    const c = ctx(); if (!c) return; const t = c.currentTime + t0;
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = lpf || 2400;
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * .012; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + .1); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .03);
    g.gain.setValueAtTime(vol, t + Math.max(.04, dur - .12)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp); lp.connect(g); g.connect(M); o.start(t); o.stop(t + dur + .05);
  }
  /* Tiếng kèn xuất phát: ta-ta-ta-TAAA */
  function horn() {
    tone(523.25, 0, .14, 'sawtooth', .10, 1800); tone(523.25, .17, .14, 'sawtooth', .10, 1800);
    tone(784, .34, .45, 'sawtooth', .12, 2000, true); tone(392, .34, .45, 'triangle', .07, 1200);
  }
  /* Tiếng reo hò của khán giả: nhiễu lọc băng thông, nhấp nhô nhẹ, nhỏ dần */
  function cheer(dur, vol) {
    const c = ctx(); if (!c) return; const t = c.currentTime; dur = dur || 2.2; vol = vol == null ? .085 : vol;
    const s = c.createBufferSource(); s.buffer = noise(c); s.loop = true;
    const b1 = c.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = 900; b1.Q.value = .6;
    const b2 = c.createBiquadFilter(); b2.type = 'lowpass'; b2.frequency.value = 2600;
    const g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 6.5; lg.gain.value = vol * .25; lfo.connect(lg); lg.connect(g.gain);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.4, dur * .25));
    g.gain.setValueAtTime(vol, t + dur * .5); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    b1.frequency.setValueAtTime(700, t); b1.frequency.linearRampToValueAtTime(1100, t + dur * .5); b1.frequency.linearRampToValueAtTime(800, t + dur);
    s.connect(b1); b1.connect(b2); b2.connect(g); g.connect(M);
    s.start(t, Math.random()); lfo.start(t); s.stop(t + dur + .1); lfo.stop(t + dur + .1);
  }
  return {
    unlock() { ctx(); },
    suspend() { try { if (C && C.state === 'running') C.suspend(); } catch (_) {} },
    resume() { try { if (C) C.resume(); } catch (_) {} },
    horn, cheer,
    start() { horn(); setTimeout(() => cheer(1.4, .09), 300); },
    beep() { tone(660, 0, .16, 'square', .05, 1600); },
    go() { horn(); setTimeout(() => cheer(1.4, .09), 300); },
    step() { tone(660, 0, .08, 'triangle', .07); tone(880, .08, .10, 'triangle', .07); cheer(.8, .11); },
    bad() { tone(220, 0, .22, 'triangle', .07); },
    power() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .08, .14, 'triangle', .07)); },
    freeze() { [1200, 900, 700, 500].forEach((f, i) => tone(f, i * .07, .14, 'sine', .07)); },
    back() { tone(392, 0, .16, 'triangle', .08); tone(262, .15, .26, 'triangle', .08); },
    win() { horn(); setTimeout(() => cheer(1.8, .11), 250); },
    get mute() { return mute; },
    toggle() { mute = !mute; try { localStorage.setItem('raceMute', mute ? '1' : '0'); } catch (_) {} if (M) M.gain.value = mute ? 0 : .8; ctx(); return mute; }
  };
})();
document.addEventListener('pointerdown', () => Snd.unlock(), { once: true, capture: true });
