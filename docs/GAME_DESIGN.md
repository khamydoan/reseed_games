# ReSeed Quest — game design (source of truth)

**One sentence.** A browser game world for kids aged 8–12 that follows the real ReSeed program
("satellites find lost forest, drones plant it back") step by step, where every minigame quietly
trains a real computer-science or science skill.

**Audience.** Ages 8–12 (US grades 3–7). Readers at grade 3 must be able to play: short sentences,
every on-screen instruction also shown as an icon or demonstrated; every spoken line can be read aloud.

**Stealth-learning rules (most important).**
1. The kid is never "in a lesson". They are on a *mission*: rescue a koala, launch a drone, fix the lab.
2. Real terms appear as *things you use*: a "CUDA crystal", a `conda activate` spell, a TCP parcel with a
   tracking number. The real word is always shown; the explanation is one short sentence, in-game.
3. Practice is the game loop itself (typing commands opens doors; picking the median clears clouds).
4. After a level the kid *collects* a Field Card (real term + one-line fact + "How ReSeed uses it"),
   not a summary of a lesson. Cards fill the **Field Guide** in the hub (a collection book).
5. No walls of text. Max 2 sentences per speech bubble, max ~22 words per sentence.
6. Failing is cheap and funny (bugs giggle, drone bonks), retry is instant, hints appear after 2 fails.
7. Levels are 1–3 minutes. 3–5 levels per game. After ~20 minutes of play, Sprout suggests a stretch break.

## The world map (hub: `index.html`)

Eight islands, joined by a dotted flight path, follow the ReSeed journey from
`ReSeed_Pitch_Pack/ReSeed-explained.html` (stages See, Check, Score, Decide, Plan, Fly, Share), plus a
**Base Camp** first: before ReSeed can run you need a computer, an OS, drivers and a Python environment.

| # | Island | ReSeed step(s) | Colour | Games |
|---|---|---|---|---|
| 0 | Base Camp — build the mission computer | README "Run it" (conda env, GPU training) | `#12a39a` | g01 Key Garden · g02 Mo's Workshop · g03 Operation Install · g04 Driver Tower · g05 Potion Lab |
| 1 | See — pictures from space | 01 Acquire (`reseed/acquire.py`) | `#d08a1c` | g06 Satellite Snap · g07 Cloud Sweeper · g08 Cloud City · g09 Packet Post |
| 2 | Check — is it a forest? | 02 Classify (`reseed/classify/`) | `#7c5cc4` | g10 Tile Detective · g11 Brain Builder · g12 Model Garage |
| 3 | Score — the greenness score | 03 NDVI (`reseed/ndvi.py`) | `#2f9e4f` | g13 NDVI Goggles · g14 Spell Academy |
| 4 | Decide — lost, or just winter? | 04 Detect (`reseed/detect.py`) | `#d1495b` | g15 Forest Detective |
| 5 | Plan — outline, count, choose | 05 Polygonize, 06 Logistics, 07 Species | `#e0752d` | g16 Patch Painter · g17 Roll Factory · g18 Seed Library |
| 6 | Fly — drop, fly, regrow | 08 Physics, 09 Mission, ↻ Regrow | `#2b7bd0` | g19 Seed Drop · g20 Drone Academy · g21 Drone Rush · g22 Mission Coder · g23 Regrow Rescue |
| 7 | Share — tell the world | Build, test, publish (GitHub) | `#5a6b7d` | g24 Git Garden · g25 Server Lab Escape (finale) |

All games are open from the start (no hard locks); the map glows the *recommended next* game.

## Characters (original — do not use any existing franchise characters)

| id | Who | Role | Voice (gpt-audio-1.5) |
|---|---|---|---|
| `sprout` | Sprout, a round green seed-drone robot with a leaf antenna and four tiny rotors | the player's buddy, main guide | `coral` |
| `koa` | Koa the koala from Kangaroo Island, aviator goggles | drone pilot, Fly island | `ballad` |
| `tuki` | Tuki the toucan from the Amazon, satellite-dish backpack | space and cloud messenger, See island | `verse` |
| `hoot` | Professor Hoot, an owl with round glasses and a bow tie | Python and data teacher, Score/Decide | `cedar` |
| `pix` | Pix the pangolin, hoodie and headset | command-line hacker, Base Camp/Share | `sage` |
| `mo` | Mo the mole, hard hat and screwdriver | hardware engineer, Base Camp | `ash` |
| `bug` | Glitch Bugs: small purple beetles with antenna "error" sparks | mischievous bugs = code bugs; they giggle | (no voice) |

## Game list (25)

Each entry: **concept** · levels · skills (what they really learn) · ReSeed tie (real file) · cards.
All numbers that claim to be ReSeed's must come from the code (see `data/reseed-data.js`).

