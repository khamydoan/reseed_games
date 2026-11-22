/* Field Cards earned in NDVI Goggles (g13). */
RQ.defineCards("g13", [
  { id: "near-infrared", name: "Near-infrared light", icon: "🥽", cat: "space",
    text: "Leaves soak up **red** light to make food (photosynthesis) and bounce back lots of **near-infrared** (NIR), a light our eyes cannot see. Snow bounces back both, so it fools you if you only look at NIR.",
    reseed: "`acquire.py` loads Sentinel-2's red band (B04) and near-infrared band (B08) for every site." },
  { id: "ndvi", name: "NDVI", icon: "🌿", cat: "forest",
    text: "**NDVI = (NIR − Red) ÷ (NIR + Red)**. With light readings above zero it stays between −1 and 1. Leafy plants usually score high, bare ground near 0, water often below 0.",
    reseed: "`acquire.py`: `ndvi(red, nir)` calls `normalized_difference(nir, red)`, which computes `(nir - red) / (nir + red)` per pixel, turns 0 ÷ 0 into NaN (\"no data\") and clips to −1…1." },
  { id: "health-classes", name: "Health classes", icon: "🪜", cat: "forest",
    text: "Start at the top and stop at the first match (**≥** means \"this number or higher\"): **≥ 0.60** Healthy, **≥ 0.30** Moderate health, **≥ 0.10** Sparse, **≥ 0.01** No vegetation, lower is Not seedable.",
    reseed: "`config.py HEALTH_CLASSES` and `ndvi.py health_class()` give exactly these labels (a display label only)." },
  { id: "forest-check", name: "Was it a forest?", icon: "🧠", cat: "ai",
    text: "A low NDVI is **not** a reason to plant. Roads, lakes, roofs and farms score low too. Seeds only go where a forest used to grow.",
    reseed: "`pipeline.py` runs ForestNet on the older *baseline* picture and stops at NOT_FOREST; `detect.detect(forest_extent, …)` only marks loss inside that historical forest area, and only if it lasts two seasons." },
  { id: "ndvi-wave", name: "The NDVI wave", icon: "〰️", cat: "data",
    text: "A leaf-dropping oak forest's NDVI rises and falls every year like a wave: high in summer, low in winter. A winter dip with a strong summer high is normal.",
    reseed: "`ndvi.py monthly_ndvi()` makes one NDVI picture per month (Ozarks 2025 in `pipeline.py`); months with no clear scene stay as gaps instead of guesses." }
]);
