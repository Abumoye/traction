# Free Resource Downloads — EmailJS Setup Guide

This connects the "Get Document" popup on `/books/` (Full Name, Email,
Download button) to an automatic email containing the direct download
link, using a free client-side email service called EmailJS. No server
and no paid tools required — this site is fully static, so EmailJS is
what lets a plain HTML page send email on its own.

## What you will end up with

- A visitor clicks "Get Document" on any free resource, enters their name
  and email, and clicks "Download."
- An email is sent immediately to that visitor with the direct download
  link (they are not shown the file inline — it's a straight download).
- A copy (BCC) of that same email lands in **tractionoutsourcing@gmail.com**
  every time, so you can see who requested what.
- Free tier: 200 emails/month, no cost, no credit card required.

## Step 1: Create an EmailJS account

1. Go to [emailjs.com](https://www.emailjs.com) and sign up for free.

## Step 2: Connect an email service

1. In the dashboard, go to **Email Services → Add New Service**.
2. Choose **Gmail** and connect **tractionoutsourcing@gmail.com**.
3. Copy the **Service ID** it gives you (looks like `service_xxxxxxx`).

## Step 3: Create the email template

1. Go to **Email Templates → Create New Template**.
2. Set the **To Email** field to `{{to_email}}`.
3. Set the **From Name** field to `{{from_name}}` (this will send as
   "Traction Outsourcing Limited").
4. Set the **Reply To** field to `{{reply_to}}` (so any reply from a
   recipient comes straight back to tractionoutsourcing@gmail.com).
5. Set the **BCC** field to `tractionoutsourcing@gmail.com`. This is what
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

Open `static/js/resource-download.js` and fill in these three constants
near the top of the file:

```js
const RESOURCE_EMAILJS_SERVICE_ID = "service_xxxxxxx";
const RESOURCE_EMAILJS_TEMPLATE_ID = "template_xxxxxxx";
const RESOURCE_EMAILJS_PUBLIC_KEY = "your_public_key_here";
```

Until these are filled in, the popup form will tell visitors it isn't
fully set up yet and point them to WhatsApp instead — it won't fail
silently or look broken.

## Adding a new free resource later

1. Put the file in `static/downloads/` (any format works — PDF, Excel,
   Word, etc.; browsers will download most of these automatically rather
   than opening them in a new tab, since there's no `download`-forcing
   trick that survives being pasted into an email — the browser's own
   handling of the file type is what decides this, and PDF/Word/Excel all
   download reliably on their own).
2. Add an entry to the `resource-grid` section's `entries` list in
   `content/pages/books.json`:

   ```json
   {
     "icon": "fa-file-pdf",
     "title": "Your Document Title",
     "description": "One or two sentences describing what's inside.",
     "cta": "Get Document",
     "file_url": "/downloads/your-file-name.pdf"
   }
   ```

3. Rebuild the site. No further EmailJS setup is needed — the same
   template and account handle every resource on the page.
