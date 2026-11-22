/* g02 Mo's Workshop — the parts of the mission computer.
 * L1 Build the bot: drag parts into a cartoon PC (snap-fit, wrong-socket bonk), power on → POST beep.
 * L2 Kitchen Rush: route orders to the CPU (head chef), GPU (helpers), RAM (countertop), storage (pantry → SSD / HDD).
 * L3 Train ForestNet: pick CPU or GPU, watch an example-timing race (README: about 12 minutes on one GPU).
 * L4 Spec-sheet detective: the real project computer (Ubuntu 24.04 LTS, 96 cores, 866 GB RAM, 4 × A100 80 GB). */
(function () {
  "use strict";
  var u = RQ.u;
  var INK = "#1d2b3a", FONT = "Fredoka, sans-serif", MONO = "'JetBrains Mono', monospace", TEAL = "#12a39a";
  var TAU = Math.PI * 2;

  /* ============================================================ helpers */
  function rbox(ctx, x, y, w, h, r, fill, lw) {
    u.rr(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw !== 0) { ctx.lineWidth = lw || 3; ctx.strokeStyle = INK; ctx.stroke(); }
  }
  function circ(ctx, x, y, r, fill, lw) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw !== 0) { ctx.lineWidth = lw || 3; ctx.strokeStyle = INK; ctx.stroke(); }
  }
  function txt(ctx, s, x, y, size, o) {
    o = o || {};
    ctx.font = (o.w || 600) + " " + size + "px " + (o.mono ? MONO : FONT);
    ctx.fillStyle = o.c || INK; ctx.textAlign = o.a || "center"; ctx.textBaseline = o.b || "middle";
    ctx.fillText(s, x, y);
  }
  /** Words of s split into lines no wider than maxW (uses the font given). */
  function wrapText(ctx, s, maxW, font) {
    ctx.font = font;
    var words = String(s).split(" "), lines = [], cur = "";
    words.forEach(function (w) {
      var t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function inRect(p, r, pad) { pad = pad || 0; return p.x >= r[0] - pad && p.x <= r[0] + r[2] + pad && p.y >= r[1] - pad && p.y <= r[1] + r[3] + pad; }
  function mid(r) { return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 }; }
  function sound(fn) { if (RQ.save.setting("sound")) { try { fn(RQ.audio); } catch (e) { /* no audio */ } } }
  function bonkSound() { sound(function (a) { a.tone({ f: 330, f2: 110, type: "sine", d: .3, v: .35 }); a.tone({ f: 180, f2: 90, type: "square", d: .1, v: .08, lp: 700 }); }); }
  function postBeep() { sound(function (a) { a.tone({ f: 1000, type: "square", d: .3, v: .1, lp: 3200 }); }); }
  function dialogOpen() { return !!document.querySelector(".rq-talk, .rq-overlay"); }
  function mySite() { return (RQ.mySite && RQ.mySite()) || null; }
  function shortSite() { var s = mySite(); return s ? s.name.split(",")[0] : "Rondônia"; }
  /** An SVG character as a canvas-drawable image. */
  function charImg(who, mood) {
    var img = new Image();
    if (RQ.chars) img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg(who, { mood: mood || "happy" }));
    return img;
  }

  /** Sparks + floating text for canvas levels. */
  function FX() {
    var ps = [], fl = [];
    return {
      burst: function (x, y, n, cols) {
        for (var i = 0; i < (n || 16); i++) {
          var a = Math.random() * TAU, s = u.rand(80, 320);
          ps.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, life: u.rand(.5, .9), r: u.rand(3, 6), c: u.pick(cols || ["#ffd23f", "#7ee787", "#79c0ff", "#ff8fab", "#ffffff"]) });
        }
      },
      float: function (x, y, s, c) { fl.push({ x: x, y: y, s: s, c: c || "#2f9e4f", life: 1.1 }); },
      draw: function (ctx, dt) {
        ps = ps.filter(function (p) {
          p.life -= dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life / .6)); circ(ctx, p.x, p.y, p.r, p.c, 0); ctx.globalAlpha = 1;
          return p.life > 0;
        });
        fl = fl.filter(function (f) {
          f.life -= dt; f.y -= 55 * dt;
          ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 2));
          ctx.font = "700 32px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.lineWidth = 6; ctx.strokeStyle = "#fff"; ctx.strokeText(f.s, f.x, f.y);
          txt(ctx, f.s, f.x, f.y, 32, { w: 700, c: f.c });
          ctx.globalAlpha = 1;
          return f.life > 0;
        });
      }
    };
  }

  /* ============================================================ shared cartoon drawings */
  function fanDraw(ctx, x, y, r, ang) {
    circ(ctx, x, y, r, "#2f3a46", 3);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = "#b9c6d3";
    for (var i = 0; i < 5; i++) { ctx.rotate(TAU / 5); ctx.beginPath(); ctx.ellipse(r * .45, 0, r * .42, r * .17, .5, 0, TAU); ctx.fill(); }
    ctx.restore();
    circ(ctx, x, y, r * .22, "#7d8ea3", 2);
  }
  function gear(ctx, x, y, r, ang, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath();
    for (var i = 0; i < 16; i++) { var a = i * TAU / 16, q = i % 2 ? r : r * .76; ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
    ctx.closePath(); ctx.fillStyle = col || "#ffc53d"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    circ(ctx, 0, 0, r * .3, "#fff", 2.5);
    ctx.restore();
  }
  function bolt(ctx, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(4, -20); ctx.lineTo(-10, 3); ctx.lineTo(0, 3); ctx.lineTo(-4, 20); ctx.lineTo(10, -4); ctx.lineTo(0, -4); ctx.closePath();
    ctx.fillStyle = col || "#ffd23f"; ctx.fill(); ctx.lineWidth = 2.5 / s; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }
  /** A Glitch Bug that pops out of a wrong socket and giggles. */
  function glitchBug(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 22) * .18);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-7, -17); ctx.lineTo(-14, -31); ctx.moveTo(7, -17); ctx.lineTo(14, -31); ctx.stroke();
    circ(ctx, -14, -32, 4.5, "#ffd23f", 2); circ(ctx, 14, -32, 4.5, "#ffd23f", 2);
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 19, 0, 0, TAU); ctx.fillStyle = "#8a5cd0"; ctx.fill(); ctx.stroke();
    circ(ctx, -8, -5, 5.5, "#fff", 2); circ(ctx, 8, -5, 5.5, "#fff", 2); circ(ctx, -7, -5, 2.2, INK, 0); circ(ctx, 9, -5, 2.2, INK, 0);
    ctx.beginPath(); ctx.arc(0, 4, 7, .15, Math.PI - .15); ctx.fillStyle = "#7a2e3a"; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  /** Chef = the CPU. (x, y) is the middle of the coat. */
  function chef(ctx, x, y, s, t, work) {
    ctx.save(); ctx.translate(x, y + (work ? Math.sin(t * 14) * 3 : Math.sin(t * 2) * 1.5)); ctx.scale(s, s);
    rbox(ctx, -46, 0, 92, 70, 26, "#ffffff");
    ctx.fillStyle = "#d1495b"; ctx.beginPath(); ctx.moveTo(-15, 1); ctx.lineTo(15, 1); ctx.lineTo(0, 18); ctx.closePath(); ctx.fill();
    circ(ctx, 0, 32, 3.5, INK, 0); circ(ctx, 0, 50, 3.5, INK, 0);
    circ(ctx, 0, -28, 32, "#f6cfa6");
    circ(ctx, -11, -33, 4, INK, 0); circ(ctx, 11, -33, 4, INK, 0);
    ctx.fillStyle = "#6b4226"; ctx.beginPath(); ctx.ellipse(-9, -17, 10, 5, .3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(9, -17, 10, 5, -.3, 0, TAU); ctx.fill();
    circ(ctx, -19, -78, 15, "#fff", 2.5); circ(ctx, 19, -78, 15, "#fff", 2.5); circ(ctx, 0, -86, 18, "#fff", 2.5);
    rbox(ctx, -26, -72, 52, 18, 5, "#fff", 2.5);
    ctx.restore();
  }
  /** One tiny GPU helper bot. */
  function helper(ctx, x, y, r, t, work, col) {
    var hop = work ? -Math.abs(Math.sin(t * 15)) * r * .7 : 0;
    ctx.save(); ctx.translate(x, y + hop);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, -r * 1.55); ctx.stroke();
    circ(ctx, 0, -r * 1.65, r * .26, "#ffd23f", 1.5);
    circ(ctx, 0, 0, r, col || TEAL, 2);
    circ(ctx, -r * .36, -r * .12, r * .2, "#fff", 0); circ(ctx, r * .36, -r * .12, r * .2, "#fff", 0);
    ctx.restore();
  }
  /** Workshop wall: pegboard. */
  function pegboard(ctx, W, H) {
    ctx.fillStyle = "#efe2c8"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(120,90,50,.18)";
    for (var y = 20; y < H; y += 34) for (var x = 20 + (y / 34 % 2) * 17; x < W; x += 34) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }
  }

  /* ============================================================ L1 Build the bot */
  var PARTS = [
    { id: "cpu", name: "CPU", w: 110, h: 110, job: "The brain. It follows instructions step by step." },
    { id: "cooler", name: "CPU cooler", w: 130, h: 130, job: "A fan that sits on the hot CPU and keeps it cool." },
    { id: "ram", name: "RAM ×2", w: 70, h: 220, job: "Super fast memory for the work happening right now." },
    { id: "gpu", name: "GPU", w: 470, h: 96, job: "Thousands of tiny helpers for pictures and AI math." },
    { id: "ssd", name: "M.2 SSD", w: 160, h: 30, job: "A tiny, very fast stick that keeps your files." },
    { id: "hdd", name: "SATA HDD", w: 170, h: 120, job: "A big, cheap drive with a spinning disk inside." },
    { id: "psu", name: "PSU", w: 300, h: 92, job: "The power supply. It feeds power to every part." }
  ];
  var SLOTS = [
    { id: "cpu", name: "CPU socket", r: [170, 90, 130, 130] },
    { id: "ram", name: "RAM slots", r: [340, 70, 70, 220] },
    { id: "ssd", name: "M.2 slot", r: [440, 236, 160, 30] },
    { id: "gpu", name: "PCIe x16 slot", r: [80, 352, 470, 96] },
    { id: "hdd", name: "Drive bay (SATA)", r: [684, 130, 170, 120] },
    { id: "psu", name: "PSU bay", r: [40, 498, 300, 92] }
  ];
  var POST = ["MO-BOARD UEFI", "Power-On Self-Test", "", "CPU ............ OK", "CPU cooler ..... OK", "Memory (RAM) ... OK",
    "Graphics (GPU) . OK", "M.2 SSD ........ OK", "SATA HDD ....... OK", "Power (PSU) .... OK"];

  function bonkMsg(pid, sid) {
    var M = {
      "cpu>ram": "A square CPU in a skinny RAM slot? Nope!",
      "gpu>ssd": "That big GPU will never fit the tiny M.2 slot!",
      "ssd>hdd": "Close! Both keep files, but this SSD is a tiny stick. Find the **M.2 slot**.",
      "hdd>ssd": "Close! Both keep files, but the HDD is a big box. It goes in the **drive bay**.",
      "ram>gpu": "RAM sticks stand up in their own skinny slots.",
      "gpu>ram": "The GPU lies down in the long **PCIe** slot.",
      "ssd>gpu": "The SSD is tiny. The long PCIe slot is for the GPU."
    };
    if (M[pid + ">" + sid]) return M[pid + ">" + sid];
    if (pid === "psu") return "The PSU is a heavy box. It lives in the **PSU bay** at the bottom.";
    if (pid === "cooler") return "The cooler sits on top of the CPU, like a hat.";
    return "Wrong socket! Look for the slot with the same shape.";
  }

  /** Draw a part filling the rectangle (x, y, w, h). on = powered (fans spin, lights glow). */
  function drawPart(ctx, id, x, y, w, h, t, on) {
    var i;
    if (id === "cpu") {
      rbox(ctx, x, y, w, h, 8, "#2f8a55");
      ctx.fillStyle = "#e7b53c";
      for (i = 1; i < 8; i++) { ctx.fillRect(x + i * w / 8 - 1.5, y + 3, 3, h * .06); ctx.fillRect(x + i * w / 8 - 1.5, y + h - 3 - h * .06, 3, h * .06); }
      rbox(ctx, x + w * .15, y + h * .15, w * .7, h * .7, 6, on ? "#e9eef3" : "#d9e0e8", 2.5);
      txt(ctx, "CPU", x + w / 2, y + h / 2, Math.max(10, h * .22), { w: 700 });
      ctx.fillStyle = "#ffc53d"; ctx.beginPath(); ctx.moveTo(x + 5, y + h - 5); ctx.lineTo(x + 5 + w * .16, y + h - 5); ctx.lineTo(x + 5, y + h - 5 - h * .16); ctx.closePath(); ctx.fill();
    } else if (id === "cooler") {
      rbox(ctx, x, y, w, h, 16, "#8d9bab");
      [[.12, .12], [.88, .12], [.12, .88], [.88, .88]].forEach(function (c) { circ(ctx, x + w * c[0], y + h * c[1], Math.max(2, w * .035), "#c9d3de", 1.5); });
      fanDraw(ctx, x + w / 2, y + h / 2, Math.min(w, h) * .4, on ? t * 20 : .35);
    } else if (id === "ram") {
      var sw = w * .4;
      for (i = 0; i < 2; i++) {
        var sx = x + (i ? w - sw : 0);
        rbox(ctx, sx, y, sw, h, 4, "#2f8a55", 2.5);
        rbox(ctx, sx + 3, y + h * .05, sw - 6, h * .86, 3, "#3b6fd6", 2);
        ctx.fillStyle = on ? "hsl(" + Math.round((t * 140 + i * 90) % 360) + ",90%,62%)" : "#9fb4d9";
        ctx.fillRect(sx + 5, y + h * .07, sw - 10, Math.max(3, h * .025));
        ctx.fillStyle = "#e7b53c"; ctx.fillRect(sx + 4, y + h * .93, sw - 8, Math.max(2, h * .03));
        ctx.save(); ctx.translate(sx + sw / 2, y + h * .5); ctx.rotate(-Math.PI / 2);
        txt(ctx, "RAM", 0, 1, Math.max(8, sw * .55), { w: 700, c: "#fff" }); ctx.restore();
      }
    } else if (id === "gpu") {
      ctx.fillStyle = "#e7b53c"; ctx.fillRect(x + w * .1, y, w * .52, Math.max(3, h * .1));
      rbox(ctx, x, y + h * .1, w, h * .9, Math.min(12, h * .12), "#2b3440");
      var fy = y + h * .55, fr = Math.min(h * .33, w * .09);
      fanDraw(ctx, x + w * .24, fy, fr, on ? t * 22 : .2); fanDraw(ctx, x + w * .5, fy, fr, on ? -t * 22 : 1.1);
      rbox(ctx, x + w * .68, y + h * .3, w * .27, h * .5, 6, on ? TEAL : "#4c5d70", 2);
      txt(ctx, "GPU", x + w * .815, y + h * .55, Math.max(8, h * .26), { w: 700, c: "#fff" });
    } else if (id === "ssd") {
      rbox(ctx, x, y, w, h, 4, "#2f8a55", 2.5);
      ctx.fillStyle = "#e7b53c"; ctx.fillRect(x + 3, y + 3, Math.max(3, w * .06), h - 6);
      for (i = 0; i < 3; i++) rbox(ctx, x + w * (.16 + i * .24), y + h * .2, w * .18, h * .6, 2, "#1f2630", 0);
      circ(ctx, x + w - h * .5, y + h * .5, h * .22, "#f3efe4", 1.5);
      if (on) circ(ctx, x + w * .1, y + h * .5, Math.max(2, h * .12), "#7ee787", 0);
    } else if (id === "hdd") {
      rbox(ctx, x, y, w, h, 8, "#c4cdd6");
      var cx = x + w * .42, cy = y + h * .52, r = Math.min(w, h) * .38;
      circ(ctx, cx, cy, r, "#e8edf2", 2.5);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(on ? t * 14 : 0); ctx.strokeStyle = "rgba(29,43,58,.3)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * .66, 0, 1.7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * .45, 3, 4.4); ctx.stroke(); ctx.restore();
      circ(ctx, cx, cy, r * .2, "#9aa8b6", 2);
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, w * .025); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x + w * .86, y + h * .82); ctx.lineTo(cx + r * .45, cy - r * .35); ctx.stroke();
      circ(ctx, x + w * .86, y + h * .82, Math.max(3, w * .035), "#7d8ea3", 2);
      txt(ctx, "HDD", x + w * .85, y + h * .2, Math.max(8, h * .16), { w: 700 });
    } else if (id === "psu") {
      rbox(ctx, x, y, w, h, 8, "#3b4756");
      var gr = Math.min(h * .4, w * .2), gx = x + w * .26, gy = y + h / 2;
      circ(ctx, gx, gy, gr, "#25303c", 2.5);
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(on ? t * 18 : 0); ctx.strokeStyle = "#6b7c90"; ctx.lineWidth = 2;
      for (i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-gr * .9, 0); ctx.lineTo(gr * .9, 0); ctx.stroke(); }
      ctx.restore();
      bolt(ctx, x + w * .58, y + h / 2, Math.max(.3, h / 70), on ? "#ffd23f" : "#c9a83a");
      txt(ctx, "PSU", x + w * .8, y + h / 2, Math.max(9, h * .26), { w: 700, c: "#fff" });
    }
  }

  function drawSlotShape(ctx, s, ox, t) {
    var x = s.r[0] + ox, y = s.r[1], w = s.r[2], h = s.r[3], i, j;
    if (s.id === "cpu") {
      rbox(ctx, x, y, w, h, 8, "#c9d3de", 3);
      rbox(ctx, x + 12, y + 12, w - 24, h - 24, 4, "#b3bfcb", 2);
      ctx.fillStyle = "#8a97a5";
      for (i = 0; i < 9; i++) for (j = 0; j < 9; j++) ctx.fillRect(x + 20 + i * (w - 40) / 8 - 1.5, y + 20 + j * (h - 40) / 8 - 1.5, 3, 3);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x + w + 6, y + 10); ctx.lineTo(x + w + 6, y + h - 6); ctx.stroke();
    } else if (s.id === "ram") {
      for (i = 0; i < 2; i++) {
        var sx = x + (i ? w - 24 : 4);
        rbox(ctx, sx, y, 20, h, 4, "#20262e", 2.5);
        rbox(ctx, sx - 2, y - 8, 24, 10, 3, "#f3efe4", 2); rbox(ctx, sx - 2, y + h - 2, 24, 10, 3, "#f3efe4", 2);
      }
    } else if (s.id === "ssd") {
      rbox(ctx, x, y + 4, 24, h - 8, 3, "#20262e", 2.5);
      ctx.setLineDash([7, 6]); rbox(ctx, x + 24, y, w - 24, h, 4, null, 2); ctx.setLineDash([]);
      circ(ctx, x + w - 14, y + h / 2, 7, "#e7b53c", 2);
    } else if (s.id === "gpu") {
      rbox(ctx, x + w * .1, y - 2, w * .52, 16, 3, "#20262e", 2.5);
      rbox(ctx, x + w * .62 + 4, y, 16, 12, 3, "#f3efe4", 2);
      ctx.setLineDash([9, 7]); rbox(ctx, x, y + 16, w, h - 16, 10, "rgba(255,255,255,.12)", 2.5); ctx.setLineDash([]);
    } else if (s.id === "hdd") {
      ctx.setLineDash([9, 7]); rbox(ctx, x, y, w, h, 8, "rgba(255,255,255,.35)", 2.5); ctx.setLineDash([]);
      ctx.strokeStyle = "#7d8ea3"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 6, y + 8); ctx.lineTo(x - 6, y + h - 8); ctx.moveTo(x + w + 6, y + 8); ctx.lineTo(x + w + 6, y + h - 8); ctx.stroke();
    } else if (s.id === "psu") {
      ctx.setLineDash([9, 7]); rbox(ctx, x, y, w, h, 10, "rgba(29,43,58,.08)", 2.5); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(29,43,58,.25)"; for (i = 0; i < 5; i++) ctx.fillRect(x + 20 + i * 14, y + 24, 6, h - 48);
    }
  }
  function plate(ctx, s, x, y) {
    ctx.font = "600 20px " + FONT;
    var w = ctx.measureText(s).width + 18;
    rbox(ctx, x - w / 2, y - 15, w, 30, 9, "rgba(255,253,247,.94)", 2);
    txt(ctx, s, x, y + 1, 20);
  }
  function plateFor(s, ox) {
    var r = s.r;
    if (s.id === "cpu") return [ox + r[0] + r[2] / 2, r[1] + r[3] + 20];
    if (s.id === "ram") return [ox + r[0] + r[2] / 2, r[1] + r[3] + 22];
    if (s.id === "ssd") return [ox + r[0] + r[2] / 2, r[1] + r[3] + 20];
    if (s.id === "gpu") return [ox + r[0] + r[2] / 2, r[1] + r[3] / 2 + 10];
    return [ox + r[0] + r[2] / 2, r[1] + r[3] / 2];
  }
  function drawCase(ctx, ox, t, on) {
    var i;
    rbox(ctx, ox + 10, 20, 880, 592, 28, "#d7dfe8", 4);
    rbox(ctx, ox + 26, 36, 848, 560, 18, "#aebbc8", 3);
    ctx.fillStyle = "rgba(29,43,58,.2)";
    for (i = 0; i < 10; i++) for (var j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(ox + 384 + i * 26, 512 + j * 24, 6, 0, TAU); ctx.fill(); }
    // motherboard
    rbox(ctx, ox + 40, 50, 600, 424, 14, "#2e8b57", 3.5);
    ctx.strokeStyle = "rgba(190,255,210,.3)"; ctx.lineWidth = 3; ctx.lineCap = "round";
    [[56, 250, 150, 250, 150, 330], [306, 120, 330, 120], [430, 300, 430, 330, 580, 330], [310, 240, 420, 240], [580, 70, 580, 120], [60, 120, 60, 230], [200, 300, 400, 300]].forEach(function (p) {
      ctx.beginPath(); ctx.moveTo(ox + p[0], p[1]); for (var k = 2; k < p.length; k += 2) ctx.lineTo(ox + p[k], p[k + 1]); ctx.stroke();
    });
    rbox(ctx, ox + 50, 60, 104, 34, 5, "#c4cdd6", 2.5);
    for (i = 0; i < 4; i++) rbox(ctx, ox + 58 + i * 23, 68, 16, 18, 3, "#4c5d70", 1.5);
    [[150, 108], [150, 205], [318, 112], [318, 200], [450, 196]].forEach(function (c) { circ(ctx, ox + c[0], c[1], 8, "#4c5d70", 2); circ(ctx, ox + c[0], c[1], 3, "#9aa8b6", 0); });
    rbox(ctx, ox + 470, 88, 84, 84, 10, "#9aa8b6", 3);
    ctx.strokeStyle = "#6b7c90"; ctx.lineWidth = 3;
    for (i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(ox + 482 + i * 12, 98); ctx.lineTo(ox + 482 + i * 12, 162); ctx.stroke(); }
    rbox(ctx, ox + 604, 180, 26, 90, 4, "#f3efe4", 2.5);
    for (i = 0; i < 6; i++) rbox(ctx, ox + 610, 188 + i * 13, 14, 8, 2, "#c4cdd6", 1);
    rbox(ctx, ox + 604, 290, 26, 20, 3, "#d1495b", 2); rbox(ctx, ox + 604, 316, 26, 20, 3, "#d1495b", 2);
    txt(ctx, "MO-BOARD", ox + 575, 458, 18, { w: 700, c: "rgba(255,255,255,.8)" });
    // drive cage
    rbox(ctx, ox + 668, 60, 196, 410, 14, "#c9d3de", 3);
    ctx.strokeStyle = "#9aa8b6"; ctx.lineWidth = 3;
    for (i = 0; i < 2; i++) { ctx.setLineDash([8, 8]); rbox(ctx, ox + 684, 280 + i * 92, 170, 76, 8, null, 2); ctx.setLineDash([]); }
    // front panel strip with RGB when on
    rbox(ctx, ox + 380, 590, 480, 10, 5, on ? "hsl(" + Math.round(t * 90 % 360) + ",85%,60%)" : "#8d9bab", 2);
  }

  function buildLevel(L) {
    var cv = L.canvas({ w: 1280, h: 630, fill: true, bg: "#efe2c8", label: "Mo's workshop: an open computer case and a box of parts" }), ctx = cv.ctx, fx = FX();
    var placed = {}, snapT = {}, back = [], bonks = 0, wrongFor = {}, sel = -1, drag = null, focus = 0, pops = [];
    var ready = false, on = false, onT = 0, posted = 0, ended = false, now = 0, mouse = { x: -99, y: -99 }, kbUsed = false;
    var moImg = charImg("mo", "happy");
    function OX() { return 350 + Math.max(0, (cv.w - 1280) / 2); }
    function TX() { return OX() - 336; }
    function sr(s) { return [s.r[0] + OX(), s.r[1], s.r[2], s.r[3]]; }
    function tr(i) { return [TX() + 12 + (i % 2) * 154, 66 + Math.floor(i / 2) * 116, 144, 106]; }
    function flying(i) { return back.some(function (b) { return b.i === i; }); }
    function avail(i) { return !placed[PARTS[i].id] && !flying(i); }
    function nPlaced() { return Object.keys(placed).length; }
    function partAt(p) { for (var i = 0; i < PARTS.length; i++) if (avail(i) && inRect(p, tr(i))) return i; return -1; }
    function slotAt(p) {
      var best = -1, bd = 1e9;
      SLOTS.forEach(function (s, k) { var r = sr(s); if (inRect(p, r, 26)) { var c = mid(r), d = u.dist(p.x, p.y, c.x, c.y); if (d < bd) { bd = d; best = k; } } });
      return best;
    }
    function rightSlot(i) { var id = PARTS[i].id === "cooler" ? "cpu" : PARTS[i].id; for (var k = 0; k < SLOTS.length; k++) if (SLOTS[k].id === id) return k; return -1; }
    function hud() { L.hud.set("parts", "🧩 " + nPlaced() + " / 7"); L.hud.set("bonk", "💥 " + bonks); }
    hud();

    function snap(i, k, from) {
      var p = PARTS[i]; placed[p.id] = true; snapT[p.id] = { t: now, from: from };
      L.sfx("snap"); L.timeout(function () { L.sfx("good"); }, 120);
      var c = mid(sr(SLOTS[k])); fx.burst(c.x, c.y, 22);
      L.toast("✅ **" + p.name + "**: " + p.job, "good", 2600);
      hud();
      if (nPlaced() === PARTS.length) {
        ready = true;
        L.timeout(function () { L.sfx("powerup"); L.toast("⚡ All parts are in! Press the green **power button**.", "info", 3200); }, 1200);
      }
    }
    function sendBack(i, from, spin) { back.push({ i: i, x: from.x, y: from.y, t: 0, spin: spin }); }
    function tryPlace(i, k, from) {
      var p = PARTS[i], s = SLOTS[k];
      sel = -1;
      if (p.id === "cooler" && s.id === "cpu") {
        if (!placed.cpu) { L.sfx("buzz"); L.toast("🔧 CPU first! The cooler sits **on top of** the CPU.", "info", 2800); sendBack(i, from, false); return; }
        snap(i, k, from); return;
      }
      if (p.id === s.id) { snap(i, k, from); return; }
      bonks++; wrongFor[p.id] = (wrongFor[p.id] || 0) + 1;
      bonkSound(); L.timeout(function () { L.sfx("giggle"); }, 250);
      pops.push({ x: from.x, y: from.y, life: 1.1 });
      L.toast("💥 Bonk! " + bonkMsg(p.id, s.id), "bad", 3000);
      sendBack(i, from, true); hud();
    }
    function powerOn() {
      if (on || !ready) return;
      on = true; onT = now; ready = false; L.hud.set("parts", "⚡ ON");
      L.sfx("click"); sound(function (a) { a.noise({ f: 250, f2: 900, ft: "bandpass", d: 1.4, v: .18 }); a.tone({ f: 60, f2: 120, type: "sawtooth", d: 1.2, v: .06, lp: 400 }); });
      POST.forEach(function (l, i) { L.timeout(function () { posted = i + 1; if (l) L.sfx("tick"); }, 1000 + i * 260); });
      var tBeep = 1000 + POST.length * 260 + 300;
      L.timeout(function () { posted = POST.length + 1; postBeep(); fx.burst(TX() + 160, 200, 30); }, tBeep);
      L.timeout(function () {
        ended = true;
        var stars = bonks <= 1 ? 3 : bonks <= 3 ? 2 : 1;
        L.win({ stars: stars, msg: "Beep! Your computer passed its **POST** self-test: the basics work and every part is in its slot.", stats: { "Parts": "7 / 7", "Bonks": bonks } });
      }, tBeep + 2300);
    }

    L.on(cv.cv, "pointerdown", function (e) {
      if (ended || on) return;
      var p = cv.toLocal(e); mouse = p;
      if (ready) { if (u.dist(p.x, p.y, OX() + 790, 530) < 56) powerOn(); return; }
      var i = partAt(p);
      if (i >= 0) { drag = { i: i, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false }; L.sfx("pop"); return; }
      if (sel >= 0) { var k = slotAt(p); if (k >= 0) tryPlace(sel, k, p); else sel = -1; }
    });
    L.on(window, "pointermove", function (e) {
      var p = cv.toLocal(e); mouse = p;
      if (drag) { drag.x = p.x; drag.y = p.y; if (u.dist(p.x, p.y, drag.sx, drag.sy) > 10) drag.moved = true; }
    });
    L.on(window, "pointerup", function (e) {
      if (!drag) return;
      var d = drag, p = cv.toLocal(e); drag = null;
      if (!d.moved) { sel = sel === d.i ? -1 : d.i; kbUsed = false; return; }
      var k = slotAt(p);
      if (k >= 0) tryPlace(d.i, k, p); else sendBack(d.i, p, false);
    });
    L.on(window, "keydown", function (e) {
      if (dialogOpen() || ended || on) return;
      if (ready && (e.key === "Enter" || e.key === " " || e.key === "p" || e.key === "P")) { e.preventDefault(); powerOn(); return; }
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= PARTS.length) { if (avail(n - 1)) { sel = n - 1; kbUsed = true; L.sfx("pop"); } return; }
      if (sel < 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") { e.preventDefault(); focus = (focus + 1) % SLOTS.length; kbUsed = true; L.sfx("tick"); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); focus = (focus + SLOTS.length - 1) % SLOTS.length; kbUsed = true; L.sfx("tick"); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tryPlace(sel, focus, mid(sr(SLOTS[focus]))); }
      else if (e.key === "Escape") sel = -1;
    });

    function partRectAt(id, cx, cy, sc) { var p = PARTS.filter(function (q) { return q.id === id; })[0]; return [cx - p.w * sc / 2, cy - p.h * sc / 2, p.w * sc, p.h * sc]; }
    function tileFit(i) { var r = tr(i), p = PARTS[i], s = Math.min((r[2] - 22) / p.w, 60 / p.h, .8); return { s: s, x: r[0] + r[2] / 2, y: r[1] + 40 }; }
    function drawPlaced(id, t) {
      var k = id === "cooler" ? 0 : rightSlot(PARTS.map(function (p) { return p.id; }).indexOf(id));
      var c = mid(sr(SLOTS[k])), st = snapT[id], q = st ? u.clamp((now - st.t) / .25, 0, 1) : 1, e = u.ease.outCubic(q);
      var x = u.lerp(st.from.x, c.x, e), y = u.lerp(st.from.y, c.y, e), sc = 1 + Math.sin(q * Math.PI) * .12;
      var r = partRectAt(id, x, y, sc);
      drawPart(ctx, id, r[0], r[1], r[2], r[3], t, on);
    }

    L.loop(function (dt, t) {
      now = t;
      var W = cv.w, ox = OX(), tx = TX(), i;
      pegboard(ctx, W, 630);
      // ---- tray (or the monitor after power-on)
      if (!on) {
        rbox(ctx, tx, 20, 320, 592, 20, "#c8a165", 4);
        rbox(ctx, tx + 8, 28, 304, 576, 14, "#e0bb7f", 0);
        txt(ctx, "🧰 Parts box", tx + 160, 46, 22, { w: 700 });
        for (i = 0; i < PARTS.length; i++) {
          var r = tr(i), p = PARTS[i], isSel = sel === i, isDrag = drag && drag.i === i && drag.moved;
          rbox(ctx, r[0], r[1] - (isSel ? 4 : 0), r[2], r[3], 12, placed[p.id] ? "#efe7d6" : isSel ? "#fff27a" : "#fffdf7", 3);
          if (placed[p.id]) { txt(ctx, "✓ " + p.name, r[0] + r[2] / 2, r[1] + r[3] / 2, 18, { c: "#8a7a5e" }); continue; }
          circ(ctx, r[0] + 16, r[1] + 16, 12, TEAL, 2); txt(ctx, String(i + 1), r[0] + 16, r[1] + 17, 15, { w: 700, c: "#fff" });
          if (!isDrag && !flying(i)) { var f = tileFit(i), pr = partRectAt(p.id, f.x, f.y - (isSel ? 4 : 0), f.s); drawPart(ctx, p.id, pr[0], pr[1], pr[2], pr[3], t, false); }
          txt(ctx, p.name, r[0] + r[2] / 2, r[1] + 88 - (isSel ? 4 : 0), 21, { w: 700 });
        }
        var held = drag ? drag.i : sel;
        rbox(ctx, tx + 10, 532, 300, 74, 12, "#fffdf7", 2.5);
        var info = held >= 0 ? PARTS[held].name + ": " + PARTS[held].job : ready ? "All in! Press the green power button." : "Drag a part to its slot. Keys: 1-7, then arrows and Enter.";
        var lines = wrapText(ctx, info, 284, "600 19px " + FONT);
        lines.slice(0, 3).forEach(function (l, j) { txt(ctx, l, tx + 160, 569 + (j - (Math.min(3, lines.length) - 1) / 2) * 22, 19); });
      } else {
        // monitor showing POST
        rbox(ctx, tx + 140, 330, 40, 50, 4, "#4c5d70", 3); rbox(ctx, tx + 90, 376, 140, 16, 8, "#4c5d70", 3);
        rbox(ctx, tx + 2, 40, 316, 296, 18, "#2b3440", 4);
        rbox(ctx, tx + 16, 54, 288, 262, 8, "#0b1a12", 2);
        for (i = 0; i < Math.min(posted, POST.length); i++) txt(ctx, POST[i], tx + 30, 76 + i * 22, 17, { a: "left", mono: true, c: i < 2 ? "#79c0ff" : "#7ee787" });
        if (posted > POST.length) { txt(ctx, "*BEEP*  All good!", tx + 30, 76 + POST.length * 22 + 8, 19, { a: "left", mono: true, c: "#ffd23f", w: 700 }); }
        else if (Math.floor(t * 3) % 2) ctx.fillRect(tx + 30, 68 + Math.min(posted, POST.length) * 22, 10, 16);
        if (moImg.complete && moImg.naturalWidth) ctx.drawImage(moImg, tx + 70, 410, 180, 180);
      }
      // ---- the case
      drawCase(ctx, ox, t, on);
      var hov = drag && drag.moved ? slotAt(drag) : -1, heldI = drag ? drag.i : sel;
      SLOTS.forEach(function (s, k) {
        var r = sr(s);
        if (!placed[s.id]) drawSlotShape(ctx, s, ox, t);
        if (heldI >= 0 && !placed[PARTS[heldI].id]) {
          var glow = k === hov || (kbUsed && sel >= 0 && k === focus);
          if (glow) { ctx.save(); ctx.shadowColor = "#ffd84d"; ctx.shadowBlur = 24; rbox(ctx, r[0] - 6, r[1] - 6, r[2] + 12, r[3] + 12, 12, "rgba(255,227,110,.35)", 4); ctx.restore(); }
          if ((wrongFor[PARTS[heldI].id] || 0) >= 2 && k === rightSlot(heldI)) {
            ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 5; ctx.strokeStyle = "#2f9e4f";
            u.rr(ctx, r[0] - 10, r[1] - 10, r[2] + 20, r[3] + 20, 14); ctx.stroke(); ctx.setLineDash([]);
            txt(ctx, "💡", r[0] + r[2] + 4, r[1] - 6, 26);
          }
        }
      });
      ["psu", "hdd", "ssd", "gpu", "ram", "cpu", "cooler"].forEach(function (id) { if (placed[id]) drawPlaced(id, t); });
      // cables
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (placed.psu) {
        ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(ox + 340, 540); ctx.lineTo(ox + 650, 540); ctx.lineTo(ox + 650, 225); ctx.lineTo(ox + 630, 225); ctx.stroke();
        ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 7; ctx.stroke();
      }
      if (placed.hdd) {
        ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(ox + 684, 200); ctx.bezierCurveTo(ox + 655, 205, ox + 660, 300, ox + 630, 300); ctx.stroke();
        ctx.strokeStyle = "#d1495b"; ctx.lineWidth = 4.5; ctx.stroke();
      }
      SLOTS.forEach(function (s) { if (!placed[s.id] || (s.id === "cpu" && !placed.cooler)) { var pl = plateFor(s, ox); if (!(s.id === "cpu" && placed.cpu)) plate(ctx, s.name, pl[0], pl[1]); } });
      if (placed.cpu && !placed.cooler) plate(ctx, "Cooler goes on top", ox + 235, 240);
      // power button
      var pb = { x: ox + 790, y: 530 };
      if (ready) { var pr2 = 44 + Math.sin(t * 6) * 6; circ(ctx, pb.x, pb.y, pr2, "rgba(47,158,79,.25)", 0); }
      circ(ctx, pb.x, pb.y, 34, on ? "#7ee787" : ready ? "#2f9e4f" : "#9aa8b6", 4);
      ctx.strokeStyle = on || ready ? "#fff" : INK; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(pb.x, pb.y + 2, 15, -Math.PI / 2 + .6, -Math.PI / 2 - .6 + TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pb.x, pb.y - 16); ctx.lineTo(pb.x, pb.y + 1); ctx.stroke();
      txt(ctx, "POWER", pb.x, pb.y + 50, 16, { w: 700, c: ready ? "#2f9e4f" : "#4c5d70" });
      // sends back to the tray
      back = back.filter(function (b) {
        b.t += dt; var q = Math.min(1, b.t / .55), e = u.ease.outCubic(q), f = tileFit(b.i);
        var x = u.lerp(b.x, f.x, e), y = u.lerp(b.y, f.y, e) - Math.sin(q * Math.PI) * 90, sc = u.lerp(.9, f.s, e);
        ctx.save(); ctx.translate(x, y); if (b.spin) ctx.rotate(q * TAU);
        var pr3 = partRectAt(PARTS[b.i].id, 0, 0, sc); drawPart(ctx, PARTS[b.i].id, pr3[0], pr3[1], pr3[2], pr3[3], t, false); ctx.restore();
        return q < 1;
      });
      // bonk bugs
      pops = pops.filter(function (b) {
        b.life -= dt; var k = 1 - b.life / 1.1;
        ctx.save(); ctx.globalAlpha = Math.min(1, b.life * 3);
        ctx.translate(b.x, b.y - 40); ctx.rotate(-.15);
        ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath();
        for (var j = 0; j < 20; j++) { var a = j * TAU / 20, q = (j % 2 ? 34 : 56) * (.6 + Math.min(1, k * 4) * .4); ctx.lineTo(Math.cos(a) * q * 1.3, Math.sin(a) * q); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        txt(ctx, "BONK!", 0, 2, 24, { w: 700, c: "#d1495b" });
        ctx.restore();
        glitchBug(ctx, b.x + 60, b.y - 70 - Math.sin(k * Math.PI) * 30, .9, t);
        ctx.globalAlpha = 1;
        return b.life > 0;
      });
      // the dragged part follows the pointer
      if (drag && drag.moved) {
        var dp = PARTS[drag.i], dr = partRectAt(dp.id, drag.x, drag.y, 1);
        ctx.save(); ctx.globalAlpha = .93; ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
        drawPart(ctx, dp.id, dr[0], dr[1], dr[2], dr[3], t, false); ctx.restore();
      } else if (sel >= 0 && !kbUsed && mouse.x > ox) {
        var sp = PARTS[sel], sr2 = partRectAt(sp.id, mouse.x, mouse.y, .6);
        ctx.save(); ctx.globalAlpha = .45; drawPart(ctx, sp.id, sr2[0], sr2[1], sr2[2], sr2[3], t, false); ctx.restore();
      }
      fx.draw(ctx, dt);
    });
  }

  /* ============================================================ L2 Kitchen Rush */
  var ST = {
    cpu: { name: "CPU", sub: "Head chef", tip: "tricky step-by-step decisions", col: "#5b6ee1" },
    gpu: { name: "GPU", sub: "1000s of helpers", tip: "matching math on many items at once", col: "#0f8f8a" },
    ram: { name: "RAM", sub: "Countertop", tip: "fast space, wiped at power-off", col: "#e0752d" },
    store: { name: "SSD / HDD", sub: "Pantry", tip: "keeps things, even with power off", col: "#8a5cd0" },
    ssd: { name: "SSD", sub: "Fast shelf", tip: "fast, no moving parts", col: "#8a5cd0" },
    hdd: { name: "HDD", sub: "Big cabinet", tip: "big and cheap, but slower", col: "#b0532b" }
  };
  function orders() {
    var site = shortSite();
    return {
      cpu: [["🧭", "Decide which forest gets seeds first"], ["📋", "Run ReSeed's steps one by one, in order"], ["🔀", "If it's cloudy, wait. If not, snap a photo!"], ["🖱️", "Answer a mouse click right now"], ["🧾", "Check the rules: lost forest, or just winter?"]],
      gpu: [["🎨", "Color 2 million pixels in big, speedy groups"], ["🧠", "Do the same neural-network math on 10,000 tiles"], ["🌈", "Brighten every pixel of the " + site + " photo"], ["🎮", "Draw 60 game pictures every second"], ["🌲", "Check 50,000 forest tiles with ForestNet"]],
      ram: [["🖼️", "Hold the photo you are editing right now"], ["🧮", "Keep the numbers in the middle of a big sum"], ["🕹️", "Keep the open game ready to play"]],
      store: [["🛰️", "Keep the " + site + " photos for next week"], ["📦", "Save the trained ForestNet file for tomorrow"], ["📚", "Keep your homework after you switch off"]],
      ssd: [["⚡", "Start the computer super fast"], ["🚀", "Load the game in two seconds"]],
      hdd: [["🗄️", "Keep 10 years of old photos cheaply"], ["🎞️", "Back up a mountain of videos"]]
    };
  }
  function reason(k, c) {
    var compute = k === "cpu" || k === "gpu", keep = k === "store" || k === "ssd" || k === "hdd";
    if (k === "cpu" && c === "gpu") return "The helpers can make choices, but they shine when everyone does the same job. Tricky step-by-step choices go to the chef.";
    if (k === "gpu" && c === "cpu") return "The chefs can share the work too, but thousands of helpers shine at lots of matching math!";
    if (compute) return "A " + (c === "ram" ? "countertop" : "pantry") + " can't cook! Send it to a chef or the helpers.";
    if (k === "ram" && (c === "cpu" || c === "gpu")) return "Chefs cook. Where do they put the stuff they are using right now?";
    if (k === "ram") return "The pantry is slower. Things you use right now go on the countertop.";
    if (keep && c === "ram") return "The countertop is wiped when the power goes off! Keep it in the pantry.";
    if (keep && (c === "cpu" || c === "gpu")) return "Chefs cook, they don't keep things. Where do we store food?";
    if (k === "ssd") return "The HDD is slower because its disk spins. For speed, pick the SSD.";
    if (k === "hdd") return "The SSD is fast but costs more. For a huge pile kept cheaply, pick the HDD.";
    return "Hmm, not that one. Read the signs under each worker.";
  }

  function kitchenLevel(L) {
    var cv = L.canvas({ w: 1280, h: 630, fill: true, bg: "#f8e9cc", label: "kitchen: send each order to the right worker" }), ctx = cv.ctx, fx = FX();
    var O = orders(), rng = L.rng;
    function take(k, n) { return u.shuffle(O[k], rng).slice(0, n).map(function (o) { return { k: k, ic: o[0], t: o[1] }; }); }
    var gpuPool = u.shuffle(O.gpu, rng);
    var p1 = u.shuffle([].concat(take("cpu", 3), gpuPool.slice(0, 3).map(function (o) { return { k: "gpu", ic: o[0], t: o[1] }; }), take("ram", 2), take("store", 2)), rng);
    var p2 = u.shuffle([].concat(take("ssd", 2), take("hdd", 2), [{ k: "gpu", ic: gpuPool[3][0], t: gpuPool[3][1] }]), rng);
    var tickets = p1.concat(p2), P1 = p1.length, TOTAL = tickets.length;
    var stations = ["cpu", "gpu", "ram", "store"], idx = 0, firstTry = 0, wrongThis = false, wrongRun = 0, busy = false, fly = null, hover = -1;
    var anim = {}; ["cpu", "gpu", "ram", "store", "ssd", "hdd"].forEach(function (k) { anim[k] = { work: 0, shake: 0 }; });
    var counter = [], jars = 3, ssdJars = 0, hddJars = 0, cut = 0, cutting = false, now = 0;
    function hud() { L.hud.set("ord", "🧾 " + Math.min(idx + 1, TOTAL) + " / " + TOTAL); L.hud.set("acc", "🎯 " + firstTry); }
    hud();
    function rects() {
      var n = stations.length, gap = 14, x0 = 20, w = (cv.w - 40 - gap * (n - 1)) / n, out = [];
      for (var i = 0; i < n; i++) out.push([x0 + i * (w + gap), 222, w, 396]);
      return out;
    }
    function front() { return [28, 30, Math.min(560, cv.w * .45), 162]; }
    function route(i) {
      if (busy || cutting || idx >= TOTAL || i < 0 || i >= stations.length) return;
      busy = true; L.sfx("whoosh");
      fly = { i: i, k: stations[i], t: 0, back: false, ok: stations[i] === tickets[idx].k };
    }
    function arrive() {
      var tk = tickets[idx], k = fly.k, c = mid(rects()[fly.i]);
      if (fly.ok) {
        fly = null; anim[k].work = 1.4; L.sfx("good"); fx.burst(c.x, c.y - 40, 18); fx.float(c.x, c.y - 100, wrongThis ? "✓" : "+1");
        if (!wrongThis) firstTry++;
        if (k === "ram") counter.push(tk.ic);
        else if (k === "store") jars++;
        else if (k === "ssd") ssdJars++;
        else if (k === "hdd") hddJars++;
        idx++; wrongThis = false; wrongRun = 0; hud();
        if (idx === P1) L.timeout(powerCut, 700);
        else if (idx >= TOTAL) L.timeout(finish, 900);
        else busy = false;
      } else {
        anim[k].shake = .6; L.sfx("bad"); wrongThis = true; wrongRun++;
        L.toast("🙅 " + reason(tk.k, k), "bad", 3200);
        fly.back = true; fly.t = 0;
      }
    }
    function powerCut() {
      if (!L.alive) return;
      cutting = true; L.sfx("zap"); sound(function (a) { a.tone({ f: 110, f2: 40, type: "sawtooth", d: .9, v: .12, lp: 600 }); });
      L.timeout(function () {
        var r = rects()[2];
        counter.forEach(function (c, j) { fx.burst(r[0] + 40 + j * 50, r[1] + 200, 10, ["#9aa8b6", "#cfd8e1", "#ffffff"]); });
        counter = []; L.sfx("whoosh");
      }, 800);
      L.timeout(function () {
        cutting = false; L.sfx("powerup");
        L.say("mo", "Power cut! The countertop forgot everything, but the pantry kept every jar.", { mood: "wow" }).then(function () {
          if (!L.alive) return;
          return L.say("mo", "That's **RAM** versus storage: RAM is fast but forgets, and storage remembers.");
        }).then(function () {
          if (!L.alive) return;
          stations = ["cpu", "gpu", "ram", "ssd", "hdd"]; ssdJars = 2; hddJars = jars; L.sfx("snap");
          return L.say("sprout", "Look, the pantry split in two: a fast **SSD** shelf and a big, cheap **HDD** cabinet!", { mood: "wow" });
        }).then(function () {
          if (!L.alive) return;
          busy = false; L.toast("🎯 New stations: **4** SSD and **5** HDD", "info", 2800);
        });
      }, 1900);
    }
    function finish() {
      var ratio = firstTry / TOTAL, stars = ratio >= .9 ? 3 : ratio >= .7 ? 2 : 1;
      L.win({ stars: stars, msg: "Order up! **" + firstTry + " of " + TOTAL + "** orders went to the right worker on the first try.", stats: { "First try": firstTry + " / " + TOTAL, "Power cuts survived": 1 } });
    }
    function stationAt(p) { var rs = rects(); for (var i = 0; i < rs.length; i++) if (inRect(p, rs[i])) return i; return -1; }
    L.on(cv.cv, "pointerdown", function (e) { var i = stationAt(cv.toLocal(e)); if (i >= 0) route(i); });
    L.on(cv.cv, "pointermove", function (e) { hover = stationAt(cv.toLocal(e)); cv.cv.style.cursor = hover >= 0 ? "pointer" : ""; });
    L.on(window, "keydown", function (e) {
      if (dialogOpen()) return;
      var n = parseInt(e.key, 10); if (n >= 1 && n <= stations.length) { e.preventDefault(); route(n - 1); }
    });

    function drawTicket(x, y, w, h, tk, big, rot, num) {
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot || 0);
      rbox(ctx, -w / 2, -h / 2, w, h, 10, "#fffef5", 3);
      rbox(ctx, -20, -h / 2 - 12, 40, 18, 4, "#9aa8b6", 2.5);
      if (big) {
        txt(ctx, "ORDER " + num, -w / 2 + 16, -h / 2 + 22, 17, { a: "left", c: "#7d8ea3", w: 700 });
        txt(ctx, tk.ic, -w / 2 + 54, 14, 54);
        var font = "600 26px " + FONT, lines = wrapText(ctx, tk.t, w - 130, font);
        lines.forEach(function (l, j) { txt(ctx, l, -w / 2 + 102, 14 + (j - (lines.length - 1) / 2) * 32, 26, { a: "left" }); });
      } else {
        txt(ctx, tk.ic, 0, 0, 40);
        txt(ctx, "next", 0, h / 2 - 16, 15, { c: "#7d8ea3" });
      }
      ctx.restore();
    }
    function drawStation(k, r, i, t, hint) {
      var a = anim[k], s = ST[k], x = r[0], y = r[1], w = r[2], h = r[3];
      var sh = a.shake > 0 ? Math.sin(t * 60) * 8 * a.shake : 0;
      ctx.save(); ctx.translate(sh, 0);
      if (hint) { ctx.save(); ctx.shadowColor = "#7ee787"; ctx.shadowBlur = 30 + Math.sin(t * 6) * 10; rbox(ctx, x, y, w, h, 18, "#fff", 0); ctx.restore(); }
      rbox(ctx, x, y, w, h, 18, i === hover ? "#fffbe6" : "#fffdf7", hint ? 5 : 3.5);
      ctx.save(); u.rr(ctx, x, y, w, 66, 18); ctx.clip(); ctx.fillStyle = s.col; ctx.fillRect(x, y, w, 66); ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 66); ctx.lineTo(x + w, y + 66); ctx.stroke();
      circ(ctx, x + 30, y + 33, 18, "#fff", 2.5); txt(ctx, String(i + 1), x + 30, y + 34, 20, { w: 700 });
      txt(ctx, s.name, x + 58, y + 22, w < 240 ? 22 : 26, { a: "left", w: 700, c: "#fff" });
      txt(ctx, s.sub, x + 58, y + 48, 18, { a: "left", c: "#fff" });
      var bx = x + 10, by = y + 76, bw = w - 20, bh = h - 140;
      if (k === "cpu") drawChefStation(bx, by, bw, bh, t, a.work > 0);
      else if (k === "gpu") drawHelpers(bx, by, bw, bh, t, a.work > 0);
      else if (k === "ram") drawCounter(bx, by, bw, bh, t);
      else if (k === "store") drawShelves(bx, by, bw, bh, jars, 3, "#8a5cd0");
      else if (k === "ssd") { drawShelves(bx, by, bw, bh, ssdJars, 2, "#8a5cd0"); bolt(ctx, bx + bw - 26, by + 22, 1, "#ffd23f"); }
      else if (k === "hdd") drawCabinet(bx, by, bw, bh, t, hddJars);
      var lines = wrapText(ctx, s.tip, w - 24, "500 18px " + FONT);
      lines.slice(0, 2).forEach(function (l, j) { txt(ctx, l, x + w / 2, y + h - 40 + j * 21 - (lines.length > 1 ? 0 : -10), 18, { w: 500, c: "#4a5b6d" }); });
      ctx.restore();
    }
    function drawChefStation(bx, by, bw, bh, t, work) {
      var s = Math.min(bw / 240, bh / 220, 1.1);
      chef(ctx, bx + bw * .2, by + bh * .72, s * .48, t + 1, work);
      chef(ctx, bx + bw * .8, by + bh * .72, s * .48, t + 2, work);
      chef(ctx, bx + bw / 2, by + bh * .55, s, t, work);
      txt(ctx, "cores", bx + bw * .2, by + bh - 4, 16, { c: "#4a5b6d" }); txt(ctx, "cores", bx + bw * .8, by + bh - 4, 16, { c: "#4a5b6d" });
      if (work) { gear(ctx, bx + bw / 2 - 26, by + 22, 16, t * 5); gear(ctx, bx + bw / 2 + 4, by + 12, 11, -t * 7, "#79c0ff"); txt(ctx, "✓", bx + bw / 2 + 34, by + 22, 30, { w: 700, c: "#2f9e4f" }); }
    }
    function drawHelpers(bx, by, bw, bh, t, work) {
      var cols = 6, rows = 5, dx = bw / cols, dy = (bh - 10) / rows, r = Math.min(dx, dy) * .26;
      for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
        var hx = bx + dx * (i + .5), hy = by + 18 + dy * (j + .62);
        if (work) { ctx.fillStyle = "hsl(" + Math.round(120 + 40 * Math.sin(t * 15)) + ",70%,55%)"; ctx.fillRect(hx - r * .5, hy - r * 2.9 - Math.abs(Math.sin(t * 15)) * r * .7, r, r); }
        helper(ctx, hx, hy, r, t, work);
      }
    }
    function drawCounter(bx, by, bw, bh, t) {
      var top = by + bh * .5;
      rbox(ctx, bx + 6, top + 16, bw - 12, bh * .5 - 16, 8, "#e0bb7f", 2.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + bw / 2, top + 22); ctx.lineTo(bx + bw / 2, by + bh - 6); ctx.stroke();
      circ(ctx, bx + bw / 2 - 12, top + bh * .25, 4, INK, 0); circ(ctx, bx + bw / 2 + 12, top + bh * .25, 4, INK, 0);
      rbox(ctx, bx, top, bw, 18, 6, "#c8a165", 3);
      var show = counter.slice(-4), gap = (bw - 20) / 4;
      show.forEach(function (ic, j) { txt(ctx, ic, bx + 10 + gap * (j + .5), top - 22 + Math.sin(t * 3 + j) * 2, 36); });
      bolt(ctx, bx + 22, by + 24, .9, "#ffd23f"); txt(ctx, "fast!", bx + 40, by + 26, 18, { a: "left", w: 700, c: "#e0752d" });
      if (!counter.length) txt(ctx, "(empty)", bx + bw / 2, top - 22, 17, { c: "#9aa8b6" });
    }
    function drawShelves(bx, by, bw, bh, n, rowsN, col) {
      var per = Math.max(3, Math.floor((bw - 20) / 40)), shown = 0;
      for (var j = 0; j < rowsN; j++) {
        var sy = by + bh * (j + 1) / rowsN - 6;
        rbox(ctx, bx + 4, sy, bw - 8, 10, 4, "#c8a165", 2.5);
        for (var i = 0; i < per && shown < n; i++, shown++) {
          var jx = bx + 14 + i * ((bw - 28) / per), jw = Math.min(30, (bw - 28) / per - 6), jh = Math.min(42, bh / rowsN - 20);
          rbox(ctx, jx, sy - jh, jw, jh, 6, "#dff3ff", 2);
          rbox(ctx, jx - 2, sy - jh - 6, jw + 4, 8, 3, col, 2);
          ctx.fillStyle = ["#ff8fab", "#7ee787", "#ffd23f", "#79c0ff"][shown % 4]; ctx.fillRect(jx + 4, sy - jh * .55, jw - 8, jh * .45);
        }
      }
    }
    function drawCabinet(bx, by, bw, bh, t, n) {
      rbox(ctx, bx + 6, by + 6, bw - 12, bh - 8, 10, "#e0bb7f", 3);
      var r = Math.min(bw, bh) * .22, cx = bx + bw / 2, cy = by + bh * .38;
      circ(ctx, cx, cy, r, "#e8edf2", 3); circ(ctx, cx, cy, r * .22, "#9aa8b6", 2);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 3); ctx.strokeStyle = "rgba(29,43,58,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * .65, 0, 1.8); ctx.stroke(); ctx.restore();
      for (var i = 0; i < Math.min(n, 8); i++) rbox(ctx, bx + 16 + (i % 4) * ((bw - 32) / 4), by + bh * .7 + Math.floor(i / 4) * 24 - 10, (bw - 32) / 4 - 6, 20, 3, "#c8a165", 2);
    }

    L.loop(function (dt, t) {
      now = t;
      var W = cv.w, rs = rects(), f = front(), i;
      var g = ctx.createLinearGradient(0, 0, 0, 630); g.addColorStop(0, "#fff4df"); g.addColorStop(1, "#f6e3c2");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 630);
      ctx.fillStyle = "rgba(208,138,28,.08)"; for (i = 0; i < W; i += 60) ctx.fillRect(i, 0, 30, 210);
      // order rail
      ctx.strokeStyle = "#7d8ea3"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(10, 20); ctx.lineTo(W - 10, 20); ctx.stroke();
      if (idx < TOTAL) {
        var tk = tickets[idx];
        for (var j = 1; j <= 3 && idx + j < TOTAL; j++) {
          var nx = f[0] + f[2] + 40 + (j - 1) * 150;
          if (nx + 130 > W - 10) break;
          drawTicket(nx, 38, 130, 104, tickets[idx + j], false, Math.sin(t * 2 + j) * .03);
        }
        if (!fly && !cutting) drawTicket(f[0], f[1], f[2], f[3], tk, true, Math.sin(t * 1.6) * .012, idx + 1);
        if (fly) {
          fly.t += dt; var q = Math.min(1, fly.t / .34), e = u.ease.inOut(q), c0 = mid(f), c1 = mid(rs[Math.min(fly.i, rs.length - 1)]);
          if (fly.back) { var tmp = c0; c0 = c1; c1 = tmp; }
          var sc = fly.back ? u.lerp(.35, 1, e) : u.lerp(1, .35, e), fx0 = u.lerp(c0.x, c1.x, e), fy0 = u.lerp(c0.y, c1.y, e) - Math.sin(q * Math.PI) * 60;
          drawTicket(fx0 - f[2] * sc / 2, fy0 - f[3] * sc / 2, f[2] * sc, f[3] * sc, tk, sc > .6, q * (fly.back ? -.4 : .4), idx + 1);
          if (q >= 1) { if (fly.back) { fly = null; busy = false; } else arrive(); }
        }
      }
      txt(ctx, "Press 1-" + stations.length + " or click a worker", W - 20, 200, 18, { a: "right", c: "#4a5b6d" });
      var hintK = idx < TOTAL && (wrongRun >= 2 || L.fails >= 1) ? tickets[idx].k : null;
      stations.forEach(function (k, n) { drawStation(k, rs[n], n, t, k === hintK); });
      ["cpu", "gpu", "ram", "store", "ssd", "hdd"].forEach(function (k) { anim[k].work = Math.max(0, anim[k].work - dt); anim[k].shake = Math.max(0, anim[k].shake - dt); });
      fx.draw(ctx, dt);
      // power cut
      if (cutting) cut = Math.min(1, cut + dt * 3); else cut = Math.max(0, cut - dt * 1.5);
      if (cut > 0) {
        var fl = cutting && Math.random() < .25 ? .5 : 1;
        ctx.fillStyle = "rgba(8,12,20," + (cut * .82 * fl) + ")"; ctx.fillRect(0, 0, W, 630);
        if (cutting) {
          ctx.font = "700 64px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 8; ctx.strokeStyle = INK;
          ctx.strokeText("⚡ POWER CUT! ⚡", W / 2, 300); txt(ctx, "⚡ POWER CUT! ⚡", W / 2, 300, 64, { w: 700, c: "#ffd23f" });
        }
      }
    });
  }

  /* ============================================================ L3 Train ForestNet */
  var GPU_MIN = 12, CPU_MIN = 360; // GPU: README "about 12 minutes on one GPU". CPU: an example, not a measurement.
  function hm(m) { var h = Math.floor(m / 60), mm = Math.floor(m % 60); return h + " h " + (mm < 10 ? "0" : "") + mm + " min"; }
  function accAt(p) { return .5 + .491 * (1 - Math.exp(-5 * p)) / (1 - Math.exp(-5)); }

  function raceLevel(L) {
    var cv = L.canvas({ w: 1280, h: 630, fill: true, bg: "#e0f3ee", label: "training race: CPU against GPU" }), ctx = cv.ctx, fx = FX();
    var phase = "pick", pick = -1, mins = 0, ff = false, hover = -1, doneT = 0, warned = false, fileFly = 0;
    var site = mySite(), thumb = null;
    if (site && site.files && site.files.thumb) { thumb = new Image(); thumb.src = RQ.url(site.files.thumb); }
    L.hud.set("clock", "⏱ 0 h 00 min");
    function cards() { var W = cv.w, w = 420; return [[W / 2 - w - 24, 132, w, 380], [W / 2 + 24, 132, w, 380]]; }
    function ffRect() { return [cv.w - 270, 92, 250, 56]; }
    function choosePick(i) {
      if (phase !== "pick") return;
      pick = i; phase = "race"; L.sfx("powerup");
      L.toast(i === 1 ? "🚀 Training on the **GPU**: thousands of helpers!" : "🧑‍🍳 Training on the **CPU**: a few clever chefs.", "info", 2600);
    }
    function finishRace() {
      phase = "done"; doneT = 0; L.sfx("good"); L.timeout(function () { L.sfx("bloom"); }, 300);
      RQ.ui.confetti(80);
      L.wait(2600).then(function () {
        if (!L.alive) return;
        return pick === 1 ? L.say("mo", "Great pick! The GPU did the same math on many pictures at once.", { mood: "happy" })
          : L.say("mo", "The GPU finished first! Your CPU chefs are still on the first few pictures.", { mood: "wow" });
      }).then(function () {
        if (!L.alive) return;
        return L.say("hoot", "ForestNet is saved in the pantry as a file, ready to check real forests!");
      }).then(function () {
        if (!L.alive) return;
        return L.choose("mo", "Quick check! On one GPU, the README says ForestNet trains in about…", ["12 minutes", "12 hours", "12 days"]);
      }).then(function (a) {
        if (!L.alive) return;
        if (a !== 0) L.toast("It's about **12 minutes** on one GPU (README).", "info", 3000);
        var stars = 1 + (pick === 1 ? 1 : 0) + (a === 0 ? 1 : 0);
        L.win({ stars: stars, msg: "ForestNet trained on the **GPU** in about 12 minutes. The CPU would still be busy (example timing).", stats: { "Your pick": pick === 1 ? "GPU" : "CPU", "Quiz": a === 0 ? "✓" : "12 minutes" } });
      });
    }
    L.on(cv.cv, "pointerdown", function (e) {
      var p = cv.toLocal(e);
      if (phase === "pick") { var cs = cards(); for (var i = 0; i < 2; i++) if (inRect(p, cs[i])) choosePick(i); }
      else if (phase === "race" && inRect(p, ffRect())) { ff = !ff; L.sfx(ff ? "powerup" : "click"); }
    });
    L.on(cv.cv, "pointermove", function (e) {
      var p = cv.toLocal(e), cs = cards(); hover = -1;
      if (phase === "pick") for (var i = 0; i < 2; i++) if (inRect(p, cs[i])) hover = i;
      cv.cv.style.cursor = hover >= 0 || (phase === "race" && inRect(p, ffRect())) ? "pointer" : "";
    });
    L.on(window, "keydown", function (e) {
      if (dialogOpen()) return;
      if (phase === "pick" && (e.key === "1" || e.key === "2")) choosePick(+e.key - 1);
      else if (phase === "race" && (e.key === "f" || e.key === "F" || e.key === " " || e.key === "Enter")) { e.preventDefault(); ff = !ff; L.sfx(ff ? "powerup" : "click"); }
    });

    function drawPickCard(r, i, t) {
      var x = r[0], y = r[1], w = r[2], h = r[3], hv = hover === i;
      ctx.save(); if (hv) { ctx.translate(0, -6); ctx.shadowColor = "rgba(18,163,154,.6)"; ctx.shadowBlur = 24; }
      rbox(ctx, x, y, w, h, 22, hv ? "#fffbe6" : "#fffdf7", 4); ctx.restore();
      var oy = hv ? -6 : 0;
      circ(ctx, x + 34, y + 34 + oy, 20, TEAL, 2.5); txt(ctx, String(i + 1), x + 34, y + 35 + oy, 22, { w: 700, c: "#fff" });
      txt(ctx, i ? "GPU" : "CPU", x + w / 2, y + 44 + oy, 40, { w: 700 });
      txt(ctx, i ? "graphics card · NVIDIA A100" : "processor · head chef", x + w / 2, y + 82 + oy, 20, { c: "#4a5b6d" });
      if (i === 0) {
        chef(ctx, x + w / 2, y + 205 + oy, 1, t, false);
        chef(ctx, x + w * .2, y + 225 + oy, .55, t + 1, false); chef(ctx, x + w * .8, y + 225 + oy, .55, t + 2, false);
      } else {
        for (var j = 0; j < 4; j++) for (var k = 0; k < 9; k++) helper(ctx, x + 46 + k * ((w - 92) / 8), y + 146 + j * 42 + oy, 11, t + k * .1, false);
      }
      txt(ctx, i ? "thousands of tiny cores" : "a few clever cores", x + w / 2, y + 316 + oy, 23, { w: 700, c: i ? "#0f8f8a" : "#5b6ee1" });
      txt(ctx, i ? "best at: the same math on many pictures" : "best at: tricky step-by-step choices", x + w / 2, y + 348 + oy, 19, { c: "#4a5b6d" });
    }
    function lane(i, y, p, t, W) {
      var mine = pick === i, x0 = 230, x1 = W - 180, tw = x1 - x0;
      rbox(ctx, 16, y, 200, 140, 18, mine ? "#fff27a" : "#fffdf7", 3);
      txt(ctx, i ? "GPU" : "CPU", 116, y + 34, 32, { w: 700 });
      txt(ctx, i ? "1000s of helpers" : "a few chefs", 116, y + 70, 19, { c: "#4a5b6d" });
      if (mine) { rbox(ctx, 56, y + 92, 120, 30, 15, TEAL, 2); txt(ctx, "your pick", 116, y + 108, 17, { w: 700, c: "#fff" }); }
      rbox(ctx, x0, y + 18, tw, 104, 16, "#efe6d2", 3);
      ctx.setLineDash([18, 14]); ctx.strokeStyle = "#c8b994"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0 + 14, y + 70); ctx.lineTo(x1 - 14, y + 70); ctx.stroke(); ctx.setLineDash([]);
      for (var k = 0; k < 6; k++) for (var m = 0; m < 2; m++) { ctx.fillStyle = (k + m) % 2 ? "#fff" : INK; ctx.fillRect(x1 - 26 + m * 12, y + 22 + k * 16, 12, 16); }
      var rx = x0 + 40 + p * (tw - 90);
      // trail of learned pictures (little forest tiles)
      for (var q = x0 + 26; q < rx - 30; q += 26) {
        ctx.fillStyle = ["#2f9e4f", "#5fbf4a", "#8fd36b", "#c8a165"][Math.floor(q / 26) % 4]; ctx.fillRect(q, y + 98 - (Math.floor(q / 26) % 2) * 8, 18, 14);
      }
      if (i === 0) chef(ctx, rx, y + 70, .62, t, phase === "race");
      else for (var b = 0; b < 12; b++) helper(ctx, rx - 34 + (b % 4) * 22, y + 48 + Math.floor(b / 4) * 24, 9, t + b * .07, phase === "race");
      txt(ctx, Math.floor(p * 100) + "%", W - 98, y + 52, 36, { w: 700, c: p >= 1 ? "#2f9e4f" : INK });
      var note = p >= 1 ? "✓ done!" : phase === "done" && i === 0 ? "still going…" : "training…";
      txt(ctx, note, W - 98, y + 92, 19, { c: "#4a5b6d" });
    }

    L.loop(function (dt, t) {
      var W = cv.w, i;
      var g = ctx.createLinearGradient(0, 0, 0, 630); g.addColorStop(0, "#e9f8ff"); g.addColorStop(1, "#d8efe9");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 630);
      if (phase === "pick") {
        txt(ctx, "Who should train ForestNet?", W / 2, 52, 38, { w: 700 });
        txt(ctx, "Training = the same math, again and again, on thousands of forest pictures.", W / 2, 96, 22, { c: "#4a5b6d" });
        var cs = cards(); for (i = 0; i < 2; i++) drawPickCard(cs[i], i, t);
        txt(ctx, "Click a card or press 1 or 2", W / 2, 552, 20, { c: "#4a5b6d" });
        fx.draw(ctx, dt);
        return;
      }
      if (phase === "race") {
        mins += dt * (ff ? 4 : 1);
        if (pick === 0 && !warned && mins > 6) { warned = true; L.toast("🐢 The CPU chefs are trying hard… but look at the GPU lane!", "info", 3000); }
        if (mins >= GPU_MIN) { mins = GPU_MIN; finishRace(); }
        L.hud.set("clock", "⏱ " + hm(mins));
      } else doneT += dt;
      var pg = Math.min(1, mins / GPU_MIN), pc = Math.min(1, mins / CPU_MIN);
      txt(ctx, "Training race", 24, 36, 32, { a: "left", w: 700 });
      txt(ctx, "Example timing (game version). Real GPU time in the README: about 12 minutes.", 24, 72, 20, { a: "left", c: "#4a5b6d" });
      rbox(ctx, W - 270, 18, 250, 60, 16, "#10161f", 3); txt(ctx, "⏱ " + hm(mins), W - 145, 49, 26, { w: 700, mono: true, c: "#7ee787" });
      if (phase === "race") {
        var fr = ffRect(); rbox(ctx, fr[0], fr[1], fr[2], fr[3], 14, ff ? "#ffd23f" : "#fff", 3);
        txt(ctx, ff ? "⏩ Fast ×4 (F)" : "⏩ Fast-forward (F)", fr[0] + fr[2] / 2, fr[1] + fr[3] / 2 + 1, 21, { w: 700 });
      }
      lane(0, 150, pc, t, W);
      lane(1, 306, pg, t, W);
      // chart: ForestNet learns (GPU lane)
      rbox(ctx, 16, 466, 560, 152, 16, "#fffdf7", 3);
      txt(ctx, "ForestNet gets smarter (GPU lane)", 32, 488, 20, { a: "left", w: 700 });
      var gx = 60, gy = 602, gw = 490, gh = 74;
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy - gh); ctx.lineTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
      txt(ctx, "100%", gx - 6, gy - gh, 14, { a: "right", c: "#4a5b6d" }); txt(ctx, "50%", gx - 6, gy, 14, { a: "right", c: "#4a5b6d" });
      ctx.strokeStyle = "#2f9e4f"; ctx.lineWidth = 4; ctx.beginPath();
      for (i = 0; i <= 60 * pg; i++) { var pp = i / 60, yy = gy - (accAt(pp) - .5) / .5 * gh; if (i === 0) ctx.moveTo(gx, yy); else ctx.lineTo(gx + pp * gw, yy); }
      ctx.stroke();
      if (pg > 0) { var ya = gy - (accAt(pg) - .5) / .5 * gh; circ(ctx, gx + pg * gw, ya, 6, "#2f9e4f", 2); }
      txt(ctx, phase === "done" ? "99.1% forest accuracy, EuroSAT tiles (README)" : "forest accuracy: " + Math.round(accAt(pg) * 100) + "%", gx + gw, 514, 18, { a: "right", w: 600, c: "#2f9e4f" });
      // result panel: the saved model + My Site
      var rx = 596, rw = W - rx - 16;
      rbox(ctx, rx, 466, rw, 152, 16, "#fffdf7", 3);
      if (phase === "done") {
        fileFly = Math.min(1, fileFly + dt * 1.2);
        var fx1 = u.lerp(W - 100, rx + 40, u.ease.outCubic(fileFly)), fy1 = u.lerp(370, 500, u.ease.outCubic(fileFly));
        rbox(ctx, fx1, fy1, 56, 70, 8, "#fff", 3); txt(ctx, ".pt", fx1 + 28, fy1 + 40, 20, { w: 700, mono: true, c: "#d1495b" });
        txt(ctx, "Saved: models/forestnet.pt", rx + 112, 500, 20, { a: "left", mono: true, w: 600 });
        txt(ctx, "(in the storage pantry)", rx + 112, 528, 18, { a: "left", c: "#4a5b6d" });
        if (thumb && thumb.complete && thumb.naturalWidth && rw > 520) {
          ctx.save(); u.rr(ctx, rx + rw - 132, 476, 116, 116, 10); ctx.clip(); ctx.drawImage(thumb, rx + rw - 132, 476, 116, 116); ctx.restore();
          rbox(ctx, rx + rw - 132, 476, 116, 116, 10, null, 3);
          txt(ctx, "Next: check " + shortSite() + "!", rx + 112, 568, 19, { a: "left", w: 700, c: "#2f9e4f" });
        } else txt(ctx, "Ready to check real forests!", rx + 112, 568, 19, { a: "left", w: 700, c: "#2f9e4f" });
        txt(ctx, "CPU (example): about " + Math.round((CPU_MIN - mins) / 60) + " more hours to go", rx + 112, 598, 17, { a: "left", c: "#4a5b6d" });
      } else {
        txt(ctx, "📦 The trained model will be saved here.", rx + rw / 2, 520, 20, { c: "#4a5b6d" });
        txt(ctx, "train.py learns from 512 pictures at a time (--batch)", rx + rw / 2, 560, 18, { c: "#4a5b6d" });
      }
      fx.draw(ctx, dt);
    });
  }

  /* ============================================================ L4 Spec-sheet detective */
  var SPEC = [
    { ic: "💿", k: "Operating system", v: "Ubuntu 24.04 LTS" },
    { ic: "🧠", k: "CPU", v: "AMD EPYC · 96 cores" },
    { ic: "📝", k: "RAM", v: "866 GB" },
    { ic: "🎨", k: "GPU", v: "4 × NVIDIA A100 80 GB" },
    { ic: "💾", k: "Disk", v: "2 TB" }
  ];
  var CASES = [
    { type: "find", q: "Find the line for the **countertop**: the fast memory that forgets at power-off.", ans: 2,
      note: "**RAM** = the countertop: 866 GB", ok: "Yes! **RAM** is the countertop: 866 GB of super-fast space.", hint: "The countertop is the memory with a three-letter name." },
    { type: "pick", q: "How many **cores** does the CPU head chef have?", opts: ["4", "96", "866"], ans: 1, line: 1,
      note: "CPU: **96** cores", ok: "**96 cores**: like 96 chefs working side by side!", hint: "Look at the **CPU** line. Find the number before 'cores'." },
    { type: "find", q: "Find the line for the **thousands of helpers** that train ForestNet.", ans: 3,
      note: "**GPU** = the helpers", ok: "Right, the **GPU** line. Each A100 is packed with tiny cores.", hint: "The helpers live on the graphics card." },
    { type: "pick", q: "How many GPUs are inside this computer?", opts: ["1", "4", "80"], ans: 1, line: 3,
      note: "**4** GPUs inside", ok: "**4 ×** means four of them! Each one is sold as an 80 GB card.", hint: "The number before the **×** tells how many." },
    { type: "num", q: "Each GPU card is sold as **80 GB** of memory. How much GPU memory is there in total?", ans: 320, line: 3,
      note: "GPU memory: **320 GB**", ok: "4 × 80 GB = **320 GB** of GPU memory. Wow!", hint: "4 × 80 = 80 + 80 + 80 + 80." },
    { type: "pick", q: "ForestNet trains on **one** GPU. How many GPUs are still free for other jobs?", opts: ["0", "3", "4"], ans: 1, line: 3,
      note: "1 GPU trains, **3** are free", ok: "**3** GPUs are free. 4 − 1 = 3.", hint: "There are 4 GPUs and one is busy. 4 − 1 = ?" },
    { type: "pick", q: "Which is bigger: the RAM, or all the GPU memory together?", opts: ["RAM: 866 GB", "GPU memory: 320 GB", "They are the same"], ans: 0, line: 2,
      note: "RAM 866 GB **>** 320 GB", ok: "866 GB beats 320 GB. That's a giant countertop!", hint: "Compare 866 and 320. Which number is bigger?" },
    { type: "find", q: "Last case! Find the line that names the **operating system**, the computer's boss program.", ans: 0,
      note: "OS: **Ubuntu 24.04 LTS**", ok: "**Ubuntu 24.04 LTS**, a Linux system. You'll install one next!", hint: "Look for the words **Operating system**." }
  ];

  function specLevel(L) {
    var el = u.el, md = RQ.ui.md;
    var root = el("div", { class: "fill mw-spec" });
    var sheet = el("div", { class: "mw-sheet", role: "group", "aria-label": "spec sheet" },
      el("div", { class: "mw-stamp", text: "REAL" }),
      el("h2", { html: "🖥️ Mission computer · spec sheet" }),
      el("div", { class: "sub", text: "Our project computer: the one ReSeed was built on" }));
    var lines = SPEC.map(function (s, i) {
      var b = el("button", { class: "mw-line", "aria-label": s.k + ": " + s.v },
        el("span", { class: "n", text: String(i + 1) }), el("span", { class: "ic", text: s.ic }), el("span", { class: "k", text: s.k }), el("span", { class: "v", text: s.v }));
      b.addEventListener("click", function () { if (L.alive && !L.paused) clickLine(i); });
      sheet.appendChild(b); return b;
    });
    var notesList = el("ul");
    sheet.appendChild(el("div", { class: "mw-notes" }, el("b", { text: "📝 Detective notes" }), notesList));
    var moWho = el("div", { class: "who" }), moTip = el("div", { class: "say" });
    var pips = el("div", { class: "mw-pips" }), pipEls = CASES.map(function () { var p = el("i"); pips.appendChild(p); return p; });
    var caseNo = el("b"), qEl = el("div", { class: "mw-q" }), ansEl = el("div", { class: "mw-ans" }), fb = el("div", { class: "mw-fb", html: "🔍 Read the sheet like a detective." });
    var panel = el("div", { class: "mw-case" }, el("div", { class: "mw-case-top" }, el("span", { class: "mag", text: "🔍" }), caseNo, pips), qEl, ansEl, fb,
      el("div", { class: "mw-mo" }, moWho, moTip));
    function mo(mood, tip) { moWho.innerHTML = RQ.chars ? RQ.chars.svg("mo", { mood: mood }) : ""; if (tip) moTip.innerHTML = md(tip); }
    root.appendChild(sheet); root.appendChild(panel); L.stage.appendChild(root);
    var cur = 0, tries = 0, first = 0, busy = false, typed = "", disp = null;
    function hud() { L.hud.set("case", "🔍 " + Math.min(cur + 1, CASES.length) + " / " + CASES.length); L.hud.set("first", "🎯 " + first); }

    function show(i) {
      var c = CASES[i]; tries = 0; busy = false; typed = "";
      caseNo.textContent = "Case " + (i + 1) + " of " + CASES.length;
      pipEls.forEach(function (p, j) { p.classList.toggle("now", j === i); });
      qEl.innerHTML = md(c.q); ansEl.innerHTML = ""; fb.className = "mw-fb"; fb.innerHTML = "🔍 Read the sheet like a detective.";
      lines.forEach(function (b) { b.classList.remove("no", "look"); });
      mo("think", c.type === "find" ? "Clues are on the sheet. Read every line!" : c.type === "num" ? "**×** means times. 4 × 80 is four 80s added up." : "Detectives check the numbers twice.");
      if (c.type === "find") ansEl.appendChild(el("div", { class: "mw-point", html: "👈 Click the right line (or press 1–5)." }));
      else if (c.type === "pick") c.opts.forEach(function (o, j) { ansEl.appendChild(el("button", { class: "btn", html: "<b>" + (j + 1) + "</b>&nbsp; " + md(o), onclick: function () { if (L.alive && !L.paused) answer(j); } })); });
      else {
        disp = el("div", { class: "mw-display", "aria-live": "polite", text: "_ GB" });
        var pad = el("div", { class: "mw-pad" });
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].forEach(function (k) {
          pad.appendChild(el("button", { class: "btn" + (k === "✓" ? " go" : ""), text: k, "aria-label": k === "⌫" ? "delete" : k === "✓" ? "check" : k, onclick: function () { if (L.alive && !L.paused) padKey(k); } }));
        });
        ansEl.appendChild(el("div", { class: "mw-padwrap" }, el("div", {}, disp, el("p", { class: "muted", style: { margin: "6px 0 0", fontSize: ".95rem" }, text: "Type the number, then ✓" })), pad));
      }
      hud();
    }
    function padKey(k) {
      if (busy) return;
      if (k === "⌫") typed = typed.slice(0, -1);
      else if (k === "✓") { if (typed) answer(parseInt(typed, 10)); return; }
      else if (typed.length < 4) typed += k;
      L.sfx("tick"); if (disp) disp.textContent = (typed || "_") + " GB";
    }
    function clickLine(i) { if (CASES[cur] && CASES[cur].type === "find") answer(i); else { L.sfx("click"); lines[i].classList.add("look"); L.timeout(function () { lines[i].classList.remove("look"); }, 500); } }
    function answer(v) {
      if (busy || cur >= CASES.length) return;
      var c = CASES[cur];
      if (v === c.ans) {
        busy = true; if (!tries) first++;
        pipEls[cur].classList.remove("now"); pipEls[cur].classList.add(tries ? "meh" : "ok");
        var ln = c.type === "find" ? c.ans : c.line; if (ln != null) lines[ln].classList.add("found");
        fb.className = "mw-fb good"; fb.innerHTML = "✅ " + md(c.ok); L.sfx("good"); hud(); mo("happy", "Nice detective work!");
        notesList.appendChild(el("li", { html: "✓ " + md(c.note) }));
        L.timeout(next, 1900);
      } else {
        tries++; L.sfx("bad");
        if (c.type === "find") { lines[v].classList.remove("no"); void lines[v].offsetWidth; lines[v].classList.add("no"); }
        if (c.type === "num") { typed = ""; if (disp) disp.textContent = "_ GB"; }
        fb.className = "mw-fb bad"; fb.innerHTML = "💡 " + md(c.hint); mo("think");
        if (tries >= 2 && c.line != null) lines[c.line].classList.add("look");
        if (tries >= 2 && c.type === "find") lines[c.ans].classList.add("look");
      }
    }
    function next() {
      cur++;
      if (cur < CASES.length) { show(cur); return; }
      L.hud.set("case", "🔍 done");
      sheet.appendChild(el("div", { class: "mw-closed", text: "CASE CLOSED ✓" }));
      L.sfx("snap"); L.timeout(function () { L.sfx("powerup"); }, 200);
      L.wait(900).then(function () {
        if (!L.alive) return;
        return L.say("mo", "Case closed! Psst: these games were built on this very computer.", { mood: "wow" });
      }).then(function () {
        if (!L.alive) return;
        var stars = first >= 7 ? 3 : first >= 5 ? 2 : 1;
        L.win({ stars: stars, msg: "You read a real spec sheet: **96 cores**, **866 GB** of RAM and **4 × 80 GB = 320 GB** of GPU memory.", stats: { "First try": first + " / " + CASES.length } });
      });
    }
    L.on(window, "keydown", function (e) {
      if (dialogOpen() || busy || cur >= CASES.length) return;
      var c = CASES[cur], n = parseInt(e.key, 10);
      if (c.type === "find" && n >= 1 && n <= SPEC.length) answer(n - 1);
      else if (c.type === "pick" && n >= 1 && n <= c.opts.length) answer(n - 1);
      else if (c.type === "num") {
        if (/^[0-9]$/.test(e.key)) padKey(e.key);
        else if (e.key === "Backspace") { e.preventDefault(); padKey("⌫"); }
        else if (e.key === "Enter") { e.preventDefault(); padKey("✓"); }
      }
    });
    show(0);
  }

  /* ============================================================ the game */
  RQ.game({
    id: "g02",
    music: "camp",
    intro: [
      ["mo", "Welcome to my workshop! I'm Mo, and I build computers."],
      ["sprout", "ReSeed needs a strong computer to find lost forests. Let's build one and see what every part does!"]
    ],
    outro: [
      ["mo", "You built a computer, ran its kitchen and read a real spec sheet. Hardware hero!"],
      ["pix", "Your computer still needs a brain program. Come to **Operation Install** and give it an operating system!"]
    ],
    levels: [
      { title: "Build the bot", goal: "Drag each part to the slot with the same shape, then power on",
        intro: [["mo", "Here's an empty case and a **motherboard**, the big board every part plugs into."],
                ["mo", "Drag each part to the slot with the same shape. A wrong socket means bonk!"]],
        cards: ["motherboard"],
        play: buildLevel },
      { title: "Kitchen Rush", goal: "Send each order to the right worker",
        intro: [["mo", "A computer works like a busy kitchen. Orders fly in, and you send each one to the right worker!"],
                ["sprout", "The **CPU** chefs make tricky choices, and **GPU** helpers shine at matching jobs on many things. **RAM** is the countertop; storage is the pantry."]],
        cards: ["cpu-chef", "ram-countertop", "storage-pantry"],
        play: kitchenLevel },
      { title: "Train ForestNet", goal: "Pick a chip and watch the training race",
        intro: [["hoot", "ForestNet is ReSeed's forest-spotting brain. It must study thousands of pictures to get smart."],
                ["mo", "Studying means the same math again and again. Pick the part that should do it!"]],
        cards: ["gpu-helpers"],
        play: raceLevel },
      { title: "Spec-sheet detective", goal: "Read the real spec sheet and solve every case",
        intro: [["mo", "Detective time! This is the spec sheet of our **real** project computer, where ReSeed was built."],
                ["mo", "Read it carefully and crack each case. Click the right line or the right answer."]],
        cards: ["spec-sheet"],
        play: specLevel }
    ]
  });
})();
