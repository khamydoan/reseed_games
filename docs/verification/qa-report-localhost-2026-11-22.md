# /qa report — ReSeed Quest (local), 2026-11-22

- **Target:** `http://127.0.0.1:8765` (static site served from `Games/` with `python -m http.server`), browser surface only.
- **Driver:** gstack's headless browser (`$B`, session `rqqa`); Aside is macOS-only. Mode: Full, Standard tier, 900 s probe budget (11 probes, ~6 min used).
- **Scope:** hub (first visit, islands, drawer, Field Guide, My Site, settings), `parents.html`, and games key-garden, potion-lab, forest-detective, mission-coder, drone-rush, lab-escape, build-a-bot (satellite-snap skipped: being edited).
- **Framework:** none (classic scripts). Existing tests: `tools/check_static.py`, `tools/smoke.py` (Playwright), CI `.github/workflows/check.yml`.

**Health score: 91 → 99** (Console 70→100, Links 85→100, Visual 92→100, Functional 100, UX 97, Accessibility 100; Performance and Content not tested).

## Issues

| ID | Severity | Category | Issue | Status |
|---|---|---|---|---|
| ISSUE-001 | Medium | Links | `parents.html` linked to `docs/HOW-IT-WAS-MADE.html` before it was generated (404, console error). | **verified** — generated with `tools/md_to_html.py`; regression in `tools/check_static.py` (checks every local `src`/`href` in `index.html` and `parents.html`) went red → green. |
| ISSUE-002 | Medium | Visual | The "Next adventure" banner covered the Base Camp and Check island labels at 1024×640 (and Base Camp at 1366×768). | **verified** — slim one-row banner for screens ≤ 900 px tall (`css/hub.css`); regression in `tools/smoke.py` hub check (banner vs island-label rectangles at 1024×640 and 1366×768) went red → green; browser recheck `overlaps=[]`. |
| ISSUE-003 | Low | UX | Key Garden L5 at 1024×640: the compact on-screen keyboard takes ~220 px, leaving ~300 px of garden for falling words. Playable. | **deferred** (Standard tier fixes Medium+) |

## Checked and passing

- First visit: Let's go → Sprout's 3 lines → explorer name → My Site; header shows name and site, no overlays left, no errors.
- Field Guide: opening a card stacks a second modal; Escape closes only the top one, then the guide.
- Island drawer → game Start → game page loads (Mo's Workshop); its Map button returns to `#island-0` with the drawer open.
- `parents.html`: 27 same-origin links, 20 skill rows, 8 journey rows; all links resolve after the fix.
- 1024×640: Drone Rush (touch controls, HUD), Server Lab Escape (canvas, touch buttons), Forest Detective rule builder (Run button inside the viewport), Mission Coder L3 (RUN at 571–617 px of 640).
- Keyboard: Potion Lab terminal — Tab on an empty command moves focus (no trap); Tab on a matching prefix completes `conda create -n reseed python=3.12`. Key Garden L5 speed choice works with the number key.

## Notes

- Clicking the pulsing "Let's go!"/"Start" buttons times out in automation tools that wait for elements to stop moving; real clicks work (verified with Playwright `force` and DOM click). Not a user bug.
- The long-lived browser served the old `hub.css` until a cache-bypassing reload; GitHub Pages visitors may see cached CSS for a few minutes after an update.

QA found 3 issues, fixed 2 (verified), deferred 1; health score 91 → 99. Evidence: `/tmp/rq/qa/run-20261122T041128Z/` (screenshots, checkpoints `exploration-001…011.json`, `baseline.json`).
