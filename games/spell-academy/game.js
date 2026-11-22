/* g14 Spell Academy — Python through spells. Professor Hoot's spellbook: the code is on the left page, the crystal ball
 * (output), the memory jars (variables) and the question on the right page.
 * Formats: predict → run (trace the spell line by line) → repair (Glitch Bug hides in a line), fill-the-blanks, Parsons.
 * L1 variables, numbers, strings, print · L2 functions: ndvi() · L3 if/elif/else: health_class() + fix-the-bug
 * L4 for loops, lists, dicts (real Ozarks NDVI, BIOMES) · L5 challenge: @dataclass Drone with fly(minutes).
 * Outputs are precomputed (no Python runs in the page). Facts: reseed/acquire.py, ndvi.py, species.py, logistics.py. */
(function () {
  "use strict";
  var u = RQ.u;

  function hasDialog() { return !!document.querySelector(".rq-overlay, .rq-talk"); }
  function keys1(L, fn) { var w = L.on(window, "keydown", fn); return function () { window.removeEventListener("keydown", w); }; }

  /* ================================================================ the spellbook UI */
  function book(L) {
    var root = u.el("div", { class: "sa-book" });
    var left = u.el("div", { class: "sa-page l" }), right = u.el("div", { class: "sa-page r" });
    root.appendChild(left); root.appendChild(right); L.stage.appendChild(root);
    var head = u.el("div", { class: "sa-head" }), goal = u.el("div", { class: "sa-goal" });
    var scroll = u.el("div", { class: "sa-scroll" }), act = u.el("div", { class: "sa-row" });
    left.appendChild(head); left.appendChild(goal); left.appendChild(scroll); left.appendChild(act);
    var ball = u.el("div", { class: "sa-ball", "aria-live": "polite" }), out = u.el("div", { class: "sa-out" });
    ball.appendChild(out);
    right.appendChild(u.el("div", { class: "sa-ballwrap" }, ball, u.el("div", { class: "sa-stand" })));
    var think = u.el("div", { class: "sa-think" }), mem = u.el("div", { class: "sa-mem" }), err = u.el("pre", { class: "sa-err", style: { display: "none" } });
    var q = u.el("div", { class: "sa-q" }), opts = u.el("div", { class: "sa-opts" }), row = u.el("div", { class: "sa-row" });
    right.appendChild(think); right.appendChild(err); right.appendChild(mem); right.appendChild(q); right.appendChild(opts); right.appendChild(row);
    var hoot = u.el("div", { class: "sa-hoot" }); right.appendChild(hoot);
    var B = { L: L, root: root, left: left, right: right, scroll: scroll, act: act, ball: ball, out: out, q: q, opts: opts, row: row, jars: {} };
    B.mood = function (m) { hoot.innerHTML = RQ.chars ? RQ.chars.svg("hoot", { mood: m }) : ""; };
    B.mood("think");
    B.head = function (i, n, title) { head.innerHTML = '<span class="chip">🪄 Spell ' + i + " / " + n + "</span> " + u.esc(title); L.hud.set("spell", "🪄 " + i + " / " + n); };
    B.goal = function (md) { goal.innerHTML = md ? RQ.ui.md(md) : ""; };
    B.ask = function (md) { q.innerHTML = md ? RQ.ui.md(md) : ""; };
    B.think = function (txt) { think.innerHTML = txt ? "🔎 <b>" + u.esc(txt) + "</b>" : ""; };
    B.ballQ = function () { ball.classList.remove("err", "swirl"); err.style.display = "none"; out.innerHTML = '<span class="q">?</span>'; };
    B.clearOut = function () { ball.classList.remove("err"); err.style.display = "none"; out.innerHTML = ""; };
    B.print = function (line) {
      String(line).split("\n").forEach(function (l) { out.appendChild(u.el("div", { text: l || " " })); });
      while (out.children.length > 1 && out.scrollHeight > out.clientHeight + 2) out.removeChild(out.firstChild);
    };
    B.error = function (text) {
      ball.classList.remove("swirl"); ball.classList.add("err"); out.innerHTML = '<span class="q">⚠️</span>';
      err.textContent = text.replace(/\n(?=[a-z'])/g, " "); err.style.display = "";
    };
    B.memReset = function () { mem.innerHTML = "<small>🧠 Memory:</small>"; B.jars = {}; };
    B.memSet = function (name, val) {
      var j = B.jars[name];
      if (!j) { j = B.jars[name] = u.el("span", { class: "sa-jar" }); mem.appendChild(j); }
      var m = /^Drone\('(.+)', (-?\d+)\)$/.exec(val);
      if (m) {
        var b = +m[2], cls = "sa-drone" + (b < 25 ? " low" : "") + (b < 0 ? " boom" : "");
        j.innerHTML = "<b>" + u.esc(name) + "</b> <span class=\"" + cls + "\">🚁 " + u.esc(m[1]) + ' <span class="bat"><i style="width:' + u.clamp(b, 0, 100) + '%"></i></span> ' + (b < 0 ? "💥 " : "") + b + "%</span>";
      } else j.innerHTML = "<b>" + u.esc(name) + "</b> " + u.esc(val);
      j.classList.remove("pop"); void j.offsetWidth; j.classList.add("pop");
    };
    B.clearQ = function () { q.innerHTML = ""; opts.innerHTML = ""; row.innerHTML = ""; act.innerHTML = ""; B.mood("think"); };
    /** Code with numbered, highlightable (and optionally clickable) lines. */
    B.showCode = function (src) {
      scroll.innerHTML = "";
      var pre = u.el("div", { class: "rq-code sa-code" + (src.split("\n").length <= 4 ? " big" : "") }), lines = [];
      src.split("\n").forEach(function (ln, i) {
        var d = u.el("div", { class: "sa-line", html: '<span class="ln">' + (i + 1) + "</span>" + (RQ.code.highlight(ln) || "") });
        pre.appendChild(d); lines.push(d);
      });
      scroll.appendChild(pre);
      return {
        el: pre, lines: lines,
        hl: function (n) {
          lines.forEach(function (d, i) { d.classList.toggle("hl", i + 1 === n); });
          if (n && lines[n - 1] && lines[n - 1].scrollIntoView) lines[n - 1].scrollIntoView({ block: "nearest" });
        },
        set: function (n, text) { lines[n - 1].innerHTML = '<span class="ln">' + n + "</span>" + RQ.code.highlight(text); }
      };
    };
    B.sparkle = function () {
      var r = ball.getBoundingClientRect(), pr = right.getBoundingClientRect();
      for (var i = 0; i < 10; i++) {
        var s = u.el("span", { class: "sa-spark", text: u.pick(["✨", "⭐", "🌟", "✨"]) });
        s.style.left = (r.left - pr.left + r.width / 2 - 12) + "px"; s.style.top = (r.top - pr.top + r.height / 2 - 14) + "px";
        s.style.setProperty("--dx", u.rand(-170, 170) + "px"); s.style.setProperty("--dy", u.rand(-120, 90) + "px");
        right.appendChild(s); (function (e) { L.timeout(function () { e.remove(); }, 950); })(s);
      }
    };
    /** Buttons for choices; resolves when the right one is picked. Wrong picks cost a mistake and giggle. */
    B.choose = function (list, ans, S, hint) {
      opts.innerHTML = "";
      return new Promise(function (res) {
        var tries = 0, btns = [];
        function pick(k) {
          if (!L.alive || btns[k].disabled) return;
          if (k === ans) { off(); B.mood("happy"); RQ.audio.sfx("good"); btns[k].classList.add("yes"); btns.forEach(function (b) { b.disabled = true; }); res(k); }
          else {
            tries++; S.mistakes++; B.mood("think"); RQ.audio.sfx("giggle"); btns[k].classList.add("no", "shake"); btns[k].disabled = true;
            if (hint) B.ask("💡 " + hint);
          }
        }
        list.forEach(function (o, k) {
          var b = u.el("button", { class: "btn", html: "<b>" + (k + 1) + "</b><span>" + RQ.ui.md(o).replace(/<br>/g, "\n") + "</span>", onclick: function () { pick(k); } });
          btns.push(b); opts.appendChild(b);
        });
        var off = keys1(L, function (e) { if (!hasDialog() && /^[1-9]$/.test(e.key) && +e.key <= list.length) { e.preventDefault(); pick(+e.key - 1); } });
      });
    };
    /** "Next" button (or Enter). */
    B.next = function (label) {
      var b = u.el("button", { class: "btn go sa-next", html: label || "Next spell ▶" }); row.appendChild(b);
      L.timeout(function () { b.focus(); }, 60);
      return new Promise(function (res) {
        var off = keys1(L, function (e) { if (!hasDialog() && e.key === "Enter" && document.activeElement !== b) { e.preventDefault(); go(); } });
        function go() { off(); b.disabled = true; RQ.audio.sfx("click"); res(); }
        b.onclick = go;
      });
    };
    B.memReset(); B.ballQ();
    return B;
  }

  /** Play a trace: [line, {var: value}, printedLine, note]. */
  async function run(L, B, view, trace, speed) {
    B.clearOut(); B.memReset(); B.ball.classList.add("swirl"); B.mood("wow"); RQ.audio.sfx("whoosh");
    await L.wait(300); if (!L.alive) return;
    for (var i = 0; i < trace.length; i++) {
      var st = trace[i];
      view.hl(st[0]);
      if (st[1]) for (var k in st[1]) B.memSet(k, st[1][k]);
      B.think(st[3] || "");
      if (st[2] != null) { B.print(st[2]); RQ.audio.sfx("pop"); } else RQ.audio.sfx("tick");
      await L.wait(speed || 560); if (!L.alive) return;
    }
    view.hl(null); B.ball.classList.remove("swirl"); B.think(""); B.mood("happy");
    B.sparkle(); RQ.audio.sfx("bloom");
  }
  function filled(tpl) { return tpl.replace(/\[\[(.+?)\]\]/g, function (m, a) { return a.split("|")[0]; }); }

  /* ------------------------------------------------------------ step types */
  var STEP = {};
  STEP.predict = async function (L, B, st, S) {
    var view = B.showCode(st.code);
    B.ballQ(); B.memReset(); B.goal(st.goal || "Read the spell. What will the **crystal ball** show?");
    B.ask(st.q || "Predict the output:");
    await B.choose(st.opts, st.ans, S, st.hint); if (!L.alive) return;
    B.ask("✨ Casting the spell…");
    await run(L, B, view, st.trace, st.speed); if (!L.alive) return;
    B.ask(st.explain || "Your prediction was right!");
    if (st.say) { await L.talk(st.say); if (!L.alive) return; }
    await B.next(st.last ? "Finish ✨" : null);
  };
  STEP.blanks = async function (L, B, st, S) {
    B.scroll.innerHTML = ""; B.ballQ(); B.memReset(); B.goal(st.goal);
    B.ask(st.q || "Type in the gaps, then press **✨ Cast** (or Enter).");
    var cast = null, b = RQ.code.blanks(B.scroll, st.tpl, { onEnter: function () { if (cast) cast(); } });
    b.el.classList.add("sa-blanks");
    var btn = u.el("button", { class: "btn primary", html: "✨ Cast" }); B.act.appendChild(btn);
    await new Promise(function (res) {
      var tries = 0;
      cast = function () {
        if (!L.alive) return;
        if (b.check()) { cast = null; btn.disabled = true; res(); }
        else {
          tries++; S.mistakes++; RQ.audio.sfx("giggle");
          B.ask("💡 " + st.hint + (tries >= 2 ? " Answer: **" + (st.reveal || "") + "**." : ""));
        }
      };
      btn.onclick = function () { if (cast) cast(); };
    });
    if (!L.alive) return;
    B.act.innerHTML = "";
    var view = B.showCode(filled(st.tpl));
    B.ask("✨ Casting the spell…");
    await run(L, B, view, st.trace, st.speed); if (!L.alive) return;
    B.ask(st.explain || "It works!");
    if (st.say) { await L.talk(st.say); if (!L.alive) return; }
    await B.next(st.last ? "Finish ✨" : null);
  };
  STEP.parsons = async function (L, B, st, S) {
    B.scroll.innerHTML = ""; B.ballQ(); B.memReset(); B.goal(st.goal);
    B.ask(st.q || "Drag the lines (or use ▲ ▼) into the right order, then **✨ Cast**.");
    var box = u.el("div", { class: "sa-pars" }); B.scroll.appendChild(box);
    var p = RQ.code.parsons(box, st.lines);
    var btn = u.el("button", { class: "btn primary", html: "✨ Cast" }); B.act.appendChild(btn);
    await new Promise(function (res) {
      var tries = 0;
      function cast() {
        if (!L.alive) return;
        if (p.check()) { off(); btn.disabled = true; res(); }
        else { tries++; S.mistakes++; RQ.audio.sfx("giggle"); B.ask("💡 Green lines are in the right place. " + st.hint); }
      }
      btn.onclick = cast;
      var off = keys1(L, function (e) { if (!hasDialog() && e.key === "Enter" && !(document.activeElement && document.activeElement.tagName === "BUTTON")) { e.preventDefault(); cast(); } });
    });
    if (!L.alive) return;
    await L.wait(500); if (!L.alive) return;
    B.act.innerHTML = "";
    var view = B.showCode(st.prog || st.lines.join("\n"));
    B.ask("✨ Casting the spell…");
    await run(L, B, view, st.trace, st.speed); if (!L.alive) return;
    B.ask(st.explain || "It works!");
    if (st.say) { await L.talk(st.say); if (!L.alive) return; }
    await B.next(st.last ? "Finish ✨" : null);
  };
  /** Repair: the ball shows a real Python error; click the line where the Glitch Bug hides, then pick the fix. */
  STEP.bug = async function (L, B, st, S) {
    var view = B.showCode(st.broken);
    B.memReset(); B.error(st.error); RQ.audio.sfx("error");
    B.goal("A **Glitch Bug** broke the spell! Read the red message, then click the broken line.");
    B.ask("Which line is broken? Click it (or use ↑ ↓ and Enter).");
    B.opts.innerHTML = "";
    var bug = u.el("div", { class: "sa-bug wiggle", html: RQ.chars ? RQ.chars.svg("bug", { mood: "happy" }) : "🐞" });
    view.el.appendChild(bug); bug.style.top = (view.el.scrollHeight - 56) + "px";
    RQ.audio.sfx("giggle");
    var cur = 0;
    await new Promise(function (res) {
      var tries = 0;
      function choose(i) {
        if (!L.alive) return;
        if (i + 1 === st.line) { off(); view.lines.forEach(function (d) { d.classList.remove("pick", "cur"); d.onclick = null; }); res(); return; }
        tries++; S.mistakes++; RQ.audio.sfx("giggle"); view.lines[i].classList.add("bad");
        (function (d) { L.timeout(function () { d.classList.remove("bad"); }, 600); })(view.lines[i]);
        B.ask("💡 Not that one. " + (tries >= 1 ? "The message says **line " + st.line + "**!" : ""));
      }
      view.lines.forEach(function (d, i) { if (d.textContent.replace(/^\d+/, "").trim()) { d.classList.add("pick"); d.onclick = function () { choose(i); }; } });
      function mark() { view.lines.forEach(function (d, i) { d.classList.toggle("cur", i === cur); }); if (view.lines[cur].scrollIntoView) view.lines[cur].scrollIntoView({ block: "nearest" }); }
      var off = keys1(L, function (e) {
        if (hasDialog()) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); cur = u.clamp(cur + (e.key === "ArrowDown" ? 1 : -1), 0, view.lines.length - 1); mark(); }
        else if (e.key === "Enter") { e.preventDefault(); choose(cur); }
      });
    });
    if (!L.alive) return;
    var line = view.lines[st.line - 1];
    line.classList.add("bad");
    bug.style.top = (line.offsetTop - 12) + "px";
    RQ.audio.sfx("jump");
    B.ask("Found the bug on **line " + st.line + "**! How do we fix it?");
    await B.choose(st.fixes, st.fixAns, S, st.hint); if (!L.alive) return;
    RQ.audio.sfx("zap"); bug.classList.remove("wiggle"); bug.classList.add("gone");
    view.set(st.line, st.fixed); line = view.lines[st.line - 1]; line.classList.remove("bad"); line.classList.add("fixed");
    await L.wait(600); if (!L.alive) return;
    line.classList.remove("fixed");
    B.ask("✨ Casting the fixed spell…");
    await run(L, B, view, st.trace, st.speed); if (!L.alive) return;
    B.ask(st.explain || "Bug squashed! The spell works again.");
    await B.next(st.last ? "Finish ✨" : null);
  };

  function spells(list, doneMsg) {
    return function (L) {
      var B = book(L), S = { mistakes: 0 };
      list[list.length - 1].last = true;
      (async function () {
        for (var i = 0; i < list.length; i++) {
          B.clearQ(); B.head(i + 1, list.length, list[i].title);
          await STEP[list[i].type](L, B, list[i], S); if (!L.alive) return;
        }
        L.win({ stars: S.mistakes <= 1 ? 3 : S.mistakes <= 3 ? 2 : 1, msg: doneMsg, stats: { "Spells cast": list.length, "Oops": S.mistakes } });
      })();
    };
  }

  /* ================================================================ L1 variables, numbers, strings */
  var L1 = [
    { type: "predict", title: "The jar spell", code: "seeds = 12\nprint(seeds)",
      opts: ["seeds", "12", "print"], ans: 1, hint: "`print` shows what is *inside* the jar called seeds.",
      trace: [[1, { seeds: "12" }, null, "put 12 in the jar 'seeds'"], [2, null, "12"]],
      explain: "`seeds` is a **variable**: a name on a jar. `print(seeds)` shows what's inside." },
    { type: "predict", title: "Change the jar", code: "seeds = 12\nseeds = seeds + 5\nprint(seeds)",
      opts: ["12", "17", "seeds + 5"], ans: 1, hint: "Line 2 takes what's in the jar, adds 5, and puts it back.",
      trace: [[1, { seeds: "12" }], [2, { seeds: "17" }, null, "12 + 5 → 17"], [3, null, "17"]],
      explain: "The right side is worked out first, then saved in the jar. Now it holds **17**." },
    { type: "predict", title: "Words in quotes", code: 'name = "Sprout"\nprint("Hi " + name)',
      opts: ["Hi name", "Hi Sprout", "Hi + Sprout"], ans: 1, hint: "`name` is a jar. Use what's inside it.",
      trace: [[1, { name: '"Sprout"' }], [2, null, "Hi Sprout", '"Hi " + "Sprout"']],
      explain: "Text in quotes is a **string**. `+` glues strings together." },
    { type: "predict", title: "Numbers vs strings", code: 'print(2 + 3)\nprint("2" + "3")', q: "Careful! One line has quotes. What does the ball show?",
      opts: ["5\n5", "5\n23", "23\n23"], ans: 1, hint: "Quotes make text. Gluing the text \"2\" and \"3\" makes \"23\".",
      trace: [[1, null, "5", "2 + 3 → 5"], [2, null, "23", '"2" + "3" → "23"']],
      explain: "Numbers **add**, strings **glue**. Same `+`, different magic!",
      say: [["hoot", "Hoo hoo, same plus sign but two different spells! Numbers add up, but strings just stick together."]] },
    { type: "blanks", title: "Your turn", tpl: "nir = 8\nred = 2\nprint([[nir]] - red)", goal: "Make the crystal ball show **6**.",
      hint: "Which jar holds the 8?", reveal: "nir",
      trace: [[1, { nir: "8" }], [2, { red: "2" }], [3, null, "6", "8 - 2 → 6"]],
      explain: "That's the top of the NDVI formula: **NIR − Red** = 6." }
  ];

  /* ================================================================ L2 functions: ndvi() */
  var L2 = [
    { type: "parsons", title: "Build the NDVI spell", goal: "Put the lines of the NDVI spell in order.",
      lines: ["def ndvi(nir, red):", "    top = nir - red", "    return top / (nir + red)", "print(ndvi(8, 2))"],
      hint: "`def` comes first. You can only use `top` after making it.",
      trace: [[1, null, null, "learn the spell ndvi"], [4, null, null, "call ndvi(8, 2)"], [1, { nir: "8", red: "2" }, null, "nir = 8, red = 2"],
        [2, { top: "6" }, null, "8 - 2 → 6"], [3, null, null, "6 / (8 + 2) → 0.6"], [4, null, "0.6"]],
      explain: "`def` teaches Python a new spell. `ndvi(8, 2)` **calls** it: 8 goes into `nir`, 2 into `red`." },
    { type: "blanks", title: "ReSeed's formula", goal: "Fill in the NDVI formula: **(NIR − Red) ÷ (NIR + Red)**.",
      tpl: "def ndvi(nir, red):\n    return ([[nir]] - [[red]]) / ([[nir]] + [[red]])\n\nprint(ndvi(6, 2))",
      hint: "Top: nir minus red. Bottom: nir plus red.", reveal: "nir, red, nir, red",
      trace: [[1, null, null, "learn the spell"], [4, null, null, "call ndvi(6, 2)"], [1, { nir: "6", red: "2" }], [2, null, null, "(6 - 2) / (6 + 2) → 0.5"], [4, null, "0.5"]],
      explain: "`return` sends the answer back to whoever called the spell. The lawn scores **0.5**." },
    { type: "predict", title: "Score the lake", code: "def ndvi(nir, red):\n    return (nir - red) / (nir + red)\n\nprint(ndvi(1, 3))", q: "The lake: NIR 1, Red 3. What does the ball show?",
      opts: ["0.5", "-0.5", "-2"], ans: 1, hint: "1 - 3 is -2, and 1 + 3 is 4. Now divide.",
      trace: [[4, null, null, "call ndvi(1, 3)"], [1, { nir: "1", red: "3" }], [2, null, null, "(1 - 3) / (1 + 3) → -0.5"], [4, null, "-0.5"]],
      explain: "This lake scores **below zero**, as water often does. One spell, many inputs: that's the power of functions!" },
    { type: "predict", title: "The order trap", code: "def ndvi(red, nir):   # red first!\n    return (nir - red) / (nir + red)\n\nprint(ndvi(8, 2))",
      q: "Watch out: this spell takes **red** first. What does the ball show?", opts: ["0.6", "-0.6", "6"], ans: 1, hint: "The 8 goes into the first name, which is `red` now.",
      trace: [[4, null, null, "call ndvi(8, 2)"], [1, { red: "8", nir: "2" }, null, "8 goes into red!"], [2, null, null, "(2 - 8) / (2 + 8) → -0.6"], [4, null, "-0.6"]],
      explain: "The first number goes into the first name. ReSeed's real `ndvi(red, nir)` in `acquire.py` takes **red first**!",
      say: [["hoot", "That's a real trap! ReSeed's own NDVI spell takes red first, so its code always passes red, then NIR."]] }
  ];

  /* ================================================================ L3 if / elif / else + fix the bug */
  var HC = ["def health_class(value):", "    if value >= 0.60:", '        return "healthy"', "    elif value >= 0.30:", '        return "moderate"',
    "    elif value >= 0.10:", '        return "sparse"', "    elif value >= 0.01:", '        return "none"', "    else:", '        return "not_seedable"', ""];
  function hcProg(v, swap) {
    var l = HC.slice(); if (swap) l[swap[0] - 1] = swap[1];
    l.push("print(health_class(" + v + "))"); return l.join("\n");
  }
  function hcTrace(v) {
    var tr = [[13, null, null, "call health_class(" + v + ")"], [1, { value: String(v) }]];
    var rungs = [[2, 0.6, 3, "healthy"], [4, 0.3, 5, "moderate"], [6, 0.1, 7, "sparse"], [8, 0.01, 9, "none"]];
    for (var i = 0; i < rungs.length; i++) {
      var r = rungs[i], ok = v >= r[1];
      tr.push([r[0], null, null, v + " >= " + r[1].toFixed(2) + " → " + (ok ? "True" : "False")]);
      if (ok) { tr.push([r[2], null, null, 'return "' + r[3] + '"']); tr.push([13, null, r[3]]); return tr; }
    }
    tr.push([10, null, null, "nothing was True → else"]); tr.push([11, null, null, 'return "not_seedable"']); tr.push([13, null, "not_seedable"]);
    return tr;
  }
  var L3 = [
    { type: "predict", title: "The health ladder", code: hcProg(0.45), q: "ReSeed's health classes as a spell. What does `health_class(0.45)` give?",
      opts: ["healthy", "moderate", "sparse"], ans: 1, hint: "Is 0.45 >= 0.60? No. Is it >= 0.30?",
      trace: hcTrace(0.45), explain: "Python checks from the top and stops at the **first True**. 0.45 lands on **moderate**." },
    { type: "predict", title: "Right on the line", code: hcProg(0.6), q: "What about exactly **0.60**?",
      opts: ["healthy", "moderate", "an error"], ans: 0, hint: "`>=` means *bigger than OR equal to*.",
      trace: hcTrace(0.6), explain: "`>=` includes the line itself, so 0.60 is **healthy**." },
    { type: "bug", title: "Bug hunt: the colon", broken: hcProg(0.15, [6, "    elif value >= 0.10"]), line: 6,
      error: '  File "spell.py", line 6\n    elif value >= 0.10\n                      ^\nSyntaxError: expected \':\'',
      fixes: ["add a colon `:` at the end", "add a bracket `)` at the end", "delete the whole line"], fixAns: 0, hint: "The message says what Python **expected**.",
      fixed: "    elif value >= 0.10:", trace: hcTrace(0.15), explain: "Every `if`, `elif`, `else` and `def` line ends with a **colon**." },
    { type: "bug", title: "Bug hunt: the indent", broken: hcProg(0.82, [3, '    return "healthy"']), line: 3,
      error: '  File "spell.py", line 3\n    return "healthy"\n    ^^^^^^\nIndentationError: expected an\nindented block after \'if\'\nstatement on line 2',
      fixes: ["add a colon `:`", "indent it 4 more spaces", "add more quotes"], fixAns: 1, hint: "Lines that belong to the `if` sit further to the right.",
      fixed: '        return "healthy"', trace: hcTrace(0.82), explain: "The **indent** shows which lines belong to the `if`. Python is picky about spaces!" },
    { type: "bug", title: "Bug hunt: the quote", broken: hcProg(0.05, [9, '        return "none']), line: 9,
      error: '  File "spell.py", line 9\n    return "none\n           ^\nSyntaxError: unterminated\nstring literal (detected at line 9)',
      fixes: ["indent it 4 more spaces", "add a colon `:`", "add the missing `\"` at the end"], fixAns: 2, hint: "A string needs a quote at the start **and** at the end.",
      fixed: '        return "none"', trace: hcTrace(0.05), explain: "Strings need **two** quotes. Unterminated means it never ended!" }
  ];

  /* ================================================================ L4 loops, lists, dicts */
  function loopTrace() { var t = []; for (var m = 1; m <= 12; m++) { t.push([1, { m: String(m) }]); t.push([2, null, "month " + m]); } return t; }
  var oz = RQ.site && RQ.site("ozarks");
  var OZ = oz ? oz.ndvi.monthly.map(function (m) { return m.mean_forest_ndvi == null ? 0.5 : Math.round(m.mean_forest_ndvi * 100) / 100; })
    : [0.43, 0.14, 0.36, 0.42, 0.88, 0.83, 0.82, 0.81, 0.79, 0.79, 0.58, 0.44];
  var OZS = OZ.map(function (v) { return v.toFixed(2); });
  var LOW = OZ.filter(function (v) { return v < 0.3; }).length;
  function ozTrace() {
    var tr = [[1, { ozarks: "[12 numbers]" }], [3, { low: "0" }]], low = 0;
    OZ.forEach(function (v, i) {
      tr.push([4, { v: OZS[i] }, null, "month " + (i + 1)]);
      var hit = v < 0.3; tr.push([5, null, null, OZS[i] + " < 0.30 → " + (hit ? "True" : "False")]);
      if (hit) { low++; tr.push([6, { low: String(low) }, null, "low + 1 → " + low]); }
    });
    tr.push([7, null, String(low)]);
    return tr;
  }
  var DICT = 'BIOMES = {\n    "oak_hickory": {\n        "species": ["White oak", "Black oak",\n                    "Mockernut hickory"],\n    },\n' +
    '    "tropical_moist_forest": {\n        "species": ["Paricá", "Balsa", "Mutamba"],\n    },\n}\n';
  var L4 = [
    { type: "predict", title: "Twelve months", code: 'for m in range(1, 13):\n    print("month", m)', q: "How many lines will the crystal ball print?",
      opts: ["12", "13", "1"], ans: 0, hint: "`range(1, 13)` starts at 1 and stops just **before** 13.", speed: 230,
      trace: loopTrace(), explain: "The loop ran **12** times: m = 1, 2, … 12. `range` stops before the last number." },
    { type: "predict", title: "A list of seeds", code: 'seeds = ["acorn", "pine seed", "seed ball"]\nprint(seeds[0])\nprint(len(seeds))',
      opts: ["acorn\n3", "pine seed\n3", "acorn\n2"], ans: 0, hint: "Python starts counting at **0**. `len` counts all the items.",
      trace: [[1, { seeds: "[3 items]" }], [2, null, "acorn", "seeds[0] → the FIRST item"], [3, null, "3", "len(seeds) → 3"]],
      explain: "Lists count from **0**: `seeds[0]` is the first seed, `seeds[2]` the third.",
      say: [["sprout", "Wait, zero comes first? Computers are funny, so my rotor number zero is my first rotor!"]] },
    { type: "predict", title: "Count the low months", speed: 200,
      code: "ozarks = [" + OZS.slice(0, 6).join(", ") + ",\n          " + OZS.slice(6).join(", ") + "]\nlow = 0\nfor v in ozarks:\n    if v < 0.30:\n        low = low + 1\nprint(low)",
      q: "ReSeed's measured NDVI for the Ozarks oak forest, month by month (2025). How many months are below 0.30?",
      opts: [String(LOW), String(LOW + 1), String(LOW + 3)], ans: 0, hint: "Look for numbers smaller than 0.30. Only winter dips that low.",
      trace: ozTrace(), explain: "Only **February** dips below 0.30: these oaks are bare in winter. The numbers come from ReSeed's `ndvi.monthly_ndvi()` (rounded)." },
    { type: "blanks", title: "Open the right drawer", tpl: DICT + 'print(BIOMES["[[oak_hickory]]"]["species"][0])',
      goal: "A **dictionary** finds things by key. Make the ball say **White oak**.", hint: "Which biome key has the oaks?", reveal: "oak_hickory",
      trace: [[1, { BIOMES: "{2 biomes}" }, null, "make the dictionary"], [10, null, null, 'BIOMES["oak_hickory"] → oak drawer'], [10, null, null, '["species"][0] → first seed'], [10, null, "White oak"]],
      explain: "Keys open drawers, and drawers can hold more drawers. In ReSeed, `BIOMES` lives in `species.py`." },
    { type: "predict", title: "Amazon seeds", code: DICT + 'print(BIOMES["tropical_moist_forest"]["species"][2])', q: "Now the Amazon drawer, item **[2]**. What does the ball show?",
      opts: ["Paricá", "Mutamba", "Balsa"], ans: 1, hint: "[0] is the first, [1] the second, [2] the third.",
      trace: [[1, { BIOMES: "{2 biomes}" }], [10, null, null, "tropical_moist_forest drawer"], [10, null, null, "[2] → third seed"], [10, null, "Mutamba"]],
      explain: "Paricá, Balsa and Mutamba are the real native seeds ReSeed plans for Rondônia." }
  ];

  /* ================================================================ L5 challenge: a Drone class */
  var DRONE = "from dataclasses import dataclass\n\n@dataclass\nclass Drone:\n    name: str\n    battery: int = 100\n";
  var FLY = "\n    def fly(self, minutes):\n        self.battery = self.battery - minutes * 5\n";
  var L5 = [
    { type: "predict", title: "A blueprint for drones", code: DRONE + '\nkoa = Drone("Koa-1")\ntuki = Drone("Tuki-2", 60)\nprint(koa.battery, tuki.battery)',
      q: "Two drones from one blueprint. What does the ball show?", opts: ["100 60", "60 100", "100 100"], ans: 0, hint: "Koa didn't give a battery, so she gets the default `= 100`.",
      trace: [[4, null, null, "learn the blueprint Drone"], [8, { koa: "Drone('Koa-1', 100)" }, null, "battery missing → default 100"], [9, { tuki: "Drone('Tuki-2', 60)" }, null, "battery = 60"], [10, null, "100 60"]],
      explain: "A **class** is a blueprint. `koa` and `tuki` are two **objects**, each with its own name and battery." },
    { type: "blanks", title: "Teach drones to fly", tpl: DRONE + "\n    def fly(self, minutes):\n        self.[[battery]] = self.battery - minutes * 5\n\nkoa = Drone(\"Koa-1\")\ntuki = Drone(\"Tuki-2\", 60)\nkoa.fly(10)\ntuki.fly(4)\nprint(koa.battery, tuki.battery)",
      goal: "A **method** is a function inside a class. Make `fly()` use up **this** drone's battery: 5 % per minute.", hint: "`self` means *this drone*. Which of its values goes down?", reveal: "battery",
      trace: [[4, null, null, "learn the blueprint"], [11, { koa: "Drone('Koa-1', 100)" }], [12, { tuki: "Drone('Tuki-2', 60)" }], [13, null, null, "koa flies 10 minutes"],
        [9, { koa: "Drone('Koa-1', 50)" }, null, "100 - 10 * 5 → 50"], [14, null, null, "tuki flies 4 minutes"], [9, { tuki: "Drone('Tuki-2', 40)" }, null, "60 - 4 * 5 → 40"], [15, null, "50 40"]],
      explain: "`self` is *the drone that is flying*. Koa's battery changed, Tuki's changed by a different amount!" },
    { type: "predict", title: "Uh-oh, Tuki!", code: DRONE + FLY + '\ntuki = Drone("Tuki-2", 60)\ntuki.fly(4)\ntuki.fly(10)\nprint(tuki.battery)',
      q: "Tuki flies 4 minutes, then 10 more. What does the ball show?", opts: ["40", "-10", "0"], ans: 1, hint: "60 - 20 = 40. Then 40 - 50 = ?",
      trace: [[11, { tuki: "Drone('Tuki-2', 60)" }], [12, null, null, "fly 4 minutes"], [9, { tuki: "Drone('Tuki-2', 40)" }, null, "60 - 20 → 40"], [13, null, null, "fly 10 minutes"],
        [9, { tuki: "Drone('Tuki-2', -10)" }, null, "40 - 50 → -10 💥"], [14, null, "-10"]],
      explain: "**−10 %**? A real battery can't go below zero: our spell is missing a check!",
      say: [["koa", "Crikey, minus ten percent? Our game let that drone use more charge than it had!"], ["hoot", "Let's add a game safety check: if the trip is too long, skip that flight."]] },
    { type: "parsons", title: "The safety spell", goal: "Put the safe `fly` method in order: check the battery **before** flying.",
      lines: ["    def fly(self, minutes):", "        if minutes * 5 > self.battery:", '            print(self.name, "stays home!")', "            return", "        self.battery = self.battery - minutes * 5"],
      hint: "Check first (`if`), and the warning goes inside the `if` before `return`.",
      prog: DRONE + '\n    def fly(self, minutes):\n        if minutes * 5 > self.battery:\n            print(self.name, "stays home!")\n            return\n        self.battery = self.battery - minutes * 5\n\ntuki = Drone("Tuki-2", 60)\ntuki.fly(4)\ntuki.fly(10)\nprint(tuki.battery)',
      trace: [[14, { tuki: "Drone('Tuki-2', 60)" }], [15, null, null, "fly 4 minutes"], [9, null, null, "20 > 60 → False"], [12, { tuki: "Drone('Tuki-2', 40)" }, null, "60 - 20 → 40"],
        [16, null, null, "fly 10 minutes"], [9, null, null, "50 > 40 → True"], [10, null, "Tuki-2 stays home!"], [11, null, null, "return: skip this flight"], [17, null, "40"]],
      explain: "Tuki skips the long flight with **40 %** left. ReSeed's real `Drone` in `logistics.py` also keeps a 25 % battery reserve.",
      say: [["koa", "Beauty, Tuki skips that flight! Real pilots also plan the way home and keep spare power."]] }
  ];

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g14",
    music: "mystery",
    intro: [
      ["hoot", "Welcome to my Spell Academy! Python spells tell a computer exactly what to do."],
      ["sprout", "Every spell has a crystal ball. Guess what it will show, then cast it and see!"]
    ],
    outro: [
      ["hoot", "You read, fixed and wrote real Python spells. ReSeed is built from spells just like these!"],
      ["koa", "And the drone class? I'm putting that one on my fridge!"]
    ],
    levels: [
      { title: "Jars & strings", goal: "Predict what each spell prints",
        intro: [["hoot", "A **variable** is a name for a value, like a label on a jar. `print` shows it in the crystal ball."]],
        cards: ["py-variable"],
        play: spells(L1, "You can read variables, numbers and strings!") },
      { title: "The NDVI spell", goal: "Build and call the ndvi() function",
        intro: [["hoot", "A **function** is a spell you can use again and again. `def` makes it, and `return` sends back the answer."],
                ["sprout", "Let's build the NDVI spell from Goggles island!"]],
        cards: ["py-function"],
        play: spells(L2, "Your ndvi() spell works for any readings in the right order (as long as they don't add up to zero)!") },
      { title: "If, elif, else", goal: "Follow the ladder, then squash the Glitch Bugs",
        intro: [["hoot", "`if`, `elif` and `else` let a spell choose. Python checks from the top and stops at the first True."],
                ["bug", "Hee hee! Glitch Bugs love hiding in spells, bet you can't find us!"]],
        cards: ["py-if"],
        play: spells(L3, "You followed ReSeed's health ladder and squashed three Glitch Bugs!") },
      { title: "Loops & drawers", goal: "Loop over months, lists and dictionaries",
        intro: [["hoot", "A **for loop** repeats a spell for every item in a list. Perfect for twelve months of NDVI!"]],
        cards: ["py-loop", "py-dict"],
        play: spells(L4, "Loops, lists and dictionaries: you can handle real ReSeed data now!") },
      { title: "Challenge: Drone class", goal: "Build a Drone blueprint with a safe fly() method",
        intro: [["koa", "G'day! Every drone in my fleet has a name and a battery, so let's make a **class**: a blueprint for drones."],
                ["hoot", "This is a challenge spell. Take your time, and the hints will help you."]],
        cards: ["py-class"],
        play: spells(L5, "Two drone objects, one blueprint, and a safety check. Real programmer stuff!") }
    ]
  });
})();
