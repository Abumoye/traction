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
import html
from html.parser import HTMLParser
import json
import os
import re
import shutil
from datetime import date, datetime, timedelta, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape as xml_escape
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
DIST = ROOT / "dist"

SITE_NAME = "Traction Outsourcing Limited"
SITE_URL = "https://tolnigeria.com"
SITE_LOGO = "https://tolnigeria.com/images/traction-outsourcing-logo.png"
# Public profiles that identify the organization to search engines (schema.org
# sameAs). Only profiles linked from the site footer belong here.
SITE_SOCIAL_PROFILES = [
    "https://www.instagram.com/tractionoutsourcing",
    "https://www.tiktok.com/@tractionoutsourcing",
]

# Top-level URL segments that get a named breadcrumb crumb pointing at a
# real page. Segments not listed here (e.g. "brands", which has no /brands/
# index) are simply skipped rather than guessed at -- pages under them can
# still supply their own more specific BreadcrumbList via "schema" if the
# 2-level Home > Leaf default isn't descriptive enough.
BREADCRUMB_SECTIONS = {
    "articles": ("Articles", "/articles/"),
    "services": ("Our Services", "/"),
    "partnerships": ("Partnerships", "/partnerships/"),
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


def build_organization_schema():
    """The publisher/author entity for every article. One shared @id so search
    engines see the same organization as author and publisher, with logo and
    social profiles attached."""
    return {
        "@type": "Organization",
        "@id": SITE_URL + "/#organization",
        "name": SITE_NAME,
        "url": SITE_URL + "/",
        "logo": {"@type": "ImageObject", "url": SITE_LOGO},
        "sameAs": SITE_SOCIAL_PROFILES,
    }


def build_article_schema(data, route):
    """Auto-derive BlogPosting JSON-LD (or NewsArticle when the page sets
    schema_type: NewsArticle, see apply_news_article_schema) for every article.html page from fields
    already authored on the page (title, dek, byline, image, tag) -- no manual
    schema authoring needed per article. The content is evergreen advisory
    writing rather than news reporting, so BlogPosting (a schema.org subtype
    of Article) is used instead of NewsArticle."""
    byline = data.get("byline", {})
    date = parse_byline_date(byline.get("date"))
    image = data.get("image") or data.get("meta", {}).get("image")
    if image and image.startswith("/"):
        image = SITE_URL + image

    org = build_organization_schema()
    author_name = byline.get("author") or SITE_NAME
    author = org if author_name == SITE_NAME else {"@type": "Organization", "name": author_name}

    schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": data.get("title") or data.get("meta", {}).get("title"),
        "description": data.get("meta", {}).get("description") or data.get("dek"),
        "url": SITE_URL + route["url"],
        "mainEntityOfPage": {"@type": "WebPage", "@id": SITE_URL + route["url"]},
        "inLanguage": "en",
        "publisher": org,
        "author": author,
    }
    if data.get("tag"):
        schema["articleSection"] = data["tag"]
    if image:
        schema["image"] = image
    if date:
        schema["datePublished"] = date
        schema["dateModified"] = parse_byline_date(byline.get("updated")) or date
    if data.get("schema_type") == "NewsArticle":
        apply_news_article_schema(schema, data, route)
    return schema


def article_word_count(data):
    """Words in the visible article text (dek + every section's paragraphs and lists)."""
    parts = [data.get("dek", "")]
    for sec in data.get("sections", []):
        parts.append(sec.get("heading", ""))
        parts.extend(sec.get("paragraphs", []))
        for li in sec.get("list", []) or []:
            parts.append(li.get("t", "") if isinstance(li, dict) else str(li))
    return len(re.sub(r"<[^>]+>", " ", " ".join(parts)).split())


