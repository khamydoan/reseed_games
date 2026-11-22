/* g06 Satellite Snap — orbits, revisit, pixels, latitude/longitude and GPS.
 * L1 fly the crosshair to coordinates (two numbers find any spot) · L2 time the camera over real ReSeed sites (Sentinel-2,
 * then Landsat's old album) · L3 Ketapang clouds: snap only passes under max_cloud 30 %, else wait 5 days · L4 pixel zoom:
 * drone vs 10 m vs 30 m (forest patches, not single trees) + the real site picture · L5 imaging vs navigation satellites,
 * GPS trilateration with an uncertainty circle.
 * The globe is an orthographic projection drawn in code (no textures). Real pictures are only drawn, never read back
 * (no getImageData), so everything works from file://. "#level=N&debug" exposes window.__ss for play-test scripts. */
(function () {
  "use strict";
  var u = RQ.u;
  var H = 600, TAU = Math.PI * 2, D2R = Math.PI / 180, INK = "#1d2b3a", GOLD = "#ffc53d", GREEN = "#5ee08a";
  var REDUCE = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var DEBUG = /debug/.test(location.hash);
  var DATA = RQ.data() || { sites: [] };
  var SHORT = { rondonia: "Rondônia", dixie: "Dixie Fire scar", ozarks: "Ozarks", kangaroo: "Kangaroo Island", kalimantan: "Ketapang",
    congo: "Salonga", manaus: "Manaus", manhattan: "Manhattan", la_interchange: "Los Angeles", new_capital: "New Capital",
    maldives: "Maldives", kansas: "Kansas fields", palm_desert: "Indian Wells" };
  function short(s) { return s ? SHORT[s.id] || s.name : "?"; }
  // Site lat/lon exactly as in reseed/config.py SITES. (data/reseed-data.js lat/lon are the pipeline's hotspot picture centres.)
  var CONFIG_LL = { rondonia: [-9.35, -64.35], dixie: [40.12, -121.05], ozarks: [36.87, -91.35], kangaroo: [-35.93, 136.72], kalimantan: [-1.95, 110.45], congo: [-2.05, 21.05],
    manaus: [-3.137, -59.90], manhattan: [40.758, -73.978], la_interchange: [33.927, -118.281], new_capital: [30.02, 31.76], maldives: [4.20, 73.53], kansas: [37.55, -100.85], palm_desert: [33.71, -116.32] };
  function LL(s) { var c = s && CONFIG_LL[s.id]; return c ? { lat: c[0], lon: c[1] } : { lat: s.lat, lon: s.lon }; }
  function dbg(o) { if (DEBUG) window.__ss = o; }

  /* ============================================================ map data (geo.js): simple continent outlines [lon, lat, ...] */
  var GEO_SRC = window.SS_GEO || { land: [], forest: [], desert: [], lakes: [], ice: [] };

  /* ============================================================ sphere maths */
  function V3(lat, lon) { var p = lat * D2R, l = lon * D2R, c = Math.cos(p); return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mad(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
  function angle(a, b) { return Math.acos(u.clamp(dot(a, b), -1, 1)); }
  function wrap180(d) { return ((d + 180) % 360 + 360) % 360 - 180; }
  function wrapPi(a) { return ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; }
  function slerp(a, b, t, ang) {
    if (ang < 1e-6) return a;
    var s = Math.sin(ang), wa = Math.sin((1 - t) * ang) / s, wb = Math.sin(t * ang) / s;
    return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
  }
  /** Local east / north unit vectors at a surface point. */
  function tangents(v) {
    var east = norm(cross([0, 0, 1], v)); if (!isFinite(east[0]) || Math.hypot(east[0], east[1]) < 1e-6) east = [0, 1, 0];
    return { e: east, n: cross(v, east) };
  }
  /** Point at angular offset (dx east, dy north, radians) from v. */
  function offset(v, dx, dy) { var t = tangents(v); return norm(mad(mad(v, t.e, Math.tan(dx)), t.n, Math.tan(dy))); }

  /** Camera looking at (lat0, lon0): screen x = east, screen y = north, z = towards the viewer. */
  function makeView(lat0, lon0, cx, cy, R) {
    var p = lat0 * D2R, l = lon0 * D2R, sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
    return { lat0: lat0, lon0: lon0, cx: cx, cy: cy, R: R, e: [-sl, cl, 0], n: [-sp * cl, -sp * sl, cp], f: [cp * cl, cp * sl, sp] };
  }
  /** Project a unit vector at radius r. vis: in front of the globe, or outside its silhouette. */
  function P(V, v, r) {
    r = r || 1;
    var x = dot(v, V.e) * r, y = dot(v, V.n) * r, z = dot(v, V.f) * r;
    return { x: V.cx + V.R * x, y: V.cy - V.R * y, z: z, vis: z >= 0 || x * x + y * y > 1 };
  }

  function ringOf(flat) {
    var pts = [], n = flat.length / 2, c = [0, 0, 0];
    for (var i = 0; i < n; i++) {
      var a = V3(flat[i * 2 + 1], flat[i * 2]), j = (i + 1) % n, b = V3(flat[j * 2 + 1], flat[j * 2]);
      var ang = angle(a, b), steps = Math.max(1, Math.ceil(ang / (2.5 * D2R)));
      for (var k = 0; k < steps; k++) pts.push(slerp(a, b, k / steps, ang));
      c = mad(c, a, 1);
    }
    c = norm(c);
    var rad = 0; pts.forEach(function (p) { rad = Math.max(rad, angle(c, p)); });
    return { pts: pts, c: c, r: rad };
  }
  var GEO = {};
  for (var key in GEO_SRC) GEO[key] = GEO_SRC[key].map(ringOf);
  var GRID = (function () {
    var lats = [], lons = [], la, lo;
    for (la = -75; la <= 75; la += 15) { var r = []; for (lo = -180; lo <= 180; lo += 3) r.push(V3(la, lo)); lats.push({ v: la, pts: r }); }
    for (lo = -180; lo < 180; lo += 15) { var m = []; for (la = -87; la <= 87; la += 3) m.push(V3(la, lo)); lons.push({ v: lo, pts: m }); }
    return { lats: lats, lons: lons };
  })();

  /** Path of a closed ring on the globe, cut at the horizon and joined along the limb. */
  function edgeAng(a, b) { var t = a[2] / (a[2] - b[2]), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; return Math.atan2(-y, x); }
  function ringPath(ctx, V, ring) {
    if (dot(ring.c, V.f) < Math.cos(Math.min(Math.PI, ring.r + Math.PI / 2))) return false;
    var pts = ring.pts, n = pts.length, pr = new Array(n), s = -1, i;
    for (i = 0; i < n; i++) { var v = pts[i]; pr[i] = [dot(v, V.e), dot(v, V.n), dot(v, V.f)]; if (s < 0 && pr[i][2] >= 0) s = i; }
    if (s < 0) return false;
    var cx = V.cx, cy = V.cy, R = V.R, exitA = 0;
    ctx.moveTo(cx + R * pr[s][0], cy - R * pr[s][1]);
    for (var k = 1; k <= n; k++) {
      var a = pr[(s + k - 1) % n], b = pr[(s + k) % n];
      if (a[2] >= 0 && b[2] >= 0) ctx.lineTo(cx + R * b[0], cy - R * b[1]);
      else if (a[2] >= 0) { exitA = edgeAng(a, b); ctx.lineTo(cx + R * Math.cos(exitA), cy + R * Math.sin(exitA)); }
      else if (b[2] >= 0) {
        var en = edgeAng(b, a), d = wrapPi(en - exitA);
        ctx.arc(cx, cy, R, exitA, exitA + d, d < 0);
        ctx.lineTo(cx + R * b[0], cy - R * b[1]);
      }
    }
    ctx.closePath(); return true;
  }
  function linePath(ctx, V, pts) {
    var pen = false;
    for (var i = 0; i < pts.length; i++) {
      var p = P(V, pts[i]);
      if (p.z >= 0) { if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); pen = true; } else pen = false;
    }
  }
  /** Small circle (angular radius rad) on the surface, as a foreshortened ellipse. */
  function surfEllipse(ctx, V, v, rad, minZ) {
    var p = P(V, v); if (p.z <= (minZ == null ? .02 : minZ)) return null;
    var ang = Math.atan2(p.y - V.cy, p.x - V.cx), rr = V.R * Math.sin(rad);
    ctx.ellipse(p.x, p.y, Math.max(.5, rr * p.z), rr, ang, 0, TAU);
    return p;
  }

  /* ============================================================ drawing: space, globe, satellites */
  var STARS = (function () { var r = u.seeded("g06-stars"), a = []; for (var i = 0; i < 260; i++) a.push({ x: r(), y: r(), s: .5 + r() * 1.8, p: r() * 7, c: r() < .12 ? "#ffe3a3" : r() < .12 ? "#a9d4ff" : "#ffffff" }); return a; })();
  function drawSpace(ctx, W, t) {
    var g = ctx.createLinearGradient(0, 0, W * .6, H);
    g.addColorStop(0, "#040920"); g.addColorStop(.6, "#0b1642"); g.addColorStop(1, "#1b1d55");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W * .55, H * .5); ctx.rotate(-.42);
    var m = ctx.createLinearGradient(0, -130, 0, 130);
    m.addColorStop(0, "rgba(150,130,255,0)"); m.addColorStop(.5, "rgba(180,160,255,.10)"); m.addColorStop(1, "rgba(150,130,255,0)");
    ctx.fillStyle = m; ctx.fillRect(-W, -130, W * 2, 260); ctx.restore();
    var n = ctx.createRadialGradient(W * .92, H * .1, 10, W * .92, H * .1, 380);
    n.addColorStop(0, "rgba(208,138,28,.24)"); n.addColorStop(1, "rgba(208,138,28,0)");
    ctx.fillStyle = n; ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      ctx.globalAlpha = .3 + .7 * Math.abs(Math.sin(t * (.6 + s.p * .15) + s.p));
      ctx.fillStyle = s.c; ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    // a shooting star every few seconds
    var k = t % 7.5;
    if (k < .7 && !REDUCE) {
      var sx = ((Math.floor(t / 7.5) * 397) % 1000) / 1000 * W, sy = 40 + ((Math.floor(t / 7.5) * 211) % 160);
      var gx = sx + k * 520, gy = sy + k * 170, tail = ctx.createLinearGradient(gx - 120, gy - 40, gx, gy);
      tail.addColorStop(0, "rgba(255,255,255,0)"); tail.addColorStop(1, "rgba(255,255,255," + (.9 - k) + ")");
      ctx.strokeStyle = tail; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx - 120, gy - 40); ctx.lineTo(gx, gy); ctx.stroke();
    }
  }

  var SUN = norm([-.52, .42, .74]);
  var CLOUDS = (function () { // decorative cloud clusters [lat, lon, radius°], drifting east
    var r = u.seeded("g06-clouds"), a = [];
    for (var i = 0; i < 34; i++) { var lat = (r() - .5) * 120, lon = r() * 360 - 180, puffs = []; for (var k = 0; k < 4; k++) puffs.push([lat + (r() - .5) * 7, lon + (r() - .5) * 11, 1.8 + r() * 3.2]); a.push({ puffs: puffs, sp: .8 + r() * 1.6 }); }
    return a;
  })();
  function drawSet(ctx, V, set, fill, stroke, lw) {
    ctx.fillStyle = fill; if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; }
    for (var i = 0; i < set.length; i++) { ctx.beginPath(); if (ringPath(ctx, V, set[i])) { ctx.fill(); if (stroke) ctx.stroke(); } }
  }
  function nightPath(ctx, V, k, lineOnly) {
    var cx = V.cx, cy = V.cy, R = V.R, sxy = Math.hypot(SUN[0], SUN[1]), dx = SUN[0] / sxy, dy = SUN[1] / sxy, ex = -dy, ey = dx, i, t;
    function pt(tt, kk) { var x = Math.cos(tt) * ex - kk * Math.sin(tt) * dx, y = Math.cos(tt) * ey - kk * Math.sin(tt) * dy; return [cx + R * x, cy - R * y]; }
    ctx.beginPath();
    for (i = 0; i <= 40; i++) { t = Math.PI * i / 40; var q = pt(t, k); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    if (!lineOnly) for (i = 40; i >= 0; i--) { q = pt(Math.PI * i / 40, 1); ctx.lineTo(q[0], q[1]); }
  }
  /** The whole globe. o: {grid, clouds, avoid (unit vec: no decor clouds there), under(ctx, V), hiLat, hiLon, t} */
  function drawGlobe(ctx, V, t, o) {
    o = o || {};
    var cx = V.cx, cy = V.cy, R = V.R;
    var g = ctx.createRadialGradient(cx, cy, R * .95, cx, cy, R * 1.2);
    g.addColorStop(0, "rgba(120,200,255,.6)"); g.addColorStop(.3, "rgba(90,160,255,.22)"); g.addColorStop(1, "rgba(60,120,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, TAU); ctx.fill();
    var lx = cx + SUN[0] * R * .45, ly = cy - SUN[1] * R * .45;
    var og = ctx.createRadialGradient(lx, ly, R * .05, cx, cy, R);
    og.addColorStop(0, "#5aaef2"); og.addColorStop(.6, "#2a72c9"); og.addColorStop(1, "#163d84");
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = og; ctx.fill(); ctx.clip();
    ctx.lineJoin = "round";
    drawSet(ctx, V, GEO.land, "#74c45e", "rgba(20,64,36,.55)", 1.3);
    drawSet(ctx, V, GEO.forest, "#3f9a4c", "rgba(20,64,36,.35)", 1);
    drawSet(ctx, V, GEO.desert, "#e3c98a");
    drawSet(ctx, V, GEO.lakes, "#2f78cc", "rgba(20,64,36,.4)", 1);
    drawSet(ctx, V, GEO.ice, "#eef6ff", "rgba(120,150,190,.7)", 1.2);
    if (o.grid) drawGrid(ctx, V, o);
    if (o.under) o.under(ctx, V);
    if (o.clouds) {
      ctx.fillStyle = "rgba(255,255,255," + (o.cloudAlpha || .7) + ")";
      CLOUDS.forEach(function (c) {
        c.puffs.forEach(function (p) {
          var v = V3(p[0], p[1] + t * c.sp);
          if (o.avoid && angle(v, o.avoid) < .32) return;
          ctx.beginPath(); if (surfEllipse(ctx, V, v, p[2] * D2R)) ctx.fill();
        });
      });
    }
    if (o.over) o.over(ctx, V);
    var sg = ctx.createRadialGradient(lx, ly, R * .1, cx, cy, R * 1.02);
    sg.addColorStop(0, "rgba(255,255,255,.17)"); sg.addColorStop(.55, "rgba(255,255,255,0)"); sg.addColorStop(1, "rgba(6,16,50,.4)");
    ctx.fillStyle = sg; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    // night side with a warm glow along the terminator
    var sz = SUN[2];
    [[sz, .3], [sz + (1 - sz) * .3, .22], [sz + (1 - sz) * .6, .2]].forEach(function (s) { nightPath(ctx, V, s[0]); ctx.closePath(); ctx.fillStyle = "rgba(5,9,34," + s[1] + ")"; ctx.fill(); });
    nightPath(ctx, V, sz, true);
    [[24, "rgba(255,140,60,.09)"], [11, "rgba(255,165,80,.16)"], [3, "rgba(255,205,130,.42)"]].forEach(function (s) { ctx.lineWidth = s[0]; ctx.strokeStyle = s[1]; ctx.stroke(); });
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(190,230,255,.8)"; ctx.stroke();
  }
  function drawGrid(ctx, V, o) {
    ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.3)";
    ctx.beginPath(); GRID.lats.forEach(function (l) { if (l.v) linePath(ctx, V, l.pts); }); GRID.lons.forEach(function (l) { if (l.v) linePath(ctx, V, l.pts); }); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,214,90,.95)"; ctx.beginPath(); linePath(ctx, V, GRID.lats[5].pts); ctx.stroke();
    ctx.strokeStyle = "rgba(255,120,90,.95)"; ctx.beginPath(); linePath(ctx, V, GRID.lons[12].pts); ctx.stroke();
    var dash = REDUCE ? 0 : -(o.t || 0) * 20, pts, la, lo;
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = dash; ctx.lineWidth = 3.5; ctx.strokeStyle = "#7ff3ff";
    if (o.hiLat != null) { pts = []; for (lo = -180; lo <= 180; lo += 3) pts.push(V3(o.hiLat, lo)); ctx.beginPath(); linePath(ctx, V, pts); ctx.stroke(); }
    if (o.hiLon != null) { pts = []; for (la = -88; la <= 88; la += 3) pts.push(V3(la, o.hiLon)); ctx.beginPath(); linePath(ctx, V, pts); ctx.stroke(); }
    ctx.setLineDash([]);
    // labels: latitudes along the centre meridian, longitudes along the equator
    var i;
    for (i = -60; i <= 60; i += 30) {
      var p = P(V, V3(i, V.lon0 - 12));
      if (p.z > .25) txt(ctx, i === 0 ? "0° equator" : Math.abs(i) + "° " + (i > 0 ? "N" : "S"), p.x, p.y - 9, { size: 16, color: i ? "#fff" : "#ffe27a", stroke: "rgba(5,15,40,.85)", lw: 4, align: "center" });
    }
    for (i = -150; i <= 180; i += 30) {
      var q = P(V, V3(Math.max(-60, Math.min(60, V.lat0)) - 6, i));
      if (q.z > .3) txt(ctx, i === 0 ? "0°" : Math.abs(i) + "° " + (i > 0 ? "E" : "W"), q.x, q.y, { size: 16, color: i ? "#fff" : "#ff9c80", stroke: "rgba(5,15,40,.85)", lw: 4, align: "center" });
    }
  }
  /** Cartoon satellites. kind: s2 (gold, one long wing) · ls (silver, two wings) · gps (blue, helix antenna). */
  function satSprite(ctx, x, y, ang, s, kind) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.lineJoin = "round";
    var body = kind === "ls" ? "#dfe7f0" : kind === "gps" ? "#8fb0d8" : kind === "gal" ? "#c6a8f0" : GOLD;
    [-1, 1].forEach(function (sd) {
      if (kind === "s2" && sd < 0) return;
      var len = kind === "s2" ? 36 : 24;
      ctx.beginPath(); ctx.moveTo(0, sd * 10); ctx.lineTo(0, sd * 15); ctx.stroke();
      ctx.fillStyle = "#2a5bd7"; ctx.beginPath(); ctx.rect(-8, sd * 15, 16, sd * len); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(180,215,255,.8)"; ctx.lineWidth = 1;
      for (var k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-8, sd * (15 + len * k / 4)); ctx.lineTo(8, sd * (15 + len * k / 4)); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, sd * 15); ctx.lineTo(0, sd * (15 + len)); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    });
    u.rr(ctx, -13, -10, 26, 20, 5); ctx.fillStyle = body; ctx.fill(); ctx.stroke();
    if (kind === "gps" || kind === "gal") {
      ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(20, 0); ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6;
      for (var h = 0; h < 3; h++) { ctx.beginPath(); ctx.ellipse(21 + h * 3, 0, 2, 5, 0, 0, TAU); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.arc(-4, 0, 4.5, 0, TAU); ctx.fillStyle = "#1d2b3a"; ctx.fill();
      ctx.beginPath(); ctx.arc(-5, -1.5, 1.4, 0, TAU); ctx.fillStyle = "#9fe3ff"; ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(4, -7, 6, 3);
    }
    ctx.restore();
  }
  function drawToucan(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 3) * 1.5 * s); ctx.scale(s, s);
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, 4, 6, 8, 0, 0, TAU); ctx.fillStyle = "#1d2230"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(1.5, -1, 3.5, 3.8, 0, 0, TAU); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(3, -5); ctx.quadraticCurveTo(15, -7, 16, -1); ctx.quadraticCurveTo(9, -1, 3, -1); ctx.closePath();
    ctx.fillStyle = "#ff9a1f"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(.5, -4, 1.3, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.restore();
  }

  /* ============================================================ small canvas helpers */
  function txt(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = (o.w || 600) + " " + (o.size || 20) + "px Fredoka, sans-serif";
    ctx.textAlign = o.align || "left"; ctx.textBaseline = o.base || "middle";
    if (o.max) { var w0 = ctx.measureText(s).width; if (w0 > o.max) { ctx.font = (o.w || 600) + " " + Math.max(11, (o.size || 20) * o.max / w0) + "px Fredoka, sans-serif"; } }
    if (o.stroke) { ctx.lineWidth = o.lw || 5; ctx.strokeStyle = o.stroke; ctx.lineJoin = "round"; ctx.strokeText(s, x, y); }
    ctx.fillStyle = o.color || "#fff"; ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  }
  function panel(ctx, x, y, w, h, o) {
    o = o || {};
    ctx.fillStyle = "rgba(0,0,0,.3)"; u.rr(ctx, x, y + 5, w, h, o.r || 16); ctx.fill();
    u.rr(ctx, x, y, w, h, o.r || 16); ctx.fillStyle = o.fill || "rgba(12,22,56,.88)"; ctx.fill();
    ctx.lineWidth = o.lw || 3; ctx.strokeStyle = o.stroke || "rgba(255,214,107,.75)"; ctx.stroke();
  }
  function chip(ctx, s, x, y, bg, fg, o) {
    o = o || {};
    ctx.font = "700 " + (o.size || 18) + "px Fredoka, sans-serif";
    var w = ctx.measureText(s).width + 22, h = (o.size || 18) + 14, x0 = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    u.rr(ctx, x0, y - h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = fg || INK; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(s, x0 + 11, y + 1);
    return w;
  }
  function pin(ctx, x, y, c, s) {
    s = s || 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-11, -14, -11, -26, 0, -28); ctx.bezierCurveTo(11, -26, 11, -14, 0, 0);
    ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -19, 4, 0, TAU); ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore();
  }
  function fmtLat(v, d) { var a = Math.abs(v).toFixed(d || 0); return +a === 0 ? "0°" : a + "° " + (v > 0 ? "N" : "S"); }
  function fmtLon(v, d) { var a = Math.abs(v).toFixed(d || 0); return +a === 0 ? "0°" : a + "° " + (v > 0 ? "E" : "W"); }
  function sgn(v, d) { var s = v.toFixed(d || 0); return +s === 0 ? (0).toFixed(d || 0) : s; }
  function loadImg(src) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; }); }
  function drawPic(ctx, img, x, y, w, h) { if (img) ctx.drawImage(img, x, y, w, h); else { ctx.fillStyle = "#3f6b3a"; ctx.fillRect(x, y, w, h); } }
  function puffs(ctx, x, y, w, cover, seed) {
    if (!cover) return;
    var r = u.seeded("puff" + seed), n = Math.max(1, Math.round(cover / 7));
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, w); ctx.clip();
    if (cover >= 60) { ctx.fillStyle = "rgba(240,244,250," + (cover / 140) + ")"; ctx.fillRect(x, y, w, w); }
    for (var i = 0; i < n; i++) {
      var px = x + r() * w, py = y + r() * w, pr = w * (.045 + r() * .05 + cover / 1100);
      ctx.fillStyle = "rgba(255,255,255,.93)";
      ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.arc(px + pr * .8, py + pr * .2, pr * .75, 0, TAU); ctx.arc(px - pr * .7, py + pr * .3, pr * .6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* ============================================================ stage: canvas + control bar */
  function stage(L, label) {
    var root = u.el("div", { class: "fill ss-root" }), view = u.el("div", { class: "ss-view" }), bar = u.el("div", { class: "ss-bar" });
    var info = u.el("div", { class: "ss-info", "aria-live": "polite" });
    bar.appendChild(info); root.appendChild(view); root.appendChild(bar); L.stage.appendChild(root);
    var S = { L: L, bar: bar, W: 1200, fx: [], flash: 0, shake: 0 };
    var cv = L.canvas({ w: 1200, h: H, parent: view, fill: true, label: label, onResize: function (api) { S.W = api.w; } });
    S.cv = cv; S.ctx = cv.ctx; S.W = cv.w;
    S.info = function (s) { info.innerHTML = RQ.ui.md(s).replace(/\[(\w+)\]/g, "<kbd>$1</kbd>"); };
    S.btn = function (html, cls, fn) {
      var b = u.el("button", { class: "btn " + (cls || ""), html: html });
      L.on(b, "click", function (e) { b.blur(); fn(e); });
      bar.appendChild(b); return b;
    };
    /** keydown that ignores keys while a speech bubble or modal owns the keyboard. */
    S.keys = function (fn) { L.on(window, "keydown", function (e) { if (document.querySelector(".rq-overlay, .rq-talk")) return; fn(e); }); };
    S.burst = function (x, y, c, n) {
      for (var i = 0; i < (n || 20); i++) {
        var a = Math.random() * TAU, sp = u.rand(60, 280);
        S.fx.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: u.rand(.5, .95), max: .95, c: c || u.pick([GOLD, "#fff", "#7fe0a0", "#ff9f6b"]), r: u.rand(2, 5) });
      }
    };
    S.pop = function (x, y, s, c, size) { S.fx.push({ text: s, x: x, y: y, vy: -36, life: 1.5, max: 1.5, c: c || "#fff", size: size || 30 }); };
    S.ring = function (x, y, c) { S.fx.push({ ring: true, x: x, y: y, life: .7, max: .7, c: c || GOLD }); };
    S.frame = function (dt, draw) {
      var ctx = S.ctx;
      S.flash = Math.max(0, S.flash - dt * 2.6); S.shake = Math.max(0, S.shake - dt);
      ctx.save();
      if (S.shake > 0 && !REDUCE) ctx.translate(u.rand(-6, 6) * S.shake * 3, u.rand(-6, 6) * S.shake * 3);
      draw(ctx);
      S.fx = S.fx.filter(function (p) {
        p.life -= dt; var k = Math.max(0, p.life / p.max);
        if (p.text) {
          p.y += p.vy * dt; ctx.globalAlpha = Math.min(1, k * 2);
          txt(ctx, p.text, p.x, p.y, { size: p.size * (1 + (1 - k) * .15), w: 700, color: p.c, stroke: "rgba(8,14,40,.9)", lw: 6, align: "center" });
        } else if (p.ring) {
          ctx.globalAlpha = k; ctx.lineWidth = 4 * k + 1; ctx.strokeStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, 10 + (1 - k) * 70, 0, TAU); ctx.stroke();
        } else {
          p.vx *= .96; p.vy = p.vy * .96 + 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.globalAlpha = k; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
        return p.life > 0;
      });
      ctx.restore();
      if (S.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + Math.min(1, S.flash) + ")"; ctx.fillRect(0, 0, S.W, H); }
    };
    return S;
  }

  /* ============================================================ photo album (prints slide in, develop, then file away) */
  function album(S) {
    var A = { list: [] };
    function slot(i) {
      var n = A.list.length, rows = Math.max(3, Math.ceil(n / 2)), rowH = Math.min(166, 460 / rows);
      return { x: S.W - 228 + (i % 2) * 142, y: 116 + Math.floor(i / 2) * rowH, w: 122 };
    }
    /** p: {img, title, sub, cloud, bad, dx (showcase offset)} */
    A.add = function (p) {
      p.t = 0; p.rot = u.rand(-.07, .07); p.seed = A.list.length + ":" + (p.title || "");
      A.list.push(p); RQ.audio.sfx("whoosh"); return p;
    };
    A.draw = function (ctx, dt, t) {
      txt(ctx, "📒 Photo album", S.W - 157, 30, { size: 20, w: 700, color: "#ffd46b", align: "center" });
      if (!A.list.length) {
        ctx.setLineDash([8, 7]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.3)";
        for (var k = 0; k < 4; k++) { var e = slot(k); u.rr(ctx, e.x - 61, e.y - 74, 122, 148, 8); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      var showing = [];
      A.list.forEach(function (p, i) {
        p.t += dt;
        var s = slot(i), hx = S.W - 330 + (p.dx || 0), hy = 290, x, y, w, rot;
        var hold = p.hold || 2.6;
        if (p.t < hold) {
          var k = Math.min(1, p.t / .4);
          w = 250 * (REDUCE ? 1 : .25 + .75 * u.ease.outBack(k)); x = hx + (1 - u.ease.outCubic(k)) * 260; y = hy; rot = p.rot + (1 - k) * .4;
          showing.push([p, x, y, w, rot]); return;
        }
        var f = u.ease.inOut(Math.min(1, (p.t - hold) / .6));
        x = u.lerp(hx, s.x, f); y = u.lerp(hy, s.y, f); w = u.lerp(250, s.w, f); rot = p.rot;
        if (f < 1) showing.push([p, x, y, w, rot]); else print(ctx, p, x, y, w, rot, t);
      });
      showing.forEach(function (q) { print(ctx, q[0], q[1], q[2], q[3], q[4], t); });
    };
    function print(ctx, p, x, y, w, rot, t) {
      var h = w * 1.22, pad = w * .07, iw = w - pad * 2, dev = Math.min(1, Math.max(0, (p.t - .3) / 1.2));
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillStyle = "rgba(0,0,0,.35)"; u.rr(ctx, -w / 2 + 4, -h / 2 + 7, w, h, 6); ctx.fill();
      ctx.fillStyle = "#fffdf5"; u.rr(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      var ix = -w / 2 + pad, iy = -h / 2 + pad;
      drawPic(ctx, p.img, ix, iy, iw, iw);
      if (p.cloud) puffs(ctx, ix, iy, iw, p.cloud, p.seed);
      if (dev < 1) { ctx.fillStyle = "rgba(38,30,24," + (1 - dev) + ")"; ctx.fillRect(ix, iy, iw, iw); }
      ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(29,43,58,.5)"; ctx.strokeRect(ix, iy, iw, iw);
      if (p.bad && dev > .6) {
        ctx.save(); ctx.translate(0, iy + iw / 2); ctx.rotate(-.25); ctx.globalAlpha = Math.min(1, (dev - .6) * 3);
        txt(ctx, "✗ TOO CLOUDY", 0, 0, { size: w * .12, w: 700, color: "#d1495b", stroke: "#fff", lw: 4, align: "center" });
        ctx.restore();
      }
      var big = w > 180;
      txt(ctx, p.title || "", 0, iy + iw + (h - iw - pad) * (big ? .36 : .45), { size: big ? 21 : 15, w: 700, color: INK, align: "center", max: iw });
      if (big && p.sub) txt(ctx, p.sub, 0, iy + iw + (h - iw - pad) * .74, { size: 16, w: 500, color: "#4a5b6d", align: "center", max: iw });
      ctx.restore();
    }
    return A;
  }

  /** Keyboard cursor for "tap" tasks: arrows move a crosshair, Enter/Space taps. Pointer taps work as usual. */
  function tapper(S, L, enabled, onTap) {
    var c = { x: 600, y: 260, on: false };
    L.on(S.cv.cv, "pointerdown", function (e) { if (!enabled()) return; var p = S.cv.toLocal(e); c.on = false; onTap(p.x, p.y); });
    S.keys(function (e) {
      if (!enabled()) return;
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (d) { e.preventDefault(); if (!c.on) { c.on = true; c.x = c.x0 || S.W / 2; c.y = c.y0 || 260; } c.x = u.clamp(c.x + d[0] * 12, 0, S.W); c.y = u.clamp(c.y + d[1] * 12, 0, H); return; }
      if ((e.key === "Enter" || e.key === " ") && c.on) { e.preventDefault(); onTap(c.x, c.y); }
    });
    c.draw = function (ctx, t) {
      if (!c.on || !enabled()) return;
      ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(c.x, c.y, 14 + Math.sin(t * 6) * 2, 0, TAU);
      ctx.moveTo(c.x - 24, c.y); ctx.lineTo(c.x - 8, c.y); ctx.moveTo(c.x + 8, c.y); ctx.lineTo(c.x + 24, c.y);
      ctx.moveTo(c.x, c.y - 24); ctx.lineTo(c.x, c.y - 8); ctx.moveTo(c.x, c.y + 8); ctx.lineTo(c.x, c.y + 24); ctx.stroke();
      txt(ctx, "Enter = tap", c.x + 18, c.y + 30, { size: 16, color: "#fff", stroke: INK, lw: 4 });
    };
    return c;
  }

  function sitesAll() { return (DATA.sites || []).map(function (s) { return { s: s, v: V3(LL(s).lat, LL(s).lon) }; }); } // the 13 real ReSeed sites
  function drawSitePins(ctx, V, list, t, hiIds) {
    list.forEach(function (o) {
      var p = P(V, o.v); if (p.z < .08) return;
      var hi = hiIds && hiIds.indexOf(o.s.id) >= 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, hi ? 6 : 3.6, 0, TAU); ctx.fillStyle = hi ? GOLD : "#ffe9a8"; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
      if (hi) txt(ctx, short(o.s), p.x + 10, p.y - 2, { size: 16, w: 700, color: "#fff", stroke: "rgba(5,15,40,.9)", lw: 4 });
    });
  }

  function crosshair(ctx, x, y, ok, t) {
    var c = ok ? GREEN : GOLD, r = 18 + (ok ? 0 : Math.sin(t * 5) * 2);
    function path() { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.moveTo(x - r - 12, y); ctx.lineTo(x - r + 7, y); ctx.moveTo(x + r - 7, y); ctx.lineTo(x + r + 12, y);
      ctx.moveTo(x, y - r - 12); ctx.lineTo(x, y - r + 7); ctx.moveTo(x, y + r - 7); ctx.lineTo(x, y + r + 12); ctx.stroke(); }
    ctx.lineWidth = 7; ctx.strokeStyle = "rgba(5,15,40,.7)"; path();
    ctx.lineWidth = 3.5; ctx.strokeStyle = c; path();
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fillStyle = c; ctx.fill();
  }
  function miniPhoto(ctx, img, x, y, w, title, k) {
    var h = w * 1.2, pad = w * .07, iw = w - 2 * pad;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(.06);
    ctx.fillStyle = "rgba(0,0,0,.35)"; u.rr(ctx, -w / 2 + 4, -h / 2 + 6, w, h, 6); ctx.fill();
    ctx.fillStyle = "#fffdf5"; u.rr(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    drawPic(ctx, img, -w / 2 + pad, -h / 2 + pad, iw, iw);
    txt(ctx, title, 0, h / 2 - (h - iw - pad) / 2, { size: 16, w: 700, color: INK, align: "center", max: iw });
    ctx.restore();
  }

  /* ============================================================ L1: two numbers find any spot */
  function levelLatLon(L) {
    var S = stage(L, "globe with latitude and longitude lines");
    var mine = RQ.mySite() || { id: "rondonia", lat: -9.8, lon: -64.3, name: "Rondônia" };
    var kang = RQ.site("kangaroo") || { id: "kangaroo", lat: -36, lon: 136.7, name: "Kangaroo Island" };
    var TASKS = [
      { lat: 40, lon: null, ok: "**40° N**: as far north as New York City!" },
      { lat: null, lon: 0, ok: "**0°**: the prime meridian, through Greenwich in London." },
      { lat: 0, lon: 0, ok: "**0, 0**: \"Null Island\". Only fish live here!" },
      { lat: Math.round(LL(mine).lat), lon: Math.round(LL(mine).lon), site: mine, ok: "My Site: **" + short(mine) + "**!" },
      { lat: Math.round(LL(kang).lat), lon: Math.round(LL(kang).lon), site: kang, ok: "**Kangaroo Island**: Koa's home!" }
    ];
    var imgs = {};
    [mine, kang].forEach(function (s) { if (s.files) loadImg(RQ.url(s.files.thumb)).then(function (im) { imgs[s.id] = im; }); });
    var pins = sitesAll(), probe = { lat: 12, lon: -38 }, cam = { lat: 12, lon: -38 };
    var ti = 0, taskT = 0, lockT = -1, total = 0, finished = false, hold = {}, drag = null, found = [], R = 228, G = { cx: 400, cy: 300 };
    L.hud.set("task", "🎯 1 / " + TASKS.length);
    S.info("Fly the crosshair with the **arrow keys**, the buttons, or by **dragging** the globe.");

    var DIRS = { n: [1, 0], s: [-1, 0], w: [0, -1], e: [0, 1] };
    var KEYS = { ArrowUp: "n", w: "n", W: "n", ArrowDown: "s", s: "s", S: "s", ArrowLeft: "w", a: "w", A: "w", ArrowRight: "e", d: "e", D: "e" };
    function step(d, amt) {
      if (lockT >= 0 || finished) return;
      probe.lat = u.clamp(probe.lat + DIRS[d][0] * amt, -80, 80); probe.lon = wrap180(probe.lon + DIRS[d][1] * amt);
    }
    function press(d) { if (hold[d]) return; hold[d] = { t: 0 }; step(d, 1); RQ.audio.sfx("tick"); }
    S.keys(function (e) { var d = KEYS[e.key]; if (!d) return; e.preventDefault(); if (!e.repeat) press(d); });
    // key-up / pointer-up must also work while paused or under a bubble, so they are raw listeners (removed at level end)
    function keyUp(e) { var d = KEYS[e.key]; if (d) delete hold[d]; }
    function ptrUp() { drag = null; }
    function blur() { hold = {}; drag = null; }
    window.addEventListener("keyup", keyUp); window.addEventListener("pointerup", ptrUp); window.addEventListener("blur", blur);
    L.onEnd(function () { window.removeEventListener("keyup", keyUp); window.removeEventListener("pointerup", ptrUp); window.removeEventListener("blur", blur); });
    [["⬅ W", "w", "west"], ["⬆ N", "n", "north"], ["⬇ S", "s", "south"], ["➡ E", "e", "east"]].forEach(function (b) {
      var el = u.el("button", { class: "btn ss-pad", html: b[0], "aria-label": "Move " + b[2] });
      L.on(el, "pointerdown", function (e) { e.preventDefault(); press(b[1]); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ty) { L.on(el, ty, function () { delete hold[b[1]]; }); });
      L.on(el, "click", function (e) { if (e.detail === 0) step(b[1], 1); });
      S.bar.appendChild(el);
    });
    L.on(S.cv.cv, "pointerdown", function (e) {
      var p = S.cv.toLocal(e); if (Math.hypot(p.x - G.cx, p.y - G.cy) > R * 1.15) return;
      drag = { x: p.x, y: p.y, lat: probe.lat, lon: probe.lon };
      try { S.cv.cv.setPointerCapture(e.pointerId); } catch (er) { /* old browsers */ }
    });
    L.on(S.cv.cv, "pointermove", function (e) {
      if (!drag || lockT >= 0 || finished) return;
      var p = S.cv.toLocal(e), k = 57.3 / R;
      probe.lat = u.clamp(drag.lat + (p.y - drag.y) * k, -80, 80);
      probe.lon = wrap180(drag.lon - (p.x - drag.x) * k / Math.max(.35, Math.cos(probe.lat * D2R)));
    });

    function okLat(tk) { return tk.lat == null || Math.abs(probe.lat - tk.lat) <= 2.5; }
    function okLon(tk) { return tk.lon == null || Math.abs(wrap180(probe.lon - tk.lon)) <= 2.5; }
    function lock(tk) {
      lockT = 0; drag = null; hold = {};
      RQ.audio.sfx("good"); L.timeout(function () { RQ.audio.sfx("chirp"); }, 160);
      S.burst(G.cx, G.cy, null, 28); S.ring(G.cx, G.cy, GREEN); S.pop(G.cx, G.cy - 64, "✓ Found it!", "#8ff7b4", 30);
      L.toast(tk.ok, "good", 2200);
      if (tk.site) found.push(tk.site.id);
    }
    async function next() {
      lockT = -1; taskT = 0; ti++;
      if (ti >= TASKS.length) { finish(); return; }
      L.hud.set("task", "🎯 " + (ti + 1) + " / " + TASKS.length);
      if (ti === 3) await L.say("tuki", "Minus means **south** for latitude and **west** for longitude. Now find My Site!");
    }
    async function finish() {
      finished = true;
      var secs = Math.round(total);
      await L.wait(500); if (!L.alive) return;
      var a = await L.choose("tuki", "ReSeed's Rondônia site is at **-9.35, -64.35**. What does the minus in **-64.35** mean?", ["West of the prime meridian", "South of the equator", "Under the sea"]);
      if (!L.alive) return;
      var right = a === 0;
      if (right) { RQ.audio.sfx("good"); await L.say("tuki", "Yes! A minus longitude means **west**, and a minus latitude means **south**.", { mood: "happy" }); }
      else { RQ.audio.sfx("bad"); await L.say("tuki", "Not quite! Minus means **west** for longitude and **south** for latitude.", { mood: "think" }); }
      if (!L.alive) return;
      L.win({ stars: 1 + (right ? 1 : 0) + (secs <= 120 ? 1 : 0), msg: "Two numbers found every spot. You flew to **" + TASKS.length + "** places!",
        stats: { "Places": TASKS.length + " / " + TASKS.length, "Flight time": secs + " s", "Minus quiz": right ? "✓" : "✗" } });
    }

    function readout(ctx, tk) {
      var w = 360, x = S.W - w - 18, y = 20, h = 360;
      panel(ctx, x, y, w, h);
      txt(ctx, "🎯 FLY TO   (" + Math.min(ti + 1, TASKS.length) + " / " + TASKS.length + ")", x + 18, y + 26, { size: 18, w: 700, color: "#ffd46b" });
      if (!tk) { txt(ctx, "All places found! 🎉", x + 18, y + 70, { size: 26, w: 700 }); return; }
      txt(ctx, "lat " + (tk.lat == null ? "any" : tk.lat) + "    lon " + (tk.lon == null ? "any" : tk.lon), x + 18, y + 64, { size: 30, w: 700 });
      function row(y0, name, hint, val, want, fmt, arrows, ok, isLat) {
        txt(ctx, name, x + 18, y0, { size: 16, w: 700, color: "#9fb6e8" });
        txt(ctx, hint, x + w - 18, y0, { size: 16, color: "#9fb6e8", align: "right" });
        txt(ctx, "you: " + sgn(val), x + 18, y0 + 32, { size: 26, w: 700 });
        txt(ctx, "= " + fmt(val), x + 168, y0 + 32, { size: 20, color: "#cfe0ff" });
        var st, bg;
        if (want == null) { st = "✓ any number"; bg = "#c8f7d6"; }
        else if (ok || lockT >= 0) { st = "✓ " + want + " = " + fmt(want); bg = "#c8f7d6"; }
        else { var d = isLat ? want - val : wrap180(want - val); st = (d > 0 ? arrows[0] : arrows[1]) + "  to " + want; bg = "#ffe08a"; }
        chip(ctx, st, x + 18, y0 + 72, bg, INK, { size: 18 });
      }
      row(y + 108, "LATITUDE", "south ↕ north", probe.lat, tk.lat, fmtLat, ["⬆ go north", "⬇ go south"], okLat(tk), true);
      row(y + 208, "LONGITUDE", "west ↔ east", probe.lon, tk.lon, fmtLon, ["➡ go east", "⬅ go west"], okLon(tk), false);
      txt(ctx, "➖ Minus means south or west.", x + 18, y + h - 26, { size: 17, color: "#ffd46b" });
    }
    function draw(ctx, t, tk) {
      drawSpace(ctx, S.W, t);
      var V = makeView(cam.lat, cam.lon, G.cx, G.cy, R);
      drawGlobe(ctx, V, t, { grid: true, clouds: true, cloudAlpha: .42, avoid: V3(cam.lat, cam.lon), t: t, hiLat: tk && lockT < 0 ? tk.lat : null, hiLon: tk && lockT < 0 ? tk.lon : null });
      drawSitePins(ctx, V, pins, t, found);
      if (tk && lockT < 0 && tk.lat != null && tk.lon != null && taskT > (L.fails ? 6 : 16)) {
        var gp = P(V, V3(tk.lat, tk.lon));
        if (gp.z > .05) {
          ctx.globalAlpha = .6 + .3 * Math.sin(t * 5); pin(ctx, gp.x, gp.y, "#7ff3ff", 1); ctx.globalAlpha = 1;
          txt(ctx, "💡 here", gp.x + 14, gp.y - 30, { size: 17, w: 700, color: "#7ff3ff", stroke: INK, lw: 4 });
        }
      }
      var cp = P(V, V3(probe.lat, probe.lon)), ok = lockT >= 0;
      crosshair(ctx, cp.x, cp.y, ok, t);
      chip(ctx, "lat " + sgn(probe.lat) + "  ·  lon " + sgn(probe.lon), cp.x, cp.y + 46, ok ? "#c8f7d6" : "#fff4d1", INK, { align: "center", size: 18 });
      if (ok && tk && tk.site) miniPhoto(ctx, imgs[tk.site.id], cp.x + 120, cp.y - 96, 140, short(tk.site), u.ease.outBack(Math.min(1, lockT / .45)));
      readout(ctx, tk);
    }
    L.loop(function (dt, t) {
      var tk = TASKS[ti];
      for (var d in hold) { hold[d].t += dt; if (hold[d].t > .28) step(d, Math.min(60, 16 + (hold[d].t - .28) * 40) * dt); }
      if (!finished) total += dt;
      if (lockT < 0) taskT += dt; else lockT += dt;
      if (tk && !finished && lockT < 0 && okLat(tk) && okLon(tk)) lock(tk);
      if (tk && lockT >= 0) {
        var kk = Math.min(1, dt * 10);
        if (tk.lat != null) probe.lat += (tk.lat - probe.lat) * kk;
        if (tk.lon != null) probe.lon = wrap180(probe.lon + wrap180(tk.lon - probe.lon) * kk);
        if (lockT > 2) next();
      }
      var k = Math.min(1, dt * 14);
      cam.lat += (probe.lat - cam.lat) * k; cam.lon = wrap180(cam.lon + wrap180(probe.lon - cam.lon) * k);
      G.cx = u.clamp(S.W * .36, R + 30, S.W - 395 - R);
      dbg({ level: 1, ti: ti, task: tk ? { lat: tk.lat, lon: tk.lon } : null, lat: probe.lat, lon: probe.lon, locked: lockT >= 0, finished: finished });
      S.frame(dt, function (ctx) { draw(ctx, t, finished ? null : tk); });
    });
  }

  /* ============================================================ satellites passing over a target (L2, L3) */
  var RS = 1.3, OMEGA = .5;
  function orbitThrough(T, az) { var tg = tangents(T), a = az * D2R; return { T: T, Hd: norm(mad(mad([0, 0, 0], tg.n, Math.cos(a)), tg.e, Math.sin(a))) }; }
  function orbitPos(o, uu) { var c = Math.cos(uu), s = Math.sin(uu); return [o.T[0] * c + o.Hd[0] * s, o.T[1] * c + o.Hd[1] * s, o.T[2] * c + o.Hd[2] * s]; }
  function makeTargetClouds(T, cover, seed) {
    var r = u.seeded("g06-tc" + seed), out = [], n = Math.round(cover / 100 * 36), i;
    for (i = 0; i < n; i++) {
      var a = r() * TAU, d = cover < 30 ? .1 + r() * .12 : r() * .2;
      out.push({ v: offset(T, Math.cos(a) * d, Math.sin(a) * d), r: .025 + r() * .03 + cover / 1300 });
    }
    if (cover >= 30) for (i = 0; i < 5; i++) out.push({ v: offset(T, (r() - .5) * .08, (r() - .5) * .08), r: .045 + r() * .02 + cover / 2500 });
    return out;
  }
  function snapWorld(S) {
    var Wd = { cam: { lat: 18, lon: -30 }, anim: null, sats: [], orbits: [], f: 1, foot: .1, slow: .38, T: null, site: null,
      frozen: true, tclouds: [], cloudA: 0, done: false, tp: null };
    Wd.geom = function () { var R = 222; return { cx: u.clamp(S.W * .4, R + 40, S.W - 300 - R - 20), cy: 300, R: R }; };
    Wd.view = function () { var g = Wd.geom(); return makeView(Wd.cam.lat, Wd.cam.lon, g.cx, g.cy, g.R); };
    Wd.camFor = function (s) { var c = LL(s); return { lat: u.clamp(c.lat - 22, -64, 64), lon: c.lon - 36 }; };
    /** Rotate the camera (spins = extra whole turns: the Earth spinning under us, days passing). */
    Wd.camTo = function (lat, lon, dur, spins) {
      var from = { lat: Wd.cam.lat, lon: Wd.cam.lon };
      return new Promise(function (res) { Wd.anim = { from: from, dLat: lat - from.lat, dLon: wrap180(lon - from.lon) - 360 * (spins || 0), t: 0, dur: REDUCE ? .05 : dur, res: res }; });
    };
    Wd.setup = function (site, kind) {
      var c = LL(site); Wd.site = site; Wd.T = V3(c.lat, c.lon); Wd.done = false;
      var main = orbitThrough(Wd.T, 194), decor = orbitThrough(V3(u.clamp(c.lat + 10, -70, 70), c.lon + 64), 192), s2 = kind === "s2";
      Wd.orbits = [main, decor];
      Wd.sats = [
        { kind: "s2", name: "Sentinel-2", orbit: s2 ? main : decor, u: -1.35, active: s2 },
        { kind: "s2", name: "Sentinel-2", orbit: s2 ? main : decor, u: -1.35 + Math.PI, active: s2 },
        { kind: "ls", name: "Landsat", orbit: s2 ? decor : main, u: s2 ? .6 : -1.35, active: !s2 }
      ];
    };
    Wd.update = function (dt) {
      if (Wd.anim) {
        var a = Wd.anim; a.t += dt;
        var k = u.ease.inOut(Math.min(1, a.t / a.dur));
        Wd.cam.lat = a.from.lat + a.dLat * k; Wd.cam.lon = wrap180(a.from.lon + a.dLon * k);
        if (a.t >= a.dur) { Wd.anim = null; a.res(); }
      }
      if (Wd.frozen) return;
      var near = 9;
      Wd.sats.forEach(function (s) { if (!s.active) return; var du = wrapPi(s.u); near = Math.min(near, du <= Wd.foot + .05 ? -du : TAU - du); });
      var want = near < .5 ? Wd.slow : near > 1.6 ? 2.3 : 1;
      Wd.f += (want - Wd.f) * Math.min(1, dt * 5);
      Wd.sats.forEach(function (s) {
        var prev = wrapPi(s.u); s.u += OMEGA * Wd.f * dt;
        var du = wrapPi(s.u);
        if (s.active && prev > -1 && prev <= Wd.foot + .05 && du > Wd.foot + .05 && Wd.onPass) Wd.onPass(s);
      });
    };
    /** Where is the nearest working camera relative to the target? state: in · early · late · none */
    Wd.check = function () {
      var best = null;
      Wd.sats.forEach(function (s) { if (!s.active) return; var du = wrapPi(s.u); if (!best || Math.abs(du) < Math.abs(best.du)) best = { du: du, sat: s }; });
      if (!best || Wd.frozen) return { state: "none", du: 9 };
      var a = Math.abs(best.du);
      best.state = a <= Wd.foot ? "in" : a < .7 ? (best.du < 0 ? "early" : "late") : "none";
      best.perfect = a <= .045;
      return best;
    };
    function ringOrbit(ctx, V, ob, a) {
      ctx.setLineDash([4, 7]); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(200,225,255," + a + ")"; ctx.beginPath();
      var pen = false;
      for (var i = 0; i <= 110; i++) {
        var p = P(V, orbitPos(ob, i / 110 * TAU), RS);
        if (p.vis) { if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); pen = true; } else pen = false;
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    function trail(ctx, V, s) {
      var n = 26, prev = null, col = s.kind === "ls" ? "159,208,255" : "255,197,61";
      for (var i = 0; i <= n; i++) {
        var p = P(V, orbitPos(s.orbit, s.u - 1.05 * (1 - i / n)), RS);
        if (prev && p.vis && prev.vis) {
          ctx.strokeStyle = "rgba(" + col + "," + (i / n * (s.active ? .9 : .45)) + ")"; ctx.lineWidth = 1 + i / n * (s.active ? 5 : 3);
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
        prev = p;
      }
    }
    function swaths(ctx, V) {
      ctx.lineCap = "round";
      Wd.sats.forEach(function (s) {
        if (!s.active) return;
        var prev = null;
        for (var i = 0; i <= 30; i++) {
          var p = P(V, orbitPos(s.orbit, s.u - 1.3 * (1 - i / 30)));
          if (prev && p.z > 0 && prev.z > 0) {
            ctx.strokeStyle = "rgba(255,214,107," + (.04 + .16 * i / 30) + ")"; ctx.lineWidth = 2 * Wd.foot * V.R * Math.max(.3, p.z);
            ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          }
          prev = p;
        }
      });
      ctx.lineCap = "butt";
    }
    function targetClouds(ctx, V) {
      if (!Wd.tclouds.length || Wd.cloudA <= 0) return;
      ctx.globalAlpha = Wd.cloudA;
      ctx.save(); ctx.translate(3, 5); ctx.fillStyle = "rgba(10,30,70,.25)";
      Wd.tclouds.forEach(function (c) { ctx.beginPath(); if (surfEllipse(ctx, V, c.v, c.r)) ctx.fill(); });
      ctx.restore(); ctx.fillStyle = "rgba(255,255,255,.95)";
      Wd.tclouds.forEach(function (c) { ctx.beginPath(); if (surfEllipse(ctx, V, c.v, c.r)) ctx.fill(); });
      ctx.globalAlpha = 1;
    }
    function footprint(ctx, V, s) {
      var g = orbitPos(s.orbit, s.u), gp = P(V, g); if (gp.z < .05) return;
      var a = orbitPos(s.orbit, s.u + Math.PI / 2), c = cross(g, a), f = Wd.foot;
      var cs = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(function (k) { return P(V, norm(mad(mad(g, a, Math.tan(f) * k[0]), c, Math.tan(f) * k[1]))); });
      var sp = P(V, g, RS), inW = Math.abs(wrapPi(s.u)) <= f && !Wd.done, col = inW ? GREEN : GOLD;
      if (sp.vis) {
        ctx.beginPath();
        for (var i = 0; i < 4; i++) { var p0 = cs[i], p1 = cs[(i + 1) % 4]; ctx.moveTo(sp.x, sp.y); ctx.lineTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.closePath(); }
        ctx.fillStyle = inW ? "rgba(94,224,138,.16)" : "rgba(255,214,107,.1)"; ctx.fill();
      }
      ctx.beginPath(); cs.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath();
      ctx.fillStyle = inW ? "rgba(94,224,138,.22)" : "rgba(255,214,107,.12)"; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath();
      cs.forEach(function (p, i) { var q = cs[(i + 1) % 4], r = cs[(i + 3) % 4]; ctx.moveTo(p.x + (q.x - p.x) * .3, p.y + (q.y - p.y) * .3); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x + (r.x - p.x) * .3, p.y + (r.y - p.y) * .3); });
      ctx.stroke();
    }
    function targetMark(ctx, V, t) {
      var p = P(V, Wd.T); Wd.tp = p.z > .02 ? p : null; if (!Wd.tp) return;
      var c = Wd.done ? GREEN : "#ff6b6b";
      for (var i = 0; i < 2; i++) {
        var k = (t * .8 + i * .5) % 1; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3; ctx.strokeStyle = c;
        ctx.beginPath(); surfEllipse(ctx, V, Wd.T, .03 + k * .09); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.beginPath(); surfEllipse(ctx, V, Wd.T, .032); ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke();
      pin(ctx, p.x, p.y, c, .9);
    }
    function sprite(ctx, V, s) {
      var p = P(V, orbitPos(s.orbit, s.u), RS); if (!p.vis) return;
      var q = P(V, orbitPos(s.orbit, s.u + .02), RS), sc = (.8 + .2 * Math.max(-1, p.z)) * (s.active ? 1.05 : .82);
      if (p.z < 0) ctx.globalAlpha = .75;
      satSprite(ctx, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), sc, s.kind);
      chip(ctx, s.name, p.x, p.y - 44 * sc, s.kind === "ls" ? "#d6ecff" : "#ffe9a8", INK, { align: "center", size: 16 });
      ctx.globalAlpha = 1;
    }
    Wd.draw = function (ctx, t) {
      var V = Wd.view(); Wd.V = V;
      drawGlobe(ctx, V, t, { clouds: true, avoid: Wd.T, under: swaths, over: targetClouds });
      Wd.orbits.forEach(function (ob, i) { ringOrbit(ctx, V, ob, i ? .18 : .35); });
      Wd.sats.forEach(function (s) { trail(ctx, V, s); });
      if (!Wd.frozen) Wd.sats.forEach(function (s) { if (s.active) footprint(ctx, V, s); });
      if (Wd.T) targetMark(ctx, V, t);
      Wd.sats.forEach(function (s) { sprite(ctx, V, s); });
      return V;
    };
    return Wd;
  }
  /** Shared SNAP button + Space/Enter key. */
  function snapControls(S, fn) { S.keys(function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); fn(); } }); return S.btn("📸 SNAP <kbd>Space</kbd>", "big primary ss-snap", fn); }
  function nowLabel(ctx, Wd, c, t) {
    if (!Wd.tp || Wd.frozen || Wd.done) return;
    if (c.state === "in") txt(ctx, "NOW!", Wd.tp.x + 34, Wd.tp.y - 14, { size: 38 + Math.sin(t * 14) * 2, w: 700, color: GREEN, stroke: INK, lw: 7 });
    else if (c.state === "early" && c.du > -.55) txt(ctx, "Get ready…", Wd.tp.x + 34, Wd.tp.y - 14, { size: 25, w: 700, color: GOLD, stroke: INK, lw: 6 });
  }

  /* ============================================================ L2: snap the real ReSeed sites */
  function levelSnap(L) {
    var S = stage(L, "globe with satellites"), Wd = snapWorld(S), A = album(S);
    var mine = RQ.mySite() || RQ.site("rondonia");
    function lsYear(s) { return s && (s.years || []).filter(function (y) { return y.source === "Landsat"; })[0]; }
    var lsSite = lsYear(mine) ? mine : RQ.site("rondonia");
    var targets = [], seen = {};
    [mine, RQ.site("congo"), RQ.site("kangaroo"), RQ.site("dixie")].forEach(function (s) { if (s && !seen[s.id] && targets.length < 3) { seen[s.id] = 1; targets.push({ site: s, kind: "s2" }); } });
    if (lsSite) targets.push({ site: lsSite, kind: "ls" });
    var imgs = {}, old = lsYear(lsSite);
    targets.forEach(function (tg) { loadImg(RQ.url(tg.site.files.thumb)).then(function (im) { imgs[tg.site.id] = im; }); });
    if (old) loadImg(RQ.url(old.rgb)).then(function (im) { imgs.old = im; });
    var ti = 0, cur = null, snapped = true, wrong = 0, perfect = 0, hinted = false, resolveSnap = null, lastSnap = 0, lsPrint = null;
    L.hud.set("snap", "📸 0 / " + targets.length);
    S.info("Press **SNAP** or [Space] when the camera frame turns **green** over the target.");
    var snapBtn = snapControls(S, snap);
    Wd.onPass = function () { if (cur && !snapped) L.toast("It flew past! It will come around again soon.", "info", 1700); };

    function snap() {
      if (!L.alive || snapped || !cur || Wd.frozen) return;
      var now = performance.now(); if (now - lastSnap < 300) return; lastSnap = now;
      RQ.audio.sfx("shutter"); S.flash = REDUCE ? .35 : .9;
      var c = Wd.check(), tp = Wd.tp || { x: Wd.geom().cx, y: 300 };
      if (c.state === "in") {
        snapped = true; Wd.done = true; cur.shown = true;
        if (c.perfect) perfect++;
        RQ.audio.sfx(c.perfect ? "powerup" : "good");
        S.burst(tp.x, tp.y, null, 30); S.ring(tp.x, tp.y, GREEN);
        S.pop(tp.x, tp.y - 60, c.perfect ? "PERFECT!" : "GOT IT!", c.perfect ? GOLD : "#8ff7b4", 34);
        var s = cur.site;
        if (cur.kind === "ls") lsPrint = A.add({ img: imgs.old, title: short(s) + " · " + (old ? old.year : ""), sub: "Landsat · 30 m · old album", dx: -132, hold: 99 });
        else A.add({ img: imgs[s.id], title: short(s), sub: "Sentinel-2 · 10 m · " + String(s.image_date || "").slice(0, 4) });
        L.hud.set("snap", "📸 " + (ti + 1) + " / " + targets.length);
        if (resolveSnap) resolveSnap();
      } else {
        wrong++; RQ.audio.sfx("bad"); S.shake = .25;
        S.pop(tp.x, tp.y - 60, c.state === "late" ? "Too late!" : "Too early!", "#ff8f8f", 28);
        L.toast(c.state === "late" ? "Too late! It already flew past." : c.state === "early" ? "Too early! Wait until the frame covers the ring." : "No camera over the target yet. Watch the gold frame!", "bad", 1600);
        if (wrong >= 2 && !hinted) { hinted = true; Wd.slow = .27; L.hint("Watch the gold frame. Press when it turns **green** and says NOW!", "tuki"); }
      }
    }
    function card(ctx) {
      if (!cur) return;
      var w = 340, x = 16, y = 16, h = 106;
      panel(ctx, x, y, w, h, { stroke: cur.kind === "ls" ? "rgba(159,208,255,.85)" : "rgba(255,214,107,.75)" });
      txt(ctx, (cur.kind === "ls" ? "📼 LANDSAT TARGET " : "🛰️ TARGET ") + (ti + 1) + " / " + targets.length, x + 16, y + 22, { size: 17, w: 700, color: cur.kind === "ls" ? "#9fd0ff" : "#ffd46b" });
      var c = LL(cur.site); txt(ctx, "lat " + sgn(c.lat, 2) + "   lon " + sgn(c.lon, 2), x + 16, y + 55, { size: 26, w: 700 });
      txt(ctx, cur.shown ? "📍 " + cur.site.name : "📍 Mystery place. Snap it to find out!", x + 16, y + 87, { size: 17, color: cur.shown ? "#9ff0b8" : "#cfe0ff", max: w - 32 });
    }
    L.loop(function (dt, t) {
      Wd.update(dt);
      var c = Wd.check();
      snapBtn.classList.toggle("ready", c.state === "in" && !snapped);
      dbg({ level: 2, ti: ti, state: c.state, du: c.du, snapped: snapped, frozen: Wd.frozen, photos: A.list.length });
      S.frame(dt, function (ctx) {
        drawSpace(ctx, S.W, t);
        Wd.draw(ctx, t);
        if (!snapped) nowLabel(ctx, Wd, c, t);
        if (Wd.tp && cur) chip(ctx, sgn(LL(cur.site).lat, 2) + ", " + sgn(LL(cur.site).lon, 2), Wd.tp.x, Wd.tp.y + 26, "#fff4d1", INK, { align: "center", size: 16 });
        card(ctx);
        A.draw(ctx, dt, t);
      });
    });

    (async function run() {
      for (var i = 0; i < targets.length; i++) {
        var tg = targets[i];
        if (tg.kind === "ls") {
          await L.say("tuki", "Now fly **Landsat**! Its pixels are **30 m**, but its photo album goes back to **1984**.");
          if (!L.alive) return;
        }
        ti = i; cur = tg; snapped = true; Wd.frozen = true;
        Wd.setup(tg.site, tg.kind);
        var cf = Wd.camFor(tg.site);
        RQ.audio.sfx("whoosh");
        await Wd.camTo(cf.lat, cf.lon, i ? 1.8 : 1.3);
        if (!L.alive) return;
        Wd.frozen = false; snapped = false;
        await new Promise(function (r) { resolveSnap = r; });
        if (!L.alive) return;
        await L.wait(tg.kind === "ls" ? 900 : 2200); if (!L.alive) return;
        if (tg.kind === "ls") {
          var today = A.add({ img: imgs[tg.site.id], title: short(tg.site) + " · " + String(tg.site.image_date || "").slice(0, 4), sub: "Sentinel-2 · 10 m · today", dx: 132, hold: 99 });
          await L.wait(1800); if (!L.alive) return;
          await L.say("tuki", "Same spot, two dates! The old Landsat photo shows the forest before it was lost.");
          if (!L.alive) return;
          lsPrint.hold = lsPrint.t; today.hold = today.t;
          await L.wait(900); if (!L.alive) return;
        }
      }
      var stars = wrong <= 1 && perfect >= 2 ? 3 : wrong <= 4 ? 2 : 1;
      L.win({ stars: stars, msg: "Your album has **" + targets.length + "** pictures from space, taken at just the right moment!",
        stats: { "Photos": targets.length + " / " + targets.length, "Perfect timing": perfect, "Early / late presses": wrong } });
    })();
  }

  /* ============================================================ L3: clouds in the way (revisit) */
  function levelClouds(L) {
    var S = stage(L, "globe with a cloudy target"), Wd = snapWorld(S), A = album(S);
    var site = RQ.site("kalimantan") || { id: "kalimantan", name: "Ketapang, West Kalimantan", lat: -2.42, lon: 110.93, files: {} };
    var MAXC = 30, NEED = 3, SEQ = [86, 58, 22, 91, 47, 14, 73, 26, 8, 64, 18, 35, 12, 77, 21];
    var img = null, pass = 0, day = 0, clear = 0, wasted = 0, misses = 0, cover = 0, snappedPass = false, warping = true, finished = false, showLog = 0, banner = 0, lastSnap = 0;
    if (site.files && site.files.thumb) loadImg(RQ.url(site.files.thumb)).then(function (im) { img = im; });
    L.hud.set("day", "📅 Day 0"); L.hud.set("clear", "✓ 0 / " + NEED + " clear");
    S.info("Read the **cloud %** first. Ketapang's limit is **30%**: under it, snap! Over it, let it pass or skip ahead 5 days.");
    var snapBtn = snapControls(S, snap);
    var skipBtn = S.btn("⏩ Wait 5 days <kbd>N</kbd>", "", skip);
    S.keys(function (e) { if (e.key === "n" || e.key === "N") skip(); });
    Wd.onPass = function () { if (!warping && !finished) nextPass(); };

    function skip() { if (!warping && !finished) { RQ.audio.sfx("whoosh"); nextPass(); } }
    function startPass() {
      cover = pass < SEQ.length ? SEQ[pass] : (L.rng() < .5 ? u.randi(5, 25) : u.randi(40, 95));
      Wd.tclouds = makeTargetClouds(Wd.T, cover, pass);
      Wd.sats[0].u = -1.3; Wd.sats[1].u = -1.3 + Math.PI; Wd.f = 1; Wd.done = false;
      snappedPass = false; warping = false; Wd.frozen = false;
    }
    async function nextPass() {
      warping = true; Wd.frozen = true; banner = 1.9;
      day += 5; pass++;
      L.hud.set("day", "📅 Day " + day);
      await Wd.camTo(Wd.cam.lat, Wd.cam.lon, 1.5, 1);
      if (!L.alive || finished) return;
      startPass();
    }
    function snap() {
      if (!L.alive || warping || finished || snappedPass) return;
      var now = performance.now(); if (now - lastSnap < 300) return; lastSnap = now;
      RQ.audio.sfx("shutter"); S.flash = REDUCE ? .35 : .9;
      var c = Wd.check(), tp = Wd.tp || { x: Wd.geom().cx, y: 300 };
      if (c.state !== "in") {
        misses++; RQ.audio.sfx("bad"); S.shake = .2;
        S.pop(tp.x, tp.y - 60, c.state === "late" ? "Too late!" : "Too early!", "#ff8f8f", 28);
        return;
      }
      snappedPass = true; Wd.done = true;
      if (cover >= MAXC) {
        wasted++; RQ.audio.sfx("giggle"); S.shake = .2;
        S.pop(tp.x, tp.y - 60, "☁ " + cover + "% cloud!", "#ffb0b0", 30);
        A.add({ img: img, cloud: cover, bad: true, title: "Day " + day + " · ☁ " + cover + "%", sub: "Over max_cloud 30: thrown away" });
        L.toast("Only clouds! ReSeed would throw this picture away.", "bad", 2000);
        if (wasted === 1) L.hint("Read the cloud number first: over **30%** means let that pass go by!", "tuki");
      } else {
        clear++; RQ.audio.sfx("powerup");
        S.burst(tp.x, tp.y, null, 30); S.ring(tp.x, tp.y, GREEN); S.pop(tp.x, tp.y - 60, "CLEAR! ✓", "#8ff7b4", 34);
        A.add({ img: img, cloud: cover, title: "Day " + day + " · ☁ " + cover + "%", sub: "Under 30%: kept ✓" });
        L.hud.set("clear", "✓ " + clear + " / " + NEED + " clear");
        if (clear >= NEED) finish();
      }
    }
    async function finish() {
      finished = true;
      await L.wait(3000); if (!L.alive) return;
      showLog = .001; RQ.audio.sfx("pop");
      await L.wait(700); if (!L.alive) return;
      await L.say("tuki", "Real Ketapang is just as cloudy! Here is the log of pictures ReSeed really kept.");
      if (!L.alive) return;
      var stars = wasted === 0 ? 3 : wasted <= 2 ? 2 : 1;
      L.win({ stars: stars, msg: "You waited out the clouds and kept **" + NEED + "** clear pictures of Ketapang.",
        stats: { "Clear photos": NEED + " / " + NEED, "Days of passes": day, "Cloudy snaps": wasted } });
    }
    function meter(ctx, t) {
      var x = 16, y = 16, w = 340, h = 190;
      panel(ctx, x, y, w, h);
      txt(ctx, "🛰️ " + short(site) + ", Borneo", x + 16, y + 22, { size: 17, w: 700, color: "#ffd46b" });
      txt(ctx, "lat " + sgn(LL(site).lat, 2) + "   lon " + sgn(LL(site).lon, 2), x + 16, y + 52, { size: 24, w: 700 });
      var show = warping ? null : cover;
      txt(ctx, "☁ CLOUD OVER THE TARGET", x + 16, y + 86, { size: 16, w: 700, color: "#9fb6e8" });
      txt(ctx, show == null ? "…" : show + "%", x + w - 16, y + 86, { size: 24, w: 700, color: show == null ? "#cfe0ff" : show >= MAXC ? "#ff9b9b" : "#8ff7b4", align: "right" });
      var bx = x + 16, by = y + 104, bw = w - 32, bh = 22;
      u.rr(ctx, bx, by, bw, bh, 8); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fill();
      if (show != null) { u.rr(ctx, bx, by, Math.max(10, bw * show / 100), bh, 8); ctx.fillStyle = show >= MAXC ? "#ff8f8f" : "#6fe39a"; ctx.fill(); }
      var mx = bx + bw * MAXC / 100;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx, by - 5); ctx.lineTo(mx, by + bh + 5); ctx.stroke();
      txt(ctx, "max_cloud = 30", mx + 6, by + bh + 14, { size: 16, w: 600, color: "#fff" });
      var verdict = show == null ? "⏩ 5 days later…" : show >= MAXC ? "✗ Too cloudy: let it pass" : "✓ Clear enough: snap it!";
      txt(ctx, verdict, x + 16, y + h - 22, { size: 18, w: 700, color: show == null ? "#cfe0ff" : show >= MAXC ? "#ffb0b0" : "#8ff7b4" });
    }
    function logPanel(ctx) {
      var k = u.ease.outBack(Math.min(1, showLog / .5)), g = Wd.geom(), w = 520, h = 400, x = g.cx - w / 2, y = 70;
      var real = (site.image && site.image.scenes) || [], win = (site.image && site.image.window) || ["?", "?"];
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-w / 2, -h / 2);
      panel(ctx, 0, 0, w, h, { fill: "rgba(255,253,245,.97)", stroke: INK });
      txt(ctx, "📜 ReSeed's real log: " + short(site), 20, 30, { size: 22, w: 700, color: INK });
      txt(ctx, "searched " + win[0] + " → " + win[1] + " · max_cloud " + MAXC + " · from reseed/pipeline.py", 20, 60, { size: 16, color: "#4a5b6d", max: w - 40 });
      real.slice(0, 8).forEach(function (sc, i) {
        var yy = 98 + i * 36, c = sc.cloud || 0;
        txt(ctx, sc.datetime, 20, yy, { size: 18, w: 600, color: INK });
        u.rr(ctx, 150, yy - 10, 260, 20, 7); ctx.fillStyle = "#e4e9f2"; ctx.fill();
        u.rr(ctx, 150, yy - 10, Math.max(8, 260 * c / 100), 20, 7); ctx.fillStyle = "#8fb8e8"; ctx.fill();
        ctx.strokeStyle = "#d1495b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(150 + 260 * MAXC / 100, yy - 13); ctx.lineTo(150 + 260 * MAXC / 100, yy + 13); ctx.stroke();
        txt(ctx, "☁ " + c.toFixed(1) + "%", 422, yy, { size: 18, w: 700, color: INK });
      });
      txt(ctx, real.length + " clear-enough pictures kept. Every one under 30%!", 20, h - 24, { size: 17, w: 700, color: "#2f9e4f", max: w - 40 });
      ctx.restore();
    }
    L.loop(function (dt, t) {
      Wd.update(dt);
      if (!warping && !finished) Wd.cloudA = Math.min(1, Wd.cloudA + dt * 2.5); else if (warping) Wd.cloudA = Math.max(0, Wd.cloudA - dt * 3);
      banner = Math.max(0, banner - dt); if (showLog) showLog += dt;
      var c = Wd.check();
      snapBtn.classList.toggle("ready", c.state === "in" && !snappedPass && !warping && cover < MAXC);
      skipBtn.disabled = warping || finished;
      dbg({ level: 3, state: c.state, du: c.du, cover: cover, warping: warping, snappedPass: snappedPass, clear: clear, day: day, finished: finished });
      S.frame(dt, function (ctx) {
        drawSpace(ctx, S.W, t);
        Wd.draw(ctx, t);
        if (!snappedPass && !warping) nowLabel(ctx, Wd, c, t);
        if (Wd.tp && !warping && !finished) chip(ctx, "☁ " + cover + "%  " + (cover >= MAXC ? "✗" : "✓"), Wd.tp.x, Wd.tp.y + 64, cover >= MAXC ? "#ffd0d0" : "#c8f7d6", INK, { align: "center", size: 18 });
        if (banner > 0) {
          var g = Wd.geom(); ctx.globalAlpha = Math.min(1, banner * 2);
          txt(ctx, "⏩ 5 days later…", g.cx, g.cy - 20, { size: 40, w: 700, color: "#fff", stroke: INK, lw: 8, align: "center" });
          txt(ctx, "Day " + day, g.cx, g.cy + 26, { size: 30, w: 700, color: GOLD, stroke: INK, lw: 7, align: "center" });
          ctx.globalAlpha = 1;
        }
        meter(ctx, t);
        A.draw(ctx, dt, t);
        if (showLog) logPanel(ctx);
      });
    });
    (async function run() {
      Wd.setup(site, "s2");
      var cf = Wd.camFor(site);
      await Wd.camTo(cf.lat, cf.lon, 1.4);
      if (!L.alive) return;
      startPass();
    })();
  }

  /* ============================================================ a drawn 300 m × 300 m forest (L4 pixel zoom, L5 map) */
  var FOREST = null;
  function forest() {
    if (FOREST) return FOREST;
    var r = u.seeded("g06-forest"), M = 300, i;
    function riverX(y) { return 236 + 16 * Math.sin(y / 46) + 7 * Math.sin(y / 15 + 1); }
    var big = [];
    for (i = 0; i < 16; i++) { var a = i / 16 * TAU, k = 1 + .13 * Math.sin(3 * a + 1) + .07 * Math.sin(5 * a); big.push([92 + Math.cos(a) * 56 * k, 208 + Math.sin(a) * 34 * k]); }
    var small = [[196, 58], [220, 57], [221, 81], [197, 82]];
    var road = [[-5, 124], [20, 138], [38, 160], [48, 184]];
    var tuki = { x: 118, y: 92, r: 9.5 };
    function inPoly(x, y, poly) {
      var c = false;
      for (var a2 = 0, b = poly.length - 1; a2 < poly.length; b = a2++) {
        var xi = poly[a2][0], yi = poly[a2][1], xj = poly[b][0], yj = poly[b][1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    }
    function roadDist(x, y) {
      var best = 1e9;
      for (var j = 0; j < road.length - 1; j++) {
        var ax = road[j][0], ay = road[j][1], bx = road[j + 1][0], by = road[j + 1][1], dx = bx - ax, dy = by - ay;
        var t = u.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
        best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
      }
      return best;
    }
    var trees = [];
    for (i = 0; i < 5000 && trees.length < 950; i++) {
      var x = r() * (M + 10) - 5, y = r() * (M + 10) - 5, rad = 3.2 + r() * 4.3;
      if (inPoly(x, y, big) || inPoly(x, y, small) || Math.abs(x - riverX(y)) < 8 + rad * .6 || roadDist(x, y) < 4 + rad * .5 ||
        Math.hypot(x - tuki.x, y - tuki.y) < tuki.r + 1.5) continue;
      trees.push([x, y, rad, r()]);
    }
    var COLS = ["#2f7d3a", "#3b8c41", "#28692f", "#469a45", "#336f34", "#3f8f3d"];
    function poly(ctx, p) { ctx.beginPath(); p.forEach(function (q, j) { if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }
    function draw(ctx, s) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = "#24592b"; ctx.fillRect(0, 0, M, M);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); for (var y2 = -10; y2 <= M + 10; y2 += 5) { if (y2 === -10) ctx.moveTo(riverX(y2), y2); else ctx.lineTo(riverX(y2), y2); }
      ctx.strokeStyle = "#8a7a52"; ctx.lineWidth = 18; ctx.stroke();
      ctx.strokeStyle = "#3d86b3"; ctx.lineWidth = 13; ctx.stroke();
      ctx.strokeStyle = "rgba(140,200,235,.6)"; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); road.forEach(function (p, j) { if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.strokeStyle = "#b8895a"; ctx.lineWidth = 6; ctx.stroke();
      poly(ctx, big); ctx.fillStyle = "#c9a26b"; ctx.fill(); poly(ctx, small); ctx.fill();
      var rr = u.seeded("g06-clearing");
      for (var g = 0; g < 40; g++) {
        var gx = 34 + rr() * 116, gy = 172 + rr() * 72, grass = rr() < .6, gr = grass ? 3 + rr() * 4 : 1.1;
        if (!inPoly(gx, gy, big)) continue;
        ctx.fillStyle = grass ? "rgba(150,170,80,.65)" : "rgba(100,70,45,.95)"; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, TAU); ctx.fill();
      }
      trees.forEach(function (tr) {
        ctx.fillStyle = "rgba(10,30,15,.45)"; ctx.beginPath(); ctx.arc(tr[0] + tr[2] * .25, tr[1] + tr[2] * .3, tr[2], 0, TAU); ctx.fill();
        ctx.fillStyle = COLS[Math.floor(tr[3] * COLS.length)]; ctx.beginPath(); ctx.arc(tr[0], tr[1], tr[2], 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(170,230,140,.22)"; ctx.beginPath(); ctx.arc(tr[0] - tr[2] * .3, tr[1] - tr[2] * .3, tr[2] * .5, 0, TAU); ctx.fill();
      });
      ctx.fillStyle = "rgba(10,30,15,.5)"; ctx.beginPath(); ctx.arc(tuki.x + 2.5, tuki.y + 3, tuki.r, 0, TAU); ctx.fill();
      ctx.fillStyle = "#357f3a"; ctx.beginPath(); ctx.arc(tuki.x, tuki.y, tuki.r, 0, TAU); ctx.fill();
      for (var l = 0; l < 6; l++) {
        var la = l / 6 * TAU; ctx.fillStyle = l % 2 ? "#3f8f3d" : "#2f7d3a";
        ctx.beginPath(); ctx.arc(tuki.x + Math.cos(la) * 5, tuki.y + Math.sin(la) * 5, 4.2, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    var cells = 0;
    for (var cy = 0; cy < 30; cy++) for (var cx = 0; cx < 30; cx++) if (inPoly(cx * 10 + 5, cy * 10 + 5, big)) cells++;
    FOREST = { M: M, big: big, small: small, tuki: tuki, inPoly: inPoly, draw: draw, cells: cells };
    return FOREST;
  }
  function renderForest(px) { var F = forest(), c = document.createElement("canvas"); c.width = c.height = px; F.draw(c.getContext("2d"), px / F.M); return c; }

  /* ============================================================ L4: pixel zoom (drone vs 10 m vs 30 m) */
  function levelPixels(L) {
    var S = stage(L, "the same forest seen by a drone, Sentinel-2 and Landsat"), F = forest();
    var V0 = renderForest(600);
    var panels = [
      { title: "🚁 Drone camera", sub: "sees single trees", img: V0, n: 0, rev: 1, on: true },
      { title: "🛰️ Sentinel-2 · 10 m", sub: "30 × 30 pixels", img: renderForest(30), n: 30, rev: 0, on: false },
      { title: "📼 Landsat · 30 m", sub: "10 × 10 pixels", img: renderForest(10), n: 10, rev: 0, on: false }
    ];
    var mine = RQ.mySite() || RQ.site("rondonia"), real = null;
    if (mine && mine.files) loadImg(RQ.url(mine.files.rgb)).then(function (im) { real = im; });
    var correct = 0, wantTap = null, grid = false, tukiMark = false, pixHi = false, clearHi = 0, smallHi = 0, treeFound = 0, finale = null, mag = { x: 320, y: 320 }, magDrag = false, doneRes = null;
    var C = 64, CS = 21, sm = document.createElement("canvas"); sm.width = sm.height = CS;
    var smx = sm.getContext("2d");
    var doneBtn = S.btn("✓ Done <kbd>Enter</kbd>", "go", function () { if (doneRes) { var r = doneRes; doneRes = null; r(); } });
    doneBtn.hidden = true;
    L.hud.set("q", "❓ 0 / 3");
    function layout() { var gap = 26, PS = Math.min(350, (S.W - 80 - 2 * gap) / 3), x0 = (S.W - (3 * PS + 2 * gap)) / 2; return { PS: PS, x: [x0, x0 + PS + gap, x0 + 2 * (PS + gap)], y: 96 }; }
    var tap = tapper(S, L, function () { return !!wantTap; }, function (x, y) { if (wantTap) wantTap(x, y); });
    function waitTap(pi, ok, wrongMsg) {
      return new Promise(function (res) {
        var Lo = layout(); tap.x0 = Lo.x[pi] + Lo.PS / 2; tap.y0 = Lo.y + Lo.PS / 2;
        wantTap = function (x, y) {
          var Lo2 = layout(), px = Lo2.x[pi], PS = Lo2.PS;
          if (x < px || x > px + PS || y < Lo2.y || y > Lo2.y + PS) { L.toast("Tap inside the **" + panels[pi].title + "** picture.", "info", 1500); return; }
          var m = { x: (x - px) / PS * F.M, y: (y - Lo2.y) / PS * F.M };
          if (ok(m)) { wantTap = null; tap.on = false; S.burst(x, y, null, 22); S.ring(x, y, GREEN); res(m); }
          else { RQ.audio.sfx("bad"); S.pop(x, y - 20, "✗", "#ff8f8f", 30); L.toast(wrongMsg, "bad", 1600); }
        };
      });
    }
    function reveal(i) { panels[i].on = true; panels[i].rev = .001; RQ.audio.sfx("zap"); } function score(ok) { if (ok) correct++; RQ.audio.sfx(ok ? "good" : "bad"); L.hud.set("q", "❓ " + correct + " / 3"); }
    // finale: drag the magnifier over the real picture
    function magTo(x, y) { var Lo = layout(), k = 640 / Lo.PS; mag.x = u.clamp((x - Lo.x[0]) * k, C / 2, 640 - C / 2); mag.y = u.clamp((y - Lo.y) * k, C / 2, 640 - C / 2); }
    L.on(S.cv.cv, "pointerdown", function (e) {
      if (!finale) return; var p = S.cv.toLocal(e), Lo = layout();
      if (p.x >= Lo.x[0] && p.x <= Lo.x[0] + Lo.PS && p.y >= Lo.y && p.y <= Lo.y + Lo.PS) { magDrag = true; magTo(p.x, p.y); finale.moved = true; }
    });
    L.on(S.cv.cv, "pointermove", function (e) { if (finale && magDrag) { var p = S.cv.toLocal(e); magTo(p.x, p.y); } });
    function ptrUp() { magDrag = false; } window.addEventListener("pointerup", ptrUp); L.onEnd(function () { window.removeEventListener("pointerup", ptrUp); });
    S.keys(function (e) {
      if (!finale) return;
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (d) { e.preventDefault(); mag.x = u.clamp(mag.x + d[0] * 16, C / 2, 640 - C / 2); mag.y = u.clamp(mag.y + d[1] * 16, C / 2, 640 - C / 2); finale.moved = true; }
      else if (e.key === "Enter" && doneRes) { e.preventDefault(); doneBtn.click(); }
    });

    function drawPanels(ctx, t) {
      var Lo = layout(), PS = Lo.PS, y = Lo.y, k = PS / F.M;
      panels.forEach(function (p, i) {
        var x = Lo.x[i];
        txt(ctx, p.title, x + PS / 2, y - 36, { size: 22, w: 700, color: p.on ? "#fff" : "#7f8db3", align: "center", max: PS });
        panel(ctx, x - 7, y - 7, PS + 14, PS + 14, { r: 10, fill: "#0d1638" });
        if (!p.on) {
          txt(ctx, "🔒", x + PS / 2, y + PS / 2 - 10, { size: 46, align: "center" });
          txt(ctx, "coming up", x + PS / 2, y + PS / 2 + 34, { size: 18, color: "#7f8db3", align: "center" });
          return;
        }
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, PS, PS); ctx.clip();
        if (p.rev < 1) { ctx.drawImage(V0, x, y, PS, PS); ctx.beginPath(); ctx.rect(x, y, PS, PS * p.rev); ctx.clip(); }
        ctx.imageSmoothingEnabled = !p.n; ctx.drawImage(p.img, x, y, PS, PS); ctx.imageSmoothingEnabled = true;
        ctx.restore();
        if (p.rev < 1) { ctx.fillStyle = "rgba(127,243,255,.9)"; ctx.fillRect(x, y + PS * p.rev - 2, PS, 4); }
        if (grid && p.n) {
          ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1; ctx.beginPath();
          for (var g = 1; g < p.n; g++) { ctx.moveTo(x + g * PS / p.n, y); ctx.lineTo(x + g * PS / p.n, y + PS); ctx.moveTo(x, y + g * PS / p.n); ctx.lineTo(x + PS, y + g * PS / p.n); }
          ctx.stroke();
        }
        if (i === 0) {
          drawToucan(ctx, x + F.tuki.x * k, y + (F.tuki.y - 3) * k, 1.25, t);
          if (treeFound) { ctx.lineWidth = 3; ctx.strokeStyle = GREEN; ctx.beginPath(); ctx.arc(x + F.tuki.x * k, y + F.tuki.y * k, 16 + Math.sin(t * 5) * 2, 0, TAU); ctx.stroke(); }
        }
        if (i === 1 && tukiMark) {
          ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.strokeStyle = "#7ff3ff";
          ctx.beginPath(); ctx.arc(x + F.tuki.x * k, y + F.tuki.y * k, 22, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          txt(ctx, "my tree?", x + F.tuki.x * k, y + F.tuki.y * k - 32, { size: 17, w: 700, color: "#7ff3ff", stroke: INK, lw: 4, align: "center" });
        }
        if (i === 1 && pixHi) {
          var c = PS / 30, px = x + 4 * c, py = y + 3 * c;
          ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.strokeRect(px, py, c, c);
          chip(ctx, "1 pixel = 10 m × 10 m", px + c + 6, py + c / 2, "#fff4d1", INK, { size: 16 });
        }
        if (clearHi && i < 2) {
          ctx.globalAlpha = Math.min(1, clearHi * 2); ctx.lineWidth = 2; ctx.strokeStyle = GOLD;
          if (i === 1) {
            var c2 = PS / 30;
            for (var cy = 0; cy < 30; cy++) for (var cx = 0; cx < 30; cx++) if (F.inPoly(cx * 10 + 5, cy * 10 + 5, F.big)) ctx.strokeRect(x + cx * c2 + 1, y + cy * c2 + 1, c2 - 2, c2 - 2);
          } else { ctx.beginPath(); F.big.forEach(function (q, j) { if (j) ctx.lineTo(x + q[0] * k, y + q[1] * k); else ctx.moveTo(x + q[0] * k, y + q[1] * k); }); ctx.closePath(); ctx.stroke(); }
          ctx.globalAlpha = 1;
          if (i === 1) chip(ctx, F.cells + " pixels = " + (F.cells / 100).toFixed(2) + " ha", x + 92 * k, y + 160 * k, "#fff4d1", INK, { align: "center", size: 16 });
        }
        if (smallHi) {
          ctx.lineWidth = 3; ctx.strokeStyle = i === 2 ? "#ff8f8f" : GREEN;
          ctx.beginPath(); ctx.arc(x + 208 * k, y + 70 * k, 26, 0, TAU); ctx.stroke();
          txt(ctx, i === 2 ? "✗ blurred away" : "✓ still there", x + 208 * k, y + 70 * k + 40, { size: 16, w: 700, color: i === 2 ? "#ffb0b0" : "#8ff7b4", stroke: INK, lw: 4, align: "center" });
        }
        txt(ctx, p.sub, x + PS / 2, y + PS + 26, { size: 18, color: "#cfe0ff", align: "center" });
      });
    }
    function drawFinale(ctx, t) {
      var Lo = layout(), PS = Lo.PS, y = Lo.y, k = PS / 640, sx = mag.x - C / 2, sy = mag.y - C / 2;
      var titles = ["🛰️ " + short(mine) + " (real)", "🔍 Sentinel-2 · 10 m", "🔍 same spot at 30 m"], subs = ["6.4 km × 6.4 km", "64 × 64 pixels = 640 m", "21 × 21 pixels (game version)"];
      for (var i = 0; i < 3; i++) {
        var x = Lo.x[i];
        txt(ctx, titles[i], x + PS / 2, y - 36, { size: 22, w: 700, color: "#fff", align: "center", max: PS });
        panel(ctx, x - 7, y - 7, PS + 14, PS + 14, { r: 10, fill: "#0d1638" });
        txt(ctx, subs[i], x + PS / 2, y + PS + 26, { size: 18, color: "#cfe0ff", align: "center" });
      }
      if (!real) { txt(ctx, "loading…", Lo.x[1] + PS / 2, y + PS / 2, { size: 20, align: "center" }); return; }
      ctx.drawImage(real, Lo.x[0], y, PS, PS);
      ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.strokeRect(Lo.x[0] + sx * k, y + sy * k, C * k, C * k);
      if (!finale.moved) txt(ctx, "✋ drag me", Lo.x[0] + mag.x * k, y + sy * k - 16, { size: 17, w: 700, color: GOLD, stroke: INK, lw: 4, align: "center" });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(real, sx, sy, C, C, Lo.x[1], y, PS, PS);
      smx.imageSmoothingEnabled = true; smx.imageSmoothingQuality = "high"; smx.clearRect(0, 0, CS, CS);
      smx.drawImage(real, sx, sy, C, C, 0, 0, CS, CS);
      ctx.drawImage(sm, 0, 0, CS, CS, Lo.x[2], y, PS, PS);
      ctx.imageSmoothingEnabled = true;
      [1, 2].forEach(function (j) {
        ctx.strokeStyle = "rgba(255,214,107,.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(Lo.x[0] + (sx + C) * k, y + sy * k); ctx.lineTo(Lo.x[j], y); ctx.moveTo(Lo.x[0] + (sx + C) * k, y + (sy + C) * k); ctx.lineTo(Lo.x[j], y + PS); ctx.stroke();
      });
    }
    L.loop(function (dt, t) {
      panels.forEach(function (p) { if (p.rev > 0 && p.rev < 1) p.rev = Math.min(1, p.rev + dt / .9); });
      if (clearHi) clearHi += dt; if (smallHi) smallHi += dt;
      dbg({ level: 4, W: S.W, wantTap: !!wantTap, finale: !!finale, correct: correct, layout: layout(), tuki: F.tuki });
      S.frame(dt, function (ctx) {
        drawSpace(ctx, S.W, t);
        if (finale) drawFinale(ctx, t); else drawPanels(ctx, t);
        tap.draw(ctx, t);
      });
    });
    (async function run() {
      S.info("Tap **Tuki's tree** in the drone picture: the big one with the toucan. (Or arrows + [Enter])");
      await waitTap(0, function (m) { return Math.hypot(m.x - F.tuki.x, m.y - F.tuki.y) < 20; }, "That's another tree. Look for the toucan!");
      if (!L.alive) return;
      treeFound = 1; RQ.audio.sfx("chirp");
      reveal(1); S.info("Here comes the **Sentinel-2** picture of the same forest…");
      await L.wait(1300); if (!L.alive) return;
      var a = await L.choose("tuki", "Now look through **Sentinel-2**. Can you still see my tree?", ["Yes, I can spot it", "No, it's just green forest pixels"]);
      if (!L.alive) return;
      grid = true; tukiMark = true; pixHi = true; score(a === 1);
      if (a === 1) await L.say("hoot", "Right! One pixel is 10 m wide, about one tree crown, so Sentinel-2 sees forest **patches**, not single trees.");
      else await L.say("hoot", "Look again: it melted into the green. One pixel is as wide as a whole tree crown!");
      if (!L.alive) return;
      tukiMark = false;
      S.info("Tap the brown **clearing** (lost forest) in the **10 m** picture. (Or arrows + [Enter])");
      await waitTap(1, function (m) { return F.inPoly(m.x, m.y, F.big); }, "That's still forest. Look for the big brown patch!");
      if (!L.alive) return;
      clearHi = .001; RQ.audio.sfx("powerup");
      await L.wait(900); if (!L.alive) return;
      await L.say("hoot", "Each 10 m pixel is a small square of land, and 100 of them make one **hectare**. ReSeed skips patches smaller than 50 pixels (**0.5 ha**).");
      if (!L.alive) return;
      clearHi = 0; pixHi = false; reveal(2); S.info("And now the **Landsat** picture, with 30 m pixels…");
      await L.wait(1300); if (!L.alive) return;
      a = await L.choose("tuki", "Here is **Landsat** at 30 m. Which pictures still show the small clearing by the river?", ["Drone and Sentinel-2", "Only Landsat", "All three"]);
      if (!L.alive) return;
      smallHi = .001; score(a === 0);
      if (a === 0) await L.say("hoot", "Yes! Landsat's big 30 m pixels blur small things away, but big patches still show up.");
      else await L.say("hoot", "Look at the circles: in Landsat the small clearing blurs away. Its 30 m pixels are too big.");
      if (!L.alive) return;
      a = await L.choose("tuki", "So why does ReSeed still use blurry **Landsat**?", ["Its photo album goes back to 1984", "It can see single trees", "It takes pictures at night"]);
      if (!L.alive) return;
      score(a === 0);
      if (a === 0) await L.say("tuki", "Yes! Old Landsat pictures show what a forest looked like long ago.");
      else await L.say("tuki", "Not quite. Landsat's album goes back to **1984**, so we can see the old forest.");
      if (!L.alive) return;
      finale = { moved: false }; smallHi = 0; grid = false; RQ.audio.sfx("whoosh");
      S.info("Your **real** site! **Drag** the gold square (or use the arrows) and compare 10 m with 30 m.");
      doneBtn.hidden = false;
      await new Promise(function (r) { doneRes = r; });
      if (!L.alive) return;
      L.win({ stars: correct >= 3 ? 3 : correct >= 2 ? 2 : 1, msg: "At 10 m and 30 m you see forest **patches**; a close-up drone picture shows single trees. Smaller pixels show more detail!",
        stats: { "Right answers": correct + " / 3", "Clearing": F.cells + " pixels = " + (F.cells / 100).toFixed(2) + " ha" } });
    })();
  }

  /* ============================================================ L5: navigation satellites and GPS trilateration */
  function droneTop(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, 12); ctx.moveTo(12, -12); ctx.lineTo(-12, 12); ctx.stroke();
    [[-12, -12], [12, -12], [12, 12], [-12, 12]].forEach(function (p, i) {
      ctx.fillStyle = "rgba(220,240,255,.55)"; ctx.beginPath(); ctx.ellipse(p[0], p[1], 9, 9 * Math.abs(Math.sin(t * 30 + i)), 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, TAU); ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fillStyle = "#5ccf6a"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -5, 3, 6, .5, 0, TAU); ctx.fillStyle = "#2f9e4f"; ctx.fill();
    ctx.restore();
  }
  function levelGPS(L) {
    var S = stage(L, "sorting satellites, then a GPS map"), MAP = renderForest(600);
    var ITEMS = [
      { name: "Sentinel-2", kind: "s2", nav: false, fact: "📷 **Sentinel-2** takes pictures with 10 m pixels." },
      { name: "GPS", kind: "gps", nav: true, fact: "📍 **GPS** satellites send time signals. They take no pictures." },
      { name: "Landsat", kind: "ls", nav: false, fact: "📷 **Landsat** takes 30 m pictures, back to 1984." },
      { name: "Galileo", kind: "gal", nav: true, fact: "📍 **Galileo** is Europe's navigation system, like GPS." }
    ];
    var GS = [[150, -45], [395, 150], [-70, 300]], RCOL = ["#ffd46b", "#7ff3ff", "#ff9bd2"];
    var ROUNDS = [
      { d: [200, 120], fuzz: 0, unc: 5, note: "☀ open sky" },
      { d: [95, 205], fuzz: 0, unc: 5, note: "☀ open sky" },
      { d: [62, 70], fuzz: 11, unc: 15, note: "🌳 under thick trees" }
    ];
    var phase = "sort", si = 0, sortMiss = 0, docked = [], flying = null, wob = 0;
    var ri = 0, rings = [], pinging = false, resPing = null, tapRes = null, showX = false, shown = null, bull = 0;
    L.hud.set("gps", "🛰️ Sort 0 / " + ITEMS.length);
    S.info("Camera or compass? Sort each satellite: **pictures** or **where you are**.");
    var bImg = S.btn("📷 Takes pictures <kbd>1</kbd>", "", function () { sortPick(false); });
    var bNav = S.btn("📍 Says where you are <kbd>2</kbd>", "", function () { sortPick(true); });
    var bPing = S.btn("📡 Listen to GPS 1 <kbd>L</kbd>", "primary", ping); bPing.hidden = true;
    S.keys(function (e) {
      if (phase === "sort") {
        if (e.key === "1" || e.key === "ArrowLeft") { e.preventDefault(); sortPick(false); }
        if (e.key === "2" || e.key === "ArrowRight") { e.preventDefault(); sortPick(true); }
      } else if (phase === "ping" && (e.key === "l" || e.key === "L" || e.key === " ")) { e.preventDefault(); ping(); }
    });
    function geom() { var MS = Math.min(400, S.W - 580), x0 = 140, y0 = 100; return { x0: x0, y0: y0, MS: MS, k: MS / 300 }; }
    var tap = tapper(S, L, function () { return phase === "tap"; }, function (x, y) {
      var g = geom();
      if (x < g.x0 || x > g.x0 + g.MS || y < g.y0 || y > g.y0 + g.MS) { L.toast("Tap on the map.", "info", 1200); return; }
      if (tapRes) { var r = tapRes; tapRes = null; r({ x: (x - g.x0) / g.k, y: (y - g.y0) / g.k }); }
    });

    function sortPick(nav) {
      if (phase !== "sort" || flying || si >= ITEMS.length) return;
      var it = ITEMS[si];
      if (it.nav === nav) { RQ.audio.sfx("good"); flying = { it: it, t: 0 }; L.toast(it.fact, "good", 2200); }
      else { sortMiss++; RQ.audio.sfx("bad"); wob = .5; L.toast("Hmm, not that one! " + it.fact, "bad", 2600); }
    }
    function dockPos(nav, n) {
      var zw = Math.min(330, S.W * .28), zx = nav ? S.W - 30 - zw : 30;
      return { x: zx + zw / 2 + (n % 2 ? 70 : -70), y: 300 + Math.floor(n / 2) * 100 };
    }
    function ping() {
      if (phase !== "ping" || pinging || rings.length >= 3) return;
      var k = rings.length, g = GS[k], d = ROUNDS[ri].d;
      rings.push({ k: k, r: Math.hypot(g[0] - d[0], g[1] - d[1]), t: 0 }); RQ.audio.sfx("zap"); pinging = true;
      bPing.innerHTML = rings.length < 3 ? "📡 Listen to GPS " + (rings.length + 1) + " <kbd>L</kbd>" : "📡 All heard";
      L.timeout(function () { pinging = false; RQ.audio.sfx("beep"); if (resPing) { var r = resPing; resPing = null; r(); } }, 950);
    }
    function waitPing() { return new Promise(function (r) { resPing = r; }); } // resolved when a ping animation ends
    function inter(c0, r0, c1, r1) {
      var dx = c1[0] - c0[0], dy = c1[1] - c0[1], d = Math.hypot(dx, dy);
      if (d > r0 + r1 || d < Math.abs(r0 - r1)) return [];
      var a = (r0 * r0 - r1 * r1 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r0 * r0 - a * a)), mx = c0[0] + a * dx / d, my = c0[1] + a * dy / d;
      return [[mx + h * dy / d, my - h * dx / d], [mx - h * dy / d, my + h * dx / d]];
    }

    function drawSort(ctx, t) {
      var zw = Math.min(330, S.W * .28);
      txt(ctx, "Camera 📷 or compass 📍?", S.W / 2, 44, { size: 30, w: 700, color: "#fff", align: "center" });
      [false, true].forEach(function (nav) {
        var zx = nav ? S.W - 30 - zw : 30;
        panel(ctx, zx, 90, zw, 420, { stroke: nav ? "rgba(127,243,255,.8)" : "rgba(255,214,107,.8)" });
        txt(ctx, nav ? "📍 NAVIGATION" : "📷 IMAGING", zx + zw / 2, 128, { size: 24, w: 700, color: nav ? "#7ff3ff" : "#ffd46b", align: "center" });
        txt(ctx, nav ? "tells you where you are" : "takes pictures of Earth", zx + zw / 2, 162, { size: 18, color: "#cfe0ff", align: "center" });
        txt(ctx, nav ? "key 2 / ➡" : "key 1 / ⬅", zx + zw / 2, 190, { size: 16, color: "#7f8db3", align: "center" });
      });
      docked.forEach(function (d) { satSprite(ctx, d.x, d.y, -Math.PI / 2, 1.3, d.it.kind); chip(ctx, d.it.name, d.x, d.y + 46, "#fff4d1", INK, { align: "center", size: 16 }); });
      if (flying) {
        var n = docked.filter(function (d) { return d.it.nav === flying.it.nav; }).length, to = dockPos(flying.it.nav, n), k = u.ease.inOut(Math.min(1, flying.t / .6));
        satSprite(ctx, u.lerp(S.W / 2, to.x, k), u.lerp(270, to.y, k), k * TAU - Math.PI / 2, u.lerp(2.6, 1.3, k), flying.it.kind);
      } else if (si < ITEMS.length) {
        var it = ITEMS[si];
        satSprite(ctx, S.W / 2 + Math.sin(wob * 40) * wob * 18, 270 + Math.sin(t * 2) * 8, Math.sin(t) * .1 - Math.PI / 2, 2.6, it.kind);
        chip(ctx, it.name, S.W / 2, 400, "#fff4d1", INK, { align: "center", size: 26 });
        txt(ctx, (si + 1) + " / " + ITEMS.length, S.W / 2, 452, { size: 18, color: "#cfe0ff", align: "center" });
      }
    }
    function drawMap(ctx, t, dt) {
      var g = geom(), R0 = ROUNDS[ri];
      panel(ctx, g.x0 - 8, g.y0 - 8, g.MS + 16, g.MS + 16, { r: 12, fill: "#0d1638" });
      ctx.drawImage(MAP, g.x0, g.y0, g.MS, g.MS);
      if (R0.fuzz) { ctx.fillStyle = "rgba(8,30,14,.28)"; ctx.fillRect(g.x0, g.y0, g.MS, g.MS); }
      ctx.fillStyle = "#fff"; ctx.fillRect(g.x0 + 14, g.y0 + g.MS - 22, 50 * g.k, 5);
      txt(ctx, "50 m", g.x0 + 14 + 25 * g.k, g.y0 + g.MS - 36, { size: 16, w: 700, color: "#fff", stroke: INK, lw: 4, align: "center" });
      rings.forEach(function (rg) {
        rg.t += dt;
        var sx = g.x0 + GS[rg.k][0] * g.k, sy = g.y0 + GS[rg.k][1] * g.k, grow = Math.min(1, rg.t / .9), rad = rg.r * g.k * u.ease.outCubic(grow), col = RCOL[rg.k];
        ctx.save(); ctx.beginPath(); ctx.rect(g.x0 - 60, g.y0 - 60, g.MS + 120, g.MS + 120); ctx.clip();
        if (R0.fuzz) { ctx.globalAlpha = .3; ctx.lineWidth = R0.fuzz * 2 * g.k; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(5,15,40,.6)"; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, TAU); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
        if (grow < 1) { ctx.lineWidth = 10; ctx.globalAlpha = .35; ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.restore();
      });
      if (showX && rings.length >= 2) {
        inter(GS[0], rings[0].r, GS[1], rings[1].r).forEach(function (p) {
          var x = g.x0 + p[0] * g.k, y = g.y0 + p[1] * g.k; if (x < 0 || x > S.W || y < 0 || y > H) return;
          txt(ctx, "?", x, y, { size: 34 + Math.sin(t * 6) * 3, w: 700, color: "#fff", stroke: INK, lw: 6, align: "center" });
        });
      }
      GS.forEach(function (s, i) {
        var x = g.x0 + s[0] * g.k, y = g.y0 + s[1] * g.k;
        satSprite(ctx, x, y + Math.sin(t * 2 + i) * 3, -Math.PI / 2, 1, "gps");
        chip(ctx, "GPS " + (i + 1), x, y + 36, RCOL[i], INK, { align: "center", size: 16 });
      });
      if (shown) {
        shown.t += dt;
        var dx = g.x0 + R0.d[0] * g.k, dy = g.y0 + R0.d[1] * g.k, k2 = u.ease.outBack(Math.min(1, shown.t / .5));
        ctx.setLineDash([6, 5]); ctx.lineWidth = 2.5; ctx.strokeStyle = "#fff"; ctx.fillStyle = "rgba(255,255,255,.18)";
        ctx.beginPath(); ctx.arc(dx, dy, R0.unc * g.k * k2, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        droneTop(ctx, dx, dy, k2 * .9, t);
        chip(ctx, "± " + R0.unc + " m", dx + R0.unc * g.k + 8, dy - 18, "#fff", INK, { size: 16 });
        var tx = g.x0 + shown.tap.x * g.k, ty = g.y0 + shown.tap.y * g.k;
        ctx.lineWidth = 3; ctx.strokeStyle = "#ff6b6b"; ctx.beginPath(); ctx.moveTo(tx - 8, ty - 8); ctx.lineTo(tx + 8, ty + 8); ctx.moveTo(tx + 8, ty - 8); ctx.lineTo(tx - 8, ty + 8); ctx.stroke();
      }
      // side panel
      var px = g.x0 + GS[1][0] * g.k + 72, pw = Math.min(360, S.W - px - 18);
      panel(ctx, px, 100, pw, 300);
      txt(ctx, "📡 GPS DISTANCES", px + 18, 128, { size: 19, w: 700, color: "#ffd46b", max: pw - 120 });
      txt(ctx, "Round " + (ri + 1) + " / " + ROUNDS.length, px + pw - 18, 128, { size: 17, color: "#cfe0ff", align: "right" });
      for (var i = 0; i < 3; i++) {
        var rg = rings[i], yy = 172 + i * 46;
        ctx.beginPath(); ctx.arc(px + 30, yy, 9, 0, TAU); ctx.fillStyle = RCOL[i]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        txt(ctx, "GPS " + (i + 1) + ":  " + (rg && rg.t > .9 ? Math.round(rg.r) + " m" + (R0.fuzz ? " ± " + R0.fuzz : "") : "…"), px + 50, yy, { size: 22, w: 700, color: "#fff", max: pw - 64 });
      }
      txt(ctx, R0.note, px + 18, 318, { size: 19, w: 700, color: R0.fuzz ? "#9ff0b8" : "#ffe08a", max: pw - 36 });
      txt(ctx, shown ? "Your tap: " + Math.round(shown.err) + " m away" : rings.length < 3 ? "Listen to all three satellites." : "Tap where all three meet!", px + 18, 360, { size: 18, color: "#cfe0ff", max: pw - 36 });
    }
    L.loop(function (dt, t) {
      wob = Math.max(0, wob - dt);
      if (flying) {
        flying.t += dt;
        if (flying.t >= .6) {
          var n = docked.filter(function (d) { return d.it.nav === flying.it.nav; }).length, p = dockPos(flying.it.nav, n);
          docked.push({ it: flying.it, x: p.x, y: p.y }); flying = null; si++; RQ.audio.sfx("pop");
          L.hud.set("gps", "🛰️ Sort " + si + " / " + ITEMS.length);
          if (si >= ITEMS.length) startGPS();
        }
      }
      dbg({ level: 5, W: S.W, phase: phase, si: si, ri: ri, rings: rings.length, pinging: pinging, geom: geom(), drone: ROUNDS[ri].d });
      S.frame(dt, function (ctx) {
        drawSpace(ctx, S.W, t);
        if (phase === "sort") drawSort(ctx, t); else drawMap(ctx, t, dt);
        tap.draw(ctx, t);
      });
    });
    async function startGPS() {
      phase = "wait"; bImg.hidden = true; bNav.hidden = true;
      await L.wait(700); if (!L.alive) return;
      await L.say("koa", "Great sorting! Now my drone is lost over the forest, so let's listen to the **GPS** satellites.");
      if (!L.alive) return;
      for (var rn = 0; rn < ROUNDS.length; rn++) {
        ri = rn; rings = []; shown = null; showX = false;
        L.hud.set("gps", "📍 Round " + (ri + 1) + " / " + ROUNDS.length);
        if (ri === 0) {
          phase = "ping"; bPing.hidden = false; bPing.innerHTML = "📡 Listen to GPS 1 <kbd>L</kbd>";
          S.info("Press **Listen**: the drone hears each GPS satellite's time signal and works out how far away it is. [L]");
          for (var k = 0; k < 3; k++) {
            await waitPing(); if (!L.alive) return;
            if (k === 0) await L.say("koa", "The drone is somewhere on this circle. One distance is not enough!");
            if (k === 1) { showX = true; await L.say("koa", "Two circles cross at two spots. Which one is it?"); }
            if (!L.alive) return;
            showX = false;
          }
          await L.say("koa", "Only one spot sits on all three circles. Tap it!");
          if (!L.alive) return;
        } else {
          phase = "auto"; bPing.hidden = true;
          if (ri === 2) { L.toast("🌳 Round 3: the drone is under thick trees!", "info", 2200); S.info("Under trees the signals get **fuzzy**: the circles become thick bands."); }
          else S.info("New drone spot! This time the drone listens to all three satellites by itself.");
          for (var j = 0; j < 3; j++) { await L.wait(ri === 2 && j === 0 ? 1500 : 550); if (!L.alive) return; phase = "ping"; ping(); phase = "auto"; await L.wait(950); if (!L.alive) return; }
        }
        phase = "tap"; bPing.hidden = true;
        var gg = geom(); tap.x0 = gg.x0 + gg.MS / 2; tap.y0 = gg.y0 + gg.MS / 2;
        S.info("Tap where **all three circles** meet. (Or arrows + [Enter])");
        var m = await new Promise(function (r) { tapRes = r; });
        if (!L.alive) return;
        phase = "show";
        var R0 = ROUNDS[ri], err = Math.hypot(m.x - R0.d[0], m.y - R0.d[1]), lim = R0.fuzz ? 22 : 12, dx = gg.x0 + R0.d[0] * gg.k, dy = gg.y0 + R0.d[1] * gg.k;
        shown = { t: 0, tap: m, err: err };
        if (err <= lim) { bull++; RQ.audio.sfx("powerup"); S.burst(dx, dy, null, 26); S.pop(dx, dy - 40, "BULLSEYE!", GOLD, 32); }
        else if (err <= lim * 2.5) { RQ.audio.sfx("good"); S.pop(dx, dy - 40, "Close!", "#8ff7b4", 30); }
        else { RQ.audio.sfx("bonk" in RQ.audio.SFX ? "bonk" : "drop"); S.pop(dx, dy - 40, "It was here!", "#ffb0b0", 28); }
        await L.wait(2300); if (!L.alive) return;
        if (ri === 2) { await L.say("koa", "Under thick trees, GPS has a harder time. The bigger circle shows all the places the drone might be."); if (!L.alive) return; }
      }
      await L.say("koa", "Real receivers use **4 or more** satellites. A phone is good to about **5 m** under open sky!");
      if (!L.alive) return;
      var sc = bull + (sortMiss === 0 ? 1 : 0);
      L.win({ stars: sc >= 4 ? 3 : sc >= 2 ? 2 : 1, msg: "You sorted the satellites and found the drone **" + ROUNDS.length + "** times with GPS circles!",
        stats: { "Sorting mistakes": sortMiss, "Bullseyes": bull + " / " + ROUNDS.length } });
    }
  }

  /* ============================================================ the game */
  RQ.game({
    id: "g06",
    music: "space",
    intro: [
      ["tuki", "Hi, I'm Tuki! I carry messages between the forest and the satellites."],
      ["tuki", "ReSeed needs fresh pictures from space. Let's learn to aim, time and snap!"]
    ],
    outro: [
      ["tuki", "Wow! You can find any spot, time a pass, dodge clouds and read pixels."],
      ["sprout", "Next stop: Cloud Sweeper. Let's clean up those cloudy pictures!"]
    ],
    levels: [
      { title: "Two numbers, one spot", goal: "Fly the crosshair to each latitude and longitude",
        intro: [["tuki", "Every place on Earth has two numbers. **Latitude** goes north and south, **longitude** goes east and west."],
                ["tuki", "Use the arrow keys, the buttons, or drag the globe. Fly the crosshair to each target!"]],
        cards: ["lat-lon"], play: levelLatLon },
      { title: "Snap the forests", goal: "Press SNAP when the frame covers the target",
        intro: [["tuki", "Meet **Sentinel-2**: twin satellites with cameras that see **10 m** pixels."],
                ["tuki", "When the camera frame turns green over the target, press **SPACE** or tap **SNAP**!"]],
        cards: ["sentinel-2", "landsat"], play: levelSnap },
      { title: "Clouds in the way", goal: "Collect 3 pictures with less than 30% cloud",
        intro: [["tuki", "Ketapang in Borneo is very cloudy. ReSeed uses a **30%** cloud limit for this site."],
                ["tuki", "Snap only the clear passes. If it's too cloudy, wait 5 days for the next pass!"]],
        cards: ["cloudy-pass"], play: levelClouds },
      { title: "Pixel zoom", goal: "Compare what a drone, 10 m and 30 m pixels can see",
        intro: [["tuki", "My favourite tree is in this forest! Let's see what a drone and two satellites can see."],
                ["hoot", "Each **pixel** is one colour for one square of ground. Bigger squares show fewer details."]],
        cards: ["pixel-size"], play: levelPixels },
      { title: "Where is my drone?", goal: "Use three GPS distances to find the lost drone",
        intro: [["koa", "G'day! Not every satellite takes pictures: **GPS** satellites help my drone know where it is."],
                ["koa", "First, sort the satellites. Then use three GPS distances to find my lost drone!"]],
        cards: ["gps"], play: levelGPS }
    ]
  });
})();
