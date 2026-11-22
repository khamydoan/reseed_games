# Brief for a game-building agent (ReSeed Quest)

You are building some of the 25 minigames of **ReSeed Quest** — a browser game world for kids aged 8–12 that follows
the real ReSeed program (satellites find lost forest, drones plant it back) and quietly teaches computer science.

Folder: `/home/azureuser/KhaMy_Doan/ReSeed/Methods/APPROACH_Claude/Games/` (below: `Games/`).
Real ReSeed code (read-only, the source of truth for facts): `/home/azureuser/KhaMy_Doan/ReSeed/Methods/APPROACH_Claude/reseed/`.

## Read first (in this order)
1. `Games/docs/GAME_DESIGN.md` — the whole world, characters, rules, your games' one-paragraph specs.
2. `Games/docs/ENGINE.md` — the engine API you must use.
3. `Games/games/key-garden/` (index.html, cards.js, game.js) — the reference game. Match its quality and structure.
4. The ReSeed files your games are about (listed in your task). Numbers you present as ReSeed's must match them.

## Hard rules
- **Only write inside your own `Games/games/<slug>/` folders** (plus any new shared file your task explicitly gives you).
  Do NOT edit `js/rq.js`, `js/catalog.js`, `js/chars.js`, `css/quest.css`, `index.html`, `data/`, or other games.
  If you need an engine change, work around it locally and list the request in your final report.
- Classic scripts only (no `import`/`export`, no `type="module"`), no `fetch()`/XHR of local files, no CDN, no external
  images or fonts. Draw art with canvas/SVG/CSS in code; you may use the real images in `Games/data/` via `RQ.url(...)`.
  Must work from `file://` and from GitHub Pages under a sub-path (always use relative paths / `RQ.url`).
- Each game: `index.html` (from the template in ENGINE.md), `cards.js` (3–6 Field Cards via `RQ.defineCards(id, [...])`),
  `game.js` (calls `RQ.game({...})` with the id from `js/catalog.js`). Optional `style.css`.
- 3–5 levels per game (Drone Rush: 5). Each level 1–3 minutes. Every finished level gives ≥ 1 star; 2–3 stars for
  accuracy/efficiency. Prefer partial stars over `L.fail`. After a fail, `L.fails ≥ 1` → show a 💡 hint.
- Mouse/touch AND keyboard. Targets ≥ 44 px. Must look good from 1024×640 to 1920×1080.
- Respect `L.alive` after every `await`; use `L.on`, `L.loop`, `L.timeout` (auto-cleanup) instead of raw listeners/timers.
- `"use strict"` IIFE like the reference. No console errors. Keep each game.js under ~1,500 lines.

## Writing for kids (ages 8–12)
- The kid is on a **mission**, never in a lesson. Real terms are *things you use* (a `conda activate` spell, a TCP parcel).
- Speech bubbles: max 2 short sentences, max ~22 words per sentence, grade-3–5 words. Bold real terms with `**…**`,
  code with backticks. Every level intro ≤ 2 bubbles. Characters: sprout (buddy), koa (drone pilot), tuki (space/cloud),
  hoot (Python/data), pix (command line), mo (hardware), bug (Glitch Bugs, the giggling mischief = code bugs).
- Spoken lines must be **string literals** inside `say/choose/talk` calls or `intro/outro` arrays (voice generation scans them).
- Make it *fun*: juicy feedback (sfx, particles, bounce), humour (bugs giggle, drone bonks), visible progress, a surprise per level.
- Honesty: when the game simplifies reality, the Field Card says "(game version)". Field Card `reseed:` lines must be true for the
  real code (cite file names like `reseed/ndvi.py`).
- Use **My Site** (`RQ.mySite()`: Rondônia, Dixie Fire scar or Ketapang) where it fits, so one forest travels through the journey.

## Accepted review changes (from gpt-6-astra's design review — apply those for your games)
- g01: stationary first, falling optional (done in reference).
- g03: four small missions (boot USB, choose OS, inspect disk — erasing is visibly reversible inside the simulator, fictional
  user/password —, first boot); one level matches each OS to its package manager (Ubuntu apt, RHEL dnf, Windows winget).
