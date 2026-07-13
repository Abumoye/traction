# ATH Academy

Learning platform for the ATH Recruiters community. A member enters their
membership ID, browses a Udemy-style catalog of 5 real courses, watches the
course video, then sits a timed, one-shot, 20-question assessment. Passing
at 90% (weighted) auto-generates a certificate, emails it, and logs it
under a public verification number. Failing emails the score with a
retake link.

**Status: live.** The frontend is deployed to `tolnigeria.com/ath-academy`
and wired to a deployed Apps Script backend — this isn't a demo anymore.

## Where this actually lives — two separate places

Two things run independently and talk to each other over the internet:

1. **The website itself** (`index.html`, `styles.css`, `app.js`,
   `verify.html`, `assets/`) is a set of static files, served from
   **your GitHub repo** (`github.com/Abumoye/traction`) via **GitHub
   Pages**.
2. **The backend** (`Code.gs`) is a Google Apps Script project, deployed as
   its own "Web App" with its own URL. It doesn't live in GitHub — it
   lives inside Google's Apps Script editor, and reaches your ATH
   Recruiters Directory spreadsheet by ID, not by being "bound" to it.

`app.js` calls the Apps Script URL (hardcoded near the top of the file, in
the `API` object) whenever it needs to check a membership ID, pull course
questions, score an assessment, or issue a certificate.

## If you edit `Code.gs` again

Editing the file in the Apps Script editor and saving does **not** update
the live URL. To push a change live: **Deploy → Manage deployments** →
click the pencil icon on the existing deployment → **Version: New version**
→ **Deploy**. The URL stays the same either way, so `app.js` doesn't need
touching unless you create an entirely new deployment from scratch.

## First-time setup, if you haven't already

