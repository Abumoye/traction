# Google Indexing API for job pages

Google recommends the Indexing API for job posting pages: it lets us tell Google straight away when a job is added, changed or closed, instead of waiting for the next crawl. Quota is 200 notifications a day, far more than we need.

The site does this automatically. After every publish, `scripts/notify_google_indexing.py` (run by `.github/workflows/build-and-deploy.yml`):

- sends `URL_UPDATED` for each job that is new or whose details changed, and
- sends `URL_DELETED` for each job that was open before but is now closed or expired.

It remembers what Google was last told in `source/indexing-state.json`, so it only sends what changed. Until the secret below is added the step is skipped and nothing breaks.

## One-time setup (about 10 minutes)

1. **Google Cloud project.** Go to https://console.cloud.google.com, create a project (e.g. "Traction website") or pick an existing one.
2. **Enable the API.** APIs & Services > Library > search "Web Search Indexing API" > Enable.
3. **Service account.** IAM & Admin > Service Accounts > Create service account (name: `indexing-bot`). No roles are needed. Open it > Keys > Add key > Create new key > JSON. A `.json` file downloads. Keep it private.
4. **Give it Search Console access.** Copy the service account's email (looks like `indexing-bot@your-project.iam.gserviceaccount.com`). In Search Console (https://search.google.com/search-console) open the `tolnigeria.com` property > Settings > Users and permissions > Add user > paste the email > permission **Owner**. (Only a verified owner can add another owner.)
5. **Add the key to GitHub.** Repo > Settings > Secrets and variables > Actions > New repository secret. Name: `GOOGLE_INDEXING_SA_JSON`. Value: open the downloaded `.json` file and paste its **entire contents**.
6. **Test.** Repo > Actions > "Build site from source and publish" > Run workflow. Open the run and check the "Notify Google Indexing API" step: you should see `ok URL_UPDATED ...` for each open job.

## What the run looks like

```
URL_UPDATED https://tolnigeria.com/apply/storekeeping-assistant-kuje/
  ok   URL_UPDATED https://tolnigeria.com/apply/storekeeping-assistant-kuje/
```

If a line starts with `FAIL`, the HTTP status tells you why: `403` means the service account is not an Owner in Search Console (step 4); `403` with "API has not been used" means step 2 was skipped; `429` means the daily quota was hit.

## Notes

- Do not commit the key file anywhere. It lives only in the GitHub secret.
- The workflow waits (up to 10 minutes) until the new pages are live before notifying Google, so Google never crawls the old version.
- The Indexing API speeds up discovery but does not replace the structured data: pages must still pass the Rich Results Test for "Job posting".
- To run it by hand: `GOOGLE_INDEXING_SA_JSON="$(cat key.json)" python3 scripts/notify_google_indexing.py` (add `--dry-run` to see what would be sent without sending).
