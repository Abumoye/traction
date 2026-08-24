# T-ICR 2026 Registration & Affiliate — New Sheet & Script Setup Guide

This is a **brand new, standalone** Google Sheet and Apps Script Web App,
separate from the "Traction Outsourcing Leads" sheet used by the other
forms on the site. It powers two pages:

- `/events/register/` — 4-field registration form ("Proceed to Payment"),
  which emails a PDF invoice from **t-icr@tolnigeria.com**.
- `/events/affiliate/` — affiliate sign-up form, which auto-assigns a code
  like `aff/tol/001/26` and emails it to the affiliate.

Both forms post to the **same** Web App URL (one script, one deployment),
routed internally by a `formType` field — so you only need to do this setup
once and paste one URL into two files at the end.

## What you will end up with

- A new Google Sheet (name it whatever you like, e.g. **T-ICR 2026
  Registrations & Affiliates**).
- Two tabs: **Registrations** and **Affiliates**.
- A new Apps Script project deployed as a Web App, with its own URL.

## Step 1: Create the Sheet and tabs

1. Go to [sheets.google.com](https://sheets.google.com) and create a new
   spreadsheet. Name it **T-ICR 2026 Registrations & Affiliates**.
2. Rename the first tab (bottom left) to **Registrations**. In row 1, add
   these headers exactly, one per column:
   `Timestamp | Full Name | Phone | Email | Referral Code | Tier | Amount (NGN) | Amount (USD)`
3. Add a second tab called **Affiliates**. In row 1, add these headers
   exactly:
   `Timestamp | Affiliate Code | Name | Gender | Age | Email | Phone | Bank Name | Account Number | Account Name`

## Step 2: Add the Apps Script

1. In the Sheet, go to **Extensions → Apps Script**.
2. Delete anything in the editor and paste the code below.
3. Click the save icon, name the project **T-ICR 2026 Events Handler**.

```javascript
var HELP_LINE = "0704 708 2697";

// ---- T-ICR 2026 pricing ----
var EARLY_BIRD_PRICE_NGN = 3550000;
var EARLY_BIRD_PRICE_USD = 2600;
var STANDARD_PRICE_NGN = 5000000;
var STANDARD_PRICE_USD = 3665;
var EARLY_BIRD_CAP = 30; // first 30 registrations get the Early Bird rate
var EARLY_BIRD_DEADLINE = new Date('2026-08-31T23:59:59+01:00'); // 31 Aug 2026, WAT
var REGISTRATION_CLOSE = new Date('2026-11-01T23:59:59+01:00'); // 1 Nov 2026, WAT

// ---- Payment details shown on the invoice ----
var NGN_BANK_NAME = "Providus Bank PLC";
var NGN_ACCOUNT_NUMBER = "1307188028";
var NGN_ACCOUNT_NAME = "Traction Outsourcing Limited";
var USD_PAYMENT_NOTE = "For USD payment, reply to this email or reach us on WhatsApp (" + HELP_LINE + ") and our team will send dollar transfer details.";

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: 'No form data received. This function only works when called from the website form, not when run manually in the editor.' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var data = JSON.parse(e.postData.contents);

  if (data.formType === 'event-affiliate') {
    return handleEventAffiliate(data);
  }

  return handleEventRegistration(data);
}

/* ============================= REGISTRATION ============================= */

function handleEventRegistration(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registrations');

  var name = (data.name || '').toString().trim();
  var phone = (data.phone || '').toString().trim();
  var email = (data.email || '').toString().trim();
  var referral = (data.referral || '').toString().trim();

  var now = new Date();

  if (now > REGISTRATION_CLOSE) {
    sheet.appendRow([now, name, phone, email, referral, 'Closed — late submission', '', '']);
    sendRegistrationClosedEmail(name, email);
    MailApp.sendEmail({
      to: "tractionoutsourcing@gmail.com",
      subject: "Late T-ICR 2026 Registration (after close): " + name,
      body: "Name: " + name + "\nPhone: " + phone + "\nEmail: " + email + "\nReferral: " + (referral || "None") +
            "\n\nThis came in after the November 1, 2026 registration close date. They were told registration is closed."
    });
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'success' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var pricing = getCurrentTicketPricing(sheet, now);

  sheet.appendRow([now, name, phone, email, referral, pricing.tier, pricing.ngn, pricing.usd]);

  sendEventInvoiceEmail(name, phone, email, referral, pricing);

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success' })
  ).setMimeType(ContentService.MimeType.JSON);
}

function getCurrentTicketPricing(sheet, now) {
  var rowCount = Math.max(sheet.getLastRow() - 1, 0); // minus header, prior registrations only
  var earlyBirdOpen = now <= EARLY_BIRD_DEADLINE && rowCount < EARLY_BIRD_CAP;
  if (earlyBirdOpen) {
    return { tier: 'Early Bird', ngn: EARLY_BIRD_PRICE_NGN, usd: EARLY_BIRD_PRICE_USD };
  }
  return { tier: 'Standard', ngn: STANDARD_PRICE_NGN, usd: STANDARD_PRICE_USD };
}

function formatNaira(n) { return "₦" + n.toLocaleString('en-NG'); }
function formatUsd(n) { return "$" + n.toLocaleString('en-US'); }

function sendEventInvoiceEmail(name, phone, email, referral, pricing) {
  var html = buildInvoiceHtml(name, phone, email, referral, pricing);
  var pdf = Utilities.newBlob(html, 'text/html', 'invoice.html').getAs('application/pdf');
  pdf.setName('T-ICR-2026-Invoice-' + name.replace(/\s+/g, '-') + '.pdf');

  var body = "Hi " + name + ",\n\n" +
    "Thank you for registering for the Traction Outsourcing International Corporate Retreat (T-ICR) 2026 in Kigali, Rwanda.\n\n" +
    "Your invoice is attached as a PDF. It shows the amount due at the " + pricing.tier + " rate — " +
    formatNaira(pricing.ngn) + " or " + formatUsd(pricing.usd) + " — along with our account details for payment.\n\n" +
    "Once you have made payment, please reply directly to this email with your payment receipt attached, so our team can confirm your registration.\n\n" +
    "If you have any questions, reach our Help Line: " + HELP_LINE + " (WhatsApp).\n\n" +
    "We look forward to seeing you in Kigali.\n\n" +
    "Traction Outsourcing Limited\nt-icr@tolnigeria.com";

  GmailApp.sendEmail(email, "Your T-ICR 2026 Registration & Invoice", body, {
    from: "t-icr@tolnigeria.com",
    name: "Traction Outsourcing — T-ICR 2026",
    replyTo: "t-icr@tolnigeria.com",
    attachments: [pdf]
  });

  // Notify the team too
  MailApp.sendEmail({
    to: "tractionoutsourcing@gmail.com",
    subject: "New T-ICR 2026 Registration: " + name,
    body: "Name: " + name + "\nPhone: " + phone + "\nEmail: " + email +
          "\nReferral: " + (referral || "None") + "\nTier: " + pricing.tier +
          "\nAmount: " + formatNaira(pricing.ngn) + " / " + formatUsd(pricing.usd)
  });
}

function sendRegistrationClosedEmail(name, email) {
  var body = "Hi " + name + ",\n\n" +
    "Thank you for your interest in the Traction Outsourcing International Corporate Retreat (T-ICR) 2026.\n\n" +
    "Registration closed on November 1, 2026, so we're unable to process this submission automatically. " +
    "If you'd like to check for a late spot, please reach our Help Line: " + HELP_LINE + " (WhatsApp).\n\n" +
    "Traction Outsourcing Limited";

  GmailApp.sendEmail(email, "T-ICR 2026 Registration — Registration Closed", body, {
    from: "t-icr@tolnigeria.com",
    name: "Traction Outsourcing — T-ICR 2026",
    replyTo: "t-icr@tolnigeria.com"
  });
}

function buildInvoiceHtml(name, phone, email, referral, pricing) {
  var today = Utilities.formatDate(new Date(), 'Africa/Lagos', 'MMMM d, yyyy');
  return '<html><body style="font-family:Arial,sans-serif;color:#1d1d1f;padding:30px;">' +
    '<h1 style="color:#d35400;margin-bottom:0;">Traction Outsourcing Limited</h1>' +
    '<h2 style="margin-top:4px;">T-ICR 2026 Registration Invoice</h2>' +
    '<p>Date: ' + today + '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-top:20px;">' +
      '<tr><td style="padding:6px 0;width:40%;"><strong>Full Name</strong></td><td>' + name + '</td></tr>' +
      '<tr><td style="padding:6px 0;"><strong>Phone</strong></td><td>' + phone + '</td></tr>' +
      '<tr><td style="padding:6px 0;"><strong>Email</strong></td><td>' + email + '</td></tr>' +
      '<tr><td style="padding:6px 0;"><strong>Referral Code</strong></td><td>' + (referral || '—') + '</td></tr>' +
      '<tr><td style="padding:6px 0;"><strong>Ticket Tier</strong></td><td>' + pricing.tier + '</td></tr>' +
    '</table>' +
    '<h3 style="margin-top:30px;">Amount Due</h3>' +
    '<p style="font-size:22px;font-weight:bold;">' + formatNaira(pricing.ngn) +
      ' <span style="font-size:15px;font-weight:normal;">(or ' + formatUsd(pricing.usd) + ')</span></p>' +
    '<h3 style="margin-top:30px;">Payment Instructions</h3>' +
    '<table style="width:100%;border-collapse:collapse;">' +
      '<tr><td style="padding:6px 0;width:40%;"><strong>Account Name</strong></td><td>' + NGN_ACCOUNT_NAME + '</td></tr>' +
      '<tr><td style="padding:6px 0;"><strong>Bank</strong></td><td>' + NGN_BANK_NAME + '</td></tr>' +
      '<tr><td style="padding:6px 0;"><strong>Account Number (NGN)</strong></td><td>' + NGN_ACCOUNT_NUMBER + '</td></tr>' +
    '</table>' +
    '<p style="margin-top:14px;font-size:13.5px;">' + USD_PAYMENT_NOTE + '</p>' +
    '<p style="margin-top:20px;">Once payment has been made, please <strong>reply to the email this invoice was attached to, with your payment receipt attached</strong>, so our team can confirm your registration.</p>' +
    '<p>For questions, reach our Help Line: <strong>' + HELP_LINE + '</strong> (WhatsApp).</p>' +
    '<p style="margin-top:30px;color:#6e6e73;font-size:12px;">Traction Outsourcing Limited — t-icr@tolnigeria.com</p>' +
    '</body></html>';
}

/* =============================== AFFILIATE =============================== */

function handleEventAffiliate(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Affiliates');

  var name = (data.name || '').toString().trim();
  var gender = (data.gender || '').toString().trim();
  var age = (data.age || '').toString().trim();
  var email = (data.email || '').toString().trim();
  var phone = (data.phone || '').toString().trim();
  var bankName = (data.bankName || '').toString().trim();
  var accountNumber = (data.accountNumber || '').toString().trim();
  var accountName = (data.accountName || '').toString().trim();

  // Header row is row 1, so the row count before this append equals the
  // number of affiliates already on record — a clean, never-resetting
  // sequential number.
  var seq = sheet.getLastRow();
  var yearSuffix = Utilities.formatDate(new Date(), 'Africa/Lagos', 'yy');
  var code = 'aff/tol/' + ('00' + seq).slice(-3) + '/' + yearSuffix;

  sheet.appendRow([new Date(), code, name, gender, age, email, phone, bankName, accountNumber, accountName]);

  MailApp.sendEmail({
    to: email,
    subject: "Your Traction Outsourcing Affiliate Code",
    body: "Hi " + name + ",\n\nWelcome! You are now registered as a Traction Outsourcing affiliate for the T-ICR 2026.\n\n" +
          "Your unique affiliate code is: " + code + "\n\nShare this code with prospective delegates. Our team will be in touch with more details on how referrals are tracked and rewarded.\n\nTraction Outsourcing Limited"
  });

  MailApp.sendEmail({
    to: "tractionoutsourcing@gmail.com",
    subject: "New T-ICR 2026 Affiliate: " + name + " (" + code + ")",
    body: "Name: " + name + "\nGender: " + gender + "\nAge: " + age + "\nEmail: " + email + "\nPhone: " + phone +
          "\nBank: " + bankName + "\nAccount Number: " + accountNumber + "\nAccount Name: " + accountName +
          "\nCode: " + code
  });

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success', code: code })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

## Step 3: Confirm the send-as alias

`GmailApp.sendEmail(...)` in the script sends the invoice and the
"registration closed" email `from: "t-icr@tolnigeria.com"`. This only
works if **t-icr@tolnigeria.com is added and verified as a "Send As"
alias** on the same Google account you deploy this Apps Script project
from (Gmail → Settings → See all settings → Accounts and Import → Send
mail as). If it isn't set up as a send-as alias on that specific account,
Gmail silently falls back to sending from the account's own address
instead of t-icr@tolnigeria.com — so check this before relying on it.

## Step 4: Deploy it as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me (your account)
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Google will ask you to authorize the script — click through the
   permission screens (it will warn you it's an unverified app, since
   this is your own personal script, not a published product; click
   **Advanced → Go to T-ICR 2026 Events Handler (unsafe)** to proceed —
   normal and expected for scripts you write yourself).
6. Copy the **Web app URL** it gives you. It looks like:
   `https://script.google.com/macros/s/XXXXXXXXXXXX/exec`

## Step 5: Wire it into the site

Open both of these files in the repo and replace the placeholder with your
copied URL in each:

- `/js/event-registration.js`
- `/js/event-affiliate.js`

```javascript
const EVENT_REGISTRATION_SCRIPT_URL = "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL";
```
becomes
```javascript
const EVENT_REGISTRATION_SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
```

(Same URL in both files — it's one deployment serving both forms.) Commit
and push, or ask me to rebuild once you've confirmed both changes.

## Redeploying after changes

If you edit the Apps Script code later, you need to create a **new
deployment** (Deploy → Manage deployments → Edit → New version) for the
change to go live — editing the code alone does not update the existing
URL, so nothing needs to change on the website side afterward.

## What's already decided in this script (confirm these are right)

- **Early Bird**: ₦3,550,000 / $2,600, limited to the first 30
  registrations, ending August 31, 2026.
- **Standard**: ₦5,000,000 / $3,665, applies once either limit is passed.
- **Registration closes**: November 1, 2026 — after this, submissions are
  still recorded (tagged "Closed — late submission") but the person gets a
  "registration is closed, contact our Help Line" email instead of an
  invoice, and no price/tier is assigned.
- **Help Line**: 0704 708 2697.
- **NGN payment account**: Providus Bank PLC, account 1307188028, Traction
  Outsourcing Limited — pulled from the site's existing lead-form setup
  doc, so this should already be correct.
- **USD payment account**: none on file. The invoice currently tells
  dollar payers to reply to the email or reach the Help Line to arrange
  transfer details. If you have real USD/domiciliary account details,
  give them to me and I'll add them to `USD_PAYMENT_NOTE` (or you can add
  them directly in the script — it's the one variable near the top).

## Testing it

Submit both forms on the live site (not the Apps Script editor's Run
button — that fails with a "postData" error because it isn't a real form
submission).

For registration, confirm: a new row appears in the **Registrations** tab
with the correct tier/amount, a notification email arrives at
tractionoutsourcing@gmail.com, and an invoice PDF email arrives at the
address you registered with — check it actually shows
**From: t-icr@tolnigeria.com**, not a fallback address, which is the sign
the send-as alias in Step 3 is working.

For the affiliate form, confirm a new row appears in the **Affiliates**
tab with a code like `aff/tol/001/26`, including the bank details you
entered, and that the same code arrives by email at the address submitted.

To test the "registration closed" behavior without waiting until November,
temporarily change `REGISTRATION_CLOSE` near the top of the script to a
date in the past, submit the form once, confirm you get the closed-message
email instead of an invoice, then change it back to
`'2026-11-01T23:59:59+01:00'` and redeploy (new version, per above).
