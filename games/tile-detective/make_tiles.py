"""Cut real ReSeed pictures into 64x64 tiles for Tile Detective (g10) and Brain Builder (g11).

    conda activate games && python games/tile-detective/make_tiles.py [--reseed ../reseed]

Why: browsers block canvas.getImageData() on images opened from file://, so the games cannot read pixels
from the JPEGs at run time. This script stores the tile pixels as base64 RGB arrays in plain JS files, so the
real ForestNet (js/forestnet.js) runs fully offline.

Writes
    games/tile-detective/tiles.js   window.RQ_TILES  = {display, tiles[]}   (~1 MB, ~66 tiles)
    games/brain-builder/points.js   window.RQ_POINTS = {points[], farm[], tiles[]}  (2-D features + 2 tiles)

Pixels
  kind "site":    the EuroSAT-like picture ForestNet classified in the pipeline (site/data/sites/<id>/model_input.webp,
                  = reseed.classify.infer.eurosat_like_rgb of the baseline growing season for forest sites, the current
                  picture for the others). Its 10x10 grid of 64x64 tiles gives exactly site.tiles.p_forest.
                  Fallback when model_input.webp is missing: Games/data/sites/<id>/rgb_baseline.jpg converted back.
  kind "now":     today's picture (data/sites/<id>/rgb.jpg, display colours) converted to EuroSAT-like colours by
                  inverting reseed.acquire.true_color (gain 3.8, gamma 0.78) and adding the path radiance of
                  eurosat_like_rgb. An approximation (JPEG + clipping), used only for the "old or new picture?" level.
  kind "example": the labelled example pictures (AI-generated test images), centre-cropped and resized to 64x64 with
                  PIL bilinear (reducing_gap 2), like reseed.classify.infer.classify_image.
The games turn EuroSAT-like pixels back into display colours with the same formulas (tiles.js "display").
"""
import argparse
import base64
import json
import pathlib

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
GAMES = HERE.parents[1]
T = 64
PATH = np.array([0.016, 0.018, 0.052])      # reseed.classify.infer.PATH_RADIANCE (red, green, blue)
EUROSAT_FULL = 0.2750                       # reflectance that maps to 255 (infer.EUROSAT_SCALE = 255 / 0.2750)
GAIN, GAMMA = 3.8, 0.78                     # reseed.acquire.true_color

# Tile Detective level 1: "My Site" tiles (sorted by the pipeline's own p_forest)
MY_SITES = ["rondonia", "dixie", "kalimantan"]
PER_SITE = {"sure_forest": 4, "sure_not": 3, "borderline": 3}
# Level 4 "old picture or new?": a 3x3 block (1.9 km) of Rondônia that was forest in the baseline and is pasture now
THEN_NOW = {"site": "rondonia", "rows": None, "cols": None}   # None = found automatically (see pick_then_now)
# Level 2 race: real tiles that might fool a forest detector (greenest tile of each site)
TRICKY_SITES = [("palm_desert", "Golf course (Indian Wells)", 0), ("kansas", "Crop circles (Kansas)", 0),
                ("manhattan", "Central Park (Manhattan)", 0), ("congo", "Rainforest (Congo)", 1)]
EXAMPLE_TRUTH = {"forest_healthy": 1, "forest_winter": 1, "ground_forest": 1, "forest_deforested": None,
                 "forest_burned": None, "river": 0, "city": 0, "buildings": 0, "street": 0, "construction": 0,
                 "lawn": 0, "fields": 0, "ocean": 0, "ground_street": 0}


def b64(a: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.uint8).tobytes()).decode()


def display_to_eurosat(rgb: np.ndarray) -> np.ndarray:
    """Display colours (true_color) -> EuroSAT-like model input (eurosat_like_rgb), approximately."""
    refl = (rgb.astype(np.float64) / 255.0) ** (1 / GAMMA) / GAIN
    return np.clip((refl + PATH) * 255 / EUROSAT_FULL + 0.5, 0, 255).astype(np.uint8)


