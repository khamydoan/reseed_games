/* Field Cards earned in Roll Factory (g17). */
RQ.defineCards("g17", [
  { id: "roll-volume", name: "Volume of a tube", icon: "🧻", cat: "math",
    text: "Our roll is 4.5 cm wide inside and 10 cm long. Half its width is **2.25 cm**, so the room inside is **π × 2.25 × 2.25 × 10 ≈ 159 mL** (π is about 3.14).",
    reseed: "`logistics.py`: `ROLL_VOLUME_ML = math.pi * (ROLL_INNER_DIAMETER_CM / 2) ** 2 * ROLL_LENGTH_CM`, about 159 mL." },
  { id: "packing", name: "Packing & jams", icon: "🌰", cat: "math",
    text: "Round seeds leave gaps. ReSeed's plan assumes seeds fill about **60 %** of a roll, and allows for about **10 %** to jam or stay behind instead of falling out.",
    reseed: "Planning values in `logistics.py`: `PACKING = 0.60` (random close packing of rounded seeds) and `DISPENSER_LOSS = 0.10` (seeds that jam or stay in the roll)." },
  { id: "int-down", name: "int() chops off decimals", icon: "✂️", cat: "python",
    text: "`int(12.27)` is **12**: it chops off the decimals. You can't pack 0.27 of a nut!",
    reseed: "`seeds_per_roll()` returns `max(1, int(ROLL_VOLUME_ML * PACKING * (1 - DISPENSER_LOSS) / volume_ml))`: 26 white-oak acorns, 954 ponderosa pine seeds." },
  { id: "ceil-up", name: "math.ceil() rounds up", icon: "⬆️", cat: "math",
    text: "`math.ceil(2.25)` is **3**. If 9 rolls fly 4 at a time, the last roll still needs its own trip!",
    reseed: "`plan()` uses `math.ceil` for rolls, sorties (trips), battery charges and days." },
  { id: "mission-cost", name: "Drones vs hands", icon: "💰", cat: "math",
    text: "Compare plans in the same unit, like dollars. ReSeed's plan counts **$2.50** for each tree planted by hand, and pays drones by the flying hour.",
    reseed: "`plan()` for Rondônia's 44 ha patch: 604,725 seeds, 11,974 rolls, 36 days with 3 drones, about $25,202 vs $274,875 by hand." }
]);
