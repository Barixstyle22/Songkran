/* Songkran shoreline: random waves wash over the sand and wet the title.
   Needs <div class="hero" id="hero"><canvas></canvas></div> in the page. */
(function () {
  'use strict';
  var hero = document.getElementById('hero');
  if (!hero) return;
  var cv = hero.querySelector('canvas');
  var ctx = cv && cv.getContext('2d');
  if (!ctx) return;

  var TITLE = 'SONGKRAN';
  var CELL = 3;                       // size of one wet-sand cell (css px)
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, DPR = 1, gw = 0, gh = 0;
  var sand, txtDry, txtWet, tmp, maskC, maskX, maskImg, wet, wt, dryRate, titleCy = 0, baseLvl = 0, D = 100;
  var waves = [], T = 0, nextWave = 0, setLeft = 0, setS = 0;
  var seed = Math.random() * 1000, running = false, raf = 0, last = 0;

  /* ---------- helpers ---------- */
  function rng(a) {                   // small seeded random, keeps sand/droplets stable on resize
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(n) { var s = Math.sin(n * 127.1 + seed) * 43758.5453; return s - Math.floor(s); }
  function noise(x) {                 // smooth 1D noise, 0..1
    var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f);
    return hash(i) * (1 - f) + hash(i + 1) * f;
  }
  function mk() {
    var c = document.createElement('canvas');
    c.width = cv.width; c.height = cv.height;
    var g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    return c;
  }

  /* ---------- static layers ---------- */
  function drawSand() {
    var c = sand.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#efd2ac'); g.addColorStop(1, '#f4dcbb');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var r = rng(7), n = Math.min(260000, Math.floor(W * H / 8));
    for (var i = 0; i < n; i++) {
      var x = r() * W, y = r() * H, z = 0.4 + r() * 1.0;
      c.fillStyle = r() < 0.55 ? 'rgba(150,140,105,' + (0.05 + r() * 0.1) + ')'
                               : 'rgba(255,248,230,' + (0.12 + r() * 0.15) + ')';
      c.fillRect(x, y, z, z);
    }
  }

  function drawText() {
    var s = txtDry.getContext('2d'), w = txtWet.getContext('2d');
    var fam = 'Arial, Helvetica, sans-serif';
    s.font = 'bold 100px ' + fam;
    var fs = Math.min(W * 0.92 / s.measureText(TITLE).width * 100, H * 0.30);
    var capH = fs * 0.716, spacer = document.querySelector('.hero-space'),
        mid = (spacer ? spacer.offsetHeight : H * 0.46) * 0.65,   // title follows the gap left above your nav
        cy = mid + capH / 2, top = cy - capH, bot = cy;
    titleCy = cy; baseLvl = cy + H * 0.26; D = baseLvl - cy;

    function paint(c, stops, shadow) {
      c.font = 'bold ' + fs + 'px ' + fam;
      c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
      var g = c.createLinearGradient(0, top, 0, bot);
      for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      c.shadowColor = 'transparent';
      c.fillStyle = g; c.fillText(TITLE, W / 2, cy);
      c.shadowColor = 'transparent';
      c.lineWidth = Math.max(1.5, fs * 0.018);
      c.strokeStyle = 'rgba(255,255,255,.95)'; c.strokeText(TITLE, W / 2, cy);
    }
    // dry = sun-bleached, wet = deeper and glossy
    paint(s, [[0, '#a9c4ff'], [.3, '#c58ae8'], [.55, '#e48ae0'], [.8, '#c093ee'], [1, '#8fc8ff']], 'rgba(120,135,115,.38)');
    paint(w, [[0, '#6f9bff'], [.3, '#9a44d8'], [.55, '#e23ec6'], [.8, '#8a4de0'], [1, '#3f9bf5']], 'rgba(70,95,85,.55)');

    // gloss streak on the wet version
    var gl = w.createLinearGradient(W * 0.1, 0, W * 0.9, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(.5, 'rgba(255,255,255,.28)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    w.save(); w.shadowColor = 'transparent'; w.fillStyle = gl;
    w.beginPath(); w.rect(0, top, W, capH * 0.4); w.clip();
    w.fillText(TITLE, W / 2, cy); w.restore();
  }

  function build() {
    var r = hero.getBoundingClientRect();
    W = Math.max(200, r.width); H = Math.max(200, r.height);
    DPR = Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2);   // always at least 1.5x sharp
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    sand = mk(); txtDry = mk(); txtWet = mk(); tmp = mk();
    drawSand(); drawText();
    gw = Math.ceil(W / CELL); gh = Math.ceil(H / CELL);
    maskC = document.createElement('canvas'); maskC.width = gw; maskC.height = gh;
    maskX = maskC.getContext('2d'); maskImg = maskX.createImageData(gw, gh);
    wet = new Float32Array(gw * gh); wt = new Float32Array(gw * gh); dryRate = new Float32Array(gw * gh);
    for (var i = 0; i < dryRate.length; i++) dryRate[i] = 0.05 + Math.random() * 0.07; // patchy drying
    if (!running) render();
  }

  /* ---------- waves ---------- */
  function spawn(s, delay) {
    waves.push({
      t0: T + (delay || 0),
      dur: 5.2 + s * 2.8 + Math.random() * 1.5,
      reach: D * (0.565 + 1.17 * s),
      tilt: (Math.random() - 0.5) * 2.6,       // wave arrives at an angle: one side first
      sd: Math.random() * 1000
    });
  }
  function pickS() {
    var r = Math.random();
    if (r < 0.5) return 0.1 + Math.random() * 0.28;    // small: stops short of the title
    if (r < 0.85) return 0.38 + Math.random() * 0.4;   // medium: wets the bottom of the letters
    return 0.8 + Math.random() * 0.3;                  // big: soaks most of the title
  }
  function schedule() {
    if (T < nextWave) return;
    if (setLeft > 0) {                                 // inside a "set" of waves
      spawn(Math.min(1.15, setS * (0.8 + Math.random() * 0.35)));
      setLeft--;
      nextWave = T + (setLeft > 0 ? 0.9 + Math.random() * 1.1 : 2.5 + Math.random() * 3);
    } else if (Math.random() < 0.16) {                 // a set begins
      setLeft = 1 + (Math.random() * 3 | 0); setS = 0.6 + Math.random() * 0.4;
      spawn(setS); nextWave = T + 1 + Math.random();
    } else {
      spawn(pickS()); nextWave = T + 1.8 + Math.random() * 4.5;
    }
    waves = waves.filter(function (w) { return T < w.t0 + w.dur + 2; });
  }
  function swash(u) {                                  // gentle surge up, slow pull back
    if (u <= 0 || u >= 1) return 0;
    if (u < 0.36) {
      var k = u / 0.36, sm = k * k * (3 - 2 * k);
      return 0.5 * sm + 0.5 * (1 - (1 - k) * (1 - k));
    }
    return 0.5 * (1 + Math.cos(Math.PI * (u - 0.36) / 0.64));
  }
  function baseY(x) {
    var k = H / 450;
    return baseLvl + H * 0.025 * Math.sin(T * 0.05 + seed) +
      (3.5 * Math.sin(x * 0.006 + T * 0.6) + 1.8 * Math.sin(x * 0.014 - T * 0.9)) * k;
  }
  function edgeY(x) {
    var h = 0, hs = 0;
    for (var i = 0; i < waves.length; i++) {
      var w = waves[i], u = (T - w.t0 - w.tilt * (x / W - 0.5)) / w.dur;
      if (u > 0 && u < 1) {
        var p = 0.7 + 0.45 * noise(x * 0.0035 + w.sd) + 0.06 * noise(x * 0.01 + w.sd * 2);
        var v = w.reach * p * swash(u);
        hs += v * v * v;
      }
    }
    h = Math.cbrt(hs);
    return Math.max(H * 0.04, baseY(x) - h);
  }

  /* ---------- per frame ---------- */
  function updateWet(dt) {
    var cx, cy, i, a;
    for (cx = 0; cx < gw; cx++) {
      var row0 = Math.max(0, Math.floor(edgeY(cx * CELL + CELL / 2) / CELL));
      for (cy = 0; cy < gh; cy++) {
        i = cy * gw + cx;
        if (cy >= row0) { if (wet[i] < 1) wet[i] = Math.min(1, wet[i] + dt * 8); }
        else if (wet[i] > 0) wet[i] = Math.max(0, wet[i] - dt * dryRate[i]);
      }
    }
    var d = maskImg.data, l, r, u, dn;
    for (cy = 0; cy < gh; cy++) for (cx = 0; cx < gw; cx++) {
      i = cy * gw + cx; l = cx > 0 ? i - 1 : i; r = cx < gw - 1 ? i + 1 : i;
      wt[i] = (wet[l] + 2 * wet[i] + wet[r]) / 4;
    }
    for (cy = 0; cy < gh; cy++) for (cx = 0; cx < gw; cx++) {
      i = cy * gw + cx; u = cy > 0 ? i - gw : i; dn = cy < gh - 1 ? i + gw : i;
      a = (wt[u] + 2 * wt[i] + wt[dn]) / 4;
      d[i * 4] = 105; d[i * 4 + 1] = 112; d[i * 4 + 2] = 92; d[i * 4 + 3] = a * 255;
    }
    maskX.putImageData(maskImg, 0, 0);
  }

  function smooth(ys, r) {                 // moving average: removes small jagged bits
    var out = [], n = ys.length, i, j, t, c;
    for (i = 0; i < n; i++) {
      t = 0; c = 0;
      for (j = -r; j <= r; j++) if (i + j >= 0 && i + j < n) { t += ys[i + j]; c++; }
      out[i] = t / c;
    }
    return out;
  }
  function curve(xs, ys) {                 // one smooth curve through the points
    var n = xs.length, i;
    ctx.moveTo(xs[0], ys[0]);
    for (i = 1; i < n - 1; i++) ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
    ctx.lineTo(xs[n - 1], ys[n - 1]);
  }
  function shifted(ys, dy) { return ys.map(function (y) { return y + dy; }); }

  function drawLayer(off, amp, k, fill, foam, wid) {
    var step = 8, n = Math.ceil(W / step) + 1, xs = [], ys = [], i;
    var f = 0.005 + 0.0015 * k, sp = 0.3 + 0.1 * k;
    for (i = 0; i < n; i++) {
      var x = Math.min(W, i * step); xs[i] = x;
      ys[i] = baseY(x) + off + amp * (Math.sin(x * f + T * sp + k * 3) + 0.5 * Math.sin(x * f * 2.1 - T * sp * 1.3 + k));
    }
    ctx.beginPath(); curve(xs, ys); ctx.lineTo(W, H + 2); ctx.lineTo(0, H + 2); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); curve(xs, ys);
    ctx.lineWidth = wid * 2.6; ctx.strokeStyle = 'rgba(160,230,250,' + foam * 0.4 + ')'; ctx.stroke();
    ctx.lineWidth = wid; ctx.strokeStyle = 'rgba(255,255,255,' + foam + ')'; ctx.stroke();
  }

  function drawWater() {
    var step = 4, n = Math.ceil(W / step) + 1, xs = [], ys = [], i;
    for (i = 0; i < n; i++) { xs[i] = Math.min(W, i * step); ys[i] = edgeY(xs[i]); }
    ys = smooth(ys, 3);

    ctx.beginPath(); curve(xs, ys); ctx.lineTo(W, H + 2); ctx.lineTo(0, H + 2); ctx.closePath();
    var g = ctx.createLinearGradient(0, H * 0.40, 0, H);
    g.addColorStop(0, 'rgba(150,240,232,.34)'); g.addColorStop(.2, 'rgba(70,215,232,.52)');
    g.addColorStop(.42, 'rgba(70,185,243,.78)'); g.addColorStop(.68, 'rgba(38,140,226,.95)');
    g.addColorStop(1, 'rgba(18,86,178,1)');
    ctx.fillStyle = g; ctx.fill();

    // slow drifting light and dark patches inside the water
    ctx.save(); ctx.clip();
    for (var b = 1; b <= 7; b++) {
      var bx = W * (0.5 + 0.5 * Math.sin(T * 0.05 * b + b * 2.1));
      var by = H * (0.72 + 0.25 * Math.sin(T * 0.07 * b + b));
      var rg = ctx.createRadialGradient(bx, by, 0, bx, by, H * 0.35);
      var col = ['255,255,255,.12', '40,220,230,.17', '10,70,170,.17'][b % 3];
      rg.addColorStop(0, 'rgba(' + col + ')'); rg.addColorStop(1, 'rgba(' + col.split(',').slice(0, 3).join(',') + ',0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // water layers further out, plus swells that roll toward the shore
    drawLayer(H * 0.07, 4, 1, 'rgba(0,205,225,.11)', 0.30, 2);
    drawLayer(H * 0.16, 6, 2, 'rgba(25,130,225,.15)', 0.24, 2.5);
    drawLayer(H * 0.29, 8, 3, 'rgba(8,55,160,.22)', 0.20, 3);
    for (var k = 0; k < 4; k++) {
      var p = (T * 0.04 + k / 4 + (seed % 1)) % 1, al = Math.sin(Math.PI * p);
      if (al < 0.05) continue;
      drawLayer(10 + (1 - p) * H * 0.26, 3 + 5 * (1 - p), k + 1.7, 'rgba(20,150,225,' + (0.07 * al) + ')', 0.55 * al, 1.5 + 2.5 * p);
    }

    // turquoise rim along the shoreline
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); curve(xs, ys);
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(110,210,238,.85)'; ctx.stroke();
    ctx.beginPath(); curve(xs, shifted(ys, 2));
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(210,248,255,.7)'; ctx.stroke();

    // foam: one continuous soft line whose strength changes slowly along the shore
    var fg = ctx.createLinearGradient(0, 0, W, 0);
    for (i = 0; i <= 16; i++) {
      var fa = Math.max(0, noise(i * 0.9 + T * 0.3) - 0.3) * 1.4;
      fg.addColorStop(i / 16, 'rgba(255,255,255,' + Math.min(0.9, fa) + ')');
    }
    ctx.beginPath(); curve(xs, shifted(ys, -1));
    ctx.strokeStyle = fg; ctx.globalAlpha = 0.3; ctx.lineWidth = 11; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 3.5; ctx.stroke();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var cw = cv.width, ch = cv.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(sand, 0, 0);
    ctx.globalAlpha = 0.5; ctx.drawImage(maskC, 0, 0, cw, ch); ctx.globalAlpha = 1;   // damp sand
    var ta = Math.max(0, Math.min(1, 1 - (window.pageYOffset || 0) / (H * 0.35)));
    if (ta > 0.01) {
    ctx.globalAlpha = ta; ctx.drawImage(txtDry, 0, 0); ctx.globalAlpha = 1;
    var t = tmp.getContext('2d');                                                      // wet text, masked by wetness
    t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, cw, ch); t.drawImage(txtWet, 0, 0);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(maskC, 0, 0, cw, ch);
    t.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ta; ctx.drawImage(tmp, 0, 0); ctx.globalAlpha = 1;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawWater();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    T += dt; schedule(); updateWet(dt); render();
  }
  function start() { if (running || reduce) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  /* ---------- init ---------- */
  function init() {
    build();
    if (reduce) {                                      // still picture for people who prefer less motion
      T = 3; spawn(0.55, -1.3);
      for (var i = 0; i < 6; i++) updateWet(0.5);
      render(); return;
    }
    spawn(0.45, 0.3); nextWave = 2.8;                  // first wave shows up almost immediately
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { e[0].isIntersecting ? start() : stop(); }).observe(hero);
    } else start();
    if ('ResizeObserver' in window) {
      var pend = 0;
      new ResizeObserver(function () {
        cancelAnimationFrame(pend);
        pend = requestAnimationFrame(function () { if (Math.abs(hero.clientWidth - W) > 1 || Math.abs(hero.clientHeight - H) > 100) build(); });
      }).observe(hero);
    }
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(init);
})();
