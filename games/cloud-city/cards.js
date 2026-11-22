/* Field Cards earned in Cloud City (g08). Prices in the game are round "game version" numbers, not real price lists. */
RQ.defineCards("g08", [
  { id: "cloud-vm", name: "Virtual machine (VM)", icon: "🖥️", cat: "cloud",
    text: "A **virtual machine** is a computer you rent inside a cloud data centre (Azure, AWS or Google Cloud). A few **CPU** cores are fine for simple maths; a **GPU** is for training AI. You pay for every hour it runs.",
    reseed: "`ndvi()` in `reseed/acquire.py` is simple maths per pixel: (NIR − Red) / (NIR + Red). Training ForestNet (`reseed/classify/train.py`) runs on a GPU: about 12 minutes on one GPU (README.md, \"Retrain ForestNet\")." },
  { id: "cloud-region", name: "Cloud region", icon: "📍", cat: "cloud",
    text: "A cloud is real buildings in real places called **regions**, like Azure West Europe or East US. Rent your computer **close to the data** and downloads are fast. (Game version: in this game the picture store sits in West Europe, and times are simplified.)",
    reseed: "`catalog()` in `reseed/acquire.py` opens the Planetary Computer catalogue at `PC_STAC_URL` (`reseed/config.py`); `load_sentinel2()` then streams the pictures from the cloud." },
  { id: "cloud-deallocate", name: "Stop (deallocate)", icon: "⏹️", cat: "cloud",
    text: "**Deallocating** a VM hands the computer back, so the hourly compute bill stops. Just shutting it down from inside may not stop that bill. Its disk keeps your files, so storage still costs a little.",
    reseed: "Once ForestNet is trained, the result is one small file, `models/forestnet.pt` (`MODEL_PATH` in `reseed/config.py`). The GPU can stop." },
  { id: "cloud-blob", name: "Blob storage (boxes in boxes)", icon: "📦", cat: "cloud",
    text: "A **blob** is one file. It sits in a **container** (a box) inside a **storage account** (the warehouse). AWS S3 and Google Cloud Storage use a **bucket**. Tiers: **hot** (read often), **cool**, **archive** (cheapest, but hours to wake up).",
    reseed: "`catalog()` in `reseed/acquire.py` uses `planetary_computer.sign_inplace`, which adds a pass to each picture link so ReSeed may download it from the cloud store." },
  { id: "cloud-stac", name: "STAC catalogue", icon: "🗂️", cat: "data",
    text: "**STAC** is a searchable list of satellite pictures. You ask: **where?** (a box on the map), **when?** (dates) and **how cloudy?** The code calls cloudiness `eo:cloud_cover`.",
    reseed: "`search()` in `reseed/acquire.py` asks the Planetary Computer STAC API (`PC_STAC_URL` in `reseed/config.py`) for scenes with `eo:cloud_cover` below a limit, then sorts them clearest first." },
  { id: "cloud-ai-key", name: "Cloud AI and API keys", icon: "🔑", cat: "cloud",
    text: "Big AI models run in the cloud. Your program sends a question with a secret **API key**. Keep the key on your server: anything inside a web page, anyone can read.",
    reseed: "`reseed/llm.py` asks Azure OpenAI (`gpt-6-astra`) for a second opinion. The key is read from `.env` on the server and never sent to the browser." }
]);