### Base Camp
- **g01 Key Garden** (`key-garden`) — typing on US QWERTY. Seeds fall on garden rows; type the letter on
  each seed to plant it before it lands; flowers bloom, bees and butterflies arrive. On-screen keyboard
  shows the finger for each key (colour zones). Levels: home row · top row · bottom row · numbers & symbols
  · Python words (`def`, `import`, `print()`). Tracks WPM and accuracy. Ties: every command in ReSeed is typed.
- **g02 Mo's Workshop** (`build-a-bot`) — computer hardware. L1 drag parts onto the motherboard (CPU,
  GPU, RAM, SSD, HDD, PSU, fan) with snap-fit and "wrong socket" bonk. L2 "Kitchen Rush": tasks fly in and
  the kid routes them: CPU = head chef (one hard job), GPU = 1000 helpers (millions of pixels at once),
  RAM = countertop (fast, forgets at power-off), SSD/HDD = pantry (keeps things). L3 upgrade the PC to train
  ForestNet faster (GPU training took ~12 minutes on one GPU, README). L4 read a real spec sheet: this
  project's VM has 4 × NVIDIA A100 80 GB.
- **g03 Operation Install** (`os-install`) — operating systems. Flash a USB stick, BIOS/UEFI boot order,
  pick Ubuntu / Windows / RHEL (what each is for, apt vs winget vs dnf), partition the disk (drag the
  slider), make a user and a strong password (password-strength meter), first boot, `sudo apt update`.
- **g04 Driver Tower** (`driver-tower`) — NVIDIA driver → CUDA toolkit → cuDNN → PyTorch. Tower-stacking
  puzzle: blocks only stick in the right order and with matching versions (driver must support the CUDA
  version). Then a fake terminal: `nvidia-smi` shows the GPUs; kid answers "how many GPUs? how much memory?".
  Final: `python -c "import torch; print(torch.cuda.is_available())"` prints `True` → fireworks.
- **g05 Potion Lab** (`potion-lab`) — virtual environments. Each project gets its own cauldron
  (environment). Pouring potions (libraries) into the *base* cauldron makes it bubble over (conflict!).
  Typed spells: `conda create -n reseed python=3.12`, `conda activate reseed`, `pip install numpy`,
  `uv venv`, `uv pip install rasterio`, `python -m venv .venv`; read an `environment.yml` recipe;
  numpy 1 vs numpy 2 conflict level. Tie: `environment.yml`, conda env `reseed`.

### See (step 01)
- **g06 Satellite Snap** (`satellite-snap`) — orbits, revisit, pixels, GPS coordinates. A spinning
  globe; Sentinel-2 (10 m pixels, ~5-day revisit) and Landsat (30 m, since 1984) orbit; press SPACE to
  snap when over a target given by latitude/longitude. Pixel zoom level: "which satellite can see the
  toucan's tree?" Ties: `acquire.py` (`load_sentinel2`, `load_landsat`), `config.py` site lat/lon.
- **g07 Cloud Sweeper** (`cloud-sweeper`) — cloud masks + median compositing (algorithm: sort and take
  the middle). Several cloudy pictures of the same real site are stacked; the kid picks the middle
  value per pixel, then runs the "median magic" on the whole picture; masks cloudy pixels (SCL).
  Ties: `acquire.py` cloud-masked median composites (up to 8 scenes).
- **g08 Cloud City** (`cloud-city`) — cloud computing. A tycoon: rent machines in Azure / AWS / GCP
  regions, pick CPU vs GPU VMs, store pictures in a **storage account** (blob containers; hot/cool/archive
  tiers), query the **Planetary Computer** STAC catalogue (where? when? how cloudy?), watch the cost meter and
  turn machines off at night. Ties: `PC_STAC_URL`, `acquire.search`, Azure OpenAI (gpt-6-astra) server.
- **g09 Packet Post** (`packet-post`) — networking. Pictures travel as numbered packets. TCP lane:
  3-way handshake (SYN, SYN-ACK, ACK), number parcels, resend lost ones, reassemble in order. UDP lane:
  live drone video, fast, a lost frame is just skipped. DNS: look up `khamydoan.github.io`; ports (443 HTTPS,
  8000 for `python -m reseed serve`); IP addresses. Ties: `server.py` (/api/health, /api/classify).

### Check (step 02)
- **g10 Tile Detective** (`tile-detective`) — cut a real satellite picture into 64×64 tiles, sort tiles
  forest / not forest quickly; then the *real* ForestNet (in JS) sorts them too; compare. 1-in-4 rule: at least
  25 % forest tiles → forest land; otherwise STOP. Ties: `classify/infer.py`, `site/js/forestnet.js`.
