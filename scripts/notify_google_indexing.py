#!/usr/bin/env python3
"""Tell Google about job pages through the Indexing API.

Run by the auto-build workflow after the site has been published. It compares
the jobs that are open right now (the published /jobs.json feed) with what
Google was last told (source/indexing-state.json) and then:

  * URL_UPDATED for every job that is new or whose details changed
  * URL_DELETED for every job that was open before but is now closed or expired

Google asks for this on job pages so a closed job leaves Google Jobs quickly
instead of waiting for the next crawl.

Setup (once): docs/google-indexing-api-setup.md. Needs the GitHub secret
GOOGLE_INDEXING_SA_JSON (the service account key). Without it this script
prints a note and exits cleanly, so the workflow keeps working until it is set up.

Usage:
  python3 scripts/notify_google_indexing.py [--feed jobs.json] [--wait-live] [--dry-run]
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
STATE_FILE = REPO / "source" / "indexing-state.json"
LIVE_FEED = "https://tolnigeria.com/jobs.json"
ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"
SCOPE = "https://www.googleapis.com/auth/indexing"


def fingerprint(job):
    return hashlib.sha256(json.dumps(job, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:16]


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8")).get("urls", {})
    return {}


def save_state(urls):
    STATE_FILE.write_text(json.dumps({
        "_comment": "What Google was last told for each job page. Written by scripts/notify_google_indexing.py; do not edit by hand.",
        "urls": dict(sorted(urls.items())),
    }, indent=2) + "\n", encoding="utf-8")


def wait_until_live(feed_text, timeout=600):
    """Pages can take a minute or two to go live after the push. Wait until the
    live feed matches the one just built, so Google crawls the new pages."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            req = urllib.request.Request(LIVE_FEED + "?nocache=" + str(int(time.time())), headers={"User-Agent": "traction-site-bot"})
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.read().decode("utf-8") == feed_text:
                    print("Live site matches the new build.")
                    return True
        except Exception as e:  # network blips are fine, just retry
            print("  waiting for site:", e)
        time.sleep(20)
    print("Live site did not match within the time limit; notifying anyway.")
    return False


def make_session():
    info = json.loads(os.environ["GOOGLE_INDEXING_SA_JSON"])
    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account
    creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    return AuthorizedSession(creds)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", default="jobs.json", help="the built feed to read (default: jobs.json in the repo root)")
    ap.add_argument("--wait-live", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="print what would be sent, send nothing, change nothing")
    args = ap.parse_args()

    if not args.dry_run and not os.environ.get("GOOGLE_INDEXING_SA_JSON"):
        print("GOOGLE_INDEXING_SA_JSON is not set - skipping Google Indexing API (see docs/google-indexing-api-setup.md).")
        return 0

    feed_path = Path(args.feed)
    if not feed_path.is_absolute():
        feed_path = REPO / feed_path
    feed_text = feed_path.read_text(encoding="utf-8")
    open_now = {j["url"]: fingerprint(j) for j in json.loads(feed_text)["jobs"]}
    known = load_state()

    to_update = [u for u, fp in open_now.items() if known.get(u) != fp]
    to_delete = [u for u in known if u not in open_now]
    if not to_update and not to_delete:
        print("Nothing to tell Google: job pages unchanged since the last notification.")
        return 0

    for u in to_update:
        print("URL_UPDATED", u)
    for u in to_delete:
        print("URL_DELETED", u)
    if args.dry_run:
        return 0

    if args.wait_live:
        wait_until_live(feed_text)
    session = make_session()

    new_state, failed = dict(known), 0
    for url, kind in [(u, "URL_UPDATED") for u in to_update] + [(u, "URL_DELETED") for u in to_delete]:
        r = session.post(ENDPOINT, json={"url": url, "type": kind}, timeout=30)
        if r.ok:
            print("  ok  ", kind, url)
            if kind == "URL_UPDATED":
                new_state[url] = open_now[url]
            else:
                new_state.pop(url, None)
        else:
            failed += 1
            print(f"  FAIL {kind} {url}: HTTP {r.status_code} {r.text[:300]}")
    save_state(new_state)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
