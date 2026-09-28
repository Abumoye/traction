# Careers / Apply Page — Google Sheet & Drive Setup Guide

This is a **brand new, standalone** Google Sheet and Apps Script Web App,
separate from the "Traction Outsourcing Leads" sheet and the T-ICR events
sheet used by the other forms on the site. It powers:

- `/apply/real-estate-sales-manager-100/` — the job application form (currently the **Real Estate Sales
  Manager** role, 7 fields: Full Name, Gender, Phone, Location in Abuja,
  Years of Experience, Sales Experience, and a CV upload).

Every submission is saved as a row in a Google Sheet, and the uploaded CV
is saved as a PDF file in a dedicated Google Drive folder, with a link to
that file placed in the Sheet row. No automated email or WhatsApp message
is sent to the applicant or the team — you'll check the Sheet directly (an
optional notification tip is at the bottom of this doc).

Because the role title is sent along with every submission, this same
Sheet and Apps Script can be reused for future job postings — you'd just
duplicate `/apply/real-estate-sales-manager-100/` into a new page for the new role and point it at the
same Web App URL. No changes needed on the Apps Script side for that.

## What you will end up with

- A Google Sheet in the **tractionoutsourcing@gmail.com** Google account,
  titled **"Traction Outsourcing – Job Applications"** — already created,
  see Part A below.
- A Google Drive folder, also in that account, titled **"Traction
  Outsourcing - Job Applications"**, where every uploaded CV is saved as
  a PDF. The Apps Script creates this automatically the first time
  someone applies — nothing to set up for it ahead of time.
- A new Apps Script project (bound to the Sheet) deployed as a Web App
  that appends each submission as a new row and saves the CV to Drive.

---

## Part A — The Google Sheet (already created)

I have live access to your Google Drive, so I created this one directly
instead of walking you through it:

**[Open the Sheet](https://docs.google.com/spreadsheets/d/1vQKpYHWfG15E7PSY4_wZEWKigWiuyDNcEiBOMt1h76k/edit)**

Row 1 already has the headers:
`Timestamp | Role | Full Name | Gender | Phone | Location (Area Council) | Years of Experience | Sales Experience | CV Link`

The single tab is whatever Google Sheets named it by default (it doesn't
matter what — the Apps Script below always writes to "the first sheet in
this spreadsheet," not a specific tab name, so there's nothing to rename).

## Part B — Add the Apps Script

I don't have Apps Script API access either, so this part is manual too —
but it's just copy-paste:

1. Open the Sheet from Part A, then go to **Extensions → Apps Script**. (Doing
   it from inside this exact Sheet is what binds the script to it — no
   need to enter a Spreadsheet ID anywhere in the code.)
2. Delete anything in the editor and paste the code below.
3. Click the save icon, name the project **Job Applications Handler**.

```javascript
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: 'No form data received. This function only works when called from the website form, not when run manually in the editor.' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var data = JSON.parse(e.postData.contents);

  if (data.formType === 'apply') {
    return handleApply(data);
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'error', message: 'Unknown form type.' })
  ).setMimeType(ContentService.MimeType.JSON);
}

/* ============================== APPLICATION ============================== */

function handleApply(data) {
  // The first (only) sheet in this spreadsheet — not tied to a specific
  // tab name, so renaming the tab later won't break this.
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  var role = (data.role || '').toString().trim();
  var fullName = (data.fullName || '').toString().trim();
  var gender = (data.gender || '').toString().trim();
  var phone = (data.phone || '').toString().trim();
  var location = (data.location || '').toString().trim();
  var yearsExperience = (data.yearsExperience || '').toString().trim();
  var salesExperience = (data.salesExperience || '').toString().trim();

  // If the CV fails to save for any reason, we still record the
  // applicant's details rather than losing the submission — the Sheet
  // row just notes that the upload needs to be re-requested.
  var cvLink = '';
  try {
    cvLink = saveCvToDrive(data.cvBase64, data.cvFileName, data.cvMimeType, fullName);
  } catch (err) {
    Logger.log('CV upload failed: ' + err);
    cvLink = 'Upload failed - contact applicant for CV';
  }

  sheet.appendRow([new Date(), role, fullName, gender, phone, location, yearsExperience, salesExperience, cvLink]);

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success' })
  ).setMimeType(ContentService.MimeType.JSON);
}

function saveCvToDrive(base64, fileName, mimeType, applicantName) {
  if (!base64) return '';

  var folder = getOrCreateApplicationsFolder();
  var safeName = (applicantName || 'Applicant').replace(/[^a-zA-Z0-9 -]/g, '').trim();
  var cleanName = safeName + ' - ' + (fileName || 'CV.pdf');

  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, mimeType || 'application/pdf', cleanName);
  var file = folder.createFile(blob);

  // Anyone with the link can view (not edit) — this is what lets the
  // Sheet's CV Link column open directly for whoever reviews it.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

function getOrCreateApplicationsFolder() {
  var folderName = 'Traction Outsourcing - Job Applications';
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
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
   **Advanced → Go to Job Applications Handler (unsafe)** to proceed —
   normal and expected for scripts you write yourself). This script asks
   for permission to read/write your Google Drive (to save CVs) and edit
   the Sheet — that's expected.
6. Copy the **Web app URL** it gives you. It looks like:
   `https://script.google.com/macros/s/XXXXXXXXXXXX/exec`

## Part D — Wire it into the site

Open `/js/apply-form.js` in the repo and replace the placeholder with
your copied URL:

```javascript
const APPLY_FORM_SCRIPT_URL = "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL";
```
becomes
```javascript
const APPLY_FORM_SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
```

Commit and push, or send the URL back to me and I'll wire it in, rebuild,
and re-ship it.

## Redeploying after changes

If you edit the Apps Script code later, you need to create a **new
deployment** (Deploy → Manage deployments → Edit → New version) for the
change to go live — editing the code alone does not update the existing
URL, so nothing needs to change on the website side afterward.

## Testing it

Submit the form on the live site with a small real PDF (under 5MB) and
confirm: a new row appears in the Sheet, and the CV Link column has a
working link to a PDF in Drive. If nothing appears, open the
Apps Script editor → **Executions** (left sidebar) to see if the request
came in and whether it threw an error. (Do not test by clicking the
Run ▶ button in the editor — that calls `doPost()` with no request data
and always fails with a "postData" error; that's expected and not a sign
anything is broken. Always test via the real form.)

A few things worth knowing about the CV upload specifically:

- The form only accepts PDF files up to 5MB, checked both before upload
  (in the browser) and implicitly by what the Apps Script can handle in
  one request — this keeps submissions fast and reliable.
- If an applicant's CV somehow fails to save, their other details are
  still recorded in the Sheet with a note in the CV Link column, so no
  application is silently lost.

## Reusing this for a future job posting

Duplicate the `/apply/real-estate-sales-manager-100/` page's content file for the new role, change the
headline and any role-specific copy, and duplicate `/js/apply-form.js`
with a new `APPLY_ROLE_TITLE` (or just change it if you're replacing the
current posting) — point the new copy at the **same**
`APPLY_FORM_SCRIPT_URL`. Every submission already carries a `Role` column
in the Sheet, so applications for different postings stay clearly
labelled in the same tab without any Apps Script changes.

## Optional: get an email when a new application comes in

Since there's no automated alert, if you'd like a nudge whenever someone
applies (rather than checking the Sheet manually), Google Sheets has a
built-in notification feature that needs no code at all: in the Sheet, go
to **Tools → Notification rules**, and set it to email you when a user
submits a form / makes any changes. This is entirely optional — every
application is safely recorded in the Sheet and Drive either way.
