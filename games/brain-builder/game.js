/* g11 Brain Builder — how a neural network works, from one neuron to the real ForestNet.
 * L1 one neuron = a draggable decision line on real tile features (greenness, brightness from points.js).
 * L2 a 3x3 filter scans pixels (convolution), ReLU, max pooling, then the REAL first layer of ForestNet on a real tile.
 * L3 a tiny network (2 -> 6 tanh -> 1) trains in the browser with backprop: loss, accuracy, learning rate, train/test split,
 *    and a green farm field that fools it. L4 (expert) assemble ForestNet's real layer stack (classify/model.py, 214,212 parameters).
 * Facts: reseed/classify/model.py, train.py, README (validation table, ~12 min on one GPU). */
(function () {
  "use strict";
  var u = RQ.u, el = u.el;
  var P = window.RQ_POINTS || { points: [], farm: [], tiles: [], display: { path: [0, 0, 0], full: 1, gain: 1, gamma: 1 } };
  var CITY = ["manhattan", "la_interchange", "new_capital", "maldives", "manaus", "palm_desert"];
  var GREEN = "#2f9e4f", GREY = "#7d8a99", INK = "#1d2b3a";

  /* ------------------------------------------------------------ shared: tiles + ForestNet */
  var LUT = (function () {
    var d = P.display, lut = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
    for (var c = 0; c < 3; c++) for (var v = 0; v < 256; v++) lut[c][v] = Math.round(Math.pow(u.clamp((v * d.full / 255 - d.path[c]) * d.gain, 0, 1), d.gamma) * 255);
    return lut;
  })();
  function px(t) { if (!t._px) t._px = RQ.ForestNet.b64ToBytes(t.b64); return t._px; }
  function tileCanvas(t, size) {
    var cv = el("canvas", { width: 64, height: 64, class: "bb-tilecv", style: { width: size + "px", height: size + "px", imageRendering: "pixelated", border: "3px solid " + INK, borderRadius: "10px" } });
    var ctx = cv.getContext("2d"), im = ctx.createImageData(64, 64), p = px(t);
    for (var i = 0; i < 4096; i++) { for (var c = 0; c < 3; c++) im.data[i * 4 + c] = LUT[c][p[i * 3 + c]]; im.data[i * 4 + 3] = 255; }
    ctx.putImageData(im, 0, 0);
    return cv;
  }
  var NET = null;
  function net() { return NET || (NET = RQ.ForestNet.load()); }

  /* ------------------------------------------------------------ shared: the feature plot */
  function plot(L, parent, label) {
    var W = 760, H = 580, M = { l: 76, r: 22, t: 16, b: 64 };
    var api = L.canvas({ w: W, h: H, parent: parent, label: label || "plot of real tiles: greenness and brightness" });
    var pw = W - M.l - M.r, ph = H - M.t - M.b, ctx = api.ctx;
    var o = { api: api, ctx: ctx, M: M, pw: pw, ph: ph };
    o.X = function (g) { return M.l + g / 100 * pw; };
    o.Y = function (b) { return M.t + (1 - b / 100) * ph; };
    o.inv = function (x, y) { return { g: u.clamp((x - M.l) / pw * 100, 0, 100), b: u.clamp((1 - (y - M.t) / ph) * 100, 0, 100) }; };
    o.back = function () {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; u.rr(ctx, M.l, M.t, pw, ph, 10); ctx.fill();
    };
    o.axes = function () {
      ctx.strokeStyle = "rgba(29,43,58,.12)"; ctx.lineWidth = 1;
      ctx.font = "500 15px Fredoka, sans-serif"; ctx.fillStyle = "#4a5b6d"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var v = 0; v <= 100; v += 20) {
        ctx.beginPath(); ctx.moveTo(o.X(v), M.t); ctx.lineTo(o.X(v), M.t + ph); ctx.moveTo(M.l, o.Y(v)); ctx.lineTo(M.l + pw, o.Y(v)); ctx.stroke();
        ctx.fillText(v, o.X(v), M.t + ph + 6);
      }
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (v = 0; v <= 100; v += 20) ctx.fillText(v, M.l - 8, o.Y(v));
      ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, M.l, M.t, pw, ph, 10); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = "700 18px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText("greenness →  (more green)", M.l + pw / 2, M.t + ph + 56);
      ctx.save(); ctx.translate(22, M.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "middle"; ctx.fillText("brightness →", 0, 0); ctx.restore();
    };
    o.dot = function (p, opts) {
      opts = opts || {};
      var x = o.X(p.g), y = o.Y(p.b), r = opts.r || 8;
      ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
      if (opts.glow) { ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 7); ctx.fillStyle = "rgba(255,216,77,.75)"; ctx.fill(); }
      if (opts.farm) {
        ctx.fillStyle = "#f0a830"; u.rr(ctx, x - r - 2, y - r - 2, 2 * r + 4, 2 * r + 4, 4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#7a4e00"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, y + 6); ctx.lineTo(x - 4, y - 6); ctx.moveTo(x + 4, y + 6); ctx.lineTo(x + 4, y - 6); ctx.stroke();
      } else if (p.y) {
        ctx.fillStyle = opts.hollow ? "#fff" : GREEN; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
        if (!opts.hollow) { ctx.fillStyle = "#a8e6b4"; ctx.beginPath(); ctx.ellipse(x - 2, y - 2, r * .45, r * .25, -.6, 0, 7); ctx.fill(); }
      } else {
        ctx.fillStyle = opts.hollow ? "#fff" : GREY; u.rr(ctx, x - r, y - r, 2 * r, 2 * r, 3); ctx.fill(); ctx.stroke();
      }
      if (opts.ring) { ctx.strokeStyle = opts.ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 7); ctx.stroke(); }
    };
    o.bug = function (p, t) {
      var x = o.X(p.g) + 11, y = o.Y(p.b) - 11 + Math.sin(t * 9 + p.g) * 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 6 + p.b) * .3);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(-5, -10); ctx.moveTo(2, -5); ctx.lineTo(5, -10); ctx.stroke();
      ctx.fillStyle = "#8a5cd0"; ctx.beginPath(); ctx.ellipse(0, 0, 6, 7, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-2, -2, 1.6, 0, 7); ctx.arc(2, -2, 1.6, 0, 7); ctx.fill();
      ctx.restore();
    };
    return o;
  }
  /** Legend drawn at a fixed spot (dot positions in data units are not used). */
  function legend(o, rows) {
    var ctx = o.ctx, x = o.M.l + o.pw - 14, y = o.M.t + 16;
    ctx.fillStyle = "rgba(255,255,255,.9)"; u.rr(ctx, x - 230, y - 12, 236, rows.length * 24 + 6, 8); ctx.fill();
    rows.forEach(function (r, i) {
      var yy = y + i * 24;
      ctx.lineWidth = 2; ctx.strokeStyle = INK;
      if (r.kind === "forest") { ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(x - 8, yy, 7, 0, 7); ctx.fill(); ctx.stroke(); }
      else if (r.kind === "farm") { ctx.fillStyle = "#f0a830"; u.rr(ctx, x - 16, yy - 8, 16, 16, 3); ctx.fill(); ctx.stroke(); }
      else { ctx.fillStyle = GREY; u.rr(ctx, x - 15, yy - 7, 14, 14, 3); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = INK; ctx.font = "600 15px Fredoka, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(r.text, x - 24, yy);
    });
  }

  /* ------------------------------------------------------------ level 1: one neuron = one line */
  function levelNeuron(L) {
    var pts = P.points.filter(function (p) { return p.l1; });
    var root = el("div", { class: "bb-wrap" }), box = el("div", { class: "bb-plot" }), side = el("div", { class: "bb-side panel" });
    root.appendChild(box); root.appendChild(side); L.stage.appendChild(root);
    var o = plot(L, box), ctx = o.ctx;
    var A = { g: 84, b: 8 }, B = { g: 78, b: 92 }, H = [A, B], sel = 1, drag = null, firing = -1, fireDone = false, tries = 0;
    var diagram = el("div", { class: "bb-neuron" }), formula = el("div", { class: "bb-formula" });
    var accTxt = el("div", { class: "bb-acc" }), barFill = el("i"), bar = el("div", { class: "bb-bar" }, barFill);
    var fire = el("button", { class: "btn big primary", html: "⚡ Fire the neuron!" });
    side.appendChild(el("h3", { text: "Your neuron" }));
    side.appendChild(diagram); side.appendChild(formula); side.appendChild(accTxt); side.appendChild(bar); side.appendChild(fire);
    side.appendChild(el("div", { class: "bb-tip", html: "Drag the yellow handles <b>1</b> and <b>2</b>. Keys: <kbd>1</kbd> <kbd>2</kbd> pick a handle, arrows move it, <kbd>Enter</kbd> fires." }));
    side.appendChild(el("div", { class: "bb-tip", text: "Each dot is a real 640 m tile from the ReSeed sites: green = ForestNet said forest, grey = city, water or desert." }));
    var N = null;
    function neuron() {
      var wg = A.b - B.b, wb = B.g - A.g, len = Math.hypot(wg, wb) || 1;
      wg /= len; wb /= len;
      var c = -(wg * A.g + wb * A.b), s = 0;
      pts.forEach(function (p) { if (p.y) s += (wg * p.g + wb * p.b + c) > 0 ? 1 : -1; });
      if (s < 0) { wg = -wg; wb = -wb; c = -c; }
      var ok = 0; pts.forEach(function (p) { if (((wg * p.g + wb * p.b + c) > 0) === !!p.y) ok++; });
      return { wg: wg, wb: wb, c: c, ok: ok, acc: ok / pts.length };
    }
    function fmt(v) { return (v < 0 ? "− " : "+ ") + Math.abs(v).toFixed(2); }
    function update() {
      N = neuron();
      formula.innerHTML = "score = <span class='g'>" + N.wg.toFixed(2) + "</span> × greenness<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" +
        fmt(N.wb) + " × <span class='b'>brightness</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + fmt(N.c).replace(/\.\d+$/, function (m) { return m.slice(0, 2); }) +
        " <small>(bias)</small><br>score &gt; 0 → ⚡ fire: <b>forest</b>";
      accTxt.innerHTML = "✔ " + N.ok + " / " + pts.length + " dots right";
      barFill.style.width = (N.acc * 100) + "%";
      var w1 = N.wg, w2 = N.wb, col = function (w) { return w >= 0 ? GREEN : "#d1495b"; }, th = function (w) { return 2 + Math.abs(w) * 9; };
      diagram.innerHTML = '<svg viewBox="0 0 300 120" role="img" aria-label="neuron with two inputs">' +
        '<line x1="70" y1="30" x2="180" y2="60" stroke="' + col(w1) + '" stroke-width="' + th(w1) + '" stroke-linecap="round"/>' +
        '<line x1="70" y1="92" x2="180" y2="60" stroke="' + col(w2) + '" stroke-width="' + th(w2) + '" stroke-linecap="round"/>' +
        '<rect x="4" y="14" width="80" height="32" rx="10" fill="#e3f6e6" stroke="#1d2b3a" stroke-width="3"/><text x="44" y="35" font-size="14" text-anchor="middle" font-weight="600">greenness</text>' +
        '<rect x="4" y="76" width="80" height="32" rx="10" fill="#fff3cf" stroke="#1d2b3a" stroke-width="3"/><text x="44" y="97" font-size="14" text-anchor="middle" font-weight="600">brightness</text>' +
        '<circle cx="190" cy="60" r="30" fill="' + (firing >= 0 ? "#ffd84d" : "#7c5cc4") + '" stroke="#1d2b3a" stroke-width="4"/><text x="190" y="67" font-size="22" text-anchor="middle">⚡</text>' +
        '<line x1="222" y1="60" x2="250" y2="60" stroke="#1d2b3a" stroke-width="4"/><text x="275" y="69" font-size="26" text-anchor="middle">🌳</text></svg>';
    }
    update();
    function nearHandle(p) { var best = -1, bd = 40; H.forEach(function (h, i) { var d = u.dist(p.x, p.y, o.X(h.g), o.Y(h.b)); if (d < bd) { bd = d; best = i; } }); return best; }
    L.on(o.api.cv, "pointerdown", function (e) {
      if (firing >= 0) return;
      var p = o.api.toLocal(e), i = nearHandle(p);
      if (i >= 0) { drag = i; sel = i; o.api.cv.setPointerCapture && o.api.cv.setPointerCapture(e.pointerId); RQ.audio.sfx("click"); }
    });
    L.on(o.api.cv, "pointermove", function (e) {
      var p = o.api.toLocal(e);
      if (drag == null) { o.api.cv.style.cursor = nearHandle(p) >= 0 ? "grab" : "default"; return; }
      var d = o.inv(p.x, p.y); H[drag].g = d.g; H[drag].b = d.b; update();
    });
    L.on(o.api.cv, "pointerup", function () { if (drag != null) RQ.audio.sfx("tick"); drag = null; });
    L.on(window, "keydown", function (e) {
      if (document.querySelector(".rq-overlay, .rq-talk") || firing >= 0) return;
      var step = e.shiftKey ? 6 : 2, h = H[sel];
      if (e.key === "1" || e.key === "2") { sel = +e.key - 1; RQ.audio.sfx("select"); }
      else if (e.key === "ArrowLeft") h.g = u.clamp(h.g - step, 0, 100);
      else if (e.key === "ArrowRight") h.g = u.clamp(h.g + step, 0, 100);
      else if (e.key === "ArrowUp") h.b = u.clamp(h.b + step, 0, 100);
      else if (e.key === "ArrowDown") h.b = u.clamp(h.b - step, 0, 100);
      else if (e.key === "Enter") { e.preventDefault(); doFire(); return; }
      else return;
      e.preventDefault(); update();
    });
    fire.onclick = doFire;
    var order = pts.slice().sort(function (a, b) { return a.g - b.g; });
    function doFire() {
      if (firing >= 0 || fireDone || !L.alive) return;
      tries++;
      if (N.acc < 0.8) {
        RQ.audio.sfx("giggle"); L.toast("🐞 Too many Glitch Bugs! Move the line between the green and grey dots.", "bad", 2600);
        if (tries >= 2) L.hint("Put handle 1 at the bottom left and handle 2 in the middle, so the green dots sit below the line.");
        return;
      }
      firing = 0; fire.disabled = true; RQ.audio.sfx("zap"); update();
    }
    L.loop(function (dt, t) {
      o.back();
      // the two sides of the line
      var d = { g: B.g - A.g, b: B.b - A.b }, dl = Math.hypot(d.g, d.b) || 1; d.g /= dl; d.b /= dl;
      var n = { g: N.wg, b: N.wb }, far = 400;
      ctx.save(); u.rr(ctx, o.M.l, o.M.t, o.pw, o.ph, 10); ctx.clip();
      [[1, "rgba(47,158,79,.16)"], [-1, "rgba(125,138,153,.16)"]].forEach(function (side) {
        var s = side[0];
        ctx.fillStyle = side[1]; ctx.beginPath();
        ctx.moveTo(o.X(A.g - d.g * far), o.Y(A.b - d.b * far)); ctx.lineTo(o.X(A.g + d.g * far), o.Y(A.b + d.b * far));
        ctx.lineTo(o.X(A.g + d.g * far + s * n.g * far), o.Y(A.b + d.b * far + s * n.b * far)); ctx.lineTo(o.X(A.g - d.g * far + s * n.g * far), o.Y(A.b - d.b * far + s * n.b * far));
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
      o.axes();
      // dots + bugs on the wrong side
      var lit = firing >= 0 ? Math.floor(firing) : -1;
      order.forEach(function (p, i) {
        var on = (N.wg * p.g + N.wb * p.b + N.c) > 0, wrong = on !== !!p.y;
        o.dot(p, { glow: firing >= 0 && i <= lit && on });
        if (wrong) o.bug(p, t);
      });
      // the line and handles
      ctx.save(); u.rr(ctx, o.M.l, o.M.t, o.pw, o.ph, 10); ctx.clip();
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.setLineDash([14, 8]);
      ctx.beginPath(); ctx.moveTo(o.X(A.g - d.g * far), o.Y(A.b - d.b * far)); ctx.lineTo(o.X(A.g + d.g * far), o.Y(A.b + d.b * far)); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      H.forEach(function (h, i) {
        var x = o.X(h.g), y = o.Y(h.b);
        if (i === sel) { ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.fillStyle = "rgba(255,216,77,.45)"; ctx.fill(); }
        ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fillStyle = "#ffd84d"; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = INK; ctx.font = "700 17px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), x, y + 1);
      });
      legend(o, [{ kind: "forest", text: "forest tile" }, { kind: "city", text: "city / water / desert tile" }]);
      if (firing >= 0) {
        var before = Math.floor(firing);
        firing += dt * 60;
        if (Math.floor(firing) > before && Math.floor(firing) % 6 === 0) RQ.audio.sfx("pop");
        if (firing >= order.length + 20) {
          firing = -1; fireDone = true; update();
          var stars = N.acc >= 0.99 ? 3 : N.acc >= 0.94 ? 2 : 1;
          L.win({ stars: stars, msg: "Your neuron fired for **" + Math.round(N.acc * 100) + "%** of the tiles correctly. One neuron = one straight line!",
            stats: { "Right": N.ok + " / " + pts.length, "Bugs left": pts.length - N.ok } });
        }
      }
    });
  }

  /* ------------------------------------------------------------ level 2: the filter factory */
  var PIC = (function () { // 10x10: bumpy dark forest with a bright cleared strip in the middle
    var g = [], leaf = [1, 4, 2, 3, 1, 2, 4];
    for (var r = 0; r < 10; r++) { var row = []; for (var c = 0; c < 10; c++) row.push(c >= 3 && c <= 6 ? 8 : leaf[(r * 3 + c * 5 + r * c) % 7]); g.push(row); }
    return g;
  })();
  var FILTERS = {
    edge: { name: "Edge finder", k: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], say: "Yellow where dark turns bright, blue where bright turns dark: the forest edges!" },
    blur: { name: "Blur", k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], div: 9, say: "That just made the picture blurry. Nothing glows extra." },
    leaf: { name: "Bump finder", k: [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]], say: "It glows where pixels jump up and down: bumpy tree crowns (and edges)." }
  };
  function convolve(img, f) {
    var out = [], n = img.length - 2;
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) {
        var s = 0; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) s += f.k[i][j] * img[r + i][c + j];
        row.push(f.div ? Math.round(s / f.div * 10) / 10 : s);
      }
      out.push(row);
    }
    return out;
  }
  function inColor(v) { var t = v / 9; return "rgb(" + Math.round(u.lerp(29, 217, t)) + "," + Math.round(u.lerp(59, 236, t)) + "," + Math.round(u.lerp(35, 176, t)) + ")"; }
  function outColor(v, max) {
    if (v == null) return "#2b3a4b";
    var t = Math.min(1, Math.abs(v) / (max || 1));
    if (v > 0) return "rgb(" + Math.round(u.lerp(43, 255, t)) + "," + Math.round(u.lerp(58, 216, t)) + "," + Math.round(u.lerp(75, 77, t)) + ")";
    if (v < 0) return "rgb(" + Math.round(u.lerp(43, 90, t)) + "," + Math.round(u.lerp(58, 150, t)) + "," + Math.round(u.lerp(75, 255, t)) + ")";
    return "#1d2b3a";
  }
  function gridEl(rows, cols, cs) {
    var g = el("div", { class: "bb-grid", style: { gridTemplateColumns: "repeat(" + cols + ", var(--cs))" } }), cells = [];
    g.style.setProperty("--cs", cs);
    for (var i = 0; i < rows * cols; i++) { var c = el("div", { class: "c" }); cells.push(c); g.appendChild(c); }
    return { el: g, cells: cells, at: function (r, c) { return cells[r * cols + c]; } };
  }
  function miniFilter(f) {
    var m = el("div", { class: "bb-mini" });
    f.k.forEach(function (row) { row.forEach(function (v) { m.appendChild(el("i", { text: String(v), style: { background: v > 0 ? "#fff1b8" : v < 0 ? "#cfe0ff" : "#fff" } })); }); });
    return m;
  }
  function levelFilters(L) {
    var root = el("div", { class: "bb-factory" }); L.stage.appendChild(root);
    var cs = Math.max(24, Math.min(40, Math.floor((window.innerHeight - 64 - 260) / 10))) + "px";
    var task = el("div", { class: "bb-task" }), machines = el("div", { class: "bb-machines" }), filters = el("div", { class: "bb-filters" });
    root.appendChild(task); root.appendChild(machines); root.appendChild(filters);
    var inG = gridEl(10, 10, cs), outG = gridEl(8, 8, cs), win = el("div", { class: "bb-window" });
    inG.el.appendChild(win); win.style.display = "none";
    PIC.forEach(function (row, r) { row.forEach(function (v, c) { var x = inG.at(r, c); x.textContent = v; x.style.background = inColor(v); x.style.color = v > 5 ? INK : "#fff"; }); });
    var calc = el("div", { class: "bb-calc", text: "Pick a filter below\nto start the scanner." });
    var fName = el("b", { text: "Filter: ?" }), outLbl = el("b", { text: "Feature map" });
    var midCol = el("div", { class: "bb-col" }, fName, calc);
    var outCol = el("div", { class: "bb-col" }, outLbl, outG.el);
    machines.appendChild(el("div", { class: "bb-col" }, el("b", { text: "Pixels (0 = dark, 9 = bright)" }), inG.el));
    machines.appendChild(midCol); machines.appendChild(outCol);
    var wrong = 0, busy = false, current = null, out = null, fast = false;
    var TASKS = [{ want: "edge", text: "🎯 Make the **edges** of the cleared strip glow!" }, { want: "leaf", text: "🎯 Now make the **bumpy tree crowns** glow!" }];
    var ti = 0;
    function setTask(md) { task.innerHTML = ""; task.appendChild(el("b", { html: RQ.ui.md(md) })); }
    setTask(TASKS[0].text);
    var cards = {};
    Object.keys(FILTERS).forEach(function (key) {
      var f = FILTERS[key];
      var b = el("button", { class: "bb-fcard", "aria-label": f.name }, miniFilter(f), el("span", { html: f.name + (f.div ? "<br><small>(÷ 9)</small>" : "") }));
      b.onclick = function () { pick(key); };
      cards[key] = b; filters.appendChild(b);
    });
    var skip = el("button", { class: "btn small", text: "⏩ Faster" }); skip.onclick = function () { fast = true; };
    task.appendChild(skip);
    async function scan(key) {
      var f = FILTERS[key], res = convolve(PIC, f), max = 0;
      res.forEach(function (row) { row.forEach(function (v) { max = Math.max(max, Math.abs(v)); }); });
      outG.cells.forEach(function (c) { c.textContent = ""; c.style.background = outColor(null); });
      fName.textContent = "Filter: " + f.name; outLbl.textContent = "Feature map: " + f.name;
      win.style.display = "";
      var cell = inG.at(0, 0).getBoundingClientRect(), base = inG.el.getBoundingClientRect(), step = inG.at(0, 1).getBoundingClientRect().left - cell.left;
      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          win.style.left = (cell.left - base.left - 7 + c * step) + "px"; win.style.top = (cell.top - base.top - 7 + r * step) + "px";
          win.style.width = (step * 3 + 6) + "px"; win.style.height = (step * 3 + 6) + "px";
          var lines = [];
          for (var i = 0; i < 3; i++) {
            var parts = [];
            for (var j = 0; j < 3; j++) { var k = f.k[i][j]; parts.push((k < 0 ? "" : "+") + k + "×" + PIC[r + i][c + j]); }
            lines.push(parts.join(" "));
          }
          calc.innerHTML = u.esc(lines.join("\n")) + "\n<span class='y'>sum" + (f.div ? " ÷ 9" : "") + " = " + res[r][c] + "</span>";
          var oc = outG.at(r, c); oc.textContent = Math.round(res[r][c]); oc.style.background = outColor(res[r][c], max); oc.style.color = res[r][c] === 0 ? "#6e7f92" : INK;
          if (!fast || c === 7) { RQ.audio.sfx("tick"); await L.wait(fast ? 8 : 55); if (!L.alive) return null; }
        }
      }
      win.style.display = "none";
      return res;
    }
    async function pick(key) {
      if (busy || !L.alive) return;
      busy = true; fast = false;
      Object.keys(cards).forEach(function (k) { cards[k].disabled = true; });
      cards[key].classList.add("tried");
      current = key; out = await scan(key);
      if (!L.alive || !out) return;
      var ok = key === TASKS[ti].want;
      if (ok) {
        RQ.audio.sfx("good"); outG.cells.forEach(function (c) { c.classList.add("hot"); }); L.timeout(function () { outG.cells.forEach(function (c) { c.classList.remove("hot"); }); }, 500);
        L.toast("✅ " + FILTERS[key].say, "good", 2600);
        await L.wait(900); if (!L.alive) return;
        ti++;
        if (ti < TASKS.length) {
          await L.say("hoot", "Splendid! Every filter hunts for its own pattern, so try the next job.", { mood: "happy" });
          if (!L.alive) return;
          setTask(TASKS[ti].text); task.appendChild(skip);
          Object.keys(cards).forEach(function (k) { cards[k].disabled = false; cards[k].classList.remove("tried"); });
          busy = false;
        } else relu();
      } else {
        wrong++; RQ.audio.sfx("giggle");
        L.toast("🤔 " + FILTERS[key].say, "info", 2800);
        if (wrong >= 2 || L.fails >= 1) L.timeout(function () { L.toast("💡 Look at the numbers in each filter: which one compares the left side with the right side?", "info", 3200); }, 2900);
        Object.keys(cards).forEach(function (k) { cards[k].disabled = false; });
        busy = false;
      }
    }
    async function relu() {
      // back to the edge map: it has negative (blue) numbers
      filters.innerHTML = "";
      setTask("🎯 The **ReLU machine**: turn every negative number into 0.");
      fast = true; out = await scan("edge"); fast = false; if (!L.alive) return;
      var neg = 0; out.forEach(function (row) { row.forEach(function (v) { if (v < 0) neg++; }); });
      var lever = el("button", { class: "btn big primary bb-lever", html: "🔧 Pull the ReLU lever (" + neg + " blue cells)" });
      filters.appendChild(lever); lever.focus();
      await new Promise(function (res) { lever.onclick = res; }); if (!L.alive) return;
      lever.disabled = true; RQ.audio.sfx("powerup");
      var max = 0; out.forEach(function (row) { row.forEach(function (v) { max = Math.max(max, v); }); });
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        if (out[r][c] < 0) { out[r][c] = 0; var oc = outG.at(r, c); oc.textContent = "0"; oc.style.background = outColor(0); oc.style.color = "#6e7f92"; oc.classList.add("hot"); RQ.audio.sfx("pop"); await L.wait(60); if (!L.alive) return; oc.classList.remove("hot"); }
      }
      calc.textContent = "ReLU: if x < 0 then 0\nelse keep x\n\nNo more blue! Other\nfilters may catch that edge.";
      await L.wait(500); if (!L.alive) return;
      pool(max);
    }
    async function pool(max) {
      filters.innerHTML = "";
      setTask("🎯 The **pooling machine**: keep the biggest number in each 2 × 2 block.");
      var btn = el("button", { class: "btn big primary", html: "🗜️ Squash it! (max pool)" });
      filters.appendChild(btn); btn.focus();
      await new Promise(function (res) { btn.onclick = res; }); if (!L.alive) return;
      btn.disabled = true;
      var pg = gridEl(4, 4, cs);
      var poolCol = el("div", { class: "bb-col" }, el("b", { text: "After pooling (4 × 4)" }), pg.el);
      machines.removeChild(midCol); machines.appendChild(poolCol);
      for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
        var cellsB = [outG.at(2 * r, 2 * c), outG.at(2 * r, 2 * c + 1), outG.at(2 * r + 1, 2 * c), outG.at(2 * r + 1, 2 * c + 1)];
        var m = Math.max(out[2 * r][2 * c], out[2 * r][2 * c + 1], out[2 * r + 1][2 * c], out[2 * r + 1][2 * c + 1]);
        cellsB.forEach(function (x) { x.classList.add("hot"); });
        var pc = pg.at(r, c); pc.textContent = m; pc.style.background = outColor(m, max); pc.style.color = m === 0 ? "#6e7f92" : INK;
        RQ.audio.sfx("snap"); await L.wait(140); if (!L.alive) return;
        cellsB.forEach(function (x) { x.classList.remove("hot"); });
      }
      await L.say("hoot", "Four times smaller, and the edge still glows! ForestNet does this squash three times.", { mood: "wow" });
      if (!L.alive) return;
      realLayer();
    }
    async function realLayer() {
      var t = P.tiles[0];
      machines.innerHTML = ""; filters.innerHTML = "";
      setTask("🎉 Surprise: the **real** first layer of ForestNet, on a real Rondônia tile!");
      var r = RQ.ForestNet.forward(net(), px(t), 3), a = r.acts[0], hw = a.h * a.w;
      var stats = [];
      for (var ch = 0; ch < a.c; ch++) { var s = 0, s2 = 0, mx = 0; for (var i = 0; i < hw; i++) { var v = a.data[ch * hw + i]; s += v; s2 += v * v; if (v > mx) mx = v; } stats.push({ ch: ch, sd: Math.sqrt(Math.max(0, s2 / hw - (s / hw) * (s / hw))), mx: mx }); }
      stats.sort(function (x, y) { return y.sd - x.sd; });
      var maps = el("div", { class: "bb-maps" });
      maps.appendChild(el("figure", {}, tileCanvas(t, 120), el("figcaption", { text: "Real tile (64 × 64)" })));
      stats.slice(0, 6).forEach(function (st) {
        var cv = el("canvas", { width: 64, height: 64 }), cx = cv.getContext("2d"), im = cx.createImageData(64, 64);
        for (var i = 0; i < hw; i++) { var g = Math.round(255 * Math.min(1, a.data[st.ch * hw + i] / (0.6 * st.mx || 1))); im.data[i * 4] = g; im.data[i * 4 + 1] = Math.round(g * .85 + 30 * (1 - g / 255)); im.data[i * 4 + 2] = Math.round(g * .3 + 60 * (1 - g / 255)); im.data[i * 4 + 3] = 255; }
        cx.putImageData(im, 0, 0);
        maps.appendChild(el("figure", {}, cv, el("figcaption", { text: "filter " + (st.ch + 1) + " of 24" })));
      });
      machines.appendChild(maps);
      await L.say("hoot", "ForestNet's first layer has **24** filters like yours. Here are six of the pictures they make from this real tile.");
      if (!L.alive) return;
      var done = el("button", { class: "btn big go", html: "Finish ✔" }); filters.appendChild(done);
      done.onclick = function () {
        L.win({ stars: wrong === 0 ? 3 : wrong <= 2 ? 2 : 1, msg: "You ran a **convolution**, a **ReLU** and a **max pool**: the three machines inside ForestNet.",
          stats: { "Wrong filters": wrong } });
      };
    }
  }

  /* ------------------------------------------------------------ level 3: train a tiny brain in the browser */
  var LRS = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100];
  function Brain(rng, H) {
    var b = { H: H, W1: [], b1: [], W2: [], b2: 0 };
    for (var j = 0; j < H; j++) { b.W1.push([(rng() - .5) * 2, (rng() - .5) * 2]); b.b1.push(rng() - .5); b.W2.push((rng() - .5) * 2); }
    return b;
  }
  function feat(p) { return [(p.g - 50) / 25, (p.b - 30) / 25]; }
  function fwd(br, x) {
    var h = [], z = br.b2;
    for (var j = 0; j < br.H; j++) { var a = Math.tanh(br.W1[j][0] * x[0] + br.W1[j][1] * x[1] + br.b1[j]); h.push(a); z += br.W2[j] * a; }
    z = u.clamp(z, -40, 40);
    return { h: h, o: 1 / (1 + Math.exp(-z)) };
  }
  /** One epoch of full-batch gradient descent with backprop. Returns the mean loss before the step. */
  function epoch(br, data, lr) {
    var H = br.H, gW1 = [], gb1 = [], gW2 = [], gb2 = 0, loss = 0, j;
    for (j = 0; j < H; j++) { gW1.push([0, 0]); gb1.push(0); gW2.push(0); }
    data.forEach(function (p) {
      var x = feat(p), f = fwd(br, x), y = p.y ? 1 : 0, d = f.o - y;
      loss -= y ? Math.log(f.o + 1e-9) : Math.log(1 - f.o + 1e-9);
      gb2 += d;
      for (var k = 0; k < H; k++) { gW2[k] += d * f.h[k]; var dh = d * br.W2[k] * (1 - f.h[k] * f.h[k]); gW1[k][0] += dh * x[0]; gW1[k][1] += dh * x[1]; gb1[k] += dh; }
    });
    var n = data.length;
    br.b2 -= lr * gb2 / n;
    for (j = 0; j < H; j++) { br.W2[j] -= lr * gW2[j] / n; br.W1[j][0] -= lr * gW1[j][0] / n; br.W1[j][1] -= lr * gW1[j][1] / n; br.b1[j] -= lr * gb1[j] / n; }
    return loss / n;
  }
  function accuracy(br, data) { var ok = 0; data.forEach(function (p) { if ((fwd(br, feat(p)).o >= 0.5) === !!p.y) ok++; }); return data.length ? ok / data.length : 0; }
  function finite(br) { return isFinite(br.b2) && br.W2.every(isFinite) && br.W1.every(function (w) { return isFinite(w[0]) && isFinite(w[1]); }); }

  function levelTrain(L) {
    var data = u.shuffle(P.points.filter(function (p) { return p.y === 1 || CITY.indexOf(p.s) >= 0; }), L.rng);
    var nTrain = Math.round(data.length * 0.7), train = data.slice(0, nTrain), test = data.slice(nTrain);
    var root = el("div", { class: "bb-wrap" }), box = el("div", { class: "bb-plot" }), side = el("div", { class: "bb-side panel" });
    root.appendChild(box); root.appendChild(side); L.stage.appendChild(root);
    var o = plot(L, box, "the tiny brain's map: green = it says forest"), ctx = o.ctx;
    var brain = Brain(L.rng, 6), ep = 0, running = false, lrIdx = 2, hist = [], chaosEp = 0, tested = false, testAcc = 0, farmShown = false, trainAcc = 0;
    var goals = [
      { id: "train", text: "Train until it gets 90 % of the training tiles right" },
      { id: "chaos", text: "Try a HUGE learning rate (30 or more) and watch" },
      { id: "test", text: "Test it on the hidden tiles it never saw" },
      { id: "farm", text: "Show it some green farm fields 🌾" }
    ], done = {};
    var goalList = el("ul", { class: "bb-goals" });
    function drawGoals() { goalList.innerHTML = ""; goals.forEach(function (g) { goalList.appendChild(el("li", { class: done[g.id] ? "done" : "", text: g.text })); }); }
    drawGoals();
    var lrIn = el("input", { type: "range", min: "0", max: String(LRS.length - 1), step: "1", value: String(lrIdx), "aria-label": "learning rate" });
    var lrVal = el("b", { text: String(LRS[lrIdx]) });
    L.on(lrIn, "input", function () { lrIdx = +lrIn.value; lrVal.textContent = String(LRS[lrIdx]); RQ.audio.sfx("tick"); });
    var bTrain = el("button", { class: "btn go", html: "▶ Train" }), bStep = el("button", { class: "btn", html: "+1 epoch" }), bReset = el("button", { class: "btn", html: "↺ New brain" });
    var bTest = el("button", { class: "btn primary", html: "🔒 Test on hidden tiles", disabled: true }), bFarm = el("button", { class: "btn primary", html: "🌾 Show farm fields", disabled: true });
    var chartBox = el("div", { class: "bb-chart" }), stat = el("div", { class: "bb-stat" }), extra = el("div", { class: "col", style: { gap: "6px" } });
    side.appendChild(el("h3", { text: "Train your brain" }));
    side.appendChild(goalList);
    side.appendChild(el("div", { class: "bb-lr" }, el("div", { html: "Learning rate (nudge size): " }, lrVal), lrIn, el("div", { class: "lbl" }, el("span", { text: "tiny" }), el("span", { text: "huge" }))));
    side.appendChild(el("div", { class: "bb-row" }, bTrain, bStep, bReset));
    side.appendChild(stat); side.appendChild(chartBox);
    side.appendChild(el("div", { class: "bb-row" }, bTest, bFarm)); side.appendChild(extra);
    var chart = L.canvas({ w: 340, h: 110, parent: chartBox, label: "loss and accuracy chart" });
    function setRun(on) { running = on; bTrain.innerHTML = on ? "⏸ Pause" : "▶ Train"; bTrain.className = "btn " + (on ? "warn" : "go"); }
    bTrain.onclick = function () { setRun(!running); RQ.audio.sfx("click"); };
    bStep.onclick = function () { step(1); RQ.audio.sfx("tick"); };
    bReset.onclick = function () { brain = Brain(L.rng, 6); ep = 0; hist = []; RQ.audio.sfx("whoosh"); L.toast("A brand-new brain with random weights.", "info"); };
    function complete(id, msg) { if (done[id]) return; done[id] = true; drawGoals(); RQ.audio.sfx("coin"); if (msg) L.toast(msg, "good", 2800); }
    function step(n) {
      for (var i = 0; i < n; i++) {
        var loss = epoch(brain, train, LRS[lrIdx]); ep++;
        if (!finite(brain)) { brain = Brain(L.rng, 6); hist = []; RQ.audio.sfx("boom"); L.toast("💥 The weights flew off to infinity! New brain.", "bad", 2600); return; }
        trainAcc = accuracy(brain, train);
        hist.push({ loss: loss, acc: trainAcc });
        if (hist.length > 600) hist.splice(0, hist.length - 600);
        if (LRS[lrIdx] >= 30) { chaosEp++; if (chaosEp >= 40) complete("chaos", "🌪️ Wobbly! A huge learning rate makes the loss jump around."); }
      }
      if (trainAcc >= 0.9 && ep >= 5) { if (!done.train) { complete("train", "🎉 90 % right on the training tiles!"); bTest.disabled = false; } }
    }
    bTest.onclick = function () {
      if (tested) return;
      tested = true; bTest.disabled = true; testAcc = accuracy(brain, test); RQ.audio.sfx("shutter");
      complete("test", "🔓 Test: " + Math.round(testAcc * 100) + " % right on tiles it never saw!");
      extra.appendChild(el("div", { class: "bb-note", html: "Test accuracy: <b>" + Math.round(testAcc * 100) + " %</b> on " + test.length + " hidden tiles (training: " + Math.round(trainAcc * 100) + " %)." }));
      bFarm.disabled = false;
    };
    bFarm.onclick = async function () {
      if (farmShown) return;
      farmShown = true; bFarm.disabled = true; setRun(false); RQ.audio.sfx("whoosh");
      var fooled = P.farm.filter(function (p) { return fwd(brain, feat(p)).o >= 0.5; }).length;
      var worst = P.farm.slice().sort(function (a, b) { return fwd(brain, feat(b)).o - fwd(brain, feat(a)).o; })[0];
      var crop = P.tiles[2], real = crop ? RQ.ForestNet.forward(net(), px(crop), 3) : null;
      var pBrain = worst ? fwd(brain, feat(worst)).o : 0;
      extra.appendChild(el("div", { class: "row", style: { alignItems: "center" } }, crop ? tileCanvas(crop, 72) : null,
        el("div", { html: "🌾 <b>" + fooled + " of " + P.farm.length + "</b> farm tiles fooled your brain" + (fooled ? "!" : " (close call: " + Math.round(pBrain * 100) + " %).") +
          (real ? "<br>Real ForestNet on this crop circle: forest <b>" + Math.round(real.pForest * 100) + " %</b>." : "") })));
      complete("farm");
      chartBox.style.display = "none"; bTest.parentNode.style.display = "none";
      await L.say("hoot", "Look, green farm fields sit right next to the forest dots! Two numbers are not enough to tell them apart.", { mood: "think" });
      if (!L.alive) return;
      await L.say("hoot", "The real ForestNet uses filters to see **texture**, and it trained on farms, lawns and parks too.");
      if (!L.alive) return;
      var fin = el("button", { class: "btn big go", html: "Finish ✔" }); extra.appendChild(fin); fin.scrollIntoView({ block: "nearest" });
      fin.onclick = function () {
        var stars = testAcc >= 0.95 ? 3 : testAcc >= 0.88 ? 2 : 1;
        L.win({ stars: stars, msg: "You trained a real tiny neural network in your browser. Test score: **" + Math.round(testAcc * 100) + " %**.",
          stats: { "Epochs": ep, "Training": Math.round(trainAcc * 100) + "%", "Test": Math.round(testAcc * 100) + "%", "Farms fooled": fooled + " / " + P.farm.length } });
      };
    };
    var heat = document.createElement("canvas"); heat.width = 48; heat.height = 48;
    var hctx = heat.getContext("2d"), him = hctx.createImageData(48, 48);
    var slowNag = false;
    L.loop(function (dt, t) {
      if (running) step(LRS[lrIdx] >= 30 ? 1 : 2);
      if (running && !slowNag && LRS[lrIdx] <= 0.03 && ep > 150 && trainAcc < 0.9) { slowNag = true; L.toast("🐢 So slow! Try a bigger learning rate.", "info", 2600); }
      // heat map of the brain's answer over the whole plot
      for (var gy = 0; gy < 48; gy++) for (var gx = 0; gx < 48; gx++) {
        var g = (gx + .5) / 48 * 100, b = (1 - (gy + .5) / 48) * 100, p = fwd(brain, feat({ g: g, b: b })).o, k = (gy * 48 + gx) * 4;
        if (p >= 0.5) { him.data[k] = 47; him.data[k + 1] = 158; him.data[k + 2] = 79; him.data[k + 3] = Math.round((p - .5) * 2 * 120 + 20); }
        else { him.data[k] = 125; him.data[k + 1] = 138; him.data[k + 2] = 153; him.data[k + 3] = Math.round((.5 - p) * 2 * 110 + 15); }
      }
      hctx.putImageData(him, 0, 0);
      o.back();
      ctx.save(); u.rr(ctx, o.M.l, o.M.t, o.pw, o.ph, 10); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(heat, o.M.l, o.M.t, o.pw, o.ph); ctx.restore();
      o.axes();
      train.forEach(function (p) { o.dot(p, { r: 7 }); });
      if (tested) test.forEach(function (p) { var ok = (fwd(brain, feat(p)).o >= 0.5) === !!p.y; o.dot(p, { r: 7, ring: ok ? "#ffd84d" : "#d1495b" }); });
      if (farmShown) P.farm.forEach(function (p) { o.dot(p, { farm: true, r: 9, glow: fwd(brain, feat(p)).o >= 0.5 && Math.sin(t * 8) > 0 }); });
      var rows = [{ kind: "forest", text: "forest tile" }, { kind: "city", text: "city / water / desert" }];
      if (farmShown) rows.push({ kind: "farm", text: "farm field (Kansas)" });
      legend(o, rows);
      if (!tested) {
        var lx = o.M.l + o.pw - 224, ly = o.Y(62);
        ctx.fillStyle = "rgba(255,255,255,.92)"; u.rr(ctx, lx, ly, 210, 30, 8); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = INK; ctx.font = "600 15px Fredoka, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("🔒 " + test.length + " test tiles hidden", lx + 10, ly + 15);
      }
      // chart
      var c2 = chart.ctx, W = 340, Hh = 110;
      c2.clearRect(0, 0, W, Hh);
      c2.fillStyle = "#4a5b6d"; c2.font = "600 12px Fredoka, sans-serif"; c2.textAlign = "left"; c2.textBaseline = "top";
      c2.fillText("— loss (wrongness)", 6, 4); c2.fillStyle = GREEN; c2.fillText("— accuracy", 130, 4);
      if (hist.length > 1) {
        var maxL = Math.max(0.8, Math.max.apply(null, hist.map(function (h) { return Math.min(h.loss, 5); })));
        [["loss", "#d1495b", maxL], ["acc", GREEN, 1]].forEach(function (s) {
          c2.strokeStyle = s[1]; c2.lineWidth = 2.5; c2.beginPath();
          hist.forEach(function (h, i) { var x = 4 + i / (hist.length - 1) * (W - 8), y = Hh - 6 - Math.min(h[s[0]], s[2]) / s[2] * (Hh - 26); if (i) c2.lineTo(x, y); else c2.moveTo(x, y); });
          c2.stroke();
        });
      }
      var last = hist[hist.length - 1];
      stat.innerHTML = '<span class="chip">Epoch ' + ep + '</span><span class="chip">Loss ' + (last ? last.loss.toFixed(2) : "–") + '</span><span class="chip">Right ' + Math.round(trainAcc * 100) + "%</span>";
    });
  }

  /* ------------------------------------------------------------ level 4 (expert): assemble ForestNet */
  // Parameters as PyTorch counts them (conv weights + BatchNorm weight and bias), from classify/model.py
  var STACK = [
    { k: "in", label: "📷 Input picture (red, green, blue)", shape: "3 × 64 × 64", p: 0, cls: "io" },
    { k: "c1", label: "Conv 3 → 24 + BatchNorm + ReLU", shape: "24 × 64 × 64", p: 3 * 24 * 9 + 48, cls: "conv" },
    { k: "pool", label: "Max pool 2 × 2", shape: "24 × 32 × 32", p: 0, cls: "pool" },
    { k: "c2", label: "Conv 24 → 48 + BatchNorm + ReLU", shape: "48 × 32 × 32", p: 24 * 48 * 9 + 96, cls: "conv" },
    { k: "pool", label: "Max pool 2 × 2", shape: "48 × 16 × 16", p: 0, cls: "pool" },
    { k: "c3", label: "Conv 48 → 96 + BatchNorm + ReLU", shape: "96 × 16 × 16", p: 48 * 96 * 9 + 192, cls: "conv" },
    { k: "pool", label: "Max pool 2 × 2", shape: "96 × 8 × 8", p: 0, cls: "pool" },
    { k: "c4", label: "Conv 96 → 160 + BatchNorm + ReLU", shape: "160 × 8 × 8", p: 96 * 160 * 9 + 320, cls: "conv" },
    { k: "gap", label: "Global average pool", shape: "160 numbers", p: 0, cls: "pool" },
    { k: "fc", label: "Dense 160 → 96 + ReLU", shape: "96 numbers", p: 160 * 96 + 96, cls: "dense" },
    { k: "head", label: "Forest head: 96 → 2 scores → chances (softmax)", shape: "not forest / forest", p: 96 * 2 + 2, cls: "dense" }
  ];
  var DECOYS = [{ k: "x1", label: "Conv 3 → 160 + BatchNorm + ReLU", cls: "conv" }, { k: "x2", label: "Dense 96 → 160", cls: "dense" }];
  var NEED = {
    in: "Every network starts with the picture itself.", c1: "The picture has red, green and blue parts: this block must take **3** in.",
    pool: "Time to squash: halve the size with a pool.", c2: "The last layer made 24 pictures: take **24** in.", c3: "The last layer made 48 pictures: take **48** in.",
    c4: "The last layer made 96 pictures: take **96** in.", gap: "Turn each of the 160 pictures into one number: average it.",
    fc: "160 numbers go into 96 hidden neurons.", head: "Last: 96 numbers in, 2 answers out."
  };
  function levelBuild(L) {
    var root = el("div", { class: "bb-build" }), stack = el("div", { class: "bb-stack" }), tray = el("div", { class: "bb-tray panel" });
    root.appendChild(stack); root.appendChild(tray); L.stage.appendChild(root);
    var slots = STACK.map(function (s, i) {
      var d = el("div", { class: "bb-slot" }, el("span", { class: "n", text: String(i + 1) }), el("span", { class: "lb", text: "?" }), el("span", { class: "shape", text: "" }), el("span", { class: "pp", text: "" }));
      stack.appendChild(d); return d;
    });
    var next = 0, mistakes = 0, total = 0;
    var count = el("div", { class: "bb-count", text: "0" }), blocks = el("div", { class: "bb-blocks" });
    tray.appendChild(el("b", { text: "Parameters (numbers to learn):" })); tray.appendChild(count);
    tray.appendChild(el("div", { class: "bb-tip", text: "Click the block that fits the glowing slot. The shapes must match!" }));
    tray.appendChild(el("div", { class: "bb-tip", html: "<b>BatchNorm</b> rescales each filter's numbers so training stays steady. It has 2 learned numbers per filter." }));
    tray.appendChild(blocks);
    var pile = u.shuffle(STACK.map(function (s) { return s; }).concat(DECOYS), L.rng);
    pile.forEach(function (b) {
      var btn = el("button", { class: "btn bb-block " + b.cls, text: b.label });
      btn.onclick = function () { place(b, btn); };
      blocks.appendChild(btn);
    });
    function mark() { slots.forEach(function (s, i) { s.classList.toggle("next", i === next); }); }
    mark();
    function place(b, btn) {
      if (next >= STACK.length || !L.alive) return;
      var want = STACK[next];
      if (b.k !== want.k) {
        mistakes++; RQ.audio.sfx("bad"); btn.classList.remove("shake"); void btn.offsetWidth; btn.classList.add("shake");
        L.toast("🔩 Doesn't fit! " + NEED[want.k], "bad", 2800);
        return;
      }
      RQ.audio.sfx("snap");
      var s = slots[next];
      s.classList.add("full"); s.querySelector(".lb").textContent = want.label; s.querySelector(".shape").textContent = "→ " + want.shape;
      s.querySelector(".pp").textContent = want.p ? "+" + u.fmt(want.p) : "";
      total += want.p; count.textContent = u.fmt(total);
      btn.remove(); next++; mark();
      if (next >= STACK.length) finish();
    }
    async function finish() {
      blocks.innerHTML = "";
      var manifest = net().manifest, heads = manifest.params - total;
      await L.wait(400); if (!L.alive) return;
      var helper = el("div", { class: "bb-slot full" }, el("span", { class: "n", text: "+" }), el("span", { text: "4 helper heads: photo type (view) · land cover · scene · aerial" }), el("span", { class: "shape", text: "→ which kind of picture, what it shows" }), el("span", { class: "pp", text: "+" + u.fmt(heads) }));
      stack.appendChild(helper); RQ.audio.sfx("powerup");
      total = manifest.params; count.textContent = u.fmt(total);
      tray.appendChild(el("div", { class: "bb-tip", html: "That's <b>" + u.fmt(manifest.params) + "</b>, exactly the number in ReSeed's model file. Trained on about <b>57,000</b> pictures in about <b>12 minutes</b> on one GPU." }));
      await L.say("hoot", "You built ForestNet! Now let's run the real weights through your stack.", { mood: "wow" });
      if (!L.alive) return;
      tray.appendChild(el("b", { text: "Run it on a real tile:" }));
      var row = el("div", { class: "bb-row" }), result = el("div", { style: { minHeight: "48px", fontWeight: "600" } });
      tray.appendChild(row); tray.appendChild(result);
      var ran = 0;
      P.tiles.forEach(function (t) {
        var b = el("button", { class: "btn", style: { flexDirection: "column", padding: "6px" }, "aria-label": t.title }, tileCanvas(t, 56), el("small", { text: t.title }));
        b.onclick = async function () {
          u.$$("button", row).forEach(function (x) { x.disabled = true; });
          for (var i = 0; i < slots.length; i++) { slots[i].classList.add("lit"); RQ.audio.sfx("tick"); await L.wait(110); if (!L.alive) return; slots[i].classList.remove("lit"); }
          var r = RQ.ForestNet.forward(net(), px(t), 3);
          result.innerHTML = "🧠 " + u.esc(t.title) + ": forest <b>" + Math.round(r.pForest * 100) + " %</b> → " + (r.forest ? "🌳 forest" : "🏙️ not forest");
          RQ.audio.sfx(r.forest ? "good" : "beep");
          ran++;
          u.$$("button", row).forEach(function (x) { x.disabled = false; });
          if (ran === 1) {
            var fin = el("button", { class: "btn big go", html: "Finish ✔" }); tray.appendChild(fin);
            fin.onclick = function () {
              L.win({ stars: mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1, msg: "You assembled ForestNet: 4 convolution blocks, pooling, 96 hidden neurons and a forest answer. **" + u.fmt(manifest.params) + "** parameters!",
                stats: { "Wrong blocks": mistakes } });
            };
          }
        };
        row.appendChild(b);
      });
    }
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g11",
    music: "lab",
    intro: [
      ["hoot", "Hoo! ForestNet is a **neural network**: a brain made of tiny number machines called neurons."],
      ["sprout", "Let's build one, piece by piece, and teach it to spot forests!"]
    ],
    outro: [
      ["hoot", "Neuron, filter, training, layers: you know what is inside ForestNet now. Splendid!"],
      ["sprout", "Next, let's see how giant AI models fit inside a GPU in the Model Garage!"]
    ],
    levels: [
      { title: "One neuron", goal: "Drag the line: forest dots on one side, grey dots on the other",
        intro: [["hoot", "Each dot is a real satellite tile. Green dots are tiles ForestNet called forest; grey dots are city, water or desert."],
                ["hoot", "A **neuron** draws one straight line. Drag the yellow handles so the Glitch Bugs disappear, then fire!"]],
        cards: ["neuron"],
        play: levelNeuron },
      { title: "Filter factory", goal: "Pick the 3 × 3 filter that makes the pattern glow",
        intro: [["mo", "Welcome to my filter factory! A **filter** is a tiny 3 × 3 grid of numbers that slides over the pixels."],
                ["mo", "At each spot it multiplies and adds. Pick the filter that makes the forest edge glow!"]],
        cards: ["convolution", "relu-pool"],
        play: levelFilters },
      { title: "Train a brain", goal: "Train, try a huge learning rate, test, then show it farm fields",
        intro: [["hoot", "This tiny brain starts with random weights. Each **epoch** it looks at every training tile and nudges its weights."],
                ["sprout", "Some tiles are locked in a vault for the test. Train, watch the loss drop, and finish the checklist!"]],
        cards: ["training", "train-test"],
        play: levelTrain },
      { title: "Build ForestNet (expert)", goal: "Stack ForestNet's real layers in the right order",
        intro: [["hoot", "Expert challenge! Stack ForestNet's real layers, from the picture at the top to the forest answer at the bottom."],
                ["mo", "Shapes must fit like pipes: what comes out of one layer must go into the next."]],
        cards: ["forestnet-arch"],
        play: levelBuild }
    ]
  });
})();
