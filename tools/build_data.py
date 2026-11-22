"""Copy the real ReSeed results into the games (run in conda env `games`).

    python tools/build_data.py [--reseed ../reseed]

Writes
    data/reseed-data.js        window.RQ_DATA = {sites, species, roll, drones, thresholds, health, ...}
    data/forestnet-model.js    window.RQ_FORESTNET = {manifest, b64}   (the real float16 ForestNet weights)
    data/sites/<id>/*          thumb.jpg, rgb.jpg, rgb_baseline.jpg, ndvi.webp, classes.png, years/<year>.jpg
    data/examples/*.jpg        the example pictures used by the ReSeed classifier window (AI-generated, labelled)

Everything comes from the ReSeed repo's site/data (built by scripts/build_site_data.py) and reseed/config.py,
so the numbers in the games are the numbers in the code. No network access needed.
"""
import argparse
import ast
import base64
import json
import pathlib
import re
import shutil

GAMES = pathlib.Path(__file__).resolve().parents[1]

KEEP_SITE = ["id", "name", "country", "category", "biome", "lat", "lon", "story", "tags", "size_m", "phenology_year",
             "verdict", "patch_total_ha", "target_patch", "logistics", "release_footprint", "mission", "decline_forest_mean",
             "recent_seasons", "hotspot"]


