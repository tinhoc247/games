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

/* ---------- Avatar (50 nhân vật SVG, dùng chung với các game khác) ---------- */
const AVD=(()=>{
/* Phong cách "khối 3D": ô bo góc, mặt chiếm cả ô, viền đáy tối, mắt to có điểm sáng */
const K='#2b2433';
const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const sh=(h,a)=>{const t=a<0?0:255,k=Math.abs(a);return'#'+hx(h).map(v=>Math.round(v+(t-v)*k).toString(16).padStart(2,'0')).join('')};
const c=(x,y,r,f,o='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${o}/>`;
const e=(x,y,rx,ry,f,t,o='')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}"${t?` transform="${t}"`:''} ${o}/>`;
const d=(pa,f,o='')=>`<path d="${pa}" fill="${f}" ${o}/>`;
const l=(pa,s=K,w=1.8)=>`<path d="${pa}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rp=(pts,f,w=3)=>`<polygon points="${pts}" fill="${f}" stroke="${f}" stroke-width="${w}" stroke-linejoin="round"/>`;
const mir=s=>`<g transform="translate(64 0) scale(-1 1)">${s}</g>`,both=s=>s+mir(s);
/* mắt: tròng trắng to, đồng tử, 2 điểm sáng */
const eye=(x,y,r,pc,sc)=>c(x,y,r,sc||'#fff','stroke="#0002" stroke-width=".7"')+c(x+(x<32?.7:-.7),y+.7,r*.62,pc||K)+c(x+r*.2,y-r*.22,r*.25,'#fff')+c(x-r*.2,y+r*.32,r*.1,'#fff','opacity=".85"');
const eyes=(y=28,dx=11.5,r=6.4,pc,sc)=>eye(32-dx,y,r,pc,sc)+eye(32+dx,y,r,pc,sc);
const bead=(y=29,dx=11,r=3.6)=>both(c(32-dx,y,r,K)+c(32-dx+1,y-1.1,r*.34,'#fff'));
const muz=(f,y=40,rx=12.5,ry=8.5)=>e(32,y,rx,ry,f);
const nose=(f=K,y=36.5,w=4.2)=>d(`M${32-w} ${y}q${w} -2.6 ${w*2} 0q-.4 4.4 -${w} 4.4q-${w-.4} 0 -${w} -4.4z`,f)+e(30.6,y+.6,1.2,.7,'#fff','', 'opacity=".55"');
const mouth=(y=41.5,w=4.6)=>l(`M32 ${y-3}v2.6M${32-w} ${y}q${w/2} 3 ${w} 0q${w/2} 3 ${w} 0`,K,1.7);
const smile=(y=44,w=6)=>l(`M${32-w} ${y}q${w} 5 ${w*2} 0`,K,1.8);
const blush=(y=37,f='#ff7f9d',x=15)=>both(e(x,y,3.6,2.3,f,'','opacity=".5"'));
const earR=(f,i,x=11,y=11,r=7.5,ir=4.4)=>both(c(x,y,r,f)+c(x,y+.6,ir,i));
const earP=(f,i,o=0)=>both(rp(`${6+o},26 ${6+o},4 25,13`,f,3)+rp(`${10+o},22 ${10+o},9 20,14`,i,2));
const whisk=(y=40)=>both(l(`M13 ${y}l-10 -1.6M13 ${y+3}l-10 1.8`,'#0003',1.3));

const V={
fox:['#f58a2a',()=>earP('#f58a2a','#3a2a30')+both(e(18,43,15,10,'#fff6ea'))+muz('#fff6ea',42,10,7)+eyes(29,11.5,6.2)+nose(K,38)+smile(44.5,4)],
panda:['#f6f6f2',()=>earR(K,K,10,10,8,0)+both(e(20.5,29,8,8.8,K,'rotate(-14 20.5 29)'))+both(c(20.5,29,5,'#fff')+c(21.2,29.8,3.1,K)+c(22.4,28.2,1.2,'#fff'))+muz('#fff',41,7,5)+nose(K,37.5,3.6)+smile(43.5,4)+blush(40,'#ff9fb3',13)],
lion:['#f2b53c',()=>c(32,32,30,'#c2742a')+c(32,32,26,'#d98a2b')+earR('#f2b53c','#b56a22',13,12,6.5,3.4)+e(32,34,21,19,'#f7c95e')+muz('#fde8b8',41,11,7.5)+eyes(30,10.5,5.6)+nose('#7a3f1c',37.5)+mouth(42)],
tiger:['#f59a23',()=>earR('#f59a23','#fff0e0',11,10,7.5,4)+both(e(17,44,14,9,'#fff'))+muz('#fff',42,10,7)+both(l('M2 25l9 3M2 33l9 .5M2 41l8 -2',K,2.6))+l('M32 9v10M26 10.5l2 8M38 10.5l-2 8',K,2.6)+eyes(30,11,5.8,K,'#fff')+nose('#e8566f',38.5)+mouth(43)],
frog:['#58c24a',()=>both(c(18,14,10,'#58c24a')+c(18,14,7.4,'#fff','stroke="#0002" stroke-width=".7"')+c(18.8,14.8,4.6,K)+c(20.4,13,1.7,'#fff'))+e(32,42,25,12,'#8be07a')+both(c(27,35,1.3,'#2f7d28'))+l('M13 41q19 13 38 0','#2f6d28',2)+blush(41,'#ff8aa6',11)],
monkey:['#9a6238',()=>both(c(6,30,7.5,'#9a6238')+c(6,30,4.4,'#f4d3a6'))+e(32,34,23,19,'#9a6238')+d('M32 24q-9 -8 -16 1q-5 9 2 14q5 3 14 -2q9 5 14 2q7 -5 2 -14q-7 -9 -16 -1z','#f6dcb4')+muz('#f6dcb4',43,10,7)+eyes(30,9.5,5.2)+both(c(29,41,1,'#7a4b25'))+smile(45,5)],
rabbit:['#fbe9f0',()=>both(e(18,8,6,12,'#fff','rotate(-6 18 8)')+e(18,9,3.2,8,'#ffb3c8','rotate(-6 18 9)'))+eyes(31,11,6)+nose('#ff7f9d',38,3.4)+l('M32 41v2M27 45q5 3.4 5 -2q0 5.4 5 2','#7a4a5a',1.6)+d('M30 45.4h4v4.4h-4z','#fff','stroke="#0002" stroke-width=".6"')+blush(40,'#ffa3bc',14)],
bear:['#a06a40',()=>earR('#a06a40','#e0b88c',11,10,7.5,4)+muz('#e0b88c',41,12,8.4)+eyes(29,11.5,5.4)+nose(K,37)+mouth(41.5)],
koala:['#a9b3c1',()=>both(c(8,20,11,'#a9b3c1')+c(8,20,6.6,'#f6dbe5'))+eyes(30,12,5.4)+d('M25 35q7 -6 14 0q3 12 -7 12q-10 0 -7 -12z',K)+c(29.6,37.6,1.3,'#fff','opacity=".6"')+l('M32 47v2M28 50q4 3 8 0','#0000',0)],
unicorn:['#fdfaff',()=>both(d('M9 16q-9 14 -2 34q7 -9 9 -26z','#ff8fc4')+d('M14 11q-11 8 -7 22q7 -5 10 -15z','#9aa8ff'))+both(rp('8,26 8,6 24,15','#fff',3)+rp('11,22 12,11 19,15','#ffc2dd',2))+d('M32 1l-5.5 17h11z','#ffd54a')+l('M28 12l8 -2.6M29.4 7l5 -1.6','#e5a313',1.4)+eyes(31,11,5.6,'#7b4fd8')+muz('#ffe3ef',43,9,6)+both(e(29,43,1.2,1.7,'#e79ab8'))+smile(46.5,3.4)+blush(40,'#ffa6c6',13)],
octopus:['#f06aa0',()=>e(32,17,18,8,'#ff9cc4',0,'opacity=".55"')+both(c(12,14,2.4,'#ff9ac2')+c(8,25,1.8,'#ff9ac2')+c(15,22,1.4,'#ff9ac2'))+eyes(30,11,6.6)+smile(43,5)+blush(40,'#ff4f8a',14)+both(d('M0 44q6 2 7 9q-8 -1 -7 -9z','#d44a85')+c(18,50,1.6,'#ff9ac2')+c(26,49,1.4,'#ff9ac2'))],
penguin:['#2e4360',()=>d('M32 14q-12 -6 -21 5q-6 14 2 25q8 10 19 10q11 0 19 -10q8 -11 2 -25q-9 -11 -21 -5z','#fff')+eyes(28,9.5,5.4)+d('M25 36q7 -5.4 14 0q-7 9 -14 0z','#ffa62b')+blush(37,'#ffb4a0',15)],
dog:['#f0d7a6',()=>both(d('M2 12q-1 24 6 34q8 -2 7 -20q-1 -12 -13 -14z','#8a5a34'))+e(44,25,10,9,'#b9824a')+muz('#fff4d8',41,12,8.5)+eyes(28,11,5.4)+nose(K,36.5)+l('M32 40v2M27.6 44.4q4.4 3.6 4.4 -2.4q0 6 4.4 2.4','#5a3a2a',1.6)+d('M30 45.4h4v5q-2 2 -4 0z','#ff7a93')],
cat:['#98a0b0',()=>earP('#98a0b0','#ffb3c7')+l('M32 10v8M26 11.5l1.6 5.4M38 11.5l-1.6 5.4','#6a7282',2.2)+muz('#e9edf3',41,11,7.5)+eyes(29,11.5,5.6,'#3e9b5a')+both(e(20.5,29,1,4.4,K))+nose('#ff8aa6',36.5,3.6)+l('M32 40v2M27.4 44.6q4.6 3.2 4.6 -2.6q0 5.8 4.6 2.6','#5a4a5a',1.5)+whisk(40)],
dragon:['#46bf88',()=>both(rp('7,22 4,3 21,13','#ffd54a',3))+both(rp('3,40 0,32 3,48','#2e9d6e',2))+both(e(18,43,10,7,'#cfeeb0'))+muz('#cfeeb0',41,10.5,8)+both(rp('26,8 29.4,15 22.6,15','#ffd54a',1.6))+eyes(28,11,5.4,'#c0392b')+both(c(28.4,38,1.2,'#2f7d5b'))+smile(44,5)+both(rp('27,44.8 28.4,47.6 29.8,45','#fff',.6))],
owl:['#a8774c',()=>both(rp('7,22 5,4 22,13','#8a5f38',3))+d('M32 22q-6 -7 -14 -2q-9 11 0 22q8 5 14 -1q6 6 14 1q9 -11 0 -22q-8 -5 -14 2z','#f4e3c4')+both(c(21,29,9.4,'#fff','stroke="#0002" stroke-width=".7"')+c(21,29,6.2,'#f0a63a')+c(21.6,29.6,3.8,K)+c(23,27.6,1.5,'#fff'))+d('M32 33l-4 6q4 5 8 0z','#f08a24')+both(l('M14 46q3 -2.4 6 0M12 50q3 -2.4 6 0','#7a5230',1.4))],
pig:['#ffa6b8',()=>both(rp('7,22 7,5 22,12','#ff8aa3',3)+rp('10,19 10,9 18,13','#ffc0cc',1.5))+eyes(27,11.5,5.4)+e(32,40,10.5,7.5,'#ff86a0')+both(e(28,40,1.8,3.2,'#b83a63'))+blush(36,'#ff6f93',13)],
hippo:['#9aa6bb',()=>earR('#9aa6bb','#d0d6e2',14,8,5.5,3)+e(32,40,23,12.5,'#c3cbda')+both(e(24.5,37.4,2.4,3.2,'#6b7790'))+both(c(21,25,6.6,'#fff','stroke="#0002" stroke-width=".7"')+c(21.7,25.8,4.1,K)+c(23.1,24,1.6,'#fff'))+both(l('M13 47q3 2 6 0M45 47q-3 2 -6 0','#7a8499',1.3))+l('M26 46q6 3.4 12 0','#6b7790',1.6)],
giraffe:['#f6c45a',()=>both(l('M21 9v-6',K,2)+c(21,3.6,3,'#a8672b'))+both(e(5,17,7,4,'#f6c45a','rotate(28 5 17)')+e(5,17,3.4,1.8,'#d79b6b','rotate(28 5 17)'))+both(c(13,35,3.8,'#b9722f','opacity=".75"')+c(24,16,3,'#b9722f','opacity=".75"'))+c(40,18,2.4,'#b9722f','opacity=".75"')+muz('#fde9b8',42,13,8.4)+eyes(28,11,5.2)+both(e(27.4,41,1.5,2.4,'#a1642a'))+smile(46,5)],
leopard:['#f2b84b',()=>earR('#f2b84b',K,11,10,7.5,3.8)+muz('#fff3d0',41,12,8)+both(c(11,35,2,K)+c(8,43,1.7,K)+c(15,44,1.5,K))+c(24,15,1.8,K)+c(40,15,1.8,K)+c(32,13,1.7,K)+c(12,20,1.8,K)+c(52,20,1.8,K)+eyes(29,11.5,5.4,'#4a8a3a')+nose('#e8566f',37)+mouth(41.6)],
toucan:['#252d42',()=>e(32,26,21,17,'#fff')+eye(22,24,6,K,'#fff')+eye(42,24,6,K,'#fff')+both(c(22,24,8.4,'none','stroke="#ffb02a" stroke-width="2"'))+d('M5 37q27 -14 54 0q-2 15 -27 16q-25 -1 -27 -16z','#ff9d2b')+d('M5 37q27 -14 54 0q-27 7 -54 0z','#ffd54a')+l('M10 41q22 5 44 0','#e0701b',1.4)+c(32,33,2,'#c2570f')],
duck:['#ffd23f',()=>l('M32 13q-5 -6 1 -9','#e8b021',2.4)+eyes(27,11,5.2)+d('M13 38q19 -9 38 0q1 12 -19 12q-20 0 -19 -12z','#ff9d2b')+d('M13 38q19 -9 38 0q-19 5 -38 0z','#ffb84a')+both(e(26.4,38.5,1,1.4,'#b55d12'))+l('M21 43q11 3.6 22 0','#c46d17',1.3)+blush(36,'#ff9d6a',9)],
chicken:['#fdfdfb',()=>both(c(23,8,6,'#ef4444'))+c(32,5,6.6,'#ef4444')+both(c(41,8,0.1,'#ef4444'))+c(41,8,6,'#ef4444')+eyes(28,11,5.2)+d('M32 33l-6 6q6 6 12 0z','#ffa62b')+e(32,47,3.2,4.4,'#ef4444')+blush(37,'#ffb4a0',13)],
cow:['#fafafa',()=>both(rp('8,16 3,6 18,10','#e9dfc2',3)+e(6,27,8,4.6,'#fff','rotate(-24 6 27)')+e(6,27,4.6,2.4,'#ffb3c7','rotate(-24 6 27)'))+e(18,20,10,8,K)+d('M44 12q10 3 9 12q-9 3 -13 -7z',K)+muz('#ffb3c7',42,14,8.8)+both(e(26.4,42,2.2,3.4,'#cf5a7a'))+eyes(28,11,5.4)],
sheep:['#f4f0e6',()=>[[8,14],[18,6],[32,4],[46,6],[56,14],[5,30],[59,30]].map(a=>c(a[0],a[1],8,'#fff','stroke="#0001" stroke-width=".8"')).join('')+both(e(3,32,7,4,'#4a4a52','rotate(24 3 32)'))+e(32,35,19,17,'#4a4a52')+c(32,14,10,'#fff')+eyes(30,9.5,5,K,'#fff')+nose('#ff8aa6',39,3.4)+l('M32 42.5v1.6M28 46q4 3 8 0','#fff',1.6)],
horse:['#b5703a',()=>both(rp('7,25 7,5 23,14','#b5703a',3)+rp('10,21 11,10 19,14','#3a2a22',2))+d('M32 5q-14 0 -16 16q8 -2 16 -3q8 1 16 3q-2 -16 -16 -16z','#3a2a22')+d('M30 18q3 8 3 16q0 5 0 9h-2q-3 -7 -3 -14q0 -6 2 -11z','#fff')+muz('#d79a64',42,12.5,8.5)+eyes(29,11.5,5.2)+both(e(27,43,1.8,2.8,'#6b3a1c'))+smile(48,5)],
mouse:['#bcbfcc',()=>earR('#bcbfcc','#ffb3c8',12,11,9.5,6)+muz('#eceef4',41,10.5,7.5)+eyes(29,11,5.4)+e(32,36.8,3,2.3,'#ff8aa6')+l('M32 39v2M27.6 43.4q4.4 3 4.4 -3q0 6 4.4 3','#5a4a5a',1.5)+whisk(41)],
hamster:['#f2c27a',()=>earR('#f2c27a','#ffb3c8',11,10,6.5,3.6)+d('M32 22q-10 -3 -13 7q3 8 13 8q10 0 13 -8q-3 -10 -13 -7z','#fff3dc')+both(e(13,40,10,8,'#fff3dc'))+eyes(28,11.5,4.8)+e(32,36.5,3.2,2.3,'#ff8aa6')+l('M32 38.6v2M28 42.6q4 3 8 0','#6a4a3a',1.5)+d('M30 42.4h4v4h-4z','#fff','stroke="#0002" stroke-width=".6"')+blush(37,'#ff9ab0',9)],
elephant:['#9fb6cc',()=>both(e(5,30,11,17,'#9fb6cc')+e(6,30,6.4,11.5,'#eab9c8'))+d('M24 36q-3 17 3 21q5 2 5 -3v-6h1v6q0 5 5 3q6 -4 3 -21z','#b4c8db')+both(l('M27 47h4M37 47h-4','#7b90a8',1.3))+eyes(27,11,5.4)+blush(38,'#ffa6bd',13)],
zebra:['#f4f4f0',()=>both(rp('7,25 7,5 23,14','#fff',3)+rp('10,21 11,10 19,14',K,2))+d('M32 5q-12 0 -14 12q14 -4 28 0q-2 -12 -14 -12z',K)+l('M32 14v13M23 17l3 9M41 17l-3 9','#2b2433',2.6)+both(l('M3 31l9 2.6M4 40l9 .6',K,2.8))+muz('#d8cdb9',42,12.5,8.5)+eyes(29,11.5,5.2)+both(e(27,43,1.7,2.6,K))+smile(48,5)],
raccoon:['#8c97a6',()=>earR('#8c97a6',K,11,10,7.5,4)+both(e(18,43,10,7,'#f2f4f7'))+muz('#f2f4f7',41,10,7.5)+d('M3 25q29 -10 58 0q-3 13 -15 8q-14 -5 -28 0q-12 5 -15 -8z',K)+eye(21.5,29,5.2,K)+eye(42.5,29,5.2,K)+nose(K,37.5)+smile(43.5,4)],
wolf:['#7b8aa0',()=>earP('#7b8aa0','#e8aebb')+d('M32 24q-14 7 -17 20q8 10 17 10q9 0 17 -10q-3 -13 -17 -20z','#e2e8f1')+eyes(28,11.5,5.2,'#c98a14')+both(l('M3 31l9 3M3 38l8 1.4','#a9b7ca',1.8))+d('M32 35l-5 3.6q5 5 10 0z',K)+l('M32 39v3.6M26 44q6 4.4 12 0','#4a5468',1.6)],
deer:['#c98b4f',()=>both(l('M16 11l-3 -9M13 2l-5 -1.6M13 2l1 -2','#7a4b25',2.6))+both(e(4,25,8,4,'#c98b4f','rotate(28 4 25)')+e(4,25,4.4,2,'#f4cfae','rotate(28 4 25)'))+c(20,18,1.7,'#fff')+c(32,13,1.7,'#fff')+c(44,18,1.7,'#fff')+muz('#f4dfc0',42,11.5,8)+eyes(29,11.5,5.3)+nose(K,37.5,3.6)+smile(44.4,4)],
goat:['#f0ecdf',()=>both(d('M16 12q-12 -6 -11 -12q10 2 15 11z','#a8a094'))+both(e(4,27,8,4,'#f4f4f0','rotate(20 4 27)'))+muz('#fff',42,10.5,7.5)+eyes(29,11.5,5.2,K,'#fff4c8')+both(e(21,29,.9,4,K))+both(c(29,41,1.1,'#c9a6a0'))+smile(46,5)+d('M29 52q3 7 6 0z','#e8e3d6')],
turtle:['#7cc47a',()=>d('M2 30q2 -26 30 -26t30 26z','#a8742f')+l('M32 5v25M18 10l6 20M46 10l-6 20M7 26h50','#7a4f1c',1.8)+d('M32 24q-14 0 -18 8q0 14 18 14t18 -14q-4 -8 -18 -8z','#9bdc96')+eyes(35,10.5,5,K)+both(c(29,43,1,'#3f8a3c'))+smile(46,5)+blush(44,'#ff9a85',16)],
crocodile:['#6bb04a',()=>both(c(17,14,8,'#6bb04a')+c(17,14,5.4,'#fff','stroke="#0002" stroke-width=".7"')+c(17.8,14.8,3.2,K)+c(19.2,13,1.2,'#fff'))+e(32,43,25,10,'#d6eca0')+both(c(24,40,1.6,'#3d7d28'))+l('M10 47q22 8 44 0','#2f6d28',1.8)+both(rp('19,47.4 21,51 23,47.6','#fff',.6)+rp('31,49 33,52.6 35,49.2','#fff',.6))+both(c(8,25,2,'#4f9438')+c(11,31,1.8,'#4f9438'))],
hedgehog:['#6b4a32',()=>d('M2 40l2 -14 6 4 1 -14 8 6 3 -14 7 7 5 -10 5 10 7 -7 3 14 8 -6 1 14 6 -4 2 14z','#4e3524')+d('M8 44q-2 -22 24 -24t24 24q-2 7 -24 7t-24 -7z','#eacaa0')+d('M10 28q22 -14 44 0q-5 -8 -10 -11q-12 -6 -24 0q-5 3 -10 11z','#6b4a32')+eyes(33,10,4.8)+e(32,40,3.8,2.8,K)+c(31,39,.9,'#fff')+smile(45,4)+blush(40,'#ff9a85',14)],
squirrel:['#d9783a',()=>both(rp('7,25 7,5 22,13','#d9783a',3)+rp('7,6 4,0 14,3','#8a4a1c',2)+rp('10,21 11,10 18,14','#f6c9a8',2))+both(e(17,43,12,8,'#fff3e6'))+muz('#fff3e6',41,10,7.5)+eyes(29,11.5,5.4)+nose(K,36.5,3.6)+l('M32 40v2M28 44q4 2.6 8 0','#6a4a3a',1.5)+d('M30 43.6h4v4.4h-4z','#fff','stroke="#0002" stroke-width=".6"')],
otter:['#8a6648',()=>earR('#8a6648','#b89270',13,9,5.6,3)+muz('#e8d5ba',41,13,8.6)+eyes(28,11.5,5.2)+nose(K,36.5)+l('M32 40v2M27.6 44.4q4.4 3.2 4.4 -2.4q0 5.4 4.4 2.4','#5a3a2a',1.5)+both(c(22,44,.8,'#8a6648')+c(19,47,.8,'#8a6648'))+whisk(41)],
seal:['#8ea2b8',()=>muz('#c7d3e2',41,13.5,8.8)+eyes(28,11.5,6.2,'#1b2230')+nose(K,36,4.4)+l('M32 40.4v2.4M27 44.6q5 3.4 5 -2q0 5.4 5 2','#3a4658',1.5)+both(l('M20 43l-12 -1.8M20 46.4l-12 2.6','#fff',1.4))],
whale:['#4f8fe0',()=>l('M32 14q-1 -9 -8 -10M32 14q1 -9 8 -10','#8ccaff',2.8)+d('M3 38q0 -22 29 -22t29 22q0 16 -29 16t-29 -16z','#e9f4ff','opacity="0"')+e(32,46,26,10,'#e9f4ff')+d('M4 40q0 -24 28 -24t28 24q-28 8 -56 0z','#4f8fe0')+eyes(30,11.5,5.6)+smile(40,6)+blush(37,'#ff8ab0',15)],
fish:['#ff9a3c',()=>d('M52 32l12 -9v20z','#ffb35a')+d('M32 6l-10 9h20z','#ff7f2a')+e(30,40,24,12,'#ffd9a8')+eye(21,26,7.4)+e(8,36,2.8,4,'#d9561a')+l('M31 22q5 7 0 15M38 21q5 7 0 16','#e8761c',1.8)+c(52,12,2.4,'#fff','opacity=".8"')+c(46,6,1.7,'#fff','opacity=".8"')],
crab:['#ef5b4a',()=>both(l('M22 17v7','#ef5b4a',3.4)+c(22,13,6,'#fff','stroke="#0002" stroke-width=".7"')+c(22.8,13.8,3.4,K)+c(24,12,1.3,'#fff'))+both(d('M3 40q-6 -8 -1 -17q8 0 10 8q1 5 -4 9z','#ff7a68'))+both(c(21,35,5.6,'#fff')+c(21.8,35.6,3.4,K)+c(23,34,1.3,'#fff'))+l('M23 45q9 6.4 18 0',K,1.8)+blush(43,'#ff9a8a',12)],
bee:['#ffd23f',()=>both(e(9,12,6.4,9.4,'#d6f0ff','rotate(-28 9 12)','opacity=".9"'))+l('M25 13q-3 -9 -8 -9M39 13q3 -9 8 -9',K,1.8)+both(c(17,4,2.2,K))+d('M0 37q32 -8 64 0v-6q-32 -8 -64 0z',K)+d('M2 48q30 7 60 0v-5q-30 7 -60 0z',K)+eyes(27,11.5,5.2)+smile(40,4.6)+blush(35,'#ff9a6a',14)],
ladybug:['#e43d3d',()=>l('M24 14q-3 -9 -8 -9M40 14q3 -9 8 -9',K,1.8)+both(c(16,5,2.2,K))+d('M0 24q32 -16 64 0v6q-32 -8 -64 0z',K)+l('M32 17v34','#a82424',1.6)+both(c(14,40,3.4,K)+c(19,48,2.4,K))+eyes(26,10.5,5.2,K)+smile(38,5)+both(c(9,31,0.1,K))+blush(35,'#ff9a8a',14)],
bat:['#6a5a8c',()=>both(rp('6,28 4,3 24,13','#6a5a8c',3)+rp('9,23 8,10 18,14','#e7a6c3',2))+muz('#8e7eb0',41,11,7.6)+eyes(28,11.5,5.4,'#e6b800')+e(32,36.5,2.8,2.1,K)+l('M26 42q6 4.4 12 0',K,1.6)+both(rp('27,42.6 28.6,47.2 30.2,43.4','#fff',.6))],
sloth:['#b59a78',()=>d('M32 19q-18 0 -22 14q0 15 22 15t22 -15q-4 -14 -22 -14z','#efe0c4')+both(e(20,30,7.4,5.6,'#5b4630','rotate(-24 20 30)')+c(20.4,30.4,3,'#fff')+c(20.8,30.8,1.8,K))+e(32,38,3.8,2.7,K)+l('M32 40.6v1.6M26 44q6 5 12 0',K,1.6)+blush(40,'#ffb09a',13)],
rhino:['#9aa2b0',()=>earR('#9aa2b0','#d6c2c8',13,9,6.2,3.4)+muz('#b9c0cc',42,13,9)+d('M32 16q-7 9 -6 21h12q1 -12 -6 -21z','#f4ead2')+eyes(28,12.5,5)+both(e(26,43.6,1.9,2.8,'#6a7384'))+smile(48,5)],
kangaroo:['#d98c52',()=>both(rp('7,26 6,2 23,13','#d98c52',3)+rp('10,22 10,8 19,13','#f6c3a0',2))+d('M32 22q-15 5 -15 21q4 11 15 11t15 -11q0 -16 -15 -21z','#f6d9b8')+eyes(29,11,5.2)+d('M27 37q5 -4.4 10 0q0 4 -5 4t-5 -4z',K)+l('M32 41v2.6M27.6 45.6q4.4 3.2 4.4 -2.6q0 5.8 4.4 2.6','#7a4a2a',1.5)+blush(40,'#ff9a85',14)],
polar:['#fbfdff',()=>earR('#fff','#cfe6f5',11,10,7.5,4)+muz('#e6f4fb',41,12,8.4)+eyes(29,11.5,5.4)+nose(K,37,4)+mouth(41.5)+both(l('M10 21q3 -2 7 -1','#bcd9ea',1.6))]
};
/* tên gọi vẫn như cũ, chỉ chuyển sang bản vẽ mới */
return V;})();
const AVS = Object.keys(AVD);
const AVN={fox:'Cáo',panda:'Gấu trúc',lion:'Sư tử',tiger:'Hổ',frog:'Ếch',monkey:'Khỉ',rabbit:'Thỏ',bear:'Gấu',koala:'Koala',unicorn:'Kỳ lân',octopus:'Bạch tuộc',penguin:'Cánh cụt',dog:'Chó',cat:'Mèo',dragon:'Rồng',owl:'Cú',pig:'Heo',hippo:'Hà mã',giraffe:'Hươu cao cổ',leopard:'Báo',toucan:'Chim tucan',duck:'Vịt',chicken:'Gà',cow:'Bò',sheep:'Cừu',horse:'Ngựa',mouse:'Chuột',hamster:'Hamster',elephant:'Voi',zebra:'Ngựa vằn',raccoon:'Gấu mèo',wolf:'Sói',deer:'Hươu',goat:'Dê',turtle:'Rùa',crocodile:'Cá sấu',hedgehog:'Nhím',squirrel:'Sóc',otter:'Rái cá',seal:'Hải cẩu',whale:'Cá voi',fish:'Cá',crab:'Cua',bee:'Ong',ladybug:'Bọ rùa',bat:'Dơi',sloth:'Lười',rhino:'Tê giác',kangaroo:'Chuột túi',polar:'Gấu Bắc Cực'};
const avSh=(h,a)=>{const t=a<0?0:255,k=Math.abs(a);return'#'+[1,3,5].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*(1-k)+t*k).toString(16).padStart(2,'0')).join('')};
function avH(id,sz){const f=AVD[id];if(!f)return id?String(id).replace(/[<>&]/g,''):'';const[bg,fn]=f;return`<svg class="avs" viewBox="0 0 64 64" role="img" aria-label="${AVN[id]||id}"${sz?` style="width:${sz};height:${sz}"`:''}><rect width="64" height="64" rx="15" fill="${bg}"/><path d="M0 24V15A15 15 0 0 1 15 0H49A15 15 0 0 1 64 15V24Z" fill="#fff" opacity=".1"/><path d="M.13 51H63.87A15 15 0 0 1 49 64H15A15 15 0 0 1 .13 51Z" fill="${avSh(bg,-.22)}"/><rect y="51" width="64" height="1.3" fill="#fff" opacity=".3"/>${fn()}</svg>`}
const AVLEG = { '🐶':'dog','🐱':'cat','🐭':'mouse','🐹':'hamster','🐰':'rabbit','🦊':'fox','🐻':'bear','🐼':'panda','🐨':'koala','🐯':'tiger','🦁':'lion','🐮':'cow','🐷':'pig','🐸':'frog','🐵':'monkey','🐔':'chicken','🐧':'penguin','🦆':'duck','🦉':'owl','🦄':'unicorn','🐝':'bee','🦋':'bee','🐌':'turtle','🐞':'ladybug','🐢':'turtle','🐍':'crocodile','🦖':'dragon','🐙':'octopus','🐠':'fish','🐬':'whale','🐳':'whale','🦈':'whale','🐘':'elephant','🦒':'giraffe','🦀':'crab','🐊':'crocodile' };   /* dữ liệu cũ lưu emoji: vẫn hiển thị đúng nhân vật tương ứng */
const avOf = a => AVD[a] ? avH(a) : AVLEG[a] ? avH(AVLEG[a]) : '🐾';

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

  /* ---------- Nhạc nền vui nhộn (trống + bass + giai điệu vui), chỉ phát trong lúc đua ---------- */
  const BAR = 1.8, E = BAR / 8, MVOL = .2, fq = s => 261.63 * 2 ** (s / 12);
  const MUS_CH = [[0, 0], [-5, 0], [-3, 1], [-7, 0], [0, 0], [-5, 0], [-7, 0], [-5, 0]];
  const MUS_ML = [
    [[0, 7, 1], [1, 7, 1], [2, 9, 1], [3, 7, 1], [4, 12, 3], [7, 9, 1]],
    [[0, 11, 1], [1, 11, 1], [2, 12, 1], [3, 11, 1], [4, 7, 3], [7, 4, 1]],
    [[0, 9, 1], [1, 9, 1], [2, 12, 1], [3, 9, 1], [4, 16, 3], [7, 12, 1]],
    [[0, 12, 1], [1, 12, 1], [2, 9, 1], [3, 5, 1], [4, 9, 3], [7, 7, 1]],
    [[0, 7, 1], [1, 7, 1], [2, 9, 1], [3, 7, 1], [4, 12, 3], [7, 14, 1]],
    [[0, 16, 1], [1, 14, 1], [2, 11, 1], [3, 14, 1], [4, 11, 3], [7, 7, 1]],
    [[0, 9, 1], [1, 12, 1], [2, 16, 1], [3, 12, 1], [4, 17, 2], [6, 16, 1], [7, 12, 1]],
    [[0, 14, 1], [1, 14, 1], [2, 11, 1], [3, 14, 1], [4, 7, 2], [6, 11, 1], [7, 14, 1]]];
  let MS = null, mg = null, dm = null, mOn = false, mTimer = null, nt = 0, mstep = 0;
  function mnote(f, t, d, type, v, a, bus, lp) {
    const o = C.createOscillator(), g = C.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + (a || .01)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    if (lp) { const fl = C.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(lp, t); fl.frequency.exponentialRampToValueAtTime(Math.max(200, lp / 4), t + d); o.connect(fl); fl.connect(g); } else o.connect(g);
    g.connect(bus || mg); o.start(t); o.stop(t + d + .05);
  }
  function mkick(t) {
    const o = C.createOscillator(), g = C.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
    g.gain.setValueAtTime(.7, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); o.connect(g); g.connect(dm); o.start(t); o.stop(t + .23);
  }
  function mnoise(t, d, v, f, type) {
    const s = C.createBufferSource(), fl = C.createBiquadFilter(), g = C.createGain(); s.buffer = noise(C); fl.type = type; fl.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(fl); fl.connect(g); g.connect(dm); s.start(t, Math.random()); s.stop(t + d + .02);
  }
  function playBar(t) {
    const bar = mstep++ % 8, c = MUS_CH[bar], r = c[0], tn = c[1] ? [0, 3, 7] : [0, 4, 7];
    for (let b = 0; b < 4; b++) mkick(t + b * 2 * E);
    [2, 6].forEach(i => mnoise(t + i * E, .14, .4, 2000, 'bandpass'));
    for (let i = 0; i < 8; i++) mnoise(t + i * E, i % 2 ? .07 : .03, i % 2 ? .18 : .09, 8000, 'highpass');
    if (bar == 7) for (let k = 1; k < 4; k++) mnoise(t + (6 + k / 2) * E, .08, .28, 2500, 'bandpass');
    for (let i = 0; i < 8; i++) mnote(fq(r - 12 + (i == 7 ? 7 : i % 2 ? 12 : 0)), t + i * E, E * .8, 'sawtooth', .1, .005, mg, 900);
    for (let i = 1; i < 8; i += 2) tn.forEach(x => mnote(fq(r + x), t + i * E, E * .45, 'square', .013, .004));
    MUS_ML[bar].forEach(n => mnote(fq(n[1]), t + n[0] * E, E * n[2] * .92, 'square', .04, .01));
  }
  function mInit(c) {
    if (MS) return;
    MS = c.createGain(); MS.gain.value = 0;
    const cp = c.createDynamicsCompressor(); cp.threshold.value = -20; cp.ratio.value = 4; MS.connect(cp); cp.connect(M);
    mg = c.createGain(); mg.connect(MS); dm = c.createGain(); dm.connect(MS);
    const dl = c.createDelay(), fbk = c.createGain(), dg = c.createGain(); dl.delayTime.value = E * 1.5; fbk.gain.value = .28; dg.gain.value = .45;
    mg.connect(dl); dl.connect(fbk); fbk.connect(dl); dl.connect(dg); dg.connect(MS);
  }
  function sched() {
    if (!C) return;
    if (!mOn || C.state !== 'running') { nt = C.currentTime + .2; return; }
    while (nt < C.currentTime + 1.5) { playBar(nt); nt += BAR; }
  }
  function music(on) {
    on = !!on; if (on === mOn) return; mOn = on;
    if (on) {
      const c = ctx(); if (!c) { mOn = false; return; }
      mInit(c); MS.gain.cancelScheduledValues(c.currentTime); MS.gain.setTargetAtTime(MVOL, c.currentTime, .4);
      nt = c.currentTime + .2; if (!mTimer) mTimer = setInterval(sched, 400);
    } else if (MS && C) { MS.gain.cancelScheduledValues(C.currentTime); MS.gain.setTargetAtTime(0, C.currentTime, .25); }
  }
  return {
    music,
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
