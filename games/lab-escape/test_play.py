"""Scripted Playwright INPUT test for Server Lab Escape: plays a level with real key presses and clicks only.
It reads (never writes) window.__labEscapeDebug.state() to decide when to press keys. Exit code 0 = level won, no JS errors.

    conda activate games && cd Games
    python games/lab-escape/test_play.py 1                 # level 1 at 1366x800
    python games/lab-escape/test_play.py 3 1024 640 wrong  # level 3, small screen, try a wrong value first at each terminal
Screenshots go to /tmp/shots-le-bot/."""
import sys, time, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
LEVEL = int(sys.argv[1]) if len(sys.argv) > 1 else 1; W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1366, 800)
WRONG = len(sys.argv) > 4 and sys.argv[4] == "wrong"     # try a wrong value first at every terminal
shots = pathlib.Path("/tmp/shots-le-bot"); shots.mkdir(exist_ok=True)
T = 40
class Won(Exception): pass
class Bot:
    def __init__(s, page): s.p = page; s.held = set(); s.errors = []; s.shot = 0
    def st(s): return s.p.evaluate("__labEscapeDebug.state()")
    def won(s): return s.p.locator(".rq-modal .rq-stars").count() > 0
    def hold(s, k):
        if k not in s.held: s.p.keyboard.down(k); s.held.add(k)
    def rel(s, k=None):
        for key in ([k] if k else list(s.held)):
            if key in s.held: s.p.keyboard.up(key); s.held.discard(key)
    def snap(s, name): s.p.screenshot(path=str(shots / f"L{LEVEL}-{W}-{s.shot:02d}-{name}.png")); s.shot += 1
    def dialogs(s):
        if s.p.locator(".rq-talk").count() == 0: return False
        held = set(s.held); s.rel()
        for _ in range(12):
            if s.p.locator(".rq-talk").count() == 0: break
            s.p.keyboard.press("Enter"); s.p.wait_for_timeout(60); s.p.keyboard.press("Enter"); s.p.wait_for_timeout(150)
        for k in held: s.hold(k)
        return True
    def jump(s, ms=250): s.p.keyboard.down("Space"); s.p.wait_for_timeout(ms); s.p.keyboard.up("Space")
    def tick(s):
        if s.won(): raise Won()
        s.dialogs()
        st = s.st()
        while st["dead"]: s.p.wait_for_timeout(80); st = s.st()
        return st
    def go(s, x, auto=True, timeout=25, stop_on_term=True):
        """Walk to pixel x (player left edge). Auto-hop when blocked or a walking bug is ahead."""
        t0 = time.time(); stuck = time.time(); lastx = None
        while time.time() - t0 < timeout:
            st = s.tick()
            if st["termOpen"] and stop_on_term: s.rel(); return "term"
            if st["mode"] == "end": s.rel(); return "end"
            d = 1 if st["x"] < x else -1
            if abs(st["x"] - x) < 6 or (d == 1 and st["x"] >= x and lastx is not None) : s.rel("ArrowRight"); s.rel("ArrowLeft"); return "ok"
            s.rel("ArrowLeft" if d == 1 else "ArrowRight"); s.hold("ArrowRight" if d == 1 else "ArrowLeft")
            if (d == 1 and st["x"] >= x) or (d == -1 and st["x"] <= x): s.rel(); return "ok"
            if auto:
                ahead = any(b["fly"] is False and 0 < (b["x"] - (st["x"] + 14)) * d < 105 and abs(b["y"] - (st["y"] + 30)) < 30 for b in st["bugs"])
                if st["wall"] == d and st["vy"] > -60: s.jump(160)
                elif st["ground"] and (ahead or (abs(st["vx"]) < 40 and time.time() - stuck > .15)): s.jump(250)
            if lastx is None or abs(st["x"] - lastx) > 2: stuck = time.time(); lastx = st["x"]
            s.p.wait_for_timeout(25)
        raise RuntimeError(f"go({x}) timed out at {s.st()['x']:.0f},{s.st()['y']:.0f}")
    def ground(s, timeout=5):
        t0 = time.time()
        while time.time() - t0 < timeout:
            st = s.tick()
            if st["ground"]: return st
            s.p.wait_for_timeout(20)
        raise RuntimeError("never landed")
    def leap(s, edge_x, land=None, ms=260, wait=None):
        """Run right to edge_x (optionally wait for a condition), jump holding right; let go of → at x >= land."""
        s.go(edge_x - (34 if wait else 0), auto=False)
        if wait:
            t0 = time.time()
            while not wait(s.tick()) and time.time() - t0 < 12: s.p.wait_for_timeout(15)
        s.hold("ArrowRight"); s.p.keyboard.down("Space"); t0 = time.time(); up = False
        while time.time() - t0 < 4:
            st = s.tick()
            if not up and time.time() - t0 > ms / 1000: s.p.keyboard.up("Space"); up = True
            if land is not None and st["x"] >= land: s.rel("ArrowRight")
            if st["ground"] and time.time() - t0 > .2: break
            s.p.wait_for_timeout(15)
        if not up: s.p.keyboard.up("Space")
        s.rel("ArrowRight"); return s.st()
    def until(s, cond, timeout=20, hold=None):
        t0 = time.time()
        while time.time() - t0 < timeout:
            st = s.tick()
            if cond(st): return st
            if hold: s.hold(hold)
            s.p.wait_for_timeout(25)
        raise RuntimeError("until() timed out")
    def rescue(s, x):
        for _ in range(8):
            if s.tick()["rescued"]: return
            s.go(x - 70); s.go(x + 6, auto=False)
            s.p.wait_for_timeout(300)
        raise RuntimeError("could not rescue")
    def term(s, value, wrong=None):
        s.rel(); s.until(lambda st: st["termOpen"], 8)
        s.p.wait_for_timeout(300); s.snap("term")
        for v in ([wrong] if (WRONG and wrong is not None) else []) + [value]:
            s.p.evaluate("v => [...document.querySelectorAll('.le-term .le-opt')].find(b => b.textContent.trim().split(/\\s+/).pop() === v).click()", str(v))
            s.p.wait_for_timeout(150)
            s.p.locator(".le-term .btn.go").click()
            for _ in range(120):
                s.p.wait_for_timeout(100)
                if not s.p.locator(".le-term .btn.go[disabled]").count(): break
            s.p.wait_for_timeout(200); s.snap("run-" + str(v))
            if not s.st()["termOpen"] and v != value:  # closeOnFail terminals: reopen with E
                s.p.wait_for_timeout(300); s.p.keyboard.press("e"); s.p.wait_for_timeout(300)
        s.until(lambda st: not st["termOpen"], 6)

