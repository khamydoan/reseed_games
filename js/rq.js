/* ReSeed Quest engine (classic script, global RQ). Works from file:// and GitHub Pages.
 * Sections: utils · save · cards · audio (synth SFX, music, voice) · ui (talk, modal, toast, confetti, card)
 *           · game shell (RQ.game) · keyboard · terminal · code (python highlight, parsons, blanks) · breaks.
 * API reference: docs/ENGINE.md
 */
(function () {
  "use strict";
  var RQ = window.RQ = window.RQ || {};
  RQ.VERSION = "1.0.0";

  // Repo root URL, from this script's own src (".../js/rq.js")
  var me = document.currentScript && document.currentScript.src;
  RQ.root = me ? me.replace(/js\/rq\.js(\?.*)?$/, "") : "./";

  /* =========================================================== utils */
  var u = RQ.u = {};
  u.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  u.lerp = function (a, b, t) { return a + (b - a) * t; };
  u.rand = function (a, b) { return a + Math.random() * (b - a); };
  u.randi = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  u.pick = function (arr, rng) { return arr[Math.floor((rng ? rng() : Math.random()) * arr.length)]; };
  u.shuffle = function (arr, rng) {
    var a = arr.slice(), r = rng || Math.random;
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  /** Seeded RNG (mulberry32). */
  u.seeded = function (seed) {
    var s = (typeof seed === "string" ? u.fnv(seed) : seed) >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0; var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** FNV-1a 32-bit hash -> 8 hex chars. Same function in tools/voice.py. */
  u.fnv = function (str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };
  u.hashText = function (text) { return ("00000000" + u.fnv(u.normText(text)).toString(16)).slice(-8); };
  u.normText = function (t) { return String(t).replace(/\s+/g, " ").trim(); };
  u.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  u.dist = function (x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); };
  u.fmt = function (n, d) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d || 0 }); };
  u.ease = {
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    outBack: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: function (t) { return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1; }
  };
  u.$ = function (sel, root) { return (root || document).querySelector(sel); };
  u.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  u.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  /** el('div', {class:'x', style:{...}, onclick:fn, html:'..', text:'..', attrs...}, child, 'text', ...) */
  u.el = function (tag, props) {
    var e = document.createElement(tag);
    if (props) for (var k in props) {
      var v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k === "html") e.innerHTML = v;
      else if (k === "text") e.textContent = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.assign(e.dataset, v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x != null) e.appendChild(typeof x === "string" ? document.createTextNode(x) : x); });
      else e.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    }
    return e;
  };
  /** Point of a pointer/mouse/touch event in element-local CSS pixels. */
  u.local = function (evt, elem) {
    var r = elem.getBoundingClientRect();
    var p = evt.touches && evt.touches[0] ? evt.touches[0] : (evt.changedTouches && evt.changedTouches[0] ? evt.changedTouches[0] : evt);
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };
  /** Rounded rectangle path on a 2D context. */
  u.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };

  /* =========================================================== save */
  var KEY = "reseedQuest.v1";
  var save = RQ.save = {};
  var state = null;
  function blank() {
    return { v: 1, nick: "", games: {}, cards: {}, settings: { sound: true, music: true, voice: true, tts: true },
      typing: { best_wpm: 0, best_acc: 0 }, playMs: 0, sinceBreakMs: 0, created: Date.now() };
  }
  function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : null; }
  /** Repair any stored shape (old versions, hand edits) so later code never throws. */
  function normalize(x) {
    var b = blank(), st = obj(x) || {};
    for (var k in b) if (st[k] == null || typeof st[k] !== typeof b[k]) st[k] = b[k];
    st.settings = obj(st.settings) || b.settings;
    for (var s in b.settings) if (typeof st.settings[s] !== "boolean") st.settings[s] = b.settings[s];
    st.games = obj(st.games) || {};
    for (var id in st.games) {
      var g = obj(st.games[id]);
      if (!g) { delete st.games[id]; continue; }
      g.stars = Array.isArray(g.stars) ? g.stars.map(function (v) { return typeof v === "number" && v >= 0 && v <= 3 ? v : 0; }) : [];
      g.best = obj(g.best) || {}; g.done = !!g.done; g.plays = typeof g.plays === "number" ? g.plays : 0;
    }
    st.cards = obj(st.cards) || {};
    st.typing = obj(st.typing) || b.typing;
    return st;
  }
  function readStored() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return normalize(null); }
  }
  /** Merge `other` INTO `into` in place (object identities are kept, so code holding save.game(id) stays valid):
   *  stars, cards, completion and bests are unioned; if otherWins, other's settings/nick/site replace ours. */
  function mergeInto(into, other, otherWins) {
    for (var id in other.games) {
      var a = into.games[id], b = other.games[id];
      if (!a) { into.games[id] = JSON.parse(JSON.stringify(b)); continue; }
      var n = Math.max(a.stars.length, b.stars.length);
      for (var i = 0; i < n; i++) a.stars[i] = Math.max(a.stars[i] || 0, b.stars[i] || 0);
      for (var lv in b.best) { a.best[lv] = a.best[lv] || {}; for (var k in b.best[lv]) if (typeof b.best[lv][k] === "number") a.best[lv][k] = Math.max(a.best[lv][k] || 0, b.best[lv][k]); }
      a.done = a.done || b.done; a.plays = Math.max(a.plays, b.plays);
      if (a.extra == null && b.extra != null) a.extra = b.extra;
    }
    for (var c in other.cards) if (!into.cards[c] || other.cards[c] < into.cards[c]) into.cards[c] = other.cards[c];
    into.typing.best_wpm = Math.max(into.typing.best_wpm || 0, other.typing.best_wpm || 0);
    into.typing.best_acc = Math.max(into.typing.best_acc || 0, other.typing.best_acc || 0);
    into.playMs = Math.max(into.playMs, other.playMs);
    if (otherWins) {
      for (var sk in other.settings) into.settings[sk] = other.settings[sk];
      ["nick", "site", "seenHub"].forEach(function (key) { if (other[key] != null) into[key] = other[key]; });
    }
    return into;
  }
  /** save.load() -> the progress object (cached). save.load(true) re-reads storage and merges it in. */
  save.load = function (fresh) {
    if (!state) { state = readStored(); return state; }
    if (fresh) mergeInto(state, readStored(), true); // another tab's settings win, nobody loses progress
    return state;
  };
  var resetting = false;
  save.write = function () {
    if (!state) return;
    try {
      if (!resetting) mergeInto(state, readStored(), false); // this tab's settings win, progress is unioned
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* private mode or full storage: keep playing without saving */ }
  };
  window.addEventListener("storage", function (e) { if (e.key === KEY && state) save.load(true); });
  window.addEventListener("pageshow", function (e) { if (e.persisted && state) save.load(true); });
  save.game = function (id) {
    var s = save.load();
    if (!s.games[id]) s.games[id] = { stars: [], best: {}, done: false, plays: 0 };
    return s.games[id];
  };
  /** Keep the best stars per level; returns {first: bool, improved: bool}. */
  save.recordLevel = function (gameId, idx, stars, stats) {
    var g = save.game(gameId), prev = g.stars[idx] || 0;
    g.stars[idx] = Math.max(prev, stars);
    g.plays++;
    if (stats) {
      g.best[idx] = g.best[idx] || {};
      for (var k in stats) if (typeof stats[k] === "number") g.best[idx][k] = Math.max(g.best[idx][k] || 0, stats[k]);
    }
    save.write();
    return { first: !prev, improved: stars > prev };
  };
  save.markDone = function (gameId) { save.game(gameId).done = true; save.write(); };
  save.totalStars = function () {
    var s = save.load(), t = 0;
    for (var id in s.games) (s.games[id].stars || []).forEach(function (x) { t += x || 0; });
    return t;
  };
  save.setting = function (k, v) { var s = save.load(); if (v === undefined) return s.settings[k]; s.settings[k] = v; save.write(); return v; };
  save.reset = function () {
    resetting = true; var b = blank(); for (var k in state) delete state[k]; for (k in b) state[k] = b[k];
    save.write(); resetting = false;
  };

  /* =========================================================== cards */
  var CARD_CATS = RQ.CARD_CATS = {
    keyboard: { label: "Keyboard", icon: "⌨️", color: "#12a39a" }, hardware: { label: "Hardware", icon: "🖥️", color: "#5b6ee1" },
    os: { label: "Operating system", icon: "💿", color: "#8a5cd0" }, python: { label: "Python", icon: "🐍", color: "#3572A5" },
    ai: { label: "AI", icon: "🧠", color: "#7c5cc4" }, cloud: { label: "Cloud", icon: "☁️", color: "#2b7bd0" },
    network: { label: "Network", icon: "📡", color: "#0f8f8a" }, space: { label: "Space", icon: "🛰️", color: "#d08a1c" },
    forest: { label: "Forest", icon: "🌳", color: "#2f9e4f" }, drone: { label: "Drone", icon: "🚁", color: "#2b7bd0" },
    math: { label: "Math & physics", icon: "➗", color: "#e0752d" }, data: { label: "Data", icon: "🗄️", color: "#b0532b" },
    web: { label: "Web & Git", icon: "🌐", color: "#5a6b7d" }, algo: { label: "Algorithm", icon: "🧩", color: "#d1495b" }
  };
  RQ.cards = { all: {}, order: [] };
  /** cards.js in each game: RQ.defineCards('g07', [{id, name, icon, cat, text, reseed}]) */
  RQ.defineCards = function (gameId, list) {
    list.forEach(function (c) {
      c.game = gameId;
      if (!RQ.cards.all[c.id]) RQ.cards.order.push(c.id);
      RQ.cards.all[c.id] = c;
    });
  };
  RQ.cards.has = function (id) { return !!save.load().cards[id]; };
  RQ.cards.give = function (id) { var s = save.load(); if (s.cards[id]) return false; s.cards[id] = Date.now(); save.write(); return true; };
  RQ.cards.count = function () { return Object.keys(save.load().cards).length; };

  /* =========================================================== audio */
  var audio = RQ.audio = {};
  var AC = null, master = null, sfxBus = null, musicBus = null;
  audio.ctx = function () {
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      AC = new C(); master = AC.createGain(); master.gain.value = .9; master.connect(AC.destination);
      sfxBus = AC.createGain(); sfxBus.gain.value = .55; sfxBus.connect(master);
      musicBus = AC.createGain(); musicBus.gain.value = .0; musicBus.connect(master);
    }
    if (AC.state === "suspended") AC.resume();
    return AC;
  };
  function unlockOnce() { audio.ctx(); if (wantMusic && !musicTimer && save.setting("music")) startMusic(wantMusic); }
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { window.addEventListener(ev, unlockOnce, { capture: true, passive: true }); });

  function tone(o) {
    // o: {f, f2, type, t (start offset), d (duration), v (volume), a (attack), bus, q (filter)}
    if (!o.bus && !save.setting("sound")) return; // sound effects respect the 🔊 switch (music has its own bus)
    var ac = audio.ctx(); if (!ac) return;
    var t0 = ac.currentTime + (o.t || 0), d = o.d || .15;
    var osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || "sine"; osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + d);
    var v = o.v == null ? .3 : o.v, a = o.a || .005;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    var node = osc;
    if (o.lp) { var f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || sfxBus); osc.start(t0); osc.stop(t0 + d + .02);
  }
  function noise(o) {
    if (!o.bus && !save.setting("sound")) return;
    var ac = audio.ctx(); if (!ac) return;
    var t0 = ac.currentTime + (o.t || 0), d = o.d || .2;
    var len = Math.max(1, Math.floor(ac.sampleRate * d)), buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
    for (var i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    var src = ac.createBufferSource(); src.buffer = buf;
    var f = ac.createBiquadFilter(); f.type = o.ft || "lowpass"; f.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    var g = ac.createGain(); var v = o.v == null ? .25 : o.v;
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus); src.start(t0); src.stop(t0 + d + .02);
  }
  audio.tone = tone; audio.noise = noise;
  /** audio.hum({f, type, v, lp}) -> {set(f, v), stop()} — a continuous sound (rotor, engine). Silent when sound is off. */
  audio.hum = function (o) {
    o = o || {};
    var ac = audio.ctx(), dead = { set: function () { }, stop: function () { } };
    if (!ac || !save.setting("sound")) return dead;
    var osc = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    osc.type = o.type || "sawtooth"; osc.frequency.value = o.f || 110; f.type = "lowpass"; f.frequency.value = o.lp || 900;
    g.gain.value = 0; g.gain.setTargetAtTime(o.v == null ? .06 : o.v, ac.currentTime, .05);
    osc.connect(f); f.connect(g); g.connect(sfxBus); osc.start();
    var on = true, vol0 = o.v == null ? .06 : o.v, muted = false;
    var h = {
      set: function (freq, vol) {
        if (!on) return; if (freq != null) osc.frequency.setTargetAtTime(freq, ac.currentTime, .05);
        if (vol != null) vol0 = vol;
        g.gain.setTargetAtTime(save.setting("sound") && !muted ? vol0 : 0, ac.currentTime, .05);
      },
      mute: function (m) { muted = !!m; h.set(); },
      stop: function () { if (!on) return; on = false; g.gain.setTargetAtTime(0, ac.currentTime, .05); setTimeout(function () { try { osc.stop(); } catch (e) { } }, 300); var k = hums.indexOf(h); if (k >= 0) hums.splice(k, 1); }
    };
    hums.push(h);
    return h;
  };
  var hums = [];
  /** Mute/unmute every running hum (the game shell calls this on pause). */
  audio.muteHums = function (m) { hums.forEach(function (h) { h.mute(m); }); };
  var N = function (semi) { return 440 * Math.pow(2, (semi - 9) / 12); }; // semitones from C4 (0 = C4)
  audio.note = N;
  var SFX = {
    click: function () { tone({ f: 900, f2: 600, type: "square", d: .05, v: .12 }); },
    select: function () { tone({ f: 660, type: "triangle", d: .08, v: .2 }); tone({ f: 990, type: "triangle", t: .05, d: .1, v: .18 }); },
    key: function () { noise({ f: 3000, ft: "highpass", d: .03, v: .12 }); tone({ f: 1800, d: .02, v: .05, type: "square" }); },
    type: function () { noise({ f: 2500, ft: "bandpass", d: .025, v: .15 }); },
    pop: function () { tone({ f: 300, f2: 900, type: "sine", d: .09, v: .3 }); },
    coin: function () { tone({ f: 988, type: "square", d: .07, v: .12 }); tone({ f: 1319, type: "square", t: .07, d: .22, v: .12 }); },
    good: function () { tone({ f: N(12), type: "triangle", d: .1, v: .25 }); tone({ f: N(16), type: "triangle", t: .08, d: .1, v: .25 }); tone({ f: N(19), type: "triangle", t: .16, d: .2, v: .25 }); },
    bad: function () { tone({ f: 220, f2: 150, type: "sawtooth", d: .25, v: .15, lp: 1200 }); },
    error: function () { tone({ f: 180, type: "square", d: .12, v: .12, lp: 900 }); tone({ f: 140, type: "square", t: .13, d: .18, v: .12, lp: 900 }); },
    win: function () { [0, 4, 7, 12, 16, 19, 24].forEach(function (s, i) { tone({ f: N(s + 12), type: "triangle", t: i * .07, d: .25, v: .22 }); }); tone({ f: N(36), type: "sine", t: .5, d: .6, v: .15 }); },
    lose: function () { [7, 6, 5, 4].forEach(function (s, i) { tone({ f: N(s), type: "triangle", t: i * .16, d: .22, v: .2 }); }); },
    whoosh: function () { noise({ f: 400, f2: 3000, ft: "bandpass", d: .35, v: .25 }); },
    drop: function () { tone({ f: 700, f2: 180, type: "sine", d: .25, v: .25 }); },
    boom: function () { noise({ f: 800, f2: 60, d: .6, v: .5 }); tone({ f: 90, f2: 40, d: .5, v: .4 }); },
    jump: function () { tone({ f: 300, f2: 700, type: "square", d: .14, v: .12, lp: 2000 }); },
    beep: function () { tone({ f: 1046, type: "sine", d: .09, v: .2 }); },
    tick: function () { tone({ f: 1500, type: "square", d: .02, v: .06 }); },
    powerup: function () { for (var i = 0; i < 8; i++) tone({ f: N(i * 2 + 12), type: "square", t: i * .04, d: .06, v: .09, lp: 3000 }); },
    splash: function () { noise({ f: 1800, f2: 300, ft: "lowpass", d: .4, v: .3 }); },
    buzz: function () { tone({ f: 120, type: "sawtooth", d: .3, v: .12, lp: 800 }); },
    zap: function () { tone({ f: 1800, f2: 200, type: "sawtooth", d: .18, v: .12, lp: 4000 }); },
    snap: function () { noise({ f: 5000, ft: "highpass", d: .05, v: .3 }); tone({ f: 1200, d: .03, v: .1 }); },
    bloom: function () { [0, 7, 12, 16].forEach(function (s, i) { tone({ f: N(s + 12), type: "sine", t: i * .05, d: .3, v: .15 }); }); },
    chirp: function () { tone({ f: 2400, f2: 3400, d: .06, v: .12 }); tone({ f: 2600, f2: 3800, t: .09, d: .06, v: .12 }); },
    giggle: function () { [0, 1, 2, 3].forEach(function (i) { tone({ f: 900 - i * 60, f2: 1200 - i * 60, type: "triangle", t: i * .07, d: .06, v: .12 }); }); },
    shutter: function () { noise({ f: 4000, ft: "highpass", d: .04, v: .35 }); noise({ f: 2500, ft: "bandpass", t: .06, d: .05, v: .25 }); },
    engine: function () { tone({ f: 70, f2: 90, type: "sawtooth", d: .2, v: .08, lp: 400 }); }
  };
  audio.sfx = function (name) {
    if (!save.setting("sound")) return;
    try { (SFX[name] || SFX.click)(); } catch (e) { /* no audio */ }
  };
  audio.SFX = SFX;

  // ---- procedural music: chord progression + bass + arpeggio + soft drums, per theme
  var THEMES = {
    camp: { bpm: 104, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], wave: "triangle", root: 0 },
    garden: { bpm: 96, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 3], wave: "sine", root: 5 },
    space: { bpm: 84, scale: [0, 2, 3, 7, 10], prog: [0, 5, 3, 6], wave: "sine", root: 2 },
    lab: { bpm: 112, scale: [0, 3, 5, 7, 10], prog: [0, 3, 5, 4], wave: "square", root: 9 },
    sky: { bpm: 120, scale: [0, 2, 4, 7, 9], prog: [0, 4, 5, 3], wave: "triangle", root: 7 },
    forest: { bpm: 90, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], wave: "sine", root: 3 },
    mystery: { bpm: 92, scale: [0, 2, 3, 7, 8], prog: [0, 5, 3, 4], wave: "triangle", root: 4 },
    action: { bpm: 140, scale: [0, 3, 5, 7, 10], prog: [0, 6, 5, 4], wave: "square", root: 0 }
  };
  var wantMusic = null, musicTimer = null, step = 0, nextT = 0;
  var CHORD = { 0: [0, 4, 7], 3: [5, 9, 12], 4: [7, 11, 14], 5: [9, 12, 16], 6: [10, 14, 17], 1: [2, 5, 9], 2: [4, 7, 11] };
  function startMusic(name) {
    if (!save.setting("music")) return;
    var ac = audio.ctx(); if (!ac) return;
    stopMusic(true);
    var th = THEMES[name] || THEMES.camp, beat = 60 / th.bpm / 2; // eighth notes
    musicBus.gain.cancelScheduledValues(ac.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ac.currentTime);
    musicBus.gain.linearRampToValueAtTime(.16, ac.currentTime + 1.2);
    step = 0; nextT = ac.currentTime + .1;
    var rng = u.seeded(name);
    var melody = []; for (var i = 0; i < 32; i++) melody.push(rng() < .55 ? th.scale[Math.floor(rng() * th.scale.length)] + (rng() < .3 ? 12 : 0) : null);
    musicTimer = setInterval(function () {
      if (!AC) return;
      while (nextT < AC.currentTime + .25) {
        var bar = Math.floor(step / 8) % th.prog.length, ch = CHORD[th.prog[bar]] || CHORD[0], s8 = step % 8, t = nextT - AC.currentTime;
        if (s8 === 0) tone({ f: N(th.root + ch[0] - 24), type: "triangle", t: t, d: beat * 7, v: .22, bus: musicBus, lp: 600 });
        if (s8 === 4) tone({ f: N(th.root + ch[2] - 24), type: "triangle", t: t, d: beat * 3, v: .16, bus: musicBus, lp: 600 });
        tone({ f: N(th.root + ch[step % 3] + (s8 > 3 ? 12 : 0)), type: th.wave, t: t, d: beat * .9, v: th.wave === "square" ? .035 : .07, bus: musicBus, lp: 2400 });
        var m = melody[step % 32];
        if (m != null && s8 % 2 === 0) tone({ f: N(th.root + m + 12), type: "sine", t: t, d: beat * 1.8, v: .07, bus: musicBus });
        if (s8 === 0 || s8 === 4) noise({ f: 160, t: t, d: .12, v: .18, bus: musicBus });
        if (s8 === 2 || s8 === 6) noise({ f: 6000, ft: "highpass", t: t, d: .04, v: .05, bus: musicBus });
        nextT += beat; step++;
      }
    }, 60);
  }
  function stopMusic(fast) {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (AC && musicBus) { musicBus.gain.cancelScheduledValues(AC.currentTime); musicBus.gain.setValueAtTime(fast ? 0 : musicBus.gain.value, AC.currentTime); }
  }
  /** audio.music('garden') starts a theme (if music is on); audio.music(null) stops. */
  audio.music = function (name) {
    wantMusic = name;
    if (!name || !save.setting("music")) { stopMusic(); return; }
    if (AC && AC.state === "running") startMusic(name);
  };
  audio.duck = function (on) { if (AC && musicBus && musicTimer) musicBus.gain.setTargetAtTime(on ? .05 : .16, AC.currentTime, .2); };

  // ---- voice: pre-generated MP3 (audio/voice-manifest.js -> window.RQ_VOICE = {hash: "file.mp3"}) or speech synthesis
  var VOICES = { sprout: { pitch: 1.35, rate: 1.02 }, koa: { pitch: 1.1, rate: .95 }, tuki: { pitch: 1.4, rate: 1.05 },
    hoot: { pitch: .8, rate: .9 }, pix: { pitch: 1.15, rate: 1.05 }, mo: { pitch: .7, rate: .92 }, narrator: { pitch: 1, rate: .95 } };
  var curVoice = null; // {finish()} of the line being spoken
  audio.stopVoice = function () {
    if (curVoice) curVoice.finish();
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { }
    audio.duck(false);
  };
  /** Speak a line. Returns a promise that always settles: when the line ends, fails, or is stopped. */
  audio.speak = function (text, who) {
    audio.stopVoice();
    if (!save.setting("voice")) return Promise.resolve();
    var clean = String(text).replace(/<[^>]+>/g, "").replace(/[`*_]/g, "");
    var h = u.hashText(clean), map = window.RQ_VOICE || {};
    return new Promise(function (resolve) {
      var done = false, a = null, me = {};
      me.finish = function () {
        if (done) return; done = true;
        if (a) { a.onended = a.onerror = null; try { a.pause(); } catch (e) { } }
        if (curVoice === me) { curVoice = null; audio.duck(false); }
        resolve();
      };
      curVoice = me;
      if (map[h]) {
        a = new Audio(RQ.root + "audio/voice/" + map[h]);
        audio.duck(true);
        a.onended = a.onerror = me.finish;
        var p = a.play(); if (p && p.catch) p.catch(me.finish);
      } else if (save.setting("tts") && window.speechSynthesis && window.SpeechSynthesisUtterance) {
        var ut = new SpeechSynthesisUtterance(clean), v = VOICES[who] || VOICES.narrator;
        ut.pitch = v.pitch; ut.rate = v.rate; ut.lang = "en-US";
        ut.onend = ut.onerror = me.finish;
        audio.duck(true); speechSynthesis.speak(ut);
      } else me.finish();
    });
  };

  /* =========================================================== ui */
  var ui = RQ.ui = {};
  var NAMES = { sprout: "Sprout", koa: "Koa", tuki: "Tuki", hoot: "Professor Hoot", pix: "Pix", mo: "Mo", bug: "Glitch Bug", narrator: "" };
  ui.names = NAMES;
  function portrait(who, mood) { return RQ.chars && RQ.chars.svg ? RQ.chars.svg(who, { mood: mood }) : ""; }
  /** Render light markup in speech: **bold**, `code`. */
  ui.md = function (s) {
    return u.esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
  };
  var talkEl = null, sayCtl = null;
  function overlayOpen() { return !!document.querySelector(".rq-overlay:not(.clear)"); }
  /** ui.say(who, text, {mood, choices:[..], top:true, auto:ms}) -> Promise<choiceIndex|undefined>.
   *  A newer say() or ui.closeTalk() cancels the current one (its promise resolves with undefined). */
  ui.say = function (who, text, opts) {
    opts = opts || {};
    if (sayCtl) sayCtl.cancel();
    var ctl = { cancelled: false };
    sayCtl = ctl;
    var p = new Promise(function (resolve) {
      var done = false, typing = true, full = ui.md(text), autoTimer = null;
      var txt = u.el("div", { class: "text" });
      var bubble = u.el("div", { class: "bubble", role: "dialog", "aria-live": "polite" },
        NAMES[who] ? u.el("div", { class: "name", text: NAMES[who] }) : null, txt,
        opts.choices ? null : u.el("div", { class: "next", text: "▶ click / Enter" }));
      var wrap = u.el("div", { class: "rq-talk" + (opts.top ? " top" : "") }, u.el("div", { class: "who ch-bob", html: portrait(who, opts.mood) }), bubble);
      talkEl = wrap; document.body.appendChild(wrap);
      // typewriter
      var plain = full, i = 0, timer = null;
      var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      function finishTyping() { typing = false; if (timer) clearInterval(timer); timer = null; txt.innerHTML = full; }
      if (reduce) finishTyping();
      else timer = setInterval(function () {
        i += 2;
        if (i >= plain.length) return finishTyping();
        // avoid cutting inside a tag/entity
        var cut = plain.slice(0, i), lt = cut.lastIndexOf("<"), gt = cut.lastIndexOf(">"), amp = cut.lastIndexOf("&"), sc = cut.lastIndexOf(";");
        if (lt > gt || amp > sc) return;
        txt.innerHTML = cut;
      }, 18);
      audio.speak(text, who);
      function close(val) {
        if (done) return; done = true; window.removeEventListener("keydown", onKey, true);
        if (timer) clearInterval(timer); if (autoTimer) clearTimeout(autoTimer);
        audio.stopVoice(); wrap.remove(); if (talkEl === wrap) talkEl = null; if (sayCtl === ctl) sayCtl = null;
        resolve(val);
      }
      ctl.cancel = function () { ctl.cancelled = true; close(undefined); };
      function onKey(e) {
        if (overlayOpen()) return; // a modal (pause, results) owns the keyboard
        if (opts.choices) {
          var n = parseInt(e.key, 10);
          if (n >= 1 && n <= opts.choices.length) { e.preventDefault(); e.stopPropagation(); audio.sfx("select"); close(n - 1); }
          return;
        }
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault(); e.stopPropagation();
          if (typing) finishTyping(); else { audio.sfx("click"); close(); }
        }
      }
      window.addEventListener("keydown", onKey, true);
      if (opts.choices) {
        var box = u.el("div", { class: "choices" });
        opts.choices.forEach(function (c, k) {
          box.appendChild(u.el("button", { class: "btn small", html: "<b>" + (k + 1) + "</b>&nbsp; " + ui.md(c), onclick: function (e) { e.stopPropagation(); audio.sfx("select"); close(k); } }));
        });
        bubble.appendChild(box);
      } else bubble.addEventListener("click", function () { if (typing) finishTyping(); else { audio.sfx("click"); close(); } });
      if (opts.auto) autoTimer = setTimeout(function () { close(); }, opts.auto);
    });
    p.ctl = ctl;
    return p;
  };
  /** ui.talk([[who, text], [who, text, {mood}] ...]) plays lines in order; stops if a line is cancelled. */
  ui.talk = function (lines) {
    var p = Promise.resolve(), stopped = false;
    (lines || []).forEach(function (l) {
      p = p.then(function () {
        if (stopped) return;
        var q = ui.say(l[0], l[1], l[2]);
        return q.then(function (v) { if (q.ctl.cancelled) stopped = true; return v; });
      });
    });
    return p;
  };
  /** ui.choose(who, text, ['A', 'B']) -> Promise<index> */
  ui.choose = function (who, text, choices, opts) { return ui.say(who, text, Object.assign({}, opts, { choices: choices })); };
  ui.closeTalk = function () { if (sayCtl) sayCtl.cancel(); if (talkEl) { talkEl.remove(); talkEl = null; } audio.stopVoice(); };

  var toastTimer = null, toastEl = null;
  /** ui.toast(text, 'good'|'bad'|'info', ms) */
  ui.toast = function (text, kind, ms) {
    if (toastEl) toastEl.remove();
    toastEl = u.el("div", { class: "rq-toast " + (kind || ""), html: ui.md(text) });
    document.body.appendChild(toastEl);
    clearTimeout(toastTimer); var e = toastEl;
    toastTimer = setTimeout(function () { e.remove(); }, ms || 1800);
  };
  /** Floating "+1" text at page coordinates. */
  ui.float = function (x, y, text, color) {
    var e = u.el("div", { class: "rq-float", text: text, style: { left: x + "px", top: y + "px", color: color || "" } });
    document.body.appendChild(e); setTimeout(function () { e.remove(); }, 1000);
  };
  /** Confetti burst (canvas overlay). */
  ui.confetti = function (n) {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var cv = u.el("canvas", { class: "rq-confetti" }); document.body.appendChild(cv);
    var W = cv.width = innerWidth, H = cv.height = innerHeight, ctx = cv.getContext("2d");
    var cols = ["#ffc53d", "#2f9e4f", "#2b7bd0", "#d1495b", "#7c5cc4", "#e0752d", "#12a39a"];
    var ps = []; for (var i = 0; i < (n || 140); i++) ps.push({ x: W / 2 + u.rand(-80, 80), y: H * .45, vx: u.rand(-9, 9), vy: u.rand(-16, -5), r: u.rand(4, 9), c: u.pick(cols), a: u.rand(0, 6), va: u.rand(-.3, .3), leaf: Math.random() < .35 });
    var t0 = performance.now();
    (function frame(t) {
      var el = t - t0; ctx.clearRect(0, 0, W, H);
      ps.forEach(function (p) {
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        if (p.leaf) { ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r / 2, 0, 0, 7); ctx.fill(); } else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      });
      if (el < 2600) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  };
  /** ui.modal({title, html|node, buttons:[{label, cls, value}], icon, dismiss}) -> Promise<value>.
   *  Modals stack; only the top one reacts to Escape and Tab stays inside it; focus returns to the opener. */
  var modalStack = [];
  ui.modal = function (o) {
    return new Promise(function (resolve) {
      var prevFocus = document.activeElement, closed = false;
      var ov = u.el("div", { class: "rq-overlay" });
      var m = u.el("div", { class: "rq-modal", role: "dialog", "aria-modal": "true" });
      if (o.icon) m.appendChild(u.el("div", { class: "big-emoji", style: { fontSize: "56px" }, html: o.icon }));
      if (o.title) m.appendChild(u.el("h2", { html: o.title }));
      if (o.html) m.appendChild(u.el("div", { html: o.html }));
      if (o.node) m.appendChild(o.node);
      var bs = u.el("div", { class: "buttons" });
      (o.buttons || [{ label: "OK", cls: "primary", value: true }]).forEach(function (b, i) {
        var btn = u.el("button", { class: "btn " + (b.cls || ""), html: b.label, onclick: function () { audio.sfx("click"); close(b.value === undefined ? i : b.value); } });
        bs.appendChild(btn);
      });
      m.appendChild(bs); ov.appendChild(m); document.body.appendChild(ov);
      var me = { close: close, el: m };
      modalStack.push(me); ui._modal = me;
      var first = bs.querySelector(".btn.primary, .btn.go") || bs.querySelector(".btn");
      if (first) setTimeout(function () { if (!closed && ui._modal === me && !m.contains(document.activeElement)) first.focus(); }, 50);
      function onKey(e) {
        if (ui._modal !== me) return; // only the top modal
        if (e.key === "Escape" && o.dismiss !== false) { e.stopPropagation(); e.preventDefault(); close(null); }
        else if (e.key === "Tab") {
          var f = u.$$("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])", m).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
          if (!f.length) return;
          var a = f[0], z = f[f.length - 1];
          if (e.shiftKey && (document.activeElement === a || !m.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
          else if (!e.shiftKey && (document.activeElement === z || !m.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
        }
      }
      window.addEventListener("keydown", onKey, true);
      if (o.dismiss !== false) ov.addEventListener("click", function (e) { if (e.target === ov) close(null); });
      function close(v) {
        if (closed) return; closed = true;
        window.removeEventListener("keydown", onKey, true); ov.remove();
        var k = modalStack.indexOf(me); if (k >= 0) modalStack.splice(k, 1);
        ui._modal = modalStack[modalStack.length - 1] || null;
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) try { prevFocus.focus(); } catch (e) { }
        resolve(v);
      }
    });
  };
  /** Close every open modal (used when the game flow changes underneath them). */
  ui.closeModals = function (v) { modalStack.slice().reverse().forEach(function (mm) { mm.close(v === undefined ? null : v); }); };
  /** HTML for a Field Card. */
  ui.cardHTML = function (c) {
    var cat = CARD_CATS[c.cat] || CARD_CATS.algo;
    return '<div class="rq-card" style="--cc:' + cat.color + '"><div class="top"><div class="ico">' + (c.icon || cat.icon) +
      '</div><div><small>' + cat.label + ' · Field Card</small><b>' + u.esc(c.name) + '</b></div></div><div class="body">' + ui.md(c.text) +
      (c.reseed ? '<div class="reseed">🌱 <b>In ReSeed:</b> ' + ui.md(c.reseed) + "</div>" : "") + "</div></div>";
  };
  /** Show a newly collected card. */
  ui.card = function (id) {
    var c = RQ.cards.all[id]; if (!c) return Promise.resolve();
    audio.sfx("powerup");
    return ui.modal({ title: "New Field Card!", html: ui.cardHTML(c) + '<p class="muted">Find it any time in the <b>Field Guide</b> on the map.</p>', buttons: [{ label: "Collect ✨", cls: "go" }] });
  };
  ui.starsHTML = function (n, max) { var s = ""; for (var i = 0; i < (max || 3); i++) s += i < n ? "⭐" : "☆"; return s; };

  /* =========================================================== real ReSeed data (data/reseed-data.js) */
  /** RQ.url('data/sites/rondonia/rgb.jpg') -> absolute URL from the repo root. */
  RQ.url = function (path) { return RQ.root + String(path).replace(/^\/+/, ""); };
  RQ.data = function () { return window.RQ_DATA || null; };
  RQ.site = function (id) { var d = window.RQ_DATA; if (!d) return null; for (var i = 0; i < d.sites.length; i++) if (d.sites[i].id === id) return d.sites[i]; return null; };
  /** The player's "My Site" (chosen on the map; default Rondônia). Games use it to carry one forest across the journey. */
  RQ.MY_SITE_CHOICES = ["rondonia", "dixie", "kalimantan"];
  RQ.mySiteId = function () { var s = save.load(); return RQ.MY_SITE_CHOICES.indexOf(s.site) >= 0 ? s.site : "rondonia"; };
  RQ.mySite = function () { return RQ.site(RQ.mySiteId()); };
  RQ.setMySite = function (id) { var s = save.load(); s.site = id; save.write(); };

  /* =========================================================== breaks (stretch reminder) */
  var BREAK_MS = 20 * 60 * 1000, lastTick = Date.now(), activeSince = Date.now();
  setInterval(function () {
    var now = Date.now(), dt = Math.min(now - lastTick, 5000); lastTick = now;
    if (document.hidden) return;
    var s = save.load(); s.playMs += dt; s.sinceBreakMs += dt;
  }, 1000);
  window.addEventListener("beforeunload", function () { save.write(); });
  RQ.breakDue = function () { return save.load().sinceBreakMs > BREAK_MS; };
  RQ.takeBreak = function () {
    var s = save.load();
    var node = u.el("div", { class: "rq-break" },
      u.el("div", { class: "stretch", html: RQ.chars ? '<div style="width:140px;height:140px;margin:auto">' + RQ.chars.svg("sprout", { mood: "happy" }) + "</div>" : "🤸" }),
      u.el("p", { html: "You have played for a while. Let's stretch!<br><b>Reach up high</b> · <b>touch your toes</b> · <b>roll your shoulders</b> · <b>look far away for 20 seconds</b>." }),
      u.el("p", { class: "muted", html: "Your stars are saved. You can come back any time." }));
    return ui.modal({ title: "Stretch break! 🌿", node: node, buttons: [{ label: "I stretched! Keep playing", cls: "go", value: 1 }, { label: "Stop for now (back to map)", value: 2 }] })
      .then(function (v) { s.sinceBreakMs = 0; save.write(); return v; });
  };

  /* =========================================================== game shell */
  /**
   * RQ.game({ id, levels:[{title, goal, intro:[[who,text]], cards:[ids], play: async (L)=>{} }],
   *           intro:[[who,text]], outro:[[who,text]], music:'camp', onReady(shell) })
   */
  RQ.game = function (def) {
    var meta = (RQ.catalog && RQ.catalog.game(def.id)) || { title: def.title || def.id, icon: "🎮", chapter: 0 };
    var chap = (RQ.catalog && RQ.catalog.chapter(meta.chapter)) || { color: "#2f9e4f", tint: "#eaf6ec", name: "" };
    document.documentElement.style.setProperty("--c", chap.color);
    document.documentElement.style.setProperty("--c-tint", chap.tint || "#eef");
    document.body.classList.add("rq");
    document.title = meta.title + " · ReSeed Quest";
    var g = save.game(def.id);
    var mapHref = RQ.root + "index.html#island-" + meta.chapter;

    // header
    var dots = u.el("div", { class: "dots" });
    var hud = u.el("div", { class: "rq-hud" });
    var tools = u.el("div", { class: "rq-tools" });
    function toolBtn(icon, key, label) {
      var b = u.el("button", { class: "btn" + (save.setting(key) ? "" : " off"), title: label, "aria-label": label, "aria-pressed": String(!!save.setting(key)), html: icon });
      b.onclick = function () {
        var v = !save.setting(key); save.setting(key, v); b.classList.toggle("off", !v); b.setAttribute("aria-pressed", String(v));
        if (key === "music") audio.music(v ? def.music || "camp" : null); else audio.music(wantMusic);
        if (key === "voice" && !v) audio.stopVoice();
        audio.sfx("click");
      };
      return b;
    }
    tools.appendChild(toolBtn("🔊", "sound", "Sound effects"));
    tools.appendChild(toolBtn("🎵", "music", "Music"));
    tools.appendChild(toolBtn("🗣️", "voice", "Read aloud"));
    var pauseBtn = u.el("button", { class: "btn", title: "Pause", "aria-label": "Pause", html: "⏸" });
    tools.appendChild(pauseBtn);
    var top = u.el("header", { class: "rq-top" },
      u.el("a", { class: "btn small", href: mapHref, title: "Back to the map", html: "🗺️ Map" }),
      u.el("div", { class: "title" }, u.el("div", { class: "badge", html: meta.icon }),
        u.el("div", { style: { minWidth: 0 } }, u.el("h1", { text: meta.title }), u.el("small", { text: chap.name ? chap.name + " island" : "" }))),
      dots, hud, tools);
    var stage = u.el("main", { class: "rq-stage", id: "rq-stage" });
    document.body.appendChild(top); document.body.appendChild(stage);

    function drawDots(cur) {
      dots.innerHTML = "";
      def.levels.forEach(function (lv, i) {
        var d = u.el("button", { class: "dot" + ((g.stars[i] || 0) > 0 ? " done" : "") + (i === cur ? " now" : ""), title: "Level " + (i + 1) + ": " + lv.title, text: String(i + 1) });
        d.onclick = function () { if (current && current.alive) current.abort(); startLevel(i); };
        dots.appendChild(d);
      });
    }

    var current = null, fails = {}, flow = 0; // flow: bumped on every navigation; stale async steps check it
    var shell = { def: def, meta: meta, stage: stage, hud: hud, startLevel: startLevel, levelSelect: levelSelect };

    function makeL(idx) {
      var lv = def.levels[idx];
      var L = { index: idx, level: lv, game: def, meta: meta, stage: null, alive: true, paused: false, fails: fails[idx] || 0, rng: u.seeded(def.id + ":" + idx + ":" + Date.now()) };
      var cleanups = [], loops = [], hudItems = {};
      function cleanupsPush(f) { if (L.alive) cleanups.push(f); else try { f(); } catch (e) { } }
      L.onEnd = cleanupsPush;
      var deferred = []; // timeouts that came due while paused run on resume
      L._resume = function () { var d = deferred; deferred = []; d.forEach(function (f) { if (L.alive) f(); }); };
      stage.innerHTML = ""; hud.innerHTML = "";
      L.stage = u.el("div", { class: "fill" }); stage.appendChild(L.stage);
      L.on = function (target, type, fn, opts) {
        var wrapped = function (e) { if (L.alive && !L.paused) fn(e); };
        if (!L.alive) return wrapped; // level already over: register nothing
        target.addEventListener(type, wrapped, opts); cleanups.push(function () { target.removeEventListener(type, wrapped, opts); }); return wrapped;
      };
      L.timeout = function (fn, ms) {
        if (!L.alive) return 0;
        var id = setTimeout(function () { if (!L.alive) return; if (L.paused) deferred.push(fn); else fn(); }, ms);
        cleanups.push(function () { clearTimeout(id); }); return id;
      };
      L.interval = function (fn, ms) {
        if (!L.alive) return 0;
        var id = setInterval(function () { if (L.alive && !L.paused) fn(); }, ms); cleanups.push(function () { clearInterval(id); }); return id;
      };
      L.wait = function (ms) { return new Promise(function (r) { L.timeout(r, ms); }); };
      /** L.loop(fn(dt seconds, t seconds)) — requestAnimationFrame loop, paused with the game, dt capped at 50 ms. */
      L.loop = function (fn) {
        var rec = { on: true, errs: 0 }, last = performance.now(), t = 0;
        function f(now) {
          if (!rec.on || !L.alive) return;
          var dt = Math.max(0, Math.min((now - last) / 1000, .05)); last = now; // first frame can be "before" start
          if (!L.paused) { t += dt; try { fn(dt, t); } catch (e) { if (++rec.errs <= 3) console.error(e); } } // keep running: a frozen level is worse
          requestAnimationFrame(f);
        }
        if (!L.alive) return function () { };
        requestAnimationFrame(f); loops.push(rec);
        return function () { rec.on = false; };
      };
      /** L.canvas({w, h, bg, fill, parent, onResize}) — logical w×h canvas scaled to fit the stage (letterboxed), crisp on hi-DPI.
     *  fill:true widens the logical width to use the whole stage (read api.w every frame). */
      L.canvas = function (o) {
        o = o || {}; var W = o.w || 1280, H = o.h || 720;
        var wrap = u.el("div", { class: "rq-canvas-wrap" }), cv = u.el("canvas", { tabindex: "0", "aria-label": o.label || "game" });
        if (o.bg) wrap.style.background = o.bg;
        wrap.appendChild(cv); (o.parent || L.stage).appendChild(wrap);
        var ctx = cv.getContext("2d"), api = { cv: cv, ctx: ctx, w: W, h: H, scale: 1, wrap: wrap }, W0 = W, H0 = H, lastKey = "";
        function fit() {
          var r = (o.parent || L.stage).getBoundingClientRect(), s = Math.min(r.width / W0, r.height / H0) || 1;
          var key = Math.round(r.width) + "x" + Math.round(r.height) + "@" + (window.devicePixelRatio || 1);
          if (key === lastKey) return; // unchanged: keep the pixels (resizing a canvas wipes it)
          lastKey = key;
          if (o.fill) { api.w = W = Math.round(r.width / s); }
          if (o.fillH) { api.h = H = Math.round(r.height / s); }
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          cv.style.width = Math.round(W * s) + "px"; cv.style.height = Math.round(H * s) + "px";
          cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
          ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0); api.scale = s;
          if (o.onResize) o.onResize(api);
        }
        fit(); L.on(window, "resize", fit);
        if (window.ResizeObserver) { // refit when the parent changes size (e.g. a side panel opens)
          var ro = new ResizeObserver(function () { if (L.alive) fit(); }); ro.observe(o.parent || L.stage);
          cleanupsPush(function () { ro.disconnect(); });
        }
        /** Convert a pointer event to logical canvas coordinates. */
        api.toLocal = function (e) { var p = u.local(e, cv); return { x: p.x / api.scale, y: p.y / api.scale }; };
        api.clear = function (c) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); if (c) { ctx.fillStyle = c; ctx.fillRect(0, 0, cv.width, cv.height); } else ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); };
        return api;
      };
      /** L.hud.set('score', '⭐ 3') shows/updates a chip in the header; L.hud.set('score', null) removes it. */
      L.hud = {
        set: function (k, html) {
          if (html == null) { if (hudItems[k]) { hudItems[k].remove(); delete hudItems[k]; } return; }
          if (!hudItems[k]) { hudItems[k] = u.el("span", { class: "chip" }); hud.appendChild(hudItems[k]); }
          hudItems[k].innerHTML = html;
        }
      };
      L.say = ui.say; L.talk = ui.talk; L.choose = ui.choose; L.toast = ui.toast; L.sfx = audio.sfx;
      /** Show a hint bubble (Sprout by default). */
      L.hint = function (text, who) { return ui.say(who || "sprout", "💡 " + text, { mood: "think" }); };
      var resolveEnd; L.done = new Promise(function (r) { resolveEnd = r; });
      function end(result) {
        if (!L.alive) return; L.alive = false;
        loops.forEach(function (r) { r.on = false; }); cleanups.forEach(function (f) { try { f(); } catch (e) { } }); cleanups = [];
        resolveEnd(result);
      }
      /** L.win({stars:1..3, msg, stats:{label:value}}) */
      L.win = function (r) { r = r || {}; end({ win: true, stars: u.clamp(r.stars == null ? 3 : r.stars, 1, 3), msg: r.msg, stats: r.stats }); };
      /** L.fail(msg) */
      L.fail = function (msg) { end({ win: false, msg: msg }); };
      L.abort = function () { end({ abort: true }); };
      L._cleanupOnly = function () { end({ abort: true }); };
      return L;
    }

    function startLevel(idx) {
      flow++;
      if (current && current.alive) current.abort();
      ui.closeTalk(); ui.closeModals();
      drawDots(idx);
      var L = current = makeL(idx), lv = def.levels[idx];
      var introP = Promise.resolve();
      if (lv.intro && lv.intro.length && !(g.stars[idx] > 0 && L.fails > 0)) introP = ui.talk(lv.intro);
      introP.then(function () {
        if (!L.alive) return;
        if (lv.goal) ui.toast("🎯 " + lv.goal, "info", 2600);
        try { var p = lv.play(L); if (p && p.catch) p.catch(function (e) { console.error(e); }); } catch (e) { console.error(e); }
      });
      L.done.then(function (res) { if (current === L) onEnd(idx, res, flow); });
    }

    function onEnd(idx, res, my) {
      ui.closeTalk();
      if (res.abort || my !== flow) return;
      function stale() { return my !== flow; }
      if (!res.win) {
        fails[idx] = (fails[idx] || 0) + 1;
        audio.sfx("lose");
        ui.modal({ icon: RQ.chars ? '<div style="width:110px;height:110px;margin:auto">' + RQ.chars.svg("bug", { mood: "happy" }) + "</div>" : "🐞",
          title: "Oops! Try again?", html: "<p>" + ui.md(res.msg || "The Glitch Bugs got that one.") + "</p>" + (fails[idx] >= 2 ? '<p class="muted">Tip: watch for the 💡 hints.</p>' : ""),
          buttons: [{ label: "↻ Try again", cls: "go", value: "retry" }, { label: "Levels", value: "levels" }], dismiss: false })
          .then(function (v) { if (stale()) return; if (v === "levels") levelSelect(); else startLevel(idx); });
        return;
      }
      fails[idx] = 0;
      var rec = save.recordLevel(def.id, idx, res.stars, res.stats);
      g = save.game(def.id);
      drawDots(idx);
      var newCards = (def.levels[idx].cards || []).filter(function (c) { return RQ.cards.all[c] && RQ.cards.give(c); });
      var last = idx === def.levels.length - 1;
      var allDone = def.levels.every(function (l, i) { return (g.stars[i] || 0) > 0; });
      var newlyDone = allDone && !g.done;
      if (newlyDone) save.markDone(def.id); // saved now, even if the kid leaves before closing the dialogs
      audio.sfx("win"); ui.confetti();
      var statsHTML = "";
      if (res.stats) { statsHTML = '<div class="rq-stats">'; for (var k in res.stats) statsHTML += '<span class="chip">' + u.esc(k) + ": <b>" + u.esc(res.stats[k]) + "</b></span>"; statsHTML += "</div>"; }
      var starRow = '<div class="rq-stars" aria-label="' + res.stars + ' of 3 stars"><span>⭐</span><span>⭐</span><span>⭐</span></div>';
      var buttons = [];
      if (!last) buttons.push({ label: "Next level ▶", cls: "go", value: "next" });
      else buttons.push({ label: allDone ? "🗺️ Back to the map" : "Levels", cls: "go", value: allDone ? "map" : "levels" });
      buttons.push({ label: "↻ Replay", value: "replay" });
      if (!last) buttons.push({ label: "Levels", value: "levels" });
      var p = ui.modal({ title: ["Nice!", "Great job!", "Amazing!"][res.stars - 1] + (rec.improved && !rec.first ? " New best!" : ""),
        html: starRow + "<p>" + ui.md(res.msg || "Level complete!") + "</p>" + statsHTML + (newCards.length ? '<p class="muted">🃏 You earned ' + newCards.length + " Field Card" + (newCards.length > 1 ? "s" : "") + "!</p>" : ""),
        buttons: buttons, dismiss: false });
      setTimeout(function () { u.$$(".rq-stars span").forEach(function (s, i) { if (i < res.stars) setTimeout(function () { s.classList.add("on"); audio.sfx("coin"); }, 250 * i); }); }, 200);
      p.then(function (v) {
        var chain = Promise.resolve();
        newCards.forEach(function (c) { chain = chain.then(function () { if (!stale()) return ui.card(c); }); });
        return chain.then(function () {
          if (newlyDone && def.outro && !stale()) return ui.talk(def.outro).then(function () { return v; });
          return v;
        });
      }).then(function (v) {
        if (stale()) return;
        var go = function () {
          if (v === "next") startLevel(idx + 1);
          else if (v === "replay") startLevel(idx);
          else if (v === "map") location.href = mapHref;
          else levelSelect();
        };
        if (RQ.breakDue()) RQ.takeBreak().then(function (b) { if (stale()) return; if (b === 2) location.href = mapHref; else go(); });
        else go();
      });
    }

    function levelSelect() {
      flow++;
      ui.closeTalk(); ui.closeModals(); drawDots(-1); if (current && current.alive) current.abort();
      stage.innerHTML = ""; hud.innerHTML = "";
      var grid = u.el("div", { class: "rq-levels" });
      def.levels.forEach(function (lv, i) {
        var st = g.stars[i] || 0;
        grid.appendChild(u.el("button", { class: "rq-level", onclick: function () { audio.sfx("select"); startLevel(i); } },
          u.el("div", { class: "n", text: String(i + 1) }), u.el("div", { class: "t", text: lv.title }), u.el("div", { class: "s", html: ui.starsHTML(st) })));
      });
      var node = u.el("div", {}, meta.tagline ? u.el("p", { class: "muted", text: meta.tagline }) : null, grid);
      var my = flow;
      ui.modal({ icon: meta.icon, title: meta.title, node: node, buttons: [{ label: "🗺️ Map", value: "map" }], dismiss: false })
        .then(function (v) { if (v === "map" && my === flow) location.href = mapHref; });
    }

    // pause
    var pauseOpen = false;
    function setPaused(p) {
      if (!current || !current.alive) return;
      var Lp = current, my = flow;
      Lp.paused = p; audio.muteHums(p);
      if (!p) Lp._resume();
      if (p && !pauseOpen) {
        pauseOpen = true; audio.stopVoice();
        ui.modal({ icon: "⏸", title: "Paused", html: "<p>Take a breath. Your game is waiting.</p>", buttons: [{ label: "▶ Keep playing", cls: "go", value: "go" }, { label: "↻ Restart level", value: "restart" }, { label: "Levels", value: "levels" }] })
          .then(function (v) {
            pauseOpen = false;
            if (my !== flow || Lp !== current) return;
            Lp.paused = false; audio.muteHums(false); Lp._resume();
            if (v === "restart") startLevel(Lp.index); else if (v === "levels") levelSelect();
          });
      }
    }
    pauseBtn.onclick = function () { audio.sfx("click"); setPaused(true); };
    document.addEventListener("visibilitychange", function () { if (document.hidden) setPaused(true); });

    // boot
    audio.music(def.music || "camp");
    var hashLevel = /level=(\d+)/.exec(location.hash);
    if (def.onReady) def.onReady(shell);
    var firstTime = !g.plays && !(g.stars || []).some(Boolean);
    if (hashLevel) startLevel(u.clamp(parseInt(hashLevel[1], 10) - 1, 0, def.levels.length - 1));
    else if (firstTime) {
      drawDots(0);
      var bootFlow = flow;
      var start = u.el("div", { class: "fill center" }, u.el("button", { class: "btn big primary pulse", html: "▶ Start", onclick: function (e) {
        e.currentTarget.disabled = true; audio.ctx(); audio.music(def.music || "camp");
        ui.talk(def.intro || []).then(function () { if (flow === bootFlow) startLevel(0); });
      } }));
      stage.appendChild(start);
    } else levelSelect();
    RQ.shell = shell;
    return shell;
  };

  /* =========================================================== on-screen keyboard (US QWERTY) */
  var kb = RQ.keyboard = {};
  // finger ids: lp lr lm li | ri rm rr rp | th
  kb.FINGERS = { lp: "#ff8fa3", lr: "#ffc078", lm: "#ffe066", li: "#8ce99a", ri: "#74c0fc", rm: "#b197fc", rr: "#f783ac", rp: "#63e6be", th: "#ced4da" };
  kb.FINGER_NAMES = { lp: "left pinky", lr: "left ring finger", lm: "left middle finger", li: "left pointer finger", ri: "right pointer finger", rm: "right middle finger", rr: "right ring finger", rp: "right pinky", th: "thumb" };
  var ROWS = [
    [["`", "~", "lp"], ["1", "!", "lp"], ["2", "@", "lr"], ["3", "#", "lm"], ["4", "$", "li"], ["5", "%", "li"], ["6", "^", "ri"], ["7", "&", "ri"], ["8", "*", "rm"], ["9", "(", "rr"], ["0", ")", "rp"], ["-", "_", "rp"], ["=", "+", "rp"], ["Backspace", null, "rp", 2]],
    [["Tab", null, "lp", 1.5], ["q", "Q", "lp"], ["w", "W", "lr"], ["e", "E", "lm"], ["r", "R", "li"], ["t", "T", "li"], ["y", "Y", "ri"], ["u", "U", "ri"], ["i", "I", "rm"], ["o", "O", "rr"], ["p", "P", "rp"], ["[", "{", "rp"], ["]", "}", "rp"], ["\\", "|", "rp", 1.5]],
    [["CapsLock", null, "lp", 1.8], ["a", "A", "lp"], ["s", "S", "lr"], ["d", "D", "lm"], ["f", "F", "li"], ["g", "G", "li"], ["h", "H", "ri"], ["j", "J", "ri"], ["k", "K", "rm"], ["l", "L", "rr"], [";", ":", "rp"], ["'", '"', "rp"], ["Enter", null, "rp", 2.2]],
    [["ShiftL", null, "lp", 2.4], ["z", "Z", "lp"], ["x", "X", "lr"], ["c", "C", "lm"], ["v", "V", "li"], ["b", "B", "li"], ["n", "N", "ri"], ["m", "M", "ri"], [",", "<", "rm"], [".", ">", "rr"], ["/", "?", "rp"], ["ShiftR", null, "rp", 2.4]],
    [[" ", null, "th", 7]]
  ];
  var KEYMAP = {}; // char -> {id, finger, shift}
  ROWS.forEach(function (row) { row.forEach(function (k) {
    KEYMAP[k[0]] = { id: k[0], finger: k[2], shift: false };
    if (k[1]) KEYMAP[k[1]] = { id: k[0], finger: k[2], shift: true };
  }); });
  kb.HOME = "asdfjkl;";
  /** Which key and finger types this character. {id, finger, shift, shiftId} */
  kb.info = function (ch) {
    if (ch === "\n") ch = "Enter";
    var i = KEYMAP[ch]; if (!i) return null;
    var r = { id: i.id, finger: i.finger, shift: i.shift };
    if (i.shift) r.shiftId = /^(lp|lr|lm|li)$/.test(i.finger) ? "ShiftR" : "ShiftL"; // opposite hand holds Shift
    return r;
  };
  /** kb.mount(container, {fingers:true, compact:false}) -> {el, highlight(ch|null), flash(ch, ok), destroy()} */
  kb.mount = function (container, opts) {
    opts = opts || {};
    var size = opts.compact === "tiny" ? .66 : opts.compact ? .82 : 1;
    var root = u.el("div", { class: "rq-kb" + (opts.compact === "tiny" ? " compact tiny" : opts.compact ? " compact" : ""), "aria-hidden": "true" }), keys = {};
    ROWS.forEach(function (row) {
      var r = u.el("div", { class: "kr" });
      row.forEach(function (k) {
        var label = k[0] === " " ? "space" : k[0] === "ShiftL" || k[0] === "ShiftR" ? "shift" : k[0] === "CapsLock" ? "caps" : k[0] === "Backspace" ? "⌫" : k[0] === "Enter" ? "enter ⏎" : k[0].length === 1 ? k[0].toUpperCase() : k[0].toLowerCase();
        var e = u.el("div", { class: "k" + (opts.fingers !== false ? " fz" : "") + (/^[fj]$/.test(k[0]) ? " home" : ""), style: { flex: "0 0 auto", minWidth: (k[3] ? 42 * k[3] + 6 * (k[3] - 1) : 42) * size + "px" } },
          k[1] && !/[A-Z]/.test(k[1]) ? u.el("small", { text: k[1] }) : null, label);
        e.style.setProperty("--fz", kb.FINGERS[k[2]]);
        keys[k[0]] = e; r.appendChild(e);
      });
      root.appendChild(r);
    });
    container.appendChild(root);
    var lit = [];
    var api = {
      el: root,
      highlight: function (ch) {
        lit.forEach(function (e) { e.classList.remove("hi"); }); lit = [];
        if (ch == null) return null;
        var i = kb.info(ch); if (!i) return null;
        [i.id, i.shiftId].forEach(function (id) { if (id && keys[id]) { keys[id].classList.add("hi"); lit.push(keys[id]); } });
        return i;
      },
      flash: function (ch, ok) {
        var i = kb.info(ch); if (!i || !keys[i.id]) return;
        var e = keys[i.id], c = ok ? "ok" : "no"; e.classList.add(c); setTimeout(function () { e.classList.remove(c); }, 140);
      },
      destroy: function () { root.remove(); }
    };
    return api;
  };

  /* =========================================================== terminal */
  var term = RQ.term = {};
  /** Light markup for terminal text: [g]green[/g] [r] [y] [b] [m] [c] [w] [dim]. Text is escaped first. */
  term.markup = function (s) {
    return u.esc(s).replace(/\[(g|r|y|b|m|c|w|dim)\]([\s\S]*?)\[\/\1\]/g, '<span class="$1">$2</span>');
  };
  /**
   * term.mount(container, {user:'kid', host:'basecamp', cwd:'~', title, height, env}) ->
   *   {print(text, cls), printSlow(lines, ms), progress(label, ms), ask(spec) -> Promise<cmd>, setEnv(name), clear(), focus(), el}
   * ask spec: {expect: string | RegExp | (cmd)=>bool, ghost: 'text to show faintly', hint, wrong:(cmd)=>message|null, tabComplete: true}
   */
  term.mount = function (container, o) {
    o = o || {};
    var el = u.el("div", { class: "rq-term", style: { height: o.height || "100%" } });
    var bar = u.el("div", { class: "bar" }, u.el("i", { style: { background: "#ff5f56" } }), u.el("i", { style: { background: "#ffbd2e" } }), u.el("i", { style: { background: "#27c93f" } }), u.el("span", { text: "  " + (o.title || (o.user || "kid") + "@" + (o.host || "basecamp")) }));
    var out = u.el("div"); el.appendChild(bar); el.appendChild(out); container.appendChild(el);
    var api = { el: el, env: o.env || null, cwd: o.cwd || "~", user: o.user || "kid", host: o.host || "basecamp", history: [] };
    /** o.prompt: custom prompt — a string (escaped, e.g. "PS C:\\>") or a function(api) returning HTML. */
    function ps1() {
      var env = api.env ? "(" + u.esc(api.env) + ") " : "";
      if (typeof o.prompt === "function") return env + o.prompt(api);
      if (typeof o.prompt === "string") return env + '<span class="ps1">' + u.esc(o.prompt) + "</span>";
      return env + '<span class="ps1">' + u.esc(api.user + "@" + api.host) + '</span>:<span class="ps1"><span class="path">' + u.esc(api.cwd) + "</span></span>$";
    }
    api.setPrompt = function (p) { o.prompt = p; };
    api.print = function (text, cls) {
      String(text).split("\n").forEach(function (line) { out.appendChild(u.el("div", { class: "line " + (cls || ""), html: term.markup(line) || "&nbsp;" })); });
      el.scrollTop = el.scrollHeight;
    };
    api.printHTML = function (html) { out.appendChild(u.el("div", { class: "line", html: html })); el.scrollTop = el.scrollHeight; };
    api.printSlow = function (lines, ms) {
      var p = Promise.resolve();
      (Array.isArray(lines) ? lines : String(lines).split("\n")).forEach(function (l) { p = p.then(function () { api.print(l); audio.sfx("tick"); return u.sleep(ms || 120); }); });
      return p;
    };
    api.progress = function (label, ms) {
      var line = u.el("div", { class: "line" }); out.appendChild(line);
      return new Promise(function (res) {
        var t0 = performance.now(), W = 24;
        (function f() {
          var k = Math.min(1, (performance.now() - t0) / (ms || 1500)), n = Math.round(k * W);
          line.innerHTML = term.markup(label + " [g][" + "#".repeat(n) + "[/g][dim]" + ".".repeat(W - n) + "][/dim] " + Math.round(k * 100) + "%");
          el.scrollTop = el.scrollHeight;
          if (k < 1) requestAnimationFrame(f); else res();
        })();
      });
    };
    api.setEnv = function (name) { api.env = name; };
    api.clear = function () { out.innerHTML = ""; };
    var activeInput = null;
    api.focus = function () { if (activeInput) activeInput.focus(); };
    api.ask = function (spec) {
      spec = spec || {};
      var tries = 0; // shared by every retry of this question (hint after 2, ghost after 3)
      return new Promise(function (resolve) {
        (function attempt() {
          var line = u.el("div", { class: "line inputline" });
          line.innerHTML = ps1();
          var inp = u.el("input", { class: "cmd", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Type a command" });
          var ghost = u.el("span", { class: "ghost" });
          var box = u.el("span", { style: { position: "relative", flex: "1", display: "flex" } }, inp);
          if (spec.ghost) { ghost.textContent = spec.ghost; ghost.style.cssText = "position:absolute;left:.6ch;top:0;pointer-events:none;white-space:pre"; box.appendChild(ghost); }
          line.appendChild(box); out.appendChild(line); activeInput = inp; el.scrollTop = el.scrollHeight;
          setTimeout(function () { inp.focus(); }, 30);
          el.onclick = function () { inp.focus(); };
          var hIdx = api.history.length;
          inp.addEventListener("input", function () {
            audio.sfx("type");
            if (spec.ghost) { var v = inp.value; ghost.textContent = spec.ghost.indexOf(v) === 0 ? " ".repeat(v.length) + spec.ghost.slice(v.length) : ""; }
            if (spec.onInput) spec.onInput(inp.value);
          });
          inp.addEventListener("keydown", function (e) {
            if (e.key === "Tab") {
              // complete only an unfinished, matching prefix; otherwise let Tab move focus as usual
              if (!e.shiftKey && spec.tabComplete !== false && typeof spec.expect === "string" && inp.value.length > 0 &&
                  spec.expect.indexOf(inp.value) === 0 && inp.value !== spec.expect) {
                e.preventDefault(); inp.value = spec.expect; ghost.textContent = ""; audio.sfx("pop");
              }
            } else if (e.key === "ArrowUp") { if (hIdx > 0) { hIdx--; inp.value = api.history[hIdx]; } e.preventDefault(); }
            else if (e.key === "ArrowDown") { if (hIdx < api.history.length) { hIdx++; inp.value = api.history[hIdx] || ""; } e.preventDefault(); }
            else if (e.key === "Enter") {
              e.preventDefault();
              var cmd = inp.value.replace(/\s+/g, " ").trim();
              var ok = typeof spec.expect === "string" ? cmd === spec.expect.replace(/\s+/g, " ").trim()
                : spec.expect instanceof RegExp ? spec.expect.test(cmd) : typeof spec.expect === "function" ? !!spec.expect(cmd) : true;
              if (!ok && cmd === "") return;
              var frozen = u.el("div", { class: "line", html: ps1() + " " + u.esc(inp.value) });
              line.replaceWith(frozen); activeInput = null; api.history.push(cmd);
              if (ok) { audio.sfx("beep"); resolve(cmd); return; }
              tries++; audio.sfx("error");
              var msg = spec.wrong ? spec.wrong(cmd, tries) : null;
              api.print(msg || ("[r]" + (cmd.split(" ")[0] || "?") + ": that didn't work.[/r] " + (spec.hint && tries >= 2 ? "[y]Hint: " + spec.hint + "[/y]" : "Try again!")));
              if (tries >= 3 && typeof spec.expect === "string" && !spec.ghost) { spec.ghost = spec.expect; api.print("[y]Type it like the grey letters show. Tab finishes it for you.[/y]"); }
              attempt();
            }
          });
        })();
      });
    };
    return api;
  };

  /* =========================================================== code (python) */
  var code = RQ.code = {};
  var KW = "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case".split(" ");
  var BI = "print len range int float str list dict set tuple round abs min max sum sorted enumerate zip open input type isinstance math np torch".split(" ");
  /** Python source -> highlighted HTML (escaped). */
  code.highlight = function (src) {
    var out = "", i = 0, s = String(src);
    var re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|f?"(?:\\.|[^"\\\n])*"|f?'(?:\\.|[^'\\\n])*')|(@[A-Za-z_][\w.]*)|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_]\w*)|(\s+)|([^\sA-Za-z_\d])/g, m, prevDef = false;
    while ((m = re.exec(s))) {
      var t = u.esc(m[0]);
      if (m[1]) out += '<span class="py-com">' + t + "</span>";
      else if (m[2]) out += '<span class="py-str">' + t + "</span>";
      else if (m[3]) out += '<span class="py-dec">' + t + "</span>";
      else if (m[4]) out += '<span class="py-num">' + t + "</span>";
      else if (m[5]) {
        var w = m[5];
        if (prevDef) { out += '<span class="py-fn">' + t + "</span>"; prevDef = false; }
        else if (KW.indexOf(w) >= 0) { out += '<span class="py-kw">' + t + "</span>"; prevDef = (w === "def" || w === "class"); }
        else if (w === "self") out += '<span class="py-self">' + t + "</span>";
        else if (BI.indexOf(w) >= 0) out += '<span class="py-bi">' + t + "</span>";
        else if (s[re.lastIndex] === "(") out += '<span class="py-fn">' + t + "</span>";
        else out += t;
      } else if (m[6]) out += t;
      else out += '<span class="py-op">' + t + "</span>";
    }
    return out;
  };
  /** code.block(src, {lines:true, hl:[lineNumbers], lang}) -> <pre> element */
  code.block = function (src, o) {
    o = o || {};
    var html = code.highlight(src).split("\n").map(function (l, i) {
      var n = i + 1, inner = (o.lines ? '<span class="ln">' + n + "</span>" : "") + (l || " ");
      return o.hl && o.hl.indexOf(n) >= 0 ? '<span class="hl">' + inner + "</span>" : inner;
    }).join("\n");
    return u.el("pre", { class: "rq-code", html: html });
  };
  /**
   * code.parsons(container, correctLines, {distractors:[], onCheck}) -> {el, check(): bool, order()}
   * Lines are shuffled; drag (or use ▲▼) to reorder; indentation is part of each line.
   */
  code.parsons = function (container, lines, o) {
    o = o || {};
    var items = lines.map(function (l, i) { return { text: l, key: i }; });
    (o.distractors || []).forEach(function (d) { items.push({ text: d, key: -1 }); });
    var order = u.shuffle(items);
    // never start already solved
    if (order.length > 1 && order.every(function (it, i) { return it.key === i; })) order.push(order.shift());
    var root = u.el("div", { class: "rq-parsons" });
    container.appendChild(root);
    var dragEl = null;
    function render() {
      root.innerHTML = "";
      order.forEach(function (it, idx) {
        var row = u.el("div", { class: "pl", draggable: "true", dataset: { i: idx } },
          u.el("span", { html: "⠿ " }), u.el("span", { html: code.highlight(it.text) }),
          u.el("span", { class: "mv" },
            u.el("button", { "aria-label": "move up", html: "▲", onclick: function (e) { e.stopPropagation(); move(idx, idx - 1); } }),
            u.el("button", { "aria-label": "move down", html: "▼", onclick: function (e) { e.stopPropagation(); move(idx, idx + 1); } })));
        row.addEventListener("dragstart", function () { dragEl = idx; row.classList.add("drag"); });
        row.addEventListener("dragend", function () { row.classList.remove("drag"); });
        row.addEventListener("dragover", function (e) { e.preventDefault(); });
        row.addEventListener("drop", function (e) { e.preventDefault(); if (dragEl != null) move(dragEl, idx); dragEl = null; });
        // touch drag
        row.addEventListener("touchstart", function () { dragEl = idx; }, { passive: true });
        row.addEventListener("touchend", function (e) {
          var t = e.changedTouches[0], target = document.elementFromPoint(t.clientX, t.clientY);
          var r = target && target.closest && target.closest(".pl");
          if (r && dragEl != null) move(dragEl, parseInt(r.dataset.i, 10)); dragEl = null;
        });
        root.appendChild(row);
      });
    }
    function move(a, b) {
      if (b < 0 || b >= order.length || a === b) return;
      var it = order.splice(a, 1)[0]; order.splice(b, 0, it); audio.sfx("tick"); render();
    }
    render();
    return {
      el: root,
      order: function () { return order.map(function (it) { return it.text; }); },
      /** Correct if the non-distractor lines are in order, at the top, and distractors are moved to the end (after a ---) or excluded. */
      check: function () {
        var want = lines.length, ok = true;
        var rows = u.$$(".pl", root);
        order.forEach(function (it, i) {
          var good = i < want ? it.key === i : it.key === -1;
          rows[i].classList.remove("ok", "no"); rows[i].classList.add(good ? "ok" : "no");
          if (!good) ok = false;
        });
        audio.sfx(ok ? "good" : "bad");
        return ok;
      }
    };
  };
  /**
   * code.blanks(container, template, {onChange}) — template uses [[answer|alt1|alt2]] for inputs.
   * Returns {el, check(): bool, inputs}
   */
  code.blanks = function (container, template, o) {
    o = o || {};
    var answers = [], html = "", last = 0, re = /\[\[(.+?)\]\]/g, m;
    while ((m = re.exec(template))) {
      html += code.highlight(template.slice(last, m.index));
      var alts = m[1].split("|");
      answers.push(alts);
      html += '<input class="rq-blank" data-k="' + (answers.length - 1) + '" size="' + Math.max(3, alts[0].length) + '" autocomplete="off" spellcheck="false" aria-label="blank ' + answers.length + '">';
      last = re.lastIndex;
    }
    html += code.highlight(template.slice(last));
    var pre = u.el("pre", { class: "rq-code", html: html });
    container.appendChild(pre);
    var inputs = u.$$("input", pre);
    inputs.forEach(function (inp, i) {
      inp.addEventListener("input", function () { inp.classList.remove("ok", "no"); audio.sfx("type"); if (o.onChange) o.onChange(); });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (inputs[i + 1]) inputs[i + 1].focus(); else if (o.onEnter) o.onEnter(); } });
    });
    if (inputs[0]) setTimeout(function () { inputs[0].focus(); }, 50);
    var norm = function (s) { return String(s).replace(/\s+/g, "").replace(/"/g, "'"); };
    return {
      el: pre, inputs: inputs,
      check: function () {
        var ok = true;
        inputs.forEach(function (inp, i) {
          var good = answers[i].some(function (a) { return norm(a) === norm(inp.value); });
          inp.classList.remove("ok", "no"); inp.classList.add(good ? "ok" : "no"); if (!good) ok = false;
        });
        audio.sfx(ok ? "good" : "bad");
        return ok;
      }
    };
  };
})();
