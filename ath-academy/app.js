/* ============================================================
   ATH ACADEMY — app.js
   Talks to the live Apps Script backend (Code.gs) — see the API
   object below for the deployment URL. The five real courses,
   their lessons, and question banks live in the ATH Recruiters
   Directory spreadsheet now, not in this file.

   RULES ENCODED HERE (per the July decisions):
   - One assessment attempt per course completion. Fail, and the
     course locks until every lesson is marked complete again.
   - 50-minute countdown once the assessment starts. Time out and
     it auto-submits whatever was answered.
   - Closing mid-lesson resumes where you left off (saved to this
     browser via localStorage — see README for cross-device notes).
     Closing mid-assessment forfeits the attempt; there is nothing
     to resume, by design.
   - Certificates get a numeric certificate ID, logged centrally,
     checkable on the public verify page.
   - Scoring happens server-side in Code.gs, which is the only
     place that holds the answer key — the browser never sees
     which option is correct, before or after answering.
   ============================================================ */

const PASS_MARK = 90;                 // percent, weighted
const ASSESSMENT_SECONDS = 50 * 60;   // 50-minute countdown

/* ---------- API layer ----------
   Wired to the live Apps Script deployment. If you ever redeploy Code.gs
   under a NEW deployment (not "manage deployments > new version" on the
   same one), update this URL to match. */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxPt9A2DzRxJtnhye2SZ0gpw6arjAEchV83oCay8CodUhjos9Bd-pBYcUOEd3d2b4a3Qw/exec';

async function apiGet(params) {
  const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
  const res = await fetch(url);
  return await res.json();
}

async function apiPost(body) {
  // Apps Script's CORS handling doesn't play well with a JSON preflight
  // request, so this sends as text/plain — Code.gs still parses the body
  // as JSON on its end (JSON.parse(e.postData.contents)), it just avoids
  // the browser trying an OPTIONS preflight that Apps Script won't answer.
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  return await res.json();
}

const API = {
  async verifyMember(code) {
    return await apiGet({ action: 'verifyMember', code });
  },
  async getCourses() {
    return await apiGet({ action: 'getCourses' });
  },
  async getCourse(courseId) {
    return await apiGet({ action: 'getCourse', courseId });
  },
  async getAssessment(courseId) {
    return await apiGet({ action: 'getAssessment', courseId });
  },
  async submitAssessment(payload) {
    return await apiPost({ action: 'submitAssessment', ...payload });
  },
  async issueCertificate(payload) {
    return await apiPost({ action: 'issueCertificate', ...payload });
  },
  async emailCertificate(payload) {
    return await apiPost({ action: 'emailCertificate', ...payload });
  }
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ---------- Local progress store ----------
   Course progress (which lessons are done, and whether the course
   is currently locked after a failed attempt) is saved to this
   browser only. See README for the cross-device tradeoff. */
const Progress = {
  key(memberCode, courseId) { return `ath-academy:${memberCode}:${courseId}`; },
  load(memberCode, courseId) {
    try {
      const raw = localStorage.getItem(this.key(memberCode, courseId));
      return raw ? JSON.parse(raw) : { completedLessons: [], locked: false };
    } catch (e) { return { completedLessons: [], locked: false }; }
  },
  save(memberCode, courseId, data) {
    try { localStorage.setItem(this.key(memberCode, courseId), JSON.stringify(data)); } catch (e) {}
  }
};

/* ---------- State ---------- */
let state = {
  member: null,
  currentCourse: null,
  lessonIndex: 0,
  completedLessons: new Set(),
  locked: false,
  quiz: { questions: [], index: 0, answers: [], selectedOption: null, timer: null, secondsLeft: ASSESSMENT_SECONDS }
};

/* ---------- Screen switching ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ---------- Login ---------- */
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('member-code').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const codeInput = document.getElementById('member-code');
  const err = document.getElementById('login-error');
  const idle = document.getElementById('login-idle');
  const rolling = document.getElementById('login-rolling');

  if (!codeInput.value.trim()) return;
  err.classList.remove('show');
  idle.classList.add('hidden');
  rolling.classList.add('active');

  const result = await API.verifyMember(codeInput.value);
  // Let the rolling animation play for a beat even on a fast response —
  // an instant flash reads as broken, not fast.
  await sleep(600);

  if (!result.ok) {
    rolling.classList.remove('active');
    idle.classList.remove('hidden');
    err.classList.add('show');
    return;
  }
  state.member = result.member;
  document.getElementById('member-chip').style.display = 'block';
  document.getElementById('member-chip').textContent = result.member.name + ' — ' + result.member.code;
  loadDashboard();
}

