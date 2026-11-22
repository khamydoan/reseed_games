# How ReSeed Quest was made — a playbook an AI coding agent can follow

This explains, step by step, how the 25 games in this folder were designed, built, checked and published, so an AI
coding agent (Claude Code, Codex or similar) can rebuild, extend or port them on another computer. Every command below
was actually run during the original build on 22 November 2026 (about 4½ hours of wall-clock time).

**Inputs**
- The ReSeed repository (`../reseed`, commit `e2ee761`): the Python pipeline, the website, and `site/data` (real results for 13 places).
- The kid explainer `../ReSeed_Pitch_Pack/ReSeed-explained.html`: its 7 stages and 29-chunk journey became the islands.
- The Understand-Anything knowledge graph of the code (`../reseed/.ua/knowledge-graph.json` and `domain-graph.json`).
- The parent's list of skills to teach, without the kids noticing.

**Output:** a static website (`index.html` + `games/*`) that runs from GitHub Pages and from `file://`, made of:
- 25 games and 115 levels
- 145 Field Cards
- 596 recorded voice lines

It is published at `khamydoan.github.io/reseed_games`.

**Who did what**

| Role | Model / tool | Work |
|---|---|---|
| Lead agent | Claude Code (Opus) | Design, shared engine, hub, reference game, tools, integration, QA |
| 8 builder sub-agents (+1 replacement) | Claude Code (Opus) | 2–4 games each, in parallel |
| Reviewer | gpt-6-astra, via the Codex CLI and the Azure Responses API | The design, the engine code, and the kid-facing text of every game |
| Voices | gpt-audio-1.5 | Recorded every character line |
| QA | gstack `/qa` | Browser QA pass |
| Code-to-facts map | Understand-Anything | Mapped the code to the game content |

The exact prompts are in `docs/prompts/`.

---

## 0. Prerequisites on a new computer

| Need | Why | How |
|---|---|---|
| conda | an isolated env; never install into base Python | `conda create -n games -c conda-forge python=3.12 nodejs=22 pillow numpy imageio-ffmpeg` |
| Playwright + Chromium | smoke tests, screenshots, play-through scripts | `conda activate games && pip install playwright && python -m playwright install chromium-headless-shell` |
| ReSeed repo next to `Games/` | real data and facts | `git clone https://github.com/khamydoan/reseed ../reseed` (`site/data` is committed) |
| Azure OpenAI key (optional) | voices and reviews only | `export AZURE_OPENAI_API_KEY=…` or keep it in `../reseed/.env`. **Never inside `Games/`** (it is published). Base URL in `tools/az.py`. |
| Codex CLI (optional) | design and code reviews by gpt-6-astra | `~/.codex/config.toml`: `model = "gpt-6-astra"`, Azure provider, `wire_api = "responses"`. On a VM where the sandbox (bubblewrap) fails, pass everything on stdin: `codex exec --skip-git-repo-check - < prompt.txt`. |
| gstack (optional) | `/qa`, `/browse` | its headless browser needs `GSTACK_CHROMIUM_NO_SANDBOX=1` on Linux VMs; run it from a temp directory (it writes `.gstack/`) |

Players need nothing installed, only a modern browser.

## 1. Understand the codebase first

1. The knowledge graph already existed, built with `/understand-anything:understand` (252 nodes, 733 edges, 9 layers)
   and `/understand-anything:understand-domain` (6 domains, 23 flows, 153 steps).
2. Check that the graph is still fresh. Compare `project.gitCommitHash` with `git rev-parse HEAD`, then run `git diff --name-only <graph> HEAD -- .`.
   Here it was one commit behind, but that commit only renumbered steps in the docs, so the graph was used as is.
3. `/understand-anything:understand-chat` was asked for each pipeline step: the files, the key functions and constants, and the
   computer-science concepts they use. The answer, for example `reseed/detect.py: Detection, detect, summarise`, became the
   game ↔ code map in `docs/GAME_DESIGN.md`.
