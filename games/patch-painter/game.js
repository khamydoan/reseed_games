/* g16 Patch Painter — grid algorithms from reseed/reseed/polygonize.py and config.py.
 * L1 threshold slider → deforestation mask (DECLINE_ABS) · L2 flood fill with 4 neighbours (ndimage.label) ·
 * L3 pixels → hectares, sweep patches under MIN_PATCH_HA · L4 bubble-sort race with My Site's REAL patch sizes ·
 * L5 pick the mission target (2–50 ha, pipeline._mission_target) and split a giant patch (split_patch). */
(function () {
  "use strict";
  var u = RQ.u;
  var DATA = RQ.data() || {}, TH = DATA.thresholds || {};
  var DECLINE_ABS = TH.DECLINE_ABS || 0.2, MIN_PATCH_HA = TH.MIN_PATCH_HA || 0.5, MISSION_MAX_HA = TH.MISSION_MAX_HA || 50;
  var PIXEL_HA = 0.01;                                   // one Sentinel-2 pixel: 10 m × 10 m = 100 m²
  var MIN_PX = Math.round(MIN_PATCH_HA / PIXEL_HA);      // 50 pixels
  var INK = "#1d2b3a";
  var PAINT = ["#ff7a1a", "#2b7bd0", "#d1495b", "#7c5cc4", "#12a39a", "#e0a21d", "#f06595", "#5b6ee1", "#2f9e4f"];
  var N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var SHORT = { rondonia: "Rondônia", dixie: "the Dixie Fire scar", kalimantan: "Ketapang" };
  var FALLBACK = { id: "rondonia", name: "Jaci-Paraná, Rondônia",
    patches: [543.34, 439.58, 117.38, 71.52, 43.98, 30.77, 29.24, 28.95, 25.96, 23.67, 14.26, 12.8].map(function (a, i) { return { area_ha: a, rank: i + 1 }; }) };
  FALLBACK.target_patch = FALLBACK.patches[4];

  /* ------------------------------------------------------------ shared helpers */
  function mySite() { var s = RQ.mySite && RQ.mySite(); return s && s.patches && s.patches.length ? s : FALLBACK; }
  function siteName(s) { return SHORT[s.id] || s.name || "your site"; }
  function tone(o) { if (RQ.save.setting("sound")) RQ.audio.tone(o); }
  function busy() { return !!document.querySelector(".rq-overlay, .rq-talk"); }
  function fmtHa(a) { return u.fmt(a, 2); }
  function md(el, text) { el.innerHTML = RQ.ui.md(text); }

  /** Side-panel layout: canvas area on the left, a chunky control panel on the right. */
  function layout(L) {
    var main = u.el("div", { class: "pp-main" }), side = u.el("div", { class: "pp-side panel" });
    L.stage.appendChild(u.el("div", { class: "fill pp-root" }, main, side));
    return { main: main, side: side };
  }
  function title(side, html) { var e = u.el("div", { class: "pp-h", html: html }); side.appendChild(e); return e; }
  function para(side, text, cls) { var e = u.el("div", { class: "pp-p " + (cls || ""), html: RQ.ui.md(text) }); side.appendChild(e); return e; }
  function stat(side, label) {
    var b = u.el("b", { text: "–" }), row = u.el("div", { class: "pp-stat" }, u.el("span", { html: label }), b);
    side.appendChild(row); b.row = row; return b;
  }
  function button(parent, html, cls, fn) {
    var b = u.el("button", { class: "btn " + (cls || ""), html: html });
    b.addEventListener("click", function () { if (!b.disabled) fn(); });
    parent.appendChild(b); return b;
  }

  /** Grid on a letterboxed canvas, with hover, tap and an arrow-key cursor (Enter / Space = tap). */
  function gridView(L, parent, cols, rows, o) {
    o = o || {};
    var cv = L.canvas({ w: o.w || 860, h: o.h || 560, parent: parent, label: o.label || "map grid" });
    var V = { cv: cv, ctx: cv.ctx, cols: cols, rows: rows, hover: null, cur: null }, pad = o.pad == null ? 14 : o.pad;
    V.cell = Math.max(2, Math.floor(Math.min((cv.w - 2 * pad) / cols, (cv.h - 2 * pad) / rows)));
    V.ox = Math.round((cv.w - V.cell * cols) / 2); V.oy = Math.round((cv.h - V.cell * rows) / 2);
    V.cx = function (x) { return V.ox + (x + .5) * V.cell; };
    V.cy = function (y) { return V.oy + (y + .5) * V.cell; };
    V.cellAt = function (pt) {
      var x = Math.floor((pt.x - V.ox) / V.cell), y = Math.floor((pt.y - V.oy) / V.cell);
      return x >= 0 && y >= 0 && x < cols && y < rows ? { x: x, y: y } : null;
    };
    L.on(cv.cv, "pointermove", function (e) { V.hover = V.cellAt(cv.toLocal(e)); });
    L.on(cv.cv, "pointerleave", function () { V.hover = null; });
    V.tap = function (fn) {
      L.on(cv.cv, "pointerdown", function (e) { if (busy()) return; var pt = cv.toLocal(e); V.cur = null; fn(V.cellAt(pt), pt); });
      L.on(window, "keydown", function (e) {
        var tag = (e.target && e.target.tagName) || "";
        if (busy() || /INPUT|TEXTAREA|SELECT/.test(tag)) return;
        var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (d) {
          e.preventDefault();
          if (!V.cur) V.cur = { x: cols >> 1, y: rows >> 1 };
          else { V.cur.x = u.clamp(V.cur.x + d[0], 0, cols - 1); V.cur.y = u.clamp(V.cur.y + d[1], 0, rows - 1); }
          V.hover = null; RQ.audio.sfx("tick");
          if (o.onCursor) o.onCursor(V.cur);
        } else if ((e.key === "Enter" || e.key === " ") && V.cur && tag !== "BUTTON") {
          e.preventDefault(); fn({ x: V.cur.x, y: V.cur.y }, { x: V.cx(V.cur.x), y: V.cy(V.cur.y) });
        }
      });
    };
    V.drawCursor = function (t) {
      var c = V.cur || V.hover; if (!c) return;
      var ctx = V.ctx; ctx.save();
      ctx.strokeStyle = V.cur ? "#ffd23f" : "#fff"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 24;
      ctx.strokeRect(V.ox + c.x * V.cell + 1.5, V.oy + c.y * V.cell + 1.5, V.cell - 3, V.cell - 3);
      ctx.restore();
    };
    V.board = function () {
      var ctx = V.ctx, w = V.cell * cols, hh = V.cell * rows;
      ctx.clearRect(0, 0, cv.w, cv.h);
      ctx.fillStyle = "rgba(29,43,58,.18)"; u.rr(ctx, V.ox - 6, V.oy + 2, w + 12, hh + 12, 14); ctx.fill();
      ctx.fillStyle = INK; u.rr(ctx, V.ox - 6, V.oy - 6, w + 12, hh + 12, 14); ctx.fill();
    };
    return V;
  }

  function pill(ctx, x, y, text, bg, fg, size) {
    size = size || 16;
    ctx.save(); ctx.font = "700 " + size + "px Fredoka, sans-serif";
    var w = ctx.measureText(text).width + 16, hh = size + 10;
    ctx.fillStyle = bg || "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    u.rr(ctx, x - w / 2, y - hh / 2, w, hh, hh / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = fg || INK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 1);
    ctx.restore();
  }
  function sparks() {
    var ps = [];
    return {
      burst: function (x, y, color, n, speed, grav) {
        for (var i = 0; i < (n || 10); i++) {
          var a = Math.random() * 6.283, s = (speed || 140) * (.35 + Math.random() * .8);
          ps.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: .8, c: color || "#ffd23f", g: grav == null ? 320 : grav, r: 2.5 + Math.random() * 3.5 });
        }
      },
      draw: function (ctx, dt) {
        ps = ps.filter(function (p) {
          p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.globalAlpha = Math.max(0, p.life / .8); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
          ctx.globalAlpha = 1; return p.life > 0;
        });
      }
    };
  }
  /** A Glitch Bug (false alarm!) drawn on the canvas. */
  function drawBug(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 12 + x) * 1.5); ctx.scale(s, s); ctx.rotate(Math.sin(t * 7 + y) * .25);
    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.lineCap = "round";
    for (var i = -1; i <= 1; i++) {
      var w = Math.sin(t * 22 + i * 2) * 2;
      ctx.beginPath(); ctx.moveTo(-7, i * 5); ctx.lineTo(-13, i * 7 + w); ctx.moveTo(7, i * 5); ctx.lineTo(13, i * 7 - w); ctx.stroke();
    }
    ctx.fillStyle = "#8a5cd0"; ctx.beginPath(); ctx.ellipse(0, 3, 9, 11, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 13); ctx.stroke();
    ctx.fillStyle = "#5b3a99"; ctx.beginPath(); ctx.arc(0, -9, 6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-2.5, -10, 2, 0, 7); ctx.arc(2.5, -10, 2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, -14); ctx.lineTo(-6, -21); ctx.moveTo(2, -14); ctx.lineTo(6, -21); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 10) > 0 ? "#ffd23f" : "#ff8fab"; ctx.beginPath(); ctx.arc(-6, -21, 2.6, 0, 7); ctx.arc(6, -21, 2.6, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawDrone(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); ctx.stroke();
    [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(function (p, i) {
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.ellipse(p[0], p[1], 7 * Math.abs(Math.cos(t * 30 + i)) + 2, 7, 0, 0, 7); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = "#7ed957"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------ grid algorithms (the real ones, in JS) */
  function parseArt(art) {
    var rows = art.length, cols = art[0].length, m = new Uint8Array(cols * rows);
    art.forEach(function (row, y) { for (var x = 0; x < cols; x++) m[y * cols + x] = row[x] === "#" ? 1 : 0; });
    return { cols: cols, rows: rows, m: m };
  }
  /** Breadth-first flood fill: returns the layers (rings) of cells reached, 4 neighbours like ndimage.label. */
  function floodLayers(cols, rows, inside, start) {
    var seen = new Uint8Array(cols * rows), layers = [], cur = [start];
    seen[start] = 1;
    while (cur.length) {
      layers.push(cur);
      var nxt = [];
      cur.forEach(function (i) {
        var x = i % cols, y = (i / cols) | 0;
        N4.forEach(function (d) {
          var nx = x + d[0], ny = y + d[1];
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
          var j = ny * cols + nx;
          if (!seen[j] && inside(j)) { seen[j] = 1; nxt.push(j); }
        });
      });
      cur = nxt;
    }
    return layers;
  }
  function countPatches(g, eight) {
    var seen = new Uint8Array(g.m.length), n = 0, dirs = eight ? N4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]) : N4;
    for (var i = 0; i < g.m.length; i++) {
      if (!g.m[i] || seen[i]) continue;
      n++; var st = [i]; seen[i] = 1;
      while (st.length) {
        var k = st.pop(), x = k % g.cols, y = (k / g.cols) | 0;
        dirs.forEach(function (d) {
          var nx = x + d[0], ny = y + d[1];
          if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) return;
          var j = ny * g.cols + nx;
          if (g.m[j] && !seen[j]) { seen[j] = 1; st.push(j); }
        });
      }
    }
    return n;
  }
  function centroid(cells, cols) {
    var sx = 0, sy = 0; cells.forEach(function (j) { sx += j % cols; sy += (j / cols) | 0; });
    sx /= cells.length; sy /= cells.length;
    var best = cells[0], bd = 1e9;   // anchor on a real cell of the patch, nearest to the centre
    cells.forEach(function (j) { var d = Math.pow(j % cols - sx, 2) + Math.pow(((j / cols) | 0) - sy, 2); if (d < bd) { bd = d; best = j; } });
    return { x: best % cols, y: (best / cols) | 0 };
  }

  /* ------------------------------------------------------------ L1: threshold → mask */
  var L1_MAPS = [
    { wob: [.13, .17], nWob: 5, edge: [.20, .23], core: [.24, .55], art: [
      "................",
      "..####......##..",
      "..####......##..",
      "..#####.....###.",
      "...####.........",
      "........###.....",
      "..##....####....",
      "..##....####....",
      "........###.....",
      "................"] },
    { wob: [.14, .18], nWob: 8, edge: [.20, .22], core: [.22, .48], art: [
      "................",
      ".....###........",
      "....######......",
      "...########.....",
      "...#########....",
      "....#######..##.",
      ".....#####..###.",
      "......###....#..",
      "................",
      "................"] }
  ];
  var DROP_STOPS = [[0, [52, 150, 72]], [0.1, [140, 198, 92]], [0.2, [232, 214, 104]], [0.3, [236, 160, 72]], [0.45, [192, 104, 56]], [0.6, [130, 70, 44]]];
  function dropRGB(v) {
    v = u.clamp(v, 0, 0.6);
    for (var i = 1; i < DROP_STOPS.length; i++) if (v <= DROP_STOPS[i][0]) {
      var a = DROP_STOPS[i - 1], b = DROP_STOPS[i], k = (v - a[0]) / (b[0] - a[0]);
      return "rgb(" + [0, 1, 2].map(function (c) { return Math.round(a[1][c] + (b[1][c] - a[1][c]) * k); }).join(",") + ")";
    }
    return "rgb(130,70,44)";
  }
  /** Made-up NDVI-drop map (hundredths): lost forest high, normal year-to-year wobble low. */
  function buildDrop(map, rng) {
    var g = parseArt(map.art), n = g.cols * g.rows, vi = new Int16Array(n), i;
    for (i = 0; i < n; i++) {
      var x = i % g.cols, y = (i / g.cols) | 0;
      if (g.m[i]) {
        var edge = N4.some(function (d) { var nx = x + d[0], ny = y + d[1]; return nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || !g.m[ny * g.cols + nx]; });
        vi[i] = Math.round(100 * (edge && rng() < .45 ? u.lerp(map.edge[0], map.edge[1], rng()) : u.lerp(map.core[0], map.core[1], rng())));
      } else vi[i] = Math.round(100 * rng() * .12);
    }
    var forest = []; for (i = 0; i < n; i++) if (!g.m[i]) forest.push(i);
    u.shuffle(forest, rng).slice(0, map.nWob).forEach(function (j) { vi[j] = Math.round(100 * u.lerp(map.wob[0], map.wob[1], rng())); });
    g.vi = vi; return g;
  }
  function realMask(S) {
    var f = S.files || {};
    if (!f.rgb || !f.classes) return Promise.resolve();
    var px = Math.round((S.size_m || 6400) / 10);
    var box = u.el("div", { class: "pp-real" }, u.el("img", { src: RQ.url(f.rgb), alt: "satellite picture" }), u.el("img", { class: "ov", src: RQ.url(f.classes), alt: "ReSeed's mask" }));
    return RQ.ui.modal({ icon: "🛰️", title: "The real mask: " + siteName(S),
      node: u.el("div", {}, box, u.el("p", { html: RQ.ui.md("**Red** = places ReSeed flagged as lost forest. Tan = stressed, green = healthy. On its 10 m grid, ReSeed checked " + px + " × " + px + " = **" + u.fmt(px * px) + "** pixels!") })),
      buttons: [{ label: "Cool! ▶", cls: "go" }], dismiss: false });
  }

  function levelThreshold(L) {
    var S = mySite(), lay = layout(L), fx = sparks();
    var V = gridView(L, lay.main, 16, 10, { label: "map of greenness drop", onCursor: function (c) { showCell(c); } });
    var round = 0, thr = 50, g = null, marks = [], perfect = 0, attempts = 0, checking = false, lastHover = "";
    title(lay.side, "🎚️ Threshold");
    var big = u.el("div", { class: "pp-big", text: "0.50" }); lay.side.appendChild(big);
    var slider = u.el("input", { type: "range", min: "0", max: "60", step: "1", value: "50", class: "pp-range", "aria-label": "Threshold" });
    lay.side.appendChild(slider);
    lay.side.appendChild(u.el("div", { class: "pp-scale" }, u.el("span", { text: "◀ more light up" }), u.el("span", { text: "fewer light up ▶" })));
    var hist = u.el("canvas", { class: "pp-hist", width: "480", height: "160", "aria-hidden": "true" }); lay.side.appendChild(hist);
    var litS = stat(lay.side, "💡 Lit squares");
    var info = para(lay.side, "Point at a square to read its **drop**.", "pp-info");
    var go = button(lay.side, "🖌️ Paint the mask!", "primary big", function () { check(); });
    para(lay.side, "Drop = how much greener the square used to be.", "pp-keys");

    function load(k) {
      g = buildDrop(L1_MAPS[k], L.rng); marks = []; checking = false; go.disabled = false;
      L.hud.set("round", "🗺️ Map " + (k + 1) + " / " + L1_MAPS.length);
      refresh();
    }
    function refresh() {
      var lit = 0; for (var i = 0; i < g.vi.length; i++) if (g.vi[i] >= thr) lit++;
      litS.textContent = lit + " of " + g.vi.length;
      drawHist();
    }
    function drawHist() {
      var c = hist.getContext("2d"), W = hist.width, H = hist.height, bins = [], max = 1, k;
      for (k = 0; k <= 60; k++) bins.push(0);
      for (k = 0; k < g.vi.length; k++) bins[Math.min(60, g.vi[k])]++;
      bins.forEach(function (b) { max = Math.max(max, b); });
      c.clearRect(0, 0, W, H);
      var bw = (W - 24) / 61, base = H - 34;
      bins.forEach(function (b, k2) {
        if (!b) return;
        var x = 12 + k2 * bw, hh = Math.max(6, (base - 12) * b / max);
        c.globalAlpha = k2 >= thr ? 1 : .35; c.fillStyle = dropRGB(k2 / 100); c.fillRect(x, base - hh, bw - 1, hh);
        c.strokeStyle = INK; c.lineWidth = 1.5; c.strokeRect(x, base - hh, bw - 1, hh);
      });
      c.globalAlpha = 1;
      var tx = 12 + thr * bw;
      c.fillStyle = "rgba(255,46,99,.12)"; c.fillRect(tx, 4, W - 12 - tx, base - 4);
      c.strokeStyle = "#d1495b"; c.lineWidth = 5; c.beginPath(); c.moveTo(tx, 4); c.lineTo(tx, base + 4); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(10, base); c.lineTo(W - 10, base); c.stroke();
      c.fillStyle = INK; c.font = "600 24px Fredoka, sans-serif"; c.textBaseline = "alphabetic";
      c.textAlign = "left"; c.fillText("0.00", 6, H - 6); c.textAlign = "right"; c.fillText("0.60", W - 6, H - 6);
      c.textAlign = "center"; c.fillText("squares per drop", W / 2, H - 6);
    }
    function showCell(c) {
      if (!c || !g) return;
      var key = c.x + "," + c.y + "," + thr; if (key === lastHover) return; lastHover = key;
      var v = g.vi[c.y * g.cols + c.x];
      md(info, "This square dropped **" + (v / 100).toFixed(2) + "** → " + (v >= thr ? "**lit** 🔆 (at or above " + (thr / 100).toFixed(2) + ")" : "dark (below " + (thr / 100).toFixed(2) + ")"));
    }
    L.on(slider, "input", function () {
      thr = +slider.value; big.textContent = (thr / 100).toFixed(2); marks = []; lastHover = "";
      RQ.audio.sfx("tick"); refresh();
    });
    V.tap(function (c) { showCell(c); });

    function check() {
      if (checking || !L.alive) return;
      attempts++; checking = true; go.disabled = true; marks = [];
      var caught = 0, missed = 0, falseA = 0, total = 0;
      for (var i = 0; i < g.vi.length; i++) {
        var lit = g.vi[i] >= thr;
        if (g.m[i]) { total++; if (lit) caught++; else { missed++; marks.push({ i: i, k: "miss" }); } }
        else if (lit) { falseA++; marks.push({ i: i, k: "bug" }); }
      }
      var pass = caught / total >= .9 && falseA <= 3;
      if (falseA) RQ.audio.sfx("giggle");
      if (pass) {
        var isPerfect = !missed && !falseA;
        if (isPerfect) perfect++;
        RQ.audio.sfx("good");
        for (i = 0; i < g.vi.length; i++) if (g.m[i] && g.vi[i] >= thr && Math.random() < .5) fx.burst(V.cx(i % g.cols), V.cy((i / g.cols) | 0), "#ffd23f", 3, 90);
        RQ.ui.toast((isPerfect ? "Perfect mask! " : "Mask painted! ") + "Caught " + caught + " of " + total + " lost squares" + (falseA ? ", " + falseA + " false alarm" + (falseA > 1 ? "s" : "") + "." : "."), "good", 2800);
        round++;
        L.timeout(function () {
          if (round < L1_MAPS.length) { load(round); L.say("pix", "Map two: land burned by a fire. Its edges are trickier!"); }
          else finale();
        }, 1800);
      } else {
        RQ.audio.sfx("bad");
        var p = falseA > 3
          ? L.say("bug", "Hee hee! So many **false alarms**: healthy forest, all lit up!").then(function () { if (L.alive) return L.say("pix", "Slide the threshold **up** a bit. Then fewer squares light up."); })
          : L.say("pix", "Some lost squares stayed dark. Slide the threshold **down** a bit.");
        p.then(function () { if (!L.alive) return; checking = false; go.disabled = false; if (attempts >= 3) L.say("pix", "💡 Look at the bar chart. Put the red line in the gap between the two hills."); });
      }
    }
    function finale() {
      L.hud.set("round", null);
      L.talk([["pix", "ReSeed looks for a **0.20** greenness drop from an earlier peak, in two recent growing seasons. That's a clue to forest loss."],
              ["pix", "It's called `DECLINE_ABS` in `config.py`. Want to see the real mask ReSeed painted?"]])
        .then(function () { if (L.alive) return realMask(S); })
        .then(function () {
          if (!L.alive) return;
          L.win({ stars: 1 + perfect, msg: "You painted a **deforestation mask** with a threshold, just like ReSeed.",
            stats: { "Perfect maps": perfect + " / " + L1_MAPS.length, "Tries": attempts } });
        });
    }

    load(0);
    L.timeout(function () { slider.focus(); }, 60);
    if (L.fails >= 1) L.say("pix", "💡 On this game map, lost forest has big drops and healthy forest only wiggles. Find the gap!");
    L.loop(function (dt, t) {
      var ctx = V.ctx, c = V.cell;
      V.board();
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "600 " + Math.round(c * .31) + "px Fredoka, sans-serif"; ctx.lineJoin = "round";
      for (var i = 0; i < g.vi.length; i++) {
        var x0 = V.ox + (i % g.cols) * c, y0 = V.oy + ((i / g.cols) | 0) * c, v = g.vi[i], lit = v >= thr;
        ctx.fillStyle = dropRGB(v / 100); ctx.fillRect(x0, y0, c - 1, c - 1);
        if (lit) {
          ctx.fillStyle = "rgba(255,46,99," + (.78 + .1 * Math.sin(t * 4 + i * .7)).toFixed(3) + ")"; ctx.fillRect(x0, y0, c - 1, c - 1);
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.strokeRect(x0 + 3, y0 + 3, c - 7, c - 7);
          ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText((v / 100).toFixed(2), x0 + c / 2, y0 + c / 2 + 1);
          ctx.fillStyle = "#fff";
        } else ctx.fillStyle = INK;
        ctx.fillText((v / 100).toFixed(2), x0 + c / 2, y0 + c / 2 + 1);
      }
      marks.forEach(function (m) {
        var cx = V.cx(m.i % g.cols), cy = V.cy((m.i / g.cols) | 0);
        if (m.k === "bug") drawBug(ctx, cx + Math.sin(t * 3 + m.i) * c * .12, cy + c * .12, c / 60, t);
        else {
          ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3;
          ctx.strokeRect(V.ox + (m.i % g.cols) * c + 2, V.oy + ((m.i / g.cols) | 0) * c + 2, c - 5, c - 5); ctx.restore();
          pill(ctx, cx + c * .32, cy - c * .32, "?", "#ffd23f", INK, Math.round(c * .28));
        }
      });
      if (V.hover) showCell(V.hover);
      V.drawCursor(t);
      fx.draw(ctx, dt);
    });
  }

  /* ------------------------------------------------------------ L2: flood fill */
  var L2_MAPS = [
    ["..................",
     "..###.............",
     ".#####.......##...",
     ".####.......####..",
     "..##.........###..",
     "..................",
     "........####......",
     ".......######.....",
     "........###.......",
     "..................",
     ".................."],
    ["..................",
     ".###.......##.....",
     ".###......###.....",
     "....##.....##.....",
     "....##..........#.",
     "..............###.",
     "..##.....#....##..",
     "..##....###.......",
     "....###..#........",
     "....###......####.",
     ".................."]
  ];
  var FILL_STEPS = ["🪣 Paint the square you tapped", "👀 Look up, down, left and right", "💧 Lit and not painted? Paint it too!", "🔁 Repeat until nobody is waiting"];

  function levelFlood(L) {
    var lay = layout(L), fx = sparks();
    var V = gridView(L, lay.main, 18, 11, { label: "mask map" });
    var round = 0, g, lab, wetT, patches, anim = null, wasted = 0, predicted = -1, cornerTold = false, corner = null, ready = false, T = 0;
    title(lay.side, "🪣 Flood fill");
    var steps = u.el("ol", { class: "pp-steps" });
    var stepEls = FILL_STEPS.map(function (s) { var li = u.el("li", { text: s }); steps.appendChild(li); return li; });
    lay.side.appendChild(steps);
    var sPatch = stat(lay.side, "🎨 Patches found"), sCells = stat(lay.side, "🟧 Squares painted"), sQueue = stat(lay.side, "⏳ Waiting in the queue");
    var info = para(lay.side, "Tap a **lit** square to pour the paint.", "pp-info");
    para(lay.side, "Keyboard: arrows move, Enter pours.", "pp-keys");
    function stepOn(k) { stepEls.forEach(function (e, i) { e.classList.toggle("on", i === k); }); }

    function load(k) {
      g = parseArt(L2_MAPS[k]);
      var n = g.cols * g.rows;
      lab = new Int16Array(n).fill(-1); wetT = new Float32Array(n).fill(-9); patches = []; anim = null; corner = null;
      g.c4 = countPatches(g, false); g.c8 = countPatches(g, true);
      g.total = 0; for (var i = 0; i < n; i++) g.total += g.m[i];
      sPatch.textContent = "0"; sCells.textContent = "0 / " + g.total; sQueue.textContent = "0"; stepOn(-1);
      L.hud.set("round", "🗺️ Map " + (k + 1) + " / " + L2_MAPS.length); L.hud.set("patches", "🎨 0");
      md(info, "Tap a **lit** square to pour the paint.");
      ready = true;
      if (k === 1) { ready = false; predict(); }
    }
    var predBox = u.el("div", { class: "pp-predict", hidden: true }); lay.side.insertBefore(predBox, info);
    var predOpts = null;
    function predict() {
      var opts = [g.c8, g.c4], mid = Math.round((g.c8 + g.c4) / 2);
      opts.push(opts.indexOf(mid) < 0 ? mid : g.c4 + 1);
      opts.sort(function (a, b) { return a - b; });
      predOpts = opts; predBox.innerHTML = ""; predBox.hidden = false; info.hidden = true;
      predBox.appendChild(u.el("div", { class: "pp-p", html: RQ.ui.md("🤔 **Predict first!** Count the lit blobs. How many patches will the bucket find?") }));
      var row = u.el("div", { class: "pp-choice" }); predBox.appendChild(row);
      opts.forEach(function (o, k) { button(row, "<b>" + o + "</b>", "warn", function () { answer(k); }); });
      RQ.audio.sfx("pop"); RQ.ui.toast("🤔 Predict first: how many patches?", "info", 2600);
    }
    function answer(k) {
      if (!predOpts || !L.alive) return;
      predicted = predOpts[k]; predOpts = null; ready = true; predBox.hidden = true; info.hidden = false;
      RQ.audio.sfx("select");
      RQ.ui.toast("You guessed **" + predicted + "**. Let's pour and see!", "info", 2200);
    }
    L.on(window, "keydown", function (e) { var k = parseInt(e.key, 10); if (predOpts && k >= 1 && k <= predOpts.length && !busy()) answer(k - 1); });
    V.tap(function (c) {
      if (!ready || !c || anim || !L.alive) return;
      var i = c.y * g.cols + c.x;
      if (!g.m[i]) {
        wasted++; RQ.audio.sfx("bad"); fx.burst(V.cx(c.x), V.cy(c.y), "#74c0fc", 8, 90);
        md(info, "Splash! That square is **not lit**, so the bucket has nothing to fill."); return;
      }
      if (lab[i] >= 0) { wasted++; RQ.audio.sfx("error"); md(info, "Already painted! Find a **lit** square that is still cream."); return; }
      var id = patches.length, P = { id: id, col: PAINT[id % PAINT.length], cells: [] };
      patches.push(P);
      anim = { P: P, layers: floodLayers(g.cols, g.rows, function (j) { return g.m[j] && lab[j] < 0; }, i), k: 0, acc: .1 };
      RQ.audio.sfx("splash"); md(info, "Pouring… watch the paint flow like water.");
    });
    function pourLayer() {
      var A = anim, layer = A.layers[A.k];
      layer.forEach(function (j) { lab[j] = A.P.id; wetT[j] = T; A.P.cells.push(j); });
      tone({ f: 300 + A.k * 38, f2: 380 + A.k * 38, type: "sine", d: .08, v: .1 });
      stepOn(A.k === 0 ? 0 : 2);
      A.k++;
      var next = A.layers[A.k], painted = 0;
      for (var j = 0; j < lab.length; j++) if (lab[j] >= 0) painted++;
      sQueue.textContent = next ? String(next.length) : "0";
      sCells.textContent = painted + " / " + g.total;
      if (!next) finishFill(painted);
      else L.timeout(function () { if (anim === A) stepOn(1); }, 25);
    }
    function findCorner(P) {
      for (var a = 0; a < P.cells.length; a++) {
        var j = P.cells[a], x = j % g.cols, y = (j / g.cols) | 0;
        for (var dx = -1; dx <= 1; dx += 2) for (var dy = -1; dy <= 1; dy += 2) {
          var nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
          var k = ny * g.cols + nx;
          if (g.m[k] && lab[k] !== P.id && !g.m[y * g.cols + nx] && !g.m[ny * g.cols + x]) return [j, k];
        }
      }
      return null;
    }
    function finishFill(painted) {
      var P = anim.P; anim = null; stepOn(3);
      P.anchor = centroid(P.cells, g.cols);
      RQ.audio.sfx("pop"); fx.burst(V.cx(P.anchor.x), V.cy(P.anchor.y), P.col, 18);
      sPatch.textContent = String(patches.length); L.hud.set("patches", "🎨 " + patches.length);
      md(info, "Patch **" + patches.length + "** painted: **" + P.cells.length + "** squares.");
      L.timeout(function () { stepOn(-1); }, 700);
      if (!cornerTold) {
        var cc = findCorner(P);
        if (cc) {
          cornerTold = true; corner = { a: cc[0], b: cc[1], t: T }; RQ.audio.sfx("giggle");
          L.say("pix", "Whoa, the paint stopped at a corner! Only up, down, left and right count as neighbours.");
        }
      }
      if (painted >= g.total) {
        ready = false;
        L.timeout(function () {
          if (round === 0) {
            round = 1; RQ.audio.sfx("good"); RQ.ui.toast("All " + patches.length + " patches found!", "good", 1800);
            L.timeout(function () { load(1); }, 1200);
          } else finish();
        }, 900);
      }
    }
    function finish() {
      var right = predicted === g.c4, total = patches.length;
      var p = right ? L.say("pix", "You predicted it! Blobs that only touch at a corner are separate patches.")
                    : L.say("pix", "Tricky, right? Blobs that only touch at a corner are separate patches.");
      p.then(function () {
        if (!L.alive) return;
        L.win({ stars: 1 + (right ? 1 : 0) + (wasted <= 1 ? 1 : 0), msg: "Your bucket found **" + total + "** patches with **flood fill**, like ReSeed's `ndimage.label`.",
          stats: { "Prediction": right ? "right ✓" : "missed", "Missed taps": wasted } });
      });
    }

    load(0);
    if (L.fails >= 1) L.say("pix", "💡 Tap any cream square. The paint does the rest!");
    L.loop(function (dt, t) {
      T = t;
      if (anim) { anim.acc += dt; var st = anim.layers.length > 10 ? .07 : .1; while (anim && anim.acc >= st) { anim.acc -= st; pourLayer(); } }
      var ctx = V.ctx, c = V.cell;
      V.board();
      for (var i = 0; i < g.m.length; i++) {
        var x0 = V.ox + (i % g.cols) * c, y0 = V.oy + ((i / g.cols) | 0) * c;
        if (!g.m[i]) {
          ctx.fillStyle = "#2f7d46"; ctx.fillRect(x0, y0, c - 1, c - 1);
          ctx.fillStyle = "#3f9a58"; ctx.beginPath(); ctx.arc(x0 + c * .5, y0 + c * .45, c * .28, 0, 7); ctx.fill();
        } else if (lab[i] < 0) {
          ctx.fillStyle = "#ffe9a8"; ctx.fillRect(x0, y0, c - 1, c - 1);
          ctx.strokeStyle = "rgba(255,255,255," + (.6 + .3 * Math.sin(t * 3 + i)).toFixed(2) + ")"; ctx.lineWidth = 2; ctx.strokeRect(x0 + 3, y0 + 3, c - 7, c - 7);
        } else {
          var P = patches[lab[i]], age = t - wetT[i];
          ctx.fillStyle = P.col; ctx.fillRect(x0, y0, c - 1, c - 1);
          if (age < .45) {
            ctx.fillStyle = "rgba(116,192,252," + (1 - age / .45).toFixed(2) + ")"; ctx.fillRect(x0, y0, c - 1, c - 1);
            ctx.strokeStyle = "rgba(255,255,255," + (1 - age / .45).toFixed(2) + ")"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x0 + c / 2, y0 + c / 2, c * (.1 + age), 0, 7); ctx.stroke();
          }
        }
      }
      patches.forEach(function (P) { if (P.anchor) pill(ctx, V.cx(P.anchor.x), V.cy(P.anchor.y), (P.id + 1) + ": " + P.cells.length, "#fff", P.col, Math.round(c * .36)); });
      if (corner && t - corner.t < 5) {
        var on = Math.sin(t * 10) > 0;
        [corner.a, corner.b].forEach(function (j) {
          ctx.strokeStyle = on ? "#d1495b" : "#fff"; ctx.lineWidth = 4;
          ctx.strokeRect(V.ox + (j % g.cols) * c + 1, V.oy + ((j / g.cols) | 0) * c + 1, c - 3, c - 3);
        });
        var ax = (V.cx(corner.a % g.cols) + V.cx(corner.b % g.cols)) / 2, ay = (V.cy((corner.a / g.cols) | 0) + V.cy((corner.b / g.cols) | 0)) / 2;
        pill(ctx, ax, ay, "✗", "#d1495b", "#fff", Math.round(c * .4));
      }
      V.drawCursor(t);
      fx.draw(ctx, dt);
    });
  }

  /* ------------------------------------------------------------ L3: pixels → hectares, sweep speckle */
  var SPECKLE_SIZES = [96, 64, 50, 49, 27, 12, 4, 1];
  /** Place compact blobs of exact pixel counts that never touch each other (not even at corners). */
  function growBlobs(cols, rows, sizes, rng) {
    for (var attempt = 0; attempt < 80; attempt++) {
      var own = new Int16Array(cols * rows).fill(-1), blobs = [], ok = true;
      for (var b = 0; b < sizes.length && ok; b++) {
        var placed = null;
        for (var tries = 0; tries < 50 && !placed; tries++) placed = growOne(own, cols, rows, sizes[b], b, rng);
        if (placed) blobs.push(placed); else ok = false;
      }
      if (ok) return { own: own, blobs: blobs };
    }
    return null;
  }
  function growOne(own, cols, rows, size, id, rng) {
    function free(x, y) {
      if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1) return false;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var o = own[(y + dy) * cols + x + dx]; if (o >= 0 && o !== id) return false; }
      return own[y * cols + x] < 0;
    }
    var sx = 1 + Math.floor(rng() * (cols - 2)), sy = 1 + Math.floor(rng() * (rows - 2));
    if (!free(sx, sy)) return null;
    var cells = [sy * cols + sx], set = {}; set[cells[0]] = 1;
    while (cells.length < size) {
      var best = -1, bs = 1e9;
      cells.forEach(function (j) {
        var x = j % cols, y = (j / cols) | 0;
        N4.forEach(function (d) {
          var nx = x + d[0], ny = y + d[1], k = ny * cols + nx;
          if (set[k] || !free(nx, ny)) return;
          var s = Math.hypot(nx - sx, (ny - sy) * 1.15) + rng() * 1.6;
          if (s < bs) { bs = s; best = k; }
        });
      });
      if (best < 0) return null;
      cells.push(best); set[best] = 1;
    }
    for (var i = 0; i < cells.length; i++) {          // commit only if still clear of others
      var x = cells[i] % cols, y = (cells[i] / cols) | 0;
      if (!free(x, y)) return null;
    }
    cells.forEach(function (j) { own[j] = id; });
    return { id: id, cells: cells };
  }

  function levelArea(L) {
    var lay = layout(L), COLS = 40, ROWS = 24, N = COLS * ROWS, fx = sparks();
    var V = gridView(L, lay.main, COLS, ROWS, { label: "pixel map" });
    var own = new Int16Array(N).fill(-1), blobs = [], wet = new Float32Array(N).fill(-9), anim = null, phase = "square", sel = null, mistakes = 0, T = 0, armsT = -1, hinted = false;
    title(lay.side, "📏 Pixels → hectares");
    var hag = u.el("div", { class: "pp-hagrid", "aria-hidden": "true" }); for (var q = 0; q < 100; q++) hag.appendChild(u.el("i"));
    lay.side.appendChild(u.el("div", { class: "pp-legend" }, hag, u.el("div", { html: RQ.ui.md("1 pixel = 10 m × 10 m = **0.01 ha**. 100 pixels = **1 hectare**.") })));
    var sCount = stat(lay.side, "🔢 Pixels counted"), sArea = stat(lay.side, "📐 Area");
    var info = para(lay.side, "Tap the big square with the **paint bucket** to count its pixels.", "pp-info");
    var choice = u.el("div", { class: "pp-choice", hidden: true }); lay.side.appendChild(choice);
    button(choice, "🌳 Keep", "go", function () { decide(false); });
    button(choice, "🧹 Sweep", "danger", function () { decide(true); });
    var keys = para(lay.side, "Keyboard: arrows + Enter to fill.", "pp-keys");

    function addBlob(cells) {
      var B = { id: blobs.length, cells: cells, state: "idle", count: 0, gone: 0 };
      cells.forEach(function (j) { own[j] = B.id; });
      B.anchor = centroid(cells, COLS); blobs.push(B); return B;
    }
    // Part A: exactly one hectare, 10 × 10 pixels
    var sq = []; for (var yy = 7; yy < 17; yy++) for (var xx = 15; xx < 25; xx++) sq.push(yy * COLS + xx);
    addBlob(sq).hectare = true;

    function nearestIdle(pt) {
      var best = null, bd = 1e9;
      blobs.forEach(function (B) {
        if (B.state !== "idle") return;
        B.cells.forEach(function (j) { var d = u.dist(pt.x, pt.y, V.cx(j % COLS), V.cy((j / COLS) | 0)); if (d < bd) { bd = d; best = { B: B, j: j }; } });
      });
      return bd <= V.cell * 2.3 ? best : null;
    }
    V.tap(function (c, pt) {
      if (!L.alive || anim || sel || phase === "wait") return;
      var hit = nearestIdle(pt);
      if (!hit) { RQ.audio.sfx("tick"); md(info, phase === "square" ? "Tap the big **lit** square." : "Tap a **lit** patch (a cream one) to measure it."); return; }
      var B = hit.B; B.state = "filling"; B.count = 0;
      anim = { B: B, layers: floodLayers(COLS, ROWS, function (j) { return own[j] === B.id; }, hit.j), k: 0, acc: .16 };
      RQ.audio.sfx("splash");
    });
    L.on(window, "keydown", function (e) {
      if (busy() || !L.alive) return;
      var k = e.key.toLowerCase();
      if (k === "k" && sel) decide(false);
      else if (k === "s" && sel) decide(true);
      else if (k === "n" && phase === "speckle") {
        var nxt = blobs.filter(function (B) { return B.state === "idle"; })[0];
        if (nxt) { V.cur = { x: nxt.anchor.x, y: nxt.anchor.y }; RQ.audio.sfx("tick"); }
      }
    });
    function countLayer() {
      var A = anim, layer = A.layers[A.k];
      layer.forEach(function (j) { wet[j] = T; A.B.count++; });
      tone({ f: 500 + A.k * 30, type: "triangle", d: .05, v: .07 });
      sCount.textContent = String(A.B.count); sArea.textContent = phase === "square" ? "? ha" : fmtHa(A.B.count * PIXEL_HA) + " ha";
      A.k++;
      if (A.k >= A.layers.length) { var B = A.B; anim = null; B.state = "measured"; measured(B); }
    }
    function measured(B) {
      RQ.audio.sfx("pop"); fx.burst(V.cx(B.anchor.x), V.cy(B.anchor.y), "#ffd23f", 14);
      if (phase === "square") {
        phase = "wait";
        md(info, "Counted: **" + B.count + " pixels**. Each pixel is **0.01 ha**.");
        L.choose("pix", "100 pixels, and each one is 0.01 hectares. How many hectares is that?", ["0.1 ha", "1 ha", "10 ha"]).then(function ask(i) {
          if (!L.alive) return;
          if (i !== 1) {
            mistakes++; RQ.audio.sfx("bad");
            return L.choose("pix", "Not quite! Think of 100 pennies: how many dollars is that?", ["0.1 ha", "1 ha", "10 ha"]).then(ask);
          }
          RQ.audio.sfx("good"); armsT = T; B.state = "kept";
          sArea.textContent = "1.00 ha";
          return L.say("pix", "Yes! One **hectare** is 100 m by 100 m, a bit bigger than a soccer field.").then(function () {
            if (!L.alive) return;
            return L.say("pix", "Now sweep the speckle! ReSeed skips patches smaller than **0.5 ha**, even though some may be real.");
          }).then(function () { if (L.alive) startSpeckle(); });
        });
      } else {
        sel = B; choice.hidden = false;
        md(info, "This patch: **" + B.count + " pixels = " + fmtHa(B.count * PIXEL_HA) + " ha**. Keep it, or sweep it?");
      }
    }
    function startSpeckle() {
      own.fill(-1); blobs = []; wet.fill(-9); armsT = -1;
      var res = growBlobs(COLS, ROWS, SPECKLE_SIZES, L.rng) || growBlobs(COLS, ROWS, SPECKLE_SIZES, u.seeded("pp-speckle"));
      res.blobs.forEach(function (b) { addBlob(b.cells); });
      phase = "speckle"; sCount.textContent = "–"; sArea.textContent = "–";
      sCount.row.querySelector("span").innerHTML = "🔢 Pixels in patch";
      md(info, "Tap a cream patch to measure it. Keep **50 pixels or more** (0.5 hectares); sweep smaller patches.");
      md(keys, "Keyboard: **N** next patch · **Enter** fill · **K** keep · **S** sweep.");
      L.hud.set("left", "🧹 " + blobs.length + " to check");
    }
    function decide(sweepIt) {
      if (!sel || !L.alive) return;
      var B = sel, small = B.count < MIN_PX, ha = fmtHa(B.count * PIXEL_HA);
      sel = null; choice.hidden = true;
      if (sweepIt === small) {
        RQ.audio.sfx(small ? "whoosh" : "good");
        md(info, small ? "Swept! **" + ha + " ha** is smaller than 0.5 ha, so ReSeed skips it." : "Kept! **" + ha + " ha** is big enough for ReSeed's map.");
      } else {
        mistakes++; RQ.audio.sfx("bad"); RQ.audio.sfx("giggle");
        md(info, small ? "Oops: **" + ha + " ha** is smaller than 0.5 ha, so ReSeed skips it. Swept!" : "Oops: **" + ha + " ha** is not smaller than 0.5 ha. ReSeed keeps it!");
        if (!hinted) { hinted = true; L.say("pix", "💡 50 pixels make 0.5 ha. Fewer than 50 pixels means sweep it!"); }
      }
      if (small) {
        B.state = "swept"; B.gone = T;
        B.cells.forEach(function (j) { if (Math.random() < .6) fx.burst(V.cx(j % COLS), V.cy((j / COLS) | 0), "#c8a165", 3, 160, -40); });
      } else B.state = "kept";
      var left = blobs.filter(function (b) { return b.state === "idle"; }).length;
      L.hud.set("left", "🧹 " + left + " to check");
      if (!left) {
        phase = "wait";
        var kept = blobs.filter(function (b) { return b.state === "kept"; }).length, swept = blobs.length - kept;
        L.timeout(function () {
          L.say("pix", "Speckle swept! Only patches of half a hectare or more stay on ReSeed's map.").then(function () {
            if (!L.alive) return;
            L.win({ stars: mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1, msg: "You measured every patch in **hectares** and swept **" + swept + "** specks too small for ReSeed's map.",
              stats: { "Kept": kept + " patches", "Mistakes": mistakes } });
          });
        }, 700);
      }
    }

    if (L.fails >= 1) L.say("pix", "💡 Each pixel is 0.01 ha. So 50 pixels make 0.5 ha.");
    L.loop(function (dt, t) {
      T = t;
      if (anim) { anim.acc += dt; var st = phase === "square" ? .16 : .07; while (anim && anim.acc >= st) { anim.acc -= st; countLayer(); } }
      var ctx = V.ctx, c = V.cell;
      V.board();
      ctx.fillStyle = "#2f7d46"; ctx.fillRect(V.ox, V.oy, c * COLS - 1, c * ROWS - 1);
      ctx.fillStyle = "#357f4b";
      for (var i = 0; i < N; i++) if (((i % COLS) + ((i / COLS) | 0)) % 2) ctx.fillRect(V.ox + (i % COLS) * c, V.oy + ((i / COLS) | 0) * c, c, c);
      blobs.forEach(function (B) {
        var alpha = B.state === "swept" ? Math.max(0, 1 - (t - B.gone) / .6) : 1;
        if (alpha <= 0) return;
        ctx.globalAlpha = alpha;
        B.cells.forEach(function (j) {
          var x0 = V.ox + (j % COLS) * c, y0 = V.oy + ((j / COLS) | 0) * c, age = t - wet[j];
          ctx.fillStyle = B.state === "idle" ? "#ffe9a8" : B.state === "kept" ? "#ff8a2a" : "#ffb36b";
          ctx.fillRect(x0, y0, c - 1, c - 1);
          if (age < .4) { ctx.fillStyle = "rgba(116,192,252," + (1 - age / .4).toFixed(2) + ")"; ctx.fillRect(x0, y0, c - 1, c - 1); }
        });
        ctx.globalAlpha = 1;
        if (B === sel) {
          ctx.save(); ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 20;
          var xs = B.cells.map(function (j) { return j % COLS; }), ys = B.cells.map(function (j) { return (j / COLS) | 0; });
          ctx.strokeRect(V.ox + Math.min.apply(null, xs) * c - 4, V.oy + Math.min.apply(null, ys) * c - 4, (Math.max.apply(null, xs) - Math.min.apply(null, xs) + 1) * c + 7, (Math.max.apply(null, ys) - Math.min.apply(null, ys) + 1) * c + 7);
          ctx.restore();
        }
        if ((B.state === "measured" || B.state === "kept" || B.state === "filling") && !(B.hectare && armsT >= 0))
          pill(ctx, V.cx(B.anchor.x), V.cy(B.anchor.y), B.count + " px" + (B.state === "kept" && !B.hectare ? " ✓" : ""), B === sel ? "#fff6c2" : "#fff", INK, 15);
        if (B.state === "swept" && alpha > 0) pill(ctx, V.cx(B.anchor.x), V.cy(B.anchor.y) - (t - B.gone) * 40, "🧹", "#fff", INK, 15);
      });
      if (armsT >= 0) {                                 // 100 m dimension arrows around the hectare
        var k = Math.min(1, (t - armsT) / .5), x1 = V.ox + 15 * c, y1 = V.oy + 7 * c, w = 10 * c * k;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x1, y1 - 12); ctx.lineTo(x1 + w, y1 - 12); ctx.moveTo(x1 - 12, y1); ctx.lineTo(x1 - 12, y1 + w); ctx.stroke();
        if (k >= 1) { pill(ctx, x1 + 5 * c, y1 - 12, "100 m", "#fff", INK, 15); pill(ctx, x1 - 12, y1 + 5 * c, "100 m", "#fff", INK, 15); pill(ctx, x1 + 5 * c, y1 + 5 * c, "1 hectare", "#ffd23f", INK, 18); }
      }
      V.drawCursor(t);
      fx.draw(ctx, dt);
    });
  }

  /* ------------------------------------------------------------ cards for L4 / L5 */
  function blobSVG(seed, r) {
    var rng = u.seeded("pp-blob-" + seed), pts = [], n = 9, i;
    for (i = 0; i < n; i++) { var a = i / n * 6.283, rr = r * (.74 + rng() * .42); pts.push([50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]); }
    function mid(p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }
    var m0 = mid(pts[n - 1], pts[0]), d = "M" + m0[0].toFixed(1) + " " + m0[1].toFixed(1);
    for (i = 0; i < n; i++) { var p = pts[i], m = mid(p, pts[(i + 1) % n]); d += " Q" + p[0].toFixed(1) + " " + p[1].toFixed(1) + " " + m[0].toFixed(1) + " " + m[1].toFixed(1); }
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + d + 'Z" fill="#e8a05a" stroke="#1d2b3a" stroke-width="3"/></svg>';
  }
  function makeCard(p, maxA) {
    var el = u.el("div", { class: "pp-card", role: "button", tabindex: "0", "aria-label": fmtHa(p.area_ha) + " hectares" });
    el.innerHTML = '<div class="rk"></div>' + blobSVG(p.rank || p.area_ha, 14 + 32 * Math.sqrt(p.area_ha / maxA)) +
      '<div class="ha">' + fmtHa(p.area_ha) + "</div><small>hectares</small>";
    return el;
  }

  /* ------------------------------------------------------------ L4: bubble-sort race (real patch sizes) */
  function levelSort(L) {
    var S = mySite(), list = S.patches.slice(0, 7).map(function (p) { return { a: p.area_ha, rank: p.rank }; });
    var maxA = Math.max.apply(null, list.map(function (p) { return p.a; })), n = list.length;
    var arr;
    do { arr = u.shuffle(list, L.rng); } while (n > 2 && inversions(arr) < Math.min(8, n * (n - 1) / 4));
    var start = arr.map(function (p) { return p.a; });
    var root = u.el("div", { class: "fill pp-sort" }); L.stage.appendChild(root);
    var say = u.el("div", { class: "pp-say" }); root.appendChild(say);
    var row = u.el("div", { class: "pp-row" }); root.appendChild(row);
    var vs = u.el("div", { class: "pp-vs", text: "VS" }); row.appendChild(vs);
    var ctr = u.el("div", { class: "pp-ctr" }); root.appendChild(ctr);
    button(ctr, "◀ Left is bigger", "big", function () { pick(0); });
    button(ctr, "Right is bigger ▶", "big", function () { pick(1); });
    var chips = u.el("div", { class: "pp-chips" }); root.appendChild(chips);
    var cComp = u.el("span", { class: "chip" }), cSwap = u.el("span", { class: "chip" }), cOops = u.el("span", { class: "chip" });
    chips.appendChild(cComp); chips.appendChild(cSwap); chips.appendChild(cOops);
    var comp = u.el("div", { class: "pp-comp panel", style: { display: "none" } }); root.appendChild(comp);
    var i = 0, end = n - 1, swappedPass = false, comps = 0, swaps = 0, oops = 0, done = false, lock = false, t0 = 0, secs = 0, hinted = false, passes = 1;

    function inversions(a) { var c = 0; for (var x = 0; x < a.length; x++) for (var y = x + 1; y < a.length; y++) if (a[x].a < a[y].a) c++; return c; }
    arr.forEach(function (it) { it.el = makeCard({ area_ha: it.a, rank: it.rank }, maxA); row.appendChild(it.el); bindDrag(it); });
    function place() {
      var W = row.getBoundingClientRect().width || 900, gap = 14, cw = Math.min(130, (W - gap * (n - 1)) / n), x0 = (W - (cw * n + gap * (n - 1))) / 2;
      arr.forEach(function (it, k) {
        it.el.style.width = cw + "px"; it.el.style.left = (x0 + k * (cw + gap)) + "px";
        it.el.classList.toggle("cmp", !done && (k === i || k === i + 1));
        it.el.classList.toggle("sorted", !!it.sorted);
      });
      vs.style.display = done ? "none" : "";
      vs.style.left = (x0 + (i + 1) * (cw + gap) - gap / 2) + "px";
      cComp.textContent = "🔍 Comparisons: " + comps; cSwap.textContent = "⇄ Swaps: " + swaps; cOops.textContent = "🐞 Oops: " + oops;
      if (!done) md(say, "Pass **" + passes + "**: which card is **bigger**? Tap it or drag it. Bigger goes **left**.");
    }
    function bindDrag(it) {
      var sx = 0, drag = false, moved = 0;
      L.on(it.el, "pointerdown", function (e) {
        var k = arr.indexOf(it);
        if (done || lock || (k !== i && k !== i + 1)) return;
        drag = true; sx = e.clientX; moved = 0;
        if (it.el.setPointerCapture) try { it.el.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
        it.el.style.transition = "none"; it.el.style.zIndex = "5";
      });
      L.on(it.el, "pointermove", function (e) {
        if (!drag) return; moved = e.clientX - sx;
        it.el.style.transform = "translateX(" + moved + "px) rotate(" + (moved / 30).toFixed(1) + "deg)";
      });
      function up() {
        if (!drag) return; drag = false;
        it.el.style.transition = ""; it.el.style.transform = ""; it.el.style.zIndex = "";
        var k = arr.indexOf(it), cw = it.el.offsetWidth;
        if (Math.abs(moved) < 10) pick(k === i ? 0 : 1);                    // tap = "this one is bigger"
        else if ((k === i + 1 && moved < -cw * .4) || (k === i && moved > cw * .4)) pick(1);   // dragged past = swap
      }
      L.on(it.el, "pointerup", up); L.on(it.el, "pointercancel", function () { moved = 0; up(); });
      L.on(it.el, "keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); var k = arr.indexOf(it); if (k === i || k === i + 1) pick(k === i ? 0 : 1); } });
    }
    L.on(window, "keydown", function (e) {
      if (busy() || done) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); pick(0); } else if (e.key === "ArrowRight") { e.preventDefault(); pick(1); }
    });
    function pick(side) {
      if (done || lock || !L.alive) return;
      if (!t0) t0 = performance.now();
      var A = arr[i], B = arr[i + 1], bigger = A.a >= B.a ? 0 : 1;
      if (side !== bigger) {
        oops++; RQ.audio.sfx("giggle");
        [A.el, B.el].forEach(function (e) { e.classList.remove("shake"); void e.offsetWidth; e.classList.add("shake"); });
        RQ.ui.toast("Look again: **" + fmtHa(Math.max(A.a, B.a)) + "** is bigger than **" + fmtHa(Math.min(A.a, B.a)) + "**.", "bad", 2200);
        if (oops >= 2 && !hinted) { hinted = true; L.say("pix", "💡 Read the numbers. The **bigger** number must sit on the **left**."); }
        place(); return;
      }
      comps++;
      if (bigger === 1) {
        arr[i] = B; arr[i + 1] = A; swaps++; swappedPass = true; RQ.audio.sfx("whoosh");
        [A.el, B.el].forEach(function (e) { e.classList.remove("hop"); void e.offsetWidth; e.classList.add("hop"); });
      } else RQ.audio.sfx("pop");
      i++;
      if (i >= end) {                     // end of a pass: the smallest so far has bubbled to the right
        arr[end].sorted = true; RQ.audio.sfx("coin"); end--; i = 0; passes++;
        if (!swappedPass || end <= 0) {
          lock = true; place();
          if (!swappedPass && end > 0) RQ.ui.toast("No swaps in a whole pass? Then it's **sorted**!", "good", 2400);
          return L.timeout(finishSort, 500);
        }
        swappedPass = false;
      }
      lock = true; L.timeout(function () { lock = false; }, 260);
      place();
    }
    function finishSort() {
      done = true; secs = Math.round((performance.now() - t0) / 1000); root.classList.add("compact");
      arr.forEach(function (it, k) { it.sorted = true; L.timeout(function () { var r = it.el.querySelector(".rk"); r.textContent = "#" + (k + 1); r.classList.add("show"); RQ.audio.sfx("coin"); }, 160 * k); });
      ctr.style.display = "none"; place();
      md(say, "Sorted, biggest first! **Rank 1** is the biggest patch of " + siteName(S) + ".");
      L.timeout(function () {
        L.say("pix", "Sorted, just like ReSeed's list: rank **1** is the biggest. Now race the computer!").then(function () { if (L.alive) showComputer(); });
      }, 160 * n + 300);
    }
    function showComputer() {
      comp.style.display = ""; comp.innerHTML = "";
      var res = u.el("span", { class: "grow", text: "ready…" });
      comp.appendChild(u.el("div", { class: "pp-lane" }, u.el("b", { text: "🧒 You" }), u.el("span", { class: "grow", text: secs + " s · " + comps + " comparisons · " + swaps + " swaps" })));
      var go = u.el("button", { class: "btn primary", html: "⚡ Computer, sort!" });
      comp.appendChild(u.el("div", { class: "pp-lane" }, u.el("b", { text: "💻 Computer" }), res, go));
      var fin = u.el("button", { class: "btn go", html: "Finish ▶", style: { display: "none", alignSelf: "center" } });
      comp.appendChild(RQ.code.block('# reseed/polygonize.py: biggest first, then rank 1, 2, 3…\nfeatures.sort(key=lambda f: -f["properties"]["area_ha"])'));
      comp.appendChild(fin);
      go.addEventListener("click", function () {
        if (!L.alive || go.disabled) return;
        go.disabled = true;
        var mine = start.slice(), a = performance.now(); mine.sort(function (x, y) { return y - x; }); var b = performance.now();
        var many = new Float64Array(100000); for (var k = 0; k < many.length; k++) many[k] = Math.random() * 600;
        var c = performance.now(); many.sort(); var d = performance.now();
        md(res, "your " + n + " cards: **" + (b - a < 1 ? "under 1 ms" : (b - a).toFixed(1) + " ms") + "** · 100,000 patches: **" + Math.max(1, Math.round(d - c)) + " ms**");
        comp.classList.remove("pp-flash"); void comp.offsetWidth; comp.classList.add("pp-flash"); RQ.audio.sfx("zap");
        L.say("pix", "Python's `sort()` is called **Timsort**. For short lists like ours, it uses **insertion sort**: tuck each card into its spot!").then(function () {
          if (!L.alive) return; fin.style.display = ""; fin.focus();
        });
      });
      fin.addEventListener("click", function () {
        if (!L.alive) return;
        L.win({ stars: oops === 0 ? 3 : oops <= 2 ? 2 : 1, msg: "You bubble-sorted the **real** patches of " + siteName(S) + ", biggest first.",
          stats: { "Comparisons": comps, "Swaps": swaps, "Oops": oops, "Your time": secs + " s" } });
      });
      go.focus();
    }
    place();
    L.on(window, "resize", place);
    L.timeout(place, 50);
    if (L.fails >= 1) L.say("pix", "💡 Only two cards at a time. Bigger one on the left!");
  }

  /* ------------------------------------------------------------ L5: pick the mission target, split the giant */
  function growGiant(n, rng) {
    var R = Math.ceil(Math.sqrt(n / Math.PI) * 1.9) + 3, cols = 2 * R, rows = 2 * R, m = new Uint8Array(cols * rows), cx = R, cy = R;
    var a1 = rng() * 6.28, a2 = rng() * 6.28, a3 = rng() * 6.28;
    function rad(x, y) { var th = Math.atan2(y - cy, x - cx); return 1 + .3 * Math.sin(2 * th + a1) + .2 * Math.sin(3 * th + a2) + .1 * Math.sin(5 * th + a3); }
    var fl = [], fs = new Float32Array(cols * rows), inF = new Uint8Array(cols * rows), count = 0;
    function add(i) {
      m[i] = 1; count++;
      var x = i % cols, y = (i / cols) | 0;
      N4.forEach(function (d) {
        var nx = x + d[0], ny = y + d[1];
        if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1) return;
        var j = ny * cols + nx;
        if (!m[j] && !inF[j]) { inF[j] = 1; fs[j] = Math.hypot(nx - cx, ny - cy) / rad(nx, ny) + rng() * 1.6; fl.push(j); }
      });
    }
    add(cy * cols + cx);
    while (count < n && fl.length) {
      var bi = 0; for (var k = 1; k < fl.length; k++) if (fs[fl[k]] < fs[fl[bi]]) bi = k;
      var j = fl[bi]; fl[bi] = fl[fl.length - 1]; fl.pop(); add(j);
    }
    var x0 = cols, y0 = rows, x1 = 0, y1 = 0, i;
    for (i = 0; i < m.length; i++) if (m[i]) { var x = i % cols, y = (i / cols) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    var M = 2, C = x1 - x0 + 1 + 2 * M, Rw = y1 - y0 + 1 + 2 * M, out = new Uint8Array(C * Rw);
    for (i = 0; i < m.length; i++) if (m[i]) out[(((i / cols) | 0) - y0 + M) * C + (i % cols) - x0 + M] = 1;
    return { cols: C, rows: Rw, m: out, x0: M, y0: M, x1: C - M, y1: Rw - M, n: count };
  }

  function levelSplit(L) {
    var S = mySite(), sorted = S.patches.slice().sort(function (a, b) { return b.area_ha - a.area_ha; });
    var fits = sorted.filter(function (p) { return p.area_ha >= 2 && p.area_ha <= MISSION_MAX_HA; });
    var target = fits[0] || S.target_patch || sorted[sorted.length - 1], maxA = sorted[0].area_ha, firstTry = true, picked = false;
    var root = u.el("div", { class: "fill pp-sort" }); L.stage.appendChild(root);
    root.appendChild(u.el("div", { class: "pp-rule panel", html: RQ.ui.md("🚁 ReSeed's first mission: the **biggest patch from 2 to " + MISSION_MAX_HA + " ha**. Tap it in " + siteName(S) + "!") }));
    var grid = u.el("div", { class: "pp-grid" }); root.appendChild(grid);
    L.hud.set("part", "Part 1 / 2");
    sorted.slice(0, 12).forEach(function (p) {
      var el = makeCard(p, maxA); grid.appendChild(el);
      el.querySelector(".rk").textContent = "#" + (p.rank || sorted.indexOf(p) + 1); el.querySelector(".rk").classList.add("show");
      function choose() {
        if (picked || !L.alive || busy()) return;
        if (p === target) {
          picked = true; el.classList.add("win"); RQ.audio.sfx("good"); RQ.ui.confetti(60);
          L.say("koa", "Bonzer, that's our first mission patch! The real ReSeed run picked the same one in `pipeline.py`.").then(function () { if (L.alive) partB(); });
          return;
        }
        firstTry = false; RQ.audio.sfx("bad"); el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
        if (p.area_ha > MISSION_MAX_HA) { el.classList.add("bigx"); RQ.ui.toast("**" + fmtHa(p.area_ha) + " ha** is over ReSeed's " + MISSION_MAX_HA + " ha mission limit!", "bad", 2400); }
        else if (p.area_ha < 2) RQ.ui.toast("**" + fmtHa(p.area_ha) + " ha** is under 2 ha: too small for the first mission.", "bad", 2400);
        else RQ.ui.toast("**" + fmtHa(p.area_ha) + " ha** fits, but a **bigger** patch fits too!", "bad", 2400);
      }
      L.on(el, "click", choose);
      L.on(el, "keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
    });
    if (L.fails >= 1) L.say("pix", "💡 Skip every card over 50 ha. The first one left is the winner!");

    function partB() {
      L.hud.set("part", "Part 2 / 2");
      var gS = sorted[0].area_ha > MISSION_MAX_HA ? S : (RQ.site("rondonia") || FALLBACK);
      var giant = gS.patches.slice().sort(function (a, b) { return b.area_ha - a.area_ha; })[0];
      var CELL_M = 50, CELL_HA = CELL_M * CELL_M / 1e4, G = growGiant(Math.round(giant.area_ha / CELL_HA), u.seeded("pp-giant-" + gS.id));
      L.stage.innerHTML = "";
      var lay = layout(L), fx = sparks();
      var V = gridView(L, lay.main, G.cols, G.rows, { label: "giant patch", pad: 20 });
      var side = 1000, squares = [], launched = null, T = 0, stars;
      title(lay.side, "✂️ Split the giant");
      para(lay.side, "Patch #1 of " + siteName(gS) + ": **" + fmtHa(giant.area_ha) + " ha**. ReSeed's limit: **" + MISSION_MAX_HA + " ha** per mission.");
      var big = u.el("div", { class: "pp-big" }); lay.side.appendChild(big);
      var slider = u.el("input", { type: "range", min: "300", max: "1000", step: "50", value: "1000", class: "pp-range blue", "aria-label": "Square side in metres" });
      lay.side.appendChild(slider);
      lay.side.appendChild(u.el("div", { class: "pp-scale" }, u.el("span", { text: "◀ small squares" }), u.el("span", { text: "big squares ▶" })));
      var sOk = stat(lay.side, "🚁 Drone missions"), sBig = stat(lay.side, "🟥 Too big (over 50 ha)"), sCrumb = stat(lay.side, "🧹 Crumbs under 0.5 ha");
      var info = para(lay.side, "Find the **biggest** square with **no red**. Bigger squares = fewer missions!", "pp-info");
      var go = button(lay.side, "🚁 Launch the drones!", "primary big", function () { launch(); });
      if (gS !== S) L.say("pix", "Your site has no giant patch. Let's help the team in Rondônia with theirs!");
      if (L.fails >= 1) L.say("pix", "💡 A 700 m square is 49 hectares. Try it!");

      function compute() {
        var s = side / CELL_M, ok = 0, bad = 0, crumbs = 0;
        squares = [];
        for (var y = G.y0; y < G.y1; y += s) for (var x = G.x0; x < G.x1; x += s) {
          var cnt = 0;
          for (var yy = y; yy < Math.min(y + s, G.rows); yy++) for (var xx = x; xx < Math.min(x + s, G.cols); xx++) cnt += G.m[yy * G.cols + xx];
          if (!cnt) continue;
          var ha = cnt * CELL_HA, kind = ha > MISSION_MAX_HA ? "big" : ha < MIN_PATCH_HA ? "crumb" : "ok";
          squares.push({ x: x, y: y, s: s, ha: ha, kind: kind });
          if (kind === "ok") ok++; else if (kind === "big") bad++; else crumbs++;
        }
        big.innerHTML = side + " m<small>" + side + " m × " + side + " m = " + u.fmt(side * side / 1e4, 2) + " ha</small>";
        sOk.textContent = String(ok); sBig.textContent = String(bad); sCrumb.textContent = String(crumbs);
        sBig.row.classList.toggle("bad", bad > 0); sOk.row.classList.toggle("good", bad === 0);
        go.disabled = bad > 0 || !!launched;
        md(info, bad ? "**" + bad + "** square" + (bad > 1 ? "s are" : " is") + " over the 50 ha limit. Make the squares smaller!" : "No red! **" + ok + "** missions. Can the squares be bigger and still fit?");
      }
      L.on(slider, "input", function () { side = +slider.value; RQ.audio.sfx("tick"); compute(); });
      compute();
      L.timeout(function () { slider.focus(); }, 60);

      function launch() {
        if (launched || !L.alive) return;
        slider.disabled = true; go.disabled = true;
        var home = { x: V.ox - 10, y: V.oy + G.rows * V.cell + 4 }, list = squares.filter(function (q) { return q.kind === "ok"; });
        launched = list.map(function (q, k) {
          var cx = V.ox + (q.x + Math.min(q.s, G.cols - q.x) / 2) * V.cell, cy = V.oy + (q.y + Math.min(q.s, G.rows - q.y) / 2) * V.cell;
          return { q: q, k: k, t0: T + .12 * k, x0: home.x, y0: home.y, x1: cx, y1: cy, arrived: false };
        });
        squares.forEach(function (q) { if (q.kind === "crumb") { var px = V.ox + (q.x + q.s / 2) * V.cell, py = V.oy + (q.y + q.s / 2) * V.cell; fx.burst(px, py, "#c8a165", 8, 120, -30); } });
        RQ.audio.sfx("whoosh");
        stars = 1 + (firstTry ? 1 : 0) + (side === 700 ? 1 : 0);
        var total = list.length;
        L.timeout(function () {
          L.say("pix", "ReSeed does this in `split_patch`: squares about **707 m** wide. A 707 m square is about 50 hectares.").then(function () {
            if (!L.alive) return;
            L.win({ stars: stars, msg: "The giant became **" + total + "** drone missions, and your first mission patch is **" + fmtHa(target.area_ha) + " ha**.",
              stats: { "Square side": side + " m", "Missions": total, "First pick": firstTry ? "right ✓" : "retry" } });
          });
        }, 1200 + 120 * total);
      }

      var PIECE = ["#ffb36b", "#ffd166", "#ff9f6b", "#f6c28b"];
      L.loop(function (dt, t) {
        T = t;
        var ctx = V.ctx, c = V.cell, i, s = side / CELL_M, look = {};
        squares.forEach(function (q) { look[q.x + "," + q.y] = q; });
        V.board();
        ctx.fillStyle = "#2f7d46"; ctx.fillRect(V.ox, V.oy, c * G.cols, c * G.rows);
        var pulse = (.75 + .25 * Math.sin(t * 6)).toFixed(2);
        for (i = 0; i < G.m.length; i++) {
          if (!G.m[i]) continue;
          var x = i % G.cols, y = (i / G.cols) | 0, qx = G.x0 + Math.floor((x - G.x0) / s) * s, qy = G.y0 + Math.floor((y - G.y0) / s) * s;
          var q = look[qx + "," + qy], done = q && q.done;
          ctx.fillStyle = !q ? "#e8a05a" : done ? "#7ed957" : q.kind === "big" ? "rgba(209,73,91," + pulse + ")" : q.kind === "crumb" ? (launched ? "#2f7d46" : "#9aa5b1") : PIECE[(Math.round((qx - G.x0) / s) + 2 * Math.round((qy - G.y0) / s)) % 4];
          ctx.fillRect(V.ox + x * c, V.oy + y * c, c, c);
        }
        ctx.save(); ctx.beginPath(); ctx.rect(V.ox, V.oy, c * G.cols, c * G.rows); ctx.clip();
        squares.forEach(function (q) {
          var x = V.ox + q.x * c, y = V.oy + q.y * c, w = q.s * c;
          ctx.strokeStyle = q.kind === "big" ? "#d1495b" : "rgba(255,255,255,.95)"; ctx.lineWidth = q.kind === "big" ? 4 : 2.5;
          ctx.strokeRect(x + 1, y + 1, w - 2, w - 2);
        });
        ctx.restore();
        squares.forEach(function (q) {
          var w = q.s * c;
          if (w < 40 || (q.kind === "crumb" && launched)) return;
          var cx = V.ox + q.x * c + Math.min(w, (G.cols - q.x) * c) / 2, cy = V.oy + q.y * c + Math.min(w, (G.rows - q.y) * c) / 2;
          pill(ctx, cx, cy, q.kind === "big" ? "⚠ " + Math.round(q.ha) + " ha" : q.kind === "crumb" ? "crumb" : Math.round(q.ha) + " ha",
            q.kind === "big" ? "#ffe0e4" : q.done ? "#d9f7df" : "#fff", INK, w >= 70 ? 14 : 11);
        });
        if (launched) launched.forEach(function (d) {
          var k = u.clamp((t - d.t0) / .9, 0, 1), e = u.ease.inOut(k);
          if (k >= 1 && !d.arrived) { d.arrived = true; d.q.done = true; RQ.audio.sfx("drop"); fx.burst(d.x1, d.y1, "#7ed957", 8, 80); }
          if (k > 0) drawDrone(ctx, u.lerp(d.x0, d.x1 + 22, e), u.lerp(d.y0, d.y1 - 20, e) - Math.sin(e * Math.PI) * 30 + Math.sin(t * 5 + d.k) * 2, Math.max(.6, c * .1), t);
        });
        fx.draw(ctx, dt);
      });
    }
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g16",
    music: "forest",
    intro: [
      ["pix", "Hey, I'm Pix! Satellites found where forest got lost, so now we draw the exact patches."],
      ["sprout", "Then the drones know exactly where to fly. Grab your paint bucket!"]
    ],
    outro: [
      ["pix", "Patches found, measured, sorted and split. That's real map coding!"],
      ["koa", "Beaut, now I know exactly where to fly! See you on Fly island."]
    ],
    levels: [
      { title: "Threshold", goal: "Light up the lost forest, not the healthy forest",
        intro: [["pix", "Each square is a **pixel**. Its number says how much greener it used to be."],
                ["pix", "Slide the **threshold**: squares at or above it light up. Light up the lost forest, not the noise!"]],
        cards: ["pp-threshold"],
        play: levelThreshold },
      { title: "Flood fill", goal: "Pour paint into every lit patch",
        intro: [["pix", "Lit squares that touch make one **patch**. My paint bucket finds them with **flood fill**."],
                ["pix", "Tap a lit square. The paint spreads up, down, left and right, like water!"]],
        cards: ["pp-flood-fill"],
        play: levelFlood },
      { title: "Hectares", goal: "Count pixels, turn them into hectares",
        intro: [["pix", "One pixel is 10 m by 10 m. That's **0.01 hectares**."],
                ["pix", "Let's count a big square first. Tap it with the bucket!"]],
        cards: ["pp-hectare"],
        play: levelArea },
      { title: "Sorting race", goal: "Sort the real patches, biggest first",
        intro: [["pix", "The drones need the biggest patches first. Let's **sort** them, largest first!"],
                ["sprout", "These are the real patch sizes from your site. Compare two cards at a time."]],
        cards: ["pp-sorting"],
        play: levelSort },
      { title: "Drone-sized", goal: "Pick the first mission, then split the giant",
        intro: [["koa", "G'day! ReSeed plans at most **50 hectares** per mission, so bigger patches need cutting."],
                ["pix", "First, pick the patch for our first mission. Then slice the giant into drone-sized squares!"]],
        cards: ["pp-split"],
        play: levelSplit }
    ]
  });
})();