def config_constants(reseed: pathlib.Path) -> dict:
    """Read the thresholds straight from reseed/config.py (no import: it needs the geo stack)."""
    src = (reseed / "reseed/config.py").read_text()
    tree = ast.parse(src)
    out = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name.isupper():
                try:
                    out[name] = ast.literal_eval(node.value)
                except ValueError:
                    pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reseed", default=str(GAMES.parent / "reseed"))
    args = ap.parse_args()
    reseed = pathlib.Path(args.reseed).resolve()
    sd = reseed / "site/data"
    cfg = config_constants(reseed)

    index = json.loads((sd / "sites.json").read_text())
    sites = []
    for entry in index:
        sid = entry["id"]
        full = json.loads((sd / "sites" / sid / "site.json").read_text())
        s = {k: full[k] for k in KEEP_SITE if k in full}
        s["image_date"] = entry.get("image_date")
        s["is_forest"] = entry.get("is_forest")
        s["top_landcover"] = entry.get("top_landcover")
        s["classifier"] = {k: full["classifier"][k] for k in ("forest_tile_fraction", "top_landcover", "is_forest", "imagery") if k in full.get("classifier", {})}
        if "landcover_mean" in full.get("classifier", {}):
            s["classifier"]["landcover_mean"] = full["classifier"]["landcover_mean"]
        nd = full.get("ndvi") or {}
        s["ndvi"] = {k: nd.get(k) for k in ("baseline_forest_mean", "image_forest_mean", "health_image", "monthly")}
        s["image"] = {"window": full.get("image", {}).get("window"),
                      "scenes": [{k: sc.get(k) for k in ("datetime", "cloud", "clear_fraction")} for sc in full.get("image", {}).get("scenes", [])],
                      "ndvi_mean": full.get("image", {}).get("ndvi_mean")}
        s["tiles"] = full.get("tiles")
        s["patches"] = (full.get("patches") or [])[:12]
        out_dir = GAMES / "data/sites" / sid
        (out_dir / "years").mkdir(parents=True, exist_ok=True)
        files = {}
        for name in ("thumb.jpg", "rgb.jpg", "rgb_baseline.jpg", "ndvi.webp", "classes.png", "dndvi.webp"):
            if (sd / "sites" / sid / name).exists():
                shutil.copy2(sd / "sites" / sid / name, out_dir / name)
                files[name.split(".")[0]] = f"data/sites/{sid}/{name}"
        years = []
        for y in full.get("years") or []:
            src = sd / "sites" / sid / y["rgb"]
            if src.exists():
                shutil.copy2(src, out_dir / "years" / src.name)
            years.append({"year": y["year"], "source": y["source"], "mean_forest_ndvi": y.get("mean_forest_ndvi"),
                          "scenes": y.get("scenes"), "rgb": f"data/sites/{sid}/years/{src.name}" if src.exists() else None})
        s["years"] = years
        s["files"] = files
        sites.append(s)

    species = json.loads((sd / "species.json").read_text())
    examples = json.loads((sd / "examples/examples.json").read_text())
    (GAMES / "data/examples").mkdir(parents=True, exist_ok=True)
    ex_out = []
    for e in examples:
        src = reseed / "site" / e["file"]
        if src.exists():
            shutil.copy2(src, GAMES / "data/examples" / src.name)
            ex_out.append({"id": e["id"], "title": e["title"], "category": e["category"], "file": f"data/examples/{src.name}",
                           "generated": e.get("generated", False)})

    data = {
        "source": {"repo": "https://github.com/khamydoan/reseed", "site": "https://khamydoan.github.io/reseed/",
                   "commit": (reseed / ".git/HEAD").exists() and _head(reseed)},
        "sites": sites,
        "biomes": species["biomes"], "roll": species["roll"], "drones": species["drones"],
        "examples": ex_out,
        "thresholds": {k: cfg[k] for k in ("DECLINE_ABS", "DECLINE_REL", "PERSIST_YEARS", "DNBR_DISTURBANCE", "SEASONAL_AMPLITUDE",
                                            "SEASONAL_PEAK_TOL", "MIN_PATCH_HA", "MIN_CLEAR_OBS", "RECOVERY_DIP", "MISSION_MAX_HA") if k in cfg},
        "health": [{"lower": c[0], "key": c[1], "label": c[2], "advice": c[3]} for c in cfg.get("HEALTH_CLASSES", [])],
        "stac_url": cfg.get("PC_STAC_URL"),
        "forest_rule": {"min_forest_tile_fraction": 0.25, "tile_px": 64, "tile_m": 640, "pixel_m": 10, "pixel_ha": 0.01},
        "physics": {"g": 9.81, "modes": ["hatch_drop", "jerk_back", "backward_flick", "spin_spread"],
                    "wind_alpha": 0.20, "downwash_mps": 6.0, "downwash_depth_m": 1.5, "default_altitude_m": 20.0, "default_speed_mps": 4.0},
        "forestnet": {"params": 214000, "input": [3, 64, 64], "channels": [24, 48, 96, 160], "hidden": 96,
                      "train_pictures": 57000,   # train splits: EuroSAT 21,600 + Intel 14,034 + RESISC45 18,900 + Places365 ~2,700 (train.py load_datasets)
                      "train_minutes_one_gpu": 12},
    }
    js = "/* Generated by tools/build_data.py from the ReSeed repo. Do not edit by hand. */\nwindow.RQ_DATA = " + \
         json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (GAMES / "data/reseed-data.js").write_text(js)

    manifest = json.loads((sd / "model/forestnet.json").read_text())
    b64 = base64.b64encode((sd / "model/forestnet.bin").read_bytes()).decode()
    (GAMES / "data/forestnet-model.js").write_text(
        "/* Generated by tools/build_data.py: the real ForestNet weights (float16) from the ReSeed repo. */\n"
        "window.RQ_FORESTNET = {manifest: " + json.dumps(manifest, separators=(",", ":")) + ', b64: "' + b64 + '"};\n')
    print(f"{len(sites)} sites, {len(ex_out)} examples, data {len(js)//1024} KB, model {len(b64)//1024} KB (base64)")


def _head(repo):
    head = (repo / ".git/HEAD").read_text().strip()
    if head.startswith("ref:"):
        ref = repo / ".git" / head.split(" ", 1)[1]
        if ref.exists():
            return ref.read_text().strip()[:7]
        packed = (repo / ".git/packed-refs")
        if packed.exists():
            m = re.search(r"^([0-9a-f]{40}) " + re.escape(head.split(" ", 1)[1]) + "$", packed.read_text(), re.M)
            if m:
                return m.group(1)[:7]
    return head[:7]


if __name__ == "__main__":
    main()
