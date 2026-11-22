"""Tiny Markdown -> HTML for the playbook (stdlib only; the subset the playbook uses).

    python kit/tools/md_to_html.py "How-it-was-built_ReSeed-Pitch-Pack-Playbook.md"

Handles: YAML front matter (skipped), # headings (with ids), paragraphs, - / 1. lists, | tables |,
``` fences, > quotes (incl. > [!tip] callouts), **bold**, *italic*, `code`, [links](url), ![images](src).
"""
import html
import pathlib
import re
import sys

CSS = """body{font:16px/1.65 "Segoe UI",Inter,-apple-system,Arial,sans-serif;color:#24364b;max-width:980px;margin:0 auto;padding:30px 22px 70px;background:#fbfcfd}
h1{font-size:32px;letter-spacing:-.6px}h2{font-size:23px;margin-top:38px;border-top:1px solid #e1e7ed;padding-top:22px}h3{font-size:18px;margin-top:26px}
code{font:13.5px Consolas,"Cascadia Code",monospace;background:#eef2f6;border-radius:4px;padding:1px 4px}pre{background:#0f2236;color:#e6edf3;border-radius:10px;padding:14px 16px;overflow:auto}pre code{background:none;color:inherit;padding:0}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:14px}th,td{border:1px solid #e1e7ed;padding:7px 9px;text-align:left;vertical-align:top}th{background:#f3f6f9}
blockquote{margin:14px 0;padding:10px 16px;background:#eef8f1;border-left:4px solid #2f9e4f;border-radius:6px}img{max-width:100%;border:1px solid #e1e7ed;border-radius:10px}
a{color:#2f6fae}li{margin:3px 0}"""


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", lambda m: f"<code>{m.group(1)}</code>", s)
    s = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", r'<img alt="\1" src="\2">', s)
    s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<i>\1</i>", s)
    return s


def convert(md):
    if md.startswith("---"):
        md = md.split("\n---", 1)[1].split("\n", 1)[1]
    lines, out, i = md.split("\n"), [], 0
    while i < len(lines):
        l = lines[i]
        if l.startswith("```"):
            j = i + 1
            while j < len(lines) and not lines[j].startswith("```"):
                j += 1
            out.append("<pre><code>" + html.escape("\n".join(lines[i + 1:j])) + "</code></pre>")
            i = j + 1
            continue
        m = re.match(r"(#{1,4}) (.*)", l)
        if m:
            t = m.group(2)
            slug = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
            out.append(f'<h{len(m.group(1))} id="{slug}">{inline(t)}</h{len(m.group(1))}>')
            i += 1
            continue
        if l.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            head, body = rows[0], [r for r in rows[1:] if not re.match(r"^:?-{2,}", r[0] or "--")]
            out.append("<table><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr>" +
                       "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body) + "</table>")
            continue
        if re.match(r"\s*([-*]|\d+\.) ", l):
            tag = "ol" if re.match(r"\s*\d+\. ", l) else "ul"
            items = []
            while i < len(lines) and re.match(r"\s*([-*]|\d+\.) ", lines[i]):
                items.append(re.sub(r"\s*([-*]|\d+\.) ", "", lines[i], count=1))
                i += 1
                while i < len(lines) and lines[i].startswith("  ") and lines[i].strip() and not re.match(r"\s*([-*]|\d+\.) ", lines[i]):
                    items[-1] += " " + lines[i].strip()
                    i += 1
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
            continue
        if l.startswith(">"):
            q = []
            while i < len(lines) and lines[i].startswith(">"):
                q.append(re.sub(r"^>\s?", "", lines[i]))
                i += 1
            text = " ".join(q)
            text = re.sub(r"^\[!(\w+)\]\s*", lambda m: f"<b>{m.group(1).capitalize()}.</b> ", text)
            out.append(f"<blockquote>{inline(text).replace('&lt;b&gt;', '<b>').replace('&lt;/b&gt;', '</b>')}</blockquote>")
            continue
        if l.strip():
            p = [l]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r"(#{1,4} |\||```|>|\s*([-*]|\d+\.) )", lines[i]):
                p.append(lines[i])
                i += 1
            out.append(f"<p>{inline(' '.join(p))}</p>")
            continue
        i += 1
    return "\n".join(out)


if __name__ == "__main__":
    src = pathlib.Path(sys.argv[1])
    body = convert(src.read_text(encoding="utf-8"))
    title = re.search(r"<h1[^>]*>(.*?)</h1>", body)
    doc = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
           f'<title>{re.sub("<[^>]+>", "", title.group(1)) if title else src.stem}</title><style>{CSS}</style></head><body>{body}</body></html>')
    src.with_suffix(".html").write_text(doc, encoding="utf-8")
    print("wrote", src.with_suffix(".html").name)
