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