4. Then read the real files for the numbers, not the graph:
   - `config.py`: thresholds, health classes, sites.
   - `species.py`: seeds and animals.
   - `logistics.py`: the 159 mL roll and the Drone dataclass.
   - `physics.py`: the drag equation.
   - `detect.py`: the decision rule.
   - `mission.py` and `demo_flight.py`.
   - `classify/model.py`: 214,212 parameters.
   - `classify/train.py` and its training log: ~57,000 training pictures.
5. Check the real machine too. `nvidia-smi` showed 4 × A100 80 GB with driver 570.211.01 and CUDA 12.8, and `lsb_release` showed Ubuntu 24.04.

## 2. Design the world (`docs/GAME_DESIGN.md`)

1. **Follow the explainer's journey.** The 7 islands are the 7 stages of `ReSeed-explained.html`: See, Check, Score, Decide, Plan, Fly, Share.
   **Base Camp** comes first, because you need a computer, an operating system, drivers and a Python environment before you can run ReSeed.
2. **Map every requested skill to a game whose mechanic *is* that skill.** The parent's list became the skill map in `parents.html`.
3. **Stealth-learning rules.**
   - Missions, not lessons. Real terms are things you use.
   - The practice is the game loop itself.
   - A collectible **Field Card** replaces the lesson summary.
   - At most 2 sentences per speech bubble.
   - Finishing always earns ≥ 1 star.
   - Levels of 1–3 minutes, and a stretch break after about 20 minutes.
4. **Original characters only:** Sprout, Koa, Tuki, Professor Hoot, Pix, Mo and the Glitch Bugs.
   - The parent suggested famous cartoon characters, but those are trademarked and the site is public.
   - Likewise, Drone Rush and Server Lab Escape borrow only the *genre* of Drive Mad and Slime Laboratory: no names, art or levels.
5. **Technical constraints.**
   - No build step, and classic scripts only: ES modules fail on `file://`.
   - No `fetch()` of local files. Data ships as `window.RQ_DATA = …` in a JS file.
   - No CDN.
   - Art is drawn with canvas, SVG and CSS; sounds are synthesized with WebAudio.
   - Progress is saved in `localStorage` only.
6. **Have gpt-6-astra review the design before building** (about 6 minutes; prompt in `docs/prompts/design-review.txt`):
   `codex exec --skip-git-repo-check -c model_reasoning_effort="high" - < prompt.txt`.
   The changes we accepted went into `docs/AGENT_BRIEF.md` under "Accepted review changes". The most valuable:
   - Stationary typing comes before falling seeds.
   - nvidia-smi's "CUDA Version" is the newest CUDA the driver supports, not the toolkit that is installed.
   - pip's PyTorch brings CUDA runtime packages.
   - GPU memory = weights + KV cache.
   - Azure has storage accounts, containers and blobs; S3 and Google Cloud Storage have buckets.
   - A UDP video frame spans several packets.
   - Code should operate the room instead of acting as quiz toll gates.
   - A "My Site" thread carries one real forest through the games.

## 3. Build the shared foundation (lead agent, before any builder starts)

| File | What |
|---|---|
| `css/quest.css` | Design system: Fredoka + JetBrains Mono (OFL, in `fonts/`), chunky ink outlines, chapter colour `--c` |
| `js/rq.js` | Engine: game shell (`RQ.game`), level context `L` (canvas, loop, timers, HUD, win/fail), save, Field Cards, synth SFX + music, voice, speech bubbles, modals, on-screen QWERTY with finger colours, fake terminal, Python highlighter / Parsons / blanks, stretch breaks |
| `js/catalog.js`, `js/chars.js` | Islands and games (single source of truth); 7 original SVG characters × 4 moods |
| `tools/build_data.py` | Real ReSeed data: copies `site/data`, reads the thresholds from `config.py` with `ast` (no geo stack needed), embeds the real ForestNet weights as base64 JS |
| `games/key-garden/` | **Reference game**, written first to set the quality bar and the code pattern |
| `tools/smoke.py`, `tools/check_static.py` | Headless boot of every level (`#level=N`); static rules (classic scripts, no fetch/CDN, card ids, JS syntax, local links, no secrets) |
| `docs/ENGINE.md`, `docs/AGENT_BRIEF.md` | The builders' only briefing: API, hard rules, kid-writing rules, accepted review changes, "done means" |

