/* ==========================================================================
   patch.js – "cập nhật theo file" không cần deploy lại
   Nạp ĐẦU TIÊN trong <head> của mọi trang (trước quota.js).

   Cách hoạt động
     • Admin chọn file mới trong dashboard (🔄 Cập nhật file) → file được lưu ở Firebase:
         patchmeta/<khoá>  { p: đường dẫn, t: thời điểm, n: số ký tự, h: mã băm }   (nhỏ, đọc mỗi lần mở trang)
         patches/<khoá>    { p, c: nội dung, t }                                    (chỉ tải khi cần, rồi nhớ trong máy)
     • Mỗi trang vừa mở, patch.js hỏi patchmeta. Không có bản vá → trang chạy như bình thường.
       Có bản vá cho trang này, hoặc cho .js / .css mà trang này nạp → dựng lại trang với nội dung mới
       (file .js/.css được nhúng thẳng vào trang) rồi chạy.
     • Gỡ bản vá (dashboard → 🔄 Cập nhật file → Gỡ) là trang quay về đúng bản đã deploy.

   Lưu ý
     • Chỉ file chữ: .html .js .css. Ảnh, font, .xlsx vẫn phải deploy.
     • patch.js không tự cập nhật được bằng cách này (phải deploy).
     • Khẩn cấp: thêm ?nopatch=1 vào link để bỏ qua mọi bản vá (dùng để vào lại dashboard gỡ bản vá lỗi).
     • Đọc Firebase bằng XHR đồng bộ (vài chục ms) để trang gốc không kịp chạy trước khi bị thay.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__patched || window.__patchRun) return;
  window.__patchRun = 1;
  var me = document.currentScript;
  if (!me || !me.src || /[?&]nopatch=1\b/.test(location.search)) return;

  var DB = 'https://minigame-70bef-default-rtdb.asia-southeast1.firebasedatabase.app';
  var rootUrl = me.src.replace(/patch\.js(\?.*)?$/, '');
  var rootU = new URL(rootUrl);

  function get(url) {
    var x = new XMLHttpRequest();
    x.open('GET', url, false);
    x.send();
    return x.status >= 200 && x.status < 300 ? x.responseText : null;
  }
  var key = function (p) { return encodeURIComponent(p).replace(/\./g, '%2E'); };
  function rel(url) {
    var u; try { u = new URL(url, location.href); } catch (e) { return null; }
    if (u.origin !== rootU.origin) return null;
    var p = decodeURI(u.pathname);
    if (p.indexOf(rootU.pathname) !== 0) return null;
    p = p.slice(rootU.pathname.length);
    return (p === '' || /\/$/.test(p)) ? p + 'index.html' : p;
  }
  function content(it) {
    var ck = 'pp:' + it.k + ':' + it.t, v = null;
    try { v = localStorage.getItem(ck); } catch (e) {}
    if (v !== null) return v;
    var raw = get(DB + '/patches/' + it.k + '/c.json');
    if (raw === null) throw Error('no content');
    v = JSON.parse(raw);
    if (typeof v !== 'string') throw Error('bad content');
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var n = localStorage.key(i);
        if (n && n.indexOf('pp:' + it.k + ':') === 0) localStorage.removeItem(n);
      }
      localStorage.setItem(ck, v);
    } catch (e) {}
    return v;
  }

  try {
    var raw = get(DB + '/patchmeta.json');
    var meta = raw ? JSON.parse(raw) : null;
    if (!meta) return;
    var by = {}, any = false, subs = false, k;
    for (k in meta) {
      if (!meta[k] || !meta[k].p) continue;
      by[meta[k].p] = { k: k, t: meta[k].t };
      any = true;
      if (/\.(js|css)$/i.test(meta[k].p)) subs = true;
    }
    if (!any) return;
    var here = rel(location.href);
    if (here === null) return;
    if (!by[here] && !subs) return;

    var src = by[here] ? content(by[here]) : get(location.href.split('#')[0]);
    if (!src) return;
    var d = new DOMParser().parseFromString(src, 'text/html');
    var changed = !!by[here];

    [].slice.call(d.querySelectorAll('script[src]')).forEach(function (s) {
      var r = rel(s.src);
      if (r === 'patch.js') { s.parentNode.removeChild(s); changed = true; return; }
      if (!r || !by[r] || !/\.js$/i.test(r)) return;
      var n = d.createElement('script');
      for (var i = 0; i < s.attributes.length; i++) if (s.attributes[i].name !== 'src') n.setAttribute(s.attributes[i].name, s.attributes[i].value);
      n.textContent = content(by[r]).replace(/<\/script/gi, '<\\/script');
      s.parentNode.replaceChild(n, s);
      changed = true;
    });
    [].slice.call(d.querySelectorAll('link[rel~="stylesheet"][href]')).forEach(function (l) {
      var r = rel(l.href);
      if (!r || !by[r] || !/\.css$/i.test(r)) return;
      var base = new URL(l.href);
      var css = content(by[r]).replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, function (m, q, u) {
        return /^(data:|https?:|#|\/\/)/i.test(u) ? m : 'url("' + new URL(u, base).href + '")';
      }).replace(/<\/style/gi, '<\\/style');
      var st = d.createElement('style');
      st.textContent = css;
      l.parentNode.replaceChild(st, l);
      changed = true;
    });
    if (!changed) return;

    /* trang gốc có thể có script chạy sớm: gỡ luôn mọi lần nạp patch.js còn sót, đặt cờ để khỏi lặp */
    var html = '<!DOCTYPE html>\n' + d.documentElement.outerHTML;
    window.__patched = 1;
    document.documentElement.style.visibility = 'hidden';
    /* phần còn lại của trang gốc thành văn bản thuần (không script nào chạy), rồi thay cả tài liệu khi đã đọc xong */
    document.write('<plaintext>');
    var swap = function () { document.open(); document.write(html); document.close(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', swap); else swap();
  } catch (e) {
    window.__patched = 0;
    try { document.documentElement.style.visibility = ''; } catch (_) {}
    if (window.console) console.warn('[patch.js] bỏ qua bản vá:', e && e.message);
  }
})();
