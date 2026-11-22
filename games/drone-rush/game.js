/* g21 Drone Rush — side-scrolling physics flying adventure (original art and levels).
 * Fly the seed drone over hills, carry the seed pack on a rope, drop it on the glowing patch (checkpoint), fly home and land
 * before the battery runs out. Battery drains faster with payload, like reseed/logistics.py:
 *   endurance_with_payload = endurance × (1 − 0.35 × payload / max_payload)
 * Levels add ONE complication each: hills → gusts → trees, birds and power lines → night + tight battery → storm + two drops.
 * Controls: thrust W / ↑ / hold ▲ · tilt A D / ← → / ◀ ▶ · drop Space / S / ↓ / 🌰. */
(function () {
  "use strict";
  var u = RQ.u;
  var H = 600, G = 760, STEP = 1 / 120, ROPE = 64, PX_M = 6, CEIL_M = 120;
  var TMAX = 2.3 * G, IDLE = .72, TILT = .72, ANG_K = 50, ANG_D = 11, DRAG_L = .75, DRAG_Q = .0018, INERTIA = 900;
  var SKIDS = [[-20, 22], [20, 22]], HARD = [[-38, -12], [38, -12], [0, -20], [-22, 6], [22, 6]];

  /* ------------------------------------------------------------ level designs */
  var LV = [
    { seed: 11, len: 3400, pad: 300, patches: [2700], hill: [[80, 640], [38, 260], [14, 110]], drain: 1.4, pack: 600, packs: 1, par: 45, batGoal: 45 },
    { seed: 23, len: 3800, pad: 300, patches: [3100], hill: [[110, 620], [46, 240], [16, 100]], drain: 1.4, pack: 600, packs: 1, par: 55, batGoal: 40,
      wind: { base: 30, gust: [200, 320], every: [3.2, 5.5], dur: 1.6 } },
    { seed: 37, len: 4200, pad: 300, patches: [3500], hill: [[120, 700], [52, 260], [18, 90]], drain: 1.3, pack: 600, packs: 1, par: 70, batGoal: 35,
      trees: [[900, 200], [1200, 240], [1550, 190], [2500, 250], [2800, 210], [3150, 230], [3720, 220]],
      birds: [[1100, 210, 160], [1700, 300, 220], [2300, 170, 180], [2750, 330, 200], [3850, 240, 160]], lines: [[1850, 2150]] },
    { seed: 51, len: 3900, pad: 300, patches: [3200], hill: [[100, 600], [44, 250], [16, 100]], drain: 2.1, pack: 600, packs: 1, par: 60, batGoal: 20,
      night: true, trees: [[1200, 220], [1900, 240], [2500, 200], [3550, 230]], wind: { base: 15 } },
    { seed: 77, len: 4900, pad: 300, patches: [2200, 4100], hill: [[130, 680], [50, 250], [18, 95]], drain: 1.25, pack: 450, packs: 2, par: 110, batGoal: 20,
      rain: true, trees: [[1300, 220], [2600, 240], [3450, 250], [3700, 210], [4500, 220]], lines: [[2900, 3200]],
      wind: { base: -35, gust: [240, 360], every: [2.6, 4.6], dur: 1.6 } }
  ];

  /* ------------------------------------------------------------ world: terrain + obstacles */
  function makeWorld(cfg) {
    var R = u.seeded(cfg.seed), ph = cfg.hill.map(function () { return R() * 6.283; });
    var N = Math.ceil(cfg.len / 8) + 4, gy = new Float32Array(N), BASE = 430;
    function raw(x) {
      var h = 0;
      cfg.hill.forEach(function (c, i) { h += c[0] * Math.sin(x / c[1] * 6.283 + ph[i]); });
      return BASE - 110 - h * .9 - Math.max(0, h) * .15;
    }
    for (var i = 0; i < N; i++) gy[i] = raw(i * 8);
    var flats = [{ x: cfg.pad, half: 90 }].concat(cfg.patches.map(function (p) { return { x: p, half: 140 }; }));
    // the ground rises gently out of the home valley (no cliff right after take-off)
    var padY = raw(cfg.pad);
    for (var j = 0; j < N; j++) { var dd = Math.abs(j * 8 - cfg.pad), q = smooth((dd - 90) / 900); gy[j] = padY + (gy[j] - padY) * q; }
    flats.forEach(function (f) {
      var target = f.x === cfg.pad ? padY : raw(f.x);
      for (var i = 0; i < N; i++) {
        var d = Math.abs(i * 8 - f.x), b = d <= f.half ? 1 : d >= f.half + 170 ? 0 : 1 - smooth((d - f.half) / 170);
        if (b > 0) gy[i] = gy[i] * (1 - b) + target * b;
      }
    });
    var W = { len: cfg.len, gy: gy, cfg: cfg, pad: cfg.pad,
      patches: cfg.patches.map(function (x) { return { x: x, half: 130, done: false, sprouts: [] }; }),
      trees: (cfg.trees || []).map(function (t) { return { x: t[0], h: t[1], sway: R() * 6 }; }),
      birds: (cfg.birds || []).map(function (b, i) { return { x0: b[0], alt: b[1], range: b[2], ph: R() * 6, sp: .55 + R() * .35, dir: i % 2 ? -1 : 1 }; }),
      lines: (cfg.lines || []).map(function (l) { return { x1: l[0], x2: l[1], h: 230 }; }) };
    W.y = function (x) {
      var f = u.clamp(x, 0, cfg.len) / 8, i = Math.floor(f), t = f - i;
      return gy[Math.min(i, N - 1)] * (1 - t) + gy[Math.min(i + 1, N - 1)] * t;
    };
    W.slope = function (x) { return Math.atan2(W.y(x + 10) - W.y(x - 10), 20); };
    W.lines.forEach(function (l) { l.y1 = W.y(l.x1) - l.h; l.y2 = W.y(l.x2) - l.h; });
    W.wireY = function (l, x, k) { var t = (x - l.x1) / (l.x2 - l.x1); return l.y1 + (l.y2 - l.y1) * t + 70 * 4 * t * (1 - t) + k * 22; };
    W.birdPos = function (b, t) {
      var s = Math.sin(t * b.sp + b.ph), x = b.x0 + s * b.range;
      return { x: x, y: W.y(x) - b.alt + Math.sin(t * 2.3 + b.ph) * 14, dir: Math.cos(t * b.sp + b.ph) * b.dir >= 0 ? 1 : -1 };
    };
    W.treeCircles = function (tr) {
      var b = W.y(tr.x);
      return [[tr.x, b - tr.h * .34, tr.h * .24], [tr.x, b - tr.h * .6, tr.h * .17], [tr.x, b - tr.h * .82, tr.h * .1], [tr.x, b - tr.h * .1, 12]];
    };
    return W;
  }
  function smooth(t) { t = u.clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* ------------------------------------------------------------ drawing */
  var koaImg = null;
  function koaImage() {
    if (!koaImg && RQ.chars) { koaImg = new Image(); koaImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg("koa", { mood: "happy" }).replace("<svg ", '<svg width="120" height="120" ')); }
    return koaImg;
  }
  function drawDrone(ctx, d, t, face) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
    ctx.lineWidth = 3; ctx.strokeStyle = "#1d2b3a"; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(-19, 22); ctx.moveTo(13, 6); ctx.lineTo(19, 22); ctx.moveTo(-27, 22); ctx.lineTo(-11, 22); ctx.moveTo(11, 22); ctx.lineTo(27, 22); ctx.stroke();
    ctx.fillStyle = "#33465a"; ctx.fillRect(-40, -9, 80, 6); ctx.strokeRect(-40, -9, 80, 6);
    [-36, 36].forEach(function (rx, i) {
      ctx.fillStyle = "#1d2b3a"; ctx.fillRect(rx - 4, -17, 8, 9);
      if (d.props === false) return;
      var fl = d.th > .02 ? .55 + .45 * Math.abs(Math.sin(t * 45 + i * 1.7)) : 1;
      ctx.fillStyle = "rgba(205,230,255," + (.5 + .35 * fl) + ")"; ctx.beginPath(); ctx.ellipse(rx, -19, d.th > .02 ? 24 * fl + 4 : 22, 3.4, 0, 0, 7); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = "#2b7bd0"; u.rr(ctx, -22, -16, 44, 24, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8be07f"; ctx.beginPath(); ctx.ellipse(-12, -2, 5, 3, -.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#163042"; u.rr(ctx, 2, -12, 18, 14, 5); ctx.fill();
    if (face === "bonk") {
      ctx.strokeStyle = "#7ff0ff"; ctx.lineWidth = 2;
      [7, 15].forEach(function (ex) { ctx.beginPath(); ctx.moveTo(ex - 2.5, -8.5); ctx.lineTo(ex + 2.5, -3.5); ctx.moveTo(ex + 2.5, -8.5); ctx.lineTo(ex - 2.5, -3.5); ctx.stroke(); });
    } else { ctx.fillStyle = "#7ff0ff"; ctx.beginPath(); ctx.arc(8, -6, 2.3, 0, 7); ctx.arc(15, -6, 2.3, 0, 7); ctx.fill(); }
    ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, -16); ctx.quadraticCurveTo(-6, -26, -1, -30); ctx.stroke();
    ctx.fillStyle = "#8be07f"; ctx.beginPath(); ctx.ellipse(4, -31, 7, 3.5, -.4, 0, 7); ctx.fill(); ctx.stroke();
    if (d.light) { ctx.fillStyle = "#fff6a8"; ctx.beginPath(); ctx.arc(21, -2, 3, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawRoll(ctx, x, y, n, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0); ctx.lineWidth = 2.5; ctx.strokeStyle = "#1d2b3a";
    for (var i = 0; i < n; i++) {
      var oy = -i * 13;   // a stack of packs, the lowest one at the rope's end
      ctx.fillStyle = "#d9b27c"; u.rr(ctx, -15, -6 + oy, 30, 12, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#6b4423"; ctx.beginPath(); ctx.ellipse(15, oy, 3, 6, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#4cb864"; ctx.beginPath(); ctx.arc(-5, oy, 2.5, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function drawTree(ctx, x, yb, h, sway, night) {
    ctx.save(); ctx.translate(x, yb); ctx.lineWidth = 3; ctx.strokeStyle = "#1d2b3a";
    ctx.fillStyle = night ? "#3b2a20" : "#7a4e2d"; ctx.fillRect(-8, -h * .22, 16, h * .22); ctx.strokeRect(-8, -h * .22, 16, h * .22);
    var cols = night ? ["#1c3a2a", "#204630", "#255236", "#2a5d3c"] : ["#2f7d3a", "#35914a", "#3fa457", "#4cb864"];
    for (var i = 0; i < 4; i++) {
      var y0 = -h * (.14 + i * .2), w = h * (.34 - i * .065), s = sway * (i + 1);
      ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(-w + s, y0); ctx.lineTo(s * 1.5, y0 - h * .32); ctx.lineTo(w + s, y0); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function drawBird(ctx, x, y, dir, t, night) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    var f = Math.sin(t * 14) * 10;
    ctx.lineWidth = 2.5; ctx.strokeStyle = "#1d2b3a"; ctx.fillStyle = night ? "#55607a" : "#5b6ee1";
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = night ? "#6b7690" : "#8c9cf2"; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.quadraticCurveTo(-2, -16 - f, 8, -4 - f * .6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffb347"; ctx.beginPath(); ctx.moveTo(13, -2); ctx.lineTo(21, 1); ctx.lineTo(13, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(8, -3, 3, 0, 7); ctx.fill(); ctx.fillStyle = "#1d2b3a"; ctx.beginPath(); ctx.arc(9, -3, 1.4, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------ one level */
  function level(idx) {
    return function (L) {
      var cfg = LV[idx], Wd = makeWorld(cfg);
      var drone = RQ.data() && RQ.data().drones ? RQ.data().drones.prototype : { endurance_min: 22, max_payload_g: 900 };
      var root = u.el("div", { class: "dr-root" }); L.stage.appendChild(root);
      var cv = L.canvas({ w: 900, h: H, parent: root, fill: true, label: "Drone Rush flying level" }), ctx = cv.ctx;
      var tip = u.el("div", { class: "dr-tip hide" }); root.appendChild(tip);
      var IN = { up: false, left: false, right: false };
      var S = {
        t: 0, acc: 0, started: false, timer: 0, crashes: 0, swaps: 0, battery: 100, drops: 0, rollsLeft: cfg.packs, won: false, landT: 0,
        d: { x: 0, y: 0, vx: 0, vy: 0, a: 0, w: 0, th: 0, landed: true, light: !!cfg.night },
        roll: { x: 0, y: 0, vx: 0, vy: 0 }, falling: [], parts: [], crash: null, shake: 0, cam: { x: 0, y: 0 }, flash: 0,
        wind: 0, gust: { v: 0, t0: -1, dur: 0, next: 4, warn: 0 }, cp: null, tipKey: "", rain: [], nextBolt: 6, lowBeep: 0, hum: 0, ceilWarn: 0, msgT: 0, msg: ""
      };
      window.__droneRush = { S: S, W: Wd, cfg: cfg, IN: IN };   // read-only handle for the automated input test
      var payloadFactor = function () { return 1 - .35 * Math.min(S.rollsLeft * cfg.pack / drone.max_payload_g, 1); };

      /* --- checkpoints */
      function setCp(x, y, landed) { S.cp = { x: x, y: y, landed: landed, battery: S.battery, rollsLeft: S.rollsLeft }; }
      function spawn(cp) {
        var d = S.d;
        d.x = cp.x; d.y = cp.landed ? Wd.y(cp.x) - 22 : cp.y; d.vx = d.vy = d.w = d.a = 0; d.th = 0; d.landed = cp.landed; d.props = true;
        S.battery = cp.battery; S.rollsLeft = cp.rollsLeft; S.crash = null; S.falling = [];
        S.roll.x = d.x; S.roll.y = cp.landed ? Wd.y(d.x) - 8 : d.y + 14 + ROPE; S.roll.vx = S.roll.vy = 0;
        S.cam.x = d.x + 200; S.cam.y = d.y;
      }
      setCp(cfg.pad, 0, true); spawn(S.cp);

      /* --- input: keyboard + on-screen buttons */
      var KEYS = { w: "up", arrowup: "up", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
      L.on(window, "keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.querySelector(".rq-overlay, .rq-talk")) return;
        var k = e.key.toLowerCase();
        if (KEYS[k]) { IN[KEYS[k]] = true; e.preventDefault(); }
        else if (k === " " || k === "s" || k === "arrowdown") { e.preventDefault(); if (!e.repeat) tryDrop(); }
      });
      L.on(window, "keyup", function (e) { var k = e.key.toLowerCase(); if (KEYS[k]) IN[KEYS[k]] = false; });
      L.on(window, "blur", function () { IN.up = IN.left = IN.right = false; });
      function padBtn(cls, html, key, hold) {
        var b = u.el("button", { class: "dr-btn " + cls, html: html, "aria-label": key });
        function on(e) { e.preventDefault(); if (hold) { IN[hold] = true; b.classList.add("on"); try { b.setPointerCapture(e.pointerId); } catch (er) { } } else tryDrop(); }
        function off() { if (hold) { IN[hold] = false; b.classList.remove("on"); } }
        L.on(b, "pointerdown", on); L.on(b, "pointerup", off); L.on(b, "pointercancel", off); L.on(b, "lostpointercapture", off);
        L.on(b, "contextmenu", function (e) { e.preventDefault(); });
        return b;
      }
      root.appendChild(u.el("div", { class: "dr-pad left" }, padBtn("", "◀<small>A</small>", "tilt left", "left"), padBtn("", "▶<small>D</small>", "tilt right", "right")));
      root.appendChild(u.el("div", { class: "dr-pad right" }, padBtn("drop", "🌰<small>Space</small>", "drop seeds"), padBtn("big", "▲<small>W</small>", "thrust", "up")));

      /* --- tips (level 1 teaches the controls) */
      function showTip(key, html) { if (S.tipKey === key) return; S.tipKey = key; tip.innerHTML = html; tip.classList.toggle("hide", !html); }
      function tips() {
        var d = S.d;
        if (S.crash) return;
        var p = nextPatch();
        if (idx === 0 && !S.started) return showTip("go", "Hold <kbd>W</kbd> or <kbd>↑</kbd> or ▲ to fly up!");
        if (idx === 0 && S.started && S.timer < 6 && S.drops === 0 && Math.abs(d.x - cfg.pad) < 300) return showTip("tilt", "Tilt with <kbd>A</kbd> <kbd>D</kbd> or ◀ ▶ to fly sideways");
        if (p && Math.abs(d.x - p.x) < p.half) {
          var alt = Wd.y(d.x) - d.y;
          return showTip(alt > 150 ? "low" : "drop", alt > 150 ? "⬇ Fly lower to drop the seeds" : "Press <kbd>Space</kbd> or 🌰 to DROP!");
        }
        if (!p && Math.abs(d.x - cfg.pad) < 200 && !d.landed) return showTip("land", "Game control: let go of thrust to sink, then land softly on the pad");
        if (S.battery < 20 && !S.won) return showTip("bat", "🔋 Battery low! Hurry home");
        showTip("", "");
      }
      function rollsInAir() { return S.falling.some(function (f) { return !f.done || f.reel != null; }); }
      function nextPatch() { for (var i = 0; i < Wd.patches.length; i++) if (!Wd.patches[i].done) return Wd.patches[i]; return null; }

      /* --- drop the seeds */
      function tryDrop() {
        if (!L.alive || S.crash || S.rollsLeft <= 0 || S.won) return;
        var d = S.d, p = nextPatch(), alt = Wd.y(d.x) - d.y;
        if (!p || Math.abs(d.x - p.x) > p.half + 20) { RQ.audio.sfx("buzz"); flashMsg("Fly over the glowing patch first!"); return; }
        if (alt > 150) { RQ.audio.sfx("buzz"); flashMsg("Too high! Fly lower to drop."); return; }
        S.rollsLeft--;
        S.falling.push({ x: S.roll.x, y: S.roll.y, vx: S.roll.vx, vy: S.roll.vy, a: 0, va: S.roll.vx * .01, patch: p, done: false });
        RQ.audio.sfx("drop");
      }
      function flashMsg(m) { S.msg = m; S.msgT = 1.6; }
      function rollLanded(f) {
        f.done = true;
        if (Math.abs(f.x - f.patch.x) <= f.patch.half + 6) {
          f.patch.done = true; S.drops++;
          RQ.audio.sfx("bloom"); RQ.audio.sfx("powerup");
          for (var i = 0; i < 22; i++) S.parts.push({ x: f.x, y: f.y, vx: u.rand(-200, 200), vy: u.rand(-320, -80), life: 1, c: u.pick(["#8be07f", "#4cb864", "#ffd84d", "#c27a3a"]), g: 1 });
          for (var k = 0; k < 9; k++) f.patch.sprouts.push({ x: f.patch.x + u.rand(-f.patch.half + 10, f.patch.half - 10), g: 0, s: u.rand(.7, 1.2), d: k * .12 });
          setCp(f.patch.x, Wd.y(f.patch.x) - 170, false);
          var more = nextPatch();
          flashMsg(more ? "🌱 Seeds planted! Checkpoint saved. Next patch!" : "🌱 Seeds planted! Checkpoint saved. Now fly home!");
          L.toast(more ? "🌱 Planted! On to the next patch" : "🌱 Planted! Now fly **home**", "good", 2200);
        } else {
          RQ.audio.sfx("bad"); L.timeout(function () { RQ.audio.sfx("giggle"); }, 250);
          flashMsg("Missed the patch! Koa's winch pulls the pack back up.");
          f.reel = 0;
        }
      }

      /* --- crash */
      function crash(why) {
        if (S.crash || S.won) return;
        var d = S.d;
        S.crash = { t: 0, why: why }; S.crashes++; S.shake = .55; d.props = false;
        d.w = (d.vx >= 0 ? 1 : -1) * u.rand(7, 11); d.vy = Math.min(d.vy, 0) - 260; d.vx = d.vx * .4 + u.rand(-60, 60);
        RQ.audio.sfx(why === "zap" ? "zap" : "boom"); L.timeout(function () { RQ.audio.sfx("giggle"); }, 380);
        for (var i = 0; i < 2; i++) S.parts.push({ x: d.x + (i ? 36 : -36), y: d.y - 18, vx: u.rand(-260, 260), vy: u.rand(-420, -220), life: 1.6, prop: true, a: 0, g: 1 });
        for (var j = 0; j < 16; j++) S.parts.push({ x: d.x, y: d.y, vx: u.rand(-240, 240), vy: u.rand(-260, 60), life: .7, c: why === "zap" ? "#ffe066" : "#c9a26b", g: .6 });
        if (S.crashes === 2 || S.crashes === 5) L.timeout(function () { if (L.alive) L.toast(HINTS[idx], "info", 4200); }, 1700);
      }
      var HINTS = [
        "💡 Tap thrust in short bursts. Let go to sink slowly.",
        "💡 When the gust arrow shows, tilt **into** the wind.",
        "💡 Game tip: pass under the wires or high above them, and wait for the birds to fly by. Real pilots stay far away from power lines and birds!",
        "💡 Fly straight and level: every climb costs battery.",
        "💡 Stay low out of the strongest wind, and drop each pack while hovering slowly."
      ];

      /* --- physics (fixed 120 Hz steps) */
      function step(dt) {
        var d = S.d, r = S.roll, attached = S.rollsLeft > 0;
        var mR = attached ? .32 * S.rollsLeft * cfg.pack / 600 : 0, mT = 1 + mR;
        // wind + gusts
        var wc = cfg.wind;
        if (wc && wc.gust) {
          var gs = S.gust;
          if (S.t >= gs.next - 1 && gs.warn === 0) { gs.warn = 1; gs.sign = u.rand(0, 1) < .5 ? -1 : 1; gs.str = u.rand(wc.gust[0], wc.gust[1]); }
          if (S.t >= gs.next) { gs.t0 = gs.next; gs.dur = wc.dur; gs.next = S.t + wc.dur + u.rand(wc.every[0], wc.every[1]); gs.warn = 0; RQ.audio.sfx("whoosh"); }
          var gt = (S.t - gs.t0) / gs.dur;
          gs.v = gt >= 0 && gt <= 1 ? Math.sin(gt * Math.PI) * gs.str * gs.sign : 0;
        }
        S.wind = (wc ? wc.base || 0 : 0) + S.gust.v;
        if (S.crash) {
          S.crash.t += dt;
          if (attached) { r.vy += G * dt; r.y += r.vy * dt; r.x += r.vx * dt; if (r.y > Wd.y(r.x) - 7) { r.y = Wd.y(r.x) - 7; r.vy = 0; r.vx *= .9; } }
          d.vy += G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.w * dt;
          var gyc = Wd.y(d.x) - 18;
          if (d.y > gyc) { d.y = gyc; d.vy = -Math.abs(d.vy) * .35; d.vx *= .7; d.w *= .7; }
          stepRoll(dt, false); stepFalling(dt);
          return;
        }
        // thrust (battery empty = motors stop)
        var want = IN.up && S.battery > 0 ? 1 : 0;
        if (IN.up && !S.started) S.started = true;
        d.th += (want - d.th) * Math.min(1, dt * 9);
        var airborne = !d.landed;
        var thrust = S.battery > 0 ? (d.th * TMAX + (airborne ? (1 - d.th) * IDLE * G * mT : 0)) : 0;
        if (S.battery <= 0 && !S.crash) { thrust = 0; }
        // attitude: angle-mode controller (stick sets a target tilt), gusts push the frame
        var target = ((IN.right ? 1 : 0) - (IN.left ? 1 : 0)) * TILT;
        if (d.landed) target = 0;
        d.w += ((target - d.a) * ANG_K - d.w * ANG_D + (S.wind - d.vx) * .012) * dt;
        d.a += d.w * dt;
        // forces
        // the drone carries its own mass; the rope passes the pack's weight on to it
        var ax = Math.sin(d.a) * thrust, ay = -Math.cos(d.a) * thrust + G;
        var sp = Math.hypot(d.vx, d.vy);
        ax += -d.vx * DRAG_L - d.vx * sp * DRAG_Q + (S.wind - d.vx) * .9;
        ay += -d.vy * DRAG_L - d.vy * sp * DRAG_Q;
        if (cfg.rain) ay += 40;
        // soft legal ceiling (120 m above the ground)
        var alt = Wd.y(d.x) - d.y;
        if (alt > CEIL_M * PX_M) { ay += (alt - CEIL_M * PX_M) * 18; S.ceilWarn = 1; }
        if (d.landed) {
          if (thrust > G * 1.05) { d.landed = false; }
          else { d.vx *= Math.pow(.02, dt); d.vy = 0; d.a += (Wd.slope(d.x) - d.a) * Math.min(1, dt * 10); d.w = 0; ax = 0; ay = 0; }
        }
        d.vx += ax * dt; d.vy += ay * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        // level walls
        if (d.x < 70) { d.x = 70; d.vx = Math.abs(d.vx) * .3; }
        if (d.x > cfg.len - 70) { d.x = cfg.len - 70; d.vx = -Math.abs(d.vx) * .3; }
        stepRoll(dt, attached, mR);
        stepFalling(dt);
        collide();
        // battery: hover power ∝ thrust; payload shortens endurance (logistics.py)
        if (S.started && S.battery > 0) {
          var use = d.landed && d.th < .05 ? .08 : .3 + .7 * d.th;
          S.battery = Math.max(0, S.battery - cfg.drain * use / payloadFactor() * dt);
          if (S.battery <= 0) { flashMsg("🔋 Battery empty! The motors stopped."); RQ.audio.sfx("lose"); }
        }
        if (S.battery <= 0 && d.landed && !S.crash) batteryFlat();
      }
      function stepRoll(dt, attached, mR) {
        var d = S.d, r = S.roll;
        if (!attached) return;
        r.vy += G * dt; r.vx += (S.wind - r.vx) * .5 * dt;
        r.vx *= 1 - .3 * dt; r.vy *= 1 - .3 * dt;
        r.x += r.vx * dt; r.y += r.vy * dt;
        var gy = Wd.y(r.x) - 7;
        if (r.y > gy) { r.y = gy; if (r.vy > 0) r.vy *= -.15; r.vx *= Math.pow(.05, dt); }
        // rope: a distance limit between the drone's belly hook and the pack (only pulls when tight)
        var hx = d.x - Math.sin(d.a) * 14, hy = d.y + Math.cos(d.a) * 14, dx = r.x - hx, dy = r.y - hy, dist = Math.hypot(dx, dy);
        if (dist > ROPE && !S.crash) {
          var nx = dx / dist, ny = dy / dist, ex = dist - ROPE, wD = 1, wR = 1 / Math.max(mR, .05), ws = wD + wR;
          d.x += nx * ex * wD / ws; d.y += ny * ex * wD / ws; r.x -= nx * ex * wR / ws; r.y -= ny * ex * wR / ws;
          var rv = (r.vx - d.vx) * nx + (r.vy - d.vy) * ny;
          if (rv > 0) {
            var j = rv / ws;
            d.vx += nx * j * wD; d.vy += ny * j * wD; r.vx -= nx * j * wR; r.vy -= ny * j * wR;
            d.w += u.clamp(((hx - d.x) * (ny * j) - (hy - d.y) * (nx * j)) / INERTIA * 5, -.6, .6);
          }
        }
      }
      function stepFalling(dt) {
        S.falling.forEach(function (f) {
          if (f.reel != null) {   // winched back to the drone after a miss
            f.reel += dt;
            if (f.reel > 1.1) { f.gone = true; S.rollsLeft++; var hk = world(0, 14); S.roll.x = hk[0]; S.roll.y = hk[1] + ROPE * .8; S.roll.vx = S.d.vx; S.roll.vy = S.d.vy; }
            return;
          }
          if (f.done) return;
          f.vy += G * dt; f.vx += (S.wind - f.vx) * .5 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va;
          if (f.y >= Wd.y(f.x) - 7) { f.y = Wd.y(f.x) - 7; rollLanded(f); }
        });
        S.falling = S.falling.filter(function (f) { return !f.gone; });
      }
      function world(lx, ly) { var d = S.d, c = Math.cos(d.a), s = Math.sin(d.a); return [d.x + lx * c - ly * s, d.y + lx * s + ly * c]; }
      function collide() {
        var d = S.d;
        // hard points (rotors, body) touching the ground = crash
        for (var i = 0; i < HARD.length; i++) { var p = world(HARD[i][0], HARD[i][1]); if (p[1] > Wd.y(p[0])) return crash("ground"); }
        // skids: landing
        var pen = 0;
        SKIDS.forEach(function (s) { var p = world(s[0], s[1]); pen = Math.max(pen, p[1] - Wd.y(p[0])); });
        if (pen > 0) {
          var rel = Math.abs(d.a - Wd.slope(d.x));
          if (d.vy > 300 || Math.abs(d.vx) > 300 || rel > .62) return crash("land");
          if (!d.landed) {
            if (d.vy > 120) { S.shake = Math.max(S.shake, .18); dust(d.x, Wd.y(d.x), 10); RQ.audio.sfx("drop"); }
            d.landed = true;
          }
          d.y -= pen; if (d.vy > 0) d.vy = 0;
        }
        if (Math.abs(d.a) > 1.9) return crash("flip");
        // trees, birds, power lines
        for (var t = 0; t < Wd.trees.length; t++) {
          var tr = Wd.trees[t]; if (Math.abs(tr.x - d.x) > 140) continue;
          var cs = Wd.treeCircles(tr);
          for (var k = 0; k < cs.length; k++) if (Math.hypot(cs[k][0] - d.x, cs[k][1] - d.y) < cs[k][2] + 24) return crash("tree");
        }
        for (var b = 0; b < Wd.birds.length; b++) { var bp = Wd.birdPos(Wd.birds[b], S.t); if (Math.hypot(bp.x - d.x, bp.y - d.y) < 34) return crash("bird"); }
        for (var l = 0; l < Wd.lines.length; l++) {
          var ln = Wd.lines[l];
          if (Math.abs(d.x - ln.x1) < 14 && d.y > ln.y1 - 10) return crash("ground");
          if (Math.abs(d.x - ln.x2) < 14 && d.y > ln.y2 - 10) return crash("ground");
          if (d.x > ln.x1 && d.x < ln.x2) for (var w = 0; w < 2; w++) if (Math.abs(Wd.wireY(ln, d.x, w) - d.y) < 20) return crash("zap");
        }
      }
      function dust(x, y, n) { for (var i = 0; i < n; i++) S.parts.push({ x: x + u.rand(-30, 30), y: y - 4, vx: u.rand(-120, 120), vy: u.rand(-80, -20), life: .8, c: "rgba(160,130,90,.7)", g: .15, r: u.rand(4, 9) }); }
      function batteryFlat() {
        if (S.flatT) return;
        S.flatT = true;
        L.timeout(function () {
          S.flatT = false; S.swaps++;
          S.cp.battery = Math.max(S.cp.battery, 35);
          flashMsg("Koa ran out with a spare battery. Back to the checkpoint!");
          spawn(S.cp);
        }, 1400);
      }

      /* --- the frame */
      L.loop(function (dt, t) {
        if (document.querySelector(".rq-talk")) return;
        S.t = t;
        if (S.started && !S.won) S.timer += dt;
        S.acc += dt;
        while (S.acc >= STEP) { step(STEP); S.acc -= STEP; }
        if (S.crash && S.crash.t > 1.7) {
          if (S.battery <= 0) { S.swaps++; S.cp.battery = Math.max(S.cp.battery, 35); flashMsg("Koa brought a spare battery. Back to the checkpoint!"); }
          spawn(S.cp);
        }
        // win: landed on the home pad with every pack planted
        var d = S.d;
        if (!S.won && S.rollsLeft === 0 && !rollsInAir() && d.landed && !S.crash && Math.abs(d.x - cfg.pad) < 80 && Math.abs(d.vx) < 40) {
          S.landT += dt;
          if (S.landT > .6) finish();
        } else S.landT = 0;
        // sounds
        S.hum -= dt;
        if (S.hum <= 0 && !S.crash && (d.th > .03 || !d.landed) && S.battery > 0 && RQ.save.setting("sound")) {
          S.hum = .075; var f = 72 + d.th * 64 + Math.hypot(d.vx, d.vy) * .03;
          RQ.audio.tone({ f: f, f2: f * .97, type: "sawtooth", d: .12, v: .018 + d.th * .03, lp: 360 + d.th * 520 });
        }
        if (S.battery < 20 && S.battery > 0 && !S.won) { S.lowBeep -= dt; if (S.lowBeep <= 0) { S.lowBeep = 1.2; RQ.audio.sfx("beep"); } }
        if (S.gust.warn === 1 && !S.gust.warned) { S.gust.warned = true; RQ.audio.sfx("tick"); }
        if (S.gust.warn === 0) S.gust.warned = false;
        tips();
        hud();
        draw(dt, t);
      });
      var hudT = 0;
      function hud() {
        hudT -= 1;
        if (hudT > 0) return; hudT = 6;
        var b = Math.ceil(S.battery);
        L.hud.set("bat", (b < 20 ? "🪫 " : "🔋 ") + '<b style="color:' + (b < 20 ? "#d1495b" : b < 40 ? "#b07a00" : "#2f9e4f") + '">' + b + "%</b>");
        L.hud.set("time", "⏱ " + fmtTime(S.timer));
        L.hud.set("seeds", "🌱 " + S.drops + " / " + cfg.packs);
        L.hud.set("bonk", "💥 " + S.crashes);
      }
      function fmtTime(s) { s = Math.floor(s); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
      function finish() {
        S.won = true; IN.up = IN.left = IN.right = false;
        var tm = S.timer, bat = Math.round(S.battery);
        var tMedal = tm <= cfg.par ? "🥇" : tm <= cfg.par * 1.35 ? "🥈" : "🥉";
        var bMedal = S.swaps ? "🥉" : bat >= cfg.batGoal ? "🥇" : bat >= cfg.batGoal * .5 ? "🥈" : "🥉";
        var stars = 1 + (tMedal === "🥇" ? 1 : 0) + (bMedal === "🥇" ? 1 : 0);
        RQ.audio.sfx("good");
        L.timeout(function () {
          L.win({ stars: stars, msg: idx === 4 ? "Both patches planted in a storm! You are a real seed pilot." : "Seeds planted and the drone is home safe!",
            stats: { "Time": fmtTime(tm) + " " + tMedal, "Battery left": bat + "% " + bMedal, "Bonks": S.crashes } });
        }, 700);
      }

      /* --- drawing */
      var mask = null, maskCtx = null;
      function draw(dt, t) {
        var d = S.d, Wv = cv.w;
        // smooth camera: look ahead, keep the ground in view
        var gyD = Wd.y(d.x), tx = d.x + u.clamp(d.vx * .45, -260, 260), ty = u.clamp((d.y + gyD) / 2 - 40, d.y - H * .3, d.y + H * .16);
        var k = 1 - Math.exp(-dt * 3.5);
        S.cam.x += (tx - S.cam.x) * k; S.cam.y += (ty - S.cam.y) * k;
        S.cam.x = u.clamp(S.cam.x, Wv / 2 - 40, cfg.len - Wv / 2 + 40);
        var ox = Wv / 2 - S.cam.x, oy = H / 2 - S.cam.y;
        ctx.save();
        if (S.shake > 0) { S.shake -= dt; ctx.translate(u.rand(-1, 1) * S.shake * 22, u.rand(-1, 1) * S.shake * 16); }
        sky(Wv, t);
        parallax(Wv, t, ox, oy);
        ctx.save(); ctx.translate(ox, oy);
        var x0 = S.cam.x - Wv / 2 - 60, x1 = S.cam.x + Wv / 2 + 60;
        ceiling(x0, x1);
        terrain(x0, x1, t);
        padDraw(t);
        Wd.patches.forEach(function (p) { patchDraw(p, t, dt); });
        Wd.lines.forEach(function (l) { if (l.x2 > x0 && l.x1 < x1) linesDraw(l); });
        Wd.trees.forEach(function (tr) { if (Math.abs(tr.x - S.cam.x) < Wv) drawTree(ctx, tr.x, Wd.y(tr.x) + 4, tr.h, Math.sin(t * 1.4 + tr.sway) * (1.2 + Math.abs(S.wind) * .01), cfg.night); });
        Wd.birds.forEach(function (b) { var bp = Wd.birdPos(b, t); if (Math.abs(bp.x - S.cam.x) < Wv) drawBird(ctx, bp.x, bp.y, bp.dir, t, cfg.night); });
        // rope + pack
        if (S.rollsLeft > 0) {
          var hk = world(0, 14);
          ctx.strokeStyle = "#5a3d2b"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hk[0], hk[1]);
          var slack = Math.max(0, ROPE - Math.hypot(S.roll.x - hk[0], S.roll.y - hk[1]));
          ctx.quadraticCurveTo((hk[0] + S.roll.x) / 2, (hk[1] + S.roll.y) / 2 + slack * .6, S.roll.x, S.roll.y - 6 - (S.rollsLeft - 1) * 13); ctx.stroke();
          drawRoll(ctx, S.roll.x, S.roll.y, S.rollsLeft, Math.atan2(S.roll.x - hk[0], S.roll.y - hk[1]) * -.4);
        }
        S.falling.forEach(function (f) {
          if (f.reel != null) { var hk2 = world(0, 14), q = Math.min(1, f.reel / 1.1); drawRoll(ctx, u.lerp(f.x, hk2[0], q), u.lerp(f.y, hk2[1] + ROPE * .7, q), 1, 0); return; }
          drawRoll(ctx, f.x, f.y, 1, f.a);
        });
        // ground dust from the rotor wash
        var altD = Wd.y(d.x) - d.y;
        if (!S.crash && d.th > .3 && altD < 130 && Math.random() < .5) dust(d.x, Wd.y(d.x), 1);
        // drone
        ctx.fillStyle = "rgba(29,43,58," + Math.max(0, .25 - altD / 1600) + ")"; ctx.beginPath(); ctx.ellipse(d.x, Wd.y(d.x) + 2, 34, 7, 0, 0, 7); ctx.fill();
        drawDrone(ctx, d, t, S.crash ? "bonk" : "");
        if (S.crash) {
          for (var s = 0; s < 4; s++) { var aa = t * 6 + s * 1.57; ctx.font = "20px sans-serif"; ctx.textAlign = "center"; ctx.fillText("⭐", d.x + Math.cos(aa) * 38, d.y - 40 + Math.sin(aa) * 10); }
          comic("BONK!", d.x, d.y - 80, S.crash.t);
        }
        particles(dt);
        ctx.restore();
        if (cfg.rain) rain(Wv, dt);
        if (cfg.night) night(Wv, ox, oy, t);
        if (cfg.rain) lightning(dt);
        overlay(Wv, t, ox, oy);
        ctx.restore();
      }
      function sky(Wv, t) {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        if (cfg.night) { g.addColorStop(0, "#0b1530"); g.addColorStop(1, "#28406e"); }
        else if (cfg.rain) { g.addColorStop(0, "#56647a"); g.addColorStop(1, "#a7b4c4"); }
        else { g.addColorStop(0, "#7cc8ff"); g.addColorStop(1, "#dff4ff"); }
        ctx.fillStyle = g; ctx.fillRect(0, 0, Wv, H);
        if (cfg.night) {
          for (var i = 0; i < 70; i++) { var sx = (i * 173.3) % Wv, sy = (i * 97.1) % (H * .6), tw = .5 + .5 * Math.sin(t * 2 + i); ctx.fillStyle = "rgba(255,255,230," + (.3 + tw * .6) + ")"; ctx.fillRect(sx, sy, 2, 2); }
          ctx.fillStyle = "#fff6c8"; ctx.beginPath(); ctx.arc(Wv - 160, 90, 34, 0, 7); ctx.fill();
          ctx.fillStyle = "#0b1530"; ctx.beginPath(); ctx.arc(Wv - 146, 80, 30, 0, 7); ctx.fill();
        } else if (!cfg.rain) { ctx.beginPath(); ctx.arc(Wv - 170, 86, 34, 0, 7); ctx.fillStyle = "#ffd84d"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#1d2b3a"; ctx.stroke(); }
      }
      function parallax(Wv, t, ox, oy) {
        // clouds (drift with the wind)
        var cc = cfg.rain ? "rgba(90,100,118,.85)" : cfg.night ? "rgba(60,80,120,.5)" : "rgba(255,255,255,.92)";
        for (var c = 0; c < 6; c++) {
          var span = Wv + 400, cx = (((c * 330 + ox * .1 + t * (14 + S.wind * .3)) % span) + span) % span - 200, cy = 60 + (c % 3) * 45 + oy * .05;
          ctx.fillStyle = cc; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.arc(cx + 32, cy - 12, 32, 0, 7); ctx.arc(cx + 66, cy, 24, 0, 7); ctx.fill();
        }
        // far mountains and mid hills
        layer(Wv, ox * .2, oy * .2 + 40, 280, 160, 900, cfg.night ? "#1a2b4c" : cfg.rain ? "#7d8a9e" : "#a8c8e8", true);
        layer(Wv, ox * .45, oy * .4 + 60, 360, 90, 420, cfg.night ? "#1d3b3a" : cfg.rain ? "#6f8a74" : "#9fd38a", false);
      }
      function layer(Wv, sx, sy, base, amp, wl, col, peaks) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
        for (var x = 0; x <= Wv + 20; x += 20) {
          var wx = x - sx, y = base + sy - amp * (peaks ? Math.abs(Math.sin(wx / wl * 3.1)) * .8 + Math.sin(wx / 210) * .2 : .5 + .5 * Math.sin(wx / wl * 6.283));
          ctx.lineTo(x, y);
        }
        ctx.lineTo(Wv, H); ctx.closePath(); ctx.fill();
        if (!peaks) {   // little background trees
          ctx.fillStyle = cfg.night ? "#163230" : "#6fb866";
          for (var tx = ((-sx % 90) + 90) % 90 - 90; tx < Wv + 90; tx += 90) {
            var wx2 = tx - sx, ty = base + sy - amp * (.5 + .5 * Math.sin(wx2 / wl * 6.283)) + 4, th = 30 + ((Math.round(wx2 / 90) * 37) % 17 + 17) % 17;
            ctx.beginPath(); ctx.moveTo(tx - 11, ty); ctx.lineTo(tx, ty - th); ctx.lineTo(tx + 11, ty); ctx.closePath(); ctx.fill();
          }
        }
      }
      function ceiling(x0, x1) {
        ctx.setLineDash([12, 10]); ctx.strokeStyle = "rgba(209,73,91,.6)"; ctx.lineWidth = 3; ctx.beginPath();
        for (var x = Math.floor(x0 / 40) * 40; x <= x1; x += 40) { var y = Wd.y(x) - CEIL_M * PX_M; if (x === Math.floor(x0 / 40) * 40) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke(); ctx.setLineDash([]);
        var lx = S.cam.x - 200; ctx.font = "600 15px Fredoka, sans-serif"; ctx.fillStyle = "rgba(209,73,91,.85)"; ctx.textAlign = "center";
        ctx.fillText("120 m (400 ft) limit in many places", lx, Wd.y(lx) - CEIL_M * PX_M - 10);
      }
      function terrain(x0, x1, t) {
        var xs = Math.floor(x0 / 8) * 8;
        ctx.beginPath(); ctx.moveTo(xs, 2000);
        for (var x = xs; x <= x1; x += 8) ctx.lineTo(x, Wd.y(x));
        ctx.lineTo(x1, 2000); ctx.closePath();
        ctx.fillStyle = cfg.night ? "#3a2a22" : "#8a5a35"; ctx.fill();
        // strata
        ctx.save(); ctx.clip();
        ctx.strokeStyle = cfg.night ? "rgba(0,0,0,.2)" : "rgba(111,69,39,.6)"; ctx.lineWidth = 6;
        for (var s = 1; s < 4; s++) { ctx.beginPath(); for (var x2 = xs; x2 <= x1; x2 += 16) { var yy = Wd.y(x2) + s * 46 + Math.sin(x2 / 70 + s) * 6; if (x2 === xs) ctx.moveTo(x2, yy); else ctx.lineTo(x2, yy); } ctx.stroke(); }
        ctx.fillStyle = cfg.night ? "#2b2019" : "#6f4527";
        for (var rx = Math.floor(x0 / 150) * 150; rx < x1; rx += 150) { var ry = Wd.y(rx) + 30 + ((rx * 7) % 50); ctx.beginPath(); ctx.ellipse(rx + 40, ry, 14, 8, 0, 0, 7); ctx.fill(); }
        ctx.restore();
        // grass top
        ctx.strokeStyle = cfg.night ? "#2f5a3a" : "#5fbf4a"; ctx.lineWidth = 12; ctx.lineJoin = "round"; ctx.beginPath();
        for (var x3 = xs; x3 <= x1; x3 += 8) { if (x3 === xs) ctx.moveTo(x3, Wd.y(x3) + 4); else ctx.lineTo(x3, Wd.y(x3) + 4); }
        ctx.stroke();
        ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; ctx.beginPath();
        for (var x4 = xs; x4 <= x1; x4 += 8) { if (x4 === xs) ctx.moveTo(x4, Wd.y(x4) - 2); else ctx.lineTo(x4, Wd.y(x4) - 2); }
        ctx.stroke();
        // flowers / tufts
        for (var fx = Math.floor(x0 / 60) * 60; fx < x1; fx += 60) {
          var fy = Wd.y(fx + 20) - 2, sw = Math.sin(t * 2 + fx) * 2 + S.wind * .01;
          ctx.strokeStyle = cfg.night ? "#2f5a3a" : "#3f9a49"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx + 20, fy); ctx.lineTo(fx + 20 + sw, fy - 9); ctx.moveTo(fx + 26, fy); ctx.lineTo(fx + 27 + sw, fy - 7); ctx.stroke();
          if ((fx / 60) % 3 === 0 && !cfg.night) { ctx.fillStyle = ["#ff8fab", "#ffd23f", "#b197fc"][(fx / 60) % 3 | 0] || "#ffd23f"; ctx.beginPath(); ctx.arc(fx + 20 + sw, fy - 10, 3, 0, 7); ctx.fill(); }
        }
        // cliffs at both ends
        [[0, 70], [cfg.len - 70, cfg.len + 400]].forEach(function (c, i) {
          ctx.fillStyle = cfg.night ? "#2a2a3a" : "#7d6b5a"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3;
          var cx = i ? c[0] : c[1];
          ctx.beginPath(); ctx.moveTo(cx, Wd.y(cx)); ctx.lineTo(cx + (i ? 20 : -20), Wd.y(cx) - 900); ctx.lineTo(i ? c[1] : -400, Wd.y(cx) - 900); ctx.lineTo(i ? c[1] : -400, Wd.y(cx) + 300); ctx.closePath(); ctx.fill(); ctx.stroke();
        });
      }
      function padDraw(t) {
        var x = cfg.pad, y = Wd.y(x), done = S.rollsLeft === 0 && !rollsInAir();
        ctx.fillStyle = "#4a5b6d"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; u.rr(ctx, x - 70, y - 8, 140, 12, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffd84d"; ctx.font = "700 14px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("H O M E", x, y - 1);
        for (var i = -1; i <= 1; i += 2) { var on = (Math.floor(t * 3) % 2 === 0) || !done; ctx.fillStyle = on ? (done ? "#7cff8f" : "#ff6b6b") : "#444"; ctx.beginPath(); ctx.arc(x + i * 62, y - 12, 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
        // base camp tent + Koa
        ctx.fillStyle = "#e0752d"; ctx.beginPath(); ctx.moveTo(x - 190, y + 2); ctx.lineTo(x - 140, y - 64); ctx.lineTo(x - 90, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#1d2b3a"; ctx.beginPath(); ctx.moveTo(x - 152, y + 2); ctx.lineTo(x - 140, y - 30); ctx.lineTo(x - 128, y + 2); ctx.closePath(); ctx.fill();
        var img = koaImage();
        if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x + 78, y - 78 + Math.abs(Math.sin(t * 2)) * -4, 76, 76);
        if (done && !S.won) { ctx.save(); ctx.globalAlpha = .35 + .25 * Math.sin(t * 5); ctx.fillStyle = "#7cff8f"; ctx.fillRect(x - 70, y - 300, 140, 292); ctx.restore(); }
      }
      function patchDraw(p, t, dt) {
        var y = Wd.y(p.x);
        ctx.strokeStyle = p.done ? "#4a8f3a" : "#8a5a35"; ctx.lineWidth = 14; ctx.beginPath();
        for (var x = p.x - p.half; x <= p.x + p.half; x += 10) { if (x === p.x - p.half) ctx.moveTo(x, Wd.y(x) + 3); else ctx.lineTo(x, Wd.y(x) + 3); }
        ctx.stroke();
        if (!p.done) {
          var pulse = .5 + .5 * Math.sin(t * 4), active = p === nextPatch();
          ctx.save(); ctx.globalAlpha = active ? .18 + .12 * pulse : .08;
          var g = ctx.createLinearGradient(0, y - 360, 0, y); g.addColorStop(0, "rgba(255,214,77,0)"); g.addColorStop(1, "#ffd84d");
          ctx.fillStyle = g; ctx.fillRect(p.x - p.half, y - 360, p.half * 2, 360); ctx.restore();
          ctx.strokeStyle = "rgba(255,214,77," + (.6 + .4 * pulse) + ")"; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.moveTo(p.x - p.half, y - 150); ctx.lineTo(p.x + p.half, y - 150); ctx.stroke(); ctx.setLineDash([]);
          ctx.font = "700 16px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = cfg.night || cfg.rain ? "#fff" : "#1d2b3a";
          if (cfg.night || cfg.rain) { ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 4; ctx.strokeText(active ? "🌱 drop zone: fly below the line" : "🌱 patch", p.x, y - 162); }
          ctx.fillText(active ? "🌱 drop zone: fly below the line" : "🌱 patch", p.x, y - 162);
        }
        p.sprouts.forEach(function (s) {
          s.g = Math.min(1, s.g + (s.d > 0 ? 0 : dt * .8)); s.d -= dt;
          var sy = Wd.y(s.x), hgt = 26 * s.s * u.ease.outBack(s.g);
          ctx.strokeStyle = "#2f8a3e"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x, sy); ctx.lineTo(s.x, sy - hgt); ctx.stroke();
          ctx.fillStyle = "#6fd36b"; ctx.beginPath(); ctx.ellipse(s.x - 6 * s.g, sy - hgt, 7 * s.g, 3.5 * s.g, -.5, 0, 7); ctx.ellipse(s.x + 6 * s.g, sy - hgt - 3, 7 * s.g, 3.5 * s.g, .5, 0, 7); ctx.fill();
        });
      }
      function linesDraw(l) {
        ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3;
        [[l.x1, l.y1], [l.x2, l.y2]].forEach(function (p) {
          ctx.fillStyle = cfg.night ? "#4a3a30" : "#8a6a4a"; ctx.fillRect(p[0] - 6, p[1], 12, Wd.y(p[0]) - p[1]); ctx.strokeRect(p[0] - 6, p[1], 12, Wd.y(p[0]) - p[1]);
          ctx.fillRect(p[0] - 22, p[1] - 4, 44, 8); ctx.strokeRect(p[0] - 22, p[1] - 4, 44, 8);
        });
        for (var k = 0; k < 2; k++) {
          ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2.5; ctx.beginPath();
          for (var x = l.x1; x <= l.x2; x += 10) { var y = Wd.wireY(l, x, k); if (x === l.x1) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.stroke();
        }
        ctx.fillStyle = "#ffd84d"; ctx.font = "700 14px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.fillText("⚡ power lines", (l.x1 + l.x2) / 2, Wd.wireY(l, (l.x1 + l.x2) / 2, 1) + 26);
      }
      function comic(txt, x, y, age) {
        var s = Math.min(1, age * 5) * (1 + Math.sin(age * 20) * .05);
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-.12);
        ctx.fillStyle = "#ffd84d"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 4; ctx.beginPath();
        for (var i = 0; i < 16; i++) { var r = i % 2 ? 34 : 52, a = i / 16 * 6.283; ctx.lineTo(Math.cos(a) * r * 1.4, Math.sin(a) * r * .8); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#d1495b"; ctx.font = "700 26px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, 0, 2);
        ctx.restore();
      }
      function particles(dt) {
        S.parts = S.parts.filter(function (p) {
          p.life -= dt; p.vy += G * (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
          if (p.prop) { p.a += dt * 25; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = "rgba(205,230,255,.9)"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 20, 3.5, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
          else { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 4, 0, 7); ctx.fill(); }
          ctx.globalAlpha = 1;
          return p.life > 0;
        });
      }
      function rain(Wv, dt) {
        while (S.rain.length < 170) S.rain.push({ x: u.rand(-100, Wv + 100), y: u.rand(-H, H), v: u.rand(700, 950) });
        ctx.strokeStyle = "rgba(220,235,255,.55)"; ctx.lineWidth = 1.6; ctx.beginPath();
        var sl = S.wind * .35;
        S.rain.forEach(function (r) {
          r.y += r.v * dt; r.x += sl * dt * 2;
          if (r.y > H) { r.y = u.rand(-60, -10); r.x = u.rand(-100, Wv + 100); }
          ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - sl * .05, r.y - 16);
        });
        ctx.stroke();
      }
      function lightning(dt) {
        S.nextBolt -= dt;
        if (S.nextBolt <= 0) { S.nextBolt = u.rand(5, 9); S.flash = 1; S.shake = Math.max(S.shake, .2); L.timeout(function () { RQ.audio.noise({ f: 300, f2: 50, d: 1.2, v: .35 }); }, 300); }
        if (S.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + S.flash * .55 + ")"; ctx.fillRect(0, 0, cv.w, H); S.flash -= dt * 2.2; }
      }
      function night(Wv, ox, oy, t) {
        var dpr = cv.cv.width / cv.w;
        if (!mask || mask.width !== cv.cv.width || mask.height !== cv.cv.height) { mask = document.createElement("canvas"); mask.width = cv.cv.width; mask.height = cv.cv.height; maskCtx = mask.getContext("2d"); }
        var m = maskCtx; m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, mask.width, mask.height); m.setTransform(dpr, 0, 0, dpr, 0, 0);
        m.globalCompositeOperation = "source-over"; m.fillStyle = "rgba(6,10,28,.82)"; m.fillRect(0, 0, Wv, H);
        m.globalCompositeOperation = "destination-out";
        function light(x, y, r, a) { var g = m.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(0,0,0," + a + ")"); g.addColorStop(1, "rgba(0,0,0,0)"); m.fillStyle = g; m.beginPath(); m.arc(x, y, r, 0, 7); m.fill(); }
        var d = S.d, sx = d.x + ox, sy = d.y + oy;
        light(sx, sy, 190, 1);
        // headlight cone towards the flight direction
        var dir = d.vx >= -5 ? 1 : -1, ang = d.a + (dir > 0 ? .35 : Math.PI - .35);
        m.save(); m.translate(sx, sy); m.rotate(ang);
        var cg = m.createLinearGradient(0, 0, 420, 0); cg.addColorStop(0, "rgba(0,0,0,.95)"); cg.addColorStop(1, "rgba(0,0,0,0)");
        m.fillStyle = cg; m.beginPath(); m.moveTo(0, 0); m.lineTo(420, -120); m.lineTo(420, 120); m.closePath(); m.fill(); m.restore();
        light(cfg.pad + ox, Wd.y(cfg.pad) + oy - 20, 170, .9);
        Wd.patches.forEach(function (p) { if (!p.done) light(p.x + ox, Wd.y(p.x) + oy - 40, 200 + Math.sin(t * 4) * 12, .85); });
        for (var i = 0; i < 14; i++) { var fx = ((i * 260 + t * 20) % cfg.len), fy = Wd.y(fx) - 50 - Math.sin(t * 1.5 + i) * 30; light(fx + ox, fy + oy, 22, .7); }
        ctx.drawImage(mask, 0, 0, Wv, H);
        for (var j = 0; j < 14; j++) { var gx = ((j * 260 + t * 20) % cfg.len), gy = Wd.y(gx) - 50 - Math.sin(t * 1.5 + j) * 30; ctx.fillStyle = "rgba(220,255,120," + (.5 + .5 * Math.sin(t * 5 + j)) + ")"; ctx.beginPath(); ctx.arc(gx + ox, gy + oy, 3, 0, 7); ctx.fill(); }
      }
      function overlay(Wv, t, ox, oy) {
        // progress strip: home ... patches
        var bx = Wv / 2 - 210, by = H - 26, bw = 420;
        ctx.fillStyle = "rgba(255,253,247,.96)"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2.5; u.rr(ctx, bx - 14, by - 14, bw + 28, 28, 14); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(29,43,58,.35)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
        var X = function (x) { return bx + x / cfg.len * bw; };
        ctx.font = "16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🏠", X(cfg.pad), by);
        Wd.patches.forEach(function (p) { ctx.fillText(p.done ? "🌳" : "🌱", X(p.x), by); });
        ctx.fillStyle = "#2b7bd0"; ctx.beginPath(); ctx.arc(X(S.d.x), by, 6, 0, 7); ctx.fill(); ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2; ctx.stroke();
        // gust warning
        if (S.gust.warn === 1 || Math.abs(S.gust.v) > 60) {
          var sg = S.gust.warn === 1 ? S.gust.sign : Math.sign(S.gust.v), a = .6 + .4 * Math.sin(t * 14);
          ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3;
          var gx = sg > 0 ? 70 : Wv - 70; u.rr(ctx, gx - 62, 40, 124, 40, 12); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#2b7bd0"; ctx.font = "700 18px Fredoka, sans-serif"; ctx.fillText("💨 GUST " + (sg > 0 ? "→" : "←"), gx, 61); ctx.restore();
          if (Math.abs(S.gust.v) > 60) {
            ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 3;
            for (var i = 0; i < 12; i++) { var lx = ((i * 211 + t * S.gust.v * 2.5) % (Wv + 200) + Wv + 200) % (Wv + 200) - 100, ly = 90 + (i * 53) % (H - 160); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 50 * sg, ly); ctx.stroke(); }
          }
        }
        // altitude readout next to the drone
        var d = S.d, alt = Math.max(0, (Wd.y(d.x) - d.y - 22) / PX_M);
        ctx.font = "600 14px Fredoka, sans-serif"; ctx.fillStyle = cfg.night ? "#fff" : "#1d2b3a"; ctx.textAlign = "left";
        ctx.fillText((!d.landed || alt > 1 ? Math.round(alt) + " m" : "") + (S.rollsLeft ? (!d.landed || alt > 1 ? " · " : "") + "🌰 " + S.rollsLeft * cfg.pack + " g" : ""), d.x + ox + 50, d.y + oy - 30);
        // arrow to the target when it is off screen
        var p = nextPatch(), tx = p ? p.x : cfg.pad, sxT = tx + ox;
        if (sxT < 20 || sxT > Wv - 20) {
          var right = sxT > Wv - 20, ay = H / 2 - 20 + Math.sin(t * 4) * 4, axp = right ? Wv - 40 : 40;
          ctx.fillStyle = p ? "#ffd84d" : "#7cff8f"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; ctx.beginPath();
          ctx.moveTo(axp + (right ? 22 : -22), ay); ctx.lineTo(axp, ay - 18); ctx.lineTo(axp, ay + 18); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = cfg.night || cfg.rain ? "#fff" : "#1d2b3a"; ctx.font = "700 15px Fredoka, sans-serif"; ctx.textAlign = right ? "right" : "left";
          ctx.fillText(p ? "patch" : "home", axp + (right ? -6 : 6), ay + 34);
        }
        // messages
        if (S.msgT > 0) {
          S.msgT -= 1 / 60;
          ctx.save(); ctx.globalAlpha = Math.min(1, S.msgT * 2); ctx.font = "700 20px Fredoka, sans-serif"; ctx.textAlign = "center";
          var w = ctx.measureText(S.msg).width + 30; ctx.fillStyle = "rgba(255,253,247,.95)"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3;
          u.rr(ctx, Wv / 2 - w / 2, 128, w, 40, 14); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#1d2b3a"; ctx.fillText(S.msg, Wv / 2, 149); ctx.restore();
        }
        if (S.ceilWarn > 0) { S.ceilWarn -= 1 / 60; if (S.ceilWarn > .9) flashMsg("Too high! Many places limit drones to 120 m."); }
      }
    };
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g21",
    music: "action",
    intro: [
      ["koa", "Strap in, pilot! The seed drone carries a pack of seeds on a rope."],
      ["koa", "Fly it to the glowing patch, drop the seeds, then fly home before the battery runs out."],
      ["sprout", "Don't bonk into anything. I'm right here inside that drone!"]
    ],
    outro: [
      ["koa", "Five missions, five forests seeded. You're a real seed pilot now!"],
      ["sprout", "Next, let's program the drone so it can fly the mission by itself."]
    ],
    levels: [
      { title: "First flight", goal: "Drop the seeds on the patch, then land at home", cards: ["thrust-gravity", "return-home"],
        intro: [["koa", "Game controls: hold **thrust** to climb and tilt to fly sideways. Let go of thrust for a gentle game landing."],
                ["koa", "Over the glowing patch, get low and press **Space** to drop the pack. Then land on the home pad."]],
        play: level(0) },
      { title: "Gusty hills", goal: "Watch for the gust arrows", cards: ["gusts"],
        intro: [["koa", "Windy today! When you see a **gust** arrow, tilt into the wind to stay steady."]],
        play: level(1) },
      { title: "Forest and birds", goal: "Dodge the trees, birds and power lines", cards: ["flight-safety"],
        intro: [["koa", "This game valley has tall trees, busy birds and **power lines**. Real pilots pick a clear area far away from these!"],
                ["koa", "See that red dashed line up high? In many countries, drones must stay below about **120 m**."]],
        play: level(2) },
      { title: "Night flight", goal: "Game night flight: save enough battery to get home", cards: ["payload-battery"],
        intro: [["koa", "Game night mission with a small battery! The heavy seed pack makes it drain faster."],
                ["koa", "Fly smooth and save enough battery to get home. Real night flights need extra rules and a trained adult pilot."]],
        play: level(3) },
      { title: "Storm run", goal: "Two patches, one storm", cards: [],
        intro: [["koa", "Game-only storm challenge! Two seed packs, two patches, and each planted patch is a checkpoint."],
                ["sprout", "Real pilots land before a storm and wait for better weather. In the game, we can do this!"]],
        play: level(4) }
    ]
  });
})();