Key engine choices worth copying:
- `L.canvas({w, h, fill, fillH})` gives each game a logical coordinate system that fits any screen.
- Everything a level registers is torn down when the level ends, and `L.alive` guards every `await`.
- `#level=N` deep links make headless testing trivial.
- Voice lines are looked up by a **hash of the exact text**: FNV-1a over UTF-16, the same code in `rq.js` and `tools/voice.py`. If a line changes, it falls back to the browser voice until it is re-recorded.

## 4. Build the games in parallel (8 builder agents)

The per-builder prompts and the extra instructions that mattered are in `docs/prompts/builders.md`.

**Rules that made parallel work safe**
- Each builder writes only inside its own `games/<slug>/`. The one exception is builder D, which owns `js/forestnet.js`.
- Builders *request* shared-engine changes in their final report, and the lead applies them. Requests that arrived this way:
  - a custom terminal prompt
  - canvas refit when the parent resizes
  - clamping the first frame's time step to ≥ 0
  - `RQ.audio.hum`
  - `fillH`
  - a tiny keyboard
- "Done" means:
  - the static check passes and the smoke test is green at 1024×640 and 1366×800;
  - the builder looked at its own screenshots;
  - a scripted Playwright play-through proves every level can be won.

**When an agent dies.** One builder hit an API error mid-way, after its helper had already finished g07. Its other helper
was still building g08 and finished on its own. A fresh agent rebuilt g06 from the `cards.js` that survived. Check what is
on disk before re-spawning, and don't touch folders that another agent is still writing.

**Highlights the builders proved with tests**
- The JavaScript ForestNet matches PyTorch to within 2.9e-6. It reproduces the pipeline's forest/not-forest call for all
  1,300 real tiles, and the expert level counts exactly 214,212 parameters.
- Forest Detective's if/elif rule reproduces all 13 real verdicts.
- Seed Drop's physics port matches the real release footprints, for example Rondônia drift 7.7 m vs 7.9 m and fall time 2.91 s vs 2.90 s.
- Autopilot scripts complete every Drone Rush and Lab Escape level using only key presses.

## 5. Review loops (three of them, all with gpt-6-astra)

1. **Design review** (section 2).
2. **Engine code review.** `docs/prompts/engine-review.txt` plus the source, sent through `codex exec` on stdin. It found 15
   real bugs, and all were fixed:
   - Cancelled speech kept its key listener alive.
   - Stale "next level" handlers navigated after a restart.
   - An old tab could overwrite newer progress. Fixed with an in-place merge that never loses stars or cards, plus a `storage` event listener.
   - Timeouts fired while the game was paused.
   - Escape closed stacked modals together, and there was no focus trap.
   - Music started despite the saved setting.
   - Voice promises never settled.
   - Tab completion trapped focus.
   - The terminal's retry counter reset on every try.
   - An invalid `#island-9` link crashed the hub.
3. **Content review of every game.** `python tools/astra_review.py` sends gpt-6-astra the catalogue entry, the Field Cards,
   the speech lines, the visible strings and excerpts of the real code. Prompt: `docs/prompts/content-review.txt`.
   - The answers are JSON (`docs/verification/astra/*.json`): factual issues *with quoted evidence*, general CS errors,
     hard words for 8-year-olds, and safety.
   - Each review went **back to the builder who wrote the game**, which had the context to verify claims against the repo
     (template in `docs/prompts/builders.md`).
   - Builders rejected about 1 in 10 suggestions, always with a citation, and caught errors the reviewer missed.
   - Example fixes: 81920 MiB = 80 GiB; "Deallocate", not "Stop"; "only use sudo with commands you trust"; uv finds
     `.venv` without activating; what "native plant" and primary/foreign key really mean; Lab Escape snippets now all `compile()`.

## 6. Voices (gpt-audio-1.5)

```bash
python tools/voice.py --list     # every spoken line found in games/*/game.js and js/hub.js
python tools/voice.py            # record new/changed lines in parallel (cached by hash); prune stale clips
```

**Voices:** Sprout `coral`, Koa `ballad`, Tuki `verse`, Hoot `cedar`, Pix `sage`, Mo `ash`, each with a short style prompt.
Clips are re-encoded to mono 24 kHz at 40 kb/s.