- g04: two routes: the easy route (`pip install torch` wheels already bundle the CUDA runtime; you need only the NVIDIA driver)
  and the expert route (driver → CUDA toolkit → cuDNN → build). `nvidia-smi`'s "CUDA Version" is the *newest CUDA the driver
  supports*, not the installed toolkit. Commands: prefilled with one missing token, not long copying. Demonstrate one mismatch first.
- g05: conflicts come from incompatible requirements (e.g. a package that needs numpy<2 and one that needs numpy>=2), not
  from "base" magically breaking; always activate/select the environment before installing; uv flow = `uv venv` →
  `source .venv/bin/activate` → `uv pip install …` (or `uv add` inside a project).
- g06: separate imaging satellites (Sentinel-2, Landsat) from navigation satellites (GPS) and show a GPS uncertainty circle.
  10 m is the resolution of Sentinel-2's red/green/blue/near-infrared bands (Landsat 30 m); satellites see forest patches,
  not single trees; clouds can spoil a pass (revisit ≈ 5 days does not guarantee a clear picture).
- g08: one rescue job per level, three machine choices, a visible deadline; Azure *storage account → container → blob* vs AWS S3
  *bucket* vs Google Cloud Storage *bucket*; stopping (deallocating) a VM stops compute cost but storage still costs a little.
- g09: a video frame spans several UDP packets; the video app decides to conceal or skip a damaged frame; UDP has no delivery
  or order guarantee.
- g11: start with a draggable decision line (one neuron), then an animated 3×3 filter scanning pixels; exact ForestNet
  architecture assembly is an optional expert level; include train/test split — test on unseen tiles, discover that a
  green farm can fool the model.
- g12: GPU memory = weights (params × bytes) + KV cache / runtime working memory; a longer prompt/conversation can run out of
  memory; simulate launching a vLLM server and a llama.cpp GGUF model, sending a prompt, and diagnosing "out of memory".
- g13: use the exact non-overlapping classes of `reseed/ndvi.py health_class` (value ≥ 0.60 healthy, ≥ 0.30 moderate,
  ≥ 0.10 sparse, ≥ 0.01 none, else not seedable); low NDVI on water/roads/snow is *not* a reason to seed: ReSeed only seeds where
  ForestNet says it *was* forest (historical forest check).
- g14: main path = variables, conditions, loops, simple functions; classes as a scaffolded final challenge (two Drone objects,
  a method that uses battery).
- g15: include the historical-forest check; dNBR is a "burn **or clearing**" clue (short-wave infrared), not proof of fire;
  present the rule as ReSeed's rule (a project heuristic) and mention its limits once.
- g17: kids fill visible seed slots in a roll and load whole trips first; the formula is revealed after they succeed.
- g20: an emergency level: low battery, lost radio link, bad GPS → choose RTL / land now / hold, with reasons.
- g21: 5 levels, checkpoint at the seed drop, one new complication per level.
- g22: score coverage and safe return first, compactness (fewer blocks) last; the exported `.waypoints` is labelled "practice file".
- g23: choose habitat helpers (water, nest box, native seeds…) then type short deployment words; different animals return
  depending on choices.
- g25: code operates the room (change a loop count → platforms move; change a condition → a door opens), not quiz toll gates.
- All: "Award a successful mission first; accuracy/efficiency medals are optional extras."

## Done means
1. `conda activate games && cd Games && python tools/smoke.py <slug> --shots /tmp/shots-<slug>` passes with 0 failures for
   each of your games, and you have LOOKED at the screenshots (Read the PNGs) and fixed anything ugly, overlapping or cut off.
   Also try a few interactions yourself with a small Playwright script if the level needs mouse input to progress.
2. `node -e "new (require('vm').Script)(require('fs').readFileSync('games/<slug>/game.js','utf8'))"` passes.
3. Your final message (≤ 400 words) lists: games + levels + cards, the ReSeed facts used (with file refs), any engine/catalog
   change requests, and known limitations. Do not paste code into the final message.