def apply_news_article_schema(schema, data, route):
    """Turns the auto-derived BlogPosting into a NewsArticle (press release /
    company news) with what Google News and other aggregators look for: an exact
    publish time with timezone, a dateline, an image with dimensions, keywords,
    word count, free access and the product the release is about. Driven by the
    page's own fields: schema_type, byline.datetime and news_schema."""
    news = data.get("news_schema", {})
    byline = data.get("byline", {})
    schema["@type"] = "NewsArticle"
    published = byline.get("datetime") or schema.get("datePublished")
    if published:
        schema["datePublished"] = published
        schema["dateModified"] = byline.get("updated_datetime") or published
    if news.get("dateline"):
        schema["dateline"] = news["dateline"]
    if news.get("genre"):
        schema["genre"] = news["genre"]
    if news.get("keywords"):
        schema["keywords"] = ", ".join(news["keywords"])
    if news.get("location"):
        schema["locationCreated"] = news["location"]
    if news.get("about"):
        schema["about"] = news["about"]
    if schema.get("image"):
        size = news.get("image_size")
        if size:
            schema["image"] = [{"@type": "ImageObject", "url": schema["image"], "width": size[0], "height": size[1]}]
            schema["thumbnailUrl"] = schema["image"][0]["url"]
        else:
            schema["image"] = [schema["image"]]
    schema["wordCount"] = article_word_count(data)
    schema["isAccessibleForFree"] = True
    if published:
        schema["copyrightYear"] = int(published[:4])
    schema["copyrightHolder"] = {"@id": SITE_URL + "/#organization"}


def strip_html(text: str) -> str:
    """Collapse raw HTML (as used freely inside content JSON string fields
    site-wide, e.g. property descriptions with <br>/<strong>) down to plain
    text, for use in JSON-LD fields that must not contain markup."""
    if not text:
        return text
    text = re.sub(r"<br\s*/?>", " ", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def build_realestate_listing_schema(data, route):
    """Auto-derive RealEstateListing JSON-LD for every 'property-grid'
    section entry that is a fully verified listing -- same gate as the
    property ID badge (property_id set) plus structured price fields
    (price_value/price_currency/price_period), so a listing never gets
    schema before it has real, verifiable data, and a new listing gets
    correct schema automatically the moment it's marked complete, with no
    schema hand-authored per listing."""
    out = []
    for sec in data.get("sections", []):
        if sec.get("type") != "property-grid":
            continue
        for e in sec.get("entries", []):
            if not e.get("property_id") or not e.get("price_value"):
                continue

            accommodation = {"@type": "House", "name": e.get("title")}

            if e.get("location"):
                parts = [p.strip() for p in e["location"].split(",") if p.strip()]
                address = {"@type": "PostalAddress", "addressCountry": "NG"}
                if parts:
                    address["addressLocality"] = parts[0]
                if len(parts) > 1:
                    address["addressRegion"] = parts[1]
                accommodation["address"] = address

            bedrooms_match = re.match(r"(\d+)", e.get("bedrooms") or "")
            if bedrooms_match:
                accommodation["numberOfBedrooms"] = int(bedrooms_match.group(1))

            if e.get("house_type"):
                accommodation["accommodationCategory"] = e["house_type"]

            photos = [SITE_URL + img for img in e.get("images", []) if img]
            if photos:
                accommodation["photo"] = [{"@type": "ImageObject", "url": p} for p in photos]

            listing = {
                "@context": "https://schema.org",
                "@type": "RealEstateListing",
                "@id": SITE_URL + route["url"] + "#" + e["property_id"],
                "url": SITE_URL + route["url"],
                "identifier": e["property_id"],
                "name": e.get("title"),
                "mainEntity": accommodation,
                "offers": {
                    "@type": "Offer",
                    "businessFunction": "http://purl.org/goodrelations/v1#LeaseOut",
                    "price": e["price_value"],
                    "priceCurrency": e.get("price_currency", "NGN"),
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": e["price_value"],
                        "priceCurrency": e.get("price_currency", "NGN"),
                        "unitText": e.get("price_period", "year"),
                    },
                },
            }

            # Any additional listing fees (agency/legal, caution/security
            # deposit, etc.) authored on the entry as e.g.
            # {"label": "Caution Fee", "amount_value": 700000, ...} go on
            # the Offer as schema.org PropertyValue facts, so a fee shown
            # on the card is always reflected in the structured data too.
            fee_props = [
                {
                    "@type": "PropertyValue",
                    "name": fee["label"],
                    "value": fee["amount_value"],
                    "unitText": e.get("price_currency", "NGN"),
                }
                for fee in e.get("fees", [])
                if fee.get("amount_value") is not None
            ]
            if fee_props:
                listing["offers"]["additionalProperty"] = fee_props
            if e.get("description"):
                listing["description"] = strip_html(e["description"])
            if photos:
                listing["image"] = photos[0]

            out.append(listing)
    return out


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