- **g11 Brain Builder** (`brain-builder`) — neural networks. L1 one neuron: drag weights/bias to split
  green dots from grey dots. L2 stack layers (Conv, ReLU, Pool, Dense, Softmax) to rebuild ForestNet
  (conv 3→24→48→96→160, ~215k parameters). L3 train for real: a tiny network trains in the browser, loss
  falls, accuracy climbs; epochs, learning rate too high = chaos. L4 CPU vs GPU training race.
  Ties: `classify/model.py`, `classify/train.py`.
- **g12 Model Garage** (`llm-garage`) — big AI models on GPUs. ReSeed asks gpt-6-astra for a
  second opinion. Park models into GPUs by memory: parameters × bytes (fp16 = 2 bytes, 4-bit ≈ 0.5 byte).
  vLLM = big restaurant kitchen serving many users on server GPUs; llama.cpp = food truck that runs a
  quantized GGUF model on a laptop CPU/GPU. Tokens: watch a sentence get chopped into tokens.
  Ties: `reseed/llm.py`, `server.py` second opinion.

### Score (step 03)
- **g13 NDVI Goggles** (`ndvi-goggles`) — invisible light. Put on near-infrared goggles; leaves glow.
  NDVI = (NIR − Red) / (NIR + Red) with kid numbers (NIR 8, Red 2 → 0.6). Health classes from
  `config.HEALTH_CLASSES`: ≥0.6 healthy · 0.3–0.6 moderate · 0.1–0.3 sparse (seedable) · <0.1 none (urgent) ·
  ≤0 not seedable. Real NDVI maps of real sites. Month-by-month wave (oak forest low in winter).
- **g14 Spell Academy** (`spell-academy`) — Python. Professor Hoot's spellbook: variables, numbers,
  strings, `print`, functions (`def ndvi(nir, red): return (nir - red) / (nir + red)`), `if/elif/else`
  (`health_class`), `for` loops over months, lists, dicts (`BIOMES["oak_hickory"]`), `@dataclass class Drone`.
  Formats: predict-the-output, fill-the-blank, put-the-lines-in-order (Parsons), fix-the-bug (indentation,
  missing colon, missing quote). Optional real Python (Pyodide) sandbox when online.

### Decide (step 04)
- **g15 Forest Detective** (`forest-detective`) — data detective with the 13 real sites. Case files with
  the real satellite picture, monthly NDVI wave and best-season-per-year bars. Rule from `detect.py`/
  `config.py`: peak drop ≥ 0.20 (or ≥ 25 %) in **two** recent seasons + burn clue (dNBR ≥ 0.10) → RESEED;
  low only in winter, peak returns → SEASONAL; past dip now healed → RECOVERING; else HEALTHY; ForestNet said
  no → NOT FOREST. Kid stamps the verdict; then builds the rule as an if/elif flowchart.

### Plan (steps 05–07)
- **g16 Patch Painter** (`patch-painter`) — algorithms on grids: threshold slider, flood fill (paint
  bucket) to find connected patches, count area (Sentinel-2 pixel = 10 m × 10 m = 0.01 ha; 1 ha = 100 m ×
  100 m), drop patches < 0.5 ha, sort patches by size (sorting race), split patches > 50 ha into drone-sized
  squares. Ties: `polygonize.py`, `MIN_PATCH_HA`, `MISSION_MAX_HA`.
- **g17 Roll Factory** (`roll-factory`) — maths and functions. Toilet-roll seed pods: volume of a cylinder
  (π r² h → 159 mL), packing 60 %, 10 % jam, seeds per roll, rolls, trips (sorties), batteries, days, cost
  vs hand planting; round UP (`math.ceil`) because you cannot fly half a trip. Ties: `logistics.py`.
- **g18 Seed Library** (`seed-library`) — databases. A seed library database: tables, rows, columns,
  keys; build queries with blocks (`SELECT common FROM species WHERE biome = 'oak_hickory' ORDER BY mass_g`);
  rescue: "the Ozarks need native seeds — never mango". JSON vs table; a `Species` record as a Python dict.
  Ties: `species.py` (`BIOMES`), `site/data/species.json`.

### Fly (steps 08–09 + Regrow)
- **g19 Seed Drop** (`seed-drop`) — physics. Side view: set height, speed, wind and release mode
  (hatch drop, jerk back, backward flick, spin spread) and drop seeds into the target patch. Acorns fall
  fast (~17 m/s terminal), pine seeds drift (~5.5 m/s). Same equation as ReSeed: dv/dt = g − k|v−w|(v−w),
  k = g / v_t². Ties: `physics.py`, `site/js/physics.js`.