def L1(b):
    b.go(29 * T - 28)
    t0 = time.time()
    while True:  # wall climb
        st = b.tick(); b.hold("ArrowRight")
        if st["ground"] and st["y"] < 8 * T: break
        if st["wall"] == 1 and st["vy"] > -60: b.jump(160)
        elif st["ground"]: b.jump(250)
        b.p.wait_for_timeout(25)
        if time.time() - t0 > 20: raise RuntimeError("climb failed")
    b.go(37 * T); b.term(8, 5); b.snap("bridge"); b.rescue(54 * T); b.go(60 * T)
def L2(b):
    bug = lambda st: st["bugs"][0]
    b.leap(12 * T + 6, land=15.5 * T); b.leap(17 * T + 4, land=21.5 * T); b.snap("ram")
    b.leap(23 * T + 4, land=27.5 * T, wait=lambda st: bug(st)["y"] > 425)
    b.leap(29 * T + 4, land=32.5 * T); b.leap(34 * T + 4, land=37.5 * T)
    b.go(43 * T); b.term(2, 6); b.snap("door")
    b.go(56 * T); b.term("cuda", "cpu")
    b.hold("ArrowLeft"); b.jump(250)                        # hop onto the fan grill
    b.until(lambda st: st["x"] < 53 * T, 4, hold="ArrowLeft"); b.rel()
    b.until(lambda st: st["y"] < 120 and abs(st["vy"]) < 80, 10); b.snap("updraft")
    b.go(57.5 * T, auto=False); b.ground(); b.rescue(62 * T); b.go(68 * T)
