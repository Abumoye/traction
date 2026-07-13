/**
 * ATH ACADEMY — Backend (Google Apps Script)
 *
 * Deploy this bound to the existing "ATH Recruiters Directory" spreadsheet
 * (one file, several tabs — Google Sheets doesn't nest a spreadsheet inside
 * a spreadsheet, so "Academy" can't hold its own sub-tabs; instead this
 * script uses one tab per table, all living in the same file as Members).
 * It needs these tabs:
 *
 *   Members        (your existing tab — read directly, nothing to copy.
 *                    Membership ID in Column C, name in Column D, email in
 *                    Column G. Without an email on file, a member's
 *                    certificate still gets logged and shown in-app, it
 *                    just won't be emailed.)
 *   Courses         id | tag | title | blurb
 *   Lessons         courseId | lessonId | order | title | desc | youtubeId
 *   Questions       courseId | question | optionA | optionB | optionC | optionD | correctIndex | weight
 *   Certificates    certId | memberCode | memberName | courseId | courseTitle | score | dateIssued
 *   Attempts        memberCode | courseId | passed | score | dateAttempted
 *
 * You don't need to create or fill in Courses, Lessons, or Questions by
 * hand — run seedAcademyData() once (see near the bottom of this file) and
 * it creates those three tabs and fills them with the five real courses.
 * If you already made an "Academy" tab, you can delete it or repurpose it;
 * this script doesn't read from a tab by that name.
 *
 * After seeding, also run expandDigitalMarketingQuestions() once (see the
 * very bottom of this file) to bring that course's question bank from 20
 * up to 140. The other four courses are still at their original 20 until
 * they get the same treatment.
 *
 * Deploy as a Web App: Deploy > New deployment > Web app.
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the resulting URL into app.js in place of the MOCK_DB calls.
 *
 * CERTIFICATE VERIFICATION & LINK PREVIEWS:
 * verifyCertificate (below) answers the JSON lookup the verify.html page
 * calls. There's also a verifyPage action that returns real server-rendered
 * HTML with Open Graph tags filled in per certificate — that's the URL to
 * put on LinkedIn/WhatsApp shares instead of verify.html directly, because
 * GitHub Pages is static and can't customize meta tags per certificate on
 * its own, but this Apps Script endpoint can, since it runs per request.
 * The share link becomes:
 *   https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=verifyPage&id=CERTID
 * It shows the ATH Academy logo and the member's name/course in the preview
 * card, then link out to the full verify.html experience.
 */

const SHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const OG_IMAGE_URL = 'https://tolnigeria.com/ath-academy/og-card.png';
const QUESTIONS_PER_ASSESSMENT = 20;
const ASSESSMENT_SECONDS = 50 * 60;
const CERT_ID_START = 100000; // first certificate is No. 100001

// Certificates and fail notices are emailed from whichever Google account
// owns this Apps Script deployment (GmailApp sends as you, or as the
// deployment's "execute as" account). Set a display name here.
const SENDER_NAME = 'ATH Academy';

function doGet(e) {
  const action = e.parameter.action;

  // HTML routes (for link-preview crawlers) return actual HTML, not JSON.
  if (action === 'verifyPage') {
    return HtmlService.createHtmlOutput(renderVerifyPageHtml(e.parameter.id));
  }

  let result;
  try {
    if (action === 'verifyMember') result = verifyMember(e.parameter.code);
    else if (action === 'getCourses') result = getCourses();
    else if (action === 'getCourse') result = getCourse(e.parameter.courseId);
    else if (action === 'getAssessment') result = getAssessment(e.parameter.courseId);
    else if (action === 'verifyCertificate') result = verifyCertificate(e.parameter.id);
    else result = { error: 'Unknown action' };
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  let result;
  try {
    if (body.action === 'recordAttempt') result = recordAttempt(body);
    else if (body.action === 'issueCertificate') result = issueCertificate(body);
    else if (body.action === 'emailCertificate') result = emailCertificate(body);
    else result = { error: 'Unknown action' };
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Members ---------- */
// Reads from the existing "ATH Recruiters Directory" spreadsheet, "Members"
// tab. Membership ID is Column C, name is Column D, email is Column G —
// zero-based indices 2, 3, and 6 below. Adjust if the sheet layout changes.
function verifyMember(code) {
  if (!code) return { ok: false };
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Members');
  const data = sheet.getDataRange().getValues();
  const normalized = code.trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim().toUpperCase() === normalized) {
      return { ok: true, member: { code: normalized, name: data[i][3], email: data[i][6] || '' } };
    }
  }
  return { ok: false };
}

/* ---------- Courses & lessons ---------- */
function getCourses() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Courses');
  const data = sheet.getDataRange().getValues();
  const lessonsSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Lessons');
  const lessonData = lessonsSheet.getDataRange().getValues();

  return data.slice(1).map(row => {
    const [id, tag, title, blurb] = row;
    const lessonCount = lessonData.slice(1).filter(l => l[0] === id).length;
    return { id, tag, title, blurb, lessonCount };
  });
}

function getCourse(courseId) {
  const courses = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Courses').getDataRange().getValues();
  const courseRow = courses.slice(1).find(r => r[0] === courseId);
  const [id, tag, title, blurb] = courseRow;

  const lessonRows = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Lessons').getDataRange().getValues();
  const lessons = lessonRows.slice(1)
    .filter(r => r[0] === courseId)
    .sort((a, b) => a[2] - b[2])
    .map(r => ({ id: r[1], title: r[3], desc: r[4], youtubeId: r[5] }));

  return { id, tag, title, blurb, lessons };
}

/* ---------- Assessment: server picks + shuffles, client never sees answers ---------- */
function getAssessment(courseId) {
  const rows = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Questions').getDataRange().getValues();
  const bank = rows.slice(1).filter(r => r[0] === courseId);

  const picked = shuffleArray(bank).slice(0, Math.min(QUESTIONS_PER_ASSESSMENT, bank.length));

  // Cache the picked question IDs (by row content hash) + correct answers keyed
  // to a one-time assessment token, so submitAssessment can score without the
  // client ever holding the answer key. Simple approach: return an opaque
  // token that encodes the picks, since Apps Script has no session state by
  // default. For production, write picks to a "Sessions" sheet keyed by a
  // random token instead of encoding in the payload.
  const assessmentId = Utilities.getUuid();
  const sessionSheet = getOrCreateSessionSheet();
  sessionSheet.appendRow([assessmentId, courseId, JSON.stringify(picked), new Date()]);

  const questionsForClient = picked.map(r => {
    const [, question, a, b, c, d, correctIndex, weight] = r;
    const options = shuffleArray([
      { text: a, isCorrect: correctIndex === 0 },
      { text: b, isCorrect: correctIndex === 1 },
      { text: c, isCorrect: correctIndex === 2 },
      { text: d, isCorrect: correctIndex === 3 }
    ]);
    return { q: question, weight, options };
  });

  return { assessmentId, questions: questionsForClient };
}

function getOrCreateSessionSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Sessions');
  if (!sheet) {
    sheet = ss.insertSheet('Sessions');
    sheet.appendRow(['assessmentId', 'courseId', 'pickedQuestionsJSON', 'createdAt']);
  }
  return sheet;
}

/* ---------- Attempts (enforces one attempt per completion, server-side) ---------- */
function recordAttempt(body) {
  const { memberCode, memberName, memberEmail, courseId, courseTitle, passed, score } = body;
  const sheet = getOrCreateSheet('Attempts', ['memberCode', 'courseId', 'passed', 'score', 'dateAttempted']);
  const now = new Date();
  sheet.appendRow([memberCode, courseId, passed, score, now]);

  if (!passed && memberEmail) {
    sendFailEmail(memberEmail, memberName, courseTitle, score, courseId);
  }

  return { ok: true };
}

function sendFailEmail(email, name, courseTitle, score, courseId) {
  const retakeUrl = 'https://tolnigeria.com/ath-academy/?course=' + encodeURIComponent(courseId);
  const html = `
    <p>Hi ${name},</p>
    <p>You scored <strong>${score}%</strong> on the <strong>${courseTitle}</strong> assessment — just under the 90% pass mark.</p>
    <p>That's a real attempt, not a wasted one. Go through the course again and you'll have another shot.</p>
    <p><a href="${retakeUrl}" style="display:inline-block;background:#E35F26;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:bold;">Retake the course</a></p>
    <p style="color:#8A8377;font-size:13px;">ATH Academy</p>
  `;
  GmailApp.sendEmail(email, `Your ${courseTitle} result — ATH Academy`, '', { htmlBody: html, name: SENDER_NAME });
}

