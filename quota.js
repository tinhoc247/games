/* ==========================================================================
   quota.js – giảm băng thông Firebase Realtime Database (gói Spark: 10 GB tải xuống / tháng)
   Nạp ở đầu MỌI trang, TRƯỚC mã của game. Không cần sửa Rules, không đổi cấu trúc dữ liệu.

   Cách hoạt động: bọc window.fetch, chỉ tác động tới yêu cầu gửi đến *.firebasedatabase.app
     1. Ghi (PUT/PATCH/DELETE): thêm print=silent để Firebase không gửi lại toàn bộ dữ liệu vừa ghi
        (trước đây mỗi lần trả lời đều tải lại cả nhật ký của học sinh). Bỏ qua khi có '.sv'
        (cần giá trị timestamp trả về).
     2. Ảnh và bộ câu hỏi (libimg/, libq/, quiz/): lưu bền vào IndexedDB. Tải lại trang, vào lại phòng,
        chơi lại → không tải lại từ Firebase (ảnh base64 là phần nặng nhất mỗi lượt vào phòng).
     3. Đọc dữ liệu hay đổi (sessions, players, results, live, events, logs): gửi kèm ETag.
        Dữ liệu không đổi → Firebase trả 304, gần như không tốn băng thông. Nếu trình duyệt/Firebase
        không hỗ trợ ETag thì tự tắt, mọi thứ chạy như cũ.
     4. Tab bị ẩn / điện thoại khoá màn hình: dùng lại bản đã tải gần nhất tối đa 15 giây thay vì hỏi lại.
     5. Hai yêu cầu đọc giống hệt nhau cùng lúc chỉ gửi một.
   Công tắc: window.Quota.off = true (đặt trước khi các trang chạy) để tắt hoàn toàn.
   Số liệu: window.Quota.stats  { req, etagHit, cacheHit, silent, hidden }
   ========================================================================== */
