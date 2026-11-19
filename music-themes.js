/* Nhạc nền riêng cho từng game (WebAudio, không cần file âm thanh).
   Mỗi chủ đề: { bar: số giây/ô nhịp, vol: âm lượng nền (vừa phải), play(h, t, n) } phát 1 ô nhịp bắt đầu lúc t.
   h = { ctx, E (1/8 ô nhịp), fq(semitone), note(...), kick(t), noise(...), mg (bus giai điệu), dm (bus trống) }.
   Chọn chủ đề: race (Chạy đua) · tank (Tank War) · gold (Đội vàng) · guard (Bảo vệ) · treasure (Kho báu). */
(function () {
  'use strict';
  const T = window.HubThemes = {};

  /* nốt kéo dài (kèn, accordion, pad): vào nhẹ, giữ, tắt nhẹ — khác nốt gảy của note() */
  function sus(h, f, t, d, type, v, a, lp, bus) {
    const c = h.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lp || 1500;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + Math.max(a + .001, d - .12)); g.gain.linearRampToValueAtTime(.0001, t + d);
    o.connect(fl); fl.connect(g); g.connect(bus || h.mg); o.start(t); o.stop(t + d + .05);
  }

  /* ===== 🏁 Chạy đua: sôi động, trống dồn + giai điệu vui (giữ như cũ) ===== */
  (function () {
    const CH = [[0, 0], [-5, 0], [-3, 1], [-7, 0], [0, 0], [-5, 0], [-7, 0], [-5, 0]];
    const ML = [
      [[0, 7, 1], [1, 7, 1], [2, 9, 1], [3, 7, 1], [4, 12, 3], [7, 9, 1]],
      [[0, 11, 1], [1, 11, 1], [2, 12, 1], [3, 11, 1], [4, 7, 3], [7, 4, 1]],
      [[0, 9, 1], [1, 9, 1], [2, 12, 1], [3, 9, 1], [4, 16, 3], [7, 12, 1]],
      [[0, 12, 1], [1, 12, 1], [2, 9, 1], [3, 5, 1], [4, 9, 3], [7, 7, 1]],
      [[0, 7, 1], [1, 7, 1], [2, 9, 1], [3, 7, 1], [4, 12, 3], [7, 14, 1]],
      [[0, 16, 1], [1, 14, 1], [2, 11, 1], [3, 14, 1], [4, 11, 3], [7, 7, 1]],
      [[0, 9, 1], [1, 12, 1], [2, 16, 1], [3, 12, 1], [4, 17, 2], [6, 16, 1], [7, 12, 1]],
      [[0, 14, 1], [1, 14, 1], [2, 11, 1], [3, 14, 1], [4, 7, 2], [6, 11, 1], [7, 14, 1]]];
    T.race = {
      bar: 1.8, vol: .18,
      play(h, t, n) {
        const E = h.E, fq = h.fq, bar = n % 8, c = CH[bar], r = c[0], tn = c[1] ? [0, 3, 7] : [0, 4, 7];
        for (let b = 0; b < 4; b++) h.kick(t + b * 2 * E);
        [2, 6].forEach(i => h.noise(t + i * E, .14, .4, 2000, 'bandpass'));
        for (let i = 0; i < 8; i++) h.noise(t + i * E, i % 2 ? .07 : .03, i % 2 ? .18 : .09, 8000, 'highpass');
        if (bar == 7) for (let k = 1; k < 4; k++) h.noise(t + (6 + k / 2) * E, .08, .28, 2500, 'bandpass');
        for (let i = 0; i < 8; i++) h.note(fq(r - 12 + (i == 7 ? 7 : i % 2 ? 12 : 0)), t + i * E, E * .8, 'sawtooth', .1, .005, h.mg, 900);
        for (let i = 1; i < 8; i += 2) tn.forEach(x => h.note(fq(r + x), t + i * E, E * .45, 'square', .013, .004));
        ML[bar].forEach(m => h.note(fq(m[1]), t + m[0] * E, E * m[2] * .92, 'square', .04, .01));
      }
    };
  })();

  /* ===== 💥 Tank War: hành khúc quân đội vui, trống snare + kèn đồng ===== */
  (function () {
    const CH = [[0, 0], [0, 0], [5, 0], [7, 0], [0, 0], [9, 1], [7, 0], [0, 0]];   /* [nốt gốc, thứ?] C C F G | C Am G C */
    const ML = [
      [[0, 7, 1], [1, 7, 1], [2, 12, 2], [4, 12, 1], [5, 11, 1], [6, 12, 2]],
      [[0, 16, 2], [2, 14, 1], [3, 12, 1], [4, 7, 4]],
      [[0, 9, 1], [1, 9, 1], [2, 14, 2], [4, 14, 1], [5, 12, 1], [6, 14, 2]],
      [[0, 17, 2], [2, 16, 1], [3, 14, 1], [4, 11, 2], [6, 7, 2]],
      [[0, 12, 1], [1, 12, 1], [2, 16, 2], [4, 16, 1], [5, 14, 1], [6, 16, 2]],
      [[0, 21, 2], [2, 19, 1], [3, 16, 1], [4, 12, 2], [6, 16, 2]],
      [[0, 14, 1], [1, 14, 1], [2, 19, 2], [4, 17, 1], [5, 16, 1], [6, 14, 2]],
      [[0, 12, 4], [4, 7, 1], [5, 9, 1], [6, 11, 1], [7, 12, 1]]];
    T.tank = {
      bar: 2.0, vol: .17,
      play(h, t, n) {
        const E = h.E, fq = h.fq, bar = n % 8, r = CH[bar][0], m = CH[bar][1];
        h.kick(t); h.kick(t + 4 * E);
        [2, 6].forEach(i => h.noise(t + i * E, .12, .32, 1800, 'bandpass'));
        [3, 7].forEach(i => h.noise(t + i * E, .05, .12, 2200, 'bandpass'));
        if (bar == 3 || bar == 7) for (let k = 0; k < 4; k++) h.noise(t + (6 + k / 2) * E, .06, .2 + k * .03, 2200, 'bandpass');
        h.note(fq(r - 12), t, E * 1.7, 'sawtooth', .085, .005, h.mg, 800);
        h.note(fq(r - 12 + 7), t + 4 * E, E * 1.7, 'sawtooth', .085, .005, h.mg, 800);
        [2, 6].forEach(i => [0, m ? 3 : 4, 7].forEach(x => h.note(fq(r + x), t + i * E, E * .55, 'square', .014, .004)));
        ML[bar].forEach(x => h.note(fq(x[1]), t + x[0] * E, E * x[2] * .9, 'sawtooth', .036, .015, h.mg, 1700));
      }
    };
  })();

  /* ===== 🪙 Đội vàng: nhí nhảnh, như tiếng xylophone nhặt vàng ===== */
  (function () {
    const CH = [[0, 0], [9, 1], [5, 0], [7, 0], [0, 0], [9, 1], [2, 1], [7, 0]];   /* C Am F G | C Am Dm G */
    const ML = [
      [[0, 12, 1], [1, 16, 1], [2, 19, 1], [3, 16, 1], [4, 24, 2], [6, 19, 1], [7, 16, 1]],
      [[0, 21, 1], [1, 19, 1], [2, 16, 1], [3, 12, 1], [4, 16, 2], [6, 19, 2]],
      [[0, 17, 1], [1, 21, 1], [2, 24, 1], [3, 21, 1], [4, 17, 2], [6, 21, 1], [7, 24, 1]],
      [[0, 23, 1], [1, 19, 1], [2, 14, 1], [3, 19, 1], [4, 23, 2], [6, 26, 2]],
      [[0, 24, 1], [1, 19, 1], [2, 16, 1], [3, 19, 1], [4, 24, 1], [5, 28, 1], [6, 24, 2]],
      [[0, 21, 1], [1, 24, 1], [2, 28, 1], [3, 24, 1], [4, 21, 2], [6, 16, 2]],
      [[0, 14, 1], [1, 17, 1], [2, 21, 1], [3, 17, 1], [4, 14, 2], [6, 17, 1], [7, 21, 1]],
      [[0, 19, 1], [1, 23, 1], [2, 26, 1], [3, 23, 1], [4, 19, 1], [5, 14, 1], [6, 19, 2]]];
    T.gold = {
      bar: 1.9, vol: .16,
      play(h, t, n) {
        const E = h.E, fq = h.fq, bar = n % 8, r = CH[bar][0], m = CH[bar][1];
        h.kick(t); h.kick(t + 4 * E);
        [2, 6].forEach(i => h.noise(t + i * E, .1, .28, 1500, 'bandpass'));
        for (let i = 1; i < 8; i += 2) h.noise(t + i * E, .04, .13, 9000, 'highpass');
        [[0, 0], [3, 7], [4, 0], [6, 7]].forEach(p => h.note(fq(r - 12 + p[1]), t + p[0] * E, E * .6, 'triangle', .17, .004, h.mg, 900));
        [3, 7].forEach(i => [0, m ? 3 : 4, 7].forEach(x => h.note(fq(r + x), t + i * E, E * .4, 'square', .011, .004)));
        ML[bar].forEach(x => {
          h.note(fq(x[1]), t + x[0] * E, E * x[2] * .75, 'triangle', .075, .004, h.mg, 3500);
          h.note(fq(x[1] + 12), t + x[0] * E, E * .3, 'sine', .018, .002, h.mg);
        });
      }
    };
  })();

  /* ===== 🛡️ Bảo vệ: hùng tráng, kèn + trống timpani + đàn hạc ===== */
  (function () {
    const CH = [[-3, 1], [-7, 0], [0, 0], [-5, 0], [-3, 1], [-7, 0], [-5, 0], [0, 0]];   /* Am F C G | Am F G C */
    const ML = [
      [[0, 16, 3], [3, 12, 1], [4, 16, 2], [6, 19, 2]],
      [[0, 17, 3], [3, 16, 1], [4, 12, 2], [6, 9, 2]],
      [[0, 12, 2], [2, 16, 2], [4, 19, 3], [7, 16, 1]],
      [[0, 14, 2], [2, 19, 2], [4, 23, 3], [7, 19, 1]],
      [[0, 21, 3], [3, 19, 1], [4, 16, 2], [6, 12, 2]],
      [[0, 17, 2], [2, 21, 2], [4, 24, 3], [7, 21, 1]],
      [[0, 23, 2], [2, 19, 2], [4, 14, 2], [6, 11, 2]],
      [[0, 16, 2], [2, 19, 2], [4, 24, 4]]];
    T.guard = {
      bar: 2.6, vol: .17,
      play(h, t, n) {
        const E = h.E, fq = h.fq, bar = n % 8, r = CH[bar][0], m = CH[bar][1], B = E * 8;
        h.kick(t); h.kick(t + 4 * E);
        [2, 6].forEach(i => h.noise(t + i * E, .16, .16, 1200, 'bandpass'));
        if (bar % 4 == 0) h.noise(t, .9, .1, 6000, 'highpass');
        [0, m ? 3 : 4, 7].forEach(x => sus(h, fq(r + 12 + x), t, B * .98, 'sawtooth', .011, .35, 900));
        h.note(fq(r - 12), t, E * 3.5, 'sawtooth', .09, .01, h.mg, 700);
        h.note(fq(r - 12), t + 4 * E, E * 3.5, 'sawtooth', .08, .01, h.mg, 700);
        const ar = [0, 7, 12, 12 + (m ? 3 : 4), 12, 12 + (m ? 3 : 4), 12, 7];
        for (let i = 0; i < 8; i++) h.note(fq(r + ar[i]), t + i * E, E * .9, 'triangle', .05, .005, h.mg, 2500);
        ML[bar].forEach(x => sus(h, fq(x[1]), t + x[0] * E, E * x[2] * .98, 'sawtooth', .04, .05, 1500));
      }
    };
  })();

  /* ===== 🏝️ Kho báu: nhịp 6/8 phiêu lưu hải tặc vui, đàn ukulele + accordion ===== */
  (function () {
    const CH = [[2, 1], [0, 0], [2, 1], [9, 0], [2, 1], [0, 0], [5, 0], [9, 0]];   /* Dm C Dm A | Dm C F A */
    const ML = [
      [[0, 14, 1], [1, 14, 1], [2, 17, 1], [3, 21, 2], [5, 17, 1]],
      [[0, 19, 1], [1, 19, 1], [2, 16, 1], [3, 16, 1], [4, 12, 2]],
      [[0, 17, 1], [1, 17, 1], [2, 21, 1], [3, 17, 1], [4, 14, 1], [5, 17, 1]],
      [[0, 16, 2], [2, 13, 1], [3, 16, 1], [4, 21, 2]],
      [[0, 21, 1], [1, 21, 1], [2, 17, 1], [3, 14, 2], [5, 17, 1]],
      [[0, 16, 1], [1, 16, 1], [2, 19, 1], [3, 16, 1], [4, 12, 2]],
      [[0, 17, 1], [1, 21, 1], [2, 24, 2], [4, 21, 1], [5, 17, 1]],
      [[0, 21, 1], [1, 16, 1], [2, 13, 1], [3, 16, 1], [4, 9, 2]]];
    T.treasure = {
      bar: 2.0, vol: .17,
      play(h, t, n) {
        const E = h.E, fq = h.fq, bar = n % 8, r = CH[bar][0], m = CH[bar][1], S = E * 8 / 6;
        h.kick(t); h.kick(t + 3 * S);
        [1, 2, 4, 5].forEach(u => h.noise(t + u * S, .05, .13, 7000, 'highpass'));
        [0, 3].forEach(u => h.noise(t + u * S, .04, .06, 7000, 'highpass'));
        h.note(fq(r - 12), t, S * 2.2, 'triangle', .19, .005, h.mg, 800);
        h.note(fq(r - 12 + 7), t + 3 * S, S * 2.2, 'triangle', .17, .005, h.mg, 800);
        [1, 2, 4, 5].forEach(u => [0, m ? 3 : 4, 7].forEach((x, i) => h.note(fq(r + x), t + u * S + i * .012, S * .7, 'triangle', .05, .003, h.mg, 3000)));
        ML[bar].forEach(x => sus(h, fq(x[1]), t + x[0] * S, S * x[2] * .95, 'sawtooth', .03, .02, 1800));
      }
    };
  })();
})();
