# ATH Job Community Form — Moving Off Apps Script Setup Guide

This moves the "Join ATH Job Community" registration form off its old
`script.google.com` URL and onto its own page on the main site:
**https://tolnigeria.com/brands/recruiters/join-ath-community/**

The Sheet, the Drive folder, and the confirmation email all stay exactly
as they were — same Spreadsheet, same Drive folder, same
`athrecruiters@gmail.com` sender. Only two things change:

1. The page people actually see and fill in now lives on tolnigeria.com,
   not script.google.com.
2. The Apps Script project no longer *serves* that page — it now only
   *receives* the submitted data, as a small API the new page calls
   in the background.

## Why this can't just be "no Apps Script at all"

The form writes rows to a Google Sheet, saves the CV and photo into a
Google Drive folder, and sends a Gmail confirmation email. All three of
those are Google account actions that only Apps Script (or a paid,
separately-hosted backend with its own Google credentials) can do. GitHub
Pages, like the rest of this site, only serves static files — it cannot
run that kind of logic itself. Keeping Apps Script as the invisible
backend, and only moving the page itself onto tolnigeria.com, is the
approach with no new infrastructure to pay for or maintain, and it reuses
everything already set up under `athrecruiters@gmail.com`.

## Step 1: Update the Apps Script project

This project is shared with the site-wide lead form (the one used on
every `/services/*/` page) and, previously, the Kigali Retreat
registration. A project can only have one function named `doPost` —
having it split across two files (`Code.gs` and `Codes.gs`) each
defining their own `doPost` was exactly what caused community
submissions to silently go nowhere the first time this was set up.
Retreat registration has since been discontinued and its sheet
deleted, so the project is now consolidated into a **single `Code.gs`
file** with one `doPost` that dispatches by `data.formType`:
`'ath-community-join'` for the community form, anything else for the
general lead form. `Index.html` stays as the project's only HTML file
(it's unused — kept only because Apps Script projects don't strictly
need to be empty of it — the community form itself lives on the main
site now).

1. Open the existing Apps Script project (the one with `Index.html`,
   `Code.gs`, and `Codes.gs`).
2. Open `Code.gs` and **replace its entire contents** with the code
   below.
3. Delete the `Codes.gs` file entirely (its file-list three-dot menu →
   Delete) — everything it did now lives in `Code.gs`.

