/* g22 Mission Coder — program the seed drone with code blocks (Fly island).
 * L1 straight line · L2 a turn · L3 lawnmower with nested repeat (reseed/mission.py `lawnmower`)
 * L4 GPS waypoints near My Site → practice .waypoints file (mission.py `export_waypoints`, QGC WPL 110)
 * L5 demo-day script (reseed/demo_flight.py `timeline`).
 * Scoring (design review): every square seeded + safe return home first, no wasted seeds next, fewer blocks last. */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a";
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // north, east, south, west (grid y grows to the south)
  var BT = {
    fwd: { label: "forward(n)", key: "f", n: 1 },
    left: { label: "turn_left()", key: "l" },
    right: { label: "turn_right()", key: "r" },
    drop: { label: "drop()", key: "d" },
    rep: { label: "repeat n:", key: "p", n: 2 },
    home: { label: "return_home()", key: "h" }
  };
  var MAX_STEPS = 400;
  var SHORT = { rondonia: "Rondônia", dixie: "Dixie Fire scar", kalimantan: "Ketapang" };

  /** The player's My Site with the mission data we need (fallback: Rondônia, values from reseed-data.js). */
  function site() {
    var s = RQ.mySite ? RQ.mySite() : null;
    if (!s || !s.target_patch || !s.mission) {
      s = { id: "rondonia", name: "Jaci-Paraná, Rondônia", target_patch: { centroid: [-9.77155, -64.23703], area_ha: 43.98 },
        mission: { home: [-64.23978, -9.77423], swath_m: 2.2563, altitude_m: 20, releases: 86396 } };
    }
    return s;
  }

  /* ================================================================ program tree helpers */
  var nid = 0;
  function mk(t, n) { var o = { id: ++nid, t: t }; if (BT[t].n) o.n = n || BT[t].n; if (t === "rep") o.body = []; return o; }
  function walk(list, fn, parent) { list.forEach(function (b, i) { fn(b, list, i, parent); if (b.body) walk(b.body, fn, b); }); }
  function find(prog, id) { var r = null; walk(prog, function (b, list, i, parent) { if (b.id === id) r = { node: b, list: list, i: i, parent: parent }; }); return r; }
  function count(list) { var c = 0; walk(list, function () { c++; }); return c; }
  function inside(node, id) { var f = false; if (node.body) walk(node.body, function (b) { if (b.id === id) f = true; }); return f; }
  /** Blocks -> flat list of steps {id, op}. forward(n) becomes n one-square moves; repeat expands. */
  function compile(list, out) {
    for (var i = 0; i < list.length && out.length <= MAX_STEPS; i++) {
      var b = list[i];
      if (b.t === "fwd") for (var k = 0; k < b.n; k++) out.push({ id: b.id, op: "move" });
      else if (b.t === "rep") for (var r = 0; r < b.n && out.length <= MAX_STEPS; r++) { out.push({ id: b.id, op: "loop", r: r, n: b.n }); compile(b.body, out); }
      else out.push({ id: b.id, op: b.t });
    }
    return out;
  }
  var LOOPV = ["i", "j", "k", "m"];
  function toPy(list, depth, lines) {
    var pad = new Array(depth + 1).join("    ");
    list.forEach(function (b) {
      if (b.t === "fwd") lines.push(pad + "forward(" + b.n + ")");
      else if (b.t === "rep") {
        lines.push(pad + "for " + LOOPV[Math.min(depth, 3)] + " in range(" + b.n + "):");
        if (!b.body.length) lines.push(pad + "    pass");
        toPy(b.body, depth + 1, lines);
      } else lines.push(pad + BT[b.t].label);
    });
    return lines;
  }
  function build(spec) { // [["fwd",2],["rep",2,[...]],"drop"] -> nodes
    return spec.map(function (s) {
      if (typeof s === "string") return mk(s);
      var n = mk(s[0], s[1]); if (s[2]) n.body = build(s[2]); return n;
    });
  }
  function parseMap(rows) {
    var M = { cols: rows[0].length, rows: rows.length, cell: {}, patch: [], home: [0, 0], trees: {} };
    rows.forEach(function (r, y) {
      for (var x = 0; x < r.length; x++) {
        var c = r[x], k = x + "," + y; M.cell[k] = c;
        if (c === "p") M.patch.push(k); else if (c === "H") M.home = [x, y]; else if (c === "T") M.trees[k] = true;
      }
    });
    return M;
  }

  /* ================================================================ small animation helper */
  /** Tweens + a draw callback in one L.loop. tween(seconds, fn(k 0..1)) -> Promise. */
  function animator(L, draw) {
    var tweens = [], A = { speed: 1 };
    A.tween = function (d, fn) {
      return new Promise(function (res) { tweens.push({ t: 0, d: Math.max(.01, d * A.speed), fn: fn || function () { }, res: res }); });
    };
    A.clear = function () { tweens = []; };
    A.stop = L.loop(function (dt, t) {
      tweens = tweens.filter(function (tw) {
        tw.t += dt; var k = Math.min(1, tw.t / tw.d); tw.fn(k);
        if (k >= 1) { tw.res(); return false; }
        return true;
      });
      draw(dt, t);
    });
    return A;
  }

  /* ================================================================ drawing helpers */
  /** Top-down seed drone (Sprout's family): nose arrow points along `ang` (0 = up/north). */
  function drawDrone(ctx, x, y, ang, s, t, flying) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.lineCap = "round";
    ctx.strokeStyle = INK; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-19, -19); ctx.lineTo(19, 19); ctx.moveTo(19, -19); ctx.lineTo(-19, 19); ctx.stroke();
    ctx.strokeStyle = "#9aa7b4"; ctx.lineWidth = 4; ctx.stroke();
    [[-19, -19], [19, -19], [19, 19], [-19, 19]].forEach(function (p, i) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 13, 0, 7); ctx.fillStyle = flying ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.8)"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(flying ? t * 32 * (i % 2 ? 1 : -1) : i * .7);
      ctx.fillStyle = "rgba(29,43,58,.6)"; ctx.fillRect(-12, -2, 24, 4); ctx.restore();
    });
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fillStyle = "#7ed957"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-5.5, -4, 4.2, 0, 7); ctx.arc(5.5, -4, 4.2, 0, 7); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-5.5, -5.5, 2.2, 0, 7); ctx.arc(5.5, -5.5, 2.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 9, 5, 3, 0, 0, 7); ctx.fillStyle = "#3f9a3a"; ctx.fill(); // leaf antenna (seen from above)
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-8, -23); ctx.lineTo(8, -23); ctx.closePath();
    ctx.fillStyle = "#ffd23f"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }
  var bugImg = null;
  function drawBug(ctx, x, y, s, t) {
    if (!bugImg && RQ.chars) { bugImg = new Image(); bugImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg("bug", { mood: "happy" })); }
    var bob = Math.sin(t * 14) * 3;
    if (bugImg && bugImg.complete && bugImg.naturalWidth) ctx.drawImage(bugImg, x - 28 * s, y - 34 * s + bob, 56 * s, 56 * s);
    else { ctx.beginPath(); ctx.arc(x, y - 6 + bob, 18 * s, 0, 7); ctx.fillStyle = "#8a5cd0"; ctx.fill(); }
    ctx.font = "700 16px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.strokeText("hee hee!", x, y - 44 * s + bob); ctx.fillStyle = "#7c3fbf"; ctx.fillText("hee hee!", x, y - 44 * s + bob);
  }
  function pill(ctx, x, y, text, bg, fg, font) {
    ctx.font = font || "600 15px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var w = ctx.measureText(text).width + 16;
    ctx.fillStyle = bg; ctx.strokeStyle = INK; ctx.lineWidth = 2; u.rr(ctx, x - w / 2, y - 13, w, 26, 13); ctx.fill(); ctx.stroke();
    ctx.fillStyle = fg || INK; ctx.fillText(text, x, y + 1);
  }

  /* ================================================================ block editor */
  function editor(L, cfg) {
    var E = { prog: [], target: "root", els: {}, wraps: {}, lists: {}, locked: false, last: null, onChange: null, hooks: {} };
    var root = u.el("div", { class: "mc-root" });
    var pal = u.el("div", { class: "mc-pal panel" }, u.el("div", { class: "mc-h", html: "🧱 Blocks" }));
    cfg.tools.forEach(function (t) {
      var html = t === "fwd" ? "forward(<b>n</b>)" : t === "rep" ? "repeat <b>n</b>:" : BT[t].label;
      var b = u.el("button", { class: "mc-blk pal t-" + t, "aria-label": "Add block " + BT[t].label, title: "Tap to add, or drag into your program (key " + BT[t].key.toUpperCase() + ")" },
        u.el("span", { class: "lbl", html: html }), u.el("kbd", { text: BT[t].key.toUpperCase() }));
      b.addEventListener("pointerdown", function (e) { press(e, { pal: t }, b); });
      b.addEventListener("click", function (e) { if (e.detail === 0 && !E.locked) addTap(t); }); // keyboard Enter / Space
      pal.appendChild(b);
    });
    var showBtn = u.el("button", { class: "btn small warn", html: "💡 Show me", style: { display: "none" } });
    var trash = u.el("div", { class: "mc-trash", html: "🗑️ Drag a block<br>here to delete it" });
    var clearArmed = false;
    var clearBtn = u.el("button", { class: "btn small", html: "🧹 Clear all", onclick: function () {
      if (E.locked) return;
      if (!clearArmed) { clearArmed = true; clearBtn.innerHTML = "Tap again to clear"; L.timeout(function () { clearArmed = false; clearBtn.innerHTML = "🧹 Clear all"; }, 2200); return; }
      clearArmed = false; clearBtn.innerHTML = "🧹 Clear all"; E.prog = []; E.target = "root"; RQ.audio.sfx("whoosh"); changed();
    } });
    pal.appendChild(showBtn); pal.appendChild(trash); pal.appendChild(clearBtn);

    var pyBtn = u.el("button", { class: "btn small", html: "🐍 Python", title: "See your program as Python code", onclick: showPy });
    var progEl = u.el("div", { class: "mc-prog", "aria-label": "Your program" });
    var runBtn = u.el("button", { class: "btn go mc-run", html: "▶ RUN", onclick: function () { E.hooks.run(false); } });
    var stepBtn = u.el("button", { class: "btn", html: "⏯ Step", title: "Run one step (key S)", onclick: function () { E.hooks.run(true); } });
    var resetBtn = u.el("button", { class: "btn", html: "↺", title: "Put the drone back home", "aria-label": "Reset the drone", onclick: function () { E.hooks.reset(); } });
    var col = u.el("div", { class: "mc-col panel" },
      u.el("div", { class: "mc-h" }, u.el("span", { text: "📜 Your program" }), u.el("span", { class: "grow" }), pyBtn),
      progEl, u.el("div", { class: "mc-btns" }, runBtn, stepBtn, resetBtn));
    var view = u.el("div", { class: "mc-view" });
    root.appendChild(pal); root.appendChild(col); root.appendChild(view);
    L.stage.appendChild(root);
    E.view = view; E.showBtn = showBtn;

    function getList(id) { if (id === "root") return E.prog; var f = find(E.prog, +id); return f && f.node.body ? f.node.body : null; }
    function lid(f) { return f.parent ? String(f.parent.id) : "root"; }
    function changed(newId) {
      if (E.target !== "root" && !getList(E.target)) E.target = "root";
      render();
      if (newId && E.els[newId]) {
        var el = E.els[newId]; el.classList.add("pop");
        if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
      }
      if (E.onChange) E.onChange();
    }
    function setTarget(id) {
      if (E.locked) return;
      E.target = E.target === id && id !== "root" ? "root" : id; RQ.audio.sfx("select"); render();
    }
    function addTap(t) {
      var list = getList(E.target) || E.prog, node = mk(t);
      list.push(node); if (node.n) E.last = node;
      if (t === "rep") E.target = String(node.id);
      RQ.audio.sfx("snap"); changed(node.id);
    }
    function remove(id) {
      var f = find(E.prog, id); if (!f) return;
      f.list.splice(f.i, 1); RQ.audio.sfx("whoosh");
      if (E.last && E.last.id === id) E.last = null;
      changed();
    }
    function setN(b, n) { b.n = u.clamp(n, 1, 9); E.last = b; RQ.audio.sfx("tick"); if (E.onChange) E.onChange(); }

    /* ---- render ---- */
    function render() {
      E.els = {}; E.wraps = {}; E.lists = {};
      progEl.innerHTML = "";
      if (!E.prog.length) progEl.appendChild(u.el("div", { class: "mc-empty", html: "👈 Tap a block, or drag it here." }));
      progEl.appendChild(listEl(E.prog, "root"));
    }
    function listEl(list, id) {
      var el = u.el("div", { class: "mc-list", dataset: { list: id } });
      E.lists[id] = el;
      list.forEach(function (b) { el.appendChild(blockEl(b)); });
      var on = E.target === id;
      if (on || !list.length || id === "root") {
        el.appendChild(u.el("button", { class: "mc-slot" + (on ? " on" : ""), dataset: { list: id }, "aria-label": "Put the next blocks here",
          html: on ? "▸ next block goes here" : list.length ? "＋ add at the end" : "＋ put blocks inside",
          onclick: function () { setTarget(id); } }));
      }
      return el;
    }
    function blockEl(b) {
      var x = u.el("button", { class: "mc-x", "aria-label": "Delete this block", html: "✕", onclick: function (e) { e.stopPropagation(); if (!E.locked) remove(b.id); } });
      var el;
      if (b.t === "fwd") el = u.el("div", { class: "mc-blk t-fwd", dataset: { id: b.id } }, u.el("span", { text: "forward(" }), num(b), u.el("span", { text: ")" }), x);
      else if (b.t === "rep") el = u.el("div", { class: "mc-blk t-rep head", dataset: { id: b.id }, title: "Tap to put the next blocks inside" },
        u.el("span", { text: "repeat" }), num(b), u.el("span", { text: ":" }), u.el("span", { class: "mc-lap" }), x);
      else el = u.el("div", { class: "mc-blk t-" + b.t, dataset: { id: b.id } }, u.el("span", { text: BT[b.t].label }), x);
      el.addEventListener("pointerdown", function (e) { press(e, { id: b.id }, el); });
      E.els[b.id] = el;
      if (b.t !== "rep") { E.wraps[b.id] = el; return el; }
      var w = u.el("div", { class: "mc-rep" + (E.target === String(b.id) ? " tgt" : "") }, el,
        u.el("div", { class: "mc-body", dataset: { list: String(b.id) } }, listEl(b.body, String(b.id))),
        u.el("div", { class: "mc-foot", dataset: { id: b.id } }));
      E.wraps[b.id] = w;
      return w;
    }
    function num(b) {
      var btn = u.el("button", { class: "mc-num", text: String(b.n), "aria-label": "Number " + b.n + ". Tap to change, or use the arrow keys" });
      btn.onclick = function (e) { e.stopPropagation(); if (!E.locked) picker(b, btn); };
      btn.onkeydown = function (e) {
        var d = e.key === "ArrowUp" || e.key === "+" ? 1 : e.key === "ArrowDown" || e.key === "-" ? -1 : 0;
        if (d && !E.locked) { e.preventDefault(); e.stopPropagation(); setN(b, b.n + d); btn.textContent = String(b.n); }
      };
      return btn;
    }
    var pick = null;
    function picker(b, btn) {
      closePick();
      var r = btn.getBoundingClientRect();
      pick = u.el("div", { class: "mc-pick", role: "dialog", "aria-label": "Pick a number" });
      for (var i = 1; i <= 9; i++) (function (n) {
        pick.appendChild(u.el("button", { class: "btn" + (n === b.n ? " primary" : ""), text: String(n),
          onclick: function (e) { e.stopPropagation(); setN(b, n); btn.textContent = String(n); RQ.audio.sfx("select"); closePick(); } }));
      })(i);
      document.body.appendChild(pick);
      var pw = pick.offsetWidth, ph = pick.offsetHeight;
      pick.style.left = u.clamp(r.left + r.width / 2 - pw / 2, 6, innerWidth - pw - 6) + "px";
      pick.style.top = (r.bottom + ph + 8 < innerHeight ? r.bottom + 6 : Math.max(6, r.top - ph - 6)) + "px";
      var cur = pick.children[b.n - 1]; if (cur) cur.focus();
    }
    function closePick() { if (pick) { pick.remove(); pick = null; } }
    L.on(window, "pointerdown", function (e) { if (pick && !pick.contains(e.target) && !(e.target.closest && e.target.closest(".mc-num"))) closePick(); }, true);

    /* ---- drag and drop (pointer events: mouse, pen and touch) ---- */
    var drag = null, ghost = null, ins = u.el("div", { class: "mc-ins" });
    document.body.appendChild(ins);
    function press(e, src, el) {
      if (E.locked || (e.button != null && e.button > 0)) return;
      if (e.target.closest && e.target.closest(".mc-x, .mc-num")) return;
      drag = { src: src, el: el, x0: e.clientX, y0: e.clientY, on: false };
    }
    function begin() {
      drag.on = true; closePick();
      var vis = drag.src.pal ? drag.el : E.wraps[drag.src.id];
      var r = vis.getBoundingClientRect();
      ghost = vis.cloneNode(true); ghost.classList.add("mc-ghost"); ghost.classList.remove("pop");
      ghost.style.width = r.width + "px"; ghost.style.left = r.left + "px"; ghost.style.top = r.top + "px";
      drag.ox = drag.x0 - r.left; drag.oy = drag.y0 - r.top; drag.vis = vis;
      document.body.appendChild(ghost);
      if (!drag.src.pal) vis.classList.add("mc-dragging");
      RQ.audio.sfx("tick");
    }
    function endVisuals() {
      if (ghost) { ghost.remove(); ghost = null; }
      ins.style.display = "none"; trash.classList.remove("hot");
      u.$$(".mc-dragging").forEach(function (x) { x.classList.remove("mc-dragging"); });
    }
    L.done.then(function () { endVisuals(); closePick(); ins.remove(); });
    function badTarget(t, d) {
      if (!t || t.trash || !d || d.src.pal) return false;
      var f = find(E.prog, d.src.id); if (!f) return true;
      return f.node.t === "rep" && (t.list === String(f.node.id) || inside(f.node, +t.list));
    }
    function dropTarget(cx, cy) {
      var el = document.elementFromPoint(cx, cy);
      if (!el || !el.closest) return null;
      if (el.closest(".mc-trash")) return { trash: true };
      if (!progEl.contains(el)) return null;
      var slot = el.closest(".mc-slot");
      if (slot) return { list: slot.dataset.list, index: 1e9 };
      var foot = el.closest(".mc-foot");
      if (foot) { var ff = find(E.prog, +foot.dataset.id); if (ff) return { list: lid(ff), index: ff.i + 1 }; }
      var blk = el.closest(".mc-blk");
      if (blk && blk.dataset.id) {
        var id = +blk.dataset.id, f = find(E.prog, id), r = blk.getBoundingClientRect(), low = cy > r.top + r.height / 2;
        if (!f) return null;
        if (f.node.t === "rep" && low) return { list: String(id), index: 0 };
        return { list: lid(f), index: f.i + (low ? 1 : 0) };
      }
      var body = el.closest(".mc-body");
      if (body) return { list: body.dataset.list, index: 1e9 };
      return { list: "root", index: 1e9 };
    }
    function showIns(t) {
      trash.classList.toggle("hot", !!(t && t.trash));
      if (!t || t.trash || badTarget(t, drag) || !E.lists[t.list]) { ins.style.display = "none"; return; }
      var listE = E.lists[t.list];
      var kids = Array.prototype.filter.call(listE.children, function (c) { return !c.classList.contains("mc-slot"); });
      var idx = Math.min(t.index, kids.length), r, y;
      if (idx < kids.length) { r = kids[idx].getBoundingClientRect(); y = r.top - 5; }
      else if (kids.length) { r = kids[kids.length - 1].getBoundingClientRect(); y = r.bottom + 1; }
      else { r = listE.getBoundingClientRect(); y = r.top; }
      ins.style.display = "block"; ins.style.left = r.left + "px"; ins.style.width = r.width + "px"; ins.style.top = y + "px";
    }
    L.on(window, "pointermove", function (e) {
      if (!drag) return;
      if (!drag.on) { if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 9) return; begin(); }
      e.preventDefault();
      ghost.style.left = (e.clientX - drag.ox) + "px"; ghost.style.top = (e.clientY - drag.oy) + "px";
      showIns(dropTarget(e.clientX, e.clientY));
      var pr = progEl.getBoundingClientRect();
      if (e.clientX > pr.left && e.clientX < pr.right) {
        if (e.clientY < pr.top + 40) progEl.scrollTop -= 14; else if (e.clientY > pr.bottom - 40) progEl.scrollTop += 14;
      }
    });
    L.on(window, "pointerup", function (e) {
      if (!drag) return;
      var d = drag; drag = null;
      if (!d.on) { tap(d); return; }
      var t = dropTarget(e.clientX, e.clientY); endVisuals(); doDrop(d, t);
    });
    L.on(window, "pointercancel", function () { if (drag && drag.on) endVisuals(); drag = null; });
    function tap(d) {
      if (E.locked) return;
      if (d.src.pal) { addTap(d.src.pal); return; }
      var f = find(E.prog, d.src.id);
      if (f && f.node.t === "rep") setTarget(String(f.node.id));
    }
    function doDrop(d, t) {
      if (!t) { RQ.audio.sfx("whoosh"); return; }
      if (t.trash) { if (!d.src.pal) remove(d.src.id); else RQ.audio.sfx("whoosh"); return; }
      if (badTarget(t, d)) { RQ.audio.sfx("error"); L.toast("A repeat can't go inside itself!", "bad"); return; }
      var list = getList(t.list); if (!list) return;
      var idx = Math.min(t.index, list.length), node;
      if (d.src.pal) node = mk(d.src.pal);
      else {
        var f = find(E.prog, d.src.id); if (!f) return;
        node = f.node;
        if (f.list === list && f.i < idx) idx--;
        f.list.splice(f.i, 1);
      }
      list.splice(idx, 0, node);
      if (node.n) E.last = node;
      if (node.t === "rep" && d.src.pal) E.target = String(node.id);
      RQ.audio.sfx("snap"); changed(node.id);
    }

    /* ---- keyboard ---- */
    L.on(window, "keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      var k = (e.key || "").toLowerCase(), onBtn = e.target && e.target.tagName === "BUTTON";
      if (pick) { if (k === "escape") closePick(); return; }
      if (E.locked) { if (k === "escape" || k === "enter") { e.preventDefault(); E.hooks.run(false); } return; }
      for (var t in BT) if (BT[t].key === k && cfg.tools.indexOf(t) >= 0) { e.preventDefault(); addTap(t); return; }
      if (/^[1-9]$/.test(k) && E.last && find(E.prog, E.last.id)) { setN(E.last, +k); render(); return; }
      if (k === "backspace" || k === "delete") {
        e.preventDefault();
        var list = getList(E.target) || E.prog;
        if (list.length) remove(list[list.length - 1].id);
        else if (E.target !== "root") { var f = find(E.prog, +E.target); E.target = f ? lid(f) : "root"; render(); }
        return;
      }
      if (k === "enter" && !onBtn) { e.preventDefault(); E.hooks.run(false); }
      else if (k === "s") E.hooks.run(true);
    });

    function showPy() {
      var lines = ["# Your drone program (game version)", "from drone import forward, turn_left, turn_right, drop, return_home", ""];
      toPy(E.prog, 0, lines);
      if (!E.prog.length) lines.push("# (empty: add some blocks!)");
      RQ.ui.modal({ icon: "🐍", title: "Your program in Python", buttons: [{ label: "Back to blocks", cls: "go" }],
        node: u.el("div", {}, RQ.code.block(lines.join("\n"), { lines: true }),
          u.el("p", { class: "muted", html: "Blocks and Python are the same program. In Python, <code>repeat 3:</code> is written <code>for i in range(3):</code>, and the indented lines are inside the loop." })) });
    }

    E.render = render;
    E.load = function (prog) { E.prog = prog; E.target = "root"; E.last = null; changed(); };
    E.lock = function (on, label) {
      E.locked = on; root.classList.toggle("running", on);
      runBtn.innerHTML = label || (on ? "⏹ Stop" : "▶ RUN");
      stepBtn.disabled = on; resetBtn.disabled = on;
    };
    E.hi = function (id) {
      u.$$(".mc-blk.now", progEl).forEach(function (x) { x.classList.remove("now"); });
      var el = id != null && E.els[id];
      if (el) { el.classList.add("now"); if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" }); }
    };
    E.lap = function (id, text) { var el = E.els[id]; var lap = el && el.querySelector(".mc-lap"); if (lap) lap.textContent = text; };
    E.clearMarks = function () { E.hi(null); u.$$(".mc-lap", progEl).forEach(function (x) { x.textContent = ""; }); };
    render();
    return E;
  }

  /* ================================================================ the drone map (levels 1-3) */
  function world(L, M, parent, cfg) {
    var C = 72, P = 14, CAP = 66, W = M.cols * C + P * 2, GH = M.rows * C + P * 2, H = GH + CAP;
    var api = L.canvas({ w: W, h: H, parent: parent, label: "Drone map, " + M.cols + " by " + M.rows + " squares" });
    var ctx = api.ctx, rng = u.seeded("g22:" + M.cols + "x" + M.rows + ":" + M.patch.length), deco = {};
    for (var yy = 0; yy < M.rows; yy++) for (var xx = 0; xx < M.cols; xx++) {
      var blobs = [];
      for (var i = 0; i < 4; i++) blobs.push({ dx: .18 + rng() * .64, dy: .18 + rng() * .64, r: .17 + rng() * .13, c: ["#3e9a4a", "#4aad56", "#358c42", "#5bbb5f"][i] });
      deco[xx + "," + yy] = { blobs: blobs, tufts: [rng(), rng(), rng(), rng(), rng(), rng()] };
    }
    var S, parts = [], floats = [], bug = null;
    function cxp(x) { return P + (x + .5) * C; }
    function cyp(y) { return P + (y + .5) * C; }
    var A = animator(L, draw);
    function reset() {
      S = { x: M.home[0], y: M.home[1], dir: cfg.dir, rx: M.home[0], ry: M.home[1], ang: cfg.dir * Math.PI / 2, alt: 0,
        seeded: {}, grow: {}, wasted: 0, doubles: 0, party: 0, shake: 0 };
      A.clear(); parts = []; floats = []; bug = null;
    }
    reset();
    function nul() { return null; }
    function floatTxt(x, y, text, color) { floats.push({ x: x, y: y, text: text, c: color, life: 1.3 }); }
    function sparkle(x, y, color, n) { for (var k = 0; k < (n || 12); k++) parts.push({ kind: "spark", x: x, y: y, vx: u.rand(-120, 120), vy: u.rand(-160, 20), life: .7, c: color }); }
    var W_ = {
      get S() { return S; },
      reset: reset,
      seededCount: function () { return M.patch.filter(function (k) { return S.seeded[k]; }).length; },
      atHome: function () { return S.x === M.home[0] && S.y === M.home[1]; },
      setSpeed: function (s) { A.speed = s; },
      takeoff: function () { RQ.audio.sfx("engine"); return A.tween(.45, function (k) { S.alt = u.ease.outCubic(k); }); },
      land: function () { return A.tween(.5, function (k) { S.alt = 1 - k; }).then(function () { RQ.audio.sfx("pop"); }); },
      celebrate: function () { sparkle(cxp(M.home[0]), cyp(M.home[1]), "#ffd23f", 20); return A.tween(1.2, function (k) { S.party = u.ease.outBack(k); }); },
      exec: function (st) {
        var op = st.op;
        if (op === "loop") return A.tween(.14).then(nul);
        if (op === "move") {
          var d = DIRS[S.dir], nx = S.x + d[0], ny = S.y + d[1];
          var out = nx < 0 || ny < 0 || nx >= M.cols || ny >= M.rows;
          if (out || M.trees[nx + "," + ny]) return bonk(d, out ? "edge" : "tree");
          var x0 = S.x, y0 = S.y; S.x = nx; S.y = ny;
          return A.tween(.3, function (k) { k = u.ease.inOut(k); S.rx = x0 + d[0] * k; S.ry = y0 + d[1] * k; }).then(nul);
        }
        if (op === "left" || op === "right") {
          var a0 = S.ang, da = op === "left" ? -Math.PI / 2 : Math.PI / 2;
          S.dir = (S.dir + (op === "left" ? 3 : 1)) % 4; RQ.audio.sfx("tick");
          return A.tween(.24, function (k) { S.ang = a0 + da * u.ease.inOut(k); }).then(nul);
        }
        if (op === "drop") return dropSeeds();
        if (op === "home") return rtl();
        return Promise.resolve(null);
      }
    };
    function dropSeeds() {
      var x = cxp(S.x), y = cyp(S.y), key = S.x + "," + S.y;
      RQ.audio.sfx("drop");
      for (var k = 0; k < 8; k++) parts.push({ kind: "seed", x: x + u.rand(-6, 6), y: y + u.rand(-6, 6), z: 30, vz: 0, vx: u.rand(-40, 40), vy: u.rand(-40, 40), life: 1.4 });
      return A.tween(.34).then(function () {
        if (M.cell[key] === "p") {
          if (S.seeded[key]) { S.doubles++; floatTxt(x, y - 24, "already seeded!", "#b0532b"); RQ.audio.sfx("buzz"); }
          else { S.seeded[key] = true; S.grow[key] = 0; RQ.audio.sfx("pop"); sparkle(x, y, "#7ed957"); floatTxt(x, y - 24, "+1 🌱", "#1f7a35"); }
        } else { S.wasted++; floatTxt(x, y - 24, "wasted!", "#d1495b"); RQ.audio.sfx("buzz"); }
        return null;
      });
    }
    function rtl() {
      var x0 = S.rx, y0 = S.ry, hx = M.home[0], hy = M.home[1], dist = Math.hypot(hx - x0, hy - y0);
      RQ.audio.sfx("whoosh"); S.x = hx; S.y = hy;
      return A.tween(.2 + dist * .12, function (k) { k = u.ease.inOut(k); S.rx = x0 + (hx - x0) * k; S.ry = y0 + (hy - y0) * k; S.alt = 1 + Math.sin(k * Math.PI) * .35; }).then(nul);
    }
    function bonk(d, why) {
      var x0 = S.rx, y0 = S.ry;
      return A.tween(.16, function (k) { S.rx = x0 + d[0] * .4 * k; S.ry = y0 + d[1] * .4 * k; }).then(function () {
        RQ.audio.sfx("bad"); S.shake = .5;
        var bx = cxp(x0 + d[0] * .55), by = cyp(y0 + d[1] * .55);
        sparkle(bx, by, "#ffd23f", 16); floatTxt(bx, by - 20, "BONK!", "#d1495b");
        bug = { x: u.clamp(bx, 40, W - 40), y: u.clamp(by, 60, GH - 10), life: 2.4 };
        L.timeout(function () { RQ.audio.sfx("giggle"); }, 250);
        return A.tween(.35, function (k) { S.rx = x0 + d[0] * .4 * (1 - k); S.ry = y0 + d[1] * .4 * (1 - k); });
      }).then(function () { return why; });
    }

    function sprout(x, y, g, big) {
      var s = (.45 + .55 * g) * (1 + big * .9);
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      if (big > .05) { ctx.beginPath(); ctx.arc(0, -18, 11 * big, 0, 7); ctx.fillStyle = "#4cbb5a"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#2a7a35"; ctx.stroke(); }
      ctx.strokeStyle = "#2f8a3e"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke();
      ctx.fillStyle = "#6fd05e";
      ctx.beginPath(); ctx.ellipse(-5, -13, 6, 3, -.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, -15, 6, 3, .5, 0, 7); ctx.fill();
      ctx.restore();
    }
    function draw(dt, t) {
      ctx.fillStyle = "#24612e"; ctx.fillRect(0, 0, W, GH);
      var x, y, k, d;
      for (y = 0; y < M.rows; y++) for (x = 0; x < M.cols; x++) {
        k = x + "," + y; d = deco[k];
        var X = P + x * C, Y = P + y * C, c = M.cell[k];
        if (c === "p") {
          ctx.fillStyle = "#c08a55"; ctx.fillRect(X, Y, C, C);
          ctx.strokeStyle = "#e0c27a"; ctx.lineWidth = 2;
          for (var q = 0; q < 6; q += 2) { var tx = X + 8 + d.tufts[q] * (C - 16), ty = Y + 10 + d.tufts[q + 1] * (C - 20); ctx.beginPath(); ctx.moveTo(tx - 4, ty); ctx.lineTo(tx - 1, ty - 7); ctx.moveTo(tx, ty); ctx.lineTo(tx + 1, ty - 8); ctx.moveTo(tx + 4, ty); ctx.lineTo(tx + 3, ty - 6); ctx.stroke(); }
          if (S.seeded[k]) {
            S.grow[k] = Math.min(1, (S.grow[k] || 0) + dt * 2.2);
            ctx.fillStyle = "rgba(95,170,70,.35)"; ctx.fillRect(X, Y, C, C);
            sprout(X + C * .3, Y + C * .62, S.grow[k], S.party); sprout(X + C * .68, Y + C * .78, S.grow[k], S.party * .8); sprout(X + C * .62, Y + C * .36, S.grow[k], S.party * .9);
          }
        } else if (c === "H") {
          ctx.fillStyle = "#8fc46f"; ctx.fillRect(X, Y, C, C);
        } else {
          ctx.fillStyle = "#2f7d3a"; ctx.fillRect(X, Y, C, C);
          d.blobs.forEach(function (b) { ctx.beginPath(); ctx.arc(X + b.dx * C, Y + b.dy * C, b.r * C, 0, 7); ctx.fillStyle = b.c; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.stroke(); });
        }
      }
      ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 1;
      for (x = 0; x <= M.cols; x++) { ctx.beginPath(); ctx.moveTo(P + x * C, P); ctx.lineTo(P + x * C, P + M.rows * C); ctx.stroke(); }
      for (y = 0; y <= M.rows; y++) { ctx.beginPath(); ctx.moveTo(P, P + y * C); ctx.lineTo(P + M.cols * C, P + y * C); ctx.stroke(); }
      // patch outline (like the polygon from polygonize.py)
      ctx.save(); ctx.setLineDash([9, 6]); ctx.lineDashOffset = -t * 12; ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3.5;
      M.patch.forEach(function (key) {
        var p = key.split(","), px = +p[0], py = +p[1], X = P + px * C, Y = P + py * C;
        function edge(nx, ny, x1, y1, x2, y2) { if (M.cell[nx + "," + ny] !== "p") { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); } }
        edge(px, py - 1, X, Y, X + C, Y); edge(px, py + 1, X, Y + C, X + C, Y + C); edge(px - 1, py, X, Y, X, Y + C); edge(px + 1, py, X + C, Y, X + C, Y + C);
      });
      ctx.restore();
      // home pad
      var hx = cxp(M.home[0]), hy = cyp(M.home[1]);
      ctx.beginPath(); ctx.arc(hx, hy, C * .38, 0, 7); ctx.fillStyle = "#e9eef3"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, C * .3, 0, 7); ctx.strokeStyle = "#ffc53d"; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = INK; ctx.font = "700 26px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("H", hx, hy + 1);
      // giant trees (taller than the drone flies)
      Object.keys(M.trees).forEach(function (key) {
        var p = key.split(","), X = cxp(+p[0]), Y = cyp(+p[1]);
        ctx.beginPath(); ctx.arc(X + 6, Y + 8, C * .5, 0, 7); ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fill();
        ctx.beginPath(); ctx.arc(X, Y, C * .5, 0, 7); ctx.fillStyle = "#1f6b30"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        [[-.18, -.15, .2], [.16, -.1, .18], [0, .17, .2]].forEach(function (b) { ctx.beginPath(); ctx.arc(X + b[0] * C, Y + b[1] * C, b[2] * C, 0, 7); ctx.fillStyle = "#2f8a3e"; ctx.fill(); });
        pill(ctx, X, Y + C * .36, "50 m tall", "#fff", INK, "600 12px Fredoka, sans-serif");
      });
      // particles
      parts = parts.filter(function (p) {
        p.life -= dt;
        if (p.kind === "seed") {
          p.vz -= 520 * dt; p.z += p.vz * dt; p.x += p.vx * dt * (p.z > 0 ? 1 : .2); p.y += p.vy * dt * (p.z > 0 ? 1 : .2);
          if (p.z < 0) { p.z = 0; p.vz = -p.vz * .3; }
          ctx.globalAlpha = Math.min(1, p.life * 2);
          ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 3, 2, 0, 0, 7); ctx.fill();
          ctx.fillStyle = "#8a5a35"; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y - p.z, 3.5 + p.z / 12, 2.6 + p.z / 16, .5, 0, 7); ctx.fill(); ctx.stroke();
        } else {
          p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.globalAlpha = Math.max(0, p.life / .7); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        return p.life > 0;
      });
      // drone + shadow
      S.shake = Math.max(0, S.shake - dt);
      var sx = Math.sin(t * 60) * S.shake * 8, dxp = cxp(S.rx) + sx, dyp = cyp(S.ry), sc = (.82 + .2 * S.alt) * C / 80;
      ctx.beginPath(); ctx.ellipse(dxp + 6 + 8 * S.alt, dyp + 8 + 10 * S.alt, 22 * sc * (1 - .2 * S.alt), 14 * sc * (1 - .2 * S.alt), 0, 0, 7); ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fill();
      drawDrone(ctx, dxp, dyp - 4 * S.alt, S.ang, sc, t, S.alt > .02);
      if (bug) { bug.life -= dt; drawBug(ctx, bug.x, bug.y, .9, t); if (bug.life <= 0) bug = null; }
      floats = floats.filter(function (f) {
        f.life -= dt; f.y -= 34 * dt;
        ctx.globalAlpha = Math.min(1, f.life * 1.6); ctx.font = "700 18px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1;
        return f.life > 0;
      });
      // caption: legend + level note
      ctx.fillStyle = "#fffdf7"; ctx.fillRect(0, GH, W, CAP); ctx.fillStyle = INK; ctx.fillRect(0, GH, W, 3);
      var ly = GH + (cfg.caption ? 21 : CAP / 2 + 1), lx = 16;
      ctx.font = "600 17px Fredoka, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      [["#c08a55", "lost forest: seed it"], ["#2f7d3a", "healthy forest"], ["#e9eef3", "H = home pad"]].forEach(function (lg) {
        ctx.fillStyle = lg[0]; ctx.strokeStyle = INK; ctx.lineWidth = 2; u.rr(ctx, lx, ly - 9, 18, 18, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.fillText(lg[1], lx + 24, ly + 1); lx += 24 + ctx.measureText(lg[1]).width + 22;
      });
      if (cfg.caption) { ctx.fillStyle = "#4a5b6d"; var cap = cfg.caption(); ctx.font = "500 16px Fredoka, sans-serif";
        var cw = ctx.measureText(cap).width; if (cw > W - 30) ctx.font = "500 " + Math.floor(16 * (W - 30) / cw) + "px Fredoka, sans-serif";
        ctx.fillText(cap, 16, GH + 47); }
    }
    return W_;
  }

  /* ================================================================ levels 1-3: code the drone */
  function codeLevel(cfg) {
    return function (L) {
      var M = parseMap(cfg.map), E = editor(L, cfg), Wd = world(L, M, E.view, cfg);
      var steps = null, pc = 0, mode = "edit", busy = false, auto = false, bad = 0, shown = false, wantReset = false;
      function hud() {
        L.hud.set("cov", "🌱 " + Wd.seededCount() + " / " + M.patch.length);
        L.hud.set("blk", "🧱 " + count(E.prog) + " · par " + cfg.par);
      }
      function resetRun() { mode = "edit"; steps = null; pc = 0; Wd.reset(); E.clearMarks(); E.lock(false); hud(); }
      E.onChange = function () { if (!busy && mode !== "edit") resetRun(); hud(); };
      E.hooks.reset = function () { if (busy) { auto = false; wantReset = true; } else { resetRun(); RQ.audio.sfx("whoosh"); } };
      E.hooks.run = function (single) {
        if (busy) { auto = false; return; } // the RUN button is "Stop" while flying
        run(single);
      };
      E.showBtn.onclick = function () {
        if (busy) return;
        shown = true; E.load(build(cfg.solution)); resetRun(); RQ.audio.sfx("powerup");
        L.toast("Here is one solution. Press **RUN** to watch it fly!", "info", 2800);
      };
      async function run(single) {
        if (mode === "done") resetRun();
        if (mode === "edit") {
          if (!E.prog.length) { RQ.audio.sfx("error"); L.toast("Your program is empty! Tap a block to add it.", "info"); return; }
          steps = compile(E.prog, []);
          if (steps.length > MAX_STEPS) { RQ.audio.sfx("error"); L.toast("🔋 Too many steps! The battery would run out. Try smaller repeat numbers.", "bad", 3000); return; }
          pc = 0; mode = "armed"; Wd.reset(); E.clearMarks();
          Wd.setSpeed(steps.length > 30 ? .6 : 1);
          busy = true; E.lock(true);
          await Wd.takeoff();
          if (!L.alive) return;
        }
        busy = true; auto = !single; E.lock(true, single ? "⏳" : "⏹ Stop");
        while (pc < steps.length) {
          var st = steps[pc++];
          E.hi(st.id); if (st.op === "loop") E.lap(st.id, (st.r + 1) + "/" + st.n);
          var res = await Wd.exec(st);
          if (!L.alive) return;
          hud();
          if (res) return finish(res);
          if (!auto || wantReset) break;
        }
        if (wantReset) { wantReset = false; busy = false; resetRun(); return; }
        if (pc >= steps.length) return finish(null);
        busy = false; E.lock(false, "▶ Continue");
      }
      async function finish(res) {
        mode = "done"; E.hi(null);
        if (res) {
          busy = false; E.lock(false);
          if (res === "tree") L.toast("💥 Bonk! That giant Brazil nut tree is taller than the drone flies.", "bad", 3200);
          else L.toast("💥 Bonk! That is the edge of the map, the **geofence**. Drones must stay inside.", "bad", 3200);
          return afterBad();
        }
        var home = Wd.atHome(), n = Wd.seededCount(), all = n === M.patch.length;
        if (home) { await Wd.land(); if (!L.alive) return; }
        if (all && home) return success();
        busy = false; E.lock(false);
        RQ.audio.sfx("giggle");
        if (all) L.toast("🏠 All seeded, but the drone did not come home! End with `return_home()`.", "bad", 3400);
        else L.toast("🌱 " + n + " of " + M.patch.length + " brown squares seeded. Find the missed ones!", "bad", 3400);
        afterBad();
      }
      function afterBad() {
        bad++;
        if (bad === 2) cfg.hint(0);
        else if (bad === 4) { cfg.hint(1); E.showBtn.style.display = ""; }
      }
      async function success() {
        busy = true; E.lock(true);
        RQ.audio.sfx("bloom");
        await Wd.celebrate();
        if (!L.alive) return;
        await L.wait(500);
        if (!L.alive) return;
        var blocks = count(E.prog), S = Wd.S, waste = S.wasted + S.doubles, tidy = waste === 0, compact = blocks <= cfg.par;
        var stars = tidy && compact ? 3 : tidy || compact ? 2 : 1;
        if (shown) stars = Math.min(stars, 2);
        var msg = "Every brown square is seeded and the drone landed home safely!" +
          (tidy ? "" : " Next time, drop seeds only on brown squares, once each.") +
          (compact ? " Super compact code!" : " Can you do it with " + cfg.par + " blocks or fewer?");
        L.win({ stars: stars, msg: msg, stats: { "Seeded": M.patch.length + "/" + M.patch.length, "Home": "landed ✅", "Blocks": blocks + " (par " + cfg.par + ")", "Wasted drops": waste } });
      }
      hud();
      if (L.fails >= 1) cfg.hint(0);
    };
  }

  /* ================================================================ level 4: GPS waypoints + .waypoints file */
  function fmtDeg(v, pos, neg) { return Math.abs(v).toFixed(4) + "° " + (v >= 0 ? pos : neg); }
  function fmtLat(v) { return fmtDeg(v, "N", "S"); }
  function fmtLon(v) { return fmtDeg(v, "E", "W"); }
  function degHTML(v, pos, neg) { var s = Math.abs(v).toFixed(4); return s.slice(0, -2) + "<b>" + s.slice(-2) + "</b>° " + (v >= 0 ? pos : neg); }
  function r4(v) { return Math.round(v * 1e4) / 1e4; }

  function gpsLevel(L) {
    var s = site(), short = SHORT[s.id] || s.name, STEP = 0.0001, NC = 7, NR = 6;
    var latC = r4(s.target_patch.centroid[0]), lonC = r4(s.target_patch.centroid[1]);
    function lonAt(i) { return r4(lonC + (i - 3) * STEP); }
    function latAt(j) { return r4(latC + (2 - j) * STEP); } // row 0 is the most northern
    var j0 = Math.floor(L.rng() * 3), wI = Math.floor(L.rng() * 2), eI = 4 + Math.floor(L.rng() * 3);
    var WP = [[wI, j0], [eI, j0], [eI, j0 + 1], [wI, j0 + 1], [wI, j0 + 2], [eI, j0 + 2]];
    var homeLon = s.mission.home[0], homeLat = s.mission.home[1], alt = s.mission.altitude_m || 20;
    var k = 0, mistakes = 0, wrongHere = 0, glow = false, hover = null, flyT = -1, placed = [], phase = "map";
    // where is home? (metres from the map centre)
    var dN = (homeLat - latC) * 111320, dE = (homeLon - lonC) * 111320 * Math.cos(latC * Math.PI / 180);
    var homeDist = Math.round(Math.hypot(dN, dE) / 10) * 10, homeDir = (dN >= 0 ? "north" : "south") + "-" + (dE >= 0 ? "east" : "west");

    var root = u.el("div", { class: "mc-root" });
    var list = u.el("tbody", {});
    var exportBtn = u.el("button", { class: "btn primary", html: "💾 Export .waypoints", disabled: true });
    var side = u.el("div", { class: "mc-col mc-wide panel" },
      u.el("div", { class: "mc-h", text: "📍 Waypoints · " + short }),
      u.el("p", { class: "mc-note", html: "Tap each spot on the map, <b>in order</b>. Keyboard: arrows + Enter." }),
      u.el("div", { class: "mc-legend" }, u.el("div", { html: "↕ <b>latitude</b> = how far north or south (rows)" }), u.el("div", { html: "↔ <b>longitude</b> = how far east or west (columns)" })),
      u.el("table", { class: "mc-wpt" }, u.el("thead", {}, u.el("tr", {}, u.el("th", { text: "" }), u.el("th", { text: "latitude ↕" }), u.el("th", { text: "longitude ↔" }), u.el("th", { text: "" }))), list),
      exportBtn,
      u.el("div", { class: "mc-home", html: "🏠 Home pad: <code>" + fmtLat(r4(homeLat)) + ", " + fmtLon(r4(homeLon)) + "</code><br>about " + homeDist + " m " + homeDir + " of this map" }));
    var view = u.el("div", { class: "mc-view" });
    root.appendChild(side); root.appendChild(view); L.stage.appendChild(root);
    function renderList() {
      list.innerHTML = "";
      WP.forEach(function (w, n) {
        list.appendChild(u.el("tr", { class: n < k ? "ok" : n === k ? "now" : "" }, u.el("td", {}, u.el("span", { class: "wp", text: "WP" + (n + 1) })),
          u.el("td", { html: degHTML(latAt(w[1]), "N", "S") }), u.el("td", { html: degHTML(lonAt(w[0]), "E", "W") }), u.el("td", { text: n < k ? "✅" : n === k ? "👈" : "" })));
      });
      L.hud.set("wp", "📍 " + k + " / " + WP.length);
    }
    renderList();

    var CW = 800, CH = 600, GX0 = 196, GX1 = 722, GY0 = 70, GY1 = 515, DX = (GX1 - GX0) / (NC - 1), DY = (GY1 - GY0) / (NR - 1);
    var api = L.canvas({ w: CW, h: CH, parent: view, label: "Map with latitude and longitude lines" }), ctx = api.ctx;
    var rng = u.seeded("g22-gps-" + s.id), trees = [];
    for (var n = 0; n < 150; n++) trees.push({ x: rng() * CW, y: rng() * CH, r: 10 + rng() * 14, c: ["#3e9a4a", "#4aad56", "#358c42"][n % 3] });
    function gx(i) { return GX0 + i * DX; }
    function gy(j) { return GY0 + j * DY; }
    var A = animator(L, draw);
    function draw(dt, t) {
      ctx.fillStyle = "#2f7d3a"; ctx.fillRect(0, 0, CW, CH);
      trees.forEach(function (tr) { ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, 7); ctx.fillStyle = tr.c; ctx.fill(); });
      // the lost patch (brown blob around the waypoint rectangle)
      var x0 = gx(wI) - DX * .45, x1 = gx(eI) + DX * .45, y0 = gy(j0) - DY * .45, y1 = gy(j0 + 2) + DY * .45;
      ctx.beginPath();
      for (var a = 0; a <= 64; a++) {
        var th = a / 64 * Math.PI * 2, wob = 1 + Math.sin(th * 5 + 1) * .05 + Math.sin(th * 3) * .04;
        var px = (x0 + x1) / 2 + Math.cos(th) * (x1 - x0) / 2 * 1.08 * wob, py = (y0 + y1) / 2 + Math.sin(th) * (y1 - y0) / 2 * 1.15 * wob;
        if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.fillStyle = "#c08a55"; ctx.fill(); ctx.setLineDash([9, 6]); ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
      // label backdrop strips
      ctx.fillStyle = "#fffdf7"; ctx.fillRect(0, 0, GX0 - 34, CH); ctx.fillRect(0, GY1 + 26, CW, CH - GY1 - 26);
      ctx.fillStyle = INK; ctx.fillRect(GX0 - 37, 0, 3, GY1 + 26); ctx.fillRect(GX0 - 37, GY1 + 26, CW, 3);
      // grid
      var i, j;
      for (i = 0; i < NC; i++) {
        var hotC = (hover && hover[0] === i) || (glow && WP[k] && WP[k][0] === i);
        ctx.strokeStyle = hotC ? "#ffe36e" : "rgba(255,255,255,.45)"; ctx.lineWidth = hotC ? 4 : 2;
        ctx.beginPath(); ctx.moveTo(gx(i), GY0 - 30); ctx.lineTo(gx(i), GY1 + 26); ctx.stroke();
        labelLon(i, gx(i), GY1 + 46, hotC);
      }
      for (j = 0; j < NR; j++) {
        var hotR = (hover && hover[1] === j) || (glow && WP[k] && WP[k][1] === j);
        ctx.strokeStyle = hotR ? "#ffe36e" : "rgba(255,255,255,.45)"; ctx.lineWidth = hotR ? 4 : 2;
        ctx.beginPath(); ctx.moveTo(GX0 - 34, gy(j)); ctx.lineTo(GX1 + 30, gy(j)); ctx.stroke();
        labelLat(j, GX0 - 44, gy(j), hotR);
      }
      for (i = 0; i < NC; i++) for (j = 0; j < NR; j++) { ctx.beginPath(); ctx.arc(gx(i), gy(j), 4, 0, 7); ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fill(); }
      ctx.fillStyle = INK; ctx.font = "700 15px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("latitude", (GX0 - 34) / 2, 20);
      ctx.fillText("longitude, in degrees " + (lonC >= 0 ? "east (E)" : "west (W)"), (GX0 + GX1) / 2, CH - 14);
      ctx.font = "500 13px Fredoka, sans-serif"; ctx.fillStyle = "#4a5b6d";
      ctx.fillText("in degrees " + (latC >= 0 ? "north (N)" : "south (S)"), (GX0 - 34) / 2, 40);
      // north arrow + home arrow
      pill(ctx, GX1 - 6, 26, "N ↑", "#fff", INK, "700 16px Fredoka, sans-serif");
      var hxv = dE / Math.hypot(dE, dN), hyv = -dN / Math.hypot(dE, dN), hcx = (GX0 + GX1) / 2 + hxv * 250, hcy = (GY0 + GY1) / 2 + hyv * 210;
      pill(ctx, u.clamp(hcx, GX0 + 60, GX1 - 60), u.clamp(hcy, GY0 + 10, GY1 + 4), "🏠 home " + homeDist + " m " + (hyv > 0 ? "↓" : "↑") + (hxv > 0 ? "→" : "←"), "#e9f2fc", INK, "600 14px Fredoka, sans-serif");
      // path + pins
      ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 20; ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 5; ctx.beginPath();
      placed.forEach(function (p, m) { if (m) ctx.lineTo(gx(p[0]), gy(p[1])); else ctx.moveTo(gx(p[0]), gy(p[1])); }); ctx.stroke(); ctx.setLineDash([]);
      placed.forEach(function (p, m) {
        p[2] = Math.min(1, p[2] + dt * 4);
        var X = gx(p[0]), Y = gy(p[1]) - 30 * (1 - u.ease.outBack(p[2]));
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.arc(X, Y - 24, 14, Math.PI * .75, Math.PI * .25); ctx.closePath();
        ctx.fillStyle = "#d1495b"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "700 14px Fredoka, sans-serif"; ctx.fillText(String(m + 1), X, Y - 24);
      });
      // the drone flies the finished path
      if (flyT >= 0 && placed.length > 1) {
        flyT += dt * .9;
        var seg = Math.min(placed.length - 1.001, flyT), si = Math.floor(seg), f = seg - si, a1 = placed[si], b1 = placed[si + 1];
        var fx = u.lerp(gx(a1[0]), gx(b1[0]), f), fy = u.lerp(gy(a1[1]), gy(b1[1]), f);
        drawDrone(ctx, fx, fy, Math.atan2(gx(b1[0]) - gx(a1[0]), -(gy(b1[1]) - gy(a1[1]))), .7, t, true);
      }
      if (hover && phase === "map") {
        var hx = gx(hover[0]), hy = gy(hover[1]);
        ctx.beginPath(); ctx.arc(hx, hy, 13, 0, 7); ctx.lineWidth = 4; ctx.strokeStyle = "#ffe36e"; ctx.stroke();
        var tip = fmtLat(latAt(hover[1])) + ", " + fmtLon(lonAt(hover[0]));
        pill(ctx, u.clamp(hx, GX0 + 40, GX1 - 70), hy - 30 < GY0 - 20 ? hy + 30 : hy - 30, tip, "#fff", INK, "600 14px JetBrains Mono, monospace");
      }
    }
    /** Grid label like 9.77|15° with the changing last two digits in bold red, centred on x (or right-aligned). */
    function degLabel(v, x, y, hot, right) {
      var s1 = Math.abs(v).toFixed(4), a = s1.slice(0, -2), b = s1.slice(-2) + "°", fs = s1.length > 7 ? "13px" : "15px";
      ctx.textBaseline = "middle"; ctx.textAlign = "left";
      ctx.font = "400 " + fs + " JetBrains Mono, monospace"; var w1 = ctx.measureText(a).width;
      ctx.font = "700 " + fs + " JetBrains Mono, monospace"; var w2 = ctx.measureText(b).width, x0 = right ? x - w1 - w2 : x - (w1 + w2) / 2;
      if (hot) { ctx.fillStyle = "#ffe36e"; u.rr(ctx, x0 - 5, y - 13, w1 + w2 + 10, 26, 8); ctx.fill(); }
      ctx.fillStyle = "#b0360f"; ctx.fillText(b, x0 + w1, y);
      ctx.font = "400 " + fs + " JetBrains Mono, monospace"; ctx.fillStyle = INK; ctx.fillText(a, x0, y);
    }
    function labelLat(j, x, y, hot) { degLabel(latAt(j), x, y, hot, true); }
    function labelLon(i, x, y, hot) { degLabel(lonAt(i), x, y, hot, false); }
    function nearest(p) {
      var i = Math.round((p.x - GX0) / DX), j = Math.round((p.y - GY0) / DY);
      if (i < 0 || j < 0 || i >= NC || j >= NR) return null;
      return Math.hypot(p.x - gx(i), p.y - gy(j)) < Math.min(DX, DY) * .48 ? [i, j] : null;
    }
    L.on(api.cv, "pointermove", function (e) { if (phase === "map") hover = nearest(api.toLocal(e)); });
    L.on(api.cv, "pointerleave", function () { if (phase === "map") hover = null; });
    L.on(api.cv, "pointerdown", function (e) { var h = nearest(api.toLocal(e)); if (h) { hover = h; place(h[0], h[1]); } });
    L.on(window, "keydown", function (e) {
      if (phase !== "map" || document.querySelector(".rq-overlay, .rq-talk")) return;
      var mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (mv) { e.preventDefault(); hover = hover || [3, 2]; hover = [u.clamp(hover[0] + mv[0], 0, NC - 1), u.clamp(hover[1] + mv[1], 0, NR - 1)]; RQ.audio.sfx("tick"); }
      else if ((e.key === "Enter" || e.key === " ") && hover && !(e.target && e.target.tagName === "BUTTON")) { e.preventDefault(); place(hover[0], hover[1]); }
    });
    function place(i, j) {
      if (phase !== "map" || k >= WP.length) return;
      var w = WP[k];
      if (i === w[0] && j === w[1]) {
        placed.push([i, j, 0]); k++; wrongHere = 0; glow = false; RQ.audio.sfx("pop");
        renderList();
        if (k === WP.length) allPlaced();
        return;
      }
      mistakes++; wrongHere++; RQ.audio.sfx("error");
      var why = [];
      if (j !== w[1]) why.push(j < w[1] ? "too far north" : "too far south");
      if (i !== w[0]) why.push(i < w[0] ? "too far west" : "too far east");
      L.toast("That spot is " + why.join(" and ") + ". Check the " + (j !== w[1] ? "latitude" : "longitude") + " numbers!", "bad", 2600);
      if (wrongHere === 2) { glow = true; L.say("tuki", "💡 Find the latitude on the left side first. Then slide along that row to the right longitude at the bottom.", { mood: "think" }); }
    }
    async function allPlaced() {
      phase = "fly"; hover = null; flyT = 0; RQ.audio.sfx("good");
      await L.wait(2600);
      if (!L.alive) return;
      await L.say("koa", "All six waypoints placed! It's the same **lawnmower** path, written in GPS numbers.", { mood: "happy" });
      if (!L.alive) return;
      exportBtn.disabled = false; exportBtn.classList.add("pulse");
      L.toast("Press **💾 Export .waypoints**!", "info", 2600);
    }
    exportBtn.onclick = function () { if (phase === "fly" && !exportBtn.disabled) showFile(); };

    function fileLines() {
      var f8 = function (v) { return v.toFixed(8); }, altS = Number.isInteger(alt) ? alt.toFixed(1) : String(alt), i = 1;
      var rows = ["QGC WPL 110", "0\t1\t0\t16\t0\t0\t0\t0\t" + f8(homeLat) + "\t" + f8(homeLon) + "\t0\t1",
        i + "\t0\t3\t22\t0\t0\t0\t0\t" + f8(homeLat) + "\t" + f8(homeLon) + "\t" + altS + "\t1"];
      WP.forEach(function (w) {
        i++; rows.push(i + "\t0\t3\t16\t0\t0\t0\t0\t" + f8(latAt(w[1])) + "\t" + f8(lonAt(w[0])) + "\t" + altS + "\t1");
        i++; rows.push(i + "\t0\t3\t183\t9\t1900\t0\t0\t0\t0\t0\t1");
      });
      i++; rows.push(i + "\t0\t3\t20\t0\t0\t0\t0\t0\t0\t0\t1");
      return rows;
    }
    async function showFile() {
      phase = "file"; A.stop(); root.remove();
      var lines = fileLines(), fname = s.id + "_practice.waypoints", q = 0, wp = 0;
      var MEAN = { 16: "📍 fly to this waypoint", 22: "🛫 take off to " + alt + " m", 183: "🌰 servo 9 → 1900: open the seed hatch", 20: "↩️ return to launch (home)" };
      var qEl = u.el("div", { class: "mc-q", html: "🌰 Tap a line that <b>opens the seed hatch</b>. Use the key!" });
      var table = u.el("table", { class: "mc-table" });
      var head = u.el("tr", {});
      ["#", "CUR", "FRAME", "CMD", "P1", "P2", "P3", "P4", "LAT", "LON", "ALT", "AUTO", "what it means"].forEach(function (h, c) { head.appendChild(u.el("th", { text: h, class: c === 12 ? "mean-h" : "" })); });
      table.appendChild(u.el("thead", {}, head));
      var tb = u.el("tbody", {});
      tb.appendChild(u.el("tr", { class: "hdr" }, u.el("td", { colspan: "12", text: lines[0] + "    ← file type: QGC waypoint list, version 110" }), u.el("td", { class: "mean", text: "" })));
      lines.slice(1).forEach(function (ln) {
        var cells = ln.split("\t"), cmd = +cells[3];
        if (cmd === 16 && cells[0] !== "0") wp++;
        var meaning = cells[0] === "0" ? "🏠 home position" : cmd === 16 ? "📍 fly to WP" + wp : MEAN[cmd];
        var tr = u.el("tr", { class: "wrow c" + cmd, tabindex: "0", "aria-label": "Line " + cells[0] + ", command " + cmd });
        cells.forEach(function (c, n) { tr.appendChild(u.el("td", { class: n === 3 ? "cmd" : "", text: c })); });
        tr.appendChild(u.el("td", { class: "mean", text: "" }));
        tr.dataset.mean = meaning;
        tr.onclick = function () { pickRow(tr, cmd, cells[0]); };
        tr.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickRow(tr, cmd, cells[0]); } };
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      var blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain" });
      var dl = u.el("a", { class: "btn small", href: URL.createObjectURL(blob), download: fname, html: "⬇ Download practice file" });
      var finishBtn = u.el("button", { class: "btn go", html: "Finish mission ▶", style: { display: "none" }, onclick: function () { done(); } });
      var box = u.el("div", { class: "mc-file" },
        u.el("div", { class: "bar" }, u.el("span", { class: "fname", text: "📄 " + fname }), u.el("span", { class: "practice", text: "PRACTICE FILE · do not fly" }),
          u.el("span", { class: "grow" }), dl, finishBtn),
        qEl,
        u.el("div", { class: "mc-key", html: "<b>CMD key:</b> <span class='k22'>22 = take off</span><span class='k16'>16 = fly to a waypoint</span>" +
          "<span class='k183'>183 = move a servo (P1 = servo number, P2 = position)</span><span class='k20'>20 = return to launch</span>" }),
        u.el("div", { class: "mc-tablewrap" }, table));
      L.stage.appendChild(box);
      L.hud.set("wp", null);
      await L.say("koa", "This file holds flight instructions for drone-control software. Each row is one command, and **CMD** says which kind.");
      if (!L.alive) return;
      function pickRow(tr, cmd, idx) {
        if (q > 1) return;
        var want = q === 0 ? 183 : 20;
        if (cmd === want) {
          RQ.audio.sfx("good"); tr.classList.add("yes");
          q++;
          if (q === 1) qEl.innerHTML = "🏠 Now tap the line that <b>brings the drone home</b>.";
          else reveal();
        } else {
          mistakes++; RQ.audio.sfx("error"); tr.classList.add("no");
          L.timeout(function () { tr.classList.remove("no"); }, 600);
          L.toast("Line " + idx + " is command **" + cmd + "**. Look at the key!", "bad", 2200);
        }
      }
      async function reveal() {
        u.$$("tr.wrow", tb).forEach(function (tr) { tr.lastChild.textContent = tr.dataset.mean; });
        qEl.innerHTML = "✅ You can read a drone mission file! Every 📍 point has a 🌰 seed drop, then the drone flies home.";
        await L.say("koa", "Brilliant! ReSeed writes files like this for each patch, with thousands of seed drops.", { mood: "happy" });
        if (!L.alive) return;
        finishBtn.style.display = ""; finishBtn.classList.add("pulse"); finishBtn.focus();
      }
      function done() {
        var stars = mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1;
        L.win({ stars: stars, msg: "You turned the lawnmower path into GPS waypoints and read a real-looking **.waypoints** mission file.",
          stats: { "Waypoints": WP.length + "/" + WP.length, "Mistakes": mistakes, "Site": short } });
      }
    }
  }

  /* ================================================================ level 5: demo-day script */
  var DEMO = [
    { icon: "⬆️", text: "Arm + take off to 1.5 m", real: 4.0 },
    { icon: "↗️", text: "Fly towards (+1 m, +1 m) at 1.2 m/s", real: .88 },
    { icon: "⏪", text: "JERK BACK: reverse at 1.5 m/s for 0.35 s", real: .35 },
    { icon: "⏸️", text: "Hold, then return to (0, 0)", real: 3.0 },
    { icon: "⬇️", text: "Land", real: 2.0 }
  ];
  var DRY_RUN = [
    "t= 0.00s  arm + take off",
    "t= 4.00s  fly towards (+1.0 m, +1.0 m) at 1.2 m/s",
    "t= 4.88s  JERK BACK: reverse to 1.5 m/s for 0.35 s - seeds exit the roll",
    "t= 5.23s  hold, then return to (0, 0)",
    "t= 8.23s  land",
    "predicted acorn landing (m from jerk point): {'centroid_m': [0.57, 0.61], 'blast_radius_m': 0.2}",
    "dry run: nothing sent.",
    "[y]# Real flights need a trained adult pilot and safety checks:[/y]",
    "[y]# test in the ArduPilot simulator (SITL) first, fly in a netted hall or open field,[/y]",
    "[y]# and keep a safety pilot on the remote with a kill switch.[/y]"
  ];

  function demoLevel(L) {
    var slots = [null, null, null, null, null], pile = u.shuffle([0, 1, 2, 3, 4], L.rng), tries = 0, busy = false;
    if (pile.join() === "0,1,2,3,4") pile.reverse();
    var root = u.el("div", { class: "mc-root" });
    var slotsEl = u.el("div", { class: "mc-slots" }), pileEl = u.el("div", { class: "mc-pile", "aria-label": "Shuffled steps" });
    var flyBtn = u.el("button", { class: "btn go big", html: "🚁 Fly demo", disabled: true });
    var side = u.el("div", { class: "mc-col mc-demo panel" },
      u.el("p", { class: "mc-note", html: "Put the 5 steps in the right order. <b>Tap</b> a step to move it, or <b>drag</b> it." }),
      u.el("div", { class: "mc-two" },
        u.el("div", { class: "mc-c" }, u.el("div", { class: "mc-h", text: "🔀 Shuffled steps" }), pileEl),
        u.el("div", { class: "mc-c" }, u.el("div", { class: "mc-h", text: "🎬 Flight script" }), slotsEl)),
      flyBtn);
    var view = u.el("div", { class: "mc-view demo" });
    root.appendChild(side); root.appendChild(view); L.stage.appendChild(root);
    L.hud.set("try", "🎬 Try " + (tries + 1));

    function card(idx) {
      var st = DEMO[idx];
      var b = u.el("button", { class: "mc-step", dataset: { k: idx } }, u.el("span", { class: "ic", text: st.icon }), u.el("span", { text: st.text }));
      b.addEventListener("pointerdown", function (e) { if (!busy && !(e.button > 0)) drag = { idx: idx, el: b, x0: e.clientX, y0: e.clientY, on: false }; });
      b.addEventListener("click", function (e) { if (e.detail === 0) tapCard(idx); });
      return b;
    }
    function render() {
      slotsEl.innerHTML = ""; pileEl.innerHTML = "";
      slots.forEach(function (c, n) {
        var hole = u.el("div", { class: "hole" + (c != null ? " full" : "") }, c != null ? card(c) : "drop a step here");
        slotsEl.appendChild(u.el("div", { class: "mc-sl", dataset: { s: n } }, u.el("span", { class: "n", text: String(n + 1) }), hole));
      });
      pile.forEach(function (c) { pileEl.appendChild(card(c)); });
      if (!pile.length) pileEl.appendChild(u.el("div", { class: "mc-note", style: { textAlign: "center", padding: "10px" }, text: "All steps placed. Ready to fly!" }));
      flyBtn.disabled = busy || slots.indexOf(null) >= 0;
      flyBtn.classList.toggle("pulse", !flyBtn.disabled);
    }
    function takeOut(idx) {
      var s = slots.indexOf(idx); if (s >= 0) { slots[s] = null; return { slot: s }; }
      var p = pile.indexOf(idx); if (p >= 0) pile.splice(p, 1);
      return { pile: true };
    }
    function moveTo(idx, dest) { // dest: slot index or "pile"
      var from = takeOut(idx);
      if (dest === "pile") pile.push(idx);
      else {
        var other = slots[dest];
        slots[dest] = idx;
        if (other != null) { if (from.slot != null) slots[from.slot] = other; else pile.push(other); }
      }
      RQ.audio.sfx("snap"); clearMarks(); render();
    }
    function tapCard(idx) {
      if (busy) return;
      if (slots.indexOf(idx) >= 0) moveTo(idx, "pile");
      else { var free = slots.indexOf(null); if (free >= 0) moveTo(idx, free); }
    }
    var drag = null, ghost = null;
    L.on(window, "pointermove", function (e) {
      if (!drag) return;
      if (!drag.on) {
        if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 9) return;
        drag.on = true; var r = drag.el.getBoundingClientRect();
        ghost = drag.el.cloneNode(true); ghost.classList.add("mc-ghost"); ghost.style.width = r.width + "px";
        drag.ox = drag.x0 - r.left; drag.oy = drag.y0 - r.top; document.body.appendChild(ghost); drag.el.style.opacity = ".3";
      }
      e.preventDefault(); ghost.style.left = (e.clientX - drag.ox) + "px"; ghost.style.top = (e.clientY - drag.oy) + "px";
    });
    L.on(window, "pointerup", function (e) {
      if (!drag) return;
      var d = drag; drag = null;
      if (!d.on) { tapCard(d.idx); return; }
      if (ghost) { ghost.remove(); ghost = null; }
      d.el.style.opacity = "";
      var el = document.elementFromPoint(e.clientX, e.clientY), sl = el && el.closest && el.closest(".mc-sl");
      if (sl) moveTo(d.idx, +sl.dataset.s);
      else if (el && el.closest && el.closest(".mc-pile")) moveTo(d.idx, "pile");
      else render();
    });
    L.done.then(function () { if (ghost) ghost.remove(); });
    function mark(n, cls) { var el = slotsEl.children[n]; if (el) { el.classList.remove("now", "ok", "bad"); if (cls) el.classList.add(cls); } }
    function clearMarks() { for (var n = 0; n < 5; n++) mark(n, null); }

    /* ---- the test field (top view, metres) ---- */
    var CW = 640, CH = 560, OX = 150, OY = 420, SC = 150;
    var api = L.canvas({ w: CW, h: CH, parent: view, label: "Demo flight test field" }), ctx = api.ctx;
    function mx(x) { return OX + x * SC; }
    function my(y) { return OY - y * SC; }
    var D, bug = null, banner = "Order the script, then press Fly demo", clock = 0;
    function resetD() { D = { x: 0, y: 0, alt: 0, air: false, moving: false, thrown: false, seeds: [], wob: 0, shake: 0 }; clock = 0; }
    resetD();
    var A = animator(L, function (dt, t) {
      ctx.fillStyle = "#cfe3b4"; ctx.fillRect(0, 0, CW, CH);
      ctx.strokeStyle = "rgba(29,43,58,.12)"; ctx.lineWidth = 1;
      for (var g = -1; g <= 6; g++) { ctx.beginPath(); ctx.moveTo(mx(g / 2), 0); ctx.lineTo(mx(g / 2), CH); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, my(g / 2)); ctx.lineTo(CW - 80, my(g / 2)); ctx.stroke(); }
      ctx.setLineDash([6, 6]); ctx.strokeStyle = "#5a6b7d"; ctx.lineWidth = 3; ctx.strokeRect(mx(-.7), my(2.3), 3.0 * SC, 3.0 * SC); ctx.setLineDash([]);
      ctx.fillStyle = "#5a6b7d"; ctx.font = "600 13px Fredoka, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("safety net", mx(-.66), my(2.24));
      // axes
      ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(mx(0), my(0)); ctx.lineTo(mx(1.9), my(0)); ctx.moveTo(mx(0), my(0)); ctx.lineTo(mx(0), my(1.9)); ctx.stroke();
      ctx.font = "600 14px Fredoka, sans-serif"; ctx.fillText("x → east", mx(1.55), my(0) + 16); ctx.fillText("y ↑ north", mx(0) + 8, my(1.9));
      for (var m = 1; m <= 1; m++) { ctx.fillText(m + " m", mx(m) - 10, my(0) + 34); }
      // target mat (+1, +1) and start pad
      [26, 17, 8].forEach(function (r, n) { ctx.beginPath(); ctx.arc(mx(1), my(1), r, 0, 7); ctx.fillStyle = n % 2 ? "#fff" : "#e0752d"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); });
      pill(ctx, mx(1) + 64, my(1) + 34, "(+1 m, +1 m)", "#fff", INK, "600 13px Fredoka, sans-serif");
      ctx.beginPath(); ctx.arc(mx(0), my(0), 30, 0, 7); ctx.fillStyle = "#e9eef3"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = INK; ctx.font = "700 22px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.fillText("H", mx(0), my(0) + 1);
      pill(ctx, mx(0) - 6, my(0) + 48, "start (0, 0)", "#fff", INK, "600 13px Fredoka, sans-serif");
      // seeds
      D.seeds.forEach(function (s) {
        var x = mx(s.x), y = my(s.y);
        ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(x, y, 4, 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#8a5a35"; ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y - s.h * 40, 4.5 + s.h * 3, 3.5 + s.h * 2, .6, 0, 7); ctx.fill(); ctx.stroke();
      });
      // drone
      D.shake = Math.max(0, D.shake - dt);
      var sh = Math.sin(t * 60) * D.shake * 6, dx = mx(D.x) + sh, dy = my(D.y), sc = .72 + .25 * D.alt / 1.5;
      ctx.beginPath(); ctx.ellipse(dx + 6 + D.alt * 14, dy + 8 + D.alt * 18, 24 * sc, 15 * sc, 0, 0, 7); ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fill();
      drawDrone(ctx, dx, dy - D.alt * 6, Math.PI / 4 + Math.sin(t * 30) * D.wob, sc, t, D.air || D.alt > .01);
      if (bug) { bug.life -= dt; drawBug(ctx, bug.x, bug.y, .9, t); if (bug.life <= 0) bug = null; }
      // altitude gauge
      var GX = CW - 46, G0 = 470, G1 = 170, gpx = (G0 - G1) / 2;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, GX - 14, G1 - 10, 28, G0 - G1 + 20, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#2b7bd0"; u.rr(ctx, GX - 8, G0 - D.alt * gpx, 16, D.alt * gpx, 6); ctx.fill();
      ctx.fillStyle = INK; ctx.font = "600 13px Fredoka, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("height", GX, G1 - 26); ctx.fillText(D.alt.toFixed(1) + " m", GX, G0 + 24);
      ctx.beginPath(); ctx.moveTo(GX - 18, G0 - 1.5 * gpx); ctx.lineTo(GX + 18, G0 - 1.5 * gpx); ctx.strokeStyle = "#d1495b"; ctx.lineWidth = 2; ctx.stroke();
      // banner + clock
      ctx.fillStyle = "rgba(255,253,247,.95)"; ctx.fillRect(0, 0, CW, 44); ctx.fillStyle = INK; ctx.fillRect(0, 44, CW, 3);
      ctx.font = "600 17px Fredoka, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(banner, 14, 23);
      ctx.textAlign = "right"; ctx.font = "600 16px JetBrains Mono, monospace"; ctx.fillText("t = " + clock.toFixed(2) + " s", CW - 12, 23);
    });
    function tw(d, fn) { return A.tween(d, fn); }
    function realClock(from, add) { return function (k) { clock = from + add * k; }; }
    function both(a, b) { return function (k) { a(k); b(k); }; }
    async function doStep(idx) {
      var c0 = clock, real = DEMO[idx].real;
      banner = DEMO[idx].icon + " " + DEMO[idx].text;
      if (idx === 0) {
        if (D.air) { D.moving = false; return null; }
        D.air = true; RQ.audio.sfx("engine");
        await tw(1.3, both(function (k) { D.alt = 1.5 * u.ease.outCubic(k); }, realClock(c0, real)));
        D.moving = false; return null;
      }
      if (idx === 1) {
        if (!D.air) {
          RQ.audio.sfx("buzz");
          await tw(.5, function (k) { var e = Math.sin(k * Math.PI) * .12; D.x = e; D.y = e; D.shake = .3; });
          return "ground-fly";
        }
        var x0 = D.x, y0 = D.y; RQ.audio.sfx("whoosh");
        await tw(1.4, both(function (k) { D.x = u.lerp(x0, .75, k); D.y = u.lerp(y0, .75, k); }, realClock(c0, real)));
        D.moving = true; return null;
      }
      if (idx === 2) {
        if (!D.air || !D.moving) {
          spill(D.x, D.y, D.air ? 1 : .15);
          await tw(.9, function (k) { D.seeds.forEach(function (s) { s.h = s.h0 * (1 - k * k); s.x = u.lerp(s.sx, s.tx, k); s.y = u.lerp(s.sy, s.ty, k); }); D.wob = D.air ? 0 : .3 * (1 - k); });
          return D.air ? "still-jerk" : "ground-jerk";
        }
        banner = "⏪ JERK BACK! (slow motion)"; RQ.audio.sfx("zap");
        var jx = D.x, jy = D.y, back = 1.5 * .35 / Math.SQRT2;
        D.seeds = [];
        for (var n = 0; n < 18; n++) {
          var a = L.rng() * Math.PI * 2, r = Math.sqrt(L.rng()) * .2;
          D.seeds.push({ sx: jx, sy: jy, x: jx, y: jy, tx: jx + .57 + Math.cos(a) * r, ty: jy + .61 + Math.sin(a) * r, h0: 1.5, h: 1.5 });
        }
        await tw(1.2, both(function (k) {
          var e = u.ease.outCubic(Math.min(1, k * 1.6)); D.x = jx - back * e; D.y = jy - back * e;
          D.seeds.forEach(function (s) { s.x = u.lerp(s.sx, s.tx, k); s.y = u.lerp(s.sy, s.ty, k); s.h = 1.5 * (1 - k * k); });
        }, realClock(c0, real)));
        RQ.audio.sfx("splash"); D.thrown = true; D.moving = false; return null;
      }
      if (idx === 3) {
        if (!D.air) { await tw(.6, function (k) { D.wob = .35 * Math.sin(k * Math.PI); }); D.wob = 0; return "ground-return"; }
        var hx = D.x, hy = D.y;
        await tw(.4, realClock(c0, 1));
        RQ.audio.sfx("whoosh");
        await tw(1.3, both(function (k) { var e = u.ease.inOut(k); D.x = hx * (1 - e); D.y = hy * (1 - e); }, realClock(c0 + 1, real - 1)));
        D.moving = false; return null;
      }
      if (!D.air) return null;
      await tw(1.1, both(function (k) { D.alt = 1.5 * (1 - k); }, realClock(c0, real)));
      D.air = false; D.moving = false; RQ.audio.sfx("pop");
      return null;
    }
    function spill(x, y, h) {
      D.seeds = [];
      for (var n = 0; n < 14; n++) { var a = L.rng() * 7, r = L.rng() * .12; D.seeds.push({ sx: x, sy: y, x: x, y: y, tx: x + Math.cos(a) * r, ty: y + Math.sin(a) * r, h0: h, h: h }); }
      RQ.audio.sfx("drop");
    }
    var FAIL = {
      "ground-fly": "💥 Scrape! The drone tried to fly while still sitting on the floor. Take off first!",
      "ground-jerk": "The drone wiggled on the floor and the seeds spilled out on the pad.",
      "still-jerk": "Plop, the seeds just dropped straight down! ReSeed's script jerks right after flying forward, so they shoot ahead.",
      "ground-return": "The drone is sitting on the floor. It cannot fly home from there.",
      "far": "The seeds flew, but the drone landed far away from the start pad!"
    };
    flyBtn.onclick = async function () {
      if (busy || slots.indexOf(null) >= 0) return;
      busy = true; tries++; resetD(); bug = null; clearMarks(); render();
      L.hud.set("try", "🎬 Try " + tries);
      for (var n = 0; n < 5; n++) {
        mark(n, "now");
        var res = await doStep(slots[n]);
        if (!L.alive) return;
        if (res) { mark(n, "bad"); return failed(res, n); }
        mark(n, "ok");
      }
      if (!D.thrown || D.air || Math.hypot(D.x, D.y) > .05) return failed("far", 4);
      success();
    };
    async function failed(res, at) {
      banner = "Oops! Fix the order and try again.";
      bug = { x: mx(D.x) + 40, y: my(D.y) - 10, life: 2.6 }; RQ.audio.sfx("giggle");
      L.toast(FAIL[res] || FAIL.far, "bad", 3600);
      await L.wait(2200);
      if (!L.alive) return;
      busy = false; resetD(); banner = "Change the order, then press Fly demo"; render(); mark(at, "bad");
      if (tries === 2) L.say("sprout", "💡 In this demo, take off before flying across the field. Put the jerk right after flying forward, like ReSeed's script.", { mood: "think" });
    }
    async function success() {
      banner = "🎯 Seeds landed about 0.8 m past the jerk point!";
      RQ.audio.sfx("good");
      await L.wait(1200);
      if (!L.alive) return;
      var wrap = u.el("div", { class: "mc-termwrap" }); view.appendChild(wrap);
      var term = RQ.term.mount(wrap, { user: "koa", host: "demo-day", cwd: "~/reseed", title: "koa@demo-day: ~/reseed (the real script, dry run)" });
      term.print("[g]koa@demo-day[/g]:[b]~/reseed[/b]$ python -m reseed.demo_flight --dry-run");
      await term.printSlow(DRY_RUN, 380);
      if (!L.alive) return;
      await L.say("koa", "Same order as the real script! **GUIDED** mode lets the program steer the drone, and **LAND** tells it to land.", { mood: "happy" });
      if (!L.alive) return;
      var stars = tries <= 1 ? 3 : tries === 2 ? 2 : 1;
      L.win({ stars: stars, msg: "Take off, fly, **jerk back**, return, land. The seeds kept flying forward when the drone stopped: that is **inertia**!",
        stats: { "Tries": tries, "Flight time": "8.23 s + landing" } });
    }
    render();
  }

  /* ================================================================ level configs + game */
  var L1 = { map: ["........", ".H.ppp..", "........", "........"], dir: 1, par: 7, tools: ["fwd", "drop", "home"],
    solution: [["fwd", 2], "drop", ["fwd", 1], "drop", ["fwd", 1], "drop", "home"],
    hint: function (n) {
      if (n === 0) return RQ.ui.say("sprout", "💡 `forward(2)` takes me to the first brown square. Then `drop()`, `forward(1)`, `drop()` and so on.", { mood: "think" });
      return RQ.ui.say("sprout", "💡 Don't forget the last block: `return_home()` brings me back to the H pad.", { mood: "think" });
    } };
  var L2 = { map: [".........", ".H.ppT...", "....p....", "....p..T.", "........."], dir: 1, par: 10, tools: ["fwd", "left", "right", "drop", "home"],
    solution: [["fwd", 2], "drop", ["fwd", 1], "drop", "right", ["fwd", 1], "drop", ["fwd", 1], "drop", "home"],
    hint: function (n) {
      if (n === 0) return RQ.ui.say("sprout", "💡 Seed the two squares in the top row first. Then `turn_right()` to face down the patch.", { mood: "think" });
      return RQ.ui.say("sprout", "💡 After the turn, use `forward(1)` and `drop()` twice. Finish with `return_home()`.", { mood: "think" });
    } };
  var L3 = { map: [".........", ".Hppppp..", "..ppppp..", "..ppppp..", "..ppppp..", ".........", "........."], dir: 1, par: 16,
    tools: ["fwd", "left", "right", "drop", "rep", "home"],
    solution: [["rep", 2, [["rep", 5, [["fwd", 1], "drop"]], ["fwd", 1], "right", ["fwd", 1], "right", ["rep", 5, [["fwd", 1], "drop"]], ["fwd", 1], "left", ["fwd", 1], "left"]], "home"],
    caption: function () {
      var s = site(), sw = (s.mission && s.mission.swath_m) || 2.2563;
      return "1 square = 1 swath (game version). Real " + (SHORT[s.id] || s.name) + " plan: " + sw.toFixed(2) + " m swath, " + u.fmt(s.mission.releases || 0) + " seed drops.";
    },
    hint: function (n) {
      if (n === 0) return RQ.ui.say("sprout", "💡 Try `repeat 5:` with `forward(1)` and `drop()` inside. That seeds a whole line!", { mood: "think" });
      return RQ.ui.say("sprout", "💡 To turn around: `forward(1)`, `turn_right()`, `forward(1)`, `turn_right()`. The next line goes back the other way.", { mood: "think" });
    } };

  RQ.game({
    id: "g22",
    music: "sky",
    intro: [
      ["koa", "G'day, I'm Koa! Our seed drone can fly a whole mission by itself, if we give it a **program**."],
      ["sprout", "A program is a list of steps for me. Snap the blocks together, press **RUN**, and I fly them!"]
    ],
    outro: [
      ["koa", "Loops, turns, GPS waypoints and a real demo flight. You're a true mission coder!"],
      ["sprout", "Next, let's see what grows back. Regrow Rescue is waiting!"]
    ],
    levels: [
      { title: "Straight line", goal: "Seed all 3 brown squares, then come home",
        intro: [["koa", "Tap blocks or drag them into **Your program**. `forward(n)` flies n squares and `drop()` drops seeds."],
                ["koa", "Seed every brown square, then end with `return_home()`. Then press **RUN**!"]],
        cards: ["mc-algorithm"],
        play: codeLevel(L1) },
      { title: "Turn the corner", goal: "Seed the L-shaped patch without bonking the giant tree",
        intro: [["koa", "This patch has a corner, and a giant Brazil nut tree blocks the way. Time to turn!"],
                ["sprout", "`turn_left()` and `turn_right()` turn me on the spot. Watch the yellow arrow on my nose."]],
        cards: ["mc-debugging"],
        play: codeLevel(L2) },
      { title: "Lawnmower loops", goal: "Seed all 20 squares with lawnmower lines",
        intro: [["koa", "Real seed drones fly a **lawnmower** path: straight lines one **swath** apart, back and forth."],
                ["pix", "Put blocks inside `repeat n:` and the drone does them n times. A repeat can even go inside another repeat!"]],
        cards: ["mc-loop", "mc-lawnmower"],
        play: codeLevel(L3) },
      { title: "GPS waypoints", goal: "Tap the 6 waypoints in order, then export the file",
        intro: [["tuki", "Real drones can use **GPS** to find their way beyond our game grid. Every spot on Earth has a **latitude** and a **longitude**."],
                ["koa", "Tap the waypoints on the map in order. Then we save the flight as a `.waypoints` file!"]],
        cards: ["mc-waypoints"],
        play: gpsLevel },
      { title: "Demo day", goal: "Put the demo flight script in order and fly it",
        intro: [["koa", "Demo day! The real ReSeed test flight hops 1 metre, then **jerks back** so the seeds fly out."],
                ["sprout", "Oh no, the steps got shuffled! Put the flight script in order, then press **Fly demo**."]],
        cards: ["mc-jerk-back"],
        play: demoLevel }
    ]
  });
})();