/* Try ATH/FCT/120726/0143 as the demo ID */

/* ---------- Dashboard (Udemy-style catalog) ---------- */
async function loadDashboard() {
  const courses = await API.getCourses();
  const grid = document.getElementById('course-grid');
  grid.innerHTML = '';
  courses.forEach(c => {
    const progress = Progress.load(state.member.code, c.id);
    const pct = Math.round((progress.completedLessons.length / c.lessonCount) * 100);
    let pillClass = '', pillText = 'Not started';
    if (progress.locked) { pillClass = 'locked'; pillText = 'Locked'; }
    else if (pct === 100) { pillClass = 'progress'; pillText = 'Ready for assessment'; }
    else if (pct > 0) { pillClass = 'progress'; pillText = `${pct}% done`; }

    const card = document.createElement('div');
    card.className = 'catalog-card';
    card.innerHTML = `
      <div class="catalog-thumb">${c.thumb ? `<img src="${c.thumb}" alt="${c.title}">` : `<span class="initials">${c.initials || c.tag.slice(0,2).toUpperCase()}</span>`}</div>
      <div class="catalog-body">
        <div class="tag">${c.tag}</div>
        <h3>${c.title}</h3>
        <p>${c.blurb}</p>
        <div class="catalog-meta">
          <span>${c.lessonCount} lessons</span>
          <span class="status-pill ${pillClass}">${pillText}</span>
        </div>
      </div>`;
    card.addEventListener('click', () => openOverview(c.id));
    grid.appendChild(card);
  });
  showScreen('screen-dashboard');
}
document.getElementById('cert-back-to-dash').addEventListener('click', loadDashboard);

/* ---------- Course overview (Udemy-style detail page) ---------- */
async function openOverview(courseId) {
  state.currentCourse = await API.getCourse(courseId);
  const course = state.currentCourse;
  const progress = Progress.load(state.member.code, course.id);
  const pct = Math.round((progress.completedLessons.length / course.lessons.length) * 100);

  document.getElementById('ov-tag').textContent = course.tag;
  document.getElementById('ov-title').textContent = course.title;
  document.getElementById('ov-blurb').textContent = course.blurb;
  document.getElementById('ov-learn').innerHTML = (course.learn || []).map(l => `<li>${l}</li>`).join('');
  document.getElementById('ov-curriculum').innerHTML = course.lessons.map((l, i) =>
    `<li><span><span class="lnum">${String(i+1).padStart(2,'0')}</span>${l.title}</span>${progress.completedLessons.includes(l.id) ? '✓' : ''}</li>`
  ).join('');

  const box = document.getElementById('ov-progress-box');
  const startBtn = document.getElementById('ov-start');
  if (progress.locked && pct < 100) {
    box.innerHTML = `Locked after your last attempt.<div class="rung--full" style="--pct:${pct}%;"></div>${pct}% through a fresh pass`;
    startBtn.textContent = 'Continue course';
  } else if (pct === 100) {
    box.innerHTML = `All lessons complete.<div class="rung--full" style="--pct:100%;"></div>Ready for the assessment`;
    startBtn.textContent = 'Go to assessment';
  } else if (pct > 0) {
    box.innerHTML = `In progress.<div class="rung--full" style="--pct:${pct}%;"></div>${pct}% complete`;
    startBtn.textContent = 'Continue course';
  } else {
    box.innerHTML = `Not started yet.<div class="rung--full" style="--pct:0%;"></div>`;
    startBtn.textContent = 'Start course';
  }
  startBtn.onclick = () => openCourse(course.id);

  showScreen('screen-overview');
}
document.getElementById('back-to-overview').addEventListener('click', () => openOverview(state.currentCourse.id));
document.getElementById('overview-back').addEventListener('click', loadDashboard);

/* ---------- Lesson / ladder ---------- */
async function openCourse(courseId) {
  state.currentCourse = await API.getCourse(courseId);
  const saved = Progress.load(state.member.code, courseId);
  state.completedLessons = new Set(saved.completedLessons);
  state.locked = saved.locked;
  // Resume at the first lesson not yet marked complete.
  const firstIncomplete = state.currentCourse.lessons.findIndex(l => !state.completedLessons.has(l.id));
  state.lessonIndex = firstIncomplete === -1 ? state.currentCourse.lessons.length - 1 : firstIncomplete;
  renderLesson();
  showScreen('screen-lesson');
}

function persistProgress() {
  Progress.save(state.member.code, state.currentCourse.id, {
    completedLessons: Array.from(state.completedLessons),
    locked: state.locked
  });
}

