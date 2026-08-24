# T-ICR 2026 Registration & Affiliate — Google Sheet Setup Guide

This is a **brand new, standalone** Google Sheet and Apps Script Web App,
separate from the "Traction Outsourcing Leads" sheet used by the other
forms on the site. It powers two pages:

- `/events/register/` — 4-field registration form (Full Name, Phone,
  Email, Referral Code).
- `/events/affiliate/` — affiliate sign-up form, which auto-assigns a code
  like `aff/tol/001/26`.

No emails or invoices are sent by either form, and there is **no
automated WhatsApp message**. Every submission is simply saved as a row
in a Google Sheet — that's it. Your team checks the Sheet directly to see
new registrations and affiliate sign-ups.

Both forms post to the **same** Web App URL (one script, one deployment),
routed internally by a `formType` field — so you only need to do this
setup once and paste one URL into two files at the end.

## What you will end up with

- A Google Sheet in the **tractionoutsourcing@gmail.com** Google account,
  with two tabs: **PARTICIPANTS** and **AFFILIATES**.
- A new Apps Script project (bound to that Sheet) deployed as a Web App
  that does nothing but append each submission as a new row.

---

## Part A — The Google Sheet

I already created the Sheet for you, in your **tractionoutsourcing@gmail.com**
account, titled **"T-ICR 2026 Registrations & Affiliates"**:

**[Open the Sheet](https://docs.google.com/spreadsheets/d/1LS6XDHBzbO5AA0y6QJgDWnjKyTyGRim1I-9wRn_2weM/edit)**

I don't have a tool that can add or rename tabs inside an existing
spreadsheet (only whole-file creation), so there are two quick manual
steps left — about 30 seconds total:

1. Open the link above. Rename the first tab (bottom left, currently
   "Sheet1" or similar — double-click it) to **PARTICIPANTS**. It already
   has the header row filled in:
   `Timestamp | Full Name | Phone | Email | Referral Code`
2. Right-click the tab strip → **Insert sheet**, and name the new tab
   **AFFILIATES**. In row 1 of that new tab, add these headers exactly,
   one per column:
   `Timestamp | Affiliate Code | Name | Gender | Age | Email | Phone | Bank Name | Account Number | Account Name`

That's it for the Sheet — no need to create a new one from scratch.

## Part B — Add the Apps Script

I don't have a tool that can create or deploy Apps Script projects either
(no Apps Script API access), so this part is manual too — but it's just
copy-paste:

1. Open the Sheet from Part A, then go to **Extensions → Apps Script**.
   (Doing it from inside this exact Sheet is what binds the script to it —
   no need to enter a Spreadsheet ID anywhere in the code.)
2. Delete anything in the editor and paste the code below.
3. Click the save icon, name the project **T-ICR 2026 Events Handler**.

```javascript
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
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PARTICIPANTS');

  var name = (data.name || '').toString().trim();
  var phone = (data.phone || '').toString().trim();
  var email = (data.email || '').toString().trim();
  var referral = (data.referral || '').toString().trim();

  sheet.appendRow([new Date(), name, phone, email, referral]);

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success' })
  ).setMimeType(ContentService.MimeType.JSON);
}

/* =============================== AFFILIATE =============================== */

function handleEventAffiliate(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AFFILIATES');

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

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success', code: code })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

## Part C — Deploy it as a Web App

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

## Part D — Wire it into the site

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
and push, or send it back to me and I'll rebuild and re-ship it.

## Redeploying after changes

If you edit the Apps Script code later, you need to create a **new
deployment** (Deploy → Manage deployments → Edit → New version) for the
change to go live — editing the code alone does not update the existing
URL, so nothing needs to change on the website side afterward.

## Testing it

Submit the form on the live site and confirm a new row appears in the
right tab (PARTICIPANTS or AFFILIATES). If nothing appears, open the Apps
Script editor → **Executions** (left sidebar) to see if the request came
in and whether it threw an error. (Do not test by clicking the Run ▶
button in the editor — that calls `doPost()` with no request data and
always fails with a "postData" error; that's expected and not a sign
anything is broken. Always test via the real form.)

## Optional: get an email when a new row is added

Since there's no automated WhatsApp alert, if you'd like a nudge whenever
someone submits a form (rather than checking the Sheet manually), Google
Sheets has a built-in notification feature that needs no code at all:
in the Sheet, go to **Tools → Notification rules**, and set it to email
you when a user submits a form / makes any changes. This is entirely
optional — every submission is safely recorded in the Sheet either way.
