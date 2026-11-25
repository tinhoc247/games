/* howto.js – PHÒNG CHỜ của học sinh: hiện MÃ GAME + CÁCH CHƠI của đúng game đang vào.
   Dùng chung cho cả 5 game (kho-bau, doi-vang, bao-ve, chay-dua, tank-war).
   Cách dùng trong trang game:   ${HowTo.block('doi-vang', CODE)}   (đặt trong HTML của phòng chờ)
   - HowTo.code(code)  : chỉ khung mã game (bấm để chép)
   - HowTo.guide(id)   : chỉ khung "Cách chơi" (thu/mở được)
   Phòng chờ vẽ lại HTML mỗi khi có người vào/ra; trạng thái thu/mở được nhớ lại tự động.
   Thêm game mới: thêm 1 mục vào GUIDES bên dưới. */
(function () {
  'use strict';
  var STATE = { open: true };           /* mặc định mở sẵn để học sinh đọc ngay */

  var GUIDES = {
    'kho-bau': {
      icon: '🏝️', name: 'Truy Tìm Kho Báu',
      goal: 'Về đích 💰 kho báu trước các bạn.',
      steps: [
        ['🎯', '<b>Trả lời câu hỏi</b> để đi tiếp. Đúng: <b>+50 vàng</b>, tiến 1 trạm và mở 1 rương. Sai: phải <b>làm lại đúng câu đó</b> (đáp án được xáo lại) cho tới khi đúng; câu làm lại không có vàng.'],
        ['🎁', '<b>Rương</b> có thể là vàng, nhân đôi hoặc mất nửa vàng, rương rỗng, hoặc <b>năng lực</b>: 🛡️ vượt nguy hiểm · 🚀 tiến thêm 1 trạm · ❄️ đóng băng đối phương · ⏪ kéo đối phương lùi 1–2 bước.'],
        ['🧊', 'Bị <b>đóng băng</b> hoặc bị kéo lùi: trả lời đúng 1 câu để rã băng và đi tiếp.'],
        ['🚧', '<b>Chướng ngại</b> (🕳️ 🌲 🐍 🌊 🔥…): dùng đúng vật dụng hoặc trả lời đúng câu hỏi để vượt. Vượt xong, tại trạm trả lời thêm 1 câu, đúng mới mở rương.'],
        ['🏪', '<b>Cửa hàng</b>: dùng vàng mua vật dụng (🏹 🦺 🌉 🧭 🛶 🥾), mở được ngay khi gặp chướng ngại.']
      ]
    },
    'doi-vang': {
      icon: '💰', name: 'Đổi Vàng',
      goal: 'Hết giờ, bạn nào có <b>nhiều vàng nhất</b> sẽ xếp hạng 1.',
      steps: [
        ['❓', 'Trả lời câu hỏi. Đúng thì được <b>chọn 1 trong 3 rương</b>. Sai thì phải <b>làm lại đúng câu đó</b> (đáp án xáo lại), làm lại không được mở rương.'],
        ['💰', '<b>Rương may mắn</b>: 💰 nhận 100 / 200 / 500 vàng · ✨ nhân đôi số vàng đang có · 🫥 rương rỗng.'],
        ['💸', '<b>Rương rủi ro</b>: 💸 mất nửa số vàng đang có.'],
        ['🥷', '<b>Rương "chơi khăm"</b> (em chọn bạn): 🥷 lấy 50% vàng · 🦹 lấy 75% vàng · 🔄 đổi vàng với bạn đó. Bạn đang dẫn đầu sẽ không gặp rương đổi vàng.'],
        ['🏆', 'Bảng xếp hạng ở góc màn hình luôn cập nhật. Vàng của em có thể tăng giảm bất ngờ, nên đừng bỏ cuộc!']
      ]
    },
    'bao-ve': {
      icon: '🏰', name: 'Bảo vệ vương quốc',
      goal: 'Giữ cho vương quốc của đội còn nhiều thành viên (và tù binh) nhất khi hết giờ.',
      steps: [
        ['👥', 'Admin bấm Bắt đầu thì mọi người được <b>chia ngẫu nhiên thành các vương quốc</b> (đội). Mỗi bạn là một nhân vật trong 🏰 thành trì của đội.'],
        ['🛡️', 'Trả lời đúng sẽ <b>tích lũy cho cả đội</b>: 🛡️ Khiên (phòng thủ) hoặc ⚔️ Kiếm (tấn công), tối đa 5 mỗi loại. Sai thì làm lại đúng câu đó, không được thưởng.'],
        ['⚔️', 'Đội còn kiếm thì <b>bất kỳ bạn nào cũng được Tấn công</b>: chọn vương quốc khác, rồi chọn <b>đúng tên người</b> muốn bắt. Mỗi lần tấn công mất 1 kiếm.'],
        ['💥', 'Bị tấn công: còn khiên thì mất 1 khiên; hết khiên thì có người bị bắt vào 🏠 nhà giam (hoặc tù binh được giải cứu trước).'],
        ['🏃', 'Bị bắt vẫn có cơ hội: trả lời đúng <b>3 câu</b> là tự thoát về thành. Đồng đội cũng có thể tấn công để cứu em.'],
        ['⏰', 'Trận kết thúc khi hết giờ hoặc admin kết thúc. Bấm <b>📜 Xem luật chơi</b> ở dưới để đọc đầy đủ.']
      ]
    },
    'chay-dua': {
      icon: '🏁', name: 'Chạy đua',
      goal: 'Là người <b>về đích đầu tiên</b>. Cuộc đua kết thúc ngay khi có người về đích.',
      steps: [
        ['⏱️', 'Khi admin bấm Bắt đầu, cả lớp đếm ngược <b>3 – 2 – 1 – GO!</b> cùng lúc rồi câu đầu tiên hiện ra.'],
        ['✅', 'Đường đua dài bằng số câu hỏi. <b>Đúng thì tiến 1 bước.</b> Mỗi câu hiện toàn màn hình và <b>không tính thời gian</b>, nên cứ đọc kỹ.'],
        ['🔁', 'Sai thì phải <b>làm lại đúng câu đó</b> (đáp án xáo lại). Làm lại đúng vẫn được tiến bước nhưng không tính là câu đúng trong báo cáo.'],
        ['🎲', '<b>Năng lực</b>: trả lời đúng ngay lần đầu ở câu thứ 3, 6, 9, 12… sẽ bốc ngẫu nhiên 1 trong 3: 🚀 tiến thêm 1 bước · ⏪ kéo lùi 1 bước một đối thủ em chọn · 🧊 đóng băng 1 đối thủ 3 giây.'],
        ['👀', 'Thanh tiến độ phía trên cho em thấy mọi người đang chạy tới đâu.']
      ]
    },
    'tank-war': {
      icon: '🛡️', name: 'Tank War',
      goal: 'Hạ nhiều đối thủ nhất khi hết giờ (hòa thì ai có nhiều vàng hơn xếp trên).',
      steps: [
        ['🎮', '<b>Lái</b>: phím <b>W A S D</b> hoặc mũi tên · <b>Ngắm</b> bằng chuột · <b>Giữ chuột trái</b> để bắn. Giữ chuột phải = đi tới con trỏ. Điện thoại: kéo ngón tay <b>nửa trái</b> màn hình để lái, chạm giữ <b>nửa phải</b> để ngắm và bắn.'],
        ['💥', 'Bắn trúng đối thủ: <b>+100 vàng</b>. Chơi theo đội thì không bắn nhầm đồng đội.'],
        ['❓', 'Bị hạ: trả lời đúng 1 câu hỏi để <b>hồi sinh</b> ở chỗ ngẫu nhiên. Sai thì phải làm lại đúng câu đó. Hồi sinh xong giáp và súng về cấp 0.'],
        ['🔧', 'Chạy vào <b>xưởng</b> ở 4 góc (vùng an toàn, không bắn và không bị bắn): phím <b>[1]</b> nâng giáp, <b>[2]</b> nâng súng, mỗi lần <b>1000 vàng</b>, tối đa cấp 3.'],
        ['🛡️', 'Mỗi phát trúng làm mất 1 lớp giáp, hết giáp thì bị hạ. Súng cấp N <b>xuyên N lớp giáp</b>, nên nâng súng giúp hạ đối thủ giáp dày.']
      ]
    }
  };

  var CSS =
    '.ht-code{display:block;width:100%;max-width:420px;margin:10px auto;padding:10px 14px 8px;border-radius:18px;' +
      'background:linear-gradient(135deg,#6C4DF6,#B04CF0);color:#fff;text-align:center;cursor:pointer;user-select:all;' +
      'font-family:inherit;box-shadow:0 6px 0 #4B32C9,0 12px 22px -8px rgba(108,77,246,.55);-webkit-tap-highlight-color:transparent}' +
    '.ht-code:active{transform:translateY(3px);box-shadow:0 3px 0 #4B32C9}' +
    '.ht-code small{display:block;font-weight:700;font-size:12px;line-height:1.2;letter-spacing:.14em;opacity:.9}' +
    '.ht-code b{display:block;font:800 clamp(34px,9vw,52px)/1.1 "Baloo 2","Be Vietnam Pro",system-ui,sans-serif;letter-spacing:.22em;text-indent:.22em;margin:2px 0}' +
    '.ht-code span{display:block;font-weight:600;font-size:12px;line-height:1.2;opacity:.9}' +
    '.ht-guide{display:block;text-align:left;margin:12px auto 8px;max-width:640px;border-radius:16px;background:#F5F3FF;border:2px solid #E1DBFB;color:#1E1B4B;font-size:15px;line-height:1.5}' +
    '.ht-guide>summary{cursor:pointer;list-style:none;padding:10px 14px;font-weight:800;font-size:16px;line-height:1.3;color:#4B32C9;display:flex;align-items:center;gap:8px;user-select:none}' +
    '.ht-guide>summary::-webkit-details-marker{display:none}' +
    '.ht-guide>summary::after{content:"▾";margin-left:auto;transition:transform .2s}' +
    '.ht-guide:not([open])>summary::after{transform:rotate(-90deg)}' +
    '.ht-body{padding:0 14px 12px}' +
    '.ht-goal{margin:0 0 8px;padding:8px 10px;border-radius:12px;background:#FFF3C4;color:#6B4A00;font-weight:600}' +
    '.ht-body ol{list-style:none;margin:0;padding:0}' +
    '.ht-body li{display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-top:1px dashed #D8D2F5}' +
    '.ht-body li:first-child{border-top:0}' +
    '.ht-body li i{flex:none;font-style:normal;font-size:20px;line-height:1.3;width:1.6em;text-align:center}' +
    '.ht-body li div{flex:1;min-width:0;overflow-wrap:anywhere}' +
    '.ht-note{margin:8px 0 0;font-size:13px;color:#6B6A8A;text-align:center}';

  function addCss() {
    if (document.getElementById('ht-css') || !document.head) return;
    var s = document.createElement('style'); s.id = 'ht-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function codeHtml(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return '';
    return '<div role="button" tabindex="0" class="ht-code" data-code="' + esc(code) + '" aria-label="Mã game ' + esc(code) + ', bấm để chép">' +
      '<small>🎟️ MÃ GAME</small><b>' + esc(code) + '</b><span>📋 Bấm để chép mã</span></div>';
  }
  function guideHtml(id) {
    var g = GUIDES[id]; if (!g) return '';
    return '<details class="ht-guide" id="howto">' +
      '<summary>📖 Cách chơi ' + esc(g.name) + '</summary>' +
      '<div class="ht-body"><p class="ht-goal">🎯 <b>Mục tiêu:</b> ' + g.goal + '</p><ol>' +
      g.steps.map(function (s) { return '<li><i>' + s[0] + '</i><div>' + s[1] + '</div></li>'; }).join('') +
      '</ol><p class="ht-note">Em đọc trong lúc chờ thầy/cô bấm Bắt đầu nhé!</p></div></details>';
  }

  window.HowTo = {
    GUIDES: GUIDES,
    code: codeHtml,
    guide: guideHtml,
    block: function (id, code) { return codeHtml(code) + guideHtml(id); }
  };

  /* Nhớ trạng thái thu/mở: phòng chờ bị vẽ lại khi có người vào/ra, nên áp lại cho khung mới xuất hiện. */
  function apply(root) {
    var els = (root && root.querySelectorAll) ? root.querySelectorAll('details.ht-guide') : [];
    for (var i = 0; i < els.length; i++) { if (els[i].open !== STATE.open) els[i].open = STATE.open; }
  }
  document.addEventListener('toggle', function (e) {
    var t = e.target; if (t && t.classList && t.classList.contains('ht-guide')) STATE.open = t.open;
  }, true);
  function observe() {
    addCss(); apply(document);
    if (!window.MutationObserver) return;
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var a = ms[i].addedNodes;
        for (var j = 0; j < a.length; j++) { if (a[j].nodeType === 1) { if (a[j].matches && a[j].matches('details.ht-guide')) { if (a[j].open !== STATE.open) a[j].open = STATE.open; } else apply(a[j]); } }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) observe(); else document.addEventListener('DOMContentLoaded', observe);

  /* Bấm khung mã để chép */
  function copy(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) return navigator.clipboard.writeText(txt);
    return new Promise(function (ok, no) {
      try { var t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); var r = document.execCommand('copy'); document.body.removeChild(t); r ? ok() : no(); } catch (e) { no(e); }
    });
  }
  function onCopy(e) {
    var b = e.target.closest && e.target.closest('.ht-code'); if (!b) return;
    var lab = b.querySelector('span'), old = lab ? lab.textContent : '';
    copy(b.getAttribute('data-code') || '').then(function () { if (lab) { lab.textContent = '✓ Đã chép mã'; setTimeout(function () { if (lab.isConnected) lab.textContent = old; }, 1500); } }, function () { });
  }
  document.addEventListener('click', onCopy);
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { if (e.target.classList && e.target.classList.contains('ht-code')) { e.preventDefault(); onCopy(e); } } });
})();
