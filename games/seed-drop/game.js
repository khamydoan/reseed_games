/* g19 Seed Drop — seed-release physics, side view. Set height, speed, wind, seed and release mode, press DROP,
 * and land the seed cloud in the glowing patch. Physics = ReSeed's model (seedphysics.js, ported from
 * reseed/site/js/physics.js): dv/dt = g − k|v−w|(v−w), k = g/v_t², wind w(z) = w10·(z/10)^0.2, gusts, rotor downwash.
 * Levels: still air → wind → pick the seed → release modes → My Site's real release footprint. */
(function () {
  "use strict";
  var u = RQ.u, P = window.SeedPhys;
  var H = 540, ZFAR = -6, ZNEAR = 10, DZ = 8, MAXH = 30, N_SEEDS = 40;
  var MODE = {
    hatch_drop: { icon: "🚪", label: "Hatch drop", tip: "tight cluster" },
    jerk_back: { icon: "⏪", label: "Jerk back", tip: "drone brakes" },
    backward_flick: { icon: "👋", label: "Backward flick", tip: "thrown back" },
    spin_spread: { icon: "🌀", label: "Spin spread", tip: "wide ring" }
  };
  var MODE_KEYS = ["hatch_drop", "jerk_back", "backward_flick", "spin_spread"];

  /* ------------------------------------------------------------ real seeds from ReSeed data (species.py) */
  function lookOf(s) {
    var d = (s.delivery || "") + " " + s.common;
    return /seed ball/.test(d) ? "ball" : /acorn|nut/.test(d) ? "acorn" : /dewinged|pine/i.test(d) ? "pine" : "flat";
  }
  function species(biome, common) {
    var d = RQ.data(), b = d && d.biomes[biome], s = b && (b.species || []).filter(function (x) { return x.common === common; })[0];
    if (!s) s = { common: common, latin: "", v_terminal: 17, delivery: "", share: 1 };
    return { name: s.common, latin: s.latin, vt: s.v_terminal, look: lookOf(s), delivery: s.delivery, share: s.share };
  }
  function seedBook() {
    return { oak: species("oak_hickory", "White oak"), parica: species("tropical_moist_forest", "Paricá"), pine: species("sierra_mixed_conifer", "Ponderosa pine") };
  }
  var SEED_ICON = { acorn: "🌰", pine: "🌲", flat: "🫘", ball: "🟤" };

  /* ------------------------------------------------------------ drawing helpers */
  function drawSeed(ctx, x, y, look, rot, r) {
    r = r || 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(r, r);
    ctx.lineWidth = 1.3; ctx.strokeStyle = "#1d2b3a";
    if (look === "acorn") {
      ctx.fillStyle = "#c27a3a"; ctx.beginPath(); ctx.ellipse(0, 1.5, 4.2, 5.2, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#6b4423"; ctx.beginPath(); ctx.ellipse(0, -2.5, 4.8, 2.6, 0, Math.PI, 0); ctx.lineTo(4.8, -2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (look === "pine") {
      ctx.fillStyle = "#5a3d2b"; ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(4, 1, 0, 4); ctx.quadraticCurveTo(-4, 1, 0, -4); ctx.fill(); ctx.stroke();
    } else if (look === "ball") {
      ctx.fillStyle = "#8a6d55"; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c9b08f"; ctx.beginPath(); ctx.arc(-1.4, -1.2, 1.1, 0, 7); ctx.arc(1.6, 1.2, .9, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = "#d6ad6b"; ctx.beginPath(); ctx.ellipse(0, 0, 5.2, 3, 0, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  /** Side-view seed drone. st: {tilt, yaw, hatch 0..1, flick 0..1, roll: bool, look}. */
  function drawDrone(ctx, x, y, sz, st, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(st.tilt || 0);
    var sq = st.yaw ? Math.max(.18, Math.abs(Math.cos(st.yaw))) : 1;
    ctx.scale(sz * sq, sz);
    ctx.lineWidth = 3 / sz; ctx.strokeStyle = "#1d2b3a"; ctx.lineJoin = "round";
    // skids
    ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-18, 22); ctx.moveTo(14, 6); ctx.lineTo(18, 22); ctx.moveTo(-26, 22); ctx.lineTo(26, 22); ctx.stroke();
    // seed roll (cardboard tube along the flight line, open front)
    if (st.roll !== false) {
      ctx.save(); ctx.translate(-14, 12); ctx.rotate(-(st.flick || 0) * 1.6);
      ctx.fillStyle = "#d9b27c"; u.rr(ctx, 0, -5, 30, 11, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#6b4423"; ctx.beginPath(); ctx.ellipse(30, .5, 3, 5.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      if (st.hatch) { ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(4 + 22 * Math.cos(st.hatch * 1.3), 6 + 22 * Math.sin(st.hatch * 1.3)); ctx.lineWidth = 4 / sz; ctx.stroke(); }
      ctx.restore();
    }
    // arms + rotors
    ctx.fillStyle = "#33465a"; ctx.fillRect(-40, -9, 80, 6); ctx.strokeRect(-40, -9, 80, 6);
    [-36, 36].forEach(function (rx, i) {
      ctx.fillStyle = "#1d2b3a"; ctx.fillRect(rx - 4, -17, 8, 9);
      var fl = .55 + .45 * Math.abs(Math.sin(t * 40 + i * 1.7));
      ctx.fillStyle = "rgba(205,230,255," + (.55 + .3 * fl) + ")"; ctx.beginPath(); ctx.ellipse(rx, -19, 24 * fl + 4, 3.4, 0, 0, 7); ctx.fill(); ctx.stroke();
    });
    // body + face
    ctx.fillStyle = "#2b7bd0"; u.rr(ctx, -22, -16, 44, 24, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#163042"; u.rr(ctx, 2, -12, 18, 14, 5); ctx.fill();
    ctx.fillStyle = "#7ff0ff"; ctx.beginPath(); ctx.arc(8, -6, 2.2, 0, 7); ctx.arc(15, -6, 2.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, -16); ctx.quadraticCurveTo(-6, -26, -1, -30); ctx.stroke();
    ctx.fillStyle = "#8be07f"; ctx.beginPath(); ctx.ellipse(4, -31, 7, 3.5, -.4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawTree(ctx, x, yb, hPx, sway) {
    ctx.save(); ctx.translate(x, yb);
    ctx.fillStyle = "#7a4e2d"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3;
    ctx.fillRect(-7, -hPx * .25, 14, hPx * .25); ctx.strokeRect(-7, -hPx * .25, 14, hPx * .25);
    for (var i = 0; i < 4; i++) {
      var y0 = -hPx * (.18 + i * .2), w = hPx * (.36 - i * .07), s = (sway || 0) * (i + 1);
      ctx.fillStyle = ["#2f7d3a", "#35914a", "#3fa457", "#4cb864"][i];
      ctx.beginPath(); ctx.moveTo(-w + s, y0); ctx.lineTo(s * 1.4, y0 - hPx * .34); ctx.lineTo(w + s, y0); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function arrow(ctx, x1, y1, x2, y2, head) {
    var a = Math.atan2(y2 - y1, x2 - x1), hd = head || 9;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hd * Math.cos(a - .5), y2 - hd * Math.sin(a - .5)); ctx.lineTo(x2 - hd * Math.cos(a + .5), y2 - hd * Math.sin(a + .5)); ctx.closePath(); ctx.fill();
  }
  function label(ctx, txt, x, y, o) {
    o = o || {};
    ctx.font = (o.weight || 600) + " " + (o.size || 15) + "px Fredoka, sans-serif"; ctx.textAlign = o.align || "center"; ctx.textBaseline = "middle";
    if (o.box) {
      var w = ctx.measureText(txt).width + 14, bx = o.align === "left" ? x - 7 : o.align === "right" ? x - w + 7 : x - w / 2;
      ctx.fillStyle = o.box; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2; u.rr(ctx, bx, y - 12, w, 24, 9); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = o.color || "#1d2b3a"; ctx.fillText(txt, x, y + 1);
  }
  function inPatch(p, x, z) { var dx = (x - p.x) / p.rx, dz = (z - p.z) / p.rz; return dx * dx + dz * dz <= 1; }

  /** Drone motion after release for each mode (analytic so replays match). Returns {x, tilt, yaw, hatch, flick}. */
  function droneMotion(mode, s, tt) {
    var o = { x: s * tt, tilt: 0, yaw: 0, hatch: 0, flick: 0 };
    if (tt < 0) return o;
    if (mode === "hatch_drop") o.hatch = Math.min(1, tt / .15) * (tt < 1.2 ? 1 : Math.max(0, 1 - (tt - 1.2) / .3));
    else if (mode === "backward_flick") o.flick = tt < .12 ? tt / .12 : Math.max(0, 1 - (tt - .12) / .4);
    else if (mode === "spin_spread") o.yaw = tt < .9 ? tt * 2 * 2 * Math.PI : 0;
    else if (mode === "jerk_back") {
      // demo_flight.py: reverse to 1.5 m/s for 0.35 s, then hold
      var a = .3, vb = -1.5, x1 = s * a + (vb - s) * a / 2;
      if (tt < a) o.x = s * tt + (vb - s) * tt * tt / (2 * a);
      else if (tt < a + .35) o.x = x1 + vb * (tt - a);
      else { var t3 = Math.min(tt - a - .35, .3); o.x = x1 + vb * .35 + vb * t3 - vb * t3 * t3 / (2 * .3); }
      o.tilt = tt < .75 ? -.42 * Math.sin(Math.min(1, tt / .75) * Math.PI) : 0;
    }
    return o;
  }

  /* ------------------------------------------------------------ the drop range (shared by every level) */
  function range(L) {
    var root = u.el("div", { class: "fill sd-root" }), top = u.el("div", { class: "sd-top" }), bar = u.el("div", { class: "sd-bar" });
    root.appendChild(top); root.appendChild(bar); L.stage.appendChild(root);
    var cv = L.canvas({ w: 1000, h: H, parent: top, fill: true, label: "seed drop range, side view" }), ctx = cv.ctx;
    var goalEl = u.el("div", { class: "sd-goal" }); top.appendChild(goalEl);
    var resEl = u.el("div", { class: "sd-res", style: { display: "none" } }); top.appendChild(resEl);
    var BOOK = seedBook();
    var S = { h: 20, s: 4, w: 0, seed: "oak", mode: "hatch_drop", rd: null, run: null, clouds: [], dust: [], ghost: null, showGhost: false,
      cloudX: 0, t: 0, book: BOOK, shake: 0, onDone: null, onDrop: null, rollsLeft: null, lastRun: null, extra: null };
    var R = { S: S, top: top, bar: bar, L: L, ctx: ctx };

    /* --- controls */
    var ctl = {};
    function slider(key, text, min, max, step, unit) {
      var val = u.el("b"), inp = u.el("input", { type: "range", class: "sd-range", min: min, max: max, step: step, "aria-label": text });
      var box = u.el("div", { class: "sd-ctl" }, u.el("div", { class: "lab" }, u.el("span", { text: text }), val), inp);
      function show() { val.textContent = u.fmt(S[key], step < 1 ? 1 : 0) + " " + unit; }
      L.on(inp, "input", function () { S[key] = parseFloat(inp.value); show(); R.changed(); });
      L.on(inp, "change", function () { inp.blur(); });
      ctl[key] = { el: box, set: function (v) { S[key] = v; inp.value = v; show(); }, lock: function (b) { inp.disabled = !!b; box.classList.toggle("locked", !!b); },
        nudge: function (d) { if (inp.disabled) return false; var v = u.clamp(Math.round((S[key] + d * step) / step) * step, min, max); ctl[key].set(v); R.changed(); RQ.audio.sfx("tick"); return true; } };
      return box;
    }
    function picker(key, items) {
      var box = u.el("div", { class: "sd-pick", role: "group" }), btns = {};
      items.forEach(function (it, i) {
        var b = u.el("button", { class: "btn", "aria-pressed": "false", html: it.html + ' <kbd>' + (i + 1) + "</kbd>" });
        b.onclick = function () { if (b.disabled) return; ctl[key].set(it.v); R.changed(); RQ.audio.sfx("select"); b.blur(); };
        btns[it.v] = b; box.appendChild(b);
      });
      ctl[key] = { el: box, items: items, set: function (v) { S[key] = v; for (var k in btns) { btns[k].classList.toggle("on", k === v); btns[k].setAttribute("aria-pressed", String(k === v)); } },
        lock: function (b, allow) { for (var k in btns) btns[k].disabled = !!b && k !== allow; box.classList.toggle("locked", !!b); } };
      return box;
    }
    var dropBtn = u.el("button", { class: "btn big primary sd-go", html: "DROP! <kbd>Space</kbd>" });
    var slowBtn = u.el("button", { class: "btn sd-btn", html: "🐢 Slow-mo <kbd>R</kbd>", title: "Slow-motion replay" });
    var nextBtn = u.el("button", { class: "btn big go sd-go pulse", html: "Next ▶ <kbd>Enter</kbd>", style: { display: "none" } });
    var rollsEl = u.el("span", { class: "chip", style: { display: "none" } });
    dropBtn.onclick = function () { dropBtn.blur(); R.drop(); };
    R.dropBtn = dropBtn;
    slowBtn.onclick = function () { slowBtn.blur(); R.replay(); };
    nextBtn.onclick = function () { if (S.onNext) { var f = S.onNext; S.onNext = null; nextBtn.style.display = "none"; f(); } };

    R.build = function (keys) {
      bar.innerHTML = ""; ctl = {};
      if (keys.indexOf("h") >= 0) bar.appendChild(slider("h", "⬆️ Height", 2, 30, 1, "m"));
      if (keys.indexOf("s") >= 0) bar.appendChild(slider("s", "➡️ Speed", 0, 8, .5, "m/s"));
      if (keys.indexOf("w") >= 0) bar.appendChild(slider("w", "🌬️ Wind", 0, 8, .5, "m/s"));
      if (keys.indexOf("seed") >= 0) bar.appendChild(picker("seed", Object.keys(BOOK).map(function (k) {
        var b = BOOK[k]; return { v: k, html: SEED_ICON[b.look] + " " + u.esc(b.name) + "<small>falls " + u.fmt(b.vt, b.vt % 1 ? 1 : 0) + " m/s</small>" };
      })));
      if (keys.indexOf("mode") >= 0) bar.appendChild(picker("mode", MODE_KEYS.map(function (k) { return { v: k, html: MODE[k].icon + " " + MODE[k].label + "<small>" + MODE[k].tip + "</small>" }; })));
      bar.appendChild(rollsEl); bar.appendChild(slowBtn); bar.appendChild(dropBtn); bar.appendChild(nextBtn);
      slowBtn.disabled = true;
      window.dispatchEvent(new Event("resize"));   // the bar changed height: refit the canvas
    };
    R.setRound = function (rd) {
      S.rd = rd; S.clouds = []; S.run = null; S.lastRun = null; S.lastRes = null; S.showGhost = false; S.misses = 0; S.dust = [];
      R.lineDrone = R.lineDecor = R.lineTick = R.lineDrop = null;
      resEl.style.display = "none"; nextBtn.style.display = "none"; dropBtn.style.display = ""; dropBtn.disabled = false; slowBtn.disabled = true;
      ["h", "s", "w", "seed", "mode"].forEach(function (k) {
        if (rd.set && rd.set[k] != null) S[k] = rd.set[k];
        if (ctl[k]) { ctl[k].set(S[k]); ctl[k].lock(rd.lock && rd.lock.indexOf(k) >= 0); }
      });
      if (rd.wind) S.wind = rd.wind;
      goalEl.innerHTML = RQ.ui.md(rd.goal || "");
      goalEl.style.display = rd.goal ? "" : "none";
      R.changed();
    };
    R.changed = function () {
      if (S.rd && S.rd.windFromSlider) S.wind = { speed: S.w, dx: 1, dz: 0, gust: GUST };
      S.ghost = null;
    };
    R.windNow = function () { return S.wind || { speed: 0, gust: 0 }; };
    R.seedNow = function () { return S.rd && S.rd.seedObj ? S.rd.seedObj : BOOK[S.seed]; };
    R.sim = function (extra) {
      var w = R.windNow(), sd = R.seedNow();
      return P.simulate(Object.assign({ vt: sd.vt, mode: S.mode, n: N_SEEDS, alt: S.h, speed: S.s, seed: (Math.random() * 1e9) | 0,
        wind: { speed: w.speed, dx: w.dx == null ? 1 : w.dx, dz: w.dz || 0, gust: w.gust == null ? .8 : w.gust } }, extra || {}));
    };

    /** Single drop: drone flies in, releases at the flag (x = 0), seeds fall. Resolves through S.onDone(result). */
    R.drop = function () {
      if (!L.alive || dropBtn.disabled || dropBtn.style.display === "none") return;
      if (S.rd && S.rd.line) return R.lineDrop && R.lineDrop();
      if (S.run) return;
      var sim = R.sim(S.rd && S.rd.simExtra), sd = R.seedNow();
      var ta = S.s > 0 ? Math.min(2.5, 12 / S.s) : .6;
      S.clouds = [{ x0: 0, t0: ta, sim: sim, look: sd.look, landedN: 0 }];
      var tree = S.rd && S.rd.tree;
      S.run = { t: 0, rate: 1, ta: ta, s: S.s, h: S.h, mode: S.mode, end: ta + Math.max(sim.duration, tree != null ? 3.2 : 1.2) + .5, bonk: null, tree: tree };
      S.lastRun = S.run; resEl.style.display = "none"; dropBtn.disabled = true; slowBtn.disabled = true;
      RQ.audio.sfx("whoosh");
    };
    R.replay = function () {
      if (!S.lastRun || S.run || !S.clouds.length || (S.rd && S.rd.line)) return;
      var r = S.lastRun; r.t = 0; r.rate = .25; r.replay = true; r.bonk = null; S.run = r; S.dust = [];
      S.clouds.forEach(function (c) { c.landedN = 0; });
      RQ.audio.sfx("whoosh"); slowBtn.disabled = true; dropBtn.disabled = true;
    };
    R.evaluate = function () {
      var rd = S.rd, c = S.clouds[0], seeds = c.sim.seeds, inP = 0;
      seeds.forEach(function (p) { if (rd.patches.some(function (pa) { return inPatch(pa, p.x + c.x0, p.z); })) inP++; });
      var st = c.sim.stats, res = { inP: inP, n: seeds.length, frac: inP / seeds.length, st: st, bonk: S.lastRun.bonk != null, cx: st.centroid.x + c.x0, cz: st.centroid.z };
      var chk = rd.check ? rd.check(res, S) : { ok: res.frac >= .5 && !res.bonk };
      res.ok = chk.ok;
      if (!chk.msg) {
        var pa = rd.patches[0], d = res.cx - pa.x;
        chk.msg = res.bonk ? "Bonk! The drone flew into the tree." : res.ok ? "🎯 **" + inP + " / " + res.n + "** seeds in the patch!"
          : inP > 0 ? "**" + inP + " / " + res.n + "** in the patch. Close!" : "Missed! The seeds landed **" + u.fmt(Math.abs(d), 1) + " m** too " + (d > 0 ? "far." : "short.");
      }
      res.msg = chk.msg; S.lastRes = res;
      return res;
    };
    R.showResult = function (res) {
      var st = res.st;
      resEl.className = "sd-res " + (res.ok ? "good" : "bad"); resEl.style.display = "";
      resEl.innerHTML = '<b class="big">' + RQ.ui.md(res.msg) + "</b>" +
        '<div class="row"><span class="chip">↔ drift ' + u.fmt(st.drift, 1) + ' m</span><span class="chip">◎ 90% within ' + u.fmt(st.blastRadius, 1) +
        ' m</span><span class="chip">⏱ fall ' + u.fmt(st.meanFall, 1) + " s</span></div>";
    };
    /** Wait for drops until one succeeds. Returns the number of drops used. */
    R.playRound = function (rd) {
      R.setRound(rd);
      return new Promise(function (resolve) {
        var used = 0;
        S.onDone = function () {
          var res = R.evaluate(); used++; R.showResult(res);
          if (S.onDrop) S.onDrop(res);
          if (res.ok) {
            RQ.audio.sfx("good"); RQ.ui.confetti(40); dropBtn.style.display = "none"; nextBtn.style.display = "";
            S.onNext = function () { resolve({ used: used, res: res }); };
          } else {
            RQ.audio.sfx(res.bonk ? "boom" : "bad"); if (res.inP === 0) L.timeout(function () { RQ.audio.sfx("giggle"); }, 300);
            S.misses++; dropBtn.disabled = false;
            if (S.misses === 2) {
              S.showGhost = true;
              L.toast("💡 Koa's flight computer now draws a **prediction line**.", "info", 3200);
              if (rd.hint) L.timeout(function () { if (L.alive && !S.run) L.talk(rd.hint); }, 700);
            }
          }
        };
      });
    };

    /* --- keyboard */
    L.on(window, "keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      var k = e.key, inInput = e.target && e.target.tagName === "INPUT";
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (nextBtn.style.display !== "none") nextBtn.onclick(); else R.drop();
      } else if (inInput && /^Arrow/.test(k)) return;
      else if (k === "ArrowUp" && ctl.h) { e.preventDefault(); ctl.h.nudge(1); }
      else if (k === "ArrowDown" && ctl.h) { e.preventDefault(); ctl.h.nudge(-1); }
      else if (k === "ArrowRight" && ctl.s) { e.preventDefault(); ctl.s.nudge(1); }
      else if (k === "ArrowLeft" && ctl.s) { e.preventDefault(); ctl.s.nudge(-1); }
      else if ((k === "x" || k === "X") && ctl.w) ctl.w.nudge(1);
      else if ((k === "z" || k === "Z") && ctl.w) ctl.w.nudge(-1);
      else if (k === "r" || k === "R") R.replay();
      else if (/^[1-4]$/.test(k)) {
        var pk = ctl.mode && !ctl.mode.el.classList.contains("locked") ? ctl.mode : ctl.seed && !ctl.seed.el.classList.contains("locked") ? ctl.seed : null;
        var it = pk && pk.items[parseInt(k, 10) - 1];
        if (it) { pk.set(it.v); R.changed(); RQ.audio.sfx("select"); }
      }
    });

    /* --- view: world metres → canvas pixels */
    function view() {
      // separate horizontal and vertical scales (the rulers show real metres); the ground is seen a little from above
      var rd = S.rd || {}, zf = rd.zf == null ? ZFAR : rd.zf, zn = rd.zn == null ? ZNEAR : rd.zn, W = cv.w, gBase = H - 20 - zn * DZ, xMin = rd.xMin == null ? -12 : rd.xMin, xMax = rd.xMax || 30;
      var sy = (gBase - 40) / MAXH, sx = (W - 150) / (xMax - xMin), x0 = 110 - xMin * sx;
      return { sx: sx, sy: sy, x0: x0, gBase: gBase, W: W, zf: zf, zn: zn, X: function (x) { return x0 + x * sx; }, Y: function (y, z) { return gBase - y * sy + (z || 0) * DZ; } };
    }

    /* --- drawing */
    function background(V, t, w) {
      var g = ctx.createLinearGradient(0, 0, 0, V.gBase);
      g.addColorStop(0, "#8fd0ff"); g.addColorStop(1, "#e4f6ff");
      ctx.fillStyle = g; ctx.fillRect(0, 0, V.W, H);
      ctx.beginPath(); ctx.arc(V.W - 380, 70, 30, 0, 7); ctx.fillStyle = "#ffd84d"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#1d2b3a"; ctx.stroke();
      for (var c = 0; c < 5; c++) {
        var span = V.W + 360, x = (((c * 300 + S.cloudX * 6) % span) + span) % span - 180, y = 50 + (c % 3) * 42;
        ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.arc(x + 26, y - 10, 28, 0, 7); ctx.arc(x + 56, y, 20, 0, 7); ctx.fill();
      }
      // far hills
      ctx.fillStyle = "#b9e3a6"; ctx.beginPath(); ctx.moveTo(0, V.Y(0, V.zf));
      for (var hx = 0; hx <= V.W + 40; hx += 40) ctx.lineTo(hx, V.Y(0, V.zf) - 60 - Math.sin(hx / 210 + 1) * 34 - Math.sin(hx / 77) * 8);
      ctx.lineTo(V.W, V.Y(0, V.zf)); ctx.fill();
      // a forest edge on the far side of the range
      for (var tx = 30; tx < V.W; tx += 64) {
        var th = 34 + ((tx * 13) % 23), ty = V.Y(0, V.zf) + 2, sw = Math.sin(t * 1.3 + tx) * (1 + (w.speed || 0) * .25);
        ctx.fillStyle = "#3f8f4a"; ctx.beginPath(); ctx.moveTo(tx - 12, ty); ctx.lineTo(tx + sw, ty - th); ctx.lineTo(tx + 12, ty); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#4fa65a"; ctx.beginPath(); ctx.moveTo(tx + 20, ty); ctx.lineTo(tx + 30 + sw, ty - th * .7); ctx.lineTo(tx + 40, ty); ctx.closePath(); ctx.fill();
      }
      // ground band (seen a little from above) + front face
      var yf = V.Y(0, V.zf), yn = V.Y(0, V.zn);
      var gg = ctx.createLinearGradient(0, yf, 0, yn); gg.addColorStop(0, "#8fd16f"); gg.addColorStop(1, "#5fb04a");
      ctx.fillStyle = gg; ctx.fillRect(0, yf, V.W, yn - yf);
      ctx.fillStyle = "#8a5a35"; ctx.fillRect(0, yn, V.W, H - yn);
      ctx.fillStyle = "#6f4527"; ctx.fillRect(0, yn + 10, V.W, 4);
      ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, yn); ctx.lineTo(V.W, yn); ctx.stroke();
      // grass tufts
      ctx.strokeStyle = "rgba(40,110,50,.55)"; ctx.lineWidth = 2;
      for (var i = 0; i < 70; i++) {
        var gx = (i * 97.3) % V.W, gz = V.zf + ((i * 37) % 15) + .5, gy = V.Y(0, gz), sw = Math.sin(t * 2 + i) * 2 + (w.speed || 0) * (w.dx || 1) * .6;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + sw, gy - 7); ctx.moveTo(gx + 4, gy); ctx.lineTo(gx + 4 + sw, gy - 5); ctx.stroke();
      }
    }
    function rulers(V) {
      // distance ticks along the near edge
      var yn = V.Y(0, V.zn), step = V.sx > 30 ? 2 : 5;
      ctx.fillStyle = "#fff"; ctx.font = "600 15px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (var m = -20; m <= 90; m += step) {
        var x = V.X(m); if (x < 60 || x > V.W - 10) continue;
        ctx.fillRect(x - 1, yn, 2, 5); ctx.fillText(m === 0 ? "0" : (m > 0 ? "+" : "") + m + " m", x, yn + 12);
      }
      // height ruler
      var rx = 22;
      ctx.strokeStyle = "rgba(29,43,58,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, V.Y(0)); ctx.lineTo(rx, V.Y(30)); ctx.stroke();
      ctx.fillStyle = "#1d2b3a"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = "600 14px Fredoka, sans-serif";
      for (var hm = 0; hm <= 30; hm += 5) { ctx.fillRect(rx - 5, V.Y(hm) - 1, 10, 2); if (hm) ctx.fillText(hm + " m", rx + 8, V.Y(hm)); }
    }
    function windArrows(V, t, w) {
      if (!w.speed) return;
      var x = 120, dir = w.dz && !w.dx ? 0 : (w.dx || 1);
      ctx.strokeStyle = "#2b7bd0"; ctx.fillStyle = "#2b7bd0"; ctx.lineWidth = 4;
      [3, 10, 20, 27].forEach(function (z) {
        var ws = P.windAt(w.speed, z, .2), len = ws * 13, y = V.Y(z);
        if (dir === 0) { label(ctx, "side wind " + u.fmt(ws, 1) + " m/s", 84, y, { size: 13, color: "#2b7bd0", align: "left", box: "rgba(255,253,247,.8)" }); return; }
        var off = (t * ws * 20) % 16;
        ctx.globalAlpha = .85;
        if (dir > 0) arrow(ctx, x + off * .2, y, x + len + off * .2, y); else arrow(ctx, x + len - off * .2, y, x - off * .2, y);
        ctx.globalAlpha = 1;
        label(ctx, u.fmt(ws, 1) + " m/s", x + Math.max(len, 20) + 40, y - 1, { size: 13, color: "#2b7bd0" });
      });
      // moving streaks
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2;
      for (var i = 0; i < 14; i++) {
        var z = 2 + (i * 7) % 28, sp = P.windAt(w.speed, z, .2) * V.sx * (dir || 0), span = V.W + 200;
        var sx = (((i * 233 + t * sp) % span) + span) % span - 100, sy = V.Y(z) + Math.sin(t * 3 + i) * 3;
        if (dir) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 26 * dir, sy); ctx.stroke(); }
      }
    }
    function patchDraw(V, p, t, hit) {
      var x = V.X(p.x), y = V.Y(0, p.z), rx = p.rx * V.sx, rz = p.rz * DZ, pulse = .5 + .5 * Math.sin(t * 4);
      ctx.save();
      ctx.fillStyle = hit ? "rgba(110,220,120,.75)" : "rgba(150,95,50,.85)"; ctx.beginPath(); ctx.ellipse(x, y, rx, rz, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 3 + pulse * 2; ctx.strokeStyle = hit ? "#2f9e4f" : "rgba(255,214,77," + (.6 + .4 * pulse) + ")"; ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#1d2b3a"; ctx.beginPath(); ctx.ellipse(x, y, rx, rz, 0, 0, 7); ctx.stroke();
      if (!p.noLabel) label(ctx, p.label || "patch", x, Math.abs(p.x) < p.rx + 1 ? y + rz + 13 : y - rz - 12, { size: 14, box: "rgba(255,253,247,.9)" });
      ctx.restore();
    }
    function flag(V, x, t) {
      var X = V.X(x), yb = V.Y(0);
      ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X, yb); ctx.lineTo(X, yb - 46); ctx.stroke();
      ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.moveTo(X, yb - 46); ctx.lineTo(X + 26 + Math.sin(t * 6) * 3, yb - 39); ctx.lineTo(X, yb - 32); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.setLineDash([5, 7]); ctx.strokeStyle = "rgba(29,43,58,.35)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X, yb - 46); ctx.lineTo(X, V.Y(S.h) + 20); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, "drop here", X - 8, yb - 40, { size: 14, color: "#d1495b", box: "rgba(255,253,247,.85)", align: "right" });
    }
    function windsock(V, x, t, w) {
      var X = V.X(x), yb = V.Y(0, V.zf + 1), ws = w.speed || 0, dir = w.dx == null ? 1 : w.dx;
      ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X, yb); ctx.lineTo(X, yb - 70); ctx.stroke();
      var ang = (Math.PI / 2) * (1 - Math.min(1, ws / 6)) + Math.sin(t * 7) * .06 * Math.min(1, ws);
      ctx.save(); ctx.translate(X, yb - 66); ctx.scale(dir || 1, 1); ctx.rotate(ang);
      for (var i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? "#fff" : "#ff7b54"; ctx.beginPath(); ctx.moveTo(i * 9, -7 + i); ctx.lineTo(i * 9 + 9, -6 + i); ctx.lineTo(i * 9 + 9, 6 - i); ctx.lineTo(i * 9, 7 - i); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    function ellipseOnGround(V, cx, cz, el, col) {
      var a = el.a, b = el.b, th = el.angle;
      ctx.beginPath();
      for (var i = 0; i <= 40; i++) {
        var f = i / 40 * 2 * Math.PI, px = cx + a * Math.cos(f) * Math.cos(th) - b * Math.sin(f) * Math.sin(th), pz = cz + a * Math.cos(f) * Math.sin(th) + b * Math.sin(f) * Math.cos(th);
        if (i) ctx.lineTo(V.X(px), V.Y(0, pz)); else ctx.moveTo(V.X(px), V.Y(0, pz));
      }
      ctx.setLineDash([7, 5]); ctx.lineWidth = 3; ctx.strokeStyle = col || "#ffffff"; ctx.stroke(); ctx.setLineDash([]);
    }
    function pathAt(p, tt) {
      var i = Math.min(p.path.length - 1, Math.max(0, Math.round(tt / .03)));
      return p.path[i];
    }
    function cloudsDraw(V, t) {
      S.clouds.forEach(function (c, ci) {
        var tt = S.run ? S.run.t - c.t0 : 1e9;
        if (tt < 0) return;
        var landedN = 0;
        c.sim.seeds.forEach(function (p, i) {
          var cur = pathAt(p, tt), last = cur[0] >= p.t - 1e-6 || tt >= p.t;
          // trail
          ctx.strokeStyle = "rgba(90,61,43,.22)"; ctx.lineWidth = 1.5; ctx.beginPath();
          var n = Math.min(p.path.length - 1, Math.round(tt / .03));
          for (var k = 0; k <= n; k += 2) { var q = p.path[k], X = V.X(q[1] + c.x0), Y = V.Y(q[2], q[3]); if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
          if (n >= 0) { var q2 = p.path[n]; ctx.lineTo(V.X(q2[1] + c.x0), V.Y(q2[2], q2[3])); }
          ctx.stroke();
          var sx = V.X(cur[1] + c.x0), sy = V.Y(cur[2], cur[3]);
          if (last) {
            landedN++;
            var hit = S.rd && S.rd.patches.some(function (pa) { return inPatch(pa, cur[1] + c.x0, cur[3]); });
            if (hit) { ctx.fillStyle = "rgba(47,158,79,.6)"; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, 7); ctx.fill(); }
            drawSeed(ctx, sx, sy - 2, c.look, i, .9);
          } else drawSeed(ctx, sx, sy, c.look, tt * 6 + i, 1.15);
        });
        if (landedN > c.landedN) {
          if (c.landedN === 0 || landedN - c.landedN >= 6 || landedN === c.sim.seeds.length) RQ.audio.sfx("tick");
          for (var d = 0; d < Math.min(3, landedN - c.landedN); d++) S.dust.push({ x: V.X(c.sim.stats.centroid.x + c.x0) + u.rand(-20, 20), y: V.Y(0, c.sim.stats.centroid.z), r: 3, a: .6 });
          c.landedN = landedN;
        }
        if (landedN === c.sim.seeds.length && (!S.run || S.run.t >= c.t0 + c.sim.duration)) {
          var st = c.sim.stats;
          ellipseOnGround(V, st.centroid.x + c.x0, st.centroid.z, st.ellipse, "#ffffff");
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(V.X(st.centroid.x + c.x0), V.Y(0, st.centroid.z), 4, 0, 7); ctx.fill();
        }
      });
    }
    function ghostDraw(V) {
      if (!S.showGhost || S.run || !S.rd || S.rd.line) return;
      if (!S.ghost) S.ghost = R.sim({ n: S.mode === "spin_spread" ? 8 : 1, noise: false, wind: (function () { var w = R.windNow(); return { speed: w.speed, dx: w.dx == null ? 1 : w.dx, dz: w.dz || 0, gust: 0 }; })() });
      ctx.setLineDash([8, 6]); ctx.strokeStyle = "rgba(209,73,91,.85)"; ctx.lineWidth = 2.5;
      S.ghost.seeds.forEach(function (p) {
        ctx.beginPath(); p.path.forEach(function (q, k) { var X = V.X(q[1]), Y = V.Y(q[2], q[3]); if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke();
        var e = p.path[p.path.length - 1]; ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 3; ctx.translate(V.X(e[1]), V.Y(0, e[3]));
        ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke(); ctx.restore();
      });
      ctx.setLineDash([]);
    }
    function droneState(t) {
      var run = S.run, rd = S.rd || {};
      if (rd.line) return R.lineDrone ? R.lineDrone(t) : { x: 0, y: S.h };
      if (!run) return { x: 0, y: S.h, tilt: 0, roll: true };
      var o;
      if (run.t < run.ta) o = { x: -run.s * (run.ta - run.t), tilt: run.s > 0 ? .12 : 0 };
      else o = droneMotion(run.mode, run.s, run.t - run.ta);
      o.y = run.h;
      if (run.tree != null) {
        var lim = run.tree - 1.6;
        if (o.x >= lim) {
          if (run.bonk == null) { run.bonk = run.t; S.shake = .4; RQ.audio.sfx("boom"); L.timeout(function () { RQ.audio.sfx("giggle"); }, 350); }
          var bt = run.t - run.bonk; o.x = lim - Math.min(1.2, bt * 3) ; o.tilt = Math.sin(bt * 18) * .5 * Math.max(0, 1 - bt); o.dizzy = bt;
        }
      }
      return o;
    }
    function miniMap(t) {
      var rd = S.rd; if (!rd) return;
      var mw = 290, mh = 176, mx = cv.w - mw - 12, my = 12;
      var pts = [[0, 0]];
      rd.patches.forEach(function (p) { pts.push([p.x - p.rx, p.z - p.rz], [p.x + p.rx, p.z + p.rz]); });
      S.clouds.forEach(function (c) { if (!S.run || S.run.t > c.t0 + c.sim.duration) c.sim.seeds.forEach(function (p) { pts.push([p.x + c.x0, p.z]); }); });
      var x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity;
      pts.forEach(function (q) { x1 = Math.min(x1, q[0]); x2 = Math.max(x2, q[0]); z1 = Math.min(z1, q[1]); z2 = Math.max(z2, q[1]); });
      x1 -= 2; x2 += 2; z1 -= 2; z2 += 2;
      var sc = Math.min((mw - 20) / (x2 - x1), (mh - 44) / Math.max(z2 - z1, 6)), cxm = (x1 + x2) / 2, czm = (z1 + z2) / 2;
      var MX = function (x) { return mx + mw / 2 + (x - cxm) * sc; }, MY = function (z) { return my + 28 + (mh - 34) / 2 + (z - czm) * sc; };
      ctx.save();
      ctx.fillStyle = "rgba(255,253,247,.95)"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; u.rr(ctx, mx, my, mw, mh, 14); ctx.fill(); ctx.stroke();
      ctx.beginPath(); u.rr(ctx, mx + 6, my + 26, mw - 12, mh - 32, 9); ctx.fillStyle = "#9fd88a"; ctx.fill(); ctx.save(); ctx.clip();
      rd.patches.forEach(function (p) { ctx.fillStyle = "rgba(150,95,50,.85)"; ctx.beginPath(); ctx.ellipse(MX(p.x), MY(p.z), p.rx * sc, p.rz * sc, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "#ffd84d"; ctx.lineWidth = 2.5; ctx.stroke(); });
      ctx.setLineDash([6, 5]); ctx.strokeStyle = "rgba(29,43,58,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, MY(0)); ctx.lineTo(mx + mw, MY(0)); ctx.stroke(); ctx.setLineDash([]);
      S.clouds.forEach(function (c) {
        ctx.strokeStyle = "#d1495b"; ctx.lineWidth = 3; var rx0 = MX(c.x0), ry0 = MY(0);
        ctx.beginPath(); ctx.moveTo(rx0 - 5, ry0 - 5); ctx.lineTo(rx0 + 5, ry0 + 5); ctx.moveTo(rx0 + 5, ry0 - 5); ctx.lineTo(rx0 - 5, ry0 + 5); ctx.stroke();
        if (S.run && S.run.t <= c.t0 + c.sim.duration) return;
        c.sim.seeds.forEach(function (p) { var hit = rd.patches.some(function (pa) { return inPatch(pa, p.x + c.x0, p.z); }); ctx.fillStyle = hit ? "#2f9e4f" : "#fff"; ctx.beginPath(); ctx.arc(MX(p.x + c.x0), MY(p.z), 2.6, 0, 7); ctx.fill(); ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 1; ctx.stroke(); });
        var st = c.sim.stats, ex = st.centroid.x + c.x0, ez = st.centroid.z;
        ctx.save(); ctx.translate(MX(ex), MY(ez)); ctx.rotate(st.ellipse.angle); ctx.setLineDash([5, 4]); ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, Math.max(2, st.ellipse.a * sc), Math.max(2, st.ellipse.b * sc), 0, 0, 7); ctx.stroke(); ctx.restore();
        ctx.strokeStyle = "#d1495b"; ctx.fillStyle = "#d1495b"; ctx.lineWidth = 2;
        if (Math.hypot(MX(ex) - rx0, MY(ez) - ry0) > 14) arrow(ctx, rx0, ry0, MX(ex), MY(ez), 7);
      });
      ctx.restore();
      label(ctx, "Seen from above", mx + 12, my + 14, { size: 14, align: "left" });
      var w = R.windNow();
      if (w.speed) {
        var ax = mx + mw - 34, ay = my + 14, dx = w.dx == null ? 1 : w.dx, dz = w.dz || 0;
        ctx.strokeStyle = "#2b7bd0"; ctx.fillStyle = "#2b7bd0"; ctx.lineWidth = 3; arrow(ctx, ax - dx * 12, ay - dz * 8, ax + dx * 12, ay + dz * 8, 7);
        label(ctx, "wind", ax - 34, ay, { size: 12, color: "#2b7bd0" });
      }
      ctx.restore();
    }

    /* --- main loop */
    L.loop(function (dt, t) {
      S.t = t;
      var w = R.windNow();
      S.cloudX += (w.speed || 0) * (w.dx == null ? 1 : w.dx) * dt;
      var run = S.run;
      if (run) {
        run.t += dt * run.rate;
        if (!run.replay && !S.rd.line && (Math.floor(run.t * 10) !== Math.floor((run.t - dt * run.rate) * 10)) && run.t < run.ta + 1 && RQ.save.setting("sound"))
          RQ.audio.tone({ f: 120 + run.s * 9, f2: 110 + run.s * 9, type: "sawtooth", d: .16, v: .035, lp: 520 });
        if (run.t >= run.ta && !run.released) { run.released = true; RQ.audio.sfx("drop"); }
        if (!S.rd.line && run.t >= run.end) {
          S.run = null; run.released = false; dropBtn.disabled = false; slowBtn.disabled = false;
          if (!run.replay && S.onDone) S.onDone();
        }
        if (S.rd.line && R.lineTick) R.lineTick(dt);
      }
      var V = view();
      ctx.save();
      if (S.shake > 0) { S.shake -= dt; ctx.translate(u.rand(-6, 6) * S.shake * 2, u.rand(-4, 4) * S.shake * 2); }
      background(V, t, w);
      rulers(V);
      windArrows(V, t, w);
      var rd = S.rd || { patches: [] };
      if (rd.tree != null) drawTree(ctx, V.X(rd.tree), V.Y(0, -1), 21 * V.sy, Math.sin(t * 1.5) * (1 + (w.speed || 0) * .4));
      windsock(V, rd.sock == null ? 24 : rd.sock, t, w);
      var landed = S.clouds.length && S.clouds.every(function (c) { return c.landedN === c.sim.seeds.length; });
      rd.patches.forEach(function (p) { patchDraw(V, p, t, landed && S.lastRes && S.lastRes.ok); });
      if (!rd.line) flag(V, 0, t);
      if (R.lineDecor) R.lineDecor(V, t);
      ghostDraw(V);
      cloudsDraw(V, t);
      S.dust = S.dust.filter(function (d) { d.r += dt * 30; d.a -= dt * .9; ctx.fillStyle = "rgba(160,120,80," + Math.max(0, d.a) + ")"; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); return d.a > 0; });
      var ds = droneState(t);
      var bob = Math.sin(t * 3) * 2;
      ctx.fillStyle = "rgba(29,43,58,.18)"; ctx.beginPath(); ctx.ellipse(V.X(ds.x), V.Y(0), 26, 6, 0, 0, 7); ctx.fill();
      drawDrone(ctx, V.X(ds.x), V.Y(ds.y) + bob - 14, 1, { tilt: ds.tilt, yaw: ds.yaw, hatch: ds.hatch, flick: ds.flick, roll: true }, t);
      if (ds.dizzy != null && ds.dizzy < 2) { for (var k = 0; k < 3; k++) { var a = t * 5 + k * 2.1; label(ctx, "⭐", V.X(ds.x) + Math.cos(a) * 30, V.Y(ds.y) - 44 + Math.sin(a) * 8, { size: 16 }); } }
      label(ctx, u.fmt(ds.y, 0) + " m", V.X(ds.x) - 58, V.Y(ds.y) - 14, { size: 13, box: "rgba(255,253,247,.85)" });
      miniMap(t);
      ctx.restore();
    });
    return R;
  }

  /* ------------------------------------------------------------ levels 1-4: rounds of patches */
  function rounds(keys, list, doneMsg) {
    return function (L) {
      var R = range(L), used = 0, totalIn = 0, best = 0;
      R.build(keys);
      var chain = Promise.resolve();
      list.forEach(function (mk, i) {
        chain = chain.then(function () {
          if (!L.alive) return;
          var rd = mk(R.S);
          L.hud.set("round", "🎯 " + (i + 1) + " / " + list.length);
          R.setRound(rd);
          return (rd.talk ? L.talk(rd.talk) : Promise.resolve()).then(function () {
            if (!L.alive) return;
            return R.playRound(rd).then(function (r) { used += r.used; totalIn += r.res.inP; best = Math.max(best, r.res.inP); L.hud.set("rolls", "🧻 " + used); });
          });
        });
      });
      chain.then(function () {
        if (!L.alive) return;
        var extra = used - list.length, stars = extra <= 1 ? 3 : extra <= 4 ? 2 : 1;
        L.win({ stars: stars, msg: doneMsg, stats: { "Seed rolls used": used, "Seeds in patches": totalIn } });
      });
    };
  }
  /** Centre a patch where a given setup lands: the noise-free prediction (no gust, average release). */
  function landingOf(o) {
    var r = P.simulate(Object.assign({}, o, { n: 1, noise: false, wind: Object.assign({}, o.wind, { gust: 0 }) }));
    return { x: r.stats.centroid.x, z: r.stats.centroid.z };
  }
  var CALM = { speed: 0, gust: 0 }, GUST = .3;   // gentle gusts while learning (ReSeed's default Wind() uses 0.8)

  var L1 = rounds(["h", "s"], [
    function (S) {
      var c = landingOf({ vt: S.book.oak.vt, mode: "hatch_drop", alt: 20, speed: 4, wind: CALM });
      return { set: { h: 20, s: 4, seed: "oak", mode: "hatch_drop" }, wind: CALM, xMax: 26, sock: 20,
        patches: [{ x: Math.round(c.x * 2) / 2, z: 0, rx: 1.4, rz: 1.6 }], goal: "Press **DROP** (Space) and watch the acorns",
        talk: [["koa", "No wind today. Press **DROP** and watch where the acorns land."]] };
    },
    function () {
      return { wind: CALM, xMax: 26, sock: 20, patches: [{ x: 2, z: 0, rx: 1.3, rz: 1.6 }], goal: "This patch is close to the flag",
        talk: [["koa", "The acorns kept flying forward with the drone! That is **inertia**."], ["koa", "This patch is close to the flag. Change the **speed** or **height**, then drop."]],
        hint: [["koa", "💡 Slow down! At 1 m/s the acorns barely move forward."]] };
    },
    function () {
      return { wind: CALM, xMax: 26, sock: 22, patches: [{ x: 12.5, z: 0, rx: 1.4, rz: 1.6 }], goal: "Reach the far patch",
        talk: [["koa", "Now a far patch. Fast seeds fly farther, and high seeds fall for longer."]],
        hint: [["koa", "💡 Try **7 m/s** and fly **high**, like 20 m or more."]] };
    }
  ], "The acorns keep the drone's speed: that's **inertia**!");

  var L2 = rounds(["h", "s", "w"], [
    function (S) {
      var vt = S.book.parica.vt, c = landingOf({ vt: vt, mode: "hatch_drop", alt: 15, speed: 0, wind: { speed: 5 } });
      return { set: { h: 15, s: 0, w: 1, seed: "parica" }, lock: ["h", "s"], windFromSlider: true, seedObj: S.book.parica, xMax: 26, sock: 20,
        patches: [{ x: Math.round(c.x * 2) / 2, z: 0, rx: 1.6, rz: 1.6 }], goal: "The drone hovers. Set the **wind** machine!",
        talk: [["koa", "These **Paricá** seeds from the Amazon fall slower than acorns. The drone just hovers."], ["koa", "Turn up my wind machine so the wind carries the seeds onto the patch."]],
        hint: [["koa", "💡 Try about **5 m/s** of wind."]] };
    },
    function (S) {
      return { set: { h: 20, s: 4, w: 4 }, lock: ["w"], wind: { speed: 4, dx: 1, gust: GUST }, seedObj: S.book.parica, xMax: 26, sock: 20,
        patches: [{ x: 4.5, z: 0, rx: 1.6, rz: 1.6 }], goal: "Real wind: 4 m/s from behind",
        talk: [["koa", "Now real wind, 4 m/s from behind. It blows harder **high up**: look at the arrows."]],
        hint: [["koa", "💡 Fly **lower** and **slower**. Low seeds spend less time in the wind."]] };
    },
    function (S) {
      return { set: { h: 20, s: 2, w: 4 }, lock: ["w"], wind: { speed: 4, dx: -1, gust: GUST }, seedObj: S.book.parica, xMin: -16, xMax: 22, sock: 14,
        patches: [{ x: 2.5, z: 0, rx: 1.6, rz: 1.6 }], goal: "Headwind! It blows the seeds back",
        talk: [["koa", "Uh oh, a **headwind** blows towards us. It pushes seeds backwards!"]],
        hint: [["koa", "💡 Fly **low** (about 5 m) and **fast** (about 5 m/s)."]] };
    }
  ], "You can read the wind like a real pilot!");

  var L3 = rounds(["h", "s", "seed"], [
    function (S) {
      var W5 = { speed: 5, dx: 1, gust: GUST }, c = landingOf({ vt: S.book.oak.vt, mode: "hatch_drop", alt: 20, speed: 2, wind: W5 });
      return { set: { h: 20, s: 2, seed: "pine" }, lock: ["h", "s"], wind: W5, xMax: 32, sock: 26,
        patches: [{ x: Math.round(c.x * 2) / 2, z: 0, rx: 1.5, rz: 1.6 }], goal: "Which seed lands **here** in this wind?",
        talk: [["koa", "Windy day: 5 m/s! Every seed has its own **terminal velocity**, its top falling speed."], ["koa", "Fast-falling seeds land near and slow ones drift far. Pick the seed for this patch."]],
        hint: [["koa", "💡 The patch is close. Pick the seed that falls **fastest**."]] };
    },
    function (S) {
      var W5 = { speed: 5, dx: 1, gust: GUST }, c = landingOf({ vt: S.book.pine.vt, mode: "hatch_drop", alt: 20, speed: 2, wind: W5 });
      return { set: { h: 20, s: 2, seed: "oak" }, lock: ["h", "s"], wind: W5, xMax: 32, sock: 6,
        patches: [{ x: Math.round(c.x * 2) / 2, z: 0, rx: 1.8, rz: 1.8 }], goal: "A far patch, same wind",
        talk: [["koa", "This patch is far downwind. Which seed will the wind carry that far?"]],
        hint: [["koa", "💡 Pick the slowest-falling seed: the pine seed with its papery wing removed."]] };
    },
    function (S) {
      var W5 = { speed: 5, dx: 1, gust: GUST };
      return { set: { h: 20, s: 2, seed: "pine" }, lock: ["seed", "s"], wind: W5, xMax: 32, sock: 26,
        patches: [{ x: 5.5, z: 0, rx: 1.6, rz: 1.6 }], goal: "Pine seeds only: change the **height**",
        talk: [["koa", "The Sierra needs pine seeds right **here**, close by. Same wind."], ["koa", "You can't change the seed now. What else can you change?"]],
        hint: [["koa", "💡 Fly **lower**, about 8 to 9 m. Less time falling means less drift."]] };
    }
  ], "Fast-falling seeds land near and slow-falling seeds drift far. You matched them to the wind!");

  var L4 = rounds(["h", "s", "mode"], [
    function () {
      return { set: { h: 15, s: 3, mode: "hatch_drop", seed: "oak" }, lock: ["h", "s"], wind: CALM, xMax: 26, sock: 20,
        patches: [{ x: .4, z: 0, rx: 2.2, rz: 2.2 }], goal: "Land acorns right under the flag while flying",
        talk: [["koa", "My drone has four ways to let seeds go: the **release modes**."], ["koa", "We fly at 3 m/s, but the patch is right under the flag. Which mode cancels our speed?"]],
        hint: [["koa", "💡 **Backward flick** throws the seeds back at about 3 m/s."]] };
    },
    function () {
      return { set: { h: 15, s: 4, mode: "hatch_drop" }, lock: ["h", "s"], wind: CALM, xMax: 26, sock: 20,
        patches: [{ x: 6.3, z: 0, rx: 6.5, rz: 6.5, label: "big meadow" }], goal: "Spread acorns over the **whole** meadow",
        check: function (res) {
          var ok = res.frac >= .5 && res.st.blastRadius >= 3;
          return { ok: ok, msg: ok ? "🌀 Spread out over **" + u.fmt(res.st.blastRadius * 2, 0) + " m**!" : res.st.blastRadius < 3 ? "Too bunched up! The seedlings will crowd each other." : null };
        },
        talk: [["koa", "This big meadow needs acorns **spread out**, not in one heap."]],
        hint: [["koa", "💡 **Spin spread**: the drone spins and seeds fly out in a ring."]] };
    },
    function () {
      return { set: { h: 15, s: 4, mode: "hatch_drop" }, lock: ["h", "s"], wind: CALM, xMax: 26, sock: 4, tree: 11,
        patches: [{ x: 6.5, z: 0, rx: 1.5, rz: 1.6 }], goal: "Hit the patch, but **brake** before the tree",
        talk: [["koa", "A tall tree stands past the patch. The drone must **brake**, but the seeds must fly on."]],
        hint: [["koa", "💡 **Jerk back**: the drone brakes hard and the seeds keep going. That's our demo-day move!"]] };
    }
  ], "Four release modes mastered. Jerk back is the one we use on demo day!");

  /* ------------------------------------------------------------ level 5: My Site, the real footprint */
  function mySite(L) {
    var site = RQ.mySite(), fp = (site && site.release_footprint) || { drift_m: 7.87, blast_radius_m: .65, mean_fall_s: 2.9 };
    var biome = site ? site.biome : "tropical_moist_forest", d = RQ.data(), sp = (d.biomes[biome] || {}).species || [];
    var lead = sp.reduce(function (a, b) { return !a || b.share > a.share ? b : a; }, null) || { common: "Paricá", v_terminal: 8, delivery: "bare seed" };
    var seedObj = { name: lead.common, vt: lead.v_terminal, look: lookOf(lead) };
    var place = site ? site.name : "Rondônia";
    var WIND = { speed: 3, dx: 0, dz: 1, gust: .8 };   // physics.Wind(): 3 m/s from the west; the drone flies north
    var R = range(L), S = R.S;
    R.build([]);
    L.hud.set("site", "📍 " + u.esc(place));
    var cx = 0, cz = 0, simRes = null;

    // Part A + B: predict, then fly ReSeed's own settings
    var rdB = { set: { h: 20, s: 4, mode: "hatch_drop" }, seedObj: seedObj, wind: WIND, xMax: 26, sock: 20, simExtra: { n: 60 }, zf: -3, zn: 12,
      patches: [], goal: "ReSeed's model: **hatch drop**, 20 m, 4 m/s, side wind 3 m/s",
      check: function (res) { return { ok: true, msg: "Drift **" + u.fmt(res.st.drift, 1) + " m**" }; } };
    var buckets = [0, Math.round(fp.drift_m), Math.round(fp.drift_m * 4)];
    R.setRound(rdB);
    L.talk([["koa", "This is **your** forest! ReSeed's physics model estimated a seed drop for it, with the same math as this game."],
      ["koa", "Hatch drop from 20 m at 4 m/s, with a 3 m/s wind from the side."]]).then(function () {
      if (!L.alive) return;
      return L.choose("koa", "Guess first! How far from the drop point will the seeds land?",
        ["Straight down: **0 m**", "About **" + buckets[1] + " m** away", "About **" + buckets[2] + " m** away"]);
    }).then(function (pick) {
      if (!L.alive) return;
      L.toast(pick === 1 ? "Good guess! Let's check." : "Let's find out!", pick === 1 ? "good" : "info", 2000);
      S.onDrop = function (res) { simRes = res; };
      return R.playRound(rdB);
    }).then(function () {
      if (!L.alive) return;
      var st = simRes.st, avg = { drift: 0, r: 0, t: 0 }, K = 20;
      // Monte Carlo: repeat the same release 20 times (different gusts) and average, like a planner would
      for (var i = 0; i < K; i++) {
        var q = P.simulate({ vt: seedObj.vt, mode: "hatch_drop", n: 60, alt: 20, speed: 4, seed: 4242 + i * 131, wind: WIND }).stats;
        avg.drift += q.drift / K; avg.r += q.blastRadius / K; avg.t += q.meanFall / K; cx += q.centroid.x / K; cz += q.centroid.z / K;
      }
      var tbl = '<table class="sd-cmp"><tr><th></th><th>Your drop</th><th>20 game drops<br><small>(average)</small></th><th>ReSeed estimate<br><code>pipeline.py</code></th></tr>' +
        "<tr><td>↔ Drift</td><td>" + u.fmt(st.drift, 1) + " m</td><td>" + u.fmt(avg.drift, 1) + " m</td><td>" + u.fmt(fp.drift_m, 1) + " m</td></tr>" +
        "<tr><td>◎ 90% within</td><td>" + u.fmt(st.blastRadius, 2) + " m</td><td>" + u.fmt(avg.r, 2) + " m</td><td>" + u.fmt(fp.blast_radius_m, 2) + " m</td></tr>" +
        "<tr><td>⏱ Fall time</td><td>" + u.fmt(st.meanFall, 1) + " s</td><td>" + u.fmt(avg.t, 1) + " s</td><td>" + u.fmt(fp.mean_fall_s, 1) + " s</td></tr></table>";
      return RQ.ui.modal({ icon: "🎯", title: "Release footprint: " + u.esc(place), html: "<p>" + u.esc(lead.common) + " seeds fall at " + lead.v_terminal + " m/s.</p>" + tbl +
        '<p class="muted">Gusts are random, so every drop is a little different. Averages agree!</p>', buttons: [{ label: "Next ▶", cls: "go" }] });
    }).then(function () {
      if (!L.alive) return;
      return L.talk([["koa", "In this game, let go **before** each patch, a little upwind. My computer marks where the seeds should land."],
        ["koa", "Press **DROP** when the red target sits on a patch. You have 4 rolls for 3 patches."]]);
    }).then(function () { if (L.alive) lineRun(); });

    // Part C: timed drops along a seeding line
    function lineRun() {
      var marks = [6, 20, 34], xEnd = 34 + cx + 9, n = 40, rolls = 4;
      var rdC = { line: true, seedObj: seedObj, wind: WIND, xMin: -12, xMax: xEnd + 2, sock: xEnd - 3, zf: -3, zn: 12,
        patches: marks.map(function (m, i) { return { x: m + cx, z: Math.max(-1, Math.min(10, cz)), rx: 1.7, rz: 1.7, label: "patch " + (i + 1) }; }),
        goal: "Press **DROP** (Space) when the red target is on a patch" };
      S.h = 20; S.s = 4; S.mode = "hatch_drop";
      R.setRound(rdC);
      var fly = { x: -12, t: 0, done: false };
      S.run = { t: 0, rate: 1, ta: 0, s: 4, h: 20, mode: "hatch_drop" };
      L.hud.set("rolls", "🧻 " + rolls + " left");
      R.lineDrone = function () { return { x: fly.x, y: 20, tilt: .12, hatch: S.clouds.length && S.run && S.run.t - S.clouds[S.clouds.length - 1].t0 < .5 ? 1 : 0 }; };
      R.lineDecor = function (V, t) {
        if (fly.done) return;
        var gx = V.X(fly.x + cx), gy = V.Y(0, cz), on = rdC.patches.some(function (p) { return inPatch(p, fly.x + cx, cz); });
        ctx2(V, gx, gy, on, t);
      };
      function ctx2(V, gx, gy, on, t) {
        var c = R.ctx;
        c.save(); c.strokeStyle = on ? "#2f9e4f" : "#d1495b"; c.lineWidth = 3; c.setLineDash([6, 5]);
        c.beginPath(); c.moveTo(V.X(fly.x), V.Y(20) + 10); c.lineTo(gx, gy); c.stroke(); c.setLineDash([]);
        var r = 12 + Math.sin(t * 8) * 2; c.beginPath(); c.ellipse(gx, gy, r, r * .45, 0, 0, 7); c.stroke();
        c.beginPath(); c.moveTo(gx - r - 5, gy); c.lineTo(gx + r + 5, gy); c.moveTo(gx, gy - 9); c.lineTo(gx, gy + 9); c.stroke(); c.restore();
      }
      R.lineDrop = function () {
        if (fly.done || rolls <= 0) return;
        rolls--; L.hud.set("rolls", "🧻 " + rolls + " left");
        var sim = P.simulate({ vt: seedObj.vt, mode: "hatch_drop", n: n, alt: 20, speed: 4, seed: (Math.random() * 1e9) | 0, wind: WIND });
        S.clouds.push({ x0: fly.x, t0: S.run.t, sim: sim, look: seedObj.look, landedN: 0 });
        RQ.audio.sfx("drop");
        if (rolls <= 0) R.dropBtn.disabled = true;
      };
      R.lineTick = function (dt) {
        if (!fly.done) {
          fly.x += 4 * dt;
          if (Math.floor(S.run.t * 10) !== Math.floor((S.run.t - dt) * 10) && RQ.save.setting("sound")) RQ.audio.tone({ f: 156, f2: 146, type: "sawtooth", d: .16, v: .03, lp: 520 });
          if (fly.x >= xEnd) fly.done = true;
        }
        var allDown = S.clouds.every(function (c) { return S.run.t >= c.t0 + c.sim.duration + .3; });
        if (fly.done && allDown && !fly.ended) { fly.ended = true; L.timeout(finish, 600); }
      };
      function finish() {
        var inP = 0, hitPatches = rdC.patches.map(function () { return 0; });
        S.clouds.forEach(function (c) { c.sim.seeds.forEach(function (p) { rdC.patches.forEach(function (pa, i) { if (inPatch(pa, p.x + c.x0, p.z)) { inP++; hitPatches[i]++; } }); }); });
        var patchesHit = hitPatches.filter(function (k) { return k >= n * .4; }).length;
        var stars = patchesHit >= 3 ? 3 : patchesHit >= 2 ? 2 : 1;
        RQ.audio.sfx(patchesHit ? "good" : "bad");
        L.win({ stars: stars, msg: patchesHit + " of 3 patches seeded at **" + u.esc(place) + "**. ReSeed's model estimates this drift for every site that needs seeding.",
          stats: { "Patches seeded": patchesHit + " / 3", "Seeds in patches": inP, "Real drift": u.fmt(fp.drift_m, 1) + " m" } });
      }
    }
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g19",
    music: "sky",
    intro: [
      ["koa", "G'day, I'm Koa from Kangaroo Island! Welcome to my seed drop range."],
      ["koa", "Seeds can drift as they fall. Their starting speed, gravity and moving air all shape their path."],
      ["sprout", "ReSeed simulates a cloud of seeds to estimate where they land. Let's learn to predict like it does!"]
    ],
    outro: [
      ["koa", "Bonza! You can predict where a seed cloud lands, just like ReSeed's physics model."],
      ["sprout", "Next stop: Drone Academy. Let's earn your pilot wings!"]
    ],
    levels: [
      { title: "Still air", goal: "Land the acorns in the glowing patch", cards: ["inertia"],
        intro: [["koa", "Set the **height** and **speed**, then press **DROP**. The red flag is where the drone lets go."]],
        play: L1 },
      { title: "Wind!", goal: "Let the wind carry the seeds", cards: ["wind-drift"],
        intro: [["koa", "Wind pushes falling seeds sideways. Slow-falling seeds spend longer drifting."]],
        play: L2 },
      { title: "Pick the seed", goal: "Choose the right seed for the wind", cards: ["terminal-velocity"],
        intro: [["koa", "Acorns fall fast, but pine seeds with their wings removed float down slowly. Let's use that!"]],
        play: L3 },
      { title: "Release modes", goal: "Pick the right way to let go", cards: ["release-modes"],
        intro: [["koa", "Same seeds, four tricks: hatch drop, jerk back, backward flick and spin spread."]],
        play: L4 },
      { title: "My Site drop", goal: "Fly ReSeed's real release plan", cards: ["simulation", "footprint"],
        intro: [["sprout", "Now try the seed-drop estimate that ReSeed's model made for **My Site**."]],
        play: mySite }
    ]
  });
})();
