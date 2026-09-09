# Free Resource Downloads — EmailJS Setup Guide

This connects the "Get Document" / "Get Book" popup on `/resources/` (Full
Name, Email, Download button) to an automatic email containing the direct
download link, using a free client-side email service called EmailJS. No
server and no paid tools required — this site is fully static, so EmailJS
is what lets a plain HTML page send email on its own.

## One EmailJS account, two Email Services/Templates

The featured book (Nigerian Bosses Are Bad) is tracked separately from
every other resource, but everything still runs through the same
tractionoutsourcing@gmail.com EmailJS account and inbox:

| Group | Used for | EmailJS Service/Template | Sends from | Replies go to | BCC copy goes to |
|---|---|---|---|---|---|
| `default` | Every resource except the book (e.g. the Payroll Excel template) | its own Service + Template | tractionoutsourcing@gmail.com | tractionoutsourcing@gmail.com | tractionoutsourcing@gmail.com |
| `book` | The featured book only | its own, separate Service + Template | tractionoutsourcing@gmail.com | tractionoutsourcing@gmail.com | tractionoutsourcing@gmail.com |

Because both groups live in the same EmailJS account, they share one
**Public Key** — only the **Service ID** and **Template ID** differ
between them. Keeping the book on its own Service + Template just means
its confirmation email can be tracked and worded separately (different
subject line, different body copy, separate delivery stats in the EmailJS
dashboard) without touching the working Payroll flow.

## What you will end up with

- A visitor clicks "Get Document" or "Get Book" on a resource, enters
  their name and email, and clicks "Download."
- An email is sent immediately to that visitor with the direct download
  link (they are not shown the file inline — it's a straight download).
  The link is the full, absolute URL to the actual file on tolnigeria.com
  (for example `https://tolnigeria.com/downloads/nigerian-payroll-paye-template-2026.xlsx`)
  — clicking it downloads the real file straight from your own site, with
  no third-party service, no view-only page, and no expiration date.
- A copy (BCC) of that same email lands in tractionoutsourcing@gmail.com
  every time, so you can see who requested what — same inbox for both
  groups.
- Free tier: 200 emails/month across the whole account (shared by both
  groups), no cost, no credit card required.

## Setting up the "book" group's Service + Template

The `default` group (Payroll template, etc.) is already set up and
working. These steps add a second, separate Service + Template inside
that same existing EmailJS account for the book:

### Step 1: Add a second Email Service

1. Log into the existing EmailJS account (tractionoutsourcing@gmail.com).
2. Go to **Email Services → Add New Service**.
3. Choose **Gmail** and connect **tractionoutsourcing@gmail.com** again,
   as a new, separate service (this gives you a second Service ID even
   though it's the same Gmail address as the `default` group).
4. Copy the new **Service ID** it gives you (looks like `service_xxxxxxx`)
   — this will be different from the `default` group's Service ID.

### Step 2: Create a new email template

1. Go to **Email Templates → Create New Template**.
2. Set the **To Email** field to `{{to_email}}`.
3. Set the **From Name** field to `{{from_name}}` (this will send as
   "Traction Outsourcing Limited").
4. Set the **Reply To** field to `{{reply_to}}` (the site sends
   tractionoutsourcing@gmail.com for this value, same as `default`).
5. Set the **BCC** field to `tractionoutsourcing@gmail.com` (same inbox
   as `default`). This is what sends you a copy of every book download —
   it does not cost extra, since EmailJS bills per send, not per
   recipient.
6. In the template body, write your message and use these variables
   wherever you want them to appear:
   - `{{to_name}}` — the visitor's name
   - `{{document_title}}` — which resource they requested (will read
     "Nigerian Bosses Are Bad" for this group)
   - `{{document_link}}` — the direct download link

   You're free to word this template differently from the `default`
   group's — that's the point of having a separate one. A simple
   template body works well, for example:

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

### Step 3: Paste the two new values into the site

Open `static/js/resource-download.js` and find the
`RESOURCE_EMAILJS_CONFIGS` object near the top of the file. Paste the new
Service ID and Template ID from Steps 1–2 into the `book` entry — leave
`publicKey` as-is, since it's the same account as `default` and doesn't
change:

```js
const RESOURCE_EMAILJS_CONFIGS = {
    default: {
        serviceId: "service_1oodwas",
        templateId: "template_crleo3n",
        publicKey: "p_j0hUJOA7fqSRNrK",
        replyTo: "tractionoutsourcing@gmail.com"
    },
    book: {
        serviceId: "service_xxxxxxx",     // <- paste the new Service ID here
        templateId: "template_xxxxxxx",   // <- paste the new Template ID here
        publicKey: "p_j0hUJOA7fqSRNrK",   // same as default — do not change
        replyTo: "tractionoutsourcing@gmail.com"
    }
};
```

Until the `book` group's Service ID and Template ID are filled in, the
book's form will tell visitors it isn't fully set up yet and point them
to WhatsApp instead — it won't fail silently or look broken, and it won't
affect the `default` group (Payroll template, etc.), which keeps working
the whole time.

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

   By default a new entry uses the `default` EmailJS group (same Service
   + Template as the Payroll template). To route it through the book's
   Service + Template instead, add `"emailjs_group": "book"` to the
   entry.

3. Rebuild the site. No further EmailJS setup is needed as long as you're
   reusing an existing group's Service + Template.