(function () {
  'use strict';
  if (window.Quota || !window.fetch) return;
  var nativeFetch = window.fetch.bind(window);
  var Q = window.Quota = { off: false, etag: true, stats: { req: 0, etagHit: 0, cacheHit: 0, silent: 0, hidden: 0 } };
  var HIDDEN_MS = 15000;
  var MEM = Object.create(null);          /* key → { t, body, etag }  (bản đọc gần nhất) */
  var INF = Object.create(null);          /* key → Promise (yêu cầu đang bay) */
  var noEtag = 0;                         /* số lần liên tiếp Firebase không trả ETag */

  var isDb = function (u) { return /\.firebasedatabase\.app\/|\.firebaseio\.com\//.test(u); };
  var parse = function (u) {
    var x = new URL(u), p = x.pathname.replace(/^\//, '').replace(/\.json$/, '');
    x.searchParams.delete('auth');
    var qs = x.searchParams.toString();
    return { path: p, key: p + (qs ? '?' + qs : ''), qs: qs, url: x };
  };
  var jsonRes = function (text) { return new Response(text, { status: 200, headers: { 'content-type': 'application/json' } }); };

  /* Dữ liệu bất biến: ảnh và bộ câu hỏi của thư viện, câu hỏi của một mã chơi. */
  var STATIC = /^(?:(?:gold|race)\/)?(?:libimg\/|libq\/|quiz\/)/;
  /* Dữ liệu thay đổi trong lúc chơi. Chỉ những đường dẫn này dùng ETag / tạm dùng lại khi tab ẩn. */
  var LIVE = /^(?:(?:gold|race)\/)?(?:sessions|players|results|live|events|logs|moves|ts)(?:\/|$)/;

  /* ---------- IndexedDB (bền, theo thiết bị) ---------- */
  var dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok) {
      try {
        var r = indexedDB.open('quota-cache', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { ok(null); };
      } catch (e) { ok(null); }
    });
    return dbp;
  }
  function idbGet(k) {
    return idb().then(function (db) {
      return !db ? null : new Promise(function (ok) {
        try { var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); }; } catch (e) { ok(null); }
      });
    });
  }
  function idbPut(k, v) {
    return idb().then(function (db) {
      if (!db) return;
      try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) {}
    });
  }
  function idbDel(k) { return idb().then(function (db) { if (db) try { db.transaction('kv', 'readwrite').objectStore('kv').delete(k); } catch (e) {} }); }
  var TTL_STATIC = 6 * 3600e3;            /* quiz/<mã>: 6 giờ.  libimg, libq: bất biến nhưng vẫn dọn sau 30 ngày */
  var TTL_LIB = 30 * 864e5;

  function getStatic(info, url, init) {
    var key = 'S:' + info.key, ttl = /^(?:(?:gold|race)\/)?quiz\//.test(info.path) ? TTL_STATIC : TTL_LIB;
    if (MEM[key] && Date.now() - MEM[key].t < ttl) { Q.stats.cacheHit++; return Promise.resolve(jsonRes(MEM[key].body)); }
    if (INF[key]) return INF[key].then(function (r) { return r.clone(); });
    var p = idbGet(key).then(function (v) {
      if (v && Date.now() - v.t < ttl && typeof v.body === 'string') { MEM[key] = v; Q.stats.cacheHit++; return jsonRes(v.body); }
      Q.stats.req++;
      return nativeFetch(url, init).then(function (res) {
        if (!res.ok) return res;
        return res.clone().text().then(function (text) {
          if (text && text !== 'null') { var rec = { t: Date.now(), body: text }; MEM[key] = rec; if (text.length < 8e6) idbPut(key, rec); }
          return res;
        });
      });
    });
    INF[key] = p; var done = function () { delete INF[key]; }; p.then(done, done);
    return p.then(function (r) { return r.clone(); });
  }

  /* ---------- đọc dữ liệu động ---------- */
  function getLive(info, url, init) {
    var key = info.key, c = MEM[key], now = Date.now();
    if (document.hidden && c && now - c.t < HIDDEN_MS) { Q.stats.hidden++; return Promise.resolve(jsonRes(c.body)); }
    if (INF[key]) return INF[key].then(function (r) { return r.clone(); });
    var h = new Headers((init && init.headers) || {});
    var useEtag = Q.etag && noEtag < 3;
    if (useEtag) { h.set('X-Firebase-ETag', 'true'); if (c && c.etag) h.set('If-None-Match', c.etag); }
    var init2 = Object.assign({}, init, { headers: h });
    Q.stats.req++;
    var p = nativeFetch(url, init2).then(function (res) {
      if (res.status === 304 && c) { Q.stats.etagHit++; c.t = Date.now(); return jsonRes(c.body); }
      if (!res.ok) return res;
      var et = res.headers.get('ETag');
      if (useEtag) { if (et) noEtag = 0; else noEtag++; }
      return res.clone().text().then(function (text) {
        if (text.length < 2e6) MEM[key] = { t: Date.now(), body: text, etag: et || null };
        return res;
      });
    }, function (err) {
      /* có thể do Firebase từ chối header ETag (CORS) → tắt ETag và thử lại đúng 1 lần như cũ */
      if (useEtag) { Q.etag = false; return nativeFetch(url, init); }
      throw err;
    });
    INF[key] = p; var done = function () { delete INF[key]; }; p.then(done, done);
    return p.then(function (r) { return r.clone(); });
  }

  /* ---------- ghi ---------- */
  function write(info, url, init) {
    var m = (init.method || 'GET').toUpperCase(), body = typeof init.body === 'string' ? init.body : '';
    if (STATIC.test(info.path)) { delete MEM['S:' + info.key]; idbDel('S:' + info.key); }
    if ((m === 'PUT' || m === 'PATCH') && body.indexOf('.sv') < 0 && info.url.searchParams.get('print') == null) {
      var u = new URL(url); u.searchParams.set('print', 'silent');
      Q.stats.silent++;
      return nativeFetch(u.toString(), init).then(function (res) { return res.status === 204 ? jsonRes('null') : res; });
    }
    return nativeFetch(url, init);
  }

  window.fetch = function (input, init) {
    try {
      if (Q.off) return nativeFetch(input, init);
      var url = typeof input === 'string' ? input : (input && input.url);
      if (!url || !isDb(url)) return nativeFetch(input, init);
      init = init || {};
      var m = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase(), info = parse(url);
      if (m === 'GET') {
        if (info.url.searchParams.get('shallow')) return nativeFetch(input, init);
        if (STATIC.test(info.path)) return getStatic(info, url, init);
        if (LIVE.test(info.path)) return getLive(info, url, init);
        return nativeFetch(input, init);
      }
      if (m === 'PUT' || m === 'PATCH' || m === 'DELETE') return write(info, url, init);
    } catch (e) { /* mọi lỗi bất ngờ: chạy như chưa có quota.js */ }
    return nativeFetch(input, init);
  };
})();
