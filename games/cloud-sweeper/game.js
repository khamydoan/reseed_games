/* g07 Cloud Sweeper — cloud masks (Sentinel-2 SCL) and median composites, like `load_sentinel2` in reseed/acquire.py.
 * L1 mask cloudy squares on My Site's real picture (practice clouds) · L2 sort one pixel's values and take the middle ·
 * L3 median a tiny 6×6 picture by hand, then "median magic" · L4 stack the REAL scenes of a cloudy site, reveal the real composite.
 * The real site picture is only drawn (never read back with getImageData), so everything works from file://. */
(function () {
  "use strict";
  var u = RQ.u;
  var H = 640, INK = "#1d2b3a", GOLD = "#ffc53d", TAU = Math.PI * 2;
  var REDUCE = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  // "#level=2&debug" exposes where the right answers are (page coordinates) for automated play tests.
  function debugHook(o) { if (/debug/.test(location.hash)) window.__cs = o; }

  /* ============================================================ drawing helpers */
  function txt(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = (o.w || 600) + " " + (o.size || 22) + "px Fredoka, sans-serif";
    ctx.textAlign = o.align || "left"; ctx.textBaseline = o.base || "middle";
    if (o.stroke) { ctx.lineWidth = o.lw || 5; ctx.strokeStyle = o.stroke; ctx.lineJoin = "round"; ctx.strokeText(s, x, y); }
    ctx.fillStyle = o.color || "#fff"; ctx.fillText(s, x, y);
  }
  function box(ctx, x, y, w, h, r, fill, lw) {
    ctx.fillStyle = "rgba(0,0,0,.28)"; u.rr(ctx, x, y + 5, w, h, r); ctx.fill();
    u.rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = lw || 3; ctx.strokeStyle = INK; ctx.stroke();
  }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgb(a) { return "rgb(" + Math.round(a[0]) + "," + Math.round(a[1]) + "," + Math.round(a[2]) + ")"; }
  function mixA(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  /** Brightness 0..100 -> colour: dark shadow, forest greens, washed grey, white cloud. */
  var STOPS = [[0, "#141a22"], [10, "#2f3b30"], [18, "#1f5a2c"], [32, "#3f8a3c"], [45, "#7f9a6a"], [62, "#aab4b8"], [80, "#dbe3ee"], [100, "#ffffff"]];
  function valColor(v) {
    v = u.clamp(v, 0, 100);
    for (var i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) {
      var a = STOPS[i - 1], b = STOPS[i];
      return rgb(mixA(hexRgb(a[1]), hexRgb(b[1]), (v - a[0]) / (b[0] - a[0])));
    }
    return "#ffffff";
  }
  function star(ctx, x, y, r, c) {
    ctx.fillStyle = c; ctx.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? r * .38 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  function loadImg(src) {
    return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; });
  }
  var BUG = null;
  function bugImg() {
    if (!BUG && RQ.chars) { BUG = new Image(); BUG.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg("bug", { mood: "happy", size: 120 })); }
    return BUG;
  }
  /** The real site picture (or a painted stand-in if it failed to load). Drawn only, never read back. */
  function drawPic(ctx, img, x, y, w, h) {
    if (img) { ctx.drawImage(img, x, y, w, h); return; }
    var g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#356b35"); g.addColorStop(1, "#8a8f4f");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }

  var SKY = (function () { var r = u.seeded("g07-sky"), a = []; for (var i = 0; i < 150; i++) a.push({ x: r(), y: r(), s: .6 + r() * 1.7, p: r() * 7 }); return a; })();
  function space(ctx, W, t, satY) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#080f2a"); g.addColorStop(.55, "#15255a"); g.addColorStop(1, "#22407c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var n = ctx.createRadialGradient(W * .86, H * .16, 10, W * .86, H * .16, 380);
    n.addColorStop(0, "rgba(208,138,28,.22)"); n.addColorStop(1, "rgba(208,138,28,0)");
    ctx.fillStyle = n; ctx.fillRect(0, 0, W, H);
    var m = ctx.createRadialGradient(W * .1, H * .9, 10, W * .1, H * .9, 420);
    m.addColorStop(0, "rgba(124,92,196,.28)"); m.addColorStop(1, "rgba(124,92,196,0)");
    ctx.fillStyle = m; ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < SKY.length; i++) {
      var s = SKY[i];
      ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(t * 1.1 + s.p));
      ctx.fillStyle = i % 9 ? "#ffffff" : "#ffe7a3"; ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    if (satY != null) satellite(ctx, ((t * 38) % (W + 300)) - 150, satY + Math.sin(t * .8) * 4, .62, Math.sin(t * .5) * .12);
  }
  /** A small cartoon Sentinel-2: gold body, two blue solar wings, camera pointing at Earth. */
  function satellite(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.lineWidth = 3; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(60, 0); ctx.stroke();
    [-1, 1].forEach(function (d) {
      ctx.fillStyle = "#3d6fd1"; ctx.fillRect(d > 0 ? 22 : -62, -11, 40, 22); ctx.strokeRect(d > 0 ? 22 : -62, -11, 40, 22);
      ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (var k = 1; k < 4; k++) { var xx = (d > 0 ? 22 : -62) + k * 10; ctx.moveTo(xx, -10); ctx.lineTo(xx, 10); } ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
    });
    ctx.fillStyle = "#e8b84a"; u.rr(ctx, -15, -14, 30, 28, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 16, 6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- clouds made of circles */
  /** Circles for a puffy cloud covering the grid cells where on(r, q) is true (cell size c). rng adds a natural wobble. */
  function cellCircles(on, n, c, rng, o) {
    var out = [], R = rng || function () { return .5; };
    o = o || {}; var jit = o.jit == null ? .18 : o.jit, r0 = o.r0 || .53, r1 = o.r1 || .63;
    for (var r = 0; r < n; r++) for (var q = 0; q < n; q++) {
      if (!on(r, q)) continue;
      var x = q * c + c / 2, y = r * c + c / 2;
      out.push({ x: x + (R() - .5) * c * jit, y: y + (R() - .5) * c * jit, r: c * (r0 + R() * (r1 - r0)) });
      if (!(r > 0 && on(r - 1, q))) { out.push({ x: x - c * .2, y: y - c * .2, r: c * .3, b: 1 }); out.push({ x: x + c * .2, y: y - c * .17, r: c * .28, b: 1 }); }
      if (o.edges) {
        if (!(q > 0 && on(r, q - 1))) out.push({ x: x - c * .32, y: y + (R() - .5) * c * .3, r: c * .28, b: 1 });
        if (!(q + 1 < n && on(r, q + 1))) out.push({ x: x + c * .32, y: y + (R() - .5) * c * .3, r: c * .28, b: 1 });
        if (!(r + 1 < n && on(r + 1, q))) out.push({ x: x + (R() - .5) * c * .3, y: y + c * .32, r: c * .28, b: 1 });
      }
      if (q + 1 < n && on(r, q + 1)) out.push({ x: x + c / 2, y: y, r: c * .5 });
      if (r + 1 < n && on(r + 1, q)) out.push({ x: x, y: y + c / 2, r: c * .5 });
      if (q + 1 < n && r + 1 < n && on(r, q + 1) && on(r + 1, q) && on(r + 1, q + 1)) out.push({ x: x + c / 2, y: y + c / 2, r: c * .52 });
    }
    return out.sort(function (a, b) { return a.y - b.y; });
  }
  function circlesPath(ctx, cs, ox, oy, grow, k) {
    k = k || 1; ctx.beginPath();
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], r = Math.max(.5, c.r * k + grow), x = ox + c.x * k, y = oy + c.y * k;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
  }
  /** Cartoon cloud: ink outline, blue-grey belly, white puffy tops. k scales the circle coordinates. */
  function drawCloud(ctx, cs, ox, oy, lw, k, alpha) {
    if (!cs.length) return;
    k = k || 1;
    ctx.save(); if (alpha != null) ctx.globalAlpha = alpha;
    circlesPath(ctx, cs, ox, oy, lw, k); ctx.fillStyle = INK; ctx.fill();
    circlesPath(ctx, cs, ox, oy, 0, k); ctx.fillStyle = "#c3d1e8"; ctx.fill();
    // every puff gets its own soft light (bright top-left, blue-grey rim); drawn top to bottom = cauliflower cumulus
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], r = c.r * k * .94, x = ox + c.x * k, y = oy + (c.y - c.r * .07) * k;
      var g = ctx.createRadialGradient(x - r * .3, y - r * .4, r * .08, x, y, r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(.55, "#f5f8fd"); g.addColorStop(1, "#ccd8ea");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawShadow(ctx, cs, ox, oy, k, alpha) {
    if (!cs.length) return;
    circlesPath(ctx, cs, ox, oy, 0, k); ctx.fillStyle = "rgba(4,9,22," + (alpha == null ? .55 : alpha) + ")"; ctx.fill();
  }
  function cloudIcon(ctx, x, y, s) {
    drawCloud(ctx, [{ x: 0, y: 2, r: 7 }, { x: 8, y: -2, r: 8 }, { x: 16, y: 3, r: 6 }], x, y, 2, s || 1);
  }
  /** Grow a random blob of `size` cells on an n×n grid, inside [0, lim). Returns list of cell indexes. */
  function growBlob(rng, n, lim, size, taken) {
    var r0 = Math.floor(rng() * lim), q0 = Math.floor(rng() * lim), cells = [r0 * n + q0];
    taken[cells[0]] = 1;
    for (var g = 0; g < 80 && cells.length < size; g++) {
      var c0 = cells[Math.floor(rng() * cells.length)], d = DIRS[Math.floor(rng() * 4)];
      var r = Math.floor(c0 / n) + d[0], q = c0 % n + d[1];
      if (r < 0 || q < 0 || r >= lim || q >= lim || taken[r * n + q]) continue;
      taken[r * n + q] = 1; cells.push(r * n + q);
    }
    return cells;
  }

  /* ---------- particles, bugs, shared level frame */
  function makeFx() {
    var ps = [];
    return {
      poof: function (x, y, n, col) {
        for (var i = 0; i < (REDUCE ? 3 : n || 8); i++) {
          var a = Math.random() * TAU, s = u.rand(40, 150);
          ps.push({ k: 0, x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, r: u.rand(6, 15), life: .7, max: .7, c: col || "#fff" });
        }
      },
      spark: function (x, y, n) {
        for (var i = 0; i < (REDUCE ? 3 : n || 10); i++) ps.push({ k: 1, x: x, y: y, vx: u.rand(-220, 220), vy: u.rand(-260, 40), life: .85, max: .85, c: u.pick([GOLD, "#ffffff", "#8ce99a", "#74c0fc"]) });
      },
      text: function (x, y, s, col) { ps.push({ k: 2, x: x, y: y, vx: 0, vy: -70, life: 1.1, max: 1.1, s: s, c: col || GOLD }); },
      ring: function (x, y, col) { ps.push({ k: 3, x: x, y: y, vx: 0, vy: 0, r: 8, life: .5, max: .5, c: col || "#fff" }); },
      draw: function (ctx, dt) {
        ps = ps.filter(function (p) {
          p.life -= dt; if (p.life <= 0) return false;
          var a = p.life / p.max; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.globalAlpha = Math.min(1, a * 1.5);
          if (p.k === 0) { p.vx *= .93; p.vy *= .93; p.r += dt * 24; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
          else if (p.k === 1) { p.vy += 420 * dt; star(ctx, p.x, p.y, 3 + 7 * a, p.c); }
          else if (p.k === 2) txt(ctx, p.s, p.x, p.y, { size: 30, w: 700, color: p.c, stroke: INK, lw: 6, align: "center" });
          else { p.r += dt * 170; ctx.strokeStyle = p.c; ctx.lineWidth = 5 * a; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke(); }
          ctx.globalAlpha = 1; return true;
        });
      }
    };
  }

  /** Level frame: canvas on top (logical 1280+ × 640), dark control bar below with info text and buttons. */
  function frame(L, label) {
    var root = u.el("div", { class: "fill cs-root" });
    var view = u.el("div", { class: "cs-view" }), bar = u.el("div", { class: "cs-bar" });
    var info = u.el("div", { class: "cs-info", "aria-live": "polite" });
    bar.appendChild(info); root.appendChild(view); root.appendChild(bar); L.stage.appendChild(root);
    var cv = L.canvas({ w: 1280, h: H, parent: view, fill: true, bg: "#0a1230", label: label });
    var S = { cv: cv, ctx: cv.ctx, fx: makeFx(), bugs: [] };
    S.W = function () { return cv.w; };
    S.info = function (md) { info.innerHTML = RQ.ui.md(md); };
    S.button = function (html, cls, fn) {
      var b = u.el("button", { class: "btn " + (cls || ""), html: html });
      b.addEventListener("click", function () { if (L.alive && !L.paused) fn(); });
      bar.appendChild(b); return b;
    };
    S.pt = function (e) { return cv.toLocal(e); };
    S.page = function (x, y) { var r = cv.cv.getBoundingClientRect(); return { x: r.left + x * cv.scale, y: r.top + y * cv.scale }; };
    S.bug = function (x, y) { S.bugs.push({ x: x, y: y, t: 0 }); RQ.audio.sfx("giggle"); };
    S.keys = function (fn) {
      L.on(window, "keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.querySelector(".rq-overlay, .rq-talk")) return;
        var ae = document.activeElement;
        if (ae && ae.tagName === "BUTTON" && (e.key === " " || e.key === "Enter")) return;
        fn(e);
      });
    };
    S.blur = function () { var ae = document.activeElement; if (ae && ae.blur && ae !== document.body) ae.blur(); };
    S.top = function (dt) {
      var ctx = S.ctx, im = bugImg();
      S.bugs = S.bugs.filter(function (b) {
        b.t += dt; if (b.t > 1.5) return false;
        var s = u.ease.outBack(Math.min(1, b.t * 4)) * (b.t > 1.2 ? (1.5 - b.t) / .3 : 1), hop = Math.abs(Math.sin(b.t * 12)) * 10;
        if (im && im.complete && im.naturalWidth) ctx.drawImage(im, b.x - 38 * s, b.y - 64 * s - hop, 76 * s, 76 * s);
        txt(ctx, "hee hee!", b.x, b.y - 80 * s - hop, { size: 22, w: 700, align: "center", color: "#e9d5ff", stroke: INK, lw: 5 });
        return true;
      });
      S.fx.draw(ctx, dt);
    };
    return S;
  }
  function starsFor(m, a, b) { return m <= a ? 3 : m <= b ? 2 : 1; }
  function dashed(ctx, x, y, w, h, r, col, t) {
    ctx.save(); ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 4; ctx.strokeStyle = col || GOLD;
    u.rr(ctx, x, y, w, h, r); ctx.stroke(); ctx.restore();
  }

  /* ============================================================ L1 · cloud mask (SCL) */
  var KEEP = [[4, "vegetation", "#3c8d3f"], [5, "bare soil", "#b08a5a"], [6, "water", "#2f6fa8"], [7, "unclassified", "#8a8f98"], [11, "snow", "#eef4ff"]];
  var HIDE = [[3, "cloud shadow", "#1b2230"], [8, "cloud (medium)", "#c9d4e3"], [9, "cloud (high)", "#ffffff"], [10, "thin cirrus", "#a9c8f0"]];

  function cloudMask(L) {
    var S = frame(L, "satellite picture with clouds"), ctx = S.ctx, site = RQ.mySite();
    var N = 8, C = 70, P = N * C;
    var SPEC = [{ min: 8, max: 14, clouds: 1, size: [5, 7] }, { min: 15, max: 24, clouds: 2, size: [4, 6], cirrus: true },
      { min: 37, max: 46, clouds: 6, size: [6, 9], storm: true }];
    var img = null, scene = null, idx = 0, mistakes = 0, checks = 0, busy = true, paint = null, kb = false, cur = { r: 3, q: 3 };
    var stamp = null, roll = 1, warned = false;
    var checkBtn = S.button("✅ Check <small>(C)</small>", "primary", check);
    var skipBtn = S.button("🗑️ Skip scene", "danger", skip); skipBtn.hidden = true;
    checkBtn.disabled = true;
    S.info("Loading your forest picture…");

    function lay() {
      var W = S.W(), gw = P + 40 + 500, ox = Math.max(24, (W - gw) / 2), px = ox + P + 40;
      return { ox: ox, oy: (H - P) / 2, px: px, pw: Math.min(520, W - px - 24) };
    }
    function isCloud(cls, r, q) { return r >= 0 && q >= 0 && r < N && q < N && (cls[r * N + q] === 8 || cls[r * N + q] === 9); }
    function gen(spec) {
      var best = null;
      for (var tries = 0; tries < 300; tries++) {
        var cls = [], i, k; for (i = 0; i < N * N; i++) cls.push(0);
        var taken = {};
        for (k = 0; k < spec.clouds; k++) {
          var size = spec.size[0] + Math.floor(L.rng() * (spec.size[1] - spec.size[0] + 1));
          growBlob(L.rng, N, N - 1, size, taken).forEach(function (c) { cls[c] = 9; });
        }
        // cloud edges = medium probability (8), cloud cores = high probability (9)
        var edge = [];
        for (i = 0; i < N * N; i++) if (cls[i] === 9) {
          var r = (i / N) | 0, q = i % N;
          if (!(isCloud(cls, r - 1, q) && isCloud(cls, r + 1, q) && isCloud(cls, r, q - 1) && isCloud(cls, r, q + 1))) edge.push(i);
        }
        edge.forEach(function (e) { cls[e] = 8; });
        // the sun shines from the top-left, so each shadow falls one square down-right
        var sh = [];
        for (i = 0; i < N * N; i++) if (cls[i] === 8 || cls[i] === 9) {
          var sr = ((i / N) | 0) + 1, sq = i % N + 1;
          if (sr < N && sq < N && cls[sr * N + sq] === 0) sh.push(sr * N + sq);
        }
        sh.forEach(function (s) { cls[s] = 3; });
        if (spec.cirrus) {
          var cr = Math.floor(L.rng() * N), cq = Math.floor(L.rng() * (N - 3));
          for (k = 0; k < 4; k++) if (cls[cr * N + cq + k] === 0) cls[cr * N + cq + k] = 10;
        }
        var bad = cls.filter(function (v) { return v; }).length;
        if (bad >= spec.min && bad <= spec.max) return cls;
        if (!best || Math.abs(bad - spec.min) < best.d) best = { cls: cls, d: Math.abs(bad - spec.min) };
      }
      return best.cls;
    }
    function makeScene(i) {
      var cls = gen(SPEC[i]);
      var cells = cls.map(function (v, k) { return { i: k, r: (k / N) | 0, q: k % N, cls: v, masked: false, mt: 1, flag: null, ft: 0 }; });
      return { cls: cls, cells: cells, storm: !!SPEC[i].storm, done: false,
        circ: cellCircles(function (r, q) { return isCloud(cls, r, q); }, N, C, L.rng, { jit: .08, r0: .5, r1: .56 }),
        cirrus: cells.filter(function (c) { return c.cls === 10; }) };
    }
    function trueClear(sc) { return sc.cells.filter(function (c) { return !c.cls; }).length / (N * N); }
    function kidClear() { return scene ? scene.cells.filter(function (c) { return !c.masked; }).length / (N * N) : 1; }
    function center(c) { var Ly = lay(); return { x: Ly.ox + c.q * C + C / 2, y: Ly.oy + c.r * C + C / 2 }; }
    function cellAt(p) {
      var Ly = lay(), q = Math.floor((p.x - Ly.ox) / C), r = Math.floor((p.y - Ly.oy) / C);
      return scene && r >= 0 && q >= 0 && r < N && q < N ? scene.cells[r * N + q] : null;
    }
    function setMask(c, on) {
      if (!c || c.masked === on) return;
      c.masked = on; c.flag = null;
      var p = center(c);
      if (on) {
        c.mt = 0; S.fx.poof(p.x, p.y, c.cls ? 9 : 5, c.cls === 3 ? "#59607a" : "#ffffff");
        RQ.audio.tone({ f: u.rand(480, 640), f2: 980, type: "sine", d: .09, v: .14 });
      } else RQ.audio.sfx("click");
      if (scene.storm && !warned && kidClear() < .5) {
        warned = true; skipBtn.hidden = false; skipBtn.classList.add("pulse");
        RQ.ui.toast("⚠️ Less than half of this scene is clear now!", "info", 2600);
        S.info("Under half clear! Would ReSeed keep this scene? Try **🗑️ Skip scene**.");
      }
    }
    function startScene() {
      scene = makeScene(idx); stamp = null; roll = 1; busy = true; checks = 0; warned = false;
      checkBtn.disabled = true; skipBtn.hidden = true; skipBtn.classList.remove("pulse");
      RQ.audio.sfx("whoosh");
      L.hud.set("scene", "🛰️ Scene " + (idx + 1) + " / 3");
      S.info(scene.storm ? "A **stormy** day! Mask the clouds and watch the clear meter."
        : "Tap every **cloud**, **cloud shadow** and **thin cirrus** square. Drag to paint. Keys: arrows + Space.");
      L.timeout(function () { busy = false; checkBtn.disabled = false; }, 800);
    }
    function check() {
      if (busy || !scene) return;
      var miss = [], wrong = [];
      scene.cells.forEach(function (c) { if (c.cls && !c.masked) miss.push(c); if (!c.cls && c.masked) wrong.push(c); });
      checks++;
      if (miss.length || wrong.length) {
        mistakes += Math.min(3, miss.length + wrong.length);
        miss.forEach(function (c) { c.flag = "miss"; c.ft = 0; });
        wrong.forEach(function (c) { c.flag = "wrong"; c.ft = 0; });
        var f = center(miss[0] || wrong[0]); S.bug(f.x, f.y);
        RQ.ui.toast((miss.length ? "☁️ " + miss.length + " cloudy square" + (miss.length > 1 ? "s" : "") + " still showing. " : "") +
          (wrong.length ? "🌳 " + wrong.length + " clear square" + (wrong.length > 1 ? "s" : "") + " masked by mistake." : ""), "bad", 2800);
        S.info("**Red** = still cloudy, shadow or cirrus. **Yellow** = clear ground, tap to unmask it.");
        if (checks === 2 || (checks === 1 && L.fails >= 1)) L.hint("Look at the edges of each cloud and at the dark shadow just below-right of it. Thin cirrus looks like white streaks.", "tuki");
        return;
      }
      finishScene(trueClear(scene) < .5);
    }
    function skip() {
      if (busy || !scene) return;
      if (trueClear(scene) < .5) { RQ.ui.toast("Smart! No need to mask a scene that gets skipped.", "good"); finishScene(true); return; }
      mistakes += 2; RQ.ui.toast("Careful! Some squares you masked are clear ground.", "bad");
      var Ly = lay(); S.bug(Ly.ox + P / 2, Ly.oy + P / 2);
    }
    function finishScene(skipped) {
      busy = true; scene.done = true; checkBtn.disabled = true; skipBtn.hidden = true;
      var clear = Math.round(100 * trueClear(scene)), Ly = lay();
      stamp = { ok: !skipped, t: 0, sub: clear + "% clear" };
      S.info(skipped ? "Scene **skipped**: less than half of it is clear." : "Scene **kept**! The masked squares become empty (NaN), the clear ground is saved.");
      RQ.audio.sfx(skipped ? "boom" : "good");
      S.fx.spark(Ly.ox + P / 2, Ly.oy + P / 2, 24);
      if (!skipped) scene.cells.forEach(function (c) { if (c.masked) { var p = center(c); S.fx.text(p.x, p.y - 10, "✓", "#8ce99a"); } });
      var p = skipped
        ? RQ.ui.say("tuki", "Less than half clear, so `load_sentinel2` skips this scene. The satellite comes back in a few days!", { mood: "wow" })
        : L.wait(1800);
      p.then(function () {
        if (!L.alive) return;
        idx++;
        if (idx < SPEC.length) { startScene(); return; }
        L.win({ stars: starsFor(mistakes, 0, 3), msg: "You masked clouds like a real **SCL** layer: two scenes kept, one stormy scene skipped.",
          stats: { "Mistakes": String(mistakes), "Scenes kept": "2 of 3" } });
      });
    }

    L.on(S.cv.cv, "pointerdown", function (e) {
      if (busy || !scene) return;
      S.blur();
      var c = cellAt(S.pt(e)); if (!c) return;
      kb = false; paint = { on: !c.masked }; setMask(c, paint.on);
      try { S.cv.cv.setPointerCapture(e.pointerId); } catch (er) { /* old browsers */ }
    });
    L.on(S.cv.cv, "pointermove", function (e) { if (!paint || busy) return; var c = cellAt(S.pt(e)); if (c) setMask(c, paint.on); });
    L.on(window, "pointerup", function () { paint = null; });
    S.keys(function (e) {
      if (busy || !scene) return;
      var k = e.key;
      if (k === "ArrowLeft") cur.q = Math.max(0, cur.q - 1);
      else if (k === "ArrowRight") cur.q = Math.min(N - 1, cur.q + 1);
      else if (k === "ArrowUp") cur.r = Math.max(0, cur.r - 1);
      else if (k === "ArrowDown") cur.r = Math.min(N - 1, cur.r + 1);
      else if (k === " " || k === "Enter") { var c = scene.cells[cur.r * N + cur.q]; setMask(c, !c.masked); }
      else if (k === "c" || k === "C") { check(); }
      else return;
      kb = true; e.preventDefault();
    });

    function side(Ly, t) {
      var x = Ly.px, w = Ly.pw, y = Ly.oy + 40;
      txt(ctx, "Scene " + (idx + 1) + " of 3", x, y + 20, { size: 36, w: 700, stroke: INK, lw: 6 });
      txt(ctx, scene && scene.storm ? "Stormy day! (practice clouds)" : "Practice clouds over " + (site ? site.name.split(",")[0] : "your forest"), x, y + 58, { size: 21, w: 500, color: "#c4d2f0" });
      var ly = y + 84;
      box(ctx, x, ly, w, 236, 16, "#fffdf7");
      txt(ctx, "KEEP", x + 18, ly + 26, { size: 22, w: 700, color: "#2f9e4f" });
      txt(ctx, "S2_CLEAR_SCL", x + 82, ly + 27, { size: 20, w: 500, color: "#4a5b6d" });
      KEEP.forEach(function (k, i) {
        var col = i < 3 ? 0 : 1, row = i < 3 ? i : i - 3, xx = x + 18 + col * (w / 2), yy = ly + 58 + row * 30;
        ctx.fillStyle = k[2]; ctx.fillRect(xx, yy - 11, 22, 22); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(xx, yy - 11, 22, 22);
        txt(ctx, k[0] + "  " + k[1], xx + 32, yy, { size: 20, w: 600, color: INK });
      });
      txt(ctx, "MASK (hide)", x + 18, ly + 162, { size: 22, w: 700, color: "#d1495b" });
      HIDE.forEach(function (k, i) {
        var xx = x + 18 + (i % 2) * (w / 2), yy = ly + 192 + Math.floor(i / 2) * 30;
        ctx.fillStyle = k[2]; ctx.fillRect(xx, yy - 11, 22, 22); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(xx, yy - 11, 22, 22);
        txt(ctx, k[0] + "  " + k[1], xx + 32, yy, { size: 20, w: 600, color: INK });
      });
      // clear meter
      var my = ly + 256, kc = kidClear(), bw = w - 10;
      txt(ctx, "Clear here: " + Math.round(kc * 100) + "%", x, my + 8, { size: 24, w: 700, color: kc < .5 ? "#ff9aa6" : "#bff3c8" });
      box(ctx, x, my + 28, bw, 32, 12, "#0f1a3a");
      ctx.save(); u.rr(ctx, x, my + 28, bw, 32, 12); ctx.clip();
      ctx.fillStyle = kc < .5 ? "#d1495b" : "#2f9e4f"; ctx.fillRect(x, my + 28, bw * kc, 32);
      ctx.restore();
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = "#ffd46b"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x + bw / 2, my + 20); ctx.lineTo(x + bw / 2, my + 68); ctx.stroke(); ctx.restore();
      txt(ctx, "min_clear = 0.5", x + bw / 2, my + 84, { size: 19, w: 600, align: "center", color: "#ffd46b" });
      var masked = scene ? scene.cells.filter(function (c) { return c.masked; }).length : 0;
      txt(ctx, "Masked squares: " + masked + "   ·   1 square = 800 m", x, my + 116, { size: 20, w: 500, color: "#c4d2f0" });
    }

    L.loop(function (dt, t) {
      var W = S.W(), Ly = lay(), ox = Ly.ox, oy = Ly.oy;
      space(ctx, W, t, null);
      ctx.fillStyle = "rgba(0,0,0,.35)"; u.rr(ctx, ox - 4, oy + 6, P + 8, P + 8, 20); ctx.fill();
      ctx.save(); u.rr(ctx, ox, oy, P, P, 16); ctx.clip();
      drawPic(ctx, img, ox, oy, P, P);
      if (scene) {
        roll = Math.max(0, roll - dt / .75);
        var off = -u.ease.inOut(roll) * (P + 140), bob = REDUCE ? 0 : Math.sin(t * 1.3) * 2;
        drawShadow(ctx, scene.circ, ox + C + off, oy + C);
        scene.cirrus.forEach(function (c) {
          var x = ox + c.q * C + off, y = oy + c.r * C;
          ctx.fillStyle = "rgba(214,232,255,.42)"; ctx.fillRect(x, y + C * .12, C, C * .76);
          ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 4; ctx.lineCap = "round";
          for (var k = 0; k < 3; k++) {
            var yy = y + C * (.3 + k * .2) + Math.sin(t * 2 + k + c.q) * 2;
            ctx.beginPath(); ctx.moveTo(x + 3, yy + 3); ctx.quadraticCurveTo(x + C / 2, yy - 9, x + C - 3, yy + 2); ctx.stroke();
          }
        });
        drawCloud(ctx, scene.circ, ox + off, oy + bob, 4);
        scene.cells.forEach(function (c) {
          var x = ox + c.q * C, y = oy + c.r * C;
          if (c.masked) {
            c.mt = Math.min(1, c.mt + dt * 5);
            var s = u.ease.outBack(c.mt), w = C * s, x0 = x + (C - w) / 2, y0 = y + (C - w) / 2;
            ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, w); ctx.clip();
            ctx.fillStyle = "rgba(36,26,70,.86)"; ctx.fillRect(x0, y0, w, w);
            ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.lineWidth = 6; ctx.beginPath();
            for (var d = -C; d < C; d += 16) { ctx.moveTo(x + d, y + C); ctx.lineTo(x + d + C, y); }
            ctx.stroke();
            if (scene.done && c.cls) txt(ctx, String(c.cls), x + C / 2, y + C / 2 + 2, { size: 28, w: 700, align: "center", color: "#ffd46b", stroke: INK, lw: 5 });
            ctx.restore();
          }
        });
        // faint grid
        ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1.5; ctx.beginPath();
        for (var g = 1; g < N; g++) { ctx.moveTo(ox + g * C, oy); ctx.lineTo(ox + g * C, oy + P); ctx.moveTo(ox, oy + g * C); ctx.lineTo(ox + P, oy + g * C); }
        ctx.stroke();
        scene.cells.forEach(function (c) {
          if (!c.flag) return;
          c.ft += dt;
          var a = .55 + .45 * Math.sin(c.ft * 8);
          ctx.lineWidth = 6; ctx.strokeStyle = c.flag === "miss" ? "rgba(255,60,90," + a + ")" : "rgba(255,212,70," + a + ")";
          ctx.strokeRect(ox + c.q * C + 5, oy + c.r * C + 5, C - 10, C - 10);
          txt(ctx, c.flag === "miss" ? "!" : "?", ox + c.q * C + C - 14, oy + c.r * C + 17, { size: 22, w: 700, align: "center", color: c.flag === "miss" ? "#ff6b7d" : "#ffd46b", stroke: INK, lw: 5 });
        });
        if (kb && !busy) dashed(ctx, ox + cur.q * C + 3, oy + cur.r * C + 3, C - 6, C - 6, 8, GOLD, t);
      }
      ctx.restore();
      ctx.lineWidth = 5; ctx.strokeStyle = INK; u.rr(ctx, ox, oy, P, P, 16); ctx.stroke();
      if (stamp) {
        stamp.t += dt;
        var sc = u.ease.outElastic(Math.min(1, stamp.t * 1.6));
        ctx.save(); ctx.translate(ox + P / 2, oy + P / 2); ctx.rotate(-.18); ctx.scale(sc, sc);
        var col = stamp.ok ? "#2f9e4f" : "#d1495b";
        ctx.fillStyle = "rgba(255,253,247,.94)"; u.rr(ctx, -190, -70, 380, 140, 22); ctx.fill();
        ctx.lineWidth = 8; ctx.strokeStyle = col; ctx.stroke();
        txt(ctx, stamp.ok ? "KEPT ✓" : "SKIPPED", 0, -14, { size: 62, w: 700, align: "center", color: col });
        txt(ctx, stamp.sub, 0, 40, { size: 26, w: 600, align: "center", color: INK });
        ctx.restore();
      }
      side(Ly, t);
      S.top(dt);
    });

    debugHook({ busy: function () { return busy || !scene; }, storm: function () { return scene && scene.storm; },
      targets: function () { return scene ? scene.cells.filter(function (c) { return c.cls && !c.masked; }).map(function (c) { var p = center(c); return S.page(p.x, p.y); }) : []; } });
    loadImg(site ? RQ.url(site.files.rgb) : "").then(function (im) {
      if (!L.alive) return;
      img = im; startScene();
    });
  }

  /* ============================================================ L2 · the median of one pixel */
  function forestSpot(site) {
    var t = site && site.tiles && site.tiles.p_forest, best = [4, 4], bv = -1;
    if (t) for (var r = 1; r < t.length - 1; r++) for (var q = 1; q < (t[r] || []).length - 1; q++) if (t[r][q] > bv) { bv = t[r][q]; best = [r, q]; }
    return { x: (best[1] + .5) / 10, y: (best[0] + .5) / 10 };
  }

  function medianSort(L) {
    var S = frame(L, "one pixel photographed on many passes"), ctx = S.ctx, site = RQ.mySite(), spot = forestSpot(site);
    var ROUNDS = [{ n: 5, cloud: 2, shadow: 0 }, { n: 7, cloud: 2, shadow: 1 }, { n: 6, cloud: 2, shadow: 1 }];
    var T = 100, GAP = 22;
    var round = 0, items = [], phase = "wait", placed = 0, picked = [], mistakes = 0, roundMiss = 0, cursor = 0, kb = false, res = null, img = null;
    var nextBtn = S.button("Next pixel ▶", "go", next); nextBtn.hidden = true;

    function lay() {
      var W = S.W(), n = items.length || 5, rowW = n * T + (n - 1) * GAP;
      return { W: W, x0: Math.max(214, (W - rowW) / 2 + 60), pileY: 132, shelfY: 322 };
    }
    function pilePos(k, Ly) { return { x: Ly.x0 + k * (T + GAP), y: Ly.pileY }; }
    function slotPos(k, Ly) { return { x: Ly.x0 + k * (T + GAP), y: Ly.shelfY }; }
    function makeRound() {
      var spec = ROUNDS[round], base = 22 + Math.floor(L.rng() * 8), used = {}, vals = [], i;
      function add(v, kind) { while (used[v]) v++; used[v] = 1; vals.push({ v: v, kind: kind }); }
      for (i = 0; i < spec.n - spec.cloud - spec.shadow; i++) add(base + Math.floor(L.rng() * 9) - 4, "clear");
      for (i = 0; i < spec.cloud; i++) add(84 + Math.floor(L.rng() * 14), "cloud");
      for (i = 0; i < spec.shadow; i++) add(4 + Math.floor(L.rng() * 6), "shadow");
      vals = u.shuffle(vals, L.rng);
      items = vals.map(function (o, k) { return { v: o.v, kind: o.kind, pass: k + 1, pile: k, slot: -1, x: 0, y: -160 - k * 70, s: 1, shake: 0, glow: 0, first: true }; });
      var Ly = lay();
      items.forEach(function (it) { var p = pilePos(it.pile, Ly); it.x = p.x; });
      placed = 0; picked = []; res = null; roundMiss = 0; cursor = 0; phase = "sort";
      nextBtn.hidden = true;
      L.hud.set("round", "🔢 Pixel " + (round + 1) + " / 3");
      S.info("Tap the **smallest** number. Keep going until the shelf is sorted from small to big.");
      RQ.audio.sfx("whoosh");
    }
    function remaining() { return items.filter(function (it) { return it.slot < 0; }).sort(function (a, b) { return a.pile - b.pile; }); }
    function mids() { var n = items.length; return n % 2 ? [(n - 1) / 2] : [n / 2 - 1, n / 2]; }
    function bySlot(k) { for (var i = 0; i < items.length; i++) if (items[i].slot === k) return items[i]; return null; }
    function mistake(x, y, msg) {
      mistakes++; roundMiss++; S.bug(x, y); RQ.ui.toast(msg, "bad", 2200);
      if (roundMiss === 2 || (roundMiss === 1 && L.fails >= 1)) {
        if (phase === "sort") L.hint("Compare the numbers one by one and keep the smallest in your head. The tiles with 80s and 90s are clouds!", "hoot");
        else L.hint("Count the tiles: the middle one has the same number of tiles on its left and on its right.", "hoot");
      }
    }
    function pickPile(it) {
      if (phase !== "sort" || it.slot >= 0) return;
      var min = Math.min.apply(null, remaining().map(function (o) { return o.v; }));
      var Ly = lay(), p = pilePos(it.pile, Ly);
      if (it.v !== min) { it.shake = .4; mistake(p.x + T / 2, p.y, "Not the smallest yet! Find the smallest number."); return; }
      it.slot = placed++;
      RQ.audio.tone({ f: 330 * Math.pow(1.12, placed), type: "triangle", d: .16, v: .22 });
      S.fx.spark(p.x + T / 2, p.y + T / 2, 8);
      cursor = 0;
      if (placed === items.length) {
        phase = "middle"; cursor = 0;
        var even = items.length % 2 === 0;
        S.info(even ? "Sorted! **6** tiles: there are **two** middle tiles. Tap both!" : "Sorted! Now tap the tile in the **middle**.");
        RQ.audio.sfx("good");
      }
    }
    function pickSlot(k) {
      if (phase !== "middle") return;
      var it = bySlot(k), Ly = lay(), p = slotPos(k, Ly);
      if (mids().indexOf(k) < 0) { it.shake = .4; mistake(p.x + T / 2, p.y, "Not the middle! Count the tiles on each side."); return; }
      if (picked.indexOf(k) >= 0) return;
      picked.push(k); it.glow = 1; RQ.audio.sfx("pop"); S.fx.ring(p.x + T / 2, p.y + T / 2, GOLD);
      if (picked.length === mids().length) show();
      else S.info("One middle found. Tap the **other** middle tile!");
    }
    function show() {
      phase = "show";
      var m = mids().map(function (k) { return bySlot(k).v; }), sum = 0;
      items.forEach(function (it) { sum += it.v; });
      res = { median: m.length === 1 ? m[0] : (m[0] + m[1]) / 2, mean: Math.round(sum / items.length * 10) / 10, pair: m.length === 2 ? m : null, t: 0 };
      RQ.audio.sfx("bloom");
      var Ly = lay(), p = slotPos(mids()[0], Ly); S.fx.spark(p.x + T / 2, p.y, 20);
      S.fx.text(p.x + T / 2, p.y - 100, "MEDIAN!", GOLD);
      S.info("The **median** is **" + res.median + "**. The **mean** (average) is **" + res.mean + "**: the clouds pulled it up!");
      var say = round === 0
        ? RQ.ui.say("hoot", "Look at the number line. Here the bright clouds drag the **mean** up, but the **median** stays with the forest!", { mood: "wow" })
        : round === 2
          ? RQ.ui.say("hoot", "Two middles? Take the number halfway between them. That is exactly what `np.nanmedian` does.", { mood: "happy" })
          : L.wait(900);
      say.then(function () {
        if (!L.alive) return;
        nextBtn.innerHTML = round < ROUNDS.length - 1 ? "Next pixel ▶" : "🏁 Finish";
        nextBtn.hidden = false; nextBtn.focus();
      });
    }
    function next() {
      if (phase !== "show") return;
      round++;
      if (round < ROUNDS.length) { makeRound(); return; }
      L.win({ stars: starsFor(mistakes, 0, 2), msg: "Sort, then take the middle: you found the **median** three times. Clouds and shadows lost in these pixels, because most passes were clear!",
        stats: { "Mistakes": String(mistakes), "Pixels": "3" } });
    }
    function hit(p) {
      var Ly = lay(), i, it, q;
      if (phase === "sort") {
        for (i = 0; i < items.length; i++) { it = items[i]; q = pilePos(it.pile, Ly); if (it.slot < 0 && p.x >= q.x && p.x <= q.x + T && p.y >= q.y && p.y <= q.y + T) return pickPile(it); }
      } else if (phase === "middle") {
        for (i = 0; i < items.length; i++) { q = slotPos(i, Ly); if (p.x >= q.x && p.x <= q.x + T && p.y >= q.y && p.y <= q.y + T) return pickSlot(i); }
      }
    }
    L.on(S.cv.cv, "pointerdown", function (e) { S.blur(); kb = false; hit(S.pt(e)); });
    S.keys(function (e) {
      var k = e.key, list = phase === "sort" ? remaining() : phase === "middle" ? items : null;
      if (!list) return;
      if (k === "ArrowLeft") cursor = Math.max(0, cursor - 1);
      else if (k === "ArrowRight") cursor = Math.min(list.length - 1, cursor + 1);
      else if (k === " " || k === "Enter") { cursor = Math.min(cursor, list.length - 1); if (phase === "sort") pickPile(list[cursor]); else pickSlot(cursor); }
      else return;
      kb = true; e.preventDefault();
    });

    function tile(it, x, y, t) {
      var sx = x + Math.sin(it.shake * 40) * it.shake * 14;
      ctx.save(); ctx.translate(sx + T / 2, y + T / 2); ctx.scale(it.s, it.s);
      if (it.glow) { ctx.shadowColor = "rgba(255,214,90,.95)"; ctx.shadowBlur = 26 + 10 * Math.sin(t * 6); ctx.fillStyle = GOLD; u.rr(ctx, -T / 2 - 6, -T / 2 - 6, T + 12, T + 12, 22); ctx.fill(); ctx.shadowBlur = 0; }
      box(ctx, -T / 2, -T / 2, T, T, 18, valColor(it.v), 4);
      var dark = it.v < 60;
      txt(ctx, String(it.v), 0, 3, { size: 42, w: 700, align: "center", color: dark ? "#fff" : INK, stroke: dark ? INK : null, lw: 6 });
      ctx.restore();
    }
    function crown(x, y) {
      ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 24, y + 12); ctx.lineTo(x - 26, y - 10); ctx.lineTo(x - 12, y + 1); ctx.lineTo(x, y - 16); ctx.lineTo(x + 12, y + 1);
      ctx.lineTo(x + 26, y - 10); ctx.lineTo(x + 24, y + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    function numberLine(Ly, t) {
      var W = Ly.W, xa = Math.max(240, W / 2 - 400), xb = Math.min(W - 130, W / 2 + 440), y = 548;
      var X = function (v) { return xa + (xb - xa) * v / 100; };
      ctx.strokeStyle = "#e8eefc"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke();
      for (var v = 0; v <= 100; v += 20) {
        ctx.beginPath(); ctx.moveTo(X(v), y - 8); ctx.lineTo(X(v), y + 8); ctx.stroke();
        txt(ctx, String(v), X(v), y + 26, { size: 20, w: 500, align: "center", color: "#c4d2f0" });
      }
      txt(ctx, "darker", xa - 14, y, { size: 20, w: 600, align: "right", color: "#c4d2f0" });
      txt(ctx, "brighter", xb + 14, y, { size: 20, w: 600, color: "#c4d2f0" });
      items.forEach(function (it) {
        ctx.beginPath(); ctx.arc(X(it.v), y, 11, 0, TAU); ctx.fillStyle = valColor(it.v); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      });
      if (!res) return;
      res.t += 1 / 60;
      var k = u.ease.outBack(Math.min(1, res.t * 2));
      // mean: red triangle under the line; median: gold star above it
      var mx = X(res.mean);
      ctx.fillStyle = "#ff6b7d"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx, y + 38); ctx.lineTo(mx - 12 * k, y + 38 + 20 * k); ctx.lineTo(mx + 12 * k, y + 38 + 20 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = "#ff9aa6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, y + 4); ctx.lineTo(mx, y + 36); ctx.stroke(); ctx.restore();
      txt(ctx, "mean " + res.mean, mx, y + 76, { size: 21, w: 700, align: "center", color: "#ff9aa6", stroke: INK, lw: 4 });
      var dx = X(res.median);
      star(ctx, dx, y - 30, 16 * k, GOLD);
      txt(ctx, "median " + res.median, dx, y - 58, { size: 22, w: 700, align: "center", color: GOLD, stroke: INK, lw: 5 });
    }

    L.loop(function (dt, t) {
      var W = S.W(), Ly = lay();
      space(ctx, W, t, 40);
      // the pixel we are watching, on the real picture
      var px = 24, py = 30, ps = 150;
      box(ctx, px, py, ps, ps, 10, "#0f1a3a", 4);
      ctx.save(); u.rr(ctx, px, py, ps, ps, 10); ctx.clip(); drawPic(ctx, img, px, py, ps, ps); ctx.restore();
      ctx.lineWidth = 4; ctx.strokeStyle = INK; u.rr(ctx, px, py, ps, ps, 10); ctx.stroke();
      var cx = px + spot.x * ps, cy = py + spot.y * ps, pr = 9 + Math.sin(t * 4) * 2;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(cx - pr, cy - pr, pr * 2, pr * 2);
      ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - pr, cy); ctx.moveTo(cx + pr, cy); ctx.lineTo(cx + 20, cy);
      ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - pr); ctx.moveTo(cx, cy + pr); ctx.lineTo(cx, cy + 20); ctx.stroke();
      txt(ctx, "1 pixel", px + ps / 2, py + ps + 24, { size: 21, w: 700, align: "center", color: GOLD });
      txt(ctx, "= 10 m × 10 m", px + ps / 2, py + ps + 50, { size: 19, w: 500, align: "center", color: "#c4d2f0" });
      // pile label + shelf
      if (phase === "sort") txt(ctx, "Passes (unsorted)", Ly.x0, Ly.pileY - 46, { size: 22, w: 700, color: "#e8eefc" });
      var n = items.length, sw = n * T + (n - 1) * GAP;
      ctx.fillStyle = "#8a5a35"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      u.rr(ctx, Ly.x0 - 16, Ly.shelfY + T + 8, sw + 32, 18, 8); ctx.fill(); ctx.stroke();
      txt(ctx, "smallest", Ly.x0 - 26, Ly.shelfY + T / 2, { size: 21, w: 600, color: "#c4d2f0", align: "right" });
      txt(ctx, "biggest", Ly.x0 + sw + 26, Ly.shelfY + T / 2, { size: 21, w: 600, color: "#c4d2f0" });
      for (var k = 0; k < n; k++) {
        var sp = slotPos(k, Ly);
        if (!bySlot(k)) { ctx.save(); ctx.setLineDash([8, 7]); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 3; u.rr(ctx, sp.x, sp.y, T, T, 18); ctx.stroke(); ctx.restore(); }
      }
      items.forEach(function (it) {
        var target = it.slot >= 0 ? slotPos(it.slot, Ly) : pilePos(it.pile, Ly);
        var ty = target.y - (phase === "show" && mids().indexOf(it.slot) >= 0 ? 26 : 0);
        var kk = Math.min(1, dt * 9);
        it.x += (target.x - it.x) * kk; it.y += (ty - it.y) * kk;
        it.shake = Math.max(0, it.shake - dt);
        it.s = 1 + (it.glow ? .06 * Math.sin(t * 6) : 0);
        txt(ctx, "Pass " + it.pass, it.x + T / 2, it.y - 16, { size: 19, w: 600, align: "center", color: "#c4d2f0" });
        tile(it, it.x, it.y, t);
      });
      if (phase === "show") mids().forEach(function (k) { var sp = slotPos(k, Ly); crown(sp.x + T / 2, sp.y - 74); });
      if (kb) {
        if (phase === "sort") { var rem = remaining(), it = rem[Math.min(cursor, rem.length - 1)]; if (it) { var q = pilePos(it.pile, Ly); dashed(ctx, q.x - 8, q.y - 8, T + 16, T + 16, 22, GOLD, t); } }
        else if (phase === "middle") { var s2 = slotPos(cursor, Ly); dashed(ctx, s2.x - 8, s2.y - 8, T + 16, T + 16, 22, GOLD, t); }
      }
      if (phase === "middle" || phase === "show") numberLine(Ly, t);
      if (res && res.pair) { var m0 = slotPos(mids()[0], Ly); txt(ctx, "(" + res.pair[0] + " + " + res.pair[1] + ") ÷ 2 = " + res.median, m0.x + T + GAP / 2, Ly.pileY + 60, { size: 30, w: 700, align: "center", color: GOLD, stroke: INK, lw: 6 }); }
      S.top(dt);
    });

    debugHook({ phase: function () { return phase; },
      targets: function () {
        var Ly = lay();
        if (phase === "sort") { var r = remaining().sort(function (a, b) { return a.v - b.v; })[0], p = pilePos(r.pile, Ly); return [S.page(p.x + T / 2, p.y + T / 2)]; }
        if (phase === "middle") return mids().filter(function (k) { return picked.indexOf(k) < 0; }).map(function (k) { var q = slotPos(k, Ly); return S.page(q.x + T / 2, q.y + T / 2); });
        return [];
      } });
    loadImg(site ? RQ.url(site.files.rgb) : "").then(function (im) { if (!L.alive) return; img = im; makeRound(); });
  }

  /* ============================================================ L3 · median magic on a tiny picture */
  function medianMagic(L) {
    var S = frame(L, "tiny picture from five cloudy passes"), ctx = S.ctx;
    var G = 6, D = 5;
    var LAND = ["FFFFRF", "FFFRFF", "PPFRFF", "PPRFFF", "PPRFFF", "FRFFFF"];
    var LC = { F: { v: 26, c: "#2f7d3a" }, P: { v: 60, c: "#c9a36b" }, R: { v: 15, c: "#2f6fa8" } };
    var stacks = [], result = [], hand = [], miniClouds = [], handDone = 0, sel = -1, tiles = [], tphase = "", wrongOnce = false;
    var mistakes = 0, busy = false, cursor = 0, kb = false, magicT = null, flyer = null, finale = null, lastTick = 0;
    var magicBtn = S.button("✨ Median magic <small>(M)</small>", "primary", magic); magicBtn.disabled = true;

    // --- build 5 passes with clouds + shadows, at most 2 bad passes per pixel
    function genBad() {
      var bad = null;
      for (var tries = 0; tries < 500; tries++) {
        bad = [];
        for (var d = 0; d < D; d++) {
          var row = [], taken = {}, i; for (i = 0; i < G * G; i++) row.push(0);
          growBlob(L.rng, G, G - 1, 3 + Math.floor(L.rng() * 3), taken).forEach(function (c) { row[c] = "c"; });
          for (i = 0; i < G * G; i++) if (row[i] === "c") { var r = ((i / G) | 0) + 1, q = i % G + 1; if (r < G && q < G && !row[r * G + q]) row[r * G + q] = "s"; }
          bad.push(row);
        }
        var ok = true, touched = 0;
        for (var p = 0; p < G * G; p++) {
          var n = 0; for (d = 0; d < D; d++) if (bad[d][p]) n++;
          if (n > 2) ok = false; if (n) touched++;
        }
        if (ok && touched >= 18) return bad;
      }
      return bad;
    }
    function build() {
      var bad = genBad(), used;
      for (var p = 0; p < G * G; p++) {
        var land = LAND[(p / G) | 0][p % G], lc = LC[land], st = [];
        used = {};
        for (var d = 0; d < D; d++) {
          var kind = bad[d][p] === "c" ? "cloud" : bad[d][p] === "s" ? "shadow" : "clear", v, col;
          if (kind === "cloud") { v = 84 + Math.floor(L.rng() * 14); col = valColor(v); }
          else if (kind === "shadow") { v = Math.max(2, Math.round(lc.v * .3) + Math.floor(L.rng() * 3)); col = rgb(mixA(hexRgb(lc.c), [10, 14, 24], .68)); }
          else { v = lc.v + Math.floor(L.rng() * 7) - 3; col = rgb(mixA(hexRgb(lc.c), v > lc.v ? [255, 255, 255] : [0, 0, 0], Math.abs(v - lc.v) * .03)); }
          while (used[v]) v++; used[v] = 1;
          st.push({ v: v, col: col, kind: kind, pass: d + 1 });
        }
        stacks.push(st); result.push(null);
      }
      for (var dd = 0; dd < D; dd++) miniClouds.push(cellCircles(function (r, q) { return stacks[r * G + q][dd].kind === "cloud"; }, G, 22, L.rng));
      // three hand pixels with two bad passes each, one per land type when possible
      ["P", "R", "F"].forEach(function (lt) {
        var best = -1;
        for (var p = 0; p < G * G; p++) {
          if (LAND[(p / G) | 0][p % G] !== lt || hand.indexOf(p) >= 0) continue;
          var nb = stacks[p].filter(function (s) { return s.kind !== "clear"; }).length;
          if (best < 0 || nb > stacks[best].filter(function (s) { return s.kind !== "clear"; }).length) best = p;
        }
        if (best >= 0) hand.push(best);
      });
    }
    function sorted(p) { return stacks[p].slice().sort(function (a, b) { return a.v - b.v; }); }
    function lay() {
      var W = S.W(), cx = W / 2, mc = 22, mw = G * mc, mg = 30, rowW = D * mw + (D - 1) * mg, rc = 56, rw = G * rc;
      var ix = cx + 10, iw = Math.min(540, W - ix - 30);
      return { W: W, cx: cx, mc: mc, mw: mw, mg: mg, mx: cx - rowW / 2, my: 56, rc: rc, rw: rw, rx: cx - rw - 50, ry: 250, ix: ix, iy: 250, iw: iw, ih: rw };
    }
    function tilePos(k, Ly) { var tw = 86, gap = 14, w = D * tw + (D - 1) * gap; return { x: Ly.ix + (Ly.iw - w) / 2 + k * (tw + gap), y: Ly.iy + 108, w: tw }; }
    function cellRect(p, Ly) { return { x: Ly.rx + (p % G) * Ly.rc, y: Ly.ry + ((p / G) | 0) * Ly.rc, s: Ly.rc }; }
    function open(p) {
      if (busy || magicT !== null || hand.indexOf(p) < 0 || result[p]) return;
      sel = p; wrongOnce = false; tphase = "pick"; cursor = 0;
      var Ly = lay();
      tiles = stacks[p].map(function (s, k) { var tp = tilePos(k, Ly); return { s: s, k: k, x: tp.x, y: tp.y - 40, tx: tp.x, ty: tp.y, glow: 0 }; });
      RQ.audio.sfx("select");
      S.info("Which pass holds the **middle** value? Tap it. (Sort in your head first!)");
    }
    function sortTiles(Ly) {
      var order = sorted(sel);
      tiles.forEach(function (tl) { var k = order.indexOf(tl.s); tl.tx = tilePos(k, Ly).x; tl.rank = k; });
    }
    function pickTile(tl) {
      if (tphase !== "pick" || busy) return;
      var med = sorted(sel)[2], Ly = lay();
      if (tl.s !== med) {
        if (!wrongOnce) { mistakes++; wrongOnce = true; }
        S.bug(tl.x + 43, tl.y); RQ.ui.toast("Not the middle! Watch them line up in order…", "bad", 2200);
        sortTiles(Ly);
        tiles.forEach(function (o) { o.glow = o.s === med ? 1 : 0; });
        S.info("Now they are sorted. The **middle** one (3rd of 5) is glowing: tap it!");
        if (mistakes === 2) L.hint("Sort the five numbers in your head: two come before the middle one and two come after it. The middle is the 3rd.", "hoot");
        return;
      }
      busy = true; tphase = "fly";
      sortTiles(Ly); RQ.audio.sfx("good");
      tl.glow = 1;
      L.timeout(function () {
        tl.ty -= 34; RQ.audio.sfx("pop");
        L.timeout(function () {
          var c = cellRect(sel, lay());
          flyer = { col: tl.s.col, v: tl.s.v, x0: tl.x, y0: tl.ty, s0: 86, x1: c.x, y1: c.y, s1: c.s, t: 0, p: sel };
          RQ.audio.sfx("whoosh");
        }, 450);
      }, 550);
    }
    function landed(p, col) {
      var c = cellRect(p, lay());
      result[p] = { col: col, t: 0 }; S.fx.spark(c.x + c.s / 2, c.y + c.s / 2, 12); RQ.audio.sfx("bloom");
      if (hand.indexOf(p) >= 0) {
        handDone++; sel = -1; tiles = []; busy = false; tphase = "";
        S.fx.text(c.x + c.s / 2, c.y, "+1", GOLD);
        if (handDone >= hand.length) {
          magicBtn.disabled = false; magicBtn.classList.add("pulse"); magicBtn.focus();
          S.info("Three by hand! Now press **✨ Median magic** and let the computer do the other " + (G * G - hand.length) + ".");
          RQ.ui.toast("✨ Median magic is ready!", "good");
        } else S.info("Great! Tap the next **glowing** pixel. (" + handDone + " of " + hand.length + " done)");
      }
    }
    function magic() {
      if (handDone < hand.length || magicT !== null) return;
      magicBtn.disabled = true; magicBtn.classList.remove("pulse"); S.blur();
      magicT = 0; RQ.audio.sfx("powerup");
      S.info("The computer finds the middle value of **every** stack, much faster than we can by hand…");
    }
    function startFinale() {
      finale = { t: 0 };
      RQ.audio.sfx("win");
      L.timeout(function () {
        RQ.ui.say("hoot", "A ReSeed site picture is 640 by 640: that's **409,600** pixels! The computer finds the median of every one, in every band.", { mood: "wow" }).then(function () {
          if (!L.alive) return;
          L.win({ stars: starsFor(mistakes, 0, 1), msg: "You found medians by hand, then **median magic** cleaned the other pixels. A 640 × 640 site picture with 5 bands needs 2,048,000 medians!",
            stats: { "Mistakes": String(mistakes), "Pixels cleaned": "36" } });
        });
      }, 2600);
    }
    function hit(p) {
      var Ly = lay();
      if (sel >= 0 && tphase === "pick") {
        for (var i = 0; i < tiles.length; i++) { var tl = tiles[i]; if (p.x >= tl.x && p.x <= tl.x + 86 && p.y >= tl.y && p.y <= tl.y + 86) return pickTile(tl); }
      }
      if (p.x >= Ly.rx && p.x < Ly.rx + Ly.rw && p.y >= Ly.ry && p.y < Ly.ry + Ly.rw) {
        var q = Math.floor((p.x - Ly.rx) / Ly.rc), r = Math.floor((p.y - Ly.ry) / Ly.rc);
        if (tphase !== "fly") open(r * G + q);
      }
    }
    L.on(S.cv.cv, "pointerdown", function (e) { S.blur(); kb = false; hit(S.pt(e)); });
    S.keys(function (e) {
      var k = e.key;
      if (k === "m" || k === "M") { magic(); e.preventDefault(); return; }
      var todo = hand.filter(function (p) { return !result[p]; }), n = sel >= 0 ? tiles.length : todo.length;
      if (!n || busy || magicT !== null) return;
      if (k === "ArrowLeft" || k === "ArrowUp") cursor = (cursor + n - 1) % n;
      else if (k === "ArrowRight" || k === "ArrowDown") cursor = (cursor + 1) % n;
      else if (k === " " || k === "Enter") {
        if (sel >= 0) { var byX = tiles.slice().sort(function (a, b) { return a.tx - b.tx; }); pickTile(byX[Math.min(cursor, n - 1)]); }
        else { open(todo[Math.min(cursor, n - 1)]); cursor = 0; }
      } else return;
      kb = true; e.preventDefault();
    });

    function miniBars(p, c, k, t) {
      // k: 0..1 sorting progress. Bars are as tall as their value; the middle one grows to fill the cell when k > 1.
      var st = stacks[p], ord = sorted(p), bw = (c.s - 8) / D;
      ctx.fillStyle = "#101a36"; ctx.fillRect(c.x, c.y, c.s, c.s);
      st.forEach(function (s, i) {
        var j = ord.indexOf(s), x = c.x + 4 + u.lerp(i, j, u.ease.inOut(u.clamp(k, 0, 1))) * bw, h = 6 + s.v / 100 * (c.s - 12);
        ctx.fillStyle = s.col; ctx.fillRect(x + 1, c.y + c.s - 4 - h, bw - 2, h);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, c.y + c.s - 4 - h, bw - 2, h);
      });
    }

    L.loop(function (dt, t) {
      var W = S.W(), Ly = lay(), p, c;
      space(ctx, W, t, null);
      // 5 cloudy passes (pixel art)
      for (var d = 0; d < D; d++) {
        var mx = Ly.mx + d * (Ly.mw + Ly.mg), my = Ly.my;
        txt(ctx, "Pass " + (d + 1), mx + Ly.mw / 2, my - 20, { size: 20, w: 700, align: "center", color: "#e8eefc" });
        box(ctx, mx - 4, my - 4, Ly.mw + 8, Ly.mw + 8, 8, "#0f1a3a", 3);
        for (p = 0; p < G * G; p++) {
          var s = stacks[p][d];
          ctx.fillStyle = s.kind === "cloud" ? "#9fb3d1" : s.col;
          ctx.fillRect(mx + (p % G) * Ly.mc, my + ((p / G) | 0) * Ly.mc, Ly.mc, Ly.mc);
        }
        ctx.save(); ctx.beginPath(); ctx.rect(mx, my, Ly.mw, Ly.mw); ctx.clip(); drawCloud(ctx, miniClouds[d], mx, my, 2); ctx.restore();
        if (sel >= 0) { ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(mx + (sel % G) * Ly.mc, my + ((sel / G) | 0) * Ly.mc, Ly.mc, Ly.mc); }
      }
      // funnel arrow
      var ay = Ly.my + Ly.mw + 18;
      txt(ctx, "5 passes  →  1 clean picture", Ly.rx + Ly.rw / 2, ay + 22, { size: 22, w: 700, align: "center", color: GOLD });
      // result grid
      box(ctx, Ly.rx - 6, Ly.ry - 6, Ly.rw + 12, Ly.rw + 12, 10, "#101a36", 4);
      for (p = 0; p < G * G; p++) {
        c = cellRect(p, Ly);
        var dl = magicT !== null && !result[p] ? magicT - ((p % G) + ((p / G) | 0)) * .09 : -1;
        if (result[p]) {
          result[p].t = Math.min(1, result[p].t + dt * 4);
          var sc = u.ease.outBack(result[p].t), w = c.s * sc;
          ctx.fillStyle = result[p].col; ctx.fillRect(c.x + (c.s - w) / 2, c.y + (c.s - w) / 2, w, w);
        } else if (dl >= 0) {
          if (dl < .7) miniBars(p, c, dl / .6, t);
          else {
            var med = sorted(p)[2];
            if (dl < 1) { miniBars(p, c, 1, t); var g2 = (dl - .7) / .3; ctx.fillStyle = med.col; ctx.fillRect(c.x + c.s / 2 - c.s / 2 * g2, c.y + c.s / 2 - c.s / 2 * g2, c.s * g2, c.s * g2); }
            else {
              result[p] = { col: med.col, t: 1 };
              if (t - lastTick > .05) { lastTick = t; RQ.audio.tone({ f: 600 + ((p * 37) % 600), type: "triangle", d: .06, v: .08 }); }
              if (p % 3 === 0) S.fx.spark(c.x + c.s / 2, c.y + c.s / 2, 3);
            }
          }
        } else {
          ctx.fillStyle = "#1a2750"; ctx.fillRect(c.x + 1, c.y + 1, c.s - 2, c.s - 2);
          txt(ctx, "?", c.x + c.s / 2, c.y + c.s / 2 + 2, { size: 22, w: 700, align: "center", color: "rgba(255,255,255,.25)" });
        }
      }
      ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1; ctx.beginPath();
      for (var g = 1; g < G; g++) { ctx.moveTo(Ly.rx + g * Ly.rc, Ly.ry); ctx.lineTo(Ly.rx + g * Ly.rc, Ly.ry + Ly.rw); ctx.moveTo(Ly.rx, Ly.ry + g * Ly.rc); ctx.lineTo(Ly.rx + Ly.rw, Ly.ry + g * Ly.rc); }
      ctx.stroke();
      var todo = hand.filter(function (q) { return !result[q]; });
      hand.forEach(function (q, i) {
        if (result[q]) return;
        var cr = cellRect(q, Ly), a = .55 + .45 * Math.sin(t * 5 + i);
        ctx.strokeStyle = q === sel ? "#ffffff" : "rgba(255,197,61," + a + ")"; ctx.lineWidth = 5; ctx.strokeRect(cr.x + 3, cr.y + 3, cr.s - 6, cr.s - 6);
        if (q !== sel) star(ctx, cr.x + cr.s / 2, cr.y + cr.s / 2, 10 + 3 * Math.sin(t * 5 + i), GOLD);
      });
      if (kb && sel < 0 && todo.length) { var kc = cellRect(todo[Math.min(cursor, todo.length - 1)], Ly); dashed(ctx, kc.x - 4, kc.y - 4, kc.s + 8, kc.s + 8, 8, "#ffffff", t); }
      // inspector panel
      box(ctx, Ly.ix, Ly.iy, Ly.iw, Ly.ih, 18, "#fffdf7", 4);
      if (finale) {
        finale.t += dt;
        var k1 = Math.min(1, finale.t / 1.4), n1 = Math.round(36 + (409600 - 36) * u.ease.outCubic(k1));
        txt(ctx, "Our tiny picture: 36 pixels", Ly.ix + Ly.iw / 2, Ly.iy + 48, { size: 24, w: 600, align: "center", color: INK });
        txt(ctx, u.fmt(n1), Ly.ix + Ly.iw / 2, Ly.iy + 122, { size: 64, w: 700, align: "center", color: "#d08a1c", stroke: INK, lw: 4 });
        txt(ctx, "pixels in one ReSeed site picture (640 × 640)", Ly.ix + Ly.iw / 2, Ly.iy + 178, { size: 22, w: 600, align: "center", color: INK });
        if (finale.t > 1.6) {
          var k2 = u.ease.outBack(Math.min(1, (finale.t - 1.6) * 2));
          ctx.save(); ctx.translate(Ly.ix + Ly.iw / 2, Ly.iy + 250); ctx.scale(k2, k2);
          txt(ctx, "× 5 bands = 2,048,000 medians!", 0, 0, { size: 28, w: 700, align: "center", color: "#2f9e4f" });
          txt(ctx, "blue · green · red · 2 kinds of invisible infrared", 0, 38, { size: 20, w: 500, align: "center", color: "#4a5b6d" });
          ctx.restore();
        }
      } else if (sel >= 0) {
        txt(ctx, "One pixel, 5 passes", Ly.ix + 22, Ly.iy + 34, { size: 26, w: 700, color: INK });
        txt(ctx, tphase === "pick" ? "Tap the middle value (the median)" : "Sorted! The middle one wins.", Ly.ix + 22, Ly.iy + 70, { size: 21, w: 500, color: "#4a5b6d" });
        tiles.forEach(function (tl, i) {
          tl.x += (tl.tx - tl.x) * Math.min(1, dt * 8); tl.y += (tl.ty - tl.y) * Math.min(1, dt * 10);
          if (tl.glow) { ctx.fillStyle = "rgba(255,197,61," + (.4 + .2 * Math.sin(t * 6)) + ")"; ctx.beginPath(); ctx.arc(tl.x + 43, tl.y + 43, 62, 0, TAU); ctx.fill(); }
          box(ctx, tl.x, tl.y, 86, 86, 14, tl.s.col, 4);
          var dark = tl.s.v < 60;
          txt(ctx, String(tl.s.v), tl.x + 43, tl.y + 46, { size: 36, w: 700, align: "center", color: dark ? "#fff" : INK, stroke: dark ? INK : null, lw: 5 });
          txt(ctx, "Pass " + tl.s.pass, tl.x + 43, tl.y + 108, { size: 20, w: 600, align: "center", color: "#4a5b6d" });
        });
        if (kb && tphase === "pick") { var byX = tiles.slice().sort(function (a, b) { return a.tx - b.tx; }), ct = byX[Math.min(cursor, byX.length - 1)]; if (ct) dashed(ctx, ct.x - 6, ct.y - 6, 98, 98, 16, "#d08a1c", t); }
        txt(ctx, "small = dark (shadow) · big = bright (cloud)", Ly.ix + Ly.iw / 2, Ly.iy + Ly.ih - 34, { size: 20, w: 500, align: "center", color: "#4a5b6d" });
      } else {
        txt(ctx, magicT !== null ? "Median magic!" : handDone >= hand.length ? "Ready for magic!" : "Tap a glowing pixel", Ly.ix + Ly.iw / 2, Ly.iy + 70, { size: 30, w: 700, align: "center", color: INK });
        txt(ctx, "By hand: " + handDone + " / " + hand.length, Ly.ix + Ly.iw / 2, Ly.iy + 120, { size: 24, w: 600, align: "center", color: "#d08a1c" });
        var done = result.filter(Boolean).length;
        txt(ctx, "Clean pixels: " + done + " / " + G * G, Ly.ix + Ly.iw / 2, Ly.iy + 160, { size: 24, w: 600, align: "center", color: "#2f9e4f" });
        box(ctx, Ly.ix + 40, Ly.iy + 196, Ly.iw - 80, 26, 10, "#e9edf5", 3);
        ctx.fillStyle = "#2f9e4f"; u.rr(ctx, Ly.ix + 40, Ly.iy + 196, (Ly.iw - 80) * done / (G * G), 26, 10); ctx.fill();
        txt(ctx, "Each pixel: sort its 5 values, keep the middle.", Ly.ix + Ly.iw / 2, Ly.iy + 270, { size: 20, w: 500, align: "center", color: "#4a5b6d" });
      }
      if (flyer) {
        flyer.t = Math.min(1, flyer.t + dt * 2.2);
        var e = u.ease.inOut(flyer.t), fs = u.lerp(flyer.s0, flyer.s1, e), fx = u.lerp(flyer.x0, flyer.x1, e), fy = u.lerp(flyer.y0, flyer.y1, e) - Math.sin(e * Math.PI) * 90;
        box(ctx, fx, fy, fs, fs, 10 * (1 - e) + 2, flyer.col, 3);
        if (flyer.t >= 1) { var f = flyer; flyer = null; landed(f.p, f.col); }
      }
      if (magicT !== null && !finale) {
        magicT += dt;
        if (result.every(Boolean) && magicT > 1.2) { RQ.audio.sfx("bloom"); S.fx.spark(Ly.rx + Ly.rw / 2, Ly.ry + Ly.rw / 2, 30); S.info("All **36** pixels are clean! Each spot was clear in most passes, so the middle value was clear ground."); startFinale(); }
      }
      S.top(dt);
    });

    debugHook({ state: function () { return { sel: sel, tphase: tphase, busy: busy, hand: handDone, magic: magicT !== null, flyer: !!flyer }; },
      targets: function () {
        var Ly = lay();
        if (sel >= 0) { var med = sorted(sel)[2], tl = tiles.filter(function (o) { return o.s === med; })[0]; return [S.page(tl.x + 43, tl.y + 43)]; }
        var todo = hand.filter(function (p) { return !result[p]; });
        return todo.map(function (p) { var c = cellRect(p, Ly); return S.page(c.x + c.s / 2, c.y + c.s / 2); });
      } });
    build();
    S.info("Tap a **glowing** pixel to see its 5 values, then pick the **middle** one.");
  }

  /* ============================================================ L4 · clear sky: real scenes, real composite */
  function cloudySite(mine) {
    var minClear = function (s) { return Math.min.apply(null, s.image.scenes.map(function (x) { return x.clear_fraction; })); };
    if (mine && mine.image && minClear(mine) < .9) return mine;
    return RQ.site("kalimantan") || mine;
  }

  function clearSky(L) {
    var mine = RQ.mySite(), site = cloudySite(mine), S = frame(L, "real satellite scenes of " + (site ? site.name : "a forest")), ctx = S.ctx;
    var G = 16, BIG = 370;
    var scenes = site.image.scenes.slice(0, 8).map(function (s, i) { return { i: i, date: s.datetime, cloud: s.cloud, clear: s.clear_fraction, on: null, circ: null, cv: null, stacked: false, shake: 0, land: 0 }; });
    var img = null, stack = [], count = [], mistakes = 0, wrong = 0, cursor = 0, kb = false, phase = "load", flyer = null;
    var sweep = null, divider = 1, dragging = false, puffs = [], cloudiest = null;
    var medBtn = S.button("✨ Median!", "primary", median); medBtn.disabled = true;
    var finBtn = S.button("🏁 Finish", "go", finish); finBtn.hidden = true;
    for (var c0 = 0; c0 < G * G; c0++) count.push(0);
    S.info("Loading real scenes…");

    function genOn(s) {
      var rng = u.seeded("g07:" + site.id + ":" + s.date), n = Math.round((1 - s.clear) * G * G), on = [], cnt = 0, list = [], i;
      for (i = 0; i < G * G; i++) on.push(0);
      var seeds = Math.max(1, Math.round(n / 24));
      for (var k = 0; k < 400 && cnt < Math.min(n, seeds); k++) { i = Math.floor(rng() * G * G); if (!on[i]) { on[i] = 1; list.push(i); cnt++; } }
      for (var g = 0; g < 30000 && cnt < n; g++) {
        var c = list[Math.floor(rng() * list.length)], d = DIRS[Math.floor(rng() * 4)], r = Math.floor(c / G) + d[0], q = c % G + d[1];
        if (r < 0 || q < 0 || r >= G || q >= G || on[r * G + q]) continue;
        on[r * G + q] = 1; list.push(r * G + q); cnt++;
      }
      return on;
    }
    function prerender() {
      var dpr = 2, size = BIG * dpr, cell = size / G;
      scenes.forEach(function (s) {
        s.on = genOn(s);
        s.circ = cellCircles(function (r, q) { return !!s.on[r * G + q]; }, G, 640 / G, u.seeded("g07-puff:" + s.date), { edges: true });
        var cv = document.createElement("canvas"); cv.width = cv.height = size;
        var c2 = cv.getContext("2d");
        drawPic(c2, img, 0, 0, size, size);
        var k = size / 640;
        drawShadow(c2, s.circ, cell * .35, cell * .45, k, .45);
        drawCloud(c2, s.circ, 0, 0, 12, k);
        s.cv = cv;
      });
      cloudiest = scenes.slice().sort(function (a, b) { return a.clear - b.clear; })[0];
    }
    function lay() {
      var W = S.W(), cx = W / 2, n = scenes.length, cw = 150, ch = 190, gap = Math.min(16, (W - 40 - n * cw) / Math.max(1, n - 1));
      var rowW = n * cw + (n - 1) * gap;
      return { W: W, cx: cx, cw: cw, ch: ch, gap: gap, x0: cx - rowW / 2, cy: 14,
        deck: { x: cx - 185, y: 246, s: BIG }, stack: { x: Math.max(24, cx - 600), y: 234, w: 230 }, info: { x: cx + 232, y: 246, w: Math.min(360, W - (cx + 232) - 24) } };
    }
    function cardPos(i, Ly) { return { x: Ly.x0 + i * (Ly.cw + Ly.gap), y: Ly.cy }; }
    function left() { return scenes.filter(function (s) { return !s.stacked; }); }
    function covered(min) { return count.filter(function (v) { return v >= min; }).length / (G * G); }
    function pick(s) {
      if (phase !== "stack" || s.stacked || flyer) return;
      var min = Math.min.apply(null, left().map(function (o) { return o.cloud; })), Ly = lay(), p = cardPos(s.i, Ly);
      if (s.cloud > min) {
        mistakes++; wrong++; s.shake = .45; S.bug(p.x + Ly.cw / 2, p.y + 120);
        RQ.ui.toast("Not yet! Find the **smallest** cloud number.", "bad", 2200);
        if (wrong === 2 || (wrong === 1 && L.fails >= 1)) L.hint("Read the cloud number under each picture. The smallest number is the least cloudy scene, so it goes first.", "tuki");
        return;
      }
      s.stacked = true; stack.push(s);
      flyer = { s: s, x0: p.x + 10, y0: p.y + 10, s0: 130, t: 0 };
      RQ.audio.sfx("whoosh");
      cursor = 0;
    }
    function landed(s) {
      s.land = 1;
      for (var i = 0; i < G * G; i++) if (!s.on[i]) count[i]++;
      var Ly = lay();
      S.fx.spark(Ly.deck.x + BIG / 2, Ly.deck.y + BIG / 2, 14); S.fx.text(Ly.deck.x + BIG / 2, Ly.deck.y + 30, "+1 scene", GOLD);
      RQ.audio.tone({ f: 392 * Math.pow(1.12, stack.length), type: "triangle", d: .18, v: .22 });
      L.hud.set("stack", "🗂️ " + stack.length + " / " + scenes.length);
      if (left().length) { S.info("Stacked **" + s.date + "**. Next: the least cloudy scene that is left."); return; }
      phase = "ready";
      S.info("All **" + stack.length + "** scenes are in the stack. Every spot was seen clear. Press **✨ Median!**");
      RQ.ui.say("tuki", "Fun fact: the cloud number counts clouds on the whole big satellite tile. Your small square can still be clear!", { mood: "happy" }).then(function () {
        if (!L.alive) return;
        medBtn.disabled = false; medBtn.classList.add("pulse"); medBtn.focus();
      });
    }
    function median() {
      if (phase !== "ready") return;
      phase = "sweep"; medBtn.disabled = true; medBtn.classList.remove("pulse"); S.blur();
      sweep = { t: 0 }; RQ.audio.sfx("powerup");
      // the clouds of the cloudiest scenes in the stack drift together, then the wind blows them off the picture
      puffs = stack.filter(function (s) { return s.circ.length; }).sort(function (a, b) { return a.clear - b.clear; }).slice(0, 3)
        .map(function (s, j) { return { circ: s.circ, dx: 0, dy: 0, v: 0, a: 900 + j * 250, delay: .8 + j * .22, vy: (j - 1) * 40 }; });
      S.info("Finding the median of every pixel, across all the stacked scenes…");
    }
    function finish() {
      if (phase !== "compare") return;
      L.win({ stars: starsFor(mistakes, 0, 2), msg: "You stacked **" + stack.length + "** real scenes of " + site.name.split(",")[0] + ", least cloudy first, and made the **median composite**, just like `load_sentinel2`!",
        stats: { "Real scenes": String(stack.length), "Mistakes": String(mistakes) } });
    }
    function bigRect(Ly) { var s = 540; return { x: Ly.cx - s / 2, y: 46, s: s }; }

    L.on(S.cv.cv, "pointerdown", function (e) {
      S.blur(); kb = false;
      var p = S.pt(e), Ly = lay();
      if (phase === "stack") {
        scenes.forEach(function (s) { var c = cardPos(s.i, Ly); if (p.x >= c.x && p.x <= c.x + Ly.cw && p.y >= c.y && p.y <= c.y + Ly.ch) pick(s); });
      } else if (phase === "compare") {
        var b = bigRect(Ly);
        if (p.x >= b.x - 30 && p.x <= b.x + b.s + 30 && p.y >= b.y && p.y <= b.y + b.s) { dragging = true; divider = u.clamp((p.x - b.x) / b.s, 0, 1); try { S.cv.cv.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } }
      }
    });
    L.on(S.cv.cv, "pointermove", function (e) {
      if (!dragging) return;
      var b = bigRect(lay()), p = S.pt(e); divider = u.clamp((p.x - b.x) / b.s, 0, 1);
    });
    L.on(window, "pointerup", function () { dragging = false; });
    S.keys(function (e) {
      var k = e.key;
      if (phase === "compare") {
        if (k === "ArrowLeft") divider = Math.max(0, divider - .05); else if (k === "ArrowRight") divider = Math.min(1, divider + .05); else return;
        e.preventDefault(); return;
      }
      if (phase !== "stack") return;
      var list = left(); if (!list.length) return;
      if (k === "ArrowLeft") cursor = (cursor + list.length - 1) % list.length;
      else if (k === "ArrowRight") cursor = (cursor + 1) % list.length;
      else if (k === " " || k === "Enter") pick(list[Math.min(cursor, list.length - 1)]);
      else return;
      kb = true; e.preventDefault();
    });

    function card(s, Ly, t) {
      var p = cardPos(s.i, Ly), x = p.x + Math.sin(s.shake * 40) * s.shake * 14, y = p.y;
      s.shake = Math.max(0, s.shake - 1 / 60);
      if (s.stacked) {
        ctx.save(); ctx.setLineDash([8, 7]); ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 3; u.rr(ctx, x, y, Ly.cw, Ly.ch, 14); ctx.stroke(); ctx.restore();
        txt(ctx, "in stack #" + (stack.indexOf(s) + 1), x + Ly.cw / 2, y + Ly.ch / 2, { size: 20, w: 600, align: "center", color: "rgba(255,255,255,.55)" });
        return;
      }
      box(ctx, x, y, Ly.cw, Ly.ch, 14, "#fffdf7", 3);
      if (s.cv) ctx.drawImage(s.cv, x + 10, y + 10, 130, 130);
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(x + 10, y + 10, 130, 130);
      txt(ctx, s.date, x + Ly.cw / 2, y + 156, { size: 20, w: 600, align: "center", color: INK });
      cloudIcon(ctx, x + 22, y + 176, 1);
      txt(ctx, s.cloud + "%", x + 52, y + 177, { size: 24, w: 700, color: "#2b5fae" });
    }
    function stackPanel(Ly, t) {
      var st = Ly.stack, base = 600, h = 34;
      txt(ctx, "Stack", st.x, st.y, { size: 28, w: 700, stroke: INK, lw: 5 });
      txt(ctx, "max_scenes = 8", st.x, st.y + 30, { size: 20, w: 600, color: "#ffd46b" });
      for (var j = 0; j < 8; j++) {
        var y = base - (j + 1) * (h + 6), s = stack[j];
        if (s && s.land) {
          box(ctx, st.x, y, st.w, h, 9, "#ffe9b8", 3);
          txt(ctx, s.date, st.x + 10, y + h / 2 + 1, { size: 20, w: 600, color: INK });
          txt(ctx, Math.round(s.clear * 100) + "% clear", st.x + st.w - 10, y + h / 2 + 1, { size: 19, w: 600, align: "right", color: "#2f7d3a" });
        } else {
          ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 2.5; u.rr(ctx, st.x, y, st.w, h, 9); ctx.stroke(); ctx.restore();
          txt(ctx, j < scenes.length ? "" : "empty", st.x + st.w / 2, y + h / 2 + 1, { size: 20, w: 500, align: "center", color: "rgba(255,255,255,.4)" });
        }
      }
    }
    function infoPanel(Ly) {
      var b = Ly.info, x = b.x, y = b.y, w = b.w;
      box(ctx, x, y, w, 360, 16, "#fffdf7", 3);
      txt(ctx, "Clear looks per spot", x + 18, y + 28, { size: 22, w: 700, color: INK });
      var ms = 11, mx = x + 18, my = y + 52;
      for (var i = 0; i < G * G; i++) {
        var v = count[i];
        ctx.fillStyle = !stack.length ? "#d5dbe6" : v === 0 ? "#6b7280" : v === 1 ? "#b7e4b0" : v === 2 ? "#6cc46a" : "#2f8a3e";
        ctx.fillRect(mx + (i % G) * ms, my + ((i / G) | 0) * ms, ms - 1, ms - 1);
      }
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(mx - 1, my - 1, G * ms + 1, G * ms + 1);
      var lx = mx + G * ms + 16;
      [["#6b7280", "never clear"], ["#b7e4b0", "1 look"], ["#6cc46a", "2 looks"], ["#2f8a3e", "3+ looks"]].forEach(function (r, k) {
        ctx.fillStyle = r[0]; ctx.fillRect(lx, my + 6 + k * 30, 18, 18); ctx.strokeRect(lx, my + 6 + k * 30, 18, 18);
        txt(ctx, r[1], lx + 26, my + 16 + k * 30, { size: 19, w: 500, color: INK });
      });
      var cov = Math.round(covered(1) * 100);
      txt(ctx, "Seen clear: " + (stack.length ? cov : 0) + "% of spots", x + 18, y + 274, { size: 22, w: 700, color: "#2f7d3a" });
      txt(ctx, "Scenes stacked: " + stack.length + " / " + scenes.length, x + 18, y + 308, { size: 21, w: 600, color: INK });
      txt(ctx, site.name.split(",")[0] + " · 6.4 km square", x + 18, y + 340, { size: 20, w: 500, color: "#4a5b6d" });
    }
    function deck(Ly, t, rect, alpha) {
      var r = rect || Ly.deck, n = stack.filter(function (s) { return s.land; }).length, size = r.s || BIG;
      if (!n) {
        ctx.save(); ctx.setLineDash([12, 9]); ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 4; u.rr(ctx, r.x, r.y, size, size, 16); ctx.stroke(); ctx.restore();
        txt(ctx, "Tap the least cloudy scene", r.x + size / 2, r.y + size / 2 - 16, { size: 24, w: 700, align: "center", color: "#e8eefc" });
        txt(ctx, "(smallest cloud number)", r.x + size / 2, r.y + size / 2 + 16, { size: 20, w: 500, align: "center", color: "#c4d2f0" });
        return;
      }
      var j = 0;
      stack.forEach(function (s) {
        if (!s.land) return;
        var o = (n - 1 - j) * 5; j++;
        ctx.globalAlpha = alpha == null ? 1 : alpha;
        ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(r.x + o + 4, r.y - o + 6, size, size);
        ctx.drawImage(s.cv, r.x + o, r.y - o, size, size);
        ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(r.x + o, r.y - o, size, size);
        ctx.globalAlpha = 1;
      });
    }

    L.loop(function (dt, t) {
      var W = S.W(), Ly = lay();
      space(ctx, W, t, null);
      if (phase === "load") { txt(ctx, "Downloading scenes…", W / 2, H / 2, { size: 30, w: 700, align: "center" }); S.top(dt); return; }
      if (phase === "stack" || phase === "ready") {
        scenes.forEach(function (s) { card(s, Ly, t); });
        if (kb && phase === "stack") { var lst = left(), cs = lst[Math.min(cursor, lst.length - 1)]; if (cs) { var cp = cardPos(cs.i, Ly); dashed(ctx, cp.x - 6, cp.y - 6, Ly.cw + 12, Ly.ch + 12, 18, GOLD, t); } }
        stackPanel(Ly, t); deck(Ly, t); infoPanel(Ly);
        if (flyer) {
          flyer.t = Math.min(1, flyer.t + dt * 2.4);
          var e = u.ease.inOut(flyer.t), fs = u.lerp(flyer.s0, BIG, e), fx = u.lerp(flyer.x0, Ly.deck.x, e), fy = u.lerp(flyer.y0, Ly.deck.y, e) - Math.sin(e * Math.PI) * 60;
          ctx.save(); ctx.translate(fx + fs / 2, fy + fs / 2); ctx.rotate((1 - e) * .25);
          ctx.drawImage(flyer.s.cv, -fs / 2, -fs / 2, fs, fs); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(-fs / 2, -fs / 2, fs, fs);
          ctx.restore();
          if (flyer.t >= 1) { var f = flyer; flyer = null; landed(f.s); }
        }
      } else {
        var b = bigRect(Ly);
        if (phase === "sweep") {
          sweep.t += dt;
          var k = u.ease.inOut(Math.min(1, sweep.t / .7));
          var r = { x: u.lerp(Ly.deck.x, b.x, k), y: u.lerp(Ly.deck.y, b.y, k), s: u.lerp(BIG, b.s, k) };
          ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(r.x + 6, r.y + 8, r.s, r.s);
          drawPic(ctx, img, r.x, r.y, r.s, r.s);
          if (sweep.t < .9) deck(Ly, t, r, 1 - u.clamp((sweep.t - .5) / .4, 0, 1));
          ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeRect(r.x, r.y, r.s, r.s);
          var kk = r.s / 640, alive = 0;
          if (sweep.t > .7 && !sweep.wind) { sweep.wind = true; RQ.audio.noise({ f: 300, f2: 2400, ft: "bandpass", d: 1.4, v: .3 }); }
          ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.s, r.s); ctx.clip();
          puffs.forEach(function (g) {
            if (sweep.t > g.delay) { g.v += g.a * dt; g.dx += g.v * dt / kk; g.dy += g.vy * dt; }
            if (g.dx > 760) return;
            alive++;
            if (sweep.t > .5) drawCloud(ctx, g.circ, r.x + g.dx * kk, r.y + g.dy * kk, 10 * kk, kk, u.clamp((sweep.t - .5) * 3, 0, 1) * u.clamp(1 - g.dx / 760, 0, 1));
          });
          ctx.restore();
          if (sweep.t > .8 && sweep.t < 2.6 && !REDUCE) {
            ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3; ctx.lineCap = "round";
            for (var i = 0; i < 6; i++) { var yy = b.y + 60 + i * 80 + Math.sin(t * 3 + i) * 10, xx = b.x + ((t * 900 + i * 170) % (b.s + 200)) - 100; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 90, yy); ctx.stroke(); }
          }
          if (sweep.t > 1.2 && Math.random() < .3) S.fx.spark(b.x + Math.random() * b.s, b.y + Math.random() * b.s, 2);
          if (sweep.t > 1 && !alive || sweep.t > 3.6) {
            phase = "compare"; divider = 1; sweep.t2 = 0; RQ.audio.sfx("bloom"); S.fx.spark(b.x + b.s / 2, b.y + b.s / 2, 30);
            finBtn.hidden = false; medBtn.hidden = true;
            S.info("This is the **real** picture ReSeed made from these scenes! Drag the slider (or ←/→) to compare with one cloudy pass.");
            RQ.ui.toast("☀️ Clear sky!", "good");
            L.timeout(function () { finBtn.focus(); }, 1500);
          }
        } else {
          sweep.t2 += dt;
          if (sweep.t2 < 1.4 && !dragging) divider = u.lerp(1, .5, u.ease.outCubic(Math.min(1, sweep.t2 / 1.2)));
          ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(b.x + 6, b.y + 8, b.s, b.s);
          drawPic(ctx, img, b.x, b.y, b.s, b.s);
          var dx = b.x + b.s * divider;
          ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.s * divider, b.s); ctx.clip(); ctx.drawImage(cloudiest.cv, b.x, b.y, b.s, b.s); ctx.restore();
          ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeRect(b.x, b.y, b.s, b.s);
          ctx.fillStyle = "#fff"; ctx.fillRect(dx - 3, b.y, 6, b.s);
          ctx.beginPath(); ctx.arc(dx, b.y + b.s / 2, 28, 0, TAU); ctx.fillStyle = GOLD; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
          txt(ctx, "◀ ▶", dx, b.y + b.s / 2 + 1, { size: 18, w: 700, align: "center", color: INK });
          if (divider > .12) { box(ctx, b.x + 10, b.y + 10, 220, 34, 10, "rgba(255,253,247,.92)", 2); txt(ctx, "1 pass · " + cloudiest.date, b.x + 22, b.y + 28, { size: 19, w: 600, color: INK }); }
          if (divider < .88) { box(ctx, b.x + b.s - 230, b.y + b.s - 46, 220, 34, 10, "rgba(217,247,223,.95)", 2); txt(ctx, "median of " + stack.length + " scenes", b.x + b.s - 120, b.y + b.s - 28, { size: 19, w: 700, align: "center", color: "#1f6b34" }); }
          // the real scene list
          var rx = b.x + b.s + 30, rw = W - rx - 24;
          if (rw > 200) {
            box(ctx, rx, b.y, rw, 40 + scenes.length * 36 + 24, 14, "#fffdf7", 3);
            txt(ctx, "Real scenes", rx + 16, b.y + 26, { size: 22, w: 700, color: INK });
            stack.forEach(function (s, j) {
              var yy = b.y + 66 + j * 36;
              txt(ctx, s.date, rx + 16, yy, { size: 20, w: 600, color: INK });
              cloudIcon(ctx, rx + rw - 104, yy, .9);
              txt(ctx, s.cloud + "%", rx + rw - 16, yy + 1, { size: 20, w: 700, align: "right", color: "#2b5fae" });
            });
          }
          var lw2 = b.x - 48;
          if (lw2 > 180) {
            txt(ctx, site.name.split(",")[0], 24 + lw2 / 2, b.y + 30, { size: 26, w: 700, align: "center", stroke: INK, lw: 5 });
            txt(ctx, site.country, 24 + lw2 / 2, b.y + 62, { size: 20, w: 500, align: "center", color: "#c4d2f0" });
            txt(ctx, "Sentinel-2", 24 + lw2 / 2, b.y + 120, { size: 21, w: 700, align: "center", color: GOLD });
            txt(ctx, "10 m pixels", 24 + lw2 / 2, b.y + 150, { size: 20, w: 500, align: "center", color: "#e8eefc" });
            txt(ctx, "6.4 km × 6.4 km", 24 + lw2 / 2, b.y + 178, { size: 20, w: 500, align: "center", color: "#e8eefc" });
          }
        }
      }
      S.top(dt);
    });

    debugHook({ phase: function () { return phase; }, flyer: function () { return !!flyer; },
      targets: function () {
        var Ly = lay(), l = left().sort(function (a, b) { return a.cloud - b.cloud; });
        if (!l.length) return [];
        var c = cardPos(l[0].i, Ly); return [S.page(c.x + Ly.cw / 2, c.y + 70)];
      } });
    var intro = mine && site && mine.id === site.id
      ? RQ.ui.say("tuki", "Your own forest, Ketapang on Borneo! Many of its pictures are half hidden by clouds.", { mood: "happy" })
      : RQ.ui.say("tuki", "Your forest's pictures, taken June to September, were nearly cloud-free. Let's help Ketapang on Borneo, whose pictures are much cloudier!", { mood: "think" });
    Promise.all([intro, loadImg(RQ.url(site.files.rgb))]).then(function (r) {
      if (!L.alive) return;
      img = r[1]; prerender(); phase = "stack";
      L.hud.set("stack", "🗂️ 0 / " + scenes.length);
      S.info("Tap the scene with the **smallest cloud number** first. Keys: ←/→ and Space.");
    });
  }

  /* ============================================================ the game */
  RQ.game({
    id: "g07",
    music: "space",
    intro: [
      ["tuki", "Hi, I'm Tuki! My satellite dish catches pictures of forests from space."],
      ["sprout", "But clouds keep getting in the way! Let's sweep them out of the pictures."]
    ],
    outro: [
      ["tuki", "Clear skies! You can mask clouds and build a median picture, just like ReSeed."],
      ["hoot", "Mask, sort, then take the middle. When most pictures of a spot are clear, that little trick wipes the clouds away!"]
    ],
    levels: [
      { title: "Cloud mask", goal: "Mask every cloud, shadow and cirrus square",
        intro: [["tuki", "Squawk, clouds hide your forest! Tap clouds, their dark shadows and thin, wispy **cirrus** clouds to **mask** those squares."],
                ["tuki", "Masked squares are skipped, so only clear ground is kept. Drag to paint many squares at once!"]],
        cards: ["cloud-mask", "min-clear"],
        play: cloudMask },
      { title: "The median", goal: "Sort the numbers, then pick the middle",
        intro: [["hoot", "Here is ONE pixel, photographed on different passes. Clouds make it too bright, shadows too dark."],
                ["hoot", "Sort the numbers from smallest to biggest, then pick the one in the **middle**. That is the **median**."]],
        cards: ["median"],
        play: medianSort },
      { title: "Median magic", goal: "Find 3 medians by hand, then use the magic",
        intro: [["sprout", "A tiny picture: 36 pixels, 5 passes each. Find the middle value of the glowing pixels."],
                ["tuki", "Do three by hand. Then press **Median magic** and let the computer do the rest!"]],
        cards: ["pixel-numbers"],
        play: medianMagic },
      { title: "Clear sky", goal: "Stack real scenes, least cloudy first",
        intro: [["tuki", "Real pictures now! ReSeed's search lines up the scenes from **least cloudy** to most cloudy, then stacks up to 8."]],
        cards: ["composite", "cloud-cover"],
        play: clearSky }
    ]
  });
})();
