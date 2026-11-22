/* g09 Packet Post — how pictures travel across the internet.
 * L1 TCP handshake (rhythm catch) · L2 numbered packets through routers: spot the lost one, resend, rebuild (TCP)
 * L3 live drone video over UDP: conceal or skip damaged frames · L4 DNS phone book + cache · L5 ports (doors) + URL parts.
 * Real ties: reseed/server.py (port 8000, /api/health, /api/classify, 12 MB limit, localhost 127.0.0.1),
 * reseed/__main__.py (`python -m reseed serve`), reseed/demo_flight.py (MAVLink over udp:127.0.0.1:14550),
 * README (khamydoan.github.io/reseed, airesearchcenter.com/reseed). Other names in the phone book are made-up `.example` names. */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a";
  var C = { syn: "#2b7bd0", synack: "#7c5cc4", ack: "#2f9e4f", amber: "#d08a1c", bad: "#d1495b", gold: "#ffd84d" };
  var FONT = "Fredoka, sans-serif", MONO = "'JetBrains Mono', ui-monospace, monospace";
  var FRAME_COLORS = ["#ff8fab", "#74c0fc", "#ffd43b", "#8ce99a", "#b197fc", "#ffa94d"];

  /* ================================================================ small helpers */
  function font(px, w) { return (w || 700) + " " + px + "px " + FONT; }
  function mono(px, w) { return (w || 600) + " " + px + "px " + MONO; }
  function txt(ctx, s, x, y, px, color, align, f) {
    ctx.font = f || font(px); ctx.fillStyle = color || INK; ctx.textAlign = align || "center"; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
  }
  /** Rounded label centred at x,y. Returns its width. */
  function pill(ctx, s, x, y, px, bg, fg, isMono) {
    ctx.font = isMono ? mono(px) : font(px);
    var w = ctx.measureText(s).width + px * 1.2, h = px * 1.75;
    ctx.fillStyle = bg || "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    u.rr(ctx, x - w / 2, y - h / 2, w, h, h / 2.4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = fg || INK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s, x, y + 1);
    return w;
  }
  function pathLen(p) { var s = 0; for (var i = 1; i < p.length; i++) s += u.dist(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y); return s; }
  /** Point at fraction k (0..1, by length) along a polyline. */
  function pathAt(p, k) {
    var d = u.clamp(k, 0, 1) * pathLen(p);
    for (var i = 1; i < p.length; i++) {
      var a = p[i - 1], b = p[i], s = u.dist(a.x, a.y, b.x, b.y);
      if (d <= s || i === p.length - 1) { var f = s ? Math.min(1, d / s) : 0; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
      d -= s;
    }
    return p[p.length - 1];
  }
  function lerpPt(a, b, k, arc) { return { x: u.lerp(a.x, b.x, k), y: u.lerp(a.y, b.y, k) - Math.sin(k * Math.PI) * (arc || 0) }; }
  var imgs = {};
  /** Character portrait as a canvas image (from the shared SVG cartoons). */
  function charImg(who, mood) {
    var k = who + (mood || "");
    if (!imgs[k]) { var im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg(who, { mood: mood || "happy", size: 240 })); imgs[k] = im; }
    return imgs[k];
  }
  function drawImg(ctx, im, x, y, w, h) { if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x, y, w, h); }
  var FALLBACK = null;
  function fallbackPic() {
    if (FALLBACK) return FALLBACK;
    var c = document.createElement("canvas"); c.width = c.height = 320; var x = c.getContext("2d"), r = u.seeded("packet-post");
    x.fillStyle = "#2f7d3a"; x.fillRect(0, 0, 320, 320);
    for (var i = 0; i < 260; i++) { x.fillStyle = r() < .5 ? "#3f9b4a" : "#25602d"; x.beginPath(); x.arc(r() * 320, r() * 320, 6 + r() * 14, 0, 7); x.fill(); }
    x.fillStyle = "#c9a26b"; x.beginPath(); x.ellipse(200, 140, 70, 46, .4, 0, 7); x.fill();
    x.strokeStyle = "#6fb3d9"; x.lineWidth = 12; x.beginPath(); x.moveTo(0, 260); x.bezierCurveTo(100, 230, 200, 300, 320, 250); x.stroke();
    FALLBACK = c; return c;
  }
  /** The player's My Site picture (thumb or rgb). Falls back to a drawn forest if it cannot load. */
  function sitePic(file) {
    var site = RQ.mySite ? RQ.mySite() : null, im = new Image();
    var rec = { ok: false, name: site ? String(site.name).split(",")[0] : "My Site" };
    im.onload = function () { rec.ok = true; };
    if (site && site.files && site.files[file]) im.src = RQ.url(site.files[file]);
    rec.src = function () { return rec.ok ? im : fallbackPic(); };
    rec.size = function () { var s = rec.src(); return { w: s.naturalWidth || s.width, h: s.naturalHeight || s.height }; };
    return rec;
  }
  /** Draw piece (c,r) of a cols×rows cut of the picture into x,y,w,h (centre crop to the grid's shape). */
  function drawPiece(ctx, pic, cols, rows, c, r, x, y, w, h) {
    var s = pic.size(), sw = s.w, sh = s.w * rows / cols;
    if (sh > s.h) { sh = s.h; sw = s.h * cols / rows; }
    var x0 = (s.w - sw) / 2, y0 = (s.h - sh) / 2;
    try { ctx.drawImage(pic.src(), x0 + c * sw / cols, y0 + r * sh / rows, sw / cols, sh / rows, x, y, w, h); } catch (e) { /* image not ready */ }
  }

  /* ================================================================ drawing kit */
  function cloud(ctx, x, y, s, col) {
    ctx.fillStyle = col || "rgba(255,255,255,.92)";
    ctx.beginPath(); ctx.arc(x, y, 24 * s, 0, 7); ctx.arc(x + 28 * s, y - 12 * s, 30 * s, 0, 7); ctx.arc(x + 60 * s, y, 22 * s, 0, 7); ctx.fill();
  }
  function hills(ctx, W, H, base, amp, wl, ph, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    for (var x = 0; x <= W + 40; x += 40) ctx.lineTo(x, base - amp - Math.sin(x / wl + ph) * amp);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  /** Warm "See island" sky, sun, clouds and hills. */
  function backdrop(ctx, W, H, t, o) {
    o = o || {};
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, o.top || "#ffd9a0"); g.addColorStop(.6, o.mid || "#fff1d6"); g.addColorStop(1, "#fffaf0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W - 90, 70); ctx.rotate(t * .12); ctx.fillStyle = "rgba(255,200,60,.35)";
    for (var i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillRect(36, -4, 22, 8); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(W - 90, 70, 30, 0, 7); ctx.fillStyle = "#ffd84d"; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    for (var c = 0; c < 4; c++) cloud(ctx, ((c * 360 + t * (9 + c * 3)) % (W + 260)) - 130, 46 + c * 24, .8 + c * .08);
    if (o.noHills) return;
    hills(ctx, W, H, H - 120, 26, 170, 0, o.h1 || "#cbe7a8");
    hills(ctx, W, H, H - 70, 16, 110, 2, o.h2 || "#a9d98a");
    if (o.sea) {
      var sx = o.sea[0], ex = o.sea[1];
      ctx.fillStyle = "#6fb3e6"; u.rr(ctx, sx, H - 120, ex - sx, 140, 30); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 3;
      for (var wv = 0; wv < 5; wv++) {
        ctx.beginPath(); var yy = H - 100 + wv * 22;
        for (var x = sx + 20; x < ex - 20; x += 8) ctx.lineTo(x, yy + Math.sin(x / 18 + t * 2 + wv) * 3);
        ctx.stroke();
      }
    }
  }
  /** A friendly router: wiggly antennas, blinking lights, eyes that follow a parcel. busy 0..1 = how excited. */
  function router(ctx, x, y, t, o) {
    o = o || {}; var busy = u.clamp(o.busy || 0, 0, 1), ph = o.ph || 0;
    ctx.save(); ctx.translate(x, y + Math.sin(t * 2 + ph) * 1.5);
    if (busy > .05) { ctx.beginPath(); ctx.arc(0, -2, 44 + busy * 8, 0, 7); ctx.fillStyle = "rgba(255,214,77," + (.5 * busy) + ")"; ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineCap = "round";
    [-1, 1].forEach(function (s) {
      ctx.save(); ctx.translate(s * 22, -16); ctx.rotate(s * .3 + Math.sin(t * (4 + busy * 14) + ph + s) * (.08 + busy * .3));
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -28); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -31, 5, 0, 7); ctx.fillStyle = busy > .3 ? C.gold : "#ff8fa3"; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    });
    ctx.fillStyle = o.color || "#5b7fa6"; ctx.lineWidth = 3.5; u.rr(ctx, -36, -18, 72, 38, 12); ctx.fill(); ctx.stroke();
    var lx = o.lookX != null ? u.clamp((o.lookX - x) / 160, -1, 1) * 3 : Math.sin(t * .7 + ph) * 2;
    [-12, 12].forEach(function (ex) {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, -5, 7, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + lx, -5, 3.2, 0, 7); ctx.fill();
    });
    for (var i = 0; i < 4; i++) {
      var on = Math.sin(t * (6 + i * 1.7) * (1 + busy) + ph * 3 + i) > (busy > .2 ? -.5 : .3);
      ctx.fillStyle = on ? (i === 2 ? C.gold : "#5cf08a") : "#2c3e50"; ctx.beginPath(); ctx.arc(-18 + i * 12, 10, 3.2, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  /** Cardboard parcel. o: {label, pic(ctx,x,y,w,h), color, rot, tag} */
  function parcel(ctx, x, y, s, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s || 1, s || 1);
    var w = 54, h = 46;
    ctx.fillStyle = o.color || "#e0a96d"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill(); ctx.stroke();
    if (o.pic) {
      ctx.save(); u.rr(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 4); ctx.clip(); o.pic(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10); ctx.restore();
      ctx.strokeStyle = "rgba(29,43,58,.55)"; ctx.lineWidth = 2; u.rr(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 4); ctx.stroke();
    } else { ctx.fillStyle = "#c98d4e"; ctx.fillRect(-5, -h / 2 + 1.5, 10, h - 3); }
    if (o.label != null) {
      ctx.font = font(20); var tw = Math.max(30, ctx.measureText(o.label).width + 14);
      ctx.fillStyle = o.tag || "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; u.rr(ctx, -tw / 2, -h / 2 - 17, tw, 26, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(o.label, 0, -h / 2 - 3);
    }
    ctx.restore();
  }
  /** Handshake envelope: SYN (blue), SYN-ACK (purple), ACK (green). */
  function envelope(ctx, x, y, kind) {
    var col = { "SYN": C.syn, "SYN-ACK": C.synack, "ACK": C.ack }[kind], w = kind === "SYN-ACK" ? 128 : 96, h = 56;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; u.rr(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w / 2 + 5, -h / 2 + 5); ctx.lineTo(0, 2); ctx.lineTo(w / 2 - 5, -h / 2 + 5); ctx.strokeStyle = "rgba(29,43,58,.35)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = col; u.rr(ctx, -w / 2 + 7, 0, w - 14, 24, 8); ctx.fill();
    txt(ctx, kind, 0, 12, 19, "#fff");
    ctx.restore();
  }
  function laptop(ctx, x, y, t, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#cfd8e3"; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, -82, -118, 164, 112, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#163049"; u.rr(ctx, -72, -108, 144, 92, 6); ctx.fill();
    ctx.fillStyle = "#e9eef5"; ctx.fillRect(-72, -108, 144, 14);
    ["#ff5f56", "#ffbd2e", "#27c93f"].forEach(function (c, i) { ctx.beginPath(); ctx.arc(-63 + i * 9, -101, 2.8, 0, 7); ctx.fillStyle = c; ctx.fill(); });
    if (o.page) {
      ctx.fillStyle = "#eaf6ec"; ctx.fillRect(-72, -94, 144, 78);
      ctx.fillStyle = "#2f9e4f"; ctx.fillRect(-72, -94, 144, 18); txt(ctx, "ReSeed", 0, -85, 13, "#fff");
      ctx.fillStyle = "#9fd486"; ctx.beginPath(); ctx.arc(-38, -50, 18, 0, 7); ctx.fill();
      ctx.fillStyle = "#c5d3e0"; for (var i = 0; i < 4; i++) ctx.fillRect(-12, -66 + i * 11, 70 - i * 10, 6);
    } else if (o.spin) {
      ctx.strokeStyle = "#79c0ff"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, -55, 16, t * 6, t * 6 + 4.2); ctx.stroke();
    }
    if (o.label) txt(ctx, o.label, 0, -55, 15, "#fff");
    ctx.fillStyle = "#aab7c6"; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, -104, -6, 208, 16, 6); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function serverRack(ctx, x, y, t, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); var hop = o.hop ? Math.sin(Math.min(1, o.hop) * Math.PI) * 8 : 0; ctx.translate(0, -hop);
    ctx.fillStyle = o.color || "#3b4a5e"; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, -62, -196, 124, 196, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; [-20, 20].forEach(function (ex) { ctx.beginPath(); ctx.arc(ex, -172, 9, 0, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); });
    ctx.fillStyle = INK; [-20, 20].forEach(function (ex) { ctx.beginPath(); ctx.arc(ex + Math.sin(t) * 3, -171, 4, 0, 7); ctx.fill(); });
    for (var i = 0; i < 4; i++) {
      var yy = -150 + i * 36; ctx.fillStyle = "#56677d"; u.rr(ctx, -50, yy, 100, 28, 6); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      for (var j = 0; j < 3; j++) {
        var on = Math.sin(t * (4 + i + j * 2.3) + i * 7 + j) > -.2;
        ctx.fillStyle = on ? (j === 2 ? C.gold : "#5cf08a") : "#26323f"; ctx.beginPath(); ctx.arc(-36 + j * 12, yy + 14, 4, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "#2a3646"; ctx.fillRect(6, yy + 10, 36, 8);
    }
    ctx.restore();
  }
  function drone(ctx, x, y, t, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.rotate(Math.sin(t * 1.7) * .05);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-64, -8); ctx.lineTo(64, -8); ctx.stroke();
    [-64, 64].forEach(function (ax, i) {
      ctx.fillStyle = "#3b4a5e"; ctx.fillRect(ax - 5, -22, 10, 14);
      var sp = Math.abs(Math.sin(t * 38 + i)); ctx.fillStyle = "rgba(210,228,245,.85)";
      ctx.beginPath(); ctx.ellipse(ax, -24, 36 * (.25 + .75 * sp), 5, 0, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.lineWidth = 4; ctx.fillStyle = "#4cbb5a"; u.rr(ctx, -32, -20, 64, 30, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-10, -6, 6, 0, 7); ctx.arc(10, -6, 6, 0, 7); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-9, -6, 3, 0, 7); ctx.arc(11, -6, 3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, -20); ctx.lineTo(26, -40); ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(26, -42, 4, 0, 7); ctx.fillStyle = Math.sin(t * 8) > 0 ? "#ff6b6b" : C.gold; ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 16, 9, 0, 7); ctx.fill(); ctx.fillStyle = "#79c0ff"; ctx.beginPath(); ctx.arc(2, 15, 4, 0, 7); ctx.fill();
    ctx.restore();
  }
  /** Particles and floating words. */
  function fxSystem() {
    var parts = [], words = [];
    return {
      burst: function (x, y, color, n, sp) {
        for (var i = 0; i < (n || 14); i++) {
          var a = Math.random() * 6.283, v = (sp || 220) * (.4 + Math.random() * .8);
          parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: .8, c: color || u.pick(["#ffd23f", "#2f9e4f", "#2b7bd0", "#ff8fab"]), r: u.rand(3, 6) });
        }
      },
      text: function (x, y, s, color, size) { words.push({ x: x, y: y, s: s, c: color || C.ack, life: 1.2, size: size || 30 }); },
      draw: function (ctx, dt) {
        parts = parts.filter(function (p) {
          p.life -= dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.globalAlpha = Math.max(0, p.life / .8); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
          return p.life > 0;
        });
        words = words.filter(function (q) {
          q.life -= dt; q.y -= 36 * dt; ctx.globalAlpha = u.clamp(q.life / .4, 0, 1);
          ctx.font = font(q.size); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 7; ctx.strokeStyle = "#fff"; ctx.lineJoin = "round";
          ctx.strokeText(q.s, q.x, q.y); ctx.fillStyle = q.c; ctx.fillText(q.s, q.x, q.y);
          return q.life > 0;
        });
        ctx.globalAlpha = 1;
      }
    };
  }

  /* ================================================================ scene: canvas on top, control bar below */
  function scene(L, label, h, bg) {
    var root = u.el("div", { class: "fill pp-root" }), top = u.el("div", { class: "pp-top" }), bar = u.el("div", { class: "pp-bar" });
    bg = bg || ["#ffd9a0", "#a9d98a"];
    top.style.background = "linear-gradient(180deg, " + bg[0] + " 0 50%, " + bg[1] + " 50% 100%)";
    root.appendChild(top); root.appendChild(bar); L.stage.appendChild(root);
    var S = { L: L, top: top, bar: bar, fx: fxSystem(), keys: {}, anyKey: null, h: h || 600, jobs: [], t: 0 };
    S.cv = L.canvas({ w: 1280, h: S.h, parent: top, fill: true, label: label });
    S.ctx = S.cv.ctx;
    L.on(window, "keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (S.keys[k]) { e.preventDefault(); S.keys[k](); } else if (S.anyKey && S.anyKey(k, e)) e.preventDefault();
    });
    S.clearBar = function () { bar.innerHTML = ""; S.keys = {}; };
    /** Big button in the bar; keys = list of keyboard keys that press it. */
    S.btn = function (html, keys, fn, cls) {
      var b = u.el("button", { class: "btn " + (cls || ""), html: html });
      b.addEventListener("click", function () { if (L.alive && !L.paused && !b.disabled) fn(b); });
      (keys || []).forEach(function (k) {
        S.keys[k] = function () { if (b.disabled) return; b.classList.add("pressed"); setTimeout(function () { b.classList.remove("pressed"); }, 120); fn(b); };
      });
      bar.appendChild(b); return b;
    };
    S.note = function (html) { var n = u.el("div", { class: "pp-note", html: html }); bar.appendChild(n); return n; };
    S.onPointer = function (fn) { L.on(S.cv.cv, "pointerdown", function (e) { fn(S.cv.toLocal(e)); }); };
    S.onHover = function (fn) { L.on(S.cv.cv, "pointermove", function (e) { S.cv.cv.style.cursor = fn(S.cv.toLocal(e)) ? "pointer" : ""; }); };
    S.shake = function () { top.classList.remove("shake"); void top.offsetWidth; top.classList.add("shake"); };
    /** Game-time scheduler (pauses with the game). */
    S.later = function (sec, fn) { S.jobs.push({ at: S.t + sec, fn: fn }); };
    S.tick = function (dt) {
      S.t += dt;
      var due = S.jobs.filter(function (j) { return j.at <= S.t; });
      S.jobs = S.jobs.filter(function (j) { return j.at > S.t; });
      due.forEach(function (j) { if (L.alive) j.fn(); });
    };
    return S;
  }
  function starsBy(mistakes, three, two) { return mistakes <= three ? 3 : mistakes <= two ? 2 : 1; }

  function poly(ctx, p) { ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (var i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y); }
  /** Thick cartoon cable/road along a polyline, with flowing dashes. */
  function road(ctx, p, t, lit) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = INK; ctx.lineWidth = 16; poly(ctx, p); ctx.stroke();
    ctx.strokeStyle = lit ? "#ffd84d" : "#9aa8b8"; ctx.lineWidth = 10; poly(ctx, p); ctx.stroke();
    ctx.setLineDash([10, 14]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 3; poly(ctx, p); ctx.stroke(); ctx.setLineDash([]);
  }

  /* ================================================================ L1 — TCP handshake (rhythm catch) */
  var MEAN = { "SYN": "Can we talk?", "SYN-ACK": "Yes! Can you hear me?", "ACK": "Yes, I hear you!" };
  function levelHandshake(L) {
    var S = scene(L, "handshake road");
    var ROUNDS = [
      { name: "Server in the next town", hops: 1, role: "client" },
      { name: "Server across the country", hops: 3, role: "client" },
      { name: "Now YOU are the server!", hops: 2, role: "server" },
      { name: "A Glitch Bug is on the road!", hops: 2, role: "client", eat: true },
      { name: "Server across the ocean", hops: 4, role: "client", sea: true },
      { name: "Speed round!", hops: 1, role: "client", speed: 1.6 },
      { name: "Speed round: be the server!", hops: 1, role: "server", speed: 1.6 }
    ];
    var ri = -1, R = null, msgs = [], phase = "start", path = [], hubs = [], stream = [], bug = null, hold = false, at = 0;
    var pts = 0, maxPts = 0, mistakes = 0, perfect = 0, misses = 0, hinted = false, eatDone = false, connT = -9, bannerT = 0, waitUntil = 0, serverHop = 9;
    var catchAt = null, catcher = null, catchMsg = null;
    var B = {
      "SYN": S.btn('<b>1 · SYN</b><small>"Can we talk?"</small>', ["1", "s"], function () { press("SYN"); }, "pp-cmd pp-syn"),
      "SYN-ACK": S.btn('<b>2 · SYN-ACK</b><small>"Yes! Can you hear me?"</small>', ["2"], function () { press("SYN-ACK"); }, "pp-cmd pp-synack"),
      "ACK": S.btn('<b>3 · ACK</b><small>"Yes, I hear you!"</small>', ["3", "a"], function () { press("ACK"); }, "pp-cmd pp-ack")
    };
    function glow(kind) { for (var k in B) B[k].classList.toggle("pp-glow", k === kind); }
    function me() { return R.role === "client" ? "L" : "R"; }
    function travel() { return (0.6 + 0.42 * R.hops) / (R.speed || 1); }
    function geo() {
      var W = S.cv.w, a = { x: 300, y: 380 }, b = { x: W - 300, y: 380 };
      path = [a]; hubs = [];
      for (var i = 0; i < R.hops; i++) {
        var f = (i + 1) / (R.hops + 1), p = { x: u.lerp(a.x, b.x, f), y: 380 + (i % 2 ? 30 : -56) };
        path.push(p); hubs.push(p);
      }
      path.push(b);
    }
    function end(side) { return side === "L" ? path[0] : path[path.length - 1]; }
    function posOf(m) { var k = u.clamp((S.t - m.t0) / m.dur, 0, 1); return pathAt(path, m.from === "L" ? k : 1 - k); }
    function send(kind, from) {
      var m = { kind: kind, from: from, t0: S.t, dur: travel() };
      if (kind === "SYN" && R.eat && !eatDone) m.eatAt = .5;
      msgs.push(m); L.sfx("whoosh");
      var to = from === "L" ? "R" : "L";
      if (to === me() && kind !== "ACK" && !m.eatAt) { catchAt = S.t + m.dur; catcher = kind === "SYN" ? "SYN-ACK" : "ACK"; catchMsg = m; glow(catcher); }
      else glow(null);
      if (from === "R") serverHop = 0;
      return m;
    }
    function arrive(m) {
      if (m.kind === "SYN" && R.role === "client") S.later(.3, function () { send("SYN-ACK", "R"); });
      else if (m.kind === "SYN-ACK" && R.role === "server") S.later(.3, function () { send("ACK", "L"); });
      else if (m.kind === "ACK") connected();
    }
    function eat(m) {
      eatDone = true; msgs.splice(msgs.indexOf(m), 1);
      var p = posOf(m); bug = { x: p.x, y: p.y, t0: S.t };
      L.sfx("giggle"); S.fx.text(p.x, p.y - 80, "Chomp!", "#9b4dca", 32);
      phase = "timeout"; waitUntil = S.t + 2.6; glow(null);
    }
    function showHint() {
      if (hinted) return; hinted = true; hold = true;
      L.hint("Watch the shrinking ring. Press the glowing button when the ring hugs the envelope!", "tuki").then(function () { hold = false; });
    }
    function missed() {
      misses++; maxPts += 3;
      var p = end(me()); S.fx.text(p.x, p.y - 84, "Missed!", C.bad, 32); L.sfx("bad");
      msgs.splice(msgs.indexOf(catchMsg), 1); catchAt = null; catchMsg = null; glow(null);
      L.toast(R.role === "client" ? "No **ACK**, so the server sends its **SYN-ACK** again." : "No **SYN-ACK**, so the laptop sends its **SYN** again.", "info", 2400);
      S.later(.8, function () { if (R.role === "client") send("SYN-ACK", "R"); else send("SYN", "L"); });
      if (misses >= 2) showHint();
    }
    function wrong(kind) {
      mistakes++; L.sfx("error"); S.shake();
      var msg;
      if (R.role === "client") {
        if (kind === "SYN-ACK") msg = "**SYN-ACK** is the server's line. You are the laptop!";
        else if (kind === "ACK") msg = phase === "await-syn" ? "Say **SYN** first: \"Can we talk?\"" : "Wait until the **SYN-ACK** reaches your ring!";
        else msg = "You already sent **SYN**. Wait for the answer.";
      } else {
        if (kind === "SYN") msg = "**SYN** comes from the laptop. You answer with **SYN-ACK**.";
        else if (kind === "ACK") msg = "**ACK** comes from the laptop. You answer with **SYN-ACK**.";
        else msg = "Wait until the **SYN** reaches your ring!";
      }
      L.toast(msg, "bad", 2400);
    }
    function press(kind) {
      if (!R || hold || phase === "done" || phase === "conn") return;
      if (catchAt != null) {
        if (kind !== catcher) return wrong(kind);
        var d = S.t - catchAt, p = end(me());
        if (d < -.45) { mistakes++; L.sfx("error"); S.shake(); S.fx.text(p.x, p.y - 84, "Too early!", C.bad, 30); return; }
        var ad = Math.abs(d), r = ad <= .13 ? 3 : ad <= .27 ? 2 : 1;
        pts += r; maxPts += 3; if (r === 3) perfect++;
        S.fx.text(p.x, p.y - 88, ["Good!", "Great!", "Perfect!"][r - 1], r === 3 ? C.ack : C.amber, 34); S.fx.burst(p.x, p.y, null, 8 + r * 6);
        L.sfx(r === 3 ? "coin" : "pop");
        msgs.splice(msgs.indexOf(catchMsg), 1); catchAt = null; catchMsg = null;
        send(kind, me());
        return;
      }
      if ((phase === "await-syn" || phase === "timeout") && R.role === "client" && kind === "SYN") { phase = "fly"; send("SYN", "L"); return; }
      wrong(kind);
    }
    function connected() {
      phase = "conn"; connT = S.t; glow(null); L.sfx("good");
      var mid = pathAt(path, .5); S.fx.burst(mid.x, mid.y - 60, null, 30, 300);
      stream = []; for (var i = 0; i < 10; i++) stream.push({ t0: S.t + .35 + i * .09, dur: .75, c: FRAME_COLORS[i % FRAME_COLORS.length] });
      S.later(2.2, nextRound);
    }
    function nextRound() {
      if (ri + 1 >= ROUNDS.length) return finish();
      ri++;
      R = ROUNDS[ri]; msgs = []; catchAt = null; catchMsg = null; eatDone = false; bug = null; stream = []; bannerT = S.t;
      L.hud.set("round", "🤝 " + (ri + 1) + " / " + ROUNDS.length);
      geo();
      if (R.role === "client") { phase = "await-syn"; glow("SYN"); }
      else { phase = "fly"; glow(null); S.later(1.2, function () { send("SYN", "L"); }); }
      if (ri === 2) L.toast("Swap! You are the server now. Catch the **SYN** with **SYN-ACK**.", "info", 3200);
    }
    function finish() {
      phase = "done"; glow(null);
      var score = (pts - mistakes) / Math.max(1, maxPts), stars = score >= .72 ? 3 : score >= .42 ? 2 : 1;
      L.timeout(function () {
        L.win({ stars: stars, msg: "Seven handshakes! **SYN**, **SYN-ACK**, **ACK**: that is how every TCP connection starts.",
          stats: { "Perfect catches": perfect, "Misses": misses, "Wrong buttons": mistakes } });
      }, 500);
    }
    function draw(dt) {
      geo();
      var ctx = S.ctx, W = S.cv.w, H = S.h, t = at, a = path[0], b = path[path.length - 1];
      backdrop(ctx, W, H, t, R.sea ? { sea: [a.x + 60, b.x - 60] } : null);
      var tukiX = ((t * 70 + 420) % (W + 260)) - 130;
      drawImg(ctx, charImg("tuki"), tukiX - 40, 200 + Math.sin(t * 2.2) * 18, 80, 80);
      if (R.sea) txt(ctx, "under-sea cable", W / 2, H - 30, 18, "#fff");
      road(ctx, [{ x: 236, y: 452 }, a], t, phase === "conn"); road(ctx, [b, { x: W - 222, y: 420 }], t, phase === "conn");
      road(ctx, path, t, phase === "conn");
      var lookX = msgs.length ? posOf(msgs[0]).x : null;
      hubs.forEach(function (p, i) {
        var busy = 0; msgs.forEach(function (m) { var q = posOf(m); busy = Math.max(busy, 1 - u.dist(q.x, q.y, p.x, p.y) / 110); });
        router(ctx, p.x, p.y - 30, t, { busy: busy, ph: i * 1.3, lookX: lookX });
      });
      laptop(ctx, 150, 470, t, { page: phase === "conn" && S.t - connT > .9, spin: phase === "fly" || phase === "timeout" });
      serverHop += dt * 3; serverRack(ctx, W - 160, 480, t, { hop: serverHop, color: R.role === "server" ? "#5a4a9e" : "#3b4a5e" });
      pill(ctx, me() === "L" ? "You: the laptop" : "Visitor's laptop", 150, 512, 19, me() === "L" ? "#fff3c4" : "#fff");
      pill(ctx, me() === "R" ? "You: the server" : "Server", W - 160, 518, 19, me() === "R" ? "#fff3c4" : "#fff");
      // catch ring + approach ring
      var cp = end(me());
      ctx.setLineDash([8, 8]); ctx.lineDashOffset = t * 20; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cp.x, cp.y - 30, 48, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      if (catchAt != null) {
        var dk = catchAt - S.t, rr = 48 + u.clamp(dk, 0, 1.3) * 120, near = Math.abs(dk) <= .13;
        ctx.strokeStyle = dk < -.13 ? C.bad : near ? "#2fd06a" : C.amber; ctx.lineWidth = near ? 9 : 6;
        ctx.beginPath(); ctx.arc(cp.x, cp.y - 30, rr + (dk < 0 ? Math.sin(t * 30) * 3 : 0), 0, 7); ctx.stroke();
      }
      // envelopes
      msgs.forEach(function (m) {
        var p = posOf(m), k = (S.t - m.t0) / m.dur, y = p.y - 30 - Math.abs(Math.sin(k * Math.PI * (R.hops + 1))) * 14;
        if (k > 1) y += Math.sin(t * 20) * 3;
        envelope(ctx, p.x, y, m.kind);
        pill(ctx, MEAN[m.kind], p.x, y + 48, 15, "rgba(255,255,255,.92)");
      });
      // data stream after connecting (the website travels to the laptop)
      stream.forEach(function (s) {
        var k = (S.t - s.t0) / s.dur; if (k < 0 || k > 1) return;
        var p = pathAt(path, 1 - k); ctx.fillStyle = s.c; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; u.rr(ctx, p.x - 9, p.y - 39, 18, 18, 4); ctx.fill(); ctx.stroke();
      });
      if (bug) {
        var bk = S.t - bug.t0;
        if (bk < 2.6) { var bx = bug.x + bk * 110, by = bug.y - 50 - bk * 150; drawImg(ctx, charImg("bug"), bx - 36, by - 36 + Math.sin(t * 18) * 3, 72, 72); envelope(ctx, bx + 30, by + 26, "SYN"); }
      }
      if (phase === "timeout") {
        var cx = 150, cy = 300, k2 = 1 - (waitUntil - S.t) / 2.6;
        ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(209,73,91,.35)"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + k2 * 6.283); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(k2 * 6.283 - 1.57) * 18, cy + Math.sin(k2 * 6.283 - 1.57) * 18); ctx.stroke();
      }
      if (phase === "conn") {
        var ck = S.t - connT, mid = pathAt(path, .5);
        ctx.save(); ctx.translate(mid.x, 190); var sc = u.ease.outBack(Math.min(1, ck * 2.5)); ctx.scale(sc, sc);
        pill(ctx, "CONNECTED!", 0, 0, 34, "#d9f7df", C.ack);
        txt(ctx, "🤝", 0, -62 + Math.sin(t * 14) * 4, 52);
        ctx.restore();
      }
      // banner + instruction
      var bs = u.ease.outBack(Math.min(1, (S.t - bannerT) * 3 + .01));
      ctx.save(); ctx.translate(W / 2, 38); ctx.scale(bs, bs); pill(ctx, "Round " + (ri + 1) + " / " + ROUNDS.length + " · " + R.name, 0, 0, 24, "#fff7e0"); ctx.restore();
      var ins = phase === "await-syn" ? "Press SYN to say hello!" : catchAt != null ? "Press " + catcher + " when the ring hugs the envelope!"
        : phase === "timeout" ? "Waiting for an answer…" : phase === "conn" ? "Connected! Now the website can travel." : R.role === "server" ? "A laptop wants to talk to you…" : "Your envelope is on its way…";
      txt(ctx, ins, W / 2, 88, 22, INK);
      S.fx.draw(ctx, dt);
    }
    nextRound();
    if (L.fails >= 1) showHint();
    L.loop(function (dt) {
      at += dt;
      if (!hold) {
        S.tick(dt);
        msgs.slice().forEach(function (m) {
          var k = (S.t - m.t0) / m.dur;
          if (m.eatAt && k >= m.eatAt) return eat(m);
          if (k >= 1 && m !== catchMsg) { msgs.splice(msgs.indexOf(m), 1); arrive(m); }
        });
        if (catchAt != null && S.t > catchAt + .45) missed();
        if (phase === "timeout" && S.t >= waitUntil) { phase = "await-syn"; glow("SYN"); L.toast("No answer: **timeout**! Send **SYN** again.", "info", 2600); }
      }
      draw(dt);
    });
  }

  /* ================================================================ L2 — number the parcels, routers, a lost packet, resend, rebuild */
  function levelParcels(L) {
    var S = scene(L, "packet post network");
    var PICS = [sitePic("thumb"), sitePic("rgb")];
    var ROUNDS = [{ cols: 3, rows: 3, pic: 0, lose: 1, manual: true }, { cols: 4, rows: 3, pic: 1, lose: 2, manual: false }];
    var round = -1, cfg = null, pic = null, pieces = [], tray = [], phase = "", stampIdx = 0, sendIdx = 0, found = [], need = 1, hold = false, at = 0;
    var mistakes = 0, hinted = false, hinted2 = false, orderSlips = 0, bugs = [], notes = [], numBtns = {}, buf = "", bufTimer = null;
    var msgLine = "", nextLaunch = 0, nextStamp = 0, stampBtn = null, needEl = null;
    function N() { return cfg.cols * cfg.rows; }
    function geo() {
      var W = S.cv.w, cell = cfg.cols === 3 ? 88 : 76, bw = cfg.cols * cell, bh = cfg.rows * cell;
      var g = { W: W, cell: cell, bw: bw, bh: bh, src: { x: 40, y: 128 }, dst: { x: W - 40 - bw, y: 128 } };
      g.out = { x: g.src.x + bw + 34, y: g.src.y + bh / 2 }; g.inn = { x: g.dst.x - 34, y: g.out.y };
      var span = g.inn.x - g.out.x;
      g.rA = [0, 1, 2].map(function (i) { return { x: g.out.x + span * .3, y: 170 + i * 104 }; });
      g.rB = [0, 1, 2].map(function (i) { return { x: g.out.x + span * .7, y: 170 + i * 104 }; });
      g.slot = N() > 9 ? 54 : 64;
      g.tray = { x: W / 2 - N() * g.slot / 2, y: 512, w: N() * g.slot };
      return g;
    }
    function homeXY(p, g) { return { x: g.src.x + p.c * g.cell + g.cell / 2, y: g.src.y + p.r * g.cell + g.cell / 2 }; }
    function cellXY(p, g) { return { x: g.dst.x + p.c * g.cell + g.cell / 2, y: g.dst.y + p.r * g.cell + g.cell / 2 }; }
    function slotXY(i, g) { return { x: g.tray.x + i * g.slot + g.slot / 2, y: g.tray.y }; }
    function routeOf(p, g) { return [homeXY(p, g), g.out, g.rA[p.ra], g.rB[p.rb], g.inn]; }
    function piecePos(p, g) {
      if (p.state === "fly") { var rt = routeOf(p, g); return pathAt(rt, (S.t - p.t0) * p.v / pathLen(rt)); }
      if (p.state === "drop") return lerpPt(g.inn, slotXY(p.slot, g), u.ease.outCubic(u.clamp((S.t - p.t0) / .4, 0, 1)), 50);
      if (p.state === "tray") return slotXY(p.slot, g);
      if (p.state === "place") return lerpPt(slotXY(p.slot, g), cellXY(p, g), u.ease.inOut(u.clamp((S.t - p.t0) / .45, 0, 1)), 90);
      return null;
    }
    function faceOf(p) { return function (ctx, x, y, w, h) { drawPiece(ctx, pic, cfg.cols, cfg.rows, p.c, p.r, x, y, w, h); }; }
    function digitKey(fn) {
      return function (k) {
        if (!/^[0-9]$/.test(k)) return false;
        buf += k; if (bufTimer) { clearTimeout(bufTimer); bufTimer = null; }
        var n = parseInt(buf, 10);
        if (buf.length === 1 && n > 0 && n * 10 <= N()) bufTimer = L.timeout(function () { var v = parseInt(buf, 10); buf = ""; bufTimer = null; fn(v); }, 700);
        else { buf = ""; if (n >= 1 && n <= N()) fn(n); }
        return true;
      };
    }
    function startRound(i) {
      round = i; cfg = ROUNDS[i]; pic = PICS[cfg.pic]; pieces = []; tray = []; found = []; bugs = []; notes = []; need = 1; S.anyKey = null; stampIdx = 0;
      for (var r = 0; r < cfg.rows; r++) for (var c = 0; c < cfg.cols; c++) pieces.push({ n: pieces.length + 1, c: c, r: r, state: "home", stamped: null });
      var n = N(), cand = [];
      for (var k = 2; k < n - 1; k++) cand.push(k);
      cand = u.shuffle(cand, L.rng);
      var bugR = u.shuffle([0, 1, 2], L.rng);
      cand.slice(0, cfg.lose).forEach(function (k, j) { pieces[k].doomed = true; pieces[k].bugR = bugR[j]; });
      var speeds = u.shuffle(pieces.map(function (p, j) { return 230 + j * (210 / n); }), L.rng);
      pieces.forEach(function (p, j) { p.v = speeds[j]; p.ra = Math.floor(L.rng() * 3); p.rb = p.doomed ? p.bugR : Math.floor(L.rng() * 3); });
      L.hud.set("round", "📦 Picture " + (i + 1) + " / 2");
      S.clearBar();
      if (cfg.manual) {
        phase = "stamp"; msgLine = "Stamp a number on every packet!";
        S.note("Number the packets in reading order: left to right, top to bottom. Click them, or press Enter.");
        stampBtn = S.btn("🏷️ Stamp #1 <kbd>Enter</kbd>", ["Enter"], stamp, "primary");
      } else {
        phase = "autostamp"; nextStamp = S.t + .4; msgLine = "Twelve packets! The stamping machine numbers them.";
        S.note("A bigger picture needs more packets. Watch for Glitch Bugs!");
      }
    }
    function stamp() {
      if (phase !== "stamp" && phase !== "autostamp") return;
      var p = pieces[stampIdx], q = homeXY(p, geo()); p.stamped = S.t; stampIdx++; L.sfx(phase === "stamp" ? "pop" : "tick"); S.fx.burst(q.x, q.y, null, 6);
      if (stampIdx < N()) { if (stampBtn && phase === "stamp") stampBtn.innerHTML = "🏷️ Stamp #" + (stampIdx + 1) + " <kbd>Enter</kbd>"; return; }
      if (phase === "stamp") {
        phase = "ready"; msgLine = "All numbered. Off they go!"; S.clearBar();
        S.note("Every packet has its number. Send them through the routers!");
        S.btn("📮 Send the parcels! <kbd>Enter</kbd>", ["Enter"], toSend, "go pp-glow");
      } else { phase = "wait"; S.later(.5, toSend); }
    }
    function toSend() {
      if (phase !== "ready" && phase !== "wait") return;
      phase = "send"; sendIdx = 0; nextLaunch = S.t + .15; msgLine = "The routers pass the parcels along…";
      S.clearBar(); S.note("Each parcel may take a different road, so they can arrive mixed up.");
    }
    function snatch(p, g) {
      p.state = "snatched"; var r = g.rB[p.rb];
      bugs.push({ p: p, rb: p.rb, t0: S.t }); L.sfx("giggle");
      S.fx.text(r.x, r.y - 86, "Hee hee!", "#9b4dca", 28);
    }
    function toMissing() {
      phase = "missing"; S.clearBar();
      msgLine = (N() - cfg.lose) + " of " + N() + " parcels arrived. " + (cfg.lose > 1 ? "Two are missing!" : "One is missing!");
      S.note(cfg.lose > 1 ? "Which <b>two</b> numbers are missing?" : "Which number is missing?");
      numBtns = {};
      for (var n = 1; n <= N(); n++) (function (n) { numBtns[n] = S.btn(String(n), [], function () { pickMissing(n); }, "pp-num"); })(n);
      S.anyKey = digitKey(pickMissing);
    }
    function pickMissing(n) {
      if ((phase !== "missing" && phase !== "resend") || hold || found.indexOf(n) >= 0) return;
      var p = pieces[n - 1];
      if (p.doomed) {
        found.push(n); numBtns[n].classList.add("ok"); numBtns[n].disabled = true; L.sfx("good");
        notes.push({ n: n, t0: S.t });
        S.later(1.0, function () { p.doomed = false; p.ra = 1; p.rb = 1; p.state = "fly"; p.t0 = S.t; p.v = 460; L.sfx("whoosh"); });
        phase = "resend";
        msgLine = found.length === cfg.lose ? "Resend #" + n + " please! Here it comes…" : "Found #" + n + "! One more is missing.";
      } else {
        mistakes++; L.sfx("error"); S.shake(); p.flash = S.t;
        numBtns[n].classList.add("no"); L.timeout(function () { numBtns[n].classList.remove("no"); }, 600);
        L.toast("**#" + n + "** is already in the tray. Look again!", "bad", 2000);
        if (!hinted) { hinted = true; hold = true; L.hint("Count along the tray: 1, 2, 3… The number you cannot find is the missing one.", "hoot").then(function () { hold = false; }); }
      }
    }
    function toAssemble() {
      phase = "assemble"; need = 1; S.clearBar(); msgLine = "All here! Rebuild the picture.";
      S.note("Click the parcels in order <b>1, 2, 3…</b> or type the number.");
      needEl = S.note(""); showNeed();
      S.anyKey = digitKey(pickParcel);
    }
    function showNeed() { if (needEl) needEl.innerHTML = '<span class="chip">Next: #' + need + "</span>"; }
    function place(p) { p.state = "place"; p.t0 = S.t; L.sfx("whoosh"); }
    function pickParcel(n) {
      if (phase !== "assemble" || hold) return;
      var p = pieces[n - 1];
      if (!p || p.state !== "tray") return;
      if (n === need) { place(p); need++; showNeed(); return; }
      mistakes++; orderSlips++; L.sfx("error"); p.flash = S.t;
      L.toast("That's **#" + n + "**. We need **#" + need + "** next!", "bad", 1800);
      if (orderSlips >= 2 && !hinted2) { hinted2 = true; hold = true; L.hint("Find the smallest number in the tray first, then the next one up.", "hoot").then(function () { hold = false; }); }
    }
    function roundDone() {
      phase = "done"; L.sfx("bloom");
      var g = geo(); for (var i = 0; i < 4; i++) S.fx.burst(g.dst.x + g.bw * Math.random(), g.dst.y + g.bh * Math.random(), null, 12);
      msgLine = "The picture arrived perfectly!"; S.clearBar(); S.note("🎉 Every packet is home, in the right order.");
      if (round === 0) S.later(1.6, function () {
        hold = true;
        L.say("hoot", "Hoo, a perfect picture! Now a bigger one: twelve packets, and two Glitch Bugs on the road!").then(function () { if (!L.alive) return; hold = false; startRound(1); });
      });
      else S.later(1.4, function () {
        L.win({ stars: starsBy(mistakes, 1, 3), msg: "Numbers, resends and sorting: that's **TCP**. Your forest picture arrived complete!", stats: { "Mistakes": mistakes } });
      });
    }
    function hitHome(q, g) {
      for (var i = 0; i < pieces.length; i++) { var c = homeXY(pieces[i], g); if (Math.abs(q.x - c.x) < g.cell / 2 && Math.abs(q.y - c.y) < g.cell / 2) return pieces[i]; }
      return null;
    }
    function hitTray(q, g) {
      for (var i = 0; i < pieces.length; i++) {
        var p = pieces[i]; if (p.state !== "tray") continue;
        var c = slotXY(p.slot, g); if (Math.abs(q.x - c.x) < g.slot / 2 && q.y > c.y - 48 && q.y < c.y + 30) return p;
      }
      return null;
    }
    S.onPointer(function (q) {
      if (hold) return;
      var g = geo();
      if (phase === "stamp") {
        var p = hitHome(q, g);
        if (!p || p.stamped != null) return;
        if (p === pieces[stampIdx]) stamp();
        else { p.flash = S.t; L.sfx("tick"); L.toast("Like reading a book: left to right, top to bottom. Next is the glowing one!", "info", 2200); }
      } else if (phase === "assemble") { var t2 = hitTray(q, g); if (t2) pickParcel(t2.n); }
    });
    S.onHover(function (q) { var g = geo(); return phase === "stamp" ? !!hitHome(q, g) : phase === "assemble" ? !!hitTray(q, g) : false; });

    function update(g) {
      if (phase === "autostamp" && S.t >= nextStamp) { stamp(); nextStamp = S.t + .09; }
      if (phase === "send" && sendIdx < N() && S.t >= nextLaunch) { var lp = pieces[sendIdx++]; lp.state = "fly"; lp.t0 = S.t; nextLaunch = S.t + .3; L.sfx("whoosh"); }
      pieces.forEach(function (p) {
        if (p.state === "fly") {
          var rt = routeOf(p, g), d = (S.t - p.t0) * p.v;
          if (p.doomed && d >= pathLen(rt.slice(0, 4))) snatch(p, g);
          else if (d >= pathLen(rt)) { p.state = "drop"; p.t0 = S.t; p.slot = tray.length; tray.push(p); L.sfx("drop"); }
        } else if (p.state === "drop" && S.t - p.t0 >= .4) p.state = "tray";
        else if (p.state === "place" && S.t - p.t0 >= .45) { p.state = "frame"; L.sfx("pop"); var q = cellXY(p, g); S.fx.burst(q.x, q.y, null, 8); }
      });
      bugs = bugs.filter(function (b) { if (S.t - b.t0 > 2.4) { b.p.state = "lost"; return false; } return true; });
      var busy = pieces.some(function (p) { return p.state === "fly" || p.state === "drop" || p.state === "snatched" || p.state === "place"; });
      if (phase === "send" && sendIdx >= N() && !busy && !bugs.length) toMissing();
      if (phase === "resend" && found.length === cfg.lose && !busy && pieces.every(function (p) { return p.state === "tray"; })) {
        if (cfg.manual) toAssemble();
        else { phase = "sort"; msgLine = "TCP sorts them for you: 1, 2, 3…"; S.clearBar(); S.note("Real TCP does this sorting by itself!"); nextStamp = S.t + .3; }
      }
      if (phase === "sort" && S.t >= nextStamp) {
        var nx = pieces.filter(function (p) { return p.state === "tray"; })[0];
        if (nx) { place(nx); nextStamp = S.t + .14; }
      }
      if ((phase === "assemble" || phase === "sort") && pieces.every(function (p) { return p.state === "frame"; })) roundDone();
    }
    function thinRoad(ctx, a, b, t) {
      ctx.lineCap = "round"; ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = "#b6c2cf"; ctx.lineWidth = 5; ctx.stroke();
      ctx.setLineDash([6, 10]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }
    function frameBox(ctx, x, y, w, h, col) {
      ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, x - 12, y - 12, w + 24, h + 24, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f6f1e3"; ctx.fillRect(x, y, w, h);
    }
    function draw(dt, g) {
      var ctx = S.ctx, W = g.W, H = S.h, t = at;
      backdrop(ctx, W, H, t, { h1: "#d9ecc0", h2: "#c3e3a6" });
      g.rA.forEach(function (a) { thinRoad(ctx, g.out, a, t); g.rB.forEach(function (b) { thinRoad(ctx, a, b, t); }); });
      g.rB.forEach(function (b) { thinRoad(ctx, b, g.inn, t); });
      var flying = pieces.filter(function (p) { return p.state === "fly"; }).map(function (p) { return piecePos(p, g); });
      g.rA.concat(g.rB).forEach(function (r, i) {
        var busy = 0, lx = null;
        flying.forEach(function (q) { var b = 1 - u.dist(q.x, q.y, r.x, r.y) / 100; if (b > busy) { busy = b; lx = q.x; } });
        router(ctx, r.x, r.y, t, { busy: busy, ph: i * 1.1, lookX: lx });
      });
      // sender picture (pieces at home) and receiver frame
      frameBox(ctx, g.src.x, g.src.y, g.bw, g.bh, "#e9c46a");
      frameBox(ctx, g.dst.x, g.dst.y, g.bw, g.bh, "#b197fc");
      pieces.forEach(function (p) {
        var h = homeXY(p, g), x = h.x - g.cell / 2, y = h.y - g.cell / 2, wob = p.flash && S.t - p.flash < .5 ? Math.sin(S.t * 40) * 3 : 0;
        ctx.globalAlpha = p.state === "home" ? 1 : .22; drawPiece(ctx, pic, cfg.cols, cfg.rows, p.c, p.r, x + 2 + wob, y + 2, g.cell - 4, g.cell - 4); ctx.globalAlpha = 1;
        if (phase === "stamp" && p === pieces[stampIdx]) {
          ctx.strokeStyle = C.gold; ctx.lineWidth = 5 + Math.sin(t * 8) * 2; ctx.strokeRect(x + 3, y + 3, g.cell - 6, g.cell - 6);
        }
        if (p.stamped != null && p.state === "home") {
          var s = u.ease.outBack(u.clamp((S.t - p.stamped) * 4, 0, 1));
          ctx.save(); ctx.translate(x + 20, y + 18); ctx.scale(s, s); pill(ctx, String(p.n), 0, 0, 18, "#fff"); ctx.restore();
        }
        var cc = cellXY(p, g);
        if (p.state === "frame") drawPiece(ctx, pic, cfg.cols, cfg.rows, p.c, p.r, cc.x - g.cell / 2 + 1, cc.y - g.cell / 2 + 1, g.cell - 2, g.cell - 2);
        else {
          ctx.setLineDash([5, 6]); ctx.strokeStyle = "rgba(29,43,58,.35)"; ctx.lineWidth = 2; ctx.strokeRect(cc.x - g.cell / 2 + 4, cc.y - g.cell / 2 + 4, g.cell - 8, g.cell - 8); ctx.setLineDash([]);
          txt(ctx, String(p.n), cc.x, cc.y, 26, "rgba(29,43,58,.3)");
        }
      });
      pill(ctx, "📤 Sender · " + pic.name, g.src.x + g.bw / 2, 92, 19, "#fff7e0");
      pill(ctx, "📥 Hoot's lab", g.dst.x + g.bw / 2, 92, 19, "#f1edfa");
      // arrival tray (shelf)
      ctx.fillStyle = "#c8a165"; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; u.rr(ctx, g.tray.x - 18, g.tray.y + 26, g.tray.w + 36, 18, 6); ctx.fill(); ctx.stroke();
      txt(ctx, "Arrival tray: parcels sit in the order they came", W / 2, g.tray.y + 66, 18, INK);
      // resend requests fly back to the sender
      notes = notes.filter(function (nt) {
        var k = (S.t - nt.t0) / .9; if (k > 1) return false;
        var p = pathAt([g.inn, g.rB[1], g.rA[1], g.out], k); pill(ctx, "Resend #" + nt.n + "!", p.x, p.y - 34, 18, "#e3d9ff"); return true;
      });
      // parcels on the move / in the tray
      pieces.forEach(function (p) {
        var q = piecePos(p, g); if (!q) return;
        var s = p.state === "fly" ? .9 : g.slot / 64, wob = p.flash && S.t - p.flash < .5 ? Math.sin(S.t * 40) * .15 : 0;
        if (p.state === "fly") q = { x: q.x, y: q.y - 6 - Math.abs(Math.sin(S.t * 9 + p.n)) * 6 };
        parcel(ctx, q.x, q.y, s, { label: "#" + p.n, pic: faceOf(p), rot: wob, tag: wob ? "#ffd0d6" : "#fff" });
      });
      bugs.forEach(function (b) {
        var r = g.rB[b.rb], k = S.t - b.t0, x = r.x, y = r.y - 40;
        if (k > .35) { x += (k - .35) * 150; y -= (k - .35) * 230; }
        var s = Math.min(1, k * 4), sz = 76 * s;
        drawImg(ctx, charImg("bug"), x - sz / 2, y - sz / 2 + Math.sin(t * 20) * 3, sz, sz);
        if (k > .2) parcel(ctx, x + 30, y + 22, .6, { label: "#" + b.p.n, pic: faceOf(b.p) });
      });
      pill(ctx, msgLine, W / 2, 36, 22, "#fff");
      S.fx.draw(ctx, dt);
    }
    startRound(0);
    L.loop(function (dt) {
      at += dt;
      var g = geo();
      if (!hold) { S.tick(dt); update(g); }
      draw(dt, g);
    });
  }

  /* ================================================================ L3 — UDP live drone video: conceal or skip */
  function bez(a, c, b, k) { var m = 1 - k; return { x: m * m * a.x + 2 * m * k * c.x + k * k * b.x, y: m * m * a.y + 2 * m * k * c.y + k * k * b.y }; }
  function chip(ctx, x, y, label, col, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; u.rr(ctx, x - 24, y - 15, 48, 30, 8); ctx.fill(); ctx.stroke();
    txt(ctx, label, x, y + 1, 16, INK); ctx.globalAlpha = 1;
  }
  function levelVideo(L) {
    var S = scene(L, "live drone video", 600, ["#8fd0ff", "#5fae5a"]);
    var pic = sitePic("rgb");
    var PLAN = [0, 0, 1, 0, 0, 2, 0, 1, 0, 1, 0, 3, 0, 2, 0, 0, 1, 0, 2, 0], LATE = 9;
    var queue = [], packets = [], fi = 0, nextFrameAt = .8, decide = null, view = null, prevView = null, bin = [];
    var hold = false, at = 0, asked = false, waitDemo = 0, frozenUntil = 0, zapT = -9, zapAt = null, resT = -9, resTxt = "", resCol = INK;
    var good = 0, wrongs = 0, freezes = 0, damaged = 0, smooth = 100, done = false, hinted = false;
    var BC = S.btn("🩹 <b>Conceal</b> <kbd>C</kbd>", ["c", "1"], function () { pick("conceal"); }, "pp-cmd");
    var BS = S.btn("⏭ <b>Skip</b> <kbd>S</kbd>", ["s", "k", "2"], function () { pick("skip"); }, "pp-cmd");
    BC.innerHTML = '<b>🩹 Conceal <kbd>C</kbd></b><small>one piece missing: borrow it</small>';
    BS.innerHTML = '<b>⏭ Skip <kbd>S</kbd></b><small>two or more missing: drop it</small>';
    function glowBtns(on) { BC.classList.toggle("pp-glow", on); BS.classList.toggle("pp-glow", on); }
    function geo() {
      var W = S.cv.w, g = { W: W };
      g.scr = { x: W - 470, y: 66, w: 400, h: 300 };
      g.slots = [0, 1, 2, 3].map(function (k) { return { x: g.scr.x + 50 + k * 100, y: 438 }; });
      g.drone = { x: Math.max(190, W * .16), y: 200 };
      g.ant = { x: g.drone.x + 26, y: g.drone.y - 44 };
      g.cloud = { x: (g.drone.x + g.scr.x) / 2 + 10, y: 118 };
      g.ring = { x: g.scr.x - 62, y: 456 };
      g.bin = { x: g.scr.x - 150, y: 520 };
      return g;
    }
    function result(s, col) { resT = at; resTxt = s; resCol = col; }
    function makeFrame() {
      var n = fi++, ks = u.shuffle([0, 1, 2, 3], L.rng).slice(0, PLAN[n]);
      var f = { n: n + 1, launch: S.t, due: S.t + 1.75, got: [false, false, false, false], status: "incoming", ox: 40 + n * 10, oy: 200 + Math.sin(n / 3) * 50, col: FRAME_COLORS[n % FRAME_COLORS.length] };
      queue.push(f);
      for (var k = 0; k < 4; k++) {
        var lost = ks.indexOf(k) >= 0, late = lost && n === LATE;
        packets.push({ f: f, k: k, t0: S.t + k * .1, dur: late ? 2.4 : u.rand(.85, 1.3), lost: lost && !late, late: late, lostAt: u.rand(.38, .6), done: false, lane: u.rand(-40, 60) });
      }
    }
    function show(f, patch, corrupt) { prevView = view; view = { f: f, patch: patch || [], corrupt: corrupt || [], from: prevView ? prevView.f : f }; f.status = "done"; }
    function teach() {
      hold = true;
      L.choose("tuki", "A packet of this frame got lost! Should the video app wait for it to be sent again?", ["⏳ Wait for a resend", "▶ Keep the video going"]).then(function (i) {
        if (!L.alive) return;
        if (i === 0) {
          waitDemo = at;
          return L.wait(2200).then(function () { if (!L.alive) return; waitDemo = 0; return L.say("koa", "The video froze, and my drone already flew past! UDP never resends by itself, and live video rarely has time to wait."); });
        }
        return L.say("koa", "Right, there's no time to wait here! Patch the hole or skip the frame, and keep going.");
      }).then(function () { if (!L.alive) return; hold = false; if (decide) decide.until = S.t + 3; });
    }
    function showHint() {
      if (hinted) return; hinted = true; hold = true;
      L.hint("One red hole means **Conceal**, two or more mean **Skip**. Decide before the ring runs out!", "koa").then(function () { hold = false; if (decide) decide.until = Math.max(decide.until, S.t + 2); });
    }
    function pick(kind) {
      if (hold || done) return;
      if (!decide) { L.toast("No broken frame right now. Whole frames play by themselves!", "info", 1800); return; }
      var d = decide, f = d.f, missK = [0, 1, 2, 3].filter(function (k) { return !f.got[k]; });
      decide = null; glowBtns(false);
      if (kind === "conceal") {
        if (d.miss === 1) { good++; show(f, missK); result("🩹 Patched! Hardly anyone notices.", C.ack); L.sfx("good"); smooth = Math.min(100, smooth + 2); }
        else { wrongs++; show(f, [], missK); result("Too many holes: the picture breaks!", C.bad); L.sfx("bad"); smooth -= 12; S.shake(); }
      } else {
        f.status = "done";
        if (d.miss >= 2) { good++; result("⏭ Skipped! The last good frame stays up.", C.ack); L.sfx("good"); smooth = Math.min(100, smooth + 2); }
        else { wrongs++; result("Only one piece was missing: patching was better!", C.amber); L.sfx("error"); smooth -= 6; }
      }
      var g = geo(); S.fx.burst(g.scr.x + g.scr.w / 2, g.scr.y + g.scr.h / 2, kind === "conceal" ? "#8ce99a" : "#74c0fc", 14);
      if (wrongs >= 2 || L.fails >= 1) showHint();
    }
    function update(g) {
      if (fi < PLAN.length && S.t >= nextFrameAt) { makeFrame(); nextFrameAt += fi < 10 ? 2.4 : 2.0; }
      packets.forEach(function (p) {
        if (p.done) return;
        var k = (S.t - p.t0) / p.dur; if (k < 0) return;
        if (p.lost && k >= p.lostAt) {
          p.done = true; zapT = at; zapAt = bez(g.ant, { x: g.cloud.x, y: g.cloud.y + 60 + p.lane }, g.slots[p.k], p.lostAt);
          S.fx.burst(zapAt.x, zapAt.y, "#adb5bd", 10, 160); L.sfx("zap");
        } else if (!p.lost && k >= 1) {
          p.done = true;
          if (p.f.status === "incoming") { p.f.got[p.k] = true; L.sfx("tick"); }
          else { bin.push({ p: p, t0: at }); S.fx.text(g.slots[p.k].x, g.slots[p.k].y - 40, "Too late!", C.bad, 24); L.sfx("drop"); }
        }
      });
      packets = packets.filter(function (p) { return !p.done; });
      if (!decide && queue.length && S.t >= queue[0].due) {
        var f = queue.shift(), miss = f.got.filter(function (x) { return !x; }).length;
        if (!miss) { show(f); smooth = Math.min(100, smooth + 1); }
        else {
          damaged++; decide = { f: f, miss: miss, until: S.t + 2.6 }; glowBtns(true); L.sfx("beep");
          if (!asked) { asked = true; teach(); }
        }
      }
      if (decide && S.t > decide.until) {
        freezes++; decide.f.status = "done"; decide = null; glowBtns(false); smooth -= 15; frozenUntil = at + 1.3; S.shake();
        result("Frozen! Decide before the ring runs out.", C.bad); L.sfx("buzz");
        if (freezes >= 2) showHint();
        if (freezes >= 5) { done = true; L.fail("The video froze too many times. Press **Conceal** or **Skip** before the ring runs out!"); return; }
      }
      smooth = u.clamp(smooth, 0, 100);
      L.hud.set("frame", "🎬 " + Math.min(fi, PLAN.length) + " / " + PLAN.length); L.hud.set("smooth", "📺 " + Math.round(smooth) + "%");
      if (!done && fi >= PLAN.length && !queue.length && !decide && S.t > nextFrameAt - 1) {
        done = true; glowBtns(false);
        var ratio = damaged ? good / damaged : 1, stars = ratio >= .85 && freezes <= 1 ? 3 : ratio >= .6 ? 2 : 1;
        L.timeout(function () {
          L.win({ stars: stars, msg: "The live video never stopped! With **UDP** the app patches or skips a broken frame instead of waiting.",
            stats: { "Good calls": good + " / " + damaged, "Freezes": freezes, "Smooth": Math.round(smooth) + "%" } });
        }, 900);
      }
    }
    function drawStrip(ctx, g, f, k) {
      var s = pic.size(), cw = s.w * .47, ch = cw * .75, sx = (f.ox / 640) * s.w, sy = (f.oy / 640) * s.h;
      try { ctx.drawImage(pic.src(), sx + k * cw / 4, sy, cw / 4, ch, g.scr.x + k * g.scr.w / 4, g.scr.y, g.scr.w / 4 + .5, g.scr.h); } catch (e) { /* loading */ }
    }
    function draw(dt, g) {
      var ctx = S.ctx, W = g.W, H = S.h, t = at;
      backdrop(ctx, W, H, t, { top: "#8fd0ff", mid: "#dff3ff", noHills: true });
      hills(ctx, W, H, H - 150, 22, 140, -t * .25, "#a6d98f");
      // forest scrolls under the drone
      ctx.fillStyle = "#5fae5a"; ctx.fillRect(0, H - 110, W, 110);
      for (var i = 0; i < 26; i++) {
        var tx = ((i * 83 - t * 70) % (W + 120) + W + 120) % (W + 120) - 60, ty = H - 96 + (i % 3) * 16, r = 20 + (i % 4) * 4;
        ctx.fillStyle = "#7a5230"; ctx.fillRect(tx - 4, ty, 8, 22);
        ctx.fillStyle = i % 2 ? "#2f8a3e" : "#3fa34d"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(tx, ty - 6, r, 0, 7); ctx.fill(); ctx.stroke();
      }
      // camera cone + drone
      ctx.fillStyle = "rgba(255,230,120,.28)"; ctx.beginPath(); ctx.moveTo(g.drone.x, g.drone.y + 20); ctx.lineTo(g.drone.x - 110, H - 100); ctx.lineTo(g.drone.x + 110, H - 100); ctx.closePath(); ctx.fill();
      drone(ctx, g.drone.x, g.drone.y + Math.sin(t * 2) * 8, t, 1.1);
      for (var w2 = 0; w2 < 3; w2++) { var rr2 = ((t * 60 + w2 * 30) % 90); ctx.strokeStyle = "rgba(29,43,58," + (1 - rr2 / 90) * .6 + ")"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(g.ant.x, g.ant.y + Math.sin(t * 2) * 8, rr2, -1.2, .4); ctx.stroke(); }
      pill(ctx, "Koa's drone · UDP stream", g.drone.x, 60, 19, "#e9f2fc");
      // grumpy radio-noise cloud
      cloud(ctx, g.cloud.x - 60, g.cloud.y, 1.5, "#c3ccd6");
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(g.cloud.x - 22, g.cloud.y - 8, 4, 0, 7); ctx.arc(g.cloud.x + 6, g.cloud.y - 8, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(g.cloud.x - 20, g.cloud.y + 8); ctx.quadraticCurveTo(g.cloud.x - 8, g.cloud.y + 2, g.cloud.x + 4, g.cloud.y + 8); ctx.stroke();
      txt(ctx, "radio noise", g.cloud.x - 8, g.cloud.y + 44, 17, "#4a5b6d");
      if (at - zapT < .25 && zapAt) {
        ctx.strokeStyle = C.gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(g.cloud.x - 10, g.cloud.y + 30);
        ctx.lineTo((g.cloud.x + zapAt.x) / 2 + 14, (g.cloud.y + zapAt.y) / 2); ctx.lineTo((g.cloud.x + zapAt.x) / 2 - 10, (g.cloud.y + zapAt.y) / 2 + 8); ctx.lineTo(zapAt.x, zapAt.y); ctx.stroke();
      }
      // packets in flight
      packets.forEach(function (p) {
        var k = (S.t - p.t0) / p.dur; if (k < 0) return;
        var q = bez(g.ant, { x: g.cloud.x, y: g.cloud.y + 60 + p.lane }, g.slots[p.k], u.clamp(k, 0, 1));
        chip(ctx, q.x, q.y, p.f.n + "·" + (p.k + 1), p.f.col);
      });
      // the tablet with the live video
      var sc = g.scr;
      ctx.fillStyle = "#26323f"; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, sc.x - 18, sc.y - 18, sc.w + 36, sc.h + 36, 22); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0d1520"; ctx.fillRect(sc.x, sc.y, sc.w, sc.h);
      if (view) {
        for (var k2 = 0; k2 < 4; k2++) {
          if (view.corrupt.indexOf(k2) >= 0) {
            for (var b = 0; b < 14; b++) { ctx.fillStyle = ["#ff00aa", "#00ff99", "#555", "#ffcc00", "#222"][(b + Math.floor(t * 12)) % 5]; ctx.fillRect(sc.x + k2 * sc.w / 4 + (b % 2) * sc.w / 8, sc.y + Math.floor(b / 2) * sc.h / 7, sc.w / 8, sc.h / 7); }
          } else drawStrip(ctx, g, view.patch.indexOf(k2) >= 0 ? view.from : view.f, k2);
        }
        view.patch.forEach(function (k3) { ctx.strokeStyle = "rgba(140,233,154,.9)"; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.strokeRect(sc.x + k3 * sc.w / 4 + 2, sc.y + 2, sc.w / 4 - 4, sc.h - 4); ctx.setLineDash([]); });
        pill(ctx, "frame " + view.f.n, sc.x + sc.w - 56, sc.y + 22, 15, "#fff");
      } else txt(ctx, "Waiting for video…", sc.x + sc.w / 2, sc.y + sc.h / 2, 22, "#fff");
      ctx.fillStyle = "#e03131"; u.rr(ctx, sc.x + 10, sc.y + 10, 70, 26, 8); ctx.fill(); txt(ctx, "● LIVE", sc.x + 45, sc.y + 23, 15, "#fff");
      if (waitDemo || at < frozenUntil) {
        ctx.fillStyle = "rgba(10,15,25,.6)"; ctx.fillRect(sc.x, sc.y, sc.w, sc.h);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(sc.x + sc.w / 2, sc.y + sc.h / 2 - 14, 26, t * 7, t * 7 + 4.4); ctx.stroke();
        txt(ctx, waitDemo ? "Buffering… waiting for a resend" : "Frozen!", sc.x + sc.w / 2, sc.y + sc.h / 2 + 40, 20, "#fff");
      }
      if (at - resT < 1.8) pill(ctx, resTxt, sc.x + sc.w / 2, sc.y + sc.h - 26, 17, "#fff", resCol);
      // frame assembler
      ctx.fillStyle = "rgba(255,253,247,.94)"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, sc.x - 8, 380, sc.w + 16, 140, 16); ctx.fill(); ctx.stroke();
      var cur = decide ? decide.f : queue[0];
      txt(ctx, cur ? "Pieces of frame " + cur.n + ":" : "Pieces of the next frame:", sc.x + sc.w / 2, 400, 19, INK);
      g.slots.forEach(function (s, k) {
        if (cur && cur.got[k]) chip(ctx, s.x, s.y, cur.n + "·" + (k + 1), cur.col);
        else {
          var hole = !!decide;
          ctx.setLineDash([5, 5]); ctx.strokeStyle = hole ? C.bad : "rgba(29,43,58,.5)"; ctx.lineWidth = hole ? 4 : 2.5;
          ctx.fillStyle = hole ? "rgba(209,73,91,.15)" : "rgba(255,255,255,.5)"; u.rr(ctx, s.x - 24, s.y - 15, 48, 30, 8); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
          txt(ctx, hole ? "✗" : String(k + 1), s.x, s.y + 1, hole ? 22 : 16, hole ? C.bad : "rgba(29,43,58,.5)");
        }
      });
      // deadline bar / decision ring
      var bx = sc.x + 26, bw = sc.w - 52, by = 474;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, bx, by, bw, 16, 8); ctx.fill(); ctx.stroke();
      if (decide) {
        var left = u.clamp((decide.until - S.t) / 2.6, 0, 1);
        ctx.fillStyle = C.bad; u.rr(ctx, bx + 2, by + 2, (bw - 4) * left, 12, 6); ctx.fill();
        var rg = g.ring; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(rg.x, rg.y, 34, 0, 7); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = C.bad; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(rg.x, rg.y, 26, -Math.PI / 2, -Math.PI / 2 + left * 6.283); ctx.stroke();
        txt(ctx, decide.miss + "✗", rg.x, rg.y + 1, 20, C.bad);
        pill(ctx, "Decide!", rg.x, rg.y + 54, 18, "#ffe0e4", C.bad);
      } else if (cur) {
        var prog = u.clamp((S.t - cur.launch) / (cur.due - cur.launch), 0, 1);
        ctx.fillStyle = "#2f9e4f"; u.rr(ctx, bx + 2, by + 2, (bw - 4) * prog, 12, 6); ctx.fill();
      }
      txt(ctx, "⏱ show time", bx + bw, by + 32, 15, "#4a5b6d", "right");
      // late-packet bin
      ctx.fillStyle = "#adb5bd"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, g.bin.x - 26, g.bin.y - 30, 52, 50, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#868e96"; u.rr(ctx, g.bin.x - 32, g.bin.y - 38, 64, 12, 4); ctx.fill(); ctx.stroke();
      txt(ctx, "too late", g.bin.x, g.bin.y + 38, 16, "#4a5b6d");
      bin = bin.filter(function (bn) {
        var k = (at - bn.t0) / .7; if (k > 1) return false;
        var q = lerpPt(g.slots[bn.p.k], { x: g.bin.x, y: g.bin.y - 30 }, k, 60); chip(ctx, q.x, q.y, bn.p.f.n + "·" + (bn.p.k + 1), bn.p.f.col, 1 - k * .5); return true;
      });
      S.fx.draw(ctx, dt);
    }
    if (L.fails >= 1) showHint();
    L.loop(function (dt) {
      at += dt;
      var g = geo();
      if (!hold && !done) { S.tick(dt); update(g); }
      draw(dt, g);
    });
  }

  /* ================================================================ L4 — DNS phone book, IP addresses, the cache */
  /* Only khamydoan.github.io (GitHub Pages) and localhost are real; every `.example` name and its documentation-range
   * address (192.0.2.x, 198.51.100.x, 203.0.113.x) is made up. */
  var BOOK = [
    ["acorn.example", "198.51.100.12"], ["aviator.example", "203.0.113.40"],
    ["bamboo.example", "192.0.2.81"], ["beehive.example", "198.51.100.5"],
    ["gecko.example", "203.0.113.17"], ["glitch-bugs.example", "192.0.2.66"],
    ["kanga.example", "198.51.100.23"], ["khamydoan.example", "192.0.2.55"], ["khamydoan.github.io", "185.199.108.153"], ["koala.example", "203.0.113.9"],
    ["lemur.example", "192.0.2.31"], ["localhost", "127.0.0.1"], ["lotus.example", "203.0.113.88"],
    ["mango.example", "198.51.100.140"], ["mole.example", "192.0.2.200"],
    ["pangolin.example", "198.51.100.61"], ["parrot.example", "203.0.113.120"],
    ["seeds.example", "192.0.2.14"], ["sloth.example", "203.0.113.230"],
    ["toucan.example", "198.51.100.99"], ["treehouse.example", "192.0.2.150"]
  ];
  function building(ctx, x, base, w, h, col, sign, lit, t) {
    ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, x - w / 2, base - h, w, h, 8); ctx.fill(); ctx.stroke();
    for (var r = 0; r < Math.floor((h - 70) / 34); r++) for (var c = 0; c < 3; c++) {
      var on = lit > 0 && ((r + c + Math.floor(t * 6)) % 3 !== 0 || lit > .6);
      ctx.fillStyle = on ? "#ffe066" : "#d7e3ee"; u.rr(ctx, x - w / 2 + 14 + c * (w - 28) / 3, base - h + 50 + r * 34, (w - 28) / 3 - 10, 22, 4); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = "#8a5a35"; ctx.lineWidth = 3; u.rr(ctx, x - 16, base - 40, 32, 40, 5); ctx.fill(); ctx.stroke();
    pill(ctx, sign, x, base - h - 4, 18, "#fff", INK, true);
  }
  function levelDNS(L) {
    var S = scene(L, "phone book street", 500);
    S.bar.classList.add("pp-book");
    var REQS = [
      { name: "khamydoan.github.io", why: "Open the ReSeed website", dest: "gh" },
      { name: "localhost", why: "Open the demo server: python -m reseed serve", dest: "self" },
      { name: "khamydoan.github.io", why: "Open the ReSeed website again", dest: "gh", cache: true },
      { name: "khamydoan.gihtub.io", why: "A Glitch Bug typed this one…", dest: "nx" }
    ];
    var ri = 0, req = REQS[0], cache = [], mistakes = 0, usedCache = false, phase = "look", trip = null, at = 0, hinted = false, stampIP = null, page = false;
    var letters = []; BOOK.forEach(function (e) { if (letters.indexOf(e[0][0]) < 0) letters.push(e[0][0]); });
    var cacheBox = u.el("div", { class: "pp-cache" }), pages = u.el("div", { class: "pp-pages" }), tabs = u.el("div", { class: "pp-tabs" }), entries = u.el("div", { class: "pp-entries" });
    pages.appendChild(tabs); pages.appendChild(entries);
    var nx = u.el("button", { class: "btn pp-nx", html: "<span>❓ <b>No such name</b></span><kbd>X</kbd>" });
    S.bar.appendChild(cacheBox); S.bar.appendChild(pages); S.bar.appendChild(nx);
    nx.addEventListener("click", function () { if (L.alive && !L.paused) answer(null, "nx", nx); });
    S.keys.x = function () { answer(null, "nx", nx); };
    S.keys.c = function () { var b = cacheBox.querySelector(".btn"); if (b) b.focus(); };
    letters.forEach(function (l) {
      var b = u.el("button", { class: "btn pp-tab", text: l.toUpperCase(), dataset: { l: l }, "aria-label": "Page " + l.toUpperCase() });
      b.addEventListener("click", function () { if (L.alive && !L.paused) openTab(l); });
      tabs.appendChild(b);
    });
    function openTab(l) {
      L.sfx("tick");
      u.$$(".pp-tab", tabs).forEach(function (b) { b.classList.toggle("on", b.dataset.l === l); });
      entries.innerHTML = "";
      BOOK.filter(function (e) { return e[0][0] === l; }).forEach(function (e) {
        var b = u.el("button", { class: "btn pp-entry", html: "<span><b>" + u.esc(e[0]) + "</b></span><code>" + e[1] + "</code>" });
        b.addEventListener("click", function () { if (L.alive && !L.paused) answer(e, "book", b); });
        entries.appendChild(b);
      });
    }
    function renderCache() {
      cacheBox.innerHTML = "<h3>📝 DNS cache <kbd>C</kbd></h3>";
      if (!cache.length) cacheBox.appendChild(u.el("div", { class: "muted", text: "Empty. Answers you find get saved here." }));
      cache.forEach(function (e) {
        var b = u.el("button", { class: "btn", html: "<b>" + u.esc(e[0]) + "</b><code>" + e[1] + "</code>" });
        b.addEventListener("click", function () { if (L.alive && !L.paused) answer(e, "cache", b); });
        cacheBox.appendChild(b);
      });
    }
    S.anyKey = function (k) {
      if (letters.indexOf(k) >= 0) { openTab(k); var f = entries.querySelector(".btn"); if (f) f.focus(); return true; }
      var list = u.$$(".pp-entry", entries), i = list.indexOf(document.activeElement);
      if (/^[1-9]$/.test(k) && list[+k - 1]) { list[+k - 1].click(); return true; }
      if (k === "ArrowDown" || k === "ArrowRight") { (list[i + 1] || list[0]).focus(); return true; }
      if (k === "ArrowUp" || k === "ArrowLeft") { (list[i - 1] || list[list.length - 1]).focus(); return true; }
      return false;
    };
    function flash(b) { if (!b) return; b.classList.add("no", "shake"); L.timeout(function () { b.classList.remove("no", "shake"); }, 600); }
    function bad(msg, b) {
      mistakes++; L.sfx("error"); S.shake(); flash(b); L.toast(msg, "bad", 2800);
      if ((mistakes >= 2 || L.fails >= 1) && !hinted) { hinted = true; L.hint("Read the name letter by letter. Open its first-letter tab, then find the exact same name.", "tuki"); }
    }
    function answer(e, how, b) {
      if (phase !== "look") return;
      if (how === "nx") {
        if (req.dest === "nx") return success(null, how);
        return bad("**" + req.name + "** IS in the phone book. Look under **" + req.name[0].toUpperCase() + "**!", b);
      }
      if (req.dest === "nx") return bad(e[0] === "khamydoan.github.io" ? "Look closely: the bug typed **gihtub**, not **github**! That name is not in the book." : "That's **" + e[0] + "**, not **" + req.name + "**.", b);
      if (e[0] === req.name) return success(e, how);
      bad("That's **" + e[0] + "**. We need **" + req.name + "**.", b);
    }
    function success(e, how) {
      phase = "trip"; L.sfx("good"); stampIP = e ? e[1] : null; trip = { t0: at };
      if (how === "cache") { usedCache = true; L.toast("Cache hit! No need to open the book. ⚡", "good", 2200); }
      else if (req.cache) L.toast("Found it! Next time, check your **cache** note first: it's faster.", "info", 2800);
      if (e && !cache.some(function (c) { return c[0] === e[0]; })) { cache.push(e); renderCache(); }
      if (req.dest === "nx") L.sfx("giggle");
      L.timeout(next, req.dest === "self" ? 3000 : 2700);
    }
    function next() {
      ri++;
      if (ri >= REQS.length) {
        phase = "done";
        return L.win({ stars: mistakes <= 1 && usedCache ? 3 : mistakes <= 3 ? 2 : 1,
          msg: "Names in, numbers out! **DNS** found every address, and your **cache** remembered one.",
          stats: { "Mistakes": mistakes, "Used the cache": usedCache ? "yes" : "no" } });
      }
      req = REQS[ri]; phase = "look"; trip = null; stampIP = null; page = false;
      L.hud.set("look", "📒 " + (ri + 1) + " / " + REQS.length);
    }
    function draw(dt) {
      var ctx = S.ctx, W = S.cv.w, H = S.h, t = at;
      backdrop(ctx, W, H, t, {});
      var bx = [W - 520, W - 340, W - 150], tk = trip ? at - trip.t0 : 0, ghLit = req.dest === "gh" && trip && tk > 1.4 ? 1 : 0;
      building(ctx, bx[0], H - 40, 140, 210, "#e9c46a", "203.0.113.9", 0, t);
      building(ctx, bx[1], H - 40, 140, 250, "#8ecae6", "198.51.100.23", 0, t);
      building(ctx, bx[2], H - 40, 170, 300, "#5a6b7d", "185.199.108.153", ghLit, t);
      txt(ctx, "GitHub Pages", bx[2], H - 52 - 300 + 30, 17, "#fff");
      laptop(ctx, 130, H - 50, t, { page: page, label: req.dest === "self" && trip && tk > 1.6 ? "127.0.0.1" : "" });
      pill(ctx, "Your laptop", 130, H - 22, 17, "#fff3c4");
      // DNS booth with Tuki
      var kx = Math.max(530, W * .41), ky = H - 40;
      ctx.fillStyle = C.amber; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, kx - 60, ky - 170, 120, 170, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff7e0"; u.rr(ctx, kx - 46, ky - 120, 92, 70, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c92a2a"; u.rr(ctx, kx - 40, ky - 110, 38, 52, 4); ctx.fill(); ctx.stroke(); u.rr(ctx, kx + 2, ky - 110, 38, 52, 4); ctx.fill(); ctx.stroke();
      txt(ctx, "DNS", kx, ky - 150, 24, "#fff");
      drawImg(ctx, charImg("tuki", phase === "look" ? "think" : "happy"), kx - 34, ky - 250 + Math.sin(t * 2) * 4, 84, 84);
      txt(ctx, "phone book", kx, ky - 24, 16, "#fff");
      // the parcel and its address label
      var p0 = { x: 290, y: H - 120 }, pp = p0, rot = 0;
      if (trip) {
        if (req.dest === "gh") pp = tk < 1.5 ? lerpPt(p0, { x: bx[2], y: H - 70 }, u.ease.inOut(tk / 1.5), 160) : null;
        else if (req.dest === "self") {
          if (tk < 1.6) { var a = tk / 1.6 * 6.283; pp = { x: 260 + Math.sin(a) * 90, y: H - 210 + Math.cos(a) * 90 - 10 }; rot = a; }
          else pp = tk < 2.1 ? lerpPt({ x: 260, y: H - 130 }, { x: 130, y: H - 110 }, (tk - 1.6) / .5, 30) : null;
        } else rot = Math.sin(tk * 30) * .08 * Math.max(0, 1 - tk);
        if (req.dest === "gh" && tk > 1.5 && !page && tk > 2.2) { page = true; L.sfx("pop"); }
      }
      if (pp) {
        parcel(ctx, pp.x, pp.y, 1.3, { rot: rot });
        ctx.save(); ctx.translate(pp.x, pp.y - 92);
        ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, -150, -36, 300, 72, 10); ctx.fill(); ctx.stroke();
        txt(ctx, "To: " + req.name, 0, -13, 19, INK, "center", mono(19));
        var ipTxt = stampIP ? "IP: " + stampIP : req.dest === "nx" && trip ? "NO SUCH NAME" : "IP: ???";
        txt(ctx, ipTxt, 0, 16, 21, stampIP ? C.ack : C.bad, "center", mono(21, 700));
        ctx.restore();
      }
      if (req.dest === "nx") drawImg(ctx, charImg("bug"), 360, H - 150 + Math.sin(t * 10) * 4, 70, 70);
      if (req.dest === "self" && trip && tk > 1.6) pill(ctx, "127.0.0.1 = this computer!", 300, 130, 20, "#d9f7df", C.ack);
      if (req.dest === "gh" && trip && tk > 1.5) pill(ctx, "Delivered to 185.199.108.153!", bx[2] - 60, 120, 20, "#d9f7df", C.ack);
      if (req.dest === "nx" && trip) pill(ctx, "Return to sender: name not found", 330, 140, 20, "#ffe0e4", C.bad);
      pill(ctx, "Find: " + req.name, W / 2, 34, 24, "#fff7e0", INK, true);
      txt(ctx, req.why, W / 2, 76, 19, "#4a5b6d");
      S.fx.draw(ctx, dt);
    }
    renderCache(); openTab("a");
    L.hud.set("look", "📒 1 / " + REQS.length);
    L.loop(function (dt) {
      at += dt; draw(dt); });
  }

  /* ================================================================ L5 — ports: deliver to the right door, then build a URL */
  var DOORS = [
    { port: 22, name: "SSH", short: "SSH", icon: "🖥️", col: "#495057", who: "pix" },
    { port: 80, name: "HTTP", short: "HTTP", icon: "📄", col: "#e0a21d", who: "mo" },
    { port: 443, name: "HTTPS", short: "HTTPS", icon: "🔒", col: "#2b7bd0", who: "tuki" },
    { port: 8000, name: "reseed serve", short: "ReSeed", icon: "🌱", col: "#2f9e4f", who: "sprout" }
  ];
  var HOSTS = {
    gh: { name: "khamydoan.github.io", sub: "185.199.108.153 · GitHub Pages", col: "#5a6b7d" },
    local: { name: "localhost", sub: "127.0.0.1 · your laptop on demo day", col: "#3a9a55" },
    lab: { name: "lab-vm", sub: "the project's GPU computer (made-up name)", col: "#2b6cb0" },
    arc: { name: "airesearchcenter.com", sub: "the AI Research Center website", col: "#7c5cc4" }
  };
  var HEALTH = '{"ok": true, "forestnet": true, "gpt": true, "gpt_model": "gpt-6-astra"}';
  var JOBS = [
    { url: "https://khamydoan.github.io/reseed/", host: "gh", door: 443, reply: "200 OK: the ReSeed website, locked and safe" },
    { url: "http://localhost:8000/", host: "local", door: 8000, reply: "200 OK: mission control, served by your own laptop" },
    { url: "ssh kid@lab-vm", host: "lab", door: 22, reply: "kid@lab-vm:~$   Pix can type commands from far away" },
    { url: "http://localhost:8000/api/health", host: "local", door: 8000, reply: HEALTH },
    { url: "http://khamydoan.github.io/reseed/", host: "gh", door: 80, reply: "301 Moved: please use https:// (door 443)" },
    { url: "https://airesearchcenter.com/reseed", host: "arc", door: 443, reply: "200 OK: the ReSeed page, shown in a frame" },
    { url: "POST http://localhost:8000/api/classify  + photo.jpg", host: "local", door: 8000, reply: '{"forestnet": {…}, "gpt": {…}}  two opinions!' }
  ];
  var URL_PARTS = ["http://", "localhost", ":8000", "/api/health"];
  function levelPorts(L) {
    var S = scene(L, "port street");
    var ji = -1, job = null, phase = "", host = "gh", hostT = -9, at = 0, mistakes = 0, hinted = false, final = false;
    var pk = null, openDoor = -1, openT = -9, refused = -1, refT = -9, reply = "", replyT = -9, built = [];
    function geo() {
      var W = S.cv.w, g = { W: W, bx: W - 600, bw: 540, base: 520, bh: 350 };
      g.doors = DOORS.map(function (d, i) { return { x: g.bx + 75 + i * 130, y: g.base - 62 }; });
      g.wait = { x: g.bx - 110, y: 468 };
      return g;
    }
    function doorButtons() {
      S.clearBar();
      S.note("Which door?");
      DOORS.forEach(function (d, i) { S.btn("<b>" + d.port + "</b><small>" + d.icon + " " + d.name + " <kbd>" + (i + 1) + "</kbd></small>", [String(i + 1)], function () { pickDoor(i); }, "pp-door"); });
    }
    function parcelPos(g) {
      if (!pk) return null;
      var k = at - pk.t0;
      if (pk.state === "belt") return lerpPt({ x: -60, y: g.wait.y }, g.wait, u.ease.outCubic(Math.min(1, k / .9)));
      if (pk.state === "wait") return { x: g.wait.x, y: g.wait.y - Math.abs(Math.sin(at * 4)) * 6 };
      if (pk.state === "hop") return lerpPt(pk.from, g.doors[pk.door], Math.min(1, k / .55), 150);
      if (pk.state === "back") return lerpPt(g.doors[pk.door], g.wait, Math.min(1, k / .6), 90);
      if (pk.state === "in") return k < .4 ? g.doors[pk.door] : null;
      return null;
    }
    function nextJob() {
      ji++;
      if (ji >= JOBS.length) return startBuild();
      job = JOBS[ji]; if (job.host !== host) { host = job.host; hostT = at; L.sfx("whoosh"); }
      pk = { state: "belt", t0: at }; phase = "pick"; openDoor = -1;
      L.hud.set("job", "📦 " + (ji + 1) + " / " + JOBS.length);
    }
    function pickDoor(i) {
      if (phase !== "pick" || !pk) return;
      var g = geo(), from = parcelPos(g) || g.wait;
      phase = "anim"; pk = { state: "hop", t0: at, from: from, door: i, ok: DOORS[i].port === job.door };
      L.sfx("jump"); L.timeout(land, 560);
    }
    function land() {
      var g = geo(), d = DOORS[pk.door], dp = g.doors[pk.door];
      if (pk.ok) {
        openDoor = pk.door; openT = at; reply = job.reply; replyT = at; L.sfx("good"); S.fx.burst(dp.x, dp.y, null, 22, 260);
        pk = { state: "in", t0: at, door: pk.door };
        L.timeout(final ? finish : nextJob, 2700);
      } else {
        mistakes++; refused = pk.door; refT = at; L.sfx("bad"); S.shake();
        L.toast("**Connection refused!** Nobody listens at door **" + d.port + "** for this parcel.", "bad", 2600);
        pk = { state: "back", t0: at, door: pk.door };
        L.timeout(function () { pk = { state: "wait", t0: at }; phase = "pick"; }, 620);
        if ((mistakes >= 2 || L.fails >= 1) && !hinted) { hinted = true; L.hint("A number after a colon, like `:8000`, names the door. With no number, `https` means 443, `http` means 80 and `ssh` means 22.", "pix"); }
      }
    }
    function startBuild() {
      phase = "build"; host = "local"; hostT = at; job = null; pk = null; built = []; openDoor = -1;
      var pieces = u.shuffle(URL_PARTS, L.rng); if (pieces.join("") === URL_PARTS.join("")) pieces.reverse();
      S.clearBar(); S.note("Last job: build the address of ReSeed's <b>health check</b>. It asks the server which tools are ready.");
      pieces.forEach(function (p, i) { S.btn("<code>" + p + "</code> <kbd>" + (i + 1) + "</kbd>", [String(i + 1)], function (b) { addPiece(p, b); }, "pp-num"); });
      L.hud.set("job", "🔗 Build the URL");
    }
    function addPiece(p, b) {
      if (phase !== "build") return;
      var n = built.length;
      if (p === URL_PARTS[n]) {
        built.push(p); b.disabled = true; L.sfx("pop");
        if (built.length === URL_PARTS.length) {
          final = true; phase = "anim"; job = { url: built.join(""), host: "local", door: 8000, reply: HEALTH };
          var g = geo(); pk = { state: "hop", t0: at, from: g.wait, door: 3, ok: true }; L.sfx("jump"); L.timeout(land, 560);
        }
      } else {
        mistakes++; L.sfx("error"); S.shake();
        L.toast(["First the **protocol**: how the computers talk.", "Next the **name** of the computer.", "Then the **door** (port), after a colon.", "Last the **path**: which page to ask for."][n], "bad", 2600);
      }
    }
    function finish() {
      L.win({ stars: starsBy(mistakes, 1, 3), msg: "Every parcel found its door: **443** HTTPS, **80** HTTP, **22** SSH and **8000** for `python -m reseed serve`!",
        stats: { "Wrong doors": mistakes } });
    }
    function draw(dt) {
      var g = geo(), ctx = S.ctx, W = g.W, H = S.h, t = at, hs = HOSTS[host];
      backdrop(ctx, W, H, t, {});
      // conveyor belt
      var bx2 = g.wait.x + 60;
      ctx.fillStyle = "#5c677d"; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, 10, 500, bx2 - 10, 26, 13); ctx.fill(); ctx.stroke();
      for (var r = 0; r < (bx2 - 20) / 34; r++) { var rx = 26 + r * 34; ctx.fillStyle = "#adb5bd"; ctx.beginPath(); ctx.arc(rx, 513, 8, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(rx, 513); ctx.lineTo(rx + Math.cos(t * 6) * 7, 513 + Math.sin(t * 6) * 7); ctx.stroke(); }
      drawImg(ctx, charImg("pix", phase === "pick" ? "think" : "happy"), 40, 330 + Math.sin(t * 2) * 5, 130, 130);
      pill(ctx, "Pix, parcel sorter", 105, 480, 16, "#fff");
      // the computer (building) — pops in when the host changes
      var pop = u.ease.outBack(u.clamp((at - hostT) / .5, 0, 1));
      ctx.save(); ctx.translate(g.bx + g.bw / 2, g.base); ctx.scale(.85 + .15 * pop, .85 + .15 * pop); ctx.translate(-(g.bx + g.bw / 2), -g.base);
      ctx.fillStyle = hs.col; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, g.bx, g.base - g.bh, g.bw, g.bh, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(g.bx + 4, g.base - g.bh + 70, g.bw - 8, 6);
      pill(ctx, hs.name, g.bx + g.bw / 2, g.base - g.bh + 4, 22, "#fff", INK, true);
      txt(ctx, hs.sub, g.bx + g.bw / 2, g.base - g.bh + 44, 17, "#fff");
      DOORS.forEach(function (d, i) {
        var x = g.bx + 75 + i * 130, top = g.base - 150, open = openDoor === i ? u.clamp((at - openT) / .3, 0, 1) * (at - openT < 2.4 ? 1 : 0) : 0;
        ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, x - 50, top - 92, 100, 72, 10); ctx.fill(); ctx.stroke();
        txt(ctx, String(d.port), x, top - 68, 30, INK); txt(ctx, d.icon + " " + d.short, x, top - 36, 15, "#4a5b6d");
        ctx.fillStyle = "#1b2430"; ctx.fillRect(x - 46, top, 92, 150);
        if (open > 0) {
          ctx.fillStyle = "rgba(255,224,102," + (.6 * open) + ")"; ctx.fillRect(x - 46, top, 92, 150);
          drawImg(ctx, charImg(d.who, "happy"), x - 40, top + 150 - 84 * open, 80, 80);
        }
        ctx.fillStyle = d.col; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; u.rr(ctx, x - 46, top, 92, 150 * (1 - open * .85), 6); ctx.fill(); ctx.stroke();
        if (open < .5) { ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(x + 30, top + 80, 6, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
        if (refused === i && at - refT < 1.1) { pill(ctx, "refused", x, top + 60, 18, "#ffe0e4", C.bad); }
      });
      ctx.restore();
      // the parcel
      var pp = parcelPos(g);
      if (pp) { var sc = pk.state === "in" ? 1 - (at - pk.t0) / .4 : 1.2; parcel(ctx, pp.x, pp.y, Math.max(.05, sc), { label: final ? "URL" : "#" + (ji + 1) }); }
      // label card (or the browser address bar for the final job)
      if (phase === "build" || final) {
        var bw = Math.min(W - 80, 760), bxx = W / 2 - bw / 2;
        ctx.fillStyle = "#e9eef5"; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; u.rr(ctx, bxx, 18, bw, 56, 14); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; u.rr(ctx, bxx + 50, 28, bw - 64, 36, 10); ctx.fill(); ctx.stroke();
        txt(ctx, "🌐", bxx + 26, 46, 22);
        ctx.font = mono(22); ctx.textAlign = "left"; ctx.textBaseline = "middle";
        var x0 = bxx + 64, cols = ["#c25e00", "#2b6fd0", "#a626a4", "#2f8f3a"];
        built.forEach(function (p, i) { ctx.fillStyle = cols[i]; ctx.fillText(p, x0, 47); x0 += ctx.measureText(p).width; });
        if (!final && Math.sin(t * 8) > 0) { ctx.fillStyle = INK; ctx.fillRect(x0 + 2, 32, 3, 30); }
        if (!final) txt(ctx, "protocol · name · :door · /path", W / 2, 96, 18, "#4a5b6d");
      } else if (job) {
        ctx.font = mono(22); var lw = Math.min(W - 60, ctx.measureText(job.url).width + 110);
        ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; u.rr(ctx, W / 2 - lw / 2, 18, lw, 56, 14); ctx.fill(); ctx.stroke();
        txt(ctx, "📦", W / 2 - lw / 2 + 30, 47, 24);
        txt(ctx, job.url, W / 2 + 18, 47, 22, INK, "center", mono(22));
        if (phase === "pick") txt(ctx, "Which door? Look for :number, or https / http / ssh at the start.", W / 2, 96, 18, "#4a5b6d");
      }
      if (at - replyT < 2.6) pill(ctx, reply, W / 2, 132, reply.length > 50 ? 15 : 18, "#d9f7df", "#1e6b35", true);
      S.fx.draw(ctx, dt);
    }
    doorButtons(); nextJob();
    L.loop(function (dt) {
      at += dt; draw(dt); });
  }

  /* ================================================================ the game */
  RQ.game({
    id: "g09",
    music: "camp",
    intro: [
      ["tuki", "Squawk, I'm Tuki! Satellite pictures often travel across the internet before they reach us."],
      ["tuki", "Big pictures get cut into small **packets**. Let's run the Packet Post and deliver them all!"]
    ],
    outro: [
      ["tuki", "Handshakes, parcels, live video, phone books and doors. You run the internet's post office now!"],
      ["hoot", "Hoo, your forest pictures reached my lab safely! Next stop: is it really a forest?"]
    ],
    levels: [
      { title: "Handshake", goal: "SYN, SYN-ACK, ACK: catch each envelope on the ring",
        intro: [["tuki", "Before **TCP** sends a picture, two computers shake hands: **SYN**, **SYN-ACK**, **ACK**."],
                ["tuki", "Send SYN, then press ACK right when the SYN-ACK reaches your ring. Keys 1, 2 and 3 work too!"]],
        cards: ["tcp-handshake"],
        play: levelHandshake },
      { title: "Parcel Post", goal: "Number the packets, find the lost one, rebuild the picture",
        intro: [["tuki", "Your forest picture is too big for one trip. Cut it into numbered **packets** and send them through the **routers**!"],
                ["hoot", "Packets may arrive mixed up, or not at all. Check the numbers, ask for a resend, then rebuild the picture."]],
        cards: ["packet", "tcp"],
        play: levelParcels },
      { title: "Live drone video", goal: "Conceal or skip each broken frame, fast",
        intro: [["koa", "G'day, my drone streams live video with **UDP**! Each video picture, a **frame**, travels as 4 packets that can get lost or mixed up."],
                ["koa", "In this game, one missing piece means **Conceal**: patch it with the last frame's piece. Two or more missing means **Skip** that frame."]],
        cards: ["udp"],
        play: levelVideo },
      { title: "Phone book", goal: "Look up each name and stamp its IP address",
        intro: [["tuki", "To send packets, computers need an **IP address**. Older IPv4 addresses are four numbers with dots; newer IPv6 ones are longer."],
                ["tuki", "**DNS** is the internet's phone book. Find each name, and remember: your laptop keeps a **cache** of answers."]],
        cards: ["dns"],
        play: levelDNS },
      { title: "The right door", goal: "Deliver each parcel to the right port",
        intro: [["pix", "One computer has thousands of numbered doors called **ports**. Each program listens at its own door."],
                ["pix", "Read the label and pick the door: **443** HTTPS, **80** HTTP, **22** SSH, **8000** for `python -m reseed serve`."]],
        cards: ["port"],
        play: levelPorts }
    ]
  });
})();
