"""Static checks for ReSeed Quest (no browser needed). Exit 1 on any problem.

    python tools/check_static.py

Checks: every catalog game has index.html + game.js + cards.js; pages use relative classic scripts only (no modules,
no fetch, no CDN); RQ.game id matches the catalog; Field Card ids are unique and every level's `cards: [...]` exists;
all JS parses (node); no secrets; reports the size of each game.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATS = {"keyboard", "hardware", "os", "python", "ai", "cloud", "network", "space", "forest", "drone", "math", "data", "web", "algo"}


def main():
    problems = []
    cat_src = (ROOT / "js/catalog.js").read_text()
    games = re.findall(r'\{ id: "(g\d\d)", slug: "([a-z0-9-]+)"', cat_src)
    all_cards = {}
    sizes = []
    for gid, slug in games:
        d = ROOT / "games" / slug
        for f in ("index.html", "game.js", "cards.js"):
            if not (d / f).exists():
                problems.append(f"{slug}: missing {f}")
        if not (d / "game.js").exists():
            continue
        html = (d / "index.html").read_text() if (d / "index.html").exists() else ""
        if 'type="module"' in html:
            problems.append(f"{slug}: module script in index.html")
        for src in re.findall(r'(?:src|href)="([^"]+)"', html):
            if src.startswith(("http:", "https:", "//", "/")):
                problems.append(f"{slug}: external/absolute reference {src}")
            elif not (d / src).resolve().exists():
                problems.append(f"{slug}: missing file {src}")
        for need in ("../../js/rq.js", "../../js/catalog.js", "../../js/chars.js", "cards.js", "game.js"):
            if need not in html:
                problems.append(f"{slug}: index.html does not load {need}")
        js_files = sorted(d.glob("*.js"))
        for jf in js_files:
            src = jf.read_text()
            if re.search(r"^\s*(import|export)\s", src, re.M):
                problems.append(f"{slug}/{jf.name}: ES module syntax")
            if re.search(r"\bfetch\(|XMLHttpRequest", src):
                problems.append(f"{slug}/{jf.name}: fetch/XHR (breaks file://)")
        game = (d / "game.js").read_text()
        m = re.search(r'RQ\.game\(\{\s*id:\s*"(g\d\d)"', game)
        if not m or m.group(1) != gid:
            problems.append(f"{slug}: RQ.game id should be {gid} (found {m.group(1) if m else 'none'})")
        cards_src = (d / "cards.js").read_text() if (d / "cards.js").exists() else ""
        if f'RQ.defineCards("{gid}"' not in cards_src and f"RQ.defineCards('{gid}'" not in cards_src:
            problems.append(f"{slug}: cards.js should call RQ.defineCards(\"{gid}\", …)")
        for cid, ccat in re.findall(r'id:\s*"([a-z0-9-]+)"[^}]*?cat:\s*"(\w+)"', cards_src, re.S):
            if cid in all_cards:
                problems.append(f"{slug}: card id '{cid}' also used by {all_cards[cid]}")
            all_cards[cid] = slug
            if ccat not in CATS:
                problems.append(f"{slug}: card '{cid}' has unknown cat '{ccat}'")
        for lst in re.findall(r"cards:\s*\[([^\]]*)\]", game):
            for cid in re.findall(r'"([a-z0-9-]+)"', lst):
                if cid not in all_cards or all_cards[cid] != slug:
                    if not re.search(r'id:\s*"' + re.escape(cid) + '"', cards_src):
                        problems.append(f"{slug}: level gives card '{cid}' that cards.js does not define")
        size = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
        lines = sum(len(f.read_text().splitlines()) for f in js_files)
        sizes.append((slug, size, lines))

    # Regression: ISSUE-001 — parents.html linked to docs/HOW-IT-WAS-MADE.html before it existed (404)
    # Found by /qa on 2026-11-22
    # Report: docs/verification/qa-report-localhost-2026-11-22.md
    for page in ("index.html", "parents.html"):
        html = re.sub(r"<script>.*?</script>", "", (ROOT / page).read_text(), flags=re.S)  # markup only
        for ref in re.findall(r'(?:src|href)="([^"#?]+)', html):
            if ref.startswith(("http:", "https:", "//", "mailto:")):
                continue
            if not (ROOT / ref).exists():
                problems.append(f"{page}: link to missing file {ref}")

    node = shutil.which("node")
    if node:
        js = [p for p in ROOT.rglob("*.js") if "node_modules" not in p.parts and ".git" not in p.parts]
        for p in js:
            r = subprocess.run([node, "-e", "new (require('vm').Script)(require('fs').readFileSync(process.argv[1],'utf8'))", str(p)],
                               capture_output=True, text=True)
            if r.returncode:
                problems.append(f"{p.relative_to(ROOT)}: JS syntax error: {next((l for l in r.stderr.splitlines() if 'Error' in l), r.stderr[:200])[:200]}")
    else:
        print("node not found: skipped JS syntax check")

    secret = re.compile(r"(api-key[\"']?\s*[:=]\s*[\"'][A-Za-z0-9]{20,}|AZURE_OPENAI_API_KEY\s*=\s*\S{20,}|sk-[A-Za-z0-9]{20,})")
    for p in ROOT.rglob("*"):
        if p.is_file() and p.suffix in {".js", ".html", ".py", ".md", ".json", ".yml", ".txt"} and ".git" not in p.parts:
            if secret.search(p.read_text(errors="ignore")):
                problems.append(f"{p.relative_to(ROOT)}: looks like a secret")

    for slug, size, lines in sizes:
        print(f"  {slug:18} {size / 1024:8.0f} KB  {lines:6} JS lines")
    print(f"{len(games)} games, {len(all_cards)} Field Cards")
    for p in problems:
        print("PROBLEM:", p)
    print(json.dumps({"problems": len(problems)}))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