```javascript
// Traction Outsourcing / ATH Recruiters — shared Apps Script backend.
//
// One project, one doPost, dispatching by data.formType:
//   - 'ath-community-join'  -> ATH Job Community registration (Members sheet)
//   - anything else         -> general website lead form (Leads sheet)
//
// The Kigali Retreat registration handler has been removed -- that
// form and sheet are no longer in use.

const SPREADSHEET_ID = "1U77pMiYV4AZfv5a6JBJBHA2gHekv4mlhvbC8sm5c98A";
const SHEET_NAME = "Members";
const PARENT_FOLDER_ID = "123j4DZ124Lm70EnWTvNU0BYlY6Z-7lu9";
const FROM_EMAIL = "athrecruiters@gmail.com";
const COMMUNITY_LINK = "https://chat.whatsapp.com/J1118dIsEht9UEi2maNrAQ";
const NEW_FORM_URL = "https://tolnigeria.com/brands/recruiters/join-ath-community/";

// The community form used to be served directly from this project's
// script.google.com URL. It now lives at NEW_FORM_URL on the main
// site, so doGet just redirects anyone who still has the old link
// bookmarked or shared, instead of showing a dead page.
function doGet() {
  const html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<meta http-equiv="refresh" content="0; url=' + NEW_FORM_URL + '">' +
    '</head><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
    '<p>This form has moved. Redirecting you now&hellip;</p>' +
    '<p><a href="' + NEW_FORM_URL + '">Click here if you are not redirected automatically.</a></p>' +
    '</body></html>'
  );
  return html.setTitle('ATH Job Community — Moved');
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return jsonOutput({ status: 'error', message: 'No form data received. This function only works when called from a website form, not when run manually in the editor.' });
  }

  const data = JSON.parse(e.postData.contents);

  if (data.formType === 'ath-community-join') {
    return handleCommunityJoin(data);
  }

  return handleLeadForm(data);
}

// ====================== GENERAL WEBSITE LEAD FORM ======================
function handleLeadForm(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');

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
    to: "athrecruiters@gmail.com",
    subject: "New Website Lead: " + (data.name || "Unknown"),
    body: "Page: " + data.sourcePage + "\\nName: " + data.name +
          "\\nPhone: " + data.phone + "\\nCompany: " + data.companyName +
          "\\nEmail: " + data.email +
          (data.category ? "\\nCategory: " + data.category : "") +
          (data.message ? "\\nMessage: " + data.message : "")
  });

  return jsonOutput({ status: 'success' });
}

// ====================== ATH JOB COMMUNITY SUBMISSION ======================
// CV and photo arrive as base64 strings (not native File objects), since
// that's what a plain fetch() from the browser can actually send.
function handleCommunityJoin(data) {
  try {
    const missing = [];
    ["fullName", "gender", "phone", "email", "dob", "highestDegree", "state", "city"].forEach(function (field) {
      if (!data[field]) missing.push(field);
    });
    if (!data.cv || !data.cv.base64) missing.push("cv");
    if (!data.photo || !data.photo.base64) missing.push("photo");
    if (missing.length) {
      return jsonOutput({ success: false, message: "Missing required field(s): " + missing.join(", ") });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet 'Members' not found. Please check the name.");

    const stateCode = getStateCode(data.state);
    const memberData = getNextMemberData(stateCode);
    const count = memberData.count;
    const memberCode = memberData.memberCode;

    // Create user folder
    const parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
    const userFolder = parentFolder.createFolder(count.toString().padStart(4, '0') + " - " + data.fullName);

    const cvUrl = saveBase64File(userFolder, data.cv);
    const photoUrl = saveBase64File(userFolder, data.photo);

    // Append to sheet. jobNiche/otherNiche are kept as empty-string columns
    // for compatibility with the existing sheet layout -- the live form has
    // never actually had those two fields, on either the old version or
    // this one, so they're always blank.
    sheet.appendRow([
      new Date(),
      count,
      memberCode,
      data.fullName,
      data.gender,
      data.phone,
      data.email,
      data.dob,
      data.highestDegree,
      data.state,
      data.city,
      data.tiktok || '',
      data.instagram || '',
      data.linkedin || '',
      data.jobNiche || '',
      data.otherNiche || '',
      cvUrl,
      photoUrl,
      "Yes"
    ]);

    sendConfirmationEmail(data.email, memberCode, data.fullName);

    return jsonOutput({ success: true, memberCode: memberCode });

  } catch (error) {
    console.error("Community Join Submission Error:", error.toString());
    return jsonOutput({ success: false, message: error.toString() });
  }
}

// Decodes a { filename, mimeType, base64 } object (sent by the website)
// into a real file saved in the given Drive folder, and returns its URL.
function saveBase64File(folder, fileData) {
  const bytes = Utilities.base64Decode(fileData.base64);
  const blob = Utilities.newBlob(bytes, fileData.mimeType || 'application/octet-stream', fileData.filename || 'file');
  const saved = folder.createFile(blob);
  return saved.getUrl();
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getNextMemberData(stateCode) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  const count = lastRow < 2 ? 1 : parseInt(sheet.getRange(lastRow, 2).getValue() || 0) + 1;

  const dateStr = Utilities.formatDate(new Date(), "GMT+1", "ddMMyy");
  const memberCode = "ATH/" + stateCode + "/" + dateStr + "/" + count.toString().padStart(4, '0');

  return { count: count, memberCode: memberCode };
}

function getStateCode(state) {
  const map = { "Abia":"AB","Adamawa":"AD","Akwa Ibom":"AK","Anambra":"AN","Bauchi":"BA","Bayelsa":"BY","Benue":"BE","Borno":"BO","Cross River":"CR","Delta":"DE","Ebonyi":"EB","Edo":"ED","Ekiti":"EK","Enugu":"EN","Federal Capital Territory":"FC","Gombe":"GO","Imo":"IM","Jigawa":"JI","Kaduna":"KD","Kano":"KN","Katsina":"KT","Kebbi":"KE","Kogi":"KO","Kwara":"KW","Lagos":"LA","Nasarawa":"NA","Niger":"NI","Ogun":"OG","Ondo":"ON","Osun":"OS","Oyo":"OY","Plateau":"PL","Rivers":"RI","Sokoto":"SO","Taraba":"TA","Yobe":"YO","Zamfara":"ZA" };
  return map[state] || "XX";
}

function sendConfirmationEmail(email, memberCode, name) {
  const subject = "✅ ATH Job Community - Membership Approved";
  const body = "Dear " + name + ",\n\nYour membership has been approved!\n\nMember Code: " + memberCode +
    "\n\nJoin the community: " + COMMUNITY_LINK + "\n\nBest regards,\nATH Recruiters";

  GmailApp.sendEmail(email, subject, body, {
    from: FROM_EMAIL,
    replyTo: FROM_EMAIL,
    name: "ATH Recruiters"
  });
}
```

