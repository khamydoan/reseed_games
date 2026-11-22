/* g05 Potion Lab — Python virtual environments.
 * Every project brews in its own cauldron (environment). Spells typed in Pix's terminal make cauldrons,
 * activate them and pour potions (packages) in; every command does something visible in the lab.
 * Levels: conda create/activate/pip · environment.yml recipe · uv venv + python -m venv · numpy<2 vs numpy>=2
 * conflict · potion orders (activate the right cauldron before installing).
 * Stealth skills: environments, activation and the prompt, pip install, YAML, uv, venv, deactivate, cd,
 * dependency conflicts, conda env list. */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a";

  /* ------------------------------------------------------------ real ReSeed facts */
  // reseed/environment.yml, verbatim
  var YML = [
    "# conda env create -f environment.yml && conda activate reseed",
    "name: reseed",
    "channels: [conda-forge]",
    "dependencies:",
    "  - python=3.12",
    "  - numpy",
    "  - rasterio",
    "  - pyproj",
    "  - shapely",
    "  - scipy",
    "  - pillow",
    "  - pyarrow",
    "  - xarray",
    "  - pip",
    "  - pip:",
    "      - pystac-client",
    "      - planetary-computer",
    "      - odc-stac",
    "      - torch",
    "      - httpx",
    "      - fastapi",
    "      - uvicorn[standard]",
    "      - python-multipart",
    "      - pytest",
    "      - pymavlink"
  ];
  var CONDA_PKGS = ["numpy", "rasterio", "pyproj", "shapely", "scipy", "pillow", "pyarrow", "xarray", "pip"];
  var PIP_PKGS = ["pystac-client", "planetary-computer", "odc-stac", "torch", "httpx", "fastapi", "uvicorn[standard]", "python-multipart", "pytest", "pymavlink"];
  // output of `python -m reseed sites` (reseed/__main__.py prints id, category, name, country from config.SITES)
  var SITES_OUT = [
    "rondonia        forest_loss      Jaci-Paraná, Rondônia, Brazil",
    "dixie           forest_loss      Dixie Fire scar, Plumas National Forest, USA (California)",
    "ozarks          forest_seasonal  Mark Twain National Forest, Ozarks, USA (Missouri)",
    "kangaroo        forest_loss      Flinders Chase, Kangaroo Island, Australia",
    "kalimantan      forest_loss      Ketapang, West Kalimantan, Indonesia (Borneo)",
    "congo           forest_healthy   Salonga National Park, DR Congo",
    "manaus          river            Meeting of the Waters, Manaus, Brazil",
    "manhattan       city             Midtown Manhattan, USA (New York)",
    "la_interchange  streets          Harry Pregerson Interchange, Los Angeles, USA (California)",
    "new_capital     construction     New Administrative Capital, Egypt",
    "maldives        ocean            North Malé Atoll, Maldives",
    "kansas          fields           Center-pivot fields, Haskell County, USA (Kansas)",
    "palm_desert     lawns            Golf courses, Indian Wells, USA (California)"
  ];

  /* ------------------------------------------------------------ colours */
  var PAL = ["#4dabf7", "#63e6be", "#ffd43b", "#ff922b", "#f783ac", "#b197fc", "#69db7c", "#ff8787", "#66d9e8", "#e599f7"];
  var COLORS = { python: "#4b8bbe", numpy: "#4dabf7", rasterio: "#38d9a9", torch: "#ff6b35", scipy: "#8ce99a", shapely: "#ffa94d",
    pyproj: "#a9e34b", pillow: "#f783ac", "old-map-tool": "#5c7cfa", "new-ndvi-tool": "#51cf66", playwright: "#2ecc71", conda: "#43b02a" };
  function pcol(n) { n = String(n).replace(/[\s=<>[].*$/, ""); return COLORS[n] || PAL[u.fnv(n) % PAL.length]; }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, k) {
    var x = hex(a), y = hex(b), r = x.map(function (v, i) { return Math.round(v + (y[i] - v) * k); });
    return "#" + r.map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("");
  }
  var TOOL = { conda: ["conda env", "#43b02a"], uv: ["made by uv ⚡", "#c24ee0"], venv: ["made by venv", "#3776ab"],
    base: ["base (conda's own)", "#7d8597"], system: ["computer's Python", "#7d8597"] };

  /* ------------------------------------------------------------ the potion lab (canvas) */
  function makeLab(L, parent) {
    var H = 620, FLOOR = H - 96;
    var api = L.canvas({ w: 720, h: H, parent: parent, fill: true, bg: "linear-gradient(#2a2150 50%, #5b3d27 50%)", label: "potion lab with cauldrons" });
    var ctx = api.ctx, W = api.w;
    var lab = { pots: [], flyers: [], parts: [], floats: [], zaps: [], t: 0, api: api };
    var bugImg = new Image();
    bugImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg("bug", { mood: "happy" }));
    var rng = u.seeded("potion-lab"), shelf = [], stars = [];
    for (var i = 0; i < 16; i++) shelf.push({ col: PAL[Math.floor(rng() * PAL.length)], shape: Math.floor(rng() * 3), h: 22 + rng() * 20, ph: rng() * 6 });
    for (i = 0; i < 16; i++) stars.push({ x: rng(), y: rng(), ph: rng() * 6 });

    function find(n) { if (n && typeof n === "object") return n; for (var k = 0; k < lab.pots.length; k++) if (lab.pots[k].name === n) return lab.pots[k]; return null; }
    lab.get = find;
    /** Add a cauldron. o: {tool, folder, empty, instant} */
    lab.add = function (name, o) {
      o = o || {};
      var p = { name: name, tool: o.tool || "conda", folder: o.folder || null, empty: !!o.empty, items: [], level: 0, lv: 0, col: "#5f4b8b",
        active: false, glow: 0, appear: o.instant ? 1 : 0, overflow: false, over: 0, shake: 0, flash: 0, x: null, s: null, ph: Math.random() * 9,
        gig: .5, order: null, spark: 0 };
      lab.pots.push(p);
      if (!o.instant && !o.empty) { RQ.audio.sfx("whoosh"); puff(p); }
      return p;
    };
    /** Fill instantly (start of a level). */
    lab.fill = function (n, items, level, col) {
      var p = find(n); items.forEach(function (it) { p.items.push({ n: it, bad: false }); });
      p.level = p.lv = level; p.col = col || pcol(items[items.length - 1] || "python");
    };
    /** Show the cauldron that the prompt points at. */
    lab.activate = function (n, silent) {
      var p = find(n);
      lab.pots.forEach(function (q) { q.active = q === p; });
      if (p && !silent) { RQ.audio.sfx("powerup"); p.spark = 1; sparkle(p, "#ffd43b", 22); }
    };
    lab.flash = function (n) { var p = find(n); if (p) { p.flash = 1.4; p.shake = .6; } };
    lab.overflowing = function (n, on) { var p = find(n); p.overflow = on; if (on) { RQ.audio.sfx("boom"); p.shake = 1; } };
    lab.markBad = function (n, prefix, bad) { var p = find(n); p.items.forEach(function (it) { if (it.n.indexOf(prefix) === 0) it.bad = bad; }); };
    lab.removeItem = function (n, prefix) { var p = find(n); p.items = p.items.filter(function (it) { return it.n.indexOf(prefix) !== 0; }); };
    lab.float = function (n, text, col) { var p = find(n); if (!p) return; var g = geo(p); lab.floats.push({ x: g.x, y: g.rimY - 30, text: text, col: col || "#fff", life: 1.6 }); };
    /** Pour a potion bottle into a cauldron. Resolves when the potion lands. o: {fast, amount, label, col, replace} */
    lab.pour = function (n, name, o) {
      o = o || {};
      var p = find(n), col = o.col || pcol(name), dur = o.fast ? .55 : 1.25, sx = 60 + Math.random() * Math.max(100, W - 300);
      lab.flyers.push({ kind: "bottle", label: o.label || name, col: col, p: p, t: 0, dur: dur, sx: sx, sy: 92 });
      if (o.fast) lab.zaps.push({ p: p, life: .25 });
      return L.wait(dur * 1000 * .55).then(function () {
        if (!L.alive) return;
        if (o.replace) lab.removeItem(p, o.replace);
        p.items.push({ n: o.label || name, bad: false });
        p.level = Math.min(.96, p.level + (o.amount == null ? .14 : o.amount));
        p.col = p.items.length <= 1 && p.lv < .05 ? col : mix(p.col, col, .38);
        splash(p, col); blub(o.fast);
      });
    };
    /** Drop the Python crystal into a cauldron. */
    lab.crystal = function (n, label, fast) {
      var p = find(n), dur = fast ? .6 : 1.1;
      lab.flyers.push({ kind: "crystal", label: label, col: "#ffd43b", p: p, t: 0, dur: dur });
      return L.wait(dur * 1000 * .7).then(function () {
        if (!L.alive) return;
        p.items.push({ n: label, bad: false }); p.level = Math.max(p.level, .22);
        p.col = p.lv < .05 ? COLORS.python : mix(p.col, COLORS.python, .3);
        RQ.audio.sfx("bloom"); sparkle(p, "#ffd43b", 18);
      });
    };
    /** A bottle flies OUT of the cauldron (uninstall). */
    lab.unpour = function (n, prefix) {
      var p = find(n), it = p.items.filter(function (q) { return q.n.indexOf(prefix) === 0; })[0];
      if (!it) return;
      lab.removeItem(p, prefix);
      var g = geo(p);
      lab.flyers.push({ kind: "out", label: it.n, col: pcol(prefix), p: p, t: 0, dur: 1.1, sx: g.x, sy: g.rimY });
      p.level = Math.max(.2, p.level - .12); RQ.audio.sfx("jump");
    };
    lab.cheer = function (n) { var p = find(n); if (p) { sparkle(p, "#ffd43b", 26); sparkle(p, "#69db7c", 16); p.spark = 1; } };

    /* ---- particles */
    function puff(p) {
      var g = geo(p);
      for (var k = 0; k < 22; k++) lab.parts.push({ x: g.x + u.rand(-60, 60), y: FLOOR - u.rand(10, 60), vx: u.rand(-60, 60), vy: u.rand(-90, -20), life: .9, max: .9, col: "rgba(235,225,255,.8)", r: u.rand(10, 22), gr: -20, soft: true });
    }
    function splash(p, col) {
      var g = geo(p);
      for (var k = 0; k < 14; k++) lab.parts.push({ x: g.x + u.rand(-20, 20), y: g.rimY, vx: u.rand(-140, 140), vy: u.rand(-260, -90), life: .7, max: .7, col: col, r: u.rand(3, 7), gr: 700 });
    }
    function sparkle(p, col, nn) {
      var g = geo(p);
      for (var k = 0; k < nn; k++) lab.parts.push({ x: g.x + u.rand(-g.R, g.R), y: g.rimY + u.rand(-20, 60), vx: u.rand(-80, 80), vy: u.rand(-200, -60), life: 1.1, max: 1.1, col: col, r: u.rand(4, 8), gr: 120, star: true });
    }
    function blub(fast) { RQ.audio.tone({ f: fast ? 380 : 220, f2: fast ? 900 : 520, type: "sine", d: .14, v: .22 }); RQ.audio.sfx(fast ? "zap" : "splash"); }

    /* ---- geometry */
    function layout(dt) {
      W = api.w;
      var n = Math.max(lab.pots.length, 1), m = 26, slot = (W - 2 * m) / n, s = u.clamp(slot / 220, .56, 1.2);
      lab.slot = slot;
      lab.pots.forEach(function (p, k) {
        p.tx = m + slot * (k + .5);
        if (p.x == null) p.x = p.tx; else p.x += (p.tx - p.x) * Math.min(1, dt * 6);
        if (p.s == null) p.s = s; else p.s += (s - p.s) * Math.min(1, dt * 6);
      });
    }
    function geo(p) {
      var s = p.s || 1, R = 74 * s, bodyH = 112 * s, legH = 34 * s, bottom = FLOOR - legH;
      return { s: s, R: R, bodyH: bodyH, bottom: bottom, rimY: bottom - bodyH, x: (p.x || W / 2) + Math.sin(lab.t * 50) * p.shake * 5 };
    }
    lab.geo = geo;

    /* ---- drawing */
    function room(t) {
      var g = ctx.createLinearGradient(0, 0, 0, FLOOR);
      g.addColorStop(0, "#2a2050"); g.addColorStop(1, "#45387a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR);
      ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 2;
      for (var r = 0; r * 36 < FLOOR; r++) for (var c = -1; c * 74 < W; c++) { u.rr(ctx, c * 74 + (r % 2) * 37 + 3, r * 36 + 3, 68, 30, 7); ctx.stroke(); }
      // arched window with the night sky
      var wx = W - 128, wy = 22, ww = 96, wh = 126;
      ctx.save(); ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx, wy + ww / 2); ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(wx + ww, wy + wh); ctx.closePath();
      ctx.lineWidth = 12; ctx.strokeStyle = "#8a6a4a"; ctx.stroke();
      var sk = ctx.createLinearGradient(0, wy, 0, wy + wh); sk.addColorStop(0, "#0b1a3a"); sk.addColorStop(1, "#27508f");
      ctx.fillStyle = sk; ctx.fill(); ctx.clip();
      stars.forEach(function (st) { ctx.globalAlpha = .5 + .5 * Math.sin(t * 2 + st.ph); ctx.fillStyle = "#fff"; ctx.fillRect(wx + st.x * ww, wy + st.y * wh * .8, 2.5, 2.5); });
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(wx + ww * .65, wy + 40, 17, 0, 7); ctx.fillStyle = "#fff4c2"; ctx.fill();
      ctx.beginPath(); ctx.arc(wx + ww * .65 + 7, wy + 35, 15, 0, 7); ctx.fillStyle = "#16305e"; ctx.fill();
      ctx.restore();
      ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx, wy + ww / 2); ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(wx + ww, wy + wh); ctx.closePath(); ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = "#8a6a4a"; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy + 2); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + 76); ctx.lineTo(wx + ww, wy + 76); ctx.stroke();
      // shelf with bottles
      var sx = 20, sw = Math.max(220, W - 236), sy = 104;
      ctx.fillStyle = "#8a5a35"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      u.rr(ctx, sx, sy, sw, 14, 4); ctx.fill(); ctx.stroke();
      [sx + 26, sx + sw - 34].forEach(function (bx) { ctx.beginPath(); ctx.moveTo(bx, sy + 14); ctx.lineTo(bx + 8, sy + 38); ctx.lineTo(bx + 16, sy + 14); ctx.fillStyle = "#6f4527"; ctx.fill(); ctx.stroke(); });
      var nb = Math.max(5, Math.floor(sw / 54));
      for (var b = 0; b < nb; b++) {
        var bt = shelf[b % shelf.length], bx = sx + 34 + b * (sw - 68) / (nb - 1);
        shelfBottle(bx, sy, bt, t);
      }
      // candle
      var cx = sx + sw + 30;
      if (cx < W - 150) {
        ctx.fillStyle = "#fff4d6"; u.rr(ctx, cx - 8, sy - 34, 16, 34, 4); ctx.fill(); ctx.stroke();
        var fl = 1 + Math.sin(t * 17) * .12;
        ctx.beginPath(); ctx.ellipse(cx, sy - 44, 6 * fl, 11 * fl, 0, 0, 7); ctx.fillStyle = "#ffd43b"; ctx.fill();
      }
      // hanging sign
      var mx = (sx + Math.min(W - 150, sx + sw)) / 2, bw = 250, by = 156;
      ctx.strokeStyle = "#c8a165"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx - 90, sy + 14); ctx.lineTo(mx - 90, by); ctx.moveTo(mx + 90, sy + 14); ctx.lineTo(mx + 90, by); ctx.stroke();
      ctx.save(); ctx.translate(mx, by + 30); ctx.rotate(Math.sin(t * .9) * .015);
      ctx.fillStyle = "#a8743f"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, -bw / 2, -30, bw, 62, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c48a4f"; u.rr(ctx, -bw / 2 + 7, -23, bw - 14, 48, 8); ctx.fill();
      ctx.fillStyle = "#fff4d6"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 24px Fredoka, sans-serif"; ctx.fillText("POTION LAB", 0, -7);
      ctx.font = "600 14px Fredoka, sans-serif"; ctx.fillText("one project = one cauldron", 0, 15);
      ctx.restore();
      // floor
      ctx.fillStyle = "#5b3d27"; ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.fillStyle = "#4a311f"; for (var pl = 0; pl < 4; pl++) ctx.fillRect(0, FLOOR + 20 + pl * 22, W, 3);
      ctx.fillStyle = "#3c2818"; ctx.fillRect(0, FLOOR, W, 6);
    }
    function shelfBottle(x, sy, bt, t) {
      ctx.save(); ctx.translate(x, sy); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.fillStyle = bt.col;
      var h = bt.h;
      if (bt.shape === 0) { ctx.beginPath(); ctx.arc(0, -h * .45, h * .45, 0, 7); ctx.fill(); ctx.stroke(); u.rr(ctx, -4, -h * 1.15, 8, h * .35, 2); ctx.fillStyle = "#dfe7ef"; ctx.fill(); ctx.stroke(); }
      else if (bt.shape === 1) { u.rr(ctx, -h * .32, -h, h * .64, h, 5); ctx.fill(); ctx.stroke(); u.rr(ctx, -4, -h - 8, 8, 9, 2); ctx.fillStyle = "#b07a4a"; ctx.fill(); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(-4, -h); ctx.lineTo(-h * .42, 0); ctx.lineTo(h * .42, 0); ctx.lineTo(4, -h); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(-h * .18, -h * .7, 3, h * .35);
      ctx.restore();
    }
    function fire(x, y, s, k, t) {
      ctx.save(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.fillStyle = "#7a4b2a";
      ctx.translate(x, y - 7 * s); ctx.rotate(.16); u.rr(ctx, -32 * s, -6 * s, 64 * s, 12 * s, 6 * s); ctx.fill(); ctx.stroke();
      ctx.rotate(-.32); u.rr(ctx, -32 * s, -6 * s, 64 * s, 12 * s, 6 * s); ctx.fill(); ctx.stroke(); ctx.restore();
      [["#ff6b35", 1], ["#ffd43b", .62]].forEach(function (f) {
        ctx.fillStyle = f[0]; ctx.beginPath();
        for (var j = -2; j <= 2; j++) {
          var fx = x + j * 9 * s, fh = 40 * s * k * f[1] * (1 - Math.abs(j) * .2) * (.78 + .22 * Math.sin(t * 13 + j * 2.1));
          ctx.moveTo(fx - 8 * s, y - 10 * s); ctx.quadraticCurveTo(fx - 7 * s, y - 10 * s - fh * .6, fx, y - 10 * s - fh); ctx.quadraticCurveTo(fx + 7 * s, y - 10 * s - fh * .6, fx + 8 * s, y - 10 * s);
        }
        ctx.fill();
      });
    }
    function folder(p, g) {
      var w = Math.min(lab.slot - 10, Math.max(g.R * 3, 170 * g.s)), top = g.rimY - 58 * g.s, x0 = g.x - w / 2;
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.fillStyle = "#d9a53a";
      u.rr(ctx, x0, top - 26, Math.min(w * .62, 150), 34, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f2c46d"; u.rr(ctx, x0, top, w, FLOOR + 4 - top, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = "700 " + Math.round(15 + 3 * g.s) + "px Fredoka, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("📁 " + p.folder, x0 + 10, top - 11);
      if (p.empty) {
        ctx.setLineDash([8, 7]); ctx.strokeStyle = "rgba(29,43,58,.55)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(g.x, g.rimY + g.bodyH * .55, g.R * 1.05, g.bodyH * .62, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "rgba(29,43,58,.7)"; ctx.textAlign = "center"; ctx.font = "600 " + Math.round(15 * g.s + 3) + "px Fredoka, sans-serif";
        ctx.fillText("no cauldron yet", g.x, g.rimY + g.bodyH * .55);
      }
    }
    function chipText(x, y, text, bg, fg, size) {
      ctx.font = "700 " + size + "px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var w = ctx.measureText(text).width + 16;
      ctx.fillStyle = bg; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; u.rr(ctx, x - w / 2, y - size * .75, w, size * 1.5, size * .75); ctx.fill(); ctx.stroke();
      ctx.fillStyle = fg; ctx.fillText(text, x, y + 1);
      return w;
    }
    /** One line under the cauldron: the newest potions, older ones folded into "+N more". */
    function itemsLine(p, g) {
      var max = lab.slot - 14, size = Math.round(u.clamp(lab.slot / 15, 12, 16)), y = FLOOR + 58;
      ctx.font = "600 " + size + "px Fredoka, sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      var sep = ctx.measureText(" · ").width, shown = [], w = 0, k;
      for (k = p.items.length - 1; k >= 0; k--) {
        var it = p.items[k], txt = (it.bad ? "✗ " : "") + it.n, tw = ctx.measureText(txt).width;
        var reserve = k > 0 ? ctx.measureText("+" + k + " more").width + sep : 0;
        if (shown.length && w + tw + reserve > max) break;
        shown.unshift({ t: txt, w: tw, bad: it.bad }); w += tw + (shown.length > 1 ? sep : 0);
      }
      var rest = p.items.length - shown.length, head = rest ? "+" + rest + " more" : "", headW = head ? ctx.measureText(head).width + sep : 0;
      var x = g.x - (w + headW) / 2;
      if (head) { ctx.fillStyle = "#ffd43b"; ctx.fillText(head, x, y); x += headW - sep; ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillText(" · ", x, y); x += sep; }
      shown.forEach(function (s2, j) {
        ctx.fillStyle = s2.bad ? "#ff8787" : "#fff3c4"; ctx.fillText(s2.t, x, y); x += s2.w;
        if (j < shown.length - 1) { ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillText(" · ", x, y); x += sep; }
      });
    }
    function pot(p, t) {
      var g = geo(p), x = g.x, R = g.R, s = g.s;
      if (p.folder) folder(p, g);
      if (p.empty) return;
      var a = u.ease.outBack(u.clamp(p.appear, 0, 1));
      ctx.save(); ctx.globalAlpha = u.clamp(p.appear * 2, 0, 1);
      ctx.translate(x, FLOOR); ctx.scale(a, a); ctx.translate(-x, -FLOOR);
      // halo when active
      if (p.glow > .02) {
        var hg = ctx.createRadialGradient(x, g.rimY + g.bodyH * .4, 10, x, g.rimY + g.bodyH * .4, R * 2.1);
        hg.addColorStop(0, "rgba(255,220,90," + (.55 * p.glow) + ")"); hg.addColorStop(1, "rgba(255,220,90,0)");
        ctx.fillStyle = hg; ctx.fillRect(x - R * 2.2, g.rimY - R * 1.7, R * 4.4, R * 4.2);
        ctx.beginPath(); ctx.ellipse(x, FLOOR + 4, R * 1.4, 14 * s, 0, 0, 7); ctx.fillStyle = "rgba(255,212,59," + (.6 * p.glow) + ")"; ctx.fill();
      }
      fire(x, FLOOR, s, p.active ? 1.3 : .75, t + p.ph);
      // legs
      ctx.fillStyle = "#2a2d36"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      [-.56, .56].forEach(function (k) { u.rr(ctx, x + k * R - 7 * s, g.bottom - 8 * s, 14 * s, 42 * s, 5 * s); ctx.fill(); ctx.stroke(); });
      // body
      var iron = p.tool === "base" || p.tool === "system" ? ["#7a8091", "#5a6070", "#3c414d"] : ["#4a5062", "#2d313c", "#16181f"];
      var gr = ctx.createLinearGradient(x - R, 0, x + R, 0); gr.addColorStop(0, iron[0]); gr.addColorStop(.45, iron[1]); gr.addColorStop(1, iron[2]);
      ctx.beginPath(); ctx.moveTo(x - R, g.rimY);
      ctx.bezierCurveTo(x - R * 1.34, g.rimY + g.bodyH * .55, x - R * .9, g.bottom, x, g.bottom);
      ctx.bezierCurveTo(x + R * .9, g.bottom, x + R * 1.34, g.rimY + g.bodyH * .55, x + R, g.rimY);
      ctx.closePath(); ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.lineWidth = 6 * s; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(x - R * .5, g.rimY + g.bodyH * .42, R * .5, Math.PI * .78, Math.PI * 1.12); ctx.stroke();
      // rim and mouth
      ctx.beginPath(); ctx.ellipse(x, g.rimY, R * 1.1, R * .3, 0, 0, 7); ctx.fillStyle = iron[0]; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, g.rimY, R * .9, R * .2, 0, 0, 7); ctx.fillStyle = "#0d0e13"; ctx.fill();
      if (p.lv > .01) {
        ctx.save(); ctx.beginPath(); ctx.ellipse(x, g.rimY, R * .9, R * .2, 0, 0, 7); ctx.clip();
        var k = .45 + .55 * p.lv, ly = g.rimY + (1 - p.lv) * R * .17;
        ctx.beginPath(); ctx.ellipse(x, ly, R * .9 * k, R * .2 * k, 0, 0, 7); ctx.fillStyle = p.col; ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - R * .28 * k, ly - R * .03, R * .3 * k, R * .045 * k, 0, 0, 7); ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fill();
        ctx.restore();
      }
      // foam when it bubbles over
      if (p.over > .03) {
        var fc = ["#c0eb75", "#e599f7", "#d8f5a2"];
        for (var f = 0; f < 11; f++) {
          var ang = Math.PI * (f / 10), fx = x - Math.cos(ang) * R * 1.02, fy = g.rimY + Math.sin(ang) * R * .26;
          ctx.beginPath(); ctx.arc(fx, fy - 6 * s, (12 + 5 * Math.sin(t * 6 + f)) * s * p.over, 0, 7); ctx.fillStyle = fc[f % 3]; ctx.fill();
        }
        [-.95, -.4, .35, .9].forEach(function (k2, j) {
          var len = (30 + 22 * Math.sin(t * 2.4 + j * 1.7)) * s * p.over, dx = x + k2 * R * 1.05;
          ctx.fillStyle = fc[j % 3]; u.rr(ctx, dx - 6 * s, g.rimY, 12 * s, len + 10 * s, 6 * s); ctx.fill();
          ctx.beginPath(); ctx.arc(dx, g.rimY + len + 10 * s, 8 * s, 0, 7); ctx.fill();
        });
        ctx.beginPath(); ctx.ellipse(x, FLOOR + 8, R * 1.5 * p.over, 9 * s, 0, 0, 7); ctx.fillStyle = "rgba(192,235,117,.75)"; ctx.fill();
      }
      // name plate on the belly
      var fs = Math.max(14, Math.round(21 * s));
      ctx.font = "700 " + fs + "px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var pw = Math.max(R * .9, ctx.measureText(p.name).width + 20), py = g.rimY + g.bodyH * .5;
      ctx.fillStyle = "#f4e3b5"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, x - pw / 2, py - fs * .8, pw, fs * 1.6, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillText(p.name, x, py + 1);
      // warning flash
      if (p.flash > 0) {
        var fa = Math.min(1, p.flash) * (.6 + .4 * Math.sin(t * 20));
        ctx.globalAlpha = fa; ctx.lineWidth = 6; ctx.strokeStyle = "#ff4d4f";
        ctx.beginPath(); ctx.ellipse(x, g.rimY + g.bodyH * .45, R * 1.5, g.bodyH * .95, 0, 0, 7); ctx.stroke();
        chipText(x, g.rimY - R * .3 - 26, "✋ not here!", "#ff6b6b", "#fff", 17); ctx.globalAlpha = 1;
      }
      ctx.restore();
      // labels below the cauldron
      ctx.save(); ctx.globalAlpha = u.clamp(p.appear * 2, 0, 1);
      var tl = TOOL[p.tool] || TOOL.conda;
      chipText(x, FLOOR + 27, tl[0], tl[1], "#fff", Math.round(13 + 3 * s));
      itemsLine(p, g);
      // active ribbon
      if (p.glow > .3 && p.flash <= 0) {
        var by = g.rimY - R * .3 - 26 + Math.sin(t * 4) * 4;
        ctx.globalAlpha = Math.min(1, p.glow);
        chipText(x, by, "★ ACTIVE ★", "#ffd43b", INK, Math.round(14 + 3 * s));
      }
      // order tag (level 5)
      if (p.order) {
        var oy = g.rimY - R * .3 - (p.glow > .3 ? 62 : 26) + Math.sin(t * 3 + 1) * 3;
        ctx.globalAlpha = 1; chipText(x, oy, "📜 needs " + p.order, "#fff8e1", INK, Math.round(13 + 3 * s));
      }
      ctx.restore();
      // bugs giggle on a bubbling-over cauldron
      if (p.over > .5 && bugImg.complete && bugImg.naturalWidth) {
        [-1, 1].forEach(function (side, j) {
          var bs = 46 * s, bx = x + side * R * .7 - bs / 2, by2 = g.rimY - bs - Math.abs(Math.sin(t * 6 + j * 1.6)) * 18 * s;
          ctx.drawImage(bugImg, bx, by2, bs, bs);
        });
      }
    }
    function bottle(x, y, col, rot, alpha) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
      ctx.lineWidth = 3; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.arc(0, 8, 17, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.stroke();
      u.rr(ctx, -6, -19, 12, 15, 3); ctx.fillStyle = "#dfe7ef"; ctx.fill(); ctx.stroke();
      if (rot > -1) { u.rr(ctx, -7, -26, 14, 8, 3); ctx.fillStyle = "#b07a4a"; ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(-6, 3, 4, 7, -.4, 0, 7); ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fill();
      ctx.restore();
    }
    function crystal(x, y, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.lineWidth = 3; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(16, -6); ctx.lineTo(0, 22); ctx.lineTo(-16, -6); ctx.closePath();
      var cg = ctx.createLinearGradient(-16, -24, 16, 22); cg.addColorStop(0, "#4b8bbe"); cg.addColorStop(.5, "#9ad0ff"); cg.addColorStop(1, "#ffd43b");
      ctx.fillStyle = cg; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(16, -6); ctx.moveTo(0, -24); ctx.lineTo(0, 22); ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
    function flyers(dt) {
      lab.flyers = lab.flyers.filter(function (f) {
        f.t += dt; var k = f.t / f.dur, g = geo(f.p), x, y, rot = 0, al = 1;
        if (f.kind === "bottle") {
          var tx = g.x + 40 * g.s, ty = g.rimY - 92 * g.s;
          if (k < .35) { var e = u.ease.inOut(k / .35); x = u.lerp(f.sx, tx, e); y = u.lerp(f.sy, ty, e) - Math.sin(e * Math.PI) * 50; rot = -e * .4; }
          else if (k < .8) {
            x = tx; y = ty; rot = -u.lerp(.4, 2.2, u.clamp((k - .35) / .12, 0, 1));
            if (k > .45 && k < .76) {
              var nx = x + 25 * Math.sin(rot), ny = y - 25 * Math.cos(rot);
              lab.parts.push({ x: nx + u.rand(-3, 3), y: ny, vx: u.rand(-15, 15), vy: 90, life: 2, max: 2, col: f.col, r: u.rand(4, 7), gr: 900, until: g.rimY });
            }
          } else { x = tx; y = ty - (k - .8) * 220; rot = -2.2; al = Math.max(0, 1 - (k - .8) / .2); }
          bottle(x, y, f.col, rot, al);
          if (k < .8) chipText(x, y + 40, f.label, "#fff", INK, 15);
        } else if (f.kind === "crystal") {
          x = g.x; y = u.lerp(-30, g.rimY - 6, u.ease.outCubic(Math.min(1, k / .7))); rot = f.t * 5; al = k < .72 ? 1 : Math.max(0, 1 - (k - .72) / .2);
          ctx.globalAlpha = al; crystal(x, y, rot); if (k < .7) chipText(x + 64, y, f.label, "#fff", INK, 15); ctx.globalAlpha = 1;
        } else if (f.kind === "out") {
          var e2 = u.ease.outCubic(Math.min(1, k)); x = f.sx + e2 * 140; y = f.sy - Math.sin(e2 * Math.PI) * 160 - e2 * 40; rot = e2 * 6; al = 1 - Math.max(0, (k - .7) / .3);
          bottle(x, y, f.col, rot, al); ctx.globalAlpha = al; chipText(x, y + 42, f.label, "#ffe0e4", INK, 15); ctx.globalAlpha = 1;
        }
        return k < 1;
      });
    }
    function particles(dt) {
      lab.parts = lab.parts.filter(function (q) {
        q.life -= dt; q.vy += (q.gr || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.until != null && q.y >= q.until) return false;
        var al = Math.max(0, q.life / q.max);
        ctx.globalAlpha = q.soft ? al * .8 : Math.min(1, al * 1.5); ctx.fillStyle = q.col;
        if (q.star) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.life * 4); ctx.fillRect(-q.r, -q.r / 3, q.r * 2, q.r / 1.5); ctx.fillRect(-q.r / 3, -q.r, q.r / 1.5, q.r * 2); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        return q.life > 0;
      });
      lab.floats = lab.floats.filter(function (fl) {
        fl.life -= dt; fl.y -= 40 * dt; ctx.globalAlpha = Math.min(1, fl.life);
        chipText(fl.x, fl.y, fl.text, fl.col, INK, 18); ctx.globalAlpha = 1;
        return fl.life > 0;
      });
      lab.zaps = lab.zaps.filter(function (z) {
        z.life -= dt; var g = geo(z.p); ctx.strokeStyle = "#fff59d"; ctx.lineWidth = 5; ctx.globalAlpha = Math.max(0, z.life * 4);
        ctx.beginPath(); ctx.moveTo(g.x + 10, 0); for (var k = 1; k <= 6; k++) ctx.lineTo(g.x + (k % 2 ? -18 : 18), (g.rimY - 20) * k / 6); ctx.stroke(); ctx.globalAlpha = 1;
        return z.life > 0;
      });
    }
    L.loop(function (dt, t) {
      lab.t = t; layout(dt);
      lab.pots.forEach(function (p) {
        p.lv += (p.level - p.lv) * Math.min(1, dt * 3);
        p.glow += ((p.active ? 1 : 0) - p.glow) * Math.min(1, dt * 5);
        p.over += ((p.overflow ? 1 : 0) - p.over) * Math.min(1, dt * 3);
        if (!p.empty) p.appear = Math.min(1, p.appear + dt * 2.2);
        p.shake = Math.max(p.overflow ? .5 : 0, p.shake - dt * 1.5);
        p.flash = Math.max(0, p.flash - dt);
        if (!p.empty && p.lv > .05 && Math.random() < dt * (1.5 + p.lv * 5 + p.over * 16)) {
          var g = geo(p);
          lab.parts.push({ x: g.x + u.rand(-.6, .6) * g.R, y: g.rimY - 4, vx: u.rand(-10, 10), vy: u.rand(-60, -25), life: .9, max: .9, col: mix(p.col, "#ffffff", .35), r: u.rand(3, 7) * g.s, gr: -10 });
        }
        if (p.overflow && p.over > .5) { p.gig -= dt; if (p.gig <= 0) { p.gig = 2.2; RQ.audio.sfx("giggle"); } }
      });
      room(t);
      lab.pots.forEach(function (p) { pot(p, t); });
      flyers(dt); particles(dt);
    });
    return lab;
  }

  /* ------------------------------------------------------------ shared scene: lab + mission card + terminal */
  function scene(L, o) {
    o = o || {};
    var root = u.el("div", { class: "fill pl-root" });
    var left = u.el("div", { class: "pl-left" }), right = u.el("div", { class: "pl-right" });
    root.appendChild(left); root.appendChild(right); L.stage.appendChild(root);
    var card = u.el("div", { class: "panel pl-mission" });
    var termBox = u.el("div", { class: "pl-termbox" });
    var fillBtn = u.el("button", { class: "btn small", title: "Type the spell for me", html: "🪄 Fill it in" });
    var castBtn = u.el("button", { class: "btn small primary", title: "Press Enter", html: "⏎ Cast" });
    var tools = u.el("div", { class: "pl-tools" }, u.el("span", { class: "tip", html: "<kbd>Tab</kbd> finishes a spell · <kbd>Enter</kbd> casts it" }), fillBtn, castBtn);
    right.appendChild(card); right.appendChild(termBox); right.appendChild(tools);
    var S = { L: L, root: root, left: left, right: right, card: card, termBox: termBox, tools: tools, miss: 0, helped: 0, cast: 0, want: null };
    S.lab = makeLab(L, left);
    S.term = RQ.term.mount(termBox, { user: "kid", host: "lab", cwd: o.cwd || "~", title: "Pix's terminal", height: "100%", env: o.env || null });
    function input() { return termBox.querySelector("input.cmd"); }
    // Tab completes the spell we are waiting for (works for every kind of expect)
    L.on(termBox, "keydown", function (e) {
      if (e.key !== "Tab" || !S.want || !e.target.classList || !e.target.classList.contains("cmd")) return;
      var v = e.target.value;
      if (v && S.want.indexOf(v) === 0 && v !== S.want) { e.target.value = S.want; e.target.dispatchEvent(new Event("input")); RQ.audio.sfx("pop"); }
    }, true);
    L.on(fillBtn, "click", function () {
      var inp = input(); if (!inp || !S.want) return;
      inp.value = S.want; inp.dispatchEvent(new Event("input")); inp.focus(); S.helped++; RQ.audio.sfx("pop");
    });
    L.on(castBtn, "click", function () {
      var inp = input(); if (!inp) return;
      inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); var nx = input(); if (nx) nx.focus();
    });
    /** Mission card with numbered steps. */
    S.steps = function (title, list, sub) {
      card.innerHTML = "";
      card.appendChild(u.el("h3", { html: "🧾 " + RQ.ui.md(title) }));
      if (sub) card.appendChild(u.el("div", { class: "pl-sub", html: RQ.ui.md(sub) }));
      S.stepEls = list.map(function (txt, i) {
        var e = u.el("div", { class: "pl-step" }, u.el("b", { class: "n", text: String(i + 1) }), u.el("span", { html: RQ.ui.md(txt) }));
        card.appendChild(e); return e;
      });
    };
    S.step = function (i) {
      (S.stepEls || []).forEach(function (e, k) {
        e.classList.toggle("done", k < i); e.classList.toggle("now", k === i);
        e.querySelector(".n").textContent = k < i ? "✓" : String(k + 1);
      });
    };
    /** Ask for one spell. o: {alts, ghost:false, special(cmd)->msg, hint} */
    S.ask = function (want, o2) {
      o2 = o2 || {};
      var ok = [want].concat(o2.alts || []);
      var spec = { ghost: o2.ghost === false ? "" : want };
      spec.expect = function (c) { return ok.indexOf(c) >= 0; };
      spec.wrong = function (c, tries) {
        S.miss++;
        var msg = (o2.special && o2.special(c)) || fizzle(c, spec.ghost ? null : o2.hint);
        if (!spec.ghost && tries >= 1) { spec.ghost = want; msg += "\n[y]Now copy the grey letters (or type the start and press Tab).[/y]"; }
        return msg;
      };
      S.want = want;
      return S.term.ask(spec).then(function (c) { S.want = null; S.cast++; return c; });
    };
    S.stars = function () { var bad = S.miss + S.helped; return bad <= 1 ? 3 : bad <= 4 ? 2 : 1; };
    S.stats = function () { return { "Spells cast": S.cast, "Fizzles": S.miss, "Magic help": S.helped }; };
    return S;
  }
  function fizzle(c, hint) {
    var w0 = c.split(" ")[0] || "?";
    var known = ["conda", "pip", "pip3", "uv", "python", "python3", "source", ".", "deactivate", "cd", "ls", "clear"];
    if (known.indexOf(w0) < 0) return "[r]" + w0 + ": command not found[/r] [dim](check the first word of the spell)[/dim]";
    return "[r]Fizzle! That spell did not work.[/r] " + (hint ? "[y]Hint: " + hint + "[/y]" : "[y]Check it letter by letter against the grey letters.[/y]");
  }
  function pipWhenBase(lab, active) {
    return function (c) {
      if (/^pip3? install/.test(c) || /^python3? -m pip install/.test(c) || /^uv pip install/.test(c)) {
        lab.flash(active);
        if (active === "system" && /^uv /.test(c)) return "[y]Pause! In this game, step into .venv before pouring. (Real uv can find a .venv even when you haven't stepped in.)[/y]";
        if (active === "system") return "[y]Stop! No cauldron is active, so pip would pour into the computer's own Python. Step into .venv first![/y]";
        return "[y]Stop! (" + active + ") is still active, so that potion would pour into " + active + ". Activate the right cauldron first![/y]";
      }
      return null;
    };
  }
  function condaHeader(t) {
    return t.printSlow(["Channels:", " - conda-forge", "Platform: linux-64", "Collecting package metadata (repodata.json): done", "Solving environment: done"], 90);
  }

  /* ------------------------------------------------------------ L1: first cauldron (conda) */
  async function lvFirst(L) {
    var S = scene(L, { env: "base" }), lab = S.lab, t = S.term;
    lab.add("base", { tool: "base", instant: true }); lab.fill("base", ["python 3.13", "conda"], .5, "#9aa0b8");
    lab.activate("base", true);
    S.steps("Brew the ReSeed cauldron", ["Make a cauldron called **reseed**", "**Activate** it", "Pour in **numpy**"]);
    S.step(0);
    t.print("[dim]# Grey letters show the spell. Type it, then press Enter.[/dim]");
    await S.ask("conda create -n reseed python=3.12", { alts: ["conda create --name reseed python=3.12", "conda create -n reseed python=3.12 -y", "conda create -y -n reseed python=3.12"] });
    if (!L.alive) return;
    await condaHeader(t); if (!L.alive) return;
    lab.add("reseed", { tool: "conda" });
    await t.printSlow(["", "## Package Plan ##", "  environment location: /home/kid/miniconda3/envs/reseed", "  added / updated specs:", "    - python=3.12", "", "Proceed ([y]/n)? y"], 90);
    if (!L.alive) return;
    await lab.crystal("reseed", "python 3.12"); if (!L.alive) return;
    await t.progress("Executing transaction", 900); if (!L.alive) return;
    await t.printSlow(["#", "# To activate this environment, use", "#", "#     $ conda activate reseed", "#"], 60);
    if (!L.alive) return;
    S.step(1);
    await L.talk([["pix", "A brand-new cauldron! But look at the prompt: it still says `(base)`."],
      ["pix", "Step into the new cauldron with `conda activate reseed`. Then potions pour there, not into **base**."]]);
    if (!L.alive) return;
    await S.ask("conda activate reseed", { special: pipWhenBase(lab, "base") });
    if (!L.alive) return;
    t.setEnv("reseed"); lab.activate("reseed");
    L.toast("The prompt says **(reseed)** now: that cauldron is active!", "good", 2600);
    S.step(2);
    await S.ask("pip install numpy", { alts: ["python -m pip install numpy", "pip3 install numpy", "conda install numpy"] });
    if (!L.alive) return;
    await t.printSlow(["Collecting numpy", "  Downloading numpy-2.2.6-cp312-cp312-manylinux_2_17_x86_64.whl (16.8 MB)"], 120);
    if (!L.alive) return;
    var pr = t.progress("  ", 1000);
    await lab.pour("reseed", "numpy", { amount: .3 }); await pr;
    if (!L.alive) return;
    await t.printSlow(["Installing collected packages: numpy", "[g]Successfully installed numpy-2.2.6[/g]"], 120);
    if (!L.alive) return;
    S.step(3); lab.cheer("reseed"); lab.float("reseed", "+ numpy", "#d0ebff");
    await L.wait(700); if (!L.alive) return;
    var a = await L.choose("pix", "Quick check! How can you tell which cauldron is active?", ["The prompt shows its name, like `(reseed)`", "The computer beeps", "You can't tell"]);
    if (!L.alive) return;
    if (a !== 0) { S.miss++; await L.say("pix", "Look at the start of the prompt line. `(reseed)` means the reseed cauldron is active.", { mood: "think" }); }
    if (!L.alive) return;
    L.win({ stars: S.stars(), msg: "Your first cauldron! **create** it, **activate** it, then **pip install**: the safe order in this game.", stats: S.stats() });
  }

  /* ------------------------------------------------------------ L2: the recipe (environment.yml) */
  function ymlHTML(line) {
    var e = u.esc(line), m;
    if (/^#/.test(line)) return '<span class="yc">' + e + "</span>";
    if ((m = /^(\s*)(- )(pip:)$/.exec(line))) return m[1] + '<span class="yd">' + m[2] + '</span><span class="yk">' + m[3] + "</span>";
    if ((m = /^(\s*)(- )(.*)$/.exec(line))) return m[1] + '<span class="yd">' + m[2] + '</span><span class="yv">' + u.esc(m[3]) + "</span>";
    if ((m = /^(\w+:)(.*)$/.exec(line))) return '<span class="yk">' + m[1] + '</span><span class="yv">' + u.esc(m[2]) + "</span>";
    return e;
  }
  async function lvRecipe(L) {
    var S = scene(L, { env: "base" }), lab = S.lab, t = S.term;
    lab.add("base", { tool: "base", instant: true }); lab.fill("base", ["python 3.13", "conda"], .5, "#9aa0b8");
    lab.activate("base", true);
    // the recipe scroll covers the lab while we read it
    var scroll = u.el("div", { class: "pl-scroll" }, u.el("div", { class: "pl-scroll-h", html: "📜 <b>environment.yml</b> · the real ReSeed recipe" }));
    var rows = YML.map(function (line) { var r = u.el("div", { class: "yl", html: ymlHTML(line) }); scroll.appendChild(r); return r; });
    S.left.appendChild(scroll);
    S.termBox.style.display = "none"; S.tools.style.display = "none";
    var quiz = u.el("div", { class: "panel pl-quiz" }); S.right.appendChild(quiz);
    S.steps("Recipe detective", ["Read the recipe on the left", "Answer Hoot's 4 questions"], "Every answer is written in the recipe.");
    S.step(1);
    var QS = [
      { q: "What will the new cauldron be called?", a: ["`base`", "`reseed`", "`conda-forge`"], ok: 1, line: 1 },
      { q: "Which **Python** version goes in?", a: ["3.12", "2.7", "3.8"], ok: 0, line: 4 },
      { q: "Where does conda shop for potions? That is the **channel**.", a: ["The app store", "`pip`", "`conda-forge`"], ok: 2, line: 2 },
      { q: "Which potion comes from **pip**, not from conda?", a: ["`numpy`", "`torch`", "`python`"], ok: 1, line: 18 }
    ];
    var cur = null;
    L.on(window, "keydown", function (e) {
      if (!cur || document.querySelector(".rq-talk, .rq-overlay")) return;
      var n = parseInt(e.key, 10); if (n >= 1 && n <= cur.btns.length) { e.preventDefault(); cur.btns[n - 1].click(); }
    });
    function ask(Q, i) {
      return new Promise(function (resolve) {
        quiz.innerHTML = "";
        quiz.appendChild(u.el("div", { class: "muted", text: "Recipe question " + (i + 1) + " of " + QS.length }));
        quiz.appendChild(u.el("div", { class: "q", html: RQ.ui.md(Q.q) }));
        var btns = Q.a.map(function (txt, k) {
          var b = u.el("button", { class: "btn", html: '<b class="k">' + (k + 1) + "</b> " + RQ.ui.md(txt) });
          b.onclick = function () {
            if (!L.alive || b.disabled || !cur) return;
            if (k === Q.ok) {
              b.classList.add("ok"); rows[Q.line].classList.remove("peek"); rows[Q.line].classList.add("hit");
              rows[Q.line].scrollIntoView({ block: "nearest", behavior: "smooth" });
              RQ.audio.sfx("good"); var r = b.getBoundingClientRect(); RQ.ui.float(r.left + r.width / 2, r.top, "+1");
              cur = null; L.timeout(resolve, 650);
            } else {
              S.miss++; b.classList.add("no", "shake"); b.disabled = true; RQ.audio.sfx("bad");
              rows[Q.line].classList.add("peek"); rows[Q.line].scrollIntoView({ block: "nearest", behavior: "smooth" });
              L.toast("💡 Look at the glowing line in the recipe.", "info", 2200);
            }
          };
          quiz.appendChild(b); return b;
        });
        cur = { btns: btns };
      });
    }
    for (var i = 0; i < QS.length; i++) { await ask(QS[i], i); if (!L.alive) return; }
    rows[0].classList.add("peek"); rows[0].scrollIntoView({ block: "nearest" });
    await L.say("hoot", "The first line starts with `#`, a note for humans. It even tells you the spell!");
    if (!L.alive) return;
    scroll.classList.add("gone"); RQ.audio.sfx("whoosh");
    await L.wait(780); if (!L.alive) return;
    scroll.remove(); quiz.remove(); S.termBox.style.display = ""; S.tools.style.display = "";
    S.steps("Brew the whole recipe", ["Brew from **environment.yml**", "Activate **reseed**", "Run ReSeed!"]);
    S.step(0);
    t.print("[dim]# The recipe file is right here in the reseed folder.[/dim]");
    await S.ask("conda env create -f environment.yml", { alts: ["conda env create --file environment.yml", "conda env create --file=environment.yml"] });
    if (!L.alive) return;
    await condaHeader(t); if (!L.alive) return;
    lab.add("reseed", { tool: "conda" });
    await L.wait(350); if (!L.alive) return;
    await lab.crystal("reseed", "python 3.12", true); if (!L.alive) return;
    t.print("Downloading and Extracting Packages:");
    var pr = t.progress("", CONDA_PKGS.length * 230 + 300);
    for (var c = 0; c < CONDA_PKGS.length; c++) { lab.pour("reseed", CONDA_PKGS[c], { fast: true, amount: .035 }); await L.wait(230); if (!L.alive) return; }
    await pr; if (!L.alive) return;
    await t.printSlow(["Preparing transaction: done", "Verifying transaction: done", "Executing transaction: done", "Installing pip dependencies:"], 80);
    if (!L.alive) return;
    pr = t.progress("", PIP_PKGS.length * 230 + 300);
    for (c = 0; c < PIP_PKGS.length; c++) { lab.pour("reseed", PIP_PKGS[c], { fast: true, amount: .035 }); await L.wait(230); if (!L.alive) return; }
    await pr; if (!L.alive) return;
    await t.printSlow(["done", "#", "# To activate this environment, use", "#", "#     $ conda activate reseed", "#"], 60);
    if (!L.alive) return;
    lab.float("reseed", "20 potions!", "#fff3bf");
    S.step(1);
    await S.ask("conda activate reseed", { ghost: false, hint: "the last line of the output tells you!", special: pipWhenBase(lab, "base") });
    if (!L.alive) return;
    t.setEnv("reseed"); lab.activate("reseed");
    S.step(2);
    await L.say("hoot", "Every potion is in. Now ask ReSeed to list its demo sites!");
    if (!L.alive) return;
    await S.ask("python -m reseed sites", { alts: ["python3 -m reseed sites"] });
    if (!L.alive) return;
    await t.printSlow(SITES_OUT, 70); if (!L.alive) return;
    S.step(3); lab.cheer("reseed");
    L.toast("ReSeed runs! Your site **" + RQ.mySiteId() + "** is on the list.", "good", 2600);
    await L.wait(1500); if (!L.alive) return;
    L.win({ stars: S.stars(), msg: "One recipe file, one spell, **20 potions**. Anyone can rebuild ReSeed's cauldron with `environment.yml`.", stats: S.stats() });
  }

  /* ------------------------------------------------------------ L3: speedy uv, then python -m venv */
  async function lvUv(L) {
    var S = scene(L, { cwd: "~/ndvi-app" }), lab = S.lab, t = S.term;
    lab.add("system", { tool: "system", instant: true }); lab.fill("system", ["python 3.12"], .45, "#9aa0b8");
    var A = lab.add("ndvi-app", { folder: "ndvi-app/", empty: true, tool: "uv", instant: true });
    lab.activate("system", true); // no cauldron active: pip would pour into the computer's own Python
    S.steps("A speedy uv cauldron", ["Make a `.venv` with **uv**", "Step in (activate)", "Pour in **rasterio**"]);
    S.step(0);
    t.print("[dim]# You are in the ndvi-app project folder.[/dim]");
    await S.ask("uv venv"); if (!L.alive) return;
    lab.zaps.push({ p: A, life: .3 }); RQ.audio.sfx("zap");
    A.empty = false; A.name = ".venv"; A.appear = 0;
    await t.printSlow(["Using CPython 3.12.3", "Creating virtual environment at: .venv", "Activate with: [w]source .venv/bin/activate[/w]"], 90);
    if (!L.alive) return;
    await lab.crystal(A, "python 3.12", true); if (!L.alive) return;
    S.step(1);
    await S.ask("source .venv/bin/activate", { alts: [". .venv/bin/activate"], special: pipWhenBase(lab, "system") });
    if (!L.alive) return;
    t.setEnv("ndvi-app"); lab.activate(A);
    L.toast("You are inside the cauldron: the prompt shows **(ndvi-app)**.", "good", 2600);
    S.step(2);
    await S.ask("uv pip install rasterio", { alts: ["uv add rasterio"] }); if (!L.alive) return;
    t.print("Resolved [w]9 packages[/w] in 182ms");
    var deps = [["affine", "2.4.0"], ["attrs", "25.3.0"], ["certifi", "2025.4.26"], ["click", "8.2.1"], ["click-plugins", "1.1.1"], ["cligj", "0.7.2"], ["numpy", "2.2.6"], ["pyparsing", "3.2.3"], ["rasterio", "1.4.3"]];
    // helpers first, rasterio last: the newest potions show under the cauldron
    for (var d = 0; d < deps.length; d++) { lab.pour(A, deps[d][0], { fast: true, amount: .07 }); await L.wait(110); if (!L.alive) return; }
    await L.wait(450); if (!L.alive) return;
    await t.printSlow(["Prepared [w]9 packages[/w] in 410ms", "Installed [w]9 packages[/w] in 21ms"].concat(deps.map(function (q) { return " [g]+[/g] " + q[0] + "==" + q[1]; })), 45);
    if (!L.alive) return;
    lab.float(A, "⚡ 9 potions in 1 s", "#f3d9fa");
    S.step(3);
    await L.talk([["pix", "Whoosh, that was fast! Inside a uv project, `uv add rasterio` also writes the potion into `pyproject.toml`."],
      ["pix", "Now the built-in way, with no uv at all. First step out of this cauldron with `deactivate`."]]);
    if (!L.alive) return;
    S.steps("Python's own cauldron maker", ["Step out: `deactivate`", "Go to the **hello-app** folder", "Make a `.venv` with **venv**", "Step in"]);
    S.step(0);
    await S.ask("deactivate"); if (!L.alive) return;
    t.setEnv(null); lab.activate("system", true); RQ.audio.sfx("drop");
    var B = lab.add("hello-app", { folder: "hello-app/", empty: true, tool: "venv" }); RQ.audio.sfx("pop");
    S.step(1);
    await S.ask("cd ~/hello-app", { alts: ["cd ../hello-app"] }); if (!L.alive) return;
    t.cwd = "~/hello-app"; lab.float(B, "📁 you are here", "#fff3bf");
    S.step(2);
    await S.ask("python -m venv .venv", { alts: ["python3 -m venv .venv"] }); if (!L.alive) return;
    B.empty = false; B.name = ".venv"; B.appear = 0; RQ.audio.sfx("whoosh");
    await L.wait(900); if (!L.alive) return;
    await lab.crystal(B, "python 3.12"); if (!L.alive) return;
    t.print("[dim]# (no message means it worked!)[/dim]");
    S.step(3);
    await S.ask("source .venv/bin/activate", { alts: [". .venv/bin/activate"] }); if (!L.alive) return;
    t.setEnv(".venv"); lab.activate(B);
    S.step(4);
    await L.wait(700); if (!L.alive) return;
    var a = await L.choose("pix", "Where do uv and venv keep their cauldron?", ["Far away, in the cloud", "Inside the project folder, in `.venv`", "Inside **base**"]);
    if (!L.alive) return;
    if (a !== 1) { S.miss++; await L.say("pix", "Look at the folders! Each `.venv` cauldron sits right inside its project folder.", { mood: "think" }); }
    if (!L.alive) return;
    L.win({ stars: S.stars(), msg: "**uv** is the speedy way, **venv** is built into Python. Both brew a `.venv` inside your project.", stats: S.stats() });
  }

  /* ------------------------------------------------------------ L4: bubble trouble (version conflict) */
  async function lvConflict(L) {
    var S = scene(L, { env: "mission" }), lab = S.lab, t = S.term;
    lab.add("base", { tool: "base", instant: true }); lab.fill("base", ["python 3.13", "conda"], .5, "#9aa0b8");
    lab.add("mission", { tool: "conda", instant: true }); lab.fill("mission", ["python 3.12"], .25, COLORS.python);
    lab.activate("mission", true);
    S.steps("Two tools, one cauldron?", ["Pour in **old-map-tool**", "Pour in **new-ndvi-tool**"], "old-map-tool wants `numpy<2` · new-ndvi-tool wants `numpy>=2`");
    S.step(0);
    await S.ask("pip install old-map-tool"); if (!L.alive) return;
    await t.printSlow(["Collecting old-map-tool", "Collecting numpy<2 (from old-map-tool)"], 110); if (!L.alive) return;
    await lab.pour("mission", "numpy", { label: "numpy 1.26", col: "#4dabf7" }); if (!L.alive) return;
    await lab.pour("mission", "old-map-tool"); if (!L.alive) return;
    await t.printSlow(["[g]Successfully installed numpy-1.26.4 old-map-tool-1.0[/g]"], 100); if (!L.alive) return;
    S.step(1);
    await S.ask("pip install new-ndvi-tool"); if (!L.alive) return;
    await t.printSlow(["Collecting new-ndvi-tool", "Collecting numpy>=2 (from new-ndvi-tool)", "Attempting uninstall: numpy", "  Found existing installation: numpy 1.26.4", "  Successfully uninstalled numpy-1.26.4"], 110);
    if (!L.alive) return;
    await lab.pour("mission", "numpy", { label: "numpy 2.2", col: "#e599f7", replace: "numpy" }); if (!L.alive) return;
    await lab.pour("mission", "new-ndvi-tool"); if (!L.alive) return;
    t.print("Successfully installed new-ndvi-tool-3.0 numpy-2.2.6");
    lab.overflowing("mission", true); lab.markBad("mission", "old-map-tool", true); lab.float("mission", "conflict!", "#ffc9c9");
    await t.printSlow(["[r]ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behaviour is the source of the following dependency conflicts.[/r]",
      "[r]old-map-tool 1.0 requires numpy<2, but you have numpy 2.2.6 which is incompatible.[/r]"], 150);
    if (!L.alive) return;
    S.step(2);
    await L.wait(1300); if (!L.alive) return;
    var a = await L.choose("mo", "Uh-oh, it bubbled over! Why?", ["The cauldron got too full", "**base** broke by magic", "The two tools need **different numpy** versions"]);
    if (!L.alive) return;
    if (a !== 2) { S.miss++; await L.say("mo", "Read the red line: `old-map-tool` needs numpy below 2, but now numpy 2 is inside. Both can't be true at once!", { mood: "think" }); }
    else await L.say("mo", "Exactly: one needs numpy below 2, the other needs 2 or newer. No single cauldron can hold both.", { mood: "happy" });
    if (!L.alive) return;
    await L.say("mo", "These two tools run separately, so each can get its own cauldron. Take **old-map-tool** out, then brew it a cauldron called **maps**.");
    if (!L.alive) return;
    S.steps("One cauldron per tool", ["Take **old-map-tool** out of mission", "Make a cauldron called **maps**", "Activate **maps**", "Pour **old-map-tool** into maps"]);
    S.step(0);
    await S.ask("pip uninstall old-map-tool", { alts: ["pip uninstall -y old-map-tool", "pip uninstall old-map-tool -y"] }); if (!L.alive) return;
    await t.printSlow(["Found existing installation: old-map-tool 1.0", "Uninstalling old-map-tool-1.0:", "Proceed (Y/n)? y", "  Successfully uninstalled old-map-tool-1.0"], 110);
    if (!L.alive) return;
    lab.unpour("mission", "old-map-tool"); lab.overflowing("mission", false); lab.get("mission").shake = 0;
    RQ.audio.sfx("good"); lab.float("mission", "calm again", "#d3f9d8");
    S.step(1);
    await S.ask("conda create -n maps python=3.12", { alts: ["conda create --name maps python=3.12", "conda create -n maps python=3.12 -y", "conda create -y -n maps python=3.12"] });
    if (!L.alive) return;
    await condaHeader(t); if (!L.alive) return;
    lab.add("maps", { tool: "conda" });
    await lab.crystal("maps", "python 3.12", true); if (!L.alive) return;
    await t.progress("Executing transaction", 700); if (!L.alive) return;
    S.step(2);
    t.print("[dim]# Your turn: no grey letters this time! Tip: press ↑ to bring back an old spell.[/dim]");
    await S.ask("conda activate maps", { ghost: false, hint: "`conda activate` and then the new cauldron's name.", special: function (c) {
      if (/install old-map-tool/.test(c)) { lab.flash("mission"); return "[y]Wait! (mission) is still active, so it would pour right back into mission. Activate maps first![/y]"; }
      return null;
    } });
    if (!L.alive) return;
    t.setEnv("maps"); lab.activate("maps");
    S.step(3);
    await S.ask("pip install old-map-tool", { ghost: false, hint: "`pip install` and then the tool's name." }); if (!L.alive) return;
    await t.printSlow(["Collecting old-map-tool", "Collecting numpy<2 (from old-map-tool)"], 100); if (!L.alive) return;
    await lab.pour("maps", "numpy", { label: "numpy 1.26", col: "#4dabf7" }); if (!L.alive) return;
    await lab.pour("maps", "old-map-tool"); if (!L.alive) return;
    t.print("[g]Successfully installed numpy-1.26.4 old-map-tool-1.0[/g]");
    S.step(4); lab.cheer("maps"); lab.cheer("mission");
    lab.float("mission", "✓ numpy 2", "#d3f9d8"); lab.float("maps", "✓ numpy 1.26", "#d0ebff");
    await L.wait(1500); if (!L.alive) return;
    L.win({ stars: S.stars(), msg: "Each tool has its own cauldron, so each gets the numpy it needs. No more bubbling over!", stats: S.stats() });
  }

  /* ------------------------------------------------------------ L5: potion orders (free terminal) */
  async function lvOrders(L) {
    var S = scene(L, { env: "base" }), lab = S.lab, t = S.term;
    lab.add("base", { tool: "base", instant: true }); lab.fill("base", ["python 3.13", "conda"], .5, "#9aa0b8");
    lab.add("reseed", { tool: "conda", instant: true }); lab.fill("reseed", ["python 3.12", "numpy", "rasterio"], .5, "#38d9a9");
    lab.add("games", { tool: "conda", instant: true }); lab.fill("games", ["python 3.12"], .25, COLORS.python);
    lab.add("maps", { tool: "conda", instant: true }); lab.fill("maps", ["python 3.12", "numpy 1.26", "old-map-tool"], .5, "#5c7cfa");
    lab.activate("base", true);
    var ENVS = ["base", "reseed", "games", "maps"], active = "base";
    var ORDERS = [{ env: "reseed", pk: "scipy" }, { env: "games", pk: "playwright" }, { env: "maps", pk: "pyproj" }, { env: "reseed", pk: "shapely" }];
    var KNOWN = CONDA_PKGS.concat(PIP_PKGS, ["playwright", "matplotlib", "pandas", "requests", "old-map-tool", "new-ndvi-tool", "jupyter", "pygame", "pytest"]);
    var oi = 0, showGhost = true;
    function card() {
      var o = ORDERS[oi];
      S.card.innerHTML = "";
      S.card.appendChild(u.el("h3", { html: "🧾 Order " + (oi + 1) + " of " + ORDERS.length }));
      S.card.appendChild(u.el("div", { class: "pl-order" }, u.el("span", { class: "big", text: "📜" }),
        u.el("span", { html: "The <b>" + o.env + "</b> cauldron needs <b>" + o.pk + "</b>." })));
      S.card.appendChild(u.el("div", { class: "pl-spells", html: "Spells: <code>conda activate NAME</code> <code>pip install POTION</code> <code>conda env list</code>" }));
      lab.pots.forEach(function (p) { p.order = p.name === o.env ? o.pk : null; });
    }
    card();
    t.print("[dim]# Orders are coming in! Check the prompt: which cauldron is active?[/dim]");
    function miss(msg) { S.miss++; showGhost = true; RQ.audio.sfx("error"); if (msg) t.print(msg); }
    while (oi < ORDERS.length) {
      var o = ORDERS[oi], next = active === o.env ? "pip install " + o.pk : "conda activate " + o.env;
      S.want = next;
      var c = await t.ask({ expect: function (x) { return x.length > 0; }, ghost: showGhost ? next : "" });
      if (!L.alive) return;
      S.want = null; S.cast++; showGhost = false;
      var m;
      if ((m = /^conda activate (\S+)$/.exec(c))) {
        if (ENVS.indexOf(m[1]) < 0) { miss("[r]EnvironmentNameNotFound: Could not find conda environment: " + m[1] + "[/r]\n[y]Type conda env list to see every cauldron.[/y]"); continue; }
        active = m[1]; t.setEnv(active); lab.activate(active);
      } else if (c === "conda deactivate") {
        if (active === "base") { miss("[y]You are already in base, the starting cauldron. Activate the one on the order![/y]"); continue; }
        active = "base"; t.setEnv("base"); lab.activate("base");
      } else if (c === "conda env list" || c === "conda info --envs" || c === "conda env ls") {
        t.print("# conda environments:\n#");
        ENVS.slice().sort().forEach(function (n) {
          var name = (n + "                    ").slice(0, 20), star = n === active ? "*" : " ";
          t.print(name + star + "  /home/kid/miniconda3" + (n === "base" ? "" : "/envs/" + n));
        });
        RQ.audio.sfx("chirp");
      } else if ((m = /^(?:pip3?|python3? -m pip) install (\S+)$/.exec(c))) {
        var pk = m[1];
        if (KNOWN.indexOf(pk) < 0) { miss("[r]ERROR: Could not find a version that satisfies the requirement " + pk + " (from versions: none)[/r]\n[y]Check the spelling of the potion on the order.[/y]"); continue; }
        t.print("Collecting " + pk);
        await lab.pour(active, pk, { amount: .08 }); if (!L.alive) return;
        t.print("[g]Successfully installed " + pk + "[/g]");
        if (active === o.env && pk === o.pk) {
          RQ.audio.sfx("coin"); lab.cheer(active); lab.float(active, "✓ order done!", "#d3f9d8");
          oi++;
          if (oi === 2) { await L.say("sprout", "Fun fact: we built these very games inside a conda environment called `games`!"); if (!L.alive) return; }
          if (oi < ORDERS.length) card(); else lab.pots.forEach(function (p) { p.order = null; });
        } else if (pk !== o.pk) {
          miss("[y]Hmm, " + pk + " isn't on the order. The order wants " + o.pk + ".[/y]");
        } else {
          lab.flash(active);
          miss("[y]Oops! That went into (" + active + "), but the order is for " + o.env + ". Activate " + o.env + ", then pour again.[/y]");
        }
      } else if (c === "clear") {
        t.clear();
      } else if (/^pip3? install$/.test(c)) {
        miss("[r]ERROR: You must give at least one requirement to install[/r]");
      } else {
        miss(fizzle(c, "`conda activate NAME` or `pip install POTION`"));
      }
    }
    await L.wait(900); if (!L.alive) return;
    var bad = S.miss + S.helped;
    L.win({ stars: bad === 0 ? 3 : bad <= 2 ? 2 : 1, msg: "Every potion went into the right cauldron. You check the prompt first, like a real coder!", stats: S.stats() });
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g05",
    music: "mystery",
    intro: [
      ["pix", "Welcome to my **Potion Lab**! Code libraries are potions here, and every project brews in its own cauldron."],
      ["hoot", "A cauldron is an **environment**. Keep each project's potions apart, and nothing bubbles over!"]
    ],
    outro: [
      ["pix", "You are a real potion master now. conda, uv and venv all obey you!"],
      ["mo", "Next stop: my workshop. Every cauldron needs a computer to sit on!"]
    ],
    levels: [
      { title: "First cauldron", goal: "Create, activate, then pip install",
        intro: [["pix", "Let's brew a cauldron for ReSeed with **conda**. Type the spell in my terminal, or type the start and press **Tab**."],
                ["pix", "The prompt starts with `(base)`. That is conda's own cauldron, so we keep project potions out of it."]],
        cards: ["virtual-environment", "conda-env"],
        play: lvFirst },
      { title: "The recipe book", goal: "Read environment.yml, then brew it all",
        intro: [["hoot", "Typing every potion by hand is slow. ReSeed keeps a recipe file called `environment.yml`."],
                ["hoot", "Read the real recipe and answer my questions. Then one spell brews it all!"]],
        cards: ["environment-yml"],
        play: lvRecipe },
      { title: "Speedy uv", goal: "uv venv, activate, uv pip install",
        intro: [["pix", "Meet **uv**, a super-fast potion tool. It brews a cauldron called `.venv` right inside your project folder."],
                ["pix", "We're in the `ndvi-app` folder. Make the cauldron, step in, then pour in **rasterio**!"]],
        cards: ["uv-venv", "python-venv"],
        play: lvUv },
      { title: "Bubble trouble", goal: "Fix a numpy version conflict",
        intro: [["mo", "Two map tools need potions for a mission. But careful: they disagree about **numpy**!"],
                ["mo", "`old-map-tool` needs numpy below 2. `new-ndvi-tool` needs numpy 2 or newer. Let's try one cauldron first."]],
        cards: ["version-conflict"],
        play: lvConflict },
      { title: "Potion orders", goal: "Activate the right cauldron, then pour",
        intro: [["pix", "The lab is open and orders are coming in! Each one says which cauldron needs which potion."],
                ["pix", "Check the prompt, `conda activate` the right cauldron, then `pip install`. Type `conda env list` to see them all."]],
        play: lvOrders }
    ]
  });
})();
