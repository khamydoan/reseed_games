/* ReSeed Quest catalogue: islands (chapters) and games. Single source of truth for the hub and every game page.
 * Kid-facing: title, tagline. Grown-up-facing: skills, reseed. Keep in sync with docs/GAME_DESIGN.md. */
(function () {
  "use strict";
  var RQ = window.RQ = window.RQ || {};
  var chapters = [
    { n: 0, key: "camp", name: "Base Camp", label: "Build the mission computer", color: "#12a39a", tint: "#e3f6f4", icon: "🏕️", who: "mo",
      step: "Before step 01", story: "Every mission needs a computer. Build one, install its brain, and make a clean workspace for ReSeed." },
    { n: 1, key: "see", name: "See", label: "Pictures from space", color: "#d08a1c", tint: "#fdf4e3", icon: "🛰️", who: "tuki",
      step: "Step 01 · Acquire", story: "Satellites take pictures of the whole Earth. Download them from the cloud and wipe away the clouds." },
    { n: 2, key: "check", name: "Check", label: "Is it a forest?", color: "#7c5cc4", tint: "#f1edfa", icon: "🧠", who: "hoot",
      step: "Step 02 · Classify", story: "A neural network called ForestNet looks at little squares. Forest, or not forest?" },
    { n: 3, key: "score", name: "Score", label: "The greenness score", color: "#2f9e4f", tint: "#eaf6ec", icon: "🌿", who: "hoot",
      step: "Step 03 · NDVI", story: "Healthy leaves glow in light we cannot see. Turn that glow into a greenness score." },
    { n: 4, key: "decide", name: "Decide", label: "Lost, or just winter?", color: "#d1495b", tint: "#fcecee", icon: "🔎", who: "hoot",
      step: "Step 04 · Decide", story: "Is the forest really gone, or just leafless for winter? Be a data detective." },
    { n: 5, key: "plan", name: "Plan", label: "Outline, count, choose", color: "#e0752d", tint: "#fdf0e6", icon: "🗺️", who: "pix",
      step: "Steps 05–07 · Outline · Count · Choose", story: "Draw the lost patch, count the seeds and toilet-paper rolls, and choose native trees." },
    { n: 6, key: "fly", name: "Fly", label: "Drop, fly, regrow", color: "#2b7bd0", tint: "#e9f2fc", icon: "🚁", who: "koa",
      step: "Steps 08–09 · Drop · Fly · ↻ Regrow", story: "Predict where seeds land, fly the drone, and watch the forest and its animals come back." },
    { n: 7, key: "share", name: "Share", label: "Tell the world", color: "#5a6b7d", tint: "#eef1f4", icon: "🌐", who: "pix",
      step: "Share · GitHub", story: "Save the code on GitHub, let the robots test it, publish the website, and escape the server lab!" }
  ];
  var games = [
    // --- Base Camp
    { id: "g01", slug: "key-garden", chapter: 0, icon: "⌨️", title: "Key Garden", tagline: "Plant seeds with your fingers. Type fast, grow flowers!",
      skills: ["US QWERTY touch typing", "home row, top row, bottom row, numbers, symbols", "words per minute and accuracy", "typing Python words"],
      reseed: "You can run ReSeed by typing a command, e.g. `python -m reseed run rondonia`." },
    { id: "g02", slug: "build-a-bot", chapter: 0, icon: "🖥️", title: "Mo's Workshop", tagline: "Build a computer and run its busy kitchen.",
      skills: ["CPU, GPU, RAM, SSD, HDD, PSU, motherboard", "what each part is for", "parallel work on a GPU", "reading a spec sheet"],
      reseed: "ForestNet trains in about 12 minutes on one GPU (README)." },
    { id: "g03", slug: "os-install", chapter: 0, icon: "💿", title: "Operation Install", tagline: "Give your new computer a brain: install an operating system.",
      skills: ["operating systems: Ubuntu, Windows, RHEL", "bootable USB, BIOS/UEFI boot order", "disk partitions", "users and strong passwords", "package managers: apt, dnf, winget"],
      reseed: "ReSeed runs on Linux (Ubuntu) in GitHub Actions and on the project VM." },
    { id: "g04", slug: "driver-tower", chapter: 0, icon: "🗼", title: "Driver Tower", tagline: "Stack the blocks that wake up the graphics card.",
      skills: ["NVIDIA GPU driver", "CUDA toolkit and versions", "cuDNN", "PyTorch on GPU", "nvidia-smi"],
      reseed: "`reseed/classify/train.py` trains ForestNet with PyTorch on a CUDA GPU." },
    { id: "g05", slug: "potion-lab", chapter: 0, icon: "🧪", title: "Potion Lab", tagline: "Every project gets its own cauldron. Never spill into the base!",
      skills: ["Conda environments", "uv and venv", "pip install", "environment.yml", "version conflicts"],
      reseed: "`conda env create -f environment.yml && conda activate reseed`." },
    // --- See
    { id: "g06", slug: "satellite-snap", chapter: 1, icon: "🛰️", title: "Satellite Snap", tagline: "Fly satellites around the Earth and snap the forests.",
      skills: ["orbits and revisit time", "pixels and resolution (10 m vs 30 m)", "latitude and longitude", "Sentinel-2 and Landsat"],
      reseed: "`reseed/acquire.py` loads Sentinel-2 (10 m) and Landsat (30 m) pictures." },
    { id: "g07", slug: "cloud-sweeper", chapter: 1, icon: "🌥️", title: "Cloud Sweeper", tagline: "Stack cloudy photos and find the clear forest underneath.",
      skills: ["cloud masks", "median: sort and take the middle", "image compositing", "pixels as numbers"],
      reseed: "`acquire.py` hides cloudy pixels and keeps the median of up to 8 pictures." },
    { id: "g08", slug: "cloud-city", chapter: 1, icon: "☁️", title: "Cloud City", tagline: "Run a city of computers in the sky. Don't waste money!",
      skills: ["cloud computing: Azure, AWS, Google Cloud", "virtual machines, CPU vs GPU", "storage accounts and blob containers", "regions", "STAC catalogue search"],
      reseed: "Pictures come from Microsoft Planetary Computer (on Azure) via its STAC API." },
    { id: "g09", slug: "packet-post", chapter: 1, icon: "📦", title: "Packet Post", tagline: "Deliver picture parcels across the internet.",
      skills: ["packets", "TCP handshake, numbering and resending", "UDP for live video", "IP addresses, ports, DNS", "HTTP and HTTPS"],
      reseed: "`python -m reseed serve` answers on port 8000: /api/health, /api/classify." },
    // --- Check
    { id: "g10", slug: "tile-detective", chapter: 2, icon: "🧩", title: "Tile Detective", tagline: "Forest or not? Race the real ForestNet AI.",
      skills: ["images as tiles of pixels", "classification", "comparing a human with an AI", "the 1-in-4 rule"],
      reseed: "`classify/infer.py` scores every 64×64 tile; ForestNet also runs in the browser." },
    { id: "g11", slug: "brain-builder", chapter: 2, icon: "🧠", title: "Brain Builder", tagline: "Build a robot brain and teach it to spot forests.",
      skills: ["neurons, weights, bias", "layers: convolution, ReLU, pooling, dense", "training, loss, accuracy, epochs", "CPU vs GPU training"],
      reseed: "`classify/model.py`: ForestNet, 4 convolution blocks, about 215,000 parameters." },
    { id: "g12", slug: "llm-garage", chapter: 2, icon: "🤖", title: "Model Garage", tagline: "Park giant AI models in GPU garages.",
      skills: ["large language models and tokens", "GPU memory (VRAM)", "quantization (16-bit, 4-bit)", "vLLM vs llama.cpp", "serving many users"],
      reseed: "The demo server asks gpt-6-astra for a second opinion (`reseed/llm.py`)." },
    // --- Score
    { id: "g13", slug: "ndvi-goggles", chapter: 3, icon: "🥽", title: "NDVI Goggles", tagline: "See the invisible glow of healthy leaves.",
      skills: ["light spectrum: red and near-infrared", "the NDVI formula", "fractions and decimals", "health classes", "seasons as a wave"],
      reseed: "`reseed/ndvi.py`: NDVI = (NIR − Red) / (NIR + Red), health classes in `config.py`." },
    { id: "g14", slug: "spell-academy", chapter: 3, icon: "🪄", title: "Spell Academy", tagline: "Learn Professor Hoot's Python spells.",
      skills: ["Python syntax and indentation", "variables, numbers, strings", "functions and return", "if / elif / else", "for loops, lists, dicts", "classes and dataclasses"],
      reseed: "Real ReSeed functions: `ndvi()`, `health_class()`, `seeds_per_roll()`, `@dataclass Drone`." },
    // --- Decide
    { id: "g15", slug: "forest-detective", chapter: 4, icon: "🔎", title: "Forest Detective", tagline: "Solve 13 real cases: lost forest, or just winter?",
      skills: ["reading line and bar charts", "rules with thresholds", "if / elif decisions", "evidence from two clues"],
      reseed: "`reseed/detect.py`: drop ≥ 0.20 in two seasons + burn clue → RESEED." },
    // --- Plan
    { id: "g16", slug: "patch-painter", chapter: 5, icon: "🪣", title: "Patch Painter", tagline: "Find the lost patches and measure them.",
      skills: ["grids and thresholds", "flood fill algorithm", "area: pixels and hectares", "sorting", "splitting big jobs"],
      reseed: "`reseed/polygonize.py`: threshold → polygons, ranked by size, split over 50 ha." },
    { id: "g17", slug: "roll-factory", chapter: 5, icon: "🧻", title: "Roll Factory", tagline: "Fill toilet-paper rolls with seeds and plan the trips.",
      skills: ["volume of a cylinder", "multiplying and dividing", "rounding up (ceil)", "Python functions", "cost comparison"],
      reseed: "`reseed/logistics.py`: 159 mL rolls, seeds per roll, sorties, batteries, days." },
    { id: "g18", slug: "seed-library", chapter: 5, icon: "📚", title: "Seed Library", tagline: "Search the seed database for the right native trees.",
      skills: ["databases: tables, rows, columns, keys", "queries: SELECT, WHERE, ORDER BY", "JSON and Python dicts", "native vs non-native species"],
      reseed: "`reseed/species.py`: the BIOMES table of native seeds. Oak country gets acorns, never mango." },
    // --- Fly
    { id: "g19", slug: "seed-drop", chapter: 6, icon: "🌰", title: "Seed Drop", tagline: "Drop seeds in the wind and hit the patch.",
      skills: ["gravity and air drag", "terminal velocity", "wind and drift", "simulation step by step"],
      reseed: "`reseed/physics.py`: dv/dt = g − k|v−w|(v−w), four release modes." },
    { id: "g20", slug: "drone-academy", chapter: 6, icon: "🎓", title: "Drone Academy", tagline: "Earn your pilot wings: drone types, parts and moves.",
      skills: ["drone types: quad, hexa, octo, fixed-wing, VTOL, helicopter", "parts: motors, ESC, flight controller, GPS, LiPo", "throttle, yaw, pitch, roll", "pre-flight checklist and safety", "flight modes"],
      reseed: "`reseed/demo_flight.py`: arm, take off, GUIDED mode, jerk back, land." },
    { id: "g21", slug: "drone-rush", chapter: 6, icon: "🚁", title: "Drone Rush", tagline: "Fly the seed drone over wild hills. Don't crash!",
      skills: ["thrust, gravity, balance", "battery planning", "wind gusts", "return to launch"],
      reseed: "Drone endurance and payload come from `logistics.Drone`." },
    { id: "g22", slug: "mission-coder", chapter: 6, icon: "🧭", title: "Mission Coder", tagline: "Program the drone's flight path with code blocks.",
      skills: ["algorithms and loops", "lawnmower (serpentine) path", "GPS waypoints", "debugging"],
      reseed: "`reseed/mission.py`: lawnmower lines → .waypoints and .plan files." },
    { id: "g23", slug: "regrow-rescue", chapter: 6, icon: "🦜", title: "Regrow Rescue", tagline: "Years fly by. Type fast to help the animals come home.",
      skills: ["typing real words fast", "ecosystems and native animals", "NDVI rising over time", "biomes of the world"],
      reseed: "The 3D twin's time-lapse regrows the forest; animals come from `species.py`." },
    // --- Share
    { id: "g24", slug: "git-garden", chapter: 7, icon: "🌳", title: "Git Garden", tagline: "Grow a history tree with git, then publish a website.",
      skills: ["git commit, branch, push", "GitHub and GitHub Actions", "automatic tests", "HTML basics", "websites and hosting"],
      reseed: "`.github/workflows/pages.yml` publishes `site/` to khamydoan.github.io/reseed." },
    { id: "g25", slug: "lab-escape", chapter: 7, icon: "🏃", title: "Server Lab Escape", tagline: "The finale! Change the code to move the room, and rescue your friends.",
      skills: ["reading and changing Python code", "loops, conditions, lists, dicts", "ports and packets", "CPU, RAM, GPU, disk, network, database rooms"],
      reseed: "Each terminal runs a line inspired by real ReSeed code: `ndvi()`, `seeds_per_roll`, `sorted(patches)`, `BIOMES[...]`." }
  ];
  var byId = {};
  games.forEach(function (g, i) { g.order = i; byId[g.id] = g; byId[g.slug] = g; });
  RQ.catalog = {
    chapters: chapters,
    games: games,
    game: function (id) { return byId[id] || null; },
    chapter: function (n) { return chapters[n] || null; },
    inChapter: function (n) { return games.filter(function (g) { return g.chapter === n; }); },
    href: function (g, root) { return (root || "") + "games/" + g.slug + "/index.html"; }
  };
})();
