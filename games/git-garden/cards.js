/* Field Cards earned in Git Garden (g24). */
RQ.defineCards("g24", [
  { id: "git-commit", name: "Commit", icon: "🌳", cat: "web",
    text: "Saving a file is not a commit. A **commit** is a snapshot you choose to make, with a short message. Git gives it an ID like `e2ee761`, so you can always go back. First `git add` puts files in the basket.",
    reseed: "ReSeed's oldest commit is `c04a049` (\"ReSeed v2: satellite forest classifier…\"). Later ones fix bugs found in testing, like `9775fdf` (from `git log --oneline` of the reseed repo)." },
  { id: "git-branch", name: "Branch & merge", icon: "🌿", cat: "web",
    text: "A **branch** is a side path where you can try an idea safely. `git merge` joins it back into **main** when it works.",
    reseed: "ReSeed keeps its finished work on the `main` branch. Every push to `main` publishes the website (`.github/workflows/pages.yml`)." },
  { id: "git-push", name: "Push & GitHub", icon: "☁️", cat: "web",
    text: "`git push` copies your new commits from your computer to **GitHub**, a website that keeps code safe and lets people work on it together.",
    reseed: "ReSeed's code lives at github.com/khamydoan/reseed. Git calls that online copy `origin`." },
  { id: "ci-tests", name: "GitHub Actions tests", icon: "🤖", cat: "web",
    text: "**GitHub Actions** robots can run your tests when you push, if the project sets them up. Green ✓ means the checks passed; red ✗ means a check failed, from a code bug or a setup problem. (Game version: the NDVI bug here is pretend.)",
    reseed: "`.github/workflows/tests.yml` sets up Python 3.12 and Node 22, runs `python -m pytest -q`, then `node tests/js/forestnet.test.mjs` compares the JavaScript ForestNet (`site/js/forestnet.js`) with PyTorch reference answers." },
  { id: "html-tags", name: "HTML tags", icon: "🏷️", cat: "web",
    text: "Web pages are written in **HTML**. `<h1>` is a big heading, `<p>` a paragraph, `<img>` a picture and `<a href>` a link. Most tags open and close: `<p>…</p>`.",
    reseed: "ReSeed's Mission Control website is `site/index.html` plus JavaScript files like `site/js/app.js` (README)." },
  { id: "github-pages", name: "GitHub Pages & iframe", icon: "🪟", cat: "web",
    text: "**GitHub Pages** turns a folder of web files into a website at *name*.github.io. An `<iframe>` shows one web page inside another, like a picture frame.",
    reseed: "`pages.yml` publishes `site/` to khamydoan.github.io/reseed on every push to **main**, with no build step. README: \"also at airesearchcenter.com/reseed\"; its Google Sites section shows the iframe embed." }
]);
