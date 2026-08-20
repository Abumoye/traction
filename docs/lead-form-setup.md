# Lead Form — Google Sheet Setup Guide

> **Update:** Email notifications are now enabled by default and go to
> **tractionoutsourcing@gmail.com**. If you already deployed the script
> before this change, open your Apps Script project, replace the
> `doPost` function with the version below, then create a **new
> deployment version** (Deploy → Manage deployments → Edit → New
> version) so the change actually goes live. Editing the code alone
> does not update an existing deployment.

This connects the small lead form on every `/services/*/` page (Name, Phone
Number, Company Name, Email) to a Google Sheet, using a free Google Apps
Script Web App. No paid tools required.

## What you will end up with

- A Google Sheet called **Traction Outsourcing Leads**, sitting in a Drive
  folder of your choice.
- One tab, **Leads**, with columns: `Timestamp`, `Source Page`, `Name`,
  `Phone Number`, `Company Name`, `Email`.
- Every form submission on the site adds a new row automatically.

If you would rather have a separate tab per service page instead of one
tab with a "Source Page" column, that is also possible. Let me know and I
will adjust the script below. The single-tab version is simpler to read at
a glance and easier to filter, which is why it is the default here.

## Step 1: Create the Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new
   spreadsheet.
2. Name it **Traction Outsourcing Leads**.
3. Rename the first tab (bottom left) to **Leads**.
4. In row 1, add these headers exactly, one per column:
   `Timestamp | Source Page | Name | Phone Number | Company Name | Email`
5. Move this Sheet into whichever Drive folder you want it stored in
   (right-click the file in Drive → Move).

## Step 2: Add the Apps Script

1. In the Sheet, go to **Extensions → Apps Script**.
2. Delete anything in the editor and paste the code below.
3. Click the save icon, name the project **Traction Outsourcing Lead Handler**.

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');

  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: 'No form data received. This function only works when called from the website form, not when run manually in the editor.' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date(),
    data.sourcePage || '',
    data.name || '',
    data.phone || '',
    data.companyName || '',
    data.email || ''
  ]);

  // Email notification for every new lead
  MailApp.sendEmail({
    to: "tractionoutsourcing@gmail.com",
    subject: "New Website Lead: " + (data.name || "Unknown"),
    body: "Page: " + data.sourcePage + "\\nName: " + data.name +
          "\\nPhone: " + data.phone + "\\nCompany: " + data.companyName +
          "\\nEmail: " + data.email
  });

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success' })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

## Step 3: Deploy it as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me (your account)
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Google will ask you to authorize the script. Click through the
   permission screens (it will warn you it is an unverified app, since
   this is a personal script, not a published product. Click **Advanced
   → Go to Traction Outsourcing Lead Handler (unsafe)** to proceed. This
   is normal and expected for scripts you write yourself).
6. Copy the **Web app URL** it gives you. It looks like:
   `https://script.google.com/macros/s/XXXXXXXXXXXX/exec`

## Step 4: Wire it into the site

1. Open `/js/lead-form.js` in the repo.
2. Replace this line:
   ```javascript
   const LEAD_FORM_SCRIPT_URL = "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL";
   ```
   with your copied URL:
   ```javascript
   const LEAD_FORM_SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
   ```
3. Commit and push. Every form on the site will now write to the Sheet.

## Redeploying after changes

If you ever edit the Apps Script code later, you need to create a **new
deployment** (Deploy → Manage deployments → Edit → New version) for the
changes to go live. Editing the code alone does not update the live URL.

## Partnerships Form (optional extra columns)

The form on `/partnerships/` sends two extra fields the service page forms
don't have: `category` (the partnership category the person picked) and
`message` (what they typed about their organization). The script above
will keep working exactly as before even without any changes, it just
won't record those two fields.

To capture them too:

1. In the **Leads** tab, add two more headers to row 1:
   `... | Company Name | Email | Category | Message`
2. In the Apps Script editor, update the `sheet.appendRow([...])` call to:
   ```javascript
   sheet.appendRow([
     new Date(),
     data.sourcePage || '',
     data.name || '',
     data.phone || '',
     data.companyName || '',
     data.email || '',
     data.category || '',
     data.message || ''
   ]);
   ```
3. Create a **new deployment version** (Deploy → Manage deployments →
   Edit → New version), same as any other script change.

