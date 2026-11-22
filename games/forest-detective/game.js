/* g15 Forest Detective — the 13 real ReSeed sites as case files. The kid applies ReSeed's rule (reseed/detect.py + pipeline.py,
 * thresholds from config.py via RQ.data().thresholds): forest check first (ForestNet, 1 in 4 tiles) -> NOT FOREST; a lost patch
 * of 1 ha or more (best-season NDVI down >= 0.20 or 25 % in two recent seasons + burn-or-clearing clue) -> RESEED; low only in
 * winter, summer peak back -> SEASONAL; a past dip >= 0.12 that healed -> RECOVERING; else HEALTHY.
 * Levels: triage (forest first) · lost or just winter? · fire and recovery · build the if/elif rule and run it on all 13 cases. */
(function () {
  "use strict";
  var u = RQ.u, el = u.el;
  var D = RQ.data() || { sites: [], thresholds: {} }, T = D.thresholds || {};
  // config.py baseline_years per forest site; Site.recent_years default (2025, 2026)
  var BASE = { rondonia: [2017, 2018, 2019], dixie: [2018, 2019, 2020], ozarks: [2019, 2020, 2021], kangaroo: [2017, 2018, 2019],
    kalimantan: [2017, 2018, 2019], congo: [2018, 2019, 2020] };
  var RECENT = [2025, 2026];
  var LABEL = { RESEED: "RESEED", SEASONAL: "SEASONAL", RECOVERING: "RECOVERING", HEALTHY: "HEALTHY", NOT_FOREST: "NOT FOREST", OPEN: "OPEN CASE" };
  var ICON = { RESEED: "🚁", SEASONAL: "❄️", RECOVERING: "🩹", HEALTHY: "🌳", NOT_FOREST: "⛔", OPEN: "📂" };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var INK = "#1d2b3a";

  /* ------------------------------------------------------------ the facts of a case, from ReSeed's results */
  function facts(s) {
    var f = { s: s, id: s.id, code: s.verdict.code, tiles: s.classifier.forest_tile_fraction };
    f.forest = f.tiles >= ((D.forest_rule && D.forest_rule.min_forest_tile_fraction) || 0.25);
    f.ndviWork = f.forest && !!(s.ndvi && s.ndvi.baseline_forest_mean != null);
    f.lost = f.seasonal = f.dip = false;
    if (!f.ndviWork) return f;
    var nd = s.ndvi, by = {};
    s.years.forEach(function (y) { if (y.mean_forest_ndvi != null) by[y.year] = y.mean_forest_ndvi; });
    f.base = nd.baseline_forest_mean;
    f.recent = RECENT.map(function (y) { return by[y]; });
    f.patchHa = s.verdict.patch_ha || 0;
    f.worst = (s.patches || [])[0] || null;
    f.lost = f.patchHa >= 1.0;                                  // detect.summarise: deforested patches >= 1.0 ha -> RESEED
    f.seasonal = (s.verdict.seasonal_fraction || 0) >= 0.3;     // detect.summarise: seasonal leaf-off share >= 0.3
    f.imgNdvi = nd.image_forest_mean; f.imgMonth = +String(s.image_date || "").slice(5, 7) || null; f.imgYear = String(s.image_date || "").slice(0, 4);
    var m = (nd.monthly || []).filter(function (x) { return x.mean_forest_ndvi != null; });
    f.peak = m.length ? m.reduce(function (a, b) { return b.mean_forest_ndvi > a.mean_forest_ndvi ? b : a; }) : null;
    var b0 = Math.max.apply(null, BASE[s.id] || [0]);
    f.history = s.years.filter(function (y) { return y.source === "Sentinel-2" && y.year > b0 && y.year < RECENT[0] && y.mean_forest_ndvi != null; });
    var low = f.history.length ? f.history.reduce(function (a, b) { return b.mean_forest_ndvi < a.mean_forest_ndvi ? b : a; }) : null;
    f.dipYear = low && low.year; f.dipVal = low && low.mean_forest_ndvi;
    f.dip = !!low && f.base - low.mean_forest_ndvi >= (T.RECOVERY_DIP || 0.12);   // pipeline.py RECOVERING check
    return f;
  }
  /** ReSeed's rule (game version of detect.py + pipeline.py). */
  function rule(f) { return !f.forest ? "NOT_FOREST" : f.lost ? "RESEED" : f.seasonal ? "SEASONAL" : f.dip ? "RECOVERING" : "HEALTHY"; }
  var ALL = D.sites.map(facts);
  ALL.forEach(function (f) { if (rule(f) !== f.code) console.warn("forest-detective: rule gives " + rule(f) + " for " + f.id + ", ReSeed says " + f.code); });
  function F(id) { for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i]; return null; }
  function n2(v) { return v == null ? "–" : v.toFixed(2); }
  function baseYear(f) { var b = BASE[f.id] || [], y = null; f.s.years.forEach(function (x) { if (b.indexOf(x.year) >= 0 && x.mean_forest_ndvi != null) y = x.year; }); return y || b[b.length - 1]; }

  /* ------------------------------------------------------------ pieces of a case file */
  function casePic(f, opt) {
    opt = opt || {};
    var s = f.s, files = s.files || {};
    var imgOld = el("img", { src: RQ.url(files.rgb_baseline || files.rgb), alt: s.name + " old picture" });
    var imgNow = el("img", { class: "over", src: RQ.url(files.rgb), alt: s.name + " now" });
    var imgMap = files.classes ? el("img", { class: "over", src: RQ.url(files.classes), alt: "ReSeed's pixel map" }) : null;
    var tag = el("div", { class: "tag" });
    var box = el("div", { class: "fd-pic" }, imgOld, imgNow, imgMap);
    if (opt.grid) {
      var g = el("div", { class: "grid" });
      (s.tiles.p_forest || []).forEach(function (row) { row.forEach(function (p) { g.appendChild(el("i", { class: p >= 0.5 ? "f" : "" })); }); });
      box.appendChild(g);
    }
    box.appendChild(tag);
    var tabs = el("div", { class: "fd-tabs" }), btns = {};
    function show(which) {
      imgNow.classList.toggle("on", which === "now"); if (imgMap) imgMap.classList.toggle("on", which === "map");
      tag.textContent = which === "now" ? "📷 now: " + (MON[(f.imgMonth || 1) - 1] || "") + " " + (f.imgYear || "") : which === "map" ? "🗺️ ReSeed's pixel map" : "🕰️ old: " + (f.ndviWork ? "growing season " + baseYear(f) : "picture from space");
      Object.keys(btns).forEach(function (k) { btns[k].classList.toggle("on", k === which); });
    }
    function tab(key, label) { var b = el("button", { class: "btn small", html: label }); b.onclick = function () { RQ.audio.sfx("click"); show(key); }; btns[key] = b; tabs.appendChild(b); }
    if (!opt.grid) { tab("old", "🕰️ Old"); tab("now", "📷 Now"); }
    show("old");
    return {
      el: box, tabs: tabs, show: show,
      addMap: function () { if (imgMap && !btns.map) { tab("map", "🗺️ ReSeed's map"); } if (imgMap) show("map"); },
      stamp: function (code, second, sub) {
        var st = el("div", { class: "fd-stamp c-" + code + (second ? " second" : ""), html: (second ? "ReSeed: " : "") + ICON[code] + " " + LABEL[code] + (sub ? "<small>" + sub + "</small>" : "") });
        box.appendChild(st); RQ.audio.sfx(second ? "snap" : "boom");
        return st;
      },
      clearStamps: function () { u.$$(".fd-stamp", box).forEach(function (x) { x.remove(); }); }
    };
  }
  function header(f) {
    var my = f.id === RQ.mySiteId();
    return el("div", { class: "fd-head" }, el("div", {}, el("h2", { html: u.esc(f.s.name) + " " + (my ? '<span class="fd-badge">⭐ My Site</span>' : "") }),
      el("div", { class: "muted", text: f.s.country + " · " + f.s.story })));
  }
  /** Bar chart: best-season NDVI per year. */
  function yearsChart(L, host, f) {
    var W = 430, H = 205;
    L.canvas({ w: W, h: H, parent: host, label: "best-season greenness per year", onResize: draw }); // redrawn on every refit
    function draw(api) {
      var c = api.ctx;
      var ys = f.s.years.filter(function (y) { return y.mean_forest_ndvi != null; }), n = ys.length;
      var x0 = 40, x1 = W - 10, y0 = H - 26, y1 = 26, bw = Math.min(30, (x1 - x0) / n - 6);
      function Y(v) { return y0 - v * (y0 - y1); }
      c.font = "600 13px Fredoka, sans-serif"; c.textBaseline = "middle"; c.textAlign = "right"; c.fillStyle = "#4a5b6d";
      [0, 0.5, 1].forEach(function (v) { c.fillText(v.toFixed(1), x0 - 6, Y(v)); c.strokeStyle = "rgba(29,43,58,.12)"; c.beginPath(); c.moveTo(x0, Y(v)); c.lineTo(x1, Y(v)); c.stroke(); });
      var b = BASE[f.id] || [];
      ys.forEach(function (y, i) {
        var x = x0 + (i + .5) * (x1 - x0) / n - bw / 2, v = y.mean_forest_ndvi;
        var col = b.indexOf(y.year) >= 0 ? "#12a39a" : RECENT.indexOf(y.year) >= 0 ? "#d1495b" : y.source === "Landsat" ? "#9fb3c8" : "#e0a21d";
        c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 2; u.rr(c, x, Y(v), bw, y0 - Y(v), 4); c.fill(); c.stroke();
        c.fillStyle = INK; c.textAlign = "center"; c.font = "600 12px Fredoka, sans-serif";
        c.fillText("'" + String(y.year).slice(2), x + bw / 2, y0 + 10); c.fillText(v.toFixed(2), x + bw / 2, Y(v) - 8);
      });
      // baseline and danger line
      c.setLineDash([6, 4]); c.lineWidth = 2;
      c.strokeStyle = "#12a39a"; c.beginPath(); c.moveTo(x0, Y(f.base)); c.lineTo(x1, Y(f.base)); c.stroke();
      var dl = f.base - (T.DECLINE_ABS || 0.2);
      c.strokeStyle = "#d1495b"; c.beginPath(); c.moveTo(x0, Y(dl)); c.lineTo(x1, Y(dl)); c.stroke(); c.setLineDash([]);
      c.font = "700 13px Fredoka, sans-serif"; c.textAlign = "right";
      var lw = c.measureText("danger line −0.20").width;
      c.fillStyle = "rgba(255,255,255,.9)"; c.fillRect(x1 - lw - 6, Y(dl) + 3, lw + 6, 16);
      c.fillStyle = "#d1495b"; c.fillText("danger line −0.20", x1 - 3, Y(dl) + 11); c.textAlign = "left";
      // legend
      var lg = [["#12a39a", "usual before"], ["#e0a21d", "past"], ["#d1495b", "2 recent seasons"], ["#9fb3c8", "Landsat"]], lx = x0;
      lg.forEach(function (it) { c.fillStyle = it[0]; c.fillRect(lx, 6, 12, 12); c.strokeStyle = INK; c.strokeRect(lx, 6, 12, 12); c.fillStyle = INK; c.fillText(it[1], lx + 16, 12); lx += c.measureText(it[1]).width + 32; });
    }
  }
  /** Line chart: NDVI month by month (phenology year) + the picture's day. */
  function waveChart(L, host, f) {
    var W = 430, H = 205;
    L.canvas({ w: W, h: H, parent: host, label: "greenness month by month", onResize: draw });
    function draw(api) {
      var c = api.ctx;
      var x0 = 40, x1 = W - 14, y0 = H - 26, y1 = 26;
      function X(m) { return x0 + (m - .5) / 12 * (x1 - x0); } function Y(v) { return y0 - v * (y0 - y1); }
      c.font = "600 13px Fredoka, sans-serif"; c.textBaseline = "middle"; c.textAlign = "right"; c.fillStyle = "#4a5b6d";
      [0, 0.5, 1].forEach(function (v) { c.fillText(v.toFixed(1), x0 - 6, Y(v)); c.strokeStyle = "rgba(29,43,58,.12)"; c.beginPath(); c.moveTo(x0, Y(v)); c.lineTo(x1, Y(v)); c.stroke(); });
      c.textAlign = "center";
      MON.forEach(function (m, i) { c.fillStyle = "#4a5b6d"; c.fillText(m[0], X(i + 1), y0 + 12); });
      var ms = (f.s.ndvi.monthly || []);
      c.strokeStyle = "#2f9e4f"; c.lineWidth = 3.5; c.beginPath(); var started = false;
      ms.forEach(function (m) { var v = m.mean_forest_ndvi; if (v == null) { started = false; return; } if (!started) { c.moveTo(X(m.month), Y(v)); started = true; } else c.lineTo(X(m.month), Y(v)); });
      c.stroke();
      ms.forEach(function (m) {
        var v = m.mean_forest_ndvi;
        if (v == null) { c.font = "14px sans-serif"; c.fillText("☁️", X(m.month), y0 - 10); return; }
        c.fillStyle = "#2f9e4f"; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(X(m.month), Y(v), 5, 0, 7); c.fill(); c.stroke();
      });
      if (f.peak) { c.font = "16px sans-serif"; c.fillText("⭐", X(f.peak.month), Y(f.peak.mean_forest_ndvi) - 14); }
      if (f.imgMonth && f.imgNdvi != null) {
        var px = X(f.imgMonth), py = Y(f.imgNdvi);
        c.fillStyle = "#ffd84d"; c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.arc(px, py, 9, 0, 7); c.fill(); c.stroke();
        c.font = "700 13px Fredoka, sans-serif"; c.textAlign = px > W - 150 ? "right" : "left";
        var lab = "📷 picture day: " + f.imgNdvi.toFixed(2), tw = c.measureText(lab).width, tx = px + (px > W - 150 ? -14 : 14), ty = py + (py > y0 - 30 ? -16 : 16);
        c.fillStyle = "rgba(255,255,255,.92)"; c.fillRect(px > W - 150 ? tx - tw - 3 : tx - 3, ty - 9, tw + 6, 18);
        c.fillStyle = INK; c.fillText(lab, tx, ty);
      }
      c.textAlign = "left"; c.font = "700 12px Fredoka, sans-serif"; c.fillStyle = INK;
      c.fillText("greenness each month of " + (f.s.phenology_year || "") + "  ·  ⭐ best month  ·  ☁️ too cloudy", x0, 12);
    }
  }
  function patchesHTML(f, withClue) {
    if (!f.ndviWork) return "No NDVI work: not forest land.";
    var w = f.worst, h = "";
    if (f.patchHa >= 1) {
      h += "<div class='big no'>" + u.fmt(f.patchHa, f.patchHa < 20 ? 1 : 0) + " ha lost</div>";
      if (w) h += "Worst patch: <b>" + u.fmt(w.area_ha, 1) + " ha</b>, best season <b>" + n2(w.baseline_peak) + " → " + n2(w.recent_peak) + "</b> (−" + n2(w.decline) + ")<br>";
      h += "<span class='ok'>✓</span> dropped ≥ 0.20 (or 25 %) in <b>both</b> " + RECENT.join(" and ") + " seasons";
      if (withClue) h += "<br>🔥 Every lost pixel also has a burn-or-clearing clue (dNBR ≥ 0.10) <b>or</b> a giant drop (≥ 0.35) <span class='ok'>✓</span>";
    } else if (f.patchHa > 0) {
      h += "<div class='big'>Only " + u.fmt(f.patchHa, 2) + " ha</div>One tiny patch dropped" + (w ? " (" + n2(w.baseline_peak) + " → " + n2(w.recent_peak) + ")" : "") +
        ".<br><b>Too small:</b> ReSeed needs 1 hectare (100 m × 100 m) or more for a mission.";
    } else {
      h += "<div class='big ok'>No lost patches</div>Every big area kept its best-season greenness.";
    }
    return h;
  }
  function dipsHTML(f) {
    if (!f.ndviWork) return "–";
    if (!f.history.length) return "<div class='big'>Not checked</div>ReSeed had no extra past seasons for this place, so it cannot call it RECOVERING.";
    var h = f.history.map(function (y) { return y.year + ": <b>" + n2(y.mean_forest_ndvi) + "</b>"; }).join(" · ");
    var drop = f.base - f.dipVal, last = f.recent[1] != null ? f.recent[1] : f.recent[0];
    return "Usual greenness before <b>" + n2(f.base) + "</b> · past seasons: " + h + "<br>Biggest dip: <b>" + f.dipYear + "</b>, " + n2(drop) + " below usual " +
      (drop >= (T.RECOVERY_DIP || 0.12) ? "<span class='no'>(≥ 0.12: a big dip!)</span>" : "(small)") + "<br>Now (" + RECENT[1] + "): <b>" + n2(last) + "</b>";
  }
  /** A clue card that opens on click. */
  function clue(grid, icon, title, render, onOpen) {
    var card = el("div", { class: "fd-clue closed" }), body = el("div", { class: "b" });
    var btn = el("button", { class: "btn small open", html: "🔍 Inspect" });
    card.appendChild(el("div", { class: "h", html: icon + " " + title })); card.appendChild(body); body.appendChild(btn); grid.appendChild(card);
    var o = { opened: false };
    o.open = function () {
      if (o.opened) return; o.opened = true; card.classList.remove("closed"); body.innerHTML = ""; RQ.audio.sfx("whoosh");
      render(body); if (onOpen) onOpen();
    };
    btn.onclick = o.open;
    return o;
  }

  /* ------------------------------------------------------------ level 1: forest check first (triage of all 13 cases) */
  function levelTriage(L) {
    var list = u.shuffle(ALL.slice(), L.rng), i = -1, wrong = 0;
    var root = el("div", { class: "fd-wrap" }), left = el("div", { class: "fd-left" }), right = el("div", { class: "fd-right" });
    root.appendChild(left); root.appendChild(right); L.stage.appendChild(root);
    var cab = el("div", { class: "fd-cabinet" }), folders = list.map(function (f, k) { var d = el("div", { class: "f", text: String(k + 1) }); cab.appendChild(d); return d; });
    var pic = null, busy = true;
    function next() {
      i++;
      if (i >= list.length) return finish();
      var f = list[i];
      folders.forEach(function (d, k) { d.classList.toggle("now", k === i); });
      L.hud.set("case", "📁 " + (i + 1) + " / " + list.length);
      left.innerHTML = ""; right.innerHTML = "";
      pic = casePic(f, { grid: true });
      left.appendChild(pic.el); left.appendChild(el("div", { class: "muted", style: { fontSize: ".85rem" }, text: "Green squares: tiles ForestNet called forest (old picture)" }));
      right.appendChild(header(f));
      var n = Math.round(f.tiles * 100);
      right.appendChild(el("div", { class: "fd-result fd-report", html: "🧠 <b>ForestNet's report</b><br><span class='num'>" + n + "</span> of 100 tiles were forest<br>" +
        "<span class='muted'>Rule: 1 tile in 4 (25 of 100) or more → forest land → open the case. Fewer → <b>NOT FOREST</b>, stop.</span>" }));
      var sOpen = el("button", { class: "btn big OPEN", html: "📂 OPEN CASE <kbd class='td-key'>O</kbd>" }), sNot = el("button", { class: "btn big NOT_FOREST", html: "⛔ NOT FOREST <kbd class='td-key'>N</kbd>" });
      sOpen.onclick = function () { stamp(true); }; sNot.onclick = function () { stamp(false); };
      right.appendChild(el("div", { class: "fd-stamps" }, sOpen, sNot));
      right.appendChild(el("div", { style: { flex: "1" } }));
      right.appendChild(el("b", { text: "Case files" })); right.appendChild(cab);
      busy = false;
    }
    async function stamp(open) {
      if (busy || !L.alive) return;
      busy = true;
      var f = list[i], ok = open === f.forest;
      pic.stamp(open ? "OPEN" : "NOT_FOREST");
      folders[i].classList.add(ok ? "ok" : "bad");
      if (ok) { RQ.audio.sfx("good"); L.toast(open ? "📂 Forest land: case opened!" : "⛔ Not forest: case closed. Back to step 1!", "good", 1300); await L.wait(1100); }
      else {
        wrong++; RQ.audio.sfx("giggle");
        var n = Math.round(f.tiles * 100);
        L.toast("🐞 " + n + " of 100 is " + (n >= 25 ? "at least" : "less than") + " 25. ReSeed says " + (f.forest ? "forest land" : "NOT FOREST") + ".", "bad", 2600);
        await L.wait(2400);
      }
      if (!L.alive) return;
      next();
    }
    L.on(window, "keydown", function (e) {
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      var k = e.key.toLowerCase();
      if (k === "o") stamp(true); else if (k === "n") stamp(false);
    });
    function finish() {
      var stars = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
      L.win({ stars: stars, msg: "You checked all **" + list.length + "** real places. Only forest land goes on to the NDVI detectives!",
        stats: { "Right": (list.length - wrong) + " / " + list.length, "Closed (not forest)": ALL.filter(function (f) { return !f.forest; }).length } });
    }
    next();
  }

  /* ------------------------------------------------------------ levels 2 + 3: real case files */
  async function speakCase(L, id, right) {
    if (id === "ozarks") {
      if (right) await L.say("hoot", "Yes, it's just winter! The oaks drop their leaves, and every summer they come back.", { mood: "happy" });
      else await L.say("hoot", "Careful, the picture is from January! In summer the greenness is back near its usual level, so it is just winter.", { mood: "think" });
    } else if (id === "rondonia") {
      if (right) await L.say("hoot", "Correct! Huge patches dropped in both recent seasons, so it's time to plan the drones.", { mood: "happy" });
      else await L.say("hoot", "Look at the lost patches: huge areas dropped in both recent seasons. That is a RESEED case.", { mood: "think" });
    } else if (id === "congo") {
      if (right) await L.say("hoot", "Right! The rainforest stays green all year and has no lost patches, so no drones are needed.", { mood: "happy" });
      else await L.say("hoot", "The greenness stays high every year, and there are no lost patches. This forest is healthy!", { mood: "think" });
    } else if (id === "dixie") {
      if (right) await L.say("hoot", "Correct! Shrubs grew back after the fire, but big patches of conifers are still gone.", { mood: "happy" });
      else await L.say("hoot", "Some green came back, but big patches still dropped in both seasons. ReSeed says RESEED.", { mood: "think" });
    } else if (id === "kangaroo") {
      if (right) await L.say("hoot", "Wow, you spotted it! The fire was huge, but the eucalypts sprouted again and the forest seems to be healing by itself.", { mood: "wow" });
      else await L.say("hoot", "Surprise! After the big fire the greenness crashed, but now it is back, and the only lost patch is under 1 hectare.", { mood: "wow" });
      if (L.alive) await L.say("koa", "That's my island! Most of our gum trees grew new leaves right out of their burned trunks.", { mood: "happy" });
    } else if (id === "kalimantan") {
      if (right) await L.say("hoot", "Correct! Small cleared patches dropped in both recent seasons.", { mood: "happy" });
      else await L.say("hoot", "Look closely: small patches, about 10 hectares in total, dropped in both recent seasons.", { mood: "think" });
      if (L.alive) await L.say("hoot", "One limit of the rule: NDVI cannot tell a plantation from a natural forest. This neat grid is a plantation!", { mood: "think" });
    }
  }
  function caseLevel(ids, codes, kinds) {
    return function (L) {
      var list = ids.map(F).filter(Boolean), k = -1, right = 0;
      var root = el("div", { class: "fd-wrap" }), left = el("div", { class: "fd-left" }), side = el("div", { class: "fd-right" });
      root.appendChild(left); root.appendChild(side); L.stage.appendChild(root);
      nextCase();
      function nextCase() {
        k++;
        if (k >= list.length) {
          var stars = right === list.length ? 3 : right >= list.length - 1 ? 2 : 1;
          L.win({ stars: stars, msg: "Case files closed: **" + right + " of " + list.length + "** solved on the first stamp.", stats: { "First-stamp right": right + " / " + list.length } });
          return;
        }
        L.hud.set("case", "📁 Case " + (k + 1) + " / " + list.length);
        var f = list[k], pic = casePic(f);
        left.innerHTML = ""; side.innerHTML = "";
        left.appendChild(pic.el); left.appendChild(pic.tabs);
        side.appendChild(header(f));
        var grid = el("div", { class: "fd-clues" }), opened = 0, stampBtns = [];
        side.appendChild(grid);
        var lock = el("div", { class: "muted", style: { textAlign: "center", fontSize: ".9rem" }, text: "🔍 Inspect at least 2 clues to unlock the stamps." });
        function onOpen() { opened++; if (opened >= 2) { lock.textContent = "Stamp your verdict!"; stampBtns.forEach(function (b) { b.disabled = false; }); } }
        kinds.forEach(function (kind) {
          if (kind === "years") clue(grid, "📈", "Best season each year", function (b) { var h = el("div", { class: "cv" }); b.appendChild(h); yearsChart(L, h, f); }, onOpen);
          if (kind === "wave") clue(grid, "🌊", "Month by month", function (b) { var h = el("div", { class: "cv" }); b.appendChild(h); waveChart(L, h, f); }, onOpen);
          if (kind === "patches") clue(grid, "🔍", "Lost patches", function (b) { b.innerHTML = patchesHTML(f, false); }, onOpen);
          if (kind === "patchclue") clue(grid, "🔥", "Lost patches + burn clue", function (b) { b.innerHTML = patchesHTML(f, true); }, onOpen);
          if (kind === "dips") clue(grid, "🩹", "Past dips", function (b) { b.innerHTML = dipsHTML(f); }, onOpen);
          if (kind === "forestnet") clue(grid, "🧠", "ForestNet check", function (b) {
            b.innerHTML = "<div class='big ok'>" + Math.round(f.tiles * 100) + " % forest tiles</div>in the old picture → ✓ forest land (1 in 4 or more).<br>Picture day: <b>" +
              MON[(f.imgMonth || 1) - 1] + " " + f.imgYear + "</b>, greenness <b>" + n2(f.imgNdvi) + "</b>";
          }, onOpen);
        });
        var stamps = el("div", { class: "fd-stamps" });
        codes.forEach(function (c) {
          var b = el("button", { class: "btn " + c, html: ICON[c] + " " + LABEL[c], disabled: true });
          b.onclick = function () { verdict(c); }; stampBtns.push(b); stamps.appendChild(b);
        });
        side.appendChild(lock); side.appendChild(stamps);
        var done = false;
        async function verdict(c) {
          if (done || !L.alive) return;
          done = true; stampBtns.forEach(function (b) { b.disabled = true; });
          var ok = c === f.code;
          pic.stamp(c);
          await L.wait(700); if (!L.alive) return;
          pic.stamp(f.code, true);
          if (ok) { right++; RQ.audio.sfx("good"); RQ.ui.confetti(60); } else RQ.audio.sfx("giggle");
          await L.wait(700); if (!L.alive) return;
          pic.addMap();
          var why = { RESEED: "Lost patches of 1 hectare (100 m × 100 m) or more, down in both recent seasons, plus a burn-or-clearing clue or a giant drop. (game version)",
            SEASONAL: "Low in the winter picture, but the summer peak is back near its usual level.",
            RECOVERING: "A big past dip, but the greenness is back and the lost patch is under 1 hectare.",
            HEALTHY: "Best-season greenness stays near normal. No lost patches." }[f.code];
          lock.innerHTML = (ok ? "✅ " : "❌ ") + "<b>ReSeed: " + LABEL[f.code] + ".</b> " + why + " <span class='muted'>(Map: red = lost, blue = seasonal, green = healthy, orange = thinner, grey = too cloudy.)</span>";
          await speakCase(L, f.id, ok);
          if (!L.alive) return;
          var nb = el("button", { class: "btn primary", html: k + 1 >= list.length ? "Close the case files ✔" : "Next case ▶" });
          stamps.innerHTML = ""; stamps.appendChild(nb); nb.focus();
          nb.onclick = function () { RQ.audio.sfx("click"); nextCase(); };
        }
        if (L.fails >= 1 && k === 0) L.hint("Compare **best season with best season**. A winter picture can fool you!");
      }
    };
  }

  /* ------------------------------------------------------------ level 4: build the rule as an if/elif chain */
  var CONDS = [
    { id: "nf", text: "ForestNet: fewer than 1 forest tile in 4", code: "forest_tiles < 0.25", test: function (f) { return !f.forest; }, ndvi: false },
    { id: "lost", text: "Lost patches ≥ 1 ha: down ≥ 0.20 (or 25 %) in BOTH recent seasons + a burn-or-clearing clue or a giant drop (≥ 0.35)", code: "lost_patch_ha >= 1.0", test: function (f) { return f.lost; }, ndvi: true },
    { id: "seas", text: "Low in the winter picture, but the summer peak is back", code: "winter_low and peak_is_back", test: function (f) { return f.seasonal; }, ndvi: true },
    { id: "dip", text: "A past season dipped 0.12 or more, and it healed", code: "past_dip >= 0.12", test: function (f) { return f.dip; }, ndvi: true }
  ];
  var VERDS = ["NOT_FOREST", "RESEED", "SEASONAL", "RECOVERING", "HEALTHY"];
  function levelFlow(L) {
    var root = el("div", { class: "fd-flow" }), chain = el("div", { class: "fd-chain" }), side = el("div", { class: "fd-side panel" });
    root.appendChild(chain); root.appendChild(side); L.stage.appendChild(root);
    var slots = [], blocks = [], sel = null, runs = 0, ghost = null;
    L.done.then(function () { if (ghost) ghost.remove(); });
    chain.appendChild(el("div", { class: "muted", html: "Drag the question blocks into the <b>if / elif</b> slots and a verdict stamp after each arrow. The first true question wins! <i>(game version: the real rule also has UNKNOWN for too few clear pictures and STRESSED for a thinner canopy)</i>" }));
    for (var r = 0; r < 5; r++) {
      var rung = el("div", { class: "fd-rung" });
      rung.appendChild(el("span", { class: "fd-kw", text: r === 0 ? "if" : r < 4 ? "elif" : "else" }));
      if (r < 4) { var cs = el("div", { class: "fd-slot cond", tabindex: "0", text: "? question" }); slots.push({ el: cs, type: "cond", rung: r, v: null }); rung.appendChild(cs); }
      else rung.appendChild(el("div", { class: "fd-slot cond full", style: { cursor: "default" }, text: "nothing above was true" }));
      rung.appendChild(el("span", { class: "fd-arrow", text: "→" }));
      var vs = el("div", { class: "fd-slot verd", tabindex: "0", text: "? verdict" }); slots.push({ el: vs, type: "verd", rung: r, v: null }); rung.appendChild(vs);
      chain.appendChild(rung);
    }
    var runBtn = el("button", { class: "btn big primary", html: "▶ Run the rule on all 13 cases", disabled: true });
    var table = el("div", { class: "fd-table" });
    chain.appendChild(el("div", { class: "row", style: { justifyContent: "center" } }, runBtn));
    chain.appendChild(table);
    var trayC = el("div", { class: "fd-blocks" }), trayV = el("div", { class: "fd-blocks" }), code = el("div", { class: "fd-code" });
    side.appendChild(el("b", { text: "❓ Question blocks" })); side.appendChild(trayC);
    side.appendChild(el("b", { text: "🔖 Verdict stamps" })); side.appendChild(trayV);
    side.appendChild(el("b", { text: "🐍 Your rule in Python" })); side.appendChild(code);
    u.shuffle(CONDS, L.rng).forEach(function (c) { addBlock({ type: "cond", v: c.id, label: c.text }, trayC); });
    u.shuffle(VERDS, L.rng).forEach(function (v) { addBlock({ type: "verd", v: v, label: ICON[v] + " " + LABEL[v] }, trayV); });
    function cond(id) { for (var i = 0; i < CONDS.length; i++) if (CONDS[i].id === id) return CONDS[i]; return null; }
    function addBlock(b, tray) {
      b.el = el("button", { class: "fd-block " + (b.type === "cond" ? "cond" : "c-" + b.v), text: b.label });
      tray.appendChild(b.el); blocks.push(b);
      L.on(b.el, "pointerdown", function (e) {
        if (b.used) return;
        var sx = e.clientX, sy = e.clientY, moved = false;
        function move(ev) {
          if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
            moved = true; ghost = b.el.cloneNode(true); ghost.classList.add("fd-ghost"); ghost.style.width = b.el.offsetWidth + "px"; document.body.appendChild(ghost);
          }
          if (moved) {
            ghost.style.left = (ev.clientX - 30) + "px"; ghost.style.top = (ev.clientY - 20) + "px";
            var t = document.elementFromPoint(ev.clientX, ev.clientY), s = t && t.closest && t.closest(".fd-slot");
            slots.forEach(function (x) { x.el.classList.toggle("hover", x.el === s); });
          }
        }
        function up(ev) {
          window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
          slots.forEach(function (x) { x.el.classList.remove("hover"); });
          if (!moved) { select(b); return; }
          if (ghost) { ghost.remove(); ghost = null; }
          var t = document.elementFromPoint(ev.clientX, ev.clientY), s = t && t.closest && t.closest(".fd-slot");
          var slot = slots.filter(function (x) { return x.el === s; })[0];
          if (slot) place(b, slot);
        }
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      });
      L.on(b.el, "keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(b); } });
    }
    function select(b) {
      if (b.used) return;
      sel = sel === b ? null : b; RQ.audio.sfx("select");
      blocks.forEach(function (x) { x.el.classList.toggle("sel", x === sel); });
      if (sel) L.toast("Now click a " + (b.type === "cond" ? "question" : "verdict") + " slot.", "info", 1400);
    }
    slots.forEach(function (s) {
      var act = function () {
        if (sel) { place(sel, s); return; }
        if (s.v) { s.v.used = false; s.v.el.classList.remove("used"); s.v = null; draw(); RQ.audio.sfx("pop"); }
      };
      L.on(s.el, "click", act);
      L.on(s.el, "keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
    });
    function place(b, s) {
      if (b.type !== s.type) { RQ.audio.sfx("bad"); L.toast(b.type === "cond" ? "Questions go in the left slots." : "Verdict stamps go after the arrows.", "bad", 1800); return; }
      if (s.v) { s.v.used = false; s.v.el.classList.remove("used"); }
      slots.forEach(function (x) { if (x.v === b) x.v = null; });
      s.v = b; b.used = true; b.el.classList.add("used"); sel = null;
      blocks.forEach(function (x) { x.el.classList.remove("sel"); });
      RQ.audio.sfx("snap"); draw();
    }
    function draw() {
      slots.forEach(function (s) {
        s.el.classList.toggle("full", !!s.v);
        s.el.className = s.el.className.replace(/\bc-[A-Z_]+\b/g, "").trim();
        if (s.type === "verd" && s.v) s.el.classList.add("c-" + s.v.v);
        s.el.textContent = s.v ? s.v.label : s.type === "cond" ? "? question" : "? verdict";
      });
      var lines = ["def verdict(case):"];
      for (var r = 0; r < 5; r++) {
        var c = slots.filter(function (s) { return s.rung === r && s.type === "cond"; })[0], v = slots.filter(function (s) { return s.rung === r && s.type === "verd"; })[0];
        var vv = v.v ? '"' + v.v.v + '"' : "???";
        if (r < 4) lines.push("    " + (r ? "elif " : "if ") + (c.v ? cond(c.v.v).code : "???") + ":");
        else lines.push("    else:");
        lines.push("        return " + vv);
      }
      code.innerHTML = RQ.code && RQ.code.highlight ? RQ.code.highlight(lines.join("\n")) : u.esc(lines.join("\n"));
      runBtn.disabled = !slots.every(function (s) { return s.v; });
    }
    draw();
    function evaluate(f) {
      for (var r = 0; r < 5; r++) {
        var v = slots.filter(function (s) { return s.rung === r && s.type === "verd"; })[0].v.v;
        if (r === 4) return { v: v, rung: r };
        var c = cond(slots.filter(function (s) { return s.rung === r && s.type === "cond"; })[0].v.v);
        if (c.ndvi && !f.ndviWork) return { v: "NO_NDVI", rung: r };
        if (c.test(f)) return { v: v, rung: r };
      }
    }
    runBtn.onclick = async function () {
      runs++; runBtn.disabled = true; table.innerHTML = ""; RQ.audio.sfx("powerup");
      var good = 0, noNdvi = 0;
      for (var i = 0; i < ALL.length; i++) {
        var f = ALL[i], res = evaluate(f);
        var rungSlots = slots.filter(function (s) { return s.rung === res.rung; });
        rungSlots.forEach(function (s) { s.el.classList.add("lit"); });
        var ok = res.v === f.code; if (ok) good++; if (res.v === "NO_NDVI") noNdvi++;
        table.appendChild(el("div", { class: "fd-row " + (ok ? "ok" : "bad") }, el("img", { src: RQ.url(f.s.files.thumb), alt: "" }),
          el("div", { html: "<b>" + u.esc(f.s.name.split(",")[0]) + "</b><br>" + (res.v === "NO_NDVI" ? "⚠ NDVI on non-forest!" : "You: " + LABEL[res.v]) + (ok ? " ✓" : "<br>ReSeed: " + LABEL[f.code]) })));
        RQ.audio.sfx(ok ? "tick" : "error");
        await L.wait(230); if (!L.alive) return;
        rungSlots.forEach(function (s) { s.el.classList.remove("lit"); });
      }
      runBtn.disabled = false;
      L.hud.set("score", "✔ " + good + " / " + ALL.length);
      if (good === ALL.length) {
        RQ.ui.confetti();
        await L.say("hoot", "All thirteen cases match ReSeed! Your if / elif chain is a game version of ReSeed's rule.", { mood: "wow" });
        if (!L.alive) return;
        await L.say("hoot", "Remember, it is a rule of thumb made by the project, not a law of nature.");
        if (!L.alive) return;
        L.win({ stars: runs <= 1 ? 3 : runs <= 3 ? 2 : 1, msg: "Your if / elif flowchart matches ReSeed's verdict on all **13** real cases.", stats: { "Runs": runs, "Cases right": good + " / " + ALL.length } });
        return;
      }
      RQ.audio.sfx("giggle");
      if (noNdvi) L.toast("⚠ " + noNdvi + " non-forest places reached an NDVI question. Check ForestNet first!", "bad", 3200);
      else L.toast("🐞 " + (ALL.length - good) + " cases don't match ReSeed. Look at the red ones!", "bad", 2800);
      if (runs >= 2 || L.fails >= 1) L.timeout(function () { L.toast("💡 ForestNet first. Then lost patches, before past dips. Healthy is what's left.", "info", 4200); }, 3300);
    };
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g15",
    music: "mystery",
    intro: [
      ["hoot", "Hoo, detective! Thirteen real case files just landed on my desk, each one a real place on Earth."],
      ["hoot", "For each case we decide: lost forest, just winter, or healing by itself? Only lost forest gets the drones."]
    ],
    outro: [
      ["hoot", "Case closed! You used ReSeed's real rule on real satellite data. A true data detective."],
      ["sprout", "Now we have patches to check for planting. On to the Plan island to draw them!"]
    ],
    levels: [
      { title: "Forest first!", goal: "Stamp each case: forest land, or NOT FOREST?",
        intro: [["hoot", "Rule number one: ask ForestNet if the place **was** forest. If fewer than 1 tile in 4 is forest, stamp **NOT FOREST**."],
                ["sprout", "Press **O** to open a case or **N** for not forest. Thirteen cases, go!"]],
        cards: ["forest-first"],
        play: levelTriage },
      { title: "Lost or just winter?", goal: "Inspect 2 clues, then stamp the verdict",
        intro: [["hoot", "Trees without leaves look brown, like a lost forest. Compare **best season with best season**, never winter with summer!"],
                ["hoot", "**RESEED** needs a drop of 0.20 or more (or 25 %) in **two** recent seasons. Inspect the clues, then stamp!"]],
        cards: ["best-season", "two-seasons"],
        play: caseLevel(["ozarks", "rondonia", "congo"], ["RESEED", "SEASONAL", "HEALTHY"], ["years", "wave", "patches", "forestnet"]) },
      { title: "Fire and recovery", goal: "Burn clues and past dips: stamp the verdict",
        intro: [["hoot", "Fires and saws leave a clue in **short-wave infrared** light. A drop of 0.10 in **NBR** hints at burning **or** clearing."],
                ["hoot", "But forests can heal by themselves. A big dip that is back to green means **RECOVERING**: don't seed!"]],
        cards: ["burn-clue", "recovering"],
        play: caseLevel(["dixie", "kangaroo", "kalimantan"], ["RESEED", "SEASONAL", "RECOVERING", "HEALTHY"], ["years", "patchclue", "dips", "wave"]) },
      { title: "Build the rule", goal: "Build the if / elif chain and run it on all 13 cases",
        intro: [["hoot", "Final challenge: turn our detective rule into an **if / elif** chain, like in Python."],
                ["pix", "Drag each question into a slot and give it a verdict stamp. Then run it on all thirteen cases!"]],
        cards: ["if-elif"],
        play: levelFlow }
    ]
  });
})();
