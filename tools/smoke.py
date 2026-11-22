"""Headless smoke test for ReSeed Quest pages (conda env `games`: python + playwright chromium).

    python tools/smoke.py                         # hub + every game: level select + every level boots, no JS errors
    python tools/smoke.py key-garden              # one game (all levels)
    python tools/smoke.py key-garden --level 2    # one level
    python tools/smoke.py key-garden --shots /tmp/shots --keys "asdf"   # screenshot + type some keys

For each level: open games/<slug>/index.html#level=N over file://, click through the speech bubbles,
wait, screenshot (optional), and fail on any uncaught page error or console error.
Exit code 1 if anything failed. Pages must work from file:// (no fetch of local files).
"""
import argparse
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]


def catalog_slugs():
    src = (ROOT / "js/catalog.js").read_text()
    import re
    return re.findall(r'slug: "([a-z0-9-]+)"', src)


def level_count(page):
    return page.evaluate("RQ.shell ? RQ.shell.def.levels.length : 0")


def advance_dialogs(page, max_steps=25):
    for _ in range(max_steps):
        if page.locator(".rq-talk").count() == 0:
            return
        if page.locator(".rq-talk .choices .btn").count():
            page.locator(".rq-talk .choices .btn").first.click()
        else:
            page.keyboard.press("Enter")   # finish typewriter
            page.wait_for_timeout(60)
            page.keyboard.press("Enter")   # close
        page.wait_for_timeout(120)


def run(args):
    slugs = [args.slug] if args.slug else ["__hub__"] + catalog_slugs()
    shots = pathlib.Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        for slug in slugs:
            if slug == "__hub__":
                path = ROOT / "index.html"
                levels = [None]
            else:
                path = ROOT / "games" / slug / "index.html"
                if not path.exists():
                    failures.append((slug, "-", "missing index.html"))
                    continue
                levels = None
            ctx = browser.new_context(viewport={"width": args.width, "height": args.height})
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
            page.goto(path.as_uri())
            page.wait_for_timeout(400)
            if levels is None:
                n = level_count(page)
                if n == 0:
                    failures.append((slug, "-", "RQ.shell not created (RQ.game not called?)"))
                levels = [args.level] if args.level else list(range(1, n + 1))
            for lv in levels:
                errors.clear()
                if lv is not None:
                    page.goto(path.as_uri() + f"#level={lv}")
                    page.reload()
                    page.wait_for_timeout(300)
                    advance_dialogs(page)
                    page.wait_for_timeout(args.wait)
                    advance_dialogs(page)
                    if args.keys:
                        page.keyboard.type(args.keys, delay=60)
                        page.wait_for_timeout(300)
                else:
                    page.wait_for_timeout(args.wait)
                    # Regression: ISSUE-002 — next-adventure banner covered island labels on short screens
                    # Found by /qa on 2026-11-22
                    # Report: docs/verification/qa-report-localhost-2026-11-22.md
                    for vw, vh in ((1024, 640), (1366, 768)):
                        page.set_viewport_size({"width": vw, "height": vh})
                        page.wait_for_timeout(250)
                        hits = page.evaluate("""() => {
                          const nb = document.querySelector('.hub-next').getBoundingClientRect();
                          return [...document.querySelectorAll('.isl rect[width="224"]')].map((r, i) => [i, r.getBoundingClientRect()])
                            .filter(([i, b]) => b.left < nb.right && b.right > nb.left && b.top < nb.bottom && b.bottom > nb.top).map(x => x[0]); }""")
                        if hits:
                            errors.append(f"layout: next-adventure banner covers island label(s) {hits} at {vw}x{vh}")
                    page.set_viewport_size({"width": args.width, "height": args.height})
                name = f"{slug}-L{lv}" if lv else slug
                if shots:
                    page.screenshot(path=str(shots / f"{name}.png"))
                bad = [e for e in errors if "favicon" not in e and "voice/" not in e]
                status = "FAIL" if bad else "ok"
                print(f"{status:4} {name}" + ("" if not bad else "\n      " + "\n      ".join(bad[:5])))
                if bad:
                    failures.append((slug, lv, bad[:5]))
            ctx.close()
        browser.close()
    print(json.dumps({"checked": len(slugs), "failures": len(failures)}))
    return 1 if failures else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--level", type=int)
    ap.add_argument("--shots")
    ap.add_argument("--keys")
    ap.add_argument("--wait", type=int, default=1200)
    ap.add_argument("--width", type=int, default=1366)
    ap.add_argument("--height", type=int, default=800)
    sys.exit(run(ap.parse_args()))
