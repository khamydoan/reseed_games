# ReSeed Quest engine reference (`js/rq.js`)

Classic script, global `RQ`. No modules, no build, no `fetch()`: every page must run from `file://` too.
Read `games/key-garden/` first: it is the reference game (index.html + cards.js + game.js).

## Page template (`games/<slug>/index.html`)

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GAME TITLE · ReSeed Quest</title>
<link rel="icon" href="../../img/favicon.svg">
<link rel="stylesheet" href="../../css/quest.css">
</head>
<body class="rq">
<script src="../../js/rq.js"></script>
<script src="../../js/catalog.js"></script>
<script src="../../js/chars.js"></script>
<script src="../../audio/voice-manifest.js"></script>
<script src="../../data/reseed-data.js"></script>      <!-- only if you use real ReSeed data -->
<script src="cards.js"></script>
<script src="game.js"></script>
</body>
</html>
```

Optional extra CSS goes in `games/<slug>/style.css` (linked after quest.css). Optional extra scripts in the same folder.

## Game definition

```js
RQ.game({
  id: "g07",                       // must match js/catalog.js
  music: "space",                  // camp | garden | space | lab | sky | forest | mystery | action
  intro: [["tuki", "Line one."], ["sprout", "Line two."]],   // first visit only, before level 1
  outro: [["hoot", "Bye!"]],       // after every level has ≥1 star (first time)
  levels: [
    { title: "Short title", goal: "One-line goal shown as a toast",
      intro: [["tuki", "Up to 2 sentences per bubble."]],     // before the level starts
      cards: ["card-id-1"],         // Field Cards given the first time this level is won
      play: function (L) { ... }    // build the level inside L.stage; call L.win / L.fail
    }
  ]
});
```

The shell gives: header (map link, title, level dots, HUD chips, sound/music/voice/pause buttons), first-time Start
button, level select, win screen (stars, stats, cards), fail screen (retry), pause on tab hide, stretch-break reminder,
saving. URL `#level=3` jumps straight to level 3 (used by tests).

## Level context `L`

| Member | What it does |
|---|---|
| `L.stage` | empty `<div class="fill">` (absolute, fills the area below the header). Build your level here. |
| `L.canvas({w, h, parent, fill, bg, onResize, label})` | logical-size canvas fitted into `parent` (default `L.stage`), hi-DPI. Returns `{cv, ctx, w, h, scale, toLocal(evt) -> {x,y}, clear(color)}`. `fill:true` widens `w` to the available width (read `api.w`); `fillH:true` does the same for the height (`api.h`). The parent must have a size (use a `.fill` or flex child with `position:relative`). It refits when the window or the parent really changes size — resizing wipes the pixels, so draw in `L.loop` or redraw in `onResize`. |
| `L.loop(fn(dt, t))` | requestAnimationFrame loop in seconds; stops at level end, freezes while paused; 0 ≤ dt ≤ 0.05. An exception is logged (first 3) and the loop keeps running. |
| `L.on(target, type, fn)` | addEventListener that is removed at level end and ignored while paused. Use for window keydown etc. |
| `L.timeout(fn, ms)`, `L.interval(fn, ms)`, `await L.wait(ms)` | auto-cleared timers. |
| `L.onEnd(fn)` | run `fn` when the level ends (cleanup). |
| `L.hud.set(key, html)` | chip in the header (`null` removes). e.g. `L.hud.set("score", "⭐ 3")`. |
| `L.win({stars, msg, stats})` | end the level. `stars` 1–3 (finishing always gives ≥ 1). `stats` = `{"Accuracy": "95%"}`. |
| `L.fail(msg)` | end with a friendly retry screen. Use sparingly (prefer partial stars). |
| `L.alive`, `L.paused` | check `L.alive` after every `await`. |
| `L.fails` | how many times the kid failed this level this session: show hints when ≥ 1. |
| `L.rng()` | seeded random for this run. |
| `L.say/L.talk/L.choose/L.toast/L.sfx/L.hint(text, who)` | shortcuts to `RQ.ui` / `RQ.audio`. |

## UI (`RQ.ui`)

- `await RQ.ui.say(who, text, {mood, top})` — speech bubble with portrait + typewriter + voice. `who`: sprout · koa · tuki · hoot · pix · mo · bug · narrator. `mood`: happy · wow · think · sad. Text markup: `**bold**`, `` `code` ``.
- `await RQ.ui.talk([[who, text], [who, text, {mood}]])` — a sequence.
- `var i = await RQ.ui.choose(who, text, ["A", "B", "C"])` — multiple choice (keys 1–9 work).
- `RQ.ui.toast(text, "good"|"bad"|"info", ms)`, `RQ.ui.float(pageX, pageY, "+1", color)`, `RQ.ui.confetti()`.
- `await RQ.ui.modal({icon, title, html | node, buttons:[{label, cls:"go"|"primary"|"danger", value}], dismiss})`.
- `RQ.ui.cardHTML(card)` — HTML of a Field Card (for previews).

