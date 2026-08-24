# T-ICR 2026 Registration & Affiliate — Sheet, Script & WhatsApp Setup Guide

This is a **brand new, standalone** Google Sheet and Apps Script Web App,
separate from the "Traction Outsourcing Leads" sheet used by the other
forms on the site. It powers two pages:

- `/events/register/` — 4-field registration form (Full Name, Phone,
  Email, Referral Code).
- `/events/affiliate/` — affiliate sign-up form, which auto-assigns a code
  like `aff/tol/001/26`.

No emails or invoices are sent by either form. Instead, every submission
is (1) saved as a row in a Google Sheet, and (2) pushed as a WhatsApp
message to **0704 708 2697** via the official WhatsApp Business Platform
(Meta Cloud API), so your team sees it immediately.

Both forms post to the **same** Web App URL (one script, one deployment),
routed internally by a `formType` field — so you only need to do this setup
once and paste one URL into two files at the end.

**Heads up on timing:** the WhatsApp part needs a verified Meta Business
account and an approved message template before it will actually send —
that's not something that finishes in one sitting (business verification
and template review can take anywhere from minutes to a few days). The
Sheet and forms will work immediately once deployed; WhatsApp delivery
comes online once Meta's side is approved. Until then, submissions still
land safely in the Sheet, so nothing is lost while you wait on approval.

## What you will end up with

- A Google Sheet in the **tractionoutsourcing@gmail.com** Google account,
  with two tabs: **PARTICIPANTS** and **AFFILIATES**.
- A new Apps Script project (bound to that Sheet) deployed as a Web App.
- A Meta WhatsApp Business Platform app that sends the notification
  messages to 0704 708 2697 whenever the script calls it.

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

## Part B — WhatsApp Business Platform (Meta Cloud API)

This is the part that takes real setup time. Do this from
**tractionoutsourcing@gmail.com** or whichever account should own the
business assets.

