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
import re
import shutil
from datetime import datetime
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
DIST = ROOT / "dist"

SITE_NAME = "Traction Outsourcing Limited"
SITE_URL = "https://tolnigeria.com"
SITE_LOGO = "https://tolnigeria.com/images/traction-outsourcing-logo.png"

# Top-level URL segments that get a named breadcrumb crumb pointing at a
# real page. Segments not listed here (e.g. "brands", which has no /brands/
# index) are simply skipped rather than guessed at -- pages under them can
# still supply their own more specific BreadcrumbList via "schema" if the
# 2-level Home > Leaf default isn't descriptive enough.
BREADCRUMB_SECTIONS = {
    "articles": ("Articles", "/articles/"),
    "services": ("Our Services", "/"),
    "partnerships": ("Partnerships", "/partnerships/"),
    "events": ("Events", "/events/"),
}

MINOR_WORDS = {"a", "an", "the", "in", "of", "for", "and", "to", "on", "at", "&"}

env = Environment(loader=FileSystemLoader(str(ROOT / "templates")))
env.filters["tojson"] = lambda obj: json.dumps(obj, indent=2, ensure_ascii=False)


def load(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def slug_to_title(slug: str) -> str:
    words = slug.split("-")
    out = []
    for i, w in enumerate(words):
        out.append(w if (w in MINOR_WORDS and i != 0) else w.capitalize())
    return " ".join(out)


def build_website_schema():
    return {"@context": "https://schema.org", "@type": "WebSite", "name": SITE_NAME, "url": SITE_URL + "/"}


def build_breadcrumb_schema(route):
    url = route["url"]
    segments = [s for s in url.split("/") if s]
    if not segments:
        return None  # homepage -- no breadcrumb needed

    items = [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL + "/"}]
    position = 2
    for seg in segments[:-1]:
        mapping = BREADCRUMB_SECTIONS.get(seg)
        if not mapping:
            continue
        label, path = mapping
        items.append({"@type": "ListItem", "position": position, "name": label, "item": SITE_URL + path})
        position += 1

    items.append({
        "@type": "ListItem",
        "position": position,
        "name": slug_to_title(segments[-1]),
        "item": SITE_URL + url,
    })
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}


def parse_byline_date(date_str):
    """'July 27, 2026' -> '2026-07-27'. Returns None if unparsable."""
    try:
        return datetime.strptime(date_str, "%B %d, %Y").strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def build_article_schema(data, route):
    """Auto-derive Article JSON-LD for every article.html page from fields
    already authored on the page (title, dek, byline, image) -- no manual
    schema authoring needed per article."""
    byline = data.get("byline", {})
    date = parse_byline_date(byline.get("date"))
    image = data.get("image") or data.get("meta", {}).get("image")
    if image and image.startswith("/"):
        image = SITE_URL + image

    schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": data.get("title") or data.get("meta", {}).get("title"),
        "description": data.get("meta", {}).get("description") or data.get("dek"),
        "url": SITE_URL + route["url"],
        "mainEntityOfPage": SITE_URL + route["url"],
        "publisher": {"@type": "Organization", "name": SITE_NAME, "logo": {"@type": "ImageObject", "url": SITE_LOGO}},
        "author": {"@type": "Organization", "name": byline.get("author") or SITE_NAME},
    }
    if image:
        schema["image"] = image
    if date:
        schema["datePublished"] = date
        schema["dateModified"] = date
    return schema


def build_faqpage_schema(data):
    """Auto-derive FAQPage JSON-LD from any 'faq' sections already on the
    page (flex.html's sections list), or a top-level "faq": {"entries": []}
    block (article.html's pattern), so FAQ structured data never has to be
    hand-duplicated and can never drift from what's actually visible."""
    entries = []
    for sec in data.get("sections", []):
        if sec.get("type") == "faq":
            entries.extend(sec.get("entries", []))
    entries.extend(data.get("faq", {}).get("entries", []))
    if not entries:
        return None
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": e["q"],
                "acceptedAnswer": {"@type": "Answer", "text": e["a"]},
            }
            for e in entries
        ],
    }


