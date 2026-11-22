"""Scripted Playwright input test for Drone Rush (g21): a closed-loop autopilot that only uses the keyboard
(hold W thrust, A/D tilt, Space drop) and reads the read-only state handle window.__droneRush each tick.
Proves every level is completable. Run in the conda env `games`, from the Games/ folder:

    python games/drone-rush/autopilot_test.py            # all 5 levels
    python games/drone-rush/autopilot_test.py 3 -v       # level 3 with a flight trace
"""
import sys, json, time, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]   # the Games/ folder
TRACE = "-v" in sys.argv
levels = [int(a) for a in sys.argv[1:] if a != "-v"] or [1, 2, 3, 4, 5]
SHOTS = pathlib.Path("/tmp/drone-rush-autopilot"); SHOTS.mkdir(exist_ok=True)
PROBE = """() => { const R = window.__droneRush; if (!R) return null; const S = R.S, W = R.W, d = S.d;
  const p = W.patches.find(q => !q.done); const target = p ? p.x : W.pad;
  const dir = target >= d.x ? 1 : -1; let need = 1e9;
  for (let x = d.x - 60; Math.abs(x - d.x) <= 520; x += dir * 20) {
    if ((dir > 0 && x > target + 40) || (dir < 0 && x < target - 40)) break;
    need = Math.min(need, W.y(x) - (R.cfg.trees || R.cfg.lines || R.cfg.birds ? 150 : 150));
    W.trees.forEach(t => { if (Math.abs(t.x - x) < 110) need = Math.min(need, W.y(t.x) - t.h - 90); });
    W.lines.forEach(l => { if (x > l.x1 - 60 && x < l.x2 + 60) need = Math.min(need, Math.min(l.y1, l.y2) - 90); });
  }
  let bird = null; W.birds.forEach(b => { const q = W.birdPos(b, S.t); if (Math.abs(q.x - d.x) < 260 && Math.abs(q.y - d.y) < 90) bird = q; });
  return { x: d.x, y: d.y, vx: d.vx, vy: d.vy, a: d.a, landed: d.landed, bat: S.battery, rolls: S.rollsLeft, falling: S.falling.filter(f => !f.done || f.reel != null).length,
    crash: !!S.crash, won: S.won, gy: W.y(d.x), need: need, target: target, pad: W.pad, timer: S.timer, crashes: S.crashes, swaps: S.swaps,
    patchHalf: p ? p.half : 0, bird: bird, wind: S.wind, drops: S.drops, ceil: W.y(d.x) - 720 }; }"""
def adv(page):
    for _ in range(30):
        if page.locator(".rq-talk").count() == 0: return
        page.keyboard.press("Enter"); page.wait_for_timeout(50); page.keyboard.press("Enter"); page.wait_for_timeout(150)
results = {}
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1366, "height": 800})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    url = (ROOT / "games/drone-rush/index.html").as_uri()
    for lv in levels:
        pg.goto(url + f"#level={lv}"); pg.reload(); pg.wait_for_timeout(500); adv(pg); pg.wait_for_timeout(300)
        held = {"w": False, "a": False, "d": False}
        def key(k, on):
            if held[k] != on: (pg.keyboard.down if on else pg.keyboard.up)(k); held[k] = on
        t0 = time.time(); shot = 0; dropped_at = None; s = None
        while time.time() - t0 < 240:
            s = pg.evaluate(PROBE)
            if s is None: pg.wait_for_timeout(50); continue
            if s["won"] or pg.locator(".rq-modal").count(): break
            if s["crash"]: [key(k, False) for k in held]; pg.wait_for_timeout(60); continue
            dx = s["target"] - s["x"]; alt = s["gy"] - s["y"]
            homing = s["rolls"] == 0 and s["falling"] == 0
            vmax = 300
            tvx = max(-vmax, min(vmax, dx * 0.9))
            if abs(dx) < 300: tvx = max(-140, min(140, dx * 0.9))
            ty = s["need"]
            if s["y"] - ty > 70: tvx = max(-60, min(60, tvx))     # climb first, then fly (heavy drones climb slowly when tilted)
            if not homing and abs(dx) < 90: ty = s["gy"] - 105          # descend to drop height over the patch
            if homing and abs(dx) < 50 and abs(s["vx"]) < 60: ty = s["gy"] + 50   # land
            if s["bird"] and not (not homing and abs(dx) < 120): ty = min(ty, s["bird"]["y"] - 110)
            ty = max(ty, s["ceil"] + 40)
            tvy = max(-260, min(170, (ty - s["y"]) * 2.2))
            if homing and abs(dx) < 50: tvy = min(tvy, 110)
            key("w", s["vy"] > tvy)
            ev = tvx - s["vx"]
            key("d", ev > 35); key("a", ev < -35)
            if not homing and s["rolls"] > 0 and s["falling"] == 0 and abs(dx) < s["patchHalf"] - 40 and alt < 140 and abs(s["vx"]) < 120:
                pg.keyboard.press("Space")
            if shot < 3 and s["timer"] > [4, 12, 22][shot]:
                pg.screenshot(path=str(SHOTS / f"L{lv}-fly{shot}.png")); shot += 1
            if TRACE and int(s["timer"] * 2) != getattr(sys, "_lt", -1):
                sys._lt = int(s["timer"] * 2)
                if sys._lt % 4 == 0: print(f"  t={s['timer']:5.1f} x={s['x']:6.0f} alt={alt:5.0f} vx={s['vx']:5.0f} vy={s['vy']:5.0f} a={s['a']:.2f} tgt={s['target']:5.0f} bat={s['bat']:4.1f} rolls={s['rolls']} land={s['landed']} need-y={s['need']-s['y']:.0f}", flush=True)
            pg.wait_for_timeout(25)
        [key(k, False) for k in held]
        pg.wait_for_timeout(900)
        pg.screenshot(path=str(SHOTS / f"L{lv}-end.png"))
        txt = pg.locator(".rq-modal").inner_text().replace("\n", " ") if pg.locator(".rq-modal").count() else "NO WIN MODAL"
        results[lv] = {"won": bool(s and s["won"]), "timer": round(s["timer"], 1) if s else None, "battery": round(s["bat"], 1) if s else None,
                       "crashes": s["crashes"] if s else None, "swaps": s["swaps"] if s else None, "modal": txt[:160]}
        print(lv, json.dumps(results[lv]), flush=True)
    print("errors:", errs)
    b.close()
ok = all(r["won"] for r in results.values()) and not errs
print("PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
