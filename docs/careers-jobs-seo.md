# Careers: how jobs reach Google, job boards and AI tools

All open roles live in one file: `source/content/jobs.json`. Every build reads it and produces:

- `JobPosting` structured data (JSON-LD) on each job page, which is what Google for Jobs reads.
- A `CollectionPage` + `ItemList` on `/apply/` listing every open role.
- `/jobs.json` (for AI tools and any site that reads JSON) and `/jobs.xml` (an Indeed-style feed that job aggregators accept).
- `<link rel="alternate">` tags on `/apply/` pointing to both feeds, and a careers section in `llms.txt`.

## Add a job

1. Add an entry to the `jobs` array in `source/content/jobs.json`: id, `"status": "open"`, title, url, locality, region, datePosted (YYYY-MM-DD), employmentType (`FULL_TIME`, `PART_TIME`, `CONTRACTOR`, `TEMPORARY`, `INTERN`), salary (value, currency `NGN`, unit `MONTH`), summary, responsibilities, qualifications, benefits.
2. Create the job page `source/content/pages/apply-<slug>.json` and add a card on `apply.json`.
3. Put the same facts on the page where visitors can see them: the hero line (location, salary, type), the description and the benefits. Google requires the markup to match what is visible.
4. Add the page URL to `sitemap.xml` and `llms.txt`.
5. Build, copy `dist/apply/...`, `dist/jobs.json` and `dist/jobs.xml` to the repo root (the auto-build does this on push).

## Closing dates (automatic)

Every job closes by itself **14 working days after its `datePosted`** (the posting day is not counted; Saturdays, Sundays and the public holidays listed in `source/content/holidays.json` are skipped). Nothing needs to be typed in `jobs.json`:

- The closing date is written into the `JobPosting` markup as `validThrough` (end of that day, Nigeria time), into both feeds (`validThrough` / `<expirationdate>`), and onto the job page ("Closing date: 22 October 2026.") and the job card on `/apply/` ("Closes 22 Oct 2026").
- The site rebuilds every night just after midnight (Nigeria time). The first build after the closing date takes the job off: the page loses its markup and its application form and says "Applications for this role have closed", the card on `/apply/` turns grey (its details stay visible) and its button reads "Closed" and can no longer be clicked, and the job disappears from the feeds.
- Google is told through the Indexing API (see `docs/google-indexing-api-setup.md`) so it drops the listing quickly.

Optional per-job settings in `jobs.json`: `"workingDaysOpen": 10` to use a different number of working days, or `"validThrough": "2026-11-05"` to set an exact closing date.

Add Eid and other government-announced holidays to `holidays.json` when they are announced; the closing dates of open jobs move automatically on the next build.

## Remote jobs

Set `"remote": true` on a job and leave out `locality`, `region` and `streetAddress`. The markup then uses `jobLocationType: TELECOMMUTE` with Nigeria as the allowed applicant country, and the feeds say "remote". The visible page must also say the role is remote.

## Close a job early

Change its `"status"` to `"closed"` in `jobs.json`. On the next build it is treated exactly like an expired job (markup, form and feed entries removed). Also deactivate its card on `apply.json` if you like, and update `sitemap.xml` and `llms.txt`. Closed jobs left online with live markup are treated by Google as stale listings.

## After publishing

1. Google Rich Results Test: test each job URL and confirm "Job posting" is detected with no errors.
2. Search Console: submit `sitemap.xml`, run URL Inspection on `/apply/` and each job page, and watch the Enhancements > Job postings report.
3. Submit `https://tolnigeria.com/jobs.xml` to aggregators that accept feeds (Jooble, Adzuna, Talent.com and similar).
4. Optionally post the same role on Jobberman, Indeed, LinkedIn and MyJobMag, linking back to the apply page.
