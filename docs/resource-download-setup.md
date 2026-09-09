# Free Resource Downloads — EmailJS Setup Guide

This connects the "Get Document" / "Get Book" popup on `/resources/` (Full
Name, Email, Download button) to an automatic email containing the direct
download link, using a free client-side email service called EmailJS. No
server and no paid tools required — this site is fully static, so EmailJS
is what lets a plain HTML page send email on its own.

## Two separate EmailJS accounts

The featured book (Nigerian Bosses Are Bad) is deliberately kept separate
from every other resource:

| Group | Used for | Sends from | Replies go to | BCC copy goes to |
|---|---|---|---|---|
| `default` | Every resource except the book (e.g. the Payroll Excel template) | tractionoutsourcing@gmail.com | tractionoutsourcing@gmail.com | tractionoutsourcing@gmail.com |
| `book` | The featured book only | resources.tractionoutsourcing@gmail.com | resources.tractionoutsourcing@gmail.com | resources.tractionoutsourcing@gmail.com |

Each group needs its **own** EmailJS account, service, and template —
follow Steps 1–4 below once for each group, using that group's Gmail
address and inbox throughout.

## What you will end up with

- A visitor clicks "Get Document" or "Get Book" on a resource, enters
  their name and email, and clicks "Download."
- An email is sent immediately to that visitor with the direct download
  link (they are not shown the file inline — it's a straight download).
  The link is the full, absolute URL to the actual file on tolnigeria.com
  (for example `https://tolnigeria.com/downloads/nigerian-payroll-paye-template-2026.xlsx`)
  — clicking it downloads the real file straight from your own site, with
  no third-party service, no view-only page, and no expiration date.
- A copy (BCC) of that same email lands in that group's inbox every time,
  so you can see who requested what.
- Free tier per account: 200 emails/month, no cost, no credit card
  required.

## Step 1: Create an EmailJS account

1. Go to [emailjs.com](https://www.emailjs.com) and sign up for free,
   using the Gmail address for the group you're setting up
   (tractionoutsourcing@gmail.com for `default`,
   resources.tractionoutsourcing@gmail.com for `book`).

## Step 2: Connect an email service

1. In the dashboard, go to **Email Services → Add New Service**.
2. Choose **Gmail** and connect that group's Gmail address.
3. Copy the **Service ID** it gives you (looks like `service_xxxxxxx`).

## Step 3: Create the email template

1. Go to **Email Templates → Create New Template**.
2. Set the **To Email** field to `{{to_email}}`.
3. Set the **From Name** field to `{{from_name}}` (this will send as
   "Traction Outsourcing Limited").
4. Set the **Reply To** field to `{{reply_to}}` (the site fills this in
   per group — tractionoutsourcing@gmail.com for `default`,
   resources.tractionoutsourcing@gmail.com for `book` — so any reply from
   a recipient comes straight back to the right inbox).
5. Set the **BCC** field to that group's own inbox
   (tractionoutsourcing@gmail.com for `default`,
   resources.tractionoutsourcing@gmail.com for `book`). This is what
   sends you a copy of every download notification — it does not cost
   extra, since EmailJS bills per send, not per recipient.
6. In the template body, write your message and use these variables
   wherever you want them to appear:
   - `{{to_name}}` — the visitor's name
   - `{{document_title}}` — which resource they requested
   - `{{document_link}}` — the direct download link

   A simple template body works well, for example:

   ```
   Hi {{to_name}},

   Thanks for requesting "{{document_title}}" from Traction Outsourcing.

   Here is your direct download link:
   {{document_link}}

   If you have any questions, just reply to this email.

   — Traction Outsourcing Limited
   ```

7. Save the template and copy its **Template ID** (looks like
   `template_xxxxxxx`).

## Step 4: Copy your Public Key

1. Go to **Account → General**.
2. Copy your **Public Key**.

## Step 5: Paste the three values into the site

Open `static/js/resource-download.js` and find the
`RESOURCE_EMAILJS_CONFIGS` object near the top of the file. Paste the
Service ID, Template ID, and Public Key from Steps 2–4 into that group's
entry:

```js
const RESOURCE_EMAILJS_CONFIGS = {
    default: {
        serviceId: "service_xxxxxxx",
        templateId: "template_xxxxxxx",
        publicKey: "your_default_public_key_here",
        replyTo: "tractionoutsourcing@gmail.com"
    },
    book: {
        serviceId: "service_xxxxxxx",
        templateId: "template_xxxxxxx",
        publicKey: "your_book_public_key_here",
        replyTo: "resources.tractionoutsourcing@gmail.com"
    }
};
```

Until a group's three values are filled in, resources in that group will
tell visitors the form isn't fully set up yet and point them to WhatsApp
instead — it won't fail silently or look broken, and it won't affect the
other group.

## Adding a new free resource later

1. Put the file in `static/downloads/` (any format works — PDF, Excel,
   Word, etc.; browsers will download most of these automatically rather
   than opening them in a new tab, since there's no `download`-forcing
   trick that survives being pasted into an email — the browser's own
   handling of the file type is what decides this, and PDF/Word/Excel all
   download reliably on their own).
2. Add an entry to the `resource-grid` section's `entries` list in
   `content/pages/resources.json`:

   ```json
   {
     "icon": "fa-file-pdf",
     "title": "Your Document Title",
     "description": "One or two sentences describing what's inside.",
     "cta": "Get Document",
     "file_url": "/downloads/your-file-name.pdf"
   }
   ```

   By default a new entry uses the `default` EmailJS group (same account
   as the Payroll template). To route it through the book's account
   instead, add `"emailjs_group": "book"` to the entry.

3. Rebuild the site. No further EmailJS setup is needed as long as you're
   reusing an existing group's account.
