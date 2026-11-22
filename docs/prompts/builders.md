# Builder prompts (what each parallel agent was told)

Every builder prompt started with the same two lines, then listed its games. The shared rules live in
`docs/AGENT_BRIEF.md` (read it first); the per-game paragraphs below are the extra, game-specific instructions.

> Read `Games/docs/AGENT_BRIEF.md` and follow it exactly (it tells you what else to read). Use the conda env `games`
> (`source ~/anaconda3/etc/profile.d/conda.sh && conda activate games`); never pip-install into base Python.
> Finish with the "Done means" checklist in the brief.

The game paragraphs are the same as the specs in `docs/GAME_DESIGN.md` with these additions, which mattered most:

| Builder | Games | Extra instructions that made the difference |
|---|---|---|
| A | g02 Mo's Workshop, g03 Operation Install, g04 Driver Tower, g05 Potion Lab | Use the **real project computer** (Ubuntu 24.04, 96 cores, 866 GB RAM, 4 × A100 80 GB, driver 570.211.01 / CUDA 12.8 from `nvidia-smi`); show the real `environment.yml`; terminal commands short with ghost text and Tab; each command must *do* something visible. |
| B | g06 Satellite Snap, g07 Cloud Sweeper, g08 Cloud City | Real 13 sites from `RQ.data().sites`; never `getImageData` on `file://` images (blocked) — do pixel puzzles on synthetic grids; one rescue job per level, three choices, a visible deadline. |
| C | g09 Packet Post, g12 Model Garage, g24 Git Garden | Real `server.py` ports/endpoints; memory = params × bytes + KV cache; real `git log` messages and the real `tests.yml` / `pages.yml`. |
| D | g10 Tile Detective, g11 Brain Builder, g15 Forest Detective + **`js/forestnet.js`** | Port the real ForestNet to a classic script and **prove parity** against `reseed/tests/fixtures/forestnet_vectors.json` (≤ 1e-3); precompute tile pixels into `tiles.js` with a Pillow script so the AI runs offline from `file://`; the detective rule must reproduce all 13 real verdicts. |
| E | g13 NDVI Goggles, g14 Spell Academy, g17 Roll Factory | Exact `health_class` thresholds; Python through predict → run → repair; kids fill visible seed slots *before* seeing the formula; real Rondônia mission numbers. |
| F | g16 Patch Painter, g18 Seed Library, g22 Mission Coder | Real patch sizes, `MIN_PATCH_HA`, `MISSION_MAX_HA`; SQL-like blocks over the real `BIOMES`; coverage and safe return scored before fewer blocks; `.waypoints` labelled practice file. |
| G | g19 Seed Drop, g20 Drone Academy, g21 Drone Rush | Port `site/js/physics.js` (same equation); real species `v_terminal`; Drone Rush: 5 levels, one new complication each, checkpoints, and a **scripted Playwright input test** proving completion. |
| H | g23 Regrow Rescue, g25 Server Lab Escape | Real biome animals and `not_suitable` reasons; Lab Escape: **code operates the room** (no quiz toll gates), coyote time + jump buffering, and a scripted input test. |

Builders were free to fork helpers for single games (several did). When builder B's agent crashed (API error) after
finishing g07 and starting g06, a fresh agent rebuilt g06 from the surviving `cards.js` with the same paragraph plus:
"A previous builder crashed after writing index.html and cards.js… keep those cards and build game.js."

## Fix-request message (sent to each builder after `tools/astra_review.py`)

> gpt-6-astra reviewed your games' kid-facing text: `Games/docs/verification/astra/<slug>.json`
> (factual_issues, general_cs_errors, hard_for_8yo, safety_or_tone; each with where/problem/fix). Please apply with judgement:
> 1. general_cs_errors / hard_for_8yo / safety_or_tone: apply (adapt wording; ≤ 2 sentences per bubble; label
>    simplifications "(game version)"). <2–6 key points copied from the review>
> 2. factual_issues saying "E does not establish…": the reviewer only saw short excerpts. Verify against the ReSeed repo;
>    keep true claims with exact file/function citations; fix or label anything you can't verify.
> 3. Keep speech as string literals. Re-run smoke tests and your play-through scripts (0 failures). Reply with a short
>    list of changes and anything rejected (with reason).

Builders rejected about 1 in 10 suggestions, always with a citation (e.g. "port 8000 is ReSeed's real default:
`__main__.py`:36"), and found real errors the reviewer missed (a wrong `ndvi()` file citation, a false
"release points are shifted upwind" claim, a "smaller fleet is cheaper" claim that `logistics.plan()` contradicts,
and the 54,000 vs ~57,000 training-picture count).
