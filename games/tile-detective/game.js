/* g10 Tile Detective — real satellite pictures cut into 64x64 tiles, sorted by the kid and by the REAL ForestNet
 * (js/forestnet.js, same float16 weights as the ReSeed site). Tile pixels come from tiles.js (make_tiles.py), so the
 * network runs offline from file://. Levels: sort My Site · race on tricky pictures · the 1-in-4 rule · old or new picture?
 * Facts: reseed/classify/infer.py (64x64 tiles, view gate), pipeline.py (p >= 0.5, forest_frac >= 0.25, baseline picture). */
(function () {
  "use strict";
  var u = RQ.u, el = u.el;
  var TILES = window.RQ_TILES || { tiles: [], display: { path: [0, 0, 0], full: 1, gain: 1, gamma: 1 } };
  var VIEW_ICON = { satellite: "🛰️", aerial: "✈️", ground: "📷" };
  var VIEW_NAME = { satellite: "satellite expert", aerial: "aerial-photo expert", ground: "ground-photo expert" };
  // Latest baseline year with a picture (config.py baseline_years; pipeline.py takes the newest available one)
  var BASE_YEAR = { rondonia: 2019, dixie: 2020, kalimantan: 2019, kangaroo: 2019, ozarks: 2021, congo: 2020 };

  /* ------------------------------------------------------------ tiles + ForestNet */
  var LUT = (function () {
    var d = TILES.display, lut = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
    for (var c = 0; c < 3; c++) for (var v = 0; v < 256; v++) {
      var refl = v * d.full / 255 - d.path[c];
      lut[c][v] = Math.round(Math.pow(u.clamp(refl * d.gain, 0, 1), d.gamma) * 255);
    }
    return lut;
  })();
  function tileSet(name) { return TILES.tiles.filter(function (t) { return t.set === name; }); }
  function tileById(id) { for (var i = 0; i < TILES.tiles.length; i++) if (TILES.tiles[i].id === id) return TILES.tiles[i]; return null; }
  function px(t) { if (!t._px) t._px = RQ.ForestNet.b64ToBytes(t.b64); return t._px; }
  /** 64x64 canvas in display colours (site tiles: EuroSAT-like -> true colour; photos as they are). */
  function canvasOf(t, cls) {
    var cv = el("canvas", { class: "td-tile " + (cls || ""), width: 64, height: 64, "aria-label": t.title || "satellite tile" });
    var ctx = cv.getContext("2d"), im = ctx.createImageData(64, 64), p = px(t), photo = t.kind === "example";
    for (var i = 0; i < 4096; i++) {
      var r = p[i * 3], g = p[i * 3 + 1], b = p[i * 3 + 2];
      im.data[i * 4] = photo ? r : LUT[0][r]; im.data[i * 4 + 1] = photo ? g : LUT[1][g]; im.data[i * 4 + 2] = photo ? b : LUT[2][b]; im.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    return cv;
  }
  var NET = null;
  function net() { return NET || (NET = RQ.ForestNet.load()); }
  /** Run the real ForestNet on a tile (cached; activations dropped to save memory). */
  function ai(t) {
    if (!t._ai) { var r = RQ.ForestNet.forward(net(), px(t), 3); r.acts = null; r.hidden = null; r.pooled = null; t._ai = r; }
    return t._ai;
  }
  function pretty(label) {
    var map = { SeaLake: "Sea or lake", HerbaceousVegetation: "Grass and bushes", AnnualCrop: "Crop field", PermanentCrop: "Orchard crops" };
    if (map[label]) return map[label];
    return String(label).replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function pct(p) { return Math.round(p * 100) + "%"; }

  /** A site picture with a 10x10 tile grid on top. which: "base" | "now". */
  function picture(site, which, cls) {
    var f = site.files || {};
    var src = which === "now" ? f.rgb : (f.rgb_baseline || f.rgb);
    var grid = el("div", { class: "td-grid" }), cells = [];
    for (var i = 0; i < 100; i++) { var c = el("div", { class: "td-cell" }); cells.push(c); grid.appendChild(c); }
    var box = el("div", { class: "td-pic " + (cls || "") }, el("img", { src: RQ.url(src), alt: site.name, draggable: "false" }), grid);
    return { el: box, cells: cells, cell: function (r, c) { return cells[r * 10 + c]; } };
  }
  function siteLabel(site, which) {
    var y = BASE_YEAR[site.id];
    if (which === "now") return "<b>" + u.esc(site.name) + "</b> · today (" + String(site.image_date || "").slice(0, 4) + ")";
    return "<b>" + u.esc(site.name) + "</b> · " + (y ? "growing season " + y + " (old picture)" : "picture from space");
  }
  function wrap(L) { var w = el("div", { class: "td-wrap" }); L.stage.appendChild(w); return w; }
  function stamp(text, kind) { return el("span", { class: "td-stamp " + (kind || "ink"), text: text }); }
  function machine() {
    var lys = [], box = el("div", { class: "td-net", "aria-label": "ForestNet" }, el("span", { class: "lbl", text: "ForestNet" }));
    [24, 48, 96, 160, 96, 2].forEach(function (n, i) { var d = el("div", { class: "ly", style: { height: (18 + Math.sqrt(n) * 5) + "px" } }); lys.push(d); box.appendChild(d); });
    return { el: box, flash: function (i) { lys.forEach(function (d, k) { d.classList.toggle("on", k === i); }); } };
  }
  function pbar() {
    var fill = el("i"), lab = el("span", { text: "forest ?" });
    var b = el("div", { class: "td-pbar", title: "how sure ForestNet is that it's forest" }, fill, el("div", { class: "half" }), lab);
    return { el: b, set: function (p) { fill.style.width = (p * 100) + "%"; lab.textContent = "forest " + pct(p); } };
  }
  /** Keyboard + swipe answers. fn(true = forest). */
  function answerKeys(L, fn) {
    L.on(window, "keydown", function (e) {
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      var k = e.key.toLowerCase();
      if (k === "f" || k === "arrowleft") { e.preventDefault(); fn(true); }
      else if (k === "n" || k === "arrowright") { e.preventDefault(); fn(false); }
    });
  }
  function swipe(L, node, fn) {
    var x0 = null;
    L.on(node, "pointerdown", function (e) { x0 = e.clientX; node.setPointerCapture && node.setPointerCapture(e.pointerId); node.style.transition = "none"; });
    L.on(node, "pointermove", function (e) { if (x0 == null) return; var dx = e.clientX - x0; node.style.transform = "translateX(" + dx + "px) rotate(" + dx / 20 + "deg)"; });
    L.on(node, "pointerup", function (e) {
      if (x0 == null) return; var dx = e.clientX - x0; x0 = null; node.style.transition = ""; node.style.transform = "";
      if (Math.abs(dx) > 70) fn(dx < 0);
    });
  }
  function answerButtons(fn) {
    var yes = el("button", { class: "btn big go", html: "🌳 Forest <kbd>F</kbd>", onclick: function () { fn(true); } });
    var no = el("button", { class: "btn big", html: "🏙️ Not forest <kbd>N</kbd>", onclick: function () { fn(false); } });
    return { el: el("div", { class: "td-btns" }, yes, no), yes: yes, no: no, enable: function (on) { yes.disabled = !on; no.disabled = !on; } };
  }
  function nextButton(label) {
    var b = el("button", { class: "btn primary", html: label || "Next ▶" });
    var p = new Promise(function (res) { b.onclick = function () { RQ.audio.sfx("click"); res(); }; });
    return { el: b, done: p };
  }

  /* ------------------------------------------------------------ level 1: sort My Site's tiles */
  function levelSort(L) {
    var site = RQ.mySite() || RQ.site("rondonia");
    var list = u.shuffle(tileSet("mysite").filter(function (t) { return t.src === site.id; }), L.rng);
    if (!list.length) list = u.shuffle(tileSet("mysite").filter(function (t) { return t.src === "rondonia"; }), L.rng);
    var root = wrap(L), pic = picture(site, "base");
    root.appendChild(el("div", { class: "td-left" }, el("div", { class: "td-cap", html: siteLabel(site, "base") }), pic.el));
    var right = el("div", { class: "td-right" }); root.appendChild(right);
    var count = el("span", { class: "chip" }), clock = el("span", { class: "chip" });
    var arena = el("div", { class: "td-arena" });
    var binF = el("div", { class: "td-bin f" }, el("b", { text: "🌳 You said forest" }), el("div", { class: "thumbs" }));
    var binN = el("div", { class: "td-bin" }, el("b", { text: "🏙️ You said not forest" }), el("div", { class: "thumbs" }));
    var btns = answerButtons(answer);
    right.appendChild(el("div", { class: "td-top" }, count, clock, el("span", { class: "grow" }), el("span", { class: "muted", html: "Swipe the tile ⇠ forest · not forest ⇢" })));
    right.appendChild(arena); right.appendChild(btns.el); right.appendChild(el("div", { class: "td-bins" }, binF, binN));
    var idx = -1, kid = {}, t0 = 0, total = 0, big = null, busy = true;
    btns.enable(false);
    // the tiles light up on the picture: "cut out" one by one
    list.forEach(function (t, i) { L.timeout(function () { pic.cell(t.r, t.c).classList.add("pick"); RQ.audio.sfx("pop"); }, 70 * i); });
    L.timeout(next, 70 * list.length + 200);
    L.loop(function () { if (t0) clock.innerHTML = "⏱ " + ((total + (busy ? 0 : performance.now() - t0)) / 1000).toFixed(1) + " s"; });
    function next() {
      idx++;
      list.forEach(function (t) { pic.cell(t.r, t.c).classList.remove("now"); });
      if (idx >= list.length) { busy = true; btns.enable(false); L.timeout(aiTurn, 400); return; }
      var t = list[idx];
      pic.cell(t.r, t.c).classList.add("now");
      count.innerHTML = "🧩 Tile " + (idx + 1) + " / " + list.length;
      arena.innerHTML = "";
      big = canvasOf(t, "td-big enter"); big.tabIndex = 0;
      arena.appendChild(big); swipe(L, big, answer);
      busy = false; btns.enable(true); t0 = performance.now();
    }
    function answer(isF) {
      if (busy || !L.alive || idx < 0 || idx >= list.length) return;
      busy = true; btns.enable(false);
      total += performance.now() - t0;
      var t = list[idx]; kid[t.id] = isF;
      RQ.audio.sfx(isF ? "bloom" : "snap");
      big.classList.add(isF ? "fly-l" : "fly-r");
      var bin = isF ? binF : binN; bin.querySelector(".thumbs").appendChild(canvasOf(t));
      bin.classList.remove("pulse-in"); void bin.offsetWidth; bin.classList.add("pulse-in");
      pic.cell(t.r, t.c).classList.add("done");
      L.timeout(next, 260);
    }
    answerKeys(L, answer);

    async function aiTurn() {
      if (!L.alive) return;
      await L.say("hoot", "Now the real **ForestNet** sorts the same tiles. It runs right here, inside your web browser!");
      if (!L.alive) return;
      right.innerHTML = "";
      var m = machine(), bar = pbar(), slot = el("div", { style: { width: "150px", height: "150px" } });
      var verdict = el("div", { style: { minHeight: "44px" } }), skip = el("button", { class: "btn small", text: "Skip ⏩" });
      var fast = false; skip.onclick = function () { fast = true; };
      right.appendChild(el("div", { class: "td-top" }, el("b", { text: "ForestNet is thinking…" }), el("span", { class: "grow" }), skip));
      right.appendChild(el("div", { class: "td-arena" }, el("div", { class: "td-machine" }, slot, m.el, el("div", { class: "col" }, bar.el, verdict))));
      var aiMs = 0;
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        slot.innerHTML = ""; var cv = canvasOf(t, "enter"); cv.style.width = cv.style.height = "150px"; slot.appendChild(cv);
        pic.cell(t.r, t.c).classList.add("now");
        if (!fast) for (var k = 0; k < 6; k++) { m.flash(k); RQ.audio.sfx("tick"); await L.wait(70); if (!L.alive) return; }
        var r = ai(t); aiMs += r.ms;
        bar.set(r.pForest); m.flash(-1);
        verdict.innerHTML = ""; verdict.appendChild(stamp(r.forest ? "🌳 forest" : "🏙️ not forest", r.forest ? "good" : "ink"));
        pic.cell(t.r, t.c).classList.remove("now", "pick", "done"); pic.cell(t.r, t.c).classList.add(r.forest ? "f" : "nf");
        RQ.audio.sfx(r.forest ? "good" : "beep");
        await L.wait(fast ? 60 : 450); if (!L.alive) return;
      }
      board(aiMs);
    }
    function board(aiMs) {
      right.innerHTML = "";
      var sure = 0, sureAgree = 0, agree = 0, differ = [];
      var grid = el("div", { class: "td-board" }), note = el("div", { class: "td-note", html: "👆 Tap a tile to see what ForestNet's expert saw." });
      list.forEach(function (t) {
        var r = ai(t), same = r.forest === kid[t.id], isSure = r.pForest >= 0.9 || r.pForest <= 0.1;
        if (same) agree++; else differ.push(t);
        if (isSure) { sure++; if (same) sureAgree++; }
        var card = el("button", { class: "td-card " + (same ? "agree" : "differ") },
          canvasOf(t), el("span", { html: "You: " + (kid[t.id] ? "🌳" : "🏙️") + " · AI: " + (r.forest ? "🌳" : "🏙️") }), el("small", { text: "forest " + pct(r.pForest) }));
        card.onclick = function () {
          u.$$(".td-card", grid).forEach(function (c) { c.classList.remove("sel"); }); card.classList.add("sel"); RQ.audio.sfx("select");
          note.innerHTML = VIEW_ICON[r.view] + " ForestNet's <b>" + VIEW_NAME[r.view] + "</b> sees: " +
            r.top.slice(0, 3).map(function (x) { return "<b>" + u.esc(pretty(x.label)) + "</b> " + pct(x.p); }).join(" · ") +
            ". Forest: <b>" + pct(r.pForest) + "</b>" + (r.pForest > 0.3 && r.pForest < 0.7 ? " — a coin flip! Edges are hard." : ".");
        };
        grid.appendChild(card);
      });
      var done = nextButton("Finish ✔");
      right.appendChild(el("div", { class: "td-top" }, el("b", { html: "You and ForestNet agreed on <b>" + agree + " of " + list.length + "</b> tiles" }),
        el("span", { class: "grow" }), done.el));
      right.appendChild(grid); right.appendChild(note);
      var stars = sureAgree >= sure ? 3 : sureAgree >= sure - 2 ? 2 : 1;
      var line = differ.length === 0 ? L.say("hoot", "Perfect match! You and ForestNet think alike, detective.", { mood: "happy" }) :
        L.say("hoot", "Look at the tiles with a ⚡. Tap them: was ForestNet sure, or was it a coin flip?", { mood: "think" });
      line.then(function () { return done.done; }).then(function () {
        if (!L.alive) return;
        L.win({ stars: stars, msg: "You sorted **" + list.length + "** real tiles of " + site.name + ". ForestNet agreed on **" + agree + "**.",
          stats: { "Agreed": agree + " / " + list.length, "Sure tiles matched": sureAgree + " / " + sure, "Your time": (total / 1000).toFixed(1) + " s", "ForestNet": (aiMs / 1000).toFixed(2) + " s" } });
      });
    }
  }

  /* ------------------------------------------------------------ level 2: race the robot on tricky pictures */
  var RACE = ["congo-9-9", "ex-forest_healthy", "ex-fields", "ex-forest_winter", "palm_desert-0-1", "ex-river", "ex-ground_forest",
    "kansas-3-6", "ex-lawn", "ex-city", "manhattan-2-5", "ex-ocean"];
  var NOTES = {
    "ex-forest_winter": "Leafless oaks in winter are still a forest. The leaves come back in spring!",
    "ex-fields": "These bright green fields are farms, not forest. Tree tops look bumpy and cast shadows.",
    "ex-lawn": "A lawn is green, but it is grass. ForestNet's ground-photo expert knows lawns.",
    "palm_desert-0-1": "Golf courses and watered lawns are green, but they are not forest.",
    "kansas-3-6": "Round crop circles: watered farm fields seen from space.",
    "manhattan-2-5": "The greenest tile of Manhattan. A city park has trees, but this tile is mostly city.",
    "ex-ground_forest": "A photo taken on the ground! ForestNet switched to its ground-photo expert.",
    "ex-ocean": "Deep blue water and a reef. No trees here.",
    "ex-river": "A muddy river with green banks: mostly water.",
    "congo-9-9": "A real Sentinel-2 tile of the Congo rainforest.",
    "ex-forest_healthy": "Dense, bumpy tree crowns: a healthy forest.",
    "ex-city": "Rooftops and streets: a city."
  };
  function levelRace(L) {
    var list = RACE.map(tileById).filter(Boolean);
    list = u.shuffle(list, L.rng);
    var root = wrap(L); root.style.flexDirection = "column";
    var kidFace = el("div", { class: "face", html: RQ.chars ? RQ.chars.svg("sprout", { mood: "happy" }) : "🙂" });
    var kidRun = el("div", { class: "who" }, kidFace, el("span", { text: "You" }));
    var botRun = el("div", { class: "who" }, el("div", { class: "robot", text: "🧠" }), el("span", { text: "ForestNet" }));
    var track = el("div", { class: "td-track" }, el("div", { class: "td-lane" }, kidRun, el("span", { class: "flag", text: "🏁" })),
      el("div", { class: "td-lane" }, botRun, el("span", { class: "flag", text: "🏁" })));
    var count = el("span", { class: "chip" }), score = el("span", { class: "chip" });
    var arena = el("div", { class: "td-arena" }), result = el("div", { class: "td-result" });
    var btns = answerButtons(answer);
    root.appendChild(el("div", { class: "td-top" }, count, score, el("span", { class: "grow" }), el("span", { class: "muted", text: "Is it forest? We know the true answer!" })));
    root.appendChild(track); root.appendChild(arena); root.appendChild(btns.el);
    var idx = -1, kidPts = 0, botPts = 0, t0 = 0, kidMs = 0, botMs = 0, busy = true;
    function move() {
      var w = track.clientWidth - Math.max(kidRun.offsetWidth, botRun.offsetWidth) - 60, n = list.length;
      kidRun.style.left = (w * kidPts / n) + "px"; botRun.style.left = (w * botPts / n) + "px";
      score.innerHTML = "You <b>" + kidPts + "</b> · ForestNet <b>" + botPts + "</b>";
    }
    function show() {
      idx++;
      if (idx >= list.length) { finish(); return; }
      var t = list[idx];
      count.innerHTML = "🖼️ " + (idx + 1) + " / " + list.length;
      arena.innerHTML = ""; result.innerHTML = "";
      var photo = el("div", { class: "td-photo enter" });
      if (t.kind === "example") photo.appendChild(el("img", { src: RQ.url(t.file), alt: t.title, draggable: "false" }));
      else { var big = canvasOf(t); photo.appendChild(big); }
      photo.appendChild(el("div", { class: "inset" }, canvasOf(t), el("div", { text: "ForestNet sees" })));
      arena.appendChild(photo); arena.appendChild(result);
      result.appendChild(el("div", { class: "td-say", html: "<b>" + (t.kind === "example" ? "Picture" : "Real satellite tile") + "</b><br>" +
        (t.kind === "example" ? "<span class='muted'>(a test picture made by an image AI)</span>" : u.esc(t.title || "")) }));
      busy = false; btns.enable(true); t0 = performance.now();
    }
    async function answer(isF) {
      if (busy || !L.alive || idx < 0 || idx >= list.length) return;
      busy = true; btns.enable(false);
      var t = list[idx], ms = performance.now() - t0; kidMs += ms;
      var r = ai(t); botMs += r.ms;
      var truth = !!t.truth, kidOk = isF === truth, botOk = r.forest === truth;
      RQ.audio.sfx("snap");
      result.appendChild(el("div", { class: "td-say", html: "🙂 You: <b>" + (isF ? "forest" : "not forest") + "</b> <span class='muted'>(" + (ms / 1000).toFixed(1) + " s)</span>" }));
      await L.wait(350); if (!L.alive) return;
      RQ.audio.sfx("beep");
      result.appendChild(el("div", { class: "td-say ai", html: "🧠 ForestNet: <b>" + (r.forest ? "forest" : "not forest") + "</b> " + pct(r.pForest) + "<br>" +
        VIEW_ICON[r.view] + " " + VIEW_NAME[r.view] + ": " + u.esc(pretty(r.label)) + " <span class='muted'>(" + (r.ms / 1000).toFixed(2) + " s)</span>" }));
      await L.wait(450); if (!L.alive) return;
      var st = el("div", {}, stamp(truth ? "Truth: forest" : "Truth: not forest", truth ? "good" : "ink"));
      result.appendChild(st);
      if (NOTES[t.id]) result.appendChild(el("div", { class: "td-note", text: NOTES[t.id] }));
      if (kidOk) { kidPts++; RQ.audio.sfx("good"); } else { RQ.audio.sfx("giggle"); }
      if (botOk) botPts++;
      move();
      var nb = nextButton(idx + 1 >= list.length ? "See who won 🏁" : "Next ▶");
      result.appendChild(nb.el); nb.el.focus();
      var go = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nb.el.click(); } };
      var off = L.on(window, "keydown", go);
      await nb.done; window.removeEventListener("keydown", off);
      if (!L.alive) return;
      show();
    }
    answerKeys(L, answer);
    function finish() {
      var n = list.length, stars = kidPts >= n - 1 ? 3 : kidPts >= n - 3 ? 2 : 1;
      var msg = kidPts > botPts ? "You beat ForestNet!" : kidPts === botPts ? "A tie with ForestNet!" : "ForestNet won this race, but you were close!";
      L.win({ stars: stars, msg: msg + " ForestNet answered all " + n + " pictures in " + (botMs / 1000).toFixed(1) + " seconds.",
        stats: { "You": kidPts + " / " + n, "ForestNet": botPts + " / " + n, "Your time": (kidMs / 1000).toFixed(0) + " s" } });
    }
    move(); L.timeout(show, 300);
    L.on(window, "resize", move);
  }

  /* ------------------------------------------------------------ level 3: the 1-in-4 rule */
  function ruleSites() {
    var my = RQ.mySiteId(), second = my === "dixie" ? "kalimantan" : "dixie";
    return ["manhattan", my, "maldives", second, "manaus"].map(RQ.site).filter(Boolean);
  }
  function levelRule(L) {
    var sites = ruleSites(), k = -1, right = 0, close = 0;
    var root = wrap(L), left = el("div", { class: "td-left" }), panel = el("div", { class: "td-right panel" });
    root.appendChild(left); root.appendChild(panel);
    L.hud.set("site", "📍 1 / " + sites.length);
    nextSite();
    function nextSite() {
      k++;
      if (k >= sites.length) return finish();
      L.hud.set("site", "📍 " + (k + 1) + " / " + sites.length);
      var site = sites[k], forestSite = !!BASE_YEAR[site.id], pic = picture(site, "base");
      left.innerHTML = ""; left.appendChild(el("div", { class: "td-cap", html: siteLabel(site, forestSite ? "base" : "now") })); left.appendChild(pic.el);
      panel.innerHTML = "";
      var grid = site.tiles.p_forest, truthN = 0;
      grid.forEach(function (row) { row.forEach(function (p) { if (p >= 0.5) truthN++; }); });
      var guessV = el("span", { class: "td-big-num", text: "50" });
      var range = el("input", { type: "range", min: "0", max: "100", step: "1", value: "50", class: "td-range", "aria-label": "Your guess: forest tiles out of 100" });
      L.on(range, "input", function () { guessV.textContent = range.value; RQ.audio.sfx("tick"); });
      var scanBtn = el("button", { class: "btn big primary", html: "🔍 Scan with ForestNet" });
      var meterFill = el("i"), meterTxt = el("span", { text: "0 / 100 forest tiles" }), guessMark = el("div", { class: "guess" });
      var meter = el("div", { class: "td-meter" }, meterFill, el("div", { class: "line" }), meterTxt);
      panel.appendChild(el("h2", { style: { margin: "0" }, text: site.name }));
      panel.appendChild(el("div", { class: "muted", text: site.story }));
      panel.appendChild(el("div", { class: "td-note", html: '<span class="td-mini"><i></i><i></i><i></i><i></i></span><b>1-in-4 rule:</b> 25 or more forest tiles out of 100 → forest land. Fewer → <b>STOP</b>.' }));
      var guessBox = el("div", { class: "col", style: { gap: "4px" } }, el("div", { html: "<b>Your guess:</b> how many of the 100 tiles are forest? " }), el("div", { class: "row" }, range, guessV), scanBtn);
      panel.appendChild(guessBox);
      panel.appendChild(el("div", { class: "td-meterlbl" }, el("span", { text: "0" }), el("b", { text: "25 = 1 in 4" }), el("span", { text: "100" })));
      panel.appendChild(meter);
      var decide = el("div", { class: "td-btns", style: { display: "none" } });
      var verdict = el("div", { style: { minHeight: "40px" } });
      panel.appendChild(decide); panel.appendChild(verdict);
      scanBtn.onclick = async function () {
        scanBtn.disabled = true; range.disabled = true; RQ.audio.sfx("whoosh");
        var guess = +range.value; guessMark.style.left = guess + "%"; meter.appendChild(guessMark);
        var n = 0;
        for (var r = 0; r < 10; r++) {
          for (var c = 0; c < 10; c++) {
            var cell = pic.cell(r, c), p = grid[r][c];
            cell.classList.add(p >= 0.5 ? "f" : "nf");
            if (p >= 0.5) { n++; RQ.audio.sfx("tick"); }
          }
          meterFill.style.width = n + "%"; meterTxt.textContent = n + " / 100 forest tiles";
          await L.wait(110); if (!L.alive) return;
        }
        if (Math.abs(guess - n) <= 15) { close++; L.toast("🎯 Great guess! You said " + guess + ", ForestNet found " + n + ".", "good"); }
        else L.toast("You guessed " + guess + ". ForestNet found " + n + ".", "info");
        var go = el("button", { class: "btn big go", html: "🌳 Forest land: go on!" }), stop = el("button", { class: "btn big danger", html: "⛔ STOP: pick another place" });
        decide.appendChild(go); decide.appendChild(stop); decide.style.display = "";
        guessBox.style.display = "none";
        go.focus();
        var choose = function (isGo) {
          go.disabled = stop.disabled = true;
          var ok = isGo === (site.classifier.forest_tile_fraction >= 0.25);
          if (ok) { right++; RQ.audio.sfx("good"); } else RQ.audio.sfx("giggle");
          var real = site.verdict && site.verdict.code === "NOT_FOREST" ? "NOT FOREST · STOP" : "FOREST LAND → next step";
          verdict.innerHTML = "";
          verdict.appendChild(el("div", { style: { padding: "10px 0 6px" } }, stamp(ok ? "✔ " + real : "✘ ReSeed said: " + real, ok ? "good" : "bad")));
          verdict.appendChild(el("div", { class: "muted", style: { marginTop: "6px" }, html: n + " of 100 tiles = <b>" + n + " %</b> " + (n >= 25 ? "≥" : "<") + " 25 %. ReSeed's file says " + Math.round(site.classifier.forest_tile_fraction * 100) + " %." }));
          var nb = nextButton(k + 1 >= sites.length ? "Finish ✔" : "Next place ▶"); verdict.appendChild(el("div", { style: { marginTop: "8px" } }, nb.el)); nb.el.focus();
          nb.done.then(function () { if (L.alive) nextSite(); });
        };
        go.onclick = function () { choose(true); }; stop.onclick = function () { choose(false); };
      };
    }
    function finish() {
      var n = sites.length, stars = right === n && close >= 3 ? 3 : right >= n - 1 ? 2 : 1;
      L.win({ stars: stars, msg: "You used ReSeed's **1-in-4 rule** on " + n + " real places.", stats: { "Right calls": right + " / " + n, "Close guesses": close + " / " + n } });
    }
  }

  /* ------------------------------------------------------------ level 4: old picture or new picture? */
  function levelThenNow(L) {
    var site = RQ.site("rondonia"), tn = TILES.then_now || { r: 3, c: 0 };
    var root = wrap(L); root.style.alignItems = "center"; root.style.justifyContent = "center";
    var picOld = picture(site, "base", "small"), picNew = picture(site, "now", "small");
    [picOld, picNew].forEach(function (p) { for (var r = tn.r; r < tn.r + 3; r++) for (var c = tn.c; c < tn.c + 3; c++) p.cell(r, c).classList.add("blk"); });
    var bOld = el("button", { class: "btn primary", html: "🕰️ Judge the OLD picture" }), bNew = el("button", { class: "btn primary", html: "📸 Judge the NEW picture" });
    var bottom = el("div", { class: "td-mid" }, el("div", { class: "td-note", html: "The yellow square is the same 3 × 3 tiles (about 2 km) in both pictures. Which one should ForestNet judge?" }));
    root.appendChild(el("div", { class: "col td-side" }, el("div", { class: "td-cap", html: "<b>Old:</b> growing season " + BASE_YEAR.rondonia }), picOld.el, bOld));
    root.appendChild(bottom);
    root.appendChild(el("div", { class: "col td-side" }, el("div", { class: "td-cap", html: "<b>New:</b> " + String(site.image_date || "2026").slice(0, 4) }), picNew.el, bNew));
    var firstPick = null, tried = {}, stars = 1;
    async function judge(which) {
      if (!L.alive || tried[which]) return;
      tried[which] = true; if (!firstPick) firstPick = which;
      bOld.disabled = bNew.disabled = true;
      var list = tileSet(which === "old" ? "then" : "now").sort(function (a, b) { return a.r - b.r || a.c - b.c; });
      bottom.innerHTML = "";
      var nine = el("div", { class: "td-nine" }), count = el("b", { text: "0 / 9 forest tiles" }), out = el("div", { style: { minHeight: "40px" } });
      bottom.appendChild(el("div", { class: "row" }, el("b", { text: (which === "old" ? "🕰️ Old" : "📸 New") + " picture → ForestNet:" }), count));
      bottom.appendChild(nine); bottom.appendChild(out);
      if (which === "new") bottom.appendChild(el("div", { class: "muted", style: { fontSize: ".8rem" }, text: "(game version: today's tiles are rebuilt from the colour picture)" }));
      var cells = list.map(function (t) { var d = el("div", { class: "t" }, canvasOf(t)); nine.appendChild(d); return d; });
      var n = 0;
      for (var i = 0; i < list.length; i++) {
        var r = ai(list[i]); RQ.audio.sfx("tick");
        if (r.forest) { n++; cells[i].classList.add("f"); }
        cells[i].appendChild(el("b", { text: pct(r.pForest) }));
        count.textContent = n + " / 9 forest tiles";
        await L.wait(160); if (!L.alive) return;
      }
      var go = n / 9 >= 0.25;
      out.appendChild(stamp(go ? "🌳 Forest land: GO" : "⛔ STOP: not forest", go ? "good" : "bad"));
      if (which === "new") {
        RQ.audio.sfx("giggle");
        await L.say("bug", "Hee hee, a sneaky disguise! The cut forest looks like a field now, so ReSeed could miss it.");
        if (!L.alive) return;
        if (firstPick === "new") await L.say("hoot", "Oh dear, today's picture hides the lost forest! Try the **old** picture.", { mood: "sad" });
        else await L.say("hoot", "See? The new picture could make ReSeed say STOP, so it judges the **old** one.", { mood: "think" });
      } else {
        RQ.audio.sfx("good");
        if (firstPick === "old") await L.say("hoot", "Brilliant! The old picture shows forest land, so the rescue goes on, but peek at the new one.", { mood: "happy" });
        else await L.say("hoot", "Yes! The old picture still shows the forest, so ReSeed can plan to plant it back.", { mood: "happy" });
      }
      if (!L.alive) return;
      bOld.disabled = !!tried.old; bNew.disabled = !!tried.new;
      if (tried.old && tried.new) part2();
    }
    bOld.onclick = function () { judge("old"); }; bNew.onclick = function () { judge("new"); };
    async function part2() {
      if (firstPick === "old") stars++;
      root.innerHTML = ""; root.style.alignItems = "center"; root.style.paddingBottom = "170px";
      var burned = tileById("ex-forest_burned"), dixie = RQ.site("dixie");
      var r = burned ? ai(burned) : { pForest: 0.12, forest: false };
      var row = el("div", { class: "td-pair", style: { flexWrap: "wrap", justifyContent: "center", width: "100%" } });
      root.appendChild(row);
      if (burned) row.appendChild(el("div", { class: "td-photo" }, el("img", { src: RQ.url(burned.file), alt: "burned forest test picture" })));
      row.appendChild(el("div", { class: "td-say ai", style: { maxWidth: "260px" }, html: "🧠 ForestNet on a <b>burned forest</b>:<br><b>forest " + pct(r.pForest) + "</b> → " + (r.forest ? "forest" : "not forest!") +
        "<br><span class='muted'>(a test picture made by an image AI)</span>" }));
      if (dixie) {
        row.appendChild(el("div", { class: "col" }, el("img", { src: RQ.url(dixie.files.rgb_baseline), alt: "Dixie before the fire" }), el("b", { text: "A: Dixie, " + BASE_YEAR.dixie })));
        row.appendChild(el("div", { class: "col" }, el("img", { src: RQ.url(dixie.files.rgb), alt: "Dixie after the fire" }), el("b", { text: "B: Dixie, " + String(dixie.image_date || "2026").slice(0, 4) })));
      }
      await L.wait(300); if (!L.alive) return;
      var pick = await L.choose("hoot", "The Dixie Fire burned in 2021. Which picture should ReSeed's forest check use?",
        ["A: the 2020 picture, before the fire", "B: the 2026 picture, after the fire"]);
      if (!L.alive) return;
      if (pick === 0) { stars++; RQ.audio.sfx("good"); await L.say("hoot", "Exactly! Burned forest still counts as **forest land**, so ReSeed can plan to replant it.", { mood: "happy" }); }
      else { RQ.audio.sfx("giggle"); await L.say("hoot", "Careful! After the fire ForestNet might say not forest, so ReSeed judges the picture from before the fire.", { mood: "think" }); }
      if (!L.alive) return;
      L.win({ stars: Math.min(3, stars), msg: "ReSeed checks an **old picture from the growing season**, so cut-down or burned forest still counts as forest land.",
        stats: { "First pick": firstPick === "old" ? "old picture ✔" : "new picture", "Dixie question": pick === 0 ? "✔" : "✘" } });
    }
    if (L.fails >= 1) L.hint("Think: what did this place look like **before** it was cut down?");
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g10",
    music: "mystery",
    intro: [
      ["hoot", "Hoo, welcome to Check island, detective! Before we save a forest, we must be sure it really is a forest."],
      ["sprout", "We cut pictures from space into little squares called **tiles**. Then we race the real AI, **ForestNet**!"]
    ],
    outro: [
      ["hoot", "Splendid detective work! You sorted tiles, raced ForestNet and used the 1-in-4 rule."],
      ["sprout", "Next stop: **Brain Builder**. Let's find out how ForestNet's brain works inside!"]
    ],
    levels: [
      { title: "Forest or not?", goal: "Sort each glowing tile: forest or not forest",
        intro: [["hoot", "Here is **My Site** from space, cut into tiles 640 m wide. Sort each glowing tile: forest, or not forest?"],
                ["sprout", "Press **F** for forest and **N** for not forest, or tap the big buttons. Quick, detective!"]],
        cards: ["image-tiles", "classifier", "ai-in-browser"],
        play: levelSort },
      { title: "Race the robot", goal: "Forest or not? Beat ForestNet on tricky pictures",
        intro: [["hoot", "Some pictures are tricky: lawns, farm fields, winter forests. Race ForestNet and see who is right!"],
                ["sprout", "We know the true answer for every picture. One step forward for each right answer!"]],
        cards: ["view-gate"],
        play: levelRace },
      { title: "The 1-in-4 rule", goal: "Guess, scan, then say GO or STOP",
        intro: [["hoot", "ReSeed only helps places that were forest. If at least **1 tile in 4** is forest, it is **forest land**."],
                ["hoot", "If not, ReSeed says **STOP** and looks somewhere else. Guess first, then scan!"]],
        cards: ["one-in-four"],
        play: levelRule },
      { title: "Old or new picture?", goal: "Choose which picture ForestNet should judge",
        intro: [["hoot", "A tricky case! This rainforest in Rondônia was cut down, and today much of it looks like cow pasture."],
                ["hoot", "Which picture should ForestNet judge: the old one or the new one? You decide."]],
        cards: ["baseline-picture"],
        play: levelThenNow }
    ]
  });
})();
