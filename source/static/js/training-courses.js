/* =========================================================
   Traction Outsourcing Limited — Employee Training page
   Used on /services/employee-training/ only. Load /js/form-guard.js first.

   - Click a course card (or "What you will get") to open its detail pop-up.
   - "Register" opens the lead form with the course already filled in.
   - "Request A Specialized Training" opens the same form with an extra
     "What training do you need?" box.

   Submits to the SAME Google Apps Script Web App as the lead form on the
   ATH Recruiters page (see /js/lead-form.js). The payload carries
   formType "employee-training"; the script files it on its own
   "Employee Training" tab. The course name is also appended to sourcePage so
   it is never lost, even on the older script that only knows the lead form.
   See /docs/employee-training-form-setup.md.
   ========================================================= */
(function () {
    var LEAD_FORM_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyeu2T0WE1M-4d2erYY9IUazEKTsWPmuG9cnIYK61PQkdfY8OqvvOTubLFcFJRfdL5iVw/exec";
    var SPECIALIZED = "Specialized training request";

    function $(id) { return document.getElementById(id); }
    var courseModal = $('courseModal');
    var formModal = $('trainingFormModal');
    var successModal = $('trainingSuccessModal');
    var form = $('trainingForm');
    if (!courseModal || !formModal || !form) return;

    var statusEl = $('trainingFormStatus');
    var submitBtn = $('trainingSubmit');
    var messageBox = $('trainingMessage');
    var defaultBtnText = submitBtn.innerText;
    var current = null;      // { title, track } for the course form, or null when specialized
    var mode = 'course';     // 'course' | 'specialized'

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function close(dlg) { if (dlg && dlg.open) dlg.close(); }

    // Close buttons, and a click on the dark backdrop.
    document.querySelectorAll('dialog [data-close-dialog]').forEach(function (b) {
        b.addEventListener('click', function () { close(b.closest('dialog')); });
    });
    [courseModal, formModal, successModal].forEach(function (dlg) {
        dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    });

    function courseFromCard(card) {
        var sec = card.closest('.training-sec');
        return {
            id: card.getAttribute('data-course-id'),
            title: card.getAttribute('data-title'),
            duration: card.getAttribute('data-duration'),
            mode: card.getAttribute('data-mode'),
            gets: Array.prototype.map.call(card.querySelectorAll('.course-gets li'), function (li) { return li.textContent; }),
            track: sec ? sec.getAttribute('data-track') : '',
            banner: sec ? sec.getAttribute('data-banner') : '',
            bannerAlt: sec ? sec.getAttribute('data-banner-alt') : '',
            icon: sec ? sec.getAttribute('data-icon') : 'fa-graduation-cap'
        };
    }

    function openCourse(c) {
        $('courseModalTrack').textContent = c.track;
        $('courseModalTitle').textContent = c.title;
        $('courseModalMeta').innerHTML =
            '<span class="course-chip"><i class="fa-regular fa-clock" aria-hidden="true"></i> ' + esc(c.duration) + '</span>' +
            (c.mode ? '<span class="course-chip"><i class="fas fa-location-dot" aria-hidden="true"></i> ' + esc(c.mode) + '</span>' : '');
        $('courseModalGets').innerHTML = c.gets.map(function (g) {
            return '<li><i class="fas fa-circle-check" aria-hidden="true"></i><span>' + esc(g) + '</span></li>';
        }).join('');
        $('courseModalBanner').innerHTML = c.banner
            ? '<img src="' + esc(c.banner) + '" alt="' + esc(c.bannerAlt) + '" width="2400" height="600">'
            : '<div class="training-banner-fallback" aria-hidden="true"><i class="fas ' + esc(c.icon) + '"></i></div>';
        $('courseModalRegister').onclick = function () { courseModal.close(); openForm(c); };
        courseModal.showModal();
        courseModal.scrollTop = 0;
    }

    function openForm(c) {
        statusEl.textContent = '';
        submitBtn.disabled = false;
        submitBtn.innerText = defaultBtnText;
        if (c) {
            mode = 'course';
            current = { title: c.title, track: c.track };
            $('trainingFormTitle').textContent = 'Register for this course';
            $('trainingFormSub').innerHTML = '<strong>' + esc(c.title) + '</strong><br>' + esc(c.duration) + (c.mode ? ' · ' + esc(c.mode) : '') + '. Leave your details and our team will reach out with dates and fees.';
            messageBox.hidden = true;
            messageBox.required = false;
        } else {
            mode = 'specialized';
            current = null;
            $('trainingFormTitle').textContent = 'Request A Specialized Training';
            $('trainingFormSub').textContent = "Tell us what your team needs and we'll design a training around it. Leave your details and our team will reach out.";
            messageBox.hidden = false;
            messageBox.required = true;
        }
        formModal.showModal();
    }

    // Card clicks: Register button, "What you will get", or the title.
    document.addEventListener('click', function (e) {
        var reg = e.target.closest('[data-course-register]');
        if (reg) { openForm(courseFromCard(reg.closest('.course-card'))); return; }
        var open = e.target.closest('[data-course-open]');
        if (open) { openCourse(courseFromCard(open.closest('.course-card'))); return; }
        var spec = e.target.closest('[data-open-training-form]');
        if (spec) { openForm(null); }
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Spam guard: hidden trap field + speed check (see /js/form-guard.js).
        if (window.formGuard && window.formGuard.blocked(form, statusEl)) return;

        var course = mode === 'course' && current ? current.title : SPECIALIZED;
        var data = {
            formType: 'employee-training',
            pagePath: window.location.pathname,
            // Course is also kept in sourcePage so it still shows on the older lead script.
            sourcePage: window.location.pathname + ' | ' + course,
            course: course,
            track: current ? current.track : '',
            name: form.name.value.trim(),
            phone: form.phone.value.trim(),
            companyName: form.companyName.value.trim(),
            email: form.email.value.trim(),
            message: mode === 'specialized' ? messageBox.value.trim() : ''
        };
        if (window.formGuard) Object.assign(data, window.formGuard.fields(form));

        if (!(data.name && data.phone && data.companyName && data.email) || (mode === 'specialized' && !data.message)) {
            statusEl.textContent = 'Please fill in every field before submitting.';
            statusEl.style.color = '#c0392b';
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
            statusEl.textContent = 'Please enter a valid email address.';
            statusEl.style.color = '#c0392b';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Submitting...';
        statusEl.textContent = '';

        fetch(LEAD_FORM_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
        })
        .then(function () {
            form.reset();
            formModal.close();
            $('trainingSuccessText').textContent = mode === 'course'
                ? 'Thank you. Your registration for "' + course + '" is in. Someone from our team will reach out shortly.'
                : 'Thank you. We have your request. Someone from our team will reach out shortly.';
            successModal.showModal();
        })
        .catch(function () {
            statusEl.textContent = 'Something went wrong. Please try again or reach us on WhatsApp.';
            statusEl.style.color = '#c0392b';
            submitBtn.disabled = false;
            submitBtn.innerText = defaultBtnText;
        });
    });
})();
