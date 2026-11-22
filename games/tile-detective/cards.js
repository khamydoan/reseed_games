/* Field Cards earned in Tile Detective (g10). */
RQ.defineCards("g10", [
  { id: "image-tiles", name: "Image tiles", icon: "🧩", cat: "ai",
    text: "A big picture is cut into small squares called **tiles**. Each tile is **64 × 64 pixels**. One pixel is 10 m, so a tile is 640 m across.",
    reseed: "`classify/infer.py` (`classify_tiles`) cuts a picture into 64 × 64 tiles and scores each one. A site picture is 640 × 640 pixels (`config.py`: `chip_m = 6400` m at 10 m), so 10 × 10 tiles." },
  { id: "classifier", name: "Classifier", icon: "🗂️", cat: "ai",
    text: "A **classifier** sorts things into groups, like *forest* or *not forest*. ForestNet also gives a forest score, from 0 % to 100 %.",
    reseed: "ForestNet's forest answer is a probability. `pipeline.py` counts a tile as forest when it is **0.5 or more**." },
  { id: "view-gate", name: "Three experts", icon: "🔭", cat: "ai",
    text: "ForestNet first asks: was this picture taken from **space**, from **a plane** or on **the ground**? Then the matching expert names what it sees.",
    reseed: "`classify/infer.py` picks the land-cover, aerial or scene head from the view head (`VIEW_HEAD`)." },
  { id: "one-in-four", name: "The 1-in-4 rule", icon: "🧮", cat: "algo",
    text: "If at least **1 tile in 4** (25 %) is forest, the place is **forest land** and the mission goes on. If not: **STOP**, pick another place.",
    reseed: "`pipeline.py`: `is_forest = forest_frac >= 0.25`, otherwise verdict `NOT_FOREST` and \"STOP - back to step 1\"." },
  { id: "baseline-picture", name: "Judge the old picture", icon: "🕰️", cat: "forest",
    text: "A cleared forest looks like a field today. So the forest check looks at an **older** growing-season picture, from before the damage.",
    reseed: "`pipeline.py` runs ForestNet on the **baseline** growing season (`config.py` `baseline_years`, e.g. 2017–2019 for Rondônia); the `classify/infer.py` docstring explains why." },
  { id: "ai-in-browser", name: "AI in your browser", icon: "💻", cat: "ai",
    text: "ForestNet learned numbers called **weights** from practice pictures. The same weights run right here in your web browser.",
    reseed: "`site/js/forestnet.js` runs the exported weights; `tests/js/forestnet.test.mjs` checks its raw scores stay within 0.001 of PyTorch's." }
]);
