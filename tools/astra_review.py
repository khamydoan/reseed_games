"""Ask gpt-6-astra to review each game's kid-facing text against the real ReSeed code.

    python tools/astra_review.py                 # all games -> docs/verification/astra/<slug>.json + summary.md
    python tools/astra_review.py seed-drop       # one game

The model sees: the catalogue entry, the Field Cards (cards.js), every speech line (from tools/voice.py's scanner),
the visible strings in game.js, and excerpts of the ReSeed files the game is about. It must quote evidence for
every factual objection. Fixes are applied by hand (or by an agent) afterwards.
"""
import concurrent.futures as cf
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import az  # noqa: E402
import voice  # noqa: E402

GAMES = pathlib.Path(__file__).resolve().parents[1]
REPO = GAMES.parent / "reseed"
OUT = GAMES / "docs/verification/astra"

EXCERPTS = {
    "key-garden": ["README.md#Run it"],
    "build-a-bot": ["README.md#Run it", "reseed/classify/model.py:30"],
    "os-install": [".github/workflows/tests.yml"],
    "driver-tower": ["reseed/classify/train.py:40", "README.md#Run it"],
    "potion-lab": ["environment.yml", "pyproject.toml", "README.md#Run it"],
    "satellite-snap": ["reseed/acquire.py:60", "reseed/config.py:120"],
    "cloud-sweeper": ["reseed/acquire.py:200"],
    "cloud-city": ["reseed/acquire.py:80", "reseed/llm.py:40", "reseed/config.py:20"],
    "packet-post": ["reseed/server.py:80", "README.md#Run it"],
    "tile-detective": ["reseed/classify/infer.py:60", "reseed/pipeline.py:grep:forest", "README.md#Results"],
    "brain-builder": ["reseed/classify/model.py:80", "reseed/classify/train.py:40", "README.md#Results"],
    "llm-garage": ["reseed/llm.py:80", "reseed/server.py:60"],
    "ndvi-goggles": ["reseed/ndvi.py:40", "reseed/config.py:40"],
    "spell-academy": ["reseed/ndvi.py:30", "reseed/logistics.py:60", "reseed/species.py:40"],
    "forest-detective": ["reseed/detect.py:130", "reseed/config.py:45", "reseed/pipeline.py:grep:RECOVER", "README.md#Results"],
    "patch-painter": ["reseed/polygonize.py:60", "reseed/config.py:45"],
    "roll-factory": ["reseed/logistics.py:140", "README.md#Results"],
    "seed-library": ["reseed/species.py:200"],
    "seed-drop": ["reseed/physics.py:70"],
    "drone-academy": ["reseed/demo_flight.py:60", "reseed/logistics.py:40"],
    "drone-rush": ["reseed/logistics.py:40"],
    "mission-coder": ["reseed/mission.py:60", "reseed/demo_flight.py:40"],
    "regrow-rescue": ["reseed/species.py:200", "README.md#How it works"],
    "git-garden": [".github/workflows/tests.yml", ".github/workflows/pages.yml", "README.md#The website"],
    "lab-escape": ["reseed/ndvi.py:30", "reseed/logistics.py:40", "reseed/polygonize.py:30"],
}


def excerpt(spec):
    if "#" in spec:
        rel, head = spec.split("#", 1)
        text = (REPO / rel).read_text()
        i = text.find("## " + head)
        return f"=== {rel} ({head}) ===\n" + (text[i:i + 3500] if i >= 0 else text[:2500])
    if ":grep:" in spec:
        rel, word = spec.split(":grep:")
        lines = (REPO / rel).read_text().splitlines()
        keep = [f"{n + 1}: {l}" for n, l in enumerate(lines) if word.lower() in l.lower()]
        return f"=== {rel} (lines with '{word}') ===\n" + "\n".join(keep[:60])
    rel, _, n = spec.partition(":")
    lines = (REPO / rel).read_text().splitlines()
    return f"=== {rel} (first {n or 'all'} lines) ===\n" + "\n".join(lines[:int(n)] if n else lines)


