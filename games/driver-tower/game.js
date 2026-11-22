/* g04 Driver Tower — wake the sleeping GPU by stacking its software, layer by layer.
 * L1 easy route: driver + `pip install torch` (after a CUDA 13 block wobbles off a driver that stops at 12.8).
 * L2 expert route: driver → CUDA toolkit → cuDNN → build, with matching versions (two towers).
 * L3 read the real `nvidia-smi` report of the ReSeed project computer (4 × A100 80GB).
 * L4 one missing word: `torch.cuda.is_available()` prints True → fireworks; train.py picks cuda or cpu.
 * Stealth skills: software layers, version compatibility, reading tool output, a first line of PyTorch. */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a";
  var CH = 620, FLOOR = 572, GPU_W = 420, GPU_H = 104, BW = 360, BH = 60, GAP = 3;

  /* ------------------------------------------------------------ blocks */
  var B = {
    drv570: { kind: "driver", num: 570, name: "NVIDIA Driver 570", tag: "CUDA ≤ 12.8", max: 12.8 },
    drv535: { kind: "driver", num: 535, name: "NVIDIA Driver 535", tag: "CUDA ≤ 12.2", max: 12.2 },
    drv580: { kind: "driver", num: 580, name: "NVIDIA Driver 580", tag: "CUDA ≤ 13.0", max: 13.0 },
    cuda128: { kind: "toolkit", name: "CUDA Toolkit", tag: "12.8", ver: 12.8 },
    cuda130: { kind: "toolkit", name: "CUDA Toolkit", tag: "13.0", ver: 13.0 },
    cudnn9c12: { kind: "cudnn", name: "cuDNN 9", tag: "for CUDA 12", major: 12 },
    cudnn9c13: { kind: "cudnn", name: "cuDNN 9", tag: "for CUDA 13", major: 13 },
    cudnn8c11: { kind: "cudnn", name: "cuDNN 8", tag: "for CUDA 11", major: 11 },
    build: { kind: "build", name: "Build PyTorch", tag: "from source" },
    torch: { kind: "torch", name: "PyTorch 2.6", tag: "+ CUDA 12.4", ver: 12.4 }
  };
  Object.keys(B).forEach(function (k) { B[k].id = k; });
  var LOOK = { driver: ["#76b900", INK], toolkit: ["#2b7bd0", "#fff"], cudnn: ["#7c5cc4", "#fff"], build: ["#ffc53d", INK], torch: ["#ee4c2c", "#fff"] };
  var ORDER = ["driver", "toolkit", "cudnn", "build"];
  var KNAME = { driver: "driver", toolkit: "CUDA toolkit", cudnn: "cuDNN", build: "build", torch: "PyTorch" };

  function fix(v) { return v.toFixed(1); }
  function plain(s) { return String(s).replace(/\*\*|`/g, ""); }
  function snd(fn) { if (RQ.save.setting("sound")) try { fn(); } catch (e) { /* no audio */ } }
  function overlayOpen() { return !!document.querySelector(".rq-overlay, .rq-talk"); }

  /** Does block d stick on top of this tower (list of defs)? -> {ok, why, short, perm} */
  function fits(tower, d) {
    var OK = { ok: true };
    function bad(why, short, perm) { return { ok: false, why: why, short: short, perm: !!perm }; }
    var top = tower[tower.length - 1];
    var drv = tower.filter(function (k) { return k.kind === "driver"; })[0];
    var tk = tower.filter(function (k) { return k.kind === "toolkit"; })[0];
    if (!tower.length) return d.kind === "driver" ? OK : bad("The " + KNAME[d.kind] + " needs a **driver** under it. The driver goes first!", "needs the driver first");
    if (d.kind === "driver") return bad("One driver is enough! It sits right on the GPU.", "only one driver");
    if (d.kind === "torch") {
      if (top.kind !== "driver") return bad("PyTorch sits right on the driver.", "goes on the driver");
      if (d.ver > drv.max) return bad("Driver " + drv.num + " speaks CUDA up to " + fix(drv.max) + ". This PyTorch needs CUDA " + fix(d.ver) + ".", "too new for this driver", true);
      return OK;
    }
    if (tower.some(function (k) { return k.kind === d.kind; })) return bad("There is already a " + KNAME[d.kind] + " in the tower.", "already in the tower");
    if (ORDER.indexOf(d.kind) > tower.length) return bad("Too early! The **" + KNAME[ORDER[tower.length]] + "** comes next.", "too early");
    if (d.kind === "toolkit" && d.ver > drv.max) return bad("Driver " + drv.num + " only speaks CUDA up to " + fix(drv.max) + ". CUDA " + fix(d.ver) + " is too new!", "too new for this driver", true);
    if (d.kind === "cudnn" && d.major !== Math.floor(tk.ver)) return bad("This cuDNN is made for CUDA " + d.major + ", but the toolkit is CUDA " + fix(tk.ver) + ".", "made for another CUDA", true);
    return OK;
  }

  /* ------------------------------------------------------------ drawing */
  function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  function wrapText(ctx, text, maxW) {
    var words = String(text).split(" "), lines = [], cur = "";
    words.forEach(function (w) {
      var t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawRoom(ctx, W) {
    var g = ctx.createLinearGradient(0, 0, 0, FLOOR);
    g.addColorStop(0, "#b9e6df"); g.addColorStop(1, "#e7f8f5");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR);
    ctx.fillStyle = "rgba(18,163,154,.14)";
    for (var r = 0, y = 26; y < FLOOR - 20; y += 34, r++) for (var x = 18 + (r % 2) * 17; x < W; x += 34) dot(ctx, x, y, 3.2);
    // pegboard tools: wrench + screwdriver
    ctx.save(); ctx.translate(58, 150); ctx.rotate(-.5); ctx.fillStyle = "#9fb3c8"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    u.rr(ctx, -7, -10, 14, 110, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -16, 17, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#cfeee9"; ctx.fillRect(-6, -36, 12, 22); ctx.restore();
    ctx.save(); ctx.translate(118, 140); ctx.rotate(.35); ctx.fillStyle = "#e2574c"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    u.rr(ctx, -10, -10, 20, 52, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#c7d3df"; ctx.fillRect(-3, 42, 6, 52); ctx.strokeRect(-3, 42, 6, 52); ctx.restore();
    ctx.fillStyle = "#c8a165"; ctx.fillRect(0, FLOOR, W, CH - FLOOR);
    ctx.fillStyle = "#b08850"; ctx.fillRect(0, FLOOR + 22, W, 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR); ctx.stroke();
  }
  function fan(ctx, x, y, r, a) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = "#1f2a36"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = "#9fb3c8";
    for (var i = 0; i < 7; i++) { ctx.rotate(Math.PI * 2 / 7); ctx.beginPath(); ctx.ellipse(r * .5, 0, r * .45, r * .17, .5, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, r * .26, 0, 7); ctx.fillStyle = "#76b900"; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  }
  /** The A100 card that sits in its slot on the bench, with a face that sleeps or wakes. */
  function drawGPU(ctx, cx, S, t) {
    var x = cx - GPU_W / 2, y = FLOOR - GPU_H, h = GPU_H - 10, w = GPU_W;
    ctx.fillStyle = "#e5b93c";
    for (var i = 0; i < 21; i++) ctx.fillRect(cx - 140 + i * 13.5, FLOOR - 12, 8, 12);
    ctx.fillStyle = "#263241"; u.rr(ctx, cx - 152, FLOOR - 4, 304, 14, 4); ctx.fill();
    ctx.save();
    if (S.wake > .02) { ctx.shadowColor = "rgba(118,185,0," + (.85 * S.wake) + ")"; ctx.shadowBlur = 36 * S.wake; }
    u.rr(ctx, x, y, w, h, 16); ctx.fillStyle = "#3b4757"; ctx.fill(); ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; u.rr(ctx, x, y, w, h, 16); ctx.stroke();
    ctx.fillStyle = "#76b900"; ctx.fillRect(x + 10, y + 7, w - 20, 5);
    fan(ctx, x + 70, y + h / 2 + 4, 34, S.fanA); fan(ctx, x + 158, y + h / 2 + 4, 34, S.fanA + .4);
    var px = x + 206, pw = w - 218, py = y + 18, ph = h - 26;
    u.rr(ctx, px, py, pw, ph, 12); ctx.fillStyle = "#142230"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = "#9be15d"; ctx.font = "700 15px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("NVIDIA A100 80GB", px + pw / 2, py + 13);
    var ex1 = px + pw * .36, ex2 = px + pw * .64, ey = py + ph * .55;
    ctx.strokeStyle = "#7ff0ff"; ctx.fillStyle = "#7ff0ff"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
    if (S.wake < .5) {
      [ex1, ex2].forEach(function (ex) { ctx.beginPath(); ctx.arc(ex, ey - 5, 8, .2 * Math.PI, .8 * Math.PI); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(px + pw / 2 - 6, ey + 16); ctx.lineTo(px + pw / 2 + 6, ey + 16); ctx.stroke();
    } else {
      var blink = (t % 3.4) < .12;
      [ex1, ex2].forEach(function (ex) {
        if (blink) { ctx.beginPath(); ctx.moveTo(ex - 7, ey); ctx.lineTo(ex + 7, ey); ctx.stroke(); }
        else { ctx.fillStyle = "#7ff0ff"; dot(ctx, ex, ey, 8); ctx.fillStyle = "#fff"; dot(ctx, ex + 3, ey - 3, 2.8); }
      });
      ctx.beginPath(); ctx.arc(px + pw / 2, ey + 8, 9, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
    }
    ctx.lineCap = "butt";
    if (S.wake < .5) {
      ctx.fillStyle = INK; ctx.textAlign = "left";
      for (var k = 0; k < 3; k++) {
        var p = (t * .5 + k / 3) % 1;
        ctx.globalAlpha = Math.sin(p * Math.PI);
        ctx.font = "700 " + (16 + k * 5) + "px Fredoka, sans-serif";
        ctx.fillText(k ? "Z" : "z", x + w + 6 + p * 22, y + 10 - p * 56);
      }
      ctx.globalAlpha = 1;
    }
  }
  /** A software block. (cx, y) = centre-top; sq = squash after landing. */
  function drawBlock(ctx, d, cx, y, rot, alpha, sq) {
    var look = LOOK[d.kind];
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : Math.max(0, alpha);
    ctx.translate(cx, y + BH); ctx.rotate(rot || 0);
    if (sq) ctx.scale(1 + sq * .22, 1 - sq * .28);
    ctx.translate(0, -BH);
    ctx.fillStyle = look[0]; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    [-110, 0, 110].forEach(function (sx) { u.rr(ctx, sx - 20, -7, 40, 12, 4); ctx.fill(); ctx.stroke(); });
    u.rr(ctx, -BW / 2, 0, BW, BH, 12); ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.25)"; u.rr(ctx, -BW / 2 + 8, 6, BW - 16, 9, 5); ctx.fill();
    ctx.font = "700 16px Fredoka, sans-serif";
    var tw = ctx.measureText(d.tag).width + 22, size = 22;
    ctx.font = "700 22px Fredoka, sans-serif";
    while (ctx.measureText(d.name).width + tw + 46 > BW && size > 15) { size--; ctx.font = "700 " + size + "px Fredoka, sans-serif"; }
    ctx.fillStyle = look[1]; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(d.name, -BW / 2 + 16, BH / 2 + 2);
    var pl = BW / 2 - 12 - tw;
    ctx.fillStyle = "#fff"; u.rr(ctx, pl, BH / 2 - 14, tw, 28, 14); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = "700 16px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.fillText(d.tag, pl + tw / 2, BH / 2 + 1);
    ctx.restore();
  }
  /** A giggling Glitch Bug (purple beetle with sparking antennae). */
  function drawBug(ctx, b, t) {
    ctx.save(); ctx.translate(b.x, b.y + Math.sin(t * 8) * 4);
    var fl = Math.abs(Math.sin(t * 40)) * 10 + 4;
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-15, -14, 9, fl, -.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(15, -14, 9, fl, .5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath();
    for (var i = -1; i <= 1; i++) {
      var wg = Math.sin(t * 14 + i) * 3;
      ctx.moveTo(-14, i * 8 + 4); ctx.lineTo(-29, i * 10 + 10 + wg); ctx.moveTo(14, i * 8 + 4); ctx.lineTo(29, i * 10 + 10 - wg);
    }
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 4, 22, 18, 0, 0, 7); ctx.fillStyle = "#8f5bd6"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 21); ctx.stroke();
    ctx.fillStyle = "#b892f0"; dot(ctx, -10, 6, 4); dot(ctx, 9, 11, 3.5); dot(ctx, 11, -2, 3);
    ctx.beginPath(); ctx.moveTo(-5, -24); ctx.lineTo(-13, -40); ctx.moveTo(5, -24); ctx.lineTo(13, -40); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -16, 12, 0, 7); ctx.fillStyle = "#5b3a99"; ctx.fill(); ctx.stroke();
    if (Math.floor(t * 7) % 2) { ctx.fillStyle = "#ffd23f"; dot(ctx, -13, -42, 4.5); dot(ctx, 13, -42, 4.5); }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(-5, -15, 3.5, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(5, -15, 3.5, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.restore();
    if (b.say) {
      ctx.font = "700 18px Fredoka, sans-serif"; var w = ctx.measureText(b.say).width + 22, bx = b.x + 30, by = b.y - 62;
      if (bx + w > b.W - 6) bx = b.x - 30 - w;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, bx, by, w, 32, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#7c5cc4"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(b.say, bx + 11, by + 17);
    }
  }
  function drawMinis(ctx, S) {
    for (var i = 0; i < 4; i++) {
      var on = i < S.minisOn, x = 16 + i * 112, y = 16;
      ctx.save(); if (on) { ctx.shadowColor = "#9be15d"; ctx.shadowBlur = 18; }
      u.rr(ctx, x, y, 100, 46, 10); ctx.fillStyle = on ? "#76b900" : "#3b4757"; ctx.fill(); ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = INK; u.rr(ctx, x, y, 100, 46, 10); ctx.stroke();
      ctx.fillStyle = on ? INK : "#cfd8e3"; ctx.font = "600 17px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("cuda:" + i, x + 50, y + 24);
    }
  }

  /* ------------------------------------------------------------ the tower scene (canvas left, panel right) */
  function towerScene(L, o) {
    o = o || {};
    var root = u.el("div", { class: "dt-root" }), left = u.el("div", { class: "dt-left" }), panel = u.el("div", { class: "dt-panel" + (o.wide ? " wide" : "") });
    root.appendChild(left); root.appendChild(panel); L.stage.appendChild(root);
    var cv = L.canvas({ w: o.w || 560, h: CH, parent: left, fill: true, label: "the GPU tower", bg: "#c8a165" });
    var S = { L: L, cv: cv, ctx: cv.ctx, panel: panel, left: left, tower: [], flying: [], parts: [], bugs: [], sign: null,
      awake: false, wake: 0, fanA: 0, shake: 0, busy: false, showMinis: false, minisOn: 0 };
    S.cx = function () { return cv.w / 2; };
    S.topY = function (n) { return FLOOR - GPU_H - (n + 1) * (BH + GAP); };
    S.defs = function () { return S.tower.map(function (b) { return b.def; }); };
    S.setTower = function (defs) { S.tower = defs.map(function (d) { return { def: d, sq: 0 }; }); };

    /* ---- signs and particles */
    S.signBad = function (text) { S.sign = { text: plain(text), t: 0, life: 4.2, good: false }; };
    S.signGood = function (text) { S.sign = { text: plain(text), t: 0, life: 3.4, good: true }; };
    S.signInfo = function (text) { S.sign = { text: plain(text), t: 0, life: 5, info: true }; };
    S.dust = function (x, y) {
      for (var i = 0; i < 14; i++) S.parts.push({ kind: "dust", x: x + u.rand(-BW / 2, BW / 2), y: y, vx: u.rand(-60, 60), vy: u.rand(-60, -10), life: .6, max: .6, r: u.rand(6, 12) });
    };
    S.sparkle = function (x, y, n) {
      for (var i = 0; i < (n || 20); i++) S.parts.push({ kind: "spark", x: x + u.rand(-40, 40), y: y + u.rand(-20, 20), vx: u.rand(-220, 220), vy: u.rand(-320, -60), g: 500, life: 1, max: 1, c: u.pick(["#ffd23f", "#9be15d", "#7ff0ff", "#fff"]) });
    };
    S.fireworks = function (n) {
      for (var i = 0; i < n; i++) (function (k) {
        L.timeout(function () {
          S.parts.push({ kind: "rocket", x: u.rand(60, cv.w - 60), y: CH - 30, vx: u.rand(-30, 30), vy: -u.rand(560, 720), g: 260, life: u.rand(.75, 1.05), max: 1,
            c: u.pick(["#ffd23f", "#ff6b8b", "#7ff0ff", "#9be15d", "#b197fc", "#ff922b"]) });
          snd(function () { RQ.audio.noise({ f: 600, f2: 2400, ft: "bandpass", d: .4, v: .12 }); });
        }, k * 380);
      })(i);
    };
    function explode(p, born) {
      for (var i = 0; i < 46; i++) {
        var a = Math.PI * 2 * i / 46 + u.rand(-.05, .05), sp = u.rand(110, 280);
        born.push({ kind: "fw", x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 150, drag: 1.1, life: u.rand(1.1, 1.6), max: 1.6, c: i % 5 ? p.c : "#fff" });
      }
      snd(function () { RQ.audio.noise({ f: 900, f2: 120, d: .45, v: .28 }); RQ.audio.tone({ f: 120, f2: 50, d: .3, v: .2 }); });
    }
    function bonk() { snd(function () { RQ.audio.tone({ f: 520, f2: 140, type: "square", d: .16, v: .13, lp: 1400 }); RQ.audio.noise({ f: 500, f2: 80, d: .25, v: .3 }); }); }

    /* ---- drop a block on the tower -> Promise<{ok, why, short, perm}> */
    S.drop = function (d, opt) {
      opt = opt || {};
      var res = fits(S.defs(), d);
      return new Promise(function (resolve) {
        S.flying.push({ def: d, dx: 0, y: opt.fromY != null ? opt.fromY : -BH - 20, vx: 0, vy: 0, rot: 0, vr: 0, state: "drop", t: 0,
          targetY: S.topY(S.tower.length), res: res, done: resolve, alpha: 1 });
        RQ.audio.sfx("whoosh");
      });
    };
    /** Lift the top block off the tower (it floats away). -> Promise<def|null> */
    S.lift = function () {
      var b = S.tower.pop(); if (!b) return Promise.resolve(null);
      S.awake = false; RQ.audio.sfx("jump");
      S.flying.push({ def: b.def, dx: 0, y: S.topY(S.tower.length), vx: 420, vy: -520, rot: 0, vr: 1.2, state: "away", t: 0, alpha: 1 });
      return L.wait(450).then(function () { return b.def; });
    };
    S.clearTower = function () {
      S.awake = false; RQ.audio.sfx("whoosh");
      S.tower.forEach(function (b, i) { S.flying.push({ def: b.def, dx: 0, y: S.topY(i), vx: u.rand(-380, 380), vy: -u.rand(420, 640), rot: 0, vr: u.rand(-3, 3), state: "away", t: 0, alpha: 1 }); });
      S.tower = [];
      return L.wait(900);
    };
    /** A Glitch Bug flies in carrying block d and drops it. -> Promise<result> */
    S.bugDrop = function (d) {
      return new Promise(function (resolve) {
        var bug = { x: cv.w + 60, y: 80, tx: S.cx() + 4, ty: 78, carry: d, say: "", W: cv.w };
        S.bugs.push(bug); RQ.audio.sfx("giggle");
        L.timeout(function () {
          bug.carry = null; bug.say = "hee hee!";
          S.drop(d, { fromY: bug.y + 28 }).then(function (r) {
            bug.say = "oops! hee hee!"; RQ.audio.sfx("giggle");
            L.timeout(function () {
              bug.tx = cv.w + 90; bug.ty = -60; bug.say = "";
              L.timeout(function () { S.bugs.splice(S.bugs.indexOf(bug), 1); resolve(r); }, 800);
            }, 1100);
          });
        }, 1500);
      });
    };

    /* ---- per-frame update + draw */
    L.loop(function (dt, t) {
      var ctx = S.ctx, W = cv.w, cx = W / 2;
      S.wake = u.lerp(S.wake, S.awake ? 1 : 0, Math.min(1, dt * 3));
      S.fanA += dt * (.4 + S.wake * 16);
      S.shake = Math.max(0, S.shake - dt);
      drawRoom(ctx, W);
      if (S.showMinis) drawMinis(ctx, S);
      drawGPU(ctx, cx, S, t);
      var n = S.tower.length;
      if (S.target && !S.busy && n < 4) { // dashed "drop here" slot
        var ty = S.topY(n), ay = ty - 30 + Math.sin(t * 5) * 6;
        ctx.save(); ctx.setLineDash([12, 9]); ctx.lineWidth = 4; ctx.strokeStyle = "rgba(29,43,58,.45)"; ctx.fillStyle = "rgba(255,255,255,.35)";
        u.rr(ctx, cx - BW / 2, ty, BW, BH, 12); ctx.fill(); ctx.stroke(); ctx.restore();
        ctx.fillStyle = "rgba(29,43,58,.55)"; ctx.font = "600 18px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("drop a block here", cx, ty + BH / 2);
        ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx, ay + 18); ctx.lineTo(cx - 14, ay); ctx.lineTo(cx + 14, ay); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      S.tower.forEach(function (b, i) {
        b.sq = Math.max(0, b.sq - dt * 4);
        var sx = S.shake > 0 ? Math.sin(t * 60 + i) * S.shake * 14 * (i + 1) / n : 0;
        drawBlock(ctx, b.def, cx + sx, S.topY(i), 0, 1, b.sq);
      });
      // falling / wobbling / tipping blocks
      S.flying = S.flying.filter(function (b) {
        b.t += dt;
        if (b.state === "drop") {
          b.vy += 2600 * dt; b.y += b.vy * dt;
          if (b.y >= b.targetY) {
            b.y = b.targetY;
            if (b.res.ok) {
              S.tower.push({ def: b.def, sq: 1 }); RQ.audio.sfx("snap");
              snd(function () { RQ.audio.tone({ f: 180, f2: 90, d: .12, v: .3 }); });
              S.dust(cx, b.y + BH); b.done(b.res); return false;
            }
            b.state = "wobble"; b.t = 0; RQ.audio.sfx("buzz"); S.shake = .5;
          }
        } else if (b.state === "wobble") {
          b.rot = Math.sin(b.t * 17) * Math.min(.2, b.t * .26);
          if (b.t > 1.05) {
            var dir = L.rng() < .5 ? -1 : 1;
            b.state = "tip"; b.t = 0; b.vr = dir * 2.8; b.vx = dir * 300; b.vy = -240; bonk();
            S.signBad(b.res.why);
          }
        } else if (b.state === "tip") {
          b.vy += 2100 * dt; b.dx += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
          if (b.y > CH + 160) { b.done(b.res); return false; }
        } else if (b.state === "away") {
          b.vy += 700 * dt; b.dx += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; b.alpha -= dt * 1.3;
          if (b.alpha <= 0) return false;
        }
        drawBlock(ctx, b.def, cx + b.dx, b.y, b.rot, b.alpha, 0);
        return true;
      });
      // bugs (carrying blocks)
      S.bugs.forEach(function (bug) {
        var k = Math.min(1, dt * 2.6); bug.x += (bug.tx - bug.x) * k; bug.y += (bug.ty - bug.y) * k; bug.W = W;
        if (bug.carry) drawBlock(ctx, bug.carry, bug.x, bug.y + 28, Math.sin(t * 5) * .05, 1, 0);
        drawBug(ctx, bug, t);
      });
      // particles
      var born = [];
      S.parts = S.parts.filter(function (p) {
        p.life -= dt;
        if (p.life <= 0) { if (p.kind === "rocket") explode(p, born); return false; }
        p.vy += (p.g || 0) * dt;
        if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt * .5; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        var a = p.life / p.max;
        if (p.kind === "dust") { ctx.globalAlpha = a * .7; ctx.fillStyle = "#e9dcc4"; dot(ctx, p.x, p.y, p.r * (1.6 - a)); }
        else if (p.kind === "spark") { ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 6); ctx.fillRect(-5, -1.6, 10, 3.2); ctx.fillRect(-1.6, -5, 3.2, 10); ctx.restore(); }
        else if (p.kind === "rocket") { ctx.globalAlpha = 1; ctx.strokeStyle = p.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); ctx.stroke(); ctx.fillStyle = "#fff"; dot(ctx, p.x, p.y, 3.5); }
        else { ctx.globalAlpha = Math.min(1, a * 1.4); ctx.fillStyle = p.c; dot(ctx, p.x, p.y, 3.2); }
        ctx.globalAlpha = 1;
        return true;
      });
      if (born.length) S.parts = S.parts.concat(born);
      // sign above the tower
      var sg = S.sign;
      if (sg) {
        sg.t += dt;
        if (sg.t > sg.life) S.sign = null;
        else {
          ctx.font = "600 19px Fredoka, sans-serif";
          var lines = wrapText(ctx, sg.text, Math.min(440, W - 60)), lh = 24, w = 0;
          lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
          w += 34; var h = lines.length * lh + 20, y = Math.max(76, S.topY(S.tower.length) - h - 26);
          var pop = u.ease.outBack(Math.min(1, sg.t / .3)), al = Math.min(1, (sg.life - sg.t) / .4);
          ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(cx, y + h / 2); ctx.scale(pop, pop);
          ctx.fillStyle = sg.info ? "#fff3bf" : sg.good ? "#d9f7df" : "#ffe0e4"; ctx.strokeStyle = INK; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(-12, h / 2 - 2); ctx.lineTo(0, h / 2 + 14); ctx.lineTo(12, h / 2 - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
          u.rr(ctx, -w / 2, -h / 2, w, h, 14); ctx.fill(); ctx.stroke();
          ctx.fillRect(-10, h / 2 - 6, 20, 5);
          ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          lines.forEach(function (l, i) { ctx.fillText(l, 0, -h / 2 + 10 + lh / 2 + i * lh); });
          ctx.restore();
        }
      }
    });

    /* ---- right panel helpers */
    S.setPanel = function (title, sub) {
      panel.innerHTML = "";
      panel.appendChild(u.el("div", { class: "dt-head" }, u.el("b", { html: title }), sub ? u.el("span", { html: RQ.ui.md(sub) }) : null));
      var body = u.el("div", { class: "dt-body" }); panel.appendChild(body);
      return body;
    };
    S.routes = function (body, on) {
      body.appendChild(u.el("div", { class: "dt-routes" },
        u.el("div", { class: "r" + (on === "easy" ? " on" : ""), html: "🐇 <b>Easy route:</b> driver → <code>pip install torch</code>" }),
        u.el("div", { class: "r" + (on === "expert" ? " on" : ""), html: "🧗 <b>Expert route:</b> driver → CUDA toolkit → cuDNN → build" })));
    };
    /** Shelf of blocks: click, drag onto the tower, or press the number key. */
    S.shelf = function (body, defs, onPick, opt) {
      opt = opt || {};
      var items = defs.slice(), marks = {}, glowId = null, active = true, drag = null, sup = false;
      var list = u.el("div", { class: "dt-shelf" }); body.appendChild(list);
      var liftBtn = null;
      if (opt.lift) {
        liftBtn = u.el("button", { class: "btn small dt-lift", html: "⤴ Lift the top block <kbd>L</kbd>" });
        L.on(liftBtn, "click", function () { doLift(); });
        body.appendChild(liftBtn);
      }
      function pick(d) { if (!active || S.busy || !L.alive) return; RQ.audio.sfx("select"); onPick(d); }
      function doLift() {
        if (!active || S.busy) return;
        if (!S.tower.length) { RQ.audio.sfx("error"); return; }
        opt.onLift();
      }
      function blockEl(d, i, cls) {
        var look = LOOK[d.kind], m = marks[d.id];
        var e = u.el("button", { class: "dt-blk" + (cls || ""), "aria-label": "Drop " + d.name + " " + d.tag },
          i != null ? u.el("span", { class: "k", text: String(i + 1) }) : null,
          u.el("span", { class: "nm", text: d.name }), u.el("span", { class: "tg", text: d.tag }),
          u.el("span", { class: "why", text: m ? "✗ " + m.why : "" }));
        e.style.setProperty("--bf", look[0]); e.style.setProperty("--bi", look[1]);
        return e;
      }
      function render() {
        list.innerHTML = "";
        items.forEach(function (d, i) {
          var btn = blockEl(d, i, glowId === d.id ? " glow" : "");
          L.on(btn, "click", function () { if (sup) return; pick(d); });
          L.on(btn, "pointerdown", function (e) { if (S.busy || !active) return; drag = { d: d, x0: e.clientX, y0: e.clientY, ghost: null }; });
          list.appendChild(btn);
        });
      }
      L.on(window, "pointermove", function (e) {
        if (!drag) return;
        if (!drag.ghost && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10) {
          drag.ghost = blockEl(drag.d, null, " dt-ghost"); L.stage.appendChild(drag.ghost); RQ.audio.sfx("pop");
        }
        if (drag.ghost) { drag.ghost.style.left = e.clientX + "px"; drag.ghost.style.top = e.clientY + "px"; }
      });
      function endDrag(e, cancel) {
        if (!drag) return;
        var dd = drag; drag = null;
        if (!dd.ghost) return;
        dd.ghost.remove(); sup = true; L.timeout(function () { sup = false; }, 80);
        var r = left.getBoundingClientRect();
        if (!cancel && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) pick(dd.d);
        else RQ.audio.sfx("click");
      }
      L.on(window, "pointerup", function (e) { endDrag(e, false); });
      L.on(window, "pointercancel", function (e) { endDrag(e, true); });
      L.on(window, "keydown", function (e) {
        if (!active || overlayOpen() || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= items.length) { e.preventDefault(); pick(items[n - 1]); }
        else if (opt.lift && (e.key === "l" || e.key === "L" || e.key === "Backspace")) { e.preventDefault(); doLift(); }
      });
      render(); S.target = true;
      return {
        items: function () { return items.slice(); },
        remove: function (d) { var i = items.indexOf(d); if (i >= 0) items.splice(i, 1); render(); },
        add: function (d) { if (items.indexOf(d) < 0) items.push(d); render(); },
        mark: function (d, why, perm) { marks[d.id] = { why: why, perm: perm }; render(); },
        clearMarks: function (all) { for (var k in marks) if (all || !marks[k].perm) delete marks[k]; render(); },
        glow: function (d) { glowId = d ? d.id : null; render(); },
        glowLift: function (on) { if (liftBtn) liftBtn.classList.toggle("glow", !!on); },
        destroy: function () { active = false; S.target = false; list.remove(); if (liftBtn) liftBtn.remove(); }
      };
    };
    return S;
  }

  /* ------------------------------------------------------------ L1: the easy route */
  function pipWrong(cmd) {
    if (/^pip3? install pytorch$/.test(cmd)) return "[y]Close! On pip the package is just called[/y] [w]torch[/w]";
    if (/^pip3? install \S+/.test(cmd)) return "[y]That's a different package. We want[/y] [w]torch[/w]";
    var sub = /^pip3? (\S+)/.exec(cmd);
    if (sub) return "[r]ERROR: unknown command \"" + sub[1] + "\"[/r] [y]Try:[/y] [w]pip install torch[/w]";
    if (/^pip3?$/.test(cmd)) return "[y]pip needs a job: install! Try[/y] [w]pip install torch[/w]";
    if (/^(sudo )?apt/.test(cmd)) return "[y]apt can install some Python packages too, but for this game use[/y] [w]pip[/w]";
    return "[r]" + (cmd.split(" ")[0] || "?") + ": command not found[/r] [y]Type:[/y] [w]pip install torch[/w]";
  }
  async function easyRoute(L) {
    var S = towerScene(L), wrongs = 0;
    var body = S.setPanel("🧰 Shelf", "Drop the **driver** on the GPU: click it, drag it, or press **1**.");
    await new Promise(function (resolve) {
      var sh = S.shelf(body, [B.drv570], function (d) {
        S.busy = true;
        S.drop(d).then(function () { S.busy = false; sh.destroy(); resolve(); });
      });
      S.routes(body, "easy");
    });
    if (!L.alive) return;
    S.signGood("Driver 570 is in! It speaks CUDA up to 12.8.");
    body = S.setPanel("👀 Uh-oh…", "A Glitch Bug is sneaking in with a shiny **CUDA 13.0** block!");
    body.appendChild(u.el("div", { class: "dt-note", html: "Look at the driver's tag: <b>CUDA ≤ 12.8</b>.<br>Will a <b>CUDA 13.0</b> block fit on it?" }));
    S.routes(body, "easy");
    await L.wait(1600); if (!L.alive) return;
    await S.bugDrop(B.cuda130); if (!L.alive) return;
    await L.talk([["mo", "Bonk! Driver 570 only speaks CUDA up to **12.8**, so a **CUDA 13** block is too new for it.", { mood: "wow" }],
      ["pix", "Easy route: **pip** brings PyTorch plus its GPU helper packages, and on this computer they fit the driver. Type `pip install torch`."]]);
    if (!L.alive) return;
    S.panel.classList.add("wide"); window.dispatchEvent(new Event("resize")); // roomier terminal; the canvas refits
    body = S.setPanel("💻 Terminal", "Type the grey command and press **Enter**. **Tab** finishes it for you.");
    var t = RQ.term.mount(body, { user: "kid", host: "basecamp", env: "reseed", height: "auto" });
    t.print("[dim]# (reseed) means we are inside the reseed environment[/dim]");
    await t.ask({ expect: "pip install torch", ghost: "pip install torch", wrong: function (cmd) { wrongs++; return pipWrong(cmd); } });
    if (!L.alive) return;
    await t.printSlow(["Collecting torch", "  Downloading torch-2.6.0 [dim](a big wheel!)[/dim]",
      "Collecting [c]nvidia-cuda-runtime-cu12[/c] [y]← CUDA 12.4 runtime comes along![/y]", "Collecting [c]nvidia-cudnn-cu12[/c] [y]← cuDNN 9.1 comes along![/y]"], 320);
    if (!L.alive) return;
    await t.progress("Installing", 1500);
    if (!L.alive) return;
    t.print("[g]Successfully installed torch-2.6.0 nvidia-cuda-runtime-cu12-12.4.127 nvidia-cudnn-cu12-9.1.0.70[/g]");
    await S.drop(B.torch); if (!L.alive) return;
    S.awake = true; S.sparkle(S.cx(), FLOOR - GPU_H / 2, 30); RQ.audio.sfx("powerup");
    S.signGood("CUDA 12.4 ≤ 12.8, so it fits! The GPU wakes up.");
    t.print("[y]CUDA 12.4 ≤ 12.8 → it fits! No CUDA toolkit needed.[/y]");
    await L.wait(2600); if (!L.alive) return;
    L.win({ stars: wrongs <= 1 ? 3 : wrongs <= 3 ? 2 : 1, msg: "Easy route done: the **driver** plus `pip install torch`. pip brought the CUDA runtime along with it!", stats: { "Typos": wrongs } });
  }

  /* ------------------------------------------------------------ L2: the expert route */
  function nextGood(S, items) {
    var defs = S.defs();
    return items.filter(function (d) { return fits(defs, d).ok; })[0] || null;
  }
  function buildRound(L, S, R, onFall) {
    return new Promise(function (resolve) {
      var body = S.setPanel(R.title, R.sub), roundFalls = 0;
      var sh = S.shelf(body, u.shuffle(R.keys, L.rng).map(function (k) { return B[k]; }), function (d) {
        S.busy = true;
        S.drop(d).then(function (res) {
          S.busy = false;
          if (!L.alive) return;
          if (res.ok) {
            sh.remove(d); sh.clearMarks(false); sh.glow(null); sh.glowLift(false);
            if (d.kind === "build") {
              sh.destroy(); S.awake = true; S.sparkle(S.cx(), S.topY(3), 34); S.fireworks(2); RQ.audio.sfx("powerup");
              S.signGood("Tower complete! The GPU wakes up.");
              L.timeout(resolve, 2400);
            } else if (d.kind === "driver") S.signGood("Driver " + d.num + " speaks CUDA up to " + fix(d.max) + ".");
            else S.signGood(KNAME[d.kind] + " fits!");
            return;
          }
          onFall(); roundFalls++;
          sh.mark(d, res.short, res.perm);
          var good = nextGood(S, sh.items());
          if (!good && S.tower.length && R.lift) {
            sh.glowLift(true);
            var drv = S.tower[0].def;
            L.timeout(function () {
              if (S.tower.length && S.tower[0].def === drv && !nextGood(S, sh.items())) S.signInfo("💡 Nothing fits on driver " + drv.num + ". Lift it (press L) and pick a newer driver!");
            }, 3000);
          } else if (good && (roundFalls >= 2 || L.fails >= 1)) sh.glow(good);
        });
      }, {
        lift: R.lift,
        onLift: function () {
          S.busy = true;
          S.lift().then(function (d) { S.busy = false; if (!L.alive || !d) return; sh.add(d); sh.clearMarks(true); sh.glowLift(false); sh.glow(null); });
        }
      });
      S.routes(body, "expert");
    });
  }
  async function expertRoute(L) {
    var S = towerScene(L), falls = 0;
    var ROUNDS = [
      { title: "🧗 Expert tower 1 of 2", sub: "Stack **driver → CUDA toolkit → cuDNN → build**. Read the version tags!",
        keys: ["drv570", "cuda130", "cuda128", "cudnn8c11", "cudnn9c12", "build"], lift: false },
      { title: "🧗 Expert tower 2 of 2", sub: "This project needs **CUDA 13.0**. Which driver can speak it?",
        keys: ["drv535", "drv580", "cuda130", "cudnn9c12", "cudnn9c13", "build"], lift: true }
    ];
    for (var r = 0; r < ROUNDS.length; r++) {
      if (r === 1) {
        await S.clearTower(); if (!L.alive) return;
        await L.say("mo", "New job! This project needs **CUDA 13.0**, so pick a driver that speaks CUDA 13.", { mood: "think" });
        if (!L.alive) return;
      }
      await buildRound(L, S, ROUNDS[r], function () { falls++; });
      if (!L.alive) return;
    }
    L.win({ stars: falls <= 1 ? 3 : falls <= 3 ? 2 : 1, msg: "Two expert towers: **driver → CUDA toolkit → cuDNN → build**, with versions that match.", stats: { "Falls": falls } });
  }

  /* ------------------------------------------------------------ L3: read the real nvidia-smi */
  function smiLines() {
    var e = u.esc;
    function K(cls, s) { return '<span class="dt-k-' + cls + '">' + e(s) + "</span>"; }
    function D(s) { return '<span class="dim">' + e(s) + "</span>"; }
    var W = 57, bar = D("+" + "-".repeat(W) + "+"), sep = D("+-----+-----------------------+--------------------+------+");
    var a = "NVIDIA-SMI 570.211.01", b = "Driver Version: ", c = "570.211.01", gap = W - 2 - a.length - b.length - c.length, col = 1 + a.length + gap;
    var lines = [bar,
      D("|") + " " + e(a) + " ".repeat(gap) + e(b) + K("driver", c) + " " + D("|"),
      D("|") + " ".repeat(col) + e("CUDA Version: ") + K("cuda", "12.8") + " ".repeat(W - col - 18) + D("|"),
      sep,
      D("|") + '<span class="w"> GPU </span>' + D("|") + '<span class="w"> Name                  </span>' + D("|") + '<span class="w">       Memory-Usage </span>' + D("|") + '<span class="w"> Util </span>' + D("|"),
      sep];
    for (var i = 0; i < 4; i++) {
      lines.push(D("|") + "   " + K("count", String(i)) + " " + D("|") + " " + K("name", "NVIDIA A100 80GB PCIe") + " " + D("|") + "    " + K("used", "0MiB") + " / " + K("mem", "81920MiB") + " " + D("|") + "   " + K("util", "0%") + " " + D("|"));
    }
    lines.push(sep, e("No running processes found"));
    return lines;
  }
  function smiWrong(cmd) {
    if (/^nvidia[ _]smi$/i.test(cmd)) return "[r]nvidia: command not found[/r] [y]It's one word with a dash:[/y] [w]nvidia-smi[/w]";
    if (/^nvidia-smi$/i.test(cmd)) return "[r]" + cmd + ": command not found[/r] [y]Linux cares about capitals. Use small letters![/y]";
    return "[r]" + (cmd.split(" ")[0] || "?") + ": command not found[/r] [y]Type:[/y] [w]nvidia-smi[/w]";
  }
  async function gauges(L) {
    var root = u.el("div", { class: "dt-root" }), left = u.el("div", { class: "dt-termwrap" }), panel = u.el("div", { class: "dt-panel dt-quiz" });
    root.appendChild(left); root.appendChild(panel); L.stage.appendChild(root);
    var t = RQ.term.mount(left, { user: "kid", host: "mission-vm", height: "auto", title: "kid@mission-vm · our project computer" });
    t.print("[dim]# Our project computer, where ReSeed was built. Ask its GPUs for a report![/dim]");
    var qn = u.el("span", { text: "Step 1: ask the GPUs for their report." });
    var gpus = u.el("div", { class: "dt-gpus" }), cards = [];
    for (var i = 0; i < 4; i++) { cards.push(u.el("div", { class: "dt-gpu", text: "GPU " + i })); gpus.appendChild(cards[i]); }
    var qEl = u.el("div", { class: "dt-q", html: "⌨️ Type <code>nvidia-smi</code> in the terminal and press <b>Enter</b>." });
    var ans = u.el("div", { class: "dt-ans" }), fb = u.el("div", { class: "dt-fb" });
    panel.appendChild(u.el("div", { class: "dt-head" }, u.el("b", { html: "🔎 GPU report quiz" }), qn));
    panel.appendChild(gpus); panel.appendChild(qEl); panel.appendChild(ans); panel.appendChild(fb);
    await t.ask({ expect: "nvidia-smi", ghost: "nvidia-smi", wrong: smiWrong });
    if (!L.alive) return;
    var lines = smiLines();
    for (var k = 0; k < lines.length; k++) { t.printHTML(lines[k]); RQ.audio.sfx("tick"); await L.wait(55); if (!L.alive) return; }
    function hl(keys, ok) {
      u.$$(".dt-hl", t.el).forEach(function (s) { s.classList.remove("dt-hl", "ok"); });
      (keys || []).forEach(function (key) { u.$$(".dt-k-" + key, t.el).forEach(function (s) { s.classList.add("dt-hl"); if (ok) s.classList.add("ok"); }); });
    }
    var Q = [
      { q: "How many GPUs does this computer have?", a: ["4", "1", "2", "8"], hl: ["count"], hint: "Count the GPU rows. The first one is number **0**!", ok: "Yes: GPUs **0, 1, 2, 3**. That's four!" },
      { q: "How much memory does ONE GPU have?", a: ["81920 MiB (80 GiB)", "0 MiB", "570 MiB", "12.8 GiB"], hl: ["mem", "used"], hint: "Look at **Memory-Usage**: used / total.", ok: "Right! 81920 MiB = 80 GiB, because 1024 MiB make 1 GiB. The card's name rounds it to 80GB." },
      { q: "How much GPU memory do all four have together?", a: ["320 GiB", "80 GiB", "160 GiB", "81920 GiB"], hl: ["mem", "count"], hint: "4 GPUs × 80 GiB each = ?", ok: "4 × 80 GiB = **320 GiB**. Room for giant AI models!" },
      { q: "Which number is the **driver version**?", a: ["570.211.01", "12.8", "81920", "0%"], hl: ["driver"], hint: "Find the words **Driver Version** at the top.", ok: "Driver **570.211.01**: the 570 block from our tower!" },
      { q: "What does **CUDA Version: 12.8** tell you?", a: ["The newest CUDA this driver can run", "The CUDA toolkit that is installed", "How hot the GPUs are", "How many GPUs there are"], hl: ["cuda"],
        hint: "It sits next to the driver version. It's about what the **driver** can do.", ok: "Yes! It's about the driver, not what is installed. This computer has no CUDA toolkit at all: pip brought the CUDA 12.4 runtime with PyTorch." }
    ];
    var wrong = 0;
    for (var qi = 0; qi < Q.length; qi++) {
      var q = Q[qi];
      qn.textContent = "Question " + (qi + 1) + " of " + Q.length + ": read the report!";
      qEl.innerHTML = RQ.ui.md(q.q) + "<small>Read it in the terminal, then pick an answer (keys 1–4).</small>";
      fb.textContent = ""; fb.className = "dt-fb";
      await new Promise(function (resolve) {
        var opts = u.shuffle(q.a, L.rng), locked = false, btns = [];
        ans.innerHTML = "";
        function answer(k) {
          if (locked || !L.alive) return;
          var b = btns[k];
          if (opts[k] === q.a[0]) {
            locked = true; b.classList.add("right"); RQ.audio.sfx("good"); hl(q.hl, true);
            var r = b.getBoundingClientRect(); RQ.ui.float(r.right - 40, r.top, "+1");
            fb.className = "dt-fb good"; fb.innerHTML = "✅ " + RQ.ui.md(q.ok);
            if (qi < 4) cards[qi].classList.add("on");
            else cards.forEach(function (c) { c.classList.add("on", "party"); });
            L.timeout(resolve, qi < 4 ? 2100 : 3200);
          } else {
            if (b.classList.contains("nope")) return;
            wrong++; b.classList.add("nope", "shake"); RQ.audio.sfx("error"); hl(q.hl, false);
            fb.className = "dt-fb bad"; fb.innerHTML = "💡 " + RQ.ui.md(q.hint) + " (look at the yellow part)";
          }
        }
        opts.forEach(function (o, k) {
          var b = u.el("button", { class: "btn", html: "<b>" + (k + 1) + "</b>" + RQ.ui.md(o) });
          L.on(b, "click", function () { answer(k); });
          btns.push(b); ans.appendChild(b);
        });
        L.on(window, "keydown", function (e) {
          if (locked || overlayOpen()) return;
          var n = parseInt(e.key, 10);
          if (n >= 1 && n <= opts.length) { e.preventDefault(); answer(n - 1); }
        });
      });
      if (!L.alive) return;
      hl([]);
    }
    L.win({ stars: wrong === 0 ? 3 : wrong <= 2 ? 2 : 1, msg: "You read a real GPU report: **4 × 80 GiB = 320 GiB**, driver **570.211.01**, CUDA up to **12.8**.", stats: { "Wrong answers": wrong } });
  }

  /* ------------------------------------------------------------ L4: wake the GPU from Python */
  function ps1(env) { return (env ? "(" + env + ") " : "") + '<span class="ps1">kid@basecamp</span>:<span class="ps1"><span class="path">~</span></span>$ '; }
  function chipBar(L, parent) {
    var bar = u.el("div", { class: "dt-chips" }), words = u.el("span", { style: { display: "contents" } }), state = { onWord: null, onRun: null };
    bar.appendChild(u.el("span", { text: "Word chips:" })); bar.appendChild(words);
    var run = u.el("button", { class: "btn go run", html: "▶ Run" });
    L.on(run, "click", function () { if (state.onRun) state.onRun(); });
    bar.appendChild(run); parent.appendChild(bar);
    return {
      set: function (list, onWord, onRun) {
        words.innerHTML = ""; state.onWord = onWord; state.onRun = onRun; run.disabled = false;
        list.forEach(function (w) {
          var b = u.el("button", { class: "btn small chip-w", text: w, dataset: { w: w } });
          L.on(b, "click", function () { if (state.onWord) state.onWord(w); });
          words.appendChild(b);
        });
      },
      glow: function (w) { u.$$(".chip-w", words).forEach(function (b) { b.classList.toggle("glow", b.dataset.w === w); }); },
      off: function () { state.onWord = state.onRun = null; run.disabled = true; u.$$(".chip-w", words).forEach(function (b) { b.disabled = true; }); }
    };
  }
  /** One prefilled line with ONE missing word. Resolves when the right word is entered. */
  function blankStep(L, t, bar, spec, onWrong) {
    return new Promise(function (resolve) {
      var cur = null, tries = 0;
      function ask() {
        t.printHTML((spec.prompt ? ps1("reseed") : "") + '<span class="dt-code">' + u.esc(spec.before) + '</span><input class="dt-blank" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="missing word"><span class="dt-code">' + u.esc(spec.after) + "</span>");
        var all = t.el.querySelectorAll("input.dt-blank"); cur = all[all.length - 1];
        cur.style.width = (Math.max(spec.answer.length, 5) + 1) + "ch";
        var me = cur; L.timeout(function () { if (me === cur) me.focus(); }, 40);
        L.on(cur, "keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); check(); }
          else if (e.key === "Tab") {
            e.preventDefault();
            var v = me.value.trim();
            if (v && spec.answer.indexOf(v) === 0) { me.value = spec.answer; RQ.audio.sfx("pop"); }
          }
        });
        L.on(cur, "input", function () { RQ.audio.sfx("type"); me.classList.remove("no"); });
      }
      function check() {
        if (!cur || !L.alive) return;
        var v = cur.value.trim();
        if (!v) { cur.classList.remove("no"); void cur.offsetWidth; cur.classList.add("no"); RQ.audio.sfx("error"); cur.focus(); return; }
        var ok = v === spec.answer;
        cur.replaceWith(u.el("span", { class: "dt-fill " + (ok ? "ok" : "no"), text: v })); cur = null;
        if (ok) { RQ.audio.sfx("beep"); bar.off(); resolve(); return; }
        tries++; onWrong(); RQ.audio.sfx("error");
        t.print(spec.error(v));
        if (tries >= 2 || L.fails >= 1) { bar.glow(spec.answer); t.print("[y]💡 Try the glowing chip.[/y]"); }
        ask();
      }
      bar.set(spec.chips, function (w) { if (cur) { cur.value = w; cur.classList.remove("no"); cur.focus(); RQ.audio.sfx("pop"); } }, check);
      L.on(t.el, "click", function () { if (cur) cur.focus(); });
      ask();
    });
  }
  function pyErr(line) { return "[dim]Traceback (most recent call last):[/dim]\n[dim]  File \"<string>\", line 1, in <module>[/dim]\n[r]" + line + "[/r]"; }
  function ident(v) { return /^[A-Za-z_]\w*$/.test(v); }
  async function wakeGPU(L) {
    var S = towerScene(L, { wide: true, w: 560 }), wrongs = 0;
    S.setTower([B.drv570, B.torch]); S.showMinis = true;
    var body = S.setPanel("🐍 Python spell", "Fill the **one missing word**: type it or click a chip, then press **Enter**.");
    var t = RQ.term.mount(body, { user: "kid", host: "basecamp", env: "reseed", height: "auto" });
    var bar = chipBar(L, body);
    t.print("[dim]# Our tower: driver 570 + PyTorch (with the CUDA 12.4 runtime). Is the GPU awake?[/dim]");
    function onWrong() { wrongs++; }
    await blankStep(L, t, bar, { prompt: true, before: "python -c \"import torch; print(torch.", after: ".is_available())\"", answer: "cuda",
      chips: ["gpu", "cuda", "nvidia", "a100"],
      error: function (v) { return ident(v) ? pyErr("AttributeError: module 'torch' has no attribute '" + v + "'") : pyErr("SyntaxError: invalid syntax"); } }, onWrong);
    if (!L.alive) return;
    await L.wait(350); if (!L.alive) return;
    t.print("[g]True[/g]");
    S.awake = true; RQ.audio.sfx("powerup"); S.sparkle(S.cx(), FLOOR - GPU_H / 2, 34); S.fireworks(5);
    S.signGood("True! PyTorch can see the GPU.");
    await L.wait(2400); if (!L.alive) return;
    await L.say("hoot", "**True!** PyTorch can see the GPU, so let's ask how many GPUs there are.", { mood: "wow" });
    if (!L.alive) return;
    await blankStep(L, t, bar, { prompt: true, before: "python -c \"import torch; print(torch.cuda.", after: "())\"", answer: "device_count",
      chips: ["how_many", "device_count", "gpus", "size"],
      error: function (v) { return ident(v) ? pyErr("AttributeError: module 'torch.cuda' has no attribute '" + v + "'") : pyErr("SyntaxError: invalid syntax"); } }, onWrong);
    if (!L.alive) return;
    await L.wait(300); if (!L.alive) return;
    t.print("[g]4[/g]");
    for (var i = 1; i <= 4; i++) { S.minisOn = i; RQ.audio.sfx("coin"); await L.wait(320); if (!L.alive) return; }
    S.signGood("4 GPUs: cuda:0, cuda:1, cuda:2 and cuda:3.");
    await L.wait(1500); if (!L.alive) return;
    await L.say("hoot", "Four GPUs, from **cuda:0** to **cuda:3**! Now fill in the backup plan in ReSeed's real training code.");
    if (!L.alive) return;
    t.print("");
    t.print("[dim]# reseed/classify/train.py, line 265: no GPU? Then use the ...[/dim]");
    await blankStep(L, t, bar, { prompt: false, before: "dev = torch.device(\"cuda\" if torch.cuda.is_available() else \"", after: "\")", answer: "cpu",
      chips: ["gpu", "cuda", "cpu", "nothing"],
      error: function (v) {
        if (v === "cuda") return "[y]Hmm: with no GPU that still asks for cuda, and training would crash. What else can do maths?[/y]";
        return pyErr("RuntimeError: Expected one of cpu, cuda, ... device type at start of device string: " + v);
      } }, onWrong);
    if (!L.alive) return;
    t.print("[g]✓ The GPU if there is one, else the CPU. Smart![/g]");
    t.print("[dim]# Training ForestNet on cuda:0 (sped-up example)[/dim]");
    await t.progress("Training ForestNet", 2600); if (!L.alive) return;
    t.print("[g]Done![/g] [dim]The real run takes about 12 minutes on one GPU (README).[/dim]");
    S.fireworks(8); S.sparkle(S.cx(), S.topY(1), 40); RQ.audio.sfx("win");
    S.signGood("ForestNet trained on the GPU!");
    await L.wait(3400); if (!L.alive) return;
    L.win({ stars: wrongs === 0 ? 3 : wrongs <= 2 ? 2 : 1, msg: "`torch.cuda.is_available()` said **True**. Four GPUs are ready, and ForestNet can train on them!", stats: { "Wrong words": wrongs } });
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g04",
    music: "lab",
    intro: [
      ["mo", "The GPU in our mission computer is fast asleep. Software wakes it up, one layer at a time."],
      ["pix", "We'll stack a tower of drivers and libraries. Wrong versions wobble and fall, so read the labels!"]
    ],
    outro: [
      ["mo", "The GPU is awake and PyTorch can see it. ForestNet can train now!"],
      ["hoot", "Next stop: the Potion Lab, where every project gets its own environment."]
    ],
    levels: [
      { title: "The easy route", goal: "Drop the driver, then type pip install torch",
        intro: [["mo", "Meet our GPU, an **NVIDIA A100**. First it needs a **driver**, the translator between the computer and the GPU."],
                ["mo", "Drop the driver block onto the GPU. Click it, drag it, or press **1**."]],
        cards: ["gpu-driver", "torch-wheel"],
        play: easyRoute },
      { title: "The expert route", goal: "Driver → CUDA toolkit → cuDNN → build",
        intro: [["mo", "Experts stack it by hand: **driver**, then **CUDA toolkit**, then **cuDNN**, then **build**."],
                ["mo", "Check the version tags. A block that doesn't fit will wobble and fall!"]],
        cards: ["cuda-toolkit", "cudnn"],
        play: expertRoute },
      { title: "Read the GPU report", goal: "Type nvidia-smi, then answer from the report",
        intro: [["pix", "Want to check on a GPU? Just type `nvidia-smi` to see its report card."],
                ["pix", "This is the real report from our project computer, where ReSeed was built. Read it to answer my questions."]],
        cards: ["nvidia-smi"],
        play: gauges },
      { title: "Wake the GPU", goal: "Fill the missing word so Python prints True",
        intro: [["hoot", "Let's ask Python if it can see the GPU. One word is missing from my spell."],
                ["hoot", "Fill the gap, then press **Enter**. If it prints `True`, the GPU is ours!"]],
        cards: ["torch-cuda-check"],
        play: wakeGPU }
    ]
  });
})();