function renderLesson() {
  const course = state.currentCourse;
  const lesson = course.lessons[state.lessonIndex];
  document.getElementById('lesson-title').textContent = lesson.title;
  document.getElementById('lesson-count').textContent = `Lesson ${state.lessonIndex + 1} of ${course.lessons.length}`;
  document.getElementById('lesson-desc').textContent = lesson.desc;
  document.getElementById('video-frame').src = `https://www.youtube.com/embed/${lesson.youtubeId}`;
  document.getElementById('prev-lesson').disabled = state.lessonIndex === 0;

  const nextBtn = document.getElementById('next-lesson');
  const isLast = state.lessonIndex === course.lessons.length - 1;
  nextBtn.textContent = state.completedLessons.has(lesson.id)
    ? (isLast ? 'Completed ✓' : 'Next lesson →')
    : 'Mark complete & continue →';

  const rail = document.getElementById('rung-list');
  rail.innerHTML = '';
  course.lessons.forEach((l, i) => {
    const item = document.createElement('div');
    const done = state.completedLessons.has(l.id);
    const current = i === state.lessonIndex;
    item.className = 'rung-item' + (done ? ' done' : '') + (current ? ' current' : '');
    item.textContent = `${i + 1}. ${l.title}`;
    item.addEventListener('click', () => { state.lessonIndex = i; renderLesson(); });
    rail.appendChild(item);
  });

  const allDone = course.lessons.every(l => state.completedLessons.has(l.id));
  const assessBtn = document.getElementById('start-assessment');
  const note = document.querySelector('.assess-note');
  if (state.locked && allDone) {
    assessBtn.disabled = false;
    assessBtn.textContent = 'Take assessment (retry unlocked)';
    note.textContent = 'You have completed the course again. One attempt, 50 minutes, 90% weighted pass mark.';
  } else if (state.locked) {
    assessBtn.disabled = true;
    assessBtn.textContent = 'Locked — finish the course again';
    note.textContent = 'Your last attempt did not reach 90%. Go through every lesson again to unlock a new attempt.';
  } else {
    assessBtn.disabled = !allDone;
    assessBtn.textContent = 'Take assessment';
    note.textContent = 'Unlocks once every lesson is marked complete. 20 questions, 50-minute limit, one attempt. Pass mark: 90%.';
  }
}

document.getElementById('prev-lesson').addEventListener('click', () => {
  if (state.lessonIndex > 0) { state.lessonIndex--; renderLesson(); }
});
document.getElementById('next-lesson').addEventListener('click', () => {
  const course = state.currentCourse;
  const lesson = course.lessons[state.lessonIndex];
  state.completedLessons.add(lesson.id);
  persistProgress();
  if (state.lessonIndex < course.lessons.length - 1) {
    state.lessonIndex++;
  }
  renderLesson();
});
document.getElementById('start-assessment').addEventListener('click', startAssessment);

/* ---------- Assessment ---------- */
function warnBeforeUnload(e) {
  e.preventDefault();
  e.returnValue = '';
}

async function startAssessment() {
  const { assessmentId, questions } = await API.getAssessment(state.currentCourse.id);
  state.quiz = {
    assessmentId, questions, index: 0, answers: [], selectedOption: null,
    secondsLeft: ASSESSMENT_SECONDS, timer: null
  };
  document.getElementById('quiz-course-title').textContent = state.currentCourse.title;
  window.addEventListener('beforeunload', warnBeforeUnload);
  startTimer();
  renderQuestion();
  showScreen('screen-quiz');
}

function startTimer() {
  updateTimerLabel();
  state.quiz.timer = setInterval(() => {
    state.quiz.secondsLeft--;
    updateTimerLabel();
    if (state.quiz.secondsLeft <= 0) {
      clearInterval(state.quiz.timer);
      finishAssessment(true); // timed out
    }
  }, 1000);
}

function updateTimerLabel() {
  const s = Math.max(0, state.quiz.secondsLeft);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const label = document.getElementById('quiz-timer');
  if (label) {
    label.textContent = `${mm}:${ss}`;
    label.classList.toggle('quiz-timer--low', s <= 120);
  }
}

