/* Splash page transition: a wave of water floods the screen when you click a link,
   then drains away on the next page to reveal it. */
(function () {
  'use strict';
  var root = document.documentElement, KEY = 'sk-wipe';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:10000;pointer-events:none;display:none';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d');
  if (!ctx) { root.classList.remove('wiping'); return; }

  var W = 0, H = 0, DPR = 1, busy = false, parts = [], acc = 0, ph = [0, 1, 2];
  var D = 0.12;                                   // how far the three water layers trail each other

  function size() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  function lp(p, i) { return Math.min(1, Math.max(0, p * (1 + 2 * D) - D * i)); }   // progress of layer i
  function fing(x, p, k) {                        // the splashy, uneven shape of the leading edge
    return 0.5 * Math.sin(x * 0.0042 + ph[0] + k * 1.7 + p * 4) +
           0.3 * Math.sin(x * 0.0105 + ph[1] + k * 2.9 - p * 6) +
           0.2 * Math.sin(x * 0.022 + ph[2] + k + p * 9);
  }
  function ey(x, p, k) {
    var pi = lp(p, k), A = H * 0.14;
    return (1 - pi) * (H + A + 60) - A + A * Math.sin(Math.PI * pi) * fing(x, pi, k) * (k === 0 ? 1 : 0.7);
  }
  function curve(xs, ys) {
    var n = xs.length, i;
    ctx.moveTo(xs[0], ys[0]);
    for (i = 1; i < n - 1; i++) ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
    ctx.lineTo(xs[n - 1], ys[n - 1]);
  }

  function layer(k, p, tt) {
    var pi = lp(p, k);
    if (pi <= 0) return;
    var step = 14, n = Math.ceil(W / step) + 1, xs = [], ys = [], i;
    for (i = 0; i < n; i++) { xs[i] = Math.min(W, i * step); ys[i] = ey(xs[i], p, k); }
    ctx.beginPath(); curve(xs, ys); ctx.lineTo(W, H + 300); ctx.lineTo(0, H + 300); ctx.closePath();
    if (k === 0) ctx.fillStyle = 'rgba(214,247,255,.96)';
    else if (k === 1) ctx.fillStyle = '#7fe3ee';
    else { var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#46c8ef'); g.addColorStop(.5, '#2f9ae8'); g.addColorStop(1, '#1d6cc4'); ctx.fillStyle = g; }
    ctx.fill();
    if (k === 2) {                                // light and dark patches that fade out once the screen is fully covered
      var bf = Math.min(1, (1 - pi) * 6);
      if (bf > 0.01) {
        ctx.save(); ctx.clip();
        for (var b = 1; b <= 6; b++) {
          var bx = W * (0.5 + 0.45 * Math.sin(tt * 0.0006 * b + b * 2.1)), by = H * (0.5 + 0.4 * Math.sin(tt * 0.0008 * b + b));
          var rg = ctx.createRadialGradient(bx, by, 0, bx, by, H * 0.4);
          var c = b % 2 ? '255,255,255,' : '30,110,230,';
          rg.addColorStop(0, 'rgba(' + c + (0.16 * bf) + ')'); rg.addColorStop(1, 'rgba(' + c + '0)');
          ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
      }
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (k === 0) {
      ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
    } else if (k === 1) {
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();
    } else {
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(125,220,245,.9)'; ctx.stroke();
    }
  }

  function spray(dt, dir, speed, p) {             // droplets thrown off the leading edge
    var i, q;
    if (dt > 0 && p > 0.01 && p < 0.97) {
      acc += dt * speed * 80;
      while (acc >= 1) {
        acc--;
        var x = Math.random() * W;
        parts.push({ x: x, y: ey(x, p, 0), vx: (Math.random() - 0.5) * 200,
          vy: dir > 0 ? -(180 + Math.random() * 460) : 40 + Math.random() * 160,
          r: 2 + Math.random() * Math.random() * 8, life: 0.6 + Math.random() * 0.7 });
      }
    }
    for (i = parts.length - 1; i >= 0; i--) {
      q = parts[i]; q.vy += 1100 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.life <= 0 || q.y > H + 40) { parts.splice(i, 1); continue; }
      var a = Math.min(1, q.life * 2);
      ctx.fillStyle = 'rgba(205,243,255,' + 0.9 * a + ')'; ctx.strokeStyle = 'rgba(255,255,255,' + 0.7 * a + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      ctx.beginPath(); ctx.arc(q.x - q.r * 0.3, q.y - q.r * 0.3, q.r * 0.3, 0, 6.2832); ctx.fill();
    }
  }

  function render(p, dir, dt, speed, tt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k < 3; k++) layer(k, p, tt);
    spray(dt, dir, speed, p);
  }

  function run(from, to, ms, done) {
    busy = true; size(); parts = []; acc = 0;
    ph = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
    cv.style.display = 'block';
    var t0 = null, prev = 0, pPrev = from;
    function f(now) {
      if (t0 === null) { t0 = now; prev = now; }
      var u = Math.min(1, (now - t0) / ms), p = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * u));
      var dt = Math.min(0.033, (now - prev) / 1000); prev = now;
      var speed = dt > 0 ? Math.abs(p - pPrev) / dt : 0; pPrev = p;
      render(p, to > from ? 1 : -1, dt, speed, now);
      if (u < 1) requestAnimationFrame(f); else if (done) done();
    }
    requestAnimationFrame(f);
  }

  /* leaving: flood the screen, then go to the next page */
  document.addEventListener('click', function (e) {
    if (reduce || busy || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.protocol !== location.protocol) return;
    if (u.protocol !== 'file:' && u.origin !== location.origin) return;
    if (u.pathname === location.pathname && u.search === location.search) return;
    e.preventDefault();
    run(0, 1, 900, function () {
      try { sessionStorage.setItem(KEY, '1'); } catch (x) {}
      location.href = u.href;
    });
  });

  /* arriving: the screen starts covered, then the water drains away */
  var had = false;
  try { had = sessionStorage.getItem(KEY) === '1'; sessionStorage.removeItem(KEY); } catch (x) {}
  if (!had || reduce) { root.classList.remove('wiping'); }
  else {
    size(); cv.style.display = 'block'; busy = true;
    render(1, 1, 0, 0, 0);
    root.classList.remove('wiping');
    var started = false;
    var go = function () {
      if (started) return; started = true;
      setTimeout(function () { run(1, 0, 1100, function () { cv.style.display = 'none'; busy = false; }); }, 120);
    };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
    setTimeout(go, 2000);
  }

  window.addEventListener('pageshow', function (e) {     // back/forward button
    if (e.persisted) { busy = false; cv.style.display = 'none'; root.classList.remove('wiping'); }
  });
})();
