/* g13 NDVI Goggles — invisible light and the greenness score.
 * L1 near-infrared goggles over a cartoon landscape · L2 the NDVI formula machine (kid numbers)
 * L3 sort values into ReSeed's exact health classes + the "was it forest?" twist
 * L4 real NDVI picture of My Site + the month-by-month wave of an oak forest (Ozarks).
 * Facts: reseed/acquire.py ndvi(), reseed/ndvi.py health_class(), monthly_ndvi(); config.py HEALTH_CLASSES. */
(function () {
  "use strict";
  var u = RQ.u;
  var D = RQ.data() || {};
  var INK = "#1d2b3a";

  /* ------------------------------------------------------------ ReSeed facts */
  // config.py HEALTH_CLASSES (shipped in data/reseed-data.js as RQ.data().health)
  var HEALTH = D.health || [
    { lower: 0.6, key: "healthy", label: "Healthy", advice: "no seed" },
    { lower: 0.3, key: "moderate", label: "Moderate health", advice: "no seed yet" },
    { lower: 0.1, key: "sparse", label: "Sparse", advice: "seedable" },
    { lower: 0.01, key: "none", label: "No vegetation", advice: "urgent seeding" },
    { lower: -1, key: "not_seedable", label: "Not seedable", advice: "roof, water, snow" }];
  var NOT_SEEDABLE = { lower: -1, key: "not_seedable", label: "Not seedable", advice: "roof, water, snow" };
  /** ndvi.py health_class(): first class whose lower bound the value reaches. */
  function healthClass(v) {
    for (var i = 0; i < HEALTH.length; i++) if (v >= HEALTH[i].lower) return HEALTH[i];
    return NOT_SEEDABLE;
  }
  function classIndex(key) { for (var i = 0; i < HEALTH.length; i++) if (HEALTH[i].key === key) return i; return HEALTH.length - 1; }
  var CLS = {
    healthy: { bg: "#1f8a3a", fg: "#fff", short: "Healthy", rule: "≥ 0.60" },
    moderate: { bg: "#b5d65a", fg: INK, short: "Moderate health", rule: "≥ 0.30" },
    sparse: { bg: "#e3c36a", fg: INK, short: "Sparse", rule: "≥ 0.10" },
    none: { bg: "#a8713d", fg: "#fff", short: "No vegetation", rule: "≥ 0.01" },
    not_seedable: { bg: "#56719e", fg: "#fff", short: "Not seedable", rule: "below 0.01" }
  };
  // reseed/webexport.py NDVI_STOPS: the colour ramp of the real NDVI pictures (ndvi.webp)
  var STOPS = [[-0.2, [40, 70, 140]], [0, [120, 80, 40]], [0.15, [170, 120, 60]], [0.3, [215, 190, 90]],
    [0.45, [190, 215, 100]], [0.6, [110, 180, 70]], [0.75, [40, 140, 50]], [0.9, [10, 90, 30]]];
  function ramp(v) {
    if (v <= STOPS[0][0]) return "rgb(" + STOPS[0][1] + ")";
    for (var i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) {
      var a = STOPS[i - 1], b = STOPS[i], k = (v - a[0]) / (b[0] - a[0]);
      return "rgb(" + [0, 1, 2].map(function (j) { return Math.round(u.lerp(a[1][j], b[1][j], k)); }) + ")";
    }
    return "rgb(" + STOPS[STOPS.length - 1][1] + ")";
  }
  function rampCSS() {
    return "linear-gradient(90deg," + STOPS.map(function (s) { return "rgb(" + s[1] + ") " + Math.round((s[0] + 0.2) / 1.1 * 100) + "%"; }).join(",") + ")";
  }
  function f2(v) { return (v < 0 ? "−" : "") + Math.abs(v).toFixed(2); }

  /* ------------------------------------------------------------ small DOM helpers */
  function hasDialog() { return !!document.querySelector(".rq-overlay, .rq-talk"); }
  function panel(cls, style) { return u.el("div", { class: "panel " + (cls || ""), style: style || {} }); }
  function classChip(c) {
    var s = CLS[c.key];
    return '<span class="chip" style="background:' + s.bg + ";color:" + s.fg + '">' + u.esc(c.label) + "</span>";
  }
  /** Small hi-DPI canvas with a fixed logical size, CSS-scaled to its box. */
  function miniCanvas(parent, w, h, cls) {
    var cv = u.el("canvas", { class: cls || "", width: w * 2, height: h * 2, "aria-hidden": "true" });
    parent.appendChild(cv);
    var ctx = cv.getContext("2d"); ctx.setTransform(2, 0, 0, 2, 0, 0);
    return { cv: cv, ctx: ctx, w: w, h: h };
  }
  function starsFor(mistakes, a, b) { return mistakes <= a ? 3 : mistakes <= b ? 2 : 1; }
  /** Window keydown listener for one step; returns a function that removes it. */
  function keys1(L, fn) { var w = L.on(window, "keydown", fn); return function () { window.removeEventListener("keydown", w); }; }

  /* ================================================================ L1 goggles */
  // Kid numbers (0-10) for the reflected light of each thing. Used again in L2.
  var THINGS = [
    { id: "forest", name: "Forest", nir: 8, red: 2, col: "#2f8a3e" },
    { id: "lawn", name: "Lawn", nir: 6, red: 2, col: "#5cc24a" },
    { id: "road", name: "Road", nir: 2, red: 2, col: "#5a6270" },
    { id: "lake", name: "Lake", nir: 1, red: 3, col: "#3f95dc" },
    { id: "snow", name: "Snow", nir: 9, red: 9, col: "#f4f8ff" },
    { id: "roof", name: "Roof", nir: 3, red: 4, col: "#c8463a" },
    { id: "plastic", name: "Plastic tree", nir: 2, red: 2, col: "#3fa34d", mystery: true }
  ];
  var HZ = 250, SH = 560;
  function geo(W) {
    var g = {};
    g.peak = { x: .2 * W, y: 60 }; g.ml = { x: .01 * W, y: 292 }; g.mr = { x: .39 * W, y: 292 };
    g.sl = { x: u.lerp(g.peak.x, g.ml.x, .34), y: u.lerp(g.peak.y, g.ml.y, .34) };
    g.sr = { x: u.lerp(g.peak.x, g.mr.x, .34), y: u.lerp(g.peak.y, g.mr.y, .34) };
    g.lake = { x: .18 * W, y: 402, rx: .13 * W, ry: 52 };
    g.road = { y0: 480, y1: 530 };
    g.lawn = { x: .47 * W, y: 405, rx: .125 * W, ry: 50 };
    g.house = { x: .47 * W, y0: 326, y1: 396, hw: 56 };
    g.roof = [{ x: .47 * W - 74, y: 330 }, { x: .47 * W, y: 268 }, { x: .47 * W + 74, y: 330 }];
    g.plastic = { x: .585 * W, y: 366 };
    g.forest = { x0: .64 * W, x1: .99 * W, y0: 238, y1: 382 };
    g.trees = [];
    for (var i = 0; i < 8; i++) g.trees.push({ x: .665 * W + i * .043 * W, y: 286 + (i % 2) * 6, r: 32 });
    for (i = 0; i < 7; i++) g.trees.push({ x: .687 * W + i * .043 * W, y: 340 + (i % 2) * 5, r: 37 });
    g.anchor = {
      forest: { x: .82 * W, y: 436 }, lawn: { x: .4 * W, y: 452 }, road: { x: .13 * W, y: 505 },
      lake: { x: .18 * W, y: 352 }, snow: { x: .2 * W, y: 52 }, roof: { x: .47 * W, y: 262 }, plastic: { x: .585 * W, y: 330 }
    };
    g.hop = { forest: { x: .8 * W, y: 318 }, lawn: { x: .4 * W, y: 420 }, road: { x: .3 * W, y: 505 }, lake: { x: .18 * W, y: 405 }, snow: { x: .2 * W, y: 108 }, roof: { x: .47 * W, y: 312 } };
    return g;
  }
  function inTri(p, a, b, c) {
    var d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y), d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y), d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  function inEll(p, e, pad) { var dx = (p.x - e.x) / (e.rx + (pad || 0)), dy = (p.y - e.y) / (e.ry + (pad || 0)); return dx * dx + dy * dy <= 1; }
  function hitThing(g, p) {
    if (u.dist(p.x, p.y, g.plastic.x, g.plastic.y) < 34) return "plastic";
    if (inTri(p, { x: g.roof[0].x - 6, y: g.roof[0].y + 4 }, { x: g.roof[1].x, y: g.roof[1].y - 8 }, { x: g.roof[2].x + 6, y: g.roof[2].y + 4 })) return "roof";
    if (inTri(p, { x: g.peak.x, y: g.peak.y - 10 }, { x: g.sl.x - 10, y: g.sl.y + 14 }, { x: g.sr.x + 10, y: g.sr.y + 14 })) return "snow";
    if (inEll(p, g.lake, 8)) return "lake";
    if (p.y >= g.road.y0 - 4 && p.y <= g.road.y1 + 4) return "road";
    if (p.x >= g.forest.x0 && p.x <= g.forest.x1 && p.y >= g.forest.y0 && p.y <= g.forest.y1) return "forest";
    if (inEll(p, g.lawn, 6) && !(Math.abs(p.x - g.house.x) < g.house.hw && p.y < g.house.y1)) return "lawn";
    return null;
  }
  function glow(ctx, on, color, blur) { ctx.shadowColor = on ? color : "transparent"; ctx.shadowBlur = on ? blur : 0; }

  /** Draw the landscape. n = near-infrared view. */
  function drawLand(ctx, W, g, n, t) {
    var sky = ctx.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, n ? "#17132a" : "#8fd3ff"); sky.addColorStop(1, n ? "#3a2f55" : "#e2f5ff");
    ctx.fillStyle = sky; ctx.fillRect(-2, -2, W + 4, SH + 4);
    ctx.lineWidth = 3; ctx.strokeStyle = INK;
    // sun
    ctx.beginPath(); ctx.arc(.47 * W, 70, 32, 0, 7); ctx.fillStyle = n ? "#fff3c4" : "#ffd84d"; ctx.fill(); ctx.stroke();
    // clouds
    for (var c = 0; c < 3; c++) {
      var cx = ((c * 330 + t * (10 + c * 3)) % (W + 260)) - 130, cy = 46 + c * 40;
      ctx.fillStyle = n ? "rgba(150,140,175,.85)" : "rgba(255,255,255,.92)";
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 7); ctx.arc(cx + 26, cy - 10, 28, 0, 7); ctx.arc(cx + 56, cy, 20, 0, 7); ctx.fill();
    }
    // back mountain + main mountain
    ctx.fillStyle = n ? "#4d4558" : "#b7bfcc";
    ctx.beginPath(); ctx.moveTo(.22 * W, 292); ctx.lineTo(.36 * W, 120); ctx.lineTo(.52 * W, 292); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = n ? "#5f5669" : "#9aa0ad";
    ctx.beginPath(); ctx.moveTo(g.ml.x, g.ml.y); ctx.lineTo(g.peak.x, g.peak.y); ctx.lineTo(g.mr.x, g.mr.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    // snow cap (bright in NIR AND in red)
    glow(ctx, n, "#ffffff", 16);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(g.peak.x, g.peak.y); ctx.lineTo(g.sr.x, g.sr.y);
    for (var k = 1; k < 6; k++) { var x = u.lerp(g.sr.x, g.sl.x, k / 6); ctx.lineTo(x, (k % 2 ? g.sr.y + 14 : g.sr.y - 4)); }
    ctx.lineTo(g.sl.x, g.sl.y); ctx.closePath(); ctx.fill(); glow(ctx, false); ctx.stroke();
    // meadow ground + far hills (grass glows a little in NIR)
    ctx.fillStyle = n ? "#b47ca6" : "#8cc96b";
    ctx.beginPath(); ctx.moveTo(0, HZ + 40);
    for (var hx = 0; hx <= W; hx += 40) ctx.lineTo(hx, HZ + 26 - Math.sin(hx / 150 + 1) * 16);
    ctx.lineTo(W, SH); ctx.lineTo(0, SH); ctx.fill();
    ctx.fillStyle = n ? "#c58ab5" : "#a5d77d"; ctx.fillRect(0, 300, W, SH - 300);
    // forest: leaves soak up red and bounce back lots of NIR -> bright glow
    g.trees.forEach(function (tr) {
      ctx.fillStyle = n ? "#6a4b5e" : "#7a5230"; ctx.fillRect(tr.x - 6, tr.y + tr.r * .5, 12, tr.r * .9); ctx.strokeRect(tr.x - 6, tr.y + tr.r * .5, 12, tr.r * .9);
    });
    g.trees.forEach(function (tr, i) {
      var sway = Math.sin(t * 1.3 + i) * 1.5;
      glow(ctx, n, "#ff5fd2", 22);
      ctx.fillStyle = n ? "#fff2fb" : (i % 3 ? "#2f8a3e" : "#3fa34d");
      ctx.beginPath(); ctx.arc(tr.x + sway, tr.y, tr.r, 0, 7); ctx.fill(); glow(ctx, false); ctx.stroke();
      ctx.fillStyle = n ? "rgba(255,190,240,.7)" : "rgba(255,255,255,.18)";
      ctx.beginPath(); ctx.arc(tr.x + sway - tr.r * .3, tr.y - tr.r * .3, tr.r * .35, 0, 7); ctx.fill();
    });
    // lake: water swallows NIR -> black
    ctx.fillStyle = n ? "#07090f" : "#3f95dc";
    ctx.beginPath(); ctx.ellipse(g.lake.x, g.lake.y, g.lake.rx, g.lake.ry, 0, 0, 7); ctx.fill(); ctx.stroke();
    if (!n) {
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 3;
      for (var w = 0; w < 3; w++) { var wx = g.lake.x - 60 + w * 50 + Math.sin(t + w) * 6; ctx.beginPath(); ctx.moveTo(wx, g.lake.y - 10 + w * 12); ctx.lineTo(wx + 26, g.lake.y - 10 + w * 12); ctx.stroke(); }
      ctx.strokeStyle = INK;
    }
    // road
    ctx.fillStyle = n ? "#34343c" : "#5a6270"; ctx.fillRect(-4, g.road.y0, W + 8, g.road.y1 - g.road.y0);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, g.road.y0); ctx.lineTo(W, g.road.y0); ctx.moveTo(0, g.road.y1); ctx.lineTo(W, g.road.y1); ctx.stroke();
    ctx.fillStyle = n ? "#55555f" : "#f5d76e";
    for (var dx = -((t * 30) % 70); dx < W; dx += 70) ctx.fillRect(dx, (g.road.y0 + g.road.y1) / 2 - 3, 36, 6);
    ctx.fillStyle = n ? "#3a3a44" : "#c9ccd2"; ctx.fillRect(g.house.x - 14, g.house.y1, 28, g.road.y0 - g.house.y1);
    // lawn (mowed stripes)
    glow(ctx, n, "#ff5fd2", 18);
    ctx.fillStyle = n ? "#ffd9f2" : "#5cc24a";
    ctx.beginPath(); ctx.ellipse(g.lawn.x, g.lawn.y, g.lawn.rx, g.lawn.ry, 0, 0, 7); ctx.fill(); glow(ctx, false); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.ellipse(g.lawn.x, g.lawn.y, g.lawn.rx - 2, g.lawn.ry - 2, 0, 0, 7); ctx.clip();
    ctx.fillStyle = n ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.14)";
    for (var sx = g.lawn.x - g.lawn.rx; sx < g.lawn.x + g.lawn.rx; sx += 36) ctx.fillRect(sx, g.lawn.y - g.lawn.ry, 18, g.lawn.ry * 2);
    ctx.restore();
    // house + roof
    var hs = g.house;
    ctx.fillStyle = n ? "#a59ca8" : "#f4e6c8"; ctx.fillRect(hs.x - hs.hw, hs.y0, hs.hw * 2, hs.y1 - hs.y0); ctx.strokeRect(hs.x - hs.hw, hs.y0, hs.hw * 2, hs.y1 - hs.y0);
    ctx.fillStyle = n ? "#3b3540" : "#7a5230"; ctx.fillRect(hs.x - 12, hs.y1 - 40, 24, 40); ctx.strokeRect(hs.x - 12, hs.y1 - 40, 24, 40);
    ctx.fillStyle = n ? "#2b2833" : "#9fd8ff"; ctx.fillRect(hs.x - 44, hs.y0 + 14, 22, 20); ctx.strokeRect(hs.x - 44, hs.y0 + 14, 22, 20);
    ctx.fillRect(hs.x + 22, hs.y0 + 14, 22, 20); ctx.strokeRect(hs.x + 22, hs.y0 + 14, 22, 20);
    ctx.fillStyle = n ? "#5e4f5a" : "#c8463a";
    ctx.beginPath(); ctx.moveTo(g.roof[0].x, g.roof[0].y); ctx.lineTo(g.roof[1].x, g.roof[1].y); ctx.lineTo(g.roof[2].x, g.roof[2].y); ctx.closePath(); ctx.fill(); ctx.stroke();
    // plastic tree: green to our eyes, dark in NIR (no living leaves)
    var pt = g.plastic;
    ctx.fillStyle = n ? "#444" : "#d08a4a"; ctx.fillRect(pt.x - 13, pt.y + 22, 26, 20); ctx.strokeRect(pt.x - 13, pt.y + 22, 26, 20);
    ctx.fillStyle = n ? "#2a2a33" : "#3fa34d";
    ctx.beginPath(); ctx.moveTo(pt.x, pt.y - 36); ctx.lineTo(pt.x + 24, pt.y + 22); ctx.lineTo(pt.x - 24, pt.y + 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!n) { // tiny price tag
      ctx.fillStyle = "#fff"; ctx.save(); ctx.translate(pt.x + 16, pt.y); ctx.rotate(Math.sin(t * 2) * .2);
      ctx.fillRect(0, 0, 14, 10); ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, 14, 10); ctx.restore(); ctx.lineWidth = 3;
    }
  }

  function levelGoggles(L) {
    var cv = L.canvas({ w: 1100, h: SH, fill: true, label: "Landscape. Move the goggles to scan." });
    var ctx = cv.ctx, lens = { x: cv.w * .5, y: 400 }, keys = {}, scanned = {}, prog = 0, cur = null, tags = [];
    var sparks = [], done = false, finishing = false, foundMystery = false, quizOk = false;
    var finishBtn = u.el("button", { class: "btn go", style: { position: "absolute", right: "16px", bottom: "14px", display: "none", zIndex: 5 }, html: "✓ Finish scan" });
    L.stage.appendChild(finishBtn);
    L.hud.set("scan", "🥽 0 / 6");
    function coreCount() { return THINGS.filter(function (th) { return !th.mystery && scanned[th.id]; }).length; }
    L.on(cv.cv, "pointermove", function (e) { var p = cv.toLocal(e); lens.x = p.x; lens.y = p.y; });
    L.on(cv.cv, "pointerdown", function (e) { var p = cv.toLocal(e); lens.x = p.x; lens.y = p.y; });
    L.on(window, "keydown", function (e) {
      if (hasDialog()) return;
      if (/^Arrow/.test(e.key)) { keys[e.key] = true; e.preventDefault(); }
      if (e.key === " " || e.key === "Enter") { // hop to the next thing not scanned yet
        e.preventDefault();
        var g = geo(cv.w), next = THINGS.filter(function (th) { return !th.mystery && !scanned[th.id]; })[0];
        if (next) { lens.x = g.hop[next.id].x; lens.y = g.hop[next.id].y; }
      }
    });
    L.on(window, "keyup", function (e) { keys[e.key] = false; });
    finishBtn.onclick = function () { if (L.alive && !finishing) finish(); };

    function scan(th, g) {
      scanned[th.id] = true; RQ.audio.sfx("shutter"); L.timeout(function () { RQ.audio.sfx(th.mystery ? "powerup" : "good"); }, 90);
      tags.push(th.id);
      var a = g.anchor[th.id];
      for (var i = 0; i < 16; i++) sparks.push({ x: a.x, y: a.y + 30, vx: u.rand(-150, 150), vy: u.rand(-220, -40), life: .8, c: u.pick(["#ff5fd2", "#ffd84d", "#fff"]) });
      L.hud.set("scan", "🥽 " + coreCount() + " / 6");
      if (th.mystery) {
        foundMystery = true;
        L.toast("🕵️ Mystery solved: a **plastic tree**! In our game it bounces back very little NIR (game version).", "good", 3200);
      } else if (th.id === "snow") L.toast("❄️ Whoa, snow glows bright too!", "info", 2200);
      else L.toast("✅ " + th.name + ": NIR " + th.nir + " · Red " + th.red, "good", 1500);
      if (coreCount() === 6 && !done) {
        done = true;
        if (foundMystery) L.timeout(finish, 900);
        else {
          finishBtn.style.display = "";
          L.timeout(function () { if (!finishing) L.toast("⭐ Bonus: one green thing does **not** glow. Can you find it?", "info", 3600); }, 1700);
        }
      } else if (done && th.mystery) L.timeout(finish, 1200);
    }

    async function finish() {
      if (finishing) return; finishing = true; finishBtn.style.display = "none";
      await L.wait(400); if (!L.alive) return;
      var pick = await L.choose("hoot", "Leaves glow in near-infrared. What else glowed really bright?", ["The snow", "The lake", "The road"]);
      if (!L.alive) return;
      quizOk = pick === 0;
      if (quizOk) { RQ.audio.sfx("good"); await L.say("hoot", "Yes! Snow also bounces back lots of **red** light, so we compare NIR with red to find real leaves.", { mood: "happy" }); }
      else { RQ.audio.sfx("bad"); await L.say("hoot", "Look again: the snow glowed bright white! Snow bounces back red light too, so we must compare NIR with red.", { mood: "think" }); }
      if (!L.alive) return;
      L.win({ stars: 1 + (quizOk ? 1 : 0) + (foundMystery ? 1 : 0),
        msg: "You saw the invisible glow of leaves!" + (foundMystery ? " And you caught the plastic tree." : " (Bonus star: find the green thing that does not glow.)"),
        stats: { "Scanned": coreCount() + " / 6", "Mystery": foundMystery ? "found" : "not found" } });
    }

    L.loop(function (dt, t) {
      var W = cv.w, g = geo(W);
      var sp = 420 * dt;
      if (keys.ArrowLeft) lens.x -= sp; if (keys.ArrowRight) lens.x += sp; if (keys.ArrowUp) lens.y -= sp; if (keys.ArrowDown) lens.y += sp;
      lens.x = u.clamp(lens.x, 10, W - 10); lens.y = u.clamp(lens.y, 10, SH - 10);
      // scanning: hold the crosshair still on a thing
      var hit = hitThing(g, lens), th = hit && THINGS.filter(function (x) { return x.id === hit; })[0];
      if (th && !scanned[th.id] && !finishing) {
        if (cur !== th.id) { cur = th.id; prog = 0; }
        prog += dt / .7;
        if (prog >= 1) { prog = 0; scan(th, g); }
      } else { prog = Math.max(0, prog - dt * 2); if (!th) cur = null; }
      // eye view
      drawLand(ctx, W, g, false, t);
      // goggles: two lenses showing the near-infrared world
      var R = 88, c1 = { x: lens.x - 74, y: lens.y }, c2 = { x: lens.x + 74, y: lens.y };
      ctx.save(); ctx.beginPath(); ctx.arc(c1.x, c1.y, R, 0, 7); ctx.moveTo(c2.x + R, c2.y); ctx.arc(c2.x, c2.y, R, 0, 7); ctx.clip();
      drawLand(ctx, W, g, true, t);
      ctx.restore();
      ctx.lineWidth = 9; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.arc(c1.x, c1.y, R, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(c2.x, c2.y, R, 0, 7); ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = "#ff5fd2";
      ctx.beginPath(); ctx.arc(c1.x, c1.y, R - 5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(c2.x, c2.y, R - 5, 0, 7); ctx.stroke();
      ctx.lineWidth = 8; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(c1.x - R, c1.y); ctx.lineTo(c1.x - R - 40, c1.y - 10); ctx.moveTo(c2.x + R, c2.y); ctx.lineTo(c2.x + R + 40, c2.y - 10); ctx.stroke();
      // crosshair + scan progress
      ctx.lineWidth = 3; ctx.strokeStyle = "#fff";
      ctx.beginPath(); ctx.moveTo(lens.x - 14, lens.y); ctx.lineTo(lens.x + 14, lens.y); ctx.moveTo(lens.x, lens.y - 14); ctx.lineTo(lens.x, lens.y + 14); ctx.stroke();
      if (prog > 0) { ctx.lineWidth = 7; ctx.strokeStyle = "#ffd84d"; ctx.beginPath(); ctx.arc(lens.x, lens.y, 24, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke(); }
      // reading tags
      ctx.font = "600 17px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      tags.forEach(function (id) {
        var tth = THINGS.filter(function (x) { return x.id === id; })[0], a = g.anchor[id];
        var txt = tth.name + "  NIR " + tth.nir + " · Red " + tth.red, tw = ctx.measureText(txt).width + 22;
        var tx = u.clamp(a.x, tw / 2 + 4, W - tw / 2 - 4);
        ctx.fillStyle = tth.mystery ? "#ffe0f6" : "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        u.rr(ctx, tx - tw / 2, a.y - 15, tw, 30, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.fillText(txt, tx, a.y + 1);
      });
      // scan log
      var lx = W - 296, ly = 12, lw = 282, rows = THINGS.length;
      ctx.fillStyle = "rgba(255,253,247,.95)"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      u.rr(ctx, lx, ly, lw, 40 + rows * 27, 14); ctx.fill(); ctx.stroke();
      ctx.textAlign = "left"; ctx.font = "700 17px Fredoka, sans-serif"; ctx.fillStyle = INK; ctx.fillText("Scan log", lx + 12, ly + 20);
      ctx.font = "600 13px Fredoka, sans-serif"; ctx.fillStyle = "#c2188f"; ctx.fillText("NIR", lx + 120, ly + 20); ctx.fillStyle = "#c0392b"; ctx.fillText("Red", lx + 204, ly + 20);
      THINGS.forEach(function (tth, i) {
        var y = ly + 44 + i * 27, ok = scanned[tth.id];
        ctx.font = "600 15px Fredoka, sans-serif"; ctx.fillStyle = ok ? INK : "#8a94a0";
        ctx.fillText(ok || !tth.mystery ? tth.name : "??? mystery", lx + 12, y);
        for (var s = 0; s < 10; s++) {
          ctx.fillStyle = ok && s < tth.nir ? "#ff5fd2" : "#e6e1ec"; ctx.fillRect(lx + 108 + s * 8, y - 7, 6, 14);
          ctx.fillStyle = ok && s < tth.red ? "#e0453a" : "#e6e1ec"; ctx.fillRect(lx + 192 + s * 8, y - 7, 6, 14);
        }
      });
      // sparks
      sparks = sparks.filter(function (p) {
        p.life -= dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, p.life / .8); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        return p.life > 0;
      });
    });
    if (L.fails >= 1) L.timeout(function () { L.hint("Hold the goggles still over a thing until the yellow ring fills. Space hops to the next one."); }, 600);
  }

  /* ================================================================ L2 formula machine */
  function drawGauge(gc, v, label) {
    var ctx = gc.ctx, w = gc.w, h = gc.h, cx = w / 2, cy = h - 56, R = Math.min(w / 2 - 66, h - 100);
    ctx.clearRect(0, 0, w, h);
    function ang(x) { return Math.PI + (x + 1) / 2 * Math.PI; }
    var segs = [[-1, 0.01, "not_seedable"], [0.01, 0.1, "none"], [0.1, 0.3, "sparse"], [0.3, 0.6, "moderate"], [0.6, 1, "healthy"]];
    segs.forEach(function (s) {
      ctx.beginPath(); ctx.arc(cx, cy, R, ang(s[0]), ang(s[1])); ctx.lineWidth = 34; ctx.strokeStyle = CLS[s[2]].bg; ctx.stroke();
    });
    ctx.lineWidth = 3; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(cx, cy, R + 17, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R - 17, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = "700 16px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    [[-1, "−1"], [0, "0"], [1, "+1"], [0.6, "0.6"], [0.3, "0.3"]].forEach(function (k) {
      var a = ang(k[0]); ctx.fillText(k[1], cx + Math.cos(a) * (R + 34), cy + Math.sin(a) * (R + 34));
    });
    if (v != null && isFinite(v)) {
      var a = ang(u.clamp(v, -1, 1));
      ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6)); ctx.stroke(); ctx.lineCap = "butt";
    }
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, 7); ctx.fillStyle = "#ffd84d"; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = "700 26px Fredoka, sans-serif";
    ctx.fillText(label || (v == null ? "NDVI ?" : isFinite(v) ? "NDVI " + f2(v) : "no data"), cx, cy + 34);
  }

  function levelMachine(L) {
    var mistakes = 0, gaugeV = null, shownV = 0;
    var wrap = u.el("div", { class: "ng-split" });
    var left = u.el("div", { class: "ng-col ng-grow" }), right = u.el("div", { class: "ng-col", style: { width: "min(42%, 480px)" } });
    wrap.appendChild(left); wrap.appendChild(right); L.stage.appendChild(wrap);
    var mach = panel("ng-machine ng-col ng-grow", { justifyContent: "center" });
    left.appendChild(mach);
    var gp = panel("ng-col", { alignItems: "stretch", justifyContent: "center" }); right.appendChild(gp);
    var gc = miniCanvas(gp, 460, 300, "ng-gauge");
    var classOut = u.el("div", { class: "center", style: { minHeight: "34px" } }); gp.appendChild(classOut);
    var fracBox = panel("ng-col", { alignItems: "center" }); right.appendChild(fracBox);
    var fracObs = new MutationObserver(function () { fracBox.style.display = fracBox.childNodes.length ? "" : "none"; });
    fracObs.observe(fracBox, { childList: true }); fracBox.style.display = "none";
    L.loop(function (dt) {
      if (gaugeV == null || !isFinite(gaugeV)) { drawGauge(gc, gaugeV, null); return; }
      shownV += (gaugeV - shownV) * Math.min(1, dt * 6);
      drawGauge(gc, shownV, "NDVI " + f2(gaugeV));
    });

    var typed = "", activeBox = null, onSubmit = null;
    function setBox(el) { if (activeBox) activeBox.classList.remove("on"); activeBox = el; if (el) { el.classList.add("on"); el.textContent = typed || "?"; } }
    function key(k) {
      if (!activeBox || !L.alive) return;
      if (k === "⌫") typed = typed.slice(0, -1);
      else if (k === "✓") { if (onSubmit && typed) onSubmit(typed); return; }
      else if (k === "−") typed = typed[0] === "-" ? typed.slice(1) : "-" + typed;
      else if (typed.replace("-", "").length < 4) typed += k;
      RQ.audio.sfx("type"); activeBox.textContent = typed.replace("-", "−") || "?";
    }
    L.on(window, "keydown", function (e) {
      if (hasDialog() || !activeBox) return;
      if (/^[0-9.]$/.test(e.key)) key(e.key);
      else if (e.key === "-") key("−");
      else if (e.key === "Backspace") key("⌫");
      else if (e.key === "Enter") key("✓");
      else return;
      e.preventDefault();
    });
    function pad(parent) {
      var p = u.el("div", { class: "ng-pad" });
      ["1", "2", "3", "4", "5", "⌫", "6", "7", "8", "9", "0", "−"].forEach(function (k) { p.appendChild(u.el("button", { class: "btn", text: k, "aria-label": k === "−" ? "minus" : k === "⌫" ? "delete" : k, onclick: function () { key(k); } })); });
      p.appendChild(u.el("button", { class: "btn", text: ".", onclick: function () { key("."); } }));
      p.appendChild(u.el("button", { class: "btn go wide", style: { gridColumn: "span 5" }, html: "✓ Check", onclick: function () { key("✓"); } }));
      parent.appendChild(p); return p;
    }
    function askNumber(box, want, stepEl, hint) {
      typed = ""; setBox(box); var tries = 0;
      return new Promise(function (res) {
        onSubmit = function (val) {
          var n = parseFloat(val);
          if (Math.abs(n - want) < 1e-9) {
            RQ.audio.sfx("good"); box.classList.remove("on"); box.classList.add("done"); box.textContent = String(want).replace("-", "−");
            activeBox = null; onSubmit = null; res();
          } else {
            tries++; mistakes++; RQ.audio.sfx("bad"); box.classList.add("shake"); L.timeout(function () { box.classList.remove("shake"); }, 400);
            typed = ""; box.textContent = "?";
            stepEl.innerHTML = RQ.ui.md("💡 " + hint + (tries >= 2 ? " It is **" + String(want).replace("-", "−") + "**." : ""));
          }
        };
      });
    }
    function fracVis(top, bot) {
      fracBox.innerHTML = "";
      fracBox.appendChild(u.el("div", { class: "ng-title", html: "🟩 " + (top < 0 ? "−" : "") + Math.abs(top) + " out of " + bot + " squares" }));
      var g = u.el("div", { class: "ng-fracvis" });
      for (var i = 0; i < bot; i++) g.appendChild(u.el("i", { class: i < Math.abs(top) ? (top < 0 ? "neg" : "pos") : "" }));
      fracBox.appendChild(g);
      if (top < 0) fracBox.appendChild(u.el("div", { class: "muted", html: "Blue squares count <b>below zero</b>." }));
    }

    var ROUNDS = [
      { th: THINGS[0], opts: ["0.6", "6", "1.6"] },
      { th: THINGS[1], opts: ["0.4", "0.5", "2"] },
      { th: THINGS[3], opts: ["0.5", "−2", "−0.5"] },
      { th: THINGS[4], opts: ["1", "0", "18"] }
    ];
    async function round(i) {
      var r = ROUNDS[i], th = r.th, top = th.nir - th.red, bot = th.nir + th.red, val = top / bot;
      L.hud.set("round", "⚙️ " + (i + 1) + " / 5");
      mach.innerHTML = ""; fracBox.innerHTML = ""; classOut.innerHTML = ""; gaugeV = null;
      mach.appendChild(u.el("div", { class: "ng-plate", text: "⚙️ NDVI MACHINE" }));
      mach.appendChild(u.el("div", { class: "ng-title" }, u.el("span", { class: "ng-swatch", style: { background: th.col } }), u.el("span", { text: th.name }),
        u.el("span", { class: "chip ng-nir", text: "NIR " + th.nir }), u.el("span", { class: "chip ng-red", text: "Red " + th.red })));
      var bTop = u.el("span", { class: "ng-box", text: "?" }), bBot = u.el("span", { class: "ng-box", text: "?" }), bRes = u.el("span", { class: "ng-box big", text: "?" });
      mach.appendChild(u.el("div", { class: "ng-formula" }, u.el("span", { text: "NDVI =" }),
        u.el("div", { class: "ng-frac" },
          u.el("div", { class: "ng-frow" }, u.el("span", { class: "ng-n nir", text: th.nir }), "−", u.el("span", { class: "ng-n red", text: th.red }), "=", bTop),
          u.el("div", { class: "ng-fbar" }),
          u.el("div", { class: "ng-frow" }, u.el("span", { class: "ng-n nir", text: th.nir }), "+", u.el("span", { class: "ng-n red", text: th.red }), "=", bBot)),
        u.el("span", { text: "=" }), bRes));
      var step = u.el("div", { class: "ng-step", style: { textAlign: "center" }, html: RQ.ui.md("Top line: **NIR − Red**. What is " + th.nir + " − " + th.red + "?") });
      mach.appendChild(step);
      var padBox = u.el("div"); mach.appendChild(padBox); pad(padBox);
      await askNumber(bTop, top, step, "Start at " + th.nir + " and count back " + th.red + "." + (top < 0 ? " You go below zero!" : ""));
      if (!L.alive) return;
      step.innerHTML = RQ.ui.md("Bottom line: **NIR + Red**. What is " + th.nir + " + " + th.red + "?");
      await askNumber(bBot, bot, step, "Add them: " + th.nir + " + " + th.red + ".");
      if (!L.alive) return;
      fracVis(top, bot);
      step.innerHTML = RQ.ui.md("Now divide: **" + String(top).replace("-", "−") + " ÷ " + bot + "**. Look at the squares!");
      padBox.innerHTML = "";
      var ch = u.el("div", { class: "ng-choices" }); padBox.appendChild(ch);
      var want = r.opts.indexOf(val === 0 ? "0" : (val < 0 ? "−" : "") + String(Math.abs(Math.round(val * 100) / 100)));
      await new Promise(function (res) {
        var tries = 0;
        function pick(k) {
          if (!L.alive) return;
          if (k === want) { RQ.audio.sfx("good"); bRes.classList.add("done"); bRes.textContent = r.opts[k]; off(); res(); }
          else {
            tries++; mistakes++; RQ.audio.sfx("bad"); ch.children[k].classList.add("shake"); ch.children[k].disabled = true;
            step.innerHTML = RQ.ui.md("💡 " + (bot === 18 ? "Zero squares filled means zero!" : "Filled squares ÷ all squares. " + Math.abs(top) + " out of " + bot + " is " + (Math.abs(top) / bot) + (top < 0 ? ", but below zero." : ".")));
          }
        }
        r.opts.forEach(function (o, k) { ch.appendChild(u.el("button", { class: "btn big", html: "<b>" + (k + 1) + "</b>&nbsp; " + o, onclick: function () { pick(k); } })); });
        var off = keys1(L, function (e) { if (!hasDialog() && /^[1-3]$/.test(e.key)) pick(+e.key - 1); });
      });
      if (!L.alive) return;
      gaugeV = val; RQ.audio.sfx("zap");
      var c = healthClass(val);
      classOut.innerHTML = classChip(c) + '&nbsp;<span class="muted">' + u.esc(c.advice) + "</span>";
      step.innerHTML = RQ.ui.md("**" + th.name + "** scores **" + f2(val) + "**. " + (val < 0 ? "Water often scores below zero!" : val === 0 ? "Snow: bright, but zero. Not leaves!" : "Leafy!"));
      await L.wait(1700);
    }

    async function sandbox() {
      L.hud.set("round", "⚙️ 5 / 5");
      mach.innerHTML = ""; fracBox.innerHTML = ""; classOut.innerHTML = "";
      var goals = { max: false, min: false, zero: false };
      mach.appendChild(u.el("div", { class: "ng-plate", text: "⚙️ NDVI MACHINE" }));
      mach.appendChild(u.el("div", { class: "ng-title", html: "🔧 Try to break the machine!" }));
      mach.appendChild(u.el("div", { class: "ng-step", html: RQ.ui.md("Slide **NIR** and **Red** from 0 to 10. Make the needle hit **+1**, then **−1**.") }));
      var sNir = u.el("input", { type: "range", min: 0, max: 10, step: 1, value: 5, "aria-label": "NIR" });
      var sRed = u.el("input", { type: "range", min: 0, max: 10, step: 1, value: 5, "aria-label": "Red" });
      var vNir = u.el("b", { text: "5" }), vRed = u.el("b", { text: "5" });
      mach.appendChild(u.el("div", { class: "ng-sliders" }, u.el("span", { class: "chip ng-nir", text: "NIR" }), sNir, vNir, u.el("span", { class: "chip ng-red", text: "Red" }), sRed, vRed));
      var out = u.el("div", { class: "ng-formula", style: { fontSize: "1.6rem" } }); mach.appendChild(out);
      var gl = u.el("div", { class: "ng-goals" }); mach.appendChild(gl);
      function goalsHTML() {
        gl.innerHTML = '<span class="chip' + (goals.max ? " ok" : "") + '">' + (goals.max ? "✅" : "⬜") + " NDVI = +1</span>" +
          '<span class="chip' + (goals.min ? " ok" : "") + '">' + (goals.min ? "✅" : "⬜") + " NDVI = −1</span>" +
          '<span class="chip' + (goals.zero ? " ok" : "") + '">' + (goals.zero ? "✅" : "⭐") + " secret: both 0</span>";
      }
      goalsHTML();
      return new Promise(function (res) {
        var ended = false;
        function upd() {
          var n = +sNir.value, r = +sRed.value; vNir.textContent = n; vRed.textContent = r;
          var t = n - r, b = n + r, v = b === 0 ? NaN : t / b;
          out.innerHTML = "(" + n + " − " + r + ") ÷ (" + n + " + " + r + ") = " + (isFinite(v) ? f2(v) : "no data!");
          gaugeV = isFinite(v) ? v : NaN; if (isFinite(v)) fracVis(t, b); else fracBox.innerHTML = '<div class="ng-title">0 ÷ 0 has no answer!</div><div class="muted">ReSeed marks those pixels as <b>no data</b>.</div>';
          var c = isFinite(v) ? healthClass(v) : null; classOut.innerHTML = c ? classChip(c) : "";
          if (isFinite(v) && v === 1 && !goals.max) { goals.max = true; RQ.audio.sfx("powerup"); L.toast("🎯 +1! As high as NDVI can go: no red at all.", "good", 2200); }
          if (isFinite(v) && v === -1 && !goals.min) { goals.min = true; RQ.audio.sfx("powerup"); L.toast("🎯 −1! As low as it goes: no NIR at all.", "good", 2200); }
          if (!isFinite(v) && !goals.zero) { goals.zero = true; RQ.audio.sfx("giggle"); L.toast("🤪 0 ÷ 0: the machine can't answer that!", "info", 2400); }
          goalsHTML();
          if (goals.max && goals.min && !ended) { ended = true; L.timeout(res, 1600); }
        }
        L.on(sNir, "input", upd); L.on(sRed, "input", upd); upd();
        L.timeout(function () { sNir.focus(); }, 100);
      }).then(function () { return goals.zero; });
    }

    (async function () {
      for (var i = 0; i < ROUNDS.length; i++) { await round(i); if (!L.alive) return; }
      var secret = await sandbox(); if (!L.alive) return;
      await L.say("hoot", "You can't push it past the ends: NDVI stays between **−1** and **+1**. Only 0 and 0 gives no answer at all!", { mood: "happy" });
      if (!L.alive) return;
      L.win({ stars: starsFor(mistakes, 1, 3), msg: "The NDVI machine works! (NIR − Red) ÷ (NIR + Red)" + (secret ? ", and you found the 0 ÷ 0 secret." : "."),
        stats: { "Mistakes": mistakes, "Things scored": 4 } });
    })();
  }

  /* ================================================================ L3 health classes + twist */
  function ex(id) { return RQ.url("data/examples/" + id + ".jpg"); }
  var SORT = [ // typical NDVI values (game version)
    { img: "forest_healthy", name: "Rainforest", v: 0.82 },
    { img: "ocean", name: "Ocean", v: -0.4 },
    { img: "fields", name: "Farm fields", v: 0.45 },
    { img: "forest_deforested", name: "Cleared patch", v: 0.18 },
    { img: "forest_burned", name: "Burned forest", v: 0.05 },
    { img: "lawn", name: "Lawn", v: 0.6, edge: true },
    { img: "forest_winter", name: "Oak forest in winter", v: 0.3, edge: true },
    { img: "construction", name: "Building site", v: 0.1, edge: true },
    { img: "street", name: "Street", v: 0.0, edge: true }
  ];
  var TWIST = [
    { img: "street", name: "Highway", v: 0.03, forest: false, why: "ForestNet: **never a forest** here, it's a road." },
    { img: "forest_deforested", name: "Cleared patch", v: 0.15, forest: true, why: "ForestNet: **forest** in the older pictures. A seeding candidate: the Decide island checks the loss lasts." },
    { img: "river", name: "River", v: -0.15, forest: false, why: "ForestNet: **never a forest**, it's water." },
    { img: "forest_burned", name: "Burned forest", v: 0.05, forest: true, why: "ForestNet: **forest** in the older pictures. A candidate: ReSeed still checks the loss lasts and isn't regrowing." },
    { img: "city", name: "City blocks", v: 0.04, forest: false, why: "ForestNet: **never a forest**, it's a city." },
    { img: "fields", name: "Farm fields", v: 0.25, forest: false, why: "ForestNet: **never a forest**, it's a farm." }
  ];
  function ladderHTML(v, upto) {
    var rows = [["if", "0.60", "healthy"], ["elif", "0.30", "moderate"], ["elif", "0.10", "sparse"], ["elif", "0.01", "none"], ["else", null, "not_seedable"]];
    return rows.map(function (r, i) {
      var res = v == null || i > upto ? "" : (i < upto ? " <b style='color:#b3261e'>✗</b>" : " <b style='color:#1f7a33'>✓</b>");
      var cond = r[1] ? '<span class="py-kw">' + r[0] + "</span> v <span class=\"py-op\">&gt;=</span> <span class=\"py-num\">" + r[1] + "</span>:" : '<span class="py-kw">else</span>:';
      return '<div class="ng-rung' + (v != null && i === upto ? " hl" : "") + '">' + cond + res + '<br>&nbsp;&nbsp;<span class="py-str">"' + CLS[r[2]].short + '"</span></div>';
    }).join("");
  }
  function tcard(it, extra) {
    var c = healthClass(it.v), card = u.el("div", { class: "ng-tcard" },
      u.el("img", { src: ex(it.img), alt: it.name }),
      u.el("div", { class: "v", text: f2(it.v) }), u.el("div", { class: "nm", text: it.name }));
    if (extra) card.appendChild(u.el("div", { class: "lab", style: { background: CLS[c.key].bg, color: CLS[c.key].fg }, text: c.label + " · " + c.advice }));
    return card;
  }

  function levelSort(L) {
    var mistakes = 0;
    var root = u.el("div", { class: "ng-sort" }); L.stage.appendChild(root);
    var ladder = panel("ng-ladder"); root.appendChild(ladder);
    ladder.innerHTML = '<div class="ng-title" style="font-family:var(--font)">health_class(v)</div>' + ladderHTML(null);
    var zone = u.el("div", { class: "ng-cardzone" }); root.appendChild(zone);
    var bins = u.el("div", { class: "ng-bins" }); root.appendChild(bins);
    var counts = HEALTH.map(function () { return 0; }), binEls = [];
    HEALTH.forEach(function (c, i) {
      var s = CLS[c.key];
      var b = u.el("button", { class: "ng-bin", "aria-label": c.label },
        u.el("span", { class: "k", text: "key " + (i + 1) }), u.el("b", { text: s.short }), u.el("small", { text: s.rule + " · " + c.advice }), u.el("span", { class: "cnt", text: "" }));
      b.style.setProperty("--bc", s.bg); b.style.setProperty("--bt", s.fg);
      binEls.push(b); bins.appendChild(b);
    });
    var onBin = null;
    binEls.forEach(function (b, i) { b.onclick = function () { if (onBin && L.alive && !L.paused) onBin(i); }; });
    L.on(window, "keydown", function (e) { if (!hasDialog() && onBin && /^[1-5]$/.test(e.key)) { e.preventDefault(); onBin(+e.key - 1); } });
    var caption = u.el("div", { class: "muted", style: { position: "absolute", right: "18px", top: "10px", fontSize: ".8rem" }, text: "Typical NDVI values (game version)" });
    root.appendChild(caption);

    async function animLadder(v) {
      var want = classIndex(healthClass(v).key);
      for (var i = 0; i <= want; i++) { ladder.innerHTML = '<div class="ng-title" style="font-family:var(--font)">health_class(' + f2(v) + ")</div>" + ladderHTML(v, i); RQ.audio.sfx("tick"); await L.wait(170); if (!L.alive) return; }
    }

    async function partA() {
      for (var k = 0; k < SORT.length; k++) {
        var it = SORT[k], want = classIndex(healthClass(it.v).key), tries = 0;
        L.hud.set("sort", "🪜 " + (k + 1) + " / " + SORT.length);
        zone.innerHTML = ""; var card = tcard(it, false); zone.appendChild(card);
        if (it.edge && k === 5) L.toast("⚠️ Tricky ones: numbers equal to a ladder number!", "info", 2200);
        ladder.innerHTML = '<div class="ng-title" style="font-family:var(--font)">health_class(' + f2(it.v) + ")</div>" + ladderHTML(null);
        await new Promise(function (res) {
          onBin = function (i) {
            if (i === want) {
              onBin = null; RQ.audio.sfx("good"); counts[i]++; binEls[i].querySelector(".cnt").textContent = "📥 " + counts[i];
              card.classList.add("fly"); animLadder(it.v).then(function () { L.timeout(res, 300); });
            } else {
              tries++; mistakes++; RQ.audio.sfx("bad"); binEls[i].classList.add("shake"); L.timeout(function () { binEls[i].classList.remove("shake"); }, 400);
              if (tries === 1) L.toast("🐞 Not that bin. Start at the top: is " + f2(it.v) + " ≥ 0.60?", "bad", 2400);
              else { animLadder(it.v); L.toast(it.edge ? "💡 **≥** means *equal counts too*. " + f2(it.v) + " reaches its line." : "💡 Follow the ladder: the first ✓ wins.", "info", 2600); }
            }
          };
        });
        if (!L.alive) return;
      }
      onBin = null;
    }

    async function partB() {
      bins.style.display = "none"; root.style.gridTemplateRows = "1fr";
      L.hud.set("sort", null);
      ladder.style.fontFamily = "var(--font)"; ladder.style.fontSize = "1.15rem";
      ladder.innerHTML = '<div class="ng-title">Seed or not?</div><div class="ng-rung" style="white-space:normal">1. Is the NDVI low?</div><div class="ng-rung" style="white-space:normal">2. 🧠 Ask ForestNet: was it a <b>forest</b> before?</div><div class="ng-rung" style="white-space:normal">3. Only <b>lost forest</b> gets seeds!</div>';
      for (var k = 0; k < TWIST.length; k++) {
        var it = TWIST[k], tries = 0;
        L.hud.set("twist", "🌱 " + (k + 1) + " / " + TWIST.length);
        zone.innerHTML = ""; var card = tcard(it, true); zone.appendChild(card);
        var acts = u.el("div", { class: "ng-actions" });
        var ask = u.el("button", { class: "btn primary", html: "🧠 Ask ForestNet: was it forest? <small>(Enter)</small>" });
        var yes = u.el("button", { class: "btn go", html: "🌱 Seed it! <small>(1)</small>", disabled: true });
        var no = u.el("button", { class: "btn danger", html: "✋ Don't seed <small>(2)</small>", disabled: true });
        acts.appendChild(ask); acts.appendChild(yes); acts.appendChild(no); zone.appendChild(acts);
        L.timeout(function () { ask.focus(); }, 60);
        await new Promise(function (res) {
          var asked = false;
          function doAsk() {
            if (asked) return; asked = true; RQ.audio.sfx("zap"); ask.disabled = true; yes.disabled = false; no.disabled = false;
            card.appendChild(u.el("div", { class: "ng-stamp " + (it.forest ? "yes" : "no"), text: it.forest ? "🌳 WAS FOREST" : "🚫 NEVER FOREST" }));
            L.timeout(function () { yes.focus(); }, 60);
          }
          function decide(seed) {
            if (!asked || !L.alive) return;
            var right = seed === it.forest;
            if (right) {
              off(); RQ.audio.sfx(seed ? "bloom" : "good"); yes.disabled = no.disabled = true;
              L.toast((seed ? "🌱 " : "✋ ") + it.why, "good", 2400); L.timeout(res, 1500);
            } else {
              tries++; mistakes++; RQ.audio.sfx("giggle");
              L.toast(seed ? "🐞 Seeds on a " + it.name.toLowerCase() + "? It was never a forest!" : "🐞 This was a forest! Lost forest is what ReSeed looks for (it still checks the loss lasts).", "bad", 2600);
            }
          }
          ask.onclick = doAsk; yes.onclick = function () { decide(true); }; no.onclick = function () { decide(false); };
          onBin = null;
          var off = keys1(L, function (e) {
            if (hasDialog()) return;
            if (e.key === "Enter" && !asked) { e.preventDefault(); doAsk(); }
            else if (e.key === "1") decide(true); else if (e.key === "2") decide(false);
          });
        });
        if (!L.alive) return;
      }
    }

    (async function () {
      if (L.fails >= 1) L.toast("💡 Check the ladder from the top. The first line that is true wins.", "info", 3000);
      await partA(); if (!L.alive) return;
      await L.talk([["sprout", "Look at those labels: **urgent seeding**! Let's drop seeds on every low number!", { mood: "wow" }],
        ["hoot", "Wait! Roads and rivers score low too, and ReSeed only seeds where **ForestNet** says a forest used to grow."]]);
      if (!L.alive) return;
      await partB(); if (!L.alive) return;
      await L.say("hoot", "Perfect: low NDVI is a clue, not a reason. The next island checks it isn't just winter!", { mood: "happy" });
      if (!L.alive) return;
      L.win({ stars: starsFor(mistakes, 1, 3), msg: "You sorted NDVI into ReSeed's five health classes, and you only seeded lost forest.", stats: { "Mistakes": mistakes } });
    })();
  }

  /* ================================================================ L4 real NDVI map + wave */
  // 32×32 cells of the real ndvi.webp pictures, read back through the colour ramp (median per cell).
  var GRID_ALPH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/", GN = 32;
  var GRIDS = {
    rondonia: "pjlhhkiilhgfdjjdefghkkkm///ypppoolkhhicbffffengfcdcgjilm///qrtrtqljhhjcbcbeefhdecccfeimm///qkqu/+vkkhncbbcefgeeedecegighz//rpoq/kpnmghecbcffgifjdebfikljcckpqnz/deceffccddgfimojfcbinmjgcafgej++fdbccbacddhihkokjaeimmmfcejddfgfgdZcccfihehiijnkjbeiqqpgacneffggidcbbccdfecbgillkbeiqqpeaejkokhfebbcaghfffccaajomjihopndfhkjlhhfbaZZZhjjjibcaampnjihkomihjmjmggfcZZYYeegkkabccjpnljjjqnlighhoojfcXXYZedeefcacjkooliji+/ogeccqrorZXYYaeeddddioppomjiiis//tgcc+/zvYXaZggffeffmqppnnlihii//+onmo///ZXcZgegeljkdgopoiillvjtxuonoony//+++whfinikfhnqpiighvjouurnnoojm+v+/xvlimolljloqhgegjkmkmonlnnml+knlntpsspnnttrsohdeikmnkkkmmlno/gkikiiuuqqouzvssrnliknomlllmllorusomifyyxrszwytrronnoononlmllkpdinugdkrz//+zwtwroooorrssomnnmn+gifddjlr///////wusopopsrrqomnnmmilbZakd+/+/////zwstsqpqsrpooomlmfgZZanoy///+///+vuuprqprrppoonmmfheajops//+rwyoy//toqrrttqppqmnndgfgjkkm/+uty/ppy/umhimruqpqrqmlugccgjlkrsqxuxrqvzsrkllovqoqqqnm/yvreiljqrortrsnqtrlkklmsoooqqomtxttrvvgtroptppoqshehjkkqnmopqpqlnpimstxvsppoqposklgilklplmpppqpqpkjmqpxvqqpnwqmpopimopnqroqppq+",
    dixie: "qmmopgikijjieejsmgMQNMLPxrkhlvqnpfmqqpigaafhhiknrsOWPMMOYiijsyyrnmmjkgfijXciajmjpvvqTONNQPPQsrrnpqsogifgghjjnvpjpsxvWRcOPOOOONONqprZkgVKLMMNfureqvwuukcPOMNNNNNMnhknfcRJIJKLcntiususrtueRbQOMUSSlkcfqdQJJKLMcpnrohktsopusvXNOkifheccfgcJKLMfZbkcspkrvrlmtnkdctssUceVbYPHKPOqpeialrnonujgiorpgfhrapecckaJVqupqiiXpugscrssjdhjrqnphZRScYYKsmprkprZrufoVeqrrrgkjWquheXUihWJOrffpqsZXUoqWejjonmohhofcZXeixgLOPoderkqWeYZQTfjlhlrnjovTaQZjxpOaVgmbknvsPcOUdZlgerkrvkpUceYlqXMbXcbkkmptmfsrusultrioxrtdYeqnsPZZRaLQZscnqiiqriosswmivcdZWYbtuYXWQZXTLnqkigcrmtlstqhcilcTLMMosRYcagYINcromrwqlvnusqrXckgQNMWYopdjNYXesrukggqlgrtqsmpdafiMLLLKenhNUNLSjvrbXesmmmupifgaeniPKLKKLefWVdnngshUlrlmsvunRirTYWbgOXNJLVpdYVqptuVRcpvrswwqXicjcWUjnaXdmfmeehjopgigpruwtuxvpjgkficgcPbdmvttjcedhmpalropquwjtbZdjjpZcPHZotoibXcfhclvnesqvkikienregnMPenthrrXUWYieenqLalgerfjidieealdThcmilcZahoqYdroYgbYmrijikhdnoiohfjhhgacaqtofjkjfmpShclpkpcortjLjsomcpphihmrrrllvoqmViouodcqoofeUJLYbTgchgjluqpuligrocrulactrmqtXXcXdgieeeiosrtssosspigfmbWnpruqcekgplkksuzsnrqorjnqvtqPafisxuy",
    kalimantan: "soyz+xtqrvvtwxwwstsruszzzxxxyzy+tovuilnsknptvvxxttssvspyvwwwyyzzgluqnemsptttusywusstusxzqovyyyy+rqstrlonoqopssutrqrpuvtsrzyxsJZ+trstssstsusruuuuqoppqswwtyxttrsuxvwxyyxyzzyyyxyxrorqsquusssxyvxwzwxyzzzzzxwxxxyyvwywrosuussyxxywzxyyzzzzzxxxyyyyuvyurorsrssyy+xzyyyyxxyzxwzgyzyyxyyvrpssrrsyxxxyyxzy+yxxxvugxzzzxyytqpsstupwxvwvxyzyzzxxyyxwyyyzwxxyvsutvwvyxsvw+yzyyywxzzyxzzyzxxy+zwyzzzyzytvvzxxyyyxyzzxvyxxwwyyzyuxyxyxyyyyzzwxyzyyzzzyxyyxxvxzzyvzyyxxyxxzzzxyyzyyz++zyzyyyvxzzyyzzxuuzzx+zzwwxxxxxzzzwxwvvvyxwxvyzwvyzzzzzyxxyyyyz+zzyxxvvwyyfcsxxustxyyyyyyzzzzzz++zywywyxyxurXtywttxyxxvyvyz+zzz+zzwxyxyxyyxwrctyxvwwwvuxwzyzyyz+zzwyyyyvxzyxuwvyxtuwxxwwryyytkkyz+yzyuywxyyxvxyzxvwyyxvoozyehilz++yywtynpsyywyz+zvvwvxuzwwzzpglz++yzxqysrwyywyzzyttuuurzzzzyzxxxyyyz+zztrvxyutwyxtssuupyyxyxzxxyyywzzzyyowxywuwxxrtuvurywxyxxxxxyyxyzyz+wxxxxwwyyturtwuxxwyxxxvswyxyx+z+zyzywwvwxuzxyyyvtssrsurfkqtxyzyyxyyyvyyyxvzyyvwyxwwxxwxqokuwyyyyxxxxxz+zwvxyywyvwwwz+yxxtutwvuvxxwxxwyxxveZiedripvyyyyyyyxvyyqnyyzzzyyzzzpcdcdfjkktyxyyywrwyzwjqx+zzzyyzzsonfjh"
  };
  function decodeGrid(s) { return s.split("").map(function (ch) { return ch === "~" ? null : GRID_ALPH.indexOf(ch) / 63 * 1.1 - 0.2; }); }
  var CUTS = [0.6, 0.3, 0.1, 0.01];
  /** Pick up to 4 clear pins (calm neighbourhood, far from class lines), as many classes as the picture has. */
  function pickPins(vals) {
    var cands = [];
    for (var r = 2; r < GN - 2; r++) for (var c = 2; c < GN - 2; c++) {
      var v = vals[r * GN + c]; if (v == null) continue;
      var k = healthClass(v).key, same = 0, n = 0;
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) { var w = vals[(r + dr) * GN + c + dc]; n++; if (w != null && healthClass(w).key === k) same++; }
      var margin = Math.min.apply(null, CUTS.map(function (t) { return Math.abs(v - t); }));
      cands.push({ r: r, c: c, v: v, key: k, score: same / n * 2 + Math.min(margin, .12) * 10 });
    }
    cands.sort(function (a, b) { return b.score - a.score; });
    var pins = [];
    function far(p) { return pins.every(function (q) { return Math.abs(q.r - p.r) + Math.abs(q.c - p.c) >= 14; }); }
    HEALTH.forEach(function (h) { var p = cands.filter(function (x) { return x.key === h.key && far(x); })[0]; if (p && pins.length < 4) pins.push(p); });
    for (var i = 0; i < cands.length && pins.length < 4; i++) if (far(cands[i])) pins.push(cands[i]);
    return u.shuffle(pins, u.seeded(pins.length + ":" + vals.length));
  }

  function levelReal(L) {
    var site = RQ.mySite(), oz = RQ.site("ozarks"), mistakes = 0, waveOk = false;
    async function partMap() {
      var vals = site && GRIDS[site.id] ? decodeGrid(GRIDS[site.id]) : null;
      if (!vals || !site.files) return;
      var pins = pickPins(vals), cur = 0;
      var wrap = u.el("div", { class: "ng-split" }); L.stage.appendChild(wrap);
      var box = u.el("div", { class: "ng-imgbox", tabindex: "0", "aria-label": "Satellite picture of your site with NDVI goggles" });
      var rgb = u.el("img", { src: RQ.url(site.files.rgb), alt: "" }), nd = u.el("img", { class: "ndvi", src: RQ.url(site.files.ndvi), alt: "" });
      var ring = u.el("div", { class: "ng-ring" }), probe = u.el("div", { class: "ng-probe", style: { display: "none" } });
      box.appendChild(rgb); box.appendChild(nd);
      var pinEls = pins.map(function (p, i) {
        var e = u.el("div", { class: "ng-pin", text: String(i + 1), style: { left: ((p.c + .5) / GN * 100) + "%", top: ((p.r + .5) / GN * 100) + "%" } });
        box.appendChild(e); return e;
      });
      box.appendChild(ring); box.appendChild(probe); wrap.appendChild(box);
      var side = panel("ng-col ng-grow", { overflow: "auto" }); wrap.appendChild(side);
      side.appendChild(u.el("div", { class: "ng-title", html: "📍 " + u.esc(site.name) + ' <span class="muted" style="font-weight:500;font-size:.9rem">' + u.esc(site.country || "") + "</span>" }));
      side.appendChild(u.el("div", { class: "muted", html: "Real Sentinel-2 picture" + (site.image_date ? " · " + u.esc(site.image_date) : "") + ". The goggles show the NDVI map ReSeed made for this site (<code>webexport.py</code>). Pin numbers are read from its colours (≈)." }));
      side.appendChild(u.el("div", { class: "ng-legend", style: { background: rampCSS() } }));
      var ll = u.el("div", { class: "ng-legend-l" }); side.appendChild(ll);
      [[-0.2, "−0.2"], [0, "0"], [0.3, "0.3"], [0.6, "0.6"], [0.9, "0.9"]].forEach(function (k) {
        ll.appendChild(u.el("span", { text: k[1], style: { left: ((k[0] + 0.2) / 1.1 * 100) + "%" } }));
      });
      var full = false, fullBtn = u.el("button", { class: "btn", html: "👓 Goggles on the whole picture" });
      side.appendChild(u.el("div", { class: "row" }, fullBtn));
      var q = u.el("div", { class: "ng-step" }); side.appendChild(q);
      var btns = u.el("div", { class: "ng-classbtns" }); side.appendChild(btns);
      var log = u.el("div", { class: "ng-pinlog" }); side.appendChild(log);
      var onClass = null;
      HEALTH.forEach(function (c, i) {
        var s = CLS[c.key];
        btns.appendChild(u.el("button", { class: "btn", html: '<i style="background:' + s.bg + '"></i><span><b>' + (i + 1) + "</b> " + s.short + ' <small class="muted">' + s.rule + "</small></span>", onclick: function () { if (onClass) onClass(i); } }));
      });
      var lens = { x: .5, y: .5 };
      function placeLens() {
        var r = box.getBoundingClientRect(), R = r.width * .17, x = lens.x * r.width, y = lens.y * r.height;
        nd.style.clipPath = full ? "none" : "circle(" + R + "px at " + x + "px " + y + "px)";
        ring.style.display = full ? "none" : ""; ring.style.left = x + "px"; ring.style.top = y + "px"; ring.style.width = ring.style.height = (R * 2) + "px";
      }
      function cellAt(fx, fy) { var c = u.clamp(Math.floor(fx * GN), 0, GN - 1), r = u.clamp(Math.floor(fy * GN), 0, GN - 1); return vals[r * GN + c]; }
      function showProbe(fx, fy) {
        var v = cellAt(fx, fy);
        probe.style.display = ""; probe.style.left = u.clamp(fx * 100, 12, 88) + "%"; probe.style.top = (fy * 100) + "%";
        probe.style.transform = fy < .12 ? "translate(-50%, 40%)" : "";
        probe.innerHTML = v == null ? "no data" : "≈ " + f2(v) + " · " + CLS[healthClass(v).key].short;
      }
      L.on(box, "pointermove", function (e) { var p = u.local(e, box), r = box.getBoundingClientRect(); lens.x = p.x / r.width; lens.y = p.y / r.height; placeLens(); });
      L.on(box, "pointerdown", function (e) { var p = u.local(e, box), r = box.getBoundingClientRect(); lens.x = p.x / r.width; lens.y = p.y / r.height; placeLens(); showProbe(lens.x, lens.y); RQ.audio.sfx("beep"); });
      L.on(window, "resize", placeLens);
      L.on(window, "keydown", function (e) {
        if (hasDialog()) return;
        var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (d) { e.preventDefault(); lens.x = u.clamp(lens.x + d[0] * .03, 0, 1); lens.y = u.clamp(lens.y + d[1] * .03, 0, 1); placeLens(); showProbe(lens.x, lens.y); }
        else if (/^[1-5]$/.test(e.key) && onClass) onClass(+e.key - 1);
        else if (e.key === "g" || e.key === "G") fullBtn.click();
      });
      fullBtn.onclick = function () { full = !full; RQ.audio.sfx("click"); fullBtn.innerHTML = full ? "🥽 Back to the lens" : "👓 Goggles on the whole picture"; placeLens(); };
      // start the lens on pin 1 so the first colour is visible right away
      if (pins[0]) { lens.x = (pins[0].c + .5) / GN; lens.y = (pins[0].r + .5) / GN; }
      L.timeout(placeLens, 50); placeLens();
      for (cur = 0; cur < pins.length; cur++) {
        var p = pins[cur], want = classIndex(p.key), tries = 0;
        pinEls.forEach(function (e, i) { e.classList.toggle("now", i === cur); });
        L.hud.set("pin", "📍 " + (cur + 1) + " / " + pins.length);
        q.innerHTML = RQ.ui.md("Move the goggles over **pin " + (cur + 1) + "**. Which class is its colour?");
        await new Promise(function (res) {
          onClass = function (i) {
            if (!L.alive) return;
            if (i === want) {
              onClass = null; RQ.audio.sfx("good"); pinEls[cur].classList.remove("now"); pinEls[cur].classList.add("ok");
              pinEls[cur].textContent = "✓"; showProbe((p.c + .5) / GN, (p.r + .5) / GN);
              log.appendChild(u.el("div", { class: "chip", html: "📍 " + (cur + 1) + " ≈ " + f2(p.v) + " " + classChip(healthClass(p.v)) }));
              L.toast("✅ Pin " + (cur + 1) + ": NDVI ≈ " + f2(p.v) + " → " + healthClass(p.v).label, "good", 1800);
              L.timeout(res, 1100);
            } else {
              tries++; mistakes++; RQ.audio.sfx("bad");
              q.innerHTML = RQ.ui.md("💡 Compare the colour under pin " + (cur + 1) + " with the colour bar. " + (tries >= 2 ? "Dark green is **Healthy**, yellow-green is **Moderate**, tan is **Sparse**." : "Tap the pin to read its number."));
            }
          };
        });
        if (!L.alive) return;
      }
      onClass = null; L.hud.set("pin", null);
      await L.say("tuki", "That's the real NDVI map ReSeed made for your site! Now let's watch NDVI change over a year.");
    }

    async function partWave() {
      L.stage.innerHTML = "";
      var col = u.el("div", { class: "ng-col", style: { position: "absolute", inset: "0", padding: "12px 16px" } }); L.stage.appendChild(col);
      var title = u.el("div", { class: "ng-title", html: "〰️ " + u.esc(oz ? oz.name : "Ozarks oak forest") + ' <span class="muted" style="font-weight:500;font-size:.9rem">oak-hickory forest · mean forest NDVI per month, ' + (oz ? oz.phenology_year : "") + " (ReSeed <code>ndvi.monthly_ndvi()</code>)</span>" });
      col.appendChild(title);
      var wb = u.el("div", { class: "ng-wavebox" }); col.appendChild(wb);
      var month = 1, visited = {}, showMine = false;
      var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      var ozv = oz ? oz.ndvi.monthly.map(function (m) { return m.mean_forest_ndvi; }) : [0.43, 0.14, 0.36, 0.42, 0.88, 0.83, 0.82, 0.81, 0.79, 0.79, 0.58, 0.44];
      var mine = site ? site.ndvi.monthly.map(function (m) { return m.mean_forest_ndvi; }) : null;
      var slider = u.el("input", { type: "range", min: 1, max: 12, step: 1, value: 1, "aria-label": "Month" });
      var play = u.el("button", { class: "btn", html: "▶ Play the year" });
      var lab = u.el("b", { style: { minWidth: "130px", display: "inline-block" } });
      col.appendChild(u.el("div", { class: "ng-wavebar" }, u.el("span", { text: "Jan" }), slider, u.el("span", { text: "Dec" }), lab, play));
      var cv = L.canvas({ w: 1100, h: 440, parent: wb, fill: true, label: "NDVI wave chart" });
      function setMonth(m) { month = u.clamp(Math.round(m), 1, 12); slider.value = month; if (!visited[month]) { visited[month] = 1; RQ.audio.sfx("tick"); } }
      L.on(slider, "input", function () { setMonth(+slider.value); });
      var playing = false;
      play.onclick = function () { if (playing) return; playing = true; setMonth(1); var m = 1; var id = L.interval(function () { m++; setMonth(m); if (m >= 12) { clearInterval(id); playing = false; } }, 450); };
      var chart = { x0: 70, y0: 30, x1: 0, y1: 380 };
      L.on(cv.cv, "pointerdown", drag); L.on(cv.cv, "pointermove", function (e) { if (e.buttons) drag(e); });
      function drag(e) { var p = cv.toLocal(e); if (p.x < chart.x1 + 20) setMonth(1 + (p.x - chart.x0) / ((chart.x1 - chart.x0) / 11)); }
      L.on(window, "keydown", function (e) {
        if (hasDialog() || document.activeElement === slider) return;
        if (e.key === "ArrowRight") { setMonth(month + 1); e.preventDefault(); } else if (e.key === "ArrowLeft") { setMonth(month - 1); e.preventDefault(); }
      });
      L.timeout(function () { slider.focus(); }, 80);
      setMonth(1);
      function X(i) { return chart.x0 + i * (chart.x1 - chart.x0) / 11; }
      function Y(v) { return chart.y1 - (v - 0) / 1 * (chart.y1 - chart.y0); }
      L.loop(function (dt, t) {
        var ctx = cv.ctx, W = cv.w; chart.x1 = W - 370;
        cv.clear("#fffdf7");
        // class bands
        [[0.6, 1, "healthy"], [0.3, 0.6, "moderate"], [0.1, 0.3, "sparse"], [0.01, 0.1, "none"], [0, 0.01, "not_seedable"]].forEach(function (b) {
          ctx.globalAlpha = .22; ctx.fillStyle = CLS[b[2]].bg; ctx.fillRect(chart.x0, Y(b[1]), chart.x1 - chart.x0, Y(b[0]) - Y(b[1])); ctx.globalAlpha = 1;
          ctx.fillStyle = INK; ctx.font = "600 13px Fredoka, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
          if (b[1] - b[0] > .05) ctx.fillText(CLS[b[2]].short, chart.x1 + 6, (Y(b[0]) + Y(b[1])) / 2);
        });
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(chart.x0, chart.y0, chart.x1 - chart.x0, chart.y1 - chart.y0);
        ctx.fillStyle = INK; ctx.font = "600 15px Fredoka, sans-serif"; ctx.textAlign = "right";
        [0, .3, .6, 1].forEach(function (v) { ctx.fillText(v.toFixed(1), chart.x0 - 8, Y(v)); });
        ctx.textAlign = "center";
        MON.forEach(function (m, i) { ctx.fillStyle = i + 1 === month ? "#c2188f" : INK; ctx.fillText(m, X(i), chart.y1 + 20); });
        // my site's wave (after the question), gaps where no clear picture
        if (showMine && mine) {
          ctx.strokeStyle = "#2b7bd0"; ctx.lineWidth = 4; ctx.setLineDash([10, 7]); ctx.beginPath(); var pen = false;
          mine.forEach(function (v, i) { if (v == null) { pen = false; return; } if (!pen) ctx.moveTo(X(i), Y(v)); else ctx.lineTo(X(i), Y(v)); pen = true; });
          ctx.stroke(); ctx.setLineDash([]);
          mine.forEach(function (v, i) { if (v == null) { ctx.fillStyle = "#8a94a0"; ctx.font = "600 13px Fredoka, sans-serif"; ctx.fillText("☁️ gap", X(i), chart.y1 - 14); } else { ctx.fillStyle = "#2b7bd0"; ctx.beginPath(); ctx.arc(X(i), Y(v), 5, 0, 7); ctx.fill(); } });
          ctx.fillStyle = "#2b7bd0"; ctx.textAlign = "left"; ctx.font = "700 15px Fredoka, sans-serif"; ctx.fillText("- - your site: " + (site ? site.name : ""), chart.x0 + 10, chart.y0 + 16);
        }
        // oak forest wave up to the chosen month
        ctx.strokeStyle = "#1f8a3a"; ctx.lineWidth = 5; ctx.beginPath(); var on = false;
        for (var i = 0; i < 12; i++) { var v = ozv[i]; if (v == null || (!visited[i + 1] && !showMine)) { on = false; continue; } if (!on) ctx.moveTo(X(i), Y(v)); else ctx.lineTo(X(i), Y(v)); on = true; }
        ctx.stroke();
        for (i = 0; i < 12; i++) if (ozv[i] != null && (visited[i + 1] || showMine)) { ctx.fillStyle = "#1f8a3a"; ctx.beginPath(); ctx.arc(X(i), Y(ozv[i]), i + 1 === month ? 9 : 5, 0, 7); ctx.fill(); if (i + 1 === month) { ctx.lineWidth = 3; ctx.stroke(); } }
        var cv0 = ozv[month - 1];
        if (cv0 != null) {
          ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; var bx = u.clamp(X(month - 1) - 52, chart.x0 + 4, chart.x1 - 108), by = Y(cv0) - 48;
          u.rr(ctx, bx, by, 104, 30, 10); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.font = "700 17px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.fillText(f2(cv0), bx + 52, by + 16);
        }
        lab.textContent = MON[month - 1] + ": " + (cv0 == null ? "—" : f2(cv0));
        // the oak tree on the right: leaves follow NDVI
        drawOak(ctx, W - 150, 380, cv0 == null ? .5 : cv0, month, t);
      });
      await new Promise(function (res) { var id = L.interval(function () { if (Object.keys(visited).length >= 12) { clearInterval(id); res(); } }, 200); });
      if (!L.alive) return;
      await L.wait(600); if (!L.alive) return;
      var feb = ozv[1], may = ozv[4];
      var pick = await L.choose("hoot", "In February this oak forest reads " + f2(feb) + ", which is Sparse! Should drones seed it?", ["Yes, seed it now!", "No, it's winter. The leaves grow back."]);
      if (!L.alive) return;
      waveOk = pick === 1;
      if (waveOk) { RQ.audio.sfx("good"); await L.say("hoot", "Right, by May it's back to " + f2(may) + "! A winter dip with a strong summer high every year is just the seasons.", { mood: "happy" }); }
      else { RQ.audio.sfx("giggle"); await L.say("hoot", "Careful: by May it's back to " + f2(may) + "! These oaks drop their leaves every winter, and that's normal.", { mood: "think" }); }
      if (!L.alive) return;
      showMine = true;
      if (mine && mine.some(function (v) { return v == null; })) await L.say("tuki", "Here is your site's wave too. Gaps are months with no clear picture, often because of clouds, so ReSeed leaves a gap instead of guessing.");
      else await L.say("tuki", "Here is your site's wave too. Every month had a clear picture this year!");
      if (!L.alive) return;
      await L.wait(400);
    }

    (async function () {
      await partMap(); if (!L.alive) return;
      await partWave(); if (!L.alive) return;
      L.win({ stars: 1 + (mistakes <= 1 ? 1 : 0) + (waveOk ? 1 : 0),
        msg: "You read a real NDVI map, and ReSeed's measured NDVI wave for the Ozarks oak-hickory forest.", stats: { "Pin mistakes": mistakes, "Winter question": waveOk ? "right" : "oops" } });
    })();
  }

  function drawOak(ctx, x, y, v, month, t) {
    var leaf = u.clamp((v - 0.12) / 0.72, 0, 1), autumn = month >= 10 || month <= 3;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#8cc96b"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 6, 130, 20, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#7a5230";
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-10, -150); ctx.lineTo(10, -150); ctx.lineTo(16, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineCap = "round"; ctx.strokeStyle = "#7a5230"; ctx.lineWidth = 9;
    var br = [[-4, -120, -80, -200], [4, -130, 85, -210], [0, -150, -20, -250], [0, -150, 40, -245], [-6, -95, -110, -150], [6, -100, 115, -160]];
    br.forEach(function (b) { ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[2], b[3]); ctx.stroke(); });
    ctx.lineCap = "butt";
    var rng = u.seeded(7), n = 46;
    for (var i = 0; i < n; i++) {
      var a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 115, lx = Math.cos(a) * d * 1.15, ly = -195 + Math.sin(a) * d * .8, show = rng() < leaf;
      if (!show) continue;
      var green = autumn && leaf < .8 ? (rng() < .5 ? "#e0a21d" : "#d1622b") : (rng() < .5 ? "#2f8a3e" : "#4cbb5a");
      ctx.fillStyle = green; ctx.beginPath(); ctx.arc(lx + Math.sin(t * 1.5 + i) * 1.5, ly, 22, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g13",
    music: "forest",
    intro: [
      ["hoot", "Welcome to Score island! I'm Professor Hoot, and I measure how healthy forests are."],
      ["sprout", "From space, a farm and a forest can both look green. We need a cleverer way to see!"]
    ],
    outro: [
      ["hoot", "You can read the invisible glow of leaves now. That number is **NDVI**!"],
      ["sprout", "Next, Spell Academy: we'll write the NDVI spell in real Python!"]
    ],
    levels: [
      { title: "Goggles on!", goal: "Scan all 6 things with the near-infrared goggles",
        intro: [["hoot", "Put on the **near-infrared goggles**! They show a light our eyes cannot see."],
                ["hoot", "Slide them over the forest, lawn, road, lake, snow and roof. Hold still to scan each one."]],
        cards: ["near-infrared"],
        play: levelGoggles },
      { title: "The NDVI machine", goal: "Feed NIR and Red into the formula",
        intro: [["hoot", "Snow fooled us, so we use two numbers: **NIR** and **Red**. Leaves bounce NIR and soak up red."],
                ["hoot", "The **NDVI** machine does (NIR − Red) ÷ (NIR + Red). You do the sums, it does the rest!"]],
        cards: ["ndvi"],
        play: levelMachine },
      { title: "Health classes", goal: "Put each NDVI number in the matching group",
        intro: [["hoot", "ReSeed gives every NDVI number one of five **health classes**. The sorter only sees the number!"],
                ["sprout", "Tap a bin or press keys 1 to 5. Start at the top of the ladder."]],
        cards: ["health-classes", "forest-check"],
        play: levelSort },
      { title: "Real NDVI maps", goal: "Read the real NDVI map, then play the year",
        intro: [["tuki", "I brought real pictures from the Sentinel-2 satellite! This is your site, seen from space."],
                ["hoot", "Slide the goggles over it to see the real NDVI map. Then read the colour under each pin."]],
        cards: ["ndvi-wave"],
        play: levelReal }
    ]
  });
})();
