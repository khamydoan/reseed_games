/* Field Cards earned in Server Lab Escape (g25). */
RQ.defineCards("g25", [
  { id: "le-loop", name: "for loop", icon: "🔁", cat: "python",
    text: "`for i in range(7):` runs the lines inside it **7 times**. Python counts i = 0, 1, 2 … 6. Change the number, change how often it repeats.",
    reseed: "`reseed/logistics.py` uses `for sp in species:` to count seeds and rolls for every tree species in a biome." },
  { id: "le-condition", name: "if and comparisons", icon: "🚦", cat: "python",
    text: "`if ndvi >= 0.6:` asks a yes/no question. The answer is **True** or **False**, and only True runs the lines inside.",
    reseed: "`reseed/config.py` `HEALTH_CLASSES` starts with 0.60 = Healthy, and `health_class()` in `reseed/ndvi.py` picks a label with `if value >= lower:`." },
  { id: "le-cuda", name: "CPU or GPU device", icon: "⚡", cat: "ai",
    text: "PyTorch can train on the **cpu**, or use **cuda** for a compatible NVIDIA graphics card (GPU). A GPU does many sums at once, so it can train big models much faster.",
    reseed: "`reseed/classify/train.py` picks `torch.device(\"cuda\" if torch.cuda.is_available() else \"cpu\")`. The README says retraining ForestNet takes about 12 minutes on one GPU." },
  { id: "le-lists", name: "Lists, index 0 and sorting", icon: "🔢", cat: "python",
    text: "In a list, the first item is `[0]`, the second is `[1]`. `sorted(x, reverse=True)` puts the biggest first; `reverse=False` the smallest first.",
    reseed: "`reseed/polygonize.py` sorts patches with `key=lambda f: -f[\"properties\"][\"area_ha\"]`, biggest first. `health_map()` in `reseed/ndvi.py` stores index 0 for Healthy." },
  { id: "le-port", name: "Ports", icon: "🔌", cat: "network",
    text: "One computer runs many programs. A **port** number says which one should answer: 22 is usually SSH, 443 is HTTPS websites.",
    reseed: "`python -m reseed serve` uses port **8000** by default (`reseed/__main__.py`), and `/api/health` replies with `{\"ok\": true, …}` (`reseed/server.py`)." },
  { id: "le-dict", name: "Dictionary", icon: "📖", cat: "data",
    text: "A **dict** stores values under names called keys. `BIOMES[\"southern_eucalypt\"]` finds Kangaroo Island's forest, Koa's home.",
    reseed: "`reseed/species.py` keeps each forest biome in the `BIOMES` dict: its native seeds, climate and `animals` list." }
]);
