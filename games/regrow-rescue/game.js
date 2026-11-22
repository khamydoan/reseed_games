/* g23 Regrow Rescue — after the seeds are down, help a forest's real animals come home.
 * Each level is one real biome from reseed/species.py (its `animals` list) with the NDVI of a real ReSeed patch.
 *  1. Plan: read what each animal needs and load habitat helpers on the drone (some are wrong for the biome).
 *  2. Deliver: type short words to drop each helper (letters wait in levels 1-2; crates float down in 3-5).
 *  3. Years: type a growing word to jump 3 years. Trees grow on the same S-curve as the website's 3D time-lapse
 *     (site/js/mission3d.js), NDVI climbs on the mini chart, and animals arrive if their need was met.
 *     Type each animal's name to welcome it home. Stars: finish · every animal home · accuracy ≥ 90 % with no wrong picks. */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a";
  var W = 1280, H = 500, GY = 420;
  var DATA = RQ.data() || { biomes: {}, sites: [], health: [] };
  var YEAR0 = 2026, STEP = 3, YEARS = 15;
  var GROW_WORDS = ["roots", "sapling", "branch", "canopy", "forest"];

  /* ------------------------------------------------------------ growth: the 3D twin's S-curve */
  function logistic(x) { return 1 / (1 + Math.exp(-x)); }
  var G0 = logistic(-4.5 / 1.6), G1 = logistic((YEARS - 4.5) / 1.6);
  /** 0 at planting, 1 after 15 years: logistic((y - 4.5) / 1.6) from site/js/mission3d.js, rescaled. */
  function grow(y) { return u.clamp((logistic((y - 4.5) / 1.6) - G0) / (G1 - G0), 0, 1); }
  function health(v) {
    var hs = DATA.health || [];
    for (var i = 0; i < hs.length; i++) if (v >= hs[i].lower) return hs[i];
    return { label: "" };
  }
  function mixColor(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    function ch(s) { return Math.round(u.lerp((pa >> s) & 255, (pb >> s) & 255, u.clamp(t, 0, 1))); }
    return "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")";
  }

  /* ------------------------------------------------------------ drawing primitives */
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot || 0, 0, Math.PI * 2); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(.1, r), 0, Math.PI * 2); }
  function paint(c, fill, lw) {
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (lw !== 0) { c.lineWidth = lw || 2.5; c.strokeStyle = INK; c.lineJoin = "round"; c.stroke(); }
  }
  function line(c, pts, col, w) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = col || INK; c.lineWidth = w || 3; c.lineCap = "round"; c.lineJoin = "round"; c.stroke();
  }
  /** Limb with an ink outline. */
  function limb(c, pts, col, w) { line(c, pts, INK, w + 3); line(c, pts, col, w); }
  function eye(c, x, y, r) { circ(c, x, y, r); c.fillStyle = INK; c.fill(); circ(c, x + r * .35, y - r * .35, r * .4); c.fillStyle = "#fff"; c.fill(); }

  /* ------------------------------------------------------------ animals (simple cartoon shapes; origin = feet) */
  function bird(c, t, o) {
    c.save(); c.translate(0, Math.sin(t * 3 + (o.ph || 0)) * 1.2);
    line(c, [-4, -12, -5, 0], o.legs || "#8a6a4a", 3); line(c, [4, -12, 5, 0], o.legs || "#8a6a4a", 3);
    if (o.fan) {
      for (var i = -3; i <= 3; i++) {
        c.save(); c.translate(-8, -26); c.rotate(i * .3 - .45);
        ell(c, 0, -22, 7, 22); paint(c, i % 2 ? "#8a5a32" : "#6b4423", 2);
        ell(c, 0, -38, 5, 4); c.fillStyle = "#efe0bd"; c.fill(); c.restore();
      }
    } else {
      var tl = o.tail || 16;
      c.beginPath(); c.moveTo(-9, -25); c.lineTo(-12 - tl, -10 + tl * .45); c.lineTo(-3 - tl * .7, -4 + tl * .5); c.closePath(); paint(c, o.tailC || o.body, 2);
    }
    ell(c, 0, -24, 17, 14, -.35); paint(c, o.body);
    if (o.chest) { ell(c, 8, -26, 8, 10, -.4); c.fillStyle = o.chest; c.fill(); }
    ell(c, -3, -25, 12, 7.5, -.45); paint(c, o.wing || o.body, 2);
    if (o.band) { ell(c, -9, -22, 6, 4, -.45); c.fillStyle = o.band; c.fill(); }
    if (o.crest) { c.beginPath(); c.moveTo(4, -45); c.lineTo(o.crest[0], o.crest[1]); c.lineTo(12, -48); c.closePath(); paint(c, o.crestC || o.head || o.body, 2); }
    circ(c, 12, -40, 10.5); paint(c, o.head || o.body);
    if (o.face) { ell(c, 15, -40, 6, 6.5); c.fillStyle = o.face; c.fill(); }
    if (o.cap) { c.beginPath(); c.arc(12, -40, 10.5, Math.PI * 1.08, Math.PI * 1.92); c.closePath(); c.fillStyle = o.cap; c.fill(); }
    if (o.necklace) { c.beginPath(); c.arc(12, -38, 10, .5, 2.5); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); }
    eye(c, 15, -42, 2.6);
    var bk = o.beak || "small";
    if (bk === "toucan") {
      c.beginPath(); c.moveTo(19, -47); c.quadraticCurveTo(44, -50, 50, -37); c.quadraticCurveTo(38, -33, 20, -33); c.closePath(); paint(c, "#ffb02e", 2);
      ell(c, 47, -39, 3.5, 3, .4); c.fillStyle = INK; c.fill();
      c.beginPath(); c.moveTo(21, -40); c.quadraticCurveTo(36, -42, 46, -39); c.strokeStyle = "#e8483b"; c.lineWidth = 2; c.stroke();
    } else if (bk === "horn") {
      c.beginPath(); c.moveTo(17, -48); c.quadraticCurveTo(32, -63, 44, -51); c.quadraticCurveTo(32, -50, 20, -45); c.closePath(); paint(c, "#ff7a2e", 2);
      c.beginPath(); c.moveTo(19, -45); c.quadraticCurveTo(40, -47, 49, -33); c.quadraticCurveTo(34, -35, 20, -35); c.closePath(); paint(c, "#ffd84d", 2);
    } else if (bk === "hook") {
      c.beginPath(); c.moveTo(19, -47); c.quadraticCurveTo(32, -47, 29, -33); c.quadraticCurveTo(25, -37, 20, -36); c.closePath(); paint(c, o.beakC || "#e8e0d0", 2);
    } else {
      c.beginPath(); c.moveTo(20, -43); c.lineTo(31, -39); c.lineTo(20, -36); c.closePath(); paint(c, o.beakC || "#3a3a3a", 2);
    }
    if (o.wattle) { ell(c, 21, -31, 3, 6); paint(c, "#e8483b", 1.5); }
    c.restore();
  }
  function butterfly(c, t, o) {
    var f = .3 + Math.abs(Math.sin(t * 9 + (o.ph || 0))) * .7;
    c.save(); c.translate(0, -30); c.save(); c.scale(f, 1);
    [-1, 1].forEach(function (s) {
      ell(c, s * 13, -7, 13, 11, s * .3); paint(c, "#1e88ff", 2);
      ell(c, s * 9, 8, 8, 7, -s * .3); paint(c, "#1767c9", 2);
      circ(c, s * 19, -11, 2.5); c.fillStyle = "#fff"; c.fill();
    });
    c.restore();
    ell(c, 0, 0, 2.5, 11); paint(c, "#2b2b2b", 1.5);
    line(c, [0, -10, -4, -18], INK, 1.5); line(c, [0, -10, 4, -18], INK, 1.5);
    c.restore();
  }
  function deer(c, t, o) {
    var sw = o.walk ? Math.sin(t * 9) * 5 : 0, nod = Math.sin(t * 1.3 + (o.ph || 0)) * .05, tan = o.color || "#a8743f";
    limb(c, [-18, -38, -18 - sw, 0], "#7a5330", 4); limb(c, [14, -38, 14 + sw, 0], "#7a5330", 4);
    if (o.flag) { ell(c, -27, -54, 5, 9, -.5); paint(c, "#fff", 2); } else { ell(c, -26, -48, 4, 6, -.6); paint(c, "#f3e6cf", 2); }
    ell(c, 0, -44, 27, 13); paint(c, tan);
    ell(c, 2, -37, 18, 5); c.fillStyle = "#f3e6cf"; c.fill();
    limb(c, [-11, -38, -11 + sw, 0], "#8a6038", 4); limb(c, [20, -38, 20 - sw, 0], "#8a6038", 4);
    c.save(); c.translate(20, -50); c.rotate(nod);
    c.beginPath(); c.moveTo(-6, 4); c.lineTo(2, -20); c.lineTo(11, -18); c.lineTo(9, 6); c.closePath(); paint(c, tan, 2);
    var er = o.bigEars ? 1.45 : 1;
    ell(c, 0, -30, 4 * er, 8 * er, -.9); paint(c, tan, 2); ell(c, 14, -31, 4 * er, 8 * er, .6); paint(c, tan, 2);
    ell(c, 9, -22, 10, 7, .35); paint(c, tan);
    ell(c, 17, -18, 3.5, 3); c.fillStyle = INK; c.fill();
    eye(c, 8, -24, 2.2);
    c.restore();
  }
  function tapir(c, t, o) {
    var sw = o.walk ? Math.sin(t * 8) * 4 : 0, n = Math.sin(t * 1.5 + (o.ph || 0)) * 1.5;
    limb(c, [-20, -22, -20 - sw, 0], "#2c2b30", 6); limb(c, [16, -22, 16 + sw, 0], "#2c2b30", 6);
    ell(c, 0, -31, 31, 17); paint(c, "#3d3c43");
    limb(c, [-12, -22, -12 + sw, 0], "#46454c", 6); limb(c, [22, -22, 22 - sw, 0], "#46454c", 6);
    ell(c, 27, -45 + n, 4, 6, -.3); paint(c, "#3d3c43", 2);
    ell(c, 33, -33 + n, 13, 11, .2); paint(c, "#3d3c43");
    c.beginPath(); c.moveTo(42, -38 + n); c.quadraticCurveTo(56, -34 + n, 53, -21 + n); c.lineTo(47, -23 + n); c.quadraticCurveTo(47, -29 + n, 41, -28 + n); c.closePath(); paint(c, "#3d3c43", 2);
    eye(c, 36, -37 + n, 2);
  }
  function bear(c, t, o) {
    var sw = o.walk ? Math.sin(t * 7) * 4 : 0, n = Math.sin(t * 1.2) * 1.2;
    limb(c, [-18, -24, -18 - sw, 0], "#1d1d20", 8); limb(c, [16, -24, 16 + sw, 0], "#1d1d20", 8);
    ell(c, 0, -34, 31, 21); paint(c, "#2a2a2e");
    limb(c, [-10, -22, -10 + sw, 0], "#333338", 8); limb(c, [22, -22, 22 - sw, 0], "#333338", 8);
    circ(c, 25, -58 + n, 5.5); paint(c, "#2a2a2e", 2); circ(c, 38, -59 + n, 5.5); paint(c, "#2a2a2e", 2);
    circ(c, 32, -46 + n, 14); paint(c, "#2a2a2e");
    ell(c, 42, -42 + n, 8, 6); paint(c, "#b08860", 2);
    ell(c, 48, -44 + n, 3, 2.5); c.fillStyle = INK; c.fill();
    eye(c, 33, -50 + n, 2.2);
  }
  function squirrel(c, t, o) {
    var col = o.color || "#8d939b";
    c.save(); c.translate(-6, -8); c.rotate(Math.sin(t * 4 + (o.ph || 0)) * .08);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-26, -6, -26, -40, -10, -50); c.bezierCurveTo(-2, -56, 8, -50, 2, -42); c.bezierCurveTo(-12, -36, -10, -12, 6, -4); c.closePath(); paint(c, col);
    c.restore();
    ell(c, 2, -16, 10, 15); paint(c, col);
    ell(c, 5, -13, 5, 9); c.fillStyle = "#f2efe8"; c.fill();
    ell(c, 3, -44, 3, 5, -.3); paint(c, col, 2);
    circ(c, 7, -34, 9); paint(c, col);
    eye(c, 10, -36, 2.2); ell(c, 15.5, -33, 2, 1.6); c.fillStyle = INK; c.fill();
    ell(c, 12, -21, 4, 5); paint(c, "#c08a4a", 1.5);
  }
  function kangaroo(c, t, o) {
    var hop = o.walk ? Math.abs(Math.sin(t * 6)) * 12 : 0, col = "#b07a52";
    c.save(); c.translate(0, -hop);
    c.beginPath(); c.moveTo(-6, -24); c.quadraticCurveTo(-28, -10, -46, -2 + hop); c.lineTo(-44, 3 + hop); c.quadraticCurveTo(-24, -2, -4, -12); c.closePath(); paint(c, col, 2);
    ell(c, -2, -15, 14, 10, .3); paint(c, col);
    ell(c, 8, -3, 14, 3.5); paint(c, "#8a5c3a", 2);
    ell(c, 2, -38, 13, 22, .25); paint(c, col);
    ell(c, 6, -36, 7, 14, .25); c.fillStyle = "#ecd6b8"; c.fill();
    limb(c, [10, -46, 17, -36], "#8a5c3a", 3);
    ell(c, 4, -79, 3.5, 8, -.25); paint(c, col, 2); ell(c, 11, -79, 3.5, 8, .15); paint(c, col, 2);
    ell(c, 10, -65, 9, 8, .2); paint(c, col);
    ell(c, 18, -63, 6, 4.5, .2); paint(c, col, 2);
    eye(c, 11, -67, 2); ell(c, 23, -63, 2, 1.6); c.fillStyle = INK; c.fill();
    c.restore();
  }
  function echidna(c, t) {
    var sn = Math.sin(t * 3) * 1.5;
    for (var i = 0; i < 12; i++) {
      var a = Math.PI * (1.08 + i * .075), x0 = Math.cos(a) * 15, y0 = -11 + Math.sin(a) * 9, x1 = Math.cos(a) * 27, y1 = -11 + Math.sin(a) * 19;
      limb(c, [x0, y0, x1, y1], "#f1e3c4", 2.5);
    }
    ell(c, 0, -10, 20, 12); paint(c, "#5a4330");
    limb(c, [15, -8, 32, -4 + sn], "#3a2a20", 3);
    limb(c, [-10, -2, -12, 0], "#3a2a20", 3); limb(c, [8, -2, 10, 0], "#3a2a20", 3);
    eye(c, 14, -12, 1.8);
  }
  function koala(c, t) {
    var col = "#9aa6b2", n = Math.sin(t * 1.1) * 1.2;
    ell(c, 0, -20, 16, 20); paint(c, col);
    ell(c, 0, -16, 9, 13); c.fillStyle = "#e6e9ee"; c.fill();
    ell(c, 12, -24, 5, 10, -.4); paint(c, col, 2);
    circ(c, -14, -54 + n, 9); paint(c, col); circ(c, -14, -54 + n, 5); c.fillStyle = "#f2c4d0"; c.fill();
    circ(c, 14, -54 + n, 9); paint(c, col); circ(c, 14, -54 + n, 5); c.fillStyle = "#f2c4d0"; c.fill();
    circ(c, 0, -45 + n, 15); paint(c, col);
    ell(c, 0, -42 + n, 5, 7); paint(c, "#3a3f47", 2);
    eye(c, -7, -48 + n, 2.2); eye(c, 7, -48 + n, 2.2);
  }
  function capuchin(c, t) {
    var col = "#6b4a2e";
    limb(c, [-6, -6, -18, 6, -20, 20, -12, 27, -8, 21], col, 3.5);
    ell(c, 0, -16, 11, 15); paint(c, col);
    ell(c, 2, -14, 6, 9); c.fillStyle = "#e9d6b5"; c.fill();
    circ(c, -9, -38, 3.5); paint(c, "#e9d6b5", 2); circ(c, 13, -38, 3.5); paint(c, "#e9d6b5", 2);
    circ(c, 2, -38, 11); paint(c, "#e9d6b5");
    c.beginPath(); c.arc(2, -38, 11, Math.PI * 1.12, Math.PI * 1.88); c.closePath(); c.fillStyle = "#3a2a1c"; c.fill();
    ell(c, 3, -34, 6.5, 5.5); c.fillStyle = "#d9b48c"; c.fill();
    eye(c, -1, -37, 2); eye(c, 6, -37, 2);
    limb(c, [7, -22, 13, -10 + Math.sin(t * 2) * 2], col, 3.5);
  }
  function orangutan(c, t) {
    var col = "#d0632a", sw = Math.sin(t * 1.6) * 3;
    limb(c, [-12, -40, -26 + sw, -78], col, 6); limb(c, [12, -40, 26 - sw, -78], col, 6);
    limb(c, [-8, -10, -14, 2], col, 6); limb(c, [8, -10, 14, 2], col, 6);
    ell(c, 0, -26, 18, 22); paint(c, col);
    for (var i = -2; i <= 2; i++) line(c, [i * 6, -10, i * 6 - 2, -3], "#a8471a", 2);
    circ(c, 0, -50, 12); paint(c, col);
    ell(c, 0, -47, 8, 9); paint(c, "#a8673f", 2);
    eye(c, -3, -50, 1.8); eye(c, 3, -50, 1.8);
    line(c, [-2, -42, 2, -42], INK, 1.5);
  }
  function gibbon(c, t, o) { // origin = the hand that grips
    var col = "#b8925f";
    c.save(); c.rotate(Math.sin(t * 2.2 + (o.ph || 0)) * .22);
    limb(c, [0, 0, 2, 30], col, 4);
    limb(c, [-4, 44, -24, 58 + Math.sin(t * 2) * 3], col, 4);
    limb(c, [-4, 66, -8, 82], col, 4.5); limb(c, [4, 66, 9, 81], col, 4.5);
    ell(c, 0, 54, 10, 14); paint(c, col);
    circ(c, 5, 34, 9); paint(c, col);
    ell(c, 6, 35, 6, 5.5); paint(c, "#3a3330", 0); circ(c, 6, 35, 7); c.strokeStyle = "#f6efe0"; c.lineWidth = 2; c.stroke();
    eye(c, 4, 34, 1.6); eye(c, 8.5, 34, 1.6);
    c.restore();
  }
  function frog(c, t, o) {
    var hop = Math.max(0, Math.sin(t * 2 + (o.ph || 0))) * 6;
    c.save(); c.translate(0, -hop);
    ell(c, 0, -7, 11, 8); paint(c, "#62c370", 2);
    circ(c, -5, -14, 4); paint(c, "#62c370", 2); circ(c, 5, -14, 4); paint(c, "#62c370", 2);
    eye(c, -5, -14, 1.8); eye(c, 5, -14, 1.8);
    c.restore();
  }
  function bee(c, t, o) {
    c.save(); c.translate(0, Math.sin(t * 6 + (o.ph || 0)) * 5);
    var flap = Math.abs(Math.sin(t * 30 + (o.ph || 0))) * 6 + 3;
    ell(c, -2, -9, 6, flap, -.4); c.fillStyle = "rgba(255,255,255,.85)"; c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke();
    ell(c, 0, 0, 10, 7); paint(c, "#ffd23f", 2);
    c.fillStyle = INK; c.fillRect(-3, -6, 3, 12); c.fillRect(3, -6, 3, 12);
    c.restore();
  }
  function lizard(c, t) {
    var w = Math.sin(t * 3) * 3;
    limb(c, [-22, -2 + w, -12, -4, 0, -5, 12, -6], "#7cc36a", 4);
    ell(c, 15, -7, 6, 4); paint(c, "#7cc36a", 2); eye(c, 17, -8, 1.4);
  }

  /* Animal art and welcome words, keyed by the exact names in reseed/species.py BIOMES[...]["animals"]. */
  var ART = {
    "toucan": { word: "toucan", kind: "perch", draw: function (c, t, o) { bird(c, t, { body: "#23262d", chest: "#fff1a8", beak: "toucan", tail: 18, ph: o.ph }); } },
    "scarlet macaw": { word: "macaw", kind: "perch", draw: function (c, t, o) { bird(c, t, { body: "#e23b2e", wing: "#2f7bd8", band: "#ffd23f", tail: 34, tailC: "#d6332a", face: "#fff6ee", beak: "hook", ph: o.ph }); } },
    "capuchin monkey": { word: "capuchin", kind: "canopy", draw: function (c, t) { capuchin(c, t); } },
    "blue morpho butterfly": { word: "morpho", kind: "fly", draw: function (c, t, o) { butterfly(c, t, o); } },
    "tapir": { word: "tapir", kind: "ground", draw: function (c, t, o) { tapir(c, t, o); } },
    "mule deer": { word: "deer", kind: "ground", draw: function (c, t, o) { deer(c, t, { walk: o.walk, bigEars: true, color: "#9a7a5a", ph: o.ph }); } },
    "Steller's jay": { word: "jay", kind: "perch", draw: function (c, t, o) { bird(c, t, { body: "#2f5fb3", head: "#1e2430", crest: [6, -66], crestC: "#1e2430", wing: "#2a55a3", tail: 20, ph: o.ph }); } },
    "western gray squirrel": { word: "squirrel", kind: "ground", draw: function (c, t, o) { squirrel(c, t, { color: "#8d939b", ph: o.ph }); } },
    "acorn woodpecker": { word: "woodpecker", kind: "perch", draw: function (c, t, o) { bird(c, t, { body: "#22252b", chest: "#f4f1e8", head: "#22252b", face: "#f4f1e8", cap: "#e23b2e", beak: "small", tail: 12, ph: o.ph }); } },
    "black bear": { word: "bear", kind: "ground", draw: function (c, t, o) { bear(c, t, o); } },
    "white-tailed deer": { word: "deer", kind: "ground", draw: function (c, t, o) { deer(c, t, { walk: o.walk, flag: true, color: "#b07a45", ph: o.ph }); } },
    "wild turkey": { word: "turkey", kind: "ground", draw: function (c, t, o) { c.save(); c.scale(1.2, 1.2); bird(c, t, { body: "#5e4128", wing: "#7a5634", head: "#8fb8e8", fan: true, wattle: true, legs: "#d98c8c", beak: "small", beakC: "#d9c59a", ph: o.ph }); c.restore(); } },
    "eastern gray squirrel": { word: "squirrel", kind: "ground", draw: function (c, t, o) { squirrel(c, t, { color: "#9a9a96", ph: o.ph }); } },
    "blue jay": { word: "jay", kind: "perch", draw: function (c, t, o) { bird(c, t, { body: "#3d8fe0", chest: "#f4f6fb", head: "#3d8fe0", crest: [4, -64], wing: "#2f6fc0", necklace: true, tail: 20, ph: o.ph }); } },
    "kangaroo": { word: "kangaroo", kind: "ground", draw: function (c, t, o) { kangaroo(c, t, o); } },
    "glossy black-cockatoo": { word: "cockatoo", kind: "perch", draw: function (c, t, o) { bird(c, t, { body: "#2b2522", head: "#3a2f2a", crest: [2, -58], tail: 22, tailC: "#d6332a", beak: "hook", beakC: "#8a8580", ph: o.ph }); } },
    "koala": { word: "koala", kind: "canopy", draw: function (c, t) { koala(c, t); } },
    "echidna": { word: "echidna", kind: "ground", draw: function (c, t) { echidna(c, t); } },
    "orangutan": { word: "orangutan", kind: "canopy", draw: function (c, t) { orangutan(c, t); } },
    "rhinoceros hornbill": { word: "hornbill", kind: "perch", draw: function (c, t, o) { bird(c, t, { body: "#202226", chest: "#f4f1e8", head: "#202226", tail: 22, tailC: "#f4f1e8", beak: "horn", ph: o.ph }); } },
    "gibbon": { word: "gibbon", kind: "hang", draw: function (c, t, o) { gibbon(c, t, o); } }
  };

  /* ------------------------------------------------------------ habitat helpers */
  var HELPERS = {
    mix: { name: "Native seed mix" },
    pond: { name: "Water pond", words: ["dig", "water"], fx: .37, bonus: "frog", bonusMsg: "Bonus: frogs moved into the pond!" },
    nest: { name: "Nest box", words: ["hang", "nest"], fx: .63, bonus: "bird", bonusMsg: "Bonus: little songbirds use the nest box!" },
    brush: { name: "Brush pile", words: ["brush", "pile"], fx: .54, bonus: "lizard", bonusMsg: "Bonus: a lizard suns itself on the brush pile!" },
    log: { name: "Shade log", words: ["log", "shade"], fx: .46, bonus: "shroom", bonusMsg: "Bonus: mushrooms and beetles love the old log!" },
    hotel: { name: "Insect hotel", words: ["bee", "hotel"], fx: .73, bonus: "bee", bonusMsg: "Bonus: wild bees moved into the insect hotel!" },
    bridge: { name: "Rope bridge", words: ["rope", "tie"], fx: .23 }
  };
  // Wrong picks: `why` null = use the real reason from species.py BIOMES[biome]["not_suitable"]["why"].
  var WRONG = {
    acorns: { name: "Oak acorns", icon: "🌰", why: null },
    grass: { name: "Lawn grass seed", icon: "🌾", why: "Grass is what the cattle pasture already has. We want the forest back!" },
    mango: { name: "Mango seeds", icon: "🥭", why: null },
    hay: { name: "Dry hay bales", icon: "🌾", why: "Dry hay is fire fuel. Never bring it to land that burned!" },
    kudzu: { name: "Kudzu vine", icon: "🍃", why: "Kudzu is a vine from Asia that smothers young trees. It does not belong in the Ozarks." },
    pine: { name: "Pine seeds", icon: "🌲", why: "Pines are not from Kangaroo Island. Seeding them would change the island's forest." },
    oilpalm: { name: "Oil palm", icon: "🌴", why: 0 },
    shorea: { name: "Shorea seeds", icon: "🍂", why: 1 }
  };
  function wrongWhy(id, biome) {
    var w = WRONG[id], ns = (biome.not_suitable && biome.not_suitable.why) || "";
    if (typeof w.why === "string") return w.why;
    if (typeof w.why === "number") { var parts = ns.match(/[^.]+\.(\s|$)/g) || [ns]; return (parts[w.why] || ns).trim(); }
    return ns;
  }

  function drawHelper(c, id, x, t, s, grown) {
    c.save(); c.translate(x, GY + 4); c.scale(s, s);
    if (id === "pond") {
      ell(c, 0, 2, 64, 15); paint(c, "#4fb3e8", 3);
      for (var i = 0; i < 2; i++) { var k = (t * .5 + i * .5) % 1; ell(c, -12 + i * 26, 2, 6 + k * 20, 2 + k * 4); c.strokeStyle = "rgba(255,255,255," + (1 - k) + ")"; c.lineWidth = 2; c.stroke(); }
      [-58, -50, 52, 60].forEach(function (rx, j) { line(c, [rx, 4, rx + Math.sin(t + j) * 2, -18 - j % 2 * 8], "#3f8a3a", 3); });
    } else if (id === "nest") {
      limb(c, [0, 0, 0, -98], "#8a5a35", 5);
      u.rr(c, -17, -134, 34, 38, 4); paint(c, "#c9894a", 3);
      c.beginPath(); c.moveTo(-22, -132); c.lineTo(0, -148); c.lineTo(22, -132); c.closePath(); paint(c, "#8a5a35", 3);
      circ(c, 0, -118, 6); c.fillStyle = "#3a2516"; c.fill();
      line(c, [-6, -106, 6, -106], INK, 3);
    } else if (id === "brush") {
      [[-40, -2, 30, -28], [-30, -30, 38, 0], [-20, -2, 10, -40], [0, -42, 30, -4], [-44, -14, 44, -16], [-12, -36, -36, -6]].forEach(function (b) { limb(c, b, "#8a6038", 4); });
      [[-26, -30], [16, -34], [34, -14], [-6, -44]].forEach(function (p) { ell(c, p[0], p[1], 7, 4, .6); paint(c, "#6aa84f", 1.5); });
    } else if (id === "log") {
      u.rr(c, -50, -28, 96, 28, 13); paint(c, "#8a5a35", 3);
      ell(c, 46, -14, 10, 14); paint(c, "#d9a560", 3);
      ell(c, 46, -14, 5, 7); c.strokeStyle = "#8a5a35"; c.lineWidth = 2; c.stroke();
      ell(c, -18, -27, 16, 4); c.fillStyle = "#6aa84f"; c.fill();
      if (grown) [[-30, -26], [-8, -27], [10, -26]].forEach(function (p, j) {
        line(c, [p[0], p[1], p[0], p[1] - 8], "#f3e6cf", 3);
        c.beginPath(); c.arc(p[0], p[1] - 8, 6 + j % 2, Math.PI, 0); c.closePath(); paint(c, "#e2553f", 1.5);
      });
    } else if (id === "hotel") {
      limb(c, [-16, 0, -16, -30], "#8a5a35", 4); limb(c, [16, 0, 16, -30], "#8a5a35", 4);
      u.rr(c, -26, -96, 52, 66, 4); paint(c, "#c9894a", 3);
      c.beginPath(); c.moveTo(-32, -94); c.lineTo(0, -116); c.lineTo(32, -94); c.closePath(); paint(c, "#8a5a35", 3);
      for (var r = 0; r < 3; r++) for (var q = 0; q < 4; q++) { circ(c, -17 + q * 11.5, -82 + r * 19, 4.5); paint(c, r === 1 ? "#e8c28a" : "#5a3a22", 1.5); }
    } else if (id === "mix") { // a toilet-paper seed roll, as ReSeed uses
      ell(c, 0, -6, 24, 8); paint(c, "#efe6d2", 3);
      c.beginPath(); c.moveTo(-24, -6); c.lineTo(-24, -54); c.lineTo(24, -54); c.lineTo(24, -6); paint(c, "#f6efe0", 0);
      line(c, [-24, -6, -24, -54], INK, 3); line(c, [24, -6, 24, -54], INK, 3);
      ell(c, 0, -54, 24, 8); paint(c, "#d9c9a8", 3);
      [[-8, -56], [6, -53], [0, -58], [12, -57], [-14, -54]].forEach(function (p) { ell(c, p[0], p[1], 3.5, 2.5); c.fillStyle = "#8a5a35"; c.fill(); });
    }
    c.restore();
  }
  function bridgePts() { var x0 = W * .16, x1 = W * .31, y = GY - 196; return { x0: x0, x1: x1, y: y, mx: (x0 + x1) / 2, my: y + 34 }; }
  function drawBridge(c, s, t) {
    var b = bridgePts();
    c.save(); c.globalAlpha = s;
    limb(c, [b.x1, GY, b.x1, b.y - 6], "#8a5a35", 6);
    c.beginPath(); c.moveTo(b.x0, b.y); c.quadraticCurveTo(b.mx, b.my + 34 + Math.sin(t) * 3, b.x1, b.y);
    c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = "#d9b47a"; c.lineWidth = 3.5; c.stroke();
    for (var i = 1; i < 8; i++) {
      var k = i / 8, x = u.lerp(b.x0, b.x1, k), y = (1 - k) * (1 - k) * b.y + 2 * k * (1 - k) * (b.my + 34) + k * k * b.y;
      u.rr(c, x - 7, y - 3, 14, 6, 2); paint(c, "#a8743f", 1.5);
    }
    c.restore();
  }
  /** Small canvas icon for the planner (helper art at small scale). */
  function iconCanvas(size, draw) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), cvs = u.el("canvas", { width: size * dpr, height: size * dpr, style: { width: size + "px", height: size + "px" } });
    var c = cvs.getContext("2d"); c.scale(dpr, dpr); draw(c); return cvs;
  }
  function helperIcon(id, size) {
    return iconCanvas(size, function (c) {
      var sc = size / 150;
      c.save(); c.translate(size / 2, size - 4 - GY * sc); c.scale(sc, sc);
      if (id === "bridge") {
        c.translate(0, GY);
        limb(c, [-50, 0, -50, -110], "#8a5a35", 8); limb(c, [50, 0, 50, -110], "#8a5a35", 8);
        c.beginPath(); c.moveTo(-50, -100); c.quadraticCurveTo(0, -40, 50, -100); c.strokeStyle = INK; c.lineWidth = 9; c.stroke(); c.strokeStyle = "#d9b47a"; c.lineWidth = 5; c.stroke();
      } else {
        var big = { pond: [1.1, 0], nest: [.95, 0], brush: [1.5, 0], log: [1.3, 0], hotel: [1.15, 0], mix: [1.9, 0] }[id] || [1, 0];
        c.translate(0, GY); c.scale(big[0], big[0]); c.translate(0, -GY);
        drawHelper(c, id, 0, 0, 1, true);
      }
      c.restore();
    });
  }
  function animalIcon(name, size) {
    var a = ART[name];
    return iconCanvas(size, function (c) {
      if (!a) return;
      var sc = { canopy: .62, ground: .52, perch: .82, fly: 1.1, hang: .62 }[a.kind] || .7;
      if (name === "echidna") sc = 1; if (name === "capuchin monkey") sc = .95; if (name === "kangaroo" || name === "black bear" || /deer|tapir/.test(name)) sc = .5;
      c.save(); c.translate(size / 2 - 4, a.kind === "hang" ? 6 : size - 4); c.scale(sc * size / 64, sc * size / 64);
      a.draw(c, 0, { ph: 0 }); c.restore();
    });
  }

  /* ------------------------------------------------------------ scenery */
  var LOOKS = {
    amazon: { sky: ["#7fcbf5", "#e3f6ff"], far: "#8cc78a", soil: "#c9b65f", floor: "#4f9a45", tree: "broad", leaf: ["#2f8f46", "#3aa055", "#257a3a"], old: ["#2a7a3d", "#358a4a"], trunk: "#6b4a2e" },
    sierra: { sky: ["#6fb6f2", "#e2f1ff"], far: "#a3b6c9", peaks: true, soil: "#5b4c40", floor: "#6c9a4a", tree: "conifer", leaf: ["#2e6b45", "#3b7d50", "#2a5e3e"], old: ["#2a5a3c", "#356a46"], trunk: "#5b3b28", snags: true },
    ozarks: { sky: ["#8ccaf7", "#eef8ff"], far: "#9ccb8a", soil: "#9b7a4c", floor: "#5a9a46", tree: "round", leaf: ["#3f8f3a", "#55a345", "#4a9a40"], old: ["#3b7f36", "#4a8f40"], trunk: "#6a4a30", logs: true },
    ki: { sky: ["#9ad3fb", "#f2fbff"], far: "#bccf9c", soil: "#4e4036", floor: "#86a865", tree: "euc", leaf: ["#7fa36b", "#8fb57a", "#6f9560"], old: ["#6f955e", "#7da56a"], trunk: "#ece5d3", snags: true },
    borneo: { sky: ["#9fcfe0", "#eef7f2"], far: "#7fb48a", soil: "#b9663b", floor: "#4b8f45", tree: "emergent", leaf: ["#2b7d3f", "#37904f", "#226d36"], old: ["#24703a", "#2e7f44"], trunk: "#7a5a3a", mist: true }
  };
  function crown(c, blobs, col, lw) {
    if (lw) { blobs.forEach(function (b) { ell(c, b[0], b[1], b[2] + lw / 2, (b[3] || b[2]) + lw / 2); c.fillStyle = INK; c.fill(); }); }
    blobs.forEach(function (b) { ell(c, b[0], b[1], b[2], b[3] || b[2]); c.fillStyle = b[4] || col; c.fill(); });
  }
  /** One tree of a biome look, h = height in px (0 = not yet sprouted). */
  function tree(c, lk, x, y, h, seed, t, outline, colIdx) {
    if (h < 2) return;
    var lw = outline ? 5 : 0, leaf = (outline ? lk.leaf : lk.old)[colIdx % 2], dark = lk.leaf[2] || leaf;
    if (h < 30) {
      line(c, [x, y, x, y - h], "#3f8a3a", 3);
      var s = h / 30; ell(c, x - 6 * s, y - h * .75, 7 * s, 3.5 * s, -.5); c.fillStyle = "#5cbf5a"; c.fill();
      ell(c, x + 6 * s, y - h * .9, 7 * s, 3.5 * s, .5); c.fill();
      return;
    }
    var sw = Math.sin(t * .8 + seed) * h * .012, tw = Math.max(3, h * .045);
    function trunk(top, col) {
      c.beginPath(); c.moveTo(x - tw, y); c.lineTo(x - tw * .55 + sw * .5, y - top); c.lineTo(x + tw * .55 + sw * .5, y - top); c.lineTo(x + tw, y); c.closePath();
      c.fillStyle = col || lk.trunk; c.fill(); if (lw) { c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); }
    }
    var X = x + sw;
    switch (lk.tree) {
      case "broad":
        trunk(h * .72);
        crown(c, [[X - h * .17, y - h * .76, h * .19], [X + h * .17, y - h * .74, h * .18], [X, y - h * .88, h * .22], [X - h * .05, y - h * .7, h * .17, 0, dark]], leaf, lw);
        break;
      case "conifer":
        trunk(h * .9);
        for (var i = 0; i < 4; i++) {
          var by = y - h * (.16 + i * .19), bw = h * (.3 - i * .06), top = by - h * .3;
          c.beginPath(); c.moveTo(X - bw, by); c.lineTo(X, top); c.lineTo(X + bw, by); c.closePath();
          c.fillStyle = i % 2 ? leaf : dark; c.fill(); if (lw) { c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); }
        }
        break;
      case "round":
        trunk(h * .6);
        crown(c, [[X - h * .2, y - h * .66, h * .2], [X + h * .2, y - h * .66, h * .2], [X, y - h * .8, h * .24], [X - h * .1, y - h * .55, h * .16, 0, dark], [X + h * .12, y - h * .56, h * .15, 0, dark]], leaf, lw);
        break;
      case "euc":
        trunk(h * .86, lk.trunk);
        limb(c, [x, y - h * .5, x - h * .16 + sw, y - h * .74], lk.trunk, Math.max(2, tw * .5));
        limb(c, [x, y - h * .6, x + h * .15 + sw, y - h * .82], lk.trunk, Math.max(2, tw * .5));
        crown(c, [[X - h * .16, y - h * .78, h * .12, h * .08], [X + h * .15, y - h * .86, h * .12, h * .08], [X, y - h * .95, h * .14, h * .09]], leaf, lw);
        break;
      case "emergent":
        trunk(h * .86);
        if (h > 60) { c.beginPath(); c.moveTo(x - tw * 3, y); c.lineTo(x - tw, y - h * .12); c.lineTo(x + tw, y - h * .12); c.lineTo(x + tw * 3, y); c.closePath(); c.fillStyle = lk.trunk; c.fill(); if (lw) { c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); } }
        crown(c, [[X - h * .16, y - h * .86, h * .2, h * .08], [X + h * .16, y - h * .87, h * .2, h * .08], [X, y - h * .93, h * .24, h * .1], [X, y - h * .82, h * .16, h * .06, dark]], leaf, lw);
        break;
    }
  }
  function droneArt(c, x, y, t) {
    c.save(); c.translate(x, y + Math.sin(t * 3) * 3);
    line(c, [-18, -10, -34, -18], INK, 4); line(c, [18, -10, 34, -18], INK, 4);
    var rw = 14 * Math.abs(Math.cos(t * 40)) + 4;
    ell(c, -34, -21, rw, 3); paint(c, "#cfe9ff", 2); ell(c, 34, -21, rw, 3); paint(c, "#cfe9ff", 2);
    c.beginPath(); c.moveTo(0, -22); c.quadraticCurveTo(-2, -32, 4, -38); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(4, -38); c.bezierCurveTo(10, -48, 24, -45, 26, -40); c.bezierCurveTo(19, -33, 9, -32, 4, -38); paint(c, "#8be07f", 2);
    circ(c, 0, 0, 24); paint(c, "#47b95c", 3);
    u.rr(c, -16, -10, 32, 21, 8); paint(c, "#163042", 2.5);
    c.fillStyle = "#7ff0ff"; circ(c, -7, -1, 3.2); c.fill(); circ(c, 7, -1, 3.2); c.fill();
    c.beginPath(); c.arc(0, 3, 4, .3, Math.PI - .3); c.strokeStyle = "#7ff0ff"; c.lineWidth = 2; c.stroke();
    c.restore();
  }
  function crateArt(c, x, y, chute, wob) {
    c.save(); c.translate(x + Math.sin(wob * 40) * wob * 10, y);
    if (chute) {
      line(c, [-15, -14, -30, -58], INK, 1.5); line(c, [15, -14, 30, -58], INK, 1.5); line(c, [0, -14, 0, -58], INK, 1.5);
      c.beginPath(); c.arc(0, -58, 32, Math.PI, 0); c.closePath(); paint(c, "#ff8fab", 2.5);
      c.beginPath(); c.arc(0, -58, 32, Math.PI * 1.33, Math.PI * 1.66); c.lineTo(0, -58); c.closePath(); c.fillStyle = "#fff"; c.fill();
    }
    u.rr(c, -18, -16, 36, 30, 5); paint(c, "#d9a560", 3);
    line(c, [-18, -1, 18, -1], "#8a5a35", 2); line(c, [0, -16, 0, 14], "#8a5a35", 2);
    c.restore();
  }

  /* ------------------------------------------------------------ the level */
  function patchNdvi(site) {
    var tp = site && (site.target_patch || (site.patches || [])[0]);
    if (tp && tp.recent_peak != null) return { n0: tp.recent_peak, n1: tp.baseline_peak, real: true };
    return { n0: .35, n1: (site && site.ndvi && site.ndvi.baseline_forest_mean) || .85, real: false };
  }

  function biomeLevel(spec) {
    return async function (L) {
      var biome = (DATA.biomes || {})[spec.biome] || { name: spec.biome, animals: [] };
      var site = RQ.site(spec.site), nd = patchNdvi(site), lk = LOOKS[spec.look];
      var hintMode = L.fails >= 1 || (RQ.save.game("g23").stars[L.index] || 0) > 0;
      // the biome's real animals, in species.py order
      var ANIMALS = (biome.animals || []).filter(function (n) { return ART[n] && spec.needs[n]; }).map(function (n, i) {
        var nd2 = spec.needs[n]; return { name: n, art: ART[n], need: nd2[0], year: nd2[1], text: nd2[2], i: i, ph: i * 1.7 };
      });
      function needsOf(h) { return ANIMALS.filter(function (a) { return a.need === h; }); }

      /* layout: scene canvas on top, typing keyboard below (hidden while planning) */
      var root = u.el("div", { class: "fill", style: { display: "flex", flexDirection: "column" } });
      var top = u.el("div", { style: { position: "relative", flex: "1", minHeight: "0" } });
      var bottom = u.el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "6px 8px 10px", background: "var(--c-tint)", borderTop: "3px solid var(--ink)" } });
      var finger = u.el("div", { class: "row", style: { minHeight: "34px", justifyContent: "center", flexWrap: "wrap" } });
      root.appendChild(top); root.appendChild(bottom); L.stage.appendChild(root); bottom.appendChild(finger);
      var kb = RQ.keyboard.mount(bottom, { compact: window.innerHeight < 700 ? "tiny" : window.innerHeight < 820 });
      var hidden = u.el("input", { "aria-label": "typing box", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
        style: { position: "absolute", opacity: "0", width: "1px", height: "1px", left: "0", bottom: "0" } });
      root.appendChild(hidden);
      var cv = L.canvas({ w: 1280, h: H, parent: top, fill: true, label: "regrowing forest", onResize: function (api) { W = api.w; } });
      W = cv.w;
      var ctx = cv.ctx;

      var rng = u.seeded(spec.biome);
      var TREES = [.235, .285, .335, .41, .48, .525, .585, .655, .695, .765].map(function (fx, i) {
        return { fx: fx + (rng() - .5) * .012, born: rng() * 1.8, hmax: (i === 4 || i === 7 ? 240 : 165 + rng() * 55), seed: rng() * 9 };
      });
      var OLD = [];
      for (var ox = .01; ox < .2; ox += .045) OLD.push({ fx: ox + rng() * .01, h: 200 + rng() * 70, seed: rng() * 9, back: OLD.length % 2 });
      for (ox = .81; ox < 1.02; ox += .045) OLD.push({ fx: ox + rng() * .01, h: 200 + rng() * 70, seed: rng() * 9, back: OLD.length % 2 });
      OLD.sort(function (a, b) { return b.back - a.back; });
      var SNAGS = lk.snags ? [.3, .44, .6, .71].map(function (fx) { return { fx: fx, h: 60 + rng() * 60 }; }) : [];

      var S = { year: 0, helpers: {}, seeded: 0, animals: [], visitors: [], bonus: [], parts: [], task: null, busy: false,
        drone: { x: W * .5, y: 84, tx: W * .5 }, sat: -1, keys: 0, good: 0, t0: 0, started: false, wrong: 0, misses: 0, home: 0, missing: [] };

      function treeTop(i) { var tr = TREES[i]; return GY - tr.hmax * grow(S.year - tr.born); }
      function treeH(i) { var tr = TREES[i]; return tr.hmax * grow(S.year - tr.born); }

      /* ---------- drawing */
      function drawWorld(t, dt) {
        var c = ctx, g = grow(S.year);
        var sky = c.createLinearGradient(0, 0, 0, GY); sky.addColorStop(0, lk.sky[0]); sky.addColorStop(1, lk.sky[1]);
        c.fillStyle = sky; c.fillRect(0, 0, W, GY);
        circ(c, W * .3, 62, 30); c.fillStyle = "#ffe27a"; c.fill();
        for (var k = 0; k < 4; k++) {
          var cx = ((k * 420 + t * (8 + k * 3)) % (W + 300)) - 150, cy = 50 + k * 26;
          c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.arc(cx, cy, 20, 0, 7); c.arc(cx + 24, cy - 9, 26, 0, 7); c.arc(cx + 52, cy, 19, 0, 7); c.fill();
        }
        // far hills or peaks
        c.fillStyle = lk.far; c.beginPath(); c.moveTo(0, GY);
        for (var hx = 0; hx <= W + 40; hx += 40) c.lineTo(hx, GY - (lk.peaks ? 150 + Math.abs(((hx / 260) % 2) - 1) * 110 : 120 + Math.sin(hx / 170) * 30));
        c.lineTo(W, GY); c.fill();
        if (lk.peaks) { c.fillStyle = "#fff"; for (var px = 130; px < W; px += 520) { c.beginPath(); c.moveTo(px - 36, GY - 230); c.lineTo(px, GY - 260); c.lineTo(px + 36, GY - 230); c.lineTo(px + 14, GY - 236); c.lineTo(px, GY - 226); c.closePath(); c.fill(); } }
        // old forest on both sides
        OLD.forEach(function (o, i) { tree(c, lk, o.fx * W, GY + 2, o.h * (o.back ? .9 : 1), o.seed, t, false, i); });
        if (lk.mist) { c.fillStyle = "rgba(255,255,255,.25)"; c.fillRect(0, GY - 190, W, 60); }
        // ground: the patch greens up as the canopy closes
        c.fillStyle = lk.floor; c.fillRect(0, GY, W, H - GY);
        var p0 = W * .2, p1 = W * .8;
        c.fillStyle = mixColor(lk.soil, lk.floor, g * 1.1);
        c.beginPath(); c.moveTo(p0 - 30, GY); c.quadraticCurveTo(p0, GY - 6, p0 + 30, GY - 4); c.lineTo(p1 - 30, GY - 4); c.quadraticCurveTo(p1, GY - 6, p1 + 30, GY); c.lineTo(p1 + 50, H); c.lineTo(p0 - 50, H); c.closePath(); c.fill();
        c.fillStyle = "rgba(0,0,0,.08)"; for (var r = 0; r < 3; r++) c.fillRect(0, GY + 20 + r * 20, W, 5);
        // burned snags and seeds on the ground
        SNAGS.forEach(function (s) { limb(c, [s.fx * W, GY, s.fx * W + 3, GY - s.h], "#2b2420", 5); limb(c, [s.fx * W + 2, GY - s.h * .6, s.fx * W + 16, GY - s.h * .75], "#2b2420", 3); });
        if (S.seeded) TREES.forEach(function (tr) { if (treeH(TREES.indexOf(tr)) < 2) { ell(c, tr.fx * W, GY + 3, 3, 2); c.fillStyle = "#6b4423"; c.fill(); } });
        // helpers behind the young trees (nest box pole, hotel), then trees, then ground helpers
        if (S.helpers.bridge) drawBridge(c, Math.min(1, S.helpers.bridge), t);
        TREES.forEach(function (tr, i) { tree(c, lk, tr.fx * W, GY + 3, treeH(i), tr.seed, t, true, i); });
        ["nest", "hotel", "pond", "log", "brush"].forEach(function (id) { if (S.helpers[id]) drawHelper(c, id, HELPERS[id].fx * W, t, u.ease.outBack(Math.min(1, S.helpers[id])), S.year >= 3); });
        for (var id in S.helpers) if (S.helpers[id] < 1) S.helpers[id] = Math.min(1, S.helpers[id] + dt * 2.5);
        // critters and animals
        S.bonus.forEach(function (b) { c.save(); c.translate(b.x(), b.y(t)); if (b.flip) c.scale(-1, 1); b.draw(c, t, b); c.restore(); });
        S.animals.concat(S.visitors).forEach(function (a) { drawAnimal(c, a, t, dt); });
        // satellite pass (ReSeed checks NDVI again from space)
        if (S.sat >= 0) {
          S.sat += dt / 2.2; var sx = u.lerp(-60, W + 60, S.sat), sy = 36 + Math.sin(S.sat * 3) * 4;
          c.fillStyle = "rgba(127,240,255,.18)"; c.beginPath(); c.moveTo(sx - 6, sy); c.lineTo(sx - 70, GY); c.lineTo(sx + 70, GY); c.lineTo(sx + 6, sy); c.fill();
          c.save(); c.translate(sx, sy); c.fillStyle = "#4b6fa8"; c.fillRect(-30, -6, 20, 12); c.fillRect(10, -6, 20, 12); c.lineWidth = 2; c.strokeStyle = INK; c.strokeRect(-30, -6, 20, 12); c.strokeRect(10, -6, 20, 12);
          u.rr(c, -10, -9, 20, 18, 4); paint(c, "#e6e9ee", 2); c.restore();
          if (S.sat > 1) S.sat = -1;
        }
        // particles
        S.parts = S.parts.filter(function (p) {
          p.life -= dt; p.vy += (p.g == null ? 500 : p.g) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          c.globalAlpha = Math.max(0, Math.min(1, p.life / .6)); c.fillStyle = p.c;
          if (p.heart) { c.font = "22px sans-serif"; c.textAlign = "center"; c.fillText("💚", p.x, p.y); } else { ell(c, p.x, p.y, p.r || 5, (p.r || 5) * .6, p.x); c.fill(); }
          c.globalAlpha = 1; return p.life > 0;
        });
        // drone
        var d = S.drone; d.x += (d.tx - d.x) * Math.min(1, dt * 3);
        droneArt(c, d.x, d.y, t);
        drawTask(c, t, dt);
        drawPanels(c);
      }
      function drawAnimal(c, a, t, dt) {
        if (a.t < 1) a.t = Math.min(1, a.t + dt / a.dur);
        var home = a.spot(), k = u.ease.inOut(a.t), from = a.from;
        var x = u.lerp(from.x, home.x, k), y = u.lerp(from.y, home.y, k) - (a.art.kind === "perch" || a.art.kind === "fly" ? Math.sin(k * Math.PI) * 60 : 0);
        if (a.leave) { a.lt = (a.lt || 0) + dt / 1.6; x = u.lerp(home.x, from.x, u.ease.inOut(Math.min(1, a.lt))); }
        if (a.happy > 0) { a.happy -= dt; y -= Math.abs(Math.sin(a.happy * 9)) * 14; }
        var moving = (a.t < 1 || (a.leave && a.lt < 1));
        var flip = a.leave ? from.x > home.x : from.x > home.x && a.t < 1;
        if (a.art.kind === "fly") { x += Math.sin(t * 1.3 + a.ph) * 26; y += Math.cos(t * 1.7 + a.ph) * 14; }
        c.save(); c.translate(x, y); if (flip) c.scale(-1, 1);
        a.art.draw(c, t, { walk: moving, ph: a.ph });
        c.restore();
        a.x = x; a.y = y;
        if (a.visitor && a.t >= 1 && !a.leave) { // thought bubble: what was missing
          c.save(); c.font = "600 22px Fredoka, sans-serif"; var txt = "No " + HELPERS[a.need].name.toLowerCase() + "?", tw = c.measureText(txt).width;
          var bx = u.clamp(x - tw / 2 - 12, 8, W - tw - 32), by = y - 140;
          u.rr(c, bx, by, tw + 24, 38, 16); paint(c, "#fff", 3); c.fillStyle = INK; c.textBaseline = "middle"; c.fillText(txt, bx + 12, by + 20); c.restore();
        }
      }
      function labelBox(c, x, y, word, pos, cap, wob, avoidChart) {
        c.save(); c.textBaseline = "middle"; c.textAlign = "left";
        c.font = "700 40px Fredoka, sans-serif";
        var tw = c.measureText(word).width, bw = tw + 34, bh = 58;
        c.font = "600 24px Fredoka, sans-serif"; var cw = cap ? c.measureText(cap).width + 24 : 0;
        var full = Math.max(bw, cw), maxX = avoidChart && y < 190 ? W - 300 : W - 10;
        var x0 = u.clamp(x - bw / 2, 10 + (full - bw) / 2, maxX - bw - (full - bw) / 2) + Math.sin(wob * 40) * wob * 10, y0 = y - bh / 2;
        if (cap) { u.rr(c, x0 + bw / 2 - cw / 2, y0 - 36, cw, 32, 12); paint(c, "#fffdf7", 2.5); c.fillStyle = INK; c.fillText(cap, x0 + bw / 2 - cw / 2 + 12, y0 - 19); }
        u.rr(c, x0, y0, bw, bh, 16); paint(c, "#fff", 4);
        c.font = "700 40px Fredoka, sans-serif";
        var cx = x0 + 17;
        for (var i = 0; i < word.length; i++) {
          var cw2 = c.measureText(word[i]).width;
          if (i === pos) { u.rr(c, cx - 2, y0 + 8, cw2 + 4, bh - 16, 7); c.fillStyle = "#ffe36e"; c.fill(); }
          c.fillStyle = i < pos ? "#2f9e4f" : INK; c.fillText(word[i], cx, y0 + bh / 2 + 2); cx += cw2;
        }
        c.restore();
        return { x: x0, y: y0, w: bw, h: bh };
      }
      function drawTask(c, t, dt) {
        var tk = S.task; if (!tk) return;
        tk.wob = Math.max(0, (tk.wob || 0) - dt);
        if (tk.kind === "crate") {
          if (tk.dropping) { tk.y = Math.min(GY - 14, tk.y + 520 * dt); }
          else if (tk.falling && !S.busy) {
            tk.y += tk.vy * dt;
            if (tk.y >= GY - 14) { // bonk: Sprout winches the crate back up
              S.misses++; RQ.audio.sfx("drop"); burst(tk.x, GY - 10, "#d9a560", 8); tk.y = S.drone.y + 50;
              L.toast("Bonk! Sprout pulls the crate back up. Try again!", "info", 1600);
            }
          }
          var hang = !tk.falling && !tk.dropping;
          if (hang) line(c, [S.drone.x, S.drone.y + 18, tk.x, tk.y - 16], INK, 2);
          crateArt(c, tk.x, tk.y, !hang && !tk.done, tk.wob);
          if (!tk.done) {
            var side = tk.x + 46 + 120 > W - 300 ? -1 : 1;
            labelBox(c, tk.x + side * (40 + 18 * tk.word.length), tk.y, tk.word, tk.pos, tk.cap, tk.wob, true);
          }
        } else if (!tk.done) {
          var ax = tk.ax ? tk.ax() : W / 2, ay = tk.ay ? tk.ay() : 150;
          var bx = u.clamp(ax, 180, W - 320), by = Math.max(96, Math.min(150, ay - 80));
          var r = labelBox(c, bx, by, tk.word, tk.pos, tk.cap, tk.wob, true);
          if (tk.ax) { c.save(); c.setLineDash([6, 6]); line(c, [r.x + r.w / 2, r.y + r.h, ax, ay - 12], "#ffffff", 3); c.restore(); }
        }
      }
      function drawPanels(c) {
        // year badge
        var yi = Math.round(S.year), hl = health(ndviAt(S.year));
        c.save(); c.textBaseline = "middle"; c.textAlign = "left";
        u.rr(c, 14, 14, 224, 84, 16); paint(c, "rgba(255,253,247,.94)", 3);
        c.fillStyle = INK; c.font = "700 34px Fredoka, sans-serif"; c.fillText(yi ? "Year +" + yi : "Planting day", 28, 42);
        c.font = "600 22px Fredoka, sans-serif"; c.fillStyle = "#4a5b6d"; c.fillText((YEAR0 + yi) + " · " + (S.seeded ? hl.label : "bare patch"), 28, 76);
        // NDVI chart
        var w = 272, h = 156, x0 = W - w - 14, y0 = 14, px = x0 + 46, py = y0 + 40, pw = w - 62, ph = h - 70;
        u.rr(c, x0, y0, w, h, 16); paint(c, "rgba(255,253,247,.94)", 3);
        var nv = ndviAt(S.year);
        c.fillStyle = INK; c.font = "700 22px Fredoka, sans-serif"; c.fillText("NDVI", x0 + 14, y0 + 22);
        c.textAlign = "right"; c.fillStyle = "#2f9e4f"; c.fillText(nv.toFixed(2), x0 + w - 14, y0 + 22);
        function Y(v) { return py + ph - u.clamp((v - .3) / .7, 0, 1) * ph; } function X(yy) { return px + yy / YEARS * pw; }
        c.lineWidth = 2; c.strokeStyle = "#c9d2dc"; c.beginPath(); c.moveTo(px, py); c.lineTo(px, py + ph); c.lineTo(px + pw, py + ph); c.stroke();
        c.setLineDash([5, 5]); c.strokeStyle = "#2f9e4f"; c.beginPath(); c.moveTo(px, Y(.6)); c.lineTo(px + pw, Y(.6)); c.stroke(); c.setLineDash([]);
        c.font = "600 18px Fredoka, sans-serif"; c.fillStyle = "#4a5b6d"; c.textAlign = "right";
        c.fillText("0.6", px - 6, Y(.6)); c.fillText("0.3", px - 6, py + ph);
        c.textAlign = "left"; c.fillText("0", px - 4, py + ph + 16); c.textAlign = "right"; c.fillText("15 years", px + pw, py + ph + 16);
        c.beginPath(); for (var yy = 0; yy <= S.year + 1e-6; yy += .25) { var vv = ndviAt(Math.min(yy, S.year)); if (yy === 0) c.moveTo(X(yy), Y(vv)); else c.lineTo(X(yy), Y(vv)); }
        c.lineTo(X(S.year), Y(nv)); c.strokeStyle = "#2f9e4f"; c.lineWidth = 4; c.lineJoin = "round"; c.stroke();
        circ(c, X(S.year), Y(nv), 6); paint(c, "#ffd23f", 2.5);
        c.restore();
      }
      function ndviAt(y) { return nd.n0 + (nd.n1 - nd.n0) * grow(y); }
      function burst(x, y, col, n) { for (var i = 0; i < (n || 14); i++) S.parts.push({ x: x, y: y, vx: u.rand(-170, 170), vy: u.rand(-280, -60), life: .8, c: col || "#8be07f" }); }
      function hearts(x, y) { for (var i = 0; i < 5; i++) S.parts.push({ x: x + u.rand(-20, 20), y: y, vx: u.rand(-30, 30), vy: u.rand(-90, -50), g: 0, life: 1.4, heart: true }); }

      L.loop(function (dt, t) { drawWorld(t, dt); });
      // read-only hook for automated play tests (tools/ and /tmp scripts); never used by the game itself
      window.__regrowDebug = { task: function () { return S.task && !S.task.done ? { word: S.task.word, pos: S.task.pos, kind: S.task.kind } : null; }, year: function () { return S.year; }, home: function () { return S.home; } };

      /* ---------- typing (same feel as Key Garden: finger hints on the on-screen keyboard) */
      function showFinger(ch) {
        var info = kb.highlight(ch); finger.innerHTML = "";
        if (!info) return;
        finger.appendChild(u.el("span", { class: "chip", style: { background: RQ.keyboard.FINGERS[info.finger] }, html: "👉 Use your <b>" + RQ.keyboard.FINGER_NAMES[info.finger] + "</b>" }));
      }
      function hud() {
        var mins = Math.max((performance.now() - S.t0) / 60000, 1 / 60);
        L.hud.set("animals", "🐾 " + S.home + " / " + ANIMALS.length);
        L.hud.set("acc", "🎯 " + (S.keys ? Math.round(100 * S.good / S.keys) : 100) + "%");
        L.hud.set("wpm", "⚡ " + (S.started ? Math.round(S.good / 5 / mins) : 0) + " WPM");
      }
      function typeWord(tk) {
        return new Promise(function (resolve) { tk.pos = 0; tk.resolve = resolve; S.task = tk; showFinger(tk.word[0]); });
      }
      function onChar(ch) {
        var tk = S.task;
        if (!tk || tk.done || S.busy || !L.alive) return;
        if (!S.started) { S.started = true; S.t0 = performance.now(); }
        S.keys++;
        var want = tk.word[tk.pos];
        if (ch.toLowerCase() === want) {
          S.good++; RQ.audio.sfx("key"); kb.flash(want, true); tk.pos++;
          if (tk.pos >= tk.word.length) { tk.done = true; showFinger(null); RQ.audio.sfx("pop"); tk.resolve(); }
          else showFinger(tk.word[tk.pos]);
        } else { RQ.audio.sfx("error"); kb.flash(ch, false); tk.wob = .35; }
        hud();
      }
      var mode = "plan";
      L.on(window, "keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.querySelector(".rq-overlay, .rq-talk")) return;
        if (mode === "plan") { if (planKey) planKey(e); return; }
        if (e.key.length !== 1) return;
        e.preventDefault(); if (e.key !== " ") onChar(e.key);
      });
      L.on(hidden, "input", function () { var v = hidden.value; hidden.value = ""; if (v && mode === "type") onChar(v.slice(-1)); });
      L.on(top, "pointerdown", function () { if (mode === "type") hidden.focus(); });

      /* ---------- 1. plan: choose habitat helpers */
      var planKey = null;
      function plan() {
        return new Promise(function (resolve) {
          var picked = [], wrapEl = u.el("div", { class: "rr-plan" }), card = u.el("div", { class: "rr-card" });
          wrapEl.appendChild(card); root.appendChild(wrapEl);
          var code = site && site.verdict && site.verdict.code;
          var sub = spec.where + (nd.real ? " · NDVI now " + nd.n0.toFixed(2) + ", before " + nd.n1.toFixed(2) : "") +
            (code === "SEASONAL" ? " · practice gap (game version): ReSeed says this forest is only bare in winter"
              : code === "RECOVERING" ? " · game version: ReSeed says RECOVERING (growing back), so it would watch, not plant" : "");
          card.appendChild(u.el("div", { class: "rr-head" }, u.el("h2", { text: biome.name }), u.el("span", { class: "muted", text: sub })));
          card.appendChild(u.el("div", { class: "rr-label", html: "🐾 Who lived here? Read what each one needs." }));
          var row = u.el("div", { class: "rr-animals" });
          ANIMALS.forEach(function (a) {
            row.appendChild(u.el("div", { class: "rr-animal" }, animalIcon(a.name, 60),
              u.el("div", {}, u.el("b", { text: a.name }), u.el("span", { text: a.text }),
                hintMode ? u.el("div", { class: "need", text: "needs: " + HELPERS[a.need].name }) : null)));
          });
          card.appendChild(row);
          card.appendChild(u.el("div", { class: "rr-label", html: "🚁 Load " + spec.slots + " helpers on the drone <span class='muted'>(tap, or press 1–" + spec.options.length + ")</span>" }));
          var grid = u.el("div", { class: "rr-helpers" }), btns = {};
          spec.options.forEach(function (id, k) {
            var isW = !!WRONG[id], nm = isW ? WRONG[id].name : HELPERS[id].name;
            var ico = u.el("div", { class: "ico" }, isW ? WRONG[id].icon : helperIcon(id, 48));
            var b = u.el("button", { class: "rr-helper", "aria-label": nm, onclick: function () { pick(id); } }, ico, u.el("span", { text: nm }), u.el("span", { class: "k", text: String(k + 1) }));
            btns[id] = b; grid.appendChild(b);
          });
          card.appendChild(grid);
          var slots = u.el("div", { class: "rr-slots" });
          var go = u.el("button", { class: "btn go big", disabled: true, html: "🚁 Fly!", onclick: function () { launch(); } });
          card.appendChild(u.el("div", { class: "rr-row" }, slots, go));
          var msg = u.el("div", { class: "rr-msg" });
          card.appendChild(msg);
          function say(who, text, kind) {
            msg.className = "rr-msg " + (kind || ""); msg.innerHTML = "";
            msg.appendChild(u.el("div", { class: "who", html: RQ.chars.svg(who, { mood: kind === "bad" ? "sad" : "happy" }) }));
            msg.appendChild(u.el("p", { html: RQ.ui.md(text) }));
          }
          function render() {
            slots.innerHTML = "";
            slots.appendChild(u.el("div", { class: "rr-slot full lock", title: "Always loaded" }, helperIcon("mix", 40), u.el("span", { text: "Native seeds 🔒" })));
            for (var i = 0; i < spec.slots; i++) {
              var id = picked[i];
              slots.appendChild(id ? u.el("button", { class: "rr-slot full", title: "Tap to unload", onclick: (function (x) { return function () { pick(x); }; })(id) }, helperIcon(id, 40), u.el("span", { text: HELPERS[id].name }))
                : u.el("div", { class: "rr-slot", text: "empty slot" }));
            }
            spec.options.forEach(function (id) { btns[id].classList.toggle("on", picked.indexOf(id) >= 0); });
            go.disabled = picked.length < spec.slots;
          }
          function pick(id) {
            if (btns[id].classList.contains("nope")) return;
            if (WRONG[id]) {
              S.wrong++; RQ.audio.sfx("bad"); btns[id].classList.add("nope", "shake");
              say("koa", "**" + WRONG[id].name + "?** " + wrongWhy(id, biome), "bad");
              return;
            }
            var at = picked.indexOf(id);
            if (at >= 0) { picked.splice(at, 1); RQ.audio.sfx("click"); say("koa", "Unloaded the **" + HELPERS[id].name + "**."); }
            else if (picked.length >= spec.slots) { RQ.audio.sfx("error"); say("koa", "The drone is full. Tap a slot to unload something first."); }
            else {
              picked.push(id); RQ.audio.sfx("pop");
              say("koa", picked.length < spec.slots ? "Loaded the **" + HELPERS[id].name + "**. Who needs it?" : "The drone is full. Press **Fly!** when you are sure.", "good");
            }
            render();
          }
          function launch() {
            if (picked.length < spec.slots) return;
            RQ.audio.sfx("whoosh"); planKey = null; wrapEl.remove(); resolve(picked.slice());
          }
          planKey = function (e) {
            var n = parseInt(e.key, 10);
            if (n >= 1 && n <= spec.options.length) { e.preventDefault(); pick(spec.options[n - 1]); }
            else if (e.key === "Enter") { e.preventDefault(); launch(); }
            else if (e.key === "Backspace" && picked.length) { e.preventDefault(); pick(picked[picked.length - 1]); }
          };
          say("koa", hintMode ? "💡 Match each animal's need to a helper. The green words show what they need." : "Tap a helper to load it. Some do not belong here!");
          render();
        });
      }

      var chosen = await plan();
      if (!L.alive) return;
      mode = "type"; hidden.focus();
      hud();
      var falling = spec.mode === "fall";

      /* ---------- 2. deliver: one crate per word */
      async function deliver(id, word, x, cap) {
        S.drone.tx = x; await L.wait(500); if (!L.alive) return;
        var tk = { kind: "crate", word: word, cap: cap, x: x, y: S.drone.y + 54, falling: falling, vy: spec.fall || 0 };
        await typeWord(tk); if (!L.alive) return;
        tk.dropping = true; tk.falling = false;
        while (tk.y < GY - 15) { await L.wait(30); if (!L.alive) return; }
        RQ.audio.sfx("bloom"); burst(x, GY - 10, id === "mix" ? "#8a5a35" : "#8be07f", 16);
        S.task = null;
        if (id === "mix") { S.seeded = 1; for (var i = 0; i < 10; i++) S.parts.push({ x: x + u.rand(-120, 120), y: GY - u.rand(60, 120), vx: 0, vy: 40, life: .7, c: "#6b4423", r: 3 }); }
        else if (S.helpers[id] == null) S.helpers[id] = 0.01;
      }
      var mixW = spec.mix;
      for (var m = 0; m < mixW.length; m++) {
        await deliver("mix", mixW[m], W * [.3, .5, .7][m % 3], "🌱 Native seeds: " + mixW[m]);
        if (!L.alive) return;
      }
      for (var h = 0; h < chosen.length; h++) {
        var hid = chosen[h], hx = hid === "bridge" ? bridgePts().mx : HELPERS[hid].fx * W;
        for (var w2 = 0; w2 < HELPERS[hid].words.length; w2++) {
          await deliver(hid, HELPERS[hid].words[w2], hx, HELPERS[hid].name);
          if (!L.alive) return;
          if (w2 === 0 && hid !== "bridge" && S.helpers[hid] != null) S.helpers[hid] = .02; // half built after the first word
        }
        if (hid === "bridge" && S.helpers.bridge == null) S.helpers.bridge = .02;
      }
      S.drone.tx = W * .5;

      /* ---------- 3. the years fly by */
      var used = {};
      function spotFor(a) {
        var k = a.art.kind, b;
        if (k === "hang") { return function () { b = bridgePts(); return { x: b.mx, y: b.my + 20 }; }; }
        if (a.need === "nest") return function () { return { x: HELPERS.nest.fx * W + (k === "ground" ? 0 : 4), y: GY - 140 }; };
        if (a.need !== "mix" && k === "ground") return function () { var hx2 = HELPERS[a.need].fx * W; return { x: hx2 + (a.need === "pond" ? 84 : 70), y: GY + 14 }; };
        if (k === "canopy") { var ti = used.c4 ? 7 : 4; used["c" + ti] = 1; return function () { return { x: TREES[ti].fx * W + 6, y: GY - treeH(ti) * .62 }; }; }
        if (k === "perch") { var pi = [1, 5, 8, 2, 6].filter(function (i) { return !used["p" + i]; })[0]; used["p" + pi] = 1; return function () { return { x: TREES[pi].fx * W, y: treeTop(pi) + 6 }; }; }
        if (k === "fly") return function () { return { x: TREES[6].fx * W - 40, y: GY - 110 }; };
        var gx = [.68, .76, .3, .6].filter(function (f) { return !used["g" + f]; })[0]; used["g" + gx] = 1;
        return function () { return { x: gx * W, y: GY + 14 }; };
      }
      function fromFor(a, spot) {
        var k = a.art.kind, s = spot();
        if (k === "perch" || k === "fly") return { x: s.x < W / 2 ? -60 : W + 60, y: 80 };
        if (k === "canopy" || k === "hang") return { x: W * .1, y: GY - 150 };
        return { x: W + 80, y: GY + 14 };
      }
      function addBonus(id) {
        var hx3 = function () { return HELPERS[id].fx * W; };
        if (id === "pond") [-40, 46].forEach(function (dx, i) { S.bonus.push({ x: function () { return hx3() + dx; }, y: function () { return GY + 8; }, draw: frog, ph: i * 2, flip: dx < 0 }); });
        if (id === "hotel") [0, 1, 2].forEach(function (i) { S.bonus.push({ x: function () { return hx3() + Math.sin(performance.now() / 700 + i * 2) * 50; }, y: function (t) { return GY - 80 + Math.cos(t * 1.3 + i) * 30; }, draw: bee, ph: i }); });
        if (id === "nest") S.bonus.push({ x: function () { return hx3() + 4; }, y: function () { return GY - 140; }, draw: function (c, t) { c.scale(.7, .7); bird(c, t, { body: "#8a6a4a", chest: "#f0a86a", tail: 12 }); }, ph: 0 });
        if (id === "brush") S.bonus.push({ x: function () { return hx3() + 4; }, y: function () { return GY - 34; }, draw: lizard, ph: 0 });
      }

      for (var step = 0; step < GROW_WORDS.length; step++) {
        if (spec.tutorial && step === 0) { await L.say("sprout", "Now type the growing word to jump **3 years** ahead. Watch the NDVI chart climb!"); if (!L.alive) return; }
        await typeWord({ kind: "year", word: GROW_WORDS[step], cap: "⏩ Grow 3 years" });
        if (!L.alive) return;
        S.task = null; S.busy = true; S.sat = 0; RQ.audio.sfx("whoosh");
        var y0 = S.year, y1 = Math.min(YEARS, y0 + STEP), tStart = performance.now();
        while (true) {
          var k2 = Math.min(1, (performance.now() - tStart) / 2200);
          S.year = u.lerp(y0, y1, u.ease.inOut(k2)); hud();
          if (k2 >= 1) break;
          await L.wait(30); if (!L.alive) return;
        }
        S.busy = false; RQ.audio.sfx("bloom");
        if (step === 0) chosen.forEach(function (id) { if (!needsOf(id).length && HELPERS[id].bonus) { addBonus(id); L.toast(HELPERS[id].bonusMsg, "good", 2200); } });
        // who comes home this time?
        var arrivals = ANIMALS.filter(function (a) { return !a.done && a.year <= S.year; });
        for (var q = 0; q < arrivals.length; q++) {
          var a = arrivals[q]; a.done = true;
          var ok = a.need === "mix" || chosen.indexOf(a.need) >= 0;
          var spot = spotFor(a);
          if (!ok) { // the animal visits, finds no habitat, and moves on
            var v = { name: a.name, art: a.art, need: a.need, ph: a.ph, t: 0, dur: 1.6, visitor: true, spot: function () { return { x: W - 330, y: GY + 14 }; } };
            if (a.art.kind === "perch") v.spot = function () { return { x: W * .84, y: 330 }; };
            v.from = { x: W + 90, y: v.spot().y };
            S.visitors.push(v); S.missing.push(a); RQ.audio.sfx("bad");
            L.toast("The " + a.name + " needed a " + HELPERS[a.need].name.toLowerCase() + "...", "bad", 2400);
            await L.wait(2600); if (!L.alive) return;
            v.leave = true; await L.wait(1200); if (!L.alive) return;
            continue;
          }
          var an = { name: a.name, art: a.art, need: a.need, ph: a.ph, t: 0, dur: 1.8, spot: spot, happy: 0 };
          an.from = fromFor(a, spot);
          S.animals.push(an); RQ.audio.sfx(a.art.kind === "perch" ? "chirp" : "pop");
          await L.wait(1900); if (!L.alive) return;
          if (spec.tutorial && !S.welcomed) { S.welcomed = 1; await L.say("koa", "An animal came home! Type its name to say welcome."); if (!L.alive) return; }
          await typeWord({ kind: "welcome", word: a.art.word, cap: "👋 Welcome home!", ax: function () { return an.x || W / 2; }, ay: function () { return (an.y || GY) - 60; } });
          if (!L.alive) return;
          S.task = null; S.home++; an.happy = 1; hearts(an.x, an.y - 70); RQ.audio.sfx("good"); hud();
          await L.wait(500); if (!L.alive) return;
        }
      }

      /* ---------- finale: satellite check */
      S.sat = 0; RQ.audio.sfx("powerup");
      S.animals.forEach(function (an) { an.happy = 1.5; });
      L.toast("🛰️ NDVI check (game version): " + ndviAt(YEARS).toFixed(2) + ", " + health(ndviAt(YEARS)).label + "!", "good", 2600);
      await L.wait(2400); if (!L.alive) return;
      if (spec.tutorial) { await L.say("tuki", "A satellite checks the **NDVI** again every year. In our game version, look how it climbed!"); if (!L.alive) return; }

      var mins = Math.max((performance.now() - S.t0) / 60000, 1 / 60), acc = S.keys ? Math.round(100 * S.good / S.keys) : 100, wpm = Math.round(S.good / 5 / mins);
      var st = RQ.save.load();
      if (wpm > (st.typing.best_wpm || 0) && acc >= 80) st.typing.best_wpm = wpm;
      if (acc > (st.typing.best_acc || 0)) st.typing.best_acc = acc;
      RQ.save.write();
      var allHome = S.missing.length === 0;
      var stars = 1 + (allHome ? 1 : 0) + (acc >= 90 && S.wrong === 0 ? 1 : 0);
      var msg = "Game version: NDVI **" + nd.n0.toFixed(2) + " → " + ndviAt(YEARS).toFixed(2) + "** in 15 years. " + S.home + " of " + ANIMALS.length + " animals came home!";
      if (!allHome) msg += " Next time, think about the " + S.missing.map(function (a) { return a.name; }).join(" and ") + ".";
      var stats = { "Animals home": S.home + " / " + ANIMALS.length, "Accuracy": acc + "%", "Speed": wpm + " WPM", "Wrong picks": String(S.wrong) };
      if (falling) stats["Bonks"] = String(S.misses);
      L.win({ stars: stars, msg: msg, stats: stats });
    };
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g23",
    music: "forest",
    intro: [
      ["koa", "Planting seeds is only the start. A forest also needs its animals back!"],
      ["sprout", "We pick helpers, type fast, and watch the years fly by. Let's go!"]
    ],
    outro: [
      ["koa", "Five forests are growing back, and their animals are home!"],
      ["tuki", "ReSeed keeps checking the NDVI from space every year. Greener leaves are a good clue, but not proof the forest is back!"]
    ],
    levels: [
      { title: "Amazon", goal: "Load the right helpers, then type to deliver them",
        intro: [["koa", "In our game, the seeds are planted in **Rondônia**. Now the animals need help to come home!"],
                ["sprout", "Read what each animal needs, then load the right **habitat helpers** on my drone."]],
        cards: ["rr-biome-animals", "rr-regrow-monitor"],
        play: biomeLevel({ biome: "tropical_moist_forest", site: "rondonia", look: "amazon", mode: "stay", slots: 2, tutorial: true,
          where: "Jaci-Paraná, Rondônia (Brazil)", mix: ["parica", "balsa", "mutamba"],
          needs: { "toucan": ["mix", 3, "Eats fruit from tall trees."], "scarlet macaw": ["nest", 6, "Nests in big tree holes. Young trees have none!"],
            "capuchin monkey": ["mix", 9, "Eats fruit high up in the trees."], "blue morpho butterfly": ["mix", 6, "Sips juice from fallen fruit."],
            "tapir": ["pond", 6, "Loves to wallow in water and mud."] },
          options: ["nest", "hotel", "pond", "acorns", "log", "grass"] }) },
      { title: "Sierra Nevada", goal: "A burn scar needs care: choose wisely",
        intro: [["koa", "The **Dixie Fire** burned these Sierra Nevada slopes. Pine, cedar and black oak seeds are ready."],
                ["koa", "Be careful what you bring to land burned by fire!"]],
        cards: ["rr-habitat"],
        play: biomeLevel({ biome: "sierra_mixed_conifer", site: "dixie", look: "sierra", mode: "stay", slots: 2,
          where: "Dixie Fire scar, Plumas National Forest (California)", mix: ["pine", "oak", "cedar"],
          needs: { "mule deer": ["brush", 6, "Hides its fawns in thick brush."], "Steller's jay": ["mix", 3, "Eats black oak acorns."],
            "western gray squirrel": ["mix", 6, "Eats pine seeds and acorns."], "acorn woodpecker": ["mix", 9, "Stores acorns in tree bark."],
            "black bear": ["pond", 12, "Needs water to drink and cool off."] },
          options: ["hotel", "pond", "hay", "brush", "mango", "nest"] }) },
      { title: "Ozarks", goal: "Type each word before its crate lands",
        intro: [["hoot", "Our Ozarks forest was only bare for winter. But here a storm knocked trees down, so we help the gap."],
                ["koa", "New trick: the crates float down. Type the word before a crate lands!"]],
        cards: ["rr-seed-dispersers"],
        play: biomeLevel({ biome: "oak_hickory", site: "ozarks", look: "ozarks", mode: "fall", fall: 19, slots: 2,
          where: "Mark Twain National Forest, Ozarks (Missouri)", mix: ["oak", "hickory"],
          needs: { "white-tailed deer": ["mix", 6, "Eats acorns all winter."], "wild turkey": ["brush", 6, "Its chicks hide from foxes in brush."],
            "eastern gray squirrel": ["nest", 9, "Raises babies in a tree hole or a nest box."], "blue jay": ["mix", 3, "Buries acorns and forgets some!"] },
          options: ["pond", "kudzu", "nest", "hotel", "brush", "mango"] }) },
      { title: "Kangaroo Island", goal: "Four animals, four needs",
        intro: [["koa", "G'day! This is my home, **Kangaroo Island**. Most trees grew back after the fire, and in our game we help one small patch that didn't."],
                ["koa", "Four animals need different things. Read carefully!"]],
        cards: ["rr-s-curve"],
        play: biomeLevel({ biome: "southern_eucalypt", site: "kangaroo", look: "ki", mode: "fall", fall: 23, slots: 3,
          where: "Flinders Chase, Kangaroo Island (Australia)", mix: ["mallee", "sheoak", "wattle"],
          needs: { "kangaroo": ["pond", 3, "Drinks at waterholes in hot summers."], "glossy black-cockatoo": ["nest", 6, "Eats sheoak seeds and nests in big tree hollows."],
            "koala": ["mix", 9, "Eats mostly eucalyptus leaves."], "echidna": ["log", 6, "Hides in hollow logs and eats ants."] },
          options: ["log", "mango", "hotel", "pond", "pine", "nest"] }) },
      { title: "Borneo", goal: "Help the orangutan, hornbill and gibbon",
        intro: [["tuki", "Last stop: **Borneo**! Orangutans, hornbills and gibbons are waiting for their forest."],
                ["koa", "Some seeds can't ride a drone. Think before you load!"]],
        cards: ["rr-corridor"],
        play: biomeLevel({ biome: "borneo_lowland", site: "kalimantan", look: "borneo", mode: "fall", fall: 28, slots: 2,
          where: "Ketapang, West Kalimantan (Borneo, Indonesia)", mix: ["kadam", "mahang", "leban"],
          needs: { "orangutan": ["mix", 12, "Eats fruit and builds a leafy bed in tall trees every night."],
            "rhinoceros hornbill": ["nest", 6, "Nests in huge tree holes. Leban fruit feeds it."],
            "gibbon": ["bridge", 9, "Swings through the treetops. It almost never touches the ground."] },
          options: ["oilpalm", "bridge", "pond", "shorea", "nest", "hotel"] }) }
    ]
  });
})();
