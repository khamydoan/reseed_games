/* Field Cards earned in Forest Detective (g15). */
RQ.defineCards("g15", [
  { id: "forest-first", name: "Check the forest first", icon: "🧠", cat: "algo",
    text: "Before measuring anything, ask: was this place a forest? If ForestNet finds fewer than 1 tile in 4, the case is closed: **NOT FOREST**.",
    reseed: "`pipeline.py` stops with `NOT_FOREST` (\"STOP - back to step 1\") before the NDVI step even starts." },
  { id: "best-season", name: "Best season vs best season", icon: "📈", cat: "forest",
    text: "Leafy trees look brown in winter. So ReSeed compares each year's **best growing-season** greenness, never winter with summer.",
    reseed: "`ndvi.yearly_peaks` builds one growing-season picture per year; `detect.py` uses each site's own matched months." },
  { id: "two-seasons", name: "Two seasons of proof", icon: "✌️", cat: "forest",
    text: "A drop of **0.20** or more (or 25 %) must show up in **both** recent seasons. One bad year is not enough to send the drones.",
    reseed: "`config.py`: `DECLINE_ABS = 0.20`, `DECLINE_REL = 0.25`, `PERSIST_YEARS = 2` (used in `detect.py`)." },
  { id: "burn-clue", name: "Burn-or-clearing clue", icon: "🔥", cat: "space",
    text: "Satellites see invisible **short-wave infrared** light, which shows bare or burned ground. If a reading called **NBR** drops by **0.10** or more, it hints at burning **or clearing**, not proof of fire.",
    reseed: "`acquire.py`: NBR = (NIR − SWIR2) ÷ (NIR + SWIR2); `config.py`: `DNBR_DISTURBANCE = 0.10`." },
  { id: "recovering", name: "Recovering naturally", icon: "🩹", cat: "forest",
    text: "If greenness dipped a lot in a past year but is back now, nature may be healing by itself. Hold off on seeds and keep watching.",
    reseed: "`pipeline.py`: a past season at least `RECOVERY_DIP = 0.12` below baseline, now healthy → `RECOVERING` (Kangaroo Island)." },
  { id: "if-elif", name: "if / elif / else", icon: "🔀", cat: "algo",
    text: "An **if / elif** chain checks from top to bottom, and the **first** true answer wins. Order matters! ReSeed's rule is a rule of thumb: its greenness score (NDVI) cannot tell a planted tree farm from a natural forest.",
    reseed: "`detect.summarise` checks RESEED, then SEASONAL, then the rest; README \"Honest limitations\" names the plantation problem." }
]);