- **g20 Drone Academy** (`drone-academy`) — everything drones: types (quadcopter, hexacopter,
  octocopter, fixed-wing, VTOL hybrid, single-rotor helicopter) and what each is good at; parts
  (propellers, motors, ESC, flight controller, GPS, LiPo battery, radio); sticks (throttle, yaw, pitch, roll)
  trainer; pre-flight checklist; flight modes (GUIDED, RTL, LAND); safety (line of sight, no flying near
  airports or people). Ties: `demo_flight.py` (arm, take off, GUIDED, land).
- **g21 Drone Rush** (`drone-rush`) — physics flying adventure in the spirit of hill-climb / Drive-Mad
  games (original art and levels): fly the seed drone across hilly side-scrolling levels, keep it balanced,
  carry the seed roll, drop it on the patch, return home before the battery runs out; wind gusts, trees,
  birds, rain. 8 short levels with medals. Ties: battery/endurance from `logistics.Drone`.
- **g22 Mission Coder** (`mission-coder`) — algorithms and GPS. Program the drone with blocks
  (`forward(n)`, `turn_left()`, `drop()`, `repeat n:`) to cover the patch with lawnmower (serpentine) lines;
  fewer blocks = more stars; then waypoints as latitude/longitude; export a `.waypoints` file. Final: the
  demo-day script (x, y → x+1 m, y+1 m, jerk back, return). Ties: `mission.lawnmower`, `demo_flight.timeline`.
- **g23 Regrow Rescue** (`regrow-rescue`) — typing + ecology. Years pass; type the word on each
  falling item (water, nest box, acorn…) to help returning animals; trees grow; an NDVI line climbs.
  Biome levels (Amazon, Sierra, Ozarks, Kangaroo Island, Borneo) with their real animals from `species.py`.

### Share (publish)
- **g24 Git Garden** (`git-garden`) — git and the web. Each `git commit` plants a labelled tree in the
  history garden; branches grow sideways; `git push` sends it to github.com; GitHub Actions robots run the
  tests (red/green) and publish; build a tiny web page with HTML tags (live preview); github.io = shop window,
  airesearchcenter.com = a frame on another wall. Ties: `.github/workflows/tests.yml`, `pages.yml`.
- **g25 Server Lab Escape** (`lab-escape`) — finale platformer in the spirit of slime-lab escape games
  (original art and levels): Sprout escapes the data centre room by room (CPU, RAM & GPU, Disk, Network, Database &
  Roof), sticking to walls and dodging Glitch Bugs. Code operates the room: change a loop count and a bridge grows, fix
  a condition (`ndvi >= 0.6`) and a door opens, pick the right list index, port or dict key; rescue the animal friends.

## Technical rules

- **No build step, no modules.** Plain `<script src>` classic scripts so every page works from GitHub
  Pages *and* when `index.html` is double-clicked (file://). No `fetch()` of local files; data ships as JS
  (`window.RQ_DATA = …`). No CDN at runtime except optional extras that degrade gracefully.
- **Layout.** `index.html` (hub) · `css/quest.css` · `js/rq.js` (engine) · `js/catalog.js` (chapters,
  games) · `js/chars.js` (SVG characters) · `data/reseed-data.js` + `data/sites/<id>/*` (real ReSeed data) ·
  `games/<slug>/index.html` + `game.js` + `cards.js` (+ optional `assets/`) · `audio/voice/*.mp3` +
  `audio/voice-manifest.js` · `tools/` (Python build + checks, run in conda env `games`) · `docs/`.
- **Engine API** is documented in `docs/ENGINE.md`. Games use `RQ.game({...})` for the shell (header,
  level select, intro, win/fail screens, stars, cards, save), `RQ.ui.talk/say/choose`, `RQ.audio.sfx`,
  `RQ.term` (fake terminal), `RQ.keyboard` (on-screen QWERTY), `RQ.code` (Python highlighting, Parsons,
  blanks), `RQ.u` (helpers).
- **Input.** Mouse/touch and keyboard for everything (except typing games, which need a keyboard and say
  so). Big targets (≥ 44 px). Works at 1024×640 up to 1920×1080; usable on a tablet in landscape.
- **Audio.** All SFX and music are synthesized with WebAudio (no files). Voice lines: pre-generated MP3 by
  gpt-audio-1.5 looked up by a hash of the exact text; else browser speech synthesis if "Read aloud" is on.
- **Saving.** `localStorage` only (nickname, stars, cards, settings). No accounts, no network, no tracking.
- **Accessibility.** Text ≥ 16 px; colour is never the only signal; `prefers-reduced-motion` respected;
  pause on tab hide.
- **Honesty.** Facts that claim to be ReSeed's must match the code. Game simplifications are labelled
  "game version" in the Field Card when they differ.
