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
- **Lead forms**: `static/js/lead-form.js` and `event-affiliate.js` (the
  T-ICR `event-registration.js` was deleted with its page on 2026-11-07) post to the same Google Apps Script Web App
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

## Application form extras (selects)

On a `form` section's `select` field in a page JSON: `"searchable": true` (optional `"search_placeholder"`)
turns the dropdown into a type-to-search list, and `"other": {"name": "...", "placeholder": "..."}` adds a
text box that appears only when the visitor picks the option named "Other" (an "Other" option must be in
`options`). Both are handled by `static/js/apply-fields.js`; the real `<select>` stays in the page, so the
page's own form script reads the field exactly as before. Example: `content/pages/apply-paid-internship.json`.

## Careers page order

The job cards on `/apply/` live in `content/pages/apply.json`. Their order in
that file does not matter: `mark_careers_cards` in `build.py` re-orders them on
every build, open roles first and newest `datePosted` at the top, then closed or
expired roles (also newest first) at the end. Roles posted on the same day keep
the order they have in `apply.json`. A new role only needs its card added and a
`datePosted` in `content/jobs.json`.

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

- `"closed": true` (optional): closes a card by hand, for example when ticket sales stop
  before the event date. Add `"closed_note": "Ticket sales are closed"` to replace the
  default "This event has ended" line. Once the `ends` date passes, the note is dropped
  and the standard wording takes over. Remove `"closed"` to reopen the card.

To test a closed card locally: `BUILD_TODAY=2026-12-01 python3 build.py`.

### Disabled buttons (closing registration on a page)

Any button on a flex page can be switched off without removing it: add `"disabled": true`
(and optionally `"disabled_label": "Ticket Sales Closed"`) to a hero or text-section
action, a `cta` section, or the `final_cta`. The button then renders as a greyed,
non-clickable `<span class="btn btn-disabled" aria-disabled="true">` with no link.
Remove the two keys (and restore the `href`) to reopen it. Used on
`service-events-kigali.json` when T-ICR 2026 ticket sales closed. Article callout
buttons (`buttons` in a `callout` section) take the same two keys.

The T-ICR registration page (`/services/events/kigali/register/`, content
`service-events-kigali-register.json`, script `event-registration.js`) was deleted
on 2026-11-07, so it now returns the site's 404 page. To bring it back, restore
those two files from git history and the sitemap entry.

## Homepage "Latest Events & Insights"

The section in `content/pages/home.json` (`insights`) is set to `"source": "latest-articles"` with `"count": 3`. `build.py` (`fill_home_insights`) fills it with the newest articles (by byline date) that are listed in `content/articles-index.json`, using each card's tag, title, excerpt, image and image_alt from that list. So a new article only needs its normal steps (article JSON + articles-index entry); it shows on the homepage after the next build and the oldest drops off. To go back to hand-picked cards, remove `source` and add an `entries` list.

## "Request A Free Consultation" pop-up (service pages)

The service pages (Corporate Restructuring, Business Advisory, Startup Structuring, and the main lead buttons on the homepage, Resources, Partnerships, Events and Recruitment Services) have no WhatsApp buttons. Their buttons open a pop-up lead form instead. It posts the same fields as the lead form (`sourcePage`, `name`, `phone`, `companyName`, `email`) to the same Google Apps Script, so enquiries land on the Leads tab and trigger the usual email. No Apps Script change is needed.

To use it on another `flex.html` page: add a `"lead_popup": {"title", "sub", "button"}` block to the page JSON, then put `"popup": true` on any hero action, section action, `cta` section or `final_cta` (and remove its `href`). The template adds the dialog and loads `/js/lead-popup.js` (plus `form-guard.js` if the page does not already load it). Script: `source/static/js/lead-popup.js`.

