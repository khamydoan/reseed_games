/* ReSeed Quest characters — original SVG cartoons (no franchise characters).
 * RQ.chars.svg(who, {mood:'happy'|'wow'|'think'|'sad', size}) -> SVG string (viewBox 0 0 120 120).
 * who: sprout · koa · tuki · hoot · pix · mo · bug */
(function () {
  "use strict";
  var RQ = window.RQ = window.RQ || {};
  var INK = "#1d2b3a", uid = 0;

  function eyes(x1, x2, y, r, mood, color) {
    color = color || INK;
    if (mood === "happy") {
      return '<path d="M' + (x1 - r) + " " + (y + 1) + " Q" + x1 + " " + (y - r * 1.4) + " " + (x1 + r) + " " + (y + 1) + '" fill="none" stroke="' + color + '" stroke-width="3.2" stroke-linecap="round"/>' +
        '<path d="M' + (x2 - r) + " " + (y + 1) + " Q" + x2 + " " + (y - r * 1.4) + " " + (x2 + r) + " " + (y + 1) + '" fill="none" stroke="' + color + '" stroke-width="3.2" stroke-linecap="round"/>';
    }
    var rr = mood === "wow" ? r * 1.25 : r, dy = mood === "think" ? -2 : 0, dx = mood === "think" ? 1.5 : 0;
    var s = "";
    [x1, x2].forEach(function (x) {
      s += '<g class="ch-blink"><circle cx="' + x + '" cy="' + y + '" r="' + rr + '" fill="' + color + '"/>' +
        '<circle cx="' + (x + rr * .35 + dx) + '" cy="' + (y - rr * .35 + dy) + '" r="' + rr * .35 + '" fill="#fff"/></g>';
    });
    if (mood === "sad") s += '<path d="M' + (x1 - r - 2) + " " + (y - r - 5) + " L" + (x1 + r) + " " + (y - r - 2) + '" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M' + (x2 + r + 2) + " " + (y - r - 5) + " L" + (x2 - r) + " " + (y - r - 2) + '" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round"/>';
    if (mood === "think") s += '<path d="M' + (x2 - r) + " " + (y - r - 6) + " Q" + x2 + " " + (y - r - 10) + " " + (x2 + r + 2) + " " + (y - r - 5) + '" stroke="' + color + '" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    return s;
  }
  function mouth(x, y, w, mood, color) {
    color = color || INK;
    if (mood === "wow") return '<ellipse cx="' + x + '" cy="' + (y + 2) + '" rx="' + w * .35 + '" ry="' + w * .45 + '" fill="' + color + '"/><ellipse cx="' + x + '" cy="' + (y + 4) + '" rx="' + w * .2 + '" ry="' + w * .2 + '" fill="#ff8fa3"/>';
    if (mood === "sad") return '<path d="M' + (x - w / 2) + " " + (y + 4) + " Q" + x + " " + (y - 4) + " " + (x + w / 2) + " " + (y + 4) + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/>';
    if (mood === "think") return '<path d="M' + (x - w / 3) + " " + (y + 1) + " L" + (x + w / 3) + " " + (y - 1) + '" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/>';
    return '<path d="M' + (x - w / 2) + " " + y + " Q" + x + " " + (y + w * .7) + " " + (x + w / 2) + " " + y + '" fill="' + (w > 10 ? "#7a2e3a" : "none") + '" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function wrap(body, o) {
    var size = o && o.size ? ' width="' + o.size + '" height="' + o.size + '"' : "";
    return '<svg viewBox="0 0 120 120"' + size + ' xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (o && o.label || "") + '">' + body + "</svg>";
  }
  var S = ' stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"';

  var DRAW = {
    sprout: function (m) {
      var id = "sp" + (uid++);
      return '<defs><radialGradient id="' + id + '" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#9be8a3"/><stop offset=".6" stop-color="#47b95c"/><stop offset="1" stop-color="#2a8c43"/></radialGradient></defs>' +
        // rotor arms + rotors
        '<path d="M30 52 L14 40 M90 52 L106 40" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>' +
        '<ellipse class="ch-rotor" cx="14" cy="36" rx="13" ry="3.5" fill="#cfe9ff"' + S + '/><ellipse class="ch-rotor" cx="106" cy="36" rx="13" ry="3.5" fill="#cfe9ff"' + S + '/>' +
        '<circle cx="14" cy="40" r="3.5" fill="' + INK + '"/><circle cx="106" cy="40" r="3.5" fill="' + INK + '"/>' +
        // antenna + leaf
        '<path d="M60 34 Q58 22 64 14" fill="none" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round"/>' +
        '<path d="M64 14 C 72 2, 90 6, 92 12 C 84 20, 70 22, 64 14 Z" fill="#8be07f"' + S + '/><path d="M66 14 Q78 12 88 12" stroke="#3f9a49" stroke-width="2" fill="none"/>' +
        // body
        '<circle cx="60" cy="68" r="36" fill="url(#' + id + ')"' + S + '/>' +
        '<path d="M34 92 L30 108 M86 92 L90 108 M24 108 L38 108 M82 108 L96 108" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>' +
        // face screen
        '<rect x="35" y="50" width="50" height="34" rx="13" fill="#163042"' + S + '/>' +
        eyes(50, 70, 64, 5, m, "#7ff0ff") + mouth(60, 74, 10, m === "wow" ? "wow" : m, "#7ff0ff") +
        '<circle cx="31" cy="80" r="4.5" fill="#ff9fb0" opacity=".75"/><circle cx="89" cy="80" r="4.5" fill="#ff9fb0" opacity=".75"/>' +
        '<ellipse cx="46" cy="44" rx="9" ry="5" fill="#fff" opacity=".35"/>';
    },
    koa: function (m) {
      return '<circle cx="27" cy="40" r="20" fill="#9aa6b2"' + S + '/><circle cx="27" cy="41" r="11" fill="#f2c4d0"/>' +
        '<circle cx="93" cy="40" r="20" fill="#9aa6b2"' + S + '/><circle cx="93" cy="41" r="11" fill="#f2c4d0"/>' +
        '<path d="M34 120 Q34 92 60 92 Q86 92 86 120 Z" fill="#b8c2cc"' + S + '/>' +
        '<path d="M40 98 Q60 108 80 98 L84 106 Q60 118 36 106 Z" fill="#e2574c"' + S + '/>' +
        '<ellipse cx="60" cy="64" rx="37" ry="32" fill="#aab5c0"' + S + '/>' +
        '<ellipse cx="60" cy="78" rx="20" ry="14" fill="#d9dee4"/>' +
        // goggles on forehead
        '<path d="M24 46 Q60 30 96 46" fill="none" stroke="#7a4b2a" stroke-width="6"/>' +
        '<circle cx="46" cy="40" r="10" fill="#8fd3ff"' + S + '/><circle cx="74" cy="40" r="10" fill="#8fd3ff"' + S + '/>' +
        '<path d="M42 36 l5 -3 M70 36 l5 -3" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' +
        eyes(45, 75, 62, 4.5, m) +
        '<ellipse cx="60" cy="72" rx="10" ry="12" fill="#2b2f36"' + S + '/><ellipse cx="56" cy="67" rx="3" ry="2" fill="#fff" opacity=".6"/>' +
        mouth(60, 87, 8, m);
    },
    tuki: function (m) {
      var id = "tk" + (uid++);
      return '<defs><linearGradient id="' + id + '" x1="0" x2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset=".65" stop-color="#ff9f1c"/><stop offset="1" stop-color="#e2574c"/></linearGradient></defs>' +
        // dish backpack
        '<path d="M22 50 L30 62" stroke="' + INK + '" stroke-width="3"/><ellipse cx="18" cy="44" rx="12" ry="7" transform="rotate(-35 18 44)" fill="#e8eef5"' + S + '/><circle cx="16" cy="41" r="2.5" fill="' + INK + '"/>' +
        '<ellipse cx="50" cy="76" rx="31" ry="37" fill="#23282f"' + S + '/>' +
        '<path d="M50 112 l-4 6 M58 112 l4 6" stroke="#ff9f1c" stroke-width="4" stroke-linecap="round"/>' +
        '<ellipse cx="58" cy="70" rx="16" ry="20" fill="#fff3b0"/>' +
        '<ellipse cx="36" cy="82" rx="10" ry="20" fill="#353c46" transform="rotate(12 36 82)"/>' +
        '<circle cx="56" cy="50" r="11" fill="#5ab0ff"' + S + '/>' + eyes(56, 999, 50, 4.5, m) +
        // beak
        '<path d="M64 40 C 86 30, 110 36, 117 54 C 104 63, 84 63, 64 59 Z" fill="url(#' + id + ')"' + S + '/>' +
        '<path d="M66 50 C 84 48, 102 50, 116 54" fill="none" stroke="' + INK + '" stroke-width="2"/>' +
        (m === "wow" ? '<path d="M68 59 C 86 70, 104 66, 114 58" fill="#7a2e3a"' + S + '/>' : "") +
        '<path d="M111 44 C 114 47, 116 50, 117 54" fill="none" stroke="#b5332a" stroke-width="4" stroke-linecap="round"/>';
    },
    hoot: function (m) {
      return '<path d="M30 34 L36 12 L48 30 Z M90 34 L84 12 L72 30 Z" fill="#7d5233"' + S + '/>' +
        '<ellipse cx="60" cy="70" rx="40" ry="44" fill="#9c6b43"' + S + '/>' +
        '<ellipse cx="24" cy="78" rx="10" ry="24" fill="#7d5233"' + S + ' transform="rotate(10 24 78)"/><ellipse cx="96" cy="78" rx="10" ry="24" fill="#7d5233"' + S + ' transform="rotate(-10 96 78)"/>' +
        '<ellipse cx="60" cy="88" rx="25" ry="22" fill="#f1dcc0"/>' +
        '<path d="M50 82 l4 4 l4 -4 M62 82 l4 4 l4 -4 M56 92 l4 4 l4 -4" fill="none" stroke="#c9a57c" stroke-width="2"/>' +
        '<circle cx="45" cy="54" r="15" fill="#f6e7d2"/><circle cx="75" cy="54" r="15" fill="#f6e7d2"/>' +
        eyes(45, 75, 54, 6, m) +
        '<circle cx="45" cy="54" r="15" fill="none"' + S + '/><circle cx="75" cy="54" r="15" fill="none"' + S + '/><path d="M58 52 Q60 49 62 52" fill="none"' + S + '/>' +
        '<path d="M60 64 L54 70 L60 76 L66 70 Z" fill="#ffb02e"' + S + '/>' +
        (m === "wow" ? '<ellipse cx="60" cy="80" rx="4" ry="4" fill="#7a2e3a"/>' : "") +
        '<path d="M60 108 L46 100 L46 116 Z M60 108 L74 100 L74 116 Z" fill="#e2574c"' + S + '/><circle cx="60" cy="108" r="4" fill="#b5332a"' + S + '/>';
    },
    pix: function (m) {
      return '<path d="M22 120 Q20 92 50 88 L78 88 Q102 92 100 120 Z" fill="#6c5ce7"' + S + '/>' +
        '<path d="M50 88 L60 102 L70 88" fill="none" stroke="#fff" stroke-width="2.5"/>' +
        '<ellipse cx="54" cy="62" rx="32" ry="28" fill="#d6b08a"' + S + '/>' +
        // scales
        '<path d="M26 56 Q32 44 40 54 Q46 40 54 52 Q62 38 68 50 Q76 38 80 52" fill="#9a7350"' + S + '/>' +
        '<path d="M28 46 Q36 30 46 42 Q54 26 64 40 Q72 28 80 42" fill="#b48a62"' + S + '/>' +
        // snout
        '<path d="M76 62 Q100 60 110 72 Q100 80 78 78 Z" fill="#e3c39f"' + S + '/><circle cx="108" cy="72" r="3.5" fill="' + INK + '"/>' +
        eyes(64, 999, 62, 4.5, m) +
        mouth(88, 80, 8, m) +
        // headset
        '<path d="M26 64 Q24 30 58 26" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
        '<rect x="18" y="58" width="14" height="20" rx="6" fill="#2d3436"' + S + '/>' +
        '<path d="M28 76 Q40 92 66 90" fill="none" stroke="' + INK + '" stroke-width="3"/><circle cx="68" cy="90" r="4" fill="#2d3436"/>';
    },
    mo: function (m) {
      return '<ellipse cx="60" cy="78" rx="40" ry="38" fill="#5a4a45"' + S + '/>' +
        '<ellipse cx="60" cy="88" rx="26" ry="22" fill="#6e5d57"/>' +
        // hard hat
        '<path d="M26 50 Q28 14 60 14 Q92 14 94 50 Z" fill="#ffc93c"' + S + '/>' +
        '<rect x="18" y="46" width="84" height="9" rx="4.5" fill="#ffb000"' + S + '/>' +
        '<path d="M60 16 L60 46" stroke="#e0a000" stroke-width="5"/>' +
        '<circle cx="60" cy="30" r="7" fill="#fff6c9"' + S + '/>' +
        // glasses + eyes
        eyes(48, 72, 68, 3.5, m) +
        '<circle cx="48" cy="68" r="8" fill="none" stroke="' + INK + '" stroke-width="2.5"/><circle cx="72" cy="68" r="8" fill="none" stroke="' + INK + '" stroke-width="2.5"/><path d="M56 68 L64 68" stroke="' + INK + '" stroke-width="2.5"/>' +
        // star nose
        '<g fill="#ff8fab" stroke="' + INK + '" stroke-width="1.5"><circle cx="60" cy="82" r="5"/>' +
        [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) { var r = a * Math.PI / 180; return '<circle cx="' + (60 + Math.cos(r) * 7).toFixed(1) + '" cy="' + (82 + Math.sin(r) * 7).toFixed(1) + '" r="2.6"/>'; }).join("") + "</g>" +
        mouth(60, 94, 8, m) +
        // paws + screwdriver
        '<ellipse cx="26" cy="104" rx="12" ry="9" fill="#ffb3c6"' + S + '/>' +
        '<path d="M96 76 L108 64" stroke="#9aa6b2" stroke-width="4" stroke-linecap="round"/><rect x="88" y="78" width="12" height="18" rx="4" transform="rotate(45 94 87)" fill="#e2574c"' + S + '/>' +
        '<ellipse cx="94" cy="102" rx="12" ry="9" fill="#ffb3c6"' + S + '/>';
    },
    bug: function (m) {
      return '<path d="M50 30 Q40 12 30 14 M70 30 Q80 12 90 14" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M30 8 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1 Z M90 8 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1 Z" fill="#ffe14d" stroke="' + INK + '" stroke-width="1.5"/>' +
        '<path d="M32 66 L16 58 M30 80 L14 82 M34 94 L20 104 M88 66 L104 58 M90 80 L106 82 M86 94 L100 104" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>' +
        '<ellipse cx="60" cy="78" rx="30" ry="32" fill="#9b4dca"' + S + '/>' +
        '<path d="M60 50 L60 110" stroke="' + INK + '" stroke-width="3"/>' +
        '<circle cx="46" cy="76" r="6" fill="#c792ea"/><circle cx="74" cy="88" r="7" fill="#c792ea"/><circle cx="72" cy="66" r="4" fill="#c792ea"/><circle cx="48" cy="96" r="4" fill="#c792ea"/>' +
        '<circle cx="60" cy="42" r="18" fill="#5b2c83"' + S + '/>' +
        '<circle cx="52" cy="40" r="7" fill="#fff"' + S + '/><circle cx="68" cy="40" r="7" fill="#fff"' + S + '/>' +
        '<circle cx="54" cy="41" r="3" fill="' + INK + '"/><circle cx="70" cy="41" r="3" fill="' + INK + '"/>' +
        (m === "sad" ? '<path d="M52 54 Q60 48 68 54" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>'
          : '<path d="M50 50 Q60 58 70 50" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M56 52 l2 3 2-3 2 3 2-3" fill="none" stroke="' + INK + '" stroke-width="1"/>');
    },
    narrator: function () {
      return '<circle cx="60" cy="60" r="44" fill="#fff"' + S + '/><text x="60" y="76" font-size="46" text-anchor="middle">🌱</text>';
    }
  };
  RQ.chars = {
    list: ["sprout", "koa", "tuki", "hoot", "pix", "mo", "bug"],
    svg: function (who, o) {
      o = o || {};
      var f = DRAW[who] || DRAW.narrator;
      return wrap(f(o.mood || "happy"), { size: o.size, label: (RQ.ui && RQ.ui.names && RQ.ui.names[who]) || who });
    }
  };
})();