def L3(b):
    bug = lambda st: st["bugs"][0]
    b.leap(10 * T + 2, land=13 * T); b.go(17 * T + 4, auto=False); b.leap(17 * T + 4, land=22 * T); b.snap("belts")
    b.leap(26 * T + 4, land=29.5 * T)
    b.go(32 * T); b.term(2, 0); b.snap("vault")
    b.rescue(41.5 * T); b.go(53 * T); b.term("False", "True"); b.snap("stairs")
    b.go(68 * T, timeout=30)
def L4(b):
    fly = lambda st: st["bugs"][0]
    b.leap(14 * T + 4, wait=lambda st: fly(st)["y"] > 565); b.leap(24 * T + 4)
    b.go(39 * T); b.term(8000, 22); b.snap("port")
    pk = lambda st: [d for d in st["devs"] if d["id"] == "packet"][0]
    b.until(lambda st: abs(pk(st)["px"] - 41) < .05 and abs(pk(st)["py"] - 15) < .05, 30)
    b.go(41 * T + 6, auto=False); b.until(lambda st: st["ground"], 3)
    b.until(lambda st: pk(st)["px"] > 51.95 and pk(st)["py"] < 6.05, 20); b.snap("ride")
    b.go(55 * T, auto=False); b.go(57 * T); b.term("laser.off()", "break"); b.snap("lasers")
    b.rescue(70 * T); b.go(73 * T)
def L5(b):
    b.go(21 * T); b.term("southern_eucalypt", "oak_hickory"); b.snap("dict")
    b.rescue(24 * T); b.go(34 * T - 10, auto=False); b.term(5.5, 1.8); b.snap("lift")
    b.go(39 * T); b.leap(39.2 * T); b.leap(43 * T + 4)
    fly = lambda st: st["bugs"][2]
    b.leap(49 * T + 2, wait=lambda st: fly(st)["y"] > 418); b.snap("pad")
    b.go(56 * T); b.p.wait_for_timeout(3500); b.snap("finale")
    b.until(lambda st: False, 15)
with sync_playwright() as p:
    br = p.chromium.launch(args=["--no-sandbox"])
    page = br.new_page(viewport={"width": W, "height": H})
    bot = Bot(page)
    page.on("pageerror", lambda e: bot.errors.append(str(e)))
    page.on("console", lambda m: bot.errors.append(m.text) if m.type == "error" else None)
    page.goto((ROOT / "games/lab-escape/index.html").as_uri() + f"#level={LEVEL}")
    page.reload(); page.wait_for_timeout(500); bot.dialogs(); page.wait_for_timeout(700)
    t0 = time.time(); msg = ""
    try:
        [L1, L2, L3, L4, L5][LEVEL - 1](bot)
        bot.until(lambda st: False, 12)
    except Won: pass
    except Exception as e:
        import traceback; msg = repr(e) + ' @ ' + ' > '.join(str(f.lineno) for f in traceback.extract_tb(e.__traceback__))
    bot.rel(); page.wait_for_timeout(1200); bot.snap("end")
    won = bot.won()
    txt = page.locator(".rq-modal").inner_text().replace("\n", " | ")[:200] if won else ""
    s = page.evaluate("__labEscapeDebug.state()")
    print(f"L{LEVEL}", "WON" if won else "NOT WON", msg, "| wall %.1fs game %.1fs respawns %s" % (time.time() - t0, s["time"], s["respawns"]), "|", txt)
    print("errors:", bot.errors[:5])
    br.close(); sys.exit(0 if won and not bot.errors else 1)