# ---------------------------------------------------------------------------
# Jobs (careers). content/jobs.json is the single source of truth for open
# roles. Each OPEN job becomes: JobPosting structured data on its page (Google
# for Jobs), an ItemList on /apply/, and the /jobs.json + /jobs.xml feeds that
# AI tools and job boards can read. Set a job's status to "closed" to drop it
# from all of them at once.
# ---------------------------------------------------------------------------
JOBS_FILE = CONTENT / "jobs.json"
HOLIDAYS_FILE = CONTENT / "holidays.json"
JOB_TYPE_LABELS = {"FULL_TIME": "Full-time", "PART_TIME": "Part-time", "CONTRACTOR": "Contract", "TEMPORARY": "Temporary", "INTERN": "Internship"}
JOB_TYPE_XML = {"FULL_TIME": "fulltime", "PART_TIME": "parttime", "CONTRACTOR": "contract", "TEMPORARY": "temporary", "INTERN": "internship"}
REGION_NAMES = {"FCT": "Abuja (FCT)"}

# Every job closes automatically this many working days (Monday to Friday,
# minus the public holidays in content/holidays.json) after its datePosted.
# A job can override this with its own "workingDaysOpen", or set an exact
# "validThrough" date to skip the calculation.
DEFAULT_WORKING_DAYS_OPEN = 14
WAT = timezone(timedelta(hours=1))


def today_wat():
    """Today's date in Nigeria. BUILD_TODAY=YYYY-MM-DD overrides it (for tests)."""
    override = os.environ.get("BUILD_TODAY")
    if override:
        return date.fromisoformat(override)
    return datetime.now(WAT).date()


def load_holidays():
    if not HOLIDAYS_FILE.exists():
        return set()
    return {date.fromisoformat(d) for d in load(HOLIDAYS_FILE).get("holidays", [])}


def add_working_days(start, days, holidays):
    """The date that is `days` working days after `start` (start itself is not
    counted). Weekends and the given holidays are skipped."""
    d, counted = start, 0
    while counted < days:
        d += timedelta(days=1)
        if d.weekday() < 5 and d not in holidays:
            counted += 1
    return d


def job_closing_date(job, holidays):
    if job.get("validThrough"):
        return date.fromisoformat(job["validThrough"][:10])
    posted = date.fromisoformat(job["datePosted"])
    return add_working_days(posted, job.get("workingDaysOpen", DEFAULT_WORKING_DAYS_OPEN), holidays)


def format_long_date(d):
    return f"{d.day} {d.strftime('%B %Y')}"


def load_all_jobs():
    """Every job in jobs.json with its computed closing date and a live state:
    open (accepting applications), expired (past its closing date) or closed
    (switched off by hand)."""
    if not JOBS_FILE.exists():
        return []
    holidays, today, jobs = load_holidays(), today_wat(), []
    for j in load(JOBS_FILE).get("jobs", []):
        j = dict(j)
        closing = job_closing_date(j, holidays)
        j["closingDate"] = closing
        # validThrough is end of the closing day, Nigeria time.
        j["validThrough"] = closing.isoformat() + "T23:59:59+01:00"
        if j.get("status") != "open":
            j["state"] = "closed"
        elif today > closing:
            j["state"] = "expired"
        else:
            j["state"] = "open"
        jobs.append(j)
    return jobs


def load_open_jobs():
    return [j for j in load_all_jobs() if j["state"] == "open"]


def job_salary_text(job):
    s = job.get("salary")
    if not s:
        return ""
    symbol = "\u20a6" if s.get("currency") == "NGN" else s.get("currency", "") + " "
    return f"{symbol}{s['value']:,}/{s['unit'].lower()}"


def job_description_html(job):
    parts = [f"<p>{html.escape(job['summary'], quote=False)}</p>"]
    for heading, key in (("Responsibilities", "responsibilities"), ("Requirements", "qualifications"), ("Benefits", "benefits")):
        items = job.get(key) or []
        if items:
            parts.append(f"<h3>{heading}</h3><ul>" + "".join(f"<li>{html.escape(i, quote=False)}</li>" for i in items) + "</ul>")
    return "".join(parts)


def job_description_text(job):
    lines = [job["summary"]]
    for heading, key in (("Responsibilities", "responsibilities"), ("Requirements", "qualifications"), ("Benefits", "benefits")):
        items = job.get(key) or []
        if items:
            lines.append(heading + ": " + " ".join(items))
    return "\n".join(lines)


