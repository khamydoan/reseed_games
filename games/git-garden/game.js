/* g24 Git Garden — git and the web (Share island).
 * Every `git commit` plants a labelled tree in a history garden; a branch grows a side path and `git merge` joins it back;
 * `git push` flies the work to github.com where GitHub Actions robots run the tests while Pages opens the shop window;
 * then the kid writes a tiny HTML page and delivers parcels to github.com / github.io / airesearchcenter.com.
 * Real facts: ReSeed's own `git log --oneline`, .github/workflows/tests.yml + pages.yml, README (Pages + Google Sites iframe). */
(function () {
  "use strict";
  var u = RQ.u, INK = "#1d2b3a", FONT = "Fredoka, sans-serif", MONO = "'JetBrains Mono', monospace";

  /* ------------------------------------------------------------ real ReSeed history (git log --oneline, oldest first) */
  var REAL = [
    ["c04a049", "ReSeed v2: satellite forest classifier, Greenblatt NDVI, seed-drone mission control", "ReSeed v2: forest classifier + drones"],
    ["9775fdf", "fix(qa): ISSUE-001 — deck height scales with the window; compact rails on short screens", "fix(qa): deck fits the window"],
    ["d72156f", "fix(qa): ISSUE-002 — skipped pipeline runs still draw the last ForestNet result"],
    ["a43bb9e", "fix(qa): ISSUE-003 — event log drops the time column in narrow panels; legend wraps instead of clipping"],
    ["9f532ad", "fix(qa): ISSUE-004 — non-forest sites replace the NDVI panel instead of leaving the previous site's"],
    ["8e08459", "fix(qa): ISSUE-005 — probe the second-opinion API only when served from localhost", "fix(qa): API only on localhost"],
    ["e22674a", "fix(qa): ISSUE-006 — seed payload panel stays visible in mission mode on short screens"],
    ["8b860dd", "fix(qa): ISSUE-007 — Release button shows a busy state until the seeds land"],
    ["6924637", "fix(qa): ISSUE-008 — site rows and globe markers are keyboard buttons with labels"],
    ["e60e7ba", "style: readable unselected toggle labels over the 3D view"],
    ["81e8c68", "chore: ignore log files (conversation exports can contain secrets)", "chore: ignore log files"],
    ["e2ee761", "Make the step numbers match the code everywhere", "Make the step numbers match"]
  ];

  /* ------------------------------------------------------------ drawing helpers */
  var IMG = {};
  function svgURL(who, mood) { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(RQ.chars.svg(who, { mood: mood || "happy", size: 120 })); }
  function drawChar(ctx, who, x, y, s, mood) {
    var k = who + (mood || "");
    if (!IMG[k]) { IMG[k] = new Image(); IMG[k].src = svgURL(who, mood); }
    if (IMG[k].complete && IMG[k].naturalWidth) ctx.drawImage(IMG[k], x - s / 2, y - s / 2, s, s);
  }
  function wrapLines(ctx, text, maxW, maxLines) {
    var words = String(text).split(/\s+/), lines = [], cur = "";
    words.forEach(function (w) {
      var test = cur ? cur + " " + w : w;
      if (!cur || ctx.measureText(test).width <= maxW) cur = test; else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var l = lines[maxLines - 1];
      while (l.length > 1 && ctx.measureText(l + "…").width > maxW) l = l.slice(0, -1);
      lines[maxLines - 1] = l + "…";
    }
    return lines.map(function (l) { // a single long word: cut it
      while (l.length > 2 && ctx.measureText(l).width > maxW) l = l.slice(0, -2) + "…";
      return l;
    });
  }
  function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function text(ctx, s, x, y, font, color, align, base) {
    ctx.font = font; ctx.fillStyle = color || INK; ctx.textAlign = align || "center"; ctx.textBaseline = base || "middle"; ctx.fillText(s, x, y);
  }
  function pill(ctx, s, x, y, font, bg, fg, padX) {
    ctx.font = font; var w = ctx.measureText(s).width + (padX || 12) * 2, h = 26;
    ctx.fillStyle = bg; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; u.rr(ctx, x - w / 2, y - h / 2, w, h, 13); ctx.fill(); ctx.stroke();
    text(ctx, s, x, y + 1, font, fg || INK);
    return w;
  }
  function cloud(ctx, x, y, s) {
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath();
    ctx.arc(x, y, 24 * s, 0, 7); ctx.arc(x + 28 * s, y - 12 * s, 30 * s, 0, 7); ctx.arc(x + 60 * s, y, 22 * s, 0, 7); ctx.fill();
  }
  function skyBg(ctx, W, H, t, c1, c2) {
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1 || "#9fd9ff"); g.addColorStop(1, c2 || "#eaf8ff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (var c = 0; c < 4; c++) cloud(ctx, ((c * 380 + t * (9 + c * 3)) % (W + 300)) - 150, 34 + c * 22, .8 + (c % 2) * .3);
  }
  var KIND = { real: ["#3f9d4a", "#2f7f3a"], kid: ["#5cc867", "#3a9c48"], pix: ["#3fb8a6", "#2c8f82"], merge: ["#6ad07a", "#3a9c48"], hoot: ["#8fbf4a", "#6a9a2f"] };
  var FRUIT = ["#ff8fab", "#ffd23f", "#b197fc", "#ff922b", "#74c0fc"];
  /** A tree whose base is at (x, y). g 0..1 grows it. Top of the canopy ≈ y − 108·sc. */
  function treeArt(ctx, x, y, g, kind, t, sc, seed) {
    if (g <= 0) return;
    var k = KIND[kind] || KIND.kid, s = sc || 1, e = u.ease.outBack(u.clamp(g, 0, 1));
    var th = 52 * s * u.clamp(g * 1.6, 0, 1), r = 32 * s * e, sway = Math.sin(t * 1.4 + x * .05) * 2 * g;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = "round";
    ctx.fillStyle = "#8a5a35"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(-4 * s + sway * .3, -th); ctx.lineTo(4 * s + sway * .3, -th); ctx.lineTo(7 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (r > 1) {
      ctx.translate(sway, -th - r * .55);
      var blobs = [[-r * .62, r * .15, r * .72], [r * .62, r * .15, r * .72], [0, -r * .35, r * .86], [0, r * .25, r * .7]];
      ctx.fillStyle = INK; blobs.forEach(function (b) { ctx.beginPath(); ctx.arc(b[0], b[1], b[2] + 3, 0, 7); ctx.fill(); });
      ctx.fillStyle = k[0]; blobs.forEach(function (b) { ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, 7); ctx.fill(); });
      ctx.globalAlpha = .45; ctx.fillStyle = k[1]; ctx.beginPath(); ctx.arc(r * .35, r * .4, r * .45, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(-r * .3, -r * .6, r * .22, 0, 7); ctx.fill();
      if (kind !== "real" && g > .75) {
        var rng = u.seeded(seed || 7), col = FRUIT[(seed || 0) % FRUIT.length];
        for (var i = 0; i < (kind === "merge" ? 9 : 5); i++) {
          var a = rng() * 6.28, d = rng() * r * .85, fx = Math.cos(a) * d, fy = Math.sin(a) * d * .8;
          ctx.fillStyle = kind === "merge" ? "#ffd23f" : col; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(fx, fy, (kind === "merge" ? 6 : 5) * s, 0, 7); ctx.fill(); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  function signArt(ctx, x, y, w, hash, msg, glow) {
    ctx.font = "500 16px " + FONT;
    var lines = wrapLines(ctx, msg, w - 14, 2), h = 26 + lines.length * 18;
    ctx.fillStyle = "#8a5a35"; ctx.fillRect(x - 3, y - 12, 6, 14);
    if (glow > 0) { ctx.fillStyle = "rgba(255,227,110," + Math.min(1, glow) * .8 + ")"; u.rr(ctx, x - w / 2 - 6, y - 6, w + 12, h + 12, 14); ctx.fill(); }
    ctx.fillStyle = "#fff8e6"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    u.rr(ctx, x - w / 2, y, w, h, 9); ctx.fill(); ctx.stroke();
    text(ctx, hash, x, y + 5, "700 15px " + MONO, "#b0532b", "center", "top");
    ctx.font = "500 16px " + FONT; ctx.fillStyle = INK;
    lines.forEach(function (l, i) { ctx.fillText(l, x, y + 23 + i * 18); });
  }
  function birdArt(ctx, x, y, t, flying, color, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir || 1, 1); ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-18, -5); ctx.lineTo(-17, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0, 0, 7); ctx.fill(); ctx.stroke();
    var flap = flying ? Math.sin(t * 22) * 9 : 2;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(-2, -3 - flap * .5, 7, 4 + Math.abs(flap) * .4, -.4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ff922b"; ctx.beginPath(); ctx.moveTo(11, -2); ctx.lineTo(18, 0); ctx.lineTo(11, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(6, -3, 1.8, 0, 7); ctx.fill();
    ctx.restore();
  }
  function beeArt(ctx, x, y, t, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.ellipse(-2, -9, 6, Math.abs(Math.sin(t * 30)) * 7 + 3, -.4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(-4, -7, 3, 14); ctx.fillRect(2, -7, 3, 14);
    ctx.restore();
  }
  /** GitHub Actions robot, feet at (x, y). st: idle | scan | pass | fail | skip. The antenna always wiggles. */
  function robotArt(ctx, x, y, t, st, col, ph, sc) {
    var bob = st === "scan" ? Math.sin(t * 22) * 1.5 : Math.sin(t * 2 + ph) * 1.2;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc || 1, sc || 1); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = "round";
    ctx.fillStyle = "#4a5b6d"; u.rr(ctx, -24, -12, 48, 12, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = st === "skip" ? "#c9d1da" : col; u.rr(ctx, -22, -52 + bob, 44, 40, 10); ctx.fill(); ctx.stroke();
    // arms
    var arm = st === "scan" ? Math.sin(t * 16) * .3 - .6 : .2;
    [[-1, 0], [1, 1]].forEach(function (a) {
      ctx.save(); ctx.translate(a[0] * 22, -42 + bob); ctx.rotate(a[0] * (a[1] ? arm : .25));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(a[0] * 12, 16); ctx.stroke(); ctx.restore();
    });
    var light = st === "pass" ? "#2f9e4f" : st === "fail" ? (Math.sin(t * 12) > 0 ? "#ff4d5e" : "#a8202f") : st === "scan" ? (Math.sin(t * 18) > 0 ? "#ffd23f" : "#fff6c2") : "#cfd6de";
    ctx.fillStyle = light; ctx.beginPath(); ctx.arc(0, -32 + bob, 8, 0, 7); ctx.fill(); ctx.stroke();
    // head + antenna
    var amp = st === "scan" ? 10 : st === "fail" ? 13 : 5, spd = st === "scan" ? 16 : st === "fail" ? 20 : 3.5;
    var tipx = Math.sin(t * spd + ph) * amp, hy = -86 + bob;
    ctx.beginPath(); ctx.moveTo(0, hy); ctx.quadraticCurveTo(-tipx * .8, hy - 12, tipx, hy - 24); ctx.stroke();
    ctx.fillStyle = st === "fail" ? light : st === "pass" ? "#8ce99a" : "#ffd23f"; ctx.beginPath(); ctx.arc(tipx, hy - 25, 6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e9eef4"; u.rr(ctx, -20, hy, 40, 32, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#26364a"; u.rr(ctx, -14, hy + 6, 28, 18, 5); ctx.fill();
    ctx.strokeStyle = st === "fail" ? "#ff7b72" : "#7ee787"; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2.5;
    if (st === "pass") { ctx.beginPath(); ctx.arc(-6, hy + 17, 3.5, Math.PI, 0); ctx.arc(6, hy + 17, 3.5, Math.PI, 0); ctx.stroke(); }
    else if (st === "fail") { [-6, 6].forEach(function (ex) { ctx.beginPath(); ctx.moveTo(ex - 3, hy + 12); ctx.lineTo(ex + 3, hy + 18); ctx.moveTo(ex + 3, hy + 12); ctx.lineTo(ex - 3, hy + 18); ctx.stroke(); }); }
    else { var look = st === "scan" ? Math.sin(t * 6) * 3 : 0, blink = (Math.sin(t * 1.3 + ph) > .97) ? .3 : 1; [-6, 6].forEach(function (ex) { ctx.beginPath(); ctx.ellipse(ex + look, hy + 15, 2.6, 3.2 * blink, 0, 0, 7); ctx.fill(); }); }
    if (st === "pass" || st === "fail") {
      ctx.fillStyle = st === "pass" ? "#2f9e4f" : "#d1495b"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(26, hy - 4, 13, 0, 7); ctx.fill(); ctx.stroke();
      text(ctx, st === "pass" ? "✓" : "✗", 26, hy - 3, "700 18px " + FONT, "#fff");
    }
    ctx.restore();
  }
  /** A tiny ReSeed Mission Control page (the shop window / the framed picture). */
  function miniSite(ctx, x, y, w, h, t) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = "#0e1726"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#16324a"; ctx.fillRect(x, y, w, h * .17);
    ctx.fillStyle = "#7ee787"; ctx.beginPath(); ctx.arc(x + h * .09, y + h * .085, h * .05, 0, 7); ctx.fill();
    ctx.fillStyle = "#e9f8ff"; ctx.fillRect(x + h * .17, y + h * .06, w * .3, h * .05);
    var gx = x + w * .3, gy = y + h * .56, gr = Math.min(w * .2, h * .3);
    ctx.fillStyle = "#2b7bd0"; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, 7); ctx.fill();
    ctx.fillStyle = "#2f9e4f"; ctx.beginPath(); ctx.ellipse(gx - gr * .2 + Math.sin(t * .5) * gr * .15, gy - gr * .1, gr * .45, gr * .3, .5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(gx + gr * .35 + Math.sin(t * .5) * gr * .15, gy + gr * .4, gr * .3, gr * .2, -.3, 0, 7); ctx.fill();
    ctx.strokeStyle = "#7ee787"; ctx.lineWidth = Math.max(1.5, h * .02); ctx.beginPath();
    for (var i = 0; i <= 12; i++) { var px = x + w * .58 + i * w * .034, py = y + h * (.7 - .22 * Math.sin(i / 12 * Math.PI) * (.8 + .2 * Math.sin(t + i))); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.fillStyle = "#ffd23f"; var dx = x + w * .58 + ((t * 30) % (w * .4)); ctx.beginPath(); ctx.arc(dx, y + h * .3, Math.max(2, h * .03), 0, 7); ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------ git model */
  function Repo() {
    var R = { commits: [], branches: { main: -1 }, lane: { main: 0 }, fork: {}, head: "main", order: ["main"], cols: 0, pushed: -1 };
    R.hash = function (msg) { return ("0000000" + u.fnv(msg + ":" + R.commits.length + ":" + Math.random()).toString(16)).slice(-7); };
    R.add = function (c) {
      c.i = R.commits.length; c.vis = c.vis !== false; c.col = c.vis ? R.cols++ : -1; c.g = c.g == null ? 0 : c.g;
      c.lane = R.lane[c.branch] || 0; R.commits.push(c); R.branches[c.branch] = c.i; return c;
    };
    R.commitOn = function (branch, msg, kind, other) {
      var p = R.branches[branch], parents = p >= 0 ? [p] : [];
      if (other != null) parents.push(other);
      return R.add({ h: R.hash(msg), msg: msg, kind: kind, branch: branch, parents: parents });
    };
    /** Add the real ReSeed commits; only `show` hashes become trees, the rest are counted as "+N more". */
    R.addReal = function (show) {
      REAL.forEach(function (r) {
        var p = R.branches.main;
        R.add({ h: r[0], msg: r[1], short: r[2] || r[1], kind: "real", branch: "main", parents: p >= 0 ? [p] : [], g: 1, vis: show.indexOf(r[0]) >= 0 });
      });
      R.pushed = R.branches.main;
    };
    R.makeBranch = function (name) { R.branches[name] = R.branches[R.head]; R.lane[name] = 1; R.fork[name] = R.branches[R.head]; R.order.push(name); };
    R.ancestors = function (i) {
      var seen = {}, st = [i];
      while (st.length) { var k = st.pop(); if (k == null || k < 0 || seen[k]) continue; seen[k] = 1; R.commits[k].parents.forEach(function (p) { st.push(p); }); }
      return seen;
    };
    return R;
  }

  /* ------------------------------------------------------------ terminal + git simulator (levels 1-3) */
  var HELP = ["[w]Commands you can use:[/w]",
    "  [g]git status[/g]           what changed?",
    "  [g]git add FILE[/g]         put a file in the basket",
    '  [g]git commit -m "msg"[/g]   save a snapshot: plant a tree',
    "  [g]git log --oneline[/g]    read the history",
    "  [g]git branch NAME[/g]      start a side path",
    "  [g]git switch NAME[/g]      walk onto a path",
    "  [g]git merge NAME[/g]       join a path into this one",
    "  [g]git push[/g]             send commits to GitHub",
    "  [g]ls[/g] · [g]clear[/g] · [g]help[/g]"].join("\n");

  function tokens(s) {
    var out = [], re = /"([^"]*)"|'([^']*)'|(\S+)/g, m;
    while ((m = re.exec(s))) out.push(m[1] != null ? { v: m[1], q: true } : m[2] != null ? { v: m[2], q: true } : { v: m[3], q: false });
    return out;
  }

  function exec(S, raw) {
    var t = S.t, R = S.R, o = S.opts;
    var c = raw.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").trim();
    function err(msg) { t.print(msg); RQ.audio.sfx("error"); return { type: "error", err: true }; }
    function validName(n) { return /^[A-Za-z0-9._-]{1,30}$/.test(n) && n !== "HEAD"; }
    if ((c.match(/"/g) || []).length % 2) return err('[y]A quote mark is missing. Messages need two: "like this"[/y]');
    var tk = tokens(c), v = tk.map(function (x) { return x.v; });
    if (!v.length) return { type: "none" };
    var w0 = v[0];
    if (w0 === "help") { t.print(HELP); return { type: "help" }; }
    if (w0 === "clear") { t.clear(); return { type: "clear" }; }
    if (w0 === "ls") { t.print(S.tracked.concat(Object.keys(S.files).filter(function (f) { return S.tracked.indexOf(f) < 0; })).map(function (f) { return /\/$/.test(f) ? "[b]" + f + "[/b]" : f; }).join("   ")); return { type: "ls" }; }
    if (w0 === "pwd") { t.print("/home/kid/reseed"); return { type: "pwd" }; }
    if (w0 === "cd") { t.print("[dim](we stay in ~/reseed for this mission)[/dim]"); return { type: "cd" }; }
    if (w0.toLowerCase() === "git" && w0 !== "git") return err("[r]" + w0 + ": command not found[/r]  [y]Commands are lowercase: git[/y]");
    if (w0 !== "git") return err("[r]" + w0 + ": command not found[/r]  [y]Start with git, like the hint shows.[/y]");
    var sub = v[1] || "", args = v.slice(2);
    var dirty = Object.keys(S.files);

    if (sub === "" || sub === "help" || sub === "--help") { t.print(HELP); return { type: "help" }; }
    if (sub === "status") {
      var lines = ["On branch " + R.head], staged = [], unst = [], untr = [];
      dirty.forEach(function (f) {
        var fo = S.files[f];
        if (fo.staged) staged.push((fo.kind === "new" ? "new file:   " : "modified:   ") + f);
        else if (fo.kind === "new") untr.push(f); else unst.push("modified:   " + f);
      });
      if (staged.length) { lines.push("Changes to be committed:"); staged.forEach(function (x) { lines.push("        [g]" + x + "[/g]"); }); }
      if (unst.length) { lines.push("Changes not staged for commit:"); unst.forEach(function (x) { lines.push("        [r]" + x + "[/r]"); }); }
      if (untr.length) { lines.push("Untracked files:  [dim](new files Git isn't saving yet)[/dim]"); untr.forEach(function (x) { lines.push("        [r]" + x + "[/r]"); }); }
      if (!dirty.length) lines.push("nothing to commit, working tree clean");
      else if (!staged.length) lines.push('[dim](use "git add <file>" to put it in the basket)[/dim]');
      t.print(lines.join("\n")); return { type: "status" };
    }
    if (sub === "add") {
      if (!args.length) return err("[r]Nothing specified, nothing added.[/r]  [y]Name the file, like: git add " + (dirty[0] || "map.txt") + "[/y]");
      var added = [];
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === "." || a === "-A" || a === "--all") dirty.forEach(function (f) { if (!S.files[f].staged) { S.files[f].staged = true; added.push(f); } });
        else if (S.files[a]) { if (!S.files[a].staged) { S.files[a].staged = true; added.push(a); } }
        else if (S.tracked.indexOf(a) < 0 && S.tracked.indexOf(a + "/") < 0) {
          var near = dirty.filter(function (f) { return f.toLowerCase() === a.toLowerCase(); })[0];
          return err("[r]fatal: pathspec '" + a + "' did not match any files[/r]" + (near ? "  [y]Capitals matter: " + near + "[/y]" : ""));
        }
      }
      if (added.length) { t.print("[dim](in the basket: " + added.join(", ") + ")[/dim]"); RQ.audio.sfx("pop"); }
      return { type: "add", files: added };
    }
    if (sub === "commit") {
      var all = false, msg = null;
      for (var j = 2; j < tk.length; j++) {
        var f = tk[j];
        if (!f.q && (f.v === "-m" || f.v === "-am" || f.v === "--message")) {
          if (f.v === "-am") all = true;
          var nx = tk[j + 1];
          if (nx && !nx.q && tk[j + 2]) return err('[y]Put the whole message inside quotes: git commit -m "' + v.slice(j + 1).join(" ") + '"[/y]');
          msg = nx ? nx.v : ""; j++;
        } else if (!f.q && f.v === "-a") all = true;
        else return err("[r]error: unknown option '" + f.v + "'[/r]  [y]Try: git commit -m \"your message\"[/y]");
      }
      if (msg == null) return err('[y]Without -m, git opens a text editor for your message. Here, add -m "your message".[/y]');
      msg = msg.trim();
      if (!msg) return err("[r]Aborting commit due to empty commit message.[/r]  [y]Type a few words between the quotes.[/y]");
      if (all) dirty.forEach(function (fl) { if (S.files[fl].kind === "modified") S.files[fl].staged = true; });
      var st = dirty.filter(function (fl) { return S.files[fl].staged; });
      if (!st.length) {
        if (dirty.length) return err('[r]no changes added to commit[/r]  [y]Put the file in the basket first: git add ' + dirty[0] + "[/y]");
        return err("[r]nothing to commit, working tree clean[/r]");
      }
      var cm = R.commitOn(R.head, msg, S.kidKind || "kid");
      st.forEach(function (fl) { delete S.files[fl]; if (S.tracked.indexOf(fl) < 0) S.tracked.push(fl); });
      t.print("[" + R.head + " [y]" + cm.h + "[/y]] " + msg + "\n " + st.length + " file" + (st.length > 1 ? "s" : "") + " changed");
      return { type: "commit", c: cm, branch: R.head, msg: msg };
    }
    if (sub === "log") {
      var anc = R.ancestors(R.branches[R.head]), out = [];
      for (var k = R.commits.length - 1; k >= 0; k--) {
        if (!anc[k]) continue;
        var cc = R.commits[k], names = R.order.filter(function (b) { return R.branches[b] === k; });
        var dec = names.length ? " [c](" + names.map(function (b) { return b === R.head ? "HEAD -> " + b : b; }).join(", ") + ")[/c]" : "";
        if (o.push && k === R.pushed) dec += " [m](origin/main)[/m]";
        out.push("[y]" + cc.h + "[/y]" + dec + " " + clip(cc.msg, 70));
      }
      t.print(out.join("\n")); return { type: "log" };
    }
    if (sub === "branch" || sub === "switch" || sub === "checkout" || sub === "merge") {
      if (!o.branching && !(sub === "branch" && !args.length)) { t.print("[y]Side paths (branches) come in level 2. Let's plant on main first![/y]"); return { type: "later" }; }
    }
    if (sub === "branch") {
      if (!args.length) { t.print(R.order.map(function (b) { return b === R.head ? "* [g]" + b + "[/g]" : "  " + b; }).join("\n")); return { type: "branch-list" }; }
      if (args[0][0] === "-") return err("[y]In this game, use: git branch NAME[/y]");
      if (args.length > 1) return err("[r]fatal: not a valid object name: '" + args[1] + "'[/r]  [y]Branch names have no spaces, like: bee-garden[/y]");
      if (!validName(args[0])) return err("[r]fatal: '" + args[0] + "' is not a valid branch name[/r]");
      if (R.branches[args[0]] != null) return err("[r]fatal: a branch named '" + args[0] + "' already exists[/r]");
      R.makeBranch(args[0]); RQ.audio.sfx("pop");
      t.print("[dim](a new side path called " + args[0] + " starts here)[/dim]");
      return { type: "branch", name: args[0] };
    }
    if (sub === "switch" || sub === "checkout") {
      var create = args[0] === "-c" || args[0] === "-b", nm = create ? args[1] : args[0];
      if (!nm) return err("[y]Switch to where? Like: git switch main[/y]");
      if (create) {
        if (!validName(nm)) return err("[r]fatal: '" + nm + "' is not a valid branch name[/r]");
        if (R.branches[nm] != null) return err("[r]fatal: a branch named '" + nm + "' already exists[/r]");
        R.makeBranch(nm);
      } else if (R.branches[nm] == null) {
        return err(sub === "switch" ? "[r]fatal: invalid reference: " + nm + "[/r]" : "[r]error: pathspec '" + nm + "' did not match any file(s) known to git[/r]");
      }
      if (R.head === nm) { t.print("Already on '" + nm + "'"); return { type: "switch", name: nm, same: true }; }
      R.head = nm; RQ.audio.sfx("jump");
      t.print((create ? "Switched to a new branch '" : "Switched to branch '") + nm + "'");
      return { type: "switch", name: nm, created: create };
    }
    if (sub === "merge") {
      var mn = args[0];
      if (!mn) return err("[y]Merge which path? Like: git merge " + (R.order[1] || "bees") + "[/y]");
      if (R.branches[mn] == null) return err("[r]merge: " + mn + " - not something we can merge[/r]");
      var ha = R.branches[R.head], hb = R.branches[mn];
      if (mn === R.head || R.ancestors(ha)[hb]) { t.print("Already up to date."); return { type: "merge-none", name: mn }; }
      if (R.ancestors(hb)[ha]) { R.branches[R.head] = hb; t.print("Fast-forward"); return { type: "merge", name: mn, ff: true }; }
      var mc = R.commitOn(R.head, "Merge branch '" + mn + "'", "merge", hb);
      t.print("Merge made by the 'ort' strategy.");
      return { type: "merge", name: mn, c: mc };
    }
    if (sub === "push") {
      if (!o.push) { t.print("[y]Pushing comes in level 3! For now the garden lives on this laptop.[/y]"); return { type: "later" }; }
      if (R.head !== "main") return err("[y]Switch to main before pushing: git switch main[/y]");
      var head = R.branches.main;
      if (head === R.pushed) { t.print("Everything up-to-date"); return { type: "push-none" }; }
      t.print("Enumerating objects: 9, done.\nWriting objects: 100% (5/5), done.\nTo https://github.com/khamydoan/reseed.git\n   " +
        R.commits[R.pushed].h + ".." + R.commits[head].h + "  main -> main");
      R.pushed = head;
      return { type: "push" };
    }
    if (sub === "pull") { t.print("Already up to date."); return { type: "pull" }; }
    if (sub === "init") { t.print("Reinitialized existing Git repository in /home/kid/reseed/.git/"); return { type: "init" }; }
    if (sub === "diff") { t.print(dirty.length ? dirty.map(function (fl) { return "[b]diff --git a/" + fl + " b/" + fl + "[/b]\n[g]+ (new lines here)[/g]"; }).join("\n") : ""); return { type: "diff" }; }
    return err("[r]git: '" + sub + "' is not a git command. See 'git help'.[/r]");
  }

  /** Layout for levels 1-3: canvas on top, terminal + mission card below. */
  function consoleScene(L, opts) {
    var S = { L: L, opts: opts, R: Repo(), files: {}, tracked: ["README.md", "environment.yml", "reseed/", "site/", "tests/"],
      mistakes: 0, helps: 0, cmds: 0, stepMiss: 0, seen: {}, lastAct: performance.now(), ghostNow: "" };
    var root = u.el("div", { class: "gg-wrap" }), top = u.el("div", { class: "gg-top" }), bottom = u.el("div", { class: "gg-bottom" });
    var termBox = u.el("div", { class: "gg-term" }), side = u.el("div", { class: "gg-side" });
    S.stepEl = u.el("div", { class: "gg-step", "aria-live": "polite" });
    S.filesEl = u.el("div", { class: "gg-files" });
    S.helpBtn = u.el("button", { class: "btn small warn", html: "💡 Show me", title: "Fill in the next command" });
    side.appendChild(S.stepEl); side.appendChild(S.filesEl); side.appendChild(S.helpBtn);
    bottom.appendChild(termBox); bottom.appendChild(side);
    root.appendChild(top); root.appendChild(bottom); L.stage.appendChild(root);
    S.top = top;
    S.t = RQ.term.mount(termBox, { user: "kid", host: "laptop", cwd: "~/reseed", title: "Terminal · kid@laptop:~/reseed" });
    S.t.print("[dim]Type a command and press Enter. Type [/dim][g]help[/g][dim] for the list. Stuck? Press 💡 Show me.[/dim]");
    S.cv = L.canvas({ w: 980, h: 410, parent: top, fill: true, label: opts.label || "git garden" });
    S.input = function () { return S.t.el.querySelector(".inputline input.cmd"); };
    S.setInput = function (txt, back) {
      var inp = S.input(); if (!inp) return;
      inp.value = txt; inp.dispatchEvent(new Event("input"));
      L.timeout(function () { inp.focus(); var p = txt.length - (back || 0); try { inp.setSelectionRange(p, p); } catch (e) { /* old browser */ } }, 50);
    };
    S.help = function () {
      if (!S.input() || !S.ghostNow) return;
      S.helps++; RQ.audio.sfx("pop"); S.setInput(S.ghostNow);
    };
    L.on(S.helpBtn, "click", function () { S.help(); });
    L.on(top, "click", function () { S.t.focus(); });
    L.on(termBox, "keydown", function (e) {
      S.lastAct = performance.now();
      if (e.key !== "Tab") return;
      var inp = S.input();
      if (inp && inp.value && S.ghostNow && S.ghostNow.indexOf(inp.value) === 0 && inp.value !== S.ghostNow) { S.setInput(S.ghostNow); RQ.audio.sfx("pop"); }
    });
    L.interval(function () {
      if (S.input() && !S.nudged && performance.now() - S.lastAct > 25000) { S.nudged = true; L.toast("💡 Stuck? Press **💡 Show me** or type `help`.", "info", 3500); }
    }, 1000);
    S.newFile = function (name, kind, staged) { S.files[name] = { kind: kind, staged: !!staged }; S.renderFiles(); RQ.audio.sfx("pop"); };
    S.renderFiles = function () {
      S.filesEl.innerHTML = "";
      var names = Object.keys(S.files);
      names.forEach(function (f) {
        var fo = S.files[f];
        S.filesEl.appendChild(u.el("span", { class: "chip gg-file " + (fo.staged ? "staged" : fo.kind), title: fo.staged ? "in the basket" : fo.kind,
          html: (fo.staged ? "🧺 " : fo.kind === "new" ? "📄 " : "✏️ ") + u.esc(f) }));
      });
      if (!names.length) S.filesEl.appendChild(u.el("span", { class: "muted", text: "✨ all saved" }));
    };
    function val(x) { return typeof x === "function" ? x() : x; }
    S.prompt = function (st) {
      var ghost = val(st.ghost) || "", key = ghost.split(" ").slice(0, 2).join(" ");
      var show = !st.commit && (!S.seen[key] || S.stepMiss > 0 || L.fails > 0);
      var spec = { expect: function (cmd) { return cmd.length > 0; } };
      if (show) spec.ghost = ghost;
      S.ghostNow = ghost;
      var p = S.t.ask(spec);
      if (st.commit) S.setInput(st.prefill || 'git commit -m ""', 1);
      return p;
    };
    S.showStep = function (st, i, n) {
      S.stepEl.innerHTML = "<small>Mission step " + (i + 1) + " of " + n + "</small>" + RQ.ui.md(val(st.label));
      L.hud.set("step", "🌱 " + (i + 1) + " / " + n);
    };
    /** Play steps in order: [{label, ghost, commit, before(), ok(ev), nudge(ev), after(ev), skip()}]. */
    S.run = async function (steps) {
      for (var i = 0; i < steps.length; i++) {
        var st = steps[i];
        if (st.skip && st.skip()) continue;
        S.stepMiss = 0; S.nudged = false;
        if (st.before) { await st.before(); if (!L.alive) return; }
        S.showStep(st, i, steps.length); S.renderFiles();
        for (;;) {
          var cmd = await S.prompt(st);
          if (!L.alive) return;
          S.lastAct = performance.now(); S.cmds++;
          var ev = exec(S, cmd);
          S.renderFiles();
          if (S.onEvent) S.onEvent(ev);
          if (st.ok(ev)) {
            var g = val(st.ghost) || ""; S.seen[g.split(" ").slice(0, 2).join(" ")] = 1;
            if (st.after) { await st.after(ev); if (!L.alive) return; }
            break;
          }
          var nudge = st.nudge && st.nudge(ev);
          if (nudge) S.t.print("[y]" + nudge + "[/y]");
          if (ev.err || nudge) {
            S.mistakes++; S.stepMiss++;
            if (S.stepMiss === 2) S.t.print("[y]💡 Type the grey letters (Tab finishes them), or press 💡 Show me.[/y]");
          }
        }
      }
    };
    S.stars = function (extra) { var s = S.mistakes + S.helps + (extra || 0); return s <= 1 ? 3 : s <= 4 ? 2 : 1; };
    S.stats = function () { return { "Commands": S.cmds, "Oopses": S.mistakes, "Help used": S.helps }; };
    return S;
  }

  /* ------------------------------------------------------------ the history garden (levels 1-2) */
  function garden(S, N) {
    var R = S.R, cv = S.cv, ctx = cv.ctx, H = 410, MY = 278, BY = 156;
    var birds = [], parts = [], bees = [], spr = null, terrK = 0, visitor = null, T = 0;
    var flowers = []; for (var i = 0; i < 40; i++) flowers.push({ x: Math.random(), y: Math.random(), c: u.pick(["#ffd23f", "#ff8fab", "#ffffff", "#b197fc"]) });
    var flock = { x: -300, y: 60, next: 3 };
    function sp() { return Math.min(210, (cv.w - 240) / Math.max(N - 1, R.cols - 1, 1)); }
    function X(col) { return 82 + col * sp(); }
    function laneY(l) { return l ? BY : MY; }
    function vparent(c) {
      var p = c.parents[0], hidden = 0;
      while (p != null && p >= 0 && !R.commits[p].vis) { hidden++; p = R.commits[p].parents[0]; }
      return { c: p == null || p < 0 ? null : R.commits[p], hidden: hidden };
    }
    function top(c) { return { x: X(c.col), y: laneY(c.lane) - 104 * (c.kind === "merge" ? 1.2 : 1) }; }
    function seg(x0, y0, x1, y1, prog) {
      var s = sp(), len = Math.abs(x1 - x0) + Math.abs(y1 - y0) * 1.3 + 1;
      ctx.save(); if (prog < 1) ctx.setLineDash([len * prog, len * 3]);
      ctx.beginPath(); ctx.moveTo(x0, y0);
      if (y0 === y1) ctx.lineTo(x1, y1);
      else if (y1 < y0) { var xm = x0 + s * .45; ctx.bezierCurveTo(x0 + s * .25, y0, xm - s * .2, y1, xm, y1); ctx.lineTo(x1, y1); }
      else { var xn = x1 - s * .45; ctx.lineTo(xn, y0); ctx.bezierCurveTo(xn + s * .2, y0, x1 - s * .25, y1, x1, y1); }
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = INK; ctx.lineWidth = 17; ctx.stroke();
      ctx.strokeStyle = "#dcae74"; ctx.lineWidth = 11; ctx.stroke();
      ctx.restore();
    }
    function sideBranch() { return R.order.filter(function (b) { return b !== "main"; })[0]; }
    function terrace(dt) {
      var b = sideBranch(); if (!b) return;
      terrK = Math.min(1, terrK + dt * 1.6);
      var s = sp(), fk = R.commits[R.fork[b]], lane1 = R.commits.filter(function (c) { return c.vis && c.lane === 1; });
      var merged = R.commits.filter(function (c) { return c.kind === "merge"; })[0];
      var last = lane1.length ? Math.max.apply(null, lane1.map(function (c) { return c.col; })) : fk.col;
      var x0 = X(fk.col) + s * .05, xt0 = X(fk.col) + s * .42;
      var xt1 = merged ? X(merged.col) - s * .45 : X(last) + s * (lane1.length ? .75 : 1.05), x1 = xt1 + s * .38;
      var topY = MY - 4 - (MY - BY + 6) * u.ease.outBack(terrK);
      ctx.beginPath(); ctx.moveTo(x0, MY - 4);
      ctx.bezierCurveTo(x0 + s * .22, MY - 4, xt0 - s * .16, topY, xt0, topY); ctx.lineTo(xt1, topY);
      ctx.bezierCurveTo(xt1 + s * .16, topY, x1 - s * .22, MY - 4, x1, MY - 4); ctx.closePath();
      ctx.fillStyle = "#9ad879"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "rgba(60,120,50,.18)"; ctx.fillRect(xt0, topY + 60, xt1 - xt0, MY - topY - 64);
      if (!lane1.length && terrK > .5) seg(X(fk.col), MY, X(fk.col) + s * .8, BY, Math.min(1, (terrK - .5) * 2));
    }
    S.burst = function (x, y, cols, n) { for (var k = 0; k < (n || 18); k++) parts.push({ x: x, y: y, vx: u.rand(-170, 170), vy: u.rand(-260, -40), life: 1, c: u.pick(cols || ["#5cc867", "#ff8fab", "#ffd23f"]) }); };
    S.visit = function (who, c, secs) { visitor = { who: who, c: c, until: T + (secs || 4) }; };
    S.bees = function (c) { for (var k = 0; k < 7; k++) bees.push({ c: c, a: Math.random() * 6.28, r: u.rand(40, 80), s: u.rand(1.2, 2.4) * (Math.random() < .5 ? -1 : 1), ph: Math.random() * 6 }); };
    S.onEvent = function (ev) {
      if (ev.type === "commit" || ev.type === "merge") {
        var c = ev.c || R.commits[R.branches[R.head]];
        c.born = T; RQ.audio.sfx("bloom");
        L.timeout(function () { var p = top(c); S.burst(p.x, p.y + 40); }, 500);
        birds.push({ c: c, x: cv.w + 30, y: u.rand(30, 70), perch: false, col: u.pick(["#74c0fc", "#ff8fab", "#ffd23f", "#ff922b"]), ph: Math.random() * 6 });
      }
    };
    var L = S.L;
    L.loop(function (dt, t) {
      T = t; var W = cv.w, s = sp();
      // sky, hills, field
      skyBg(ctx, W, MY, t);
      ctx.save(); ctx.translate(W - 70, 52); ctx.rotate(t * .15); ctx.fillStyle = "rgba(255,214,77,.35)";
      for (var k = 0; k < 12; k++) { ctx.rotate(Math.PI / 6); ctx.fillRect(34, -4, 20, 8); } ctx.restore();
      ctx.beginPath(); ctx.arc(W - 70, 52, 28, 0, 7); ctx.fillStyle = "#ffd84d"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = "#bfe6a6"; ctx.beginPath(); ctx.moveTo(0, MY);
      for (var hx = 0; hx <= W; hx += 30) ctx.lineTo(hx, MY - 70 - Math.sin(hx / 170) * 26);
      ctx.lineTo(W, MY); ctx.fill();
      ctx.fillStyle = "#8fd46f"; ctx.fillRect(0, MY - 40, W, H - MY + 40);
      ctx.fillStyle = "#7cc45c"; ctx.fillRect(0, MY + 60, W, H - MY - 60);
      flowers.forEach(function (f) { ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x * W, MY - 36 + f.y * (H - MY + 30), 2.6, 0, 7); ctx.fill(); });
      // ambient flock
      flock.next -= dt;
      if (flock.next <= 0 && flock.x < -200) { flock.x = -60; flock.y = u.rand(30, 90); }
      if (flock.x > -200) { flock.x += 90 * dt; for (k = 0; k < 3; k++) birdArt(ctx, flock.x - k * 30, flock.y + (k % 2) * 14 + Math.sin(t * 3 + k) * 4, t + k, true, "#9aa7b5", 1); if (flock.x > W + 120) { flock.x = -300; flock.next = u.rand(8, 14); } }
      terrace(dt);
      // paths
      var vis = R.commits.filter(function (c) { return c.vis; });
      if (vis.length) seg(-20, MY, X(vis[0].col), MY, 1);
      vis.forEach(function (c) {
        c.g = Math.min(1, c.g + dt * 1.1);
        var vp = vparent(c);
        if (vp.c) seg(X(vp.c.col), laneY(vp.c.lane), X(c.col), laneY(c.lane), Math.min(1, c.g * 2));
        if (c.parents[1] != null) { var o2 = R.commits[c.parents[1]]; seg(X(o2.col), laneY(o2.lane), X(c.col), laneY(c.lane), Math.min(1, c.g * 2)); }
      });
      vis.forEach(function (c) { // "+N more" pills for real commits that are not drawn as trees
        var vp = vparent(c);
        if (vp.c && vp.hidden) pill(ctx, "+" + vp.hidden + " more", (X(vp.c.col) + X(c.col)) / 2, laneY(c.lane), "600 16px " + FONT, "#fff8e6");
      });
      // trees, lane 1 then lane 0, then signs and branch tags
      [1, 0].forEach(function (ln) { vis.forEach(function (c) { if (c.lane === ln) treeArt(ctx, X(c.col), laneY(c.lane), c.g, c.kind, t, c.kind === "merge" ? 1.2 : 1, c.i * 7 + 3); }); });
      vis.forEach(function (c) {
        var glow = c.born != null ? 2.5 - (t - c.born) : 0;
        signArt(ctx, X(c.col), laneY(c.lane) + 16, Math.min(168, s - 14), c.h, c.short || c.msg, glow);
      });
      // Sprout = HEAD, with the files basket
      var hc = R.commits[R.branches[R.head]];
      if (hc) {
        var lane = R.lane[R.head] ? 1 : hc.lane, tx = X(hc.col) + Math.max(s * .6, 90) + (hc.kind === "merge" ? 14 : 0), ty = laneY(lane);
        if (!spr) spr = { x: tx, y: ty };
        spr.x += (tx - spr.x) * Math.min(1, dt * 4); spr.y += (ty - spr.y) * Math.min(1, dt * 4);
        var hop = Math.abs(ty - spr.y) > 4 ? -Math.sin(Math.min(1, Math.abs(ty - spr.y) / 120) * Math.PI) * 30 : 0;
        var bob = Math.sin(t * 3) * 3 + hop;
        var q, files = Object.keys(S.files), loose = files.filter(function (f) { return !S.files[f].staged; }), inBasket = files.length - loose.length;
        loose.forEach(function (f, q) { paper(ctx, spr.x - 40 - q * 14, spr.y - 14, true); });
        // basket
        var bx = spr.x + 38, by = spr.y - 4;
        for (q = 0; q < inBasket; q++) paper(ctx, bx - 6 + q * 8, by - 22, false);
        ctx.fillStyle = "#c8945a"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(bx - 17, by - 18); ctx.lineTo(bx + 17, by - 18); ctx.lineTo(bx + 12, by); ctx.lineTo(bx - 12, by); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - 12, by - 10); ctx.lineTo(bx + 13, by - 10); ctx.stroke();
        ctx.beginPath(); ctx.arc(bx, by - 18, 13, Math.PI, 0); ctx.stroke();
        drawChar(ctx, "sprout", spr.x, spr.y - 34 + bob, 62);
        pill(ctx, "HEAD", spr.x, spr.y - 80 + bob, "700 15px " + FONT, "#ffe36e");
      }
      if (visitor && t < visitor.until) drawChar(ctx, visitor.who, X(visitor.c.col) - 52, laneY(visitor.c.lane) - 28 + Math.sin(t * 4) * 2, 58);
      // birds
      birds.forEach(function (b) {
        var p = top(b.c), txx = p.x + 20, tyy = p.y + 30;
        if (!b.perch) { var dx = txx - b.x, dy = tyy - b.y, d = Math.hypot(dx, dy); if (d < 6) { b.perch = true; RQ.audio.sfx("chirp"); } else { b.x += dx / d * Math.min(d, 280 * dt); b.y += dy / d * Math.min(d, 280 * dt); } }
        else { b.x = txx; b.y = tyy + (Math.sin(t * 2 + b.ph) > .9 ? -4 : 0); }
        birdArt(ctx, b.x, b.y, t, !b.perch, b.col, b.perch ? 1 : -1);
      });
      bees.forEach(function (b) { var p = top(b.c); b.a += b.s * dt; beeArt(ctx, p.x + Math.cos(b.a) * b.r, p.y + 52 + Math.sin(b.a * 1.3 + b.ph) * b.r * .45, t + b.ph, Math.cos(b.a) * b.s > 0 ? -1 : 1); });
      parts = parts.filter(function (p) {
        p.life -= dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, 6, 3, p.x, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        return p.life > 0;
      });
      var tagged = {};
      R.order.forEach(function (b) {
        var hc = R.commits[R.branches[b]]; if (!hc || !hc.vis) return;
        var n = tagged[hc.i] = (tagged[hc.i] || 0) + 1, p = top(hc);
        pill(ctx, b, p.x, p.y - 16 - (n - 1) * 30, "700 16px " + FONT, b === "main" ? "#74c0fc" : "#ffc078");
      });
    });
    return S;
  }
  function paper(ctx, x, y, loose) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(loose ? -.15 : .1);
    ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(4, -12); ctx.lineTo(9, -7); ctx.lineTo(9, 12); ctx.lineTo(-9, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#9aa7b5"; ctx.lineWidth = 1.5; ctx.beginPath(); for (var i = 0; i < 3; i++) { ctx.moveTo(-5, -4 + i * 5); ctx.lineTo(5, -4 + i * 5); } ctx.stroke();
    if (loose) { ctx.fillStyle = "#d1495b"; ctx.beginPath(); ctx.arc(9, -12, 7, 0, 7); ctx.fill(); text(ctx, "!", 9, -11, "700 12px " + FONT, "#fff"); }
    ctx.restore();
  }

  /* ------------------------------------------------------------ level 1: commit trees */
  function level1(L) {
    var S = consoleScene(L, { label: "history garden" });
    S.R.addReal(["c04a049", "8e08459", "81e8c68", "e2ee761"]);
    garden(S, 7);
    function addStep(file, ghost, label) {
      return { label: label, ghost: ghost, ok: function (ev) { return ev.type === "add" && S.files[file] && S.files[file].staged; } };
    }
    function commitStep(example) {
      return { label: "Plant the tree! Type a short message between the quotes, then press Enter.", commit: true, ghost: 'git commit -m "' + example + '"',
        ok: function (ev) { return ev.type === "commit"; },
        after: async function (ev) {
          if (ev.msg.length > 50) S.t.print("[dim](Tip: short messages are easier to read on the signs.)[/dim]");
          L.toast("🌳 New tree **" + ev.c.h + "** planted!", "good", 1800); await L.wait(900);
        } };
    }
    var steps = [
      { label: "Sprout drew a seed map called **map.txt**. Peek at what changed with `git status`.", ghost: "git status",
        before: function () { S.newFile("map.txt", "new"); }, ok: function (ev) { return ev.type === "status"; } },
      addStep("map.txt", "git add map.txt", "Put **map.txt** in the basket: `git add map.txt`"),
      commitStep("add seed map"),
      Object.assign(addStep("rolls.py", "git add rolls.py", "Hoot wrote **rolls.py**. Put it in the basket too."),
        { before: async function () { S.newFile("rolls.py", "new"); await L.say("hoot", "I wrote rolls.py to count the seed rolls. Please save it in the garden!"); } }),
      commitStep("count seed rolls"),
      Object.assign(addStep("README.md", "git add README.md", "Koa changed **README.md**. Add it, then commit."),
        { before: async function () { S.newFile("README.md", "modified"); await L.say("koa", "I added a hello to README.md. Can you save that too?"); } }),
      commitStep("say hi in README"),
      { label: "Read the whole history: `git log --oneline`", ghost: "git log --oneline", ok: function (ev) { return ev.type === "log"; } }
    ];
    S.run(steps).then(async function () {
      if (!L.alive) return;
      await L.wait(600); if (!L.alive) return;
      await L.say("pix", "See? The older lines are real ReSeed commits, like `c04a049`. Your three trees are on top!");
      if (!L.alive) return;
      L.win({ stars: S.stars(), msg: "Three new trees in the history garden. Every commit is a saved moment you can go back to.", stats: S.stats() });
    });
  }

  /* ------------------------------------------------------------ level 2: branch & merge */
  function level2(L) {
    var S = consoleScene(L, { label: "history garden with a side path", branching: true });
    S.R.addReal(["c04a049", "81e8c68", "e2ee761"]);
    garden(S, 7);
    S.bname = "bees";
    var onSide = function () { return S.R.head === S.bname; };
    function sideCommit(file, example, line) {
      return { label: "You are on the side path. Plant a tree there: commit with a message.", commit: true, ghost: 'git commit -m "' + example + '"',
        before: async function () { S.newFile(file, "new", true); S.t.print("[dim](" + line + ")[/dim]"); },
        ok: function (ev) { return ev.type === "commit" && ev.branch === S.bname; },
        nudge: function (ev) { return ev.type === "commit" ? "Oops, that tree grew on " + ev.branch + ". Walk to the side path first: git switch " + S.bname : null; } };
    }
    var steps = [
      { label: "Start a side path called **bees**: `git branch bees`", ghost: "git branch bees",
        ok: function (ev) { return ev.type === "branch" || (ev.type === "switch" && ev.created); },
        after: async function (ev) { S.bname = ev.name; if (ev.name !== "bees") L.toast("🌿 Your path is called **" + ev.name + "**. Nice name!", "good"); await L.wait(700); } },
      { label: function () { return "Walk onto it: `git switch " + S.bname + "`"; }, ghost: function () { return "git switch " + S.bname; }, skip: onSide,
        ok: function (ev) { return ev.type === "switch" && ev.name === S.bname; } },
      sideCommit("flowers.html", "plant bee flowers", "Sprout planted flowers.html and put it in the basket for you"),
      sideCommit("hive.html", "add a beehive", "Sprout built hive.html and put it in the basket"),
      { label: "Go back to the main path: `git switch main`", ghost: "git switch main",
        before: async function () {
          var c = S.R.commitOn("main", "fix typo in README", "pix"); S.onEvent({ type: "commit", c: c }); S.visit("pix", c, 6);
          await L.wait(900); if (!L.alive) return;
          await L.say("pix", "Meanwhile, I fixed a typo on **main**. Now the garden has two paths!");
        },
        ok: function (ev) { return ev.type === "switch" && ev.name === "main"; } },
      { label: function () { return "Join the paths: `git merge " + S.bname + "`"; }, ghost: function () { return "git merge " + S.bname; },
        ok: function (ev) { return ev.type === "merge" && ev.name === S.bname; },
        nudge: function (ev) { return ev.type === "merge-none" && S.R.head !== "main" ? "You are on " + S.R.head + ". Merge from main: git switch main" : null; },
        after: async function (ev) { if (ev.c) S.bees(ev.c); await L.wait(1400); } }
    ];
    S.run(steps).then(async function () {
      if (!L.alive) return;
      await L.say("koa", "Bees on the main path! A branch let us try the idea safely, then share it.");
      if (!L.alive) return;
      L.win({ stars: S.stars(), msg: "You grew a side path, planted on it, and merged it back into **main**.", stats: S.stats() });
    });
  }

  /* ------------------------------------------------------------ level 3: push & GitHub Actions robots */
  function level3(L) {
    var S = consoleScene(L, { label: "github workshop", push: true });
    var R = S.R; R.addReal([]);
    var hootC = R.commitOn("main", "make NDVI faster", "hoot"); hootC.g = 1;
    S.tracked.push("reseed/acquire.py");
    var cv = S.cv, ctx = cv.ctx, BELT = 320, PAGE = 176;
    var NAMES = ["checkout", "Python 3.12", "Node 22", "pytest", "ForestNet"], SUBS = ["get the code", "+ pip install", "for JavaScript", "Python tests", "JS = PyTorch?"];
    var COLS = ["#74c0fc", "#ffd23f", "#8ce99a", "#b197fc", "#ff922b"];
    var F = { fly: null, parcel: null, robots: [], pages: { st: "idle", t0: 0, x: 0 }, shop: { flash: 0, ver: 0 }, status: null, parts: [], T: 0 };
    for (var i = 0; i < 5; i++) F.robots.push({ st: "idle", ph: i * 1.7 });
    function wx0() { return 246; }
    function wx1() { return cv.w - 238; }
    function rx(k) { return wx0() + 86 + k * (wx1() - wx0() - 150) / 4; }
    function sx() { return cv.w - 224; }
    function box(x, y, label, col) {
      ctx.fillStyle = col || "#e0bb7f"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; u.rr(ctx, x - 30, y - 38, 60, 38, 6); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 30, y - 28); ctx.lineTo(x + 30, y - 28); ctx.stroke();
      text(ctx, label, x, y - 13, "700 14px " + MONO, INK);
    }
    async function pushRun(fail) {
      F.robots.forEach(function (r) { r.st = "idle"; }); F.status = "running";
      F.fly = { t0: F.T }; RQ.audio.sfx("whoosh");
      await L.wait(1500); if (!L.alive) return false;
      F.fly = null; F.parcel = { x: wx0() + 20, si: -1, bug: false, h: R.commits[R.pushed].h };
      S.t.print("[c]GitHub Actions:[/c] 2 workflows start for [y]" + F.parcel.h + "[/y]: [b]Tests[/b] (tests.yml) and [b]Deploy site to GitHub Pages[/b] (pages.yml)");
      pagesRun();
      for (var k = 0; k < 5; k++) {
        F.parcel.si = k; await L.wait(650); if (!L.alive) return false;
        F.robots[k].st = "scan"; RQ.audio.sfx("beep"); await L.wait(850); if (!L.alive) return false;
        if (fail && k === 3) {
          F.robots[3].st = "fail"; F.robots[4].st = "skip"; F.parcel.bug = true; F.status = "fail";
          RQ.audio.sfx("error"); L.timeout(function () { RQ.audio.sfx("giggle"); }, 400);
          S.t.print("[r]✗ pytest[/r]\n[r]FAILED tests/test_core.py::test_ndvi_range_and_nan[/r]\n[r]    assert 1.25 == approx(0.8)[/r]   [dim](NIR 0.45, Red 0.05)[/dim]\n[dim]  ForestNet test skipped: the job stops at the first red step.[/dim]");
          return false;
        }
        F.robots[k].st = "pass"; RQ.audio.sfx("coin");
        S.t.print("[g]✓[/g] " + ["checkout", "set up Python 3.12 + pip install", "set up Node 22", "python -m pytest -q", "node tests/js/forestnet.test.mjs (JS ForestNet = PyTorch)"][k]);
      }
      F.status = "pass"; RQ.audio.sfx("win");
      return true;
    }
    function pagesRun() {
      (async function () {
        F.pages = { st: "drive", t0: F.T }; await L.wait(2600); if (!L.alive) return;
        F.pages = { st: "zip", t0: F.T }; await L.wait(1000); if (!L.alive) return;
        F.pages = { st: "done", t0: F.T }; F.shop.flash = 1; F.shop.ver++; RQ.audio.sfx("bloom");
        S.t.print("[g]✓ pages.yml:[/g] published [b]site/[/b] to [c]https://khamydoan.github.io/reseed/[/c]");
      })();
    }
    function fixPanel() {
      return new Promise(function (resolve) {
        var ops = ["+", "-"], tries = 0;
        var panel = u.el("div", { class: "gg-fix panel" });
        panel.appendChild(u.el("h3", { html: "🐞 Fix the Glitch Bug · <code>reseed/acquire.py</code> (game version)" }));
        panel.appendChild(u.el("p", { html: RQ.ui.md("NDVI = **(NIR − Red) / (NIR + Red)**. The test uses NIR = 0.45, Red = 0.05 and wants **0.8**. Click the signs to flip them.") }));
        var b0 = u.el("button", { class: "gg-op", "aria-label": "first sign" }), b1 = u.el("button", { class: "gg-op", "aria-label": "second sign" });
        var code = u.el("div", { class: "code" }, "def normalized_difference(a, b):\n    return (a ", b0, " b) / (a ", b1, " b)");
        panel.appendChild(code);
        var res = u.el("div", { class: "gg-res", text: "" });
        var run = u.el("button", { class: "btn go", html: "▶ Run the test" });
        panel.appendChild(u.el("div", {}, run)); panel.appendChild(res);
        function show() { b0.textContent = ops[0] === "-" ? "−" : "+"; b1.textContent = ops[1] === "-" ? "−" : "+"; }
        [b0, b1].forEach(function (b, k) { L.on(b, "click", function () { ops[k] = ops[k] === "+" ? "-" : "+"; RQ.audio.sfx("tick"); res.textContent = ""; res.className = "gg-res"; show(); }); });
        L.on(run, "click", function () {
          tries++;
          var a = .45, bb = .05, top = ops[0] === "+" ? a + bb : a - bb, bot = ops[1] === "+" ? a + bb : a - bb, v = Math.round(top / bot * 100) / 100;
          if (ops[0] === "-" && ops[1] === "+") {
            res.className = "gg-res ok"; res.textContent = "Result 0.8 ✓  The test passes! Bug squashed."; RQ.audio.sfx("good");
            L.timeout(function () { panel.remove(); resolve(tries); }, 1300);
          } else {
            res.className = "gg-res no"; res.textContent = "Result " + v + " ✗  The test wants 0.8."; RQ.audio.sfx("giggle");
            if (tries >= 2) res.textContent += "  💡 Minus on top, plus on the bottom.";
          }
        });
        show(); S.top.appendChild(panel); L.timeout(function () { b0.focus(); }, 80);
      });
    }
    var fixTries = 0;
    var steps = [
      { label: "Send Hoot's commit to GitHub: `git push`", ghost: "git push", ok: function (ev) { return ev.type === "push"; },
        after: async function () {
          await pushRun(true); if (!L.alive) return;
          await L.wait(1600); if (!L.alive) return;
          await L.say("bug", "Hee hee! I swapped a plus and a minus in the NDVI formula!");
          if (!L.alive) return;
          await L.say("pix", "Red ✗ on **pytest**! The website still updated: Pages publishes `site/` on every push to **main**, and the bug hides in the Python code.");
          if (!L.alive) return;
          S.stepEl.innerHTML = "<small>Fix it</small>" + RQ.ui.md("Flip the signs in the formula, then **Run the test**.");
          fixTries = await fixPanel(); if (!L.alive) return;
          F.parcel.bug = false; F.robots[3].st = "idle"; F.robots[4].st = "idle"; F.status = null;
          S.burst(rx(3), BELT - 80); S.files["reseed/acquire.py"] = { kind: "modified", staged: false }; S.renderFiles();
          await L.say("hoot", "Thank you! Now save the fix as a commit and push again.");
        } },
      { label: "Save the fix: `-am` adds changes to files Git already tracks, then commits.", commit: true, prefill: 'git commit -am ""', ghost: 'git commit -am "fix NDVI formula"',
        ok: function (ev) { return ev.type === "commit"; } },
      { label: "Push again and watch the robots: `git push`", ghost: "git push", ok: function (ev) { return ev.type === "push"; },
        after: async function () { await pushRun(false); if (!L.alive) return; await L.wait(1800); } }
    ];
    S.burst = function (x, y) { for (var k = 0; k < 24; k++) F.parts.push({ x: x, y: y, vx: u.rand(-200, 200), vy: u.rand(-300, -60), life: 1.2, c: u.pick(["#ffd23f", "#2f9e4f", "#74c0fc", "#ff8fab"]) }); };
    S.run(steps).then(async function () {
      if (!L.alive) return;
      RQ.ui.confetti();
      await L.say("sprout", "All green! Every test passes, and the website is live at khamydoan.github.io/reseed.");
      if (!L.alive) return;
      L.win({ stars: S.stars(Math.max(0, fixTries - 1)), msg: "Red ✗ → fix → green ✓. That's how real coders keep ReSeed working.", stats: { "Fix tries": fixTries, "Oopses": S.mistakes, "Help used": S.helps } });
    });
    L.loop(function (dt, t) {
      F.T = t; var W = cv.w, x0 = wx0(), x1 = wx1(), shopX = sx();
      skyBg(ctx, W, 410, t, "#a9dcff", "#f1f9ff");
      // cloud floor under the workshop
      ctx.fillStyle = "#fff"; for (var c = x0 - 30; c < W + 40; c += 54) { ctx.beginPath(); ctx.arc(c, 404 + Math.sin(c) * 4, 34, 0, 7); ctx.fill(); }
      // laptop island
      var ix = 122, iy = 286 + Math.sin(t * 1.2) * 4;
      ctx.fillStyle = "#a0714a"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ix - 100, iy); ctx.quadraticCurveTo(ix - 40, iy + 90, ix, iy + 104); ctx.quadraticCurveTo(ix + 40, iy + 90, ix + 100, iy); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#7fcf6b"; ctx.beginPath(); ctx.ellipse(ix, iy, 104, 20, 0, 0, 7); ctx.fill(); ctx.stroke();
      for (var k = 0; k < 3; k++) treeArt(ctx, ix - 76 + k * 30, iy - 2, 1, "real", t, .45, k);
      ctx.fillStyle = "#26364a"; u.rr(ctx, ix + 4, iy - 62, 78, 52, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#7ee787"; for (k = 0; k < 4; k++) ctx.fillRect(ix + 12, iy - 54 + k * 10, 20 + ((k * 23 + Math.floor(t * 2)) % 40), 4);
      ctx.fillStyle = "#c9d1da"; ctx.beginPath(); ctx.moveTo(ix - 4, iy - 8); ctx.lineTo(ix + 90, iy - 8); ctx.lineTo(ix + 98, iy + 2); ctx.lineTo(ix - 12, iy + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      pill(ctx, "your laptop", ix, iy + 44, "600 16px " + FONT, "#fff8e6");
      // workshop
      ctx.fillStyle = "#eef1f4"; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, x0, 34, x1 - x0, 358, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#5a6b7d"; u.rr(ctx, x0, 34, x1 - x0, 34, 14); ctx.fill(); ctx.stroke();
      text(ctx, "github.com/khamydoan/reseed  ·  Actions", x0 + 16, 52, "700 17px " + FONT, "#fff", "left");
      if (F.status === "fail" || F.status === "pass") pill(ctx, F.status === "pass" ? "✓ All checks passed" : "✗ 1 failing", x1 - 98, 51, "700 15px " + FONT, F.status === "pass" ? "#8de59f" : "#ff9aa6");
      ctx.strokeStyle = "#c9d1da"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0 + 10, 232); ctx.lineTo(x1 - 10, 232); ctx.stroke();
      pill(ctx, "pages.yml", x0 + 62, 88, "600 15px " + MONO, "#fff");
      // pages lane: robot carries site/ to the shop window
      var pg = F.pages, pk = pg.st === "drive" ? u.clamp((t - pg.t0) / 2.6, 0, 1) : pg.st === "idle" ? 0 : 1;
      var px = u.lerp(x0 + 140, x1 - 50, u.ease.inOut(pk));
      ctx.strokeStyle = "#9aa7b5"; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(x1 - 30, 104); ctx.lineTo(shopX + 40, 168); ctx.stroke(); ctx.setLineDash([]);
      robotArt(ctx, px, PAGE, t, pg.st === "drive" ? "scan" : pg.st === "done" ? "pass" : "idle", "#f783ac", 3);
      if (pg.st === "drive") box(px, PAGE - 92, "site/", "#ffd8a8");
      if (pg.st === "zip") { var zk = u.clamp((t - pg.t0) / 1, 0, 1); box(u.lerp(x1 - 30, shopX + 40, zk), u.lerp(104, 168, zk) + 38, "site/", "#ffd8a8"); }
      text(ctx, "deploy", px, PAGE + 16, "600 16px " + FONT);
      // tests lane: robots, belt, parcel
      F.robots.forEach(function (r, q) { robotArt(ctx, rx(q), BELT - 4, t, r.st, COLS[q], r.ph); });
      ctx.fillStyle = "#4a5b6d"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, x0 + 8, BELT, x1 - x0 - 16, 22, 9); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#8494a7"; ctx.lineWidth = 3; var off = F.status === "running" ? (t * 60) % 24 : 0;
      ctx.beginPath(); for (var bx = x0 + 120 + off; bx < x1 - 16; bx += 24) { ctx.moveTo(bx, BELT + 5); ctx.lineTo(bx - 6, BELT + 17); } ctx.stroke();
      text(ctx, "tests.yml ▸", x0 + 20, BELT + 12, "700 15px " + MONO, "#fff", "left");
      NAMES.forEach(function (n, q) {
        text(ctx, n, rx(q), BELT + 38, "700 16px " + FONT, INK);
        text(ctx, SUBS[q], rx(q), BELT + 57, "500 15px " + FONT, "#4a5b6d");
      });
      if (F.parcel) {
        var tx = F.parcel.si < 0 ? x0 + 20 : rx(F.parcel.si) + 2;
        F.parcel.x += (tx - F.parcel.x) * Math.min(1, dt * 7);
        box(F.parcel.x, BELT, F.parcel.h);
        if (F.parcel.bug) drawChar(ctx, "bug", F.parcel.x + 30, BELT - 62 + Math.abs(Math.sin(t * 6)) * -10, 58);
      }
      // shop window (GitHub Pages)
      ctx.fillStyle = "#f6e7c8"; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, shopX, 120, 208, 272, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff8e6"; u.rr(ctx, shopX + 6, 62, 196, 50, 10); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
      text(ctx, "khamydoan.github.io", shopX + 104, 78, "700 16px " + FONT); text(ctx, "/reseed", shopX + 104, 98, "700 16px " + FONT, "#2b7bd0");
      for (k = 0; k < 7; k++) { ctx.fillStyle = k % 2 ? "#fff" : "#d1495b"; ctx.beginPath(); ctx.moveTo(shopX + k * 29.7, 120); ctx.lineTo(shopX + (k + 1) * 29.7, 120); ctx.lineTo(shopX + (k + 1) * 29.7, 146); ctx.arc(shopX + (k + .5) * 29.7, 146, 14.85, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
      ctx.fillStyle = "#26364a"; ctx.fillRect(shopX + 16, 168, 176, 128);
      if (F.shop.ver) miniSite(ctx, shopX + 20, 172, 168, 120, t);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(shopX + 16, 168, 176, 128);
      if (F.shop.flash > 0) { F.shop.flash -= dt * .8; ctx.fillStyle = "rgba(255,255,255," + Math.max(0, F.shop.flash) + ")"; ctx.fillRect(shopX + 16, 168, 176, 128); }
      pill(ctx, F.shop.ver ? "OPEN" : "closed", shopX + 104, 330, "700 18px " + FONT, F.shop.ver ? "#8de59f" : "#e9eef4");
      text(ctx, "shop window", shopX + 104, 368, "600 16px " + FONT, "#4a5b6d");
      // Sprout flies the push
      if (F.fly) {
        var fk = u.clamp((t - F.fly.t0) / 1.5, 0, 1), fx = u.lerp(ix + 40, x0 + 20, u.ease.inOut(fk)), fy = u.lerp(iy - 70, BELT - 60, fk) - Math.sin(fk * Math.PI) * 140;
        ctx.strokeStyle = "rgba(29,43,58,.35)"; ctx.setLineDash([4, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ix + 40, iy - 70); ctx.quadraticCurveTo((ix + x0) / 2, iy - 260, fx, fy); ctx.stroke(); ctx.setLineDash([]);
        box(fx, fy + 66, "push"); drawChar(ctx, "sprout", fx, fy, 64);
      } else drawChar(ctx, "sprout", ix - 70, iy - 46 + Math.sin(t * 3) * 3, 56);
      F.parts = F.parts.filter(function (p) {
        p.life -= dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life)); ctx.fillStyle = p.c; ctx.fillRect(p.x - 4, p.y - 2, 8, 4); ctx.globalAlpha = 1;
        return p.life > 0;
      });
    });
  }

  /* ------------------------------------------------------------ level 4: your web page (HTML + live preview) */
  function level4(L) {
    var site = RQ.mySite ? RQ.mySite() : null;
    var PICS = { "my-site.jpg": site ? RQ.url(site.files.thumb) : svgURL("tuki"), "sprout.png": svgURL("sprout") };
    var START_H1 = "My Forest Page", T_H1 = "Saving the forest", T_P = "Drones plant seeds where the forest was lost.";
    var BLOCKS = [
      { key: "h1", label: "＋ Heading <code>&lt;h1&gt;</code>", code: "<h1>" + T_H1 + "</h1>" },
      { key: "p", label: "＋ Sentence <code>&lt;p&gt;</code>", code: "<p>" + T_P + "</p>" },
      { key: "img", label: "＋ Picture <code>&lt;img&gt;</code>", code: '<img src="my-site.jpg" alt="My forest from space">' },
      { key: "a", label: "＋ Link <code>&lt;a&gt;</code>", code: '<a href="https://khamydoan.github.io/reseed/">Visit ReSeed</a>' }
    ];
    var root = u.el("div", { class: "gg-html" });
    var ed = u.el("div", { class: "panel gg-ed" }), tools = u.el("div", { class: "gg-tools" });
    var ta = u.el("textarea", { class: "gg-src", spellcheck: "false", autocomplete: "off", autocapitalize: "off", "aria-label": "HTML code of your page" });
    ta.value = "<h1>" + START_H1 + "</h1>\n";
    ed.appendChild(u.el("h3", { html: "📝 index.html <span class='muted' style='font-weight:500'>· your code</span>" }));
    ed.appendChild(tools);
    ed.appendChild(u.el("div", { class: "gg-folder", html: "📁 Pictures in your folder: <code>my-site.jpg</code> <code>sprout.png</code>" }));
    ed.appendChild(ta);
    var br = u.el("div", { class: "panel gg-br" }), view = u.el("div", { class: "gg-view", "aria-label": "live preview" });
    br.appendChild(u.el("div", { class: "bar" }, u.el("i", { style: { background: "#ff5f56" } }), u.el("i", { style: { background: "#ffbd2e" } }), u.el("i", { style: { background: "#27c93f" } }),
      u.el("span", { class: "addr", text: "🔒 https://you.github.io/my-forest/" })));
    br.appendChild(view);
    var goalsEl = u.el("div", { class: "gg-goals" });
    var publish = u.el("button", { class: "btn go", html: "🚀 Publish", disabled: true });
    root.appendChild(ed); root.appendChild(br); root.appendChild(goalsEl); L.stage.appendChild(root);
    BLOCKS.forEach(function (b) {
      var btn = u.el("button", { class: "btn small", html: b.label });
      L.on(btn, "click", function () {
        var s = ta.selectionStart == null ? ta.value.length : ta.selectionStart, before = ta.value.slice(0, s), after = ta.value.slice(s);
        var ins = (before && !/\n$/.test(before) ? "\n" : "") + b.code + "\n";
        ta.value = before + ins + after; RQ.audio.sfx("pop"); ta.focus(); var p = before.length + ins.length; ta.setSelectionRange(p, p);
        update();
      });
      tools.appendChild(btn);
    });
    var bug = { done: false, pending: false, active: false, el: null }, everAll = false, t0 = performance.now(), hinted = false;
    function render() {
      var doc = new DOMParser().parseFromString("<body>" + ta.value + "</body>", "text/html");
      var f = { h1: "", p: "", h1s: [], ps: [], img: 0, imgOk: 0, a: 0, bad: [] }, OK = { h1: 1, h2: 1, h3: 1, p: 1, img: 1, a: 1, b: 1, i: 1, em: 1, strong: 1, br: 1, ul: 1, li: 1 };
      view.innerHTML = "";
      (function walk(src, dst) {
        Array.prototype.forEach.call(src.childNodes, function (n) {
          if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); return; }
          if (n.nodeType !== 1) return;
          var tag = n.tagName.toLowerCase(), e;
          if (!OK[tag]) { walk(n, dst); return; }
          if (tag === "img") {
            var sv = (n.getAttribute("src") || "").trim(), url = PICS[sv.toLowerCase()];
            f.img++;
            if (url) { e = u.el("img", { src: url, alt: n.getAttribute("alt") || "" }); f.imgOk++; }
            else { e = u.el("div", { class: "gg-broken", html: "🖼️ can't find <code>" + u.esc(sv || "?") + "</code>" }); f.bad.push(sv); }
          } else if (tag === "a") {
            var href = (n.getAttribute("href") || "").trim(), good = /^https?:\/\/\S+\.\S+/.test(href);
            e = u.el("a", { href: good ? href : "#", title: href, rel: "noopener" });
            e.addEventListener("click", function (ev) { ev.preventDefault(); RQ.ui.toast(good ? "🔗 This link goes to **" + href + "**" : "🔗 This link needs an address: href=\"https://…\"", good ? "info" : "bad", 2400); });
            walk(n, e);
            if (good && n.textContent.trim()) f.a++;
          } else {
            e = document.createElement(tag); walk(n, e);
            if (tag === "h1" && n.textContent.trim()) { f.h1 = f.h1 || n.textContent.trim(); f.h1s.push(n.textContent.trim()); }
            if (tag === "p" && n.textContent.trim()) { f.p = f.p || n.textContent.trim(); f.ps.push(n.textContent.trim()); }
          }
          dst.appendChild(e);
        });
      })(doc.body, view);
      if (bug.active && bug.el) view.appendChild(bug.el);
      return f;
    }
    var last = null;
    function ownWords(f) {
      return [f.h1s.some(function (h) { return [START_H1, T_H1].indexOf(h) < 0; }), f.ps.some(function (q) { return q !== T_P; })];
    }
    function update() {
      var f = render(); last = f;
      var own1 = ownWords(f)[0], own2 = ownWords(f)[1];
      var goals = [[!!f.h1, "Heading <code>&lt;h1&gt;</code>"], [!!f.p, "Sentence <code>&lt;p&gt;</code>"], [f.imgOk > 0 && !f.bad.length, "Picture <code>&lt;img&gt;</code>"], [f.a > 0, "Link <code>&lt;a&gt;</code>"]];
      var n = goals.filter(function (g) { return g[0]; }).length, all = n === 4;
      goalsEl.innerHTML = "";
      goals.forEach(function (g) { goalsEl.appendChild(u.el("span", { class: "chip" + (g[0] ? " ok" : ""), html: (g[0] ? "✅ " : "⬜ ") + g[1] })); });
      goalsEl.appendChild(u.el("span", { class: "chip bonus" + (own1 ? " ok" : ""), html: (own1 ? "⭐ " : "☆ ") + "your own heading" }));
      goalsEl.appendChild(u.el("span", { class: "chip bonus" + (own2 ? " ok" : ""), html: (own2 ? "⭐ " : "☆ ") + "your own sentence" }));
      goalsEl.appendChild(publish);
      publish.disabled = !all;
      L.hud.set("goals", "✅ " + n + " / 4");
      if (all && !everAll) { everAll = true; RQ.audio.sfx("good"); }
      if (all && !bug.done && !bug.pending) glitch();
      if (bug.active && !f.bad.length && f.imgOk) squash();
      return f;
    }
    function glitch() {
      bug.pending = true;
      L.timeout(function () {
        var m = /src\s*=\s*"(my-site\.jpg|sprout\.png)"/i.exec(ta.value); if (!m) { bug.done = true; return; }
        bug.active = true;
        var name = m[1], bad = name.toLowerCase() === "sprout.png" ? "sprot.png" : "my-sight.jpg";
        ta.value = ta.value.replace(m[0], 'src="' + bad + '"');
        bug.el = u.el("div", { class: "gg-bugpic", html: RQ.chars.svg("bug", { mood: "happy" }), style: { right: "16px", top: "10px" } });
        RQ.audio.sfx("giggle"); update();
        L.say("bug", "Hee hee! I changed one letter in your picture's name. Now the browser can't find it!").then(function () {
          if (L.alive && bug.active) L.toast("🔎 Fix the picture name in your code: **" + name + "**", "info", 3500);
        });
      }, 900);
    }
    function squash() {
      bug.active = false; bug.done = true; RQ.audio.sfx("splash"); L.toast("🐞 Squashed! The picture is back.", "good", 2000);
      var el = bug.el; if (el) { view.appendChild(el); el.classList.add("squash"); L.timeout(function () { el.remove(); }, 600); }
    }
    L.on(ta, "input", function () { update(); });
    L.on(ta, "keydown", function (e) { if (e.key === "Tab") { e.preventDefault(); var s = ta.selectionStart; ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(ta.selectionEnd); ta.setSelectionRange(s + 2, s + 2); update(); } });
    L.interval(function () {
      if (!hinted && (L.fails > 0 || performance.now() - t0 > 40000) && last && !(last.h1 && last.p && last.imgOk && last.a)) {
        hinted = true; L.hint("Use the **＋** buttons to add each tag. Then change the words between the tags to your own!", "tuki");
      }
    }, 1000);
    L.on(publish, "click", function () {
      if (publish.disabled) return;
      var ow = ownWords(last), own = (ow[0] ? 1 : 0) + (ow[1] ? 1 : 0);
      RQ.audio.sfx("whoosh"); publish.disabled = true;
      L.toast("🚀 Pages would put this at **you.github.io/my-forest** (practice page).", "good", 2600);
      L.timeout(function () { L.win({ stars: own + 1, msg: "Your own web page: heading, sentence, picture and link!", stats: { "Own words": own + " / 2", "Bug fixed": bug.done ? "yes" : "no" } }); }, 1200);
    });
    update(); L.timeout(function () { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 100);
  }

  /* ------------------------------------------------------------ level 5: where it lives (delivery) */
  var PARCELS = [
    { t: "The code files: app.js and server.py", a: 0, why: "Code lives in the workshop: github.com/khamydoan/reseed." },
    { t: "Every commit in the history garden", a: 0, why: "The history is kept with the code, on github.com." },
    { t: "Robots that run pytest on every push", a: 0, why: "GitHub Actions robots work in the github.com workshop." },
    { t: "A fix for a Glitch Bug (a new commit)", a: 0, why: "New commits are pushed to the workshop first." },
    { t: "The Mission Control page anyone can visit", a: 1, why: "GitHub Pages shows the website at khamydoan.github.io/reseed." },
    { t: "Where these games will live: khamydoan.github.io/reseed_games", a: 1, why: "A .github.io address is a GitHub Pages shop window." },
    { t: "An <iframe> that shows the ReSeed page", a: 2, why: "An iframe is a frame on another wall, like airesearchcenter.com/reseed." },
    { t: "A Google Sites page named reseed", a: 2, why: "airesearchcenter.com/reseed is a Google Sites page with an iframe inside (README)." }
  ];
  var BUILD = [
    { name: "github.com", sub: "workshop: code + robots", col: "#d9a066" },
    { name: "khamydoan.github.io", sub: "shop window: the website", col: "#f6e7c8" },
    { name: "airesearchcenter.com", sub: "a frame on another wall", col: "#e7c9a9" }
  ];
  function level5(L) {
    var cv = L.canvas({ w: 940, h: 540, fill: true, label: "delivery: click a building or press 1, 2, 3" }), ctx = cv.ctx;
    var queue = u.shuffle(PARCELS, L.rng), cur = 0, wrong = 0, state = "wait", fly = null, hover = -1, glow = [0, 0, 0], hintGlow = [0, 0, 0], bonk = 0, fin = 0, T = 0;
    var HOME = function () { return { x: cv.w / 2, y: 205 }; };
    var pos = HOME();
    function geo(i) { var bw = Math.min(330, cv.w / 3 - 40), x = cv.w * (i * 2 + 1) / 6; return { x: x - bw / 2, y: 256, w: bw, h: 214, cx: x }; }
    function pick(i) {
      if (state !== "wait" || cur >= queue.length) return;
      state = "fly"; fly = { t: 0, to: i, ok: queue[cur].a === i, from: { x: pos.x, y: pos.y } }; RQ.audio.sfx("whoosh");
    }
    L.hud.set("parcels", "📦 0 / " + queue.length);
    L.on(cv.cv, "pointerdown", function (e) { var p = cv.toLocal(e); for (var i = 0; i < 3; i++) { var g = geo(i); if (p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y - 40 && p.y <= g.y + g.h + 60) pick(i); } });
    L.on(cv.cv, "pointermove", function (e) { var p = cv.toLocal(e); hover = -1; for (var i = 0; i < 3; i++) { var g = geo(i); if (p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y - 40 && p.y <= g.y + g.h + 60) hover = i; } cv.cv.style.cursor = hover >= 0 ? "pointer" : "default"; });
    L.on(window, "keydown", function (e) {
      if (document.querySelector(".rq-overlay, .rq-talk")) return;
      var n = parseInt(e.key, 10); if (n >= 1 && n <= 3) { e.preventDefault(); pick(n - 1); }
    });
    async function finale() {
      state = "finale"; await L.wait(1800); if (!L.alive) return;
      await L.talk([["pix", "That frame is an **iframe**. airesearchcenter.com/reseed shows the github.io page inside its own page."],
        ["sprout", "And these games will live at khamydoan.github.io/reseed_games. Let's share them with everyone!"]]);
      if (!L.alive) return;
      L.win({ stars: wrong === 0 ? 3 : wrong <= 2 ? 2 : 1, msg: "Workshop, shop window, picture frame: you know where every part of ReSeed lives.", stats: { "Delivered": queue.length, "Wrong door": wrong } });
    }
    function workshop(g, t) {
      ctx.fillStyle = BUILD[0].col; ctx.strokeStyle = INK; ctx.lineWidth = 4;
      ctx.fillRect(g.x, g.y + 40, g.w, g.h - 40); ctx.strokeRect(g.x, g.y + 40, g.w, g.h - 40);
      ctx.fillStyle = "#5a6b7d"; ctx.beginPath(); ctx.moveTo(g.x - 10, g.y + 44);
      for (var k = 0; k < 3; k++) { ctx.lineTo(g.x + g.w * k / 3, g.y); ctx.lineTo(g.x + g.w * (k + 1) / 3, g.y + 44); }
      ctx.lineTo(g.x + g.w + 10, g.y + 44); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(g.x + g.w - 34, g.y - 4); ctx.rotate(t); ctx.fillStyle = "#9aa7b5"; ctx.lineWidth = 3;
      for (k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -20, 8, 10); } ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = "rgba(29,43,58,.2)"; ctx.lineWidth = 2; for (k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(g.x, g.y + 40 + k * 32); ctx.lineTo(g.x + g.w, g.y + 40 + k * 32); ctx.stroke(); }
      ctx.fillStyle = "#e9f8ff"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, g.x + 20, g.y + 66, g.w * .5, 110, 8); ctx.fill(); ctx.stroke();
      robotArt(ctx, g.x + 20 + g.w * .25, g.y + 172, t, Math.sin(t) > 0 ? "scan" : "pass", "#74c0fc", 1, .8);
      ctx.fillStyle = "#8a5a35"; u.rr(ctx, g.x + g.w * .66, g.y + 110, g.w * .24, g.h - 110, 6); ctx.fill(); ctx.stroke();
    }
    function shop(g, t) {
      ctx.fillStyle = BUILD[1].col; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.fillRect(g.x, g.y + 30, g.w, g.h - 30); ctx.strokeRect(g.x, g.y + 30, g.w, g.h - 30);
      var n = 8, sw = g.w / n;
      for (var k = 0; k < n; k++) { ctx.fillStyle = k % 2 ? "#fff" : "#2b7bd0"; ctx.beginPath(); ctx.moveTo(g.x + k * sw, g.y + 30); ctx.lineTo(g.x + (k + 1) * sw, g.y + 30); ctx.lineTo(g.x + (k + 1) * sw, g.y + 58); ctx.arc(g.x + (k + .5) * sw, g.y + 58, sw / 2, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
      ctx.fillStyle = "#26364a"; ctx.fillRect(g.x + 18, g.y + 84, g.w - 36, g.h - 104);
      miniSite(ctx, g.x + 22, g.y + 88, g.w - 44, g.h - 112, t);
      ctx.lineWidth = 4; ctx.strokeRect(g.x + 18, g.y + 84, g.w - 36, g.h - 104);
    }
    function gallery(g, t, frameK) {
      ctx.fillStyle = BUILD[2].col; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.fillRect(g.x, g.y + 10, g.w, g.h - 10); ctx.strokeRect(g.x, g.y + 10, g.w, g.h - 10);
      ctx.save(); ctx.beginPath(); ctx.rect(g.x, g.y + 10, g.w, g.h - 10); ctx.clip();
      ctx.strokeStyle = "rgba(150,90,60,.35)"; ctx.lineWidth = 2;
      for (var r = 0; r < 9; r++) { var yy = g.y + 10 + r * 25; ctx.beginPath(); ctx.moveTo(g.x, yy); ctx.lineTo(g.x + g.w, yy); ctx.stroke();
        for (var c = (r % 2) * 30; c < g.w; c += 60) { ctx.beginPath(); ctx.moveTo(g.x + c, yy); ctx.lineTo(g.x + c, yy + 25); ctx.stroke(); } }
      ctx.restore();
      var fw = g.w * .66, fh = fw * .62, fx = g.cx - fw / 2, fy = g.y + 50;
      if (frameK > 0) { var e = u.ease.inOut(frameK), bw = Math.min(cv.w * .5, 300 / .62); fw = u.lerp(fw, bw, e); fh = fw * .62; fx = u.lerp(fx, cv.w / 2 - fw / 2, e); fy = u.lerp(fy, 74, e); }
      ctx.fillStyle = "#d4a017"; ctx.strokeStyle = INK; ctx.lineWidth = 4; u.rr(ctx, fx - 14, fy - 14, fw + 28, fh + 28, 8); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#ffe36e"; ctx.lineWidth = 3; ctx.strokeRect(fx - 7, fy - 7, fw + 14, fh + 14);
      miniSite(ctx, fx, fy, fw, fh, t); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(fx, fy, fw, fh);
      if (frameK > .6) {
        ctx.globalAlpha = Math.min(1, (frameK - .6) * 2.5);
        ctx.font = "600 18px " + MONO; var code = '<iframe src="https://khamydoan.github.io/reseed/">', w = ctx.measureText(code).width + 30;
        ctx.fillStyle = "#10161f"; u.rr(ctx, cv.w / 2 - w / 2, fy + fh + 24, w, 40, 12); ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
        text(ctx, code, cv.w / 2, fy + fh + 45, "600 18px " + MONO, "#7ee787");
        ctx.globalAlpha = 1;
      } else pill(ctx, "<iframe>", g.cx, fy + fh + 36, "600 15px " + MONO, "#fff8e6");
    }
    L.loop(function (dt, t) {
      T = t; var W = cv.w;
      skyBg(ctx, W, 540, t, "#9fd9ff", "#fdf4e3");
      ctx.fillStyle = "#c9d1da"; ctx.fillRect(0, 470, W, 70); ctx.fillStyle = "#8494a7"; ctx.fillRect(0, 470, W, 8);
      for (var i = 0; i < 3; i++) {
        var g = geo(i);
        glow[i] = Math.max(0, glow[i] - dt); hintGlow[i] = Math.max(0, hintGlow[i] - dt);
        if (hover === i || glow[i] > 0 || hintGlow[i] > 0) { ctx.fillStyle = glow[i] > 0 ? "rgba(141,229,159,.7)" : hintGlow[i] > 0 ? "rgba(255,227,110," + (.4 + .4 * Math.sin(t * 10)) + ")" : "rgba(255,227,110,.55)"; u.rr(ctx, g.x - 14, g.y - 24, g.w + 28, g.h + 30, 22); ctx.fill(); }
        if (i === 0) workshop(g, t); else if (i === 1) shop(g, t); else gallery(g, t, 0);
        ctx.fillStyle = "#2b7bd0"; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(g.x + 4, g.y + 4, 21, 0, 7); ctx.fill(); ctx.stroke();
        text(ctx, String(i + 1), g.x + 4, g.y + 5, "700 22px " + FONT, "#fff");
        text(ctx, BUILD[i].name, g.cx, 494, "700 20px " + FONT);
        text(ctx, BUILD[i].sub, g.cx, 518, "500 17px " + FONT, "#33475b");
      }
      // parcel card
      if (cur < queue.length && state !== "finale") {
        ctx.font = "600 24px " + FONT; var cw = Math.min(900, W - 60), lines = wrapLines(ctx, "📦 " + queue[cur].t, cw - 40, 2), ch = 30 + lines.length * 30 + 26;
        ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3; u.rr(ctx, W / 2 - cw / 2, 66, cw, ch, 16); ctx.fill(); ctx.stroke();
        lines.forEach(function (l, k) { text(ctx, l, W / 2, 92 + k * 30, "600 24px " + FONT); });
        text(ctx, "Where does it go? Click a building or press 1, 2 or 3.", W / 2, 66 + ch - 20, "500 17px " + FONT, "#4a5b6d");
      }
      // Sprout carries the parcel
      var home = HOME();
      if (state === "fly" || state === "back") {
        fly.t += dt;
        var tgt = state === "fly" ? { x: geo(fly.to).cx, y: 318 } : home, src = state === "fly" ? fly.from : fly.at, k = u.clamp(fly.t / (state === "fly" ? .75 : .6), 0, 1), e = u.ease.inOut(k);
        pos = { x: u.lerp(src.x, tgt.x, e), y: u.lerp(src.y, tgt.y, e) - Math.sin(k * Math.PI) * 50 };
        if (k >= 1 && state === "fly") {
          fly.at = { x: pos.x, y: pos.y };
          if (fly.ok) { glow[fly.to] = 1.2; RQ.audio.sfx("coin"); cur++; L.hud.set("parcels", "📦 " + cur + " / " + queue.length); RQ.ui.toast("✅ " + queue[cur - 1].why, "good", 2200); }
          else { wrong++; bonk = .5; RQ.audio.sfx("bad"); L.timeout(function () { RQ.audio.sfx("giggle"); }, 250); hintGlow[queue[cur].a] = 2.4; RQ.ui.toast("🐞 Wrong door! " + queue[cur].why, "bad", 3200); }
          state = "back"; fly.t = 0;
        } else if (k >= 1 && state === "back") { state = "wait"; if (cur >= queue.length) finale(); }
      } else if (state === "wait") pos = { x: home.x, y: home.y + Math.sin(t * 2.5) * 5 };
      if (state !== "finale") {
        bonk = Math.max(0, bonk - dt); var bx = pos.x + Math.sin(bonk * 60) * bonk * 16;
        if (cur < queue.length || state === "back") {
          ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - 10, pos.y + 22); ctx.lineTo(bx - 14, pos.y + 44); ctx.moveTo(bx + 10, pos.y + 22); ctx.lineTo(bx + 14, pos.y + 44); ctx.stroke();
          if (!(state === "back" && fly && fly.ok)) { ctx.fillStyle = "#e0bb7f"; u.rr(ctx, bx - 22, pos.y + 42, 44, 32, 6); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(bx, pos.y + 42); ctx.lineTo(bx, pos.y + 74); ctx.stroke(); }
          if (bonk > 0) drawChar(ctx, "bug", bx + 34, pos.y + 40, 44);
        }
        drawChar(ctx, "sprout", bx, pos.y, 70, bonk > 0 ? "wow" : "happy");
      } else {
        fin = Math.min(1, fin + dt / 1.4);
        ctx.fillStyle = "rgba(20,32,46," + (.45 * fin) + ")"; ctx.fillRect(0, 0, W, 540);
        gallery(geo(2), t, fin);
        if (fin >= 1) text(ctx, "airesearchcenter.com/reseed shows the shop window in a frame", W / 2, 30, "700 22px " + FONT, "#fff");
      }
    });
  }

  /* ------------------------------------------------------------ the game */
  RQ.game({
    id: "g24",
    music: "garden",
    intro: [
      ["pix", "Hey, I'm Pix! ReSeed's code grows in a **git** history garden."],
      ["pix", "Every commit plants a tree. Push to **main**, and robots test the code and publish the website!"],
      ["sprout", "Let's plant some history. I'll carry the basket!"]
    ],
    outro: [
      ["pix", "Commit, branch, merge, push, test, publish. You work like a real coder now!"],
      ["sprout", "Next stop: the Server Lab Escape. Let's go!"]
    ],
    levels: [
      { title: "Commit trees", goal: "Save files with git add + git commit",
        intro: [["pix", "Each tree here is a **commit**: a saved moment of the code, with a short message."],
                ["pix", "First `git add` puts a file in Sprout's basket. Then `git commit -m \"message\"` plants the tree!"]],
        cards: ["git-commit"], play: level1 },
      { title: "Branch & merge", goal: "Grow a side path, then merge it back",
        intro: [["koa", "G'day! I want to try a bee garden without messing up **main**, the main path."],
                ["pix", "Make a **branch**: a side path. Try ideas there, then **merge** it back when it works."]],
        cards: ["git-branch"], play: level2 },
      { title: "Push & robots", goal: "Push, fix the red test, push again",
        intro: [["hoot", "I made the NDVI code faster! It's saved as a commit on this laptop."],
                ["pix", "Send it with `git push` to **github.com**. ReSeed's workflow files tell GitHub Actions robots to test every push."]],
        cards: ["git-push", "ci-tests"], play: level3 },
      { title: "Your web page", goal: "Add a heading, a sentence, a picture and a link",
        intro: [["tuki", "Websites use **HTML**. Tags like `h1` for headings and `p` for paragraphs tell the browser what each part is."],
                ["tuki", "Build your own page with a heading, a sentence, a picture and a link. It changes live!"]],
        cards: ["html-tags"], play: level4 },
      { title: "Where it lives", goal: "Deliver each parcel to the right building",
        intro: [["pix", "Three places, three jobs. **github.com** is the workshop. **github.io** is the shop window."],
                ["pix", "airesearchcenter.com hangs a frame on its wall that shows the shop window. Deliver each parcel!"]],
        cards: ["github-pages"], play: level5 }
    ]
  });
})();
