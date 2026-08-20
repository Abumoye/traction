# Source — how the live site gets built

This folder is the source of truth for tolnigeria.com's Apple-inspired design:
light ash/white palette, dark-orange brand accent (plus distinct navy/purple
accents on the two sub-brand pages), glass navigation, full-text article
search. Everything **outside** this `source/` folder (`index.html`,
`articles/`, `services/`, `css/`, etc. at the repo root) is *generated* —
GitHub Pages serves those files directly, but they are rebuilt automatically
from here, so don't hand-edit them; edit the JSON/templates in `source/`
instead.

## How publishing works

`.github/workflows/build-and-deploy.yml` watches for pushes to `main` that
touch anything under `source/`. On a matching push it runs `build.py`,
copies the output over the site folders at the repo root, and commits that
back to `main` — which is what GitHub Pages actually deploys. So the loop
is: edit a file in `source/content/` → commit & push to `main` → the bot
commit appears a minute or two later → tolnigeria.com updates.

You can also trigger a rebuild manually from the Actions tab
("Build site from source and publish" → Run workflow) if you want to force
a republish without changing anything.

## Why Python instead of Eleventy/Node

The environment this was built in couldn't reach the npm registry, so instead
of Eleventy this uses a small Jinja2-based static site generator (`build.py`)
that does the same job: shared layout + templates, JSON content files, output
to `dist/` as plain static HTML/CSS/JS. If you have Node available locally and
want to port this to real Eleventy later, the templates/content split makes
that a mechanical port, not a redesign.

## Requirements

- Python 3.9+
- `pip install jinja2 beautifulsoup4 lxml`

## Build

```
python3 build.py
```

Renders every page in `content/pages/*.json` and `content/articles/*.json`
into `dist/`. Re-run this after editing any content JSON or template.

## Preview locally

```
python3 -m http.server -d dist 8080
```

Then open http://localhost:8080 in your browser.

## Project structure

- `templates/` — Jinja2 templates. `base.html` is the shared shell (nav +
  footer). `flex.html` is a generic page template (services, founder, brands,
  partnerships, events, etc.) built from an ordered list of typed "sections"
  (text, grid, steps, image-text, logos, quote, cta, faq, form, raw-text) —
  read the top of the file for the full list. `article.html` is for blog
  articles. `legal.html` is for the privacy policy. `home.html` and
  `service.html` are two more specific templates used by the homepage and the
  Staff Outsourcing page (the first two pages built, before `flex.html` was
  generalized).
- `content/pages/*.json` — one file per non-article page. Every file starts
  with a `"_route"` block naming its template, output path, and URL.
- `content/articles/*.json` — one file per article, same `_route` pattern,
  rendered through `article.html`.
- `content/articles-index.json` / `content/search-index.json` /
  `content/categories.json` — power the `/articles/` grid and the live search
  box (search-index.json holds full article body text for full-text search).
- `static/` — CSS, JS, and images, copied into `dist/` as-is on build.
- `dist/` — build output. This is what you'd deploy to GitHub Pages (same
  static-file setup the live site already uses — a CNAME file and a straight
  copy of `dist/`'s contents to the repo root, or point GitHub Pages at
  `dist/` as the publish directory).

## Adding or editing a page

Add a new JSON file to `content/pages/` (or `content/articles/`) with a
`_route` block and content matching the shape of an existing file for the
same template, then re-run `python3 build.py`. No code changes needed.

## Known gaps / next steps

- **No structured data (JSON-LD schema)** yet in the new templates. The old
  site has fairly extensive Organization/LocalBusiness/FAQPage/Article schema
  that helps with search rich results — this redesign doesn't carry it over
  yet. Worth adding back into `base.html`/`article.html` before shipping.
- **Lead forms**: `static/js/lead-form.js` and `retreat-registration.js` are
  carried over unchanged from the old site (they post to a Google Apps
  Script). A past audit flagged that `mode: 'no-cors'` in that script means a
  failed submission still shows a success message — not fixed here, out of
  scope for a visual redesign, but worth knowing before this goes live.
- **Some old-site UI widgets have no equivalent yet**: the interactive
  training course-picker, the events page's embedded ticketing iframe, and a
  couple of dropdown/select form fields were represented as static text or
  plain inputs. Search each content JSON file's own notes (ask the assistant
  that built this, or check the conversation this was built in) for the
  specific judgment calls made per page.