4. Save the file (the save icon, or Ctrl/Cmd+S).

## Step 2: Deploy it as a Web App

Because `doGet`/`doPost` changed, this needs a **new deployment version**
— editing the code alone does not update the live URL.

1. Click **Deploy → Manage deployments**.
2. If there's an existing active deployment, click the pencil icon to
   edit it, then next to "Version" choose **New version**, and click
   **Deploy**. (If there's no existing deployment yet, use **Deploy →
   New deployment** instead, click the gear icon, choose **Web app**,
   set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**.)
3. If Google asks you to re-authorize permissions, click through it —
   this is expected the first time `doPost`/Drive/Gmail scopes are
   touched.
4. Copy the **Web app URL**. It looks like:
   `https://script.google.com/macros/s/XXXXXXXXXXXX/exec`
5. Send me that URL and I'll wire it into the site and ship it.

## Step 3: What changes on the site (already done, for reference)

- New page: `/brands/recruiters/join-ath-community/`, styled to match
  the rest of the ATH Recruiters brand (same purple accent, header,
  footer as `/brands/recruiters/`).
- The "Need A Job in Nigeria? Join Our Community Now." button on
  `/brands/recruiters/` now points straight at the new page instead of
  the old `bit.ly/athjobs` link.
- `static/js/community-join.js` handles the states/LGA dropdowns, reads
  the CV and photo as base64, and posts everything to the Apps Script
  Web App URL from Step 2 — once that constant is filled in.

## A note on what changes in the experience

The old page could show your **Member Code** in an on-page popup the
instant you submitted, because it was served directly by Apps Script.
The new page can't do that: browsers block a static site from reading
the response of a cross-origin request like this one unless the request
is sent in a very particular way (this is the same technique already
used by the lead form on every `/services/*/` page, described in
`docs/lead-form-setup.md`) — the tradeoff is that the response can't be
read back. Since the confirmation email already contains the Member Code
and the community link, the on-page message after submitting just says
"check your email" instead. Nothing is lost, it just arrives by email
instead of a popup.

## Testing it

Once the Web App URL is wired in and deployed:

1. Go to `https://tolnigeria.com/brands/recruiters/join-ath-community/`.
2. Fill in the form with your own details and a real CV/photo, agree to
   both checkboxes, and submit.
3. Check that a new row appears in the **Members** sheet within a few
   seconds, that a new folder with the CV and photo appears in the Drive
   folder, and that a confirmation email arrives with the Member Code.

**Do not test by clicking the Run ▶ button in the Apps Script editor.**
That calls `doPost()` with no request data, which will show the
"No form data received" message. This is expected, it just means the
function was called outside of a real form submission — always test by
submitting the actual form on the live website.

If something doesn't come through, open the Apps Script editor, go to
**Executions** (left sidebar) to see whether the request arrived and
whether it threw an error.