/* ---------- Certificates ---------- */
// Certificate numbers are a plain incrementing string of digits, per the
// July decision — easy for a member to read out over the phone or type
// into the verify page. Sequence starts at CERT_ID_START + 1.
function issueCertificate(body) {
  const { memberCode, memberName, courseId, courseTitle, score } = body;
  const sheet = getOrCreateSheet('Certificates', ['certId', 'memberCode', 'memberName', 'courseId', 'courseTitle', 'score', 'dateIssued']);
  const data = sheet.getDataRange().getValues();
  const lastId = data.length > 1 ? Number(data[data.length - 1][0]) : CERT_ID_START;
  const certId = String(lastId + 1);
  sheet.appendRow([certId, memberCode, memberName, courseId, courseTitle, score, new Date()]);
  return { certId };
}

// Separate call: the browser draws the certificate image with the real
// number on it first, then sends it here to attach and email.
function emailCertificate(body) {
  const { certId, memberEmail, memberName, courseTitle, imageBase64 } = body;
  if (!memberEmail || !imageBase64) return { ok: false, reason: 'missing email or image' };
  sendCertificateEmail(memberEmail, memberName, courseTitle, certId, imageBase64);
  return { ok: true };
}

function sendCertificateEmail(email, name, courseTitle, certId, certImageBase64) {
  const bytes = Utilities.base64Decode(certImageBase64.replace(/^data:image\/png;base64,/, ''));
  const blob = Utilities.newBlob(bytes, 'image/png', `ATH-Academy-Certificate-${certId}.png`);
  const verifyUrl = 'https://tolnigeria.com/ath-academy/verify.html?id=' + certId;
  const html = `
    <p>Congratulations, ${name}.</p>
    <p>You've earned your certificate for <strong>${courseTitle}</strong>. It's attached, and logged as
    Certificate No. <strong>${certId}</strong> — anyone can confirm it's genuine at
    <a href="${verifyUrl}">${verifyUrl}</a>.</p>
    <p>Share it on WhatsApp, LinkedIn, TikTok, or Instagram — you earned it.</p>
    <p style="color:#8A8377;font-size:13px;">ATH Academy</p>
  `;
  GmailApp.sendEmail(email, `Your certificate: ${courseTitle} — ATH Academy`, '', {
    htmlBody: html, name: SENDER_NAME, attachments: [blob]
  });
}

function verifyCertificate(certId) {
  if (!certId) return { ok: false };
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Certificates');
  if (!sheet) return { ok: false };
  const data = sheet.getDataRange().getValues();
  const row = data.slice(1).find(r => String(r[0]) === String(certId).trim());
  if (!row) return { ok: false };
  const [id, memberCode, memberName, , courseTitle, , dateIssued] = row;
  return {
    ok: true,
    cert: {
      certId: id, memberCode, memberName, courseTitle,
      dateIssued: Utilities.formatDate(new Date(dateIssued), Session.getScriptTimeZone(), 'd MMMM yyyy')
    }
  };
}

// Server-rendered HTML so LinkedIn/WhatsApp/etc. crawlers — which don't run
// JavaScript — see real Open Graph tags per certificate. GitHub Pages alone
// can't do this since it only serves static files; this Apps Script endpoint
// can, because it builds the page fresh on every request.
function renderVerifyPageHtml(certId) {
  const result = verifyCertificate(certId);
  const title = result.ok
    ? `${result.cert.memberName} — ${result.cert.courseTitle} | ATH Academy`
    : 'Certificate not found | ATH Academy';
  const description = result.ok
    ? `Certificate No. ${result.cert.certId}, issued ${result.cert.dateIssued}. Verified by ATH Academy.`
    : 'No certificate was found with that number.';
  const verifyUrl = `https://tolnigeria.com/ath-academy/verify.html?id=${encodeURIComponent(certId || '')}`;

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${OG_IMAGE_URL}">
<meta property="og:type" content="website">
<meta http-equiv="refresh" content="0; url=${verifyUrl}">
</head><body>
<p>Redirecting to <a href="${verifyUrl}">${verifyUrl}</a>…</p>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getOrCreateSheet(name, headerRow) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headerRow);
  }
  return sheet;
}

/* ---------- Utility ---------- */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
 * SEED DATA — run seedAcademyData() ONCE from the Apps Script
 * editor (select it from the function dropdown, click Run) to
 * populate Courses, Lessons, and Questions with the five real
 * courses and their starter question banks. It's safe to run
 * more than once by accident — it checks each sheet for existing
 * rows first and skips seeding anything already populated, so it
 * won't create duplicates.
 *
 * These are the same 20-per-course starter questions shipped in
 * app.js's MOCK_DB, written from general subject knowledge of
 * each topic rather than transcribed from the videos. Getting
 * each course to a full, well-calibrated 500 is a real content
 * project — treat this as the seed pattern, then append more rows
 * to the Questions tab over time (same columns: courseId,
 * question, optionA-D, correctIndex, weight).
 * ============================================================ */
