#!/usr/bin/env python3
"""
Traction Outsourcing — local static site builder.

Node/Eleventy isn't available in the environment this was authored in
(npm registry access is blocked), so this is a small Jinja2-based
equivalent: shared layout + partials in templates/, content kept as
JSON in content/ (never hand-duplicated across pages), and
`python3 build.py` renders everything to dist/ as plain static HTML,
CSS, and JS -- the same kind of output Eleventy would produce, and it
ships to GitHub Pages the same way the current site does.

Every page's content JSON carries its own "_route" block:
  { "template": "flex.html", "output": "services/foo/index.html", "url": "/services/foo/" }
build.py just scans content/pages/*.json and content/articles/*.json
and renders each through the template it names. Adding a new page is
"drop a JSON file in content/pages or content/articles" -- no code change.

Run:  python3 build.py
Then: python3 -m http.server -d dist 8080   (preview locally)
"""
import json
import shutil
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
DIST = ROOT / "dist"

env = Environment(loader=FileSystemLoader(str(ROOT / "templates")))


def load(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write(path: Path, html: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")
    print(f"  built {path.relative_to(DIST)}")


def render_json_page(json_path: Path):
    data = load(json_path)
    route = data.pop("_route", None)
    if route is None:
        raise ValueError(f"{json_path} is missing a _route block")
    tpl = env.get_template(route["template"])
    html = tpl.render(path=route["url"], **data)
    write(DIST / route["output"], html)


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    # ---- Static assets ----
    shutil.copytree(ROOT / "static" / "css", DIST / "css")
    shutil.copytree(ROOT / "static" / "js", DIST / "js")
    if (ROOT / "static" / "images").exists():
        shutil.copytree(ROOT / "static" / "images", DIST / "images", dirs_exist_ok=True)

    # ---- Every "page" json (home, services, founder, brands, partnerships,
    #      events, legal, etc.) is fully self-describing via _route ----
    pages_dir = CONTENT / "pages"
    if pages_dir.exists():
        for p in sorted(pages_dir.glob("*.json")):
            render_json_page(p)

    # ---- Articles index (search + filter) ----
    articles = load(CONTENT / "articles-index.json")
    categories = load(CONTENT / "categories.json")
    featured = next(a for a in articles if a.get("featured"))
    rest = [a for a in articles if not a.get("featured")]
    tpl = env.get_template("articles-index.html")
    html = tpl.render(
        path="/articles/",
        meta={
            "title": "Articles & Insights | Traction Outsourcing Limited",
            "description": "Read expert corporate advisory articles covering workforce management, business structuring, organogram development, and recruitment trends across Nigeria.",
        },
        articles=rest,
        featured=featured,
        categories=categories,
    )
    write(DIST / "articles/index.html", html)

    # ---- Search index (served as static JSON, fetched client-side) ----
    search_index = load(CONTENT / "search-index.json")
    write(DIST / "search-index.json", json.dumps(search_index, ensure_ascii=False))

    # ---- Every individual article json ----
    articles_dir = CONTENT / "articles"
    if articles_dir.exists():
        for p in sorted(articles_dir.glob("*.json")):
            render_json_page(p)

    print(f"\nBuild complete -> {DIST}")


if __name__ == "__main__":
    main()
