/* Field Cards earned in Patch Painter (g16). Facts checked against reseed/reseed/polygonize.py, config.py, detect.py, pipeline.py. */
RQ.defineCards("g16", [
  { id: "pp-threshold", name: "Threshold & mask", icon: "🎚️", cat: "algo",
    text: "A **threshold** is a cut-off number. Every pixel at or above it says **yes** and lights up; the rest say no. That yes/no map is a **mask**. (Game version: the map is made up.)",
    reseed: "`detect.py` compares each season's greenest NDVI with an earlier baseline peak. A drop of 0.20 or more (`DECLINE_ABS` in `config.py`) or 25 %, in two recent growing seasons, is a loss clue. `polygonize.py` turns the yes/no map into patches." },
  { id: "pp-flood-fill", name: "Flood fill", icon: "🪣", cat: "algo",
    text: "Start on one lit square and spread to its neighbours **up, down, left and right**, again and again, until nothing new is found. Each spill is one **patch** (a connected component). Corners don't count!",
    reseed: "`polygonize.py` calls `ndimage.label`, which gives every connected patch its own number. Its neighbours are up, down, left and right." },
  { id: "pp-hectare", name: "Pixels & hectares", icon: "📏", cat: "math",
    text: "On ReSeed's 10 m grid, one pixel is 10 m × 10 m = 100 m² = **0.01 ha**. One **hectare** is 100 m × 100 m, so it holds **100 of these pixels**.",
    reseed: "`acquire.site_geobox` uses a 10 m grid (Sentinel-2 has 10, 20 and 60 m bands). `config.py`: `MIN_PATCH_HA = 0.5`; `polygonize.polygonize` skips patches under half a hectare (50 pixels). Some may be real loss, but they are left out." },
  { id: "pp-sorting", name: "Sorting", icon: "🃏", cat: "algo",
    text: "**Bubble sort** checks neighbours and swaps them into order, again and again. Python uses **Timsort**. For short lists it uses **insertion sort**: tuck each item into its right spot.",
    reseed: "`polygonize.polygonize` sorts the patches largest first and gives **rank 1** to the biggest." },
  { id: "pp-split", name: "Split big jobs", icon: "✂️", cat: "drone",
    text: "A job too big for one mission is cut into pieces, one mission each. A square about 707 m × 707 m is about 50 hectares. (Game version: 50 m grid, 700 m squares.)",
    reseed: "`config.py`: `MISSION_MAX_HA = 50` is ReSeed's planning limit per mission (not a drone limit). `polygonize.split_patch` cuts bigger patches into squares of √(50 ha) ≈ 707 m; `pipeline._mission_target` picks the largest patch of 2–50 ha first." }
]);