function seedAcademyData() {
  const courses = [
    { id: 'digital-marketing', tag: 'Digital Marketing', title: 'Digital Marketing Full Course', blurb: 'SEO, paid ads, email, and content — the full toolkit for getting a business found online.' },
    { id: 'capcut-editing', tag: 'Video Editing', title: 'CapCut for Beginners', blurb: "Mobile video editing from a blank timeline to a polished, ready-to-post clip." },
    { id: 'tiktok-ads', tag: 'Paid Advertising', title: 'How to Run TikTok Ads', blurb: "Setting up, targeting, and reading results on TikTok's ad platform." },
    { id: 'google-docs-basics', tag: 'Digital Skills', title: 'How to Use Google Docs', blurb: 'Everyday document skills — formatting, sharing, and collaborating without friction.' },
    { id: 'social-media-manager', tag: 'Social Media', title: 'Social Media Manager Full Course', blurb: 'Planning, posting, and reporting on social accounts the way a professional manager does.' }
  ];

  const lessons = [
    { courseId: 'digital-marketing', lessonId: 'l1', order: 1, title: 'Digital Marketing Full Course', desc: 'The complete walkthrough — SEO, social, paid ads, email, and analytics.', youtubeId: 'qnBhOVH1QQ8' },
    { courseId: 'capcut-editing', lessonId: 'l1', order: 1, title: 'CapCut Course for Beginners', desc: 'A full walkthrough of the CapCut interface and core editing workflow.', youtubeId: '68KNzsmBarM' },
    { courseId: 'tiktok-ads', lessonId: 'l1', order: 1, title: 'How to Run TikTok Ads — Full Course', desc: 'Campaign setup, targeting, creative, and reading your results.', youtubeId: 'T1xOxbGUB-A' },
    { courseId: 'google-docs-basics', lessonId: 'l1', order: 1, title: 'Google Docs for Beginners', desc: 'A full walkthrough of formatting, sharing, and collaborating in Google Docs.', youtubeId: 'RzNVGQYOmFk' },
    { courseId: 'social-media-manager', lessonId: 'l1', order: 1, title: 'Social Media Manager Full Course', desc: 'Strategy, content planning, publishing, community management, and reporting.', youtubeId: 'bgrA3kuZpWk' }
  ];

  // [courseId, question, optionA, optionB, optionC, optionD, correctIndex, weight]
  const questions = [
    // Digital Marketing
    ['digital-marketing', 'What does SEO stand for?', 'Search Engine Optimization', 'Site Element Order', 'Search Email Outreach', 'Sales Engagement Objective', 0, 1],
    ['digital-marketing', 'What does CTR measure?', 'Cost to reach', 'Click-through rate', 'Content transfer rate', 'Customer trust rating', 1, 2],
    ['digital-marketing', "A 'conversion' in digital marketing means:", 'A visitor leaves the site', 'A visitor completes a desired action, like a purchase or signup', 'An ad gets rejected', 'A page loads slowly', 1, 2],
    ['digital-marketing', "Which of these is 'owned media'?", 'A TV commercial', "A company's own website", 'A newspaper article about the brand', "An influencer's unpaid post", 1, 2],
    ['digital-marketing', 'CPC stands for:', 'Cost per click', 'Content per campaign', 'Customer purchase cycle', 'Click per conversion', 0, 1],
    ['digital-marketing', "What is a 'bounce rate'?", 'The percentage of visitors who leave after viewing only one page', 'The rate ads are rejected', 'How fast a page loads', 'The number of repeat customers', 0, 2],
    ['digital-marketing', 'Which channel is best suited for long-term, compounding organic traffic?', 'Paid search ads', 'SEO content', 'Flash sales', 'Cold email blasts', 1, 2],
    ['digital-marketing', "In email marketing, an 'open rate' measures:", 'How many recipients opened the email', 'How many clicked a link inside it', 'How many unsubscribed', 'How many emails bounced', 0, 1],
    ['digital-marketing', 'A/B testing in marketing is used to:', 'Compare two versions of something to see which performs better', 'Send two emails at once', 'Split a budget between two platforms', "Test a website's loading speed", 0, 2],
    ['digital-marketing', "What's the primary goal of a marketing funnel?", 'To decorate a landing page', 'To guide a stranger toward becoming a customer step by step', 'To reduce ad spend to zero', 'To automate customer support', 1, 2],
    ['digital-marketing', 'Which metric best reflects ad efficiency, not just reach?', 'Impressions', 'Return on ad spend (ROAS)', 'Follower count', 'Page likes', 1, 3],
    ['digital-marketing', "What is a 'lead magnet'?", 'A paid advertisement', 'Something of value offered in exchange for contact information', 'A type of email spam filter', 'A social media algorithm', 1, 2],
    ['digital-marketing', 'Retargeting ads are shown to:', 'Anyone on the internet', 'People who have already interacted with your brand', 'Only new customers', "Competitors' customers exclusively", 1, 2],
    ['digital-marketing', 'Which is a paid marketing channel?', 'Organic search results', 'Google Ads', 'Word of mouth', 'A blog post', 1, 1],
    ['digital-marketing', "What does 'organic reach' refer to?", 'Reach gained without paying for promotion', 'Reach only from farming-related brands', 'Reach from paid ads', 'Reach measured in kilometers', 0, 1],
    ['digital-marketing', 'A buyer persona is:', 'A legal document', 'A semi-fictional profile of your ideal customer', 'A pricing strategy', 'A type of ad format', 1, 2],
    ['digital-marketing', 'Which is the best first step before running paid ads?', 'Defining a clear target audience and goal', 'Spending the entire budget on day one', 'Skipping analytics setup', "Copying a competitor's ad exactly", 0, 2],
    ['digital-marketing', 'UGC in marketing stands for:', 'User-Generated Content', 'Universal Growth Campaign', 'Unique Global Currency', 'Updated Graphic Content', 0, 1],
    ['digital-marketing', "What's the main risk of ignoring analytics?", 'Ads load faster', 'Decisions get made on guesswork instead of evidence', 'SEO improves automatically', 'Nothing — analytics is optional', 1, 2],
    ['digital-marketing', "Which best describes 'content marketing'?", 'Buying ad space only', 'Creating valuable content to attract and retain an audience', 'Cold calling leads', 'Printing flyers', 1, 2],
    // CapCut
    ['capcut-editing', "In CapCut, what does 'splitting' a clip do?", 'Deletes the clip', 'Cuts a clip into two separate pieces at the playhead', 'Merges two clips', "Changes the clip's color", 1, 1],
    ['capcut-editing', 'Which tool would you use to make a clip play in slow motion?', 'Speed', 'Crop', 'Filter', 'Voiceover', 0, 2],
    ['capcut-editing', "What is a 'keyframe' used for?", 'Deleting audio', 'Animating a property (like zoom or position) to change over time', 'Adding subtitles automatically', 'Locking the export settings', 1, 3],
    ['capcut-editing', "What's the purpose of a transition between two clips?", "To change the video's title", 'To smooth or stylize the switch from one clip to the next', 'To add background music', 'To increase export resolution', 1, 1],
    ['capcut-editing', 'Which export setting most affects file size and clarity?', 'Resolution', 'Font choice', 'Caption position', 'Track name', 0, 2],
    ['capcut-editing', 'Auto captions in CapCut are generated from:', "The video's spoken audio", "The video's file name", 'A random word list', 'The thumbnail image', 0, 1],
    ['capcut-editing', "What does the 'crop' tool primarily change?", 'The audio pitch', 'The visible frame or aspect ratio of a clip', "The clip's speed", 'The export format', 1, 1],
    ['capcut-editing', 'Which aspect ratio is standard for TikTok/Reels/Shorts?', '16:9', '9:16', '1:1', '4:3', 1, 2],
    ['capcut-editing', "What is a 'green screen' effect used for in CapCut?", 'Adding a green filter', 'Replacing a solid-colored background with another image or video', 'Making text green', 'Boosting audio volume', 1, 2],
    ['capcut-editing', "Lowering a clip's opacity in an overlay track does what?", 'Makes it louder', 'Makes it more transparent', 'Deletes the audio', 'Speeds it up', 1, 2],
    ['capcut-editing', "What's the benefit of using 'auto reframe' or similar tools?", 'It automatically repositions footage to fit a different aspect ratio', 'It adds background music', 'It corrects spelling in captions', 'It compresses the file', 0, 2],
    ['capcut-editing', 'Which track type typically holds background music, separate from dialogue?', 'Text track', 'Audio track', 'Sticker track', 'Filter track', 1, 1],
    ['capcut-editing', "What does 'freeze frame' do?", 'Pauses the whole export', 'Holds a single frame still for a chosen duration', "Deletes a clip's audio", 'Reverses the clip', 1, 2],
    ['capcut-editing', 'Why would you use keyframed zoom on a static photo?', 'To fix audio sync', 'To add subtle motion to an otherwise still image', "To change its file format", 'To delete the background', 1, 2],
    ['capcut-editing', "What's a safe way to keep captions readable on any background?", 'Use a text outline or background box behind the text', 'Always use the smallest font size', 'Only use white text', 'Remove captions entirely', 0, 2],
    ['capcut-editing', 'Which comes first in a typical basic edit workflow?', 'Exporting', 'Importing and arranging clips on the timeline', 'Adding the final color grade', 'Publishing to social media', 1, 1],
    ['capcut-editing', "What does adjusting 'volume' on a specific clip affect?", "Only that clip's audio level", "The entire project's audio", "The video's brightness", 'The export resolution', 0, 1],
    ['capcut-editing', 'A jump cut is:', 'A hard cut between two similar shots that creates a noticeable jump', 'A type of transition effect', 'An audio distortion', 'A caption style', 0, 2],
    ['capcut-editing', 'Why trim silence from the start of a clip before editing further?', "It's required by CapCut", 'It tightens pacing and avoids dead air', 'It automatically improves resolution', 'It changes the aspect ratio', 1, 1],
    ['capcut-editing', "What's the purpose of exporting a draft at lower resolution first?", 'To check the edit quickly without a long export wait', "It's the only way to export", 'To save the project permanently', 'To add captions automatically', 0, 1],
    // TikTok Ads
    ['tiktok-ads', 'In TikTok Ads Manager, campaigns are built in which order?', 'Ad Group → Campaign → Ad', 'Campaign → Ad Group → Ad', 'Ad → Campaign → Ad Group', 'There is no set structure', 1, 2],
    ['tiktok-ads', "What does the campaign 'objective' determine?", 'The font used in ads', 'What TikTok optimizes delivery for, like traffic or conversions', "The account's username", "The video's aspect ratio only", 1, 2],
    ['tiktok-ads', "What is a 'lifetime budget'?", 'A fixed total spend across the whole campaign duration', 'A daily spend cap only', 'An unlimited budget', 'A one-time payment to TikTok', 0, 2],
    ['tiktok-ads', 'Narrow targeting (very small audience) usually risks:', 'Faster ad approval', 'Limited delivery and higher costs per result', 'Guaranteed higher sales', 'Lower creative requirements', 1, 2],
    ['tiktok-ads', 'What does CPM stand for?', 'Cost per thousand impressions', 'Cost per minute', 'Clicks per minute', 'Campaign performance metric', 0, 1],
    ['tiktok-ads', "Which is typically true of native, less 'ad-like' TikTok creative?", 'It usually performs worse than polished commercials', 'It often performs better because it blends with organic content', "It's not allowed on the platform", "It can't include a call to action", 1, 2],
    ['tiktok-ads', "What is a 'Spark Ad' on TikTok?", 'An ad format that boosts an existing organic post', 'A type of banned content', 'A discount code', 'An automatic bidding strategy', 0, 2],
    ['tiktok-ads', 'What should you check first if a campaign has high impressions but almost no clicks?', "The account's payment method", 'The ad creative and hook, and whether targeting matches the offer', "The company's tax ID", "The app's version number", 1, 3],
    ['tiktok-ads', "What does 'frequency' measure in ad reporting?", 'How often the ad account logs in', 'The average number of times a unique user saw the ad', 'How many ads are in a campaign', 'How fast a video loads', 1, 2],
    ['tiktok-ads', 'A pixel (or equivalent tracking tag) is used to:', 'Track user actions on your website after they click an ad', 'Change ad colors automatically', 'Increase video resolution', 'Block competitor ads', 0, 2],
    ['tiktok-ads', "What's a common first sign that an ad's creative is fatiguing (getting stale)?", 'Rising costs and falling engagement over time with no other changes', "Sudden drop in account balance", 'A change in campaign objective', 'The ad account gets suspended', 0, 2],
    ['tiktok-ads', 'Which metric most directly reflects cost-efficiency toward a sale?', 'Cost per result / cost per acquisition', 'Total impressions', 'Number of ad groups', 'Video watch count alone', 0, 3],
    ['tiktok-ads', "What is 'lookalike' or 'similar audience' targeting based on?", 'Random selection', 'Characteristics of an existing audience, like past customers', 'Geographic location only', 'Ad spend amount', 1, 2],
    ['tiktok-ads', 'Why run a small test budget before scaling a campaign?', "It's required by law", 'To validate performance before committing a larger budget', 'It guarantees approval', 'It increases the CPM automatically', 1, 2],
    ['tiktok-ads', "What typically happens if an ad violates TikTok's advertising policies?", 'It gets boosted for visibility', 'It gets rejected or taken down during review', 'Nothing changes', 'The advertiser is refunded automatically', 1, 1],
    ['tiktok-ads', 'A strong hook in the first few seconds of a TikTok ad mainly helps:', 'Increase watch time and reduce early drop-off', "Lower the video's resolution", 'Bypass the review process', 'Reduce targeting options', 0, 2],
    ['tiktok-ads', "What does 'optimization event' refer to in campaign setup?", "The specific action TikTok's algorithm tries to get more of, like purchases", 'The time of day ads run', "The ad's file format", "The account's creation date", 0, 2],
    ['tiktok-ads', 'Broad targeting with strong creative often performs well because:', 'It gives the algorithm more room to find responsive users', 'It always costs less per impression', 'It skips the review process', 'It disables tracking', 0, 2],
    ['tiktok-ads', "What's a reasonable first move if cost per result is rising sharply?", 'Immediately delete the ad account', 'Review targeting, creative fatigue, and budget pacing before making changes', 'Increase the budget tenfold', 'Switch the business category', 1, 2],
    ['tiktok-ads', 'Which is NOT typically a campaign objective category?', 'Traffic', 'Conversions', 'Weather forecasting', 'Awareness/Reach', 2, 1],
    // Google Docs
    ['google-docs-basics', "What does 'Suggesting' mode do in Google Docs?", 'Deletes text permanently', 'Tracks proposed edits without changing the original text until accepted', 'Shares the doc publicly', 'Locks the document from editing', 1, 2],
    ['google-docs-basics', 'Which sharing permission lets someone edit but not change sharing settings?', 'Viewer', 'Commenter', 'Editor', 'Owner', 2, 2],
    ['google-docs-basics', 'What is the fastest way to leave feedback on a specific sentence without editing it?', 'Delete the sentence', 'Add a comment', 'Change the font color', 'Print the document', 1, 1],
    ['google-docs-basics', "What does 'Version history' let you do?", "Change the document's owner", 'See and restore earlier versions of the document', 'Convert the file to PDF', 'Add collaborators', 1, 2],
    ['google-docs-basics', 'Which feature automatically generates a list of headings for navigation?', 'Table of contents', 'Footnotes', 'Page numbers', 'Word count', 0, 2],
    ['google-docs-basics', "What's the difference between 'Anyone with the link' and inviting specific people?", 'No difference at all', 'Link sharing opens access to anyone who has the URL, not just named people', 'Named invites are always public', 'Link sharing is more secure', 1, 2],
    ['google-docs-basics', "Which shortcut typically opens 'Find and replace'?", 'Ctrl/Cmd + H', 'Ctrl/Cmd + P', 'Ctrl/Cmd + B', 'Ctrl/Cmd + S', 0, 1],
    ['google-docs-basics', "What does applying a 'Heading' style (vs. just bold text) enable?", 'Nothing extra beyond appearance', 'Structure that powers the table of contents and document outline', 'Automatic translation', 'Faster printing', 1, 2],
    ['google-docs-basics', 'How does Google Docs typically save changes?', 'Manually only, via Ctrl/Cmd+S', 'Automatically, as you type', 'Only when you close the tab', 'Only when a collaborator approves', 1, 1],
    ['google-docs-basics', "What is the purpose of 'page break' in a document?", 'To delete the current page', 'To force the next content to start on a new page', 'To change the font', 'To add a comment', 1, 1],
    ['google-docs-basics', 'Which tool would you use to insert a chart from Google Sheets into a Doc?', 'Insert > Chart > From Sheets', 'Format > Paragraph styles', 'Tools > Spelling', 'File > Print', 0, 2],
    ['google-docs-basics', "What does 'Explore' (or a similar research tool) help you do?", 'Search the web and insert citations without leaving the document', 'Automatically fix all typos', "Change the document's owner", 'Compress images', 0, 1],
    ['google-docs-basics', "Why use 'Viewer' access instead of 'Editor' for some collaborators?", "It's the only free option", 'To let people read without risking accidental changes', 'Viewer access is required for comments', "There's no functional difference", 1, 2],
    ['google-docs-basics', 'What happens when you resolve a comment thread?', 'The comment is permanently deleted with no record', "It's marked resolved and hidden from the main view, but still recoverable", 'The document is locked', 'All suggestions are auto-accepted', 1, 2],
    ['google-docs-basics', 'Which feature helps keep consistent formatting across a long document?', 'Paragraph/heading styles', 'Random font changes', 'Manual spacing on every line', 'Copy-pasting from different sources', 0, 2],
    ['google-docs-basics', "What's a quick way to convert a Google Doc to a downloadable Word file?", 'File > Download > Microsoft Word (.docx)', "It's not possible", 'Insert > Word', 'Tools > Convert', 0, 1],
    ['google-docs-basics', "What does '@mentioning' someone in a comment typically do?", 'Nothing, it\u2019s just text', "Notifies that person and can grant them access if they don't have it", 'Deletes their access', "Changes their permission to Owner", 1, 2],
    ['google-docs-basics', "Why might you use 'Bookmark' or internal links in a long document?", 'To jump directly to a specific section from elsewhere in the doc', 'To share the document externally', 'To change page orientation', 'To lock specific paragraphs', 0, 2],
    ['google-docs-basics', "Which best describes 'Offline mode' in Google Docs?", 'Editing is impossible without internet', 'You can view and edit certain docs without an active connection, syncing once reconnected', 'It permanently disables sharing', 'It only works on desktop', 1, 1],
    ['google-docs-basics', 'What is the benefit of using bullet or numbered lists over plain paragraphs for steps?', 'No real benefit', 'Improves scannability and clarifies sequence or grouping', "It changes the document language", 'It reduces file size significantly', 1, 1],
    // Social Media Manager
    ['social-media-manager', 'What should a content calendar be built around first?', 'Whatever is trending that day', "Clear goals and the audience you're trying to reach", "The manager's personal preferences", 'Competitor copy-paste', 1, 2],
    ['social-media-manager', 'Engagement rate is generally calculated as:', 'Total followers divided by posts', 'Interactions (likes, comments, shares) relative to reach or followers', 'Number of hashtags used', 'Posting frequency per week', 1, 2],
    ['social-media-manager', 'Why track reach separately from impressions?', 'They are always identical', 'Reach counts unique viewers, impressions count total views including repeats', 'Reach only applies to paid posts', "Impressions don't exist on social platforms", 1, 2],
    ['social-media-manager', "What's a reasonable first response to a negative public comment from a real customer?", 'Delete it immediately without response', 'Acknowledge it professionally and move detailed resolution to a private channel', 'Argue publicly to defend the brand', 'Ignore it completely', 1, 3],
    ['social-media-manager', "A 'content pillar' is:", 'A physical prop used in photos', 'A core recurring theme that content is organized around', 'A paid ad format', 'A type of analytics dashboard', 1, 2],
    ['social-media-manager', 'Why does posting consistency generally matter?', 'It has no effect on performance', 'It builds audience expectation and can support algorithmic visibility', 'It guarantees virality', 'Platforms penalize any regular schedule', 1, 2],
    ['social-media-manager', 'What belongs in a basic monthly social media report?', 'Only follower count', 'Key metrics against goals, top-performing content, and takeaways', 'A list of every single post with no analysis', 'Competitor login credentials', 1, 2],
    ['social-media-manager', 'Which is a community management task?', 'Designing the company logo', 'Responding to comments and DMs in a timely, on-brand way', 'Filing tax returns', 'Negotiating office rent', 1, 1],
    ['social-media-manager', "What's the risk of posting the same content identically across every platform?", 'No risk, platforms are interchangeable', 'Missing each platform\u2019s format, tone, and audience expectations', 'Guaranteed higher engagement everywhere', 'Accounts get automatically merged', 1, 2],
    ['social-media-manager', "A 'call to action' in a social post is meant to:", 'Decorate the caption', "Tell the viewer exactly what to do next, like 'comment below' or 'shop now'", 'Increase the character count', 'Replace the need for a caption', 1, 1],
    ['social-media-manager', "Why review analytics before planning the next month's content?", "It's not necessary if content looks good", "To repeat what worked and adjust or drop what didn't", 'Analytics only matter for paid ads', "To copy a competitor's exact calendar", 1, 2],
    ['social-media-manager', "What does 'social listening' involve?", 'Only posting content, never reading responses', 'Monitoring mentions, comments, and conversations about a brand or topic', 'Turning off comments', 'Deleting negative reviews', 1, 2],
    ['social-media-manager', 'Which is generally true about short-form video across platforms right now?', 'It is a minor, declining format', 'It tends to drive strong reach relative to other formats', 'It performs identically to static images always', 'It is banned on most platforms', 1, 2],
    ['social-media-manager', "What's the value of a brand voice/tone guide for a social team?", 'It restricts creativity with no benefit', 'It keeps posts consistent even when different people are writing them', 'It is only needed for legal documents', 'It replaces the need for a content calendar', 1, 2],
    ['social-media-manager', 'When a post underperforms, what is a useful first diagnostic question?', 'Was the timing, format, or hook off compared to what usually works?', 'Should the account be deleted?', 'Is the platform broken?', 'Should posting stop entirely?', 0, 2],
    ['social-media-manager', "What's a practical reason to repurpose one piece of content across formats (e.g. a video into a carousel)?", "It's required by every platform's terms of service", 'It extends the value of one idea without starting from scratch each time', 'It guarantees identical performance everywhere', 'It removes the need for analytics', 1, 2],
    ['social-media-manager', 'Handling a crisis or PR issue on social media should generally start with:', 'Posting jokes to lighten the mood', 'A calm, honest, and timely acknowledgment, escalated internally as needed', 'Deleting the account', 'Blocking everyone who comments', 1, 2],
    ['social-media-manager', "What's the purpose of A/B testing captions or thumbnails?", 'To waste time', 'To learn what resonates better with the audience using evidence, not guesses', 'It is only possible with a huge budget', 'To confuse the algorithm', 1, 2],
    ['social-media-manager', 'Why is knowing peak audience activity times useful?', 'It has no real impact on reach', 'Posting when your audience is active tends to support better initial engagement', 'It is only relevant for paid campaigns', 'It guarantees a post goes viral', 1, 1],
    ['social-media-manager', 'What best describes the role of a social media manager overall?', 'Only designing graphics', "Planning, publishing, engaging, and reporting on a brand's social presence toward real goals", 'Managing the company payroll', 'Writing legal contracts', 1, 1]
  ];

  const coursesSheet = getOrCreateSheet('Courses', ['id', 'tag', 'title', 'blurb']);
  if (coursesSheet.getLastRow() <= 1) {
    courses.forEach(c => coursesSheet.appendRow([c.id, c.tag, c.title, c.blurb]));
  }

  const lessonsSheet = getOrCreateSheet('Lessons', ['courseId', 'lessonId', 'order', 'title', 'desc', 'youtubeId']);
  if (lessonsSheet.getLastRow() <= 1) {
    lessons.forEach(l => lessonsSheet.appendRow([l.courseId, l.lessonId, l.order, l.title, l.desc, l.youtubeId]));
  }

  const questionsSheet = getOrCreateSheet('Questions', ['courseId', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'correctIndex', 'weight']);
  if (questionsSheet.getLastRow() <= 1) {
    questions.forEach(row => questionsSheet.appendRow(row));
  }

  Logger.log('Seed complete: %s courses, %s lessons, %s questions.', courses.length, lessons.length, questions.length);
}

