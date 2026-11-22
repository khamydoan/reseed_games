/* g08 Cloud City — cloud computing as a light tycoon. One rescue job per level, three big choices, a visible deadline.
 * L1 rent a VM (region next to the data, CPU vs GPU) · L2 stop (deallocate) idle VMs · L3 storage account → container → blob,
 * buckets, hot/cool/archive tiers · L4 STAC search on the Planetary Computer · L5 cloud AI second opinion, key stays on the server.
 * Prices and times are round game numbers ("game version"); site names, dates, cloud % and the STAC URL are real ReSeed data. */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a", H = 460, GOLD = "#ffc53d";
  var FONT = "Fredoka, sans-serif", MONO = "'JetBrains Mono', monospace";
  var PROV = { azure: { name: "Azure", color: "#2b88d8" }, aws: { name: "AWS", color: "#f29100" }, gcp: { name: "Google Cloud", color: "#34a853" } };
  // Real Azure region names. In this game (game version) the picture store sits in West Europe.
  var REG = {
    weu: { key: "weu", name: "West Europe", where: "Netherlands", lat: 52.4, lon: 4.9 },
    eus: { key: "eus", name: "East US", where: "Virginia", lat: 37.4, lon: -78.4 },
    brs: { key: "brs", name: "Brazil South", where: "São Paulo", lat: -23.5, lon: -46.6 },
    wus: { key: "wus", name: "West US", where: "California", lat: 37.8, lon: -122.4 },
    sea: { key: "sea", name: "Southeast Asia", where: "Singapore", lat: 1.3, lon: 103.8 }
  };
  var NEAR = { rondonia: "brs", dixie: "wus", kalimantan: "sea" };     // the region closest to each My Site forest
  var MAXC = { rondonia: 15, dixie: 20, kalimantan: 30 };             // Site.max_cloud in reseed/config.py
  var VMS = {
    small: { icon: "🖥️", name: "Small CPU VM", sub: "2 CPU cores · 2 workers, fine for simple maths", rate: .1 },
    big: { icon: "🗄️", name: "Big CPU VM", sub: "16 CPU cores · 16 workers sharing the maths", rate: .8 },
    gpu: { icon: "🚀", name: "GPU VM", sub: "1 big GPU · built for training AI", rate: 3 }
  };
  var memo = {}; // remembers a weak result in this session, to give a hint on replay

  function data() { return RQ.data() || { sites: [], stac_url: "" }; }
  function mySite() { return RQ.mySite() || data().sites[0]; }
  function img(path) { var im = new Image(); if (path) im.src = RQ.url(path); return im; }
  function ok(im) { return im && im.complete && im.naturalWidth > 0; }
  function km(a, b) {
    var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtH(h) {
    var hh = Math.floor(h + 1e-6) % 24, mm = Math.floor((h - Math.floor(h + 1e-6)) * 4 + 1e-6) * 15;
    if (mm < 0) mm = 0;
    return (hh % 12 || 12) + ":" + (mm < 10 ? "0" : "") + mm + " " + (hh < 12 ? "AM" : "PM");
  }
  function hourLab(h) { var hh = Math.round(h) % 24; return (hh % 12 || 12) + (hh < 12 ? " AM" : " PM"); }
  function money(v) { return "$" + v.toFixed(2); }
  function night(h) {
    h = ((h % 24) + 24) % 24;
    if (h >= 21 || h < 5) return 1; if (h >= 18) return (h - 18) / 3; if (h < 7) return 1 - (h - 5) / 2; return 0;
  }
  var hexCache = {};
  function rgb(hex) { if (!hexCache[hex]) { var n = parseInt(hex.slice(1), 16); hexCache[hex] = [n >> 16, (n >> 8) & 255, n & 255]; } return hexCache[hex]; }
  function mix(a, b, k) { var p = rgb(a), q = rgb(b); return "rgb(" + Math.round(u.lerp(p[0], q[0], k)) + "," + Math.round(u.lerp(p[1], q[1], k)) + "," + Math.round(u.lerp(p[2], q[2], k)) + ")"; }

  /* ------------------------------------------------------------ drawing helpers */
  function txt(c, s, x, y, size, color, align, weight, font) {
    c.font = (weight || 600) + " " + size + "px " + (font || FONT);
    c.fillStyle = color || INK; c.textAlign = align || "center"; c.textBaseline = "middle"; c.fillText(s, x, y);
  }
  function pill(c, s, x, y, o) {
    o = o || {}; var size = o.size || 17, pad = o.pad || 12;
    c.font = (o.weight || 600) + " " + size + "px " + (o.font || FONT);
    var w = c.measureText(s).width + pad * 2, h = size + 12;
    var x0 = o.align === "left" ? x : o.align === "right" ? x - w : x - w / 2;
    u.rr(c, x0, y - h / 2, w, h, h / 2); c.fillStyle = o.bg || "#fff"; c.fill(); c.lineWidth = o.lw || 2.5; c.strokeStyle = INK; c.stroke();
    c.fillStyle = o.fg || INK; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(s, x0 + pad, y + 1);
    return { x: x0, y: y - h / 2, w: w, h: h };
  }
  function coin(c, x, y, r, spin) {
    var sx = Math.max(.15, Math.abs(Math.cos(spin || 0)));
    c.save(); c.translate(x, y); c.scale(sx, 1);
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = "#e89b00"; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(0, 0, r * .72, 0, 7); c.fillStyle = GOLD; c.fill();
    if (sx > .5 && r >= 8) txt(c, "$", 0, 1, r * 1.1, "#a86a00", "center", 700);
    c.restore();
  }
  function bar(c, x, y, w, k, color, label) {
    u.rr(c, x - w / 2, y - 9, w, 18, 9); c.fillStyle = "#fff"; c.fill();
    if (k > 0) { u.rr(c, x - w / 2, y - 9, Math.max(18, w * u.clamp(k, 0, 1)), 18, 9); c.fillStyle = color; c.fill(); }
    u.rr(c, x - w / 2, y - 9, w, 18, 9); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    if (label) txt(c, label, x, y - 24, 16, INK, "center", 700);
  }
  /** A floating cloud island; y = flat top surface. Union outline: ink circles first, then the white fill on top. */
  function island(c, x, y, w, ph) {
    var n = Math.max(3, Math.round(w / 55)), pts = [], i;
    for (i = 0; i <= n; i++) pts.push([x - w / 2 + w * i / n, y + 16 + Math.sin(i * 2.1 + ph) * 4, 20 + 9 * Math.abs(Math.sin(i * 1.3 + ph))]);
    pts.push([x - w * .2, y + 36, 30], [x + w * .22, y + 34, 28], [x, y + 46, 32]);
    c.fillStyle = INK;
    pts.forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], p[2] + 3.5, 0, 7); c.fill(); });
    u.rr(c, x - w / 2 - 3.5, y - 3.5, w + 7, 30, 15); c.fill();
    var g = c.createLinearGradient(0, y, 0, y + 80); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#c9def5");
    c.fillStyle = g;
    pts.forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], p[2], 0, 7); c.fill(); });
    u.rr(c, x - w / 2, y, w, 26, 13); c.fill();
    c.fillStyle = "rgba(160,190,225,.45)"; c.fillRect(x - w / 2 + 12, y + 2, w - 24, 4);
  }
  function flag(c, x, y, color, name, t) {
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 50); c.stroke();
    c.font = "700 15px " + FONT; var w = c.measureText(name).width + 18, wave = Math.sin(t * 4 + x) * 3;
    c.beginPath(); c.moveTo(x, y - 50); c.quadraticCurveTo(x + w / 2, y - 50 + wave, x + w, y - 48);
    c.lineTo(x + w, y - 26); c.quadraticCurveTo(x + w / 2, y - 26 + wave, x, y - 28); c.closePath();
    c.fillStyle = color; c.fill(); c.lineWidth = 2.5; c.stroke();
    txt(c, name, x + w / 2, y - 38 + wave * .5, 15, "#fff", "center", 700);
  }
  /** Data-centre building on an island (x centre, y base). */
  function building(c, x, y, w, h, color, t, o) {
    o = o || {};
    c.lineWidth = 3; c.strokeStyle = INK;
    u.rr(c, x - w / 2, y - h, w, h, 10); c.fillStyle = o.body || "#f2f6fb"; c.fill(); c.stroke();
    u.rr(c, x - w / 2 - 6, y - h - 12, w + 12, 20, 8); c.fillStyle = color; c.fill(); c.stroke();
    var cols = Math.max(2, Math.floor((w - 16) / 28)), rows = Math.max(1, Math.floor((h - (o.door ? 110 : 34)) / 26));
    var gx = (w - cols * 28) / 2 + 6;
    for (var r = 0; r < rows; r++) for (var k = 0; k < cols; k++) {
      var lit = o.lit !== false && Math.sin(t * 3 + r * 1.7 + k * 2.3) > -.4;
      u.rr(c, x - w / 2 + gx + k * 28, y - h + 18 + r * 26, 16, 14, 3);
      c.fillStyle = lit ? "#ffe9a3" : "#b9cde3"; c.fill(); c.lineWidth = 2; c.stroke();
    }
    if (o.flag) flag(c, x + w / 2 - 16, y - h - 12, o.flag.color, o.flag.name, t);
    if (o.title) pill(c, o.title, x, y - 20, { size: 15, bg: "#fff" });
  }
  function rackSize(kind) { return kind === "small" ? [62, 84] : kind === "big" ? [80, 128] : [96, 114]; }
  /** A rented VM drawn as a server rack. */
  function rack(c, x, y, kind, on, busy, t, name) {
    var d = rackSize(kind), w = d[0], h = d[1], i, k;
    c.lineWidth = 3; c.strokeStyle = INK;
    c.fillStyle = "rgba(0,0,0,.12)"; c.beginPath(); c.ellipse(x, y + 2, w * .6, 6, 0, 0, 7); c.fill();
    u.rr(c, x - w / 2, y - h, w, h, 10); c.fillStyle = kind === "gpu" ? "#223047" : "#2e3d50"; c.fill(); c.stroke();
    var rows = Math.floor((h - (kind === "gpu" ? 44 : 20)) / 16);
    for (i = 0; i < rows; i++) {
      var ry = y - h + 10 + i * 16;
      u.rr(c, x - w / 2 + 8, ry, w - 16, 11, 3); c.fillStyle = "#43566d"; c.fill();
      for (k = 0; k < 3; k++) {
        var lit = on && (busy ? Math.sin(t * 13 + i * 3.1 + k * 1.7) > -.2 : Math.sin(t * 2 + i + k * 2) > .5);
        c.beginPath(); c.arc(x + w / 2 - 15 - k * 9, ry + 5.5, 2.8, 0, 7);
        c.fillStyle = lit ? (k === 0 && busy ? "#ffd84d" : "#5dff8f") : "#18222e"; c.fill();
      }
    }
    if (kind === "gpu") {
      if (on) { c.fillStyle = "rgba(61,220,132,.35)"; c.beginPath(); c.arc(x, y - 22, 26, 0, 7); c.fill(); }
      u.rr(c, x - 28, y - 34, 56, 24, 5); c.fillStyle = on ? "#3ddc84" : "#2a5a3c"; c.fill(); c.lineWidth = 2.5; c.stroke();
      txt(c, "GPU", x, y - 21, 15, INK, "center", 700);
    }
    var fy = y - h - 14;
    c.beginPath(); c.arc(x, fy, 14, 0, 7); c.fillStyle = "#cfd8e3"; c.fill(); c.lineWidth = 3; c.stroke();
    c.save(); c.translate(x, fy); c.rotate(on ? t * (busy ? 18 : 6) : .3); c.fillStyle = "#5b6e84";
    for (k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.beginPath(); c.ellipse(6, 0, 6, 2.6, 0, 0, 7); c.fill(); }
    c.restore();
    if (busy && on) for (k = 0; k < 3; k++) {   // heat shimmer
      var hp = (t * 1.5 + k / 3) % 1; c.strokeStyle = "rgba(255,140,60," + (1 - hp) * .7 + ")"; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(x - 10 + k * 10, fy - 18 - hp * 26); c.quadraticCurveTo(x - 4 + k * 10, fy - 24 - hp * 26, x - 10 + k * 10, fy - 30 - hp * 26); c.stroke();
    }
    if (!on) for (k = 0; k < 3; k++) {          // sleeping Zzz
      var zp = (t * .5 + k / 3) % 1; c.globalAlpha = 1 - zp;
      txt(c, "z", x + w / 2 + 4 + zp * 18, y - h - 6 - zp * 42, 15 + k * 4, "#4f7fc0", "center", 700); c.globalAlpha = 1;
    }
    if (name) pill(c, name, x, y + 20, { size: 15, bg: on ? "#fff" : "#e3e8ee" });
  }
  function pic(c, x, y, s, seed, cloud) {
    c.save(); u.rr(c, x - s / 2, y - s / 2, s, s, 4); c.save(); c.clip();
    c.fillStyle = "#3f8f3f"; c.fillRect(x - s / 2, y - s / 2, s, s);
    var r = u.seeded(seed * 7 + 3);
    for (var i = 0; i < 5; i++) { c.fillStyle = i % 2 ? "#c9a25b" : "#2a6a33"; c.fillRect(x - s / 2 + r() * s * .7, y - s / 2 + r() * s * .7, s * (.2 + r() * .2), s * (.15 + r() * .2)); }
    if (cloud) {
      var n = Math.min(8, Math.round(cloud / 3)); c.fillStyle = "rgba(255,255,255,.9)";
      for (i = 0; i < n; i++) { c.beginPath(); c.arc(x - s / 2 + r() * s, y - s / 2 + r() * s, s * (.12 + Math.min(.2, cloud / 100)), 0, 7); c.fill(); }
    }
    c.restore(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); c.restore();
  }
  function keyIcon(c, x, y, s, glow) {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (glow) { c.fillStyle = "rgba(255,216,77,.5)"; c.beginPath(); c.arc(0, 0, 22, 0, 7); c.fill(); }
    c.lineWidth = 3; c.strokeStyle = INK; c.fillStyle = GOLD;
    c.beginPath(); c.arc(-8, 0, 8, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.rect(0, -3, 18, 6); c.fill(); c.stroke();
    c.beginPath(); c.rect(12, 3, 4, 6); c.fill(); c.stroke();
    c.restore();
  }
  var CHAR_IMG = {};
  function drawChar(c, who, x, y, s, mood) {
    var k = who + ":" + (mood || "");
    if (!CHAR_IMG[k] && RQ.chars && RQ.chars.svg) {
      var im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg(who, { mood: mood, size: 120 }));
      CHAR_IMG[k] = im;
    }
    if (ok(CHAR_IMG[k])) c.drawImage(CHAR_IMG[k], x - s / 2, y - s / 2, s, s);
  }

  /* ------------------------------------------------------------ world map (cartoon continents, lon/lat pairs) */
  var CONT = [
    [-168, 66, -162, 70, -140, 70, -125, 70, -110, 73, -95, 72, -80, 73, -75, 68, -62, 60, -56, 52, -66, 45, -70, 42, -76, 37, -81, 31, -80, 25, -82, 28, -85, 30, -90, 29, -97, 27, -97, 22, -92, 19, -87, 21, -88, 16, -84, 11, -80, 8, -77, 8, -82, 12, -87, 14, -92, 15, -96, 16, -105, 20, -110, 24, -115, 30, -117, 33, -121, 36, -124, 40, -124, 46, -127, 50, -133, 55, -140, 59, -150, 60, -158, 57, -165, 60],
    [-52, 62, -43, 60, -38, 65, -22, 70, -18, 77, -30, 83, -50, 82, -65, 78, -58, 74, -54, 68],
    [-80, 8, -75, 11, -71, 12, -62, 11, -55, 6, -50, 2, -44, -2, -35, -6, -37, -12, -39, -18, -42, -23, -48, -26, -53, -33, -58, -38, -63, -41, -65, -46, -68, -51, -72, -54, -75, -50, -74, -43, -72, -35, -71, -27, -70, -18, -76, -13, -81, -6, -80, -1, -78, 2],
    [-10, 36, -9, 43, -2, 44, -1, 46, -5, 48, 2, 51, 5, 53, 8, 54, 8, 57, 11, 58, 12, 56, 10, 54, 14, 54, 20, 55, 21, 57, 24, 59, 22, 61, 18, 61, 21, 64, 22, 66, 17, 69, 12, 66, 5, 62, 6, 58, 10, 59, 15, 69, 22, 70, 30, 70, 41, 67, 40, 62, 32, 60, 30, 55, 38, 50, 40, 47, 30, 46, 28, 41, 24, 40, 23, 38, 21, 40, 16, 40, 13, 44, 10, 44, 7, 44, 3, 43, 0, 39, -2, 37, -6, 36],
    [-6, 50, 1, 51, 2, 53, -1, 55, -3, 58, -6, 58, -5, 55, -3, 54, -5, 52],
    [-10, 52, -6, 52, -6, 55, -8, 55, -10, 54],
    [-24, 64, -22, 66, -15, 66, -13, 65, -18, 63],
    [-17, 15, -17, 21, -13, 27, -10, 30, -6, 36, 10, 37, 11, 33, 20, 31, 25, 32, 32, 31, 33, 28, 37, 20, 42, 12, 51, 12, 48, 5, 42, -1, 40, -10, 40, -16, 35, -24, 33, -29, 27, -34, 20, -35, 17, -29, 12, -18, 12, -6, 9, 0, 9, 4, 5, 6, -4, 5, -8, 4, -13, 8],
    [44, -25, 47, -25, 50, -15, 49, -12, 44, -17],
    [28, 41, 36, 36, 35, 32, 35, 28, 39, 21, 43, 13, 52, 15, 57, 18, 59, 22, 56, 26, 52, 28, 48, 30, 50, 30, 54, 27, 57, 26, 62, 25, 67, 25, 70, 21, 73, 17, 77, 8, 80, 13, 80, 16, 87, 22, 92, 22, 94, 17, 98, 16, 98, 8, 100, 4, 103, 1, 104, 2, 103, 5, 101, 7, 100, 13, 103, 11, 105, 9, 107, 11, 109, 12, 108, 16, 106, 20, 108, 22, 111, 21, 114, 22, 117, 24, 120, 27, 122, 30, 121, 32, 119, 35, 122, 37, 121, 39, 118, 39, 121, 41, 125, 40, 127, 38, 127, 35, 129, 35, 130, 43, 135, 44, 140, 48, 141, 53, 137, 54, 142, 59, 150, 59, 156, 61, 160, 61, 163, 64, 170, 66, 180, 66, 180, 71, 170, 70, 160, 70, 150, 72, 140, 73, 130, 71, 120, 73, 113, 74, 105, 77, 96, 76, 80, 73, 73, 69, 68, 70, 60, 69, 55, 68, 45, 68, 41, 67, 40, 62, 32, 60, 30, 55, 38, 50, 40, 47, 30, 46],
    [130, 31, 132, 34, 136, 34, 140, 35, 141, 38, 142, 41, 140, 41, 139, 38, 136, 36, 132, 35],
    [140, 42, 143, 42, 145, 44, 142, 46, 141, 44],
    [95, 5, 98, 4, 104, -2, 106, -6, 104, -5, 101, -2, 97, 2],
    [109, 1, 110, -3, 114, -4, 116, -4, 118, 0, 119, 1, 117, 5, 117, 7, 115, 5, 113, 3, 111, 2],
    [106, -6, 114, -7, 114, -8, 106, -7],
    [131, -1, 138, -2, 141, -3, 146, -6, 150, -10, 146, -9, 142, -9, 138, -8, 135, -4, 132, -3],
    [119, -5, 121, -1, 123, 1, 125, 1, 121, -1, 123, -5, 121, -4],
    [120, 18, 122, 18, 123, 14, 126, 9, 125, 6, 122, 8, 121, 13],
    [114, -22, 114, -26, 115, -34, 118, -35, 123, -34, 129, -32, 132, -32, 135, -35, 138, -35, 140, -38, 145, -38, 148, -38, 150, -37, 153, -31, 153, -25, 150, -22, 146, -19, 145, -15, 142, -11, 141, -13, 141, -17, 139, -17, 136, -15, 137, -12, 133, -11, 130, -12, 127, -14, 125, -15, 122, -17, 119, -20],
    [145, -41, 148, -41, 148, -43, 146, -44],
    [172, -34, 175, -37, 178, -38, 175, -41, 173, -41, 174, -39],
    [167, -46, 171, -44, 174, -41, 172, -41, 168, -44],
    [80, 6, 82, 7, 81, 10, 80, 9]
  ];
  /** Draws the map and returns a projection P(lat, lon) -> {x, y}. Equirectangular, lon -170..180, lat 78..-58. */
  function worldMap(c, x, y, w, h, grid) {
    var P = function (lat, lon) { return { x: x + (lon + 170) / 350 * w, y: y + (78 - lat) / 136 * h }; };
    c.save(); u.rr(c, x, y, w, h, 16);
    var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "#8fd0f5"); g.addColorStop(1, "#5fb0e6");
    c.fillStyle = g; c.fill(); c.save(); c.clip();
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1.2;
    for (var la = -30; la <= 60; la += 30) { var p = P(la, 0); c.beginPath(); c.moveTo(x, p.y); c.lineTo(x + w, p.y); c.stroke(); }
    for (var lo = -150; lo <= 180; lo += 30) { var q = P(0, lo); c.beginPath(); c.moveTo(q.x, y); c.lineTo(q.x, y + h); c.stroke(); }
    c.fillStyle = "#a6dc85"; c.strokeStyle = "#4b8a45"; c.lineWidth = 1.6; c.lineJoin = "round";
    CONT.forEach(function (poly) {
      c.beginPath();
      for (var i = 0; i < poly.length; i += 2) { var pt = P(poly[i + 1], poly[i]); if (i) c.lineTo(pt.x, pt.y); else c.moveTo(pt.x, pt.y); }
      c.closePath(); c.fill(); c.stroke();
    });
    if (grid) {
      var e = P(0, -170); c.setLineDash([6, 5]); c.strokeStyle = "rgba(29,43,58,.45)"; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x, e.y); c.lineTo(x + w, e.y); c.stroke(); c.setLineDash([]);
      txt(c, "equator", x + w - 10, e.y - 10, 13, "rgba(29,43,58,.75)", "right", 600);
    }
    c.restore(); c.lineWidth = 3.5; c.strokeStyle = INK; u.rr(c, x, y, w, h, 16); c.stroke(); c.restore();
    return P;
  }
  function pinDraw(c, x, y, color, label, t, big) {
    var r = big ? 15 : 12, bob = big ? Math.sin(t * 5) * 3 : 0;
    c.save(); c.translate(0, bob);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - r * .7, y - r * 1.4); c.arc(x, y - r * 1.8, r, Math.PI * .8, Math.PI * .2); c.closePath();
    c.fillStyle = color; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    if (label) txt(c, label, x, y - r * 1.8, r * 1.1, "#fff", "center", 700);
    c.restore();
  }
  function treePin(c, x, y) {
    c.lineWidth = 2.5; c.strokeStyle = INK;
    c.fillStyle = "#8a5a35"; c.fillRect(x - 2.5, y - 8, 5, 8);
    c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x - 11, y - 7); c.lineTo(x + 11, y - 7); c.closePath(); c.fillStyle = "#2f9e4f"; c.fill(); c.stroke();
  }
  function dbIcon(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s || 1, s || 1); c.lineWidth = 2.5; c.strokeStyle = INK;
    for (var i = 2; i >= 0; i--) {
      c.beginPath(); c.ellipse(0, i * 9, 13, 5, 0, 0, Math.PI); c.lineTo(-13, i * 9 - 8); c.ellipse(0, i * 9 - 8, 13, 5, 0, Math.PI, 0, true); c.closePath();
      c.fillStyle = i ? "#f6c04a" : "#ffd84d"; c.fill(); c.stroke();
    }
    c.beginPath(); c.ellipse(0, -8, 13, 5, 0, 0, 7); c.fillStyle = "#ffe68a"; c.fill(); c.stroke();
    c.restore();
  }
  /** Microsoft Planetary Computer data warehouse (in Azure West Europe). */
  function warehouse(c, x, y, t) {
    building(c, x, y, 200, 140, "#0f8f8a", t, { flag: PROV.azure, door: true });
    c.save(); c.translate(x - 50, y - 48); c.lineWidth = 2.5; c.strokeStyle = INK;
    c.beginPath(); c.arc(0, 0, 22, 0, 7); c.fillStyle = "#74c0fc"; c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, 0, 9 + Math.abs(Math.sin(t)) * 4, 22, 0, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(-22, 0); c.lineTo(22, 0); c.stroke(); c.restore();
    dbIcon(c, x + 48, y - 52, 1.2);
    pill(c, "Planetary Computer", x, y - 13, { size: 15 });
  }

  /* ------------------------------------------------------------ scene shell: canvas on top, control panel below */
  function scene(L, o) {
    var root = u.el("div", { class: "fill cc-root" }), top = u.el("div", { class: "cc-scene" });
    var panel = u.el("div", { class: "cc-panel" }), job = u.el("div", { class: "cc-job" }), area = u.el("div", { class: "cc-area" });
    panel.appendChild(job); panel.appendChild(area); root.appendChild(top); root.appendChild(panel); L.stage.appendChild(root);
    var S = { L: L, area: area, parts: [], meters: [], hits: [], t: 0, hour: o.start, start: o.start, end: o.end, deadline: o.deadline,
      dlName: o.dlName || "Deadline", spent: 0, speed: 0, stopAt: null, est: null, key: null, draw: null, lights: null, over: null, last: {}, hud: {} };
    var cv = L.canvas({ w: 1100, h: H, parent: top, fill: true, label: o.label || "Cloud City", onResize: function (api) { S.W = api.w; } });
    S.cv = cv; S.ctx = cv.ctx; S.W = cv.w;
    S.clouds = []; for (var i = 0; i < 7; i++) S.clouds.push({ x: Math.random() * 1500, y: 100 + Math.random() * 300, s: .6 + Math.random() * .9, v: 6 + Math.random() * 10 });
    S.job = function (title, text) { job.innerHTML = "<h3>" + u.esc(title) + "</h3><div>" + RQ.ui.md(text) + "</div>"; };
    S.sfx = function (name, gap) { if (S.t - (S.last[name] == null ? -99 : S.last[name]) >= gap) { S.last[name] = S.t; RQ.audio.sfx(name); } };
    S.hit = function (x, y, w, h, fn) { S.hits.push({ x: x, y: y, w: w, h: h, fn: fn }); };
    S.meter = function (m) { m.spent = 0; m.waste = 0; m.acc = 0; S.meters.push(m); return m; };
    S.rateNow = function () { var r = 0; S.meters.forEach(function (m) { r += m.on ? m.rate : (m.disk || 0); }); return r; };
    S.coinTo = function (x, y, small) { if (S.parts.length < 260) S.parts.push({ type: "coin", x0: 38, y0: 36, x1: x, y1: y, age: 0, dur: .75, r: small ? 6 : 10, quiet: small }); };
    S.fly = function (p) { p.type = "fly"; p.age = 0; S.parts.push(p); return p; };
    S.puff = function (x, y, n, col) { for (var k = 0; k < (n || 8); k++) S.parts.push({ type: "puff", x: x + u.rand(-20, 20), y: y + u.rand(-10, 10), vx: u.rand(-60, 60), vy: u.rand(-50, 10), r: u.rand(8, 16), age: 0, life: .7, col: col || "#fff" }); };
    S.sparks = function (x, y, n) { for (var k = 0; k < (n || 16); k++) S.parts.push({ type: "spark", x: x, y: y, vx: u.rand(-220, 220), vy: u.rand(-300, -60), age: 0, life: .9, col: u.pick(["#ffd84d", "#7ee787", "#74c0fc", "#ff8fab"]) }); };
    S.float = function (s, x, y, col) { S.parts.push({ type: "text", s: s, x: x, y: y, age: 0, life: 1.2, col: col || INK }); };
    /** Run the clock for `hours` of game time over `secs` real seconds, then call done(). Driven by the loop, so it pauses with the game. */
    S.task = function (hours, secs, done) { S.speed = hours / secs; S.stopAt = S.hour + hours; S.taskDone = done; };
    /** Pause the clock while a speech bubble is open. */
    S.talk = function (p) { var sp = S.speed; S.speed = 0; return p.then(function (v) { if (L.alive && S.speed === 0) S.speed = sp; return v; }); };
    S.cards = function (items, onPick) {
      area.innerHTML = "";
      var row = u.el("div", { class: "cc-cards" }), api = { btns: [], locked: false };
      items.forEach(function (it, i) {
        var b = u.el("button", { class: "cc-card", "aria-label": (i + 1) + ": " + it.name.replace(/\*\*/g, "") },
          u.el("span", { class: "cc-key", text: String(i + 1) }),
          u.el("div", { class: "cc-top" }, u.el("span", { class: "cc-ico", html: it.icon }), u.el("b", { html: RQ.ui.md(it.name) })),
          it.sub ? u.el("small", { html: RQ.ui.md(it.sub) }) : null,
          it.price ? u.el("span", { class: "cc-price", html: it.price }) : null);
        L.on(b, "click", function () { choose(i); });
        row.appendChild(b); api.btns.push(b);
      });
      area.appendChild(row);
      function choose(i) { if (api.locked || !L.alive) return; RQ.audio.sfx("select"); onPick(i, api.btns[i]); }
      api.choose = choose;
      api.lock = function (i) { api.locked = true; api.btns.forEach(function (b, k) { b.disabled = true; if (k === i) b.classList.add("picked"); }); };
      api.unlock = function () { api.locked = false; api.btns.forEach(function (b) { b.disabled = false; b.classList.remove("picked", "no", "good"); }); };
      api.no = function (i) { var b = api.btns[i]; b.classList.remove("no"); void b.offsetWidth; b.classList.add("no"); };
      S.key = function (k) { var n = parseInt(k, 10); if (n >= 1 && n <= items.length) { choose(n - 1); return true; } };
      return api;
    };
    var note = u.el("div", { class: "cc-note" }), noteTimer = null; top.appendChild(note);
    /** Short message just below the time bar (engine toasts would cover the deadline). */
    S.note = function (text, kind, ms) {
      note.className = "cc-note show " + (kind || "info"); note.innerHTML = RQ.ui.md(text);
      note.style.top = Math.round(cv.cv.offsetTop + 80 * cv.scale) + "px";
      clearTimeout(noteTimer); noteTimer = L.timeout(function () { note.className = "cc-note"; }, ms || 2200);
    };
    S.status = function (html) {
      var box = area.querySelector(".cc-bill");
      if (box && S._status === html) return; S._status = html;
      if (!box) { area.innerHTML = ""; box = u.el("div", { class: "cc-bill" }); area.appendChild(box); }
      box.innerHTML = html;
    };
    S.setHud = function (k, v) { if (S.hud[k] !== v) { S.hud[k] = v; L.hud.set(k, v); } };

    L.on(window, "keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      var ae = document.activeElement, tag = ae && ae.tagName;
      if ((e.key === "Enter" || e.key === " ") && tag === "BUTTON") return;
      if (tag === "INPUT" && /Arrow/.test(e.key)) return;
      if (S.key && S.key(e.key, e)) e.preventDefault();
    });
    function hitAt(p) { for (var i = S.hits.length - 1; i >= 0; i--) { var h = S.hits[i]; if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h; } return null; }
    L.on(cv.cv, "pointerdown", function (e) { var h = hitAt(cv.toLocal(e)); if (h) h.fn(cv.toLocal(e)); });
    L.on(cv.cv, "pointermove", function (e) { cv.cv.style.cursor = hitAt(cv.toLocal(e)) ? "pointer" : "default"; });

    var lastN = -1;
    L.loop(function (dt, t) {
      S.t = t;
      if (S.speed > 0) {
        var dh = dt * S.speed;
        if (S.stopAt != null) dh = Math.min(dh, Math.max(0, S.stopAt - S.hour));
        S.hour += dh; tick(dh);
        if (S.onTime) S.onTime(dh);
        if (S.stopAt != null && S.hour >= S.stopAt - 1e-9) { S.speed = 0; S.stopAt = null; var f = S.taskDone; S.taskDone = null; if (f) f(); }
      }
      if (!L.alive) return;
      S.hits = [];
      var c = S.ctx, n = night(S.hour);
      c.fontKerning = "none";
      if (Math.abs(n - lastN) > .02) { lastN = n; cv.wrap.style.background = "linear-gradient(" + mix("#7cc8ff", "#0e1a40", n) + "," + mix("#e8f7ff", "#2d3570", n) + ")"; }
      sky(S, c, dt, t, n);
      if (S.draw) S.draw(c, t, dt);
      if (n > .01) { c.fillStyle = "rgba(12,20,58," + (n * .4) + ")"; c.fillRect(0, 0, S.W, H); }
      if (S.lights) S.lights(c, t, dt);
      stepParts(S, c, dt);
      if (S.over) S.over(c, t, dt);
      topBar(S, c, t);
      S.setHud("clock", "⏰ " + fmtH(S.hour));
      S.setHud("money", "💰 " + money(S.spent));
    });
    function tick(dh) {
      S.meters.forEach(function (m) {
        var cost = (m.on ? m.rate : (m.disk || 0)) * dh;
        S.spent += cost; m.spent += cost; if (m.on && !m.busy) m.waste += cost;
        m.acc += cost;
        var step = m.on ? .2 : .04;
        while (m.acc >= step) { m.acc -= step; if (m.x != null) S.coinTo(m.x + u.rand(-14, 14), m.y, !m.on); }
      });
    }
    return S;
  }

  function sky(S, c, dt, t, n) {
    var W = S.W, g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix("#7cc8ff", "#0e1a40", n)); g.addColorStop(1, mix("#e8f7ff", "#2d3570", n));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (n > .15) for (var i = 0; i < 60; i++) {
      var sx = (i * 197.3) % W, sy = 80 + (i * 83.7) % 300, tw = .5 + .5 * Math.sin(t * 2 + i);
      c.fillStyle = "rgba(255,255,255," + (n * tw * .9) + ")"; c.fillRect(sx, sy, 2.5, 2.5);
    }
    var sunX = W - 110, sunY = 120;
    if (S.noSun) n = Math.max(n, 0), sunY = -999;
    if (n < .9 && sunY > 0) {
      c.save(); c.globalAlpha = 1 - n; c.translate(sunX, sunY); c.rotate(t * .12); c.fillStyle = "rgba(255,214,77,.4)";
      for (i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.fillRect(38, -5, 22, 10); }
      c.restore(); c.globalAlpha = 1 - n;
      c.beginPath(); c.arc(sunX, sunY, 30, 0, 7); c.fillStyle = "#ffd84d"; c.fill(); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke(); c.globalAlpha = 1;
    }
    if (n > .1 && sunY > 0) {
      c.globalAlpha = n; c.beginPath(); c.arc(sunX, sunY, 26, 0, 7); c.fillStyle = "#f4f1d0"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(sunX + 12, sunY - 8, 22, 0, 7); c.fillStyle = mix("#7cc8ff", "#0e1a40", n); c.fill(); c.globalAlpha = 1;
    }
    c.fillStyle = "rgba(255,255,255," + (.7 - n * .45) + ")";
    S.clouds.forEach(function (k) {
      k.x += k.v * dt; if (k.x > W + 160) k.x = -160;
      c.beginPath(); c.arc(k.x, k.y, 24 * k.s, 0, 7); c.arc(k.x + 28 * k.s, k.y - 12 * k.s, 30 * k.s, 0, 7); c.arc(k.x + 60 * k.s, k.y, 22 * k.s, 0, 7); c.fill();
    });
  }

  function topBar(S, c, t) {
    var W = S.W, k;
    c.fillStyle = "rgba(255,253,247,.96)"; c.strokeStyle = INK; c.lineWidth = 3;
    u.rr(c, 8, 6, W - 16, 64, 16); c.fill(); c.stroke();
    coin(c, 38, 36, 16, t * 2.5);
    txt(c, money(S.spent), 62, 27, 22, INK, "left", 700);
    var mw = c.measureText(money(S.spent)).width;
    txt(c, "(game version)", 62 + mw + 6, 28, 13, "#6b7887", "left", 600);
    var r = S.rateNow();
    txt(c, r > .001 ? "+" + money(r) + " per hour" : "meter is off", 62, 51, 15, r >= .5 ? "#c0392b" : r > .001 ? "#a66b00" : "#2f9e4f", "left", 600);
    var cx = 266;   // clock face
    c.beginPath(); c.arc(cx, 37, 19, 0, 7); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 3; c.stroke();
    var ah = (S.hour % 12) / 12 * Math.PI * 2, am = (S.hour % 1) * Math.PI * 2;
    c.lineCap = "round"; c.lineWidth = 3.5; c.beginPath(); c.moveTo(cx, 37); c.lineTo(cx + Math.sin(ah) * 10, 37 - Math.cos(ah) * 10); c.stroke();
    c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx, 37); c.lineTo(cx + Math.sin(am) * 15, 37 - Math.cos(am) * 15); c.stroke(); c.lineCap = "butt";
    txt(c, fmtH(S.hour), cx + 28, 37, 21, INK, "left", 700);
    var x0 = cx + 150, x1 = W - 34, y = 42, span = S.end - S.start;
    var X = function (h) { return x0 + u.clamp((h - S.start) / span, 0, 1) * (x1 - x0); };
    var xd = X(S.deadline), xh = X(S.hour);
    c.save(); u.rr(c, x0, y - 7, x1 - x0, 14, 7); c.fillStyle = "#e7edf3"; c.fill(); c.clip();
    c.fillStyle = "rgba(209,73,91,.22)"; c.fillRect(xd, y - 7, x1 - xd, 14);
    c.fillStyle = S.hour <= S.deadline + 1e-6 ? "#5fcf7f" : "#ff8a7a"; c.fillRect(x0, y - 7, xh - x0, 14); c.restore();
    u.rr(c, x0, y - 7, x1 - x0, 14, 7); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    var step = span > 8 ? 2 : 1;
    for (k = Math.ceil(S.start); k <= S.end + 1e-6; k += step) {
      var hx = X(k); if (Math.abs(hx - xd) < 26) continue;
      txt(c, hourLab(k), hx, y + 18, 14, "#4a5b6d", "center", 600);
    }
    if (S.est != null) {   // ghost marker: when the job will finish
      var ex = X(S.est), late = S.est > S.deadline + 1e-6;
      c.setLineDash([4, 4]); c.strokeStyle = late ? "#c0392b" : "#2f9e4f"; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(ex, y - 12); c.lineTo(ex, y + 10); c.stroke(); c.setLineDash([]);
      pill(c, S.est > S.end ? "done ≫ later!" : "done ≈ " + fmtH(S.est), ex, y - 22, { size: 13, pad: 7, lw: 2, bg: late ? "#ffe0e4" : "#d9f7df", align: ex > x1 - 90 ? "right" : ex < x0 + 60 ? "left" : null });
    }
    c.strokeStyle = "#c0392b"; c.lineWidth = 3; c.beginPath(); c.moveTo(xd, y + 10); c.lineTo(xd, y - 14); c.stroke();
    pill(c, "⏰ " + S.dlName + " " + hourLab(S.deadline), xd, y + 19, { size: 13, pad: 7, lw: 2, bg: "#d1495b", fg: "#fff", weight: 700, align: xd > x1 - 80 ? "right" : null });
    c.save(); c.translate(xh, y);   // sun (or moon) rides the time bar
    if (night(S.hour) > .5) { c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fillStyle = "#f4f1d0"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); }
    else {
      c.rotate(t * 1.5); c.fillStyle = "#ffb703"; for (k = 0; k < 8; k++) { c.rotate(Math.PI / 4); c.fillRect(11, -2, 6, 4); }
      c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fillStyle = "#ffd84d"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    }
    c.restore();
  }

  function stepParts(S, c, dt) {
    S.parts = S.parts.filter(function (p) {
      p.age += dt;
      var k, x, y, e;
      if (p.type === "coin") {
        k = Math.min(1, p.age / p.dur); e = u.ease.inOut(k);
        x = u.lerp(p.x0, p.x1, e); y = u.lerp(p.y0, p.y1, e) - Math.sin(k * Math.PI) * 60;
        coin(c, x, y, p.r, p.age * 12);
        if (k >= 1) { if (!p.quiet) S.sfx("coin", .22); return false; }
        return true;
      }
      if (p.type === "fly") {
        k = Math.min(1, p.age / p.dur); e = p.linear ? k : u.ease.inOut(k);
        x = u.lerp(p.x0, p.x1, e); y = u.lerp(p.y0, p.y1, e) - Math.sin(e * Math.PI) * (p.arc || 0);
        if (p.trail && k > .03 && k < .97) {
          var e2 = Math.max(0, e - .07), x2 = u.lerp(p.x0, p.x1, e2), y2 = u.lerp(p.y0, p.y1, e2) - Math.sin(e2 * Math.PI) * (p.arc || 0);
          c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 3; c.lineCap = "round";
          for (var j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(x2 + j * 3, y2 + j * 7); c.lineTo(u.lerp(x2, x, .55) + j * 3, u.lerp(y2, y, .55) + j * 7); c.stroke(); }
          c.lineCap = "butt";
        }
        p.draw(c, x, y, k);
        if (k >= 1) { if (p.done) p.done(); return false; }
        return true;
      }
      if (p.type === "puff") {
        k = p.age / p.life; p.x += p.vx * dt; p.y += p.vy * dt;
        c.globalAlpha = Math.max(0, 1 - k); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r * (1 + k), 0, 7); c.fill(); c.globalAlpha = 1;
        return k < 1;
      }
      if (p.type === "spark") {
        k = p.age / p.life; p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        c.globalAlpha = Math.max(0, 1 - k); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, 4, 0, 7); c.fill(); c.globalAlpha = 1;
        return k < 1;
      }
      if (p.type === "text") {
        k = p.age / p.life; c.globalAlpha = Math.max(0, 1 - k * k);
        c.lineWidth = 5; c.strokeStyle = "#fff"; c.font = "700 22px " + FONT; c.textAlign = "center"; c.textBaseline = "middle";
        c.strokeText(p.s, p.x, p.y - k * 50); txt(c, p.s, p.x, p.y - k * 50, 22, p.col, "center", 700); c.globalAlpha = 1;
        return k < 1;
      }
      return false;
    });
  }

  function fileIcon(c, x, y, name) {
    c.lineWidth = 2.5; c.strokeStyle = INK;
    c.beginPath(); c.moveTo(x - 16, y - 20); c.lineTo(x + 6, y - 20); c.lineTo(x + 16, y - 10); c.lineTo(x + 16, y + 20); c.lineTo(x - 16, y + 20); c.closePath();
    c.fillStyle = "#fff"; c.fill(); c.stroke();
    c.fillStyle = "#b197fc"; c.fillRect(x - 10, y - 4, 20, 4); c.fillRect(x - 10, y + 4, 14, 4);
    if (name) pill(c, name, x, y + 36, { size: 14, pad: 7, lw: 2 });
  }
  function bugsOn(c, m, x, y, t) {
    if (!m.on) return;
    for (var i = 0; i < m.bugs; i++) drawChar(c, "bug", x - 30 + i * 30, y - 30 - Math.abs(Math.sin(t * 7 + i * 2)) * 12, 44, "happy");
  }

  /* ============================================================ L1 Rent a VM: region near the data, CPU vs GPU */
  function lvRent(L) {
    var site = mySite(), S = scene(L, { start: 9, end: 15, deadline: 13 });
    var near = REG[NEAR[site.id]] || REG.brs;
    var regs = [REG.weu, REG.eus, near].map(function (r) { var d = km(r, REG.weu); return Object.assign({}, r, { km: d < 50 ? 0 : Math.round(d / 100) * 100 }); });
    var nPics = u.clamp(site.image && site.image.scenes ? site.image.scenes.length : 8, 3, 8);
    var ndvi = img(site.files && site.files.ndvi);
    var CPU_H = { small: 2, big: .5, gpu: .5 };
    var st = { phase: "region", reg: null, vm: null, dropT: -1, got: 0, sent: 0, dlH: 0, dl0: 0, prog: 0, finish: null, popT: -1, meter: null };
    S.job("📋 Rescue job", "Make the **greenness map** (NDVI) of **" + site.name + "** by **1 PM**.");
    var cards = S.cards(regs.map(function (r) {
      return { icon: "📍", name: "Azure **" + r.name + "**",
        sub: r.where + " · " + (r.km === 0 ? "🛰️ in this game, the picture data is here!" : u.fmt(r.km) + " km from the picture data") + (r.key === near.key ? " · near your forest 🌳" : "") };
    }), pickRegion);
    if (memo.l1late) L.timeout(function () { S.talk(L.hint("In this game the pictures live in **West Europe**. Rent your VM next to the data, not next to the forest!", "tuki")); }, 300);

    function lay() {
      var W = S.W;
      if (st.reg && st.reg.km === 0) return { same: true, base: 352, whX: W * .5 - 210, isX: W * .5, iw: 740, vmX: W * .5 + 55, scX: W * .5 + 225 };
      return { same: false, base: 352, whX: W * .23, isX: W * .72, iw: 360, vmX: W * .72 - 70, scX: W * .72 + 88 };
    }
    function pickRegion(i) {
      st.reg = regs[i]; cards.lock(i); RQ.audio.sfx("pop");
      L.timeout(function () {
        st.phase = "vm";
        S.job("📋 Rescue job", "Region: **Azure " + st.reg.name + "**. Now rent a computer and make the NDVI map by **1 PM**.");
        cards = S.cards(["small", "big", "gpu"].map(function (k) { var v = VMS[k]; return { icon: v.icon, name: v.name, sub: v.sub, price: money(v.rate) + " / hour" }; }), pickVm);
        var p = lay(); S.puff(p.vmX, p.base - 40, 10);
      }, 550);
    }
    function pickVm(i) {
      st.vm = ["small", "big", "gpu"][i]; cards.lock(i); st.dropT = S.t; RQ.audio.sfx("whoosh");
      L.timeout(function () {
        var p = lay(); RQ.audio.sfx("drop"); S.puff(p.vmX, p.base, 12);
        st.meter = S.meter({ rate: VMS[st.vm].rate, on: true, busy: true, x: p.vmX, y: p.base - 60 });
        st.phase = "dl"; st.dl0 = S.hour; st.dlH = .5 + st.reg.km / 4000;
        S.est = S.hour + st.dlH + CPU_H[st.vm];
        S.speed = .55; status();
      }, 600);
    }
    function status() {
      var a = st.phase === "dl" ? "⏳" : "✅", b = st.phase === "cpu" ? "⚙️" : st.phase === "done" ? "✅" : "⏳";
      S.status("<h4>" + VMS[st.vm].icon + " " + VMS[st.vm].name + " in Azure " + u.esc(st.reg.name) + " · " + money(VMS[st.vm].rate) + " per hour</h4>" +
        '<div class="ln"><span>' + a + " Download " + nPics + " pictures of your forest</span><b>" + st.got + " / " + nPics + "</b></div>" +
        '<div class="ln"><span>' + b + " Work out NDVI for every pixel</span><b>" + Math.round(st.prog * 100) + "%</b></div>" +
        '<div class="ln tot"><span>💰 Bill so far</span><span>' + money(S.spent) + "</span></div>");
    }
    function send(secs) {
      var p = lay(), idx = st.sent++;
      S.sfx("whoosh", .35);
      S.fly({ x0: p.whX + 40, y0: p.base - 120, x1: p.vmX, y1: p.base - rackSize(st.vm)[1] * .6, dur: secs, arc: p.same ? 50 : 110, trail: true,
        draw: function (c, x, y) { pic(c, x, y, 30, idx); },
        done: function () {
          st.got++; S.sfx("pop", .06); S.puff(p.vmX, p.base - 80, 3);
          if (st.got >= nPics && st.phase === "dl") { st.phase = "cpu"; RQ.audio.sfx("powerup"); S.note("⚙️ All pictures are here! Now the VM does the maths.", "info", 1800); }
        } });
    }
    S.onTime = function (dh) {
      if (st.phase === "dl") {
        var F = st.dlH * .35, el = S.hour - st.dl0, gap = (st.dlH - F) / Math.max(1, nPics - 1);
        while (st.sent < nPics && el >= st.sent * gap) send(F / S.speed);
      } else if (st.phase === "cpu") {
        st.prog = Math.min(1, st.prog + dh / CPU_H[st.vm]);
        if (st.prog >= 1) finish();
      }
      if (st.vm && st.phase !== "done") status();
    };
    function finish() {
      st.phase = "done"; st.finish = S.hour; S.est = null; S.speed = 0;
      st.meter.on = false; st.meter.busy = false; st.popT = S.t;
      RQ.audio.sfx("bloom"); var p = lay(); S.sparks(p.scX, p.base - 110, 26); status();
      S.note("✅ NDVI map ready! Tuki deallocated the VM for you.", "good", 2400);
      L.timeout(end, 2900);
    }
    function end() {
      var onTime = st.finish <= 13 + 1e-6, cost = S.spent, stars = !onTime ? 1 : cost <= 1 ? 3 : 2;
      memo.l1late = !onTime;
      var msg = !onTime ? "The map is ready, but **late**: the pictures had a very long trip. Rent your VM next to the **data**!"
        : st.vm === "gpu" ? "On time! But a **GPU** for simple NDVI maths is like taking a rocket to the bakery."
        : cost <= 1 ? "On time and cheap! A **CPU VM** right next to the data is perfect for NDVI maths."
        : "On time! A VM closer to the data would finish sooner and cost less.";
      L.win({ stars: stars, msg: msg, stats: { "Ready at": fmtH(st.finish), "Bill": money(cost), "Region": st.reg.name } });
    }
    function screen(c, x, y, s, k) {
      u.rr(c, x - s / 2 - 9, y - s / 2 - 9, s + 18, s + 18, 12); c.fillStyle = "#2e3d50"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.fillStyle = "#2e3d50"; c.fillRect(x - 6, y + s / 2 + 9, 12, 26); c.strokeRect(x - 6, y + s / 2 + 9, 12, 26);
      c.fillStyle = "#16202b"; c.fillRect(x - s / 2, y - s / 2, s, s);
      c.save(); c.beginPath(); c.rect(x - s / 2, y - s / 2, s, s * k); c.clip();
      if (ok(ndvi)) c.drawImage(ndvi, x - s / 2, y - s / 2, s, s); else { c.fillStyle = "#3f9f4f"; c.fillRect(x - s / 2, y - s / 2, s, s); }
      c.restore();
      if (k < 1) { c.fillStyle = "#7ee787"; c.fillRect(x - s / 2, y - s / 2 + s * k - 2, s, 4); }
    }
    function drawMap(c, t) {
      var mw = Math.min(S.W - 140, 800), mh = mw / 2.57, mx = (S.W - mw) / 2, my = 86;
      var P = worldMap(c, mx, my, mw, mh, false);
      var f = P(site.lat, site.lon); treePin(c, f.x, f.y);
      pill(c, "🌳 your forest", f.x - 14, f.y + 16, { size: 14, align: "right", pad: 8, lw: 2 });
      var d = P(REG.weu.lat, REG.weu.lon);
      dbIcon(c, d.x - 34, d.y - 22, 1); pill(c, "🛰️ picture data", d.x - 54, d.y - 26, { size: 14, align: "right", pad: 8, lw: 2, bg: "#fff3c4" });
      regs.forEach(function (r, i) {
        var q = P(r.lat, r.lon); pinDraw(c, q.x, q.y, PROV.azure.color, String(i + 1), t, true);
        var b = pill(c, r.name, q.x + 17, q.y - 30, { size: 15, align: "left", pad: 8, lw: 2, bg: "#e3f0ff" });
        S.hit(q.x - 24, q.y - 60, b.x + b.w - q.x + 24, 64, function () { cards.choose(i); });
      });
      pill(c, "Game map · tap a region pin, or pick a card below", S.W / 2, my + mh + 28, { size: 16 });
      if (S.W - (mx + mw) > 100) drawChar(c, "tuki", mx + mw + 50, my + mh - 30, 96);
    }
    S.draw = function (c, t) {
      if (st.phase === "region") { drawMap(c, t); return; }
      var p = lay();
      if (p.same) island(c, p.isX, p.base, p.iw, 1); else { island(c, p.whX, p.base, 390, 1); island(c, p.isX, p.base, p.iw, 2.4); }
      warehouse(c, p.whX, p.base, t);
      pill(c, "Azure · West Europe", p.whX, p.base + 64, { size: 15, bg: "#e3f0ff" });
      if (!p.same) {
        var ax = p.whX + 110, bx = p.vmX - 60, my = 176;
        c.setLineDash([10, 8]); c.lineDashOffset = -t * 30; c.strokeStyle = "rgba(29,43,58,.5)"; c.lineWidth = 3;
        c.beginPath(); c.moveTo(ax, p.base - 100); c.quadraticCurveTo((ax + bx) / 2, my - 50, bx, p.base - 100); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
        pill(c, "🌍 " + u.fmt(st.reg.km) + " km", (ax + bx) / 2, my, { size: 17, bg: "#fff3c4", weight: 700 });
        pill(c, "Azure · " + st.reg.name, p.isX, p.base + 64, { size: 15, bg: "#e3f0ff" });
      } else pill(c, "🏠 right next to the data!", p.vmX + 60, 150, { size: 17, bg: "#d9f7df", weight: 700 });
      if (st.dropT < 0) {
        u.rr(c, p.vmX - 52, p.base - 112, 104, 108, 12); c.fillStyle = "rgba(255,255,255,.55)"; c.fill();
        c.setLineDash([8, 6]); c.strokeStyle = "rgba(29,43,58,.55)"; c.lineWidth = 3; c.stroke(); c.setLineDash([]);
        txt(c, "your VM", p.vmX, p.base - 68, 16, "#4a5b6d", "center", 700); txt(c, "goes here", p.vmX, p.base - 46, 16, "#4a5b6d", "center", 700);
      } else {
        var k = u.clamp((S.t - st.dropT) / .6, 0, 1), dy = -(1 - u.ease.outBack(k)) * 340, on = !st.meter || st.meter.on;
        rack(c, p.vmX, p.base + dy, st.vm, on, on && !!st.meter, t, VMS[st.vm].name);
        var top = p.base - rackSize(st.vm)[1] - 56;
        if (st.phase === "dl") pill(c, "⬇️ " + st.got + " / " + nPics + " pictures", p.vmX, top, { size: 16, weight: 700 });
        if (st.phase === "cpu") bar(c, p.vmX, top + 8, 130, st.prog, "#5fcf7f", "NDVI " + Math.round(st.prog * 100) + "%");
      }
      if (st.phase === "cpu" || st.phase === "done") screen(c, p.scX, p.base - 112, 124, st.prog);
    };
    S.over = function (c, t) {
      if (st.popT < 0) return;
      var k = u.clamp((S.t - st.popT - .4) / .6, 0, 1); if (k <= 0) return;
      var s = 260 * u.ease.outBack(k), x = S.W / 2, y = 262;
      c.fillStyle = "rgba(255,255,255," + .4 * k + ")"; c.fillRect(0, 70, S.W, H);
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2) * .02);
      u.rr(c, -s / 2 - 12, -s / 2 - 12, s + 24, s + 24, 16); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
      if (ok(ndvi)) c.drawImage(ndvi, -s / 2, -s / 2, s, s); else { c.fillStyle = "#3f9f4f"; c.fillRect(-s / 2, -s / 2, s, s); }
      c.restore();
      if (k >= 1) {
        pill(c, "🌿 NDVI map · " + site.name, x, y - s / 2 - 36, { size: 18, bg: "#fff3c4", weight: 700 });
        pill(c, "dark green = healthy leaves", x, y + s / 2 + 34, { size: 16 });
      }
    };
  }

  /* ============================================================ L2 Stop the meter: GPU for training, then deallocate */
  function lvStop(L) {
    var S = scene(L, { start: 8, end: 24, deadline: 12 });
    var NEED = { small: 30, big: 9, gpu: .25 }, KINDS = ["small", "big", "gpu"];
    var st = { done: null, prog: 0, slow: false, hinted: false, ff: false, over: false, saved: false };
    var test = S.meter({ name: "test-vm", icon: "🗄️", kind: "big", rate: .8, disk: .02, on: true, busy: false, idleH: 0, bugs: 0 });
    var train = null, cards = null;
    S.job("📋 Rescue job", "Train **ForestNet**, the forest-spotting AI, by **12 PM**. Don't waste coins!");
    S.stopAt = 24; S.taskDone = finish; S.speed = .2;
    chooseCards();
    L.timeout(function () { S.note("⏰ The clock is ticking, and Pix's test VM is burning coins!", "bad", 2600); }, 600);
    if (memo.l2) L.timeout(function () { S.talk(L.hint("Train on the **GPU**, then press **Deallocate** on every VM when its job is done. That ends its compute bill.", "tuki")); }, 3300);

    function lay() { var W = S.W, iw = Math.min(W - 120, 900); return { base: 350, ix: W / 2, iw: iw, tx: W / 2 - iw * .28, vx: W / 2 + iw * .04, mx: W / 2 + iw * .33 }; }
    function setSpeed() {
      if (st.over) { S.speed = 0; return; }
      S.speed = st.ff ? 3 : !train ? .2 : (train.on && st.done == null) ? (train.kind === "gpu" ? .15 : .9) : .45;
    }
    function chooseCards() {
      cards = S.cards(KINDS.map(function (k) {
        var v = VMS[k]; return { icon: v.icon, name: v.name, sub: "Training time (game version): about **" + (k === "gpu" ? "15 minutes" : NEED[k] + " hours") + "**", price: money(v.rate) + " / hour" };
      }), pick);
      var side = u.el("div", { class: "cc-side" });
      var b = u.el("button", { class: "btn" });
      var paint = function () { b.className = "btn " + (test.on ? "danger" : "go"); b.innerHTML = test.on ? "⏹ Deallocate test-vm" : "▶ Start test-vm"; };
      paint(); L.on(b, "click", function () { toggle(test); paint(); });
      side.appendChild(b); S.area.appendChild(side);
      var base = S.key;
      S.key = function (k) { if (k === "s" || k === "S") { toggle(test); paint(); return true; } return base(k); };
    }
    function pick(i) {
      var k = KINDS[i]; cards.lock(i);
      if (train) { S.meters.splice(S.meters.indexOf(train), 1); S.note("🗑️ Old VM deleted. Training starts again on the new one.", "info", 2200); }
      train = S.meter({ name: "train-vm", icon: VMS[k].icon, kind: k, rate: VMS[k].rate, disk: .02, on: true, busy: true, idleH: 0, bugs: 0, dropT: S.t });
      st.prog = 0; st.slow = false; RQ.audio.sfx("whoosh");
      L.timeout(function () { var p = lay(); RQ.audio.sfx("drop"); S.puff(p.vx, p.base, 12); rows(); }, 500);
      setSpeed();
    }
    function toggle(m) {
      if (st.over || !m) return;
      m.on = !m.on;
      var p = lay(), x = m === test ? p.tx : p.vx;
      if (m.on) { RQ.audio.sfx("powerup"); m.busy = m === train && !st.done; m.idleH = 0; }
      else {
        RQ.audio.tone({ f: 520, f2: 90, type: "sawtooth", d: .45, v: .1, lp: 1400 });
        S.puff(x, p.base - 90, 8, "#cfe3ff"); S.float("😴 deallocated", x, p.base - 175, "#2b7bd0"); m.bugs = 0; m.busy = false;
        if (m === train && !st.done) S.note("⏸ Training paused. A deallocated VM does no work.", "info", 2200);
        else S.note("😴 Deallocated! The compute bill stops, but its disk still costs a little.", "good", 2600);
      }
      setSpeed(); rows(); check();
    }
    function rows() {
      if (!train || st.over) return;
      S.area.innerHTML = "";
      var box = u.el("div", { class: "cc-rows" });
      [test, train].forEach(function (m, i) {
        var state = m.on ? (m.busy ? "🟢 Working" : "🟠 On, doing nothing") : "😴 Deallocated · disk " + money(m.disk) + "/h";
        var b = u.el("button", { class: "btn " + (m.on ? "danger" : "go"), html: m.on ? "⏹ Deallocate" : "▶ Start" });
        L.on(b, "click", function () { toggle(m); });
        box.appendChild(u.el("div", { class: "cc-row" + (m.on ? " on" : "") }, u.el("span", { class: "ico", text: m.icon }),
          u.el("div", { class: "nm", html: "<b>" + (i + 1) + ". " + m.name + "</b><small>" + VMS[m.kind].name + " · " + money(m.rate) + " per hour while on</small>" }),
          u.el("span", { class: "state", text: state }), b));
      });
      S.area.appendChild(box);
      if (st.slow && !st.done) {
        var side = u.el("div", { class: "cc-side" }), sw = u.el("button", { class: "btn warn", html: "🔁 Swap machine" });
        L.on(sw, "click", swap); side.appendChild(sw); S.area.appendChild(side);
      }
      S.key = function (k) {
        if (k === "1") { toggle(test); return true; }
        if (k === "2") { toggle(train); return true; }
        if ((k === "s" || k === "S") && st.slow && !st.done) { swap(); return true; }
      };
    }
    function swap() { if (st.done || st.over) return; RQ.audio.sfx("click"); chooseCards(); }
    function trained() {
      st.done = S.hour; train.busy = false; S.est = null;
      var p = lay(); RQ.audio.sfx("win"); S.sparks(p.vx, p.base - 150, 26);
      S.fly({ x0: p.vx, y0: p.base - 160, x1: p.mx, y1: p.base - 66, dur: 1, arc: 90, draw: function (c, x, y) { fileIcon(c, x, y); },
        done: function () { st.saved = true; RQ.audio.sfx("pop"); S.puff(p.mx, p.base - 60, 6); } });
      S.note(st.done <= S.deadline + 1e-6 ? "✅ ForestNet trained on time! Saved **models/forestnet.pt**." : "✅ ForestNet trained, but after the deadline.", "good", 2600);
      S.job("📋 Rescue job", "✅ ForestNet is trained. Now make sure **no meter** keeps running!");
      setSpeed(); rows(); check();
    }
    function check() {
      if (st.done != null && !test.on && train && !train.on && !st.ff) {
        st.ff = true; setSpeed();
        S.note("🌙 Every meter is off! Fast-forward to midnight: only the disks cost a little.", "good", 2800);
      }
    }
    S.onTime = function (dh) {
      [test, train].forEach(function (m) {
        if (m && m.on && !m.busy) { m.idleH += dh; var nb = Math.min(3, Math.ceil(m.idleH / .6)); if (nb > m.bugs) { m.bugs = nb; S.sfx("giggle", .5); } }
      });
      if (train && train.on && st.done == null) {
        st.prog = Math.min(1, st.prog + dh / NEED[train.kind]);
        S.est = S.hour + (1 - st.prog) * NEED[train.kind];
        if (!st.slow && S.est > S.deadline + .01) { st.slow = true; rows(); RQ.audio.sfx("bad"); S.note("🐢 Too slow! This VM finishes long after the deadline. Swap it?", "bad", 2800); }
        if (st.prog >= 1) trained();
      } else if (st.done == null) S.est = null;
      if (st.done != null && !st.hinted && (test.on || train.on) && S.hour - st.done > 1.5) {
        st.hinted = true; S.talk(L.hint("Training is done, but a meter is still running! Press **Deallocate** on every VM.", "tuki"));
      }
    };
    function finish() {
      if (st.over) return; st.over = true; S.speed = 0;
      var waste = test.waste + (train ? train.waste : 0), onTime = st.done != null && st.done <= S.deadline + 1e-6;
      var stars = !onTime ? 1 : waste <= 4 ? 3 : waste <= 12 ? 2 : 1;
      memo.l2 = stars < 3;
      var msg = st.done == null ? "ForestNet was not ready by midnight. A **GPU** trains it much faster!"
        : !onTime ? "ForestNet is trained, but after the deadline. Pick the **GPU** VM for AI training."
        : waste <= 4 ? "Trained on time, and every meter stopped. Only the disks cost a little overnight!"
        : "Trained on time! But idle VMs ate **" + money(waste) + "**. Deallocate machines the moment the job is done.";
      L.timeout(function () { L.win({ stars: stars, msg: msg, stats: { "Trained at": st.done != null ? fmtH(st.done) : "not done", "Wasted on idle VMs": money(waste), "Total bill": money(S.spent) } }); }, 900);
    }
    function shelf(c, x, y) {
      u.rr(c, x - 64, y - 100, 128, 100, 12); c.fillStyle = "#fff6e0"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.fillStyle = "#e0c48a"; c.fillRect(x - 56, y - 30, 112, 6);
      pill(c, "💾 models/", x, y - 118, { size: 15, bg: "#fff" });
      if (st.saved) { fileIcon(c, x, y - 66); txt(c, "forestnet.pt", x, y - 14, 14, INK, "center", 700); }
      else txt(c, "empty", x, y - 60, 15, "#8a94a0", "center", 600);
    }
    S.draw = function (c, t) {
      var p = lay();
      island(c, p.ix, p.base, p.iw, .7);
      flag(c, p.ix - p.iw / 2 + 26, p.base, PROV.azure.color, "Azure", t);
      pill(c, "Azure · West Europe", p.ix, p.base + 64, { size: 15, bg: "#e3f0ff" });
      test.x = p.tx; test.y = p.base - 70;
      rack(c, p.tx, p.base, "big", test.on, false, t, "1 · test-vm");
      S.hit(p.tx - 52, p.base - 170, 104, 200, function () { toggle(test); });
      bugsOn(c, test, p.tx, p.base - 130, t);
      if (train) {
        var k = u.clamp((S.t - train.dropT) / .55, 0, 1), dy = -(1 - u.ease.outBack(k)) * 340, h = rackSize(train.kind)[1];
        train.x = p.vx; train.y = p.base - 70;
        rack(c, p.vx, p.base + dy, train.kind, train.on, train.busy, t, "2 · train-vm");
        S.hit(p.vx - 56, p.base - 170, 112, 200, function () { toggle(train); });
        if (st.done == null) bar(c, p.vx, p.base - h - 62, 160, st.prog, "#b197fc", (train.on ? "🧠 Training " : "⏸ Paused ") + Math.round(st.prog * 100) + "%");
        bugsOn(c, train, p.vx, p.base - h, t);
      } else {
        u.rr(c, p.vx - 52, p.base - 112, 104, 108, 12); c.fillStyle = "rgba(255,255,255,.55)"; c.fill();
        c.setLineDash([8, 6]); c.strokeStyle = "rgba(29,43,58,.55)"; c.lineWidth = 3; c.stroke(); c.setLineDash([]);
        txt(c, "pick a VM", p.vx, p.base - 68, 16, "#4a5b6d", "center", 700); txt(c, "below", p.vx, p.base - 46, 16, "#4a5b6d", "center", 700);
      }
      shelf(c, p.mx, p.base);
    };
    S.lights = function (c) {
      var n = night(S.hour); if (n < .05) return;
      var p = lay();
      [[test, p.tx], [train, p.vx]].forEach(function (a) {
        if (!a[0] || !a[0].on) return;
        var g = c.createRadialGradient(a[1], p.base - 70, 10, a[1], p.base - 70, 110);
        g.addColorStop(0, "rgba(255,220,120," + .45 * n + ")"); g.addColorStop(1, "rgba(255,220,120,0)");
        c.fillStyle = g; c.beginPath(); c.arc(a[1], p.base - 70, 110, 0, 7); c.fill();
      });
    };
  }

  /* ============================================================ L3 Storage: account → container → blob, buckets, tiers */
  function crate(c, x, y, cr, ice, hl, t) {
    if (hl) { c.fillStyle = "rgba(255,216,77,.55)"; u.rr(c, x - 68, y - 26, 136, 52, 12); c.fill(); }
    u.rr(c, x - 60, y - 18, 120, 36, 6); c.fillStyle = "#c98d4e"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    c.strokeStyle = "rgba(29,43,58,.35)"; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 56, y); c.lineTo(x + 56, y); c.stroke();
    txt(c, cr.icon + " " + cr.short, x, y + 1, 15, "#fff", "center", 700);
    if (ice) { u.rr(c, x - 64, y - 22, 128, 44, 8); c.fillStyle = "rgba(170,215,255,.45)"; c.fill(); c.lineWidth = 2; c.strokeStyle = "#5c8fd6"; c.stroke(); }
  }
  function cabinet(c, x, y, T, t, hl) {
    var w = 160, h = 150, k;
    if (hl) { c.fillStyle = "rgba(255,216,77,.45)"; u.rr(c, x - w / 2 - 10, y - h - 10, w + 20, h + 20, 20); c.fill(); }
    u.rr(c, x - w / 2, y - h, w, h, 14); c.fillStyle = T.bg; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.strokeStyle = "rgba(29,43,58,.22)"; c.lineWidth = 2;
    for (k = 1; k < 3; k++) { c.beginPath(); c.moveTo(x - w / 2 + 8, y - k * 44 - 2); c.lineTo(x + w / 2 - 8, y - k * 44 - 2); c.stroke(); }
    c.lineWidth = 2.5; c.strokeStyle = INK;
    if (T.key === "hot") for (k = 0; k < 3; k++) {
      var fh = 22 + Math.sin(t * 9 + k * 2) * 6, fx = x - 42 + k * 42;
      c.beginPath(); c.moveTo(fx - 12, y - h); c.quadraticCurveTo(fx - 10, y - h - fh * .6, fx, y - h - fh); c.quadraticCurveTo(fx + 10, y - h - fh * .6, fx + 12, y - h); c.closePath();
      c.fillStyle = k === 1 ? "#ffd84d" : "#ff8a3d"; c.fill(); c.stroke();
    }
    if (T.key === "cool") { c.save(); c.translate(x, y - h - 18); c.rotate(t * .5); c.strokeStyle = "#2b88d8"; c.lineWidth = 4; for (k = 0; k < 3; k++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-15, 0); c.lineTo(15, 0); c.stroke(); } c.restore(); }
    if (T.key === "archive") {
      c.fillStyle = "#e6f3ff";
      for (k = 0; k < 6; k++) { var ix = x - w / 2 + 16 + k * 26; c.beginPath(); c.moveTo(ix - 7, y - h); c.lineTo(ix + 7, y - h); c.lineTo(ix, y - h + 14 + (k % 2) * 8); c.closePath(); c.fill(); c.stroke(); }
      u.rr(c, x + w / 2 - 30, y - h + 32, 22, 18, 4); c.fillStyle = GOLD; c.fill(); c.stroke();
      c.beginPath(); c.arc(x + w / 2 - 19, y - h + 32, 7, Math.PI, 0); c.stroke();
    }
    pill(c, T.icon + " " + T.name, x, y + 62, { size: 16, weight: 700, bg: T.bg });
  }
  function bucket(c, x, y, color, name, full) {
    c.lineWidth = 3; c.strokeStyle = INK;
    c.beginPath(); c.arc(x, y - 100, 52, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    if (full) pic(c, x, y - 96, 30, 5);
    c.beginPath(); c.moveTo(x - 64, y - 96); c.lineTo(x + 64, y - 96); c.lineTo(x + 48, y - 6); c.lineTo(x - 48, y - 6); c.closePath();
    c.fillStyle = color; c.fill(); c.stroke();
    c.beginPath(); c.ellipse(x, y - 96, 64, 11, 0, 0, 7); c.fillStyle = "rgba(255,255,255,.35)"; c.fill(); c.stroke();
    txt(c, name, x, y - 48, 16, "#fff", "center", 700);
  }
  function lvStore(L) {
    var site = mySite(), sc0 = (site.image && site.image.scenes && site.image.scenes[0]) || { datetime: "2026-06-03" };
    var blobName = site.id + "/" + sc0.datetime + ".tif";
    var S = scene(L, { start: 8, end: 10, deadline: 9, dlName: "Briefing" }); S.noSun = true;
    var PARTS = [{ icon: "🏢", name: "Storage account", code: "reseedstore", sub: "the big warehouse" },
      { icon: "📦", name: "Container", code: "sentinel2", sub: "a box inside the account" },
      { icon: "🖼️", name: "Blob", code: blobName, sub: "one picture file" }];
    var TIERS = [
      { key: "hot", icon: "🔥", name: "Hot", store: 6, read: 0, sub: "Store: **$6** a month · read: instant, free", bg: "#ffe1c7" },
      { key: "cool", icon: "❄️", name: "Cool", store: 3, read: 1, sub: "Store: **$3** a month · read: instant, **$1** each time", bg: "#dcefff" },
      { key: "archive", icon: "🧊", name: "Archive", store: 1, read: 5, sub: "Store: **$1** a month · read: **$5**, and it takes up to **15 hours** to wake up", bg: "#c6d6ee" }];
    var CRATES = [{ icon: "🌞", name: "Today's pictures", short: "Today", read: "read **every morning**", reads: 30 },
      { icon: "📅", name: "Last year's pictures", short: "Last year", read: "read **a few times a year**", reads: 2 },
      { icon: "🗃️", name: "2017 backups", short: "2017", read: "**almost never** read", reads: 0 }];
    var st = { phase: "build", built: 0, bT: [], mist: 0, cmpT: -1, bk: [false, false], cur: 0, tries: 0, sim: null, late: false, total: 0 };
    var order = u.shuffle([0, 1, 2], L.rng), cards;
    S.job("📋 Rescue job", "Give the new pictures a safe home in Azure. Build it from the **biggest box** to the smallest!");
    cards = S.cards(order.map(function (k) { var p = PARTS[k]; return { icon: p.icon, name: p.name, sub: "`" + p.code + "` · " + p.sub }; }), pickPart);
    if (L.fails || memo.l3) L.timeout(function () { S.talk(L.hint("Read every box: today's pictures are needed **every morning**, so they must be quick to open.", "hoot")); }, 300);

    function lay() { var W = S.W; return { base: 360, ax: W / 2, lx: W * .14, rx: W * .86, sw: Math.min(250, W * .22), sx: W * .12, cx: [W * .4, W * .62, W * .84] }; }
    function pickPart(i) {
      var k = order[i];
      if (k !== st.built) {
        st.mist++; cards.no(i); RQ.audio.sfx("error"); S.sfx("giggle", .3);
        S.note(st.built === 0 ? "Start with the biggest box: the **storage account** holds everything." : "Next comes the **container**: it lives inside the account.", "bad", 2600);
        return;
      }
      cards.btns[i].disabled = true; cards.btns[i].classList.add("good");
      st.bT[k] = S.t; st.built++;
      var p = lay(); RQ.audio.sfx(k === 2 ? "whoosh" : "drop");
      L.timeout(function () { S.puff(p.ax + (k === 1 ? 0 : 0), p.base - (k ? 60 : 0), 10); RQ.audio.sfx("pop"); }, 450);
      if (st.built === 3) { st.phase = "cmp"; L.timeout(compare, 1300); }
    }
    function compare() {
      st.cmpT = S.t; RQ.audio.sfx("whoosh");
      S.job("📋 Rescue job", "Other clouds keep files too. **AWS S3** and **Google Cloud Storage** call the box a **bucket**.");
      L.timeout(function () {
        var p = lay();
        [p.lx, p.rx].forEach(function (x, k) {
          S.fly({ x0: p.ax, y0: p.base - 90, x1: x, y1: p.base - 96, dur: .9, arc: 120, trail: true, draw: function (c, x2, y2) { pic(c, x2, y2, 30, 5); },
            done: function () { st.bk[k] = true; RQ.audio.sfx("pop"); S.puff(x, p.base - 100, 5); } });
        });
      }, 1100);
      L.timeout(quiz, 2900);
    }
    function quiz() {
      L.choose("tuki", "On AWS and Google Cloud, what holds your picture files?", ["A **bucket**", "A **blob**", "A **VM**"]).then(function (a) {
        if (!L.alive) return;
        if (a === 0) { RQ.audio.sfx("good"); S.note("✅ Yes! Azure: account → container → blob. AWS and Google: a **bucket**.", "good", 2800); }
        else { st.mist++; S.sfx("giggle", .1); S.note("Not quite! On AWS and Google Cloud the box is called a **bucket**.", "bad", 2800); }
        L.timeout(tiers, 900);
      });
    }
    function tiers() {
      st.phase = "tiers"; st.cur = 0; st.sim = null; st.late = false; S.hour = 8; S.spent = 0;
      CRATES.forEach(function (cr) { cr.tier = -1; cr.placed = false; cr.flying = false; });
      showTierCards();
    }
    function showTierCards() {
      var cr = CRATES[st.cur];
      S.job("📦 Box " + (st.cur + 1) + " of 3", cr.icon + " **" + cr.name + "**: " + cr.read + ". Which tier?");
      cards = S.cards(TIERS.map(function (T) { return { icon: T.icon, name: T.name + " tier", sub: T.sub }; }), pickTier);
    }
    function slotOf(cr) { var n = 0; for (var j = 0; j < CRATES.indexOf(cr); j++) if (CRATES[j].tier === cr.tier && CRATES[j].tier >= 0) n++; return n; }
    function pickTier(i) {
      if (st.phase !== "tiers") return;
      var cr = CRATES[st.cur], p = lay(), j = st.cur;
      cr.tier = i; cr.flying = true; cards.lock(i); RQ.audio.sfx("whoosh");
      S.fly({ x0: p.sx, y0: p.base - 26 - (2 - j) * 42, x1: p.cx[i], y1: p.base - 26 - slotOf(cr) * 44, dur: .6, arc: 90, trail: true,
        draw: function (c, x, y) { crate(c, x, y, cr, false, false); },
        done: function () { cr.flying = false; cr.placed = true; RQ.audio.sfx(i === 2 ? "zap" : "pop"); S.puff(p.cx[i], p.base - 40, 5, i === 2 ? "#cfe8ff" : "#fff"); } });
      st.cur++;
      L.timeout(function () { if (st.cur < 3) showTierCards(); else ready(); }, 700);
    }
    function ready() {
      st.phase = "ready"; S.area.innerHTML = "";
      S.job("📋 Rescue job", "Every morning at **9 AM**, Hoot's briefing needs **today's pictures**. Test your shelves!");
      var go = u.el("button", { class: "btn big primary pulse", html: "▶ Run the morning briefing" }), again = u.el("button", { class: "btn", html: "↩ Sort the boxes again" });
      L.on(go, "click", runSim); L.on(again, "click", function () { RQ.audio.sfx("click"); tiers(); });
      S.area.appendChild(u.el("div", { class: "cc-side", style: { flex: "1", alignItems: "center" } }, go, again));
      S.key = function (k) { if (k === "Enter" || k === " ") { runSim(); return true; } };
    }
    function runSim() {
      if (st.phase !== "ready") return;
      st.phase = "sim"; S.key = null; S.hour = 8;
      S.status("<h4>☀️ Morning briefing</h4><div class='ln'><span>Hoot needs today's pictures before 9 AM.</span><b>⏳</b></div>");
      st.sim = { req: S.t };
      var today = CRATES[0], p = lay();
      S.task(.2, 1, function () {
        if (today.tier < 2) {
          today.placed = false;
          S.fly({ x0: p.cx[today.tier], y0: p.base - 26 - slotOf(today) * 44, x1: p.sx, y1: p.base - 120, dur: .8, arc: 70, trail: true,
            draw: function (c, x, y) { crate(c, x, y, today, false, false); },
            done: function () { st.sim.ok = true; RQ.audio.sfx("good"); S.sparks(p.sx, p.base - 150, 20); S.float("✓ on time!", p.sx, p.base - 200, "#2f9e4f"); } });
          S.task(.15, .9, function () { L.timeout(month, 700); });
        } else {
          st.sim.rehyd = S.hour; RQ.audio.sfx("buzz");
          S.task(1.3, 3.4, function () { st.late = true; RQ.audio.sfx("bad"); S.sfx("giggle", 0); L.timeout(month, 500); });
        }
      });
    }
    function month() {
      st.sim.month = S.t; RQ.audio.sfx("whoosh");
      var total = 0, p = lay();
      CRATES.forEach(function (cr) { var T = TIERS[cr.tier]; cr.cost = T.store + cr.reads * T.read; total += cr.cost; });
      st.total = total;
      CRATES.forEach(function (cr, j) {
        var n = Math.min(14, cr.cost);
        for (var k = 0; k < n; k++) L.timeout(function () { S.coinTo(p.cx[cr.tier] + u.rand(-30, 30), p.base - 90); S.spent += cr.cost / n; }, 80 * k + j * 160);
      });
      L.timeout(function () { S.spent = total; bill(); }, 1900);
    }
    function bill() {
      var rows = CRATES.map(function (cr) {
        var T = TIERS[cr.tier];
        return "<div class='ln'><span>" + cr.icon + " " + cr.name + " → " + T.icon + " " + T.name + "</span><span>$" + T.store + " + " + cr.reads + " reads × $" + T.read + " = <b>$" + cr.cost + "</b></span></div>";
      }).join("");
      var head = st.late ? "<h4><span class='bad'>❌ Briefing missed!</span> Today's pictures were asleep in the archive.</h4>" : "<h4>🧾 One month's bill (game prices)</h4>";
      S.status(head + rows + "<div class='ln tot'><span>Total" + (st.total <= 12 ? " · the cheapest way! 🎉" : "") + "</span><span>$" + st.total + "</span></div>");
      var b = u.el("button", { class: "btn big " + (st.late ? "warn" : "go"), html: st.late ? "🔁 Move the boxes" : "✅ Finish" });
      L.on(b, "click", function () {
        if (st.late) { st.tries++; RQ.audio.sfx("click"); tiers(); return; }
        var stars = 1 + (st.total <= 12 ? 1 : 0) + (st.tries === 0 && st.mist <= 1 ? 1 : 0);
        memo.l3 = stars < 3;
        L.win({ stars: stars, msg: st.total <= 12 ? "Hot for daily pictures, cool for last year, archive for old backups. Smart and cheap!" : "The briefing worked! But some boxes sit in a pricier tier than they need.",
          stats: { "Monthly bill": "$" + st.total, "Cheapest possible": "$12", "Do-overs": st.tries } });
      });
      S.area.appendChild(u.el("div", { class: "cc-side" }, b));
      S.key = function (k) { if (k === "Enter" || k === " ") { b.click(); return true; } };
      if (st.late) S.talk(L.say("hoot", "I waited and waited! Pictures we need every day belong in a quick tier.", { mood: "sad" }));
    }
    function drawBuild(c, t) {
      var p = lay(), W = S.W;
      island(c, p.ax, p.base, 470, 1.2);
      flag(c, p.ax - 215, p.base, PROV.azure.color, "Azure", t);
      if (st.built >= 1) {
        var dy = -(1 - u.ease.outBack(u.clamp((S.t - st.bT[0]) / .5, 0, 1))) * 380;
        c.save(); c.translate(0, dy);
        building(c, p.ax, p.base, 280, 196, PROV.azure.color, t, { door: true });
        u.rr(c, p.ax - 106, p.base - 104, 212, 100, 10); c.fillStyle = "#1f2d3d"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
        pill(c, "🏢 storage account: reseedstore", p.ax, p.base - 224, { size: 16, weight: 700, bg: "#e3f0ff" });
        c.restore();
      } else {
        c.setLineDash([8, 6]); c.strokeStyle = "rgba(29,43,58,.55)"; c.lineWidth = 3; u.rr(c, p.ax - 140, p.base - 196, 280, 192, 14); c.stroke(); c.setLineDash([]);
        txt(c, "?", p.ax, p.base - 100, 64, "rgba(29,43,58,.35)", "center", 700);
      }
      if (st.built >= 2) {
        var cx = u.lerp(W + 140, p.ax, u.ease.outCubic(u.clamp((S.t - st.bT[1]) / .6, 0, 1)));
        u.rr(c, cx - 96, p.base - 72, 192, 62, 8); c.fillStyle = "#c98d4e"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
        txt(c, "📦 container: sentinel2", cx, p.base - 40, 15, "#fff", "center", 700);
      }
      if (st.built >= 3) {
        var k3 = u.clamp((S.t - st.bT[2]) / .7, 0, 1);
        pic(c, p.ax, u.lerp(90, p.base - 90, u.ease.outCubic(k3)), 34, 1);
        pill(c, "🖼️ blob: " + blobName, p.ax, p.base + 66, { size: 15, bg: "#fff3c4", weight: 700 });
      }
      if (st.cmpT >= 0) {
        var e = u.ease.outCubic(u.clamp((S.t - st.cmpT) / .9, 0, 1));
        [[u.lerp(-200, p.lx, e), PROV.aws, "AWS S3 bucket", 0], [u.lerp(W + 200, p.rx, e), PROV.gcp, "Google Cloud Storage bucket", 1]].forEach(function (a) {
          island(c, a[0], p.base, p.sw, 2 + a[3]);
          bucket(c, a[0], p.base, a[1].color, a[1].name, st.bk[a[3]]);
          pill(c, a[2], a[0], p.base + 66, { size: 15, bg: "#fff" });
        });
      }
    }
    function drawTiers(c, t) {
      var p = lay();
      island(c, S.W / 2, p.base, S.W * .93, .4);
      TIERS.forEach(function (T, i) {
        cabinet(c, p.cx[i], p.base, T, t, st.phase === "tiers" && Math.sin(t * 4) > 0 && st.cur < 3 && L.fails > 0);
        if (st.phase === "tiers") S.hit(p.cx[i] - 85, p.base - 175, 170, 260, function () { if (!cards.locked) cards.choose(i); });
      });
      CRATES.forEach(function (cr, j) {
        if (cr.placed) crate(c, p.cx[cr.tier], p.base - 26 - slotOf(cr) * 44, cr, cr.tier === 2 && !(st.sim && st.sim.rehyd != null && j === 0 && S.hour > 9.4), false, t);
        else if (!cr.flying && cr.tier < 0) {
          var cur = st.phase === "tiers" && j === st.cur, bob = cur ? Math.sin(t * 5) * 4 : 0;
          crate(c, p.sx, p.base - 26 - (2 - j) * 42 + bob, cr, false, cur, t);
          if (cur) { c.fillStyle = GOLD; c.strokeStyle = INK; c.lineWidth = 2.5; var ax = p.sx + 78 + Math.sin(t * 6) * 5, ay = p.base - 26 - (2 - j) * 42;
            c.beginPath(); c.moveTo(ax, ay - 12); c.lineTo(ax + 20, ay); c.lineTo(ax, ay + 12); c.closePath(); c.fill(); c.stroke(); }
        }
      });
      if (st.sim) {
        var bx = p.sx, by = p.base - 120;
        drawChar(c, "hoot", bx - 4, by - 118, 92, st.late ? "sad" : st.sim.ok ? "happy" : null);
        u.rr(c, bx - 72, by - 52, 144, 92, 12); c.fillStyle = "#24324a"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
        c.fillStyle = "#24324a"; c.fillRect(bx - 4, by + 40, 8, p.base - by - 40);
        if (st.sim.ok) { pic(c, bx - 34, by - 8, 34, 2); pic(c, bx + 6, by - 8, 34, 4); txt(c, "✓", bx + 46, by - 10, 34, "#7ee787", "center", 700); }
        else if (st.late) txt(c, "✗ missed", bx, by - 6, 22, "#ff8a7a", "center", 700);
        else txt(c, "waiting…", bx, by - 6, 18, "#cfe3ff", "center", 600);
        if (!st.sim.ok && !st.late) pill(c, "Today's pictures, please!", bx + 46, by - 132, { size: 15, align: "left", bg: "#fff" });
        if (st.sim.rehyd != null && !st.late) {
          var k = (S.hour - st.sim.rehyd) / 15;
          bar(c, p.cx[2], p.base - 196, 170, Math.max(.04, k), "#74c0fc", "🧊 waking up… up to 15 h");
        }
      }
    }
    S.draw = function (c, t) { if (st.phase === "build" || st.phase === "cmp") drawBuild(c, t); else drawTiers(c, t); };
  }

  /* ============================================================ L4 STAC search on the Planetary Computer */
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function shortDate(d) { var a = String(d).split("-"); return MON[(+a[1] || 1) - 1] + " " + (+a[2] || 1); }
  function laptop(c, x, y) {
    u.rr(c, x - 44, y - 62, 88, 58, 8); c.fillStyle = "#2e3d50"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.fillStyle = "#74c0fc"; c.fillRect(x - 36, y - 55, 72, 44);
    u.rr(c, x - 56, y - 6, 112, 12, 5); c.fillStyle = "#cfd8e3"; c.fill(); c.stroke();
  }
  function lvStac(L) {
    var site = mySite(), D = data();
    var S = scene(L, { start: 9, end: 12, deadline: 11 }); S.noSun = true;
    var all = ((site.image && site.image.scenes) || []).slice().sort(function (a, b) { return a.cloud - b.cloud; });
    var win = (site.image && site.image.window) || ["2026-06-01", "2026-09-26"];
    var half = (site.size_m || 6400) / 2, dLat = half / 111320, dLon = half / (111320 * Math.cos(site.lat * Math.PI / 180));
    var bbox = [site.lon - dLon, site.lat - dLat, site.lon + dLon, site.lat + dLat].map(function (v) { return v.toFixed(3); });
    var MACH = [
      { key: "laptop", icon: "💻", name: "Your laptop at home", sub: "Far from the data · slow home Wi-Fi", price: "free", rate: 0, search: .1, dl: 2.2, secS: 1.2, secD: 4.4 },
      { key: "vm", icon: "☁️", name: "Small VM in West Europe", sub: "Next to the picture data (in this game)", price: "$0.10 / hour", rate: .1, search: .05, dl: .25, secS: .9, secD: 1.6 },
      { key: "gpu", icon: "🚀", name: "Giant GPU VM in West Europe", sub: "Next to the data, super strong", price: "$3.00 / hour", rate: 3, search: .05, dl: .25, secS: .9, secD: 1.6 }];
    var st = { phase: "machine", m: null, meter: null, where: false, lim: 5, res: null, busy: false, tries: 0, got: 0, kept: 0, done: null, wrong: 0, pulse: -9, planeT: -1, P: null };
    var ui = {};
    S.job("📋 Rescue job", "Find clear Sentinel-2 pictures of **" + site.name + "** for Hoot by **11 AM**. Which computer will search and download?");
    var cards = S.cards(MACH.map(function (m) { return { icon: m.icon, name: m.name, sub: m.sub, price: m.price }; }), pickMachine);
    if (memo.l4) L.timeout(function () { S.talk(L.hint("Ask the catalogue from any computer. For the big downloads, a VM next to the data saves lots of time!", "tuki")); }, 300);

    function lay() { var W = S.W, mw = Math.min(W * .5, 600); return { mx: 20, my: 82, mw: mw, mh: mw / 2.57, rx: 46 + mw, rw: W - 66 - mw, ty: 352, px: 74, py: 438 }; }
    function pickMachine(i) {
      st.m = MACH[i]; cards.lock(i); RQ.audio.sfx("pop");
      var p = lay(); st.meter = S.meter({ rate: st.m.rate, on: false, busy: true, x: p.px, y: p.py - 40 });
      S.puff(p.px, p.py - 30, 10);
      L.timeout(form, 500);
    }
    function form() {
      st.phase = "query"; S.area.innerHTML = "";
      S.job("📋 Rescue job", "Ask the **STAC catalogue**: where? when? how cloudy? Hoot needs **3 or more** clear pictures (game rule).");
      var f = u.el("div", { class: "cc-form" });
      ui.where = u.el("div", { class: "val" }); ui.num = u.el("span", { class: "big-num" });
      ui.range = u.el("input", { type: "range", min: "0", max: "100", step: "1", value: String(st.lim), "aria-label": "most cloud cover allowed (%)" });
      var minus = u.el("button", { class: "btn small", html: "−", "aria-label": "less cloud" }), plus = u.el("button", { class: "btn small", html: "+", "aria-label": "more cloud" });
      L.on(ui.range, "input", function () { setLim(+ui.range.value); });
      L.on(minus, "click", function () { setLim(st.lim - 1); }); L.on(plus, "click", function () { setLim(st.lim + 1); });
      f.appendChild(u.el("span", { class: "lab", text: "📍 Where?" })); f.appendChild(ui.where);
      f.appendChild(u.el("span", { class: "lab", text: "📅 When?" }));
      f.appendChild(u.el("div", { class: "val", html: "<code>" + u.esc(win[0]) + "</code> to <code>" + u.esc(win[1]) + "</code>" }));
      f.appendChild(u.el("span", { class: "lab", text: "☁️ Clouds?" }));
      f.appendChild(u.el("div", { class: "val" }, u.el("span", { text: "less than" }), minus, ui.range, plus, ui.num));
      S.area.appendChild(f);
      ui.go = u.el("button", { class: "btn big primary", html: "🔎 Search" }); L.on(ui.go, "click", search);
      S.area.appendChild(u.el("div", { class: "cc-side" }, ui.go));
      setLim(st.lim); paintWhere();
      S.key = function (k) {
        if (k === "Enter") { search(); return true; }
        if (k === "ArrowLeft" || k === "-") { setLim(st.lim - 1); return true; }
        if (k === "ArrowRight" || k === "+" || k === "=") { setLim(st.lim + 1); return true; }
        if (k === "m" || k === "M") { setWhere(); return true; }
      };
    }
    function setLim(v) { if (st.busy) return; st.lim = u.clamp(Math.round(v), 0, 100); ui.range.value = String(st.lim); ui.num.textContent = st.lim + " %"; RQ.audio.sfx("tick"); }
    function paintWhere() {
      ui.where.innerHTML = "";
      if (st.where) { ui.where.appendChild(u.el("span", { html: "✅ <code>lat " + site.lat.toFixed(2) + ", lon " + site.lon.toFixed(2) + "</code>" })); return; }
      var b = u.el("button", { class: "btn small", html: "📍 Pick my forest" }); L.on(b, "click", setWhere);
      ui.where.appendChild(b); ui.where.appendChild(u.el("span", { class: "muted", text: "or tap it on the map" }));
    }
    function setWhere() {
      if (st.where || st.phase !== "query") return;
      st.where = true; RQ.audio.sfx("good"); paintWhere();
      if (st.P) { var q = st.P(site.lat, site.lon); S.sparks(q.x, q.y, 16); }
      S.note("📍 Got it: a 6.4 km square around your forest.", "good", 2000);
    }
    function mapTap(pt) {
      if (st.phase !== "query" || st.where || !st.P) return;
      var best = null, bd = 34;
      D.sites.forEach(function (s) { var q = st.P(s.lat, s.lon), d = u.dist(q.x, q.y, pt.x, pt.y); if (d < bd) { bd = d; best = s; } });
      if (!best) return;
      if (best.id === site.id) { setWhere(); return; }
      st.wrong++; S.sfx("giggle", .2); RQ.audio.sfx("error");
      S.note("That's **" + best.name + "** (" + best.country + "). Yours is at lat " + site.lat.toFixed(1) + ", lon " + site.lon.toFixed(1) + ".", "bad", 2800);
      if (st.wrong >= 2) st.pulse = S.t;
    }
    function search() {
      if (st.phase !== "query" || st.busy) return;
      if (!st.where) { RQ.audio.sfx("error"); st.pulse = S.t; S.note("📍 First tell the catalogue **where**: tap your forest on the map!", "bad", 2400); return; }
      st.busy = true; st.tries++; ui.go.disabled = true; ui.range.disabled = true; st.res = null;
      st.meter.on = st.m.rate > 0; RQ.audio.sfx("whoosh"); st.planeT = S.t;
      S.task(st.m.search, st.m.secS, function () { st.meter.on = false; st.planeT = -1; results(); });
    }
    function results() {
      var lim = st.lim;
      st.res = all.map(function (s, i) { return { s: s, keep: s.cloud < lim, t0: S.t + i * .12, fallT: -1 }; });
      var kept = st.res.filter(function (r) { return r.keep; }).slice(0, 8);
      st.kept = kept.length; RQ.audio.sfx("pop");
      L.timeout(function () { var any = false; st.res.forEach(function (r) { if (!r.keep) { r.fallT = S.t; any = true; } }); if (any) RQ.audio.sfx("drop"); }, 300 + st.res.length * 120);
      L.timeout(function () {
        if (kept.length < 3) {
          st.busy = false; ui.go.disabled = false; ui.range.disabled = false;
          S.talk(L.say("hoot", "Too strict, only a few pictures got through! This game needs at least 3 pictures, so raise the cloud limit.", { mood: "think" }));
        } else download(kept);
      }, 1000 + st.res.length * 120);
    }
    function download(kept) {
      st.phase = "dl"; st.meter.on = st.m.rate > 0;
      S.job("📋 Rescue job", "⬇️ Downloading **" + kept.length + "** clear pictures to your " + (st.m.key === "laptop" ? "laptop" : "VM") + "…");
      var p = lay();
      kept.forEach(function (r, j) {
        L.timeout(function () {
          var from = cardPos(st.res.indexOf(r), p);
          S.fly({ x0: from.x, y0: from.y, x1: p.px, y1: p.py - 40, dur: .6, arc: 70, trail: true, draw: function (c, x, y) { pic(c, x, y, 28, j, r.s.cloud); },
            done: function () { st.got++; S.sfx("pop", .05); } });
        }, j * st.m.secD * 1000 / kept.length);
      });
      S.task(st.m.dl, st.m.secD + .3, function () { st.meter.on = false; st.done = S.hour; finish(); });
    }
    function finish() {
      var onTime = st.done <= 11 + 1e-6, cost = S.spent, stars = !onTime ? 1 : cost <= .5 ? 3 : 2;
      memo.l4 = stars < 3; RQ.audio.sfx("bloom"); S.sparks(lay().px, lay().py - 60, 24);
      var msg = !onTime ? "Hoot got the pictures, but **late**. The search was quick, but the big download over home Wi-Fi was slow!"
        : st.m.key === "gpu" ? "On time! But a giant GPU VM costs a lot just to search and download."
        : "On time and cheap! Downloading right next to the data is the cloud way.";
      L.timeout(function () { L.win({ stars: stars, msg: msg, stats: { "Pictures": st.kept, "Cloud limit": "< " + st.lim + " %", "Ready at": fmtH(st.done), "Bill": money(cost) } }); }, 1300);
    }
    function cardPos(i, p) { return { x: 196 + i * 104, y: p.ty + 40 }; }
    function codeBoard(c, x, y, w) {
      var lines = [
        [["catalog", "#79c0ff"], ["().search(", "#e6edf3"]],
        [["  collections=", "#e6edf3"], ['["sentinel-2-l2a"]', "#7ee787"], [",", "#e6edf3"]],
        st.where ? [["  bbox=", "#e6edf3"], ["[" + bbox.join(", ") + "]", "#f2cc60"], [",", "#e6edf3"]] : [["  bbox=", "#e6edf3"], ["[?, ?, ?, ?]", "#ff7b72"], [",", "#e6edf3"]],
        [["  datetime=", "#e6edf3"], ['"' + win[0] + "/" + win[1] + '"', "#7ee787"], [",", "#e6edf3"]],
        [["  query=", "#e6edf3"], ['{"eo:cloud_cover": {"lt": ', "#7ee787"], [String(st.lim), "#f2cc60"], ["}}", "#7ee787"], [",", "#e6edf3"]],
        [[")", "#e6edf3"]]];
      var lh = 19, h = lines.length * lh + 22;
      u.rr(c, x, y, w, h, 12); c.fillStyle = "#10161f"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.font = "600 14px " + MONO; c.textAlign = "left"; c.textBaseline = "middle";
      lines.forEach(function (ln, i) {
        var cx = x + 14;
        ln.forEach(function (seg) { c.fillStyle = seg[1]; c.fillText(seg[0], cx, y + 20 + i * lh); cx += c.measureText(seg[0]).width; });
      });
      txt(c, "reseed/acquire.py · search()", x + w - 12, y + h + 14, 13, "#4a5b6d", "right", 600, MONO);
    }
    S.draw = function (c, t) {
      var p = lay(), P = worldMap(c, p.mx, p.my, p.mw, p.mh, true), k;
      st.P = P;
      D.sites.forEach(function (s) {
        var q = P(s.lat, s.lon), mine = s.id === site.id;
        if (mine && st.where) return;
        c.beginPath(); c.arc(q.x, q.y, 6.5, 0, 7); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
        if (mine && (S.t - st.pulse < 5 || L.fails > 0)) { var pr = 10 + ((S.t * 30) % 24); c.strokeStyle = "rgba(209,73,91," + (1 - (pr - 10) / 24) + ")"; c.lineWidth = 3; c.beginPath(); c.arc(q.x, q.y, pr, 0, 7); c.stroke(); }
      });
      if (st.where) { var q0 = P(site.lat, site.lon); treePin(c, q0.x, q0.y + 4); pill(c, "🌳 " + site.name, q0.x + 14, q0.y - 22, { size: 14, align: q0.x > p.mx + p.mw * .6 ? "right" : "left", pad: 8, lw: 2, bg: "#d9f7df" }); }
      S.hit(p.mx, p.my, p.mw, p.mh, mapTap);
      [60, 30, 0, -30].forEach(function (la) { txt(c, la === 0 ? "0°" : Math.abs(la) + "°" + (la > 0 ? "N" : "S"), p.mx + 6, P(la, 0).y + 10, 13, "rgba(29,43,58,.7)", "left", 600); });
      [-120, -60, 0, 60, 120].forEach(function (lo) { txt(c, lo === 0 ? "0°" : Math.abs(lo) + "°" + (lo > 0 ? "E" : "W"), P(0, lo).x, p.my + p.mh - 10, 13, "rgba(29,43,58,.7)", "center", 600); });
      // catalogue + real URL + code
      building(c, p.rx + 52, 156, 96, 58, "#0f8f8a", t, { lit: true });
      dbIcon(c, p.rx + 52, 130, .8);
      txt(c, "Planetary Computer", p.rx + 112, 108, 18, INK, "left", 700);
      txt(c, "STAC catalogue · on Azure", p.rx + 112, 134, 15, "#4a5b6d", "left", 600);
      c.font = "600 13px " + MONO; var uw = Math.min(p.rw, c.measureText(D.stac_url).width + 20);
      u.rr(c, p.rx, 165, uw, 26, 13); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
      c.save(); c.beginPath(); c.rect(p.rx, 165, uw, 26); c.clip(); txt(c, D.stac_url, p.rx + 10, 179, 13, "#2b6fd0", "left", 600, MONO); c.restore();
      codeBoard(c, p.rx, 200, p.rw);
      // machine
      if (st.m) {
        if (st.m.key === "laptop") { laptop(c, p.px, p.py - 10); pill(c, "🏠 home Wi-Fi", p.px, p.py + 8, { size: 13, pad: 6, lw: 2 }); }
        else {
          c.save(); c.translate(p.px, p.py + 6); c.scale(.8, .8);
          rack(c, 0, 0, st.m.key === "gpu" ? "gpu" : "small", st.meter.on, st.meter.on, t); c.restore();
          pill(c, "West Europe", p.px, p.py + 4, { size: 13, pad: 6, lw: 2, bg: "#e3f0ff" });
        }
      }
      // results tray
      txt(c, st.res ? "Results: clearest first · " + st.kept + " kept (ReSeed keeps up to 8: max_scenes=8)" : "Results appear here", 150, p.ty, 16, INK, "left", 700);
      pill(c, "ReSeed's own limit here: max_cloud = " + (MAXC[site.id] || 20), S.W - 24, p.ty, { size: 13, pad: 8, lw: 2, align: "right", bg: "#fff3c4" });
      if (st.res) st.res.forEach(function (r, i) {
        if (S.t < r.t0) return;
        var a = u.clamp((S.t - r.t0) / .25, 0, 1), pos = cardPos(i, p), fy = 0, al = a;
        if (r.fallT >= 0) { var f = S.t - r.fallT; fy = 300 * f * f; al = Math.max(0, 1 - f * 1.4); if (al <= 0) return; }
        c.save(); c.globalAlpha = al; c.translate(0, fy + (1 - u.ease.outBack(a)) * 30);
        u.rr(c, pos.x - 48, p.ty + 14, 96, 92, 10); c.fillStyle = r.keep ? "#eafbe9" : "#ffe7e9"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = r.keep ? "#2f9e4f" : "#d1495b"; c.stroke();
        pic(c, pos.x, p.ty + 40, 42, i, r.s.cloud);
        txt(c, shortDate(r.s.datetime), pos.x, p.ty + 74, 15, INK, "center", 700);
        txt(c, "☁️ " + r.s.cloud + "%", pos.x, p.ty + 94, 14, r.keep ? "#2f7a3e" : "#c0392b", "center", 700);
        if (r.fallT >= 0) txt(c, "✗", pos.x + 36, p.ty + 22, 20, "#d1495b", "center", 700);
        c.restore();
      });
      if (st.planeT >= 0) {
        k = u.clamp((S.t - st.planeT) / st.m.secS, 0, 1);
        var go = k < .5, e = u.ease.inOut(go ? k * 2 : (k - .5) * 2), ax = p.px, ay = p.py - 70, bx = p.rx + 62, by = 130;
        var x = go ? u.lerp(ax, bx, e) : u.lerp(bx, ax, e), y = (go ? u.lerp(ay, by, e) : u.lerp(by, ay, e)) - Math.sin(e * Math.PI) * 60;
        c.save(); c.translate(x, y); c.rotate(go ? -.5 : 2.6);
        c.beginPath(); c.moveTo(18, 0); c.lineTo(-14, -11); c.lineTo(-7, 0); c.lineTo(-14, 11); c.closePath();
        c.fillStyle = "#fff"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); c.restore();
        if (st.m.key === "laptop" && Math.sin(S.t * 8) > 0) pill(c, "slow Wi-Fi…", x, y - 30, { size: 13, pad: 6, lw: 2 });
      }
      if (st.phase === "dl") pill(c, "⬇️ " + st.got + " / " + st.kept, p.px, p.ty - 14, { size: 15, weight: 700 });
    };
  }

  /* ============================================================ L5 Second opinion: a cloud AI, the key stays on the server */
  function lvAI(L) {
    var site = mySite(), photo = img(site.files && (site.files.rgb_baseline || site.files.rgb));
    var S = scene(L, { start: 9, end: 10.5, deadline: 10, dlName: "Demo" }); S.noSun = true;
    var st = { mode: null, t0: -1, tries: 0, keyAt: "safe", sent: 0, done: false, fx: {} };
    var OPTS = [
      { icon: "🔑", name: "Key inside the web page", sub: "Quick! The visitor's browser calls the AI itself." },
      { icon: "🛡️", name: "Key stays on the server", sub: "Web page → ReSeed server (key in `.env`) → Azure OpenAI" },
      { icon: "💻", name: "Giant AI on the demo laptop", sub: "No cloud at all… if it fits?" }];
    S.job("📋 Rescue job", "Demo at **10 AM**! Show a forest picture with the cloud AI's **second opinion**.");
    var cards = S.cards(OPTS.map(function (o) { return { icon: o.icon, name: o.name, sub: o.sub }; }), pick);

    function lay() { var W = S.W; return { base: 352, tx: W * .15, sx: W * .49, ax: W * .83 }; }
    function once(k) { if (st.fx[k]) return false; st.fx[k] = true; return true; }
    function pick(i) {
      cards.lock(i); st.mode = ["leak", "ok", "oom"][i]; st.t0 = S.t; st.fx = {};
      if (st.mode === "ok") { S.task(.35, 5.6, function () { st.done = true; L.timeout(finish, 1500); }); return; }
      S.task(st.mode === "leak" ? .2 : .3, st.mode === "leak" ? 4 : 3, function () {
        var talk = st.mode === "leak"
          ? L.say("tuki", "Anyone can peek inside a web page. The Glitch Bugs copied our key and spent our coins!", { mood: "sad" })
          : L.say("mo", "That model is far too big for one laptop. It ran out of memory!", { mood: "sad" });
        talk.then(function () {
          if (!L.alive) return;
          if (st.mode === "leak") S.note("🔁 Pix made a new key (rotated it). The stolen one is useless now.", "info", 2600);
          st.tries++; st.mode = null; st.keyAt = "safe"; cards.unlock();
        });
      });
    }
    function finish() {
      var stars = st.tries === 0 ? 3 : st.tries === 1 ? 2 : 1, onTime = S.hour <= 10 + 1e-6;
      L.win({ stars: stars, msg: (onTime ? "The answer came back in time for the demo" : "The answer came back") + ", and the key never left the server. Safe and smart!",
        stats: { "Tries": st.tries + 1, "Answer at": fmtH(S.hour), "Bill": money(S.spent) } });
    }
    S.onTime = function () {
      var e = S.t - st.t0, p = lay();
      if (st.mode === "leak") {
        if (e > .1 && once("k")) { st.keyAt = "fly"; RQ.audio.sfx("whoosh"); }
        if (e > .8) st.keyAt = "page";
        if (e > 1.8 && once("grab")) { st.keyAt = "bug"; S.sfx("giggle", 0); }
        if (e > 2 && e < 3.6 && e - (st.lastSend || 0) > .09) {
          st.lastSend = e; S.spent += .5; S.coinTo(p.ax, p.base - 90); S.sfx("zap", .15);
          S.fly({ x0: p.tx + 40, y0: p.base - 160, x1: p.ax, y1: p.base - 110, dur: .45, arc: 40, linear: true, draw: function (c, x, y) { u.rr(c, x - 9, y - 6, 18, 12, 2); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 2; c.strokeStyle = "#d1495b"; c.stroke(); } });
        }
        if (e > 2.2 && once("alarm")) RQ.audio.sfx("buzz");
      }
      if (st.mode === "oom") {
        if (e > .1 && once("grow")) RQ.audio.sfx("powerup");
        if (e > 1.6 && e < 3 && Math.random() < .3) S.puff(p.sx + u.rand(-40, 40), p.base - 150, 1, "#9aa6b2");
        if (e > 1.9 && once("oom")) { RQ.audio.sfx("error"); S.sfx("giggle", 0); }
      }
      if (st.mode === "ok") {
        if (e > .1 && once("a")) RQ.audio.sfx("whoosh");
        if (e > 1 && once("b")) RQ.audio.sfx("beep");
        if (e > 1.8 && once("c")) RQ.audio.sfx("whoosh");
        if (e > 2.8 && once("d")) RQ.audio.sfx("chirp");
        if (e > 3.8 && once("e")) RQ.audio.sfx("whoosh");
        if (e > 5 && once("f")) { RQ.audio.sfx("good"); S.sparks(p.tx, p.base - 200, 22); }
      }
    };
    function along(a, b, k, arc) { var e = u.ease.inOut(u.clamp(k, 0, 1)); return { x: u.lerp(a.x, b.x, e), y: u.lerp(a.y, b.y, e) - Math.sin(e * Math.PI) * (arc || 60) }; }
    S.draw = function (c, t) {
      var p = lay(), e = st.t0 >= 0 ? S.t - st.t0 : 0, b = p.base;
      island(c, p.tx, b, 250, .3); island(c, p.sx, b, 280, 1.4); island(c, p.ax, b, 270, 2.6);
      // visitor's web page (tablet)
      u.rr(c, p.tx - 84, b - 160, 168, 124, 14); c.fillStyle = "#2e3d50"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.fillStyle = "#fff"; c.fillRect(p.tx - 74, b - 150, 148, 104);
      if (ok(photo)) c.drawImage(photo, p.tx - 74, b - 132, 148, 86); else { c.fillStyle = "#3f8f3f"; c.fillRect(p.tx - 74, b - 132, 148, 86); }
      c.fillStyle = "#e7edf3"; c.fillRect(p.tx - 74, b - 150, 148, 18); txt(c, "ReSeed web page", p.tx, b - 141, 13, INK, "center", 600);
      c.fillStyle = "#2e3d50"; c.fillRect(p.tx - 8, b - 36, 16, 34);
      pill(c, "🌐 visitor's web page", p.tx, b + 64, { size: 15 });
      // ReSeed server with the key safe
      rack(c, p.sx - 50, b, "big", true, st.mode === "ok" && e > 1 && e < 1.8, t);
      u.rr(c, p.sx + 22, b - 70, 74, 66, 10); c.fillStyle = "#9aa6b2"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(p.sx + 59, b - 37, 15, 0, 7); c.fillStyle = "#cfd8e3"; c.fill(); c.stroke();
      txt(c, ".env", p.sx + 59, b - 84, 14, INK, "center", 700, MONO);
      if (st.keyAt === "safe") keyIcon(c, p.sx + 59, b - 37, .8, st.mode === "ok" && e > 1.6 && e < 2.8);
      pill(c, "🖥️ ReSeed server", p.sx, b + 64, { size: 15 });
      pill(c, "python -m reseed serve", p.sx, b - 200, { size: 13, font: MONO, pad: 8, lw: 2, bg: "#10161f", fg: "#7ee787" });
      if (st.mode === "ok" && e > 1 && e < 1.9) pill(c, "🧠 ForestNet checks first", p.sx - 50, b - 166, { size: 14, pad: 8, lw: 2, bg: "#f1edfa" });
      // Azure OpenAI
      building(c, p.ax, b, 190, 150, PROV.azure.color, t, { flag: PROV.azure });
      var think = st.mode === "ok" && e > 2.6 && e < 3.8, br = 24 + (think ? Math.sin(t * 12) * 4 : 0);
      c.fillStyle = "#ff9fc0"; c.strokeStyle = INK; c.lineWidth = 2.5;
      [[-12, -6], [12, -6], [-10, 10], [10, 10]].forEach(function (o) { c.beginPath(); c.arc(p.ax + o[0] * br / 24, b - 74 + o[1] * br / 24, br * .55, 0, 7); c.fill(); c.stroke(); });
      pill(c, "Azure OpenAI", p.ax, b - 20, { size: 15, weight: 700 });
      pill(c, "gpt-6-astra", p.ax, b + 64, { size: 15, font: MONO, bg: "#e3f0ff" });
      if (think) txt(c, "thinking" + ".".repeat(1 + Math.floor(t * 4) % 3), p.ax, b - 190, 16, INK, "center", 700);
      // the right way: picture → server → Azure OpenAI → back
      var T = { x: p.tx + 60, y: b - 110 }, Sv = { x: p.sx - 50, y: b - 110 }, A = { x: p.ax - 60, y: b - 100 };
      if (st.mode === "ok" || st.done) {
        var q;
        if (e < 1) { q = along(T, Sv, e / 1); pic(c, q.x, q.y, 30, 1); pill(c, "POST /api/classify", (T.x + Sv.x) / 2, b - 230, { size: 14, font: MONO, pad: 8, lw: 2 }); }
        else if (e > 1.8 && e < 2.8) { q = along(Sv, A, e - 1.8, 70); pic(c, q.x, q.y, 28, 1); txt(c, "🔒", q.x + 16, q.y - 16, 18); }
        else if (e > 3.8 && e < 5) { q = along(A, T, (e - 3.8) / 1.2, 120); u.rr(c, q.x - 26, q.y - 14, 52, 28, 8); c.fillStyle = "#fff3c4"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); txt(c, "{ }", q.x, q.y + 1, 16, INK, "center", 700, MONO); }
        if (e > 5) {
          u.rr(c, p.tx - 96, b - 262, 270, 100, 12); c.fillStyle = "#fffdf2"; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
          txt(c, '{"is_forest": true,', p.tx - 84, b - 242, 14, "#2f7a3e", "left", 600, MONO);
          txt(c, ' "view": "overhead"}', p.tx - 84, b - 222, 14, "#2f7a3e", "left", 600, MONO);
          txt(c, "🤖 Second opinion: forest!", p.tx - 84, b - 196, 15, INK, "left", 700);
          txt(c, "(example answer)", p.tx + 164, b - 176, 13, "#4a5b6d", "right", 600);
        }
      }
      // the leak: key in the page, bugs steal it
      if (st.mode === "leak") {
        if (st.keyAt === "fly") { var kq = along({ x: p.sx + 59, y: b - 37 }, { x: p.tx + 50, y: b - 120 }, (e - .1) / .7, 90); keyIcon(c, kq.x, kq.y, .9, true); }
        if (st.keyAt === "page") keyIcon(c, p.tx + 50, b - 120, .9, true);
        var bx = Math.min(p.tx - 30, -40 + (e - .8) * 220);
        if (e > .8) for (var i = 0; i < 3; i++) drawChar(c, "bug", bx - i * 34, b - 40 - i * 26 - Math.abs(Math.sin(t * 9 + i)) * 8, 46, "happy");
        if (st.keyAt === "bug") keyIcon(c, bx + 4, b - 70 - Math.abs(Math.sin(t * 9)) * 8, .8, true);
        if (e > 2) pill(c, "🚨 stolen key: thousands of calls!", p.sx, 150, { size: 16, bg: "#ffe0e4", weight: 700 });
      }
      // the laptop meltdown: the model does not fit in memory
      if (st.mode === "oom") {
        var g = u.ease.outBack(u.clamp(e / 1.6, 0, 1)) * 1.6;
        c.save(); c.translate(p.sx - 50, b - 110); c.scale(g, g); c.globalAlpha = .9; c.fillStyle = "#ff9fc0"; c.strokeStyle = INK; c.lineWidth = 2;
        [[-14, -8], [14, -8], [-12, 12], [12, 12], [0, 0]].forEach(function (o) { c.beginPath(); c.arc(o[0], o[1], 16, 0, 7); c.fill(); c.stroke(); });
        c.restore();
        var th = u.clamp(e / 2, 0, 1);
        u.rr(c, p.sx + 110, b - 150, 18, 120, 9); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
        c.fillStyle = "#e5484d"; c.fillRect(p.sx + 114, b - 34 - 108 * th, 10, 108 * th);
        if (e > 1.9 && Math.sin(t * 10) > -.3) pill(c, "⚠️ OUT OF MEMORY", p.sx, 150, { size: 18, bg: "#d1495b", fg: "#fff", weight: 700 });
      }
    };
  }

  /* ============================================================ the game */
  RQ.game({
    id: "g08",
    music: "camp",
    intro: [
      ["tuki", "Squawk, I'm Tuki! Welcome to **Cloud City**, where computers live in giant buildings called **data centres**."],
      ["tuki", "You can rent them by the hour. Every job has a deadline, and every hour costs coins!"]
    ],
    outro: [
      ["tuki", "You ran Cloud City like a pro: fast, cheap and safe!"],
      ["sprout", "Our pictures are ready. Next, they travel across the internet in Packet Post!"]
    ],
    levels: [
      { title: "Rent a VM", goal: "Pick a region and a computer, then make the map by 1 PM",
        intro: [["tuki", "Rescue job! The team needs a greenness map of your forest by 1 PM."],
                ["tuki", "First pick a **region**, the place where your cloud computer lives. Then pick the computer."]],
        cards: ["cloud-vm", "cloud-region"], play: lvRent },
      { title: "Stop the meter", goal: "Train ForestNet by noon, then deallocate every VM",
        intro: [["mo", "Next job: train **ForestNet**, our forest-spotting AI, before noon."],
                ["pix", "Oops, I left my test VM running all night. Every hour on the meter costs coins!"]],
        cards: ["cloud-deallocate"], play: lvStop },
      { title: "Cloud storage", goal: "Build account → container → blob, then pick a tier for each box",
        intro: [["tuki", "Satellite pictures need a safe home in the cloud. Let's build a **storage account**!"],
                ["hoot", "Then sort the boxes. Some we read every day, some almost never."]],
        cards: ["cloud-blob"], play: lvStore },
      { title: "STAC search", goal: "Ask the catalogue: where? when? how cloudy?",
        intro: [["hoot", "I need clear pictures of your forest by 11 AM. Ask the **STAC catalogue**!"],
                ["tuki", "Tell it where, when and how cloudy. It's like a library card index for space pictures."]],
        cards: ["cloud-stac"], play: lvStac },
      { title: "Ask the cloud AI", goal: "Get a second opinion before the 10 AM demo",
        intro: [["sprout", "Demo day! ReSeed asks a cloud AI for a **second opinion** on a picture."],
                ["pix", "The AI needs a secret **API key**. Where we keep that key really matters!"]],
        cards: ["cloud-ai-key"], play: lvAI }
    ]
  });
})();
