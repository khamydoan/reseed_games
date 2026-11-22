/* g18 Seed Library — databases, built from the real ReSeed seed table (reseed/species.py BIOMES via data/reseed-data.js).
 * L1 tables, rows, columns, cells (fact hunt) · L2 query blocks: SELECT / FROM / WHERE / ORDER BY, evaluated for real
 * L3 rescue requests: native seeds only (real not_suitable + why, real animals) · L4 keys, a join, one record as table / JSON / dict. */
(function () {
  "use strict";
  var u = RQ.u;
  var D = RQ.data() || { biomes: {}, sites: [] };
  var B = D.biomes || {};
  /* Only biomes with seeds are part of the library (city / desert / ocean biomes have none). */
  var BIOME_KEYS = Object.keys(B).filter(function (k) { return (B[k].species || []).length > 0; });
  var ROWS = [];
  BIOME_KEYS.forEach(function (k) { B[k].species.forEach(function (s) { ROWS.push(Object.assign({ biome: k }, s)); }); });
  var COLS = ["biome", "common", "latin", "mass_g", "volume_ml", "v_terminal", "establishment", "delivery"];
  var NUM = { mass_g: 1, volume_ml: 1, v_terminal: 1, establishment: 1 };
  var BCOL = { oak_hickory: "#a8612a", tropical_moist_forest: "#2f9e4f", sierra_mixed_conifer: "#2b7bd0",
    southern_eucalypt: "#12a39a", borneo_lowland: "#7c5cc4", congo_rainforest: "#c27c12" };
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";

  /* ------------------------------------------------------------ helpers */
  function mySite() { return RQ.mySite() || RQ.site("rondonia") || { id: "rondonia", name: "Rondônia", biome: "tropical_moist_forest" }; }
  function rowsOf(k) { return ROWS.filter(function (r) { return r.biome === k; }); }
  function commons(rows) { return rows.map(function (r) { return r.common; }); }
  /* zero-width space after "_" lets long keys wrap only where CSS allows wrapping (unlike <wbr>, nowrap still wins) */
  function wbr(s) { return u.esc(s).replace(/_/g, "_\u200B"); }
  function dot(k) { return '<i class="sl-dot" style="background:' + (BCOL[k] || "#999") + '"></i>'; }
  function md(s) { return RQ.ui.md(s); }
  function seedIcon(r) {
    var d = (r.delivery || "") + " " + (r.common || "");
    if (/acorn|nut/i.test(d)) return "🌰";
    if (/ball/i.test(d)) return "🟤";
    return "🌱";
  }
  function trapIcon(name) {
    return /mango/i.test(name) ? "🥭" : /acorn/i.test(name) ? "🌰" : /palm/i.test(name) ? "🌴" : /eucalyptus/i.test(name) ? "🌿" : "❓";
  }
  var ANIMALS = [[/macaw|cockatoo|parrot/, "🦜"], [/turkey/, "🦃"], [/toucan|hornbill|jay|woodpecker/, "🐦"], [/orangutan/, "🦧"],
    [/monkey|gibbon|bonobo/, "🐒"], [/butterfly/, "🦋"], [/deer/, "🦌"], [/squirrel/, "🐿️"], [/bear/, "🐻"], [/kangaroo/, "🦘"],
    [/koala/, "🐨"], [/echidna/, "🦔"], [/elephant/, "🐘"]];
  function animalIcon(a) { for (var i = 0; i < ANIMALS.length; i++) if (ANIMALS[i][0].test(a)) return ANIMALS[i][1]; return "🐾"; }
  function sqlHTML(sql) {
    return sql.split(/('[^']*')/).map(function (part, i) {
      if (i % 2) return '<span class="sq-str">' + u.esc(part) + "</span>";
      return u.esc(part).replace(/\b(SELECT|FROM|WHERE|AND|ORDER BY|JOIN|ON)\b/g, '<span class="sq-kw">$1</span>')
        .replace(/(^|[\s(])(\d+(?:\.\d+)?)(?=[\s;)]|$)/g, '$1<span class="sq-num">$2</span>');
    }).join("");
  }
  function sameSet(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; }); }
  function sameOrder(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }
  function starsFor(m, a, b) { return m <= a ? 3 : m <= b ? 2 : 1; }
  function shake(el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }

  function room(L) { var r = u.el("div", { class: "sl-room" }); L.stage.appendChild(r); return r; }
  /** Index-card banner with a character portrait: set(html) shows the current request. */
  function questCard(parent, who) {
    var card = u.el("div", { class: "sl-quest" });
    var face = u.el("div", { class: "sl-face", html: RQ.chars ? RQ.chars.svg(who, { mood: "happy" }) : "" });
    var txt = u.el("div", { class: "sl-qtext", "aria-live": "polite" });
    var right = u.el("div", { class: "sl-qright" });
    card.appendChild(face); card.appendChild(txt); card.appendChild(right); parent.appendChild(card);
    return {
      el: card, right: right, text: txt,
      set: function (markdown, extraHTML) {
        txt.innerHTML = md(markdown) + (extraHTML || "");
        card.classList.remove("sl-new"); void card.offsetWidth; card.classList.add("sl-new");
      },
      face: function (w, mood) { face.innerHTML = RQ.chars ? RQ.chars.svg(w, { mood: mood || "happy" }) : ""; }
    };
  }
  /** Fly a copy of fromEl onto toEl (FLIP style). Resolves when it lands. */
  function flyTo(L, root, fromEl, toEl, ms) {
    return new Promise(function (resolve) {
      if (REDUCE || !fromEl || !toEl) { resolve(); return; }
      var a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
      var c = fromEl.cloneNode(true);
      c.classList.add("sl-fly"); c.classList.remove("dim", "lit", "gone");
      c.style.left = a.left + "px"; c.style.top = a.top + "px"; c.style.width = a.width + "px"; c.style.height = a.height + "px";
      root.appendChild(c); c.getBoundingClientRect();
      var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      c.style.transform = "translate(" + dx + "px," + dy + "px) scale(.85)";
      c.style.opacity = ".55";
      L.timeout(function () { c.remove(); resolve(); }, ms || 500);
    });
  }
  /** Drag-and-drop with a tap fallback. bind(el, {zone: ".css", onDrop(targetEl), onTap(), ghost()}). */
  function dragKit(L, root) {
    var cur = null, lastEnd = 0, lastEl = null;
    function clear() {
      if (!cur) return;
      if (cur.ghost) cur.ghost.remove();
      if (cur.zone) cur.zone.classList.remove("sl-over");
      cur.el.classList.remove("sl-dragging");
      cur = null;
    }
    L.on(window, "pointermove", function (e) {
      if (!cur || e.pointerId !== cur.id) return;
      if (!cur.ghost) {
        if (Math.hypot(e.clientX - cur.sx, e.clientY - cur.sy) < 9) return;
        cur.ghost = cur.o.ghost ? cur.o.ghost() : cur.el.cloneNode(true);
        cur.ghost.classList.add("sl-ghost"); cur.ghost.style.width = cur.el.offsetWidth + "px";
        root.appendChild(cur.ghost); cur.el.classList.add("sl-dragging"); RQ.audio.sfx("pop");
      }
      cur.ghost.style.left = e.clientX + "px"; cur.ghost.style.top = e.clientY + "px";
      var t = document.elementFromPoint(e.clientX, e.clientY), z = t && cur.o.zone ? t.closest(cur.o.zone) : null;
      if (z !== cur.zone) { if (cur.zone) cur.zone.classList.remove("sl-over"); if (z) z.classList.add("sl-over"); cur.zone = z; }
    });
    function end(e) {
      if (!cur || e.pointerId !== cur.id) return;
      var c = cur;
      if (!c.ghost) { cur = null; return; }
      lastEnd = performance.now(); lastEl = c.el;
      var t = document.elementFromPoint(e.clientX, e.clientY);
      clear();
      if (e.type === "pointerup" && c.o.onDrop) c.o.onDrop(t);
    }
    L.on(window, "pointerup", end); L.on(window, "pointercancel", end);
    L.done.then(clear);
    return {
      bind: function (el, o) {
        L.on(el, "pointerdown", function (e) {
          if (e.button > 0 || cur) return;
          if (e.target.closest(".sl-x, .sl-plus") && el.classList.contains("in-strip")) return;
          cur = { el: el, o: o, id: e.pointerId, sx: e.clientX, sy: e.clientY, ghost: null, zone: null };
        });
        if (o.onTap) L.on(el, "click", function (e) { if (lastEl === el && performance.now() - lastEnd < 350) return; o.onTap(e); });
      }
    };
  }

  /* ------------------------------------------------------------ the species table widget */
  function cellClass(c) { return c === "biome" ? "key" : c === "latin" ? "lat" : c === "common" ? "com" : c === "delivery" ? "del" : NUM[c] ? "num" : ""; }
  function cellHTML(r, c) { return c === "biome" ? dot(r.biome) + wbr(r.biome) : u.esc(String(r[c])); }
  function buildTable(L, parent, rows, cols) {
    var table = u.el("table", { class: "sl-table", "aria-label": "species table" });
    var thead = u.el("thead"), hr = u.el("tr"), tb = u.el("tbody"), heads = {}, trs = [];
    cols.forEach(function (c) {
      var th = u.el("th", { tabindex: "0", scope: "col", dataset: { col: c }, html: wbr(c), "aria-label": "column " + c });
      heads[c] = th; hr.appendChild(th);
    });
    thead.appendChild(hr); table.appendChild(thead); table.appendChild(tb);
    rows.forEach(function (r, i) {
      var tr = u.el("tr", { dataset: { r: i } });
      cols.forEach(function (c) {
        tr.appendChild(u.el("td", { tabindex: "-1", class: cellClass(c), dataset: { col: c, r: i }, html: cellHTML(r, c), "aria-label": r.common + ", " + c + ": " + r[c] }));
      });
      tb.appendChild(tr); trs.push(tr);
    });
    parent.appendChild(table);
    var T = {
      table: table, heads: heads, trs: trs, rows: rows, cols: cols,
      cell: function (i, c) { return trs[i].querySelector('[data-col="' + c + '"]'); },
      colCells: function (c) { return u.$$('[data-col="' + c + '"]', table); }
    };
    // row + column highlight under the pointer or keyboard focus
    var cur = null;
    function clearHL() { u.$$(".hrow, .hcol", table).forEach(function (x) { x.classList.remove("hrow", "hcol"); }); cur = null; }
    function hl(c) {
      if (c === cur) return; clearHL(); cur = c; if (!c) return;
      if (c.dataset.r != null) trs[+c.dataset.r].classList.add("hrow");
      T.colCells(c.dataset.col).forEach(function (x) { x.classList.add("hcol"); });
    }
    L.on(table, "pointerover", function (e) { hl(e.target.closest("td,th")); });
    L.on(table, "pointerleave", clearHL);
    L.on(table, "focusin", function (e) { hl(e.target.closest("td,th")); });
    // arrow keys move between cells (header row = -1)
    L.on(table, "keydown", function (e) {
      var c = e.target.closest("td,th"); if (!c) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (T.onPick) T.onPick(c); return; }
      var r = c.dataset.r == null ? -1 : +c.dataset.r, ci = cols.indexOf(c.dataset.col);
      if (e.key === "ArrowRight") ci++; else if (e.key === "ArrowLeft") ci--; else if (e.key === "ArrowDown") r++; else if (e.key === "ArrowUp") r--; else return;
      e.preventDefault();
      ci = u.clamp(ci, 0, cols.length - 1); r = u.clamp(r, -1, rows.length - 1);
      var n = r < 0 ? heads[cols[ci]] : T.cell(r, cols[ci]);
      n.tabIndex = 0; n.focus();
    });
    L.on(table, "click", function (e) { var c = e.target.closest("td,th"); if (c && T.onPick) T.onPick(c); });
    return T;
  }

  /* ------------------------------------------------------------ L1 tables, rows, columns */
  function levelTable(L) {
    var site = mySite(), mine = site.biome, show = [];
    ["oak_hickory", mine, "tropical_moist_forest", "sierra_mixed_conifer"].forEach(function (k) {
      if (B[k] && (B[k].species || []).length && show.indexOf(k) < 0 && show.length < 3) show.push(k);
    });
    var rows = [];
    show.forEach(function (k) { rows = rows.concat(rowsOf(k)); });
    var root = room(L), qc = questCard(root, "hoot");
    var legend = u.el("div", { class: "row sl-legend" }), chips = {};
    [["row", "▤ row"], ["col", "▥ column"], ["cell", "▣ cell"]].forEach(function (p) { chips[p[0]] = u.el("span", { class: "chip", text: p[1] }); legend.appendChild(chips[p[0]]); });
    qc.right.appendChild(legend);
    var wrap = u.el("div", { class: "sl-wood sl-tablewrap" }); root.appendChild(wrap);
    wrap.appendChild(u.el("div", { class: "sl-tname", html: "📚 table <code>species</code> · " + rows.length + " rows × " + COLS.length + " columns" }));
    var scroll = u.el("div", { class: "sl-scroll" }); wrap.appendChild(scroll);
    var T = buildTable(L, scroll, rows, COLS);
    T.heads.biome.tabIndex = 0;

    function rowIdx(name) { for (var i = 0; i < rows.length; i++) if (rows[i].common === name) return i; return 0; }
    function rowCells(i) { return u.$$("td", T.trs[i]); }
    var fast = rows.reduce(function (a, r) { return r.v_terminal > a.v_terminal ? r : a; }, rows[0]);
    var oak = rows[rowIdx("White oak")], par = rows[rowIdx("Paricá")];
    var need = [];
    rows.forEach(function (r, i) { if (r.biome === mine) need.push(i); });
    var Qs = [
      { kind: "row", q: "Find the **row** for **Balsa**. Click anywhere on it.",
        ok: function (c) { return c.row && c.row.common === "Balsa"; },
        good: "Yes! One **row** is one **record**: every fact about Balsa.", target: function () { return rowCells(rowIdx("Balsa")); } },
      { kind: "col", q: "Which **column** tells how a seed is packed for the drone?",
        ok: function (c) { return c.col === "delivery"; },
        good: "Right, `delivery`! One **column** is one **field**: the same kind of fact for every row.", target: function () { return [T.heads.delivery]; } },
      { kind: "cell", q: "How heavy is one **White oak** acorn? Click that **cell**.", row: "White oak", col: "mass_g",
        ok: function (c) { return c.row && c.row.common === "White oak" && c.col === "mass_g"; },
        good: "**" + oak.mass_g + " g**! A **cell** is where one row meets one column.", target: function () { return [T.cell(rowIdx("White oak"), "mass_g")]; } },
      { kind: "cell", q: "`v_terminal` means steady falling speed in still air. Which seed has the biggest number? Click that cell.", row: fast.common, col: "v_terminal",
        ok: function (c) { return c.row && c.row.v_terminal === fast.v_terminal && c.col === "v_terminal"; },
        good: "**" + fast.common + "** falls at **" + fast.v_terminal + " m/s**. Heavy seeds drop fast!", target: function () { return [T.cell(rowIdx(fast.common), "v_terminal")]; } },
      { kind: "cell", q: "Find **Paricá**'s science name in the `latin` column. Click that cell.", row: "Paricá", col: "latin",
        ok: function (c) { return c.row && c.row.common === "Paricá" && c.col === "latin"; },
        good: "**" + par.latin + "**. Scientists all over the world use Latin names.", target: function () { return [T.cell(rowIdx("Paricá"), "latin")]; } },
      { kind: "rows", q: "My Site, **" + site.name + "**: click every row where `biome = '" + mine + "'`.",
        good: "You found all " + need.length + " rows. You just ran a **WHERE** filter by hand!", target: function () { var out = []; need.forEach(function (i) { out = out.concat(rowCells(i)); }); return out; } }
    ];
    var qi = 0, mistakes = 0, miss = 0, picked = [], busy = false;
    function clearMarks() { u.$$(".ok, .no, .sl-hint, .pick", T.table).forEach(function (x) { x.classList.remove("ok", "no", "sl-hint", "pick"); }); }
    function load() {
      clearMarks(); miss = 0; picked = [];
      var q = Qs[qi];
      qc.set(q.q);
      Object.keys(chips).forEach(function (k) { chips[k].classList.toggle("on", k === q.kind || (q.kind === "rows" && k === "row")); });
      L.hud.set("q", "📇 " + (qi + 1) + " / " + Qs.length);
    }
    function hint() { Qs[qi].target().forEach(function (x) { x.classList.add("sl-hint"); }); }
    function wrong(c, msg) {
      mistakes++; miss++;
      RQ.audio.sfx("error"); c.el.classList.add("no"); shake(c.el);
      L.timeout(function () { c.el.classList.remove("no"); }, 500);
      if (msg) L.toast(msg, "bad", 2000);
      if (miss >= 2 || L.fails >= 1) hint();
      L.hud.set("miss", "🐞 " + mistakes);
    }
    function next(q, marks) {
      busy = true;
      marks.forEach(function (x) { x.classList.add("ok"); });
      RQ.audio.sfx("good"); L.toast("✅ " + q.good, "good", 2400);
      L.timeout(function () {
        busy = false; qi++;
        if (qi < Qs.length) { load(); return; }
        clearMarks();
        L.say("hoot", "Wonderful! Next level, a **query** finds rows for you in a blink.").then(function () {
          if (!L.alive) return;
          L.win({ stars: starsFor(mistakes, 1, 4), msg: "You read the **species** table like a real librarian!",
            stats: { "Facts found": Qs.length, "Mistakes": mistakes } });
        });
      }, 1500);
    }
    T.onPick = function (el) {
      if (busy || qi >= Qs.length || !L.alive) return;
      var c = { el: el, col: el.dataset.col, row: el.dataset.r != null ? rows[+el.dataset.r] : null, i: el.dataset.r != null ? +el.dataset.r : -1 };
      var q = Qs[qi];
      if (q.kind === "rows") {
        if (c.i < 0) { wrong(c, "Click the **rows**, not the column names."); return; }
        if (need.indexOf(c.i) < 0) { wrong(c, "That row says `biome = '" + c.row.biome + "'`. Look at the **biome** column!"); return; }
        if (picked.indexOf(c.i) >= 0) return;
        picked.push(c.i); T.trs[c.i].classList.add("pick"); RQ.audio.sfx("pop");
        if (picked.length === need.length) next(q, []);
        return;
      }
      if (q.ok(c)) {
        next(q, q.kind === "row" ? rowCells(c.i) : q.kind === "col" ? T.colCells("delivery") : [el]);
        return;
      }
      var msg = null;
      if (q.kind === "cell" && c.row && c.row.common === q.row) msg = "Right row! Now find the `" + q.col + "` column.";
      else if (q.kind === "cell" && c.col === q.col) msg = "Right column! Now find the row for **" + q.row + "**.";
      else if (q.kind === "col" && c.i >= 0) msg = "Look at the **column names** at the top: which one is about packing?";
      wrong(c, msg);
    };
    load();
    L.hud.set("miss", "🐞 0");
  }

  /* ------------------------------------------------------------ L2 query blocks */
  function levelQuery(L) {
    var site = mySite(), mine = site.biome;
    var Q = { select: ["common"], from: true, where: null, est: false, order: null };
    var root = room(L), qc = questCard(root, "hoot"), DK = dragKit(L, root);
    var grid = u.el("div", { class: "sl-l2" }); root.appendChild(grid);
    var pal = u.el("div", { class: "sl-palette sl-wood" }), work = u.el("div", { class: "sl-work" });
    grid.appendChild(pal); grid.appendChild(work);
    pal.appendChild(u.el("div", { class: "sl-pal-h", html: "🧱 Query blocks<br><small>drag into the strip, or tap</small>" }));
    var strip = u.el("div", { class: "sl-strip", "aria-label": "query strip" });
    var runBtn = u.el("button", { class: "btn go big sl-run", html: "▶ Run", title: "Run the query (R)" });
    work.appendChild(u.el("div", { class: "sl-striprow" }, strip, runBtn));
    var sqlLine = u.el("div", { class: "sl-sql", "aria-live": "polite" }); work.appendChild(sqlLine);
    var lower = u.el("div", { class: "sl-lower" }); work.appendChild(lower);
    var shelves = u.el("div", { class: "sl-shelves sl-wood" }), tray = u.el("div", { class: "sl-tray" });
    lower.appendChild(shelves); lower.appendChild(tray);
    var trayH = u.el("h3", { text: "📥 Result tray" }), trayBody = u.el("div", { class: "body" });
    tray.appendChild(trayH); tray.appendChild(trayBody);
    trayBody.appendChild(u.el("p", { class: "muted", text: "Results land here." }));
    var books = {};
    BIOME_KEYS.forEach(function (k) {
      var sh = u.el("div", { class: "sl-shelf" }, u.el("div", { class: "lab", html: dot(k) + wbr(k) }));
      rowsOf(k).forEach(function (r) {
        var b = u.el("div", { class: "sl-book", style: { background: BCOL[k] }, title: r.common, html: seedIcon(r) + " " + u.esc(r.common) });
        books[r.common] = b; sh.appendChild(b);
      });
      shelves.appendChild(sh);
    });

    /* ---- blocks */
    var ORDER = ["select", "from", "where", "est", "order"];
    var PAL = {
      select: 'SELECT <span class="sl-slot fake">▢</span>', from: "FROM species", where: 'WHERE biome = <span class="sl-slot fake">▢</span>',
      est: "WHERE establishment &gt; 0.1", order: 'ORDER BY <span class="sl-slot fake">▢</span>'
    };
    var palEls = {};
    function has(k) { return k === "select" ? Q.select != null : k === "from" ? Q.from : k === "where" ? Q.where != null : k === "est" ? Q.est : Q.order != null; }
    ORDER.forEach(function (k) {
      var b = u.el("button", { class: "sl-block b-" + k, html: PAL[k], "aria-label": "add block " + PAL[k].replace(/<[^>]+>/g, "").replace("&gt;", ">") });
      pal.appendChild(b); palEls[k] = b;
      DK.bind(b, { zone: ".sl-strip", onTap: function () { addBlock(k); },
        onDrop: function (t) { if (t && t.closest(".sl-strip")) addBlock(k); } });
    });
    var andShown = false, busy = false, slotEls = {};
    function addBlock(k) {
      if (busy || !L.alive) return;
      if (has(k)) { L.toast("That block is already in the query.", "info", 1400); RQ.audio.sfx("bad"); return; }
      if (k === "select") Q.select = [""]; else if (k === "from") Q.from = true; else if (k === "where") Q.where = ""; else if (k === "est") Q.est = true; else Q.order = "";
      RQ.audio.sfx("snap"); render(k);
      if (!andShown && Q.est && Q.where != null) { andShown = true; L.toast("Two filters? The second **WHERE** turns into **AND**.", "info", 2600); }
      var s = k === "select" ? slotEls["select:0"] : slotEls[k];
      if (s && s.classList.contains("empty")) L.timeout(function () { s.click(); }, 120);
    }
    function removeBlock(k) {
      if (busy) return;
      if (k === "select") Q.select = null; else if (k === "from") Q.from = false; else if (k === "where") Q.where = null; else if (k === "est") Q.est = false; else Q.order = null;
      RQ.audio.sfx("whoosh"); render();
    }
    function slot(val, label, key, onTap) {
      var s = u.el("button", { class: "sl-slot" + (val ? "" : " empty"), html: val ? u.esc(label) : "▢ pick", "aria-label": "choose " + key });
      s.addEventListener("click", function (e) { e.stopPropagation(); if (!busy) onTap(s); });
      slotEls[key] = s; return s;
    }
    function render(fresh) {
      strip.innerHTML = ""; slotEls = {};
      var any = false;
      ORDER.forEach(function (k) {
        if (!has(k)) return; any = true;
        var b = u.el("div", { class: "sl-block in-strip b-" + k + (k === fresh ? " sl-snap" : ""), dataset: { k: k } });
        if (k === "select") {
          b.appendChild(document.createTextNode("SELECT"));
          Q.select.forEach(function (c, i) {
            if (i) b.appendChild(document.createTextNode(","));
            b.appendChild(slot(c, c, "select:" + i, function (el) { pickColumn(el, i); }));
          });
          if (Q.select.length < 3) b.appendChild(u.el("button", { class: "sl-plus", html: "＋", title: "add another column", "aria-label": "add another column",
            onclick: function (e) { e.stopPropagation(); if (busy) return; Q.select.push(""); render(); var s = slotEls["select:" + (Q.select.length - 1)]; if (s) s.click(); } }));
        } else if (k === "from") b.appendChild(document.createTextNode("FROM species"));
        else if (k === "where") {
          b.appendChild(document.createTextNode("WHERE biome ="));
          b.appendChild(slot(Q.where, "'" + Q.where + "'", "where", pickBiome));
        } else if (k === "est") b.appendChild(document.createTextNode((Q.where != null ? "AND" : "WHERE") + " establishment > 0.1"));
        else { b.appendChild(document.createTextNode("ORDER BY")); b.appendChild(slot(Q.order, Q.order, "order", pickOrder)); }
        b.appendChild(u.el("button", { class: "sl-x", html: "✕", title: "remove block", "aria-label": "remove block",
          onclick: function (e) { e.stopPropagation(); removeBlock(k); } }));
        DK.bind(b, { zone: ".sl-strip", onDrop: function (t) { if (!t || !t.closest(".sl-strip")) removeBlock(k); } });
        strip.appendChild(b);
      });
      if (!any) strip.appendChild(u.el("div", { class: "sl-empty", text: "Drop blocks here to build a query" }));
      ORDER.forEach(function (k) { palEls[k].classList.toggle("used", has(k)); });
      sqlLine.innerHTML = sqlHTML(sqlText());
    }
    function sqlText() {
      var p = [];
      if (Q.select != null) p.push("SELECT " + Q.select.map(function (c) { return c || "▢"; }).join(", "));
      if (Q.from) p.push("FROM species");
      if (Q.where != null) p.push("WHERE biome = " + (Q.where ? "'" + Q.where + "'" : "▢"));
      if (Q.est) p.push((Q.where != null ? "AND" : "WHERE") + " establishment > 0.1");
      if (Q.order != null) p.push("ORDER BY " + (Q.order || "▢"));
      return p.length ? p.join(" ") + ";" : "-- empty query";
    }

    /* ---- slot picker */
    var picker = null;
    function closePicker() { if (picker) { picker.remove(); picker = null; } }
    function openPicker(anchor, opts, onPick) {
      closePicker();
      picker = u.el("div", { class: "sl-picker", role: "listbox" });
      opts.forEach(function (o) {
        picker.appendChild(u.el("button", { class: "sl-opt" + (o.cls ? " " + o.cls : ""), html: o.html, role: "option",
          onclick: function (e) { e.stopPropagation(); closePicker(); RQ.audio.sfx("select"); onPick(o.v); } }));
      });
      root.appendChild(picker);
      var r = anchor.getBoundingClientRect(), pw = picker.offsetWidth, ph = picker.offsetHeight;
      var x = u.clamp(r.left, 8, innerWidth - pw - 8), y = r.bottom + 6;
      if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 6);
      picker.style.left = x + "px"; picker.style.top = y + "px";
      var f = picker.querySelector("button"); if (f) f.focus();
    }
    L.on(window, "pointerdown", function (e) { if (picker && !picker.contains(e.target)) closePicker(); });
    L.done.then(closePicker);
    function pickColumn(el, i) {
      var opts = COLS.map(function (c) { return { v: c, html: u.esc(c) }; });
      if (Q.select.length > 1) opts.push({ v: null, html: "✕ remove", cls: "rm" });
      openPicker(el, opts, function (v) { if (v == null) Q.select.splice(i, 1); else Q.select[i] = v; render(); });
    }
    function pickBiome(el) {
      openPicker(el, BIOME_KEYS.map(function (k) { return { v: k, html: dot(k) + "'" + u.esc(k) + "'" }; }), function (v) { Q.where = v; render(); });
    }
    function pickOrder(el) {
      openPicker(el, ["mass_g", "volume_ml", "v_terminal", "establishment", "common", "latin"].map(function (c) { return { v: c, html: u.esc(c) }; }),
        function (v) { Q.order = v; render(); });
    }

    /* ---- missions */
    var oakRows = rowsOf("oak_hickory"), sierra = "sierra_mixed_conifer";
    var oakByMass = commons(oakRows.slice().sort(function (a, b) { return a.mass_g - b.mass_g; }));
    var sierraGood = commons(rowsOf(sierra).filter(function (r) { return r.establishment > 0.1; }));
    var M = [
      { text: "Warm-up: press **▶ Run** to try the query that is already built.", expect: null },
      { text: "Too many seeds! The Ozarks only want theirs. Add `WHERE biome = 'oak_hickory'`.", expect: commons(oakRows), cols: ["common"],
        ghost: "SELECT common FROM species WHERE biome = 'oak_hickory';", done: "Only the 3 Ozark seeds came out!" },
      { text: "Line them up, lightest seed first: add `ORDER BY mass_g`.", expect: oakByMass, ordered: true, cols: ["common"],
        ghost: "SELECT common FROM species WHERE biome = 'oak_hickory' ORDER BY mass_g;", done: "Sorted: " + oakByMass.join(" → ") + "." },
      { text: "The Dixie Fire needs seeds likely to grow into surviving seedlings. Ask for `biome = '" + sierra + "'` with `establishment > 0.1`.", expect: sierraGood, cols: ["common"],
        ghost: "SELECT common FROM species WHERE biome = '" + sierra + "' AND establishment > 0.1;", done: "Only " + sierraGood.join(", ") + " passed the filter!" },
      { text: "My Site, **" + site.name + "**: get `common` **and** `delivery` for every seed of `'" + mine + "'`.", expect: commons(rowsOf(mine)), cols: ["common", "delivery"],
        ghost: "SELECT common, delivery FROM species WHERE biome = '" + mine + "';", done: "Now Koa knows how to pack every seed for your site!" }
    ];
    var mi = 0, miss = 0, mistakes = 0, runs = 0;
    function loadMission() {
      miss = 0;
      var m = M[mi];
      qc.set((mi ? "**Mission " + mi + " / " + (M.length - 1) + ":** " : "") + m.text);
      L.hud.set("m", "🔍 " + (mi ? mi + " / " + (M.length - 1) : "warm-up"));
    }
    function showGhost() {
      var m = M[mi]; if (!m.ghost || qc.text.querySelector(".sl-ghostsql")) return;
      qc.text.appendChild(u.el("div", { class: "sl-ghostsql", html: "💡 " + sqlHTML(m.ghost) }));
    }
    function validate() {
      if (Q.select == null) return "Our game queries start with `SELECT`. Add the purple block!";
      if (Q.select.some(function (c) { return !c; })) return "SELECT what? Tap the empty slot and pick a column.";
      if (!Q.from) return "FROM which table? Add the blue `FROM species` block.";
      if (Q.where === "") return "WHERE biome = ...what? Tap the empty slot and pick a biome.";
      if (Q.order === "") return "ORDER BY what? Tap the empty slot and pick a column.";
      return null;
    }
    function evaluate() {
      var rs = ROWS.filter(function (r) { return (Q.where == null || r.biome === Q.where) && (!Q.est || r.establishment > 0.1); });
      if (Q.order) {
        var o = Q.order;
        rs = rs.slice().sort(function (a, b) { return NUM[o] ? a[o] - b[o] : String(a[o]).localeCompare(String(b[o])); });
      }
      var cols = [];
      Q.select.forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); });
      return { cols: cols, rows: rs };
    }
    function showResult(res) {
      trayBody.innerHTML = "";
      trayH.textContent = "📥 Result: " + res.rows.length + " row" + (res.rows.length === 1 ? "" : "s");
      Object.keys(books).forEach(function (k) { books[k].classList.remove("lit"); books[k].classList.add("dim"); });
      if (!res.rows.length) {
        trayBody.appendChild(u.el("p", { class: "muted", text: "No rows matched, so the shelves stay full." }));
        RQ.audio.sfx("buzz"); return Promise.resolve();
      }
      var t = u.el("table", { class: "sl-res" }), hr = u.el("tr"), tb = u.el("tbody");
      res.cols.forEach(function (c) { hr.appendChild(u.el("th", { text: c })); });
      t.appendChild(u.el("thead", {}, hr)); t.appendChild(tb); trayBody.appendChild(t);
      var trs = res.rows.map(function (r) {
        var tr = u.el("tr", { class: "wait" });
        res.cols.forEach(function (c) { tr.appendChild(u.el("td", { class: NUM[c] ? "num" : "", text: String(r[c]) })); });
        tb.appendChild(tr); return tr;
      });
      return new Promise(function (done) {
        var step = Math.max(70, Math.min(170, 1500 / res.rows.length)), landed = 0;
        res.rows.forEach(function (r, i) {
          L.timeout(function () {
            var b = books[r.common], tr = trs[i];
            b.classList.remove("dim"); b.classList.add("lit");
            var need = tr.offsetTop + t.offsetTop + tr.offsetHeight + 6 - trayBody.clientHeight;
            if (need > trayBody.scrollTop) trayBody.scrollTop = need;
            flyTo(L, root, b, tr, 480).then(function () {
              if (!L.alive) return;
              tr.classList.remove("wait"); tr.classList.add("in"); RQ.audio.sfx("pop");
              if (++landed === res.rows.length) L.timeout(done, 250);
            });
          }, i * step);
        });
      });
    }
    function run() {
      if (busy || !L.alive) return;
      closePicker();
      var err = validate();
      if (err) {
        if (mi > 0) { mistakes++; miss++; }
        RQ.audio.sfx("giggle"); shake(strip); L.toast("🐞 " + err, "bad", 2600);
        if (miss >= 2 || (L.fails >= 1 && mi > 0)) showGhost();
        return;
      }
      busy = true; runBtn.disabled = true; runs++;
      L.hud.set("runs", "▶ " + runs);
      sqlLine.innerHTML = sqlHTML(sqlText());
      var res = evaluate();
      showResult(res).then(function () {
        if (!L.alive) return;
        busy = false; runBtn.disabled = false;
        check(res);
      });
    }
    L.on(runBtn, "click", run);
    L.on(window, "keydown", function (e) {
      if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !picker && !document.querySelector(".rq-overlay, .rq-talk")) run();
    });
    function check(res) {
      var m = M[mi], got = commons(res.rows);
      if (m.expect == null) {
        busy = true;
        L.say("hoot", "Whoa, every seed in the library came out! A **WHERE** block keeps only the rows you want.").then(function () {
          if (!L.alive) return;
          busy = false; mi++; loadMission();
        });
        return;
      }
      var colsOk = m.cols.every(function (c) { return res.cols.indexOf(c) >= 0; });
      var rowsOk = m.ordered ? sameOrder(got, m.expect) : sameSet(got, m.expect);
      if (colsOk && rowsOk) {
        RQ.audio.sfx("good"); L.toast("✅ " + m.done, "good", 2600);
        var r = runBtn.getBoundingClientRect(); RQ.ui.float(r.left + r.width / 2, r.top, "+1 🔍");
        busy = true;
        L.timeout(function () {
          busy = false; mi++;
          if (mi < M.length) { loadMission(); return; }
          L.say("pix", "Queries are like magic spells for data. You just wrote five of them!").then(function () {
            if (!L.alive) return;
            L.win({ stars: starsFor(mistakes, 1, 3), msg: "Your queries pulled exactly the right seeds off the shelves.",
              stats: { "Queries run": runs, "Wrong runs": mistakes } });
          });
        }, 1300);
        return;
      }
      mistakes++; miss++;
      var extra = got.filter(function (x) { return m.expect.indexOf(x) < 0; }), missing = m.expect.filter(function (x) { return got.indexOf(x) < 0; });
      var msg;
      if (!colsOk) msg = "Close! SELECT also needs " + m.cols.filter(function (c) { return res.cols.indexOf(c) < 0; }).map(function (c) { return "`" + c + "`"; }).join(" and ") + ". Tap **＋** in the SELECT block.";
      else if (extra.length) msg = "Too many rows: **" + extra.slice(0, 3).join(", ") + "**" + (extra.length > 3 ? " and more" : "") + " should stay on the shelf.";
      else if (missing.length) msg = "Missing: **" + missing.join(", ") + "**. Is a filter too strict?";
      else msg = "Right seeds, wrong order! Sort them with `ORDER BY mass_g`.";
      RQ.audio.sfx("giggle"); L.toast("🐞 " + msg, "bad", 3200);
      if (miss >= 2 || L.fails >= 1) showGhost();
    }
    render(); loadMission();
  }

  /* ------------------------------------------------------------ L3 rescue requests */
  var TRAP_QUIP = { "Mango": "shiny and juicy!", "Oak acorns": "big and shiny!", "Oil palm": "a plantation favourite!", "Eucalyptus": "grows super fast!" };
  var SHORT = { ozarks: "The Ozarks need", kangaroo: "Kangaroo Island needs", dixie: "The Dixie Fire scar needs", kalimantan: "Ketapang needs", rondonia: "Rondônia needs" };
  function levelRescue(L) {
    var site = mySite();
    var ids = ["ozarks", "kangaroo", "dixie", "kalimantan", "rondonia"].filter(function (id) {
      var s = RQ.site(id); return id !== site.id && s && B[s.biome] && (B[s.biome].species || []).length;
    });
    ids.push(site.id);
    var root = room(L), qc = questCard(root, "sprout"), DK = dragKit(L, root);
    var grid = u.el("div", { class: "sl-l3" }); root.appendChild(grid);
    var letter = u.el("div", { class: "sl-letter" }), jars = u.el("div", { class: "sl-jars sl-wood" }), crate = u.el("div", { class: "sl-crate" });
    grid.appendChild(letter); grid.appendChild(jars); grid.appendChild(crate);
    var ri = 0, mistakes = 0, packed = [], slots = [], busy = false, trapSeen = false, note = null;
    function load() {
      var s = RQ.site(ids[ri]), bk = s.biome, bio = B[bk], ns = bio.not_suitable || { common: "Mango", why: "" };
      packed = []; busy = false;
      qc.set("Request **" + (ri + 1) + " of " + ids.length + "**: pack **3 native seeds** for `biome = '" + bk + "'`. Check each jar's label!");
      L.hud.set("req", "📮 " + (ri + 1) + " / " + ids.length);
      // the letter
      letter.innerHTML = "";
      if (s.files && s.files.thumb) letter.appendChild(u.el("img", { src: RQ.url(s.files.thumb), alt: "satellite picture of " + s.name }));
      letter.appendChild(u.el("div", { class: "sl-stamp", text: ids[ri] === site.id ? "MY SITE" : "URGENT" }));
      letter.appendChild(u.el("div", { class: "from", text: "📮 From: " + s.name + ", " + s.country }));
      letter.appendChild(u.el("div", { class: "msg", text: (SHORT[s.id] || s.name + " needs") + " native seeds — never " + ns.common.toLowerCase() + "!" }));
      letter.appendChild(u.el("div", { class: "clim", html: "🌦️ " + u.esc(bio.climate || "") }));
      note = u.el("div", { class: "sl-note", html: md("Our key: `biome = '" + bk + "'`") });
      letter.appendChild(note);
      // the shelf: 3 natives + the real not_suitable seed + 2 natives of other forests
      var others = u.shuffle(ROWS.filter(function (r) { return r.biome !== bk; }), L.rng), decoys = [], used = {};
      others.forEach(function (r) { if (decoys.length < 2 && !used[r.biome]) { used[r.biome] = 1; decoys.push(r); } });
      var items = rowsOf(bk).map(function (r) { return { kind: "native", r: r }; })
        .concat([{ kind: "trap", ns: ns }])
        .concat(decoys.map(function (r) { return { kind: "decoy", r: r }; }));
      items = u.shuffle(items, L.rng);
      jars.innerHTML = "";
      items.forEach(function (it) {
        var j;
        if (it.kind === "trap") {
          j = u.el("button", { class: "sl-jar trap", "aria-label": it.ns.common + ", label unknown" },
            u.el("span", { class: "ico", text: trapIcon(it.ns.common) }), u.el("span", { class: "nm", text: it.ns.common }),
            u.el("span", { class: "lt", text: TRAP_QUIP[it.ns.common] || "special offer!" }), u.el("span", { class: "tag", text: "biome: ???" }),
            u.el("span", { class: "sl-sticker", text: "SALE!" }),
            u.el("span", { class: "sl-minibug", html: RQ.chars ? RQ.chars.svg("bug", { mood: "happy" }) : "🐞" }));
        } else {
          j = u.el("button", { class: "sl-jar", "aria-label": it.r.common + ", biome " + it.r.biome },
            u.el("span", { class: "ico", text: seedIcon(it.r) }), u.el("span", { class: "nm", text: it.r.common }),
            u.el("span", { class: "lt", text: it.r.latin }), u.el("span", { class: "tag", html: dot(it.r.biome) + wbr(it.r.biome) }));
        }
        it.el = j; jars.appendChild(j);
        DK.bind(j, { zone: ".sl-crate", onTap: function () { pick(it); }, onDrop: function (t) { if (t && t.closest(".sl-crate")) pick(it); } });
      });
      // the crate
      crate.innerHTML = ""; slots = [];
      crate.appendChild(u.el("h3", { text: "📦 Seed crate" }));
      crate.appendChild(u.el("div", { class: "ck", text: "biome = '" + bk + "'" }));
      var cs = u.el("div", { class: "sl-cslots" }); crate.appendChild(cs);
      for (var i = 0; i < 3; i++) { var sl = u.el("div", { class: "sl-cslot", text: "seed " + (i + 1) }); slots.push(sl); cs.appendChild(sl); }
      crate.classList.remove("ship"); crate.classList.remove("back"); void crate.offsetWidth; crate.classList.add("back");
    }
    function setNote(html, bad) { note.innerHTML = html; note.className = "sl-note" + (bad ? " bad" : ""); shake(note); }
    function pick(it) {
      if (busy || it.done || !L.alive) return;
      var bk = RQ.site(ids[ri]).biome;
      if (it.kind === "native") {
        it.done = true;
        var slot = slots[packed.length]; packed.push(it);
        var p = flyTo(L, root, it.el, slot, 450);
        it.el.classList.add("gone"); it.el.disabled = true; RQ.audio.sfx("pop");
        p.then(function () {
          if (!L.alive) return;
          slot.classList.add("full");
          slot.innerHTML = '<span class="ico">' + seedIcon(it.r) + "</span><span>" + u.esc(it.r.common) + "</span>";
          RQ.audio.sfx("good");
          if (packed.length === 3 && !busy) ship();
        });
        return;
      }
      mistakes++; L.hud.set("miss", "🐞 " + mistakes);
      shake(it.el);
      if (it.kind === "trap") {
        RQ.audio.sfx("giggle");
        setNote("🚫 <b>" + u.esc(it.ns.common) + "</b>: " + u.esc(it.ns.why), true);
        if (!trapSeen) { trapSeen = true; L.say("bug", "Hee hee! Shiny, juicy... and totally the wrong forest!"); }
      } else {
        RQ.audio.sfx("bad");
        setNote(md("**" + it.r.common + "** is native to `" + it.r.biome + "`, not to `" + bk + "`. Wrong forest!"), true);
      }
      if (mistakes >= 3 || L.fails >= 1) {
        // hint: the native jars glow
        jars.querySelectorAll(".sl-jar").forEach(function (j) { j.classList.remove("sl-hint"); });
        jarsFor(bk).forEach(function (j) { j.classList.add("sl-hint"); });
      }
    }
    function jarsFor(bk) { return u.$$(".sl-jar:not(.trap):not(.gone)", jars).filter(function (j) { return (j.getAttribute("aria-label") || "").indexOf("biome " + bk) >= 0; }); }
    function ship() {
      busy = true;
      var s = RQ.site(ids[ri]), bio = B[s.biome];
      L.wait(450).then(function () {
        if (!L.alive) return;
        crate.classList.remove("back"); crate.classList.add("ship"); RQ.audio.sfx("whoosh");
        var par = u.el("div", { class: "sl-parade" }, u.el("h3", { text: "🎉 Crate shipped! These animals can come home:" }));
        var row = u.el("div", { class: "row" }); par.appendChild(row);
        (bio.animals || []).forEach(function (a, i) {
          row.appendChild(u.el("span", { class: "sl-animal", style: { animationDelay: (0.25 + i * 0.22) + "s" }, html: "<b>" + animalIcon(a) + "</b> " + u.esc(a) }));
          L.timeout(function () { RQ.audio.sfx("chirp"); }, 250 + i * 220);
        });
        jars.appendChild(par);
        return L.wait(2900);
      }).then(function () {
        if (!L.alive) return;
        ri++;
        if (ri < ids.length) { load(); return; }
        L.win({ stars: starsFor(mistakes, 1, 3), msg: "Every forest got its own **native** seeds. Not one mango slipped through!",
          stats: { "Crates shipped": ids.length, "Wrong picks": mistakes } });
      });
    }
    load(); L.hud.set("miss", "🐞 0");
  }

  /* ------------------------------------------------------------ L4 keys, join, JSON vs dict */
  function levelKeys(L) {
    var site = mySite(), mine = site.biome;
    var prefer = { southern_eucalypt: "Drooping sheoak" };
    var sp = BIOME_KEYS.map(function (k) {
      var a = rowsOf(k); return a.filter(function (r) { return r.common === prefer[k]; })[0] || a[0];
    });
    var order = u.shuffle(sp, L.rng);
    var root = room(L), qc = questCard(root, "hoot");
    var area = u.el("div", { class: "sl-l4" }); root.appendChild(area);
    var left = u.el("div"), right = u.el("div");
    area.appendChild(left); area.appendChild(u.el("div")); area.appendChild(right);
    var svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "sl-links"); area.appendChild(svg);
    var bar = u.el("div", { class: "sl-bar" }); root.appendChild(bar);
    var mistakes = 0;
    L.hud.set("miss", "🐞 0");
    function oops(msg) { mistakes++; L.hud.set("miss", "🐞 " + mistakes); RQ.audio.sfx("giggle"); if (msg) L.toast("🐞 " + msg, "bad", 2600); }

    // species table (left): common | biome (a key that points to the other table)
    var tS = u.el("table", { class: "sl-mini" });
    tS.appendChild(u.el("caption", { html: "📗 table <code>species</code>" }));
    tS.appendChild(u.el("thead", {}, u.el("tr", {}, u.el("th", { text: "common" }), u.el("th", { text: "biome 🔗" }))));
    var tbS = u.el("tbody"); tS.appendChild(tbS); left.appendChild(tS);
    var fks = [];
    order.forEach(function (r) {
      var fk = u.el("button", { class: "sl-fk", text: r.biome, dataset: { key: r.biome }, "aria-label": r.common + " biome key " + r.biome });
      var tr = u.el("tr", {}, u.el("td", { class: "com", html: seedIcon(r) + " <b>" + u.esc(r.common) + "</b>" }), u.el("td", {}, fk));
      fk._r = r; fk._tr = tr; fks.push(fk); tbS.appendChild(tr);
    });
    // biomes table (right): biome (primary key) | name | animals
    var tB = u.el("table", { class: "sl-mini" });
    tB.appendChild(u.el("caption", { html: "📘 table <code>biomes</code>" }));
    tB.appendChild(u.el("thead", {}, u.el("tr", {}, u.el("th", { text: "🔑 biome" }), u.el("th", { text: "name" }), u.el("th", { text: "animals" }))));
    var tbB = u.el("tbody"); tB.appendChild(tbB); right.appendChild(tB);
    var bRows = {};
    BIOME_KEYS.forEach(function (k) {
      var an = B[k].animals || [];
      var tr = u.el("tr", { class: "sl-bkrow", tabindex: "0", dataset: { key: k }, "aria-label": "biome " + k + ", " + B[k].name },
        u.el("td", { class: "key", html: dot(k) + u.esc(k) }), u.el("td", { class: "nm", text: B[k].name }),
        u.el("td", { class: "an", title: an.join(", "), text: an.map(animalIcon).join("") }));
      bRows[k] = tr; tbB.appendChild(tr);
    });

    /* ---- linking keys: tap a 🔗 key then its biome row, or drag from one to the other */
    var links = [], armed = null, band = null, drag = null, phase = "link", focusKey = null;
    function pt(el, side) {
      var a = area.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: (side === "r" ? r.right : r.left) - a.left, y: r.top + r.height / 2 - a.top };
    }
    function curve(p, q) { var mx = (p.x + q.x) / 2; return "M" + p.x + " " + p.y + " C" + mx + " " + p.y + " " + mx + " " + q.y + " " + q.x + " " + q.y; }
    function path(d, color, w, dash) {
      var pth = document.createElementNS(NS, "path");
      pth.setAttribute("d", d); pth.setAttribute("fill", "none"); pth.setAttribute("stroke", color); pth.setAttribute("stroke-width", w);
      pth.setAttribute("stroke-linecap", "round"); if (dash) pth.setAttribute("stroke-dasharray", dash);
      svg.appendChild(pth); return pth;
    }
    function redraw() {
      if (!area.isConnected) return;
      svg.innerHTML = "";
      links.forEach(function (l) {
        var hot = focusKey && l.key === focusKey;
        path(curve(pt(l.fk, "r"), pt(l.row.firstChild, "l")), "#1d2b3a", hot ? 11 : 8);
        path(curve(pt(l.fk, "r"), pt(l.row.firstChild, "l")), hot ? "#ffc53d" : BCOL[l.key], hot ? 7 : 4.5);
      });
      if (armed && band) path(curve(pt(armed, "r"), band), "#1d2b3a", 4, "8 7");
    }
    L.on(window, "resize", redraw);
    function arm(fk) {
      if (phase !== "link" || fk.classList.contains("done")) return;
      if (armed) armed.classList.remove("armed");
      armed = fk; fk.classList.add("armed"); RQ.audio.sfx("select");
      u.$$(".sl-bkrow", tbB).forEach(function (r) { r.classList.add("armable"); r.classList.remove("sl-hint"); });
      if (mistakes >= 2 || L.fails >= 1) bRows[fk.dataset.key].classList.add("sl-hint");
    }
    function disarm() {
      if (armed) armed.classList.remove("armed");
      armed = null; band = null;
      u.$$(".sl-bkrow", tbB).forEach(function (r) { r.classList.remove("armable", "sl-hint"); });
      redraw();
    }
    function tryLink(row) {
      if (!armed) { L.toast("First tap a **biome 🔗** key on the left.", "info", 1800); return; }
      var fk = armed;
      if (fk.dataset.key === row.dataset.key) {
        links.push({ fk: fk, row: row, key: row.dataset.key });
        fk.classList.add("done"); row.classList.add("linked");
        RQ.audio.sfx("snap"); L.timeout(function () { RQ.audio.sfx("good"); }, 90);
        disarm();
        if (links.length === fks.length) L.timeout(joinPhase, 500);
      } else {
        var p = path(curve(pt(fk, "r"), pt(row.firstChild, "l")), "#d1495b", 5);
        L.timeout(function () { if (p.parentNode) p.remove(); }, 450);
        oops("Keys must match exactly: '" + fk.dataset.key + "' is not '" + row.dataset.key + "'.");
        shake(row); disarm();
      }
    }
    fks.forEach(function (fk) {
      L.on(fk, "pointerdown", function (e) { if (e.button > 0) return; arm(fk); drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false }; });
      L.on(fk, "click", function () { if (!armed || armed !== fk) arm(fk); });
    });
    L.on(window, "pointermove", function (e) {
      if (!armed) return;
      var a = area.getBoundingClientRect(); band = { x: e.clientX - a.left, y: e.clientY - a.top };
      if (drag && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.moved = true;
      redraw();
    });
    L.on(window, "pointerup", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      if (!d.moved || !armed) return;
      var t = document.elementFromPoint(e.clientX, e.clientY), row = t && t.closest(".sl-bkrow");
      if (row) tryLink(row); else disarm();
    });
    u.$$(".sl-bkrow", tbB).forEach(function (row) {
      L.on(row, "click", function () { if (phase === "link") tryLink(row); });
      L.on(row, "keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && phase === "link") { e.preventDefault(); tryLink(row); } });
    });
    qc.set("A **biome** is a kind of habitat. Match each seed's 🔗 `biome` (a **foreign key**) to the same 🔑 **primary key** in `biomes`: tap one, then the other.");
    L.hud.set("links", "🔗 0 / " + fks.length);
    L.on(window, "pointerup", function () { if (phase === "link") L.hud.set("links", "🔗 " + links.length + " / " + fks.length); });
    L.timeout(redraw, 60);

    /* ---- the join question */
    function joinPhase() {
      if (!L.alive) return;
      phase = "join"; L.hud.set("links", "🔗 " + links.length + " / " + fks.length + " ✓");
      L.say("hoot", "All keys linked! A **JOIN** follows a key from one table into the other.").then(function () {
        if (!L.alive) return;
        var js = sp.filter(function (r) { return r.biome === mine; })[0] || sp[0];
        focusKey = js.biome; redraw();
        fks.forEach(function (fk) { if (fk._r === js) fk._tr.classList.add("focus"); });
        bRows[js.biome].classList.add("focus");
        var sql = "SELECT biomes.animals FROM species JOIN biomes ON species.biome = biomes.biome WHERE common = '" + js.common + "';";
        qc.set("**JOIN:** which animals live where **" + js.common + "** grows? Follow its glowing key line!",
          '<div class="sl-ghostsql" style="color:#1d2b3a">' + sqlHTML(sql) + "</div>");
        var opts = [js.biome].concat(u.shuffle(BIOME_KEYS.filter(function (k) { return k !== js.biome && (B[k].animals || []).length; }), L.rng).slice(0, 2));
        opts = u.shuffle(opts, L.rng);
        bar.innerHTML = "";
        opts.forEach(function (k) {
          var an = B[k].animals || [];
          var btn = u.el("button", { class: "btn", html: an.map(function (a) { return animalIcon(a) + " " + u.esc(a); }).join(", ") });
          L.on(btn, "click", function () {
            if (phase !== "join") return;
            if (k === js.biome) {
              phase = "done-join"; RQ.audio.sfx("good"); btn.classList.add("go");
              bar.innerHTML = "";
              bar.appendChild(u.el("div", { class: "sl-joined panel", html: "🔗 Joined row: <b>" + u.esc(js.common) + "</b> · <code>" + u.esc(js.biome) + "</code> · " +
                an.map(function (a) { return animalIcon(a) + " " + u.esc(a); }).join(", ") }));
              L.timeout(formatsPhase, 2200);
            } else { oops("Those animals live in `" + k + "`. Follow the line from " + js.common + "!"); shake(btn); }
          });
          bar.appendChild(btn);
        });
        L.timeout(redraw, 30);
      });
    }

    /* ---- one record, three outfits: table row, JSON, Python dict */
    function formatsPhase() {
      if (!L.alive) return;
      phase = "formats";
      var r = sp.filter(function (x) { return x.biome === mine; })[0] || sp[0];
      area.remove(); bar.innerHTML = ""; L.hud.set("links", null);
      var F = ["latin", "common", "mass_g", "establishment", "delivery"];
      function num(v) { return Number.isInteger(v) ? v + ".0" : String(v); }
      function val(f, q) { return NUM[f] ? num(r[f]) : q + r[f] + q; }
      var box = u.el("div", { class: "sl-formats" }); root.insertBefore(box, bar);
      // table row
      var pRow = u.el("div", { class: "sl-fmt rowp" }, u.el("h4", { html: "📗 Table row <small>one record in the <code>species</code> table</small>" }));
      var mt = u.el("table", { class: "sl-mini" }), hr = u.el("tr"), dr = u.el("tr"), heads = {}, cells = {};
      F.forEach(function (f) {
        heads[f] = u.el("th", { text: f }); hr.appendChild(heads[f]);
        cells[f] = u.el("td", { class: f === "latin" ? "lat" : "", text: String(r[f]) }); dr.appendChild(cells[f]);
      });
      mt.appendChild(u.el("thead", {}, hr)); mt.appendChild(u.el("tbody", {}, dr)); pRow.appendChild(mt); box.appendChild(pRow);
      // JSON and Python dict, one line per field
      var lines = { json: {}, py: {} };
      function panel(kind, title, sub) {
        var p = u.el("div", { class: "sl-fmt dark" }, u.el("h4", { html: title + " <small>" + sub + "</small>" }));
        if (kind === "json") p.appendChild(u.el("div", { class: "sl-line", text: "{" }));
        F.forEach(function (f, i) {
          var last = i === F.length - 1, txt;
          if (kind === "json") txt = '  "' + f + '": ' + val(f, '"') + (last ? "" : ",");
          else txt = (i === 0 ? "{" : " ") + "'" + f + "': " + val(f, "'") + (last ? "}" : ",");
          var ln = u.el("div", { class: "sl-line f", tabindex: "0", role: "button", dataset: { f: f, k: kind }, text: txt });
          lines[kind][f] = ln; p.appendChild(ln);
        });
        if (kind === "json") p.appendChild(u.el("div", { class: "sl-line", text: "}" }));
        box.appendChild(p);
      }
      panel("json", "📦 JSON", "like the website file <code>species.json</code>");
      panel("py", "🐍 Python dict", "the way Python prints it");
      var rounds = ["common", "mass_g", "delivery"], ri = 0, found = {};
      function loadRound() {
        var f = rounds[ri]; found = {};
        heads[f].classList.add("want"); cells[f].classList.add("want");
        qc.set("Field **" + (ri + 1) + " / 3**: find the field `" + f + "` in the **JSON** and in the **Python dict**. Tap both lines!");
      }
      function tap(ln) {
        if (phase !== "formats" || ln.classList.contains("found")) return;
        var f = rounds[ri];
        if (ln.dataset.f !== f) {
          oops("That line is `" + ln.dataset.f + "`. We want `" + f + "`.");
          ln.classList.add("no"); L.timeout(function () { ln.classList.remove("no"); }, 450);
          if (mistakes >= 3 || L.fails >= 1) { lines.json[f].classList.add("sl-hint"); lines.py[f].classList.add("sl-hint"); }
          return;
        }
        if (found[ln.dataset.k]) return;
        found[ln.dataset.k] = true; ln.classList.remove("sl-hint"); ln.classList.add("found"); RQ.audio.sfx("pop");
        if (found.json && found.py) {
          heads[f].classList.remove("want"); cells[f].classList.remove("want");
          heads[f].classList.add("found"); cells[f].classList.add("found"); RQ.audio.sfx("good");
          ri++;
          if (ri < rounds.length) L.timeout(loadRound, 500); else L.timeout(quoteQuestion, 600);
        }
      }
      u.$$(".sl-line.f", box).forEach(function (ln) {
        L.on(ln, "click", function () { tap(ln); });
        L.on(ln, "keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(ln); } });
      });
      function quoteQuestion() {
        phase = "quotes";
        qc.set("Last clue! Which outfit uses **'single quotes'** here?");
        bar.innerHTML = "";
        [["📗 Table row", 0], ["📦 JSON", 1], ["🐍 Python dict", 2]].forEach(function (o) {
          var btn = u.el("button", { class: "btn big", html: o[0] });
          L.on(btn, "click", function () {
            if (phase !== "quotes") return;
            if (o[1] === 2) {
              phase = "end"; btn.classList.add("go"); RQ.audio.sfx("good");
              L.toast("✅ This Python dict uses 'single quotes'; Python allows both kinds. **JSON** text needs \"double quotes\".", "good", 3400);
              L.timeout(function () {
                L.win({ stars: starsFor(mistakes, 1, 3), msg: "Keys linked, tables joined, and one record seen in three outfits!",
                  stats: { "Keys linked": fks.length, "Mistakes": mistakes } });
              }, 1600);
            } else { oops(o[1] === 1 ? "Look again: **JSON** uses \"double quotes\" only." : "The table row has no quotes at all!"); shake(btn); }
          });
          bar.appendChild(btn);
        });
      }
      L.say("pix", "Same seed, three outfits: a table row, **JSON** and a Python dict. Find each field in all three!").then(function () {
        if (L.alive) loadRound();
      });
    }
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g18",
    music: "mystery",
    intro: [
      ["hoot", "Welcome to the **Seed Library**! Every native seed ReSeed can drop has a record here."],
      ["sprout", "A drone can only plant what we load. Let's find the right seeds for every forest!"]
    ],
    outro: [
      ["hoot", "Tables, queries, keys and JSON: you did real database work today!"],
      ["koa", "The crates are packed with native seeds. Meet me on Fly island, mate!"]
    ],
    levels: [
      { title: "Tables, rows, columns", goal: "Click the right row, column or cell",
        intro: [["hoot", "This is the **species table**. Each **row** is one seed, and each **column** is one kind of fact."],
                ["hoot", "Read each library request at the top. Then click the right row, column or cell."]],
        cards: ["db-table", "record-field"],
        play: levelTable },
      { title: "Query blocks", goal: "Build each query with blocks, then press Run",
        intro: [["hoot", "Searching by hand is slow. A **query** asks the database for exactly the rows you need."],
                ["pix", "Drag blocks into the strip, or just tap them. Then press **Run** and watch the shelves!"]],
        cards: ["sql-query"],
        play: levelQuery },
      { title: "Seed rescue", goal: "Pack 3 native seeds for each forest",
        intro: [["sprout", "Help letters are pouring in! Every forest needs its own **native** seeds."],
                ["hoot", "Pack three native seeds in each crate. The Glitch Bugs hid a wrong seed on every shelf!"]],
        cards: ["native-species"],
        play: levelRescue },
      { title: "Keys & joins", goal: "Link the keys, join, then find each field",
        intro: [["hoot", "Two tables can hold hands with a **key**. The `biome` key links each seed to its forest."],
                ["pix", "Connect the keys first. Then see the same seed facts in three outfits: a table row, **JSON** and a Python dictionary."]],
        cards: ["key-join", "json"],
        play: levelKeys }
    ]
  });
})();
