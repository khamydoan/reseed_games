/* g17 Roll Factory — toilet-paper-roll seed pods (reseed/logistics.py).
 * Kids DO first, then the formula is revealed:
 * L1 fill the visible seed slots of one roll, pour water into the gaps, test the dispenser → reveal π r² h, 60 % packing, 10 % jam
 * L2 stuff acorns, seed balls and pine seeds → reveal seeds_per_roll() and int() rounding down
 * L3 load whole trips on the 4-roll field drone → reveal math.ceil (trips, batteries, rolls)
 * L4 My Site's real mission from RQ.mySite().logistics (seeds, rolls, batteries, days, fleet size, cost vs hand planting). */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a";
  var D = RQ.data() || {};

  /* ------------------------------------------------------------ ReSeed facts (logistics.py) */
  var ROLL = D.roll || { inner_diameter_cm: 4.5, length_cm: 10, volume_ml: 159.04, packing: 0.6, dispenser_loss: 0.1 };
  var VOL = Math.PI * Math.pow(ROLL.inner_diameter_cm / 2, 2) * ROLL.length_cm;   // ROLL_VOLUME_ML ≈ 159.04
  var ROOM = VOL * ROLL.packing * (1 - ROLL.dispenser_loss);                       // ≈ 85.9 mL of seeds that come out
  function perRoll(v) { return Math.max(1, Math.floor(ROOM / v)); }                   // seeds_per_roll()
  function slotsFor(v) { return Math.floor(VOL * ROLL.packing / v); }                // seeds that fit before the jam
  function species(biome, common, fb) {
    var b = D.biomes && D.biomes[biome], s = b && b.species.filter(function (x) { return x.common === common; })[0];
    return s || fb;
  }
  var ACORN = species("oak_hickory", "White oak", { common: "White oak", volume_ml: 3.2 });
  var BALL = species("tropical_moist_forest", "Balsa", { common: "Balsa", volume_ml: 1.8 });
  var PINE = species("sierra_mixed_conifer", "Ponderosa pine", { common: "Ponderosa pine", volume_ml: 0.09 });
  var HICKORY = species("oak_hickory", "Mockernut hickory", { common: "Mockernut hickory", volume_ml: 7 });
  var PARICA = species("tropical_moist_forest", "Paricá", { common: "Paricá", volume_ml: 1.4 });
  var FIELD = (D.drones && D.drones.field) || { rolls_per_sortie: 4 };

  function hasDialog() { return !!document.querySelector(".rq-overlay, .rq-talk"); }
  function keys1(L, fn) { var w = L.on(window, "keydown", fn); return function () { window.removeEventListener("keydown", w); }; }
  function n1(x) { return u.fmt(x, 1); }

  /* ------------------------------------------------------------ drawing */
  function gear(ctx, x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = "#b8c2cc"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath();
    for (var i = 0; i < 16; i++) { var an = i / 16 * Math.PI * 2, rr = i % 2 ? r : r * 1.22; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * .35, 0, 7); ctx.fillStyle = "#7d8a97"; ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function factory(ctx, W, H, t) {
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#fbe9d0"); g.addColorStop(1, "#f1d3ad");
    ctx.fillStyle = g; ctx.fillRect(-2, -2, W + 4, H + 4);
    ctx.strokeStyle = "rgba(160,110,60,.16)"; ctx.lineWidth = 2;
    for (var y = 50, r = 0; y < H - 70; y += 34, r++) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      for (var x = (r % 2) * 40; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 34); ctx.stroke(); }
    }
    ctx.fillStyle = "#9aa7b4"; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillRect(-4, 20, W + 8, 16); ctx.strokeRect(-4, 20, W + 8, 16);
    gear(ctx, W - 60, 96, 30, t * .6); gear(ctx, W - 108, 132, 19, -t * .95);
    ctx.fillStyle = "#7d8a97"; ctx.fillRect(-4, H - 56, W + 8, 60); ctx.strokeRect(-4, H - 56, W + 8, 60);
    ctx.fillStyle = "#ffd23f";
    for (var sx = -((t * 20) % 60); sx < W; sx += 60) { ctx.beginPath(); ctx.moveTo(sx, H - 56); ctx.lineTo(sx + 26, H - 56); ctx.lineTo(sx + 12, H - 44); ctx.lineTo(sx - 14, H - 44); ctx.closePath(); ctx.fill(); }
  }
  /** Cut-away toilet-paper roll. r = inner cavity {x, y, w, h}. Rear (left) end is blocked, front (right) end is the dispenser. */
  function tube(ctx, r, water) {
    ctx.fillStyle = "#fff3dc"; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "rgba(200,150,90,.16)"; ctx.fillRect(r.x, r.y, r.w, r.h * .16); ctx.fillRect(r.x, r.y + r.h * .84, r.w, r.h * .16);
    if (water) { ctx.fillStyle = "rgba(60,150,230,.55)"; ctx.fillRect(r.x, r.y + r.h * (1 - water), r.w, r.h * water); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    var wall = Math.max(10, r.h * .07);
    [r.y - wall, r.y + r.h].forEach(function (wy) {
      ctx.fillStyle = "#c98d52"; ctx.fillRect(r.x - 4, wy, r.w + 8, wall); ctx.strokeRect(r.x - 4, wy, r.w + 8, wall);
      ctx.strokeStyle = "rgba(120,70,30,.45)"; ctx.lineWidth = 2;
      for (var sx = r.x + 10; sx < r.x + r.w; sx += 46) { ctx.beginPath(); ctx.moveTo(sx, wy + wall); ctx.lineTo(sx + 26, wy); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
    });
    ctx.fillStyle = "#a86c36"; ctx.fillRect(r.x - 22, r.y - wall, 20, r.h + wall * 2); ctx.strokeRect(r.x - 22, r.y - wall, 20, r.h + wall * 2);
    ctx.beginPath(); ctx.ellipse(r.x + r.w + 4, r.y + r.h / 2, Math.max(6, r.h * .04), r.h / 2 + wall, 0, 0, 7); ctx.strokeStyle = "#a86c36"; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
  }
  function acorn(ctx, x, y, s, rot, tint) {
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.lineWidth = Math.max(1.5, s * .09); ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, s * .18, s * .72, s * .8, 0, 0, 7); ctx.fillStyle = tint || "#d99a4e"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -s * .3, s * .85, s * .42, 0, Math.PI, 0); ctx.lineTo(s * .85, -s * .3); ctx.closePath(); ctx.fillStyle = "#7a4b2a"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * .7); ctx.lineTo(s * .12, -s * .95); ctx.stroke();
    ctx.restore();
  }
  function seedBall(ctx, x, y, s, tint) {
    ctx.beginPath(); ctx.arc(x, y, s * .8, 0, 7); ctx.fillStyle = tint || "#9b7653"; ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * .08); ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = "#6b4d33"; ctx.beginPath(); ctx.arc(x - s * .25, y - s * .2, s * .12, 0, 7); ctx.arc(x + s * .3, y + s * .1, s * .1, 0, 7); ctx.fill();
  }
  function pineSeed(ctx, x, y, s, tint) {
    ctx.fillStyle = tint || "#5b3a22"; ctx.beginPath(); ctx.ellipse(x, y, s * .55, s * .85, .5, 0, 7); ctx.fill();
  }
  function drawSeed(kind, ctx, x, y, s, tint) { if (kind === "acorn") acorn(ctx, x, y, s, 0, tint); else if (kind === "ball") seedBall(ctx, x, y, s, tint); else pineSeed(ctx, x, y, s, tint); }
  function slotMark(ctx, x, y, s) {
    ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(29,43,58,.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, s * .8, s * .9, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  function smallRoll(ctx, x, y, s) {
    ctx.fillStyle = "#c98d52"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.fillRect(x - s, y - s * .55, s * 2, s * 1.1); ctx.strokeRect(x - s, y - s * .55, s * 2, s * 1.1);
    ctx.beginPath(); ctx.ellipse(x + s, y, s * .3, s * .55, 0, 0, 7); ctx.fillStyle = "#e7b98a"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + s, y, s * .14, s * .3, 0, 0, 7); ctx.fillStyle = "#7a4b2a"; ctx.fill();
  }
  /** Field drone, side view, with a carousel of `cap` roll slots and `load` rolls in it. */
  function droneArt(ctx, x, y, s, t, load, cap, spin) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-80, -18); ctx.lineTo(80, -18); ctx.stroke();
    [-80, 80].forEach(function (rx) {
      ctx.fillStyle = "#3a4654"; ctx.fillRect(rx - 6, -30, 12, 14);
      var w = spin ? 46 * Math.abs(Math.sin(t * 40 + rx)) + 8 : 46;
      ctx.beginPath(); ctx.ellipse(rx, -34, w, 6, 0, 0, 7); ctx.fillStyle = "rgba(200,220,240,.85)"; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    });
    ctx.lineWidth = 3; u.rr(ctx, -46, -30, 92, 34, 12); ctx.fillStyle = "#2b7bd0"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(30, -14, 5, 0, 7); ctx.fillStyle = Math.sin(t * 6) > 0 ? "#7ee787" : "#2f9e4f"; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 13px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("FIELD", -8, -13);
    // carousel
    var cw = 30, cx0 = -(cap * cw) / 2;
    ctx.fillStyle = "#e6edf3"; u.rr(ctx, cx0 - 6, 6, cap * cw + 12, 30, 8); ctx.fill(); ctx.stroke();
    for (var i = 0; i < cap; i++) {
      var sx = cx0 + i * cw + cw / 2;
      if (i < load) smallRoll(ctx, sx - 3, 21, 11);
      else { ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(29,43,58,.4)"; ctx.strokeRect(sx - 13, 12, 26, 18); ctx.setLineDash([]); ctx.strokeStyle = INK; }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ number pad question panel */
  function numberQuestion(L, parent, o) {
    // o: {prompt, calc, want, hint, wrongMsg(v)} -> Promise<number of mistakes>
    var box = u.el("div", { class: "rf-q" }); parent.appendChild(box);
    box.appendChild(u.el("div", { class: "prompt", html: RQ.ui.md(o.prompt) }));
    if (o.calc) box.appendChild(u.el("div", { class: "calc", text: o.calc }));
    var disp = u.el("div", { class: "rf-disp", text: "?" }); box.appendChild(disp);
    var tip = u.el("div", { class: "muted", style: { minHeight: "1.3em", fontSize: ".95rem" } }); box.appendChild(tip);
    var pad = u.el("div", { class: "rf-pad" }); box.appendChild(pad);
    var typed = "", mistakes = 0;
    return new Promise(function (res) {
      function show() { disp.textContent = typed || "?"; disp.classList.remove("no", "ok"); }
      function key(k) {
        if (!L.alive) return;
        if (k === "⌫") typed = typed.slice(0, -1);
        else if (k === "✓") {
          if (!typed) return;
          var v = parseFloat(typed);
          if (v === o.want) { disp.classList.add("ok"); RQ.audio.sfx("good"); off(); L.timeout(function () { box.remove(); res({ mistakes: mistakes }); }, 650); return; }
          mistakes++; RQ.audio.sfx("bad"); disp.classList.add("no"); disp.classList.add("shake");
          L.timeout(function () { disp.classList.remove("shake"); }, 400);
          tip.innerHTML = RQ.ui.md("💡 " + ((o.wrongMsg && o.wrongMsg(v)) || o.hint) + (mistakes >= 2 ? " It's **" + o.want + "**." : ""));
          if (o.onWrong) o.onWrong(v);
          typed = ""; return;
        } else if (typed.length < 7) typed += k;
        RQ.audio.sfx("type"); show();
      }
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].forEach(function (k) { pad.appendChild(u.el("button", { class: "btn", text: k, onclick: function () { key(k); } })); });
      pad.appendChild(u.el("button", { class: "btn", text: "⌫", "aria-label": "delete", onclick: function () { key("⌫"); } }));
      pad.appendChild(u.el("button", { class: "btn go", style: { gridColumn: "span 4" }, html: "✓ Check", onclick: function () { key("✓"); } }));
      var off = keys1(L, function (e) {
        if (hasDialog()) return;
        if (/^[0-9]$/.test(e.key)) key(e.key); else if (e.key === "Backspace") key("⌫"); else if (e.key === "Enter") key("✓"); else return;
        e.preventDefault();
      });
    });
  }
  /** Choice buttons inside `parent`; resolves with the number of wrong picks. */
  function choiceRow(L, parent, labels, ans, onWrong) {
    var row = u.el("div", { class: "rf-choices" }); parent.appendChild(row);
    return new Promise(function (res) {
      var wrong = 0, btns = [];
      function pick(k) {
        if (!L.alive || btns[k].disabled) return;
        if (k === ans) { off(); RQ.audio.sfx("good"); btns[k].classList.add("yes"); btns.forEach(function (b) { b.disabled = true; }); L.timeout(function () { res(wrong); }, 500); }
        else { wrong++; RQ.audio.sfx("bad"); btns[k].classList.add("no", "shake"); btns[k].disabled = true; if (onWrong) onWrong(k); }
      }
      labels.forEach(function (l, k) { var b = u.el("button", { class: "btn", html: "<b>" + (k + 1) + "</b>&nbsp; " + l, onclick: function () { pick(k); } }); btns.push(b); row.appendChild(b); });
      var off = keys1(L, function (e) { if (!hasDialog() && /^[1-9]$/.test(e.key) && +e.key <= labels.length) { e.preventDefault(); pick(+e.key - 1); } });
    });
  }
  /** Blueprint panel: lines appear one by one; resolves on "Got it". */
  function blueprint(L, parent, title, lines, py) {
    var bp = u.el("div", { class: "rf-blue" }); bp.appendChild(u.el("h3", { text: title }));
    var els = lines.map(function (l) { var e = u.el("div", { class: "ln", html: RQ.ui.md(l) }); bp.appendChild(e); return e; });
    var pyEl = py ? u.el("div", { class: "ln py", html: RQ.code.highlight(py) }) : null; if (pyEl) { bp.appendChild(pyEl); els.push(pyEl); }
    var btn = u.el("button", { class: "btn go", html: "✓ Got it", disabled: true }); bp.appendChild(u.el("div", { class: "btns" }, btn));
    parent.appendChild(bp);
    return new Promise(function (res) {
      var i = 0;
      (function nextLine() {
        if (!L.alive) return;
        if (i < els.length) { els[i].classList.add("on"); RQ.audio.sfx("pop"); i++; L.timeout(nextLine, 750); return; }
        btn.disabled = false; btn.focus();
      })();
      btn.onclick = function () { RQ.audio.sfx("click"); bp.remove(); res(); };
    });
  }

  /* ================================================================ L1 fill one roll */
  function levelFill(L) {
    var wrap = u.el("div", { class: "rf-wrap" }), top = u.el("div", { class: "rf-top" }), cvBox = u.el("div", { class: "rf-canvas" });
    var bar = u.el("div", { class: "rf-bar" }); top.appendChild(cvBox); wrap.appendChild(top); wrap.appendChild(bar); L.stage.appendChild(wrap);
    var cv = L.canvas({ w: 1100, h: 500, parent: cvBox, fill: true, label: "Toilet-paper roll with acorn slots" }), ctx = cv.ctx;
    var nSlots = slotsFor(ACORN.volume_ml), out = perRoll(ACORN.volume_ml), jam = nSlots - out; // 29, 26, 3
    var R = { x: 0, y: 140, w: 540, h: 243 };
    var slots = [], phase = "fill", filled = 0, water = 0, flying = [], basket = 0, parts = [], qOk = false;
    function geo() {
      R.x = cv.w / 2 - 330;
      var rows = [Math.ceil(nSlots / 3), Math.floor(nSlots / 3), nSlots - Math.ceil(nSlots / 3) - Math.floor(nSlots / 3)];
      var pts = [], sp = R.w / Math.max(rows[0], 1);
      rows.forEach(function (cnt, ri) {
        for (var i = 0; i < cnt; i++) pts.push({ x: R.x + sp * (i + .5 + (cnt < rows[0] ? .5 : 0)), y: R.y + R.h * (ri + .5) / 3 });
      });
      pts.sort(function (a, b) { return a.x - b.x || a.y - b.y; });
      pts.forEach(function (p, i) { if (!slots[i]) slots[i] = { full: false, out: false, jam: false }; slots[i].x = p.x; slots[i].y = p.y; });
    }
    geo();
    for (var j = 0; j < jam; j++) slots[j].jam = true; // the rear-most seeds stay stuck
    var hopper = function () { return { x: R.x + R.w + 150, y: 120 }; };
    var dropBtn = u.el("button", { class: "btn primary big", html: "🌰 Drop acorn <small>(Space)</small>" });
    var msg = u.el("div", { class: "rf-msg", html: RQ.ui.md("Fill every dashed slot: **0 / " + nSlots + "**") });
    bar.appendChild(msg); bar.appendChild(dropBtn);
    L.hud.set("roll", "🌰 0 / " + nSlots);
    function fillSlot(i) {
      if (phase !== "fill" || !slots[i] || slots[i].full) return;
      slots[i].full = true; var h = hopper();
      flying.push({ i: i, x0: h.x, y0: h.y + 40, t: 0 });
      RQ.audio.sfx("drop");
    }
    function nextEmpty() { for (var i = 0; i < slots.length; i++) if (!slots[i].full) return i; return -1; }
    var holding = false, holdT = 0;
    L.on(dropBtn, "pointerdown", function () { holding = true; holdT = 0; var i = nextEmpty(); if (i >= 0) fillSlot(i); });
    L.on(window, "pointerup", function () { holding = false; });
    L.on(window, "keydown", function (e) {
      if (hasDialog() || phase !== "fill") return;
      if (e.key === " ") { e.preventDefault(); if (!e.repeat) { var i = nextEmpty(); if (i >= 0) fillSlot(i); } holding = true; }
    });
    L.on(window, "keyup", function (e) { if (e.key === " ") holding = false; });
    L.on(cv.cv, "pointerdown", function (e) {
      var p = cv.toLocal(e);
      for (var i = 0; i < slots.length; i++) if (!slots[i].full && u.dist(p.x, p.y, slots[i].x, slots[i].y) < 30) { fillSlot(i); return; }
    });

    async function afterFull() {
      phase = "full"; dropBtn.remove(); L.hud.set("roll", "🌰 " + nSlots + " / " + nSlots);
      await L.wait(500); if (!L.alive) return;
      await L.say("mo", "Full to the brim, but is it really full? Let's pour in some water and see!", { mood: "think" });
      if (!L.alive) return;
      msg.innerHTML = RQ.ui.md("Is the roll **really** full?");
      var wb = u.el("button", { class: "btn primary big", html: "💧 Pour water" }); bar.appendChild(wb); wb.focus();
      await new Promise(function (r) { wb.onclick = r; }); if (!L.alive) return;
      wb.remove(); phase = "water"; RQ.audio.sfx("splash");
      await L.wait(2300); if (!L.alive) return;
      msg.innerHTML = RQ.ui.md("Water filled the gaps! ReSeed's plan assumes round seeds fill about **60 %** of a roll; the rest is air.");
      await L.wait(1600); if (!L.alive) return;
      var tb = u.el("button", { class: "btn primary big", html: "🧪 Test the dispenser" }); bar.appendChild(tb); tb.focus();
      await new Promise(function (r) { tb.onclick = r; }); if (!L.alive) return;
      tb.remove(); phase = "drain";
      await L.wait(900); if (!L.alive) return;
      phase = "test"; msg.innerHTML = RQ.ui.md("Shake, shake! Count the acorns that land in the basket…");
      for (var i = slots.length - 1; i >= 0; i--) {
        if (slots[i].jam) continue;
        slots[i].out = true; flying.push({ i: i, out: true, x0: slots[i].x, y0: slots[i].y, t: 0 });
        RQ.audio.sfx("pop"); await L.wait(130); if (!L.alive) return;
      }
      await L.wait(700); if (!L.alive) return;
      RQ.audio.sfx("giggle");
      msg.innerHTML = RQ.ui.md("How many acorns came out to plant? (" + jam + " stayed stuck at the back: game version)");
      var wrong = await choiceRow(L, bar, [String(nSlots), String(out), String(jam)], 1, function () { msg.innerHTML = RQ.ui.md("💡 All " + nSlots + " went in, but **" + jam + "** stayed stuck. " + nSlots + " − " + jam + " = ?"); });
      if (!L.alive) return;
      qOk = wrong === 0; bar.innerHTML = "";
      bar.appendChild(u.el("div", { class: "rf-msg", html: RQ.ui.md("**" + out + " acorns** per roll. Now see the factory's secret recipe!") }));
      await blueprint(L, cvBox, "🧾 How ReSeed counts seeds per roll", [
        "📏 The roll is **4.5 cm** wide inside and **10 cm** long: room = **π × 2.25 × 2.25 × 10 ≈ " + Math.round(VOL) + " mL**",
        "🌰 ReSeed plans for round seeds filling **60 %**: " + Math.round(VOL) + " × 0.6 ≈ " + Math.round(VOL * .6) + " mL of acorns → **" + nSlots + "** acorns of " + ACORN.volume_ml + " mL",
        "🧲 It allows for about **10 %** to jam or stay in the roll: × 0.9 → **" + out + "** acorns fly out"
      ], "seeds_per_roll = int(" + Math.round(VOL) + " * 0.6 * 0.9 / " + ACORN.volume_ml + ")   # → " + out);
      if (!L.alive) return;
      L.win({ stars: qOk ? 3 : 2, msg: "One roll = **" + out + "** white-oak acorns. You found the gaps and the jams yourself!", stats: { "Slots filled": nSlots, "Acorns out": out } });
    }

    L.loop(function (dt, t) {
      var W = cv.w; geo(); factory(ctx, W, 500, t);
      if (holding && phase === "fill") { holdT += dt; if (holdT > .16) { holdT = 0; var ni = nextEmpty(); if (ni >= 0) fillSlot(ni); } }
      if (phase === "water" || phase === "drain") water = phase === "water" ? Math.min(1, water + dt * .5) : Math.max(0, water - dt * 1.6);
      // size labels
      ctx.fillStyle = INK; ctx.font = "700 18px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(R.x, R.y - 44); ctx.lineTo(R.x + R.w, R.y - 44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(R.x, R.y - 52); ctx.lineTo(R.x, R.y - 36); ctx.moveTo(R.x + R.w, R.y - 52); ctx.lineTo(R.x + R.w, R.y - 36); ctx.stroke();
      ctx.fillStyle = "#fbe9d0"; ctx.fillRect(R.x + R.w / 2 - 44, R.y - 56, 88, 24); ctx.fillStyle = INK; ctx.fillText(ROLL.length_cm + " cm", R.x + R.w / 2, R.y - 44);
      ctx.beginPath(); ctx.moveTo(R.x - 46, R.y); ctx.lineTo(R.x - 46, R.y + R.h); ctx.stroke();
      ctx.save(); ctx.translate(R.x - 62, R.y + R.h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(ROLL.inner_diameter_cm + " cm", 0, 0); ctx.restore();
      tube(ctx, R, water);
      // hopper
      var h = hopper();
      ctx.fillStyle = "#9aa7b4"; ctx.beginPath(); ctx.moveTo(h.x - 70, h.y - 80); ctx.lineTo(h.x + 70, h.y - 80); ctx.lineTo(h.x + 18, h.y + 30); ctx.lineTo(h.x - 18, h.y + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (var a = 0; a < 6; a++) acorn(ctx, h.x - 40 + a * 16, h.y - 62 + (a % 2) * 10, 11, a * .4);
      ctx.fillStyle = INK; ctx.font = "700 15px Fredoka, sans-serif"; ctx.fillText("ACORNS", h.x, h.y - 94);
      // basket
      var bx = R.x + R.w + 150, by = 420;
      ctx.fillStyle = "#c8a165"; ctx.beginPath(); ctx.moveTo(bx - 80, by - 40); ctx.lineTo(bx + 80, by - 40); ctx.lineTo(bx + 60, by + 20); ctx.lineTo(bx - 60, by + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (var bi = 0; bi < Math.min(basket, 30); bi++) acorn(ctx, bx - 60 + (bi % 10) * 13, by - 44 - Math.floor(bi / 10) * 10, 8, bi);
      ctx.fillStyle = INK; ctx.font = "700 18px Fredoka, sans-serif"; ctx.fillText("Basket: " + basket, bx, by + 40);
      // slots + seeds
      slots.forEach(function (s, i) {
        var inAir = flying.some(function (f) { return f.i === i; });
        if (!s.full) { slotMark(ctx, s.x, s.y, 30); return; }
        if (s.out || inAir) return;
        var wob = s.jam && phase === "test" ? Math.sin(t * 20 + i) * .15 : 0;
        acorn(ctx, s.x, s.y + 4, 30, wob, s.jam && phase === "test" ? "#e8a07c" : null);
        if (s.jam && phase === "test") { ctx.fillStyle = "#d1495b"; ctx.font = "700 22px Fredoka, sans-serif"; ctx.fillText("✕", s.x, s.y - 34); }
      });
      // flying seeds (in from the hopper, or out to the basket)
      flying = flying.filter(function (f) {
        f.t += dt / (f.out ? .45 : .35);
        var k = Math.min(1, f.t), s = slots[f.i], x1 = f.out ? bx : s.x, y1 = f.out ? by - 46 : s.y + 4;
        var tx = f.out ? R.x + R.w + 10 : x1;
        var x = f.out ? (k < .3 ? u.lerp(f.x0, tx, k / .3) : u.lerp(tx, bx, (k - .3) / .7)) : u.lerp(f.x0, x1, k);
        var y = f.out ? (k < .3 ? u.lerp(f.y0, R.y + R.h / 2, k / .3) : u.lerp(R.y + R.h / 2, y1, (k - .3) / .7) - Math.sin((k - .3) / .7 * Math.PI) * 60) : u.lerp(f.y0, y1, k) - Math.sin(k * Math.PI) * 50;
        acorn(ctx, x, y, f.out ? 20 : 26, k * 6);
        if (k >= 1) {
          if (f.out) { basket++; }
          else {
            filled++; RQ.audio.sfx("pop");
            for (var p = 0; p < 6; p++) parts.push({ x: s.x, y: s.y, vx: u.rand(-90, 90), vy: u.rand(-160, -40), life: .5 });
            msg.innerHTML = RQ.ui.md("Fill every dashed slot: **" + filled + " / " + nSlots + "**"); L.hud.set("roll", "🌰 " + filled + " / " + nSlots);
            if (filled === nSlots) afterFull();
          }
          return false;
        }
        return true;
      });
      parts = parts.filter(function (p) { p.life -= dt; p.vy += 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; return p.life > 0; });
      if (phase === "water" && water > .95) {
        ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, R.x + R.w / 2 - 150, R.y + R.h + 34, 300, 40, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#1f5fa8"; ctx.font = "700 20px Fredoka, sans-serif"; ctx.fillText("💧 About 40 % of the roll is gaps!", R.x + R.w / 2, R.y + R.h + 54);
      }
    });
    if (L.fails >= 1) L.timeout(function () { L.toast("💡 Hold Space or the button to drop acorns fast.", "info", 2600); }, 400);
  }

  /* ================================================================ L2 seed sizes */
  function levelSizes(L) {
    var SEEDS = [
      { kind: "acorn", sp: ACORN, name: "Acorn", desc: "white oak, Ozarks" },
      { kind: "ball", sp: BALL, name: "Seed ball", desc: "clay ball with balsa seeds, Amazon" },
      { kind: "pine", sp: PINE, name: "Pine seed", desc: "ponderosa pine, Sierra Nevada" }
    ];
    var wrap = u.el("div", { class: "rf-wrap" }), top = u.el("div", { class: "rf-top" }), side = u.el("div", { class: "rf-side" }), cvBox = u.el("div", { class: "rf-canvas" });
    var bar = u.el("div", { class: "rf-bar" });
    top.appendChild(side); top.appendChild(cvBox); wrap.appendChild(top); wrap.appendChild(bar); L.stage.appendChild(wrap);
    var cv = L.canvas({ w: 900, h: 500, parent: cvBox, fill: true, label: "Seed stuffing machine" }), ctx = cv.ctx;
    side.appendChild(u.el("div", { class: "rf-title", text: "🏭 Pick a seed" }));
    var table = u.el("table", { class: "rf-table" });
    table.innerHTML = "<tr><th>Seed</th><th>Size</th><th>Per roll</th></tr>";
    var mistakes = 0, cur = null, fill = 0, state = "idle", done = {}, slots = [], outCount = 0;
    var R = { x: 0, y: 120, w: 520, h: 234 };
    SEEDS.forEach(function (s, i) {
      s.slots = slotsFor(s.sp.volume_ml); s.out = perRoll(s.sp.volume_ml);
      s.btn = u.el("button", { class: "btn rf-seedbtn", html: "<span><b>" + (i + 1) + " " + s.name + "</b><small>" + s.sp.volume_ml + " mL each · " + s.desc + "</small></span>", onclick: function () { choose(s); } });
      side.appendChild(s.btn);
      s.row = u.el("tr", {}, u.el("td", { text: s.name }), u.el("td", { class: "n", text: s.sp.volume_ml + " mL" }), u.el("td", { class: "n", text: "?" }));
      table.appendChild(s.row);
    });
    side.appendChild(table);
    var msg = u.el("div", { class: "rf-msg" }); bar.appendChild(msg);
    var lever = u.el("button", { class: "btn primary big", html: "⬇ Stuff! <small>(hold Space)</small>", disabled: true }); bar.appendChild(lever);
    function layout(n) {
      var ratio = R.w / R.h, rows = Math.max(1, Math.round(Math.sqrt(n / ratio))), cols = Math.ceil(n / rows), cw = R.w / cols, rh = R.h / rows, pts = [];
      for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) { if (pts.length >= n) break; pts.push({ x: R.x + cw * (c + .5), y: R.y + rh * (r + .5) }); }
      return { pts: pts, s: Math.min(cw, rh) * .5 };
    }
    var lay = null;
    function choose(s) {
      if (state === "stuffing" || state === "counting" || state === "locked" || !L.alive) return;
      cur = s; fill = 0; outCount = 0; state = "ready"; lay = layout(s.slots);
      SEEDS.forEach(function (x) { x.btn.classList.toggle("on", x === s); });
      lever.disabled = false; RQ.audio.sfx("select");
      msg.innerHTML = RQ.ui.md("**" + s.name + "** (" + s.sp.volume_ml + " mL): hold the lever to stuff the roll!");
    }
    var holding = false;
    L.on(lever, "pointerdown", function () { if (!lever.disabled) holding = true; });
    L.on(window, "pointerup", function () { holding = false; });
    L.on(window, "keydown", function (e) {
      if (hasDialog() || state === "locked") return;
      if (e.key === " " && !lever.disabled) { e.preventDefault(); holding = true; }
      else if (/^[1-3]$/.test(e.key) && state !== "stuffing") choose(SEEDS[+e.key - 1]);
    });
    L.on(window, "keyup", function (e) { if (e.key === " ") holding = false; });

    async function dispense(s) {
      state = "counting"; lever.disabled = true; holding = false;
      msg.innerHTML = RQ.ui.md("Full! Now the dispenser test…"); RQ.audio.sfx("whoosh");
      var t0 = 0, dur = 1.6;
      await new Promise(function (r) { var id = L.interval(function () { t0 += .05; outCount = Math.min(s.out, Math.round(s.out * t0 / dur)); if (t0 >= dur) { clearInterval(id); r(); } }, 50); });
      if (!L.alive) return;
      outCount = s.out; RQ.audio.sfx("coin");
      s.row.lastChild.textContent = u.fmt(s.out); s.btn.classList.add("done"); done[s.kind] = true;
      msg.innerHTML = RQ.ui.md("**" + u.fmt(s.out) + "** " + s.name.toLowerCase() + "s per roll (" + u.fmt(s.slots - s.out) + " jammed)." + (Object.keys(done).length < 3 ? " Pick another seed!" : ""));
      state = "emptied";
      if (Object.keys(done).length === 3) { state = "locked"; L.timeout(finish, 1200); }
    }

    async function finish() {
      if (!L.alive) return;
      lever.remove();
      await L.say("pix", "Smaller seeds, more per roll! The factory uses one tiny formula for all of them, ready to crack it?");
      if (!L.alive) return;
      await blueprint(L, cvBox, "🧾 The seeds-per-roll recipe", [
        "Every roll has the same seed room: **" + Math.round(VOL) + " mL × 0.6 × 0.9 ≈ " + n1(ROOM) + " mL** (gaps and jams taken out)",
        "Divide by the size of one seed, then **chop off the decimals** with `int()`",
        "Acorn: " + n1(ROOM) + " ÷ " + ACORN.volume_ml + " = " + (ROOM / ACORN.volume_ml).toFixed(2) + " → **" + perRoll(ACORN.volume_ml) + "**"
      ], "def seeds_per_roll(volume_ml):\n    return max(1, int(ROLL_VOLUME_ML * PACKING * (1 - DISPENSER_LOSS) / volume_ml))");
      if (!L.alive) return;
      var qs = [
        { sp: HICKORY, label: "**mockernut hickory** nuts (" + HICKORY.volume_ml + " mL each, Ozarks)" },
        { sp: PARICA, label: "**Paricá** seeds (" + PARICA.volume_ml + " mL each, Amazon)" }
      ];
      for (var i = 0; i < qs.length; i++) {
        var q = qs[i], exact = ROOM / q.sp.volume_ml, want = perRoll(q.sp.volume_ml);
        msg.innerHTML = RQ.ui.md("Your turn: use `int()` to drop the decimal part.");
        var r = await numberQuestion(L, cvBox, {
          prompt: "How many of " + q.label + " fit in one roll?", calc: n1(ROOM) + " ÷ " + q.sp.volume_ml + " = " + exact.toFixed(2) + "  → int() → ?",
          want: want, hint: "`int()` keeps only the whole number before the dot.",
          wrongMsg: function (v) { return v === want + 1 ? "That rounds **up**. `int()` always chops the decimals off: you can't pack part of a seed!" : null; }
        });
        if (!L.alive) return;
        mistakes += r.mistakes;
        L.toast("✅ " + want + " per roll: int(" + exact.toFixed(2) + ") = " + want, "good", 1800);
      }
      L.win({ stars: mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1, msg: "Acorn **" + perRoll(ACORN.volume_ml) + "**, seed ball **" + perRoll(BALL.volume_ml) + "**, pine seed **" + perRoll(PINE.volume_ml) + "**. You cracked `seeds_per_roll()`!",
        stats: { "Mistakes": mistakes, "Best stuffer": "pine (" + perRoll(PINE.volume_ml) + ")" } });
    }

    L.loop(function (dt, t) {
      var W = cv.w; R.x = W / 2 - R.w / 2 - 20;
      factory(ctx, W, 500, t);
      if (cur && lay) lay = layout(cur.slots);
      tube(ctx, R, 0);
      // hopper with the chosen seed
      var hx = R.x + R.w + 110, hy = 120;
      ctx.fillStyle = "#9aa7b4"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx - 60, hy - 70); ctx.lineTo(hx + 60, hy - 70); ctx.lineTo(hx + 14, hy + 26); ctx.lineTo(hx - 14, hy + 26); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (cur) for (var a = 0; a < 7; a++) drawSeed(cur.kind, ctx, hx - 42 + a * 14, hy - 52 + (a % 2) * 8, cur.kind === "pine" ? 6 : 10);
      ctx.beginPath(); ctx.moveTo(hx, hy + 26); ctx.quadraticCurveTo(hx, R.y + R.h / 2, R.x + R.w + 10, R.y + R.h / 2); ctx.lineWidth = 12; ctx.strokeStyle = "#b8c2cc"; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = INK;
      if (!cur) {
        ctx.fillStyle = INK; ctx.font = "700 24px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("← Pick a seed to load the machine", R.x + R.w / 2, R.y + R.h / 2);
        return;
      }
      if (state === "stuffing" || state === "ready") {
        if (holding) { state = "stuffing"; fill = Math.min(cur.slots, fill + dt * cur.slots / 2.2); if (Math.random() < .5) RQ.audio.sfx("tick"); }
        if (fill >= cur.slots && state === "stuffing") dispense(cur);
      }
      var n = Math.floor(fill), s = lay.s, gone = state === "counting" || state === "emptied" || state === "locked";
      lay.pts.forEach(function (p, i) {
        var jammed = i < cur.slots - cur.out;
        if (gone && !jammed && i >= cur.slots - outCount) return;   // these fell out
        if (i < n) drawSeed(cur.kind, ctx, p.x, p.y, s * (cur.kind === "pine" ? 1.6 : .95), gone && jammed ? "#e8a07c" : null);
        else if (cur.slots < 80) slotMark(ctx, p.x, p.y, s);
      });
      if (cur.slots >= 80 && n < cur.slots) { ctx.fillStyle = "rgba(29,43,58,.06)"; ctx.fillRect(R.x, R.y, R.w, R.h); }
      // counters
      ctx.fillStyle = INK; ctx.font = "700 22px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("In the roll: " + u.fmt(n) + (gone ? "   →   out of the dispenser: " + u.fmt(outCount) : ""), R.x + R.w / 2, R.y + R.h + 48);
    });
    (async function () {
      msg.innerHTML = RQ.ui.md("Guess first!");
      var pick = await L.choose("mo", "Which seed fits the MOST times into one roll?", ["Acorn", "Seed ball", "Pine seed"]);
      if (!L.alive) return;
      if (pick === 2) { RQ.audio.sfx("good"); L.toast("🎯 Good guess! Let's check it.", "good", 1800); } else { mistakes++; RQ.audio.sfx("bad"); L.toast("🤔 Let's find out by stuffing!", "info", 1800); }
      msg.innerHTML = RQ.ui.md("Pick a seed on the left (or press **1**, **2**, **3**).");
    })();
  }

  /* ================================================================ L3 trips & batteries */
  function levelTrips(L) {
    var CAP = FIELD.rolls_per_sortie || 4, TOTAL = 10;
    var wrap = u.el("div", { class: "rf-wrap" }), top = u.el("div", { class: "rf-top" }), cvBox = u.el("div", { class: "rf-canvas" });
    var bar = u.el("div", { class: "rf-bar" }); top.appendChild(cvBox); wrap.appendChild(top); wrap.appendChild(bar); L.stage.appendChild(wrap);
    var cv = L.canvas({ w: 1100, h: 500, parent: cvBox, fill: true, label: "Loading dock with the field drone" }), ctx = cv.ctx;
    var dock = TOTAL, load = 0, trips = 0, moving = [], drone = { st: "pad", t: 0, y: 0, x: 0 }, seeds = [], mistakes = 0, view = null, finished = false;
    var msg = u.el("div", { class: "rf-msg" }), bLoad = u.el("button", { class: "btn primary big", html: "📦 Load roll <small>(Space)</small>" }), bGo = u.el("button", { class: "btn go big", html: "🚀 Launch <small>(Enter)</small>" });
    bar.appendChild(msg); bar.appendChild(bLoad); bar.appendChild(bGo);
    function upd() {
      msg.innerHTML = RQ.ui.md("Rolls on the dock: **" + dock + "** · in the drone: **" + load + " / " + CAP + "**");
      L.hud.set("trips", "🚁 Trips: " + trips);
    }
    upd();
    function doLoad() {
      if (finished || drone.st !== "pad" || dock <= 0) { if (dock <= 0 && !finished) L.toast("No rolls left on the dock. Launch!", "info", 1400); return; }
      if (load + moving.length >= CAP) { RQ.audio.sfx("bad"); L.toast("The carousel holds only **" + CAP + "** rolls. Launch!", "bad", 1600); return; }
      dock--; moving.push({ t: 0 }); RQ.audio.sfx("select"); upd();
    }
    function doGo() {
      if (finished || drone.st !== "pad" || moving.length) return;
      if (load === 0) { RQ.audio.sfx("bad"); drone.bonk = .4; L.toast("🙃 An empty trip? Load a roll first!", "bad", 1500); return; }
      if (load < CAP && dock > 0) L.toast("Only " + load + " rolls on board, but " + dock + " still wait. That costs an extra trip!", "info", 2400);
      drone.st = "up"; drone.t = 0; RQ.audio.sfx("whoosh");
    }
    L.on(bLoad, "click", doLoad); L.on(bGo, "click", doGo);
    L.on(window, "keydown", function (e) {
      if (hasDialog() || finished) return;
      if (e.key === " ") { e.preventDefault(); doLoad(); } else if (e.key === "Enter") { e.preventDefault(); doGo(); }
    });

    function padPos(W) { return { x: W * .7, y: 330 }; }
    L.loop(function (dt, t) {
      var W = cv.w, pad = padPos(W);
      factory(ctx, W, 500, t);
      if (view) { drawGroups(ctx, W, t); return; }
      // conveyor
      var cx0 = 40, cx1 = W * .5, cy = 360;
      ctx.fillStyle = "#4a5866"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, cx0, cy, cx1 - cx0, 26, 12); ctx.fill(); ctx.stroke();
      for (var rx = cx0 + 14; rx < cx1; rx += 36) { ctx.beginPath(); ctx.arc(rx + ((t * 30) % 36), cy + 13, 7, 0, 7); ctx.fillStyle = "#b8c2cc"; ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = "#6a7783"; ctx.fillRect(cx0 + 20, cy + 26, 12, 108); ctx.fillRect(cx1 - 32, cy + 26, 12, 108);
      for (var i = 0; i < dock; i++) smallRoll(ctx, cx1 - 40 - i * 40, cy - 16, 15);
      ctx.fillStyle = INK; ctx.font = "700 18px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Seed rolls (" + TOTAL + " to deliver)", (cx0 + cx1) / 2, cy + 56);
      // pad
      ctx.fillStyle = "#3a4654"; ctx.beginPath(); ctx.ellipse(pad.x, pad.y + 58, 120, 18, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffd23f"; ctx.font = "700 22px Fredoka, sans-serif"; ctx.fillText("H", pad.x, pad.y + 58);
      // rolls moving from conveyor to drone
      moving = moving.filter(function (m) {
        m.t += dt / .55; var k = Math.min(1, m.t);
        var x = u.lerp(cx1 - 40, pad.x - 45 + (load) * 30, k), y = u.lerp(cy - 16, pad.y + 21, k) - Math.sin(k * Math.PI) * 90;
        smallRoll(ctx, x, y, 13);
        if (k >= 1) { load++; RQ.audio.sfx("snap"); upd(); return false; }
        return true;
      });
      // drone states
      var dx = pad.x, dy = pad.y;
      if (drone.st === "up") { drone.t += dt; dy = pad.y - drone.t * 260; dx = pad.x + Math.max(0, drone.t - .5) * 420; if (drone.t > 1.4) { drone.st = "away"; drone.t = 0; for (var s = 0; s < 18; s++) seeds.push({ x: W - 60, y: 120, vx: u.rand(-60, 60), vy: u.rand(-20, 60), life: 1 }); RQ.audio.sfx("bloom"); } }
      else if (drone.st === "away") { drone.t += dt; dx = W + 200; if (drone.t > .7) { drone.st = "back"; drone.t = 0; load = 0; trips++; upd(); } }
      else if (drone.st === "back") { drone.t += dt / 1.1; var k = u.ease.outCubic(Math.min(1, drone.t)); dx = u.lerp(W + 200, pad.x, k); dy = u.lerp(pad.y - 300, pad.y, k); if (drone.t >= 1) { drone.st = "pad"; RQ.audio.sfx("drop"); checkDone(); } }
      if (drone.bonk) { drone.bonk -= dt; dx += Math.sin(t * 60) * 6; }
      droneArt(ctx, dx, dy, 1.25, t, drone.st === "away" ? 0 : load, CAP, drone.st !== "pad");
      seeds = seeds.filter(function (p) { p.life -= dt * .6; p.vy += 200 * dt; p.x += p.vx * dt; p.y += p.vy * dt; acorn(ctx, p.x, p.y, 6, p.life * 9); return p.life > 0; });
      ctx.fillStyle = INK; ctx.font = "700 20px Fredoka, sans-serif"; ctx.fillText("🚁 Trips flown: " + trips, pad.x, 70);
    });

    function checkDone() {
      if (dock > 0 || load > 0 || finished) return;
      finished = true; bLoad.remove(); bGo.remove();
      (async function () {
        var best = Math.ceil(TOTAL / CAP), extra = trips - best;
        await L.wait(400); if (!L.alive) return;
        if (extra > 0) await L.say("koa", "All delivered, but we used some extra trips! Taking full loads would need fewer.", { mood: "think" });
        else await L.say("koa", "All delivered! Two full trips, and one trip with just two rolls.", { mood: "happy" });
        if (!L.alive) return;
        msg.innerHTML = RQ.ui.md("You flew **" + trips + "** trips.");
        await blueprint(L, cvBox, "🧾 Why the answer rounds UP", [
          TOTAL + " rolls ÷ " + CAP + " per trip = **" + (TOTAL / CAP) + "** trips",
          "But you can't fly **half** a trip! The last 2 rolls still need a whole trip.",
          "`math.ceil()` rounds **up** to the next whole number: ceil(" + (TOTAL / CAP) + ") = **" + best + "**"
        ], "import math\ntrips = math.ceil(" + TOTAL + " / " + CAP + ")   # → " + best);
        if (!L.alive) return;
        var QS = [
          { n: 9, k: CAP, icon: "roll", box: "trip", prompt: "**9 rolls**, " + CAP + " per trip. How many trips?", unit: "trips" },
          { n: 11, k: 4, icon: "trip", box: "battery", prompt: "One battery lasts **4 trips** (like ReSeed's plan for Rondônia). **11 trips**: how many battery charges?", unit: "charges" },
          { n: 140, k: perRoll(ACORN.volume_ml), icon: "acorn", box: "roll", prompt: "**140 acorns**, " + perRoll(ACORN.volume_ml) + " fit in a roll. How many rolls?", unit: "rolls" }
        ];
        for (var i = 0; i < QS.length; i++) {
          var q = QS[i], want = Math.ceil(q.n / q.k);
          view = { q: q, boxes: 0, left: false, t: 0 };
          msg.innerHTML = RQ.ui.md("Round **up** with `math.ceil()`!");
          var r = await numberQuestion(L, cvBox, {
            prompt: q.prompt, calc: q.n + " ÷ " + q.k + " = " + (Math.round(q.n / q.k * 100) / 100) + "  → math.ceil() → ?", want: want,
            hint: "Round **up**: a part-full " + q.box + " still counts.",
            onWrong: function (v) { if (v > 0 && v < 60) { view.boxes = v; view.left = true; view.t = 0; RQ.audio.sfx("giggle"); } },
            wrongMsg: function (v) { return v < want ? "Some " + (q.icon === "acorn" ? "acorns" : q.icon === "roll" ? "rolls" : "trips") + " got **left behind**! Round up." : null; }
          });
          if (!L.alive) return;
          mistakes += r.mistakes; view.boxes = want; view.left = false; view.t = 0; RQ.audio.sfx("powerup");
          await L.wait(1400); if (!L.alive) return;
        }
        var stars = (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1) - (extra > 1 ? 1 : 0);
        L.win({ stars: Math.max(1, stars), msg: "Trips, batteries and rolls all round **up**. Nothing gets left behind!", stats: { "Trips flown": trips + " (best " + best + ")", "Mistakes": mistakes } });
      })();
    }

    /** Items packed into boxes of k (after an answer), or in a loose pile (before). Leftovers glow red. */
    function drawGroups(ctx, W, t) {
      var q = view.q, n = q.n, k = q.k; view.t += 1 / 60;
      var maxW = W * .6, x0 = 40, y0 = 96;
      ctx.fillStyle = INK; ctx.font = "700 22px Fredoka, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(n + " " + (q.icon === "trip" ? "trips" : q.icon === "roll" ? "rolls" : "acorns") + " → " + q.unit + " of " + k, x0, 64);
      var cols = Math.ceil(Math.sqrt(k)), rows = Math.ceil(k / cols), cell = q.icon === "acorn" ? 26 : 50;
      var bw = cols * cell + 16, bh = rows * cell + 34, per = Math.max(1, Math.floor(maxW / (bw + 12)));
      function icon(x, y, c) {
        if (q.icon === "roll") smallRoll(ctx, x, y, 16);
        else if (q.icon === "acorn") acorn(ctx, x, y, 10, 0, c);
        else { droneArt(ctx, x, y + 8, .2, 0, 0, 1, false); if (c) { ctx.fillStyle = "rgba(209,73,91,.35)"; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill(); } }
      }
      if (!view.boxes) {
        var pc = Math.floor(maxW / cell);
        for (var i = 0; i < n; i++) icon(x0 + 14 + (i % pc) * cell, y0 + 30 + Math.floor(i / pc) * cell);
        return;
      }
      var placed = 0;
      for (var b = 0; b < view.boxes; b++) {
        var bx = x0 + (b % per) * (bw + 12), by = y0 + Math.floor(b / per) * (bh + 12);
        var pop = Math.min(1, view.t * 3 - b * .2); if (pop <= 0) continue;
        ctx.save(); ctx.globalAlpha = pop;
        ctx.fillStyle = "#fff8e6"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.font = "700 14px Fredoka, sans-serif"; ctx.textAlign = "left"; ctx.fillText((q.box === "battery" ? "🔋 " : q.box === "trip" ? "🚁 " : "🧻 ") + q.box + " " + (b + 1), bx + 8, by + 14);
        for (var s = 0; s < k && placed < n; s++, placed++) icon(bx + 8 + cell / 2 + (s % cols) * cell, by + 30 + cell / 2 + Math.floor(s / cols) * cell - 4);
        ctx.restore();
      }
      if (view.left && placed < n) {
        var ly = y0 + Math.ceil(view.boxes / per) * (bh + 12) + 10;
        ctx.fillStyle = "#d1495b"; ctx.font = "700 18px Fredoka, sans-serif"; ctx.textAlign = "left";
        ctx.fillText("😢 Left behind: " + (n - placed), x0, ly + 16);
        for (var lft = 0; lft < Math.min(n - placed, 30); lft++) icon(x0 + 190 + (lft % 12) * cell + Math.sin(t * 9 + lft) * 2, ly + 16 + Math.floor(lft / 12) * cell, "#d1495b");
      }
    }
  }

  /* ================================================================ L4 My Site mission (real numbers) */
  function levelMission(L) {
    var site = RQ.mySite() || RQ.site("rondonia"), lg = site && site.logistics;
    if (!lg || !lg.species) { L.win({ stars: 1, msg: "No mission data found." }); return; }
    var mistakes = 0, HPD = 6;   // plan(): hours_per_day = 6
    var board = u.el("div", { class: "rf-board" }); L.stage.appendChild(board);
    board.appendChild(u.el("div", { class: "rf-head", html: "📋 Mission order: " + u.esc(site.name) + ' <span class="chip">' + n1(lg.area_ha) + " ha patch</span>" +
      '<span class="chip">' + u.esc((D.biomes && D.biomes[lg.biome] && D.biomes[lg.biome].name) || lg.biome) + '</span><span class="chip">🚁 ' + u.esc(lg.drone.name.split(" (")[0]) + ", " + lg.rolls_per_sortie + " roll per trip</span>" }));
    var grid = u.el("div", { class: "rf-machines" }); board.appendChild(grid);
    var ask = u.el("div", { class: "rf-ask" }); board.appendChild(ask);
    function machine(icon, title) {
      var m = u.el("div", { class: "rf-m" }), big = u.el("div", { class: "big", text: "?" }), sub = u.el("div", { class: "sub" }), extra = u.el("div", { class: "rows" });
      m.appendChild(u.el("div", { class: "wm", text: icon }));
      m.appendChild(u.el("div", { class: "t", html: icon + " " + title })); m.appendChild(big); m.appendChild(sub); m.appendChild(extra); grid.appendChild(m);
      return { el: m, big: big, sub: sub, extra: extra };
    }
    var M = { seeds: machine("🌱", "Seeds"), rolls: machine("🧻", "Rolls"), trips: machine("🚁", "Trips (sorties)"), batt: machine("🔋", "Battery charges"), days: machine("📅", "Days"), cost: machine("💰", "Cost") };
    function on(m) { Object.keys(M).forEach(function (k) { M[k].el.classList.remove("on"); }); if (m) m.el.classList.add("on"); }
    function countUp(el, to, ms) {
      return new Promise(function (res) {
        var t0 = performance.now();
        (function f() { if (!L.alive) return res(); var k = Math.min(1, (performance.now() - t0) / ms); el.textContent = u.fmt(Math.round(to * u.ease.outCubic(k))); if (k < 1) requestAnimationFrame(f); else res(); })();
      });
    }
    function prompt(md) { ask.innerHTML = ""; var p = u.el("div", { class: "prompt", html: RQ.ui.md(md) }); ask.appendChild(p); return p; }
    async function choiceQ(md, labels, ans, hint) {
      var p = prompt(md);
      if (L.rng() < .5) { labels = labels.slice().reverse(); ans = labels.length - 1 - ans; }
      var w = await choiceRow(L, ask, labels, ans, function () { p.innerHTML = RQ.ui.md(md + "  💡 " + hint); });
      mistakes += w; return w;
    }

    (async function () {
      var sp0 = lg.species[0];
      // 1. seeds
      on(M.seeds); prompt("The **Seeds** machine counts the seeds of each native tree type for " + n1(lg.area_ha) + " ha…");
      M.seeds.extra.innerHTML = lg.species.map(function (s) { return "• " + u.esc(s.common) + ": " + u.fmt(s.seeds); }).join("<br>");
      await countUp(M.seeds.big, lg.seeds, 1400); if (!L.alive) return;
      M.seeds.sub.innerHTML = RQ.ui.md("for **" + u.fmt(lg.target_trees) + "** trees (not every seed grows)");
      M.seeds.el.classList.add("done"); RQ.audio.sfx("coin"); await L.wait(900); if (!L.alive) return;
      // 2. rolls
      on(M.rolls);
      var exact = sp0.seeds / sp0.seeds_per_roll;
      await choiceQ("**" + u.esc(sp0.common) + "**: " + u.fmt(sp0.seeds) + " seeds, **" + sp0.seeds_per_roll + "** per roll. <span class='calc'>" + u.fmt(sp0.seeds) + " ÷ " + sp0.seeds_per_roll + " = " + n1(exact) + "</span> How many rolls?",
        [u.fmt(Math.floor(exact)), u.fmt(sp0.rolls)], 1, "Round **up**: the last seeds need a roll too!");
      if (!L.alive) return;
      M.rolls.extra.innerHTML = lg.species.map(function (s) { return "• " + u.esc(s.common) + ": " + u.fmt(s.rolls) + " (" + s.seeds_per_roll + " per roll)"; }).join("<br>");
      await countUp(M.rolls.big, lg.rolls, 1200); if (!L.alive) return;
      M.rolls.sub.innerHTML = RQ.ui.md("`math.ceil(seeds / per_roll)`"); M.rolls.el.classList.add("done"); RQ.audio.sfx("coin");
      // 3. trips
      on(M.trips); prompt("The prototype drone carries **" + lg.rolls_per_sortie + " roll** per trip, so trips = rolls.");
      await countUp(M.trips.big, lg.sorties, 1000); if (!L.alive) return;
      M.trips.sub.innerHTML = RQ.ui.md("about **" + n1(lg.sortie_min) + " min** each, out and back"); M.trips.el.classList.add("done");
      await L.wait(800); if (!L.alive) return;
      // 4. batteries
      on(M.batt);
      var bx = lg.sorties / lg.sorties_per_battery;
      await choiceQ("One battery lasts **" + lg.sorties_per_battery + " trips**. <span class='calc'>" + u.fmt(lg.sorties) + " ÷ " + lg.sorties_per_battery + " = " + n1(bx) + "</span> How many battery charges?",
        [u.fmt(Math.floor(bx)), u.fmt(lg.battery_charges)], 1, "Half a battery charge is still a charge. Round **up**!");
      if (!L.alive) return;
      await countUp(M.batt.big, lg.battery_charges, 900); if (!L.alive) return; M.batt.sub.innerHTML = RQ.ui.md("`math.ceil(trips / " + lg.sorties_per_battery + ")`"); M.batt.el.classList.add("done"); RQ.audio.sfx("coin");
      // 5. days
      on(M.days);
      var perDay = lg.fleet * HPD, dx = lg.flight_hours / perDay;
      await choiceQ("**" + n1(lg.flight_hours) + " flying hours**. " + lg.fleet + " drones × " + HPD + " h a day = " + perDay + " h. <span class='calc'>" + n1(lg.flight_hours) + " ÷ " + perDay + " = " + n1(dx) + "</span> How many days?",
        [u.fmt(Math.floor(dx)), u.fmt(lg.days)], 1, "The last bit of flying still needs a whole day!");
      if (!L.alive) return;
      await countUp(M.days.big, lg.days, 700); if (!L.alive) return; M.days.sub.innerHTML = RQ.ui.md("with **" + lg.fleet + " drones**, " + HPD + " h a day"); M.days.el.classList.add("done"); RQ.audio.sfx("coin");
      // 6. fleet challenge
      var target = Math.max(2, Math.round(lg.days / 2.6)), best = 1;
      while (Math.ceil(lg.flight_hours / (best * HPD)) > target) best++;
      var fleet = await fleetChallenge(target, best); if (!L.alive) return;
      var fleetStar = fleet === best ? 1 : 0;
      M.days.big.textContent = u.fmt(Math.ceil(lg.flight_hours / (fleet * HPD)));
      M.days.sub.innerHTML = RQ.ui.md("with your **" + fleet + " drones** · ReSeed's plan: **" + lg.days + " days** with " + lg.fleet);
      // 7. cost
      on(M.cost); prompt("Last machine: is it worth it? Drones vs planting by hand…");
      var c = lg.cost_usd, mx = Math.max(c.total, c.hand_planting);
      M.cost.big.textContent = "$" + u.fmt(c.total);
      M.cost.extra.innerHTML = '<div class="bars"><div class="bar"><i style="background:#4cbb5a"></i><span>🚁 drones + seeds $' + u.fmt(c.total) + '</span></div><div class="bar"><i style="background:#e0752d"></i><span>✋ by hand $' + u.fmt(c.hand_planting) + "</span></div></div>";
      L.timeout(function () { var is = M.cost.extra.querySelectorAll("i"); is[0].style.width = (c.total / mx * 100) + "%"; is[1].style.width = (c.hand_planting / mx * 100) + "%"; }, 80);
      M.cost.sub.innerHTML = RQ.ui.md("saves about **" + Math.round((lg.saving_vs_hand || (1 - c.total / c.hand_planting)) * 100) + " %**");
      M.cost.el.classList.add("done"); RQ.audio.sfx("win");
      await L.wait(1600); if (!L.alive) return;
      await L.say("mo", "Mission planned! Rolls stuffed, batteries counted, and way cheaper than planting by hand.", { mood: "happy" });
      if (!L.alive) return;
      var stars = u.clamp(1 + (mistakes <= 1 ? 1 : 0) + fleetStar, 1, 3);
      L.win({ stars: stars, msg: u.esc(site.name) + ": **" + u.fmt(lg.seeds) + "** seeds in **" + u.fmt(lg.rolls) + "** rolls, about **$" + u.fmt(c.total) + "** instead of **$" + u.fmt(c.hand_planting) + "** by hand.",
        stats: { "Mistakes": mistakes, "Fleet": fleet + " drones (best " + best + ")" } });
    })();

    function fleetChallenge(target, best) {
      on(M.days); ask.innerHTML = "";
      var p = u.el("div", { class: "prompt", style: { flex: "1 1 100%" }, html: RQ.ui.md("⏱️ Koa wants the patch seeded in **" + target + " days** or less. What is the **smallest** fleet that can do it?") });
      ask.appendChild(p);
      var max = Math.max(best + 10, lg.drones_to_finish_in_one_day || 30);
      var sl = u.el("input", { type: "range", min: 1, max: max, step: 1, value: lg.fleet, "aria-label": "Number of drones" });
      var days = u.el("span", { class: "days" }), count = u.el("b", { style: { minWidth: "5.5em" } });
      var lock = u.el("button", { class: "btn go", html: "🔒 Lock in" });
      var row = u.el("div", { class: "rf-fleet" }, count, sl, days, lock); ask.appendChild(row);
      var strip = u.el("div", { class: "rf-strip", style: { flex: "1 1 100%" } }); ask.appendChild(strip);
      var cvs = L.canvas({ w: 1200, h: 70, parent: strip, fill: true, label: "Drone fleet" });
      function d() { return Math.ceil(lg.flight_hours / (+sl.value * HPD)); }
      function upd() {
        var dd = d(); count.textContent = "🚁 × " + sl.value; days.textContent = "📅 " + dd + " day" + (dd > 1 ? "s" : "") + (dd <= target ? " ✅" : " ❌");
        M.days.big.textContent = u.fmt(dd); RQ.audio.sfx("tick");
      }
      L.on(sl, "input", upd); upd(); L.timeout(function () { sl.focus(); }, 60);
      L.loop(function (dt, t) {
        var c = cvs.ctx, W = cvs.w; cvs.clear();
        var n = +sl.value, show = Math.min(n, 16), sp = Math.min(76, (W - 140) / Math.max(show, 1));
        for (var i = 0; i < show; i++) droneArt(c, 50 + i * sp, 46 + Math.sin(t * 4 + i) * 3, .27, t + i, 1, 1, true);
        if (n > show) { c.fillStyle = INK; c.font = "700 20px Fredoka, sans-serif"; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("+" + (n - show), 40 + show * sp, 40); }
      });
      return new Promise(function (res) {
        lock.onclick = function () {
          if (!L.alive) return;
          if (d() > target) { RQ.audio.sfx("bad"); p.innerHTML = RQ.ui.md("❌ " + sl.value + " drones need **" + d() + " days**. Koa wants " + target + " or less: add drones!"); return; }
          var f = +sl.value; RQ.audio.sfx("good");
          if (f > best) L.toast("✅ Works! But " + best + " drones would already meet the deadline.", "info", 2600);
          else L.toast("🎯 Perfect: the smallest fleet is " + best + " drones!", "good", 2400);
          lock.disabled = true; sl.disabled = true;
          L.timeout(function () { res(f); }, 900);
        };
      });
    }
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g17",
    music: "camp",
    intro: [
      ["mo", "Welcome to the Roll Factory, I'm Mo! We turn old toilet-paper rolls into seed pods for the drones."],
      ["pix", "First we fill rolls with our own hands. Then we crack the factory's secret formulas!"]
    ],
    outro: [
      ["mo", "The factory is humming! Seeds, rolls, trips and batteries: all planned."],
      ["koa", "My drones are ready. Next stop: the Fly island!"]
    ],
    levels: [
      { title: "Fill a roll", goal: "Fill every seed slot, then test the roll",
        intro: [["mo", "This empty roll is a seed pod. Tap the dashed slots, or hold **Space**, to fill it with acorns."]],
        cards: ["roll-volume", "packing"],
        play: levelFill },
      { title: "Big seeds, tiny seeds", goal: "Stuff three kinds of seed and count",
        intro: [["mo", "Different seeds, different sizes! A tiny pine seed is nothing like a big acorn."],
                ["pix", "Guess first, then stuff each seed into a roll and count what comes out."]],
        cards: ["int-down"],
        play: levelSizes },
      { title: "Whole trips", goal: "Load the rolls and fly every one out",
        intro: [["koa", "My field drone carries **4 rolls** per trip. Load the rolls and launch!"],
                ["mo", "Press **Space** to load a roll and **Enter** to launch. Don't leave any rolls behind!"]],
        cards: ["ceil-up"],
        play: levelTrips },
      { title: "My Site mission", goal: "Plan the real mission for your site",
        intro: [["pix", "Time for the real thing: your site's mission, with ReSeed's real numbers!"],
                ["mo", "Each machine needs one answer. Remember: rolls, batteries and days always round **up**."]],
        cards: ["mission-cost"],
        play: levelMission }
    ]
  });
})();
