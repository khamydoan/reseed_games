/* g20 Drone Academy — earn your game pilot wings.
 * L1 drone types (mission cards) · L2 build a quad (parts + prop directions) · L3 stick trainer (throttle, yaw, pitch, roll)
 * L4 pre-flight checklist and safety · L5 flight modes (demo_flight.py order) and emergencies: RTL / LAND / HOLD.
 * Facts: reseed/reseed/demo_flight.py (GUIDED mode, SITL first, safety pilot with kill switch), reseed/reseed/logistics.py Drone. */
(function () {
  "use strict";
  var u = RQ.u, md = RQ.ui.md;
  function proto() { var d = RQ.data(); return (d && d.drones && d.drones.prototype) || { name: "ReSeed prototype (X500-class quad, 1 roll)", endurance_min: 22, max_payload_g: 900, rolls_per_sortie: 1 }; }
  function scoreStars(m, a, b) { return m <= a ? 3 : m <= b ? 2 : 1; }

  /* ------------------------------------------------------------ drone pictures (SVG, viewBox 0 0 120 70) */
  var INK = "#1d2b3a";
  function rotor(x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#cfe9ff" stroke="' + INK + '" stroke-width="2.5"/><circle cx="' + x + '" cy="' + y + '" r="2.5" fill="' + INK + '"/>'; }
  function multi(n) {
    var s = "", R = 25, r = n > 6 ? 8 : n > 4 ? 9.5 : 11;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0) - Math.PI / 2, x = 60 + Math.cos(a) * R * 1.25, y = 35 + Math.sin(a) * R;
      s += '<line x1="60" y1="35" x2="' + x + '" y2="' + y + '" stroke="' + INK + '" stroke-width="4"/>' + rotor(x, y, r);
    }
    return s + '<rect x="50" y="27" width="20" height="16" rx="5" fill="#2b7bd0" stroke="' + INK + '" stroke-width="2.5"/>';
  }
  var PICS = {
    quad: multi(4), hexa: multi(6), octo: multi(8),
    wing: '<path d="M60 8 L66 30 L112 40 L112 46 L66 42 L64 58 L74 64 L46 64 L56 58 L54 42 L8 46 L8 40 L54 30 Z" fill="#e0752d" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="60" cy="66" rx="9" ry="2.5" fill="#cfe9ff" stroke="' + INK + '" stroke-width="2"/>',
    vtol: '<path d="M60 8 L65 30 L110 38 L110 44 L65 41 L63 58 L72 63 L48 63 L57 58 L55 41 L10 44 L10 38 L55 30 Z" fill="#12a39a" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/><line x1="34" y1="22" x2="34" y2="56" stroke="' + INK + '" stroke-width="4"/><line x1="86" y1="22" x2="86" y2="56" stroke="' + INK + '" stroke-width="4"/>' + rotor(34, 20, 8) + rotor(34, 56, 8) + rotor(86, 20, 8) + rotor(86, 56, 8),
    heli: '<ellipse cx="50" cy="40" rx="24" ry="13" fill="#d1495b" stroke="' + INK + '" stroke-width="2.5"/><path d="M72 38 L108 34 L108 40 L72 44 Z" fill="#d1495b" stroke="' + INK + '" stroke-width="2.5"/><circle cx="108" cy="34" r="7" fill="#cfe9ff" stroke="' + INK + '" stroke-width="2"/><line x1="50" y1="27" x2="50" y2="18" stroke="' + INK + '" stroke-width="3"/><ellipse cx="50" cy="16" rx="46" ry="3.5" fill="#cfe9ff" stroke="' + INK + '" stroke-width="2"/><path d="M34 54 L30 60 L70 60 L66 54" fill="none" stroke="' + INK + '" stroke-width="3"/><path d="M34 34 Q38 29 46 30 L46 40 L32 40 Z" fill="#cfe9ff" stroke="' + INK + '" stroke-width="2"/>'
  };
  function pic(k) { return '<svg viewBox="0 0 120 70" aria-hidden="true">' + PICS[k] + "</svg>"; }

  /* ------------------------------------------------------------ L1: which drone for which job? */
  var TYPES = {
    quad: { name: "Quadcopter", s: [5, 2, 2, 3], good: "hovering still; simple and cheap", weak: "short flights and small loads" },
    hexa: { name: "Hexacopter", s: [5, 3, 2, 3], good: "more lift, and spare rotors (some can land if one motor stops)", weak: "costs more than a quad" },
    octo: { name: "Octocopter", s: [5, 5, 1, 2], good: "very heavy loads and spare rotors", weak: "short range; big and costly" },
    wing: { name: "Fixed-wing", s: [0, 3, 5, 5], good: "long range and speed", weak: "it cannot hover and needs room to launch and land" },
    vtol: { name: "VTOL hybrid", s: [4, 2, 4, 4], good: "taking off like a quad and cruising like a plane", weak: "it is complex and pricey" },
    heli: { name: "Single-rotor helicopter", s: [4, 4, 3, 3], good: "lifting heavy loads for a long time with one big rotor", weak: "big, dangerous blades and tricky repairs" }
  };
  var STATS = ["Hover", "Lift", "Range", "Speed"];
  var MISSIONS = [
    { text: "Hover over one small patch and drop seeds from **one seed roll**. Keep it simple and cheap!", need: "Hover", ans: "quad",
      why: [["koa", "A **quadcopter**: four rotors, great at hovering! ReSeed's prototype is an X500-class quad."]] },
    { text: "Map **500 hectares** of burned hills in one long flight.", need: "Range + Speed", ans: "wing",
      why: [["koa", "**Fixed-wing**: wings make lift, so it flies far and fast! But it can never hover."]] },
    { text: "Lift a heavy **10 kg** tank of seed balls.", need: "Lift", ans: "octo",
      why: [["koa", "**Octocopter**: eight rotors share the heavy load! Many can still land if one motor fails, but not all."]] },
    { text: "Take off from a tiny forest clearing, then fly **30 km** to the next valley.", need: "Hover + Range", ans: "vtol",
      why: [["koa", "**VTOL hybrid**: it takes off straight up, then uses its wings to cruise far like a plane!"]] },
    { text: "Carry a medium load, with spare rotors in case **one motor stops**.", need: "Hover + Lift", ans: "hexa",
      why: [["koa", "**Hexacopter**: six rotors share the load! Many can land on the other five, if they are set up for it."]] },
    { text: "Spray a big farm field for an hour with a heavy tank.", need: "Lift + Range", ans: "heli",
      why: [["koa", "**Single-rotor helicopter**! One big rotor is very efficient for long, heavy work."]] }
  ];
  function typesLevel(L) {
    var wrap = u.el("div", { class: "da-wrap" }); L.stage.appendChild(wrap);
    var mission = u.el("div", { class: "da-mission" }), deck = u.el("div", { class: "da-deck" });
    wrap.appendChild(mission); wrap.appendChild(deck);
    var keys = Object.keys(TYPES), cards = {}, mi = 0, mistakes = 0, busy = false;
    keys.forEach(function (k, i) {
      var t = TYPES[k];
      var stats = t.s.map(function (v, j) { return '<div class="da-stat"><span>' + STATS[j] + '</span><span class="da-bar"><i style="width:' + v * 20 + '%"></i></span></div>'; }).join("");
      var c = u.el("button", { class: "da-card", "aria-label": t.name, html: '<span class="k">' + (i + 1) + '</span><div class="pic">' + pic(k) + "</div><b>" + t.name + "</b>" + stats });
      c.onclick = function () { pick(k); };
      cards[k] = c; deck.appendChild(c);
    });
    function show() {
      var m = MISSIONS[mi];
      mission.innerHTML = '<div class="who">' + RQ.chars.svg("koa", { mood: "think" }) + "</div><div><small class=\"muted\">Mission " + (mi + 1) + " of " + MISSIONS.length +
        "</small><h3>" + md(m.text) + '</h3><div class="need"><span class="chip">Needs: ' + m.need + "</span></div></div>";
      L.hud.set("mission", "🎯 " + (mi + 1) + " / " + MISSIONS.length);
    }
    function pick(k) {
      if (busy || !L.alive || cards[k].classList.contains("used")) return;
      var m = MISSIONS[mi], c = cards[k];
      if (k === m.ans) {
        busy = true; RQ.audio.sfx("good"); c.classList.add("ok");
        L.talk(m.why).then(function () {
          if (!L.alive) return;
          c.classList.remove("ok"); c.classList.add("used"); busy = false; mi++;
          if (mi >= MISSIONS.length) L.win({ stars: scoreStars(mistakes, 1, 3), msg: "Six missions, six perfect drones. You know the whole fleet!", stats: { "Wrong picks": mistakes } });
          else show();
        });
      } else {
        mistakes++; RQ.audio.sfx("bad"); c.classList.remove("no"); void c.offsetWidth; c.classList.add("no");
        L.toast("**" + TYPES[k].name + "**: great at " + TYPES[k].good + ", but " + TYPES[k].weak + ".", "bad", 3600);
      }
    }
    L.on(window, "keydown", function (e) {
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      var n = parseInt(e.key, 10); if (n >= 1 && n <= keys.length) pick(keys[n - 1]);
    });
    show();
  }

  /* ------------------------------------------------------------ L2: build the seed drone */
  var PARTS = [
    { id: "frame", icon: "✖️", name: "Frame", n: 1, slots: ["frame"], info: "The **frame** is the drone's skeleton: a light X with four arms. It goes on the **workbench** first." },
    { id: "motor", icon: "⚙️", name: "Motor", n: 4, slots: ["m_fl", "m_fr", "m_bl", "m_br"], info: "A brushless **motor** spins a propeller super fast. One goes at the **end of each arm**." },
    { id: "esc", icon: "🟩", name: "ESC board", n: 1, slots: ["center"], info: "**ESCs** (electronic speed controllers) tell each motor how fast to spin. This 4-in-1 board sits in the **middle**, under the brain." },
    { id: "fc", icon: "🧠", name: "Flight controller", n: 1, slots: ["center"], info: "The **flight controller** is the brain. It stacks **on top of the ESC board**, its arrow pointing forward." },
    { id: "gps", icon: "📡", name: "GPS", n: 1, slots: ["gps"], info: "The **GPS** finds where the drone is. It sits on a **mast at the back**, far from noisy wires." },
    { id: "rx", icon: "📻", name: "Radio receiver", n: 1, slots: ["rx"], info: "The **radio receiver** hears the pilot's transmitter. It goes on the **left side plate**." },
    { id: "bat", icon: "🔋", name: "LiPo battery", n: 1, slots: ["bat"], info: "The **LiPo battery** powers everything. Strap it on the **back plate**, between the brain and the GPS." },
    { id: "servo", icon: "🧻", name: "Seed-roll servo", n: 1, slots: ["servo"], info: "A **servo** opens the seed roll's hatch: ReSeed's mission files switch it on. In this game it hangs at the **front**, under the nose." }
  ];
  var SLOTS = {
    frame: [50, 50, 70, 70], m_fl: [19, 19, 17, 17], m_fr: [81, 19, 17, 17], m_bl: [19, 81, 17, 17], m_br: [81, 81, 17, 17],
    center: [50, 50, 20, 20], gps: [50, 89, 13, 13], rx: [28, 50, 13, 13], bat: [50, 70, 24, 11], servo: [50, 30, 18, 11]
  };
  var PART_SVG = {
    motor: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#5b6b7d" stroke="#1d2b3a" stroke-width="3"/><circle cx="20" cy="20" r="7" fill="#c8d3df" stroke="#1d2b3a" stroke-width="2"/></svg>',
    esc: '<svg viewBox="0 0 40 40"><rect x="3" y="3" width="34" height="34" rx="5" fill="#3fa457" stroke="#1d2b3a" stroke-width="3"/><rect x="9" y="9" width="8" height="8" fill="#1d2b3a"/><rect x="23" y="23" width="8" height="8" fill="#1d2b3a"/></svg>',
    fc: '<svg viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" rx="5" fill="#26364a" stroke="#1d2b3a" stroke-width="3"/><path d="M20 9 L28 22 L22 22 L22 31 L18 31 L18 22 L12 22 Z" fill="#ffd84d"/></svg>',
    gps: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#f5f7fa" stroke="#1d2b3a" stroke-width="3"/><path d="M20 9 L26 22 L14 22 Z" fill="#d1495b"/></svg>',
    rx: '<svg viewBox="0 0 40 40"><rect x="8" y="12" width="24" height="18" rx="4" fill="#7c5cc4" stroke="#1d2b3a" stroke-width="3"/><path d="M12 12 L4 2 M28 12 L36 2" stroke="#1d2b3a" stroke-width="3"/></svg>',
    bat: '<svg viewBox="0 0 80 36"><rect x="3" y="3" width="74" height="30" rx="6" fill="#ffd84d" stroke="#1d2b3a" stroke-width="3"/><rect x="3" y="3" width="20" height="30" rx="6" fill="#1d2b3a"/><text x="48" y="24" font-size="13" font-weight="700" text-anchor="middle" fill="#1d2b3a">LiPo 4S</text></svg>',
    servo: '<svg viewBox="0 0 60 34"><rect x="2" y="6" width="22" height="22" rx="4" fill="#2b7bd0" stroke="#1d2b3a" stroke-width="3"/><rect x="26" y="8" width="32" height="18" rx="6" fill="#d9b27c" stroke="#1d2b3a" stroke-width="3"/></svg>'
  };
  var FRAME_SVG = '<svg class="frame" viewBox="0 0 100 100" aria-hidden="true"><g stroke="#1d2b3a" stroke-linecap="round">' +
    '<line x1="50" y1="50" x2="19" y2="19" stroke-width="7"/><line x1="50" y1="50" x2="81" y2="19" stroke-width="7"/><line x1="50" y1="50" x2="19" y2="81" stroke-width="7"/><line x1="50" y1="50" x2="81" y2="81" stroke-width="7"/>' +
    '<line x1="50" y1="50" x2="19" y2="19" stroke="#d1495b" stroke-width="4"/><line x1="50" y1="50" x2="81" y2="19" stroke="#d1495b" stroke-width="4"/>' +
    '<line x1="50" y1="50" x2="19" y2="81" stroke="#4a5b6d" stroke-width="4"/><line x1="50" y1="50" x2="81" y2="81" stroke="#4a5b6d" stroke-width="4"/></g>' +
    '<rect x="34" y="34" width="32" height="40" rx="7" fill="#c8d3df" stroke="#1d2b3a" stroke-width="2.5"/><line x1="50" y1="74" x2="50" y2="86" stroke="#1d2b3a" stroke-width="2.5"/>' +
    '<text x="50" y="8" font-size="5" font-weight="700" text-anchor="middle" fill="#d1495b">▲ FRONT</text></svg>';
  function buildLevel(L) {
    var wrap = u.el("div", { class: "da-wrap" }); L.stage.appendChild(wrap);
    var area = u.el("div", { class: "da-build" }), bench = u.el("div", { class: "da-bench", role: "group", "aria-label": "workbench" }), tray = u.el("div", { class: "da-tray" });
    var info = u.el("div", { class: "da-info", html: "Pick a part, then click where it goes. Or drag it!" });
    area.appendChild(bench); area.appendChild(tray); wrap.appendChild(area);
    tray.appendChild(info);
    var left = {}, sel = null, mistakes = 0, slotEls = {}, centerStage = 0, done = false, props = { m_fl: 1, m_fr: 1, m_bl: 1, m_br: 1 }, phase = "build";
    var partBtns = {};
    PARTS.forEach(function (p) {
      left[p.id] = p.n;
      var b = u.el("button", { class: "da-part", html: '<span class="ico">' + p.icon + "</span><span><b>" + p.name + '</b><small class="cnt"></small></span>' });
      partBtns[p.id] = b; tray.appendChild(b);
      b.onclick = function () { if (!b.dragged) choose(p.id); b.dragged = false; };
      dragify(b, p.id);
    });
    function refresh() {
      PARTS.forEach(function (p) {
        var b = partBtns[p.id];
        b.classList.toggle("gone", left[p.id] <= 0);
        b.classList.toggle("sel", sel === p.id);
        b.disabled = p.id !== "frame" && left.frame > 0;
        b.querySelector(".cnt").textContent = left[p.id] > 1 ? "× " + left[p.id] : p.id !== "frame" && left.frame > 0 ? "place the frame first" : "";
      });
      Object.keys(slotEls).forEach(function (k) { slotEls[k].classList.toggle("glow", !!sel && !slotEls[k].classList.contains("full") && (k === "frame") === (sel === "frame")); });
    }
    Object.keys(SLOTS).forEach(function (k) {
      var g = SLOTS[k];
      var s = u.el("button", { class: "da-slot", dataset: { slot: k }, "aria-label": k === "frame" ? "workbench" : "slot", text: k === "frame" ? "Workbench: the frame goes here" : "",
        style: { left: (g[0] - g[2] / 2) + "%", top: (g[1] - g[3] / 2) + "%", width: g[2] + "%", height: g[3] + "%", display: k === "frame" ? "" : "none", fontSize: k === "frame" ? "1rem" : "" } });
      s.onclick = function () { if (phase === "props") toggleProp(k); else if (sel) place(sel, k); };
      slotEls[k] = s; bench.appendChild(s);
    });
    function choose(id) {
      if (phase !== "build" || left[id] <= 0) return;
      sel = id; RQ.audio.sfx("select");
      var p = PARTS.filter(function (q) { return q.id === id; })[0];
      info.innerHTML = '<span style="font-size:1.4em">' + p.icon + "</span> " + md(p.info);
      refresh();
    }
    function place(id, slot) {
      if (phase !== "build" || !L.alive) return;
      var p = PARTS.filter(function (q) { return q.id === id; })[0], el = slotEls[slot];
      if (!el || el.classList.contains("full") && slot !== "center") return;
      var ok = p.slots.indexOf(slot) >= 0;
      if (ok && slot === "center") ok = (id === "esc" && centerStage === 0) || (id === "fc" && centerStage === 1);
      if (!ok) {
        mistakes++; RQ.audio.sfx("bad"); el.classList.remove("no"); void el.offsetWidth; bench.classList.add("shake"); L.timeout(function () { bench.classList.remove("shake"); }, 400);
        L.toast(id === "fc" && slot === "center" && centerStage === 0 ? "The **ESC board** goes underneath first. Then the brain on top!" : "Not there! Read the hint: " + p.info.split(". ").slice(-1)[0], "bad", 3200);
        return;
      }
      RQ.audio.sfx("snap"); left[id]--;
      if (id === "frame") {
        bench.insertAdjacentHTML("afterbegin", FRAME_SVG); el.classList.add("full"); el.style.display = "none";
        Object.keys(slotEls).forEach(function (k) { if (k !== "frame") slotEls[k].style.display = ""; });
      } else {
        if (slot === "center") { centerStage++; el.innerHTML = PART_SVG[id]; if (centerStage === 2) el.classList.add("full"); }
        else { el.innerHTML = PART_SVG[id]; el.classList.add("full"); }
      }
      RQ.ui.float(innerWidth / 2, innerHeight / 2, "✓", "#2f9e4f");
      if (left[id] <= 0) sel = null;
      refresh();
      if (PARTS.every(function (q) { return left[q.id] <= 0; })) propsPhase();
    }
    // drag and drop with pointer events (mouse + touch)
    function dragify(b, id) {
      var ghost = null, sx = 0, sy = 0;
      L.on(b, "pointerdown", function (e) { if (b.disabled) return; sx = e.clientX; sy = e.clientY; ghost = null; b.dragged = false; try { b.setPointerCapture(e.pointerId); } catch (er) { } });
      L.on(b, "pointermove", function (e) {
        if (!b.hasPointerCapture || !b.hasPointerCapture(e.pointerId)) return;
        if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { choose(id); ghost = u.el("div", { class: "da-ghost", text: PARTS.filter(function (q) { return q.id === id; })[0].icon }); document.body.appendChild(ghost); b.dragged = true; }
        if (ghost) { ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px"; }
      });
      L.on(b, "pointerup", function (e) {
        if (!ghost) return;
        ghost.remove(); ghost = null;
        var t = document.elementFromPoint(e.clientX, e.clientY), s = t && t.closest && t.closest(".da-slot");
        if (s) place(id, s.dataset.slot);
      });
    }
    // prop directions
    function drawProps() {
      ["m_fl", "m_fr", "m_bl", "m_br"].forEach(function (k) {
        var cw = props[k] === 1, el = slotEls[k];
        el.classList.add("prop");
        el.innerHTML = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="rgba(207,233,255,.85)" stroke="#1d2b3a" stroke-width="2.5"/>' +
          '<path d="' + (cw ? "M20 6 A14 14 0 1 1 6 20" : "M20 6 A14 14 0 1 0 34 20") + '" fill="none" stroke="' + (cw ? "#d1495b" : "#2b7bd0") + '" stroke-width="4"/>' +
          '<path d="' + (cw ? "M6 20 L2 13 L11 14 Z" : "M34 20 L38 13 L29 14 Z") + '" fill="' + (cw ? "#d1495b" : "#2b7bd0") + '"/><text x="20" y="24" font-size="9" font-weight="700" text-anchor="middle">' + (cw ? "CW" : "CCW") + "</text></svg>";
      });
    }
    function toggleProp(k) { if (!/^m_/.test(k)) return; props[k] = -props[k]; RQ.audio.sfx("tick"); drawProps(); }
    var testBtn = u.el("button", { class: "btn big go", html: "🚁 Test hover" });
    function propsPhase() {
      phase = "props"; sel = null; refresh(); drawProps();
      info.innerHTML = md("Click each motor to set its propeller: **CW** (clockwise) or **CCW**. Then press **Test hover**.");
      tray.appendChild(testBtn);
      L.talk([["mo", "All parts in, now the propellers! If all four spin the same way, the whole drone twists around."], ["mo", "Props across from each other spin the same way. Props side by side spin opposite ways."]]);
    }
    testBtn.onclick = function () {
      if (done) return;
      var ok = props.m_fl === props.m_br && props.m_fr === props.m_bl && props.m_fl !== props.m_fr;
      if (ok) {
        done = true; RQ.audio.sfx("powerup"); bench.style.transition = "transform 1.2s cubic-bezier(.3,1.4,.5,1)"; bench.style.transform = "translateY(-40px) scale(1.04)";
        var pr = proto();
        L.timeout(function () { L.win({ stars: scoreStars(mistakes, 1, 4), msg: "It hovers! The twists of the CW and CCW props cancel out. ReSeed's prototype model: **" + pr.endurance_min + " min** without cargo (less when loaded), up to **" + pr.max_payload_g + " g** of cargo, **" + pr.rolls_per_sortie + "** seed roll.", stats: { "Wrong tries": mistakes } }); }, 1500);
      } else {
        mistakes++; RQ.audio.sfx("bad"); L.timeout(function () { RQ.audio.sfx("giggle"); }, 300);
        bench.style.transition = "transform .9s ease-in-out"; bench.style.transform = "rotate(" + (props.m_fl + props.m_fr > 0 ? -360 : 360) + "deg)";
        L.timeout(function () { bench.style.transition = "none"; bench.style.transform = ""; }, 950);
        L.toast("Wheee, it spins like a top! Diagonal props must match, neighbours must be opposite.", "bad", 3600);
      }
    };
    refresh();
    choose("frame");
  }

  /* ------------------------------------------------------------ L3: stick trainer (top view) */
  function stickLevel(L) {
    var root = u.el("div", { class: "da-sim" }); L.stage.appendChild(root);
    var cv = L.canvas({ w: 1000, h: 600, parent: root, fill: true, label: "drone stick trainer, seen from above" }), ctx = cv.ctx;
    var stepEl = u.el("div", { class: "da-step" }); root.appendChild(stepEl);
    var IN = { thr: 0, yaw: 0, pit: 0, rol: 0 }, KEY = {}, touch = { left: null, right: null };
    var PXM = 26, K = 11;   // pixels per metre (ground) and per metre of height
    var D = { x: 0, y: 4, z: 0, h: 0, vx: 0, vy: 0, vz: 0 }, pad = { x: 0, y: 4 };
    var step = 0, rings = [], flag = null, holdT = 0, t0 = 0, courseT = 0, bumps = 0, finished = false;
    function stick(side, labels, name) {
      var el = u.el("div", { class: "da-stick " + side, role: "application", "aria-label": name },
        u.el("div", { class: "name", text: name }), u.el("div", { class: "lab t", text: labels[0] }), u.el("div", { class: "lab b", text: labels[1] }),
        u.el("div", { class: "lab l", text: labels[2] }), u.el("div", { class: "lab r", text: labels[3] }), u.el("div", { class: "knob" }));
      root.appendChild(el);
      function setFrom(e) { var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1; touch[side] = { x: u.clamp(x * 1.3, -1, 1), y: u.clamp(-y * 1.3, -1, 1) }; }
      L.on(el, "pointerdown", function (e) { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (er) { } setFrom(e); });
      L.on(el, "pointermove", function (e) { if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) setFrom(e); });
      function off() { touch[side] = null; }
      L.on(el, "pointerup", off); L.on(el, "pointercancel", off); L.on(el, "lostpointercapture", off);
      return el;
    }
    var sL = stick("left", ["W ▲ up", "S ▼ down", "A ⟲", "D ⟳"], "Throttle + Yaw"), sR = stick("right", ["↑ forward", "↓ back", "←", "→"], "Pitch + Roll");
    L.on(window, "keydown", function (e) { if (document.querySelector(".rq-overlay, .rq-talk")) return; KEY[e.key.toLowerCase()] = true; if (/^arrow/.test(e.key.toLowerCase())) e.preventDefault(); });
    L.on(window, "keyup", function (e) { KEY[e.key.toLowerCase()] = false; });
    L.on(window, "blur", function () { KEY = {}; });
    function inputs() {
      var k = function (a) { return KEY[a] ? 1 : 0; };
      IN.thr = touch.left ? touch.left.y : k("w") - k("s");
      IN.yaw = touch.left ? touch.left.x : k("d") - k("a");
      IN.pit = touch.right ? touch.right.y : k("arrowup") - k("arrowdown");
      IN.rol = touch.right ? touch.right.x : k("arrowright") - k("arrowleft");
      [[sL, IN.yaw, IN.thr], [sR, IN.rol, IN.pit]].forEach(function (s) { s[0].querySelector(".knob").style.transform = "translate(" + s[1] * 44 + "px," + -s[2] * 44 + "px)"; });
    }
    function arena() { return { w: cv.w / PXM / 2 - 1.5, h: 600 / PXM / 2 - 1.5 }; }
    function fwd() { return { x: Math.sin(D.h), y: -Math.cos(D.h) }; }
    function clampRing(r) { var A = arena(); r.x = u.clamp(r.x, -A.w + 2, A.w - 2); r.y = u.clamp(r.y, -A.h + 2, A.h - 3); return r; }
    var STEPS = [
      { html: "<b>Throttle</b>: push the <b>left stick UP</b> (<kbd>W</kbd>) to climb into the ring", hint: sL,
        start: function () { rings = [{ x: pad.x, y: pad.y, z: 3 }]; } },
      { html: "<b>Yaw</b>: push the <b>left stick sideways</b> (<kbd>A</kbd> <kbd>D</kbd>) to turn and face the flag", hint: sL,
        start: function () { rings = []; var a = D.h + 2.1; flag = { x: D.x + Math.sin(a) * 6, y: D.y - Math.cos(a) * 6, a: a }; clampRing(flag); flag.a = Math.atan2(flag.x - D.x, -(flag.y - D.y)); } },
      { html: "<b>Pitch</b>: push the <b>right stick UP</b> (<kbd>↑</kbd>) to fly forward through the ring", hint: sR,
        start: function () { flag = null; var f = fwd(); rings = [clampRing({ x: D.x + f.x * 7, y: D.y + f.y * 7, z: 3 })]; } },
      { html: "<b>Roll</b>: push the <b>right stick sideways</b> (<kbd>←</kbd> <kbd>→</kbd>) to slide into the ring", hint: sR,
        start: function () { var f = fwd(), r = { x: -f.y, y: f.x }, A = arena(), side = Math.abs(D.x + r.x * 6) < A.w - 2 && Math.abs(D.y + r.y * 6) < A.h - 2 ? 1 : -1; rings = [clampRing({ x: D.x + r.x * 6 * side, y: D.y + r.y * 6 * side, z: 3 })]; } },
      { html: "<b>Course!</b> Fly through every ring in order, then land on the pad", hint: null,
        start: function () { var A = arena(); rings = [[-.5, -.5, 2], [.5, -.6, 4], [.75, .3, 3], [0, .1, 5], [-.7, .25, 2.5]].map(function (q) { return clampRing({ x: q[0] * A.w, y: q[1] * A.h, z: q[2] }); }); courseT = 0; } },
      { html: "Now <b>land</b> on the pad: hold the <b>left stick down</b> (<kbd>S</kbd>) right over it", hint: sL, start: function () { rings = []; } }
    ];
    function startStep(i) {
      step = i; holdT = 0; STEPS[i].start(); stepEl.innerHTML = (i < 4 ? "Lesson " + (i + 1) + " of 4 · " : "") + STEPS[i].html;
      [sL, sR].forEach(function (s) { s.classList.toggle("hint", STEPS[i].hint === s); });
      L.hud.set("step", "🎓 " + Math.min(i + 1, 5) + " / 5");
    }
    function inRing(r) { return Math.hypot(D.x - r.x, D.y - r.y) < 1.5 && Math.abs(D.z - r.z) < .9; }
    L.loop(function (dt, t) {
      if (document.querySelector(".rq-talk")) return;
      inputs();
      // flight model (game version of Loiter mode): sticks set target speeds, the drone eases towards them
      var air = D.z > .05;
      D.vz += (IN.thr * 2.5 - D.vz) * Math.min(1, dt * 4);
      if (air) D.h += IN.yaw * 2.1 * dt;
      var f = fwd(), r = { x: -f.y, y: f.x };
      var tvx = air ? (f.x * IN.pit + r.x * IN.rol) * 5 : 0, tvy = air ? (f.y * IN.pit + r.y * IN.rol) * 5 : 0;
      D.vx += (tvx - D.vx) * Math.min(1, dt * 2.2); D.vy += (tvy - D.vy) * Math.min(1, dt * 2.2);
      D.x += D.vx * dt; D.y += D.vy * dt; D.z = u.clamp(D.z + D.vz * dt, 0, 8);
      if (D.z === 0) { D.vx *= .8; D.vy *= .8; }
      var A = arena();
      if (Math.abs(D.x) > A.w || Math.abs(D.y) > A.h) { D.x = u.clamp(D.x, -A.w, A.w); D.y = u.clamp(D.y, -A.h, A.h); D.vx *= -.4; D.vy *= -.4; if (t - (D.bumpT || 0) > .6) { D.bumpT = t; bumps++; RQ.audio.sfx("bad"); L.toast("Bonk! That's the net around the field.", "bad", 1400); } }
      if (step === 4) courseT += dt;
      // lesson logic
      if (!finished) {
        if (step === 1) {
          var diff = Math.abs(Math.atan2(Math.sin(D.h - flag.a), Math.cos(D.h - flag.a)));
          holdT = diff < .26 ? holdT + dt : 0;
          if (holdT > .5) pass();
        } else if (step === 5) {
          if (D.z < .05 && Math.hypot(D.x - pad.x, D.y - pad.y) < 1.6) finish();
        } else if (rings.length && inRing(rings[0])) {
          rings.shift(); RQ.audio.sfx("coin"); RQ.ui.float(innerWidth / 2, innerHeight / 2 - 60, "+1 ring", "#2f9e4f");
          if (!rings.length) pass();
        }
      }
      if (KEY.w || KEY.s || Math.abs(IN.thr) > .1 && Math.random() < .15) { }
      draw(t);
    });
    function pass() { RQ.audio.sfx("good"); if (step < STEPS.length - 1) startStep(step + 1); }
    function finish() {
      finished = true; RQ.audio.sfx("win");
      var stars = courseT <= 50 && bumps <= 1 ? 3 : courseT <= 90 ? 2 : 1;
      L.timeout(function () { L.win({ stars: stars, msg: "Throttle, yaw, pitch and roll: you flew them all!", stats: { "Course time": Math.round(courseT) + " s", "Net bonks": bumps } }); }, 500);
    }
    function S(x, y, z) { return { x: cv.w / 2 + x * PXM, y: 300 + y * PXM - (z || 0) * K }; }
    function draw(t) {
      var W = cv.w;
      ctx.fillStyle = "#8fd16f"; ctx.fillRect(0, 0, W, 600);
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1;
      for (var gx = (W / 2) % PXM; gx < W; gx += PXM) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, 600); ctx.stroke(); }
      for (var gy = 300 % PXM; gy < 600; gy += PXM) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      var A = arena(), c1 = S(-A.w, -A.h), c2 = S(A.w, A.h);
      ctx.setLineDash([10, 8]); ctx.strokeStyle = "rgba(29,43,58,.5)"; ctx.lineWidth = 3; ctx.strokeRect(c1.x, c1.y, c2.x - c1.x, c2.y - c1.y); ctx.setLineDash([]);
      // trees outside the safety net
      for (var ti = 0; ti < 26; ti++) {
        var side = ti % 4, f = ((ti * 37) % 26) / 26, tx = side < 2 ? 20 + f * (W - 40) : side === 2 ? 14 : W - 14, ty = side === 0 ? 10 : side === 1 ? 590 : 30 + f * 540;
        if (side < 2 && (tx < 230 || tx > W - 230) && side === 1) continue;
        ctx.fillStyle = "#3f9a49"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(tx, ty, 16 + (ti % 3) * 4, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#5cbf63"; ctx.beginPath(); ctx.arc(tx - 4, ty - 4, 7, 0, 7); ctx.fill();
      }
      // pad
      var p = S(pad.x, pad.y);
      ctx.fillStyle = "#4a5b6d"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * PXM, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffd84d"; ctx.font = "700 30px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("H", p.x, p.y + 2);
      if (flag) {
        var fp = S(flag.x, flag.y);
        ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fp.x, fp.y); ctx.lineTo(fp.x, fp.y - 60); ctx.stroke();
        ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.moveTo(fp.x, fp.y - 60); ctx.lineTo(fp.x + 36 + Math.sin(t * 6) * 4, fp.y - 50); ctx.lineTo(fp.x, fp.y - 40); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // rings: shadow on the ground, ring at its height
      rings.slice().reverse().forEach(function (r, i) {
        var first = r === rings[0], g = S(r.x, r.y), hgt = S(r.x, r.y, r.z), match = Math.abs(D.z - r.z) < .9;
        ctx.fillStyle = "rgba(29,43,58,.18)"; ctx.beginPath(); ctx.ellipse(g.x, g.y, 1.5 * PXM, 1.5 * PXM * .5, 0, 0, 7); ctx.fill();
        ctx.setLineDash([4, 5]); ctx.strokeStyle = "rgba(29,43,58,.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(hgt.x, hgt.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = first ? 7 : 4; ctx.strokeStyle = first ? (match ? "#2f9e4f" : "#ffb020") : "rgba(255,255,255,.7)";
        ctx.beginPath(); ctx.ellipse(hgt.x, hgt.y, 1.5 * PXM, 1.5 * PXM * .55, 0, 0, 7); ctx.stroke();
        if (first) { ctx.fillStyle = "#1d2b3a"; ctx.font = "700 15px Fredoka, sans-serif"; ctx.fillText(r.z + " m high", hgt.x, hgt.y - 30); }
      });
      // drone shadow + drone (higher = drawn higher and a bit bigger)
      var sh = S(D.x, D.y), dp = S(D.x, D.y, D.z), sc = 1 + D.z * .05;
      ctx.fillStyle = "rgba(29,43,58,.25)"; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 30, 15, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(dp.x, dp.y); ctx.scale(sc, sc * .85); ctx.rotate(D.h);
      ctx.lineCap = "round";
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
        ctx.strokeStyle = q[1] < 0 ? "#d1495b" : "#33465a"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(q[0] * 24, q[1] * 24); ctx.stroke();
      });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q, i) {
        ctx.fillStyle = "rgba(207,233,255," + (D.z > .05 || IN.thr > 0 ? .55 + .3 * Math.abs(Math.sin(t * 40 + i)) : .9) + ")"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(q[0] * 24, q[1] * 24, 15, 0, 7); ctx.fill(); ctx.stroke();
      });
      ctx.fillStyle = "#2b7bd0"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; u.rr(ctx, -12, -15, 24, 30, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffd84d"; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(7, -14); ctx.lineTo(-7, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      // telemetry
      ctx.fillStyle = "rgba(255,253,247,.92)"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; u.rr(ctx, 14, 14, 170, 78, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1d2b3a"; ctx.font = "600 16px Fredoka, sans-serif"; ctx.textAlign = "left";
      ctx.fillText("⬆ height " + D.z.toFixed(1) + " m", 26, 38);
      ctx.fillText("🧭 heading " + Math.round(((D.h * 180 / Math.PI) % 360 + 360) % 360) + "°", 26, 64);
      if (step === 4) { ctx.fillText("⏱ " + Math.round(courseT) + " s", 26, 86); }
    }
    window.__daTrainer = { D: D, rings: function () { return rings; }, step: function () { return step; }, flag: function () { return flag; }, pad: pad };   // read-only handle for automated tests
    startStep(0);
  }

  /* ------------------------------------------------------------ L4: pre-flight checklist */
  function art(kind, bad) {
    var s = '<svg viewBox="0 0 240 120" aria-hidden="true">';
    if (kind === "props") s += '<ellipse cx="120" cy="60" rx="100" ry="16" fill="#cfe9ff" stroke="#1d2b3a" stroke-width="4"/><circle cx="120" cy="60" r="12" fill="#1d2b3a"/>' + (bad ? '<path d="M190 48 L198 60 L188 66 L196 74" fill="none" stroke="#d1495b" stroke-width="5"/>' : "");
    else if (kind === "battery") s += bad === "puffy" ? '<path d="M40 30 Q120 0 200 30 Q215 60 200 90 Q120 120 40 90 Q25 60 40 30 Z" fill="#ffd84d" stroke="#1d2b3a" stroke-width="4"/><text x="120" y="68" font-size="20" font-weight="700" text-anchor="middle" fill="#d1495b">PUFFY!</text>'
      : '<rect x="30" y="30" width="170" height="60" rx="10" fill="#fff" stroke="#1d2b3a" stroke-width="4"/><rect x="200" y="48" width="12" height="24" fill="#1d2b3a"/><rect x="36" y="36" width="' + (bad ? 50 : 158) + '" height="48" rx="6" fill="' + (bad ? "#d1495b" : "#2f9e4f") + '"/><text x="115" y="68" font-size="22" font-weight="700" text-anchor="middle">' + (bad ? "30%" : "100%") + "</text>";
    else if (kind === "gps") { for (var i = 0; i < (bad ? 3 : 14); i++) s += '<text x="' + (20 + (i % 7) * 30) + '" y="' + (40 + Math.floor(i / 7) * 34) + '" font-size="22">🛰️</text>'; s += '<text x="120" y="112" font-size="18" font-weight="700" text-anchor="middle" fill="' + (bad ? "#d1495b" : "#2f9e4f") + '">' + (bad ? "No fix · 3 satellites" : "3D fix · 14 satellites") + "</text>"; }
    else if (kind === "radio") s += '<rect x="70" y="20" width="100" height="80" rx="16" fill="#4a5b6d" stroke="#1d2b3a" stroke-width="4"/><circle cx="100" cy="60" r="14" fill="#1d2b3a"/><circle cx="140" cy="60" r="14" fill="#1d2b3a"/><circle cx="120" cy="34" r="6" fill="' + (bad ? "#555" : "#7ee787") + '"/><text x="120" y="116" font-size="16" font-weight="700" text-anchor="middle" fill="' + (bad ? "#d1495b" : "#2f9e4f") + '">' + (bad ? "Transmitter OFF" : "Link 100 %") + "</text>";
    else if (kind === "people") s += '<rect x="0" y="80" width="240" height="40" fill="#8fd16f"/><path d="M10 40 Q120 0 230 40" fill="none" stroke="#2b7bd0" stroke-width="3" stroke-dasharray="8 6"/>' + (bad ? '<text x="90" y="92" font-size="34">🧺</text><text x="120" y="90" font-size="34">👨‍👩‍👧</text>' : '<text x="110" y="100" font-size="30">🌼</text>');
    else if (kind === "airport") s += '<text x="20" y="80" font-size="40">🏠</text><text x="' + (bad ? 150 : 190) + '" y="80" font-size="40">✈️</text><text x="120" y="112" font-size="17" font-weight="700" text-anchor="middle" fill="' + (bad ? "#d1495b" : "#2f9e4f") + '">' + (bad ? "Airport 2 km away" : "Nearest airport 25 km away") + "</text>";
    else if (kind === "sight") s += '<rect x="0" y="80" width="240" height="40" fill="#8fd16f"/>' + (bad ? '<path d="M110 80 Q150 0 200 80 Z" fill="#6fae5c" stroke="#1d2b3a" stroke-width="3"/>' : "") + '<text x="14" y="78" font-size="32">🧍</text><text x="' + (bad ? 196 : 170) + '" y="' + (bad ? 74 : 40) + '" font-size="26">🚁</text>';
    else if (kind === "pilot") s += bad ? '<text x="40" y="80" font-size="44">🧍</text><text x="140" y="70" font-size="30">🎮❓</text>' : '<text x="40" y="80" font-size="44">🧑‍✈️</text><text x="120" y="72" font-size="28">🎮 + 🛑</text>';
    else if (kind === "weather") s += bad ? '<text x="70" y="80" font-size="56">⛈️</text>' : '<text x="70" y="80" font-size="56">🌤️</text><text x="120" y="112" font-size="16" font-weight="700" text-anchor="middle">wind 3 m/s</text>';
    return s + "</svg>";
  }
  var CHECKS = [
    { id: "props", name: "Propellers", ok: "Smooth and tight. No cracks.", bad: "One propeller has a **crack** at the tip.", fix: "The adult pilot replaces the cracked propeller. A broken prop can fly off!" },
    { id: "battery", name: "Battery", ok: "Charged to 100 %, cool and flat.", bad: "This LiPo battery is **puffy** (swollen).", badKind: "puffy", fix: "Never use a puffy LiPo: it can catch fire. Leave it alone and tell an adult." },
    { id: "gps", name: "GPS lock", ok: "GPS position found (3D fix) using 14 satellites.", bad: "**No fix**: only 3 satellites.", fix: "Wait for a GPS lock. RTL needs GPS to find home." },
    { id: "radio", name: "Radio link", ok: "Transmitter on, link 100 %.", bad: "The pilot's **transmitter is off**.", fix: "Switch on the transmitter first, then the drone." },
    { id: "people", name: "Clear area", ok: "Nobody under the flight path.", bad: "A family **picnic** is right under the flight path.", fix: "Never fly over people. Wait, or move the flight path." },
    { id: "airport", name: "Airspace", ok: "Nearest airport is far away.", bad: "An **airport** is only 2 km away.", fix: "Local drone rules limit flying near airports. Pick another site." },
    { id: "sight", name: "Line of sight", ok: "You can see the whole route.", bad: "The route goes **behind a hill**.", fix: "Change the route so you can always see the drone." },
    { id: "pilot", name: "Safety pilot", ok: "Safety pilot ready, hand on the **kill switch**.", bad: "**Nobody** is holding the transmitter.", fix: "A trained adult safety pilot must hold the kill switch, as `demo_flight.py` says." },
    { id: "weather", name: "Weather", ok: "Light breeze, 3 m/s.", bad: "A **thunderstorm** is coming.", fix: "Wait for better weather. Storms and drones don't mix." }
  ];
  function checkLevel(L) {
    var wrap = u.el("div", { class: "da-wrap" }); L.stage.appendChild(wrap);
    var box = u.el("div", { class: "da-check" }), list = u.el("div", { class: "da-list" }), insp = u.el("div", { class: "da-inspect" });
    box.appendChild(list); box.appendChild(insp); wrap.appendChild(box);
    var R = L.rng, order = CHECKS.slice(), mistakes = 0, i = 0, busy = false;
    // 4 or 5 problems, never in a row of three
    var badSet = u.shuffle(order.map(function (c, k) { return k; }), R).slice(0, 4 + (R() < .5 ? 1 : 0));
    order.forEach(function (c, k) { c.isBad = badSet.indexOf(k) >= 0; });
    list.innerHTML = "<h3>📋 Pre-flight</h3><ul>" + order.map(function (c, k) { return '<li data-k="' + k + '"><span class="st">⬜</span>' + c.name + "</li>"; }).join("") + "</ul>";
    function show() {
      var c = order[i];
      u.$$("li", list).forEach(function (li, k) { li.classList.toggle("now", k === i); });
      L.hud.set("check", "📋 " + (i + 1) + " / " + order.length);
      insp.innerHTML = "";
      insp.appendChild(u.el("h2", { text: c.name }));
      insp.appendChild(u.el("div", { class: "art", html: art(c.id, c.isBad ? (c.badKind || true) : false) }));
      insp.appendChild(u.el("p", { html: md(c.isBad ? c.bad : c.ok) }));
      var btns = u.el("div", { class: "btns" },
        u.el("button", { class: "btn big go", html: "✅ Ready <kbd>1</kbd>", onclick: function () { answer(false); } }),
        u.el("button", { class: "btn big warn", html: "🔧 Fix it <kbd>2</kbd>", onclick: function () { answer(true); } }));
      insp.appendChild(btns);
    }
    function mark(k, s) { list.querySelector('li[data-k="' + k + '"] .st').textContent = s; }
    function answer(fix) {
      if (busy || !L.alive) return;
      var c = order[i];
      if (fix !== c.isBad) {
        mistakes++; RQ.audio.sfx("bad");
        L.toast(c.isBad ? "Look again! Something here is **not** safe." : "That one is fine. No fix needed!", "bad", 2400);
        return;
      }
      busy = true;
      if (fix) { RQ.audio.sfx("snap"); mark(i, "🔧"); L.toast("🔧 " + c.fix, "good", 3200); }
      else { RQ.audio.sfx("good"); mark(i, "✅"); }
      L.timeout(function () {
        mark(i, "✅"); busy = false; i++;
        if (i < order.length) show(); else armIt();
      }, fix ? 2200 : 500);
    }
    function armIt() {
      insp.innerHTML = "";
      insp.appendChild(u.el("h2", { text: "All green! Ready to arm" }));
      insp.appendChild(u.el("div", { class: "art", html: '<svg viewBox="0 0 240 120"><g id="da-arm"><g transform="translate(60 25)">' + PICS.quad + "</g></g></svg>" }));
      insp.appendChild(u.el("p", { html: md("**Arming** lets the motors spin. From now on, props are dangerous!") }));
      var b = u.el("button", { class: "btn big primary pulse", html: "🔓 ARM + take off" });
      b.onclick = function () {
        b.disabled = true; RQ.audio.sfx("powerup");
        var g = insp.querySelector("#da-arm"); if (g) { g.style.transition = "transform 1.4s ease-in"; g.style.transform = "translateY(-60px)"; }
        L.timeout(function () { L.win({ stars: scoreStars(mistakes, 0, 2), msg: "Every check done. That's how real pilots stay safe!", stats: { "Mistakes": mistakes } }); }, 1500);
      };
      insp.appendChild(b);
    }
    L.on(window, "keydown", function (e) {
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      if (e.key === "1") answer(false); else if (e.key === "2") answer(true);
    });
    show();
  }

  /* ------------------------------------------------------------ L5: flight modes + emergencies */
  var EMERGENCIES = [
    { alarm: "🔋 LOW BATTERY: 25 %", bat: 25, link: "ok", sats: 14, dist: 380, ans: "RTL", spot: [.78, .3],
      why: [["koa", "**RTL**: fly home now, while there's still enough battery! ReSeed's battery plans keep a 25 % reserve for this."]] },
    { alarm: "📻 RADIO LINK LOST", bat: 70, link: "lost", sats: 15, dist: 300, ans: "RTL", spot: [.7, .62],
      why: [["koa", "**RTL**: if the failsafe is set up, the drone uses GPS to fly home when the radio is lost! It needs a good GPS fix and a saved home point."]] },
    { alarm: "🛰️ GPS GLITCH: position jumping", bat: 60, link: "ok", sats: 4, dist: 120, ans: "LAND", spot: [.45, .35],
      why: [["koa", "**LAND**: RTL and HOLD need GPS to know where the drone is! Come down gently, right now."]] },
    { alarm: "🚶 PERSON WALKING UNDER THE PATH", bat: 75, link: "ok", sats: 14, dist: 200, ans: "HOLD", spot: [.6, .45],
      why: [["koa", "**HOLD**: stop and hover in place until they have walked past! Never fly over people."]] },
    { alarm: "🪫 BATTERY CRITICAL: 8 %", bat: 8, link: "ok", sats: 14, dist: 650, ans: "LAND", spot: [.9, .2],
      why: [["koa", "**LAND**: it's too far to make it home on 8 %! Land now in a clear spot, and an adult can fetch it."]] },
    { alarm: "⛈️ STORM CLOUDS COMING", bat: 70, link: "ok", sats: 14, dist: 260, ans: "RTL", spot: [.66, .7],
      why: [["koa", "**RTL**! Plenty of battery and good GPS: head home before the storm arrives."]] }
  ];
  var MODES = [["RTL", "🏠", "fly home"], ["LAND", "⬇️", "land here"], ["HOLD", "✋", "hover in place"]];
  function modesLevel(L) {
    var wrap = u.el("div", { class: "da-wrap" }); L.stage.appendChild(wrap);
    var mistakes = 0;
    // Part A: put demo_flight.py's steps in order
    var codeBox = u.el("div", { class: "da-code" });
    wrap.appendChild(u.el("p", { html: md("Put the demo-day flight in order, just like `reseed/demo_flight.py`. Drag lines or use ▲ ▼.") }));
    wrap.appendChild(codeBox);
    var lines = [
      "m.wait_heartbeat()              # hello, drone?",
      "m.set_mode(\"GUIDED\")            # the computer flies",
      "m.arducopter_arm()              # motors on!",
      "m.mav.command_long_send(...TAKEOFF...)  # climb",
      "vel_target(-un * jerk_speed, -ue * jerk_speed)  # jerk back",
      "pos_target(0, 0, -alt)          # back to the start",
      "m.set_mode(\"LAND\")              # come down"
    ];
    var pz = RQ.code.parsons(codeBox, lines);
    var chk = u.el("button", { class: "btn big primary", html: "✔ Check the order" });
    wrap.appendChild(chk);
    chk.onclick = function () {
      if (pz.check()) { chk.disabled = true; L.timeout(function () { if (L.alive) partB(); }, 900); }
      else { mistakes++; L.toast(mistakes >= 2 ? "💡 Hello first, then GUIDED, then **arm** before take-off. LAND is last." : "Not yet! What must happen before take-off?", "bad", 3200); }
    };
    // Part B: emergencies at the ground control station
    function partB() {
      L.talk([["koa", "Great, now you're at the **ground control station**! Things can go wrong in the air."], ["koa", "For each alarm, pick a flight mode: **RTL** flies home, **LAND** comes down, **HOLD** hovers."]]).then(function () {
        if (!L.alive) return;
        wrap.innerHTML = "";
        var gcs = u.el("div", { class: "da-gcs" }), map = u.el("div", { class: "da-map" }), panel = u.el("div", { class: "da-panel" });
        gcs.appendChild(map); gcs.appendChild(panel); wrap.appendChild(gcs);
        var cv = L.canvas({ w: 360, h: 440, parent: map, fill: true, label: "map of the flight" }), ctx = cv.ctx;
        var gauges = u.el("div", { class: "da-gauge" }), alarm = u.el("div", { class: "da-alarm" }), modes = u.el("div", { class: "da-modes" });
        panel.appendChild(alarm); panel.appendChild(gauges); panel.appendChild(modes);
        var k = 0, anim = null, busy = false, list = u.shuffle(EMERGENCIES, L.rng);
        MODES.forEach(function (m, i) {
          modes.appendChild(u.el("button", { class: "btn big", html: m[1] + " " + m[0] + "<small>" + m[2] + " · " + (i + 1) + "</small>", onclick: function () { pick(m[0]); } }));
        });
        function show() {
          var e = list[k]; anim = { mode: null, t: 0, x: e.spot[0], y: e.spot[1] };
          alarm.textContent = e.alarm;
          gauges.innerHTML = "MODE  <span class=\"good\">GUIDED</span><br>BATT  <span class=\"" + (e.bat < 30 ? "bad" : "good") + "\">" + e.bat + " %</span><br>LINK  <span class=\"" +
            (e.link === "ok" ? "good\">OK" : "bad\">LOST") + "</span><br>GPS   <span class=\"" + (e.sats < 6 ? "bad\">JUMPING" : "good\">OK, " + e.sats + " sats") + "</span><br>HOME  " + e.dist + " m";
          L.hud.set("alarm", "🚨 " + (k + 1) + " / " + list.length);
          RQ.audio.sfx("buzz");
        }
        function pick(m) {
          if (busy || !L.alive) return;
          var e = list[k];
          if (m !== e.ans) { mistakes++; RQ.audio.sfx("bad"); L.toast(m === "RTL" && e.sats < 6 ? "RTL needs good GPS to find home!" : m === "HOLD" && e.bat < 10 ? "Hovering still uses battery!" : "Hmm, is that the safest choice? Look at the gauges.", "bad", 2800); return; }
          busy = true; anim.mode = m; anim.t = 0; RQ.audio.sfx("good");
          L.timeout(function () {
            L.talk(e.why).then(function () {
              if (!L.alive) return;
              busy = false; k++;
              if (k < list.length) show();
              else L.win({ stars: scoreStars(mistakes, 1, 3), msg: "Cool head, safe drone. You've earned your **game pilot wings**! 🪽 Real flights need a trained adult pilot.", stats: { "Mistakes": mistakes } });
            });
          }, 1600);
        }
        L.on(window, "keydown", function (ev) { if (document.querySelector(".rq-overlay, .rq-talk")) return; var n = parseInt(ev.key, 10); if (n >= 1 && n <= 3) pick(MODES[n - 1][0]); });
        L.loop(function (dt, t) {
          var W = cv.w, Hh = 440, home = { x: W * .14, y: Hh * .78 };
          ctx.fillStyle = "#a9d98f"; ctx.fillRect(0, 0, W, Hh);
          ctx.fillStyle = "#94c97a"; for (var i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse((i * 173) % W, (i * 97) % Hh, 60, 30, i, 0, 7); ctx.fill(); }
          ctx.fillStyle = "#7cc4e8"; ctx.beginPath(); ctx.ellipse(W * .5, Hh * .9, 120, 26, 0, 0, 7); ctx.fill();
          ctx.fillStyle = "#4a5b6d"; ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(home.x, home.y, 22, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#ffd84d"; ctx.font = "700 22px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("H", home.x, home.y + 1);
          if (!anim) return;
          var e = list[k], dx = anim.x * W, dy = anim.y * Hh, sc = 1;
          if (e.ans === "HOLD" || anim.mode === "HOLD") { ctx.font = "30px sans-serif"; ctx.fillText("🚶", dx + 10, dy + 40); }
          if (e.alarm.indexOf("STORM") >= 0) { ctx.font = "44px sans-serif"; ctx.fillText("⛈️", W * .88, Hh * .3 + Math.sin(t) * 6); }
          if (anim.mode) {
            anim.t += dt;
            if (anim.mode === "RTL") { var q = Math.min(1, anim.t / 1.4); dx = u.lerp(dx, home.x, u.ease.inOut(q)); dy = u.lerp(dy, home.y, u.ease.inOut(q)); if (q >= 1) sc = Math.max(.5, 1 - (anim.t - 1.4) * 2); }
            else if (anim.mode === "LAND") sc = Math.max(.5, 1 - anim.t * .4);
            else { dx += Math.cos(t * 3) * 4; dy += Math.sin(t * 3) * 4; }
          } else { dx += Math.sin(t * 1.3) * 6; dy += Math.cos(t * 1.1) * 4; }
          ctx.setLineDash([8, 7]); ctx.strokeStyle = "rgba(29,43,58,.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(home.x, home.y); ctx.lineTo(dx, dy); ctx.stroke(); ctx.setLineDash([]);
          if (e.sats < 6 && !anim.mode) { ctx.strokeStyle = "rgba(209,73,91,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(dx + Math.sin(t * 9) * 12, dy + Math.cos(t * 7) * 12, 46, 0, 7); ctx.stroke(); }
          ctx.fillStyle = "rgba(29,43,58,.25)"; ctx.beginPath(); ctx.ellipse(dx, dy + 26 * sc, 22 * sc, 7 * sc, 0, 0, 7); ctx.fill();
          ctx.save(); ctx.translate(dx, dy); ctx.scale(sc, sc);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p2) { ctx.strokeStyle = "#1d2b3a"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p2[0] * 16, p2[1] * 16); ctx.stroke(); ctx.fillStyle = "rgba(207,233,255,.9)"; ctx.beginPath(); ctx.arc(p2[0] * 16, p2[1] * 16, 10, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); });
          ctx.fillStyle = "#2b7bd0"; u.rr(ctx, -9, -9, 18, 18, 5); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
          if (anim.mode) { ctx.fillStyle = "#1d2b3a"; ctx.font = "700 18px Fredoka, sans-serif"; ctx.fillText(anim.mode, dx, dy - 36); }
        });
        show();
      });
    }
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g20",
    music: "camp",
    intro: [
      ["koa", "Welcome to Drone Academy! Five lessons earn your **game** pilot wings."],
      ["koa", "Real drones are flown by trained adult pilots who follow local drone rules. Let's learn what they know!"]
    ],
    outro: [
      ["koa", "Game pilot wings, earned! Real flights need a trained adult pilot and local drone rules."],
      ["sprout", "Ready for a real mission? Let's fly Drone Rush!"]
    ],
    levels: [
      { title: "Drone types", goal: "Pick the best drone for each mission", cards: ["drone-types"],
        intro: [["koa", "Every job needs the right drone. Read each mission and pick the best card, or press keys 1 to 6."]],
        play: typesLevel },
      { title: "Build a drone", goal: "Put every part in the right place", cards: ["flight-controller", "prop-direction"],
        intro: [["mo", "Let's build ReSeed's seed drone, a quadcopter. Pick a part and read where it goes."]],
        play: buildLevel },
      { title: "Stick school", goal: "Learn throttle, yaw, pitch and roll", cards: ["sticks"],
        intro: [["koa", "A pilot has two sticks: the **left** one climbs and turns. The **right** one moves you around."],
                ["koa", "Use the keys, or drag the sticks on the screen. Higher drones fly higher on the screen too!"]],
        play: stickLevel },
      { title: "Pre-flight check", goal: "Check everything before you fly", cards: ["preflight"],
        intro: [["koa", "Before every flight, pilots run a checklist. Spot anything that's not safe!"]],
        play: checkLevel },
      { title: "Emergency!", goal: "Know your flight modes", cards: ["flight-modes"],
        intro: [["koa", "ReSeed's demo flight is a Python script that flies the drone in **GUIDED** mode."],
                ["sprout", "`demo_flight.py` says: test in **SITL** first, a pretend drone inside the computer. Safe and smart!"]],
        play: modesLevel }
    ]
  });
})();