**On articles:** every article now has the pop-up automatically (the sidebar "Book a Free Strategy Call" button opens it; no WhatsApp). To change its wording add a `"lead_popup"` block to the article JSON. Inside an article you can also use `"popup": true` on the `cta` block (the button opens the pop-up instead of linking) or on an item of a `contact` section, or put `<a href="#request-consultation" data-open-lead-popup>text</a>` inside a paragraph. An article may also set a top-level `"image_alt"` for the hero picture (otherwise the title is used). The pop-up HTML lives in `templates/_lead_popup.html`, included by both `flex.html` and `article.html`. Example: `how-to-know-when-you-need-traction-outsourcing.json`.

Per-item buttons: a grid card or a property-grid card can carry `"popup": "<what it is about>"` instead of an `href`. The button then opens the same pop-up, shows "Enquiring about: <text>", and appends " | <text>" to `sourcePage` so the Leads sheet and the email say which property, plot or plan the enquiry was for. A hero action can use `"training_popup": "specialized"` to open the Employee Training specialized-request form. Used on: Employee Training, Traction Properties (hub, For Rent, Houses For Sale, Estate Lands) and Recruitment Services. The site footer still has its WhatsApp link.

## Service page extras (service.html: optional, for SEO and AI answers)

A service page JSON (for example `service-staff-outsourcing.json`) can carry, beside the usual keys:

- `"summary"`: one short, quotable paragraph shown in a highlighted box above the intro. Write it as a direct answer (what the service is, who it is for, where). AI assistants and Google snippets quote this kind of text.
- FAQ entries may add `"link": {"href": "/x/", "label": "Read: ..."}`, shown as a link after the answer (the FAQPage structured data keeps only the plain question and answer).
- `"related": {"title": "...", "entries": [{"title", "text", "href", "cta"}]}`: a grid of internal links to related services and articles at the end of the page.

Pages that do not use these keys render exactly as before.

## SEO and AI-search checklist (every new article or page)
- **Meta title** at most about 65 characters and **meta description** at most about 160, so Google does not cut them off. These are the `meta.title` and `meta.description` fields only; the page heading can be longer.
- **Robots:** `base.html` puts `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` on every page that is not marked `noindex`, so search engines may show large image previews and full snippets. `robots.txt` already allows all crawlers, including AI crawlers.
- **`sitemap.xml`** (repo root, hand-maintained): add the page, and set `<lastmod>` to the article's `byline.updated` if it has one, otherwise `byline.date`. Update the `/articles/` lastmod to the newest article date.
- **`llms.txt`** (repo root, hand-maintained): add a line under `## Articles` (newest first) with the article title and its meta description. This is the list AI assistants read, so every article must be in it.
- Articles already output Article, FAQPage and BreadcrumbList structured data from the article JSON (`faq.entries`, `byline`), so keep the FAQ questions written as real questions with direct answers.

## Salary ranges on job pages
In `jobs.json` a role can have a salary range: `"salary": {"value": 400000, "max": 600000, "currency": "NGN", "unit": "MONTH"}` (`value` is the lowest figure, `max` the highest). The Google JobPosting markup then uses minValue/maxValue, the feeds show both figures, and `job_salary_text()` prints "₦400,000 - ₦600,000/month". The text on the page and card (hero sentence, card `salary`) is typed by hand in the page JSON and `apply.json`.

## Recruitment Services (formerly ATH Recruiters)

The ATH Recruiters / Abuja Talent Hub brand was retired on 2026-11-09. The page now lives at `/services/recruitment/` (`content/pages/service-recruitment.json`), uses the normal Traction header and footer (the purple sub-brand theme, `nav-recruiters.html` and `footer-recruiters.html` were deleted) and is listed under Our Services. The old `/brands/recruiters/` address is a small redirect page (`brands-recruiters.json`, template `redirect.html`), kept out of the sitemap and search. Wording rule: use "Traction Outsourcing Recruitment Services" for the name in text and "Recruitment Services" for page, menu and card titles. The old names appear only on purpose in the page's "same as ATH Recruiters?" FAQ, its structured-data alternate names, the best-recruitment-agency FAQ and the llms.txt line, so people and AI tools searching the old name find the new one. The external "Join Our Job Community" button still points to https://bit.ly/athjobs.