def build_jobposting_schema(job):
    schema = {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": job["title"],
        "description": job_description_html(job),
        "identifier": {"@type": "PropertyValue", "name": SITE_NAME, "value": job["id"]},
        "datePosted": job["datePosted"],
        **({"employmentType": job["employmentType"]} if job.get("employmentType") else {}),
        "hiringOrganization": {
            "@type": "Organization",
            "name": SITE_NAME,
            "sameAs": SITE_URL + "/",
            "logo": SITE_LOGO,
        },
        **(
            {
                # Fully remote (Google's TELECOMMUTE): no physical jobLocation,
                # but the countries applicants may live in are required.
                "jobLocationType": "TELECOMMUTE",
                "applicantLocationRequirements": {"@type": "Country", "name": "Nigeria"},
            }
            if job.get("remote")
            else {
                "jobLocation": {
                    "@type": "Place",
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": job["locality"],
                        "addressRegion": job["region"],
                        "addressCountry": "NG",
                    },
                },
            }
        ),
        "directApply": True,
        "url": SITE_URL + job["url"],
    }
    # Optional fields: only written when the job actually states them.
    if job.get("streetAddress") and not job.get("remote"):
        schema["jobLocation"]["address"] = {
            "@type": "PostalAddress",
            "streetAddress": job["streetAddress"],
            **{k: v for k, v in schema["jobLocation"]["address"].items() if k != "@type"},
        }
    if job.get("experienceMonths"):
        schema["experienceRequirements"] = {"@type": "OccupationalExperienceRequirements", "monthsOfExperience": job["experienceMonths"]}
    if job.get("industry"):
        schema["industry"] = job["industry"]
    schema["validThrough"] = job["validThrough"]
    if job.get("salary"):
        s = job["salary"]
        schema["baseSalary"] = {
            "@type": "MonetaryAmount",
            "currency": s["currency"],
            "value": {"@type": "QuantitativeValue", "value": s["value"], "unitText": s["unit"]},
        }
    if job.get("benefits"):
        schema["jobBenefits"] = " ".join(job["benefits"])
    return schema


def apply_job_page_state(data, job):
    """Show the closing date on an open job's page. Once the job has closed,
    replace the application form with a notice (Google requires that a job
    which is no longer open does not keep job markup or a live application)."""
    hero = data.setdefault("hero", {})
    if job["state"] == "open":
        hero["sub"] = (hero.get("sub", "") + f" Closing date: {format_long_date(job['closingDate'])}.").strip()
        return
    hero["eyebrow"] = "Position Closed"
    hero["sub"] = "Applications for this role have closed. See our other open roles on the careers page."
    data["sections"] = [sec for sec in data.get("sections", []) if sec.get("type") != "form"]
    # No form left on the page, so the spam-guard / apply scripts are not needed.
    data["scripts"] = [sc for sc in data.get("scripts", []) if "apply" not in sc and "form-guard" not in sc]


def mark_careers_cards(data, all_jobs):
    """On the careers hub, show each open job's closing date and turn the card
    of a closed or expired job into a disabled, greyed-out 'Closed' card."""
    by_url = {j["url"]: j for j in all_jobs}
    for sec in data.get("sections", []):
        if sec.get("type") != "job-cards":
            continue
        for card in sec.get("jobs", []):
            job = by_url.get(card.get("href"))
            if not job:
                continue
            if job["state"] == "open":
                card["closing"] = "Closes " + job["closingDate"].strftime("%d %b %Y").lstrip("0")
            else:
                card["active"] = False
                card["cta_label"] = "Closed"


def build_careers_collection_schema(open_jobs, meta):
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Careers at " + SITE_NAME,
        "description": meta.get("description", ""),
        "url": SITE_URL + "/apply/",
        "publisher": {"@id": SITE_URL + "/#organization"},
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": len(open_jobs),
            "itemListElement": [
                {"@type": "ListItem", "position": i, "url": SITE_URL + j["url"], "name": j["title"] + (" - Remote" if j.get("remote") else " - " + j["locality"] + ", Abuja")}
                for i, j in enumerate(open_jobs, 1)
            ],
        },
    }


