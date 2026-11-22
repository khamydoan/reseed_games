/* Field Cards earned in Potion Lab (g05). */
RQ.defineCards("g05", [
  { id: "virtual-environment", name: "Virtual environment", icon: "🧪", cat: "python",
    text: "A **virtual environment** is a private cauldron for one project's libraries. Keeping libraries apart helps stop one project's updates from breaking another. (It is not a full sandbox: projects still share your files.)",
    reseed: "ReSeed brews in its own conda environment called `reseed` (see `environment.yml`)." },
  { id: "conda-env", name: "conda activate", icon: "🐍", cat: "python",
    text: "`conda create -n NAME` makes an environment and `conda activate NAME` steps into it. The prompt usually shows `(NAME)`. In this game, always activate **before** you `pip install`!",
    reseed: "README \"Run it\": `conda env create -f environment.yml && conda activate reseed`." },
  { id: "environment-yml", name: "environment.yml", icon: "📜", cat: "python",
    text: "A recipe file for a whole environment: its **name**, its **channels** (where conda shops) and its **dependencies**. One command follows the recipe on another computer, though versions can differ a little.",
    reseed: "`environment.yml`: name `reseed`, channel `conda-forge`, `python=3.12`, numpy, rasterio… plus pip extras like `torch` and `fastapi`." },
  { id: "uv-venv", name: "uv", icon: "⚡", cat: "python",
    text: "**uv** is a very fast Python tool. `uv venv` makes a `.venv` cauldron inside your project folder and `uv pip install` fills it. In a uv project, `uv add` also writes the library into `pyproject.toml`.",
    reseed: "ReSeed lists its libraries in `pyproject.toml` too (e.g. `numpy>=1.26`), so `pip install -e .[dev]` works as well." },
  { id: "python-venv", name: "venv", icon: "📁", cat: "python",
    text: "Python's built-in cauldron maker: `python -m venv .venv`. Step in with `source .venv/bin/activate`, step out with `deactivate`.",
    reseed: "`pyproject.toml` says ReSeed needs Python 3.11 or newer: `requires-python = \">=3.11\"`." },
  { id: "version-conflict", name: "Version conflict", icon: "💥", cat: "python",
    text: "Two libraries ask for versions that can't both be true, like **numpy<2** and **numpy>=2**. If the tools run separately, give each one its own environment. (game version: the two map tools are made up)",
    reseed: "ReSeed's `pyproject.toml` asks for `numpy>=1.26`: any numpy from 1.26 upward is allowed." }
]);