**Voice lines.** Write every spoken line as a *string literal* directly inside `say("who", "…")`, `choose("who", "…", …)`,
`intro`/`outro` arrays or `[["who", "…"]]` arrays, so `tools/voice.py` can find it and pre-generate the MP3.
Lines built at runtime (with numbers) still work: they use the browser's speech synthesis when "read aloud" is on.

## Audio (`RQ.audio`)

`RQ.audio.sfx(name)` — synthesized, no files: click select key type pop coin good bad error win lose whoosh drop boom
jump beep tick powerup splash buzz zap snap bloom chirp giggle shutter engine.
`RQ.audio.tone({f, f2, type, t, d, v, lp})` and `RQ.audio.noise({f, f2, ft, t, d, v})` for custom sounds; `var h = RQ.audio.hum({f: 110, v: .06}); h.set(freq, vol); h.stop()` for a continuous rotor/engine sound (stop it in `L.onEnd`). All respect the 🔊 switch.
Music is started by the shell from `music`.

## Widgets

- **Keyboard** `var kb = RQ.keyboard.mount(container, {compact: true | "tiny", fingers})` → `kb.highlight(ch)` (returns `{finger, shift}`),
  `kb.flash(ch, ok)`, `kb.destroy()`. `RQ.keyboard.FINGERS`, `RQ.keyboard.FINGER_NAMES`, `RQ.keyboard.info(ch)`.
- **Terminal** `var t = RQ.term.mount(container, {user, host, cwd, title, height, env})` →
  `t.print("[g]green[/g] [r]red[/r] [y] [b] [m] [c] [w] [dim]")`, `await t.printSlow(lines, ms)`, `await t.progress(label, ms)`,
  `var cmd = await t.ask({expect: "conda activate reseed" | /regex/ | fn, ghost: "faint text to copy", hint, wrong: (cmd, tries) => "[r]message[/r]"})`,
  `t.setEnv("reseed")` (shows `(reseed)` in the prompt), `t.clear()`, `t.focus()`. Custom prompt: `mount(c, {prompt: "PS C:\\>"})` or `prompt: api => html`; `t.setPrompt(p)`. Tab completes a string `expect`; after 3 wrong tries the expected command appears as ghost text.
- **Python code** `RQ.code.highlight(src)` → HTML; `RQ.code.block(src, {lines, hl:[2,3]})` → `<pre>`;
  `var p = RQ.code.parsons(container, correctLines, {distractors})` → `p.check()`; 
  `var b = RQ.code.blanks(container, "return ([[nir]] - red) / (nir + [[red]])", {onEnter})` → `b.check()`.

## Data

`<script src="../../data/reseed-data.js">` → `RQ.data()` = `{sites[13], biomes, roll, drones, examples, thresholds, health, forest_rule, physics, forestnet, stac_url}`.
`RQ.site("ozarks")`, `RQ.mySite()` (the player's chosen site: rondonia | dixie | kalimantan), `RQ.url("data/sites/ozarks/rgb.jpg")` for images.
Each site: `id, name, country, lat, lon, biome, story, verdict{code,text,action,areas_ha,patch_ha}, classifier{forest_tile_fraction, top_landcover}, ndvi{baseline_forest_mean, image_forest_mean, monthly[12]}, years[{year, source, mean_forest_ndvi, rgb}], tiles{p_forest[10][10]}, patches[], logistics, mission, release_footprint, files{thumb, rgb, rgb_baseline, ndvi, classes}`.
`data/forestnet-model.js` → `window.RQ_FORESTNET` (real weights, base64 float16) for `js/forestnet.js`.

## Saving

`RQ.save.load()` (whole state), `RQ.save.game(id)`, `RQ.save.write()`. Store game-specific extras under
`RQ.save.game("g07").extra = {...}; RQ.save.write()`. Never store personal data.

## Utilities `RQ.u`

`clamp lerp rand randi pick shuffle seeded fnv hashText sleep dist fmt ease.{outCubic,inOut,outBack,outElastic} $ $$ esc el local rr`.
`u.el("div", {class, style:{}, html, text, onclick, dataset, ...attrs}, ...children)` builds DOM.
`u.rr(ctx, x, y, w, h, r)` rounded-rect path.

## Testing

`conda activate games && python tools/smoke.py <slug> --shots /tmp/shots` — boots every level headless and fails on any JS error.
Look at the screenshots. `--keys "abc"` types after boot; `--level N` one level.
