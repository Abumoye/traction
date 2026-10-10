# Google Indexing API for job pages

Google recommends the Indexing API for job posting pages: it lets us tell Google straight away when a job is added, changed or closed, instead of waiting for the next crawl. Quota is 200 notifications a day, far more than we need.

The site does this automatically. After every publish, `scripts/notify_google_indexing.py` (run by `.github/workflows/build-and-deploy.yml`):

- sends `URL_UPDATED` for each job that is new or whose details changed, and
- sends `URL_DELETED` for each job that was open before but is now closed or expired.

It remembers what Google was last told in `source/indexing-state.json`, so it only sends what changed. Until Google is set up the step is skipped and nothing breaks.

There are two ways to let GitHub sign in to Google. **Use the keyless way (Part 2)**: it needs no key file, and it works even when the Google Cloud organization blocks service account keys (the "iam.disableServiceAccountKeyCreation" error). Part 1 is needed either way.

## Part 1: Google Cloud project, API and service account

1. **Project.** https://console.cloud.google.com > project picker > New project (e.g. "Traction website"). Note its **Project ID** (shown in the picker).
2. **Enable the API.** APIs & Services > Library > "Web Search Indexing API" > Enable.
3. **Service account.** IAM & Admin > Service Accounts > Create service account, name `indexing-bot`, skip the optional role steps, Done. Copy its email (`indexing-bot@<project-id>.iam.gserviceaccount.com`).
4. **Give it Search Console access.** https://search.google.com/search-console > the `tolnigeria.com` property > Settings > Users and permissions > Add user > paste the service account email > permission **Owner**. (Only a verified owner can add another owner.)

## Part 2: Keyless sign-in from GitHub (Workload Identity Federation)

Open Cloud Shell: in the Google Cloud console click the `>_` icon (top right) and approve the "Authorize" prompt. Paste these commands one block at a time. Replace `YOUR_PROJECT_ID` first.

```
export PROJECT_ID=YOUR_PROJECT_ID
gcloud config set project $PROJECT_ID
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export SA_EMAIL=indexing-bot@$PROJECT_ID.iam.gserviceaccount.com

gcloud services enable indexing.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
```

```
gcloud iam workload-identity-pools create github-pool \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github-pool \
  --display-name="GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='Abumoye/traction'"
```

```
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/Abumoye/traction"
```

The `--attribute-condition` and the last command limit access to this one GitHub repository, `Abumoye/traction`. Nobody else's GitHub repo can use the service account.

Now print the two values GitHub needs:

```
echo "GCP_SERVICE_ACCOUNT = $SA_EMAIL"
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global --workload-identity-pool=github-pool --format='value(name)'
```

The second command prints something like `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider`. This is `GCP_WORKLOAD_IDENTITY_PROVIDER`.

Add them to GitHub: repo > Settings > Secrets and variables > Actions > **Variables** tab (not Secrets) > New repository variable:

| Name | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | the `projects/.../providers/github-provider` line |
| `GCP_SERVICE_ACCOUNT` | the service account email |

These are not passwords, so they are safe as ordinary variables.

## Part 2 (alternative): service account key

Only if keys are allowed in your organization: create a JSON key for the service account (Keys > Add key > Create new key > JSON), then add the whole file contents as a repository **secret** named `GOOGLE_INDEXING_SA_JSON`. Do not commit the file anywhere.

## Test it

Repo > Actions > "Build site from source and publish" > Run workflow. In the run, open **Sign in to Google (keyless)** (it should be green) and **Notify Google Indexing API**. You should see:

```
URL_UPDATED https://tolnigeria.com/apply/storekeeping-assistant-kuje/
  ok   URL_UPDATED https://tolnigeria.com/apply/storekeeping-assistant-kuje/
```

If a line starts with `FAIL`, the HTTP status says why:

- `403` mentioning permission: the service account is not an **Owner** in Search Console (Part 1, step 4). Search Console can take a few minutes to recognise a newly added owner.
- `403` saying the API has not been used: step 2 was skipped, or the project differs from the one the service account lives in.
- `429`: the daily quota of 200 was hit.

If **Sign in to Google (keyless)** fails, open it and read the message:

- "Unable to acquire impersonated credentials" / `iam.serviceAccounts.getAccessToken` denied: the `add-iam-policy-binding` command did not run, or the repository name in it is not exactly `Abumoye/traction` (capital A matters).
- `invalid_target` / pool not found: the `GCP_WORKLOAD_IDENTITY_PROVIDER` value is wrong. Copy it again from the `describe` command (it must start with `projects/<number>/`, not `projects/<id>/`).
- "IAM Service Account Credentials API has not been used": run the `gcloud services enable` command again.

## Notes

- The workflow waits (up to 10 minutes) until the new pages are live before notifying Google, so Google never crawls the old version.
- The Indexing API speeds up discovery but does not replace the structured data: pages must still pass the Rich Results Test for "Job posting".
- To run it by hand with a key: `GOOGLE_INDEXING_SA_JSON="$(cat key.json)" python3 scripts/notify_google_indexing.py` (add `--dry-run` to see what would be sent without sending).