def write(path: Path, html: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")
    print(f"  built {path.relative_to(DIST)}")


# GitHub Pages serves static files only -- there is no server-side 301, so a
# retired/duplicate URL gets this instead: a real (thin) page at the old
# path with a self-referencing canonical pointing at the new URL, noindex so
# Google drops the old URL from its index, and a meta-refresh + visible link
# so any visitor or crawler that doesn't honor those still lands on the
# current page. Add an entry here whenever a URL is merged into another one.
REDIRECTS = {
    # old output path (relative to dist/) -> new absolute URL path
    "articles/article-tall-poppy-syndrome/index.html": "/articles/tall-poppy-syndrome/",
    "founder/index.html": "/",
}


def build_redirect_page(old_output: str, new_url: str):
    dest = SITE_URL + new_url
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{SITE_NAME}</title>
  <link rel="canonical" href="{dest}">
  <meta name="robots" content="noindex,follow">
  <meta http-equiv="refresh" content="0; url={dest}">
</head>
<body>
  <p>This page has moved. <a href="{dest}">Continue to the current page</a>.</p>
</body>
</html>
"""
    write(DIST / old_output, html)


def render_json_page(json_path: Path):
    data = load(json_path)
    route = data.pop("_route", None)
    if route is None:
        raise ValueError(f"{json_path} is missing a _route block")

    # Any page can carry a top-level "schema" array of raw schema.org
    # objects (Event, LocalBusiness, Service, Person, etc.) in its content
    # JSON; base.html renders each as its own <script
    # type="application/ld+json">. On top of whatever a page supplies by
    # hand, every page automatically gets: a WebSite block, a BreadcrumbList
    # derived from its URL, an Article block if it's rendered through
    # article.html, and a FAQPage block if it has FAQ content -- each only
    # added when the page hasn't already supplied that @type itself, so
    # nothing is ever duplicated.
    schema = list(data.pop("schema", []))
    existing_types = set()
    for s in schema:
        t = s.get("@type")
        if isinstance(t, list):
            existing_types.update(t)
        elif t:
            existing_types.add(t)

    if "WebSite" not in existing_types:
        schema.append(build_website_schema())

    if "BreadcrumbList" not in existing_types:
        breadcrumb = build_breadcrumb_schema(route)
        if breadcrumb:
            schema.append(breadcrumb)

    if route["template"] == "article.html" and "Article" not in existing_types:
        schema.append(build_article_schema(data, route))

    if "FAQPage" not in existing_types:
        faqpage = build_faqpage_schema(data)
        if faqpage:
            schema.append(faqpage)

    tpl = env.get_template(route["template"])
    html = tpl.render(path=route["url"], schema=schema, **data)
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
    if (ROOT / "static" / "downloads").exists():
        shutil.copytree(ROOT / "static" / "downloads", DIST / "downloads", dirs_exist_ok=True)

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
    articles_meta = {
        "title": "Articles & Insights | Traction Outsourcing Limited",
        "description": "Read expert corporate advisory articles covering workforce management, business structuring, organogram development, and recruitment trends across Nigeria.",
        "image_alt": "Traction Outsourcing Limited team headshots beside the company logo and the tagline Built by Africans, for Africa.",
    }
    articles_route = {"url": "/articles/"}
    articles_schema = [
        build_website_schema(),
        build_breadcrumb_schema(articles_route),
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Insights & Articles | Traction Outsourcing Limited",
            "description": articles_meta["description"],
            "url": SITE_URL + "/articles/",
            "publisher": {"@type": "Organization", "name": SITE_NAME, "url": SITE_URL + "/"},
            "image": SITE_URL + "/images/traction-opengraph.png",
        },
    ]
    tpl = env.get_template("articles-index.html")
    html = tpl.render(
        path="/articles/",
        meta=articles_meta,
        articles=rest,
        featured=featured,
        categories=categories,
        schema=articles_schema,
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

    # ---- Redirect stubs for retired/merged URLs ----
    for old_output, new_url in REDIRECTS.items():
        build_redirect_page(old_output, new_url)

    print(f"\nBuild complete -> {DIST}")


if __name__ == "__main__":
    main()
