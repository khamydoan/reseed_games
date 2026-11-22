"""Scripted Playwright INPUT test for Satellite Snap (g06): completes levels 1-5 with real key presses and clicks only.

    conda activate games && cd Games
    python games/satellite-snap/test_play.py                       # all levels, 1366x800, shots in /tmp/ss-play
    python games/satellite-snap/test_play.py /tmp/out --levels 1,2 --size 1024x640 [--trace]

Uses the "#level=N&debug" hook (window.__ss) only to READ game state (where the target is, when the frame is green);
all input goes through the keyboard / mouse like a player. Fails on any page error or console error.
"""
import argparse, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / "games/satellite-snap/index.html").as_uri()


def wrap(d):
    return (d + 180) % 360 - 180


class Run:
    def __init__(self, page, out):
        self.page, self.out, self.errors, self.shots = page, out, [], 0
        page.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)))
        page.on("console", lambda m: self.errors.append("console: " + m.text) if m.type == "error" and "voice/" not in m.text and "favicon" not in m.text else None)

    def shot(self, name):
        self.shots += 1
        self.page.screenshot(path=str(self.out / f"{self.shots:02d}-{name}.png"))

    def ss(self):
        return self.page.evaluate("window.__ss || null")

    def talk_open(self):
        return self.page.locator(".rq-talk").count() > 0

    def answer(self, pick=None):
        """Close the current speech bubble; for multiple choice, pick(text) -> index."""
        p = self.page
        btns = p.locator(".rq-talk .choices .btn")
        if btns.count():
            p.wait_for_timeout(1600)   # let the typewriter finish before reading the question
            text = p.locator(".rq-talk .text").inner_text()
            idx = pick(text) if pick else 0
            btns.nth(idx).click()
        else:
            p.keyboard.press("Enter"); p.wait_for_timeout(80)   # finishes the typewriter, or closes the bubble
            if self.talk_open():
                p.locator(".rq-talk .bubble").click()
        p.wait_for_timeout(150)

    def won(self):
        return self.page.locator(".rq-modal .rq-stars").count() > 0

    def start(self, n):
        p = self.page
        p.goto(URL + f"#level={n}&debug"); p.reload(); p.wait_for_timeout(400)
        for _ in range(10):
            if not self.talk_open(): break
            self.answer()

    def finish(self, n):
        p = self.page
        p.wait_for_timeout(1200)
        stars = p.evaluate("document.querySelectorAll('.rq-stars span.on').length")
        title = p.locator(".rq-modal h2").inner_text()
        self.shot(f"L{n}-win")
        print(f"L{n}: WIN  {title!r}  stars={stars}  stats={p.locator('.rq-modal .rq-stats').inner_text()!r}")

    def canvas_xy(self, s, x, y):
        box = self.page.locator(".ss-view canvas").bounding_box()
        k = box["width"] / s["W"]
        return box["x"] + x * k, box["y"] + y * k

    # ------------------------------------------------------------------ levels
    def l1(self):
        p = self.page; self.start(1); shot4 = False
        for _ in range(4000):
            if self.won(): break
            if self.talk_open():
                self.answer(lambda t: 0); continue
            s = self.ss()
            if not s or s.get("level") != 1 or s["finished"] or s["locked"] or not s["task"]:
                if s and s.get("locked") and s.get("ti") == 3 and not shot4:
                    p.wait_for_timeout(500); self.shot("L1-my-site-found"); shot4 = True
                p.wait_for_timeout(80); continue
            t, key, diff = s["task"], None, 0
            if t["lat"] is not None and abs(s["lat"] - t["lat"]) > 1.5:
                diff = t["lat"] - s["lat"]; key = "ArrowUp" if diff > 0 else "ArrowDown"
            elif t["lon"] is not None and abs(wrap(t["lon"] - s["lon"])) > 1.5:
                diff = wrap(t["lon"] - s["lon"]); key = "ArrowRight" if diff > 0 else "ArrowLeft"
            if key and abs(diff) > 8:
                p.keyboard.down(key); p.wait_for_timeout(int(min(900, 250 + abs(diff) * 8))); p.keyboard.up(key)
            elif key:
                p.keyboard.press(key)
            p.wait_for_timeout(40)
        self.finish(1)

    def snap_loop(self, n, max_iter=6000, cloudy=False):
        p = self.page; did_early = did_shot = did_cloudy = False; skips = 0; s_prev_finished = False
        for it in range(max_iter):
            if it % 120 == 0 and getattr(self, "trace", False):
                print("  trace", it, self.ss(), "talk", self.talk_open(), "modal", self.page.evaluate("[...document.querySelectorAll('.rq-modal')].map(m => m.innerText.slice(0, 80))"), "focus", self.page.evaluate("document.activeElement && document.activeElement.outerHTML.slice(0, 80)"), flush=True)
            if self.won(): break
            if self.talk_open():
                if cloudy and s_prev_finished:
                    p.wait_for_timeout(1500); self.shot("L3-real-log"); s_prev_finished = False
                self.answer(); continue
            s = self.ss()
            if cloudy and s and s.get("level") == 3 and not s["warping"] and s["cover"] >= 30 and s["state"] == "early" and -0.3 < s["du"] and not getattr(self, "_c", 0):
                self._c = 1; self.shot("L3-cloudy-approach")
            if not s or s.get("level") != n:
                p.wait_for_timeout(60); continue
            if cloudy:
                if s["finished"] and not getattr(self, "_logged", 0):
                    self._logged = 1; s_prev_finished = True
                if s["finished"] or s["warping"] or s["snappedPass"]:
                    p.wait_for_timeout(60); continue
                if s["cover"] >= 30:
                    if not did_cloudy and s["state"] == "in":   # snap one cloudy pass on purpose: the photo must be thrown away
                        p.keyboard.press("Space"); did_cloudy = True; p.wait_for_timeout(700); self.shot("L3-cloudy-snap")
                    elif did_cloudy and skips < 3 and s["state"] == "early" and s["du"] < -0.8:
                        p.keyboard.press("n"); skips += 1
                    p.wait_for_timeout(60); continue
            else:
                if s["snapped"] or s["frozen"]:
                    p.wait_for_timeout(60); continue
                if not did_early and s["state"] == "early" and s["du"] > -0.5:
                    p.keyboard.press("Space"); did_early = True; p.wait_for_timeout(250); self.shot("L2-too-early"); continue
            if s["state"] == "in" and abs(s["du"]) < 0.06:
                p.keyboard.press("Space")
                if not did_shot:
                    p.wait_for_timeout(150); self.shot(f"L{n}-flash"); p.wait_for_timeout(1100); self.shot(f"L{n}-print"); did_shot = True
            p.wait_for_timeout(25)
        self.finish(n)

    def l2(self):
        self.start(2); self.snap_loop(2)

    def l3(self):
        self.start(3); self.snap_loop(3, cloudy=True)

    def l4(self):
        p = self.page; self.start(4)
        answers = {"Can you still see my tree": 1, "small clearing": 0, "blurry": 0}
        def pick(text):
            for k, v in answers.items():
                if k in text: return v
            return 0
        tapped_tree = tapped_clear = dragged = False
        for _ in range(3000):
            if self.won(): break
            if self.talk_open():
                self.answer(pick); continue
            s = self.ss()
            if not s or s.get("level") != 4:
                p.wait_for_timeout(60); continue
            lo = s["layout"]
            if s["wantTap"] and not tapped_tree:
                x, y = lo["x"][0] + s["tuki"]["x"] / 300 * lo["PS"], lo["y"] + s["tuki"]["y"] / 300 * lo["PS"]
                p.mouse.click(*self.canvas_xy(s, x, y)); tapped_tree = True; p.wait_for_timeout(1600); self.shot("L4-sentinel-reveal")
            elif s["wantTap"] and tapped_tree and not tapped_clear:
                x, y = lo["x"][1] + 92 / 300 * lo["PS"], lo["y"] + 208 / 300 * lo["PS"]
                p.mouse.click(*self.canvas_xy(s, x, y)); tapped_clear = True; p.wait_for_timeout(1000); self.shot("L4-clearing-pixels")
            elif s["finale"] and not dragged:
                p.wait_for_timeout(600)
                a = self.canvas_xy(s, lo["x"][0] + lo["PS"] * .5, lo["y"] + lo["PS"] * .5)
                b = self.canvas_xy(s, lo["x"][0] + lo["PS"] * .3, lo["y"] + lo["PS"] * .62)
                p.mouse.move(*a); p.mouse.down(); p.mouse.move(*b, steps=8); p.mouse.up(); dragged = True
                p.wait_for_timeout(400); self.shot("L4-real-finale")
                p.get_by_role("button", name="Done").click()
            p.wait_for_timeout(60)
        self.finish(4)

    def l5(self):
        p = self.page; self.start(5)
        order = ["1", "2", "1", "2"]; sorted_n = 0; tapped = set(); shot_sort = False
        for _ in range(4000):
            if self.won(): break
            if self.talk_open():
                if not shot_sort and "Two circles" in p.locator(".rq-talk .text").inner_text():
                    self.shot("L5-two-circles"); shot_sort = True
                self.answer(); continue
            s = self.ss()
            if not s or s.get("level") != 5:
                p.wait_for_timeout(60); continue
            if s["phase"] == "sort" and s["si"] < 4 and sorted_n == s["si"]:
                if sorted_n == 1: p.keyboard.press("1"); p.wait_for_timeout(300)   # one wrong answer on purpose (GPS is not a camera)
                p.keyboard.press(order[s["si"]]); sorted_n += 1
                if sorted_n == 3: p.wait_for_timeout(300); self.shot("L5-sorting")
                p.wait_for_timeout(750); continue
            if s["phase"] == "ping" and not s["pinging"] and s["ri"] == 0 and s["rings"] < 3:
                p.keyboard.press("l"); p.wait_for_timeout(1100); continue
            if s["phase"] == "tap" and s["ri"] not in tapped:
                g, d = s["geom"], s["drone"]
                jitter = 4 if s["ri"] < 2 else 9
                x, y = g["x0"] + (d[0] + jitter) * g["k"], g["y0"] + d[1] * g["k"]
                p.mouse.click(*self.canvas_xy(s, x, y)); tapped.add(s["ri"]); p.wait_for_timeout(900); self.shot(f"L5-round{s['ri'] + 1}")
            p.wait_for_timeout(60)
        self.finish(5)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out", nargs="?", default="/tmp/ss-play")
    ap.add_argument("--levels", default="1,2,3,4,5")
    ap.add_argument("--size", default="1366x800")
    ap.add_argument("--trace", action="store_true")
    a = ap.parse_args()
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    w, h = map(int, a.size.split("x"))
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        ctx = br.new_context(viewport={"width": w, "height": h})
        ctx.add_init_script("try { localStorage.clear(); } catch (e) {}")
        page = ctx.new_page(); r = Run(page, out); r.trace = "--trace" in sys.argv
        for n in [int(x) for x in a.levels.split(",")]:
            getattr(r, f"l{n}")()
        br.close()
    bad = [e for e in r.errors]
    print("errors:", len(bad)); [print("  ", e) for e in bad[:10]]
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
