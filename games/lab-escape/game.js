/* g25 Server Lab Escape — the finale platformer (original art, levels and mechanics).
 * Sprout, a small sticky seed drone, escapes the data centre room by room: CPU, RAM, GPU, Disk, Network,
 * Database and the Cloud roof. Code operates the room: each terminal shows a short real-looking ReSeed Python
 * snippet with ONE editable value (or line); Run it and the room obeys (planks extend, doors open, fans blow,
 * steps re-sort, packets travel, lasers switch off, a lift rises). Glitch Bugs patrol; touching one = back to
 * the last charging pad. Each level rescues one friend and ends at the exit; stars = a timer medal.
 * Controls: ← → / A D move · Space / ↑ / W jump · hold toward a wall to stick, jump again to kick up ·
 * E / ↓ use a terminal · on-screen buttons for touch and mouse. */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a", TS = 40, VH = 720;
  var W = 1280;
  var DATA = RQ.data() || { biomes: {}, sites: [] };
  var PH = { run: 330, acc: 3000, air: 2100, fric: 3600, grav: 2300, jump: 800, cut: .45, maxFall: 900, coyote: .1, buffer: .13,
    slide: 55, wjx: 310, wjy: 760, kick: 190, belt: 110 };
  var SOLID = { "#": 1, "X": 1, "<": 1, ">": 1 };
  var CALM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; // no screen shake

  /* ------------------------------------------------------------ small helpers */
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot || 0, 0, Math.PI * 2); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(.1, r), 0, Math.PI * 2); }
  function paint(c, fill, lw) { if (fill) { c.fillStyle = fill; c.fill(); } if (lw !== 0) { c.lineWidth = lw || 2.5; c.strokeStyle = INK; c.lineJoin = "round"; c.stroke(); } }
  function line(c, pts, col, w) {
    c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = col || INK; c.lineWidth = w || 3; c.lineCap = "round"; c.lineJoin = "round"; c.stroke();
  }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function hash(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }
  function mmss(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function txt(c, s, x, y, font, col, align) { c.font = font; c.fillStyle = col; c.textAlign = align || "center"; c.textBaseline = "middle"; c.fillText(s, x, y); }

  /* Friends are drawn from js/chars.js (SVG -> image, no files). */
  var IMG = {};
  function portrait(who) {
    if (!IMG[who]) { var im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg(who, { size: 120, mood: "happy" })); IMG[who] = im; }
    return IMG[who];
  }
  function drawPortrait(c, who, x, y, s) { var im = portrait(who); if (im.complete && im.naturalWidth) c.drawImage(im, x - s / 2, y - s, s, s); }

  /* Real patch sizes from ReSeed's Rondônia run (data/reseed-data.js), biggest first. */
  var AREAS = (function () {
    var s = RQ.site("rondonia"), a = ((s && s.patches) || []).map(function (p) { return p.area_ha; }).sort(function (x, y) { return y - x; }).slice(0, 5);
    return a.length === 5 ? a : [543.34, 439.58, 117.38, 71.52, 43.98];
  })();
  function ha(v) { return v >= 100 ? Math.round(v) : Math.round(v * 10) / 10; }

  /* ------------------------------------------------------------ art */
  function sproutArt(c, x, y, o, t) { // x,y = feet centre
    c.save(); c.translate(x, y); c.scale(o.face * (o.sx || 1), o.sy || 1);
    var spin = Math.abs(Math.sin(t * (o.air ? 55 : 30)));
    line(c, [-11, -27, -22, -35], INK, 3); line(c, [11, -27, 22, -35], INK, 3);
    ell(c, -22, -37, 3 + 10 * spin, 2.5); paint(c, "#cfe9ff", 2); ell(c, 22, -37, 3 + 10 * spin, 2.5); paint(c, "#cfe9ff", 2);
    c.beginPath(); c.moveTo(0, -33); c.quadraticCurveTo(-1, -42, 4, -46); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
    c.beginPath(); c.moveTo(4, -46); c.bezierCurveTo(9, -55, 20, -52, 22, -48); c.bezierCurveTo(16, -42, 8, -41, 4, -46); paint(c, "#8be07f", 2);
    if (o.wall) { [[15, -26], [17, -14], [14, -6]].forEach(function (p) { circ(c, p[0], p[1], 3.2); paint(c, "#a8f07a", 1.5); }); }
    circ(c, 0, -17, 17); paint(c, "#47b95c", 3);
    ell(c, -7, -25, 5, 3); c.fillStyle = "rgba(255,255,255,.4)"; c.fill();
    u.rr(c, -11, -24, 22, 14, 5); paint(c, "#163042", 2);
    c.fillStyle = "#7ff0ff";
    if (o.blink) { c.fillRect(-7, -17.5, 5, 2); c.fillRect(3, -17.5, 5, 2); }
    else { circ(c, -3, -17, 2.4); c.fill(); circ(c, 6, -17, 2.4); c.fill(); }
    c.restore();
  }
  function bugArt(c, x, y, dir, t, fly) { // x,y = feet centre
    c.save(); c.translate(x, y); c.scale(dir, 1);
    if (fly) { var fl = Math.abs(Math.sin(t * 28)) * 8 + 3; ell(c, -4, -22, 8, fl, -.5); c.fillStyle = "rgba(220,240,255,.75)"; c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke(); }
    else for (var i = 0; i < 3; i++) { var ph = Math.sin(t * 14 + i * 2) * 3; line(c, [-8 + i * 7, -6, -10 + i * 7 + ph, 0], INK, 2.5); }
    ell(c, 0, -11, 15, 10); paint(c, "#9b4dca", 2.5);
    circ(c, -5, -13, 3); c.fillStyle = "#c792ea"; c.fill(); circ(c, 4, -8, 2.5); c.fill();
    circ(c, 12, -15, 7.5); paint(c, "#5b2c83", 2.5);
    circ(c, 11, -17, 3.2); paint(c, "#fff", 1.2); circ(c, 16, -17, 3.2); paint(c, "#fff", 1.2);
    circ(c, 12, -17, 1.5); c.fillStyle = INK; c.fill(); circ(c, 17, -17, 1.5); c.fill();
    c.beginPath(); c.arc(13.5, -12, 3.5, .2, Math.PI - .2); c.strokeStyle = "#fff"; c.lineWidth = 1.8; c.stroke();
    line(c, [10, -21, 8, -30], INK, 2); line(c, [15, -21, 19, -29], INK, 2);
    var sp = Math.sin(t * 20) > 0;
    [[8, -31], [19, -30]].forEach(function (p) { c.fillStyle = sp ? "#ffe14d" : "#fff6b0"; circ(c, p[0], p[1], sp ? 3.4 : 2.4); c.fill(); });
    c.restore();
  }

  var THEMES = {
    cpu: { bg: ["#1c2434", "#2c2130"], glow: "#ff9f43", wall: "#3a4a5e", lip: "#6a86a3", led: ["#ff9f43", "#ffd166", "#7ff0ff"] },
    gpu: { bg: ["#152229", "#182c26"], glow: "#7cf29a", wall: "#34505a", lip: "#5e8f8f", led: ["#7cf29a", "#7ff0ff", "#ffd166"] },
    disk: { bg: ["#171f3a", "#1f2546"], glow: "#7aa7ff", wall: "#3b4870", lip: "#6f82b8", led: ["#7aa7ff", "#b197fc", "#7ff0ff"] },
    net: { bg: ["#112530", "#122f38"], glow: "#4ff0e0", wall: "#2f5160", lip: "#5a8fa0", led: ["#4ff0e0", "#7ee787", "#ffd166"] },
    db: { bg: ["#211f2e", "#2b2431"], glow: "#ffc53d", wall: "#4a4258", lip: "#8a7aa3", led: ["#ffc53d", "#ff8fab", "#7ff0ff"] }
  };

  /* ------------------------------------------------------------ devices (code-operated room parts) */
  function mkDevice(d, S) {
    var dv = { id: d.id, type: d.type, x: d.x, y: d.y, dx: 0, dy: 0, d: d };
    var T = d.type;
    if (T === "bridge") {
      dv.n = 0; dv.shown = 0;
      dv.solids = function () { var r = []; for (var i = 0; i < Math.floor(dv.shown + 1e-6); i++) r.push({ x: (dv.x + i) * TS, y: dv.y * TS, w: TS, h: 14 }); return r; };
      dv.update = function (dt) { var before = Math.floor(dv.shown); dv.shown += u.clamp(dv.n - dv.shown, -dt * 14, dt * 7); if (Math.floor(dv.shown) > before) RQ.audio.sfx("snap"); };
      dv.set = function (n, R) { dv.n = n; return R.sleep(Math.abs(n - dv.shown) / (n > dv.shown ? 7 : 14) + .08); };
      dv.draw = function (c) {
        u.rr(c, dv.x * TS - 16, dv.y * TS - 6, 18, 26, 4); paint(c, "#ffc53d", 2.5);
        for (var i = 0; i < Math.ceil(dv.shown - 1e-6); i++) {
          var k = Math.min(1, dv.shown - i), x = (dv.x + i) * TS, pw = TS * k - 2;
          if (pw < 8) continue;
          u.rr(c, x + 1, dv.y * TS, pw, 14, 3); paint(c, "#c98a3f", 2.5);
          if (pw > 18) line(c, [x + 8, dv.y * TS + 7, x + pw - 6, dv.y * TS + 7], "#8a5a35", 2);
        }
      };
    } else if (T === "door") {
      dv.open = false; dv.amt = 0; dv.h = d.h;
      dv.solids = function () { var hh = dv.h * TS * (1 - dv.amt); return hh > 4 ? [{ x: dv.x * TS + 6, y: dv.y * TS, w: TS - 12, h: hh }] : []; };
      dv.update = function (dt) { dv.amt = u.clamp(dv.amt + (dv.open ? dt * 1.4 : -dt * 2), 0, 1); };
      dv.draw = function (c, t) {
        var hh = dv.h * TS * (1 - dv.amt), x = dv.x * TS + 6, y = dv.y * TS;
        if (hh > 2) {
          c.save(); c.beginPath(); c.rect(x, y, TS - 12, hh); c.clip();
          c.fillStyle = "#c9d3dd"; c.fillRect(x, y, TS - 12, hh);
          for (var k = -4; k < dv.h * 2 + 2; k++) { c.fillStyle = k % 2 ? "#ffc53d" : INK; c.beginPath(); c.moveTo(x, y + hh - k * 20); c.lineTo(x + TS, y + hh - k * 20 - 20); c.lineTo(x + TS, y + hh - k * 20 - 10); c.lineTo(x, y + hh - k * 20 + 10); c.fill(); }
          c.restore(); c.lineWidth = 3; c.strokeStyle = INK; c.strokeRect(x, y, TS - 12, hh);
        }
        circ(c, dv.x * TS + TS / 2, y - 12, 7); paint(c, dv.open ? "#7ee787" : (Math.sin(t * 6) > 0 ? "#ff5d5d" : "#a33"), 2);
      };
    } else if (T === "laser") {
      dv.on = true; dv.h = d.h;
      dv.hazards = function () { return dv.on ? [{ x: dv.x * TS + 14, y: dv.y * TS, w: 12, h: dv.h * TS }] : []; };
      dv.draw = function (c, t) {
        var x = dv.x * TS + TS / 2, y0 = dv.y * TS, y1 = (dv.y + dv.h) * TS;
        if (dv.on) {
          c.fillStyle = "rgba(255,60,80,.25)"; c.fillRect(x - 10 - Math.sin(t * 30) * 2, y0, 20 + Math.sin(t * 30) * 4, y1 - y0);
          c.fillStyle = "#ff3b5c"; c.fillRect(x - 3, y0, 6, y1 - y0); c.fillStyle = "#ffd0d8"; c.fillRect(x - 1, y0, 2, y1 - y0);
        }
        u.rr(c, x - 14, y0 - 4, 28, 14, 4); paint(c, "#556677", 2.5); u.rr(c, x - 14, y1 - 10, 28, 12, 4); paint(c, "#556677", 2.5);
        circ(c, x, y0 + 3, 4); c.fillStyle = dv.on ? "#ff3b5c" : "#2a3440"; c.fill();
      };
    } else if (T === "fans") {
      dv.power = 0; dv.target = 0; dv.w = d.w; dv.top = d.top;
      dv.region = { x: dv.x * TS, y: dv.top * TS, w: dv.w * TS, h: (dv.y - dv.top) * TS };
      dv.solids = function () { return [{ x: dv.x * TS, y: dv.y * TS + 8, w: dv.w * TS, h: TS - 8 }]; };
      dv.update = function (dt) { dv.power += u.clamp(dv.target - dv.power, -dt, dt * .8); dv.spin = (dv.spin || 0) + dt * (2 + dv.power * 30); };
      dv.draw = function (c, t) {
        for (var i = 0; i < dv.w; i++) {
          var cx = (dv.x + i) * TS + TS / 2, cy = dv.y * TS + 24;
          u.rr(c, cx - 19, dv.y * TS + 8, 38, 32, 5); paint(c, "#2b3b48", 2.5);
          for (var b = 0; b < 3; b++) { var a = dv.spin + b * 2.094; ell(c, cx + Math.cos(a) * 7, cy + Math.sin(a) * 4, 9, 3.5, a); c.fillStyle = "#9fb3c8"; c.fill(); }
          circ(c, cx, cy, 3); c.fillStyle = INK; c.fill();
        }
        if (dv.power > .05) for (var k = 0; k < 16 * dv.w; k++) {
          var ph = (t * (.5 + dv.power * 1.6) + hash(k, 3)) % 1, wx = dv.x * TS + hash(k, 7) * dv.w * TS, wy = dv.y * TS - ph * (dv.y - dv.top) * TS;
          c.strokeStyle = "rgba(200,255,240," + (.5 * dv.power * (1 - ph)) + ")"; c.lineWidth = 2; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx, wy + 18 + dv.power * 16); c.stroke();
        }
      };
    } else if (T === "stairs") {
      dv.floorRow = d.y; dv.blocks = d.raw.map(function (h, i) { return { h: h, area: AREAS[5 - h], pos: i, from: i, to: i }; });
      dv.lift = 0;
      dv.solids = function () { return dv.blocks.map(function (b) { return { x: (dv.x + 2 * b.pos) * TS, y: (dv.floorRow - b.h) * TS - b.up, w: 2 * TS, h: b.h * TS }; }); };
      dv.blocks.forEach(function (b) { b.up = 0; });
      dv.arrange = function (areas, R) {
        dv.blocks.forEach(function (b) { b.from = b.pos; b.to = areas.indexOf(b.area); });
        dv.k = 0; RQ.audio.sfx("whoosh");
        return R.sleep(1.3);
      };
      dv.update = function (dt) {
        if (dv.k == null) return;
        dv.k = Math.min(1, dv.k + dt / 1.2);
        var e = u.ease.inOut(dv.k);
        dv.blocks.forEach(function (b) { b.pos = u.lerp(b.from, b.to, e); b.up = b.from !== b.to ? Math.sin(e * Math.PI) * 50 : 0; });
        if (dv.k >= 1) { dv.k = null; RQ.audio.sfx("snap"); }
      };
      dv.draw = function (c) {
        dv.blocks.forEach(function (b) {
          var x = (dv.x + 2 * b.pos) * TS, y = (dv.floorRow - b.h) * TS - b.up, w = 2 * TS, h = b.h * TS;
          c.fillStyle = "#a9bccf"; c.fillRect(x, y, w, h);
          c.fillStyle = "rgba(255,255,255,.35)"; for (var k = 0; k < h; k += 26) c.fillRect(x + 6, y + k + 6, w - 12, 4);
          c.lineWidth = 3; c.strokeStyle = INK; c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
          u.rr(c, x + 8, y + 8, w - 16, 26, 7); paint(c, "#fffdf7", 2);
          txt(c, ha(b.area) + " ha", x + w / 2, y + 22, "700 16px Fredoka, sans-serif", INK);
        });
      };
    } else if (T === "vaults") {
      dv.colors = ["red", "blue", "green", "gold"]; dv.hex = ["#e2553f", "#3d7fe0", "#2f9e4f", "#e0a21d"]; dv.amt = [0, 0, 0, 0]; dv.want = [0, 0, 0, 0]; dv.bugged = {};
      dv.update = function (dt) { for (var i = 0; i < 4; i++) dv.amt[i] = u.clamp(dv.amt[i] + (dv.want[i] ? dt * 2 : -dt * 2), 0, 1); };
      dv.openDoor = function (i, R) {
        for (var k = 0; k < 4; k++) dv.want[k] = k === i ? 1 : (k === 2 && !R.cage.locked ? 1 : 0);
        RQ.audio.sfx("whoosh");
        return R.sleep(.6).then(function () {
          if (i !== 2 && !dv.bugged[i]) { dv.bugged[i] = 1; R.spawnBug({ x: dv.x + i * 3 + .5, y: dv.y + 1, x0: 30, x1: 50 }); }
        });
      };
      dv.draw = function (c, t) {
        for (var i = 0; i < 4; i++) {
          var x = (dv.x + i * 3) * TS, y = dv.y * TS, w = 2 * TS, h = 2 * TS;
          u.rr(c, x - 6, y - 10, w + 12, h + 10, 8); paint(c, "#2a3550", 3);
          c.fillStyle = "#0c1222"; c.fillRect(x, y, w, h);
          var oh = h * (1 - dv.amt[i]);
          if (oh > 1) { c.fillStyle = dv.hex[i]; c.fillRect(x, y, w, oh); c.lineWidth = 2.5; c.strokeStyle = INK; c.strokeRect(x, y, w, oh); }
          if (oh > 30) txt(c, dv.colors[i], x + w / 2, y + Math.min(oh - 16, 40), "700 20px Fredoka, sans-serif", "#fff");
        }
      };
    } else if (T === "packet") {
      dv.paths = d.paths; dv.port = null; dv.px = d.paths.home[0]; dv.py = d.paths.home[1]; dv.seg = 0; dv.dir = 0; dv.wait = 0; dv.route = [d.paths.home];
      dv.solids = function () { return [{ x: dv.px * TS, y: dv.py * TS, w: 2 * TS, h: 16, moving: true }]; };
      dv.setPort = function (p) { dv.port = p; dv.route = dv.paths[p]; dv.seg = 0; dv.dir = 1; dv.wait = .6; dv.px = dv.route[0][0]; dv.py = dv.route[0][1]; };
      dv.update = function (dt) {
        var ox = dv.px, oy = dv.py;
        if (dv.dir === 1 && dv.seg === 0 && !S.riding(dv)) dv.wait = Math.max(dv.wait, .35); // waits at home until Sprout hops on
        if (dv.dir && (dv.wait -= dt) <= 0) {
          var nxt = dv.route[dv.seg + dv.dir], tgt = nxt || null;
          if (!tgt) { dv.dir = -dv.dir; dv.wait = 1.4; if (dv.dir < 0 && dv.port !== 8000) S.floatText(dv.port === 22 ? "Not a web server: error!" : "Connection refused!", (dv.px + 1) * TS, dv.py * TS - 40, "#ff7b72"); }
          else {
            var ddx = tgt[0] - dv.px, ddy = tgt[1] - dv.py, dist = Math.hypot(ddx, ddy), step = 3.8 * dt;
            if (dist <= step) { dv.px = tgt[0]; dv.py = tgt[1]; dv.seg += dv.dir; } else { dv.px += ddx / dist * step; dv.py += ddy / dist * step; }
          }
        }
        dv.dx = (dv.px - ox) * TS; dv.dy = (dv.py - oy) * TS;
      };
      dv.draw = function (c, t) {
        ["22", "443", "8000"].forEach(function (p) {
          var pts = dv.paths[p], on = String(dv.port) === p;
          c.beginPath(); pts.forEach(function (q, i) { var x = q[0] * TS + TS, y = q[1] * TS + 8; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
          c.strokeStyle = INK; c.lineWidth = 9; c.stroke(); c.strokeStyle = on ? "#4ff0e0" : "#355766"; c.lineWidth = 5; c.stroke();
          var end = pts[pts.length - 1]; u.rr(c, end[0] * TS - 4, end[1] * TS - 52, 2 * TS + 8, 34, 9); paint(c, p === "8000" ? "#1f6b4a" : "#40263a", 2.5);
          txt(c, ":" + p, end[0] * TS + TS, end[1] * TS - 35, "700 20px JetBrains Mono, monospace", "#fff");
        });
        var x = dv.px * TS, y = dv.py * TS;
        c.save(); c.shadowColor = "#4ff0e0"; c.shadowBlur = 14; u.rr(c, x, y, 2 * TS, 16, 5); paint(c, "#9ff7ee", 2.5); c.restore();
        line(c, [x + 8, y + 3, x + TS, y + 11, x + 2 * TS - 8, y + 3], "#1d6f66", 2);
      };
    } else if (T === "lift") {
      dv.rise = 0; dv.target = 0; dv.w = d.w; dv.max = d.max; dv.floor = d.floor;
      dv.solids = function () { return [{ x: dv.x * TS, y: dv.y * TS - dv.rise, w: dv.w * TS, h: 16, moving: true }]; };
      dv.update = function (dt) {
        if (dv.auto && S.mode === "play") { // solved: a friendly elevator, so Sprout can never get stuck below
          var py = S.player.y, below = py > dv.y * TS - dv.floor * 3 + 20;
          if (S.riding(dv) && below) dv.target = dv.floor * 3; else if (!S.riding(dv) && below && py > dv.y * TS - 200) dv.target = 0;
        }
        var o = dv.rise; dv.rise += u.clamp(dv.target - dv.rise, -dt * 420, dt * 230); dv.dx = 0; dv.dy = -(dv.rise - o);
      };
      dv.up = function (floors, R) {
        var want = floors * dv.floor;
        if (want <= dv.max) { dv.target = want; return R.sleep(want / 230 + .2).then(function () { return true; }); }
        dv.target = dv.max;
        return R.sleep(dv.max / 230 + .1).then(function () {
          RQ.audio.sfx("boom"); R.shake(10); R.float("BONK!", (dv.x + 1.5) * TS, dv.y * TS - dv.rise - 60, "#ff7b72");
          return R.sleep(.6);
        }).then(function () { dv.target = 0; return R.sleep(dv.max / 420 + .2); }).then(function () { return false; });
      };
      dv.draw = function (c) {
        var x = dv.x * TS, y = dv.y * TS - dv.rise, w = dv.w * TS;
        line(c, [x + 10, y, x + 10, (dv.y - dv.max / TS) * TS - 40], "#556677", 3); line(c, [x + w - 10, y, x + w - 10, (dv.y - dv.max / TS) * TS - 40], "#556677", 3);
        c.save(); c.beginPath(); c.rect(x, y, w, 16); c.clip();
        for (var k = 0; k < w; k += 20) { c.fillStyle = (k / 20) % 2 ? INK : "#ffc53d"; c.beginPath(); c.moveTo(x + k, y + 16); c.lineTo(x + k + 10, y); c.lineTo(x + k + 20, y); c.lineTo(x + k + 10, y + 16); c.fill(); }
        c.restore(); c.lineWidth = 3; c.strokeStyle = INK; c.strokeRect(x, y, w, 16);
      };
    }
    return dv;
  }

  /* ------------------------------------------------------------ the five levels */
  function walls(B, w, h, rightX) { B.rect(0, 0, w - 1, 0, "#").rect(0, 0, 0, h - 1, "#").rect(w - 1, 0, w - 1, h - 1, rightX ? "X" : "#").rect(0, h - 1, w - 1, h - 1, "#"); }
  var LEVELS = [
    { title: "CPU Core", goal: "Climb the wall, build the bridge, rescue Mo", theme: "cpu", friend: "mo", w: 64, h: 18, gold: 55, silver: 100,
      map: function (B) {
        walls(B, 64, 18);
        B.rect(1, 15, 29, 16, "#").rect(8, 14, 9, 14, "#").rect(12, 13, 13, 14, "#").rect(19, 11, 22, 11, "=");
        B.rect(30, 8, 40, 16, "#").rect(41, 16, 48, 16, "^").rect(49, 8, 62, 16, "#").rect(40, 9, 40, 16, "X").rect(49, 9, 49, 16, "X");
      },
      start: [2, 14], checkpoints: [[33, 7]], cage: { x: 54, y: 7 }, exit: { x: 60, y: 7 },
      bugs: [{ x: 20, y: 14, x0: 15, x1: 27 }],
      labels: [{ x: 6, y: 5, t: "CPU" }, { x: 52, y: 4, t: "CORE 0" }],
      signs: [{ x: 4, y: 11, t: "← →  move     Space  jump" }, { x: 22.5, y: 8, t: "Hold → on the wall,\nthen jump again!" }],
      ruler: { x: 41, y: 10, n: 8 },
      devices: [{ id: "bridge", type: "bridge", x: 41, y: 8 }],
      terminals: [{ x: 37, y: 7, file: "bridge.py", focus: [45, 9], options: [1, 2, 3, 4, 5, 6, 7, 8, 9], start: 0,
        code: "# bridge.py: one plank per loop\nfor i in range({{v}}):\n    bridge.extend()",
        hint: "Count the tiles of the gap: the yellow numbers under the bridge.",
        run: async function (n, R) {
          var b = R.dev("bridge"), gap = 8;
          await b.set(0, R);
          for (var i = 0; i < n; i++) {
            R.loopVar("i = " + i);
            if (i >= gap) {
              R.sfx("boom"); R.shake(8); R.float("BONK!", (b.x + gap) * TS, b.y * TS - 30, "#ff7b72");
              R.out("[r]BridgeError: plank " + (i + 1) + " hit the wall![/r] The gap is only " + gap + " tiles.");
              await R.sleep(.8); await b.set(0, R); R.loopVar(null); return false;
            }
            await b.set(i + 1, R);
          }
          R.loopVar(null);
          if (n < gap) { R.out("[y]Only " + n + " planks: too short! The bridge folds back up.[/y]"); await R.sleep(.9); await b.set(0, R); return false; }
          R.out("[g]" + gap + " planks: the bridge reaches the other side![/g]"); return true;
        } }],
      intro: [["pix", "Move with the **arrow keys** and jump with **Space**. Hold toward a wall to stick, then jump again!"],
              ["pix", "These code screens, called **terminals**, show Python-style code. Change it, and the room changes!"]],
      cards: ["le-loop"] },
    { title: "RAM & GPU", goal: "Make the condition True, then power the fans", theme: "gpu", friend: "hoot", w: 72, h: 18, gold: 75, silver: 130,
      map: function (B) {
        walls(B, 72, 18, true);
        B.rect(1, 15, 12, 16, "#").rect(13, 16, 36, 16, "^").rect(15, 13, 17, 13, "=").rect(21, 11, 23, 11, "=").rect(27, 12, 29, 12, "=").rect(32, 13, 34, 13, "=");
        B.rect(37, 15, 70, 16, "#").rect(47, 1, 47, 11, "X").rect(56, 5, 70, 6, "#");
      },
      start: [2, 14], checkpoints: [[39, 14], [49, 14]], cage: { x: 62, y: 4 }, exit: { x: 68, y: 4 },
      bugs: [{ fly: true, x: 25, y: 8.5, ay: 1.5, sp: 1.6 }, { x: 65, y: 4, x0: 64, x1: 67 }],
      labels: [{ x: 8, y: 4, t: "RAM" }, { x: 51, y: 9, t: "GPU" }],
      signs: [{ x: 18, y: 6, t: "RAM sticks: jump across!" }],
      devices: [{ id: "door", type: "door", x: 47, y: 12, h: 3 }, { id: "fans", type: "fans", x: 51, y: 14, w: 4, top: 1 }],
      terminals: [
        { x: 43, y: 14, file: "door.py", focus: [46, 11], options: [6, 4, 2], start: 0,
          code: "nir, red = 8, {{v}}\nif ndvi(nir, red) >= 0.6:    # healthy forest?\n    door.open()",
          hint: "NDVI = (nir - red) / (nir + red). A smaller red number makes it bigger.",
          run: async function (red, R) {
            var v = (8 - red) / (8 + red), s = Math.round(v * 100) / 100, ok = v >= .6 - 1e-9;
            R.out("ndvi(8, " + red + ") = (8 - " + red + ") / (8 + " + red + ") = [c]" + s + "[/c]");
            await R.sleep(.6);
            R.out(s + " >= 0.6 is " + (ok ? "[g]True[/g]: door.open()" : "[r]False[/r]: the door stays shut"));
            if (ok) { R.dev("door").open = true; R.sfx("powerup"); await R.sleep(1); } else R.sfx("buzz");
            return ok;
          } },
        { x: 56, y: 14, file: "train.py", focus: [53, 8], options: ["cpu", "cuda"], start: 0,
          code: "device = torch.device(\"{{v}}\")   # where ForestNet trains\nfans.power = 100 if device.type == \"cuda\" else 10   # game rule",
          hint: "PyTorch calls a compatible NVIDIA graphics card (GPU) **cuda**.",
          run: async function (dev, R) {
            var f = R.dev("fans"), gpu = dev === "cuda";
            f.target = gpu ? 1 : .55; R.sfx(gpu ? "powerup" : "engine");
            R.out("device.type = \"" + dev + "\"  →  fans.power = " + (gpu ? 100 : 10));
            await R.sleep(1.3);
            R.out(gpu ? "[g]Game version: the GPU is busy training, so the fans roar. Ride the wind up![/g]" : "[y]Game version: the CPU trains slowly, so the fans only whisper. Not enough wind![/y]");
            return gpu;
          } }],
      intro: [["mo", "Thanks for the rescue! Next door: the **RAM** room, then the hot **GPU** room."],
              ["hoot", "Whoo! I'm stuck on a high ledge. That door opens when **NDVI**, our plant-green score, is 0.6 or more."]],
      cards: ["le-condition", "le-cuda"] },
    { title: "Disk Drive", goal: "Open the right door, then sort the steps", theme: "disk", friend: "pix", w: 72, h: 18, gold: 90, silver: 160,
      map: function (B) {
        walls(B, 72, 18);
        B.rect(1, 15, 10, 16, "#").rect(11, 16, 28, 16, "^").rect(12, 13, 17, 13, "<").rect(21, 12, 26, 12, ">").rect(29, 15, 64, 16, "#");
        B.rect(65, 1, 70, 7, "X").rect(65, 10, 70, 16, "X");
      },
      start: [2, 14], checkpoints: [[30, 14], [51, 14]], cage: { x: 41.5, y: 14, locked: true, hidden: true }, exit: { x: 68, y: 9 },
      bugs: [{ fly: true, x: 23.5, y: 8.5, ay: 1, ax: .8, sp: 1.4 }],
      labels: [{ x: 4, y: 5, t: "DISK" }, { x: 57, y: 4, t: "SORT" }],
      signs: [{ x: 14, y: 9, t: "Moving belts!" }],
      devices: [{ id: "vaults", type: "vaults", x: 35, y: 13 }, { id: "stairs", type: "stairs", x: 55, y: 15, raw: [4, 1, 5, 2, 3] }],
      terminals: [
        { x: 32, y: 14, file: "vault.py", focus: [40, 11], options: [0, 1, 2, 3], start: 1,
          code: "doors = [\"red\", \"blue\", \"green\", \"gold\"]\nroom.open_door(doors[{{v}}])   # Pix is behind the green door",
          hint: "Python counts from 0: doors[0] is red, doors[1] is blue …",
          run: async function (i, R) {
            var v = R.dev("vaults");
            R.out("doors[" + i + "] is \"" + v.colors[i] + "\"");
            if (i === 2) R.cage.locked = false;
            await v.openDoor(i, R);
            if (i === 2) { R.out("[g]The green door! Index 2 is the third item.[/g]"); R.sfx("powerup"); return true; }
            R.sfx("giggle"); R.out("[r]A Glitch Bug was hiding behind the " + v.colors[i] + " door. Hee hee![/r]");
            return false;
          } },
        { x: 53, y: 14, file: "rank.py", focus: [60, 10], options: ["True", "False"], start: 0,
          code: "# rank.py: line up the lost-forest patches by size\nsteps = sorted(patches, key=lambda p: p[\"area_ha\"], reverse={{v}})\nstairs.build(steps)    # left to right",
          hint: "You climb from the left. The smallest step must come first.",
          run: async function (rev, R) {
            var st = R.dev("stairs"), list = AREAS.slice().sort(function (a, b) { return rev === "True" ? b - a : a - b; });
            R.out("step sizes (area_ha) = [" + list.map(ha).join(", ") + "]");
            await st.arrange(list, R);
            var ok = rev === "False";
            R.out(ok ? "[g]Smallest first: a staircase up to the exit![/g]" : "[y]Biggest first, the way ReSeed ranks patches. But now the tallest step blocks you![/y]");
            return ok;
          } }],
      intro: [["hoot", "Whoo, the disk room! Remember: in Python, the first item in a list is number **0**."],
              ["mo", "Pix is locked behind one of those coloured doors. Open the right one!"]],
      cards: ["le-lists"] },
    { title: "Network", goal: "Pick the right port, then switch off the lasers", theme: "net", friend: "tuki", w: 76, h: 18, gold: 90, silver: 160,
      map: function (B) {
        walls(B, 76, 18, true);
        B.rect(1, 15, 14, 16, "#").rect(15, 16, 18, 16, "^").rect(19, 15, 24, 16, "#").rect(25, 16, 28, 16, "^").rect(29, 15, 74, 16, "#");
        B.rect(54, 6, 74, 7, "#").rect(54, 6, 54, 7, "X").rect(41, 15, 42, 15, ".");
      },
      start: [2, 14], checkpoints: [[21, 14], [55, 5]], cage: { x: 70, y: 5 }, exit: { x: 73, y: 5 },
      bugs: [{ fly: true, x: 16.5, y: 12, ay: 1.5, sp: 1.8 }, { x: 33, y: 14, x0: 31, x1: 37 }],
      labels: [{ x: 6, y: 5, t: "NET" }, { x: 62, y: 11, t: "ROUTER" }],
      signs: [{ x: 31, y: 12, t: "Ride the packet!" }],
      devices: [{ id: "packet", type: "packet", paths: { home: [41, 15],
          "8000": [[41, 15], [41, 10], [49, 10], [49, 6], [52, 6]], "22": [[41, 15], [41, 10], [36, 10], [36, 4]], "443": [[41, 15], [41, 10], [44, 10], [44, 6.5]] } },
        { id: "laser1", type: "laser", x: 59, y: 1, h: 5 }, { id: "laser2", type: "laser", x: 63, y: 1, h: 5 }, { id: "laser3", type: "laser", x: 67, y: 1, h: 5 }],
      terminals: [
        { x: 39, y: 14, file: "health_check.py", focus: [45, 8], options: [22, 443, 8000], start: 0, closeOnFail: true,
          code: "import requests    # ReSeed's server: python -m reseed serve\nurl = \"http://localhost:{{v}}/api/health\"\npacket = requests.get(url)    # game rule: ride along!",
          hint: "`python -m reseed serve` opens the website on http://localhost:8000.",
          run: async function (port, R) {
            R.out("GET http://localhost:" + port + "/api/health");
            R.dev("packet").setPort(port);
            await R.sleep(.5);
            if (port === 8000) { R.out("[g]200 OK  {\"ok\": true, ...}[/g]  ReSeed's server answers on 8000. Hop on the packet!"); return true; }
            R.out(port === 22 ? "[r]In this lab, port 22 runs SSH, not a web server. The web request fails![/r]" : "[r]Nothing is listening on port 443 here. Connection refused![/r]");
            return false;
          } },
        { x: 57, y: 5, file: "lasers.py", focus: [63, 3], options: ["laser.on()", "laser.off()", "break"], start: 0,
          code: "for laser in lasers:      # 3 lasers\n    {{v}}",
          hint: "The loop visits every laser. What should each one do?",
          run: async function (ln, R) {
            var ls = ["laser1", "laser2", "laser3"].map(R.dev);
            if (ln === "break") { R.loopVar("laser = lasers[0]"); await R.sleep(.5); R.loopVar(null); R.out("[y]break stops the loop at once. Nothing changed![/y]"); return false; }
            for (var i = 0; i < 3; i++) {
              R.loopVar("laser = lasers[" + i + "]");
              if (ln === "laser.off()") { ls[i].on = false; R.sfx("zap"); } else R.sfx("beep");
              await R.sleep(.5);
            }
            R.loopVar(null);
            if (ln === "laser.off()") { R.out("[g]laser 1 off · laser 2 off · laser 3 off[/g]"); return true; }
            R.out("[y]All 3 lasers were already on. They are still on![/y]"); return false;
          } }],
      intro: [["pix", "Network room! Data travels in **packets**, and a **port** number picks which program answers."],
              ["mo", "Tuki is behind the lasers. A loop can switch off every laser in a list!"]],
      cards: ["le-port"] },
    { title: "Database & Roof", goal: "Free Koa, take the lift, reach the drone", theme: "db", friend: "koa", w: 60, h: 30, gold: 95, silver: 170, skyRow: 16,
      map: function (B) {
        B.rect(0, 16, 32, 16, "#").rect(36, 16, 59, 16, "#").rect(0, 16, 0, 29, "X").rect(59, 16, 59, 29, "X").rect(0, 29, 59, 29, "#");
        B.rect(1, 27, 32, 28, "#").rect(36, 27, 58, 28, "#").rect(33, 28, 35, 28, "#");
        B.rect(8, 25, 9, 26, "#").rect(14, 24, 15, 26, "#");
        B.rect(32, 11, 36, 11, "#");
        B.rect(40, 13, 43, 13, "=").rect(46, 10, 49, 10, "=").rect(51, 7, 58, 7, "#");
      },
      start: [2, 26], checkpoints: [[18, 26], [28, 26], [38, 15]], cage: { x: 24, y: 26, locked: true }, exit: { x: 56, y: 6 },
      bugs: [{ x: 11, y: 26, x0: 10, x1: 13 }, { x: 44, y: 15, x0: 40, x1: 50 }, { fly: true, x: 50, y: 8.5, ay: 1.2, sp: 2 }],
      labels: [{ x: 4, y: 19, t: "DATABASE" }],
      signs: [{ x: 26, y: 22, t: "Lift to the roof →" }],
      floors: { x: 36.6, base: 27, step: 440 / 3 / TS },
      devices: [{ id: "lift", type: "lift", x: 33, y: 27, w: 3, max: 470, floor: 440 / 3 }],
      terminals: [
        { x: 21, y: 26, file: "lookup.py", focus: [23, 24], options: ["oak_hickory", "southern_eucalypt", "borneo_lowland"], start: 0,
          code: "friend = \"koala\"\nanimals = BIOMES[\"{{v}}\"][\"animals\"]\nif friend in animals:\n    cage.open()",
          hint: "Koalas live on Kangaroo Island: eucalyptus country.",
          run: async function (key, R) {
            var an = (((DATA.biomes || {})[key]) || {}).animals || [];
            R.out("animals = [c][" + an.map(function (a) { return "'" + a + "'"; }).join(", ") + "][/c]");
            await R.sleep(.7);
            var ok = an.indexOf("koala") >= 0;
            R.out(ok ? "[g]\"koala\" in animals is True: cage.open()[/g]" : "[r]\"koala\" in animals is False.[/r] No koalas in that forest!");
            if (ok) { R.cage.locked = false; R.sfx("powerup"); await R.sleep(.6); } else R.sfx("buzz");
            return ok;
          } },
        { x: 34, y: 26, attach: "lift", file: "roll.py", focus: [34, 18.5], panel: "bottom", options: [0.09, 1.8, 5.5], start: 1,
          code: "volume = {{v}}     # mL: pine 0.09 · seed ball 1.8 · acorn 5.5\nseeds_per_roll = int(159 * 0.6 * 0.9 / volume)\nlift.up(seeds_per_roll // 5)    # game rule: 1 floor per 5 seeds",
          hint: "The roof is 3 floors up, so you need 15 seeds per roll.",
          run: async function (vol, R) {
            var n = Math.floor(159 * 0.6 * 0.9 / vol + 1e-6), fl = Math.floor(n / 5), lf = R.dev("lift");
            R.player.x = u.clamp(R.player.x, lf.x * TS + 2, (lf.x + lf.w) * TS - R.player.w - 2);
            R.out("seeds_per_roll = [c]" + n + "[/c]   lift.up(" + n + " // 5) = lift.up([c]" + fl + "[/c])");
            await R.sleep(.5);
            var ok = await R.dev("lift").up(fl, R);
            if (ok) R.dev("lift").auto = true;
            R.out(ok ? "[g]3 floors up: the roof! ReSeed's logistics.py also plans 15 black oak acorns per 159 mL roll.[/g]" : "[r]LiftError: " + fl + " floors is too high. The lift hit the top and slid back down![/r]");
            return ok;
          } }],
      intro: [["tuki", "Squawk! Koa is locked in the **database** room. Find Koa's forest type, called a **biome**, to open the cage!"],
              ["sprout", "Then the lift takes us up to the **cloud roof**. Our seed drone is waiting!"]],
      cards: ["le-dict"] }
  ];

  /* ------------------------------------------------------------ one level */
  function play(def) {
    return function (L) {
      var th = THEMES[def.theme];
      // map
      var g = []; for (var yy = 0; yy < def.h; yy++) { g.push([]); for (var xx = 0; xx < def.w; xx++) g[yy].push("."); }
      var B = { rect: function (x0, y0, x1, y1, ch) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < def.w) g[y][x] = ch; return B; } };
      def.map(B);
      var MW = def.w * TS, MH = def.h * TS;

      var S = { g: g, mode: "play", time: 0, respawns: 0, runs: 0, rescued: false, cam: { x: 0, y: 0 }, shake: 0, parts: [], floats: [], sleeps: [],
        devs: [], bugs: [], focus: null, termOpen: null, done: false };
      S.riding = function (d) { return p.rideDev === d && S.time - p.rideT < .3 && S.mode === "play"; };
      S.floatText = function (s, x, y, col) { S.floats.push({ s: s, x: x, y: y, c: col || "#fff", life: 1.6 }); };
      def.devices.forEach(function (d) { S.devs.push(mkDevice(d, S)); });
      function dev(id) { for (var i = 0; i < S.devs.length; i++) if (S.devs[i].id === id) return S.devs[i]; return null; }
      def.bugs.forEach(function (b) { addBug(b); });
      function addBug(b) {
        S.bugs.push(b.fly ? { fly: true, bx: (b.x + .5) * TS, by: (b.y + 1) * TS, ay: b.ay || 0, ax: b.ax || 0, sp: b.sp || 1.5, t: Math.random() * 6, x: 0, y: 0, dir: 1 }
          : { x: (b.x + .5) * TS, y: (b.y + 1) * TS, vx: 70, dir: 1, x0: b.x0 * TS, x1: (b.x1 + 1) * TS, pop: 0 });
      }
      var cps = [def.start].concat(def.checkpoints).map(function (p, i) { return { x: p[0], y: p[1], on: i === 0 }; });
      var cp = cps[0];
      var cage = { x: def.cage.x, y: def.cage.y, locked: !!def.cage.locked, open: false };
      var terms = def.terminals.map(function (t) { return { spec: t, solved: false, armed: true, x: t.x, y: t.y }; });
      var p = { x: 0, y: 0, w: 28, h: 30, vx: 0, vy: 0, face: 1, ground: false, gref: null, wall: 0, wallT: 0, wallDir: 0, coyote: 0, buffer: 0, lock: 0, jumping: false,
        sx: 1, sy: 1, dead: 0, blink: 0, lastVy: 0 };
      function spawnAt(c0) { p.x = (c0.x + .5) * TS - p.w / 2; p.y = (c0.y + 1) * TS - p.h - .01; p.vx = p.vy = 0; p.dead = 0; p.gref = null; p.inv = 1.2; }
      spawnAt(cp); S.player = p;
      var trail = [];

      /* layout: canvas + terminal panel + touch pad */
      var wrap = u.el("div", { class: "fill" }); L.stage.appendChild(wrap);
      var cv = L.canvas({ w: 1280, h: VH, parent: wrap, fill: true, label: "server lab", onResize: function (api) { W = api.w; } });
      W = cv.w; var ctx = cv.ctx;
      var keys = {}, touch = {};
      var pad = buildPad();
      var panel = buildPanel();

      /* ---------- input */
      function dirInput() { return ((keys.right || touch.right) ? 1 : 0) - ((keys.left || touch.left) ? 1 : 0); }
      function jumpHeld() { return !!(keys.jump || touch.jump); }
      var KEYMAP = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", " ": "jump", ArrowUp: "jump", w: "jump", W: "jump", z: "jump", Z: "jump",
        e: "use", E: "use", ArrowDown: "use", s: "use", S: "use", Enter: "use" };
      L.on(window, "keydown", function (e) {
        if (document.querySelector(".rq-overlay, .rq-talk")) return;
        if (S.mode === "term") { panel.key(e); return; }
        var k = KEYMAP[e.key]; if (!k) return;
        e.preventDefault();
        if (k === "jump" && !e.repeat) p.buffer = PH.buffer;
        if (k === "use" && !e.repeat) tryUse();
        keys[k] = true;
      });
      L.on(window, "keyup", function (e) { var k = KEYMAP[e.key]; if (k) keys[k] = false; });
      L.on(window, "blur", function () { keys = {}; });
      function tryUse() { var t = nearTerm(); if (t && !t.solved && S.mode === "play") openTerm(t); }

      function buildPad() {
        var l = u.el("div", { class: "le-pad l" }), r = u.el("div", { class: "le-pad r" }), btns = {};
        [["left", "◀", l], ["right", "▶", l], ["use", "💻", r], ["jump", "⤒", r]].forEach(function (b) {
          var el = u.el("button", { class: b[0] === "jump" ? "big" : "", "aria-label": b[0], html: b[1] });
          btns[b[0]] = el; b[2].appendChild(el);
          function down(e) { e.preventDefault(); touch[b[0]] = true; el.classList.add("down"); if (b[0] === "jump") p.buffer = PH.buffer; if (b[0] === "use") tryUse(); }
          function up() { touch[b[0]] = false; el.classList.remove("down"); }
          L.on(el, "pointerdown", down); L.on(el, "pointerup", up); L.on(el, "pointerleave", up); L.on(el, "pointercancel", up);
        });
        wrap.appendChild(l); wrap.appendChild(r);
        return { l: l, r: r, btns: btns, show: function (v) { l.style.display = r.style.display = v ? "flex" : "none"; } };
      }

      /* ---------- terminal panel (DOM) */
      function buildPanel() {
        var el = u.el("div", { class: "le-term", role: "dialog", "aria-label": "code terminal" });
        var title = u.el("span"), close = u.el("button", { class: "btn le-x", "aria-label": "close terminal", html: "✕" });
        var code = u.el("pre", { class: "le-code" }), opts = u.el("div", { class: "le-row" }), out = u.el("div", { class: "le-out", "aria-live": "polite" });
        var runB = u.el("button", { class: "btn go", html: "▶ Run" }), varChip = u.el("span", { class: "le-var", style: { display: "none" } }), hint = u.el("span", { class: "le-hint" });
        el.appendChild(u.el("div", { class: "le-bar" }, u.el("span", { text: "💻" }), title, varChip, close));
        el.appendChild(code); el.appendChild(opts); el.appendChild(out); el.appendChild(u.el("div", { class: "le-row" }, hint));
        wrap.appendChild(el);
        var cur = null, idx = 0, busy = false, wrong = 0;
        function fmtV(v) { return String(v); }
        function render() {
          var parts = cur.spec.code.split("{{v}}");
          code.innerHTML = "";
          code.appendChild(u.el("span", { html: RQ.code.highlight(parts[0]) }));
          var slot = u.el("button", { class: "le-slot", "aria-label": "change value", title: "click to change", html: u.esc(fmtV(cur.spec.options[idx])) + " ▾", onclick: function () { if (!busy) { pick((idx + 1) % cur.spec.options.length); } } });
          code.appendChild(slot);
          code.appendChild(u.el("span", { html: RQ.code.highlight(parts[1] || "") }));
          opts.innerHTML = "";
          opts.appendChild(u.el("span", { class: "lbl", text: "Try:" }));
          cur.spec.options.forEach(function (o, i) {
            opts.appendChild(u.el("button", { class: "le-opt" + (i === idx ? " on" : ""), html: (typeof o !== "number" ? "<small>" + (i + 1) + "</small> " : "") + u.esc(fmtV(o)), onclick: function () { if (!busy) pick(i); } }));
          });
          opts.appendChild(runB);
        }
        function pick(i) { idx = i; RQ.audio.sfx("select"); render(); }
        function print(s) { out.appendChild(u.el("div", { html: RQ.term.markup(s) })); out.scrollTop = out.scrollHeight; }
        var R = {
          dev: dev, out: print, sfx: RQ.audio.sfx, cage: cage, player: p,
          sleep: function (sec) { return new Promise(function (res) { S.sleeps.push({ t: sec, res: res }); }); },
          shake: function (a) { S.shake = Math.max(S.shake, a); },
          float: function (s, x, y, col) { S.floatText(s, x, y, col); },
          loopVar: function (s) { varChip.style.display = s ? "" : "none"; varChip.textContent = s || ""; },
          spawnBug: function (b) { addBug(b); var nb = S.bugs[S.bugs.length - 1]; nb.pop = 1; RQ.audio.sfx("giggle"); S.floatText("hee hee!", nb.x, nb.y - 50, "#c792ea"); }
        };
        runB.onclick = function () { run(); };
        close.onclick = function () { hide(); };
        async function run() {
          if (busy || !cur) return;
          busy = true; runB.disabled = true; S.runs++;
          out.innerHTML = ""; print("[dim]>>> running " + cur.spec.file + "[/dim]");
          RQ.audio.sfx("beep");
          var ok = false;
          try { ok = await cur.spec.run(cur.spec.options[idx], R); } catch (e) { console.error(e); }
          if (!L.alive) return;
          busy = false; runB.disabled = false;
          if (ok) {
            cur.solved = true; RQ.audio.sfx("good");
            var t0 = cur; setTimeout(function () { if (L.alive && cur === t0) hide(); }, 1300);
          } else {
            wrong++;
            if (wrong >= 2 || L.fails >= 1) hint.innerHTML = "💡 " + RQ.ui.md(cur.spec.hint);
            if (cur.spec.closeOnFail) { var t1 = cur; setTimeout(function () { if (L.alive && cur === t1) hide(); }, 1600); }
          }
        }
        function hide() {
          if (busy) return;
          el.classList.remove("open"); if (cur) cur.armed = false; cur = null; S.termOpen = null; S.focus = null;
          if (S.mode === "term") S.mode = "play"; pad.show(true); keys = {};
        }
        return {
          el: el, busy: function () { return busy; },
          open: function (t) {
            cur = t; idx = t.idx != null ? t.idx : t.spec.start; wrong = 0; hint.innerHTML = ""; out.innerHTML = ""; varChip.style.display = "none";
            title.textContent = t.spec.file + "  ·  game version"; render();
            var fy = t.spec.focus[1] * TS, low = t.spec.panel ? t.spec.panel === "top" : fy > (Math.min(MH, VH) * .5 + (MH > VH ? S.cam.y : 0));
            el.classList.remove("top", "bottom"); el.classList.add(low ? "top" : "bottom");
            el.classList.add("open"); pad.show(false);
            print("[dim]Pick a value, then press Run (or Enter).[/dim]");
            S.focus = { x: (t.spec.focus[0] + .5) * TS, y: fy, at: low ? .68 : .3 };
          },
          hide: hide,
          key: function (e) {
            if (!cur) return;
            var n = parseInt(e.key, 10), len = cur.spec.options.length;
            if (e.key === "Escape") { e.preventDefault(); hide(); }
            else if (e.key === "Enter") { e.preventDefault(); run(); }
            else if (busy) { if (e.key === " " || /^Arrow/.test(e.key)) e.preventDefault(); }
            else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); pick((idx + 1) % len); }
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); pick((idx + len - 1) % len); }
            else if (!isNaN(n) && cur.spec.options.indexOf(n) >= 0) { e.preventDefault(); pick(cur.spec.options.indexOf(n)); }
            else if (n >= 1 && n <= len && typeof cur.spec.options[0] !== "number") { e.preventDefault(); pick(n - 1); }
            else if (e.key === " ") e.preventDefault();
            if (cur) cur.idx = idx;
          }
        };
      }
      function termPos(t) { var a = t.spec.attach ? dev(t.spec.attach) : null; return { x: t.x * TS, y: (t.y + 1) * TS - (a ? a.rise : 0) }; }
      function nearTerm() {
        for (var i = 0; i < terms.length; i++) { var q = termPos(terms[i]); if (overlap(p, { x: q.x - 22, y: q.y - 70, w: TS + 44, h: 70 })) return terms[i]; }
        return null;
      }
      function openTerm(t) { S.mode = "term"; p.vx = 0; keys = {}; panel.open(t); }

      /* ---------- physics */
      function tileAt(tx, ty) { if (tx < 0 || tx >= def.w) return "#"; if (ty < 0 || ty >= def.h) return "."; return g[ty][tx]; }
      function rectsNear(x, y, w, h) {
        var out = [], tx0 = Math.floor(x / TS) - 1, tx1 = Math.floor((x + w) / TS) + 1, ty0 = Math.floor(y / TS) - 1, ty1 = Math.floor((y + h) / TS) + 1;
        for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
          var ch = tileAt(tx, ty);
          if (SOLID[ch]) out.push({ x: tx * TS, y: ty * TS, w: TS, h: TS, sticky: ch === "#", belt: ch === "<" ? -1 : ch === ">" ? 1 : 0 });
          else if (ch === "=") out.push({ x: tx * TS, y: ty * TS, w: TS, h: 12, oneway: true });
        }
        S.devs.forEach(function (d) { if (d.solids) d.solids().forEach(function (r) { r.dev = d; out.push(r); }); });
        return out;
      }
      function moveX(dx) {
        p.x += dx;
        var rs = rectsNear(p.x, p.y, p.w, p.h);
        for (var i = 0; i < rs.length; i++) { var r = rs[i]; if (r.oneway || !overlap(p, r)) continue; if (dx > 0) p.x = r.x - p.w; else if (dx < 0) p.x = r.x + r.w; p.vx = 0; }
        p.x = u.clamp(p.x, 0, MW - p.w);
      }
      function moveY(dy) {
        var prevB = p.y + p.h, landed = null;
        p.y += dy;
        var rs = rectsNear(p.x, p.y, p.w, p.h);
        for (var i = 0; i < rs.length; i++) {
          var r = rs[i];
          if (r.oneway) { if (dy >= 0 && prevB <= r.y + 1 && p.y + p.h > r.y && p.x + p.w > r.x && p.x < r.x + r.w) { p.y = r.y - p.h; p.vy = 0; landed = r; } continue; }
          if (!overlap(p, r)) continue;
          if (dy > 0) { p.y = r.y - p.h; landed = r; } else if (dy < 0) { p.y = r.y + r.h; p.jumping = false; }
          p.vy = 0;
        }
        if (p.y < -60) { p.y = -60; p.vy = Math.max(0, p.vy); }
        return landed;
      }
      function unstick() { // pushed by a moving part: pop up out of it
        for (var k = 0; k < 40; k++) { var hit = rectsNear(p.x, p.y, p.w, p.h).some(function (r) { return !r.oneway && overlap(p, r); }); if (!hit) return; p.y -= 6; }
      }
      function wallProbe() {
        var rs = rectsNear(p.x - 3, p.y, p.w + 6, p.h), Lr = { x: p.x - 3, y: p.y + 6, w: 3, h: p.h - 12 }, Rr = { x: p.x + p.w, y: p.y + 6, w: 3, h: p.h - 12 };
        for (var i = 0; i < rs.length; i++) { if (!rs[i].sticky) continue; if (overlap(Lr, rs[i])) return -1; if (overlap(Rr, rs[i])) return 1; }
        return 0;
      }
      function step(dt) {
        var dir = dirInput(), wasGround = p.ground;
        p.blink -= dt; if (p.blink < -3) p.blink = .12;
        if (dir) p.face = dir;
        p.coyote = p.ground ? PH.coyote : p.coyote - dt; p.buffer -= dt; p.lock -= dt; p.wallT -= dt;
        var target = dir * PH.run, acc = p.ground ? PH.acc : PH.air;
        if (p.lock > 0) acc *= .25;
        if (dir) p.vx += u.clamp(target - p.vx, -acc * dt, acc * dt);
        else if (p.ground) p.vx += u.clamp(-p.vx, -PH.fric * dt, PH.fric * dt);
        else p.vx *= Math.pow(.2, dt);
        // gravity, fans, wall stick
        p.vy = Math.min(PH.maxFall, p.vy + PH.grav * dt);
        S.devs.forEach(function (d) {
          if (d.type === "fans" && d.power > .02 && overlap(p, d.region)) {
            var f = u.clamp((p.y - d.region.y) / 90, 0, 1); p.vy -= d.power * 3900 * f * dt; p.vy = Math.max(p.vy, -420 * d.power);
            if (f < 1 && d.power > .9) p.vy *= Math.pow(.04, dt); // hover calmly near the top
            if (!dir && !p.ground) { p.vx *= Math.pow(.02, dt); p.vx += (d.region.x + d.region.w / 2 - p.x - p.w / 2) * 3 * dt; } // the wind catches Sprout
          }
        });
        p.wall = p.ground ? 0 : wallProbe();
        if (p.wall) { p.wallT = .12; p.wallDir = p.wall; }
        if (p.wall && dir === p.wall && p.vy > PH.slide) { p.vy = PH.slide; if (Math.random() < .3) S.parts.push({ x: p.x + (p.wall > 0 ? p.w : 0), y: p.y + p.h - 4, vx: -p.wall * 30, vy: -20, life: .4, c: "#a8f07a", s: 4 }); }
        // jumps
        if (p.buffer > 0) {
          if (p.ground || p.coyote > 0) { p.vy = -PH.jump; p.ground = false; p.coyote = 0; p.buffer = 0; p.jumping = true; p.sy = 1.25; p.sx = .8; RQ.audio.sfx("jump"); puff(p.x + p.w / 2, p.y + p.h, 6); }
          else if (p.wallT > 0) {
            var away = -p.wallDir, climb = dir === p.wallDir;
            p.vx = away * (climb ? PH.kick : PH.wjx); p.vy = -PH.wjy; p.lock = climb ? .09 : .16; p.buffer = 0; p.wallT = 0; p.jumping = true; p.face = away; p.sy = 1.2; p.sx = .85;
            RQ.audio.sfx("jump"); puff(p.x + (p.wallDir > 0 ? p.w : 0), p.y + p.h / 2, 5);
          }
        }
        if (p.jumping && !jumpHeld() && p.vy < 0) { p.vy *= PH.cut; p.jumping = false; }
        if (p.vy >= 0) p.jumping = false;
        // integrate (2 substeps)
        var landed = null;
        for (var s = 0; s < 2; s++) { moveX(p.vx * dt / 2); var l2 = moveY(p.vy * dt / 2); if (l2) landed = l2; }
        p.ground = !!landed && p.vy >= 0; p.gref = landed;
        if (landed && landed.dev) { p.rideDev = landed.dev; p.rideT = S.time; }
        if (landed && landed.belt) moveX(landed.belt * PH.belt * dt);
        if (p.ground && !wasGround) { if (p.lastVy > 380) { p.sy = .75; p.sx = 1.25; puff(p.x + p.w / 2, p.y + p.h, 8); RQ.audio.sfx("tick"); } }
        p.lastVy = p.vy > 0 ? p.vy : p.lastVy * .9;
        if (!p.ground && p.vy > 0) p.lastVy = p.vy;
        if (p.ground && Math.abs(p.vx) > 200 && Math.random() < .2) S.parts.push({ x: p.x + p.w / 2 - p.face * 10, y: p.y + p.h, vx: -p.face * 40, vy: -40, life: .35, c: "rgba(200,220,240,.7)", s: 4 });
        p.sx += (1 - p.sx) * Math.min(1, dt * 12); p.sy += (1 - p.sy) * Math.min(1, dt * 12);
      }
      function puff(x, y, n) { for (var i = 0; i < n; i++) S.parts.push({ x: x, y: y, vx: u.rand(-90, 90), vy: u.rand(-90, -10), life: .4, c: "rgba(220,235,250,.8)", s: 5 }); }

      /* ---------- hazards, pickups */
      function die(why, bug) {
        if (p.dead > 0) return;
        p.dead = .75; S.respawns++; RQ.audio.sfx(why === "bug" ? "giggle" : "zap"); S.shake = 6;
        for (var i = 0; i < 22; i++) S.parts.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, vx: u.rand(-260, 260), vy: u.rand(-320, 60), life: .7, c: i % 2 ? "#47b95c" : "#8be07f", s: 6, g: 600 });
        if (bug) S.floatText("hee hee!", bug.x, bug.y - 48, "#c792ea");
        if (S.respawns === 3) L.toast(def.theme === "cpu" ? "💡 Tip: hold → against the wall and tap jump again and again!" : "💡 Tip: wait for the bug to turn around, then jump over it.", "info", 3200);
      }
      function checkHazards() {
        var hb = { x: p.x + 5, y: p.y + 5, w: p.w - 10, h: p.h - 8 };
        var tx0 = Math.floor(p.x / TS), tx1 = Math.floor((p.x + p.w) / TS), ty0 = Math.floor(p.y / TS), ty1 = Math.floor((p.y + p.h) / TS);
        for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) if (tileAt(tx, ty) === "^" && overlap(hb, { x: tx * TS + 4, y: ty * TS + 20, w: TS - 8, h: 20 })) return die("zap");
        if (p.y > MH + 60) return die("fall");
        if (p.inv > 0) return; // just respawned: a moment of safety from bugs and lasers
        for (var i = 0; i < S.devs.length; i++) { var hz = S.devs[i].hazards ? S.devs[i].hazards() : []; for (var k = 0; k < hz.length; k++) if (overlap(hb, hz[k])) return die("zap"); }
        for (i = 0; i < S.bugs.length; i++) { var b = S.bugs[i]; if (overlap(hb, { x: b.x - 13, y: b.y - (b.fly ? 26 : 20), w: 26, h: b.fly ? 24 : 20 })) return die("bug", b); }
      }
      async function pickups() {
        cps.forEach(function (c0) {
          if (!c0.on && overlap(p, { x: c0.x * TS, y: c0.y * TS - 20, w: TS, h: TS + 20 })) {
            cps.forEach(function (o) { o.on = false; }); c0.on = true; cp = c0; RQ.audio.sfx("powerup"); S.floatText("Checkpoint!", (c0.x + .5) * TS, c0.y * TS - 30, "#7ee787");
          }
        });
        var t = nearTerm();
        if (t && !t.solved && t.armed && S.mode === "play") openTerm(t);
        terms.forEach(function (q) { if (q !== t) q.armed = true; });
        if (!cage.open && !cage.locked && overlap(p, { x: cage.x * TS - 12, y: cage.y * TS - 40, w: TS + 24, h: TS + 40 })) {
          cage.open = true; S.rescued = true; RQ.audio.sfx("win"); RQ.ui.confetti(60);
          for (var i = 0; i < 6; i++) trail.push({ x: (cage.x + .5) * TS, y: (cage.y + 1) * TS });
          S.mode = "talk"; keys = {}; p.vx = 0;
          await rescueLine(def.friend);
          if (!L.alive) return;
          S.mode = "play";
        }
        var ex = { x: def.exit.x * TS, y: (def.exit.y - 1) * TS, w: TS, h: 2 * TS };
        if (overlap(p, ex) && S.mode === "play") {
          if (!S.rescued) { if (!S.nagT || S.time - S.nagT > 3) { S.nagT = S.time; L.toast("Wait! We can't leave " + RQ.ui.names[def.friend] + " behind!", "bad", 2000); } }
          else finish();
        }
      }
      function rescueLine(who) {
        if (who === "mo") return L.say("mo", "Free at last! The CPU runs much cooler now. Let's go!");
        if (who === "hoot") return L.say("hoot", "Whoo-hoo! Thank you, Sprout. A GPU can make training much faster!");
        if (who === "pix") return L.say("pix", "Index 2, the green door! You count like a real Python coder.");
        if (who === "tuki") return L.say("tuki", "Squawk! Packet delivered. I'm coming with you!");
        return L.say("koa", "G'day, mate! Get us to the roof. I'll fly the seed drone!");
      }

      /* ---------- finish */
      async function finish() {
        if (S.done) return; S.done = true; S.mode = "end"; RQ.audio.sfx("powerup"); keys = {};
        if (L.index === LEVELS.length - 1) {
          S.finale = 0; pad.show(false);
          await waitFinale(); if (!L.alive) return;
          await L.say("koa", "Hold on tight! Next stop: a forest that needs us."); if (!L.alive) return;
        } else { S.exitAnim = 0; await new Promise(function (r) { S.sleeps.push({ t: .9, res: r }); }); if (!L.alive) return; }
        var stars = S.time <= def.gold ? 3 : S.time <= def.silver ? 2 : 1;
        var medal = ["🥉 bronze", "🥈 silver", "🥇 gold"][stars - 1];
        L.win({ stars: stars, msg: "Escaped in **" + mmss(S.time) + "** with " + RQ.ui.names[def.friend] + ": " + medal + " medal!" + (stars < 3 ? " Gold is under " + mmss(def.gold) + "." : ""),
          stats: { "Time": mmss(S.time), "Medal": medal, "Respawns": String(S.respawns), "Code runs": String(S.runs) } });
      }
      function waitFinale() { return new Promise(function (r) { S.finaleDone = r; }); }

      /* ---------- drawing */
      function drawBG(c, t) {
        var cam = S.cam, gr = c.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, th.bg[0]); gr.addColorStop(1, th.bg[1]);
        c.fillStyle = gr; c.fillRect(0, 0, W, VH);
        // far server racks with blinking LEDs (parallax 0.3)
        var par = .3, rw = 110, gap = 34, ox = -cam.x * par, oy = -cam.y * par + 70, i0 = Math.floor(-ox / (rw + gap)) - 1;
        for (var i = i0; i < i0 + Math.ceil(W / (rw + gap)) + 3; i++) {
          var x = ox + i * (rw + gap);
          c.fillStyle = "rgba(10,16,26,.75)"; c.fillRect(x, oy, rw, 900); c.fillStyle = "rgba(255,255,255,.04)"; c.fillRect(x, oy, 4, 900);
          for (var r = 0; r < 26; r++) {
            var y = oy + 14 + r * 30; if (y > VH) break;
            c.fillStyle = "rgba(30,46,68,.7)"; c.fillRect(x + 8, y, rw - 16, 22);
            for (var k = 0; k < 3; k++) { var on = hash(i * 7 + r, k) + Math.sin(t * (1 + hash(i, r * 3 + k) * 5) + k) * .5 > .85; c.fillStyle = on ? th.led[(i + r + k) % 3] : "rgba(60,80,104,.6)"; c.fillRect(x + 14 + k * 9, y + 8, 4, 4); }
          }
        }
        // hanging cables (parallax 0.6)
        var co = -cam.x * .6;
        for (var j = Math.floor(-co / 260) - 1; j < Math.floor(-co / 260) + W / 260 + 2; j++) {
          var cx = co + j * 260, sag = 60 + hash(j, 9) * 70;
          c.strokeStyle = ["#e2553f", "#3d7fe0", "#ffc53d", "#2f9e4f"][((j % 4) + 4) % 4]; c.globalAlpha = .45; c.lineWidth = 5;
          c.beginPath(); c.moveTo(cx, -cam.y * .6); c.quadraticCurveTo(cx + 130, sag - cam.y * .6 + 40, cx + 260, -cam.y * .6); c.stroke(); c.globalAlpha = 1;
        }
        if (def.skyRow) { // the cloud roof: open sky above the roof line
          var sy = def.skyRow * TS - cam.y;
          if (sy > 0) {
            var sk = c.createLinearGradient(0, sy - 700, 0, sy); sk.addColorStop(0, "#5aa9e6"); sk.addColorStop(1, "#ffd9a8");
            c.fillStyle = sk; c.fillRect(0, 0, W, sy);
            circ(c, W * .75 - cam.x * .05, sy - 330, 46); c.fillStyle = "#ffe27a"; c.fill();
            for (var q = 0; q < 6; q++) { var qx = ((q * 330 - cam.x * .2 + t * 10) % (W + 300) + W + 300) % (W + 300) - 150, qy = sy - 520 + q * 60; c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.arc(qx, qy, 24, 0, 7); c.arc(qx + 30, qy - 10, 30, 0, 7); c.arc(qx + 62, qy, 22, 0, 7); c.fill(); }
            c.fillStyle = "#6aa84f"; c.beginPath(); c.moveTo(0, sy); for (var hx = 0; hx <= W; hx += 40) c.lineTo(hx, sy - 40 - Math.sin((hx + cam.x * .3) / 90) * 14); c.lineTo(W, sy); c.fill();
          }
        }
      }
      function drawWorldDecor(c, t) {
        def.labels.forEach(function (lb) { c.save(); c.globalAlpha = .22; txt(c, lb.t, lb.x * TS, lb.y * TS, "700 150px Fredoka, sans-serif", th.glow, "left"); c.restore(); });
        def.signs.forEach(function (s) { if (s.t) { c.save(); c.globalAlpha = .9; s.t.split("\n").forEach(function (ln, i) { txt(c, ln, s.x * TS, s.y * TS + i * 30, "600 24px Fredoka, sans-serif", "#e8f1f8", "left"); }); c.restore(); } });
        if (def.ruler) for (var i = 0; i < def.ruler.n; i++) txt(c, String(i + 1), (def.ruler.x + i + .5) * TS, def.ruler.y * TS, "700 28px Fredoka, sans-serif", "#ffd166");
        if (def.floors) { var f = def.floors; for (var k = 1; k <= 3; k++) txt(c, k === 3 ? "3 ROOF" : String(k), f.x * TS, (f.base - k * f.step) * TS + (k === 3 ? -24 : 20), "700 24px Fredoka, sans-serif", "#ffd166", "left"); }
      }
      function drawTiles(c, t) {
        var cam = S.cam, x0 = Math.max(0, Math.floor(cam.x / TS)), x1 = Math.min(def.w - 1, Math.floor((cam.x + W) / TS)), y0 = Math.max(0, Math.floor(cam.y / TS)), y1 = Math.min(def.h - 1, Math.floor((cam.y + VH) / TS));
        for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
          var ch = g[y][x]; if (ch === ".") continue;
          var X = x * TS, Y = y * TS;
          if (ch === "#" || ch === "X" || ch === "<" || ch === ">") {
            var up = !SOLID[tileAt(x, y - 1)], dn = !SOLID[tileAt(x, y + 1)], lf = !SOLID[tileAt(x - 1, y)], rt = !SOLID[tileAt(x + 1, y)];
            if (ch === "X") { c.fillStyle = "#9fb3c8"; c.fillRect(X, Y, TS, TS); c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 3; c.beginPath(); c.moveTo(X + 6, Y + 30); c.lineTo(X + 30, Y + 6); c.stroke(); }
            else if (ch === "#") {
              c.fillStyle = th.wall; c.fillRect(X, Y, TS, TS);
              if (up) { c.fillStyle = th.lip; c.fillRect(X, Y, TS, 8); }
              c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(X + 5, Y + TS - 9, 4, 4); c.fillRect(X + TS - 9, Y + TS - 9, 4, 4);
            } else {
              c.fillStyle = "#2b3440"; c.fillRect(X, Y, TS, TS);
              var off = ((t * PH.belt * (ch === ">" ? 1 : -1)) % 20 + 20) % 20;
              c.save(); c.beginPath(); c.rect(X, Y, TS, 24); c.clip();
              for (var k = -1; k < 3; k++) { var cx3 = X + k * 20 + off; c.beginPath(); if (ch === ">") { c.moveTo(cx3, Y + 5); c.lineTo(cx3 + 8, Y + 12); c.lineTo(cx3, Y + 19); } else { c.moveTo(cx3 + 8, Y + 5); c.lineTo(cx3, Y + 12); c.lineTo(cx3 + 8, Y + 19); } c.lineWidth = 3; c.strokeStyle = "#ffc53d"; c.stroke(); }
              c.restore();
            }
            c.strokeStyle = INK; c.lineWidth = 3; c.beginPath();
            if (up) { c.moveTo(X, Y + 1.5); c.lineTo(X + TS, Y + 1.5); } if (dn) { c.moveTo(X, Y + TS - 1.5); c.lineTo(X + TS, Y + TS - 1.5); }
            if (lf) { c.moveTo(X + 1.5, Y); c.lineTo(X + 1.5, Y + TS); } if (rt) { c.moveTo(X + TS - 1.5, Y); c.lineTo(X + TS - 1.5, Y + TS); }
            c.stroke();
          } else if (ch === "=") {
            u.rr(c, X, Y, TS, 12, 3); paint(c, "#7d8fa3", 2.5);
            c.fillStyle = "#3b4a5c"; for (var h = 0; h < 3; h++) c.fillRect(X + 6 + h * 11, Y + 4, 6, 4);
          } else if (ch === "^") {
            c.fillStyle = "#1a2230"; c.fillRect(X, Y + 26, TS, 14);
            c.strokeStyle = Math.sin(t * 25 + x) > 0 ? "#ffe14d" : "#7ff0ff"; c.lineWidth = 3; c.beginPath(); c.moveTo(X, Y + 30);
            for (var z = 1; z <= 4; z++) c.lineTo(X + z * 10, Y + 22 + (hash(x * 9 + z, Math.floor(t * 12)) * 14));
            c.stroke();
          }
        }
      }
      function drawObjects(c, t) {
        // checkpoints (charging pads)
        cps.forEach(function (c0, i) {
          if (i === 0) return;
          var x = (c0.x + .5) * TS, y = (c0.y + 1) * TS;
          u.rr(c, x - 18, y - 8, 36, 8, 3); paint(c, c0.on ? "#7ee787" : "#556677", 2.5);
          line(c, [x - 12, y - 8, x - 12, y - 56], INK, 4); line(c, [x - 12, y - 8, x - 12, y - 56], "#9fb3c8", 2);
          c.beginPath(); c.moveTo(x - 12, y - 56); c.quadraticCurveTo(x + 8 + Math.sin(t * 4) * 3, y - 60, x + 14, y - 46); c.quadraticCurveTo(x, y - 44, x - 12, y - 40); paint(c, c0.on ? "#8be07f" : "#7d8fa3", 2);
        });
        // terminals
        terms.forEach(function (q) {
          var pos = termPos(q), x = pos.x + TS / 2, y = pos.y;
          u.rr(c, x - 22, y - 30, 44, 30, 4); paint(c, "#556677", 2.5);
          line(c, [x, y - 30, x, y - 40], INK, 5);
          u.rr(c, x - 26, y - 70, 52, 34, 6); paint(c, "#0b131b", 3);
          if (q.solved) txt(c, "✔", x, y - 53, "700 22px Fredoka, sans-serif", "#7ee787");
          else for (var k = 0; k < 3; k++) { c.fillStyle = ["#ff8fd8", "#82c8ff", "#a5e887"][k]; c.fillRect(x - 18, y - 64 + k * 9, 10 + hash(k, Math.floor(t * 2)) * 24, 4); }
          if (!q.solved && S.mode === "play") {
            var b = Math.sin(t * 5) * 4, near = nearTerm() === q;
            u.rr(c, x - (near ? 58 : 16), y - 112 + b, near ? 116 : 32, 32, 10); paint(c, "#ffe36e", 2.5);
            txt(c, near ? "E / ↓ : code" : "!", x, y - 95 + b, "700 18px Fredoka, sans-serif", INK);
          }
        });
        // cage
        var cx = (cage.x + .5) * TS, cy = (cage.y + 1) * TS;
        if (!cage.open && !(def.cage.hidden && cage.locked)) {
          drawPortrait(c, def.friend, cx, cy - 4 + Math.sin(t * 3) * 2, 50);
          c.lineWidth = 3; c.strokeStyle = INK; c.fillStyle = "#c9d3dd";
          u.rr(c, cx - 30, cy - 66, 60, 10, 3); paint(c, "#7d8fa3", 2.5); u.rr(c, cx - 30, cy - 6, 60, 8, 3); paint(c, "#7d8fa3", 2.5);
          for (var bx = -24; bx <= 24; bx += 12) line(c, [cx + bx, cy - 56, cx + bx, cy - 6], "#9fb3c8", 3.5);
          if (cage.locked) { u.rr(c, cx - 10, cy - 36, 20, 16, 4); paint(c, "#ffc53d", 2.5); c.beginPath(); c.arc(cx, cy - 36, 6, Math.PI, 0); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); }
          else if (Math.sin(t * 6) > 0) { txt(c, "HELP!", cx, cy - 84, "700 20px Fredoka, sans-serif", "#ffe36e"); }
        }
        // exit
        var ex = def.exit.x * TS, ey = (def.exit.y + 1) * TS;
        if (L.index === LEVELS.length - 1) { // drone pad
          u.rr(c, ex - 50, ey - 10, 140, 10, 4); paint(c, "#ffc53d", 2.5); txt(c, "H", ex + 20, ey - 30, "700 30px Fredoka, sans-serif", "#ffc53d");
          if (!S.finaleOn) droneArt(c, ex + 20, ey - 50, t, 1);
        } else {
          u.rr(c, ex - 4, ey - 2 * TS - 6, TS + 8, 2 * TS + 6, 6); paint(c, "#24303d", 3);
          c.fillStyle = S.rescued ? "#2f9e4f" : "#3a4a5e"; c.fillRect(ex + 3, ey - 2 * TS + 2, TS - 6, 2 * TS - 4);
          u.rr(c, ex - 12, ey - 2 * TS - 34, TS + 24, 24, 6); paint(c, S.rescued ? "#2f9e4f" : "#556677", 2.5);
          txt(c, "EXIT", ex + TS / 2, ey - 2 * TS - 21, "700 16px Fredoka, sans-serif", "#fff");
        }
      }
      function droneArt(c, x, y, t, s) {
        c.save(); c.translate(x, y); c.scale(s, s);
        line(c, [-44, -10, 44, -10], INK, 6); line(c, [-44, -10, 44, -10], "#556677", 3);
        [-44, 44].forEach(function (rx) { var w = 6 + 18 * Math.abs(Math.sin(t * 45 + rx)); ell(c, rx, -20, w, 4); paint(c, "#cfe9ff", 2); line(c, [rx, -10, rx, -18], INK, 3); });
        u.rr(c, -26, -14, 52, 22, 8); paint(c, "#47b95c", 3);
        u.rr(c, -10, 8, 20, 18, 4); paint(c, "#f6efe0", 2.5);
        c.restore();
      }
      function drawBugs(c, t) {
        S.bugs.forEach(function (b) {
          var s = b.pop > 0 ? 1 + b.pop * .6 : 1;
          c.save(); c.translate(b.x, b.y); c.scale(s, s); bugArt(c, 0, 0, b.dir, t + b.x * .01, b.fly); c.restore();
        });
      }
      function drawPlayer(c, t) {
        // friend follows Sprout's trail
        if (S.rescued && trail.length) { var f = trail[0]; drawPortrait(c, def.friend, f.x, f.y + Math.sin(t * 4) * 3, 44); }
        if (p.dead > 0 || (p.inv > 0 && Math.sin(t * 40) > 0)) return;
        sproutArt(c, p.x + p.w / 2, p.y + p.h + 3, { face: p.face, sx: p.sx * 1.18, sy: p.sy * 1.18, air: !p.ground, wall: !p.ground && p.wall && dirInput() === p.wall, blink: p.blink > 0 }, t);
      }
      function drawFX(c, dt) {
        S.parts = S.parts.filter(function (q) {
          q.life -= dt; q.vy += (q.g || 300) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
          c.globalAlpha = u.clamp(q.life / .4, 0, 1); c.fillStyle = q.c; c.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); c.globalAlpha = 1;
          return q.life > 0;
        });
        S.floats = S.floats.filter(function (q) {
          q.life -= dt; q.y -= 30 * dt;
          c.save(); c.globalAlpha = u.clamp(q.life, 0, 1); c.font = "700 26px Fredoka, sans-serif"; c.textAlign = "center"; c.lineWidth = 5; c.strokeStyle = INK; c.strokeText(q.s, q.x, q.y); c.fillStyle = q.c; c.fillText(q.s, q.x, q.y); c.restore();
          return q.life > 0;
        });
      }
      /* Finale: the seed drone flies Koa and friends over a forest that grows back. */
      function drawFinale(c, t, dt) {
        S.finale += dt; S.finaleOn = true;
        var k = S.finale, sk = c.createLinearGradient(0, 0, 0, VH);
        sk.addColorStop(0, "#5aa9e6"); sk.addColorStop(1, "#ffd9a8"); c.fillStyle = sk; c.fillRect(0, 0, W, VH);
        circ(c, W * .8, 160 - k * 10, 50); c.fillStyle = "#ffe27a"; c.fill();
        for (var q = 0; q < 5; q++) { var qx = ((q * 320 + k * 40) % (W + 300)) - 150, qy = 90 + q * 40; c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.arc(qx, qy, 24, 0, 7); c.arc(qx + 30, qy - 10, 30, 0, 7); c.arc(qx + 62, qy, 22, 0, 7); c.fill(); }
        c.fillStyle = "#9cc98a"; c.beginPath(); c.moveTo(0, VH); for (var hx = 0; hx <= W; hx += 40) c.lineTo(hx, 470 - Math.sin(hx / 160) * 40); c.lineTo(W, VH); c.fill();
        var gy = 600, dxp = u.lerp(-120, W + 160, u.clamp((k - .6) / 5.4, 0, 1));
        c.fillStyle = "#8a6a45"; c.fillRect(0, gy, W, VH - gy);
        for (var i = 0; i < 28; i++) {
          var x = 20 + i * (W - 40) / 27, grown = u.clamp((dxp - x) / 260, 0, 1), h = 20 + grown * (70 + hash(i, 1) * 50);
          if (dxp > x) {
            line(c, [x, gy, x, gy - h * .6], "#6b4a2e", 3 + grown * 4);
            circ(c, x, gy - h * .7, 6 + grown * (20 + hash(i, 2) * 10)); paint(c, ["#2f8f46", "#3aa055", "#47b95c"][i % 3], 2.5);
          } else { circ(c, x, gy + 4, 4); c.fillStyle = "#5a3a22"; c.fill(); }
        }
        c.fillStyle = "#5aa04a"; c.fillRect(0, gy, Math.max(0, dxp - 60), 10);
        var dy = 300 + Math.sin(k * 2) * 12;
        droneArt(c, dxp, dy, k, 1.6);
        drawPortrait(c, "koa", dxp, dy - 34, 58);
        drawPortrait(c, "sprout", dxp - 70, dy + 10 + Math.sin(k * 3) * 6, 46);
        ["mo", "hoot", "pix", "tuki"].forEach(function (w2, j) { drawPortrait(c, w2, dxp - 120 - j * 46, dy + 30 + Math.sin(k * 3 + j) * 8, 40); });
        if (Math.random() < .5) S.parts.push({ x: dxp, y: dy + 40, vx: u.rand(-30, 30), vy: 120, life: 2, c: "#6b4423", s: 5, g: 200 });
        drawFX(c, dt);
        if (k > 1) { c.save(); c.globalAlpha = u.clamp(k - 1, 0, 1); u.rr(c, W / 2 - 300, 40, 600, 64, 20); paint(c, "rgba(255,253,247,.95)", 3.5); txt(c, "Mission: regrow the forest! 🌱", W / 2, 72, "700 34px Fredoka, sans-serif", INK); c.restore(); }
        if (k > 6.5 && S.finaleDone) { var r = S.finaleDone; S.finaleDone = null; r(); }
      }

      /* ---------- main loop */
      var hudT = -1, lastNow = performance.now();
      L.hud.set("time", "⏱ 0:00"); L.hud.set("gold", "🥇 " + mmss(def.gold)); L.hud.set("friend", "🐾 0/1");
      window.__labEscapeDebug = {
        state: function () {
          var t = nearTerm();
          return { level: L.index + 1, x: p.x, y: p.y, vx: p.vx, vy: p.vy, ground: p.ground, wall: p.wall, dead: p.dead > 0, mode: S.mode, time: S.time, respawns: S.respawns,
            rescued: S.rescued, done: S.done, termOpen: !!S.termOpen || panel.el.classList.contains("open"), nearTerm: !!t, solved: terms.map(function (q) { return q.solved; }),
            tile: TS, bugs: S.bugs.map(function (b) { return { x: b.x, y: b.y, fly: !!b.fly }; }), cp: [cp.x, cp.y],
            devs: S.devs.map(function (d) { return { id: d.id, px: d.px, py: d.py, rise: d.rise, power: d.power }; }) };
        }
      };
      L.loop(function (dt, t) {
        var now = performance.now();
        if (now - lastNow > 250) { keys = {}; touch = {}; } // resumed from pause: forget held keys
        lastNow = now;
        // timed sleeps for terminal programs (pause-aware)
        S.sleeps = S.sleeps.filter(function (s) { s.t -= dt; if (s.t <= 0) { s.res(); return false; } return true; });
        S.devs.forEach(function (d) { if (d.update) d.update(dt); });
        // riders move with their platform first, then anything still overlapping is pushed out
        if (p.gref && p.gref.dev && (p.gref.dev.dx || p.gref.dev.dy) && p.dead <= 0) { if (p.gref.dev.dx) moveX(p.gref.dev.dx); p.y += p.gref.dev.dy; }
        if (S.mode !== "end") unstick();
        if (S.mode === "play" || S.mode === "term") S.time += dt;
        if (S.mode === "play") {
          if (p.dead > 0) { p.dead -= dt; if (p.dead <= 0) { spawnAt(cp); RQ.audio.sfx("pop"); puff(p.x + p.w / 2, p.y + p.h / 2, 12); } }
          else { p.inv = (p.inv || 0) - dt; step(dt); checkHazards(); if (p.dead <= 0) pickups(); }
        }
        // bugs
        S.bugs.forEach(function (b) {
          b.pop = Math.max(0, (b.pop || 0) - dt * 2);
          if (b.fly) { b.t += dt; b.x = b.bx + Math.sin(b.t * b.sp) * b.ax * TS; b.y = b.by + Math.sin(b.t * b.sp) * b.ay * TS; b.dir = Math.cos(b.t * b.sp) * (b.ax || 1) >= 0 ? 1 : -1; return; }
          if (S.mode === "talk") return;
          var nx = b.x + b.vx * dt, front = nx + (b.vx > 0 ? 14 : -14), fx = Math.floor(front / TS), fy = Math.floor((b.y - 10) / TS), below = Math.floor((b.y + 4) / TS);
          if (SOLID[tileAt(fx, fy)] || !(SOLID[tileAt(fx, below)] || tileAt(fx, below) === "=") || front < b.x0 || front > b.x1) { b.vx = -b.vx; } else b.x = nx;
          b.dir = b.vx > 0 ? 1 : -1;
        });
        // friend trail
        if (S.rescued) { trail.push({ x: p.x + p.w / 2 - p.face * 30, y: p.y + p.h - 6 }); while (trail.length > 14) trail.shift(); }
        // camera
        var cam = S.cam, tx, ty;
        if (S.focus) { tx = S.focus.x - W / 2; ty = S.focus.y - VH * S.focus.at; }
        else { tx = p.x + p.w / 2 - W / 2 + p.face * 70; ty = p.y + p.h / 2 - VH * .55; }
        tx = MW <= W ? (MW - W) / 2 : u.clamp(tx, 0, MW - W);
        ty = S.focus ? u.clamp(ty, -280, Math.max(0, MH - VH) + 280) : (MH <= VH ? 0 : u.clamp(ty, 0, MH - VH));
        var kcam = S.camInit ? Math.min(1, dt * (S.focus ? 4 : 7)) : 1; S.camInit = true;
        cam.x += (tx - cam.x) * kcam; cam.y += (ty - cam.y) * kcam;
        S.shake = CALM ? 0 : Math.max(0, S.shake - dt * 20);
        // draw
        var c = ctx;
        if (S.finale != null) { drawFinale(c, t, dt); return; }
        drawBG(c, t);
        c.save(); c.translate(-Math.round(cam.x + u.rand(-S.shake, S.shake)), -Math.round(cam.y + u.rand(-S.shake, S.shake)));
        drawWorldDecor(c, t);
        S.devs.forEach(function (d) { if (d.type === "vaults") d.draw(c, t); });
        drawTiles(c, t);
        S.devs.forEach(function (d) { if (d.draw && d.type !== "vaults") d.draw(c, t); });
        drawObjects(c, t); drawBugs(c, t); drawPlayer(c, t); drawFX(c, dt);
        c.restore();
        // HUD (once per second)
        var sec = Math.floor(S.time);
        if (sec !== hudT) { hudT = sec; L.hud.set("time", "⏱ " + mmss(S.time)); L.hud.set("friend", "🐾 " + (S.rescued ? 1 : 0) + "/1"); L.hud.set("deaths", S.respawns ? "💥 " + S.respawns : null); }
      });
    };
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g25",
    music: "action",
    intro: [
      ["pix", "Alert! The Glitch Bugs locked our friends inside the server lab!"],
      ["sprout", "I'm small, but I'm sticky. Let's escape room by room!"]
    ],
    outro: [
      ["koa", "We made it out! Now the seed drone can fly back to the forest."],
      ["sprout", "You read code, changed it, and the whole lab obeyed. You're a real ReSeed engineer!"]
    ],
    levels: LEVELS.map(function (d) { return { title: d.title, goal: d.goal, intro: d.intro, cards: d.cards, play: play(d) }; })
  });
})();
