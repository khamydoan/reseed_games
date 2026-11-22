/* g01 Key Garden — US QWERTY touch typing. Every correct key plants a seed; the garden fills with flowers.
 * Levels 1-4: seeds wait for you (no time pressure). Level 5: seed rain, you pick the speed.
 * Stealth skills: home row, finger zones, top/bottom rows, Shift + symbols, WPM and accuracy. */
(function () {
  "use strict";
  var u = RQ.u;
  var W = 1280, H = 540, SOIL = 440;
  var PETALS = ["#ff8fab", "#ffd23f", "#b197fc", "#74c0fc", "#ff922b", "#f783ac", "#63e6be", "#ffffff"];

  /* ------------------------------------------------------------ level content */
  var LINES = {
    home: ["asdf jkl;", "fff jjj fj fj", "ddd kkk dk dk", "sss lll sl sl", "aaa ;;; a; a;", "sad lad", "ask dad", "a fall salad", "flask alfalfa"],
    top: ["tree", "root", "pot", "seed", "water", "fruit", "kite", "type", "power", "drop", "spider", "quiet"],
    bottom: ["bee", "moss", "vine", "acorn", "bloom", "zoom", "cave", "box", "mix", "calm", "bunny", "climb"],
    shift: ["Koa", "Tuki", "Sprout", "NDVI", "GPU", "Hi!", "x = 5", "0.6", "seeds = 42", "print(\"hi\")", "def grow():", "#tag"]
  };
  var RAIN = ["seed", "tree", "leaf", "rain", "root", "bee", "moss", "fern", "oak", "pine", "drone", "cloud", "pixel", "koala", "toucan",
    "def", "for", "in", "print", "import", "return", "True", "GPU", "NDVI", "forest", "acorn", "nest", "frog", "owl", "sun"];

  /* ------------------------------------------------------------ drawing helpers */
  function sky(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, 0, SOIL);
    g.addColorStop(0, "#9ed8ff"); g.addColorStop(1, "#e8f8ff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, SOIL);
    // sun with slowly turning rays
    ctx.save(); ctx.translate(1140, 80); ctx.rotate(t * .15);
    ctx.fillStyle = "rgba(255,214,77,.35)";
    for (var i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillRect(40, -5, 26, 10); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(1140, 80, 36, 0, 7); ctx.fillStyle = "#ffd84d"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#1d2b3a"; ctx.stroke();
    // clouds drift
    for (var c = 0; c < 4; c++) {
      var x = ((c * 360 + t * (12 + c * 4)) % (W + 300)) - 150, y = 60 + c * 34;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.arc(x + 30, y - 12, 32, 0, 7); ctx.arc(x + 64, y, 24, 0, 7); ctx.fill();
    }
    // hills (two layers)
    ctx.fillStyle = "#a9e28f"; ctx.beginPath(); ctx.moveTo(0, SOIL);
    for (var hx = 0; hx <= W; hx += 40) ctx.lineTo(hx, SOIL - 90 - Math.sin(hx / 190) * 40);
    ctx.lineTo(W, SOIL); ctx.fill();
    ctx.fillStyle = "#7fcf6b"; ctx.beginPath(); ctx.moveTo(0, SOIL);
    for (hx = 0; hx <= W; hx += 40) ctx.lineTo(hx, SOIL - 40 - Math.sin(hx / 120 + 2) * 22);
    ctx.lineTo(W, SOIL); ctx.fill();
    // fence
    ctx.strokeStyle = "#c8a165"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, SOIL - 46); ctx.lineTo(W, SOIL - 46); ctx.moveTo(0, SOIL - 24); ctx.lineTo(W, SOIL - 24); ctx.stroke();
    ctx.fillStyle = "#e0bb7f";
    for (var fx = 10; fx < W; fx += 70) { ctx.fillRect(fx, SOIL - 64, 14, 64); }
  }
  function soil(ctx) {
    ctx.fillStyle = "#8a5a35"; ctx.fillRect(0, SOIL, W, H - SOIL);
    ctx.fillStyle = "#6f4527";
    for (var i = 0; i < 4; i++) ctx.fillRect(0, SOIL + 18 + i * 22, W, 6);
    ctx.fillStyle = "#5fbf4a"; ctx.fillRect(0, SOIL - 6, W, 10);
  }
  /** A seed (acorn-like) with a label. state: 0 waiting, 1 active (glow). */
  function seed(ctx, x, y, label, active, wobble, done) {
    ctx.save(); ctx.translate(x + Math.sin(wobble * 40) * wobble * 10, y);
    if (active) { ctx.beginPath(); ctx.arc(0, -4, 40, 0, 7); ctx.fillStyle = "rgba(255,227,110,.55)"; ctx.fill(); }
    ctx.lineWidth = 3.5; ctx.strokeStyle = "#1d2b3a";
    ctx.beginPath(); ctx.ellipse(0, 6, 24, 27, 0, 0, 7); ctx.fillStyle = done ? "#c9e7b5" : "#e8b26a"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -16, 27, 13, 0, Math.PI, 0); ctx.lineTo(27, -16); ctx.closePath(); ctx.fillStyle = "#8a5a35"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -29); ctx.lineTo(3, -38); ctx.stroke();
    ctx.fillStyle = "#1d2b3a"; ctx.font = "700 " + (label.length > 1 ? 22 : 30) + "px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label === " " ? "␣" : label, 0, 8);
    ctx.restore();
  }
  /** A plant that grows: g 0..1 (stem then bloom). */
  function plant(ctx, p, t) {
    var g = u.clamp(p.g, 0, 1), h = p.h * u.ease.outCubic(Math.min(1, g * 1.4));
    var sway = Math.sin(t * 1.6 + p.x * .05) * 3 * g;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.strokeStyle = "#2f8a3e"; ctx.lineWidth = 5 * p.s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway * .5, -h / 2, sway, -h); ctx.stroke();
    if (g > .3) {
      var lf = Math.min(1, (g - .3) / .3) * 14 * p.s;
      ctx.fillStyle = "#4cbb5a";
      ctx.beginPath(); ctx.ellipse(-lf * .8, -h * .35, lf, lf * .45, -.6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(lf * .8, -h * .55, lf, lf * .45, .6, 0, 7); ctx.fill();
    }
    if (g > .6) {
      var b = u.ease.outBack(Math.min(1, (g - .6) / .4)) * 16 * p.s;
      ctx.translate(sway, -h); ctx.rotate(t * .3 * (p.x % 2 ? 1 : -1));
      ctx.fillStyle = p.c; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2.5;
      for (var i = 0; i < p.n; i++) { ctx.rotate(Math.PI * 2 / p.n); ctx.beginPath(); ctx.ellipse(b * .9, 0, b * .75, b * .42, 0, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, b * .48, 0, 7); ctx.fillStyle = "#ffcf33"; ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function bee(ctx, b, t) {
    ctx.save(); ctx.translate(b.x, b.y + Math.sin(t * 6 + b.ph) * 6); ctx.scale(b.dir, 1);
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2;
    var flap = Math.abs(Math.sin(t * 30 + b.ph)) * 8 + 3;
    ctx.beginPath(); ctx.ellipse(-2, -10, 7, flap, -.4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0, 0, 7); ctx.fillStyle = "#ffd23f"; ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#1d2b3a"; ctx.fillRect(-4, -8, 3.5, 16); ctx.fillRect(3, -8, 3.5, 16);
    ctx.beginPath(); ctx.arc(10, -2, 2, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------ shared typing scene */
  function scene(L, opts) {
    var root = u.el("div", { class: "fill", style: { display: "flex", flexDirection: "column" } });
    var top = u.el("div", { style: { position: "relative", flex: "1", minHeight: "0" } });
    var bottom = u.el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "8px 8px 12px", background: "var(--c-tint)", borderTop: "3px solid var(--ink)" } });
    var finger = u.el("div", { class: "row", style: { minHeight: "34px", justifyContent: "center", flexWrap: "wrap" } });
    root.appendChild(top); root.appendChild(bottom); L.stage.appendChild(root);
    bottom.appendChild(finger);
    var kb = RQ.keyboard.mount(bottom, { compact: window.innerHeight < 700 ? "tiny" : window.innerHeight < 860 });
    // hidden input so tablets show a keyboard
    var hidden = u.el("input", { "aria-label": "typing box", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
      style: { position: "absolute", opacity: "0", width: "1px", height: "1px", left: "0", bottom: "0" } });
    root.appendChild(hidden);
    L.on(top, "pointerdown", function () { hidden.focus(); });
    var cv = L.canvas({ w: 1280, h: H, parent: top, label: "garden", fill: true, onResize: function (api) { W = api.w; } });
    W = cv.w;
    var S = { L: L, cv: cv, ctx: cv.ctx, kb: kb, plants: [], bees: [], parts: [], keys: 0, good: 0, t0: 0, started: false, fingerEl: finger };
    S.showFinger = function (ch) {
      var info = kb.highlight(ch);
      finger.innerHTML = "";
      if (!info) return;
      var f = RQ.keyboard.FINGERS[info.finger], name = RQ.keyboard.FINGER_NAMES[info.finger];
      finger.appendChild(u.el("span", { class: "chip", style: { background: f }, html: "👉 Use your <b>" + name + "</b>" }));
      if (info.shift) finger.appendChild(u.el("span", { class: "chip", style: { background: RQ.keyboard.FINGERS[info.shiftId === "ShiftR" ? "rp" : "lp"] }, html: "+ hold <b>Shift</b> with the other pinky" }));
    };
    S.addPlant = function (x, y, s, h) {
      var p = { x: x, y: y, s: s || 1, h: h || u.rand(50, 90), g: 0, c: u.pick(PETALS), n: u.randi(5, 8) };
      S.plants.push(p); return p;
    };
    S.burst = function (x, y, color) {
      for (var i = 0; i < 14; i++) S.parts.push({ x: x, y: y, vx: u.rand(-160, 160), vy: u.rand(-260, -60), life: .8, c: color || u.pick(PETALS) });
    };
    S.maybeBee = function () {
      if (S.bees.length < 7 && Math.random() < .5) S.bees.push({ x: Math.random() < .5 ? -30 : W + 30, y: u.rand(150, 330), tx: u.rand(100, W - 100), ty: u.rand(220, 380), dir: 1, ph: Math.random() * 9 });
    };
    S.drawWorld = function (t, dt) {
      var ctx = S.ctx;
      sky(ctx, t); soil(ctx);
      S.plants.forEach(function (p) { if (p.g < 1) p.g = Math.min(1, p.g + dt * 1.6); plant(ctx, p, t); });
      S.bees.forEach(function (b) {
        if (Math.random() < .005) { b.tx = u.rand(80, W - 80); b.ty = u.rand(200, 380); }
        var dx = b.tx - b.x; b.dir = dx >= 0 ? 1 : -1; b.x += u.clamp(dx, -80, 80) * dt * 1.2; b.y += (b.ty - b.y) * dt * .8; bee(ctx, b, t);
      });
      S.parts = S.parts.filter(function (p) {
        p.life -= dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, p.life / .8); ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, 6, 3, p.x, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        return p.life > 0;
      });
    };
    S.stats = function () {
      var mins = Math.max((performance.now() - S.t0) / 60000, 1 / 60);
      return { acc: S.keys ? Math.round(100 * S.good / S.keys) : 100, wpm: Math.round(S.good / 5 / mins) };
    };
    S.hud = function () { var s = S.stats(); L.hud.set("acc", "🎯 " + s.acc + "%"); L.hud.set("wpm", "⚡ " + (S.started ? s.wpm : 0) + " WPM"); };
    /** Route typed characters (keyboard or tablet input) to fn(ch). */
    S.onChar = function (fn) {
      L.on(window, "keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.querySelector(".rq-overlay, .rq-talk")) return; // dialogs own the keyboard
        var k = e.key;
        if (k.length !== 1) return;
        e.preventDefault(); fn(k);
      });
      L.on(hidden, "input", function () { var v = hidden.value; hidden.value = ""; if (v) fn(v.slice(-1)); });
    };
    return S;
  }

  function finishTyping(S, msg, extra) {
    var s = S.stats(), st = RQ.save.load();
    if (s.wpm > (st.typing.best_wpm || 0) && s.acc >= 80) st.typing.best_wpm = s.wpm;
    if (s.acc > (st.typing.best_acc || 0)) st.typing.best_acc = s.acc;
    RQ.save.write();
    var stars = s.acc >= 95 ? 3 : s.acc >= 85 ? 2 : 1;
    var stats = { "Accuracy": s.acc + "%", "Speed": s.wpm + " WPM" };
    if (extra) for (var k in extra) stats[k] = extra[k];
    S.L.win({ stars: extra && extra.stars ? extra.stars : stars, msg: msg, stats: stats });
  }

  /* ------------------------------------------------------------ stationary mode (levels 1-4) */
  function stationary(lines, rounds, doneMsg) {
    return function (L) {
      var S = scene(L);
      var pool = u.shuffle(lines, L.rng).slice(0, rounds), lineIdx = 0, text = "", pos = 0, wob = 0, seeds = [], busy = false;
      function load() {
        text = pool[lineIdx]; pos = 0; seeds = []; busy = false;
        var n = text.length, gap = Math.min(86, (W - 200) / Math.max(n, 1)), x0 = W / 2 - gap * (n - 1) / 2;
        for (var i = 0; i < n; i++) seeds.push({ ch: text[i], x: x0 + i * gap, y: SOIL + 46, done: false, drop: 0 });
        S.showFinger(text[0]);
        L.hud.set("round", "🌱 " + (lineIdx + 1) + " / " + pool.length);
      }
      load(); S.hud();
      S.onChar(function (ch) {
        if (!L.alive || busy) return; // ignore keys while the next line slides in
        var want = text[pos];
        if (!S.started) { S.started = true; S.t0 = performance.now(); }
        S.keys++;
        if (ch === want) {
          S.good++; RQ.audio.sfx("key"); S.kb.flash(ch, true);
          var sd = seeds[pos]; sd.done = true;
          if (ch !== " ") { S.addPlant(sd.x, SOIL - 2, .9, u.rand(70, 110)); S.burst(sd.x, SOIL); }
          pos++;
          if (pos >= text.length) {
            busy = true; S.showFinger(null);
            RQ.audio.sfx("bloom"); S.maybeBee();
            // the finished line moves to the back row as small flowers
            seeds.forEach(function (q) { if (q.ch !== " ") S.addPlant(u.rand(40, W - 40), SOIL - u.rand(28, 52), .55, u.rand(30, 55)); });
            S.plants = S.plants.filter(function (p) { return p.s < .8; });
            lineIdx++;
            if (lineIdx >= pool.length) { S.showFinger(null); L.timeout(function () { finishTyping(S, doneMsg); }, 700); return; }
            L.timeout(load, 450);
          } else S.showFinger(text[pos]);
        } else {
          RQ.audio.sfx("error"); S.kb.flash(ch, false); wob = .35;
          if (L.fails >= 1 || S.keys - S.good >= 3) S.showFinger(want);
        }
        S.hud();
      });
      L.loop(function (dt, t) {
        S.drawWorld(t, dt);
        wob = Math.max(0, wob - dt);
        var ctx = S.ctx;
        seeds.forEach(function (sd, i) {
          if (sd.done) return;
          seed(ctx, sd.x, sd.y + (i === pos ? Math.sin(t * 6) * 3 : 0), sd.ch, i === pos, i === pos ? wob : 0);
        });
        if (seeds[pos]) { // arrow above the active seed
          var ax = seeds[pos].x, ay = SOIL - 18 + Math.sin(t * 5) * 5;
          ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - 12, ay - 16); ctx.lineTo(ax + 12, ay - 16); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      });
    };
  }

  /* ------------------------------------------------------------ seed rain (level 5) */
  function seedRain(L) {
    return RQ.ui.choose("koa", "How fast should the seeds fall? You can change it next time.", ["🐢 Slow", "🐇 Medium", "🚀 Fast"]).then(function (speedIdx) {
      if (!L.alive) return;
      var S = scene(L), speed = [38, 62, 92][speedIdx], DUR = 75;
      var words = [], planted = 0, missed = 0, target = null, tray = [], t = 0, nextSpawn = .5;
      S.started = true; S.t0 = performance.now();
      L.hud.set("time", "⏱ " + DUR);
      function spawn() {
        var w = u.pick(RAIN, L.rng);
        if (words.some(function (q) { return q.w === w; })) return;
        words.push({ w: w, x: u.rand(110, W - 110), y: -30, typed: 0, vy: speed * u.rand(.85, 1.15) });
      }
      S.onChar(function (ch) {
        if (!L.alive) return;
        S.keys++;
        if (!target) {
          // lock onto the lowest word that starts with this letter
          var cands = words.filter(function (q) { return q.w[0] === ch; }).sort(function (a, b) { return b.y - a.y; });
          target = cands[0] || null;
        }
        if (target && target.w[target.typed] === ch) {
          S.good++; target.typed++; RQ.audio.sfx("key"); S.kb.flash(ch, true);
          if (target.typed === target.w.length) {
            planted++; RQ.audio.sfx("bloom"); S.burst(target.x, target.y);
            S.addPlant(target.x, SOIL - 2, .8, u.rand(60, 100)); S.maybeBee();
            words.splice(words.indexOf(target), 1); target = null;
          }
        } else { RQ.audio.sfx("error"); S.kb.flash(ch, false); }
        S.showFinger(target ? target.w[target.typed] : null);
        S.hud();
      });
      L.loop(function (dt) {
        t += dt; nextSpawn -= dt;
        if (nextSpawn <= 0 && t < DUR - 3) { spawn(); nextSpawn = Math.max(1.1, 2.8 - t / 40) * (60 / speed) * .9; }
        S.drawWorld(t, dt);
        var ctx = S.ctx;
        words.slice().forEach(function (q) {
          q.y += q.vy * dt;
          if (q.y > SOIL - 10) { // missed: roll into the recovery tray
            missed++; tray.push(q.w); words.splice(words.indexOf(q), 1); if (target === q) { target = null; S.showFinger(null); }
            RQ.audio.sfx("drop"); return;
          }
          seed(ctx, q.x, q.y, "", q === target, 0);
          // word label: typed part green
          ctx.font = "700 26px Fredoka, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
          var full = ctx.measureText(q.w).width, x0 = q.x - full / 2 - 10, y0 = q.y - 58;
          ctx.fillStyle = q === target ? "#fff6c2" : "#fff"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3;
          u.rr(ctx, x0, y0 - 18, full + 20, 36, 12); ctx.fill(); ctx.stroke();
          var a = q.w.slice(0, q.typed), b = q.w.slice(q.typed);
          ctx.fillStyle = "#2f9e4f"; ctx.fillText(a, x0 + 10, y0 + 1);
          ctx.fillStyle = "#1d2b3a"; ctx.fillText(b, x0 + 10 + ctx.measureText(a).width, y0 + 1);
        });
        // recovery tray
        ctx.fillStyle = "#c8a165"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3;
        u.rr(ctx, W - 190, SOIL + 30, 170, 60, 14); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#1d2b3a"; ctx.font = "600 18px Fredoka, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Recovery tray: " + tray.length, W - 105, SOIL + 60);
        L.hud.set("time", "⏱ " + Math.max(0, Math.ceil(DUR - t)));
        L.hud.set("planted", "🌼 " + planted);
        if (t >= DUR) {
          var stars = planted >= [10, 14, 18][speedIdx] ? 3 : planted >= [6, 9, 12][speedIdx] ? 2 : 1;
          finishTyping(S, "You planted **" + planted + "** words" + (tray.length ? " and caught " + tray.length + " in the tray to plant later." : "!"), { "Planted": planted, stars: stars });
        }
      });
    });
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g01",
    music: "garden",
    intro: [
      ["sprout", "Hi, I'm Sprout! I'm a seed drone, and a forest far away needs our help."],
      ["sprout", "Typing helps us tell ReSeed what to do. So let's train your fingers first!"],
      ["pix", "I'm Pix. Every key you type right plants a seed in this garden. Ready?"]
    ],
    outro: [
      ["sprout", "Look at that garden! Your fingers know the whole keyboard now."],
      ["mo", "Perfect timing. Come to my workshop next: we need to build the mission computer!"]
    ],
    levels: [
      { title: "Home row", goal: "Type the letter on the glowing seed",
        intro: [["pix", "Rest your fingers on the **home row**: A S D F for the left hand, J K L ; for the right."],
                ["pix", "Feel the little bumps on **F** and **J**? Those are your home bases. Type the glowing seed. The big key at the bottom is Space."]],
        cards: ["qwerty", "home-row"],
        play: stationary(LINES.home, 5, "Your fingers found their home!") },
      { title: "Top row", goal: "Reach up for Q W E R T Y U I O P",
        intro: [["pix", "Now reach **up** to the top row, then come back home. Some keys need a little sideways reach too."]],
        cards: ["touch-typing"],
        play: stationary(LINES.top, 7, "Top row done. You can type real words now!") },
      { title: "Bottom row", goal: "Reach down for Z X C V B N M",
        intro: [["koa", "G'day! Bees love the bottom row. Reach **down** for Z X C V B N M, then back home."]],
        play: stationary(LINES.bottom, 7, "The bottom row is yours!") },
      { title: "Capitals & symbols", goal: "Hold Shift for capitals and symbols",
        intro: [["hoot", "Coders type capitals and symbols all day. Hold **Shift** with the pinky on the *other* hand."],
                ["hoot", "Watch the keyboard: it lights up Shift too. Try my favourite spell: `print(\"hi\")`."]],
        cards: ["shift-key"],
        play: stationary(LINES.shift, 6, "Capitals, numbers and symbols: unlocked!") },
      { title: "Seed rain", goal: "Type each falling word before it lands",
        intro: [["koa", "The wind is blowing seeds everywhere! Type a word to catch it and plant it."],
                ["koa", "Missed ones land in the recovery tray, so no seed is lost. Careful beats fast!"]],
        cards: ["wpm"],
        play: seedRain }
    ]
  });
})();