**Lesson learned.** On the first pass, 32 of 557 lines came back *answered* instead of read, because questions and
instructions ("Which command?") look like requests to the model. The fix:
- Frame the line as `<line>…</line>` from a children's game script, "spoken by a character TO a child, NOT addressed to you".
- Compare the transcript with the text and retry up to 4 times.
- Reject a clip below 0.6 similarity (the browser voice reads that line instead).

After that, 596/596 lines matched and none were rejected.

**Not used:** gpt-realtime-2.1. Live voice chat needs a server that holds the API key, and these games are a static site.

## 7. Verify (run before every publish)

```bash
conda activate games
python tools/check_static.py               # structure, classic scripts only, no fetch/CDN, cards, JS syntax, local links, no secrets
python tools/smoke.py --shots /tmp/shots   # hub layout + every level of every game boots with zero JS errors
```

**Look at the screenshots.** We used a contact-sheet montage (PIL) of `/tmp/shots/*.png` for each batch.

**gstack `/qa` pass** (report: `docs/verification/qa-report-localhost-2026-11-22.md`): 11 probes on the hub, the grown-ups page and
7 games at 1024×640 and 1366×800. Health score 91 → 99.

| Issue | Severity | Fix | Regression test |
|---|---|---|---|
| A 404 link to this playbook's HTML | Medium | Generated the HTML | Local link check in `check_static.py` |
| The banner covered island labels on laptop screens | Medium | A slim one-row banner | Overlap check in `smoke.py` |
| Key Garden's keyboard was large at 1024×640 | Low | Tiny keyboard on short screens | — |

## 8. Pitfalls we hit (save yourself the time)

- **Browser limits on `file://`**
  - `getImageData` on images is blocked, so precompute pixels with Pillow (`games/tile-detective/make_tiles.py`).
  - ES modules don't load; use classic scripts.
- **Canvas resizing.** Setting `canvas.width` wipes the pixels, so refit only when the size really changes. A ResizeObserver
  fires once right away, so skip it when the size hasn't changed.
- **The first animation frame** can have a timestamp earlier than the loop's start, which makes `dt` negative. Clamp it to ≥ 0.
- **Pulsing buttons in tests.** Playwright and `$B` clicks time out on pulsing (CSS-animated) buttons because they wait for the element to stop moving.
  Use `force` or a DOM click in tests. Real users are fine.
- **gstack `$B` sessions.** Each calling process gets its own tab; set `BROWSE_SESSION=<name>` to keep one tab.
- **Codex on a VM.** The sandbox (bubblewrap) fails, so send prompts on stdin. Prompts larger than 128 KB can't be passed as an argument.
- **Facts from excerpts.** Reviewers working from excerpts flag true facts as "unsupported"; always route reviews to an agent that can read the repo.

## 9. Publish

```bash
cd Games && git init -b main && git add -A && git commit -m "ReSeed Quest: 25 games"
gh repo create khamydoan/reseed_games --public --source . --push     # needs the owner's GitHub login
```

1. In the repository, go to *Settings → Pages → Source: GitHub Actions*.
2. `.github/workflows/pages.yml` uploads the folder as committed, minus `tools/`.
3. `check.yml` runs the static check and the smoke test on every push.
4. To show the games on airesearchcenter.com (Google Sites): add a page, choose *Insert → Embed*, and paste
   `<iframe src="https://khamydoan.github.io/reseed_games/" style="width:100%;height:900px;border:0" allowfullscreen></iframe>`.

## 10. Extending

- **New game**
  1. Add an entry to `js/catalog.js`.
  2. Copy `games/key-garden/` as a template and follow `docs/AGENT_BRIEF.md`.
  3. Add `<script src="games/<slug>/cards.js">` to `index.html`.
  4. Run `astra_review.py <slug>` and apply the review.
  5. Run `voice.py` and the checks.
- **New ReSeed results:** rebuild `../reseed/site/data` (`python scripts/build_site_data.py` in the `reseed` env), then
  run `python tools/build_data.py` here, then the checks.
- **New language:** all kid-facing text is in string literals in `game.js`, `cards.js` and `catalog.js`. The voice hash makes re-recording automatic.
