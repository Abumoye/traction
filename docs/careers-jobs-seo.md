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

## Close a job

Change its `"status"` to `"closed"` in `jobs.json`. It drops out of the structured data, the feeds and the `/apply/` list on the next build. Also remove or deactivate its card on `apply.json`, and update `sitemap.xml` and `llms.txt`. Closed jobs left online with live markup are treated by Google as stale listings.

There is no closing date by default. To add one, set `"validThrough": "YYYY-MM-DD"` on the job.

## After publishing

1. Google Rich Results Test: test each job URL and confirm "Job posting" is detected with no errors.
2. Search Console: submit `sitemap.xml`, run URL Inspection on `/apply/` and each job page, and watch the Enhancements > Job postings report.
3. Submit `https://tolnigeria.com/jobs.xml` to aggregators that accept feeds (Jooble, Adzuna, Talent.com and similar).
4. Optionally post the same role on Jobberman, Indeed, LinkedIn and MyJobMag, linking back to the apply page.
