# ReSeed Quest

**Play:** [khamydoan.github.io/reseed_games](https://khamydoan.github.io/reseed_games/) · or download this folder and
double-click `index.html` (works offline).

25 browser games for kids aged 8–12 that follow the real [ReSeed](https://github.com/khamydoan/reseed) program,
*satellites find lost forest, drones plant it back*, one step at a time. On the way, kids practise US QWERTY typing and
meet the computer science that ReSeed really uses: hardware, operating systems, NVIDIA drivers and CUDA, Conda and uv,
networks, the cloud, neural networks, LLM serving (vLLM, llama.cpp), NDVI, algorithms, databases, Python, drones, physics,
Git and the web. They are on missions, not in lessons; every real term becomes a collectible Field Card.

| Island | ReSeed step | Games |
|---|---|---|
| ⛺ Base Camp | before step 01: the computer | Key Garden · Mo's Workshop · Operation Install · Driver Tower · Potion Lab |
| 1 See | 01 Acquire | Satellite Snap · Cloud Sweeper · Cloud City · Packet Post |
| 2 Check | 02 Classify (ForestNet) | Tile Detective · Brain Builder · Model Garage |
| 3 Score | 03 NDVI | NDVI Goggles · Spell Academy |
| 4 Decide | 04 Deforested or seasonal? | Forest Detective |
| 5 Plan | 05 Outline · 06 Count · 07 Choose | Patch Painter · Roll Factory · Seed Library |
| 6 Fly | 08 Drop · 09 Fly · ↻ Regrow | Seed Drop · Drone Academy · Drone Rush · Mission Coder · Regrow Rescue |
| 7 Share | GitHub, Actions, Pages | Git Garden · Server Lab Escape (finale) |

Parents and teachers: open **For grown-ups** on the map (`parents.html`) for the skill map and privacy notes
(no accounts, no tracking; progress stays in the browser).

## How it is built

No build step and no frameworks: plain HTML, CSS and classic `<script>` files, so the same folder runs from GitHub Pages and
from `file://`.

```
index.html, js/hub.js, css/hub.css    the world map (hub)
js/rq.js                              engine: game shell, levels, stars, save, UI, synth audio, voice, keyboard, terminal, Python code widgets
js/catalog.js, js/chars.js            islands + games; original SVG characters
js/forestnet.js                       the real ForestNet CNN in plain JavaScript (weights in data/forestnet-model.js)
games/<slug>/{index.html,game.js,cards.js}   one folder per game
data/reseed-data.js, data/sites/      real ReSeed results for 13 places (from the ReSeed repo)
audio/voice/*.mp3, audio/voice-manifest.js   character voices (gpt-audio-1.5)
tools/                                build data, voices, reviews and tests (Python, conda env `games`)
docs/                                 design, engine API, agent brief, how it was made, verification reports
```

## Rebuild and test (conda env `games`)

```bash
conda create -n games -c conda-forge python=3.12 nodejs=22 pillow numpy imageio-ffmpeg
conda activate games && pip install playwright && python -m playwright install chromium-headless-shell
python tools/build_data.py            # copy real results from ../reseed (site/data, config.py)
python tools/check_static.py          # structure, no modules/fetch/CDN, cards, JS syntax, no secrets
python tools/smoke.py                 # boot every level in headless Chromium, fail on any JS error
python tools/voice.py                 # record new/changed lines (needs AZURE_OPENAI_API_KEY; never stored here)
python tools/astra_review.py          # gpt-6-astra reviews each game's text against the ReSeed code
```

Full playbook for AI agents: [docs/HOW-IT-WAS-MADE.md](docs/HOW-IT-WAS-MADE.md).

## Publish

Push to `main` of `github.com/khamydoan/reseed_games`, then in the repository's *Settings → Pages* choose
*Source: GitHub Actions*. `.github/workflows/pages.yml` publishes the folder as committed (without `tools/`).

© 2026 Kha My Doan. See [LICENSE](LICENSE). Satellite imagery: modified Copernicus Sentinel data (ESA) and Landsat
(USGS/NASA) via Microsoft Planetary Computer.