def write_job_feeds(open_jobs):
    """/jobs.json (for AI tools and any site that reads JSON) and /jobs.xml
    (generic job-board XML feed). Built from jobs.json only, so they can never
    disagree with the structured data on the pages. No build timestamp is
    written, so rebuilding without changes produces identical files."""
    updated = max((j["datePosted"] for j in open_jobs), default="")
    feed = {
        "publisher": {"name": SITE_NAME, "url": SITE_URL + "/", "logo": SITE_LOGO},
        "careersPage": SITE_URL + "/apply/",
        "lastUpdated": updated,
        "jobs": [],
    }
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', "<source>",
           f"  <publisher>{xml_escape(SITE_NAME)}</publisher>",
           f"  <publisherurl>{SITE_URL}/</publisherurl>",
           f"  <lastBuildDate>{updated}</lastBuildDate>"]
    for j in open_jobs:
        s = j.get("salary")
        feed["jobs"].append({
            "id": j["id"],
            "title": j["title"],
            "url": SITE_URL + j["url"],
            "applyUrl": SITE_URL + j["url"],
            "company": SITE_NAME,
            "location": (
                {"remote": True, "country": "Nigeria", "countryCode": "NG"}
                if j.get("remote")
                else {"city": j["locality"], "state": REGION_NAMES.get(j["region"], j["region"]), "country": "Nigeria", "countryCode": "NG"}
            ),
            "employmentType": j.get("employmentType"),
            "datePosted": j["datePosted"],
            "validThrough": j["validThrough"],
            "salary": ({"currency": s["currency"], "amount": s["value"], "period": s["unit"], "display": job_salary_text(j)} if s else None),
            "description": job_description_text(j),
            "responsibilities": j.get("responsibilities", []),
            "qualifications": j.get("qualifications", []),
            "benefits": j.get("benefits", []),
        })
        # Optional details, only present when the job states them.
        if j.get("streetAddress") and not j.get("remote"):
            feed["jobs"][-1]["location"]["streetAddress"] = j["streetAddress"]
        if j.get("workArrangement"):
            feed["jobs"][-1]["workArrangement"] = j["workArrangement"]
        if j.get("industry"):
            feed["jobs"][-1]["industry"] = j["industry"]
        xml += ["  <job>",
                f"    <title><![CDATA[{j['title']}]]></title>",
                f"    <date><![CDATA[{j['datePosted']}]]></date>",
                f"    <referencenumber><![CDATA[{j['id']}]]></referencenumber>",
                f"    <url><![CDATA[{SITE_URL + j['url']}]]></url>",
                f"    <company><![CDATA[{SITE_NAME}]]></company>",
                f"    <expirationdate><![CDATA[{j['closingDate'].isoformat()}]]></expirationdate>",
                *(
                    ["    <remote><![CDATA[true]]></remote>"]
                    if j.get("remote")
                    else [f"    <city><![CDATA[{j['locality']}]]></city>", f"    <state><![CDATA[{j['region']}]]></state>"]
                ),
                "    <country><![CDATA[NG]]></country>",
                f"    <description><![CDATA[{job_description_html(j)}]]></description>"]
        if s:
            xml.append(f"    <salary><![CDATA[{job_salary_text(j)}]]></salary>")
        if j.get("employmentType"):
            xml.append(f"    <jobtype><![CDATA[{JOB_TYPE_XML.get(j['employmentType'], 'fulltime')}]]></jobtype>")
        xml.append("  </job>")
    xml.append("</source>")
    write(DIST / "jobs.json", json.dumps(feed, indent=2, ensure_ascii=False) + "\n")
    write(DIST / "jobs.xml", "\n".join(xml) + "\n")


# ---------------------------------------------------------------------------
# Article feeds. /feed.xml is an RSS 2.0 feed of the newest articles (blogs,
# readers and aggregators subscribe to it). /news-sitemap.xml is a Google News
# sitemap: it lists only articles marked schema_type "NewsArticle" (press
# releases / company news) published in the last 2 days, which is all Google
# News reads. The nightly rebuild keeps both current, and no build timestamp is
# written, so rebuilding without changes produces identical files.
# ---------------------------------------------------------------------------
FEED_ITEMS = 20
NEWS_WINDOW_DAYS = 2


def collect_articles():
    """Every article page (article.html template) with its publish date, newest first."""
    items = []
    for folder in ("articles", "pages"):
        d = CONTENT / folder
        if not d.exists():
            continue
        for p in sorted(d.glob("*.json")):
            a = load(p)
            route = a.get("_route", {})
            if route.get("template") != "article.html":
                continue
            byline = a.get("byline", {})
            day = parse_byline_date(byline.get("date"))
            if not day:
                continue
            stamp = byline.get("datetime") or day + "T09:00:00+01:00"
            items.append({
                "url": SITE_URL + route["url"],
                "title": a.get("title") or a.get("meta", {}).get("title", ""),
                "description": a.get("meta", {}).get("description") or strip_html(a.get("dek", "")),
                "tag": a.get("tag", ""),
                "author": byline.get("author") or SITE_NAME,
                "image": a.get("image") or a.get("meta", {}).get("image"),
                "day": day,
                "datetime": datetime.fromisoformat(stamp),
                "news": a.get("schema_type") == "NewsArticle",
            })
    items.sort(key=lambda i: (i["datetime"], i["url"]), reverse=True)
    return items