**1. Deploy the backend.**
- Go to [script.google.com](https://script.google.com) → **New project**.
- Paste in the entire contents of `Code.gs`.
- Set `SHEET_ID` near the top to your ATH Recruiters Directory
  spreadsheet's ID.
- Run **seedAcademyData**, authorize when prompted, then run
  **expandDigitalMarketingQuestions**.
- **If you seeded before this update**, also run
  **backfillCourseMetadata** once — it fills in each course's thumbnail,
  initials, and "what you'll learn" bullets, which didn't exist as columns
  the first time you seeded. Safe to run more than once.
- **Deploy → New deployment → Web app**, Execute as **Me**, Who has access
  **Anyone**, copy the URL.

**2. Push the files to GitHub.**
Create an `ath-academy` folder in your `traction` repo with every file
here, keeping the `assets/` structure intact. Commit and push, the same
way you've deployed the rest of `tolnigeria.com`. Once GitHub Pages
rebuilds, it's live at `tolnigeria.com/ath-academy`.

There's no build step, no npm install, nothing to compile — these are
plain files GitHub Pages serves as-is.

## Your Members vs. Academy question

Yes — `Code.gs` reads membership IDs straight from your existing
**Members** tab, nothing to duplicate. Google Sheets doesn't let one tab
contain other tabs inside it, though, so an "Academy" tab on its own
couldn't hold separate tables for courses, lessons, and questions. Instead,
`Code.gs` creates and uses three dedicated tabs — **Courses**, **Lessons**,
**Questions** — in the same spreadsheet file, alongside **Members**.
`seedAcademyData()` (step 1 above) creates and fills all three
automatically. If you'd already made an "Academy" tab, you can delete it;
nothing reads from a tab by that name.

## The five courses

Each is a single long-form "full course" video, so each has one lesson for
now. If you'd rather split any of them into multiple lessons by timestamp
(chapters), send the breakdown and I'll restructure that course.

| Course | Video |
|---|---|
| Digital Marketing Full Course | qnBhOVH1QQ8 |
| CapCut for Beginners | 68KNzsmBarM |
| How to Run TikTok Ads | T1xOxbGUB-A |
| How to Use Google Docs | RzNVGQYOmFk |
| Social Media Manager Full Course | bgrA3kuZpWk |

Each also has a simple branded thumbnail card in `assets/thumbs/`.

**On the question banks — a progress note.** Digital Marketing now has 140
questions (20 original + a 120-question expansion, covering keyword
research, on-page/off-page/technical SEO, content, email, social, paid
search, paid social, analytics, CRO, branding, funnels, affiliate and
influencer marketing, and strategy/ROI). Run `expandDigitalMarketingQuestions()`
in `Code.gs` once, the same way you ran `seedAcademyData()`, to load these
into your Questions tab — it's safe to run more than once, since it skips
anything already there. The other four courses are still at their original
20 each.

These are written from general, well-established digital marketing
knowledge — not transcribed from the video, since I can't watch a
multi-hour course. That's the normal way a skills assessment works: it
tests command of the subject, not verbatim recall of one specific video.
Getting to a genuine, well-calibrated 500 for Digital Marketing means
roughly 360 more, written and checked for quality, not just volume — I'd
rather keep delivering in solid batches like this one than pad it with
weak filler questions that undermine the point of a 90% pass mark. Let me
know if you want me to keep going on Digital Marketing toward 500, or move
to seeding one of the other four courses next.

## What I still need from you

- **Whether to keep expanding Digital Marketing toward 500**, or move to
  seeding the other four courses with their own starter banks first.
- Real thumbnail images, if you'd rather replace the generated ones.

## Notes on the design decisions

- **Login** is a single matte-orange screen with one pill-shaped input.
  Submitting triggers a short rolling-loader animation before either an
  error or the course catalog.
- **The catalog and course pages follow the Udemy pattern**: a grid of
  cards on the dashboard, each opening a detail page with a "What you'll
  learn" list and curriculum before the member commits to starting.
- **Scoring happens server-side.** `Code.gs` never sends the correct answer
  down to the browser until after submission — worth flagging that this
  wasn't quite true in an earlier draft: `getAssessment` used to include an
  `isCorrect` flag on every option in its response, readable by anyone who
  opened browser dev tools before answering. That's fixed now: the answer
  key lives only in a `Sessions` row on the server, and a new
  `submitAssessment` endpoint is the sole place scoring happens, keyed to a
  one-time `assessmentId` that gets marked "used" on submission so the same
  attempt can't be scored twice.
- **Certificates are automatic.** The moment a member passes, the
  certificate is generated, numbered, logged, and (if an email's on file)
  sent — no button to click. The browser draws the certificate with the
  real number on it before emailing it, so the emailed copy never shows a
  placeholder.
- **No retakes on a given attempt.** 50-minute countdown, auto-submits on
  timeout, and a fail locks the course until every lesson is marked
  complete again. The lock lives in the browser (`localStorage`); worth
  moving server-side before this scales past a pilot, since clearing
  browser data would currently bypass it.
- **Lesson progress resumes automatically** per browser, via
  `localStorage` — per-device, not per-account. Assessments never resume;
  closing the tab mid-attempt forfeits it, on purpose, with a warning
  before a member can accidentally leave.
- **Logos are the real ATH Recruiters and Traction Outsourcing marks**,
  used on the certificate, site header, and favicon. Traction's logo sits
  on a small white plate on the certificate since its dark text doesn't
  read on the near-black background — send a light/white version if you'd
  rather drop the plate.
- **Social link previews** can't show a personalized image per certificate
  on a static host like GitHub Pages, since preview crawlers read the raw
  HTML before any JavaScript runs. `Code.gs` works around this with a
  `verifyPage` route that server-renders the right title and description
  per certificate, but the image itself is still the branded logo card, not
  a live render of the certificate.

## Open questions for the next pass

- Should certificates expire or need renewal after a period?
- Do you want a leaderboard or completion count visible to members, or keep
  it strictly private per member?
- Should the retake lock move server-side once this is past pilot stage?
