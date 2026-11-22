/* g12 Model Garage — big AI language models and the GPUs that run them.
 * L1 Token Chopper: words become tokens (game-version tokenizer); count them.
 * L2 GPU Parking: memory = parameters × bytes + KV cache; park made-up models in GPU garages; a long chat overflows.
 * L3 Kitchen or Food Truck: vLLM (many users, server GPUs) vs llama.cpp (one GGUF file on a laptop).
 * L4 Out of Memory!: launch a pretend server in the terminal, crash with "CUDA out of memory", pick the fix.
 * The helper-1b/8b/70b models are made-up examples. ReSeed itself asks gpt-6-astra in Azure's cloud (reseed/llm.py). */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a", FONT = "Fredoka, sans-serif", MONO = "'JetBrains Mono', monospace";
  var BYTES = { 16: 2, 8: 1, 4: 0.5 };

  /* ============================================================ shared helpers */
  function frame(L, who) {
    var root = u.el("div", { class: "fill mg-root" });
    var top = u.el("div", { class: "mg-top" });
    var bar = u.el("div", { class: "mg-bar" });
    root.appendChild(top); root.appendChild(bar); L.stage.appendChild(root);
    var api = { root: root, top: top, bar: bar };
    api.set = function (btns) {
      bar.innerHTML = "";
      if (who && RQ.chars) bar.appendChild(u.el("div", { class: "mg-buddy ch-bob", html: RQ.chars.svg(who, { mood: "happy" }) }));
      btns.forEach(function (b) { bar.appendChild(b); });
    };
    return api;
  }
  function keyBtn(html, key, cls, fn) {
    return u.el("button", { class: "btn " + (cls || ""), html: '<span class="mg-key">' + key + "</span> " + html, onclick: fn });
  }
  /** Window keys for the level, ignored while a dialog is open or the kid is typing in a box. */
  function onKeys(L, fn) {
    L.on(window, "keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      var a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      fn(e);
    });
  }
  /** Tiny tween engine driven by the level loop: await T.to(obj, {x: 10}, 0.5, ease). */
  function tweens() {
    var list = [];
    return {
      to: function (obj, props, dur, ease) {
        list.forEach(function (tw) { if (tw.obj === obj) for (var k in props) delete tw.to[k]; });
        return new Promise(function (res) {
          var from = {}, to = {};
          for (var k in props) { from[k] = obj[k]; to[k] = props[k]; }
          list.push({ obj: obj, from: from, to: to, t: 0, d: Math.max(0.001, dur), e: ease || u.ease.inOut, res: res });
        });
      },
      step: function (dt) {
        list = list.filter(function (tw) {
          tw.t += dt;
          var k = Math.min(1, tw.t / tw.d), e = tw.e(k);
          for (var p in tw.to) tw.obj[p] = tw.from[p] + (tw.to[p] - tw.from[p]) * e;
          if (k >= 1) { tw.res(); return false; }
          return true;
        });
      }
    };
  }
  function parts() {
    var ps = [];
    return {
      burst: function (x, y, n, cols, sp) {
        sp = sp || 230;
        for (var i = 0; i < n; i++) ps.push({ x: x, y: y, vx: u.rand(-1, 1) * sp, vy: u.rand(-1.3, 0.1) * sp, life: u.rand(.5, .9), c: u.pick(cols), r: u.rand(3, 7) });
      },
      puff: function (x, y, c) { ps.push({ x: x, y: y, vx: u.rand(-50, -15), vy: u.rand(-40, -15), life: .8, c: c || "#ffffff", r: u.rand(5, 9), smoke: true }); },
      draw: function (ctx, dt) {
        ps = ps.filter(function (p) {
          p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.smoke) p.r += dt * 12; else p.vy += 520 * dt;
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)) * (p.smoke ? .6 : 1);
          ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
          return p.life > 0;
        });
      }
    };
  }
  function box(ctx, x, y, w, h, r, fill, stroke, lw) {
    u.rr(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function txt(ctx, s, x, y, size, color, align, weight, font) {
    ctx.font = (weight || 600) + " " + size + "px " + (font || FONT);
    ctx.fillStyle = color || INK; ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(s, x, y);
  }
  function neon(ctx, s, x, y, size, color, t) {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 12 + Math.sin(t * 3) * 4;
    txt(ctx, s, x, y, size, color, "center", 700);
    ctx.shadowBlur = 4; txt(ctx, s, x, y, size, "rgba(255,255,255,.85)", "center", 700);
    ctx.restore();
  }
  function eyes(ctx, x, y, gap, r, t, mood) {
    var blink = (t % 3.7) < 0.12;
    [-1, 1].forEach(function (s) {
      var ex = x + s * gap / 2;
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      if (mood === "x") {
        ctx.beginPath(); ctx.moveTo(ex - r, y - r); ctx.lineTo(ex + r, y + r); ctx.moveTo(ex + r, y - r); ctx.lineTo(ex - r, y + r); ctx.stroke(); return;
      }
      if (blink) { ctx.fillStyle = INK; ctx.fillRect(ex - r, y - 1.5, r * 2, 3); return; }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, y, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + r * .3, y + r * .05, r * .55, 0, 7); ctx.fill();
    });
  }
  /** A Glitch Bug: purple beetle with sparking antennae. */
  function drawBug(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 12) * 3); ctx.scale(s, s); ctx.rotate(Math.sin(t * 9) * .15);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = "round";
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(-14, i * 8); ctx.lineTo(-27, i * 11 + Math.sin(t * 20 + i) * 3);
      ctx.moveTo(14, i * 8); ctx.lineTo(27, i * 11 - Math.sin(t * 20 + i) * 3); ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(0, 4, 19, 22, 0, 0, 7); ctx.fillStyle = "#9b4dca"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 26); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -16, 12, 0, 7); ctx.fillStyle = "#5b2c83"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -26); ctx.lineTo(-13, -40); ctx.moveTo(5, -26); ctx.lineTo(13, -40); ctx.stroke();
    ctx.fillStyle = (t * 8 | 0) % 2 ? "#ffd43b" : "#ff6b6b";
    [-13, 13].forEach(function (ax) { ctx.beginPath(); ctx.arc(ax, -42, 5, 0, 7); ctx.fill(); });
    eyes(ctx, 0, -17, 11, 4.2, t);
    ctx.restore();
  }
  function gear(ctx, x, y, r, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.strokeStyle = "rgba(29,43,58,.35)"; ctx.lineWidth = 3;
    ctx.beginPath();
    for (var i = 0; i < 20; i++) { var ang = i / 20 * Math.PI * 2, rr = i % 2 ? r : r * 1.18; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * .35, 0, 7); ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function starsFor(pen, a, b) { return pen <= a ? 3 : pen <= b ? 2 : 1; }
  function gb(n) { return (Math.round(n * 10) / 10) + " GB"; }

  /* ============================================================ L1 Token Chopper */
  var TOK_COLS = ["#ffd43b", "#8ce99a", "#74c0fc", "#b197fc", "#ffa8a8", "#63e6be", "#ffc078", "#f783ac"];
  var SITE_WORD = { rondonia: ["R", "ond", "ônia"], dixie: ["Pl", "umas"], kalimantan: ["Ket", "ap", "ang"] };
  function tokenSentences() {
    var sw = SITE_WORD[RQ.mySiteId()] || SITE_WORD.rondonia;
    return [
      [["Is"], ["this"], ["picture"], ["a"], ["forest"], ["?"]],
      [["Forest", "Net"], ["looked"], ["at"], sw, ["from"], ["space"], ["."]],
      [["Ask"], ["gpt", "-", "6", "-", "astra"], ["for"], ["a"], ["second"], ["opinion"], ["!"]]
    ];
  }
  function tokenId(s) { return 1000 + u.fnv(s) % 48000; }

  function levelTokens(L) {
    var F = frame(L, "hoot"), H = 620, BELT = 350, CH = 64, FL = 404;
    var cv = L.canvas({ w: 1280, h: H, parent: F.top, fill: true, label: "token chopper" }), ctx = cv.ctx;
    var T = tweens(), P = parts();
    var S = tokenSentences(), si = 0, crates = [], chips = [], cur = 0, mistakes = 0, total = 0, busy = true;
    var press = { y: 0 }, beltOff = 0, bug = null, bigCount = null, shake = 0, hinted = false;
    var bWhole = keyBtn("🟩 Keep whole", "1", "go", function () { decide(false); });
    var bChop = keyBtn("🔪 Chop it!", "2", "danger", function () { decide(true); });
    F.set([bWhole, bChop]);
    function enable(on) { bWhole.disabled = bChop.disabled = !on; }
    enable(false);
    onKeys(L, function (e) {
      var k = e.key.toLowerCase();
      if (k === "1" || k === "w" || k === "arrowleft") decide(false);
      else if (k === "2" || k === "c" || k === "arrowright") decide(true);
    });

    function crateW(text) { ctx.font = "700 30px " + FONT; return Math.max(62, ctx.measureText(text).width + 40); }
    function chipW(s) { ctx.font = "700 24px " + FONT; return Math.max(44, ctx.measureText(s).width + 26); }
    function piecePos(c) {
      ctx.font = "700 28px " + FONT;
      var ws = c.pcs.map(function (p) { return Math.max(34, ctx.measureText(p).width + 22); });
      var gap = 4 + 26 * c.split, tot = ws.reduce(function (a, b) { return a + b; }, 0) + gap * (ws.length - 1), x = c.x - tot / 2;
      return ws.map(function (w) { var p = { x: x + w / 2, w: w }; x += w + gap; return p; });
    }
    function loadSentence() {
      crates = S[si].map(function (pcs) { var t = pcs.join(""); return { pcs: pcs, text: t, w: crateW(t), x: 0, tx: 0, split: 0, stamp: 0, gone: false }; });
      cur = 0; layoutCrates(true);
      L.hud.set("sent", "📜 Sentence " + (si + 1) + " / " + S.length);
    }
    function layoutCrates(fromLeft) {
      var x = cv.w / 2;
      for (var i = cur; i < crates.length; i++) {
        if (i > cur) x -= crates[i - 1].w / 2 + 22 + crates[i].w / 2;
        crates[i].tx = x;
        if (fromLeft) crates[i].x = x - cv.w * .75;
      }
    }
    function layoutChips() {
      var gap = 10, maxW = cv.w - 80, rows = [[]], rw = [0];
      chips.forEach(function (c) {
        var r = rows.length - 1;
        if (rw[r] + c.w > maxW && rows[r].length) { rows.push([]); rw.push(0); r++; }
        rows[r].push(c); rw[r] += c.w + gap;
      });
      rows.forEach(function (row, ri) {
        var x = cv.w / 2 - (rw[ri] - gap) / 2;
        row.forEach(function (c) { c.tx = x + c.w / 2; c.ty = 488 + ri * 64; x += c.w + gap; });
      });
    }
    function decide(chop) {
      if (busy || !crates[cur]) return;
      busy = true; enable(false);
      run(crates[cur], chop);
    }
    async function run(c, chop) {
      var need = c.pcs.length > 1, ok = need === chop, punct = /^[?.!]$/.test(c.text);
      total++;
      RQ.audio.sfx("whoosh");
      await T.to(press, { y: 1 }, .16, function (k) { return k * k; });
      if (!L.alive) return;
      shake = .25; RQ.audio.sfx(need ? "zap" : "snap");
      P.burst(cv.w / 2, BELT - CH, 16, need ? ["#ffffff", "#ffd43b", "#74c0fc"] : ["#8ce99a", "#ffffff"]);
      if (!ok) {
        mistakes++; RQ.audio.sfx("giggle");
        bug = { x: cv.w / 2 + 170, y: BELT - 150 };
        L.toast(need ? "**" + c.text + "** is long or made-up, so it gets chopped into **" + c.pcs.length + " tokens**."
          : punct ? "Punctuation like **" + c.text + "** is its own **1 token**." : "**" + c.text + "** is a short, common word: it stays **1 token**.", "bad", 2800);
      } else RQ.audio.sfx("coin");
      if (need) T.to(c, { split: 1 }, .4, u.ease.outBack); else T.to(c, { stamp: 1 }, .3, u.ease.outBack);
      await T.to(press, { y: 0 }, .3);
      await L.wait(ok ? 280 : 1500);
      if (!L.alive) return;
      bug = null;
      var pos = piecePos(c);
      c.pcs.forEach(function (p, i) {
        chips.push({ s: p, id: tokenId(p), w: chipW(p), x: pos[i].x, y: BELT - CH / 2, c: TOK_COLS[chips.length % TOK_COLS.length], n: 0, pop: .6 });
      });
      c.gone = true; layoutChips(); RQ.audio.sfx("pop");
      cur++;
      if (cur >= crates.length) { await L.wait(650); if (L.alive) countPhase(); return; }
      layoutCrates(false); RQ.audio.sfx("engine");
      if (mistakes >= 3 && !hinted) { hinted = true; await L.hint("Short words we use every day stay whole. Names and made-up words get chopped!", "hoot"); if (!L.alive) return; }
      await L.wait(420);
      if (!L.alive) return;
      busy = false; enable(true);
    }
    async function countPhase() {
      var n = chips.length, opts = u.shuffle([n, n - 1, n + 2], L.rng).map(String);
      total++;
      var pick = await L.choose("hoot", "How many tokens did this sentence make? Count the blocks!", opts, { top: true });
      if (!L.alive) return;
      var ok = +opts[pick] === n;
      if (!ok) { mistakes++; RQ.audio.sfx("bad"); }
      for (var i = 0; i < n; i++) {
        chips[i].n = i + 1; chips[i].pop = 1; RQ.audio.sfx("tick");
        await L.wait(ok ? 110 : 260);
        if (!L.alive) return;
      }
      bigCount = { n: n, t: 0 };
      RQ.audio.sfx(ok ? "good" : "error");
      L.toast(ok ? "Yes! **" + n + " tokens**." : "It was **" + n + " tokens**. Look at the numbers on the blocks!", ok ? "good" : "bad", 2200);
      await L.wait(1600);
      if (!L.alive) return;
      bigCount = null;
      chips.forEach(function (c, i) { c.tx = cv.w + 120 + i * 70; });
      RQ.audio.sfx("whoosh");
      await L.wait(700);
      if (!L.alive) return;
      chips = []; si++;
      if (si >= S.length) {
        L.win({ stars: starsFor(mistakes, 1, 4), msg: "Language models read **tokens**, not letters. Even ReSeed's question to its AI helper becomes tokens!",
          stats: { "Correct": (total - mistakes) + " / " + total } });
        return;
      }
      loadSentence(); RQ.audio.sfx("engine");
      await L.wait(800);
      if (!L.alive) return;
      busy = false; enable(true);
    }

    function drawRoom(W, t) {
      var g = ctx.createLinearGradient(0, 0, 0, FL); g.addColorStop(0, "#efe9fb"); g.addColorStop(1, "#d6cbf2");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, FL);
      ctx.strokeStyle = "rgba(124,92,196,.13)"; ctx.lineWidth = 2;
      for (var x = 40; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FL); ctx.stroke(); }
      ctx.fillStyle = "#b9a9e6"; ctx.fillRect(0, 236, W, 12); ctx.fillStyle = "#a493d8"; ctx.fillRect(0, 246, W, 4);
      gear(ctx, W - 96, 96, 46, t * .6, "#c3b2f0"); gear(ctx, W - 170, 160, 28, -t * 1, "#d4c7f6"); gear(ctx, W - 56, 196, 22, -t * 1.3, "#cdbff4");
      ctx.fillStyle = "#4b3d7a"; ctx.fillRect(0, FL, W, H - FL);
      ctx.fillStyle = "#56478a"; for (var fx = 0; fx < W; fx += 120) ctx.fillRect(fx, FL, 60, H - FL);
      // rule board
      box(ctx, 22, 22, 352, 150, 16, "#fffdf7", INK, 4);
      txt(ctx, "Chopper rules (game version)", 198, 46, 20, "#7c5cc4", "center", 700);
      txt(ctx, "🟩  short, common word → 1 token", 40, 82, 19, INK, "left", 600);
      txt(ctx, "🔪  long or made-up word → chop!", 40, 112, 19, INK, "left", 600);
      txt(ctx, "❓  . ? ! → 1 token each", 40, 142, 19, INK, "left", 600);
    }
    function drawBelt(W) {
      ctx.fillStyle = "#3b3f4a"; ctx.fillRect(0, BELT, W, 26);
      ctx.strokeStyle = "#5c6270"; ctx.lineWidth = 3;
      for (var x = -40 + (beltOff % 40); x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, BELT + 3); ctx.lineTo(x + 14, BELT + 23); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-4, BELT, W + 8, 26);
      for (var r = 30; r < W; r += 160) {
        ctx.fillStyle = "#7a8394"; ctx.fillRect(r, BELT + 26, 14, FL - BELT - 26);
        ctx.save(); ctx.translate(r + 7, BELT + 13); ctx.rotate(beltOff / 12);
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fillStyle = "#c9ced6"; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke(); ctx.restore();
      }
    }
    function drawCrate(c, active, t) {
      var y = BELT;
      if (c.split > .01) {
        piecePos(c).forEach(function (p, i) {
          var yy = y - CH - Math.sin(Math.min(1, c.split) * Math.PI) * 18 * (i % 2 ? 1 : -.4);
          box(ctx, p.x - p.w / 2, yy, p.w, CH, 10, TOK_COLS[i % TOK_COLS.length], INK, 3.5);
          txt(ctx, c.pcs[i], p.x, yy + CH / 2 + 1, 28, INK, "center", 700);
        });
        return;
      }
      var x = c.x - c.w / 2;
      if (active) { ctx.save(); ctx.shadowColor = "#ffd43b"; ctx.shadowBlur = 24 + Math.sin(t * 6) * 8; box(ctx, x, y - CH, c.w, CH, 10, "#fff3bf"); ctx.restore(); }
      box(ctx, x, y - CH, c.w, CH, 10, c.stamp > 0 ? "#c9f2d0" : "#f0c27a", INK, 3.5);
      ctx.strokeStyle = "rgba(29,43,58,.18)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 8, y - CH + 14); ctx.lineTo(x + c.w - 8, y - CH + 14); ctx.moveTo(x + 8, y - 14); ctx.lineTo(x + c.w - 8, y - 14); ctx.stroke();
      txt(ctx, c.text, c.x, y - CH / 2 + 1, 30, INK, "center", 700);
      if (c.stamp > 0) {
        ctx.save(); ctx.translate(c.x, y - CH - 22); ctx.rotate(-.08); ctx.scale(c.stamp, c.stamp);
        box(ctx, -46, -15, 92, 30, 8, "#2f9e4f", INK, 3); txt(ctx, "1 token", 0, 1, 17, "#fff", "center", 700); ctx.restore();
      }
    }
    function drawPillars(cx) {
      ctx.fillStyle = "#8f7fc9"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      [-150, 136].forEach(function (dx) { ctx.fillRect(cx + dx, 62, 14, BELT - 62); ctx.strokeRect(cx + dx, 62, 14, BELT - 62); });
    }
    function drawPress(cx, t) {
      var top = 22, hh = 116, upY = 220, downY = BELT - CH + 2, hb = upY + (downY - upY) * press.y, headH = 46;
      box(ctx, cx - 15, top + hh - 6, 30, hb - headH - top - hh + 10, 4, "#c9ced6", INK, 3);
      ctx.save(); u.rr(ctx, cx - 96, hb - headH, 192, headH, 8); ctx.clip();
      ctx.fillStyle = "#ffd43b"; ctx.fillRect(cx - 96, hb - headH, 192, headH);
      ctx.fillStyle = INK; for (var s = -120; s < 120; s += 28) { ctx.beginPath(); ctx.moveTo(cx + s, hb); ctx.lineTo(cx + s + 14, hb); ctx.lineTo(cx + s + 34, hb - headH); ctx.lineTo(cx + s + 20, hb - headH); ctx.fill(); }
      ctx.restore(); box(ctx, cx - 96, hb - headH, 192, headH, 8, null, INK, 3.5);
      ctx.fillStyle = "#e9ecef"; ctx.beginPath(); ctx.moveTo(cx - 6, hb); ctx.lineTo(cx, hb + 10); ctx.lineTo(cx + 6, hb); ctx.fill(); ctx.stroke();
      box(ctx, cx - 140, top, 280, hh, 20, "#7c5cc4", INK, 4);
      txt(ctx, "TOKEN CHOPPER", cx, top + 34, 26, "#fff", "center", 700);
      txt(ctx, "3000", cx, top + 62, 18, "#e5dbff", "center", 700);
      for (var i = 0; i < 6; i++) {
        var on = ((t * 4 | 0) + i) % 6 < 2 || !busy;
        ctx.beginPath(); ctx.arc(cx - 75 + i * 30, top + 92, 8, 0, 7); ctx.fillStyle = on ? TOK_COLS[i] : "#4b3d7a"; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      }
    }
    function drawChip(c) {
      var h = 44, s = 1 + c.pop * .3;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(s, s);
      box(ctx, -c.w / 2, -h / 2, c.w, h, 12, c.c, INK, 3);
      txt(ctx, c.s, 0, 1, 24, INK, "center", 700);
      txt(ctx, "#" + c.id, 0, h / 2 + 11, 12, "#e5dbff", "center", 600, MONO);
      if (c.n) {
        ctx.beginPath(); ctx.arc(c.w / 2 - 2, -h / 2 + 1, 13, 0, 7); ctx.fillStyle = "#d1495b"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        txt(ctx, String(c.n), c.w / 2 - 2, -h / 2 + 2, 15, "#fff", "center", 700);
      }
      ctx.restore();
    }

    loadSentence();
    L.timeout(function () { busy = false; enable(true); }, 900);
    L.loop(function (dt, t) {
      T.step(dt);
      var W = cv.w, moving = false;
      crates.forEach(function (c) { var d = c.tx - c.x; if (Math.abs(d) > 1) moving = true; c.x += d * Math.min(1, dt * 5); });
      if (moving) beltOff += dt * 160;
      chips.forEach(function (c) { c.x += (c.tx - c.x) * Math.min(1, dt * 7); c.y += (c.ty - c.y) * Math.min(1, dt * 7); c.pop = Math.max(0, c.pop - dt * 2.5); });
      shake = Math.max(0, shake - dt);
      ctx.save();
      if (shake) ctx.translate(u.rand(-4, 4) * shake * 4, u.rand(-3, 3) * shake * 4);
      drawRoom(W, t);
      drawBelt(W);
      drawPillars(W / 2);
      for (var i = crates.length - 1; i >= 0; i--) if (!crates[i].gone) drawCrate(crates[i], i === cur && !busy, t);
      drawPress(W / 2, t);
      txt(ctx, "Token train: the model really reads these numbers (token IDs)", W / 2, 436, 18, "#e5dbff", "center", 600);
      chips.forEach(drawChip);
      if (bigCount) {
        bigCount.t += dt;
        var sc = u.ease.outBack(Math.min(1, bigCount.t * 3));
        ctx.save(); ctx.translate(W - 150, 290); ctx.scale(sc, sc);
        box(ctx, -110, -40, 220, 80, 22, "#fff", INK, 4);
        txt(ctx, bigCount.n + " tokens", 0, 2, 38, "#7c5cc4", "center", 700); ctx.restore();
      }
      if (bug) drawBug(ctx, bug.x, bug.y, 1.3, t);
      P.draw(ctx, dt);
      ctx.restore();
    });
  }

  /* ============================================================ L2 GPU Parking */
  var GARAGES = [
    { name: "Laptop GPU", cap: 8, col: "#3fd4c8", w: 172, h: 200 },
    { name: "Gaming GPU", cap: 24, col: "#ff9f5a", w: 192, h: 226 },
    { name: "A100", cap: 80, col: "#c4a5ff", w: 214, h: 252 },
    { name: "4 × A100", cap: 320, col: "#ffd43b", w: 262, h: 280, sub: "project computer" }
  ];
  var TRUCKS = [
    { name: "Tiny", b: 1, bits: 16, kv: 1, col: "#8ce99a" },
    { name: "Mid", b: 8, bits: 16, kv: 2, col: "#74c0fc" },
    { name: "Mid", b: 8, bits: 4, kv: 2, col: "#74c0fc" },
    { name: "Giant", b: 70, bits: 16, kv: 5, col: "#ffa8a8" },
    { name: "Giant", b: 70, bits: 4, kv: 5, col: "#ffa8a8" },
    { name: "Mid", b: 8, bits: 8, kv: 2, col: "#74c0fc" }
  ];
  function bytesWord(bits) { return bits === 16 ? "2 bytes" : bits === 8 ? "1 byte" : "½ byte"; }
  function drawModelTruck(ctx, tr, t) {
    var cw = tr.cw;
    ctx.save(); ctx.translate(tr.x + (tr.shake ? Math.sin(t * 70) * 7 * tr.shake : 0), tr.y); ctx.scale(tr.s, tr.s); ctx.globalAlpha = tr.a;
    ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(0, 2, cw / 2 + 50, 8, 0, 0, 7); ctx.fill();
    var x0 = -cw / 2 - 36, cab = x0 + cw + 6;
    box(ctx, x0 - 6, -34, cw + 86, 16, 6, "#4a5b6d", INK, 3);
    box(ctx, x0, -36 - tr.ch, cw, tr.ch, 10, tr.col, INK, 4);
    // cargo split: weights (blue stripe) + KV cache (orange stripe) along the bottom
    var wf = tr.wgt / (tr.wgt + tr.kv);
    ctx.fillStyle = "#4dabf7"; ctx.fillRect(x0 + 6, -47, (cw - 12) * wf, 7);
    ctx.fillStyle = "#ffa94d"; ctx.fillRect(x0 + 6 + (cw - 12) * wf, -47, (cw - 12) * (1 - wf), 7);
    txt(ctx, tr.l1, x0 + cw / 2, -36 - tr.ch + 20, tr.cw > 100 ? 21 : 18, INK, "center", 700);
    txt(ctx, tr.l2, x0 + cw / 2, -36 - tr.ch + 41, 16, INK, "center", 600);
    if (tr.bits === 4) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 8, -36 - tr.ch / 2); ctx.lineTo(x0 + 4, -36 - tr.ch / 2); ctx.moveTo(x0 + cw + 8, -36 - tr.ch / 2); ctx.lineTo(x0 + cw - 4, -36 - tr.ch / 2); ctx.stroke(); }
    box(ctx, cab, -92, 70, 60, 14, "#fffdf7", INK, 4);
    box(ctx, cab + 18, -84, 44, 30, 8, "#bfe8ff", INK, 2.5);
    eyes(ctx, cab + 40, -69, 18, 5.5, t + tr.ph, tr.mood);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cab + 30, -92); ctx.lineTo(cab + 26 + Math.sin(t * 5) * 4, -112); ctx.stroke();
    ctx.beginPath(); ctx.arc(cab + 26 + Math.sin(t * 5) * 4, -115, 5, 0, 7); ctx.fillStyle = (t * 3 | 0) % 2 ? "#ff6b6b" : "#ffd43b"; ctx.fill(); ctx.stroke();
    [x0 + 26, cab + 40].concat(cw > 150 ? [x0 + cw - 30] : []).forEach(function (wx) {
      ctx.save(); ctx.translate(wx, -14); ctx.rotate(tr.x / 16);
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fillStyle = "#2b2f38"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fillStyle = "#c9ced6"; ctx.fill();
      ctx.fillStyle = "#c9ced6"; ctx.fillRect(-1.5, -14, 3, 8); ctx.restore();
    });
    ctx.restore();
  }

  function levelParking(L) {
    var F = frame(L, "hoot"), H = 620, GY = 426, TRUCK_Y = 596, WAIT_X = 168;
    var cv = L.canvas({ w: 1280, h: H, parent: F.top, fill: true, label: "GPU garages" }), ctx = cv.ctx;
    var T = tweens(), P = parts();
    var gar = GARAGES.map(function (g) { return Object.assign({ door: 0, gw: 0, gk: 0, alarm: 0, parked: null, glow: 0 }, g); });
    var tr = null, revealed = true, mistakes = 0, roomy = 0, firstTry = 0, pickRes = null, chat = null, fixRes = null;
    var starsBg = []; for (var i = 0; i < 70; i++) starsBg.push({ x: Math.random(), y: Math.random() * .5, p: Math.random() * 6 });
    var gBtns = gar.map(function (g, i) {
      return keyBtn(g.cap + " GB · " + g.name, String(i + 1), "", function () { pick(i); });
    });
    var fixBtns = [keyBtn("✂️ Remember less text (trim the chat)", "1", "", function () { fix(0); }), keyBtn("🗜️ Switch to 8-bit", "2", "", function () { fix(1); })];
    F.set(gBtns);
    function setPick(on) { gBtns.forEach(function (b) { b.disabled = !on; }); }
    setPick(false);
    function pickGarage() { return new Promise(function (r) { pickRes = r; setPick(true); }); }
    function pick(i) { if (!pickRes) return; var r = pickRes; pickRes = null; setPick(false); RQ.audio.sfx("select"); r(i); }
    function fix(i) { if (!fixRes) return; var r = fixRes; fixRes = null; fixBtns.forEach(function (b) { b.disabled = true; }); RQ.audio.sfx("select"); r(i); }
    onKeys(L, function (e) {
      var n = parseInt(e.key, 10);
      if (fixRes && (n === 1 || n === 2)) fix(n - 1);
      else if (n >= 1 && n <= 4) pick(n - 1);
    });
    L.on(cv.cv, "pointerdown", function (e) {
      if (!pickRes) return;
      var p = cv.toLocal(e);
      gar.forEach(function (g, i) { if (p.x >= g.x && p.x <= g.x + g.w && p.y >= GY - g.h - 70 && p.y <= GY + 44) pick(i); });
    });
    function layout() {
      var x0 = 330, avail = cv.w - x0 - 22, tw = 0;
      gar.forEach(function (g) { tw += g.w; });
      var gap = Math.max(14, (avail - tw) / 3), x = x0;
      gar.forEach(function (g) { g.x = x; x += g.w + gap; });
    }
    function newTruck(sp) {
      var wgt = sp.b * BYTES[sp.bits];
      return { sp: sp, wgt: wgt, kv: sp.kv, need: wgt + sp.kv, bits: sp.bits, col: sp.col, l1: sp.name + " " + sp.b + "B", l2: sp.bits + "-bit",
        cw: u.clamp(66 + 13 * Math.sqrt(wgt), 82, 230), ch: sp.bits === 4 ? 60 : 72, x: -260, y: TRUCK_Y, s: 1, a: 1, shake: 0, mood: null, ph: Math.random() * 5 };
    }
    async function drive(x, d) {
      RQ.audio.sfx("engine");
      tr.driving = true; await T.to(tr, { x: x }, d || (.35 + Math.abs(x - tr.x) / 850), u.ease.inOut); tr.driving = false;
    }
    async function parkInto(g) {
      RQ.audio.sfx("whoosh"); await T.to(g, { door: 1 }, .35);
      if (!L.alive) return;
      await T.to(tr, { y: GY - 4, s: .5, a: 0 }, .6, u.ease.inOut);
      if (!L.alive) return;
      g.parked = tr; RQ.audio.sfx("powerup"); T.to(g, { door: 0 }, .45);
      await T.to(g, { gw: tr.wgt, gk: tr.kv }, .7);
    }
    function emptyGarages() { gar.forEach(function (g) { g.parked = null; g.alarm = 0; T.to(g, { gw: 0, gk: 0 }, .5); }); }

    async function round(i) {
      emptyGarages();
      tr = newTruck(TRUCKS[i]); revealed = i === 0 || L.fails > 0;
      L.hud.set("round", "🚚 " + (i + 1) + " / " + (TRUCKS.length + 1));
      await drive(WAIT_X, 1.1);
      if (!L.alive) return;
      var best = 0; while (gar[best].cap < tr.need) best++;
      var tries = 0;
      for (;;) {
        var gi = await pickGarage();
        if (!L.alive) return;
        var g = gar[gi];
        await drive(g.x + g.w / 2);
        if (!L.alive) return;
        if (tr.need > g.cap) {
          tries++; mistakes++; revealed = true;
          RQ.audio.sfx("whoosh"); await T.to(g, { door: 1 }, .3);
          await T.to(tr, { y: TRUCK_Y - 22 }, .18);
          if (!L.alive) return;
          g.gw = 0; g.gk = 0; T.to(g, { gw: tr.wgt, gk: tr.kv }, .35);
          g.alarm = 2.4; tr.mood = "x"; tr.shake = 1; RQ.audio.sfx("error"); RQ.audio.sfx("buzz");
          P.burst(g.x + g.w / 2, GY - 40, 20, ["#ff6b6b", "#ffd43b", "#ffffff"]);
          L.toast("💥 **CUDA out of memory!** " + gb(tr.need) + " does not fit in " + g.cap + " GB.", "bad", 2600);
          await L.wait(1500);
          if (!L.alive) return;
          tr.shake = 0; tr.mood = null; T.to(g, { gw: 0, gk: 0, door: 0 }, .4);
          await T.to(tr, { y: TRUCK_Y }, .25);
          await drive(WAIT_X);
          if (!L.alive) return;
          if (tries === 2) { await L.hint("Multiply first: billions of settings × bytes for each one. Then add the KV cache, and find a garage with room.", "hoot"); if (!L.alive) return; }
          continue;
        }
        await parkInto(g);
        if (!L.alive) return;
        revealed = true;
        if (gi === best) {
          if (!tries) firstTry++;
          RQ.audio.sfx("coin"); P.burst(g.x + g.w / 2, GY - g.h, 24, ["#ffd43b", "#8ce99a", g.col, "#fff"]);
          L.toast("✅ Parked! " + gb(tr.wgt) + " + " + gb(tr.kv) + " = " + gb(tr.need) + " fits in " + g.cap + " GB.", "good", 2400);
        } else {
          roomy++; RQ.audio.sfx("good");
          L.toast("It fits! But the **" + gar[best].name + "** (" + gar[best].cap + " GB) had room. Save big garages for giants!", "info", 3200);
        }
        break;
      }
      await L.wait(1500);
    }

    async function longChat() {
      emptyGarages(); tr = null;
      L.hud.set("round", "💬 " + (TRUCKS.length + 1) + " / " + (TRUCKS.length + 1));
      await L.say("hoot", "Last job: a long chat! Watch the **KV cache** grow as the chat gets longer.", { top: true });
      if (!L.alive) return;
      var g = gar[1];
      tr = newTruck({ name: "Mid", b: 8, bits: 16, kv: 2, col: "#74c0fc" }); revealed = true;
      await drive(g.x + g.w / 2, 1.6);
      if (!L.alive) return;
      await parkInto(g);
      if (!L.alive) return;
      chat = { g: g, on: true, tokens: 0, max: Infinity, crashed: false, bub: [], next: 0 };
      F.set(fixBtns); fixBtns.forEach(function (b) { b.disabled = false; });
      L.toast("💬 Chatting… Fix it before the garage overflows!", "info", 2600);
      var f = await new Promise(function (r) { fixRes = r; });
      if (!L.alive) return;
      g.alarm = 0; g.warn = false;
      if (f === 0) { chat.max = 8000; chat.tokens = Math.min(chat.tokens, 8000); L.toast("✂️ Less to remember: the model keeps notes on only the newest **8,000 tokens**.", "good", 3000); }
      else { T.to(g, { gw: 8 }, .6); L.toast("🗜️ 8-bit: 8 billion × 1 byte = **8 GB** of weights. Lots of room for notes!", "good", 3000); }
      RQ.audio.sfx("powerup"); P.burst(g.x + g.w / 2, GY - g.h, 26, ["#8ce99a", "#ffd43b", "#fff"]);
      chat.on = true;
      await L.wait(3400);
      if (!L.alive) return;
      var pen = mistakes + roomy * .5 + (chat.crashed ? 1 : 0);
      L.win({ stars: starsFor(pen, .5, 2.5), msg: "Memory = **weights + KV cache**. 4-bit makes weights about 4 × smaller, but always test that the answers stay good!",
        stats: { "Parked first try": firstTry + " / " + TRUCKS.length, "Chat crashed": chat.crashed ? "yes" : "no" } });
    }

    function drawSky(W, t) {
      var g = ctx.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, "#17123a"); g.addColorStop(1, "#45307a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY + 2);
      starsBg.forEach(function (s) { ctx.globalAlpha = .35 + .35 * Math.sin(t * 2 + s.p); ctx.fillStyle = "#fff"; ctx.fillRect(s.x * W, s.y * GY, 2.5, 2.5); });
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(700, 46, 26, 0, 7); ctx.fillStyle = "#fff6c9"; ctx.fill();
      ctx.beginPath(); ctx.arc(712, 38, 22, 0, 7); ctx.fillStyle = "#1b1540"; ctx.fill();
      ctx.fillStyle = "#2a2156";
      for (var x = 0, k = 0; x < W; x += 70, k++) { var bh = 60 + (k * 37 % 90); ctx.fillRect(x, GY - bh, 62, bh); }
      ctx.fillStyle = "rgba(255,214,102,.5)";
      for (x = 0, k = 0; x < W; x += 70, k++) for (var wy = GY - 50; wy > GY - 40 - (k * 37 % 90); wy -= 22) if ((k + wy) % 3) ctx.fillRect(x + 10 + (wy % 2) * 24, wy, 10, 10);
      ctx.fillStyle = "#3a3f4b"; ctx.fillRect(0, GY, W, H - GY);
      ctx.fillStyle = "#4b5160"; ctx.fillRect(0, GY, W, 50);
      ctx.strokeStyle = "#ffd43b"; ctx.lineWidth = 4; ctx.setLineDash([30, 22]);
      ctx.beginPath(); ctx.moveTo(0, GY + 112); ctx.lineTo(W, GY + 112); ctx.stroke(); ctx.setLineDash([]);
    }
    function drawGarage(g, i, t) {
      var x = g.x, w = g.w, h = g.h, top = GY - h, pulse = .5 + .5 * Math.sin(t * 2 + i);
      ctx.save(); ctx.shadowColor = g.alarm > 0 ? "#ff4d4d" : g.col; ctx.shadowBlur = 18 + 14 * pulse;
      box(ctx, x, top, w, h, 10, "#342c5e", g.alarm > 0 ? "#ff6b6b" : g.col, 4); ctx.restore();
      box(ctx, x, top, w, h, 10, null, INK, 2);
      box(ctx, x - 10, top - 16, w + 20, 20, 6, "#231d45", INK, 3);
      box(ctx, x + 8, top - 64, w - 16, 42, 10, "#120e29", g.col, 3);
      neon(ctx, g.name + " · " + g.cap + " GB", x + w / 2, top - 43, w > 200 ? 19 : 17, g.col, t + i);
      if (g.sub) { box(ctx, x + w / 2 - 70, top + 10, 140, 24, 8, "#ffd43b", INK, 2.5); txt(ctx, g.sub, x + w / 2, top + 22, 14, INK, "center", 700); }
      ctx.beginPath(); ctx.arc(x + 22, top + 24, 15, 0, 7); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      txt(ctx, String(i + 1), x + 22, top + 25, 17, INK, "center", 700);
      var dw = w * .72, dx = x + (w - dw) / 2, dh = h * .6, dy = GY - dh;
      box(ctx, dx - 6, dy - 6, dw + 12, dh + 6, 6, "#1b1733", INK, 3);
      var ig = ctx.createLinearGradient(0, dy, 0, GY); ig.addColorStop(0, "#1b1733"); ig.addColorStop(1, g.col);
      ctx.globalAlpha = .55; ctx.fillStyle = ig; ctx.fillRect(dx, dy, dw, dh); ctx.globalAlpha = 1;
      if (g.parked) { box(ctx, dx + dw * .18, GY - 52, dw * .64, 46, 8, g.parked.col, INK, 3); txt(ctx, g.parked.l1, dx + dw / 2, GY - 36, 15, INK, "center", 700); txt(ctx, g.parked.l2, dx + dw / 2, GY - 18, 13, INK, "center", 600); }
      var sh = dh * (1 - g.door);
      if (sh > 1) {
        ctx.fillStyle = "#cfd6de"; ctx.fillRect(dx, dy, dw, sh);
        ctx.strokeStyle = "#9aa6b2"; ctx.lineWidth = 2;
        for (var ly = dy + 10; ly < dy + sh; ly += 11) { ctx.beginPath(); ctx.moveTo(dx, ly); ctx.lineTo(dx + dw, ly); ctx.stroke(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(dx, dy, dw, sh);
        box(ctx, dx + dw / 2 - 16, dy + sh - 12, 32, 7, 3, "#6c7a89");
        if (g.parked && sh > dh * .8) { ctx.save(); ctx.translate(dx + dw / 2, dy + sh * .45); ctx.rotate(-.06); box(ctx, -42, -14, 84, 28, 8, "#2f9e4f", INK, 2.5); txt(ctx, "PARKED ✓", 0, 1, 14, "#fff", "center", 700); ctx.restore(); }
      }
      if (g.warn && !(g.alarm > 0)) {
        var on = (t * 5 | 0) % 2;
        ctx.beginPath(); ctx.arc(x + w / 2, top - 74, 11, Math.PI, 0); ctx.fillStyle = on ? "#ffd43b" : "#8a6d00"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        box(ctx, x + w / 2 - 70, top + 50, 140, 34, 10, on ? "#ffd43b" : "#fff3bf", INK, 3);
        txt(ctx, "Almost full!", x + w / 2, top + 68, 16, INK, "center", 700);
      }
      if (g.alarm > 0) {
        var sx = x + w / 2, sy = top - 74;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 8); ctx.fillStyle = "rgba(255,80,80,.35)";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 120, -.3, .3); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 120, Math.PI - .3, Math.PI + .3); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.arc(sx, sy, 11, Math.PI, 0); ctx.fillStyle = (t * 6 | 0) % 2 ? "#ff3b3b" : "#ff9f9f"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        box(ctx, x + w / 2 - 86, top + 46, 172, 50, 12, "#d1495b", INK, 3);
        txt(ctx, "CUDA out of", x + w / 2, top + 61, 16, "#fff", "center", 700);
        txt(ctx, "memory!", x + w / 2, top + 81, 16, "#fff", "center", 700);
      }
      // VRAM gauge
      var gx = x, gyy = GY + 10, gw = w, gh = 28, tot = g.gw + g.gk;
      box(ctx, gx, gyy, gw, gh, 8, "#120e29", INK, 3);
      ctx.save(); u.rr(ctx, gx + 2, gyy + 2, gw - 4, gh - 4, 6); ctx.clip();
      var wpx = Math.min(1, g.gw / g.cap) * (gw - 4), kpx = Math.min(1 - Math.min(1, g.gw / g.cap), g.gk / g.cap) * (gw - 4);
      ctx.fillStyle = "#4dabf7"; ctx.fillRect(gx + 2, gyy + 2, wpx, gh - 4);
      ctx.fillStyle = "#ffa94d"; ctx.fillRect(gx + 2 + wpx, gyy + 2, kpx, gh - 4);
      ctx.restore();
      var label = (tot > 0 ? gb(Math.min(tot, 999)) + " / " : "") + g.cap + " GB";
      ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = "rgba(18,14,41,.85)"; ctx.font = "700 15px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeText(label, gx + gw / 2, gyy + gh / 2 + 1); ctx.restore();
      txt(ctx, label, gx + gw / 2, gyy + gh / 2 + 1, 15, "#fff", "center", 700);
    }
    /** Overflow tongues go in a second pass so the next garage never hides them. */
    function drawOverflow(g, t) {
      var tot = g.gw + g.gk;
      if (tot < g.cap + .5) return;
      var fl = (t * 6 | 0) % 2, gx = g.x + g.w - 6, gyy = GY + 5;
      box(ctx, gx, gyy, 52, 38, 8, fl ? "#ff3b3b" : "#ffd43b", INK, 3);
      txt(ctx, "+" + Math.max(1, Math.round(tot - g.cap)), gx + 26, gyy + 20, 16, INK, "center", 700);
    }
    function drawTicket() {
      if (!tr) return;
      var sp = tr.sp, x = 18, y = 16, w = 296;
      box(ctx, x, y, w, 276, 16, "#fffdf7", INK, 4);
      txt(ctx, "🎫 Parking ticket", x + w / 2, y + 24, 20, "#7c5cc4", "center", 700);
      txt(ctx, sp.name + " " + sp.b + "B · " + sp.bits + "-bit", x + w / 2, y + 56, 22, INK, "center", 700);
      txt(ctx, sp.b + " billion settings (parameters)", x + 18, y + 90, 18, INK, "left", 600);
      txt(ctx, "× " + bytesWord(sp.bits) + " each (" + sp.bits + "-bit)", x + 18, y + 116, 18, INK, "left", 600);
      txt(ctx, "= " + (revealed ? gb(tr.wgt) : "? GB") + " weights", x + 18, y + 144, 19, "#1c7ed6", "left", 700);
      txt(ctx, "+ " + gb(tr.kv) + " KV cache", x + 18, y + 170, 19, "#e8590c", "left", 700);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 18, y + 186); ctx.lineTo(x + w - 18, y + 186); ctx.stroke();
      txt(ctx, "= " + (revealed ? gb(tr.need) : "? GB") + " in total", x + 18, y + 206, 21, INK, "left", 700);
      txt(ctx, "16 bits = 2 bytes · 8 bits = 1 byte", x + w / 2, y + 234, 14, "#4a5b6d", "center", 600);
      txt(ctx, "4 bits = ½ byte", x + w / 2, y + 254, 14, "#4a5b6d", "center", 600);
      txt(ctx, "(game version: made-up models, GPU only)", x + w / 2, y + 296, 14, "#d0c4ff", "center", 600);
    }
    function drawChat(dt, t) {
      if (!chat) return;
      var g = chat.g;
      if (chat.on) {
        chat.tokens = Math.min(chat.max, chat.tokens + 6000 * dt);
        var kv = 2 + chat.tokens / 8000;
        g.gk = kv;
        if (g.gw + kv >= g.cap && !chat.crashed) {
          chat.on = false; chat.crashed = true; g.alarm = 99; g.warn = false; g.gk = g.cap - g.gw + 1;
          RQ.audio.sfx("error"); RQ.audio.sfx("buzz"); P.burst(g.x + g.w / 2, GY - 60, 26, ["#ff6b6b", "#ffd43b"]);
          L.toast("💥 **CUDA out of memory!** The chat notes filled the garage. Pick a fix!", "bad", 3000);
        } else g.warn = !chat.crashed && !!fixRes && g.gw + kv > g.cap * .82;
        chat.next -= dt;
        if (chat.next <= 0) { chat.next = .45; chat.bub.push({ x: g.x + u.rand(20, g.w - 20), y: GY - g.h - 70, a: 1 }); RQ.audio.sfx("tick"); }
      }
      chat.bub = chat.bub.filter(function (b) {
        b.y -= 40 * dt; b.a -= dt * .5;
        ctx.globalAlpha = Math.max(0, b.a); box(ctx, b.x - 22, b.y - 14, 44, 28, 10, "#fff", INK, 2.5);
        txt(ctx, "•••", b.x, b.y, 16, INK); ctx.globalAlpha = 1;
        return b.a > 0;
      });
      var lbl = "💬 chat: " + u.fmt(Math.round(chat.tokens / 100) * 100) + " tokens";
      box(ctx, g.x + g.w / 2 - 110, GY + 46, 220, 32, 10, "#fffdf7", INK, 3);
      txt(ctx, lbl, g.x + g.w / 2, GY + 63, 16, INK, "center", 700);
    }

    layout();
    L.loop(function (dt, t) {
      T.step(dt);
      layout();
      var W = cv.w;
      drawSky(W, t);
      gar.forEach(function (g, i) { g.alarm = Math.max(0, g.alarm - dt); drawGarage(g, i, t); });
      gar.forEach(function (g) { drawOverflow(g, t); });
      drawChat(dt, t);
      drawTicket();
      if (tr && tr.a > .01) {
        if (tr.driving && Math.random() < .5) P.puff(tr.x - tr.cw / 2 - 40 * tr.s, tr.y - 20 * tr.s);
        drawModelTruck(ctx, tr, t);
      }
      P.draw(ctx, dt);
    });
    (async function () {
      await L.wait(500);
      for (var r = 0; r < TRUCKS.length; r++) { await round(r); if (!L.alive) return; }
      await longChat();
    })();
  }

  /* ============================================================ L3 Kitchen or Food Truck */
  var JOBS = [
    { icon: "🏫", text: "300 students ask the school's forest helper questions, all at the same time.", ans: 0, crowd: 14,
      why: "Hundreds of users at once need the big **vLLM** kitchen on server GPUs." },
    { icon: "🏕️", text: "Field trip in the rainforest: no internet, just one laptop.", ans: 1,
      why: "No internet and one laptop: the **llama.cpp** food truck runs right there." },
    { icon: "💻", text: "Run a small 4-bit **GGUF** file on a laptop's CPU.", ans: 1,
      why: "GGUF files are made for **llama.cpp**. It even runs on a plain CPU!" },
    { icon: "🛰️", text: "A cloud server with four A100 GPUs must answer thousands of app users.", ans: 0, crowd: 14,
      why: "Big server GPUs and thousands of users: **vLLM** batches them together." },
    { icon: "🌙", text: "Overnight: write captions for 5,000 drone photos on the big GPU server, as fast as possible.", ans: 0, crowd: 10,
      why: "Thousands of jobs at once: the **vLLM** kitchen cooks them in big batches." },
    { icon: "🔒", text: "Use a pretend diary for an offline chat on your own laptop. No cloud AI needed.", ans: 1,
      why: "Offline on your own laptop: the **llama.cpp** food truck. Still, never type secrets or private info into any AI!" },
    { icon: "🎪", text: "Science fair booth: 40 visitors chat with the helper at the same time.", ans: 0, crowd: 12,
      why: "40 people at once is a crowd: the **vLLM** kitchen serves them together." },
    { icon: "🔋", text: "An old small PC with no big GPU, and just one user.", ans: 1,
      why: "No big GPU? **llama.cpp** runs quantized models on ordinary computers." }
  ];
  var SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"], SHIRT = ["#ff8fab", "#74c0fc", "#8ce99a", "#ffd43b", "#b197fc", "#ffa94d", "#63e6be"];
  function person(x, y, s) { return { x: x, y: y, s: s || 1, col: u.pick(SHIRT), skin: u.pick(SKIN), ph: Math.random() * 6, moving: false, plate: false, q: false, ticket: false }; }
  function drawPerson(ctx, p, t) {
    var bob = p.moving ? Math.abs(Math.sin(t * 11 + p.ph)) * 5 : Math.sin(t * 2 + p.ph) * 1.2, lg = p.moving ? Math.sin(t * 12 + p.ph) * 7 : 0;
    ctx.save(); ctx.translate(p.x, p.y - bob); ctx.scale(p.s, p.s);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(-6 - lg, 0); ctx.moveTo(6, -18); ctx.lineTo(6 + lg, 0); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -34, 16, 20, 0, 0, 7); ctx.fillStyle = p.col; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -66, 15, 0, 7); ctx.fillStyle = p.skin; ctx.fill(); ctx.stroke();
    eyes(ctx, 0, -68, 12, 3.6, t + p.ph);
    ctx.beginPath(); ctx.arc(0, -61, 5, .2, Math.PI - .2); ctx.lineWidth = 2; ctx.stroke();
    if (p.plate) {
      ctx.beginPath(); ctx.ellipse(20, -40, 16, 6, 0, 0, 7); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(20, -46, 8, Math.PI, 0); ctx.fillStyle = "#ff922b"; ctx.fill(); ctx.stroke();
    } else if (p.ticket) { box(ctx, 12, -56, 20, 26, 3, "#fff", INK, 2); ctx.fillStyle = "#adb5bd"; ctx.fillRect(16, -50, 12, 2); ctx.fillRect(16, -44, 12, 2); }
    if (p.q) { box(ctx, 8, -112, 34, 34, 12, "#fff", INK, 3); txt(ctx, "?", 25, -94, 24, "#d1495b", "center", 700); }
    ctx.restore();
  }
  function drawPlate(ctx, x, y) {
    ctx.beginPath(); ctx.ellipse(x, y, 14, 5, 0, 0, 7); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - 4, 7, Math.PI, 0); ctx.fillStyle = "#ff922b"; ctx.fill(); ctx.stroke();
  }

  function levelEngines(L) {
    var F = frame(L, "pix"), H = 620, GY = 500;
    var cv = L.canvas({ w: 1280, h: H, parent: F.top, fill: true, label: "kitchen and food truck" }), ctx = cv.ctx;
    var T = tweens(), P = parts();
    var card = u.el("div", { class: "mg-job" }); F.top.appendChild(card); card.style.display = "none";
    var jobs = u.shuffle(JOBS, L.rng), cust = null, crowd = [], flights = [], mistakes = 0, total = 0, pickRes = null, bug = null;
    var busy = [0, 0], race = null, KX = 24, KW = 410, TWID = 360;
    var bK = keyBtn("◀ 🍽️ vLLM Kitchen", "1", "primary", function () { pick(0); });
    var bT = keyBtn("🚚 llama.cpp Food Truck ▶", "2", "warn", function () { pick(1); });
    F.set([bK, bT]);
    function setPick(on) { bK.disabled = bT.disabled = !on; }
    setPick(false);
    function pick(i) { if (!pickRes) return; var r = pickRes; pickRes = null; setPick(false); RQ.audio.sfx("select"); r(i); }
    onKeys(L, function (e) {
      if (e.key === "1" || e.key === "ArrowLeft") pick(0);
      else if (e.key === "2" || e.key === "ArrowRight") pick(1);
    });
    function TX() { return cv.w - 24 - TWID; }
    L.on(cv.cv, "pointerdown", function (e) {
      if (!pickRes) return;
      var p = cv.toLocal(e);
      if (p.x < KX + KW && p.y > GY - 360) pick(0); else if (p.x > TX() && p.y > GY - 280) pick(1);
    });
    function doorOf(i) { return i === 0 ? { x: KX + KW - 60, y: GY + 44 } : { x: TX() + 130, y: GY + 44 }; }
    function serve(i, targets) {
      var from = i === 0 ? { x: KX + KW - 60, y: GY - 70 } : { x: TX() + 130, y: GY - 120 };
      targets.forEach(function (p, k) { flights.push({ x0: from.x, y0: from.y, p: p, t: -(i === 0 ? 0 : k * .4), d: .55 }); });
      busy[i] = 1.4;
    }
    function crowdAt(i, n) {
      var list = [], base = i === 0 ? KX + 30 : TX() + 10, span = i === 0 ? KW - 40 : TWID - 20;
      for (var k = 0; k < n; k++) {
        var row = k % 2, col = Math.floor(k / 2), cols = Math.ceil(n / 2);
        list.push(person(base + (col + .5) * span / cols + row * 12, GY + 62 + row * 34, .62));
      }
      return list;
    }

    async function job(j, idx) {
      L.hud.set("job", "🧾 " + (idx + 1) + " / " + jobs.length);
      card.innerHTML = '<div class="ico">' + j.icon + '</div><div>' + RQ.ui.md(j.text) + '</div><div class="keys">◀ Kitchen [1] · Food truck [2] ▶</div>';
      card.style.display = ""; card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
      cust = person(cv.w / 2, H + 90); cust.ticket = true; cust.moving = true;
      RQ.audio.sfx("pop");
      await T.to(cust, { y: GY + 44 }, .6, u.ease.outCubic);
      cust.moving = false;
      if (!L.alive) return;
      var choice = await new Promise(function (r) { pickRes = r; setPick(true); });
      if (!L.alive) return;
      total++;
      var ok = choice === j.ans, d = doorOf(choice);
      cust.moving = true; await T.to(cust, { x: d.x, y: d.y }, .8); cust.moving = false;
      if (!L.alive) return;
      if (!ok) {
        mistakes++; cust.q = true; RQ.audio.sfx("giggle");
        bug = { x: choice === 0 ? KX + 160 : TX() + 200, y: GY - 210, t: 0 };
        L.toast(j.why, "bad", 3400);
        await L.wait(1600);
        if (!L.alive) return;
        bug = null; cust.q = false;
        d = doorOf(j.ans); cust.moving = true; await T.to(cust, { x: d.x }, 1.1); cust.moving = false;
        if (!L.alive) return;
      } else { RQ.audio.sfx("good"); L.toast("✅ " + j.why, "good", 2600); }
      card.style.display = "none";
      var targets = [cust];
      if (j.ans === 0 && j.crowd) { crowd = crowdAt(0, j.crowd); targets = targets.concat(crowd); RQ.audio.sfx("whoosh"); }
      serve(j.ans, targets);
      await L.wait(1300);
      if (!L.alive) return;
      RQ.audio.sfx("coin"); P.burst(cust.x, cust.y - 90, 14, ["#ffd43b", "#8ce99a", "#fff"]);
      await L.wait(500);
      if (!L.alive) return;
      cust.moving = true; crowd.forEach(function (p) { p.moving = true; T.to(p, { y: H + 120 }, .9); });
      await T.to(cust, { y: H + 120 }, .8); crowd = []; cust = null;
    }
    async function rushHour() {
      L.hud.set("job", "⏰ Rush hour");
      var p = await L.choose("hoot", "Rush hour: twelve hungry customers wait at each place! Who serves all twelve first?", ["🍽️ vLLM Kitchen", "🚚 llama.cpp Food Truck"], { top: true });
      if (!L.alive) return;
      total++;
      race = { t: 0, k: crowdAt(0, 12), f: crowdAt(1, 12), ks: 0, fs: 0, kt: 0, ft: 0 };
      RQ.audio.sfx("whoosh");
      await L.wait(5600);
      if (!L.alive) return;
      var ok = p === 0;
      if (!ok) mistakes++;
      RQ.audio.sfx(ok ? "good" : "bad");
      L.toast((ok ? "✅ " : "") + "The kitchen **batches** many orders on big GPUs. The food truck is great for one person on a smaller computer!", ok ? "good" : "info", 3600);
      await L.wait(1800);
      race = null;
    }
    async function commands() {
      L.hud.set("job", "⌨️ Commands");
      var c1 = ["`vllm serve helper-8b`", "`llama-server -m helper-8b-Q4_K_M.gguf`", "`pip install kitchen`"], o1 = u.shuffle([0, 1, 2], L.rng);
      var a = await L.choose("pix", "Open the big kitchen on the server GPUs! Which command starts it?", o1.map(function (k) { return c1[k]; }), { top: true });
      if (!L.alive) return;
      total++; if (o1[a] !== 0) { mistakes++; RQ.audio.sfx("bad"); L.toast("The kitchen starts with `vllm serve helper-8b`.", "bad", 2600); } else { RQ.audio.sfx("good"); busy[0] = 2; }
      await L.wait(700);
      if (!L.alive) return;
      var o2 = u.shuffle([0, 1, 2], L.rng);
      var b = await L.choose("pix", "Now start the food truck on a laptop. Which command?", o2.map(function (k) { return c1[k]; }), { top: true });
      if (!L.alive) return;
      total++; if (o2[b] !== 1) { mistakes++; RQ.audio.sfx("bad"); L.toast("The food truck starts with `llama-server -m` and a **.gguf** file.", "bad", 2600); } else { RQ.audio.sfx("good"); busy[1] = 2; }
      await L.wait(900);
    }

    function drawStreet(W, t) {
      var g = ctx.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, "#9d8cf0"); g.addColorStop(1, "#ffd6a5");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
      ctx.beginPath(); ctx.arc(W / 2, GY - 40, 70, 0, 7); ctx.fillStyle = "rgba(255,236,170,.8)"; ctx.fill();
      for (var c = 0; c < 3; c++) {
        var x = ((c * 450 + t * (10 + c * 5)) % (W + 300)) - 150, y = 70 + c * 40;
        ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.arc(x + 26, y - 10, 28, 0, 7); ctx.arc(x + 56, y, 20, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "#d9d2c3"; ctx.fillRect(0, GY, W, 40); ctx.fillStyle = "#c4bcab"; for (var sx = 0; sx < W; sx += 64) ctx.fillRect(sx, GY, 3, 40);
      ctx.fillStyle = "#5b616d"; ctx.fillRect(0, GY + 40, W, H - GY - 40);
      ctx.strokeStyle = "#ffe066"; ctx.lineWidth = 4; ctx.setLineDash([26, 20]); ctx.beginPath(); ctx.moveTo(0, GY + 92); ctx.lineTo(W, GY + 92); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();
    }
    function drawKitchen(t) {
      var x = KX, w = KW, top = GY - 264, bz = busy[0] > 0;
      box(ctx, x + 292, top - 84, 62, 96, 8, "#2d3436", INK, 3);
      for (var r = 0; r < 4; r++) {
        box(ctx, x + 298, top - 76 + r * 21, 50, 15, 3, "#495057", INK, 1.5);
        for (var l = 0; l < 3; l++) { ctx.fillStyle = ((t * (bz ? 12 : 3) + r * 3 + l) | 0) % 3 ? "#51cf66" : "#1b4d2a"; ctx.fillRect(x + 304 + l * 9, top - 71 + r * 21, 5, 5); }
      }
      if (bz && Math.random() < .2) P.puff(x + 323, top - 88, "#dee2e6");
      box(ctx, x, top, w, GY - top, 8, "#fff4e0", INK, 4);
      box(ctx, x - 8, top - 14, w + 16, 22, 6, "#7c5cc4", INK, 3);
      box(ctx, x + 40, top - 64, 220, 50, 12, "#140f2b", "#c4a5ff", 3);
      neon(ctx, "vLLM Kitchen", x + 150, top - 38, 27, "#c4a5ff", t);
      box(ctx, x + 22, top + 30, 248, 136, 10, "#2b2350", INK, 3);
      for (var i = 0; i < 6; i++) {
        var cx = x + 64 + (i % 3) * 82, cy = top + 70 + Math.floor(i / 3) * 62, b = Math.sin(t * (bz ? 14 : 3) + i * 1.3) * (bz ? 5 : 1.5);
        ctx.beginPath(); ctx.ellipse(cx, cy + 22, 22, 7, 0, 0, 7); ctx.fillStyle = "#adb5bd"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        if (bz && Math.random() < .08) P.puff(cx, cy - 20, "#ffffff");
        box(ctx, cx - 16, cy - 14 + b, 32, 28, 5, "#2f9e4f", INK, 2.5);
        ctx.fillStyle = "#ffd43b"; for (var pn = 0; pn < 3; pn++) { ctx.fillRect(cx - 21, cy - 8 + pn * 8 + b, 5, 3); ctx.fillRect(cx + 16, cy - 8 + pn * 8 + b, 5, 3); }
        ctx.beginPath(); ctx.ellipse(cx, cy - 22 + b, 12, 8, 0, 0, 7); ctx.fillStyle = "#fff"; ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.fillRect(cx - 8, cy - 22 + b, 16, 8); ctx.strokeRect(cx - 8, cy - 22 + b, 16, 8);
        eyes(ctx, cx, cy - 2 + b, 11, 3.4, t + i);
        txt(ctx, "GPU", cx, cy + 8 + b, 9, "#fff", "center", 700);
      }
      txt(ctx, "server GPUs · many users at once", x + 146, top + 186, 15, "#5a4a8a", "center", 700);
      box(ctx, x + 22, top + 202, 248, 34, 8, "#140f2b", INK, 2.5);
      txt(ctx, "$ vllm serve <model>", x + 146, top + 219, 15, "#7ee787", "center", 600, MONO);
      for (var s = 0; s < 6; s++) { ctx.fillStyle = s % 2 ? "#fff" : "#d1495b"; ctx.fillRect(x + 288 + s * 18, top + 82, 18, 22); }
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x + 288, top + 82, 108, 22);
      box(ctx, x + 304, top + 108, 82, GY - top - 108, 6, bz ? "#ffe8a3" : "#8a5a35", INK, 3);
      ctx.beginPath(); ctx.arc(x + 372, top + 180, 4, 0, 7); ctx.fillStyle = INK; ctx.fill();
    }
    function drawFoodTruck(t) {
      var x = TX(), bz = busy[1] > 0, by = GY - 34, bodyTop = by - 168;
      box(ctx, x + 40, bodyTop - 70, 210, 46, 12, "#140f2b", "#ffd43b", 3);
      neon(ctx, "llama.cpp", x + 145, bodyTop - 47, 26, "#ffd43b", t + 1);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 80, bodyTop - 24); ctx.lineTo(x + 80, bodyTop); ctx.moveTo(x + 210, bodyTop - 24); ctx.lineTo(x + 210, bodyTop); ctx.stroke();
      box(ctx, x, bodyTop, 270, by - bodyTop, 14, "#ffd43b", INK, 4);
      box(ctx, x + 264, bodyTop + 40, 92, by - bodyTop - 40, 16, "#ffe066", INK, 4);
      box(ctx, x + 300, bodyTop + 52, 46, 40, 8, "#bfe8ff", INK, 3);
      box(ctx, x + 24, bodyTop + 26, 214, 76, 8, "#3b2f2f", INK, 3);
      for (var s = 0; s < 8; s++) { ctx.fillStyle = s % 2 ? "#fff" : "#2b7bd0"; ctx.beginPath(); ctx.moveTo(x + 16 + s * 29, bodyTop + 14); ctx.lineTo(x + 45 + s * 29, bodyTop + 14); ctx.lineTo(x + 30 + s * 29, bodyTop + 32); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 16, bodyTop + 14); ctx.lineTo(x + 248, bodyTop + 14); ctx.stroke();
      for (var lb = 0; lb < 9; lb++) { ctx.beginPath(); ctx.arc(x + 18 + lb * 28, bodyTop + 6 + Math.sin(lb) * 2, 4.5, 0, 7); ctx.fillStyle = ((t * 4 | 0) + lb) % 3 ? TOK_COLS[lb % TOK_COLS.length] : "#555"; ctx.fill(); }
      var b = Math.sin(t * (bz ? 14 : 3)) * (bz ? 4 : 1.2), cx = x + 80, cy = bodyTop + 62;
      box(ctx, cx - 16, cy - 14 + b, 32, 28, 5, "#495057", INK, 2.5);
      ctx.beginPath(); ctx.ellipse(cx, cy - 22 + b, 12, 8, 0, 0, 7); ctx.fillStyle = "#fff"; ctx.fill(); ctx.stroke();
      eyes(ctx, cx, cy - 2 + b, 11, 3.4, t + 9);
      txt(ctx, "CPU", cx, cy + 8 + b, 9, "#fff", "center", 700);
      box(ctx, x + 130, bodyTop + 52, 76, 46, 4, "#1c2733", INK, 2.5);
      ctx.fillStyle = bz ? "#74c0fc" : "#4dabf7"; ctx.fillRect(x + 135, bodyTop + 56, 66, 34);
      txt(ctx, "GGUF", x + 168, bodyTop + 73, 14, "#fff", "center", 700, MONO);
      box(ctx, x + 120, bodyTop + 97, 96, 8, 3, "#adb5bd", INK, 2);
      box(ctx, x + 24, bodyTop + 108, 214, 26, 6, "#140f2b", INK, 2.5);
      txt(ctx, "$ llama-server -m model.gguf", x + 131, bodyTop + 121, 12, "#7ee787", "center", 600, MONO);
      txt(ctx, "laptop CPU/GPU · offline OK", x + 180, by - 12, 12, "#5c3d00", "center", 700);
      [x + 60, x + 300].forEach(function (wx) {
        ctx.save(); ctx.translate(wx, by + 4); ctx.rotate(t * .5);
        ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fillStyle = "#2b2f38"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fillStyle = "#c9ced6"; ctx.fill(); ctx.fillRect(-2, -20, 4, 10); ctx.restore();
      });
    }
    function drawRace(dt) {
      if (!race) return;
      race.t += dt;
      race.kt += dt; race.ft += dt;
      if (race.kt > .9 && race.ks < 12) { race.kt = 0; serve(0, race.k.slice(race.ks, race.ks + 6)); race.ks += 6; RQ.audio.sfx("whoosh"); }
      if (race.ft > .42 && race.fs < 12) { race.ft = 0; serve(1, [race.f[race.fs]]); race.fs++; RQ.audio.sfx("pop"); }
      race.k.concat(race.f).forEach(function (p) { drawPerson(ctx, p, race.t); });
      [[KX + KW / 2, race.k], [TX() + TWID / 2, race.f]].forEach(function (a) {
        var n = a[1].filter(function (p) { return p.plate; }).length;
        box(ctx, a[0] - 80, 18, 160, 40, 12, n >= 12 ? "#d9f7df" : "#fff", INK, 3);
        txt(ctx, (n >= 12 ? "✓ " : "") + n + " / 12 served", a[0], 39, 19, INK, "center", 700);
      });
    }

    L.loop(function (dt, t) {
      T.step(dt);
      busy[0] = Math.max(0, busy[0] - dt); busy[1] = Math.max(0, busy[1] - dt);
      var W = cv.w;
      drawStreet(W, t);
      drawKitchen(t);
      drawFoodTruck(t);
      crowd.forEach(function (p) { drawPerson(ctx, p, t); });
      drawRace(dt);
      if (cust) drawPerson(ctx, cust, t);
      flights = flights.filter(function (f) {
        f.t += dt; if (f.t < 0) return true;
        var k = Math.min(1, f.t / f.d), tx = f.p.x + 18 * f.p.s, ty = f.p.y - 40 * f.p.s;
        drawPlate(ctx, u.lerp(f.x0, tx, k), u.lerp(f.y0, ty, k) - Math.sin(k * Math.PI) * 90);
        if (k >= 1) { f.p.plate = true; f.p.ticket = false; return false; }
        return true;
      });
      if (bug) { bug.t += dt; drawBug(ctx, bug.x, bug.y, 1.2, t); }
      P.draw(ctx, dt);
    });
    (async function () {
      await L.wait(500);
      for (var i = 0; i < jobs.length; i++) { await job(jobs[i], i); if (!L.alive) return; }
      await rushHour(); if (!L.alive) return;
      await commands(); if (!L.alive) return;
      L.win({ stars: starsFor(mistakes, 1, 3), msg: "**vLLM** = a big kitchen for crowds on server GPUs. **llama.cpp** = a food truck that runs GGUF models on many computers, if they fit!",
        stats: { "Right first time": (total - mistakes) + " / " + total } });
    })();
  }

  /* ============================================================ L4 Out of Memory! (terminal) */
  var CASES = [
    { title: "The long diary", host: "lab", gpu: "Gaming GPU", cap: 24, n: 1, engine: "vllm", model: "helper-8b (16-bit)",
      task: "Ask <b>helper-8b</b> about Hoot's whole field diary.", rule: "Keep the 8B brain. The big A100 machine is booked today.",
      launch: "vllm serve helper-8b", w: 16, rt: 2, ask: "python ask.py diary.txt", kv: 15,
      fixes: [
        { ok: true, label: "less text to remember (8,192 tokens)", cmd: "vllm serve helper-8b --max-model-len 8192", model: "helper-8b (16-bit)", w: 16, rt: 2, kv: 1, note: "ask.py now sends only the newest 8,192 tokens: the last diary pages." },
        { ok: true, label: "4-bit model (AWQ)", cmd: "vllm serve helper-8b-awq", model: "helper-8b-awq (4-bit)", w: 4, rt: 2, kv: 15, note: "4-bit weights: 8 billion × ½ byte = 4 GB." },
        { ok: false, why: "Hoot wants the **8B** brain for this. The 1B one forgets plant names!" },
        { ok: false, why: "The big A100 machine is booked today. Fix it on this GPU!" }
      ],
      answer: "[c]helper-8b:[/c] The last diary page says: plant 40 acorns by the creek!" },
    { title: "The giant brain", host: "lab", gpu: "Gaming GPU", cap: 24, n: 1, engine: "vllm", model: "helper-70b (16-bit)",
      task: "Load the giant <b>helper-70b</b> for a hard question.", rule: "Keep the 70B brain. The project's computer (4 × A100 80 GB) is free now!",
      launch: "vllm serve helper-70b", w: 140, rt: 4, loadCrash: true,
      fixes: [
        { ok: false, why: "Remembering less text only shrinks the KV cache. The weights alone are **140 GB**!", preview: { w: 140, rt: 4, kv: 0 } },
        { ok: false, why: "4-bit makes the weights **35 GB**. Still too big for 24 GB!", preview: { w: 35, rt: 4, kv: 0 } },
        { ok: false, why: "Hoot needs the giant **70B** brain for this hard question." },
        { ok: true, label: "bigger GPUs: the project's computer, 4 × A100 80 GB", cmd: "vllm serve helper-70b -tp 4", model: "helper-70b (16-bit)", host: "project-pc", gpu: "A100 80 GB", cap: 320, n: 4, w: 140, rt: 8, kv: 4,
          note: "-tp 4 shares the model's work across 4 GPUs working together." }
      ],
      answer: "[c]helper-70b:[/c] Forest! Tall trees, a closed canopy and no roads." },
    { title: "Rainforest camp", host: "laptop", gpu: "Laptop GPU", cap: 8, n: 1, engine: "llama", model: "helper-8b-f16.gguf",
      task: "Chat offline in the rainforest camp.", rule: "No internet, no other computer. Keep the 8B brain.",
      launch: "llama-server -m helper-8b-f16.gguf", w: 16, rt: 1, loadCrash: true,
      fixes: [
        { ok: false, why: "Remembering less text only shrinks the KV cache. The 16-bit weights alone are **16 GB**!", preview: { w: 16, rt: 1, kv: 0 } },
        { ok: true, label: "4-bit GGUF file (Q4_K_M)", cmd: "llama-server -m helper-8b-Q4_K_M.gguf", model: "helper-8b-Q4_K_M.gguf", w: 4, rt: 1, kv: 1, note: "Q4 = about 4 bits per number: 8 billion × ½ byte ≈ 4 GB." },
        { ok: false, why: "Keep the **8B** brain: it knows the rainforest trees." },
        { ok: false, why: "There is no other computer in the rainforest camp, and no internet!" }
      ],
      answer: "[c]helper-8b (4-bit):[/c] That bird is a toucan! Ask me anything, even offline." }
  ];
  var FIXES = [["✂️", "Less text to remember", "smaller KV cache (chat notes)"], ["🗜️", "4-bit model", "weights shrink to ¼"],
    ["🐣", "Smaller model", "fewer settings (parameters)"], ["🚚", "Bigger GPU", "more memory"]];

  function levelDiagnose(L) {
    var root = u.el("div", { class: "mg-lab" }), left = u.el("div", { class: "left" }), right = u.el("div", { class: "right" });
    var info = u.el("div", { class: "panel mg-info" }), gbox = u.el("div", { class: "mg-gauge" }), fixes = u.el("div", { class: "mg-fixes" });
    right.appendChild(info); right.appendChild(gbox); right.appendChild(fixes);
    root.appendChild(left); root.appendChild(right); L.stage.appendChild(root);
    var term = RQ.term.mount(left, { user: "kid", host: "lab", title: "model server lab (pretend)", height: "100%" });
    var cv = L.canvas({ w: 520, h: 430, parent: gbox, label: "GPU memory gauge" }), ctx = cv.ctx;
    var T = tweens(), P = parts();
    var G = { cap: 24, n: 1, gpu: "Gaming GPU", w: 0, rt: 0, kv: 0, status: "off", fan: 0, fanA: 0 };
    var mistakes = 0, fixRes = null;
    var fixBtns = FIXES.map(function (f, i) {
      var b = u.el("button", { class: "btn", html: '<span class="mg-key">' + (i + 1) + "</span> " + f[0] + " <span>" + f[1] + "<small>" + f[2] + "</small></span>", onclick: function () { choose(i); } });
      fixes.appendChild(b); return b;
    });
    function setFix(on) { fixBtns.forEach(function (b) { b.disabled = !on; }); }
    setFix(false);
    function choose(i) { if (!fixRes) return; var r = fixRes; fixRes = null; setFix(false); RQ.audio.sfx("select"); r(i); }
    onKeys(L, function (e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= 4) choose(n - 1); });
    function setInfo(c, host) {
      info.innerHTML = "🖥️ <b>" + u.esc(host || c.host) + "</b> · " + (G.n > 1 ? G.n + " × " : "1 × ") + u.esc(G.gpu) + " (" + G.cap + " GB)<br>🎯 " + c.task + "<br>📌 " + u.esc(c.rule);
    }
    function partial(label, upto, ms) {
      term.print(label);
      var out = term.el.children[1], line = out.lastElementChild;
      return new Promise(function (res) {
        var t0 = performance.now(), Wd = 20;
        (function f() {
          if (!L.alive) return res();
          var k = Math.min(1, (performance.now() - t0) / ms), pct = k * upto, n = Math.round(pct / 100 * Wd);
          line.innerHTML = RQ.term.markup(label + " [g][" + "#".repeat(n) + "[/g][dim]" + ".".repeat(Wd - n) + "][/dim] " + Math.round(pct) + "%");
          if (k < 1) requestAnimationFrame(f); else res();
        })();
      });
    }
    function need() { return G.w + G.rt + G.kv; }
    async function load(c, m, crash) {
      G.status = "load"; G.fan = 1; RQ.audio.sfx("engine");
      if (c.engine === "vllm") term.print("[dim]INFO  vLLM: loading " + m.model + " on " + G.n + " GPU" + (G.n > 1 ? "s" : "") + "[/dim]");
      else term.print("[dim]llama_model_load: loading " + m.model + " (" + m.w + " GiB)[/dim]");
      T.to(G, { w: m.w, rt: m.rt, kv: 0 }, crash ? 1.0 : 1.3);
      await partial("Loading weights", crash ? 23 : 100, crash ? 1000 : 1300);
      if (!L.alive) return;
      if (crash) {
        if (c.engine === "vllm") {
          term.print("[r]torch.OutOfMemoryError: CUDA out of memory. Tried to allocate " + m.w + ".00 GiB.[/r]");
          term.print("[r]GPU 0 has a total capacity of " + G.cap + ".00 GiB.[/r]");
        } else {
          term.print("[r]cudaMalloc failed: out of memory (allocating " + (m.w * 1024) + " MiB on device 0)[/r]");
          term.print("[r]llama_model_load: error loading model: failed to allocate buffer[/r]");
        }
        crashFx();
        return;
      }
      term.print("[dim]INFO  Model weights take " + m.w + ".0 GiB · working memory " + m.rt + " GiB[/dim]");
      if (c.engine === "vllm") term.print("[g]INFO  Uvicorn running on http://0.0.0.0:8000[/g]");
      else term.print("[g]main: server is listening on http://127.0.0.1:8080[/g]");
      G.status = "ok"; G.fan = .4; RQ.audio.sfx("good");
    }
    function crashFx() { G.status = "crash"; G.fan = .1; RQ.audio.sfx("error"); RQ.audio.sfx("buzz"); P.burst(470, 40, 22, ["#ff6b6b", "#ffd43b", "#fff"]); }
    async function runCase(c, ci) {
      G.cap = c.cap; G.n = c.n; G.gpu = c.gpu; G.status = "off"; term.host = c.host;
      T.to(G, { w: 0, rt: 0, kv: 0 }, .4);
      setInfo(c);
      L.hud.set("case", "🩺 Case " + (ci + 1) + " / " + CASES.length);
      term.print("");
      term.print("[y]# Case " + (ci + 1) + ": " + c.title + "[/y]");
      await term.ask({ expect: c.launch, ghost: c.launch, hint: "Copy the grey letters. Tab finishes it." });
      if (!L.alive) return;
      await load(c, { model: c.model, w: c.w, rt: c.rt }, !!c.loadCrash);
      if (!L.alive) return;
      if (!c.loadCrash) {
        term.print("[dim]# Now send Hoot's whole diary to the model:[/dim]");
        await term.ask({ expect: c.ask, ghost: c.ask });
        if (!L.alive) return;
        term.print("Sending diary.txt (120,000 tokens) to localhost:8000 …");
        await T.to(G, { kv: c.kv }, 1.4);
        if (!L.alive) return;
        term.print("[r]torch.OutOfMemoryError: CUDA out of memory. Tried to allocate " + c.kv + ".00 GiB.[/r]");
        term.print("[r]GPU 0 has a total capacity of " + G.cap + ".00 GiB of which " + (G.cap - c.w - c.rt) + ".00 GiB is free.[/r]");
        crashFx();
      }
      await L.wait(500);
      if (!L.alive) return;
      if (ci === 0) await L.say("pix", "Crash! **CUDA out of memory** means it didn't fit, so read the gauge and pick a fix.", { top: true });
      else L.toast("💥 Out of memory again! Read the gauge and the 📌 rule.", "bad", 2600);
      if (!L.alive) return;
      var wrongHere = 0, fx;
      for (;;) {
        setFix(true);
        var f = await new Promise(function (r) { fixRes = r; });
        if (!L.alive) return;
        fx = c.fixes[f];
        if (fx.ok) break;
        mistakes++; wrongHere++; RQ.audio.sfx("bad");
        term.print("[m]# Try: " + FIXES[f][1].toLowerCase() + " … no luck.[/m]");
        L.toast(fx.why, "bad", 3400);
        if (fx.preview) {
          var keep = { w: G.w, rt: G.rt, kv: G.kv };
          await T.to(G, fx.preview, .6);
          await L.wait(1500);
          if (!L.alive) return;
          await T.to(G, keep, .5);
        } else await L.wait(900);
        if (!L.alive) return;
        if (wrongHere === 2) { await L.hint("Is it the **weights** or the **KV cache** that is too big? Check the gauge and the 📌 rule.", "hoot"); if (!L.alive) return; }
      }
      RQ.audio.sfx("powerup");
      term.print("[g]# Fix: " + fx.label + "[/g]");
      term.print("[dim]# " + fx.note + "[/dim]");
      G.status = "off";
      if (fx.host) { G.cap = fx.cap; G.n = fx.n; G.gpu = fx.gpu; term.host = fx.host; setInfo(c, fx.host); term.print("[dim]# Moved to the project's computer: 4 × A100 80 GB = 320 GB.[/dim]"); }
      T.to(G, { w: 0, rt: 0, kv: 0 }, .4);
      await term.ask({ expect: fx.cmd, ghost: fx.cmd, hint: "Copy the grey letters. Tab finishes it." });
      if (!L.alive) return;
      await load(c, { model: fx.model, w: fx.w, rt: fx.rt }, false);
      if (!L.alive) return;
      term.print("[dim]> asking: " + (c.ask ? "what does the diary say?" : "a test question") + "[/dim]");
      await T.to(G, { kv: fx.kv }, .9);
      if (!L.alive) return;
      term.print(c.answer);
      P.burst(260, 60, 26, ["#8ce99a", "#ffd43b", "#fff", "#74c0fc"]);
      RQ.audio.sfx("bloom");
      L.toast("✅ Fixed! " + gb(need()) + " fits in " + G.cap + " GB.", "good", 2400);
      await L.wait(1800);
    }

    function drawGpu(x, y, w, h, t, col) {
      box(ctx, x, y, w, h, 10, "#2f9e4f", INK, 3);
      ctx.fillStyle = "#ffd43b"; for (var p = 8; p < w - 30; p += 10) ctx.fillRect(x + p, y + h, 6, 7);
      var fr = Math.min(h * .36, w * .16), n = 2;
      for (var i = 0; i < n; i++) {
        var fx = x + w * (i + 1) / (n + 1), fy = y + h / 2;
        ctx.beginPath(); ctx.arc(fx, fy, fr + 3, 0, 7); ctx.fillStyle = "#1c2733"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(G.fanA + i);
        ctx.fillStyle = "#adb5bd";
        for (var bl = 0; bl < 5; bl++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(fr * .5, 0, fr * .5, fr * .2, .4, 0, 7); ctx.fill(); }
        ctx.restore();
        ctx.beginPath(); ctx.arc(fx, fy, fr * .2, 0, 7); ctx.fillStyle = col; ctx.fill();
      }
      txt(ctx, "GPU", x + 14, y + 12, 11, "#d3f9d8", "left", 700);
    }
    L.loop(function (dt, t) {
      T.step(dt);
      G.fanA += dt * (1 + G.fan * 22);
      var W = cv.w, Hh = cv.h, over = need() > G.cap + .01, st = G.status;
      ctx.clearRect(0, 0, W, Hh);
      box(ctx, 4, 4, W - 8, Hh - 8, 18, "#1c1838", INK, 4);
      var lampCol = st === "ok" ? "#51cf66" : st === "load" ? ((t * 4 | 0) % 2 ? "#ffd43b" : "#8a6d00") : st === "crash" ? ((t * 6 | 0) % 2 ? "#ff3b3b" : "#7a1010") : "#495057";
      if (G.n === 1) drawGpu(105, 30, 300, 104, t, lampCol);
      else for (var i = 0; i < 4; i++) drawGpu(66 + (i % 2) * 196, 24 + Math.floor(i / 2) * 62, 184, 50, t, lampCol);
      txt(ctx, (G.n > 1 ? G.n + " × " : "") + G.gpu + (G.n > 1 ? " = " + G.cap + " GB" : " · " + G.cap + " GB"), W / 2, 168, 21, "#fff", "center", 700);
      if (st === "crash") {
        ctx.save(); ctx.translate(470, 40); ctx.rotate(t * 7); ctx.fillStyle = "rgba(255,80,80,.3)";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 80, -.35, .35); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(470, 40, 15, 0, 7); ctx.fillStyle = lampCol; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      var bx = 26, by = 232, bw = W - 52 - 64, bh = 54, sc = (bw - 4) / G.cap;
      var nd = need();
      txt(ctx, "Needs " + gb(nd) + " · has " + G.cap + " GB", bx, by - 18, 18, over ? "#ff8787" : nd > 0 ? "#8ce99a" : "#c9c2ea", "left", 700);
      box(ctx, bx, by, bw, bh, 10, "#0e0b20", "#c9c2ea", 3);
      ctx.save(); u.rr(ctx, bx + 2, by + 2, bw - 4, bh - 4, 8); ctx.clip();
      var segs = [[G.w, "#4dabf7"], [G.rt, "#adb5bd"], [G.kv, "#ffa94d"]], xx = bx + 2;
      segs.forEach(function (s) { var wpx = s[0] * sc; ctx.fillStyle = s[1]; ctx.fillRect(xx, by + 2, wpx, bh - 4); xx += wpx; });
      ctx.restore();
      if (over) {
        var fl = (t * 6 | 0) % 2;
        box(ctx, bx + bw - 8, by - 6, 70, bh + 12, 10, fl ? "#ff3b3b" : "#ffd43b", INK, 3);
        txt(ctx, "+" + Math.round(nd - G.cap), bx + bw + 27, by + bh / 2 - 6, 17, INK, "center", 700);
        txt(ctx, "GB", bx + bw + 27, by + bh / 2 + 12, 13, INK, "center", 700);
        txt(ctx, "CUDA out of memory!", W / 2, by + bh + 30, 22, fl ? "#ff8787" : "#fff", "center", 700);
      } else txt(ctx, "memory = weights + working memory + KV cache", W / 2, by + bh + 30, 15, "#c9c2ea", "center", 600);
      [["weights", "#4dabf7"], ["working memory", "#adb5bd"], ["KV cache (chat notes)", "#ffa94d"]].forEach(function (lg, k) {
        var lx = [26, 150, 318][k], ly = Hh - 34;
        box(ctx, lx, ly - 8, 16, 16, 4, lg[1], INK, 2); txt(ctx, lg[0], lx + 22, ly, 14, "#e5dbff", "left", 600);
      });
      P.draw(ctx, dt);
    });
    (async function () {
      term.print("[dim]# Model server lab (game version): pretend commands,[/dim]");
      term.print("[dim]# made-up models helper-1b, helper-8b, helper-70b.[/dim]");
      term.print("[dim]# Real ReSeed asks gpt-6-astra in Azure's cloud.[/dim]");
      term.print("[dim]# Type each command (Tab finishes it). Watch the gauge →[/dim]");
      for (var ci = 0; ci < CASES.length; ci++) { await runCase(CASES[ci], ci); if (!L.alive) return; }
      L.win({ stars: starsFor(mistakes, 0, 2), msg: "You fixed three **CUDA out of memory** crashes: less text, 4-bit and bigger GPUs. Real AI engineers do exactly this!",
        stats: { "Wrong fixes": String(mistakes) } });
    })();
  }

  /* ============================================================ the game */
  RQ.game({
    id: "g12",
    music: "lab",
    intro: [
      ["hoot", "Hoo! ReSeed's demo server asks a giant AI, **gpt-6-astra**, for a second opinion on forest pictures."],
      ["hoot", "Giant AI brains need giant computers. Let's learn how people run them on GPUs!"],
      ["pix", "I'll bring a command window to type in. Welcome to the **Model Garage**!"]
    ],
    outro: [
      ["hoot", "You can chop tokens, park models and fix out-of-memory crashes. Splendid work!"],
      ["sprout", "Next stop: Score island, where we measure how green the forest is!"]
    ],
    levels: [
      { title: "Token Chopper", goal: "Keep common words whole, chop the long or made-up ones",
        intro: [["hoot", "AI language models don't read letters. They read **tokens**: little chunks of text."],
                ["hoot", "Short, common words stay whole, and long or made-up words get chopped. You run the chopper!"]],
        cards: ["token"],
        play: levelTokens },
      { title: "GPU Parking", goal: "Park each model in the smallest garage where it fits",
        intro: [["hoot", "In this game, a model's **weights** must fit in GPU memory: billions of settings × bytes each. 16 bits are 2 bytes, and 4 bits are half a byte."],
                ["hoot", "Add room for the **KV cache**, the model's notes while it chats. These models are made-up examples."]],
        cards: ["gpu-memory", "quantization"],
        play: levelParking },
      { title: "Kitchen or Food Truck?", goal: "Send each customer to vLLM or llama.cpp",
        intro: [["pix", "Two ways to serve an AI model. **vLLM** is a big kitchen that cooks for many users at once on server GPUs."],
                ["pix", "**llama.cpp** is a food truck: it runs a GGUF model that fits on your laptop. Send each customer to the right one!"]],
        cards: ["vllm", "llama-cpp"],
        play: levelEngines },
      { title: "Out of Memory!", goal: "Launch the server, read the crash, pick the fix",
        intro: [["pix", "Time to start a pretend AI model server! Type the commands in the command window, then fix the crashes."],
                ["hoot", "If you see **CUDA out of memory**, the model didn't fit. Read the gauge and pick a fix."]],
        cards: ["kv-cache"],
        play: levelDiagnose }
    ]
  });
})();