function renderQuestion() {
  const { questions, index } = state.quiz;
  const q = questions[index];
  state.quiz.selectedOption = null;

  document.getElementById('quiz-progress-label').textContent = `Question ${index + 1} / ${questions.length}`;
  document.getElementById('quiz-progress-bar').style.setProperty('--pct', `${((index) / questions.length) * 100}%`);
  document.getElementById('q-text').textContent = q.q;
  document.getElementById('quiz-weight-label').textContent = `Worth ${q.weight} point${q.weight > 1 ? 's' : ''}`;

  const optWrap = document.getElementById('q-options');
  optWrap.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D', 'E'];
  q.options.forEach((opt, i) => {
    const div = document.createElement('div');
    div.className = 'option';
    div.innerHTML = `<span class="letter">${letters[i]}</span><span>${opt.text}</span>`;
    div.addEventListener('click', () => {
      document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
      div.classList.add('selected');
      state.quiz.selectedOption = i;
      document.getElementById('submit-answer').disabled = false;
    });
    optWrap.appendChild(div);
  });
  document.getElementById('submit-answer').disabled = true;
  document.getElementById('submit-answer').textContent = index === questions.length - 1 ? 'Finish assessment' : 'Next question →';
}

document.getElementById('submit-answer').addEventListener('click', () => {
  const { selectedOption } = state.quiz;
  state.quiz.answers.push(selectedOption);

  if (state.quiz.index < state.quiz.questions.length - 1) {
    state.quiz.index++;
    renderQuestion();
  } else {
    finishAssessment(false);
  }
});

async function finishAssessment(timedOut) {
  clearInterval(state.quiz.timer);
  window.removeEventListener('beforeunload', warnBeforeUnload);

  // Any question left unanswered because of a timeout is submitted as -1,
  // which can never match a real option index, so it's scored as wrong.
  const { questions, answers, assessmentId } = state.quiz;
  while (answers.length < questions.length) {
    answers.push(-1);
  }

  document.getElementById('result-heading').textContent = 'Scoring your attempt…';
  showScreen('screen-result');
  document.getElementById('result-badge').textContent = '—';
  document.getElementById('result-badge').className = 'result-badge';
  document.getElementById('result-score').textContent = '';
  document.getElementById('result-actions').innerHTML = '';

  // Scoring happens server-side — Code.gs holds the answer key from when
  // the assessment was generated and this is the only place the pass/fail
  // is actually decided, so it can't be spoofed from the browser.
  const result = await API.submitAssessment({
    assessmentId,
    answers,
    memberCode: state.member.code,
    memberName: state.member.name,
    memberEmail: state.member.email || '',
    courseId: state.currentCourse.id,
    courseTitle: state.currentCourse.title
  });

  if (result.error) {
    document.getElementById('result-heading').textContent = "Something went wrong scoring that attempt.";
    document.getElementById('result-score').textContent = result.error;
    return;
  }

  const { passed, score: pct } = result;

  document.getElementById('result-badge').textContent = passed ? 'Passed' : 'Not this time';
  document.getElementById('result-badge').className = 'result-badge ' + (passed ? 'pass' : 'fail');
  document.getElementById('result-heading').textContent = passed
    ? 'You cleared the bar. Generating your certificate…'
    : (timedOut ? 'Time ran out before you finished.' : "You gave it a real shot — that's what counts.");
  document.getElementById('result-score').textContent = `Weighted score: ${pct}% (pass mark ${PASS_MARK}%)`;

  const actions = document.getElementById('result-actions');
  actions.innerHTML = '';
  if (passed) {
    // Certificates are automatic — no button to click, per spec.
    generateCertificate(pct);
  } else {
    state.locked = true;
    state.completedLessons.clear();
    persistProgress();
    const p = document.createElement('p');
    p.style.cssText = 'color:var(--muted); margin-bottom:24px; max-width:520px;';
    p.textContent = "There are no retakes on this attempt, but the door isn't closed. Go through the course again from the start, and a fresh attempt unlocks once every lesson is complete.";
    actions.parentNode.insertBefore(p, actions);
    const back = document.createElement('button');
    back.textContent = 'Restart the course';
    back.addEventListener('click', () => { state.lessonIndex = 0; renderLesson(); showScreen('screen-lesson'); });
    actions.appendChild(back);
  }
  showScreen('screen-result');
}

/* ---------- Certificate ---------- */
const LOGO_ATH = new Image();
LOGO_ATH.src = 'assets/ath-badge.png';
const LOGO_TRACTION = new Image();
LOGO_TRACTION.src = 'assets/traction-outsourcing-logo.png';

function waitForImages() {
  const ready = img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; });
  return Promise.all([ready(LOGO_ATH), ready(LOGO_TRACTION)]);
}

async function generateCertificate(pct) {
  await waitForImages();
  const certId = await drawAndIssueCertificate(pct);
  buildShareLinks(state.currentCourse.title, certId);
  document.getElementById('cert-sub').innerHTML =
    `Certificate ID <strong>${certId}</strong> — anyone can check it at ` +
    `<a href="verify.html?id=${certId}" style="color:var(--orange)" target="_blank">tolnigeria.com/ath-academy/verify</a>. ` +
    (state.member.email ? `A copy has also been emailed to you.` : ``);
  showScreen('screen-cert');
}

