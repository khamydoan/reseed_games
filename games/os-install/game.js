/* g03 Operation Install — give the mission computer Mo built its brain: an operating system.
 * L1 bootable USB + UEFI boot order · L2 pick an OS (Ubuntu / Windows / RHEL) · L3 inspect & partition the disk
 * (a reversible simulator with Undo), a pretend user + password meter, install · L4 first boot: `sudo apt update`
 * in RQ.term · L5 package managers: apt (Ubuntu), dnf (RHEL), winget (Windows), one tiny install command each.
 * Facts: ReSeed CI runs-on ubuntu-latest with Python 3.12 (.github/workflows/tests.yml); project VM = Ubuntu 24.04 LTS. */
(function () {
  "use strict";
  var u = RQ.u, el = u.el;
  var INK = "#1d2b3a";
  var SK = ' stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"';
  var SK3 = ' stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"';
  function sfx(n) { RQ.audio.sfx(n); }
  function toast(t, kind, ms) { RQ.ui.toast(t, kind, ms); }

  /* ------------------------------------------------------------ art (original SVG, no logos copied) */
  function svg(vb, body) { return '<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + "</svg>"; }
  var ART = {
    usb: function (fill, label) {
      fill = u.clamp(fill || 0, 0, 1);
      return svg("0 0 170 80",
        '<rect x="112" y="24" width="50" height="32" rx="4" fill="#d5dce4"' + SK + "/>" +
        '<rect x="126" y="33" width="9" height="7" fill="' + INK + '"/><rect x="142" y="33" width="9" height="7" fill="' + INK + '"/>' +
        '<rect x="8" y="10" width="112" height="60" rx="16" fill="#fff"/>' +
        (fill > 0 ? '<rect x="14" y="16" width="' + (100 * fill).toFixed(1) + '" height="48" rx="11" fill="#e95420"/>' : "") +
        '<rect x="8" y="10" width="112" height="60" rx="16" fill="none"' + SK + "/>" +
        '<text x="64" y="47" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="17" fill="' + INK + '">' + (label || "16 GB") + "</text>");
    },
    hdd: function () {
      return svg("0 0 120 90",
        '<rect x="8" y="10" width="104" height="70" rx="12" fill="#5a6b7d"' + SK + "/>" +
        '<rect x="22" y="22" width="56" height="44" rx="6" fill="#bfe8ff"' + SK3 + "/>" +
        '<path d="M25 63 L42 43 L53 54 L61 47 L75 63 Z" fill="#2f9e4f"/><circle cx="64" cy="33" r="5" fill="#ffd84d"/>' +
        '<path d="M96 32 c-3 -6 -12 -3 -8 4 l8 8 l8 -8 c4 -7 -5 -10 -8 -4z" fill="#ff8fab" stroke="' + INK + '" stroke-width="2"/>' +
        '<circle cx="96" cy="66" r="4" fill="#7ee787"/>');
    },
    laptop: function () {
      return svg("0 0 120 90",
        '<rect x="20" y="10" width="80" height="54" rx="6" fill="#2b3a4b"' + SK + "/>" +
        '<rect x="28" y="18" width="64" height="38" rx="3" fill="#79c0ff"/>' +
        '<path d="M6 70 H114 L106 82 H14 Z" fill="#cfd6de"' + SK + "/>");
    },
    ubuntu: function () {
      var dots = "";
      [-90, 30, 150].forEach(function (a) {
        var r = a * Math.PI / 180;
        dots += '<circle cx="' + (50 + 30 * Math.cos(r)).toFixed(1) + '" cy="' + (50 + 30 * Math.sin(r)).toFixed(1) + '" r="8.5" fill="#fff" stroke="#e95420" stroke-width="3.5"/>';
      });
      return svg("0 0 100 100", '<circle cx="50" cy="50" r="44" fill="#e95420"' + SK + '/><circle cx="50" cy="50" r="23" fill="none" stroke="#fff" stroke-width="9"/>' + dots);
    },
    windows: function () {
      return svg("0 0 100 100", '<rect x="6" y="6" width="88" height="88" rx="18" fill="#e3f0ff"' + SK + "/>" +
        '<rect x="22" y="22" width="26" height="26" rx="3" fill="#2b7bd0"/><rect x="52" y="22" width="26" height="26" rx="3" fill="#2b7bd0"/>' +
        '<rect x="22" y="52" width="26" height="26" rx="3" fill="#2b7bd0"/><rect x="52" y="52" width="26" height="26" rx="3" fill="#2b7bd0"/>');
    },
    rhel: function () {
      return svg("0 0 100 100", '<rect x="6" y="6" width="88" height="88" rx="18" fill="#fde8e8"' + SK + "/>" +
        '<ellipse cx="50" cy="66" rx="38" ry="11" fill="#cc2b2b"' + SK3 + "/>" +
        '<path d="M28 64 C28 40 34 27 50 27 C66 27 72 40 72 64 Z" fill="#cc2b2b"' + SK3 + "/>" +
        '<path d="M29 55 Q50 61 71 55 L71.6 62 Q50 68 28.4 62 Z" fill="' + INK + '"/>');
    },
    truck: function (label, color) {
      return svg("0 0 200 110",
        '<rect x="6" y="14" width="124" height="66" rx="10" fill="' + color + '"' + SK + "/>" +
        '<text x="68" y="57" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="27" fill="#fff">' + label + "</text>" +
        '<path d="M130 34 H164 L188 58 V80 H130 Z" fill="#fff"' + SK + "/>" +
        '<path d="M140 42 H160 L175 57 H140 Z" fill="#9ed8ff"' + SK3 + "/>" +
        '<circle cx="42" cy="86" r="14" fill="#4a5b6d"' + SK + '/><circle cx="42" cy="86" r="5" fill="#cfd6de"/>' +
        '<circle cx="160" cy="86" r="14" fill="#4a5b6d"' + SK + '/><circle cx="160" cy="86" r="5" fill="#cfd6de"/>');
    },
    tower: function (plugged, on) {
      return svg("0 0 130 230",
        '<rect x="10" y="8" width="110" height="214" rx="14" fill="#3b4b5e"' + SK + "/>" +
        '<rect x="26" y="26" width="78" height="12" rx="5" fill="#2b3a4b"/><rect x="26" y="46" width="78" height="12" rx="5" fill="#2b3a4b"/>' +
        '<circle cx="65" cy="100" r="18" fill="' + (on ? "#7ee787" : "#cfd6de") + '"' + SK + "/>" +
        '<path d="M65 89 V100 M57 93 A12 12 0 1 0 73 93" fill="none" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round"/>' +
        '<rect x="45" y="150" width="40" height="16" rx="3" fill="#10161f" stroke="#cfd6de" stroke-width="2.5"/>' +
        (plugged ? '<rect x="38" y="140" width="54" height="34" rx="8" fill="#e95420"' + SK3 + '/><text x="65" y="163" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="15" fill="#fff">USB</text>' : "") +
        '<path d="M26 188 H104 M26 198 H104" stroke="#2b3a4b" stroke-width="4"/>' +
        '<circle cx="100" cy="122" r="5" fill="' + (on ? "#7ee787" : "#4a5b6d") + '"/>');
    }
  };

  /* ------------------------------------------------------------ helpers */
  function restart(node, cls) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
  function shake(node) { restart(node, "shake"); }
  function bounce(node) { restart(node, "oi-bounce"); }
  function floatOn(node, text, color) { var r = node.getBoundingClientRect(); RQ.ui.float(r.left + r.width / 2 - 12, r.top + 8, text, color); }
  function blocked() { return !!document.querySelector(".rq-overlay, .rq-talk"); }
  function stars3(m, a, b) { return m <= a ? 3 : m <= b ? 2 : 1; }
  function titlebar(text) { return el("div", { class: "oi-titlebar" }, el("i"), el("i"), el("i"), el("span", { text: text })); }
  function honk() { RQ.audio.tone({ f: 415, type: "square", d: .11, v: .1, lp: 1400 }); RQ.audio.tone({ f: 415, type: "square", t: .16, d: .16, v: .1, lp: 1400 }); }
  /** Global keys for a level, ignored while a dialog is open or while typing in a text box. */
  function keys(L, fn) {
    L.on(window, "keydown", function (e) {
      if (blocked()) return;
      var tg = e.target, tag = tg && tg.tagName;
      if ((tag === "INPUT" && tg.type !== "range") || tag === "TEXTAREA") return;
      fn(e);
    });
  }
  /** Resolves once, when btn is clicked. */
  function clicked(L, btn) {
    return new Promise(function (res) {
      var done = false;
      btn.onclick = function () { if (done || !L.alive) return; done = true; res(); };
    });
  }
  /** Pointer drag (mouse + touch) with keyboard fallback (Enter/Space on the focused button = click).
   *  o.targets() -> [{el, id}], o.onDrop(target|null, isClick) -> true to keep the dragged position. */
  function draggable(L, node, o) {
    var d = null;
    function hit(e) {
      var ts = o.targets();
      for (var i = 0; i < ts.length; i++) {
        var r = ts[i].el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return ts[i];
      }
      return null;
    }
    L.on(node, "pointerdown", function (e) {
      if (o.enabled && !o.enabled()) return;
      d = { x: e.clientX, y: e.clientY, moved: false };
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      node.style.transition = "none";
    });
    L.on(node, "pointermove", function (e) {
      if (!d) return;
      var dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 8) return;
      d.moved = true; node.classList.add("oi-dragging");
      node.style.transform = "translate(" + dx + "px," + dy + "px)";
      if (o.onHover) o.onHover(hit(e));
    });
    function up(e, cancel) {
      if (!d) return;
      var was = d; d = null; node.classList.remove("oi-dragging");
      if (o.onHover) o.onHover(null);
      var keep = cancel ? false : o.onDrop(was.moved ? hit(e) : null, !was.moved);
      if (!keep && node.isConnected) {
        node.style.transition = "transform .25s cubic-bezier(.3,1.5,.5,1)"; node.style.transform = "";
      }
    }
    L.on(node, "pointerup", function (e) { up(e, false); });
    L.on(node, "pointercancel", function (e) { up(e, true); });
    L.on(node, "click", function (e) { if (e.detail === 0) o.onDrop(null, true); });
  }
  /** Rewrite RQ.term's bash prompt (user@host:~$) into another prompt, e.g. PowerShell's "PS C:\Users\fern>". */
  function promptHook(t) {
    var hook = { text: null, cls: "oi-ps" }, out = t.el.children[1];
    new MutationObserver(function (muts) {
      if (hook.text == null) return;
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1 || !n.classList.contains("line")) return;
          var ps = n.querySelectorAll(":scope > .ps1");
          if (!ps.length) return;
          var last = ps[ps.length - 1];
          while (n.firstChild && n.firstChild !== last) n.removeChild(n.firstChild);
          n.removeChild(last);
          if (n.firstChild && n.firstChild.nodeType === 3) n.firstChild.nodeValue = n.firstChild.nodeValue.replace(/^\$/, "");
          n.insertBefore(el("span", { class: hook.cls, text: hook.text }), n.firstChild);
        });
      });
    }).observe(out, { childList: true });
    return hook;
  }
  function lastLine(t) { return t.el.children[1].lastElementChild; }
  var KNOWN = ["sudo", "apt", "apt-get", "dnf", "yum", "winget", "python3", "python", "y", "yes"];
  /** Ask for one command. counter.n counts wrong tries. opts: {ghost:false, match:RegExp, extraWrong(cmd)->msg|null}. */
  function cmd(t, expect, counter, opts) {
    opts = opts || {};
    var spec = {
      expect: opts.match || expect,
      ghost: opts.ghost === false ? null : expect,
      wrong: function (c) {
        counter.n++;
        if (!spec.ghost) spec.ghost = expect;   // after the first miss the grey letters appear
        var m = opts.extraWrong && opts.extraWrong(c);
        if (m) return m;
        var w = c.split(" ")[0] || "?", e = expect.split(" ")[0];
        if (w !== e && KNOWN.indexOf(w) < 0) return "[r]" + w + ": command not found[/r]  [y]Copy the grey letters. Tab finishes them.[/y]";
        return "[y]So close! Check each letter and space. Tab finishes it for you.[/y]";
      }
    };
    return t.ask(spec);
  }
  var NAMES = ["Fern", "Rocket", "Moss", "Pebble", "Comet"];
  function userName() {
    var x = RQ.save.game("g03").extra;
    return x && NAMES.indexOf(x.user) >= 0 ? x.user : "Fern";
  }

  /* ================================================================== L1: bootable USB + boot order */
  var IMAGES = [
    { id: "iso", icon: "💿", name: "ubuntu-24.04-desktop-amd64.iso", note: "OS installer image · 6 GB", ok: true },
    { id: "cat", icon: "🐱", name: "funny-cat.mp4", note: "a video", why: "That's a cat video, not an operating system! Our installer image ends in **.iso**." },
    { id: "doc", icon: "📄", name: "homework.docx", note: "a document", why: "Homework can't start a computer! Look for the **.iso** image." }
  ];
  var DRIVES = [
    { id: "photos", art: ART.hdd, name: "FAMILY PHOTOS", note: "1 TB drive · 3,000 photos", why: "STOP! Flashing **erases the whole drive**. Grandma's 3,000 photos would vanish!" },
    { id: "usb", art: function () { return ART.usb(0); }, name: "USB stick", note: "16 GB · empty", ok: true },
    { id: "laptop", art: ART.laptop, name: "This laptop's disk", note: "the disk running this laptop", why: "That's the disk this laptop runs on. We'd erase our own tools!" }
  ];

  async function levelBoot(L) {
    var S = el("div", { class: "fill oi" }); L.stage.appendChild(S);
    var oops = 0, pick = { img: null, drive: null }, flashing = false;
    var app = el("div", { class: "oi-window oi-app" }, titlebar("Stick Maker · makes bootable USB sticks"));
    var cols = el("div", { class: "oi-cols" }); app.appendChild(cols); S.appendChild(app);
    function column(n, title) {
      var c = el("div", { class: "oi-col" }, el("h3", { html: '<span class="oi-n">' + n + "</span> " + title }));
      cols.appendChild(c); return c;
    }
    var c1 = column(1, "Pick the image"), c2 = column(2, "Pick the drive"), c3 = column(3, "Flash it!");
    function option(o, col, kind) {
      var b = el("button", { class: "oi-opt", html: '<span class="ic' + (o.art ? "" : " emo") + '">' + (o.art ? o.art() : o.icon) + '</span><span class="tx"><b>' + u.esc(o.name) + "</b><small>" + u.esc(o.note) + "</small></span>" });
      b.onclick = function () {
        if (flashing || !L.alive) return;
        if (!o.ok) {
          oops++; shake(b); b.classList.add("nope"); toast(o.why, "bad", 3400);
          if (o.id === "photos") { sfx("buzz"); L.timeout(function () { sfx("giggle"); }, 320); } else sfx("error");
          return;
        }
        u.$$(".oi-opt", col).forEach(function (x) { x.classList.remove("sel", "nope"); });
        b.classList.add("sel"); sfx("select"); bounce(b); pick[kind] = o; refresh();
      };
      col.appendChild(b);
    }
    IMAGES.forEach(function (o) { option(o, c1, "img"); });
    DRIVES.forEach(function (o) { option(o, c2, "drive"); });
    var big = el("div", { class: "oi-usbbig", html: ART.usb(0) }), status = el("div", { class: "oi-status" });
    var flashBtn = el("button", { class: "btn big primary", html: "⚡ Flash!" });
    c3.appendChild(el("div", { class: "oi-flash" }, big, status, flashBtn));
    function refresh() {
      var ready = !!(pick.img && pick.drive);
      flashBtn.disabled = !ready; flashBtn.classList.toggle("pulse", ready);
      status.innerHTML = ready ? "Ready! Press <b>Flash</b>." : !pick.img ? "Step 1: pick the OS image." : "Step 2: pick the USB stick.";
    }
    refresh();
    await new Promise(function (resolve) {
      flashBtn.onclick = function () {
        if (flashing || flashBtn.disabled) return;
        flashing = true; flashBtn.disabled = true; flashBtn.classList.remove("pulse"); sfx("whoosh");
        u.$$(".oi-opt", cols).forEach(function (b) { b.disabled = true; });
        var t0 = -1, last = 0;
        var stop = L.loop(function (dt, t) {
          if (t0 < 0) t0 = t;
          var k = Math.min(1, (t - t0) / 3.4);
          big.innerHTML = ART.usb(k);
          status.innerHTML = k < .85 ? "Writing… <b>" + Math.round(k / .85 * 100) + "%</b>" : "Checking the copy… 🔍";
          if (t - last > .14) { last = t; sfx("tick"); }
          if (k >= 1) { stop(); resolve(); }
        });
      };
    });
    if (!L.alive) return;
    sfx("powerup"); status.innerHTML = "✅ <b>Bootable USB ready!</b>"; bounce(big);
    await L.wait(1200); if (!L.alive) return;
    await bootOrder(L, S, oops);
  }

  async function bootOrder(L, S, oops) {
    S.innerHTML = "";
    var desk = el("div", { class: "oi-desk" }), monitor = el("div", { class: "oi-monitor" }), screen = el("div", { class: "oi-screen" });
    monitor.appendChild(screen); monitor.appendChild(el("div", { class: "oi-stand" }));
    var tower = el("div", { class: "oi-tower", html: ART.tower(false, false) });
    var stick = el("button", { class: "oi-stick pulse", "aria-label": "USB stick: drag it to the computer, or press Enter", html: ART.usb(1, "USB") });
    desk.appendChild(monitor); desk.appendChild(tower); desk.appendChild(stick);
    var powerBtn = el("button", { class: "btn big", html: "⏻ Power" }), f2Btn = el("button", { class: "btn big oi-f2", html: "F2" });
    var tip = el("div", { class: "oi-tip" });
    powerBtn.disabled = true; f2Btn.disabled = true;
    S.appendChild(desk); S.appendChild(el("div", { class: "oi-controls" }, powerBtn, f2Btn, tip));
    function setTip(md) { tip.innerHTML = RQ.ui.md(md); bounce(tip); }
    function scr(html) { screen.innerHTML = html; }
    var onKey = null;
    keys(L, function (e) { if (onKey) onKey(e); });
    scr('<div class="oi-off">no signal</div>');
    setTip("Drag the **USB stick** into the computer (or click it).");
    await new Promise(function (res) {
      draggable(L, stick, {
        targets: function () { return [{ el: tower }]; },
        onHover: function (tg) { tower.classList.toggle("hot", !!tg); },
        onDrop: function (tg, isClick) {
          if (!tg && !isClick) { setTip("Drop it **on the computer** (the tall box)."); return false; }
          res(); return true;
        }
      });
    });
    if (!L.alive) return;
    stick.style.visibility = "hidden"; tower.classList.remove("hot");
    tower.innerHTML = ART.tower(true, false); sfx("snap"); bounce(tower);
    var order = [
      { id: "hdd", icon: "💽", name: "Hard disk · 1 TB (empty)" },
      { id: "net", icon: "🌐", name: "Network boot (PXE)" },
      { id: "usb", icon: "🔌", name: "USB · STICK 16 GB" }
    ];
    var first = true, inSetup = false;

    function noOS(name) {
      scr('<div class="oi-noos"><div>Booting from: ' + u.esc(name) + ' …</div><div class="r">No operating system found. 🤷</div><div class="dim">Insert a boot disk and restart.</div><div class="oi-bugface">' + RQ.chars.svg("bug", { mood: "happy" }) + "</div></div>");
      sfx("error"); L.timeout(function () { sfx("giggle"); }, 400);
      return L.wait(2000);
    }
    function post(limit) {
      return new Promise(function (res) {
        scr('<div class="oi-post"><div class="brand">MO-BOARD</div><div>Press <b class="oi-k">F2</b> to enter Setup</div><div class="bar"><i></i></div></div>');
        var bar = screen.querySelector(".bar i"), done = false, t0 = -1;
        f2Btn.disabled = false; f2Btn.classList.add("pulse", "warn");
        function finish(v) { if (done) return; done = true; stop(); onKey = null; f2Btn.disabled = true; f2Btn.classList.remove("pulse", "warn"); res(v); }
        f2Btn.onclick = function () { finish(true); };
        onKey = function (e) { if (e.key === "F2") { e.preventDefault(); finish(true); } };
        var stop = L.loop(function (dt, t) {
          if (t0 < 0) t0 = t;
          var k = (t - t0) / limit;
          bar.style.width = Math.max(0, 100 - k * 100) + "%";
          if (k >= 1) finish(false);
        });
      });
    }
    function setup() {
      return new Promise(function (res) {
        var sel = 0;
        function render() {
          var rows = order.map(function (o, i) {
            return '<div class="oi-brow' + (i === sel ? " sel" : "") + (o.id === "usb" ? " usb" : "") + '" data-i="' + i + '"><span class="num">' + (i + 1) + '.</span><span class="nm">' + o.icon + " " + u.esc(o.name) +
              '</span><button data-up="' + i + '" aria-label="move up">▲</button><button data-down="' + i + '" aria-label="move down">▼</button></div>';
          }).join("");
          scr('<div class="oi-uefi"><div class="hd"><span>MO-BOARD UEFI SETUP</span><span class="tabs">Main <b>Boot</b> Exit</span></div>' +
            '<div class="ttl">Boot order: the computer tries <b>#1</b> first</div>' + rows +
            '<div class="keys">↑ ↓ pick · + / − move · F10 save &amp; exit</div><button class="oi-save">F10 · Save &amp; Exit</button></div>');
        }
        function move(i, d) {
          var j = i + d;
          if (j < 0 || j >= order.length) { sfx("bad"); return; }
          var x = order[i]; order[i] = order[j]; order[j] = x; sel = j; sfx("tick"); render();
        }
        function save() { onKey = null; screen.onclick = null; sfx("click"); res(order[0].id === "usb"); }
        screen.onclick = function (e) {
          var b = e.target.closest("button, .oi-brow");
          if (!b || !L.alive) return;
          if (b.dataset.up != null) move(+b.dataset.up, -1);
          else if (b.dataset.down != null) move(+b.dataset.down, 1);
          else if (b.classList.contains("oi-save")) save();
          else if (b.dataset.i != null) { sel = +b.dataset.i; sfx("tick"); render(); }
        };
        onKey = function (e) {
          if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); sfx("tick"); render(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(order.length - 1, sel + 1); sfx("tick"); render(); }
          else if (e.key === "+" || e.key === "=") { e.preventDefault(); move(sel, -1); }
          else if (e.key === "-" || e.key === "_") { e.preventDefault(); move(sel, 1); }
          else if (e.key === "F10") { e.preventDefault(); save(); }
        };
        render();
      });
    }

    while (L.alive) {
      if (!inSetup) {
        powerBtn.disabled = false; powerBtn.classList.add("pulse"); powerBtn.focus();
        setTip(first ? "Press **⏻ Power** to switch the computer on." : "Press **⏻ Power** to restart. Be quick with **F2**!");
        await clicked(L, powerBtn);
        if (!L.alive) return;
        powerBtn.disabled = true; powerBtn.classList.remove("pulse");
        tower.innerHTML = ART.tower(true, true); sfx("beep");
        setTip("Quick! Press **F2** (keyboard or button) to open the setup menu.");
        var got = await post(first ? 5 : 9);
        first = false;
        if (!L.alive) return;
        if (!got) {
          oops++; setTip("Too slow! It tried the **empty hard disk** first.");
          await noOS(order[0].name); if (!L.alive) return;
          tower.innerHTML = ART.tower(true, false);
          continue;
        }
        sfx("select"); inSetup = true;
      }
      setTip("Move **🔌 USB** to the top (▲ or +), then press **F10 · Save & Exit**.");
      var ok = await setup();
      if (!L.alive) return;
      if (ok) break;
      oops++; setTip("Oops! It tried **" + order[0].name + "** first. Put USB on top!");
      await noOS(order[0].name); if (!L.alive) return;
    }
    if (!L.alive) return;
    setTip("Booting from your USB stick…");
    scr('<div class="oi-noos"><div>Saving… restarting…</div><div class="g">Booting from: USB · STICK 16 GB ✔</div></div>'); sfx("whoosh");
    await L.wait(1200); if (!L.alive) return;
    scr('<div class="oi-splash-in"><div class="logo">' + ART.ubuntu() + "</div><b>Ubuntu 24.04 LTS</b><span>Install Ubuntu</span>" + '<div class="oi-dots"><i></i><i></i><i></i></div></div>');
    sfx("powerup");
    await L.wait(1800); if (!L.alive) return;
    L.win({ stars: stars3(oops, 0, 2), msg: "The computer started the **Ubuntu installer** from your USB stick!", stats: { "Oopsies": oops } });
  }

  /* ================================================================== L2: pick an operating system */
  var OSES = [
    { id: "ubuntu", name: "Ubuntu", full: "Linux · free to use", art: ART.ubuntu, good: ["Free for everyone", "Servers, science & AI"], color: "#e95420" },
    { id: "windows", name: "Windows", full: "by Microsoft", art: ART.windows, good: ["PC games & school apps", "Most home computers"], color: "#2b7bd0" },
    { id: "rhel", name: "RHEL", full: "Red Hat Enterprise Linux", art: ART.rhel, good: ["Big company servers", "Paid help for years"], color: "#cc2b2b" }
  ];
  var OS_BY = {}; OSES.forEach(function (o) { OS_BY[o.id] = o; });
  var MISSIONS = [
    { icon: "🤖", t: "Run ReSeed's tests on GitHub's robot computers", a: "ubuntu", why: "Yes! ReSeed's test robot runs on `ubuntu-latest`.", hint: "ReSeed's test file says `runs-on: ubuntu-latest`." },
    { icon: "🧠", t: "Train ForestNet on the project's big GPU computer", a: "ubuntu", why: "Right! Our project computer, where ReSeed was built, runs **Ubuntu 24.04**.", hint: "Science and AI computers love free Linux." },
    { icon: "🔬", t: "Give an old science laptop a free system", a: "ubuntu", why: "Yes! Ubuntu is free to download and use.", hint: "Which one is free for everyone?" },
    { icon: "🎮", t: "Play the newest PC games with friends", a: "windows", why: "Yes! Most PC games are made for Windows.", hint: "Most home PCs and games use Windows." },
    { icon: "🎨", t: "Use the school's drawing app that only works on Windows", a: "windows", why: "Right! A Windows-only app needs Windows.", hint: "Read the mission again: which system fits its clue best?" },
    { icon: "🏦", t: "A bank needs servers with a help line for 10 years", a: "rhel", why: "Yes! RHEL comes with paid support for many years.", hint: "Which one sells paid help to big companies?" },
    { icon: "✈️", t: "An airline wants Linux servers with paid expert help", a: "rhel", why: "Right! Big companies pay Red Hat for support.", hint: "Look for paid help for company servers." }
  ];

  async function levelChoose(L) {
    var S = el("div", { class: "fill oi oi-l2" }); L.stage.appendChild(S);
    var oops = 0, idx = 0, wrongHere = 0, busy = false, card = null;
    var deck = u.shuffle(MISSIONS, L.rng);
    var prog = el("div", { class: "oi-progress" });
    var area = el("div", { class: "oi-cardarea" });
    var bins = el("div", { class: "oi-bins" }), binEl = {}, countEl = {}, counts = {};
    OSES.forEach(function (os, i) {
      counts[os.id] = 0;
      countEl[os.id] = el("span", { class: "count", text: "0" });
      var b = el("button", { class: "oi-bin", style: "--oc:" + os.color, "aria-label": os.name + ": " + os.good.join(", ") },
        el("span", { class: "oi-kbd", text: String(i + 1) }), countEl[os.id],
        el("div", { class: "logo", html: os.art() }), el("b", { text: os.name }), el("small", { text: os.full }),
        el("ul", {}, os.good.map(function (g) { return el("li", { text: g }); })));
      b.onclick = function () { answer(os.id); };
      binEl[os.id] = b; bins.appendChild(b);
    });
    S.appendChild(area); S.appendChild(prog); S.appendChild(bins);
    function drawProg() {
      prog.innerHTML = "";
      deck.forEach(function (m, i) { prog.appendChild(el("span", { class: "oi-pip" + (i < idx ? " done" : i === idx ? " now" : ""), text: i < idx ? "✓" : m.icon })); });
    }
    var finished;
    var allDone = new Promise(function (r) { finished = r; });
    function showCard() {
      drawProg();
      if (idx >= deck.length) { finished(); return; }
      var m = deck[idx]; wrongHere = 0;
      u.$$(".oi-bin", bins).forEach(function (b) { b.classList.remove("pulse"); });
      area.innerHTML = "";
      card = el("button", { class: "oi-mission", "aria-label": "Mission: " + m.t }, el("span", { class: "ic", text: m.icon }),
        el("span", { class: "tx" }, el("span", { text: m.t }), el("small", { text: "Drag me to the best operating system, or press 1, 2 or 3" })));
      area.appendChild(card);
      draggable(L, card, {
        enabled: function () { return !busy; },
        targets: function () { return OSES.map(function (o) { return { el: binEl[o.id], id: o.id }; }); },
        onHover: function (tg) { OSES.forEach(function (o) { binEl[o.id].classList.toggle("hot", !!tg && tg.id === o.id); }); },
        onDrop: function (tg, isClick) {
          if (tg) return answer(tg.id);
          if (isClick) toast("Now click the best operating system below!", "info", 1800);
          return false;
        }
      });
    }
    function answer(osId) {
      if (busy || !card || idx >= deck.length || !L.alive) return false;
      var m = deck[idx], b = binEl[osId];
      if (osId === m.a) {
        busy = true; sfx("good"); counts[osId]++; countEl[osId].textContent = String(counts[osId]);
        var cr = card.getBoundingClientRect(), br = b.getBoundingClientRect();
        var dx = br.left + br.width / 2 - (cr.left + cr.width / 2), dy = br.top + br.height / 2 - (cr.top + cr.height / 2);
        card.style.transition = "transform .45s cubic-bezier(.5,-.3,.6,1), opacity .45s";
        card.style.transform = (card.style.transform || "") + " translate(" + dx + "px," + dy + "px) scale(.15)";
        card.style.opacity = "0";
        L.timeout(function () { bounce(b); floatOn(b, "+1"); }, 380);
        toast(m.why, "good", 2400);
        L.timeout(function () { busy = false; idx++; showCard(); }, 700);
        return true;
      }
      oops++; wrongHere++; sfx("error"); shake(b);
      toast(wrongHere >= 2 ? "💡 " + m.hint : "Hmm, not the best fit. Read what each one is good for!", "bad", 2800);
      if (wrongHere >= 2) binEl[m.a].classList.add("pulse");
      return false;
    }
    keys(L, function (e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= 3) { e.preventDefault(); answer(OSES[n - 1].id); } });
    showCard();
    await allDone;
    if (!L.alive) return;
    area.innerHTML = '<div class="oi-alldone">' + OSES.map(function (o) { return '<span class="logo">' + o.art() + "</span>"; }).join("") + "</div>";
    sfx("bloom");
    var pickIdx = await L.choose("pix", "So which brain should our ReSeed mission computer get?", ["Ubuntu", "Windows", "RHEL"]);
    if (!L.alive) return;
    if (pickIdx === 0) await L.say("pix", "Yes! ReSeed's test robot runs **ubuntu-latest**, and our project computer runs **Ubuntu 24.04**.", { mood: "happy" });
    else { oops++; await L.say("pix", "It could work, but ReSeed uses **Ubuntu**: it's free, and the test robot runs `ubuntu-latest`.", { mood: "think" }); }
    if (!L.alive) return;
    L.win({ stars: stars3(oops, 1, 4), msg: "Ubuntu it is! In real life jobs overlap a bit, but now you know each OS's superpower.", stats: { "Oopsies": oops } });
  }

  /* ================================================================== L3: disk, partitions, user, install */
  var DISK = 1000;
  function pad(s, n) { s = String(s); while (s.length < n) s = " " + s; return s; }
  function lsblk(parts) {
    var s = "$ lsblk          (game version)\nNAME           SIZE  WHAT\nnvme0n1      " + pad(DISK + "G", 6) + "  disk";
    parts.forEach(function (p, i) { s += "\n" + (i === parts.length - 1 ? "└─" : "├─") + "nvme0n1p" + (i + 1) + "  " + pad(p.size + "G", 6) + "  " + (p.mount || p.name); });
    return s;
  }
  var WORDS = ["koala", "purple", "tacos", "moon", "jumps", "river"], NUMS = ["42", "7"], SYMS = ["!", "#"], WEAK = ["password", "123456", "qwerty"];
  var PW_LABELS = ["Too easy to guess!", "Weak", "Okay", "Strong", "Super strong!"];
  function strength(tiles) {
    var s = tiles.join("");
    if (!s) return { lvl: -1, label: "Empty: tap some tiles" };
    if (tiles.some(function (t) { return WEAK.indexOf(t) >= 0; })) return { lvl: 0, label: "Too easy! Robots guess that one first." };
    if (s.length < 8) return { lvl: 1, label: "Too short" };
    var words = tiles.filter(function (t) { return WORDS.indexOf(t) >= 0; }).length;
    var lvl = 1 + (s.length >= 12 ? 1 : 0) + (s.length >= 18 ? 1 : 0) + (/\d/.test(s) ? 1 : 0) + (/[^a-z0-9]/i.test(s) ? 1 : 0) + (words >= 3 ? 1 : 0);
    if (s.length < 12) lvl = Math.min(lvl, 2);
    lvl = Math.min(4, lvl);
    return { lvl: lvl, label: PW_LABELS[lvl] };
  }

  async function levelDisk(L) {
    var S = el("div", { class: "fill oi" }); L.stage.appendChild(S);
    var oops = 0;
    var win = el("div", { class: "oi-window oi-installer" }, titlebar("Install Ubuntu 24.04 LTS"));
    var side = el("ol", { class: "oi-steps" }), main = el("div", { class: "oi-inst-main" });
    ["💽 The disk", "🍰 Partitions", "🙂 Your user", "⏳ Install"].forEach(function (s) { side.appendChild(el("li", { text: s })); });
    win.appendChild(el("div", { class: "oi-inst-body" }, side, main)); S.appendChild(win);
    function step(i) { u.$$("li", side).forEach(function (li, k) { li.className = k < i ? "done" : k === i ? "now" : ""; }); main.innerHTML = ""; }

    /* ---- phase 1: inspect, back up, erase (with Undo) */
    step(0);
    var OLD = [
      { name: "old-games", size: 600, color: "#7c5cc4", stuff: "🎮 🕹️ 🎮", what: "Old games nobody plays any more." },
      { name: "cat-photos", size: 100, color: "#d9488a", stuff: "🐱 📷 🐈 📹", what: "Mo's cat photos and videos. Precious!", precious: true },
      { name: "junk", size: 300, color: "#6e7f92", stuff: "🗑️ 🧦 🥫", what: "Old junk files." }
    ];
    var parts = OLD.slice(), history = [], backedUp = false, cried = false, busy = false, selPart = null;
    var head = el("div", { class: "oi-h" });
    var disk = el("div", { class: "oi-disk" }), ls = el("pre", { class: "oi-lsblk" });
    var inspect = el("div", { class: "oi-inspect" }), backup = el("div", { class: "oi-backup" });
    var eraseBtn = el("button", { class: "btn danger", html: "🗑️ Erase whole disk" });
    var undoBtn = el("button", { class: "btn warn", html: "↶ Undo" });
    var nextBtn = el("button", { class: "btn go", html: "Next ▶" });
    main.appendChild(head); main.appendChild(disk);
    main.appendChild(el("div", { class: "oi-row2" }, inspect, el("div", { class: "oi-col2" }, backup, ls)));
    main.appendChild(el("div", { class: "oi-toolbar" }, eraseBtn, undoBtn, el("span", { class: "muted oi-note", text: "Undo only works in this simulator!" }), el("span", { class: "grow" }), nextBtn));
    function refresh(rewind) {
      disk.innerHTML = "";
      if (!parts.length) disk.appendChild(el("div", { class: "oi-free", text: "Empty · " + DISK + " GB free" }));
      parts.forEach(function (p) {
        var d = el("button", { class: "oi-part" + (p === selPart ? " sel" : "") + (rewind ? " rewind" : ""), style: { flexGrow: String(p.size), background: p.color },
          html: "<b>" + u.esc(p.name) + "</b><small>" + p.size + " GB</small>" });
        d.onclick = function () { if (busy) return; selPart = p; sfx("select"); refresh(); };
        p.node = d; disk.appendChild(d);
      });
      ls.textContent = lsblk(parts);
      inspect.innerHTML = "";
      if (!selPart) inspect.appendChild(el("div", { class: "muted", html: "👆 Click a part of the disk to look inside." }));
      else {
        inspect.appendChild(el("div", { class: "stuff", text: selPart.stuff }));
        inspect.appendChild(el("div", { html: "<b>" + u.esc(selPart.name) + "</b> · " + selPart.size + " GB<br>" + u.esc(selPart.what) }));
        if (selPart.precious) {
          if (backedUp) inspect.appendChild(el("div", { class: "oi-ok", text: "✔ Safe on the backup stick" }));
          else {
            var bk = el("button", { class: "btn primary pulse", html: "📦 Copy to backup stick" });
            bk.onclick = function () {
              if (backedUp) return;
              backedUp = true; sfx("coin"); floatOn(backup, "🐱 +1"); toast("Cat photos copied to the backup stick!", "good"); refresh();
            };
            inspect.appendChild(bk);
          }
        }
      }
      backup.innerHTML = '<span class="mini">' + ART.usb(backedUp ? 1 : 0, "BACKUP") + "</span><span>" + (backedUp ? "🐱 cat-photos ✔" : "empty") + "</span>";
      eraseBtn.disabled = !parts.length;
      undoBtn.disabled = !history.length;
      var ready = !parts.length && backedUp;
      nextBtn.disabled = !ready; nextBtn.classList.toggle("pulse", ready);
      head.innerHTML = RQ.ui.md(ready ? "Clean and safe! Press **Next**." : !backedUp && (cried || selPart) ? "Back up Mo's **cat photos** first, then **erase** the disk." :
        parts.length ? "This used disk is full of old stuff. **Click each part** to look inside, then make room." : "Disk erased.");
    }
    refresh();
    eraseBtn.onclick = async function () {
      if (!parts.length || busy || !L.alive) return;
      busy = true; history.push(parts.slice());
      parts.forEach(function (p) { if (p.node) p.node.classList.add("crumble"); });
      sfx("boom");
      await L.wait(560); if (!L.alive) return;
      parts = []; selPart = null; busy = false; refresh();
      if (!backedUp && !cried) {
        cried = true; oops++;
        await L.say("mo", "Noooo, my cat photos were on that disk! Quick, press **Undo**!", { mood: "sad" });
        if (!L.alive) return;
        if (history.length) undoBtn.classList.add("pulse");
      } else if (backedUp) { sfx("good"); toast("Disk erased. The cat photos are safe on the backup stick!", "good", 2400); }
    };
    undoBtn.onclick = function () {
      if (!history.length || busy || !L.alive) return;
      parts = history.pop(); undoBtn.classList.remove("pulse"); sfx("pop");
      selPart = backedUp ? null : OLD[1];
      refresh(true);
      toast(cried && !backedUp ? "Phew, it's back! Real disks have **no Undo**, so always back up first." : "Undo! Everything is back.", "good", 3200);
    };
    await clicked(L, nextBtn);
    if (!L.alive) return;
    sfx("select");

    /* ---- phase 2: partitions (EFI + / + /home) */
    step(1);
    var efi = false, root = 40, lastTick = 0;
    var head2 = el("div", { class: "oi-h", html: RQ.ui.md("Split the empty disk into **partitions**, like rooms in a house.") });
    var disk2 = el("div", { class: "oi-disk" });
    var efiBtn = el("button", { class: "btn", html: "＋ Add boot partition (EFI · 1 GB)" });
    var slider = el("input", { type: "range", min: "10", max: "990", step: "10", value: String(root), class: "oi-range", "aria-label": "Size of the system partition in gigabytes" });
    var sizeLbl = el("div", { class: "oi-slbl" });
    var checks = el("ul", { class: "oi-checks" }), ls2 = el("pre", { class: "oi-lsblk" });
    var writeBtn = el("button", { class: "btn go big", html: "✔ Write changes" });
    main.appendChild(head2); main.appendChild(disk2);
    main.appendChild(el("div", { class: "oi-ctl" }, efiBtn, el("div", { class: "oi-sl" }, sizeLbl, slider)));
    main.appendChild(el("div", { class: "oi-row2" }, checks, ls2));
    main.appendChild(el("div", { class: "oi-toolbar" }, el("span", { class: "grow" }), writeBtn));
    function home() { return DISK - (efi ? 1 : 0) - root; }
    function okList() {
      return [
        { ok: efi, md: "**EFI** boot partition (1 GB): helps the computer start", why: "No **EFI** boot partition: the computer wouldn't know how to start!" },
        { ok: root >= 100, md: "**/** (system) at least **100 GB**: Ubuntu, Python, GPU tools", why: "**/** is too small for Ubuntu and Python. It needs 100 GB." },
        { ok: home() >= 500, md: "**/home** at least **500 GB**: your files and satellite pictures", why: "**/home** is too small for the satellite pictures. It needs 500 GB." }
      ];
    }
    function render2() {
      disk2.innerHTML = "";
      var segs = [];
      if (efi) segs.push({ name: "EFI", size: 1, color: "#e0a21d", cls: "efi", mount: "/boot/efi" });
      segs.push({ name: "/", size: root, color: "#e95420", mount: "/" });
      segs.push({ name: "/home", size: home(), color: "#2b7bd0", mount: "/home" });
      segs.forEach(function (p) {
        disk2.appendChild(el("div", { class: "oi-part " + (p.cls || ""), style: { flexGrow: p.cls ? "0" : String(p.size), background: p.color }, html: "<b>" + p.name + "</b><small>" + p.size + " GB</small>" }));
      });
      sizeLbl.innerHTML = "Size of <b>/</b> (system): <b>" + root + " GB</b> · <b>/home</b> gets <b>" + home() + " GB</b>";
      checks.innerHTML = "";
      okList().forEach(function (c) { checks.appendChild(el("li", { class: c.ok ? "ok" : "no", html: (c.ok ? "✅ " : "⬜ ") + RQ.ui.md(c.md) })); });
      ls2.textContent = lsblk(segs);
      efiBtn.innerHTML = efi ? "✔ EFI added (click to remove)" : "＋ Add boot partition (EFI · 1 GB)";
      efiBtn.classList.toggle("go", efi);
    }
    efiBtn.onclick = function () { efi = !efi; sfx(efi ? "snap" : "pop"); render2(); };
    L.on(slider, "input", function () {
      root = parseInt(slider.value, 10) || 10;
      var now = performance.now(); if (now - lastTick > 60) { lastTick = now; sfx("tick"); }
      render2();
    });
    render2();
    while (L.alive) {
      await clicked(L, writeBtn);
      if (!L.alive) return;
      var bad = okList().filter(function (c) { return !c.ok; });
      if (!bad.length) break;
      oops++; sfx("error"); shake(writeBtn); shake(checks.querySelector(".no"));
      toast(bad[0].why, "bad", 3200);
    }
    sfx("good"); bounce(disk2); toast("Partitions written: **EFI**, **/** and **/home**!", "good", 2000);
    await L.wait(1100); if (!L.alive) return;

    /* ---- phase 3: pretend user + password strength */
    step(2);
    var name = null, tiles = [];
    var nameRow = el("div", { class: "oi-names" }), info = el("div", { class: "oi-info" });
    var tileBox = el("div", { class: "oi-tiles" }), pwBox = el("div", { class: "oi-pw" }), meter = el("div", { class: "oi-meter" });
    var goBtn = el("button", { class: "btn go big", html: "Continue ▶" });
    var backBtn = el("button", { class: "btn", html: "⌫", "aria-label": "Remove the last tile" }), clearBtn = el("button", { class: "btn", html: "Clear" });
    main.appendChild(el("div", { class: "oi-h", html: RQ.ui.md("Make a **pretend** user. Pick a name:") }));
    main.appendChild(el("div", { class: "oi-userrow" }, nameRow, info));
    main.appendChild(el("div", { class: "oi-h", html: RQ.ui.md("Build a password from the tiles (max 6):") }));
    main.appendChild(tileBox);
    main.appendChild(el("div", { class: "oi-pwrow" }, pwBox, backBtn, clearBtn));
    main.appendChild(meter);
    main.appendChild(el("div", { class: "oi-toolbar" }, el("span", { class: "muted oi-note", text: "🔒 Pretend only! Never type your real password into a game." }), el("span", { class: "grow" }), goBtn));
    NAMES.forEach(function (n) {
      var b = el("button", { class: "oi-chipbtn", text: n });
      b.onclick = function () { name = n; sfx("select"); u.$$(".oi-chipbtn", nameRow).forEach(function (x) { x.classList.toggle("sel", x === b); }); render3(); };
      nameRow.appendChild(b);
    });
    [[WORDS, "word"], [NUMS, "num"], [SYMS, "sym"], [WEAK, "word"]].forEach(function (grp) {
      grp[0].forEach(function (w) {
        var b = el("button", { class: "oi-tile " + grp[1], text: w });
        b.onclick = function () {
          if (tiles.length >= 6) { sfx("bad"); toast("Six tiles is plenty!", "info"); return; }
          tiles.push(w); sfx("key"); render3();
        };
        tileBox.appendChild(b);
      });
    });
    backBtn.onclick = function () { tiles.pop(); sfx("click"); render3(); };
    clearBtn.onclick = function () { tiles = []; sfx("click"); render3(); };
    var lastLvl = -1;
    function render3() {
      info.innerHTML = name ? "Username: <b>" + name.toLowerCase() + "</b> · Computer: <b>basecamp</b>" : "Computer name: <b>basecamp</b>";
      pwBox.innerHTML = tiles.length ? tiles.map(function (t) { return '<span class="pt">' + u.esc(t) + "</span>"; }).join("") : '<span class="muted">tap tiles to build a password</span>';
      var s = strength(tiles), lv = s.lvl;
      var cols = ["#d1495b", "#e0752d", "#e0a21d", "#2f9e4f", "#1fbf5f"];
      var bars = "";
      for (var i = 0; i < 4; i++) bars += '<i style="background:' + (lv > i ? cols[lv] : lv === 0 && i === 0 ? cols[0] : "#e7e1d2") + '"></i>';
      meter.innerHTML = '<span class="bars">' + bars + "</span><b>" + (lv >= 4 ? "💪 " : "") + s.label + "</b>" + (tiles.length ? '<small class="muted">' + tiles.join("").length + " letters</small>" : "");
      if (lv !== lastLvl && lv >= 3) { sfx(lv >= 4 ? "powerup" : "good"); bounce(meter); }
      if (lv === 0 && lastLvl !== 0) { sfx("giggle"); shake(meter); }
      lastLvl = lv;
      var ready = !!name && lv >= 3;
      goBtn.disabled = !ready; goBtn.classList.toggle("pulse", ready);
    }
    render3();
    await clicked(L, goBtn);
    if (!L.alive) return;
    var pw = strength(tiles);
    var gs = RQ.save.game("g03"); gs.extra = gs.extra || {}; gs.extra.user = name; RQ.save.write();
    sfx("select");

    /* ---- phase 4: install with a fact slideshow */
    step(3);
    var SLIDES = [
      "**24.04** means it came out in **2024**, month **04** (April).",
      "**LTS** means **Long Term Support**: years of free safety fixes.",
      "ReSeed's test robot runs Ubuntu too: `ubuntu-latest`."
    ];
    var slide = el("div", { class: "oi-slide" }), bar = el("div", { class: "oi-bar" }, el("i")), pct = el("div", { class: "oi-pct" });
    main.appendChild(el("div", { class: "oi-h", html: RQ.ui.md("Installing **Ubuntu 24.04 LTS**…") }));
    main.appendChild(slide); main.appendChild(bar); main.appendChild(pct);
    var shown = -1;
    await new Promise(function (res) {
      var t0 = -1;
      var stop = L.loop(function (dt, t) {
        if (t0 < 0) t0 = t;
        var k = Math.min(1, (t - t0) / 7.5), si = Math.min(SLIDES.length - 1, Math.floor(k * SLIDES.length));
        bar.firstChild.style.width = (k * 100).toFixed(1) + "%";
        pct.textContent = k < 1 ? ["Copying files…", "Installing the system…", "Setting up user " + name.toLowerCase() + "…"][si] + " " + Math.round(k * 100) + "%" : "Done!";
        if (si !== shown) { shown = si; slide.innerHTML = '<span class="big">' + ["📅", "🛡️", "🤖"][si] + "</span><span>" + RQ.ui.md(SLIDES[si]) + "</span>"; bounce(slide); sfx("pop"); }
        if (k >= 1) { stop(); res(); }
      });
    });
    if (!L.alive) return;
    var rb = el("button", { class: "btn go big pulse", html: "🔄 Restart now" });
    main.appendChild(el("div", { class: "oi-toolbar" }, el("b", { text: "Installation complete!" }), el("span", { class: "grow" }), rb));
    sfx("powerup"); rb.focus();
    await clicked(L, rb);
    if (!L.alive) return;
    var stars = 1 + (oops <= 1 ? 1 : 0) + (pw.lvl >= 4 ? 1 : 0);
    L.win({ stars: stars, msg: "Ubuntu is installed! The disk has **EFI**, **/** and **/home**, and user **" + name.toLowerCase() + "** is ready.",
      stats: { "Oopsies": oops, "Password": pw.label.replace("!", "") } });
  }

  /* ================================================================== L4: first boot + sudo apt update */
  var PKGS = ["python3", "git", "curl", "wget", "nano", "openssl", "bash", "vim", "tzdata", "zip", "libc6", "systemd"];

  async function levelFirstBoot(L) {
    var name = userName(), user = name.toLowerCase(), typos = { n: 0 };
    var S = el("div", { class: "fill oi-desktop" }); L.stage.appendChild(S);
    var splash = el("div", { class: "oi-bootsplash", html: '<div class="logo">' + ART.ubuntu() + '</div><b>Ubuntu 24.04 LTS</b><div class="oi-dots"><i></i><i></i><i></i></div>' });
    S.appendChild(splash); sfx("powerup");
    await L.wait(1700); if (!L.alive) return;
    splash.remove();
    var pwd = el("div", { class: "oi-pwdots" }), loginBtn = el("button", { class: "btn go big", html: "Log in ▶" });
    var login = el("div", { class: "oi-login" }, el("div", { class: "av", text: name[0] }), el("b", { text: name }), pwd, loginBtn,
      el("small", { text: "Your pretend password fills in by itself." }));
    S.appendChild(login); loginBtn.focus();
    await clicked(L, loginBtn);
    if (!L.alive) return;
    loginBtn.disabled = true;
    for (var i = 0; i < 8; i++) { pwd.textContent += "●"; sfx("type"); await L.wait(70); if (!L.alive) return; }
    sfx("good"); await L.wait(300); if (!L.alive) return;
    login.remove();

    // desktop: top bar, dock, package shelf, terminal area
    var topbar = el("div", { class: "oi-topbar" }, el("span", { text: "Activities" }), el("span", { text: "Mon 9:41" }), el("span", { text: "🔊 🔋 " + user }));
    var dock = el("div", { class: "oi-dock" }), termIcon = el("button", { class: "oi-termicon pulse", html: "&gt;_", "aria-label": "Open the Terminal", title: "Terminal" });
    [["📁", "Files"], ["🌐", "Web browser"]].forEach(function (d) { dock.appendChild(el("button", { html: d[0], title: d[1], "aria-label": d[1], onclick: function () { sfx("bad"); toast("Not now! Open the **Terminal** (the >_ button).", "info"); } })); });
    dock.appendChild(termIcon);
    dock.appendChild(el("button", { html: "⚙️", title: "Settings", "aria-label": "Settings", onclick: function () { sfx("bad"); toast("Not now! Open the **Terminal** (the >_ button).", "info"); } }));
    var grid = el("div", { class: "oi-boxes" }), badge = el("div", { class: "oi-badge", text: "📋 Catalog: not checked yet" });
    var lock = el("div", { class: "oi-lock", html: "🔒<small>boss only</small>" });
    var shelf = el("div", { class: "oi-shelf" }, el("h3", { text: "📦 Programs on this computer" }), badge, grid, lock);
    var boxes = PKGS.map(function (p) {
      var b = el("div", { class: "oi-box" }, el("span", { class: "star", text: "⭐" }), el("div", { class: "e", text: "📦" }), el("div", { class: "n", text: p }), el("span", { class: "v", text: "old" }));
      grid.appendChild(b); return b;
    });
    var termArea = el("div", { class: "oi-termarea" }, el("div", { class: "oi-open", html: RQ.ui.md("Open the **Terminal**: click **>_** in the dock, or press **Ctrl + Alt + T**.") }));
    S.appendChild(topbar); S.appendChild(el("div", { class: "oi-deskmain" }, dock, el("div", { class: "oi-work" }, shelf, termArea)));
    await new Promise(function (res) {
      var done = false;
      function go() { if (done || !L.alive) return; done = true; res(); }
      termIcon.onclick = go;
      keys(L, function (e) { if (e.ctrlKey && e.altKey && (e.key === "t" || e.key === "T")) { e.preventDefault(); go(); } });
    });
    if (!L.alive) return;
    termIcon.classList.remove("pulse"); sfx("pop");
    termArea.innerHTML = "";
    var t = RQ.term.mount(termArea, { user: user, host: "basecamp", title: user + "@basecamp: ~" });
    var hook = promptHook(t);
    t.print("[dim]Welcome to Ubuntu 24.04 LTS (game version)[/dim]");
    t.print("[y]Mission: update the computer. Type [/y][w]apt update[/w][y] and press Enter.[/y]");
    await cmd(t, "apt update", typos); if (!L.alive) return;
    await t.printSlow(["Reading package lists... Done", "[r]E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)[/r]", "[r]E: Unable to lock directory /var/lib/apt/lists/[/r]"], 170);
    if (!L.alive) return;
    shake(lock); sfx("error"); L.timeout(function () { sfx("giggle"); }, 350);
    await L.wait(500); if (!L.alive) return;
    await L.talk([["pix", "**Permission denied!** Changing the whole computer needs boss powers."],
                  ["pix", "For this update, put `sudo` in front to use boss powers. Only use `sudo` with commands you trust!"]]);
    if (!L.alive) return;
    await cmd(t, "sudo apt update", typos, { extraWrong: function (c) { return c === "sudo apt-get update" ? "[y]apt-get works too, but today let's use the shorter apt![/y]" : null; } });
    if (!L.alive) return;
    t.print("[sudo] password for " + user + ": ");
    var pl = lastLine(t);
    for (i = 0; i < 8; i++) { await L.wait(55); if (!L.alive) return; pl.textContent += "•"; sfx("type"); }
    lock.classList.add("open"); lock.innerHTML = "🔓<small>boss mode!</small>"; sfx("powerup");
    L.timeout(function () { lock.classList.add("gone"); }, 1300);
    await t.printSlow(["Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease", "Get:2 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]",
      "Get:3 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]", "Fetched 252 kB in 1s (310 kB/s)", "Reading package lists... Done",
      "[g]12 packages can be upgraded.[/g] Run 'apt list --upgradable' to see them."], 170);
    if (!L.alive) return;
    badge.textContent = "📋 Catalog: 12 new versions!"; bounce(badge); sfx("coin");
    boxes.forEach(function (b, k) { L.timeout(function () { b.classList.add("new"); sfx("tick"); }, 80 * k); });
    t.print("[y]New versions found! Install them: [/y][w]sudo apt upgrade[/w]");
    await cmd(t, "sudo apt upgrade", typos); if (!L.alive) return;
    await t.printSlow(["Reading package lists... Done", "Building dependency tree... Done", "The following packages will be upgraded:",
      "  " + PKGS.slice().sort().join(" "), "12 upgraded, 0 newly installed, 0 to remove and 0 not upgraded."], 140);
    if (!L.alive) return;
    hook.cls = "oi-q"; hook.text = "Do you want to continue? [Y/n]";
    await cmd(t, "y", typos, { match: /^(y|yes)$/i }); if (!L.alive) return;
    hook.text = null;
    sfx("whoosh");
    boxes.forEach(function (b, k) {
      L.timeout(function () { b.classList.remove("new"); restart(b, "fresh"); b.querySelector(".v").textContent = "new"; sfx("pop"); }, 150 + k * 190);
    });
    await t.progress("Upgrading", 2600); if (!L.alive) return;
    await t.printSlow(["Setting up 12 packages ... Done", "[g]✔ Everything is up to date![/g]"], 160);
    if (!L.alive) return;
    badge.textContent = "📋 Catalog: all up to date ✔"; bounce(badge);
    t.print("[y]Last one: which Python came with Ubuntu? Type [/y][w]python3 --version[/w]");
    await cmd(t, "python3 --version", typos); if (!L.alive) return;
    t.print("Python 3.12.3");
    var py = boxes[0];
    py.querySelector(".v").textContent = "3.12"; py.appendChild(el("span", { class: "oi-snake", text: "🐍" })); restart(py, "fresh"); sfx("bloom");
    await L.wait(900); if (!L.alive) return;
    await L.say("pix", "Python **3.12**: the same version ReSeed's test robot uses!", { mood: "wow" });
    if (!L.alive) return;
    L.win({ stars: stars3(typos.n, 1, 4), msg: "You logged in, used **sudo** boss powers, and updated the whole computer!", stats: { "Typos": typos.n, "Commands": 5 } });
  }

  /* ================================================================== L5: package managers */
  var MGR = {
    ubuntu: { id: "apt", sub: "Advanced Package Tool" },
    rhel: { id: "dnf", sub: "Dandified YUM" },
    windows: { id: "winget", sub: "Windows Package Manager" }
  };
  var MGR_OWNER = { apt: "**apt** belongs to Ubuntu (and Debian).", dnf: "**dnf** belongs to Red Hat (RHEL and Fedora).", winget: "**winget** belongs to **Win**dows. The name is a clue!" };
  var OS_ORDER = ["ubuntu", "rhel", "windows"];

  async function levelPackages(L) {
    var S = el("div", { class: "fill oi oi-l5" }); L.stage.appendChild(S);
    var oops = { n: 0 }, user = userName().toLowerCase();
    var tip = el("div", { class: "oi-tip", html: RQ.ui.md("Connect each **operating system** to its **package manager** truck. Drag a line, or click one and then the other.") });
    var match = el("div", { class: "oi-match" }), left = el("div", { class: "col" }), right = el("div", { class: "col" });
    var lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); lineSvg.setAttribute("class", "oi-lines");
    match.appendChild(lineSvg); match.appendChild(left); match.appendChild(el("div")); match.appendChild(right);
    S.appendChild(match); S.appendChild(tip);
    var osEl = {}, truckEl = {}, matched = {}, sel = null, nMatched = 0, drag = null;
    var truckOrder = u.shuffle(["apt", "dnf", "winget"], L.rng);
    OS_ORDER.forEach(function (os, i) {
      var o = OS_BY[os];
      osEl[os] = el("button", { class: "oi-ostile", "aria-label": o.name },
        el("span", { class: "oi-kbd", text: String(i + 1) }), el("span", { class: "logo", html: o.art() }),
        el("span", {}, el("b", { text: o.name }), el("small", { text: o.full })));
      left.appendChild(osEl[os]);
    });
    truckOrder.forEach(function (m, i) {
      var sub = ""; for (var k in MGR) if (MGR[k].id === m) sub = MGR[k].sub;
      truckEl[m] = el("button", { class: "oi-trucktile", "aria-label": "Package manager " + m },
        el("span", { class: "oi-kbd", text: "ABC"[i] }), el("span", { class: "art", html: ART.truck(m, "#5a6b7d") }), el("small", { text: sub }));
      truckEl[m].onclick = function () {
        if (!L.alive || drag) return;
        if (sel) tryMatch(sel, m); else { sfx("bad"); toast("First pick an operating system on the left!", "info"); shake(left); }
      };
      right.appendChild(truckEl[m]);
    });
    function pt(node, side) {
      var r = node.getBoundingClientRect(), m = match.getBoundingClientRect();
      return { x: (side === "r" ? r.right : r.left) - m.left, y: r.top + r.height / 2 - m.top };
    }
    function curve(a, b, color, dash) {
      return '<path d="M' + a.x + " " + a.y + " C" + (a.x + 90) + " " + a.y + " " + (b.x - 90) + " " + b.y + " " + b.x + " " + b.y + '" stroke="' + color + '" stroke-width="' + (dash ? 5 : 9) +
        '" fill="none" stroke-linecap="round"' + (dash ? ' stroke-dasharray="10 9"' : "") + "/>";
    }
    function redraw(temp) {
      var h = "";
      OS_ORDER.forEach(function (os) { if (matched[os]) h += curve(pt(osEl[os], "r"), pt(truckEl[MGR[os].id], "l"), OS_BY[os].color); });
      if (temp) h += curve(temp.a, temp.b, INK, true);
      lineSvg.innerHTML = h;
    }
    L.on(window, "resize", function () { redraw(); });
    function select(os) {
      if (matched[os]) return;
      sel = os; sfx("select");
      OS_ORDER.forEach(function (o) { osEl[o].classList.toggle("sel", o === os); });
    }
    function hitTruck(e) {
      for (var m in truckEl) { var r = truckEl[m].getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return m; }
      return null;
    }
    var finished, allMatched = new Promise(function (r) { finished = r; });
    function tryMatch(os, m) {
      if (matched[os]) return;
      if (MGR[os].id === m) {
        matched[os] = true; sel = null; nMatched++;
        osEl[os].classList.remove("sel"); osEl[os].classList.add("done"); truckEl[m].classList.add("done");
        truckEl[m].querySelector(".art").innerHTML = ART.truck(m, OS_BY[os].color);
        sfx("good"); honk(); bounce(truckEl[m]); floatOn(truckEl[m], "+1"); redraw();
        toast("Yes! " + OS_BY[os].name + " installs programs with **" + m + "**.", "good", 2000);
        if (nMatched === 3) L.timeout(finished, 900);
      } else {
        oops.n++; sfx("error"); shake(truckEl[m]);
        toast(MGR_OWNER[m] + " Try another truck for " + OS_BY[os].name + ".", "bad", 3000);
      }
    }
    OS_ORDER.forEach(function (os) {
      var tile = osEl[os];
      L.on(tile, "pointerdown", function (e) {
        if (matched[os]) return;
        e.preventDefault(); select(os);
        drag = { os: os, x: e.clientX, y: e.clientY, moved: false };
        try { tile.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      });
      L.on(tile, "pointermove", function (e) {
        if (!drag || drag.os !== os) return;
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
        if (!drag.moved) return;
        var m = match.getBoundingClientRect(), over = hitTruck(e);
        redraw({ a: pt(tile, "r"), b: { x: e.clientX - m.left, y: e.clientY - m.top } });
        for (var k in truckEl) truckEl[k].classList.toggle("hot", k === over);
      });
      function end(e, cancel) {
        if (!drag || drag.os !== os) return;
        var d = drag; drag = null; redraw();
        for (var k in truckEl) truckEl[k].classList.remove("hot");
        if (!cancel && d.moved) { var m = hitTruck(e); if (m) tryMatch(os, m); }
      }
      L.on(tile, "pointerup", function (e) { end(e, false); });
      L.on(tile, "pointercancel", function (e) { end(e, true); });
      L.on(tile, "click", function (e) { if (e.detail === 0) select(os); });
    });
    keys(L, function (e) {
      if (nMatched >= 3) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 3) { e.preventDefault(); select(OS_ORDER[n - 1]); return; }
      var j = "abc".indexOf(String(e.key).toLowerCase());
      if (j >= 0 && e.key.length === 1) {
        e.preventDefault();
        if (sel) tryMatch(sel, truckOrder[j]); else { sfx("bad"); toast("First pick an operating system: press 1, 2 or 3.", "info"); }
      }
    });
    await allMatched;
    if (!L.alive) return;
    sfx("powerup");
    await L.say("pix", "Now install **git** on all three computers. Fill the blank in each recipe!", { mood: "happy" });
    if (!L.alive) return;

    /* ---- phase B: one tiny install command per OS */
    var SPECS = {
      ubuntu: { title: "Ubuntu · Terminal", host: "basecamp", prompt: null, want: "sudo apt install git", recipe: "sudo ___ install git",
        out1: ["Reading package lists... Done", "Building dependency tree... Done", "The following NEW packages will be installed:", "  git"], bar: "Downloading",
        out2: ["Setting up git (1:2.43.0-1ubuntu7) ...", "[g]✔ git is installed![/g]"] },
      rhel: { title: "RHEL · Terminal", host: "bank-server", prompt: "[" + user + "@bank-server ~]$", want: "sudo dnf install git", recipe: "sudo ___ install git",
        out1: ["Updating Subscription Management repositories.", "Dependencies resolved.", " Installing: git   x86_64   (AppStream)", "Is this ok [y/N]: y"], bar: "Downloading",
        out2: ["Installed:", "  git", "[g]Complete![/g]"] },
      windows: { title: "Windows · Terminal (PowerShell)", host: "game-pc", prompt: "PS C:\\Users\\" + user + ">", want: "winget install Git.Git", recipe: "___ install Git.Git",
        out1: ["Found Git [Git.Git]", "This application is licensed to you by its owner."], bar: "Downloading",
        out2: ["Successfully verified installer hash", "Starting package install...", "[g]Successfully installed[/g]"] }
    };
    function wrongFor(os) {
      return function (c) {
        var w = c.split(" "), first = w[0], mgr = first === "sudo" ? w[1] : first;
        if (os === "windows") {
          if (first === "sudo" || first === "apt" || first === "dnf") return "[r]" + first + " : The term '" + first + "' is not recognized.[/r]  [y]This is Windows: just use winget.[/y]";
          if (c.toLowerCase() === "winget install git.git") return "[y]Almost! For this game, copy the spelling exactly: Git.Git[/y]";
          return null;
        }
        var right = MGR[os].id;
        if (os === "rhel" && mgr === "yum") return "[y]yum is dnf's grandpa! It still works, but today we use dnf.[/y]";
        if (os === "ubuntu" && mgr === "apt-get") return "[y]apt-get works too, but let's use the shorter apt.[/y]";
        if (mgr && mgr !== right && ["apt", "dnf", "winget"].indexOf(mgr) >= 0) return "[r]sudo: " + mgr + ": command not found[/r]  [y]This is " + OS_BY[os].name + ": its truck is " + right + ".[/y]";
        if (first === right) {
          return os === "ubuntu" ? "[r]E: Unable to acquire the dpkg frontend lock, are you root?[/r]  [y]Installing needs boss powers: start with sudo.[/y]"
            : "[r]Error: This command has to be run with superuser privileges.[/r]  [y]Start with sudo.[/y]";
        }
        return null;
      };
    }
    for (var i = 0; i < OS_ORDER.length; i++) {
      var os = OS_ORDER[i], sp = SPECS[os];
      S.innerHTML = "";
      var prog = el("div", { class: "oi-progress" });
      OS_ORDER.forEach(function (o, k) {
        prog.appendChild(el("span", { class: "oi-step" + (k < i ? " done" : k === i ? " now" : "") }, el("span", { class: "logo", html: OS_BY[o].art() }), (k < i ? "✔ " : "") + OS_BY[o].name));
      });
      var road = el("div", { class: "oi-road" }), truck = el("div", { class: "oi-truck", html: ART.truck(MGR[os].id, OS_BY[os].color) });
      road.appendChild(truck);
      var recipe = el("div", { class: "oi-recipe", html: "Install <b>git</b> on " + OS_BY[os].name + ": <code>" + u.esc(sp.recipe) + "</code>" });
      var winEl = el("div", { class: "oi-oswin " + os }, el("div", { class: "head", html: '<span class="logo">' + OS_BY[os].art() + "</span>" + u.esc(sp.title) }));
      S.appendChild(prog); S.appendChild(road); S.appendChild(recipe); S.appendChild(winEl);
      var t = RQ.term.mount(winEl, { user: user, host: sp.host, title: sp.title });
      if (sp.prompt) { var hook = promptHook(t); hook.text = sp.prompt; }
      t.print("[dim]Fill the blank in the recipe above. Which truck delivers here?[/dim]");
      await cmd(t, sp.want, oops, { ghost: false, extraWrong: wrongFor(os) });
      if (!L.alive) return;
      truck.classList.add("go"); sfx("engine"); honk();
      await t.printSlow(sp.out1, 150); if (!L.alive) return;
      await t.progress(sp.bar, 1300); if (!L.alive) return;
      await t.printSlow(sp.out2, 150); if (!L.alive) return;
      var box = el("div", { class: "oi-dropbox", html: "📦<b>git</b>" });
      road.appendChild(box); sfx("drop");
      L.timeout(function () { sfx("good"); }, 450);
      toast("**git** delivered to " + OS_BY[os].name + " by **" + MGR[os].id + "**!", "good", 1800);
      await L.wait(1500); if (!L.alive) return;
    }
    L.win({ stars: stars3(oops.n, 1, 4), msg: "**git** is on all three computers: **apt** for Ubuntu, **dnf** for RHEL, **winget** for Windows!", stats: { "Oopsies": oops.n } });
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g03",
    music: "lab",
    intro: [
      ["mo", "Our mission computer is built, but its screen is empty. It has no brain yet!"],
      ["pix", "Our mission computer needs an **operating system**: the boss program that helps run all the others. Let's install one!"]
    ],
    outro: [
      ["pix", "Ubuntu is installed and up to date. The mission computer is awake!"],
      ["mo", "Next stop, Driver Tower. Let's wake up the graphics card too!"]
    ],
    levels: [
      { title: "Boot stick", goal: "Make a bootable USB, then boot from it",
        intro: [["pix", "First we need a **bootable USB** stick: a stick with an operating system installer on it."],
                ["mo", "Then we tell the computer to start from the stick. Careful which drive you pick!"]],
        cards: ["bootable-usb"],
        play: levelBoot },
      { title: "Pick a brain", goal: "Send each mission to the best operating system",
        intro: [["pix", "There are many operating systems. Each one is great at different jobs."],
                ["sprout", "Send each mission to the best one: **Ubuntu**, **Windows** or **RHEL**."]],
        cards: ["operating-system"],
        play: levelChoose },
      { title: "Disk & user", goal: "Back up, erase, partition, make a user",
        intro: [["mo", "This used disk is full of old stuff. Let's look inside, then split it into **partitions**, like rooms in a house."],
                ["pix", "Then make a pretend user with a strong password. Never type a real password into a game!"]],
        cards: ["disk-partition", "strong-password"],
        play: levelDisk },
      { title: "First boot", goal: "Log in, open the Terminal, update everything",
        intro: [["pix", "First boot! Log in, open the **Terminal**, and let's update the computer."]],
        cards: ["sudo-apt"],
        play: levelFirstBoot },
      { title: "Package trucks", goal: "Match each OS to its package manager",
        intro: [["pix", "These three operating systems each have a **package manager**: an app store you can talk to by typing."],
                ["sprout", "Match each one to its truck, then install **git** on all three computers!"]],
        cards: ["package-manager"],
        play: levelPackages }
    ]
  });
})();
