/* Field Cards earned in Spell Academy (g14). */
RQ.defineCards("g14", [
  { id: "py-variable", name: "Variables & strings", icon: "🏺", cat: "python",
    text: "A **variable** is a name for a value: `seeds = 12`. Text in quotes is a **string**: `\"2\" + \"3\"` glues into `23`, but `2 + 3` is `5`.",
    reseed: "`logistics.py` keeps its numbers in named variables, like `PACKING = 0.60` and `DISPENSER_LOSS = 0.10`." },
  { id: "py-function", name: "Functions", icon: "🪄", cat: "python",
    text: "`def` makes a spell you can reuse. Inputs go in the brackets and `return` sends the answer back. The first input goes into the first name!",
    reseed: "`acquire.py` has `def ndvi(red, nir)`, which works out `(nir - red) / (nir + red)` through `normalized_difference()`. Red comes first, so the order matters." },
  { id: "py-if", name: "if / elif / else", icon: "🪜", cat: "python",
    text: "Python checks each condition from the top and runs only the first one that is True. A `:` opens a block, and the lines inside it are indented.",
    reseed: "`ndvi.py health_class()` checks the `HEALTH_CLASSES` list from 0.60 down and returns the first match (game version: written as if / elif)." },
  { id: "py-loop", name: "for loops & lists", icon: "🔁", cat: "python",
    text: "`for m in range(1, 13):` repeats for m = 1 up to 12: it stops *before* 13. Lists count from 0, so `seeds[0]` is the first item.",
    reseed: "`ndvi.py monthly_ndvi()` loops `for m in range(1, 13)` to make one NDVI picture per month." },
  { id: "py-dict", name: "Dictionaries", icon: "🗄️", cat: "python",
    text: "A **dictionary** finds a value by its key, like the label on a drawer: `BIOMES[\"oak_hickory\"]`. You can open drawers inside drawers.",
    reseed: "`species.py` lists the seeds for each forest type it covers in a dictionary called `BIOMES` (game version: fewer details per seed)." },
  { id: "py-class", name: "Classes & objects", icon: "🚁", cat: "python",
    text: "A **class** is a blueprint. Each object built from it keeps its own data (Koa's battery is not Tuki's), and a **method** like `fly()` can change it.",
    reseed: "`logistics.py` has `@dataclass class Drone` with fields like `endurance_min = 22` and `max_payload_g = 900` (game version: battery in %)." }
]);
