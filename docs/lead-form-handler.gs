function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');

  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: 'No form data received. This function only works when called from the website form, not when run manually in the editor.' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var data = JSON.parse(e.postData.contents);

  var spam = checkSpam(data);
  if (spam) {
    logBlocked(data.formType === 'employee-training' ? 'Employee training' : 'Lead form', spam, data);
    return okResponse();
  }

  // Employee Training page (course registrations + specialized training
  // requests) go to their own "Employee Training" tab.
  if (data.formType === 'employee-training') {
    return handleEmployeeTraining(data);
  }

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
    body: "Page: " + data.sourcePage + "\nName: " + data.name +
          "\nPhone: " + data.phone + "\nCompany: " + data.companyName +
          "\nEmail: " + data.email
  });

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success' })
  ).setMimeType(ContentService.MimeType.JSON);
}

/* ============================ EMPLOYEE TRAINING ============================ */

// Everything sent from /services/employee-training/ lands on a tab called
// "Employee Training" in this same spreadsheet. The tab and its header row are
// created automatically on the first submission, so there is nothing to set up
// by hand. "Course" is the course name, or "Specialized training request".
var TRAINING_HEADERS = [
  'Timestamp', 'Course', 'Track', 'Name', 'Phone Number', 'Company Name',
  'Email', 'What They Need (specialized requests)', 'Source Page'
];

function getTrainingSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Employee Training');
  if (!sheet) sheet = ss.insertSheet('Employee Training');

  var current = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, TRAINING_HEADERS.length).getValues()[0] : [];
  if (current.join('|') !== TRAINING_HEADERS.join('|')) {
    sheet.getRange(1, 1, 1, TRAINING_HEADERS.length).setValues([TRAINING_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Phone column is plain text so the leading 0 (e.g. 08052033145) is kept.
    sheet.getRange(2, 5, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
    sheet.getRange(2, 8, sheet.getMaxRows() - 1, 1).setWrap(true);
    sheet.setColumnWidth(2, 280);
    sheet.setColumnWidth(8, 360);
  }
  return sheet;
}

function handleEmployeeTraining(data) {
  var sheet = getTrainingSheet();

  var course = (data.course || '').toString().trim();
  var track = (data.track || '').toString().trim();
  var name = (data.name || '').toString().trim();
  var phone = (data.phone || '').toString().trim();
  var company = (data.companyName || '').toString().trim();
  var email = (data.email || '').toString().trim();
  var message = (data.message || '').toString().trim();
  var page = (data.pagePath || data.sourcePage || '').toString().trim();

  sheet.appendRow([new Date(), course, track, name, phone, company, email, message, page]);
  var row = sheet.getLastRow();
  sheet.getRange(row, 5).setNumberFormat('@').setValue(phone);
  sheet.getRange(row, 8).setWrap(true);

  // Email notification for every new training registration / request
  MailApp.sendEmail({
    to: "tractionoutsourcing@gmail.com",
    subject: "Employee Training: " + (course || "enquiry") + " - " + (name || "Unknown"),
    body: "Course: " + course + (track ? "\nTrack: " + track : "") +
          "\nName: " + name + "\nPhone: " + phone + "\nCompany: " + company +
          "\nEmail: " + email + (message ? "\nWhat they need: " + message : "")
  });

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success' })
  ).setMimeType(ContentService.MimeType.JSON);
}

/* ============================== SPAM GUARD ============================== */

// The website forms send two extra fields: a hidden trap field (website_url,
// always empty for real people) and elapsedMs (how long the page had been open
// when the form was sent). Spam bots fill the trap, send instantly, or post
// straight to this script without the fields. Those entries are NOT added to
// your sheets or emailed. They are written to a tab called "Blocked" so that,
// if a real person is ever caught by mistake, you can still see their details.
// Phone numbers are not restricted, so international numbers work.
var MIN_FILL_MS = 3000;

function checkSpam(data) {
  if (data.website_url) return 'Hidden trap field filled in';
  if (data.elapsedMs === undefined || data.elapsedMs === null || data.elapsedMs === '' || isNaN(Number(data.elapsedMs))) {
    return 'Speed check missing (not sent from the website form)';
  }
  if (Number(data.elapsedMs) < MIN_FILL_MS) return 'Submitted too fast (' + data.elapsedMs + ' ms)';
  return '';
}

function logBlocked(formName, reason, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Blocked');
  if (!sheet) {
    sheet = ss.insertSheet('Blocked');
    sheet.getRange(1, 1, 1, 7).setValues([['Timestamp', 'Form', 'Reason', 'Page', 'Name', 'Email', 'Phone']]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  function clip(v) { return (v === undefined || v === null ? '' : String(v)).slice(0, 200); }
  var name = data.name || data.fullName || [data.firstName, data.lastName].join(' ');
  var row = sheet.getLastRow() + 1;
  // Plain text, so nothing a spammer types can be treated as a formula.
  sheet.getRange(row, 1, 1, 7).setNumberFormat('@').setValues([[
    new Date().toISOString(), formName, reason, clip(data.sourcePage), clip(name), clip(data.email), clip(data.phone)
  ]]);
  // Keep the log small: only the latest 500 blocked entries are kept.
  if (sheet.getLastRow() > 501) sheet.deleteRows(2, sheet.getLastRow() - 501);
}

function okResponse() {
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
}
