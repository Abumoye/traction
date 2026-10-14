/* =========================================================
   Traction Outsourcing Limited — Event class registrations (Apps Script)

   Receives the pop-up registration form on event pages such as
   /services/events/structure/ (free online classes). One Sheet, one tab
   per event (the tab is named after the event slug, for example
   "structure"), created automatically on the first registration.

   Paste this as the ONLY code in a new Apps Script project attached to a
   NEW Google Sheet called "Traction Outsourcing Event Registrations".
   Deploy as a Web app (Execute as: Me, Who has access: Anyone), then paste
   the Web app URL into /source/static/js/event-modal-registration.js.
   ========================================================= */

// Optional: set an email address to be told about every registration.
// Leave empty ("") for no emails.
var NOTIFY_EMAIL = "";

var HEADERS = ['Timestamp', 'Event', 'Full Name', 'Organization', 'Phone Number', 'Email', 'State of Residence', 'Page'];
var MIN_FILL_MS = 3000;

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return json_({ status: 'error', message: 'No form data received. This only works when called from the website form.' });
  }

  var data;
  try { data = JSON.parse(e.postData.contents); }
  catch (err) { return json_({ status: 'error', message: 'Bad data' }); }

  var spam = checkSpam_(data);
  if (spam) { logBlocked_(spam, data); return json_({ status: 'success' }); }

  if (data.formType !== 'event-class-registration') {
    return json_({ status: 'error', message: 'Unknown form' });
  }

  var slug = String(data.eventSlug || 'event').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'event';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(slug);
  if (!sheet) {
    sheet = ss.insertSheet(slug);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var email = clip_(data.email).toLowerCase();

  // Same email twice for the same event: keep the first entry only.
  var last = sheet.getLastRow();
  if (last > 1) {
    var emails = sheet.getRange(2, 6, last - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if (String(emails[i][0]).toLowerCase() === email) return json_({ status: 'success' });
    }
  }

  var row = last + 1;
  // Written as plain text so nothing a visitor types can run as a formula.
  sheet.getRange(row, 1, 1, HEADERS.length).setNumberFormat('@').setValues([[
    new Date().toISOString(),
    clip_(data.eventName),
    clip_(data.name),
    clip_(data.organization),
    clip_(data.phone),
    email,
    clip_(data.state),
    clip_(data.sourcePage)
  ]]);

  if (NOTIFY_EMAIL) {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'New registration: ' + clip_(data.eventName),
      body: 'Name: ' + clip_(data.name) + '\nOrganization: ' + clip_(data.organization) +
            '\nPhone: ' + clip_(data.phone) + '\nEmail: ' + email + '\nState: ' + clip_(data.state)
    });
  }

  return json_({ status: 'success' });
}

function doGet() {
  return json_({ status: 'ok', message: 'Event registration handler is running.' });
}

/* ============================== SPAM GUARD ============================== */
// Same two checks as the other site forms: a hidden trap field (website_url)
// that real people never fill, and a speed check (elapsedMs). Blocked
// entries go to a "Blocked" tab so a real person caught by mistake can still
// be found.

function checkSpam_(data) {
  if (data.website_url) return 'Hidden trap field filled in';
  if (data.elapsedMs === undefined || data.elapsedMs === null || data.elapsedMs === '' || isNaN(Number(data.elapsedMs))) {
    return 'Speed check missing (not sent from the website form)';
  }
  if (Number(data.elapsedMs) < MIN_FILL_MS) return 'Submitted too fast (' + data.elapsedMs + ' ms)';
  return '';
}

function logBlocked_(reason, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Blocked');
  if (!sheet) {
    sheet = ss.insertSheet('Blocked');
    sheet.getRange(1, 1, 1, 6).setValues([['Timestamp', 'Reason', 'Page', 'Name', 'Email', 'Phone']]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 6).setNumberFormat('@').setValues([[
    new Date().toISOString(), reason, clip_(data.sourcePage), clip_(data.name), clip_(data.email), clip_(data.phone)
  ]]);
  if (sheet.getLastRow() > 501) sheet.deleteRows(2, sheet.getLastRow() - 501);
}

function clip_(v) { return (v === undefined || v === null ? '' : String(v)).slice(0, 200); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