def visible_strings(src):
    """String literals that look like kid-facing text (have a space and a letter)."""
    out = []
    for m in re.finditer(r'"((?:\\.|[^"\\\n]){12,})"', src):
        s = m.group(1)
        if " " in s and re.search(r"[A-Za-z]{3}", s) and not re.match(r"^[\w\-.:#/ ]+\{", s) and "px" not in s[:12]:
            out.append(s)
    return out


ASK = """You are reviewing one minigame of "ReSeed Quest", browser games for kids aged 8-12 (US grades 3-7) that follow a
student's real project, ReSeed (satellites find lost forest, drones plant it back), and quietly teach computer science.
You get (A) the game's catalogue entry, (B) its Field Cards, (C) its speech lines, (D) other visible strings from the
code, and (E) excerpts of the real ReSeed code and README.

Answer ONLY with JSON:
{"factual_issues":[{"where":"card id / line start / string start","claim":"...","problem":"...","evidence":"quote from E or well-known fact","fix":"exact replacement text"}],
 "general_cs_errors":[{"where":"...","claim":"...","problem":"what is technically wrong for real computers/networks/drones/biology","fix":"exact replacement text"}],
 "hard_for_8yo":[{"where":"...","text":"...","simpler":"exact replacement text"}],
 "safety_or_tone":[{"where":"...","problem":"...","fix":"..."}],
 "verdict":"one sentence"}

Rules: report a ReSeed factual issue only if (E) contradicts the text or clearly does not support a claim presented as
ReSeed's; quote the evidence. Report a general CS error only when it is actually wrong (not just simplified); simplified
statements labelled "game version" are fine. Keep each list to the most important items (max 8 each). Replacement text
must keep the same tone and length."""


def review(slug):
    d = GAMES / "games" / slug
    cat = (GAMES / "js/catalog.js").read_text()
    m = re.search(r'\{ id: "g\d\d", slug: "' + slug + r'".*?\n\s*reseed: "[^"]*" \}', cat, re.S)
    lines = voice.find_lines(f"games/{slug}/")
    game_src = (d / "game.js").read_text()
    body = ["=== (A) catalogue ===", m.group(0) if m else slug,
            "=== (B) cards.js ===", (d / "cards.js").read_text(),
            "=== (C) speech lines ===", "\n".join(f"[{l['who']}] {l['text']}" for l in lines.values()),
            "=== (D) other visible strings ===", "\n".join(sorted(set(visible_strings(game_src))))[:14000],
            "=== (E) ReSeed excerpts ==="] + [excerpt(s) for s in EXCERPTS.get(slug, [])]
    text = "\n".join(body)
    raw = az.respond("gpt-6-astra", text, instructions=ASK, reasoning={"effort": "medium"})
    j = raw[raw.find("{"): raw.rfind("}") + 1]
    try:
        data = json.loads(j)
    except json.JSONDecodeError:
        data = {"unparsed": raw}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{slug}.json").write_text(json.dumps(data, indent=1, ensure_ascii=False))
    return slug, data


def main():
    slugs = sys.argv[1:] or re.findall(r'slug: "([a-z0-9-]+)"', (GAMES / "js/catalog.js").read_text())
    results = {}
    with cf.ThreadPoolExecutor(6) as ex:
        for fut in cf.as_completed([ex.submit(review, s) for s in slugs]):
            try:
                slug, data = fut.result()
                results[slug] = data
                n = sum(len(data.get(k, [])) for k in ("factual_issues", "general_cs_errors", "hard_for_8yo", "safety_or_tone"))
                print(f"{slug:18} {n:3} notes  {data.get('verdict', '')[:110]}", flush=True)
            except Exception as e:
                print("FAILED", e, flush=True)
    if len(slugs) > 1:
        md = ["# gpt-6-astra content review", ""]
        for slug in slugs:
            data = results.get(slug, {})
            md.append(f"## {slug}\n\n{data.get('verdict', '')}\n")
            for k in ("factual_issues", "general_cs_errors", "hard_for_8yo", "safety_or_tone"):
                for it in data.get(k, []):
                    md.append(f"- **{k}** · {it.get('where', '')}: {it.get('problem') or it.get('text', '')} → {it.get('fix') or it.get('simpler', '')}")
            md.append("")
        (OUT / "summary.md").write_text("\n".join(md))


if __name__ == "__main__":
    main()