def _plain(text):
    """Strip HTML tags/entities and collapse whitespace for the search index."""
    import html as _html, re as _re
    text = _re.sub(r"<[^>]+>", " ", str(text or ""))
    return _re.sub(r"\s+", " ", _html.unescape(text)).strip()


def _article_body_text(art, header=True):
    """Flatten an article JSON into plain text for full-text search.
    header=False leaves out the tag/title/byline lines (used for result snippets)."""
    parts = []
    if header:
        by = art.get("byline") or {}
        parts += [art.get("tag"), art.get("title"), by.get("author"), by.get("date"), by.get("read_time")]
    parts += [art.get("dek")]
    for sec in art.get("sections", []):
        parts += [sec.get("heading"), sec.get("eyebrow"), sec.get("text")]
        parts += sec.get("paragraphs", []) or []
        for it in sec.get("list", []) or []:
            parts += [it.get("b"), it.get("t")] if isinstance(it, dict) else [it]
        for it in sec.get("items", []) or []:
            if isinstance(it, dict):
                parts += [it.get("label"), it.get("value"), it.get("text")]
    for ent in (art.get("faq") or {}).get("entries", []):
        parts += [ent.get("q"), ent.get("a")]
    return " ".join(x for x in (_plain(p) for p in parts) if x)


def build_search_index(header=True):
    """One entry per article in articles-index.json (same order)."""
    index = load(CONTENT / "articles-index.json")
    out = []
    for card in index:
        slug = card["url"].strip("/").split("/")[-1]
        f = CONTENT / "articles" / f"{slug}.json"
        body = _article_body_text(load(f), header) if f.exists() else ""
        out.append({
            "url": card["url"],
            "title": card["title"],
            "category": card.get("category", ""),
            "tag": card.get("tag", ""),
            "excerpt": card.get("excerpt", ""),
            "read_time": card.get("read_time", ""),
            "image": card.get("image", ""),
            "body": body,
        })
    return out


# ---------------------------------------------------------------------------
# Site-wide search index (/site-search-index.json)
# ---------------------------------------------------------------------------
# Built AFTER every page has been rendered: the finished HTML in dist/ is
# crawled, so any page that is published is searchable automatically (no list
# to maintain). Pages marked noindex (and /search/ itself) are left out, as are
# the application pages of roles that are closed or past their closing date.
# SEARCH_KEYWORDS adds plain-language words a visitor might type for a page
# that the page text itself does not contain (e.g. "jobs" for the careers hub).
SEARCH_KEYWORDS = {
    "/": "home traction outsourcing nigeria overview",
    "/apply/": "careers jobs job vacancies vacancy openings work with us employment hiring apply recruitment",
    "/book-a-call/": "contact us call consultation appointment strategy call whatsapp phone email enquiry",
    "/resources/": "download downloads ebook e-book book template free documents guide pdf excel",
    "/articles/": "blog insights news press stories read",
    "/partnerships/": "partner partners partnership collaborate affiliate",
    "/services/staff-outsourcing/": "payroll hr human resources outsourcing staffing manpower employees hmo",
    "/services/employee-training/": "training trainings workshop workshops course courses learning staff development coaching class classes",
    "/services/events/": "events event retreat retreats class classes online class webinar webinars training seminar register registration",
    "/services/startup-structuring/": "startup start-up company registration cac structure organogram investor",
    "/services/corporate-restructuring/": "restructuring restructure turnaround reorganization organogram merger",
    "/services/business-advisory/": "advisory consulting consultant strategy business growth",
    "/brands/recruiters/": "recruitment recruiting recruiter hire hiring talent staffing placement ath",
    "/brands/properties/": "real estate property properties land house houses rent buy sale estate",
}

SEARCH_TITLE_SUFFIX = re.compile(r"\s*[|–—-]\s*Traction Outsourcing(?: Limited)?\s*$", re.I)