/* ============================================================
 * DIGITAL MARKETING EXPANSION — run expandDigitalMarketingQuestions()
 * once from the Apps Script editor to add these 120 questions on top
 * of the original starter 20 (140 total for this course so far).
 * Written from general, well-established digital marketing knowledge
 * across 15 subtopics (keyword research, on-page/off-page/technical
 * SEO, content, email, social, paid search, paid social, analytics,
 * CRO, branding, funnels, affiliate/influencer, and strategy/ROI).
 *
 * This is safe to run more than once — it checks the Questions tab
 * for exact question-text matches already present for this course
 * and only appends ones that aren't there yet, so re-running won't
 * create duplicates.
 *
 * Digital Marketing now stands at 140 of the eventual 500. Same
 * pattern to keep extending: add more rows to the array below (or a
 * new expansion function) and re-run.
 * ============================================================ */
function expandDigitalMarketingQuestions() {
  const newRows = [
    ['digital-marketing', 'What is "search intent"?', 'The reason or goal behind a user\'s search query', 'The number of searches per month', 'The keyword\'s character count', 'The ad\'s landing page URL', 0, 1],
    ['digital-marketing', 'Which keyword type usually has lower search volume but higher conversion intent?', 'Short-tail', 'Long-tail', 'Branded', 'Generic', 1, 2],
    ['digital-marketing', '"Navigational" search intent means the user is trying to:', 'Find a specific website or page', 'Compare prices', 'Learn general information', 'Make an immediate purchase', 0, 2],
    ['digital-marketing', 'What does keyword "difficulty" typically estimate?', 'How hard the word is to spell', 'How competitive it is to rank for that keyword', 'How many words it contains', 'Its average CPC only', 1, 1],
    ['digital-marketing', 'Which is an example of "transactional" search intent?', '"what is SEO"', '"best running shoes"', '"buy running shoes size 10"', '"nike.com"', 2, 2],
    ['digital-marketing', 'Why look at "related searches" or "People also ask" when researching keywords?', 'They\'re irrelevant to SEO', 'They reveal related questions and subtopics real users are searching for', 'They only show paid ads', 'They replace the need for any other research', 1, 2],
    ['digital-marketing', 'A branded keyword includes:', 'A generic product category', 'The company or product name itself', 'Only location terms', 'Only question words', 1, 1],
    ['digital-marketing', 'What\'s a risk of targeting only very broad, high-volume keywords?', 'No risk at all', 'Extremely high competition and often lower buyer intent', 'They guarantee top rankings', 'They cost nothing to target', 1, 2],
    ['digital-marketing', 'What is a "meta description" primarily used for?', 'It\'s a ranking factor that guarantees position one', 'A summary shown in search results that can influence click-through rate', 'It replaces the page title', 'It\'s only visible to developers', 1, 2],
    ['digital-marketing', 'Where should the primary keyword ideally appear for strong on-page SEO?', 'Nowhere on the page', 'In the title tag, headings, and naturally within the content', 'Only in the image file names', 'Only in the footer', 1, 1],
    ['digital-marketing', 'What is "alt text" on an image for?', 'Decorative color styling', 'Describing the image for accessibility and search engines', 'Compressing the file size', 'Setting the image\'s dimensions', 1, 1],
    ['digital-marketing', 'Why use descriptive, keyword-relevant URLs instead of random strings?', 'It has no effect', 'It helps both users and search engines understand the page\'s topic', 'URLs are never seen by search engines', 'It\'s required by law', 1, 2],
    ['digital-marketing', 'What does "internal linking" refer to?', 'Links to other websites', 'Links between pages on the same website', 'Paid backlinks', 'Broken links', 1, 1],
    ['digital-marketing', 'A page\'s H1 tag typically represents:', 'The smallest text on the page', 'The main heading or topic of the page', 'The footer copyright notice', 'A hidden SEO trick with no visible effect', 1, 1],
    ['digital-marketing', 'What is "keyword stuffing" and why is it a problem?', 'A helpful technique with no downsides', 'Overusing a keyword unnaturally, which can hurt rankings and readability', 'A method to increase page speed', 'A required step in on-page SEO', 1, 2],
    ['digital-marketing', 'What does the "page title" (title tag) primarily influence?', 'The website\'s hosting cost', 'Search result display and relevance signals', 'The site\'s domain name', 'Server response time', 1, 2],
    ['digital-marketing', 'What is a "backlink"?', 'A link from your own site to itself', 'A link from another website pointing to yours', 'A broken link', 'A social media hashtag', 1, 1],
    ['digital-marketing', 'Why do search engines generally treat backlinks as a trust signal?', 'They don\'t factor into rankings at all', 'Other sites linking to you can indicate your content is valuable or authoritative', 'Backlinks only affect page load speed', 'They are purely decorative', 1, 2],
    ['digital-marketing', 'What is "domain authority" (or similar third-party scores) meant to estimate?', 'The exact Google ranking position', 'A relative prediction of how well a site might rank, based on its link profile and other factors', 'The number of pages on a site', 'The site\'s monthly revenue', 1, 2],
    ['digital-marketing', 'Which is considered a risky, potentially penalized link-building tactic?', 'Earning links through genuinely useful content', 'Buying large quantities of low-quality backlinks', 'Getting linked by a reputable industry publication', 'Guest posting on a relevant, reputable site', 1, 2],
    ['digital-marketing', 'What is "anchor text"?', 'The visible, clickable text of a hyperlink', 'The webpage\'s loading speed', 'A type of image format', 'The site\'s server location', 0, 1],
    ['digital-marketing', 'Why might a single link from a highly reputable, relevant site be worth more than many links from low-quality sites?', 'It never matters', 'Search engines generally weigh link quality and relevance, not just quantity', 'Quality has no bearing on SEO', 'Low-quality links always help more', 1, 3],
    ['digital-marketing', 'Which is an example of digital PR as a link-building strategy?', 'Buying links in bulk from link farms', 'Getting featured in a journalist\'s article that links back to your site', 'Hiding links in invisible text', 'Creating fake reviews', 1, 2],
    ['digital-marketing', 'What\'s a "nofollow" link generally used to indicate?', 'A link that should not pass on ranking credit or trust to the destination', 'A broken link', 'The fastest-loading link on a page', 'A link only visible on mobile', 0, 2],
    ['digital-marketing', 'What does a "sitemap" help search engines do?', 'Increase ad revenue', 'Discover and understand the structure of a website\'s pages', 'Block certain visitors', 'Change page colors', 1, 1],
    ['digital-marketing', 'What is "robots.txt" used for?', 'Displaying a cookie banner', 'Giving instructions to search engine crawlers about which pages to crawl or avoid', 'Compressing images', 'Managing email subscribers', 1, 2],
    ['digital-marketing', 'Why does page load speed matter for SEO?', 'It has zero effect on rankings or user experience', 'Slow pages can hurt both user experience and search rankings', 'It only matters for video content', 'Search engines can\'t measure speed', 1, 2],
    ['digital-marketing', 'What does "mobile-friendliness" refer to in SEO?', 'Whether a site displays and functions well on smartphones', 'Whether a site has a mobile app', 'Whether a site blocks mobile traffic', 'The site\'s server brand', 0, 1],
    ['digital-marketing', 'A "404 error" typically means:', 'The page loaded successfully', 'The requested page could not be found', 'The site is under maintenance', 'The user is not logged in', 1, 1],
    ['digital-marketing', 'What is a "canonical tag" used to address?', 'Duplicate content across multiple URLs, by indicating the preferred version', 'Broken images', 'Slow server response', 'Missing meta descriptions', 0, 3],
    ['digital-marketing', 'Why might HTTPS (a secure connection) matter for SEO?', 'It has no relevance to search engines', 'It\'s a trust and security signal that can factor into rankings', 'It only affects video pages', 'It slows down every website', 1, 1],
    ['digital-marketing', 'What does "crawlability" describe?', 'How easily search engine bots can access and read a site\'s pages', 'How many ads are on a page', 'A site\'s color scheme', 'The number of site visitors', 0, 2],
    ['digital-marketing', 'What is the main purpose of a "content pillar page"?', 'A single ad creative', 'A comprehensive page that broadly covers a topic and links to related, deeper content', 'A checkout page', 'A 404 error page', 1, 2],
    ['digital-marketing', 'Why map content to different stages of the buyer\'s journey (awareness, consideration, decision)?', 'It\'s unnecessary complexity', 'Different content serves people at different points in their decision-making process', 'Only decision-stage content matters', 'Awareness content should always sell hard', 1, 2],
    ['digital-marketing', 'What\'s a common goal of "evergreen content"?', 'Content that\'s only relevant for one day', 'Content that stays useful and relevant over a long period of time', 'Content that must be deleted after a week', 'Content exclusively about current events', 1, 1],
    ['digital-marketing', 'What does repurposing content mean?', 'Deleting old content permanently', 'Adapting one piece of content into different formats, like a blog post into a video', 'Copying a competitor\'s content word for word', 'Running the same ad forever unchanged', 1, 1],
    ['digital-marketing', 'Why is a consistent publishing schedule often recommended for content marketing?', 'It guarantees virality', 'It builds audience habit and can support steady growth over time', 'Search engines penalize any regular schedule', 'It\'s only relevant for email marketing', 1, 1],
    ['digital-marketing', 'What is a "content audit"?', 'A financial review of ad spend', 'A systematic review of existing content to assess performance and gaps', 'A legal review of copyright', 'A one-time backup of the website', 1, 2],
    ['digital-marketing', 'Which best distinguishes content marketing from traditional advertising?', 'Content marketing never mentions the brand', 'Content marketing focuses on providing value first to attract and retain an audience', 'They are identical in approach', 'Content marketing is always paid', 1, 2],
    ['digital-marketing', 'Why would a brand create a case study as content?', 'To bore potential customers', 'To provide credible, real-world proof of results for prospective customers', 'Case studies have no marketing value', 'To satisfy a legal requirement', 1, 1],
    ['digital-marketing', 'What is "segmentation" in email marketing?', 'Sending identical emails to everyone', 'Dividing an email list into groups based on shared traits or behavior', 'Deleting inactive subscribers immediately', 'A spam filtering technique', 1, 2],
    ['digital-marketing', 'What does an "unsubscribe rate" indicate?', 'How many people opened the email', 'The percentage of recipients who opted out of future emails', 'How many emails bounced', 'How many people clicked a link', 1, 1],
    ['digital-marketing', 'Why is a clear, honest subject line important?', 'It has no impact on open rates', 'It\'s often the main factor in whether someone opens the email at all', 'Subject lines are hidden from recipients', 'It only matters for spam filters', 1, 2],
    ['digital-marketing', 'What is a "drip campaign"?', 'A single one-off email blast', 'A series of automated emails sent based on a schedule or triggered actions', 'A method for cleaning an email list', 'A type of unsubscribe button', 1, 2],
    ['digital-marketing', 'What does "double opt-in" mean for email signups?', 'Subscribing to two different newsletters', 'Requiring a subscriber to confirm their email address after initially signing up', 'Sending two emails at once', 'Paying twice for an email tool', 1, 2],
    ['digital-marketing', 'Why should email marketers avoid buying email lists?', 'There\'s no downside to it', 'It typically leads to poor engagement, spam complaints, and potential legal issues', 'Bought lists always convert better', 'It\'s required by anti-spam law', 1, 2],
    ['digital-marketing', 'What is a "hard bounce"?', 'A temporary delivery failure, like a full inbox', 'A permanent delivery failure, often due to an invalid email address', 'An email opened twice', 'A successful delivery', 1, 1],
    ['digital-marketing', 'What\'s the benefit of personalizing emails, such as using a subscriber\'s name?', 'It has no effect on engagement', 'It can improve engagement by making the message feel more relevant', 'It\'s against best practice', 'It guarantees a sale', 1, 1],
    ['digital-marketing', 'Why might posting strategy differ between LinkedIn and TikTok?', 'It shouldn\'t differ at all', 'Each platform has a different audience, format expectation, and tone', 'All platforms have identical algorithms', 'Only paid content matters on both', 1, 2],
    ['digital-marketing', 'What does a platform\'s "algorithm" primarily determine?', 'The price of running a business account', 'What content gets shown to which users, and how prominently', 'The number of employees a company has', 'The color scheme of the app', 1, 1],
    ['digital-marketing', 'What is a "hashtag" primarily used for?', 'Deleting a post', 'Categorizing content and helping it be discovered around a topic', 'Blocking comments', 'Scheduling posts automatically', 1, 1],
    ['digital-marketing', 'Why might a brand run a social media contest or giveaway?', 'It has no strategic value', 'To boost engagement, reach, or follower growth around a specific goal', 'It\'s required by every platform', 'To reduce customer trust', 1, 1],
    ['digital-marketing', 'What\'s the value of a "content calendar" for social media?', 'None, spontaneous posting always performs best', 'It helps plan, organize, and stay consistent with posting across platforms', 'It\'s only useful for paid ads', 'It replaces the need for analytics', 1, 1],
    ['digital-marketing', 'What does "organic social media" refer to?', 'Posts and activity that aren\'t paid for', 'Only posts about environmental topics', 'Posts that are always sponsored', 'A platform exclusively for farmers', 0, 1],
    ['digital-marketing', 'Why track "share of voice" on social media?', 'It measures your brand\'s visibility relative to competitors on a given topic', 'It only tracks negative comments', 'It\'s unrelated to marketing', 'It replaces follower count entirely', 0, 2],
    ['digital-marketing', 'What\'s a common reason brands use social media management tools (schedulers)?', 'To publish content automatically and manage multiple platforms efficiently', 'They are required by every social platform', 'They eliminate the need for any content strategy', 'They only track competitor ad spend', 0, 1],
    ['digital-marketing', 'In a typical PPC (pay-per-click) model, when does the advertiser pay?', 'Only when someone views the ad', 'When someone clicks the ad', 'Once per day regardless of activity', 'Only when a sale is made, always', 1, 1],
    ['digital-marketing', 'What does "Quality Score" in Google Ads generally reflect?', 'The advertiser\'s account age', 'The relevance and expected performance of an ad, keyword, and landing page together', 'The number of employees at the company', 'The size of the daily budget', 1, 3],
    ['digital-marketing', 'What is a "negative keyword" used for in a search campaign?', 'Keywords that guarantee a top position', 'Terms you exclude so your ad doesn\'t show for irrelevant searches', 'Keywords that are automatically banned by Google', 'A keyword with a negative sentiment word in it', 1, 2],
    ['digital-marketing', 'What does "ad rank" help determine?', 'The company\'s credit score', 'An ad\'s position and whether it\'s eligible to show at all', 'The website\'s hosting speed', 'The number of ad extensions allowed', 1, 2],
    ['digital-marketing', 'What\'s the purpose of "ad extensions" (like sitelinks or call buttons)?', 'To increase the ad\'s cost artificially', 'To add extra useful information or actions to an ad, often improving performance', 'They are purely decorative with no functional impact', 'They replace the need for a landing page', 1, 2],
    ['digital-marketing', 'What does "impression share" measure?', 'The percentage of eligible impressions your ads actually received', 'The number of unique visitors to a site', 'The total ad spend for a month', 'The click-through rate only', 0, 2],
    ['digital-marketing', 'Why might an advertiser use match types like broad, phrase, and exact?', 'They control how closely a search query must match a keyword to trigger the ad', 'They determine the ad\'s color scheme', 'They set the campaign\'s start date', 'They are only relevant for display ads', 0, 2],
    ['digital-marketing', 'What\'s a key difference between search ads and display ads?', 'There is no difference', 'Search ads typically target active search intent; display ads focus more on visual reach and awareness', 'Display ads only run on mobile', 'Search ads never use images', 1, 2],
    ['digital-marketing', 'What does "bid strategy" control in a paid social campaign?', 'The ad\'s visual design only', 'How the platform spends your budget to pursue your chosen goal', 'The account\'s payment method', 'The ad reviewer\'s name', 1, 2],
    ['digital-marketing', 'What\'s the purpose of a "custom audience" built from existing customer data?', 'To target people already connected to your business for tailored ads', 'To randomly select strangers', 'To disable ad tracking', 'To reduce ad relevance', 0, 2],
    ['digital-marketing', 'What does "ad relevance" or a similar quality signal typically affect?', 'Nothing measurable', 'How well an ad is likely to resonate with its audience, which can affect cost and delivery', 'Only the advertiser\'s login credentials', 'The platform\'s server location', 1, 2],
    ['digital-marketing', 'Why might a marketer test multiple ad creatives within one ad set?', 'It\'s not allowed on most platforms', 'To learn which creative performs best with real data instead of guessing', 'It guarantees the lowest possible cost automatically', 'Testing has no impact on results', 1, 2],
    ['digital-marketing', 'What\'s the risk of allowing a campaign to run with no monitoring after launch?', 'There is no risk once launched', 'Underperformance or overspending can go unnoticed and uncorrected', 'Campaigns automatically optimize with zero oversight needed', 'Monitoring is only required for search ads', 1, 2],
    ['digital-marketing', 'What does "placement" refer to in a paid social campaign?', 'The physical office location of the advertiser', 'Where the ad actually appears, like a feed, story, or in-stream slot', 'The campaign\'s billing currency', 'The account\'s creation date', 1, 1],
    ['digital-marketing', 'Why might a brand exclude existing customers from a prospecting (new-customer) campaign?', 'To avoid wasting budget targeting people who\'ve already converted', 'It\'s required by every ad platform', 'Existing customers should never see any ads', 'It has no effect on efficiency', 0, 2],
    ['digital-marketing', 'What is "creative fatigue" in the context of paid social ads?', 'A technical bug in the ad platform', 'Declining performance over time as the same audience sees the same ad repeatedly', 'A billing error', 'A type of ad rejection', 1, 2],
    ['digital-marketing', 'What does "attribution" attempt to determine in marketing analytics?', 'The exact office address of a competitor', 'Which marketing touchpoints get credit for leading to a conversion', 'The font used in an ad', 'The server hosting a website', 1, 2],
    ['digital-marketing', 'What is "last-click attribution"?', 'A model that gives all credit for a conversion to the very last touchpoint before it', 'A model that ignores conversions entirely', 'A method of blocking bots', 'A type of email format', 0, 2],
    ['digital-marketing', 'Why might last-click attribution undervalue awareness-stage marketing?', 'It doesn\'t, it values every touchpoint equally', 'It ignores earlier touchpoints, like an initial social ad, that helped lead to the eventual conversion', 'Awareness marketing never contributes to conversions', 'Last-click attribution only applies to email', 1, 3],
    ['digital-marketing', 'What does "customer lifetime value" (LTV) estimate?', 'How long a customer keeps a product in a cart', 'The total revenue a business can expect from a customer over the relationship', 'The number of ads a customer has seen', 'A customer\'s exact age', 1, 2],
    ['digital-marketing', 'What is "churn rate" typically used to measure?', 'The percentage of customers who stop using a product or service over a period', 'The number of new sign-ups', 'Total ad impressions', 'Average order value', 0, 2],
    ['digital-marketing', 'Why compare metrics against a previous period or benchmark?', 'Raw numbers alone often lack context without something to compare them to', 'Comparisons are misleading and should be avoided', 'Only competitor data should ever be used', 'Benchmarks are irrelevant to marketing', 0, 1],
    ['digital-marketing', 'What does "average order value" (AOV) measure?', 'The average amount spent per transaction', 'The number of orders per day', 'The average shipping time', 'The number of returning customers', 0, 1],
    ['digital-marketing', 'Why might a marketer track "assisted conversions" alongside direct conversions?', 'To see which channels contributed to a sale even if they weren\'t the final touchpoint', 'Assisted conversions are a made-up metric with no use', 'It replaces the need for any other tracking', 'It only applies to offline sales', 0, 3],
    ['digital-marketing', 'What does CRO stand for?', 'Content Reach Optimization', 'Conversion Rate Optimization', 'Customer Relations Outreach', 'Campaign Reporting Overview', 1, 1],
    ['digital-marketing', 'What is the main goal of a dedicated landing page for an ad campaign?', 'To showcase the entire website\'s navigation', 'To focus a visitor\'s attention on one specific offer or action', 'To maximize the number of links on the page', 'To replace the homepage entirely', 1, 2],
    ['digital-marketing', 'Why might too many form fields hurt a landing page\'s conversion rate?', 'More fields always improve trust', 'Extra friction can cause visitors to abandon the form before completing it', 'Forms have no effect on conversions', 'Fields are purely a design choice with no functional impact', 1, 2],
    ['digital-marketing', 'What is a common purpose of "social proof" (testimonials, reviews) on a landing page?', 'To fill empty space with no strategic purpose', 'To build trust and credibility with prospective customers', 'To slow down page load time intentionally', 'It\'s required by law on every page', 1, 1],
    ['digital-marketing', 'What does "above the fold" refer to on a webpage?', 'The printed portion of a newspaper', 'The content visible on a screen before scrolling', 'A page that has been indexed twice', 'A broken page layout', 1, 1],
    ['digital-marketing', 'Why run an A/B test on a landing page headline?', 'To determine which version drives better performance based on real visitor data', 'Headlines never affect conversion rates', 'It\'s only useful for email subject lines', 'A/B testing is banned on landing pages', 0, 2],
    ['digital-marketing', 'What\'s a clear, specific call to action likely to improve?', 'Server response time', 'The likelihood a visitor takes the intended next step', 'The site\'s domain authority automatically', 'Email deliverability', 1, 1],
    ['digital-marketing', 'Why keep a landing page\'s message consistent with the ad that led to it?', 'Consistency isn\'t important', 'Mismatched messaging can confuse visitors and increase bounce or drop-off', 'Ads and landing pages should always say completely different things', 'It only matters for search ads, not social ads', 1, 2],
    ['digital-marketing', 'What is "brand positioning"?', 'The physical location of a company\'s office', 'How a brand is perceived relative to competitors in the minds of its audience', 'The company\'s tax classification', 'A type of ad format', 1, 2],
    ['digital-marketing', 'What does a "unique selling proposition" (USP) describe?', 'The most expensive product in a lineup', 'What makes a brand or product meaningfully different from competitors', 'A company\'s shipping policy', 'An unrelated legal disclaimer', 1, 2],
    ['digital-marketing', 'Why does consistent visual branding across channels matter?', 'It has no measurable benefit', 'It builds recognition and trust as people encounter the brand repeatedly', 'It\'s only relevant for large corporations', 'Consistency actively hurts recall', 1, 1],
    ['digital-marketing', 'What is "brand equity"?', 'A company\'s physical assets only', 'The value a brand holds based on consumer perception, loyalty, and recognition', 'The number of employees', 'A type of ad extension', 1, 2],
    ['digital-marketing', 'Why might a company invest in brand awareness campaigns even without an immediate call to action?', 'Awareness has no long-term value', 'Building familiarity can support easier conversions later in the funnel', 'It\'s a wasted use of budget always', 'It\'s only appropriate for nonprofits', 1, 2],
    ['digital-marketing', 'What does "tone of voice" refer to in branding?', 'The literal volume of a company\'s ads', 'The consistent style and personality used in a brand\'s written communication', 'A legal requirement for all advertising', 'The pricing tier of a product', 1, 1],
    ['digital-marketing', 'Why differentiate a brand beyond just price?', 'Price is the only factor customers ever consider', 'Competing purely on price is often unsustainable and easy for competitors to undercut', 'Differentiation is irrelevant to marketing', 'It\'s illegal to compete on price', 1, 2],
    ['digital-marketing', 'What\'s a "brand guideline" document typically used for?', 'Tracking ad spend', 'Ensuring consistent use of a brand\'s visual and verbal identity across teams and channels', 'Filing taxes', 'Managing a customer support queue', 1, 1],
    ['digital-marketing', 'What does TOFU, MOFU, BOFU typically stand for in funnel marketing?', 'Types of ad formats', 'Top, Middle, and Bottom of Funnel', 'Three social media platforms', 'Three currencies used in ad billing', 1, 1],
    ['digital-marketing', 'At the "awareness" stage of a funnel, content is typically meant to:', 'Close a sale immediately', 'Introduce a problem or brand to someone unfamiliar with it', 'Process a refund', 'Upsell an existing customer', 1, 1],
    ['digital-marketing', 'What generally happens at the "decision" stage of a buyer\'s journey?', 'The person first hears about the brand', 'The person is close to choosing a specific solution or vendor', 'The person has already forgotten the brand', 'No content is needed at this stage', 1, 2],
    ['digital-marketing', 'Why map content types to each funnel stage?', 'It\'s unnecessary and funnels don\'t reflect real behavior', 'Different content serves different levels of buyer readiness and intent', 'All stages should use identical hard-sell messaging', 'Funnels only apply to B2B companies', 1, 2],
    ['digital-marketing', 'What is "customer retention" primarily focused on?', 'Attracting entirely new customers only', 'Keeping existing customers engaged and returning after their first purchase', 'Filing legal complaints', 'Reducing ad spend to zero', 1, 1],
    ['digital-marketing', 'Why is retention often cheaper than new customer acquisition?', 'It\'s actually always more expensive', 'Marketing to existing, already-engaged customers typically costs less than acquiring strangers', 'Retention has no associated cost', 'Acquisition is always free', 1, 2],
    ['digital-marketing', 'What does "upselling" mean?', 'Lowering a product\'s price', 'Encouraging a customer to purchase a higher-value or upgraded option', 'Canceling a subscription', 'Deleting a customer account', 1, 1],
    ['digital-marketing', 'What is "cross-selling"?', 'Selling to a different, unrelated company', 'Recommending complementary products related to what a customer is already buying', 'Refusing additional sales', 'Selling only overseas', 1, 1],
    ['digital-marketing', 'How are affiliate marketers typically compensated?', 'A fixed salary regardless of performance', 'A commission based on sales or actions they generate', 'Only through equity in the company', 'They are never compensated', 1, 1],
    ['digital-marketing', 'What is an "affiliate link" used for?', 'Decorating a webpage', 'Tracking referrals so commissions can be attributed correctly', 'Blocking bot traffic', 'Formatting text', 1, 1],
    ['digital-marketing', 'Why do brands work with influencers whose audience closely matches their target market?', 'Audience relevance has no bearing on results', 'Better audience fit generally leads to more relevant, effective engagement', 'All audiences perform identically regardless of fit', 'It\'s a legal requirement', 1, 2],
    ['digital-marketing', 'What does "disclosure" (e.g. #ad, #sponsored) in influencer content refer to?', 'An optional flourish with no real purpose', 'Clearly indicating that content is paid or sponsored, often a legal or ethical requirement', 'A hashtag that boosts reach artificially', 'A type of contract clause about payment terms', 1, 2],
    ['digital-marketing', 'What\'s a potential downside of choosing an influencer purely based on high follower count?', 'There is no downside', 'Follower count doesn\'t guarantee genuine engagement or audience relevance', 'High followers always guarantee high sales', 'Follower count is the only metric that matters', 1, 2],
    ['digital-marketing', 'What does "engagement rate" help assess about an influencer?', 'Their physical location', 'How actively their audience interacts with their content relative to reach or followers', 'Their tax bracket', 'The platform\'s server uptime', 1, 2],
    ['digital-marketing', 'What is a "micro-influencer" generally characterized by?', 'Millions of followers and celebrity status', 'A smaller, often niche and highly engaged following', 'No online presence at all', 'Exclusively B2B audiences', 1, 1],
    ['digital-marketing', 'Why might affiliate marketing be considered lower-risk for the advertiser compared to upfront ad spend?', 'It carries no risk of any kind', 'Payment is often tied to actual results rather than guaranteed spend', 'Affiliates are always free to work with', 'It eliminates the need for tracking', 1, 2],
    ['digital-marketing', 'What does ROI stand for in marketing?', 'Rate of Interaction', 'Return on Investment', 'Reach of Impressions', 'Ranking Optimization Index', 1, 1],
    ['digital-marketing', 'How is basic marketing ROI generally calculated?', 'Total impressions divided by budget', '(Revenue generated minus cost) divided by cost', 'Number of employees divided by budget', 'Website visits multiplied by two', 1, 2],
    ['digital-marketing', 'Why set specific, measurable goals before launching a marketing campaign?', 'Goals are optional and rarely useful', 'They give a clear benchmark to judge whether the campaign actually worked', 'Vague goals always perform better', 'It\'s only necessary for large budgets', 1, 1],
    ['digital-marketing', 'What does "customer acquisition cost" (CAC) measure?', 'The average cost to acquire one new customer', 'The total company revenue', 'The number of products in stock', 'The price of a single ad impression', 0, 2],
    ['digital-marketing', 'Why compare CAC to customer lifetime value (LTV)?', 'They\'re unrelated metrics with no reason to compare', 'To judge whether acquiring a customer is actually profitable over time', 'LTV always equals CAC by definition', 'Only large companies need to make this comparison', 1, 3],
    ['digital-marketing', 'What\'s a reasonable reason to allocate a marketing budget across multiple channels instead of just one?', 'Diversification can reduce risk and reach audiences that respond differently to different channels', 'It\'s illegal to use just one channel', 'Budget should always go to the cheapest channel only', 'Multiple channels always cost the same as one', 0, 2],
    ['digital-marketing', 'Why review and adjust a marketing strategy periodically instead of setting it once?', 'Markets, platforms, and audience behavior change over time', 'Strategies never need revisiting once launched', 'Reviewing a strategy guarantees failure', 'Only new companies need to revisit strategy', 0, 1],
    ['digital-marketing', 'What is a competitive analysis in marketing strategy used for?', 'Copying a competitor\'s ads exactly', 'Understanding competitors\' strengths, weaknesses, and positioning to inform your own strategy', 'Filing a lawsuit', 'Setting your own prices arbitrarily higher', 1, 2],  ];

  const sheet = getOrCreateSheet('Questions', ['courseId', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'correctIndex', 'weight']);
  const existing = sheet.getDataRange().getValues();
  const existingQuestions = new Set(
    existing.slice(1).filter(r => r[0] === 'digital-marketing').map(r => r[1])
  );

  let added = 0;
  newRows.forEach(row => {
    if (!existingQuestions.has(row[1])) {
      sheet.appendRow(row);
      added++;
    }
  });

  Logger.log('Digital Marketing expansion: %s new questions added (%s were already present).', added, newRows.length - added);
}
