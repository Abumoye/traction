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
- `content/articles-index.json` / `content/categories.json` — power the
  `/articles/` grid. `search-index.json` is no longer hand-maintained: the
  build generates it from `articles-index.json` plus each article's JSON
  (full body text), so adding an article means adding its JSON file and one
  entry to `articles-index.json`, and it is searchable automatically.
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
- **Lead forms**: `static/js/lead-form.js`, `event-registration.js`, and
  `event-affiliate.js` all post to the same Google Apps Script Web App
  (routed by a `formType` field — see `docs/lead-form-setup.md`). A past
  audit flagged that `mode: 'no-cors'` in these scripts means a failed
  submission still shows a success message — not fixed here, carried over
  as an accepted trade-off, but worth knowing.
- **Some old-site UI widgets have no equivalent yet**: the interactive
  training course-picker, the events page's embedded ticketing iframe, and a
  couple of dropdown/select form fields were represented as static text or
  plain inputs. Search each content JSON file's own notes (ask the assistant
  that built this, or check the conversation this was built in) for the
  specific judgment calls made per page.

## Site-wide search

The homepage hero has a search box, and `/search/` shows the full results
list. Both read `/site-search-index.json`, which `build.py` generates on every
build (`build_site_search_index`). It crawls the finished pages in `dist/`, so
every public page, article and resource is searchable with nothing to
maintain. Pages with `"noindex": true`, `/search/` itself and the apply pages of
closed or expired roles are left out.

- Add plain-language words for a page (e.g. "jobs" for the careers hub) in the
  `SEARCH_KEYWORDS` dict near the top of that function's section in `build.py`.
- Search words and their synonyms live in `static/js/site-search.js`
  (`SYNONYMS`), and the ranking weights are in `termScore`.
- The hero box text is in `content/pages/home.json` under `hero.search`.

## Event cards (images and "CLOSED")

The cards in the "Upcoming Events" grid on `/services/events/` live in
`content/pages/service-events.json` (a `grid` section with `"style": "case-study"`).
Each card can have:

- `"image"`: path to a 1200 x 630 JPG, e.g. `/images/events/<slug>.jpg`
  (files go in `static/images/events/`), and `"image_alt"`: what the picture shows.
  A card without an image simply shows no picture.
- `"ends"`: the last day of the event as `YYYY-MM-DD`. From the next day (Nigeria
  time) the card is greyed out, shows a diagonal red "CLOSED" stamp, loses its
  register link and moves after the cards that are still open. The nightly rebuild
  (about 00:10 WAT) does this, so nobody has to edit the page. A card with no `ends`
  (for example "Coming Soon") never closes. Logic: `mark_event_cards` in `build.py`;
  styles: `.card-media`, `.is-closed`, `.closed-stamp` in `static/css/style.css`.

To test a closed card locally: `BUILD_TODAY=2026-12-01 python3 build.py`.

## Homepage "Latest Events & Insights"

The section in `content/pages/home.json` (`insights`) is set to `"source": "latest-articles"` with `"count": 3`. `build.py` (`fill_home_insights`) fills it with the newest articles (by byline date) that are listed in `content/articles-index.json`, using each card's tag, title, excerpt, image and image_alt from that list. So a new article only needs its normal steps (article JSON + articles-index entry); it shows on the homepage after the next build and the oldest drops off. To go back to hand-picked cards, remove `source` and add an `entries` list.