async function drawAndIssueCertificate(pct) {
  const { certId } = await API.issueCertificate({
    memberCode: state.member.code,
    memberName: state.member.name,
    memberEmail: state.member.email || '',
    courseId: state.currentCourse.id,
    courseTitle: state.currentCourse.title,
    score: pct,
    date: new Date().toISOString()
  });

  drawCertificate(state.member.name, state.member.code, state.currentCourse.title, certId);

  if (state.member.email) {
    const canvas = document.getElementById('cert-canvas');
    API.emailCertificate({
      certId,
      memberEmail: state.member.email,
      memberName: state.member.name,
      courseTitle: state.currentCourse.title,
      imageBase64: canvas.toDataURL('image/png')
    });
  }

  return certId;
}

function drawCertificate(name, memberCode, courseTitle, certId) {
  const canvas = document.getElementById('cert-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = '#14110F';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#E35F26';
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(48, 48, W - 96, H - 96);

  // Logo row — ATH Recruiters badge on the left, Traction Outsourcing
  // wordmark on the right. Traction's logo has a black icon dot and dark
  // "Outsourcing" text that read poorly on the near-black background, so it
  // sits on a small white plate; the ATH badge is already transparent and
  // reads fine directly on black.
  const athH = 64;
  const athW = LOGO_ATH.naturalWidth ? (LOGO_ATH.naturalWidth / LOGO_ATH.naturalHeight) * athH : athH;
  if (LOGO_ATH.complete && LOGO_ATH.naturalWidth) ctx.drawImage(LOGO_ATH, 80, 62, athW, athH);

  const tracH = 40;
  const tracW = LOGO_TRACTION.naturalWidth ? (LOGO_TRACTION.naturalWidth / LOGO_TRACTION.naturalHeight) * tracH : tracH * 4;
  const plateX = W - 80 - tracW - 20, plateY = 68, plateW = tracW + 40, plateH = tracH + 24;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, plateX, plateY, plateW, plateH, 4);
  ctx.fill();
  if (LOGO_TRACTION.complete && LOGO_TRACTION.naturalWidth) {
    ctx.drawImage(LOGO_TRACTION, plateX + 20, plateY + 12, tracW, tracH);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#8A8377';
  ctx.font = '400 16px Archivo, sans-serif';
  ctx.fillText('CERTIFICATE OF COMPLETION', W / 2, 195);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 52px Archivo, sans-serif';
  ctx.fillText(name, W / 2, 340);

  ctx.fillStyle = '#8A8377';
  ctx.font = '400 15px "IBM Plex Mono", monospace';
  ctx.fillText(memberCode, W / 2, 375);

  ctx.fillStyle = '#8A8377';
  ctx.font = '400 18px Archivo, sans-serif';
  ctx.fillText('has completed', W / 2, 420);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 30px Archivo, sans-serif';
  wrapText(ctx, courseTitle, W / 2, 470, W - 240, 38);

  ctx.fillStyle = '#8A8377';
  ctx.font = '400 15px "IBM Plex Mono", monospace';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(dateStr, W / 2, H - 140);
  ctx.font = '700 16px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#E35F26';
  ctx.fillText('Certificate No. ' + certId, W / 2, H - 108);
  ctx.font = '400 14px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#8A8377';
  ctx.fillText('Verify at tolnigeria.com/ath-academy/verify', W / 2, H - 82);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', lines = [];
  words.forEach(w => {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line); line = w + ' ';
    } else { line = test; }
  });
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l.trim(), x, startY + i * lineHeight));
}

document.getElementById('cert-download').addEventListener('click', () => {
  const canvas = document.getElementById('cert-canvas');
  const link = document.createElement('a');
  link.download = 'ath-academy-certificate.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

function buildShareLinks(courseTitle, certId) {
  const shareText = encodeURIComponent(`I just earned my ${courseTitle} certificate from ATH Academy. Certificate No. ${certId} — verify at tolnigeria.com/ath-academy/verify`);
  const shareUrl = encodeURIComponent(`https://tolnigeria.com/ath-academy/verify.html?id=${certId}`);
  const row = document.getElementById('share-row');
  row.innerHTML = `
    <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank">Share on WhatsApp</a>
    <a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank">Share on LinkedIn</a>
    <a href="#" id="copy-caption">Copy caption for TikTok / Instagram</a>
  `;
  document.getElementById('copy-caption').addEventListener('click', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(decodeURIComponent(shareText));
    e.target.textContent = 'Copied — paste it into your post';
  });
}