1. Go to [business.facebook.com](https://business.facebook.com) and
   create (or use an existing) Meta Business Account for Traction
   Outsourcing Limited.
2. Go to [developers.facebook.com](https://developers.facebook.com),
   create a new App, choose type **Business**, and add the **WhatsApp**
   product to it.
3. In the WhatsApp product setup, you'll get a **test phone number**
   automatically for development. To send to 0704 708 2697 during
   testing, add it under **API Setup → To → Manage phone number list**
   as a verified recipient (it'll get a verification code by WhatsApp).
   Test numbers work immediately with no business verification needed —
   good for confirming everything works end to end before going further.
4. For this to work reliably on an ongoing basis (not just a temporary
   test number that expires), you'll want to: add your own business
   WhatsApp-enabled phone number as the sending number, and complete
   **Meta Business Verification** (Business Settings → Security Center →
   Start Verification) so the app can message any number, not just
   pre-approved test recipients. This is the step that can take days —
   Meta reviews business documents.
5. Generate a **permanent access token**: Business Settings → Users →
   System Users → create a system user → assign it to your WhatsApp app
   with `whatsapp_business_messaging` permission → **Generate Token**
   (choose "Never expires" if offered, or the longest duration available).
   Copy this token somewhere safe — you'll paste it into the script.
6. Note your **Phone Number ID** (not the phone number itself — a numeric
   ID shown in WhatsApp → API Setup, under the "From" number). You'll
   need this too.

### Create the two message templates

Outbound business-initiated WhatsApp messages must use a **pre-approved
template** (you can't just send arbitrary free text to a number that
hasn't messaged you first). In Meta's WhatsApp Manager → **Message
Templates → Create Template**, create these two, both category
**Utility**, language **English (US)**:

**Template 1** — name it exactly `ticr_2026_registration_alert`, body:
```
New T-ICR 2026 registration:
Name: {{1}}
Phone: {{2}}
Email: {{3}}
Referral: {{4}}
```

**Template 2** — name it exactly `ticr_2026_affiliate_alert`, body:
```
New T-ICR 2026 affiliate:
Name: {{1}}
Code: {{2}}
Phone: {{3}}
Gender: {{4}}
Age: {{5}}
Payout details: {{6}}
```

Submit both for review. Utility templates are usually approved within a
few minutes to a few hours, sometimes longer. You'll see the status
change to "Approved" in WhatsApp Manager once ready — the script below
won't work until both show Approved.

## Part C — Add the Apps Script

I don't have a tool that can create or deploy Apps Script projects either
(no Apps Script API access), so this part is manual too — but it's just
copy-paste:

1. Open the Sheet from Part A, then go to **Extensions → Apps Script**.
   (Doing it from inside this exact Sheet is what binds the script to it —
   no need to enter a Spreadsheet ID anywhere in the code.)
2. Delete anything in the editor and paste the code below.
3. Fill in the four `REPLACE_WITH_...` constants near the top with what
   you gathered in Part B.
4. Click the save icon, name the project **T-ICR 2026 Events Handler**.

```javascript
// ---- WhatsApp Business Platform (Meta Cloud API) ----
var WHATSAPP_PHONE_NUMBER_ID = "REPLACE_WITH_YOUR_WHATSAPP_PHONE_NUMBER_ID";
var WHATSAPP_ACCESS_TOKEN = "REPLACE_WITH_YOUR_PERMANENT_ACCESS_TOKEN";
var WHATSAPP_API_VERSION = "v21.0";
var NOTIFY_WHATSAPP_NUMBER = "2347047082697"; // 0704 708 2697, international format, no leading +

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

  sendWhatsAppTemplate('ticr_2026_registration_alert', [
    name, phone, email, referral || 'None'
  ]);

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

  var payoutDetails = bankName + ' - ' + accountNumber + ' - ' + accountName;

  sendWhatsAppTemplate('ticr_2026_affiliate_alert', [
    name, code, phone, gender, age, payoutDetails
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success', code: code })
  ).setMimeType(ContentService.MimeType.JSON);
}

/* ============================= WHATSAPP SEND ============================= */

function sendWhatsAppTemplate(templateName, paramValues) {
  var url = 'https://graph.facebook.com/' + WHATSAPP_API_VERSION + '/' + WHATSAPP_PHONE_NUMBER_ID + '/messages';

  var payload = {
    messaging_product: 'whatsapp',
    to: NOTIFY_WHATSAPP_NUMBER,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: paramValues.map(function (v) {
            return { type: 'text', text: String(v) };
          })
        }
      ]
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + WHATSAPP_ACCESS_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  // Always log the response — this is the first place to look if a
  // WhatsApp message doesn't arrive (see Testing section below).
  Logger.log('WhatsApp send response: ' + response.getResponseCode() + ' ' + response.getContentText());
  return response;
}
```

## Part D: Deploy it as a Web App

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

## Part E: Wire it into the site

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

If you edit the Apps Script code later (e.g. update the phone number ID or
token), you need to create a **new deployment** (Deploy → Manage
deployments → Edit → New version) for the change to go live — editing the
code alone does not update the existing URL, so nothing needs to change on
the website side afterward.

## Testing it

**Test the Sheet first, independent of WhatsApp.** Submit the form on the
live site and confirm a new row appears in the right tab. If nothing
appears, open the Apps Script editor → **Executions** (left sidebar) to
see if the request came in and whether it threw an error. (Do not test by
clicking the Run ▶ button in the editor — that calls `doPost()` with no
request data and always fails with a "postData" error; that's expected
and not a sign anything is broken. Always test via the real form.)

**Then test WhatsApp delivery.** After a submission, check Executions for
the `sendWhatsAppTemplate` log line — it logs the HTTP response code and
body from Meta. A `200` with `"messages"` in the body means it sent. A
non-200 response almost always means one of: the template isn't Approved
yet, the recipient number isn't a verified test recipient (if you haven't
finished business verification yet), the access token is wrong or
expired, or the Phone Number ID is wrong. The error message in the log
will say which.

## If you'd rather not go through Meta's business verification

If Business Verification turns out to be more than you want to deal with
right now, the Sheet and forms still work completely fine on their own —
every submission is safely recorded — and I can swap the notification
step for something simpler later (either the free CallMeBot-based
approach I mentioned earlier, or a click-to-chat link the visitor sends
themselves). Just let me know and I'll update the script.