def eurosat_to_display(mi: np.ndarray) -> np.ndarray:
    refl = mi.astype(np.float64) * EUROSAT_FULL / 255 - PATH
    return (np.clip(refl * GAIN, 0, 1) ** GAMMA * 255 + 0.5).astype(np.uint8)


def site_picture(reseed: pathlib.Path, sid: str) -> np.ndarray:
    mi = reseed / "site/data/sites" / sid / "model_input.webp"
    if mi.exists():
        return np.asarray(Image.open(mi).convert("RGB"))
    return display_to_eurosat(np.asarray(Image.open(GAMES / "data/sites" / sid / "rgb_baseline.jpg").convert("RGB")))


def p_grid(reseed: pathlib.Path, sid: str) -> np.ndarray:
    js = reseed / "site/data/sites" / sid / "site.json"
    return np.array(json.loads(js.read_text())["tiles"]["p_forest"], dtype=float)


def tile(img: np.ndarray, r: int, c: int) -> np.ndarray:
    return img[r * T:(r + 1) * T, c * T:(c + 1) * T]


def spread_pick(cands, n):
    """Pick n of the candidates (r, c, p), evenly spread through the list (deterministic)."""
    if len(cands) <= n:
        return cands
    idx = np.linspace(0, len(cands) - 1, n).round().astype(int)
    return [cands[i] for i in idx]


def features(rgb_display: np.ndarray) -> tuple[float, float]:
    """Kid features of a tile: greenness (share of green, 0-100 scaled) and brightness (0-100)."""
    m = rgb_display.reshape(-1, 3).astype(float).mean(0)
    green_share = m[1] / max(m.sum(), 1e-6)                 # about 0.30 (grey/blue) .. 0.48 (deep green)
    g = float(np.clip((green_share - 0.30) / 0.20 * 100, 0, 100))
    b = float(np.clip((m.mean() / 255 - 0.10) / 0.60 * 100, 0, 100))
    return round(g, 1), round(b, 1)


