/* ReSeed Quest hub: the world map. Eight islands follow the ReSeed journey (Base Camp + See … Share).
 * Click an island to see its games; progress, Field Guide, My Site and settings live here. */
(function () {
  "use strict";
  var u = RQ.u, cat = RQ.catalog, save = RQ.save, ui = RQ.ui;
  var VW = 1600, VH = 900;
  var POS = [[235, 600], [500, 465], [780, 640], [1060, 495], [1345, 650], [1395, 295], [1020, 185], [600, 205]];
  var DECOR = [["⛺", "🖥️", "🌲"], ["📡", "🌲", "🏔️"], ["🧠", "🌲", "🏫"], ["🌿", "🌳", "🔬"], ["🔎", "🏚️", "🌲"],
    ["🗺️", "🏭", "🌳"], ["🚁", "🌲", "🌳"], ["🌐", "🏢", "🌲"]];
  var NS = "http://www.w3.org/2000/svg";
  var st = save.load();

  document.body.classList.add("rq", "hub");

  /* ------------------------------------------------------------ progress helpers */
  function gameStars(g) { var s = (st.games[g.id] && st.games[g.id].stars) || []; return s.reduce(function (a, b) { return a + (b || 0); }, 0); }
  function gameStarted(g) { return gameStars(g) > 0; }
  function gameDone(g) { return !!(st.games[g.id] && st.games[g.id].done); }
  function nextGame() {
    var gs = cat.games;
    for (var i = 0; i < gs.length; i++) if (!gameStarted(gs[i])) return gs[i];
    for (i = 0; i < gs.length; i++) if (!gameDone(gs[i])) return gs[i];
    return null;
  }
  function chapterStars(n) {
    var got = 0, max = 0;
    cat.inChapter(n).forEach(function (g) { got += gameStars(g); max += 3 * (g.levels || 4); });
    return { got: got };
  }
  function href(g) { return cat.href(g, ""); }

  /* ------------------------------------------------------------ header */
  var starsChip = u.el("span", { class: "chip", title: "Stars collected" });
  var cardsChip = u.el("button", { class: "chip btn", style: { minHeight: "38px" }, title: "Open the Field Guide", onclick: openGuide });
  var nickChip = u.el("button", { class: "chip btn nick hide-sm", style: { minHeight: "38px" }, title: "Your explorer name", onclick: askNick });
  var siteChip = u.el("button", { class: "chip btn hide-sm", style: { minHeight: "38px" }, title: "Your forest site", onclick: pickSite });
  function refreshHeader() {
    st = save.load();
    starsChip.innerHTML = "⭐ " + save.totalStars();
    cardsChip.innerHTML = "🃏 " + RQ.cards.count() + " / " + RQ.cards.order.length;
    nickChip.innerHTML = "🧑‍🚀 " + u.esc(st.nick || "Explorer");
    var s = RQ.mySite(); siteChip.innerHTML = "🌳 " + u.esc(s ? s.name.split(",")[0] : "My site");
  }
  var top = u.el("header", { class: "hub-top" },
    u.el("a", { class: "hub-logo", href: "index.html" }, u.el("span", { class: "mark", html: RQ.chars.svg("sprout") }),
      u.el("span", {}, u.el("b", { html: "ReSeed <span>Quest</span>" }), u.el("small", { text: "Satellites find lost forest. Drones plant it back. You help!" }))),
    u.el("span", { class: "sp" }), nickChip, siteChip, starsChip, cardsChip,
    u.el("button", { class: "btn small", title: "Settings", onclick: openSettings, html: "⚙️" }),
    u.el("a", { class: "btn small hide-sm", href: "parents.html", title: "For parents and teachers", html: "👪 Grown-ups" }));
  document.body.appendChild(top);

  /* ------------------------------------------------------------ map */
  var map = u.el("main", { class: "hub-map" });
  document.body.appendChild(map);
  function S(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  var svg = S("svg", { viewBox: "0 0 " + VW + " " + VH, preserveAspectRatio: "xMidYMid slice", role: "img", "aria-label": "World map with eight islands" }, map);
  var defs = S("defs", {}, svg);
  defs.innerHTML = '<radialGradient id="sea" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#8fe0ff"/><stop offset=".7" stop-color="#4fb6e3"/><stop offset="1" stop-color="#2d8fc4"/></radialGradient>' +
    '<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6e57f"/><stop offset="1" stop-color="#6cc35a"/></linearGradient>' +
    '<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>';
  S("rect", { x: 0, y: 0, width: VW, height: VH, fill: "url(#sea)" }, svg);
  // waves
  var waves = S("g", { class: "wave", opacity: .35 }, svg);
  for (var wy = 60; wy < VH; wy += 70) for (var wx = (wy / 70 % 2) * 60; wx < VW + 60; wx += 120) S("path", { d: "M" + wx + " " + wy + " q 15 -10 30 0 t 30 0", stroke: "#fff", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, waves);
  // the flight path between islands
  var pathD = "M" + POS[0][0] + " " + POS[0][1];
  for (var i = 1; i < POS.length; i++) {
    var a = POS[i - 1], b = POS[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 70;
    pathD += " Q" + mx + " " + my + " " + b[0] + " " + b[1];
  }
  S("path", { d: pathD, fill: "none", stroke: "rgba(255,255,255,.85)", "stroke-width": 7, "stroke-dasharray": "2 18", "stroke-linecap": "round" }, svg);

  function blob(cx, cy, rx, ry, seed) {
    var r = u.seeded(seed), n = 14, pts = [];
    for (var k = 0; k < n; k++) { var t = k / n * Math.PI * 2, f = .86 + r() * .22; pts.push([cx + Math.cos(t) * rx * f, cy + Math.sin(t) * ry * f]); }
    var d = "";
    for (k = 0; k < n; k++) {
      var p = pts[k], q = pts[(k + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (k === 0) { var l = pts[n - 1]; d += "M" + ((l[0] + p[0]) / 2).toFixed(1) + " " + ((l[1] + p[1]) / 2).toFixed(1); }
      d += " Q" + p[0].toFixed(1) + " " + p[1].toFixed(1) + " " + m[0].toFixed(1) + " " + m[1].toFixed(1);
    }
    return d + "Z";
  }
  var islands = [];
  cat.chapters.forEach(function (ch, n) {
    var x = POS[n][0], y = POS[n][1], rx = 150, ry = 78;
    var g = S("g", { class: "isl", tabindex: 0, role: "button", "aria-label": "Island " + n + ": " + ch.name + ", " + ch.label }, svg);
    S("ellipse", { cx: x, cy: y + 60, rx: rx * 1.08, ry: ry * .55, fill: "rgba(0,40,80,.28)", filter: "url(#soft)" }, g);
    S("ellipse", { class: "ring", cx: x, cy: y + 10, rx: rx * 1.15, ry: ry * 1.05, fill: "none", stroke: "#fff", "stroke-width": 6, opacity: 0 }, g);
    S("path", { d: blob(x, y + 30, rx * 1.02, ry * 1.02, "s" + n), fill: "#9b6a43", stroke: "#1d2b3a", "stroke-width": 4 }, g);
    S("path", { d: blob(x, y + 8, rx * 1.06, ry * 1.06, "s" + n), fill: "#f4dc9b", stroke: "#1d2b3a", "stroke-width": 4 }, g);
    S("path", { class: "top", d: blob(x, y, rx * .94, ry * .9, "t" + n), fill: "url(#grass)", stroke: "#1d2b3a", "stroke-width": 4 }, g);
    // decorations
    var dec = DECOR[n];
    [[-78, -6, 46], [62, 2, 42], [-6, -34, 34], [-40, 28, 30], [92, -30, 30]].forEach(function (p, k) {
      var t = S("text", { x: x + p[0], y: y + p[1], "font-size": p[2], "text-anchor": "middle", "dominant-baseline": "middle" }, g);
      t.textContent = k < 3 ? dec[k] : "🌲";
    });
    // flag
    S("line", { x1: x + 8, y1: y - 10, x2: x + 8, y2: y - 92, stroke: "#1d2b3a", "stroke-width": 5, "stroke-linecap": "round" }, g);
    S("path", { d: "M" + (x + 10) + " " + (y - 92) + " l58 14 l-58 16 z", fill: ch.color, stroke: "#1d2b3a", "stroke-width": 4, "stroke-linejoin": "round" }, g);
    var fl = S("text", { x: x + 28, y: y - 75, "font-size": 20, "text-anchor": "middle", "dominant-baseline": "middle" }, g); fl.textContent = ch.icon;
    // label
    var lab = S("g", {}, g);
    S("rect", { x: x - 112, y: y + 76, width: 224, height: 54, rx: 18, fill: "#fffdf7", stroke: "#1d2b3a", "stroke-width": 4 }, lab);
    S("rect", { x: x - 112, y: y + 76, width: 46, height: 54, rx: 18, fill: ch.color, stroke: "#1d2b3a", "stroke-width": 4 }, lab);
    var num = S("text", { x: x - 89, y: y + 104, "font-size": 24, "font-weight": 700, fill: "#fff", "text-anchor": "middle", "dominant-baseline": "middle", "font-family": "Fredoka, sans-serif" }, lab); num.textContent = n === 0 ? "⛺" : String(n);
    var nm = S("text", { x: x - 56, y: y + 96, "font-size": 22, "font-weight": 700, fill: "#1d2b3a", "dominant-baseline": "middle", "font-family": "Fredoka, sans-serif" }, lab); nm.textContent = ch.name;
    var sub = S("text", { x: x - 56, y: y + 117, "font-size": 15, "font-weight": 500, fill: "#4a5b6d", "dominant-baseline": "middle", "font-family": "Fredoka, sans-serif" }, lab);
    g.addEventListener("click", function () { RQ.audio.sfx("select"); openIsland(n); });
    g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIsland(n); } });
    islands.push({ g: g, sub: sub });
  });
  // drifting clouds
  for (var c = 0; c < 5; c++) {
    var cg = S("g", { class: "cloud", style: "animation-duration:" + (70 + c * 17) + "s;animation-delay:-" + (c * 23) + "s", opacity: .9 }, svg);
    var cy = 80 + c * 160 % 760;
    S("path", { d: "M0 " + cy + " a30 30 0 0 1 50 -20 a40 40 0 0 1 75 5 a28 28 0 0 1 30 35 z", fill: "#fff", stroke: "rgba(29,43,58,.25)", "stroke-width": 3 }, cg);
  }
  // Sprout drone flying to the next island
  var drone = S("g", { class: "hub-drone" }, svg);
  var dimg = S("image", { width: 96, height: 96, x: -48, y: -120, href: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg("sprout")) }, drone);
  dimg.setAttribute("class", "ch-bob");

  function refreshMap() {
    var nx = nextGame(), nChap = nx ? nx.chapter : -1;
    islands.forEach(function (isl, n) {
      var games = cat.inChapter(n), started = games.filter(gameStarted).length;
      isl.sub.textContent = started + " / " + games.length + " games · ⭐ " + chapterStars(n).got;
      isl.g.classList.toggle("next", n === nChap);
    });
    var p = POS[nChap >= 0 ? nChap : 7];
    drone.setAttribute("transform", "translate(" + p[0] + "," + (p[1] - 40) + ")");
  }

  /* ------------------------------------------------------------ island drawer */
  var drawer = u.el("aside", { class: "drawer", "aria-hidden": "true" });
  document.body.appendChild(drawer);
  var openN = -1;
  function openIsland(n) {
    var ch = cat.chapter(n), nx = nextGame();
    if (!ch) return;
    openN = n;
    drawer.style.setProperty("--ic", ch.color);
    drawer.innerHTML = "";
    drawer.appendChild(u.el("div", { class: "head" },
      u.el("div", { class: "who", html: RQ.chars.svg(ch.who) }),
      u.el("div", {}, u.el("small", { text: (n === 0 ? "Base Camp" : "Island " + n) + " · " + ch.step }), u.el("h2", { text: ch.name + ": " + ch.label })),
      u.el("button", { class: "btn small x", "aria-label": "Close", html: "✕", onclick: closeIsland })));
    drawer.appendChild(u.el("p", { class: "story", text: ch.story }));
    var list = u.el("div", { class: "gcards" });
    cat.inChapter(n).forEach(function (g) {
      var stars = gameStars(g), done = gameDone(g);
      list.appendChild(u.el("div", { class: "gcard" + (nx && nx.id === g.id ? " next" : "") },
        u.el("a", { class: "cover", href: href(g), style: { background: "linear-gradient(135deg," + ch.color + ", " + ch.tint + ")" }, "aria-hidden": "true", tabindex: "-1", text: g.icon }),
        u.el("div", { class: "info" },
          u.el("b", { text: g.title }), u.el("p", { text: g.tagline }),
          u.el("div", { class: "stars", html: (stars ? "⭐ " + stars + (done ? " · ✅ done" : "") : "<span class='muted'>New!</span>") }),
          u.el("div", { class: "skills" }, g.skills.map(function (s) { return u.el("span", { text: s }); }))),
        u.el("a", { class: "btn play " + (nx && nx.id === g.id ? "go" : "primary"), href: href(g), html: stars ? "▶ Play" : "▶ Start" })));
    });
    drawer.appendChild(list);
    drawer.appendChild(u.el("div", { class: "foot" },
      u.el("label", { class: "row", style: { gap: "8px", cursor: "pointer" } },
        u.el("input", { type: "checkbox", checked: document.body.classList.contains("grownup") || null, onchange: function (e) { document.body.classList.toggle("grownup", e.target.checked); } }),
        "Show what each game teaches (for grown-ups)")));
    drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false");
    history.replaceState(null, "", "#island-" + n);
    var first = drawer.querySelector(".btn.play"); if (first) setTimeout(function () { first.focus(); }, 300);
  }
  function closeIsland() {
    drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); openN = -1;
    history.replaceState(null, "", "#");
  }
  window.addEventListener("keydown", function (e) { if (e.key === "Escape" && openN >= 0 && !document.querySelector(".rq-overlay")) closeIsland(); });
  map.addEventListener("click", function (e) { if (openN >= 0 && !e.target.closest(".isl")) closeIsland(); });

  /* ------------------------------------------------------------ next-adventure banner */
  var nextBox = u.el("div", { class: "hub-next" });
  document.body.appendChild(nextBox);
  function refreshNext() {
    var nx = nextGame(); nextBox.innerHTML = "";
    var ch = nx ? cat.chapter(nx.chapter) : null;
    nextBox.appendChild(u.el("div", { class: "who", html: RQ.chars.svg(ch ? ch.who : "sprout", { mood: nx ? "happy" : "wow" }) }));
    nextBox.appendChild(u.el("div", {},
      u.el("p", { html: nx ? "Next adventure: <b>" + u.esc(nx.title) + "</b> on <b>" + u.esc(ch.name) + "</b> island." : "You finished every adventure! The forest is growing back. 🌳" }),
      nx ? u.el("div", { class: "row" }, u.el("a", { class: "btn go", href: href(nx), html: "▶ Play " + u.esc(nx.title) }), u.el("button", { class: "btn small", html: "🏝️ Island", onclick: function () { openIsland(nx.chapter); } }))
        : u.el("button", { class: "btn primary", html: "🃏 Open the Field Guide", onclick: openGuide })));
  }

  /* ------------------------------------------------------------ Field Guide */
  function openGuide() {
    var filter = null, node = u.el("div");
    var bar = u.el("div", { class: "guide-filters" }), grid = u.el("div", { class: "guide-grid" });
    var cats = {};
    RQ.cards.order.forEach(function (id) { cats[RQ.cards.all[id].cat] = 1; });
    function render() {
      bar.innerHTML = ""; grid.innerHTML = "";
      bar.appendChild(u.el("button", { class: "btn small" + (filter ? "" : " on"), text: "All", onclick: function () { filter = null; render(); } }));
      Object.keys(cats).forEach(function (k) {
        var cc = RQ.CARD_CATS[k] || { label: k, icon: "🃏" };
        bar.appendChild(u.el("button", { class: "btn small" + (filter === k ? " on" : ""), html: cc.icon + " " + cc.label, onclick: function () { filter = k; render(); } }));
      });
      RQ.cards.order.forEach(function (id) {
        var c = RQ.cards.all[id]; if (filter && c.cat !== filter) return;
        var have = RQ.cards.has(id), g = cat.game(c.game), cc = RQ.CARD_CATS[c.cat] || {};
        var slot = u.el("div", { class: "gslot" + (have ? "" : " locked"), style: have ? { borderColor: "#1d2b3a", boxShadow: "inset 0 6px 0 " + (cc.color || "#888") } : {} },
          u.el("span", { class: "i", text: have ? (c.icon || cc.icon) : "❔" }),
          u.el("b", { text: have ? c.name : "???" }),
          u.el("small", { text: have ? (cc.label || "") : "Find it in " + (g ? g.title : "a game") }));
        if (have) slot.addEventListener("click", function () { ui.modal({ html: ui.cardHTML(c), buttons: [{ label: "Back", cls: "primary" }] }); });
        grid.appendChild(slot);
      });
    }
    render();
    node.appendChild(u.el("p", { class: "muted", html: "Every game hides Field Cards. You have <b>" + RQ.cards.count() + "</b> of <b>" + RQ.cards.order.length + "</b>." }));
    node.appendChild(bar); node.appendChild(grid);
    ui.modal({ icon: "🃏", title: "Field Guide", node: node, buttons: [{ label: "Close", cls: "primary" }] });
  }

  /* ------------------------------------------------------------ nickname, my site, settings */
  function askNick() {
    var inp = u.el("input", { type: "text", maxlength: 16, value: st.nick || "", placeholder: "e.g. Captain Leaf", "aria-label": "Explorer name",
      style: { font: "inherit", fontSize: "1.3rem", padding: "8px 12px", border: "3px solid #1d2b3a", borderRadius: "12px", width: "80%", textAlign: "center" } });
    var node = u.el("div", {}, u.el("p", { text: "What should we call you? Use a fun explorer name, not your real full name." }), inp);
    setTimeout(function () { inp.focus(); }, 80);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") ui._modal && ui._modal.close("ok"); });
    return ui.modal({ icon: "🧑‍🚀", title: "Explorer name", node: node, buttons: [{ label: "Save", cls: "go", value: "ok" }, { label: "Skip", value: "skip" }] })
      .then(function (v) { if (v === "ok") { st.nick = inp.value.replace(/[<>]/g, "").trim().slice(0, 16); save.write(); } refreshHeader(); });
  }
  function pickSite() {
    var cur = RQ.mySiteId(), node = u.el("div"), box = u.el("div", { class: "site-pick" });
    node.appendChild(u.el("p", { text: "Pick the forest you will rescue. It travels with you from game to game. All three are real places that ReSeed checked from space." }));
    RQ.MY_SITE_CHOICES.forEach(function (id) {
      var s = RQ.site(id); if (!s) return;
      var b = u.el("button", { class: id === cur ? "on" : "", onclick: function () { cur = id; u.$$(".site-pick button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); RQ.audio.sfx("select"); } },
        u.el("img", { src: RQ.url(s.files.thumb), alt: s.name }), u.el("b", { text: s.name.split(",")[0] }), u.el("small", { text: s.country }));
      box.appendChild(b);
    });
    node.appendChild(box);
    return ui.modal({ icon: "🌳", title: "My forest site", node: node, buttons: [{ label: "This one!", cls: "go", value: "ok" }] })
      .then(function (v) { if (v === "ok") RQ.setMySite(cur); refreshHeader(); });
  }
  function openSettings() {
    var node = u.el("div", { class: "col", style: { alignItems: "stretch", textAlign: "left" } });
    [["sound", "🔊 Sound effects"], ["music", "🎵 Music"], ["voice", "🗣️ Read speech bubbles aloud"], ["tts", "🤖 Use the computer voice when there is no recording"]].forEach(function (s) {
      node.appendChild(u.el("label", { class: "row", style: { cursor: "pointer", fontSize: "1.1rem" } },
        u.el("input", { type: "checkbox", checked: save.setting(s[0]) || null, style: { width: "24px", height: "24px" },
          onchange: function (e) { save.setting(s[0], e.target.checked); if (s[0] === "music") RQ.audio.music(e.target.checked ? "camp" : null); } }), s[1]));
    });
    node.appendChild(u.el("hr"));
    node.appendChild(u.el("button", { class: "btn danger small", text: "Start over (erase stars and cards on this computer)", onclick: function () {
      if (window.confirm("Erase all progress on this computer?")) { save.reset(); location.reload(); }
    } }));
    ui.modal({ icon: "⚙️", title: "Settings", node: node, buttons: [{ label: "Done", cls: "primary" }] });
  }

  /* ------------------------------------------------------------ first visit */
  function welcome() {
    return ui.talk([
      ["sprout", "Hi! I'm Sprout, a seed drone. Welcome to **ReSeed Quest**!"],
      ["sprout", "Forests are being cut down and burned. Satellites can find the lost forest, and drones like me can plant it back."],
      ["sprout", "Each island is one step of the real ReSeed program. Play the games, collect Field Cards, and take breaks whenever you like."]
    ]).then(askNick).then(pickSite).then(function () { st.seenHub = true; save.write(); refreshAll(); });
  }

  function refreshAll() { refreshHeader(); refreshMap(); refreshNext(); }
  refreshAll();
  RQ.audio.music("camp");
  var m = /^#island-(\d+)$/.exec(location.hash), mi = m ? parseInt(m[1], 10) : -1;
  if (cat.chapter(mi)) openIsland(mi);
  else if (!st.seenHub) {
    var startBtn = u.el("div", { class: "rq-overlay" }, u.el("div", { class: "rq-modal" },
      u.el("div", { style: { width: "160px", height: "160px", margin: "0 auto" }, html: RQ.chars.svg("sprout", { mood: "wow" }) }),
      u.el("h2", { html: "ReSeed <span style='color:#2f9e4f'>Quest</span>" }),
      u.el("p", { text: "A game adventure about satellites, AI, drones and forests. For explorers aged 8 to 12." }),
      u.el("div", { class: "buttons" }, u.el("button", { class: "btn big go pulse", html: "▶ Let's go!", onclick: function () { startBtn.remove(); RQ.audio.ctx(); RQ.audio.music("camp"); welcome(); } }))));
    document.body.appendChild(startBtn);
  }
  window.addEventListener("pageshow", function () { save.load(true); refreshAll(); });
  window.addEventListener("storage", function () { refreshAll(); });
})();