class _PageText(HTMLParser):
    """Pull the title, description, headings and visible <main> text out of a page."""
    SKIP = {"script", "style", "noscript", "svg", "form", "select", "option",
            "textarea", "button", "nav", "header", "footer", "template"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.desc = ""
        self.noindex = False
        self.h = []
        self.h1 = ""
        self.body = []
        self._in_title = False
        self._in_main = False
        self._skip = 0
        self._heading = None
        self._hbuf = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            n = (a.get("name") or "").lower()
            if n == "description":
                self.desc = a.get("content") or ""
            elif n == "robots" and "noindex" in (a.get("content") or "").lower():
                self.noindex = True
        elif tag == "main":
            self._in_main = True
        if tag in self.SKIP:
            self._skip += 1
        if self._in_main and not self._skip and tag in ("h1", "h2", "h3"):
            self._heading, self._hbuf = tag, []

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "main":
            self._in_main = False
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        if self._heading == tag:
            t = " ".join("".join(self._hbuf).split())
            if t:
                self.h.append(t)
                if tag == "h1" and not self.h1:
                    self.h1 = t
            self._heading = None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if not self._in_main or self._skip:
            return
        if self._heading:
            self._hbuf.append(data)
        t = " ".join(data.split())
        if t:
            self.body.append(t)


def _search_type(url):
    if url == "/":
        return "Page"
    if url.startswith("/services/events/"):
        return "Event"
    if url.startswith("/services/"):
        return "Service"
    if url == "/apply/":
        return "Careers"
    if url.startswith("/apply/"):
        return "Job"
    if url.startswith("/brands/"):
        return "Brand"
    if url.startswith("/partnerships"):
        return "Partnership"
    if url.startswith("/resources"):
        return "Resource"
    return "Page"


def build_site_search_index():
    """Every public page, article and downloadable resource as one list."""
    inactive_jobs = {j["url"] for j in load_all_jobs() if j["state"] != "open"}
    entries = []

    # Articles: richer data (excerpt, tag, full body) than a page crawl gives.
    for a in build_search_index(header=False):
        entries.append({
            "u": a["url"], "t": a["title"], "k": "Article", "d": a["excerpt"],
            "h": a["tag"], "kw": "", "b": a["body"][:12000],
        })

    # Every other page: crawl the rendered HTML.
    for f in sorted(DIST.rglob("index.html")):
        url = "/" + f.parent.relative_to(DIST).as_posix() + "/"
        if url == "/./":
            url = "/"
        if url == "/search/" or url in inactive_jobs:
            continue
        if url.startswith("/articles/") and url != "/articles/":
            continue  # individual articles are added above
        p = _PageText()
        p.feed(f.read_text(encoding="utf-8"))
        if p.noindex:
            continue
        title = SEARCH_TITLE_SUFFIX.sub("", " ".join(p.title.split()))
        title = re.sub(r"\s*\|\s*Traction Outsourcing(?: Limited)?\s*$", "", title)
        body = " ".join(p.body)
        if url == "/articles/":
            body = ""  # just a list of the article cards; articles are indexed on their own
        # Result title = the first part of the SEO title (before " | "), which
        # names the page plainly; the rest of the title and the on-page
        # headings stay searchable through the headings field.
        parts = [x.strip() for x in title.split(" | ")]
        shown = parts[0] or p.h1
        heads = list(dict.fromkeys(parts[1:] + p.h))
        entries.append({
            "u": url, "t": shown, "k": _search_type(url), "d": " ".join(p.desc.split()),
            "h": " | ".join(heads), "kw": SEARCH_KEYWORDS.get(url, ""),
            "b": body[:12000],
        })

    # Downloadable resources (books, templates): one entry each.
    res_page = CONTENT / "pages" / "resources.json"
    if res_page.exists():
        for sec in load(res_page).get("sections", []):
            if sec.get("type") != "resource-grid":
                continue
            items = list(sec.get("entries", []))
            if isinstance(sec.get("featured"), dict):
                items.append(sec["featured"])
            for r in items:
                if not r.get("title"):
                    continue
                entries.append({
                    "u": "/resources/", "t": r["title"], "k": "Resource",
                    "d": r.get("description", ""), "h": r.get("category", ""),
                    "kw": "download free " + ("paid " if r.get("resource_type") == "paid" else "")
                          + "document template ebook", "b": "",
                })
    return entries


def write_article_feeds():
    items = collect_articles()
    newest = items[0]["datetime"] if items else None
    rss = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">',
           "  <channel>",
           f"    <title>{xml_escape(SITE_NAME)}: Articles and News</title>",
           f"    <link>{SITE_URL}/articles/</link>",
           "    <description>Company news, press releases and expert articles on HR, outsourcing, recruitment and business structure in Nigeria from Traction Outsourcing Limited.</description>",
           "    <language>en</language>",
           f'    <atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>',
           "    <image>",
           f"      <url>{SITE_LOGO}</url>",
           f"      <title>{xml_escape(SITE_NAME)}</title>",
           f"      <link>{SITE_URL}/</link>",
           "    </image>"]
    if newest:
        rss.append(f"    <lastBuildDate>{format_datetime(newest)}</lastBuildDate>")
    for it in items[:FEED_ITEMS]:
        image = SITE_URL + it["image"] if it["image"] and it["image"].startswith("/") else it["image"]
        rss += ["    <item>",
                f"      <title>{xml_escape(it['title'])}</title>",
                f"      <link>{it['url']}</link>",
                f'      <guid isPermaLink="true">{it["url"]}</guid>',
                f"      <pubDate>{format_datetime(it['datetime'])}</pubDate>",
                f"      <dc:creator>{xml_escape(it['author'])}</dc:creator>",
                f"      <category>{xml_escape(it['tag'])}</category>",
                f"      <description>{xml_escape(it['description'])}</description>"]
        if image:
            rss.append(f'      <media:content url="{image}" medium="image"/>')
        rss.append("    </item>")
    rss += ["  </channel>", "</rss>"]
    write(DIST / "feed.xml", "\n".join(rss) + "\n")

    today = today_wat()
    news = [i for i in items if i["news"] and 0 <= (today - i["datetime"].date()).days < NEWS_WINDOW_DAYS]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">']
    for it in news:
        sm += ["  <url>",
               f"    <loc>{it['url']}</loc>",
               "    <news:news>",
               "      <news:publication>",
               f"        <news:name>{xml_escape(SITE_NAME)}</news:name>",
               "        <news:language>en</news:language>",
               "      </news:publication>",
               f"      <news:publication_date>{it['datetime'].isoformat()}</news:publication_date>",
               f"      <news:title>{xml_escape(it['title'])}</news:title>",
               "    </news:news>",
               "  </url>"]
    sm.append("</urlset>")
    write(DIST / "news-sitemap.xml", "\n".join(sm) + "\n")