def pick_then_now(p: np.ndarray, now_img: np.ndarray):
    """3x3 block of tiles: all forest in the baseline (p >= 0.9) and the least green today."""
    best = None
    for r in range(8):
        for c in range(8):
            blk = p[r:r + 3, c:c + 3]
            if (blk < 0.9).any():
                continue
            disp = now_img[r * T:(r + 3) * T, c * T:(c + 3) * T].reshape(-1, 3).astype(float).mean(0)
            score = disp[0] + disp[2] - 2 * disp[1] + disp.mean()   # brown + bright = cleared pasture
            if best is None or score > best[0]:
                best = (score, r, c)
    return best[1], best[2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reseed", default=str(GAMES.parent / "reseed"))
    args = ap.parse_args()
    reseed = pathlib.Path(args.reseed).resolve()
    tiles = []

    # ---- level 1: My Site tiles ----------------------------------------------------------------
    for sid in MY_SITES:
        img, p = site_picture(reseed, sid), p_grid(reseed, sid)
        cells = [(r, c, float(p[r, c])) for r in range(10) for c in range(10)]
        sure_f = sorted([x for x in cells if x[2] >= 0.9], key=lambda x: (x[0], x[1]))
        sure_n = sorted([x for x in cells if x[2] <= 0.1], key=lambda x: (x[0], x[1]))
        border = sorted([x for x in cells if 0.3 <= x[2] <= 0.7], key=lambda x: abs(x[2] - 0.5))
        if len(sure_n) < PER_SITE["sure_not"]:   # few clear non-forest tiles: take the lowest ones
            sure_n = sorted(cells, key=lambda x: x[2])[:8]
        pick = (spread_pick(sure_f, PER_SITE["sure_forest"]) + spread_pick(sure_n, PER_SITE["sure_not"]) +
                border[:PER_SITE["borderline"]])
        for r, c, pf in pick:
            tiles.append({"id": f"{sid}-{r}-{c}", "kind": "site", "src": sid, "r": r, "c": c, "p": round(pf, 4),
                          "set": "mysite", "b64": b64(tile(img, r, c))})

    # ---- level 4: then and now (Rondônia) ------------------------------------------------------------
    sid = THEN_NOW["site"]
    img, p = site_picture(reseed, sid), p_grid(reseed, sid)
    now_disp = np.asarray(Image.open(GAMES / "data/sites" / sid / "rgb.jpg").convert("RGB"))
    r0, c0 = pick_then_now(p, now_disp)
    now_img = display_to_eurosat(now_disp)
    for r in range(r0, r0 + 3):
        for c in range(c0, c0 + 3):
            tiles.append({"id": f"{sid}-then-{r}-{c}", "kind": "site", "src": sid, "r": r, "c": c,
                          "p": round(float(p[r, c]), 4), "set": "then", "b64": b64(tile(img, r, c))})
            tiles.append({"id": f"{sid}-now-{r}-{c}", "kind": "now", "src": sid, "r": r, "c": c, "set": "now",
                          "b64": b64(tile(now_img, r, c))})

    # ---- level 2: tricky real tiles + example pictures --------------------------------------------
    for sid, title, truth in TRICKY_SITES:
        img, p = site_picture(reseed, sid), p_grid(reseed, sid)
        best = max(((r, c) for r in range(10) for c in range(10)),
                   key=lambda rc: features(eurosat_to_display(tile(img, *rc)))[0])
        r, c = best
        tiles.append({"id": f"{sid}-{r}-{c}", "kind": "site", "src": sid, "r": r, "c": c, "p": round(float(p[r, c]), 4),
                      "set": "race", "title": title, "truth": truth, "b64": b64(tile(img, r, c))})
    examples = json.loads((reseed / "site/data/examples/examples.json").read_text())
    for e in examples:
        f = GAMES / "data/examples" / pathlib.Path(e["file"]).name
        if not f.exists():
            continue
        im = Image.open(f).convert("RGB")
        w, h = im.size
        s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
        im = im.resize((T, T), Image.BILINEAR, reducing_gap=2.0)
        tiles.append({"id": "ex-" + e["id"], "kind": "example", "src": e["id"], "set": "race", "title": e["title"],
                      "truth": EXAMPLE_TRUTH.get(e["id"]), "file": f"data/examples/{f.name}", "b64": b64(np.asarray(im))})

    disp = {"path": PATH.tolist(), "full": EUROSAT_FULL, "gain": GAIN, "gamma": GAMMA}
    js = ("/* Generated by games/tile-detective/make_tiles.py from the ReSeed pictures. Do not edit by hand.\n"
          " * b64 = 64x64x3 uint8 RGB. kind site/now: EuroSAT-like colours (what ForestNet sees); example: photo colours. */\n"
          "window.RQ_TILES = " + json.dumps({"display": disp, "then_now": {"site": sid, "r": r0, "c": c0}, "tiles": tiles},
                                            separators=(",", ":")) + ";\n")
    (HERE / "tiles.js").write_text(js)
    print(f"tiles.js: {len(tiles)} tiles, {len(js) // 1024} KB, then/now block at row {r0}, col {c0}")

    # ---- Brain Builder: 2-D features of real tiles (label = the pipeline's ForestNet answer) ---------------
    pts = []
    forest_sites = ["rondonia", "congo", "ozarks", "dixie", "kalimantan", "kangaroo"]
    city_sites = ["manhattan", "la_interchange", "new_capital", "maldives", "manaus", "palm_desert"]
    rng = np.random.default_rng(7)
    for sid in forest_sites + city_sites:
        img, p = site_picture(reseed, sid), p_grid(reseed, sid)
        cells = [(r, c) for r in range(10) for c in range(10)]
        rng.shuffle(cells)
        quota = {1: 11, 0: 4} if sid in forest_sites else {1: 0, 0: 10}   # forest sites: mostly forest, some pasture/scar
        for r, c in cells:
            pf = float(p[r, c])
            if 0.3 < pf < 0.7:
                continue            # keep clear examples: the pipeline's answer is the label
            y = int(pf >= 0.5)
            if quota[y] <= 0:
                continue
            quota[y] -= 1
            g, b = features(eurosat_to_display(tile(img, r, c)))
            pts.append({"g": g, "b": b, "y": y, "s": sid})
    # Level 1 (one neuron) uses forest vs city/water/desert dots that one straight line can split:
    # fit a logistic regression and keep the dots it gets right with a small margin (flag l1 = 1)
    sel = [q for q in pts if q["y"] == 1 or q["s"] in city_sites]
    Xa = np.array([[(q["g"] - 50) / 25, (q["b"] - 30) / 25, 1.0] for q in sel])
    ya = np.array([q["y"] for q in sel], dtype=float)
    w = np.zeros(3)
    for _ in range(4000):
        pr = 1 / (1 + np.exp(-Xa @ w))
        w -= 0.5 * Xa.T @ (pr - ya) / len(ya)
    margin = (Xa @ w) * (2 * ya - 1)
    for q, m in zip(sel, margin):
        if m > 0.6:
            q["l1"] = 1
    # Kansas crop circles closest to the forest cloud in (greenness, brightness): colour alone says "forest"
    fx = np.array([[q["g"], q["b"]] for q in pts if q["y"] == 1]).mean(0)
    img, p = site_picture(reseed, "kansas"), p_grid(reseed, "kansas")
    ks = []
    for r in range(10):
        for c in range(10):
            g, b = features(eurosat_to_display(tile(img, r, c)))
            ks.append((float(np.hypot(g - fx[0], (b - fx[1]) * 2)), {"g": g, "b": b, "y": int(p[r, c] >= 0.5), "s": "kansas",
                                                                      "r": r, "c": c}))
    ks.sort(key=lambda t: t[0])
    farm = [k[1] for k in ks[:5]]
    sample = []
    img, p = site_picture(reseed, "rondonia"), p_grid(reseed, "rondonia")
    # one tile with a forest edge (borderline) and one deep-forest tile for the "real layer 1" view
    border = sorted(((r, c) for r in range(10) for c in range(10)), key=lambda rc: abs(p[rc] - 0.5))[0]
    deep = max(((r, c) for r in range(10) for c in range(10)), key=lambda rc: p[rc])
    for (r, c), name in ((border, "Forest edge"), (deep, "Deep forest")):
        sample.append({"id": f"rondonia-{r}-{c}", "title": name, "p": round(float(p[r, c]), 4), "b64": b64(tile(img, r, c))})
    fr = farm[0]
    sample.append({"id": f"kansas-{fr['r']}-{fr['c']}", "title": "Green crop circle", "p": round(float(p_grid(reseed, "kansas")[fr["r"], fr["c"]]), 4),
                   "b64": b64(tile(site_picture(reseed, "kansas"), fr["r"], fr["c"]))})
    pj = ("/* Generated by games/tile-detective/make_tiles.py. Real tile features: g = greenness 0-100, b = brightness 0-100,\n"
          " * y = 1 if ReSeed's ForestNet said forest (p >= 0.5). farm = green crop-circle tiles from Kansas (not forest). */\n"
          "window.RQ_POINTS = " + json.dumps({"display": disp, "points": pts, "farm": farm, "tiles": sample},
                                             separators=(",", ":")) + ";\n")
    (GAMES / "games/brain-builder").mkdir(parents=True, exist_ok=True)
    (GAMES / "games/brain-builder/points.js").write_text(pj)
    print(f"points.js: {len(pts)} points ({sum(x['y'] for x in pts)} forest), {len(farm)} farm tiles, {len(pj) // 1024} KB")


if __name__ == "__main__":
    main()