Everything else, the Web App URL, the email notification, stays the same.

## Retreat Registration Form — retired

The old nine-field `/events/register/` form (with the receipt file upload)
has been replaced by the four-field T-ICR 2026 registration form below. If
you previously set up the **Kigali Retreat 2026** sheet tab and the
`RECEIPT_FOLDER_ID` / `handleRetreatRegistration` code for it, those can
stay in place for historical records, but the site no longer submits to
them — `js/retreat-registration.js` has been removed from the project.

## T-ICR 2026 Registration Form (/events/register/)

This form collects four fields (Full Name, Phone, Email, Referral Code) and
its button says "Proceed to Payment." Unlike the other forms, it also needs
to send the registrant a PDF invoice by email, from **t-icr@tolnigeria.com**
specifically, with the amount due and payment instructions. It posts to the
**same** Apps Script Web App as everything else, tagged with
`formType: "event-registration"`.

**Before you deploy:** this form works out pricing itself — Early Bird
(₦3,550,000 / $2,150, limited to the first 30 registrations, ending August
31, 2026) automatically switches to Standard (₦5,000,000 / $3,030) once
either limit is hit. This came from your correction of the previously
published flat price, and I read "N3,550" and "3qst August" as shorthand for
₦3,550,000 and a typo for "31st August, 2026" — let me know if either should
be different. The invoice below reuses the Providus Bank account already
used for the old retreat form's Naira payments; there is no USD/domiciliary
account on file yet, so the invoice currently tells USD payers to reach out
directly to arrange transfer details — replace `USD_PAYMENT_NOTE` in the
script with real dollar account details once you have them, or leave it as
is if you'd rather always coordinate USD payments manually.

### Step 1: Add a new sheet tab

In the same **Traction Outsourcing Leads** spreadsheet, add a new tab
called **T-ICR 2026 Registrations**. In row 1, add these headers exactly:

`Timestamp | Full Name | Phone | Email | Referral Code | Tier | Amount (NGN) | Amount (USD)`

### Step 2: Confirm the send-as alias

`GmailApp.sendEmail(...)` below sends the invoice `from: "t-icr@tolnigeria.com"`.
This only works if **t-icr@tolnigeria.com is added and verified as a "Send
As" alias** on the same Google account this Apps Script project is deployed
under (Gmail → Settings → See all settings → Accounts and Import → Send
mail as). You said this mailbox already exists and works — just double
check it's reachable as a send-as alias from this specific account before
relying on it, otherwise Gmail silently falls back to sending from the
account's own address instead.

## T-ICR 2026 Affiliate Sign-Up Form (/events/affiliate/)

This form collects Name, Gender, Age, Email, Phone, State, plus a required
disclaimer checkbox, and auto-assigns a sequential affiliate code in the
format `aff/tol/001/26` (3 digits, never resets across years). It posts to
the same Web App tagged with `formType: "event-affiliate"`.

### Step 1: Add a new sheet tab

In the same spreadsheet, add a tab called **T-ICR 2026 Affiliates**. In row
1, add these headers exactly:

`Timestamp | Affiliate Code | Name | Gender | Age | Email | Phone | State`

### Step 2: Replace the whole Apps Script

Go into **Extensions → Apps Script** on the same project. Delete everything
in the editor and paste this complete version in. If you filled in real USD
account details in Step 1 above, put them in `USD_PAYMENT_NOTE` here too:

```javascript
var HELP_LINE = "0704 708 2697"; // confirm this is the right number — cut off in the original request

// ---- T-ICR 2026 pricing ----
var EARLY_BIRD_PRICE_NGN = 3550000;
var EARLY_BIRD_PRICE_USD = 2150;
var STANDARD_PRICE_NGN = 5000000;
var STANDARD_PRICE_USD = 3030;
var EARLY_BIRD_CAP = 30;
var EARLY_BIRD_DEADLINE = new Date('2026-08-31T23:59:59+01:00');

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

  if (data.formType === 'event-registration') {
    return handleEventRegistration(data);
  }
  if (data.formType === 'event-affiliate') {
    return handleEventAffiliate(data);
  }

  return handleLeadForm(data);
}

function handleLeadForm(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');

  sheet.appendRow([
    new Date(),
    data.sourcePage || '',
    data.name || '',
    data.phone || '',
    data.companyName || '',
    data.email || '',
    data.category || '',
    data.message || ''
  ]);

  MailApp.sendEmail({
    to: "tractionoutsourcing@gmail.com",
    subject: "New Website Lead: " + (data.name || "Unknown"),
    body: "Page: " + data.sourcePage + "\\nName: " + data.name +
          "\\nPhone: " + data.phone + "\\nCompany: " + data.companyName +
          "\\nEmail: " + data.email +
          (data.category ? "\\nCategory: " + data.category : "") +
          (data.message ? "\\nMessage: " + data.message : "")
  });

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success' })
  ).setMimeType(ContentService.MimeType.JSON);
}

function handleEventRegistration(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('T-ICR 2026 Registrations');

  var name = (data.name || '').toString().trim();
  var phone = (data.phone || '').toString().trim();
  var email = (data.email || '').toString().trim();
  var referral = (data.referral || '').toString().trim();

  var pricing = getCurrentTicketPricing(sheet);

  sheet.appendRow([new Date(), name, phone, email, referral, pricing.tier, pricing.ngn, pricing.usd]);

  sendEventInvoiceEmail(name, phone, email, referral, pricing);

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success' })
  ).setMimeType(ContentService.MimeType.JSON);
}

function getCurrentTicketPricing(sheet) {
  var now = new Date();
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

function handleEventAffiliate(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('T-ICR 2026 Affiliates');

  var name = (data.name || '').toString().trim();
  var gender = (data.gender || '').toString().trim();
  var age = (data.age || '').toString().trim();
  var email = (data.email || '').toString().trim();
  var phone = (data.phone || '').toString().trim();
  var state = (data.state || '').toString().trim();

  // Header row is row 1, so the row count before this append equals the
  // number of affiliates already on record — a clean, never-resetting
  // sequential number.
  var seq = sheet.getLastRow();
  var yearSuffix = Utilities.formatDate(new Date(), 'Africa/Lagos', 'yy');
  var code = 'aff/tol/' + ('00' + seq).slice(-3) + '/' + yearSuffix;

  sheet.appendRow([new Date(), code, name, gender, age, email, phone, state]);

  MailApp.sendEmail({
    to: email,
    subject: "Your Traction Outsourcing Affiliate Code",
    body: "Hi " + name + ",\n\nWelcome! You are now registered as a Traction Outsourcing affiliate for the T-ICR 2026.\n\n" +
          "Your unique affiliate code is: " + code + "\n\nShare this code with prospective delegates. Our team will be in touch with more details on how referrals are tracked and rewarded.\n\nTraction Outsourcing Limited"
  });

  MailApp.sendEmail({
    to: "tractionoutsourcing@gmail.com",
    subject: "New T-ICR 2026 Affiliate: " + name + " (" + code + ")",
    body: "Name: " + name + "\nGender: " + gender + "\nAge: " + age + "\nEmail: " + email + "\nPhone: " + phone + "\nState: " + state + "\nCode: " + code
  });

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success', code: code })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

Create a **new deployment version** afterward (Deploy → Manage deployments
→ Edit → New version), same as any other script change. The Web App URL
stays the same, so nothing needs to change in `js/lead-form.js`,
`js/event-registration.js`, or `js/event-affiliate.js`.

## Testing it

Once wired in, submit the form on any service page. Check the Sheet, a
new row should appear within a few seconds. If nothing appears, open the
Apps Script editor, go to **Executions** (left sidebar) to see if the
request came in and whether it threw an error.

**Do not test by clicking the Run ▶ button in the Apps Script editor.**
That calls `doPost()` with no request data, which will show an error
like `Cannot read properties of undefined (reading 'postData')`. This is
expected and does not mean anything is broken, it just means the
function was called outside of a real form submission. Always test by
submitting the actual form on the live website instead.

For the T-ICR 2026 registration form, confirm three things happen: a new
row appears in the **T-ICR 2026 Registrations** tab, a notification email
arrives at tractionoutsourcing@gmail.com, and an invoice PDF email arrives
at the address you registered with, sent from t-icr@tolnigeria.com (check
it actually shows that From address, not a fallback — that's the sign the
send-as alias in Step 2 above is working).

For the affiliate form, confirm a new row appears in the **T-ICR 2026
Affiliates** tab with a code like `aff/tol/001/26`, and that the same code
arrives by email at the address submitted.
