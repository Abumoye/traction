/* =========================================================
   Traction Outsourcing Limited — Event registrations (Code.gs)

   ONE Google Sheet document for every event registration form on the
   website. Each event gets its own tab (sheet) inside this one document.
   The tab is named after the event's slug (the last part of its page
   address), for example:

     /services/events/structure/  ->  tab "structure"

   Tabs are created automatically on the first registration, so adding a
   new event never needs a script change: the new event page just sends its
   own slug. You can also create or rename a tab yourself ahead of time (it
   must have exactly the slug as its name, and the header row below).

   Confirmation emails: when an event has an entry in EVENT_EMAILS below,
   everyone who registers gets an automatic email with the class access
   details. Events without an entry simply get no email. To add the next
   event, add one more block to EVENT_EMAILS (same slug as the event page).
   The email is sent from the Google account that owns this script.

   Setup: paste this as the ONLY code in the Apps Script project attached
   to the Sheet, then Deploy -> New deployment -> Web app (Execute as: Me,
   Who has access: Anyone). Paste the Web app URL into
   /source/static/js/event-modal-registration.js on the website.
   To change the script later: Deploy -> Manage deployments -> Edit -> New
   version (the URL stays the same).
   ========================================================= */

// Optional: set an email address to be told about every registration.
// Leave empty ("") for no emails to the team.
var NOTIFY_EMAIL = "";

// Who the confirmation email appears to come from, and where replies go.
var EMAIL_SENDER_NAME = "Traction Outsourcing Limited";
var EMAIL_REPLY_TO = "partner@tolnigeria.com";

// One block per event. The key is the event slug (the last part of the
// event page address). Each block fills in the email: title, date, time,
// linkLabel and link (the guest name is added automatically).
var EVENT_EMAILS = {
  structure: {
    subject: "You are registered: The Basis of Organizational Restructuring in 2027",
    title: "The Basis of Organizational Restructuring in 2027",
    date: "Friday, 16th October, 2026",
    time: "3:00pm",
    linkLabel: "Google Meet access link",
    link: "https://meet.google.com/mfn-fwuf-yjs"
  },
  resilient: {
    subject: "You are registered: How To Build A Resilient Management Team",
    title: "How To Build A Resilient Management Team",
    date: "Friday, 23rd October, 2026",
    time: "3:00pm",
    linkLabel: "Google Meet access link",
    link: "https://meet.google.com/mzg-cvsp-rfo"
  }
};

var HEADERS = ['Timestamp', 'Event', 'Full Name', 'Organization', 'Phone Number', 'Email', 'State of Residence', 'Page', 'Confirmation Email'];
var EMAIL_STATUS_COL = 9;
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
  var email = clip_(data.email).toLowerCase();

  // Registrations can arrive at the same moment (many people sign up right
  // after a post goes out). The lock makes them queue up instead of
  // overwriting each other's row.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(slug);
    if (!sheet) {
      sheet = ss.insertSheet(slug);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Tabs made before the confirmation-email column existed: add its header.
    if (sheet.getRange(1, EMAIL_STATUS_COL).getValue() === '') {
      sheet.getRange(1, EMAIL_STATUS_COL).setValue(HEADERS[EMAIL_STATUS_COL - 1]).setFontWeight('bold');
    }

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
  } finally {
    lock.releaseLock();
  }

  // Confirmation email (outside the lock so other registrations are not held
  // up). The registration is already saved, so a failed email never loses it;
  // the result is written next to the row so you can see who was not emailed.
  var status = sendConfirmation_(slug, clip_(data.name), email);
  if (status) {
    sheet.getRange(row, EMAIL_STATUS_COL).setNumberFormat('@').setValue(status);
  }

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

/* ============================ CONFIRMATION EMAIL ============================ */

// Returns "Sent", "Failed: ..." or "" (no email set up for this event).
function sendConfirmation_(slug, name, email) {
  var cfg = EVENT_EMAILS[slug];
  if (!cfg) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Failed: invalid email address';

  var safeName = String(name || '').replace(/[\r\n]+/g, ' ').trim() || 'there';
  var text =
    'Dear ' + safeName + ',\n\n' +
    'Thank you for registering for "' + cfg.title + '" Class.  Kindly see class access details below:\n\n' +
    'Date: ' + cfg.date + '\n' +
    'Time: ' + cfg.time + '\n' +
    cfg.linkLabel + ': ' + cfg.link + '\n\n' +
    'See you in class!';
  var html =
    '<p>Dear ' + esc_(safeName) + ',</p>' +
    '<p>Thank you for registering for &quot;' + esc_(cfg.title) + '&quot; Class.&nbsp; Kindly see class access details below:</p>' +
    '<p>Date: ' + esc_(cfg.date) + '<br>' +
    'Time: ' + esc_(cfg.time) + '<br>' +
    esc_(cfg.linkLabel) + ': <a href="' + esc_(cfg.link) + '">' + esc_(cfg.link) + '</a></p>' +
    '<p>See you in class!</p>';

  try {
    MailApp.sendEmail({
      to: email,
      subject: cfg.subject,
      body: text,
      htmlBody: html,
      name: EMAIL_SENDER_NAME,
      replyTo: EMAIL_REPLY_TO
    });
    return 'Sent';
  } catch (err) {
    return 'Failed: ' + String(err && err.message ? err.message : err).slice(0, 150);
  }
}

// Run this once by hand (select it in the toolbar, click Run) if a
// registration shows "Failed" or "" in the Confirmation Email column and you
// want to email those people now. It only touches rows that are not "Sent".
function resendMissingConfirmations() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sent = 0, failed = 0;
  ss.getSheets().forEach(function (sheet) {
    var slug = sheet.getName();
    if (!EVENT_EMAILS[slug] || sheet.getLastRow() < 2) return;
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, EMAIL_STATUS_COL).getValues();
    rows.forEach(function (r, i) {
      if (String(r[EMAIL_STATUS_COL - 1]) === 'Sent') return;
      var status = sendConfirmation_(slug, r[2], String(r[5]).toLowerCase());
      sheet.getRange(i + 2, EMAIL_STATUS_COL).setNumberFormat('@').setValue(status);
      if (status === 'Sent') sent++; else failed++;
    });
  });
  Logger.log('Sent: ' + sent + ', failed: ' + failed);
}

// Run this once by hand after pasting the script (select it, click Run, and
// accept the permission screen) so Google lets the script send email.
function authorizeEmail() {
  Logger.log('Emails you can still send today: ' + MailApp.getRemainingDailyQuota());
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