def write(path: Path, html: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")
    print(f"  built {path.relative_to(DIST)}")


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
    # derived from its URL, a BlogPosting block if it's rendered through
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

    if route["template"] == "article.html" and not existing_types & {"Article", "BlogPosting", "NewsArticle"}:
        schema.append(build_article_schema(data, route))

    if "FAQPage" not in existing_types:
        faqpage = build_faqpage_schema(data)
        if faqpage:
            schema.append(faqpage)

    if "RealEstateListing" not in existing_types:
        schema.extend(build_realestate_listing_schema(data, route))

    # Careers: JobPosting on each open job's page, and an ItemList of all open
    # jobs on the careers hub. Driven by content/jobs.json. A job past its
    # closing date (or switched off by hand) loses its markup and its form.
    all_jobs = load_all_jobs()
    open_jobs = [j for j in all_jobs if j["state"] == "open"]
    job = next((j for j in all_jobs if j["url"] == route["url"]), None)
    if job:
        apply_job_page_state(data, job)
        if job["state"] == "open" and "JobPosting" not in existing_types:
            schema.append(build_jobposting_schema(job))
    if route["url"] == "/apply/":
        mark_careers_cards(data, all_jobs)
        if "CollectionPage" not in existing_types:
            schema.append(build_careers_collection_schema(open_jobs, data.get("meta", {})))

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
    # Generated from the article JSON files + articles-index.json, so a new
    # article is searchable the moment it is built (nothing to hand-maintain).
    search_index = build_search_index()
    write(DIST / "search-index.json", json.dumps(search_index, ensure_ascii=False))

    # ---- Every individual article json ----
    articles_dir = CONTENT / "articles"
    if articles_dir.exists():
        for p in sorted(articles_dir.glob("*.json")):
            render_json_page(p)

    # ---- Job feeds (jobs.json / jobs.xml) ----
    write_job_feeds(load_open_jobs())

    # ---- Site-wide search index (must run last: it reads the finished pages) ----
    site_index = build_site_search_index()
    write(DIST / "site-search-index.json",
          json.dumps(site_index, ensure_ascii=False, separators=(",", ":")))
    print(f"  built site-search-index.json ({len(site_index)} entries)")

    # ---- Article feeds (feed.xml / news-sitemap.xml) ----
    write_article_feeds()

    print(f"\nBuild complete -> {DIST}")


if __name__ == "__main__":
    main()
