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

## Retreat Registration Form (/events/register/)

This form is different from the others: it collects nine fields instead of
four, has an optional file upload for the payment receipt, and needs to send
a confirmation email back to the person registering, not just a notification
to you. It posts to the **same** Apps Script Web App as everything else,
tagged with `formType: "retreat-registration"`, so you only have one script
and one URL to manage.

### Step 1: Add a new sheet tab

In the same **Traction Outsourcing Leads** spreadsheet used for everything
else, add a new tab called **Kigali Retreat 2026**. In row 1, add these
headers exactly, one per column:

`Timestamp | Full Name | Email | Phone | Company | Job Title | Gender | Nationality | Group Ticket | Group Size | Payment Made | Receipt Link`

### Step 2: Create a Drive folder for receipts

In Google Drive, create a folder called **Kigali Retreat 2026 Receipts**.
Open it, and copy the folder ID out of the URL, it is the long string of
letters and numbers after `folders/`:

`https://drive.google.com/drive/folders/`**`1a2B3cD4EfGhIjKlMnOpQrStUvWxYz`**

You will paste that ID into the script below.

### Step 3: Replace the whole Apps Script

Go back into **Extensions → Apps Script** on the same project you already
have (the one handling the service page forms and the Partnerships form).
Delete everything in the editor and paste this complete version in, then
update the `RECEIPT_FOLDER_ID` line near the top with the folder ID from
Step 2:

```javascript
var RECEIPT_FOLDER_ID = "PASTE_YOUR_DRIVE_FOLDER_ID_HERE";

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: 'No form data received. This function only works when called from the website form, not when run manually in the editor.' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var data = JSON.parse(e.postData.contents);

  if (data.formType === 'retreat-registration') {
    return handleRetreatRegistration(data);
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

function handleRetreatRegistration(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kigali Retreat 2026');
  var receiptLink = '';

  if (data.receiptFileData) {
    try {
      var folder = DriveApp.getFolderById(RECEIPT_FOLDER_ID);
      var bytes = Utilities.base64Decode(data.receiptFileData);
      var blob = Utilities.newBlob(bytes, data.receiptFileType || 'application/octet-stream', data.receiptFileName || 'receipt');
      var file = folder.createFile(blob);
      file.setName((data.name || 'Unknown') + ' - ' + (data.receiptFileName || 'receipt'));
      receiptLink = file.getUrl();
    } catch (err) {
      receiptLink = 'Upload failed: ' + err.message;
    }
  }

  sheet.appendRow([
    new Date(),
    data.name || '',
    data.email || '',
    data.phone || '',
    data.companyName || '',
    data.jobTitle || '',
    data.gender || '',
    data.nationality || '',
    data.groupTicket || '',
    data.groupSize || '',
    data.paymentMade || '',
    receiptLink
  ]);

  // Notify the team
  MailApp.sendEmail({
    to: "tractionoutsourcing@gmail.com",
    subject: "New Kigali Retreat Registration: " + (data.name || "Unknown"),
    body: "Name: " + data.name + "\\nEmail: " + data.email + "\\nPhone: " + data.phone +
          "\\nCompany: " + data.companyName + "\\nJob Title: " + data.jobTitle +
          "\\nGender: " + data.gender + "\\nNationality: " + data.nationality +
          "\\nGroup Ticket: " + data.groupTicket + "\\nGroup Size: " + data.groupSize +
          "\\nPayment Made: " + data.paymentMade +
          "\\nReceipt: " + (receiptLink || "Not uploaded")
  });

  // Confirmation email to the registrant
  if (data.email) {
    MailApp.sendEmail({
      to: data.email,
      subject: "Registration Received: Traction Outsourcing International Corporate Retreat 2026",
      body: "Hi " + (data.name || "there") + ",\\n\\n" +
            "Thank you for registering for the Traction Outsourcing International Corporate Retreat 2026 in Kigali, Rwanda (November 22-30, 2026).\\n\\n" +
            "We have received your registration and our team will review it and reach out to you within 24 hours or less.\\n\\n" +
            "If you have not yet made payment, you can do so by bank transfer to:\\n" +
            "Bank: Providus Bank PLC\\nAccount Number: 1307188028\\nAccount Name: Traction Outsourcing Limited\\n\\n" +
            "If you have any questions in the meantime, reach us on WhatsApp at 0805 203 3145 or reply to this email.\\n\\n" +
            "Best regards,\\nTraction Outsourcing Limited"
    });
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success' })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

Create a **new deployment version** afterward (Deploy → Manage deployments
→ Edit → New version), same as any other script change. The Web App URL
stays the same, so nothing needs to change in `js/lead-form.js` or
`js/retreat-registration.js`.

### A note on the file upload

Receipt files are capped at 5MB on the website side before they are even
sent. Apps Script can time out on very large requests, so if someone
reports the form hanging when attaching a receipt, that is the first thing
to check. Everything else about the form works fine without a receipt
attached, since it is optional.

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

For the retreat registration form specifically, test with and without
attaching a receipt file, and confirm three things happen: a new row
appears in the **Kigali Retreat 2026** tab, a notification email arrives
at tractionoutsourcing@gmail.com, and a confirmation email arrives at the
email address you registered with.
