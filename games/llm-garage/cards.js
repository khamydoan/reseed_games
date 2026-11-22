/* Field Cards earned in Model Garage (g12). */
RQ.defineCards("g12", [
  { id: "token", name: "Token", icon: "🧩", cat: "ai",
    text: "Language models read text in small chunks called **tokens**, and every token is really a number. Common words are one token; long or made-up words get chopped into pieces. (game version: real tokenizers also glue spaces onto words)",
    reseed: "`reseed/llm.py` sends gpt-6-astra a written question (`CLASSIFY_PROMPT`) plus the picture, and asks for a JSON answer with `is_forest` and `confidence`." },
  { id: "gpu-memory", name: "GPU memory (VRAM)", icon: "💾", cat: "hardware",
    text: "**Weight memory = number of settings × bytes per setting**: 8 billion × 2 bytes = 16 GB, plus room for the KV cache. The project's computer has 4 × A100 GPUs with 80 GB each (nvidia-smi). (game version: weights must fit in GPUs; real setups can also use CPU memory, offloading or several GPUs)",
    reseed: "gpt-6-astra runs on Azure's computers, not ours: `reseed/llm.py` just sends the question and picture over the internet, with a key kept in `.env`." },
  { id: "quantization", name: "Quantization", icon: "🗜️", cat: "ai",
    text: "Use fewer **bits** (the computer's tiny 0s and 1s) for each number: 16 bits = 2 bytes, 8 bits = 1 byte, 4 bits = half a byte. Weights get up to 4 × smaller, but answers may get worse. How much depends on the model and method, so test it!",
    reseed: "`reseed/classify/export.py` saves ForestNet's weights as float16 for the website and writes `tests/fixtures/forestnet_vectors.json`; `tests/js/forestnet.test.mjs` checks the browser's answers against them." },
  { id: "vllm", name: "vLLM", icon: "🍽️", cat: "ai",
    text: "Software that runs AI models on big server GPUs. Like a restaurant kitchen, it **batches** many people's requests and cooks them together. Start it with `vllm serve <model>`.",
    reseed: "ReSeed's own demo server is FastAPI: `python -m reseed serve` (`reseed/__main__.py`, README) answers on port 8000. It sends gpt-6-astra one paid question at a time, at least 2 s apart (`reseed/server.py`)." },
  { id: "llama-cpp", name: "llama.cpp & GGUF", icon: "🚚", cat: "ai",
    text: "**GGUF** is a file format for AI models. llama.cpp runs a GGUF model that fits your computer, on a laptop CPU or small GPU, even with no internet. Start it with `llama-server -m model.gguf`.",
    reseed: "On demo day the ReSeed site is served from the laptop, and everything is bundled, so it works without internet (README, Demo day)." },
  { id: "kv-cache", name: "KV cache & out of memory", icon: "🚨", cat: "ai",
    text: "While it reads and chats, a model keeps notes on every token: the **KV cache**. Too many notes, and: CUDA out of memory! Fixes: less text to remember, 4-bit, a smaller model or a bigger GPU. (game version)",
    reseed: "`reseed/server.py` calls `rgb.thumbnail((1024, 1024))` to shrink each picture before `llm.classify_image` asks gpt-6-astra." }
]);
