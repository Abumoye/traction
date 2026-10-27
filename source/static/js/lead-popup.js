/* =========================================================
   Traction Outsourcing Limited — "Request A Free Consultation" pop-up form
   Used on the service pages whose JSON has a "lead_popup" block
   (Corporate Restructuring, Business Advisory, Startup Structuring,
   Bank Outsourcing). Any button marked data-open-lead-popup opens it.

   Submits to the SAME Google Apps Script Web App and with the SAME fields
   as the lead form (see /js/lead-form.js), so every enquiry lands on the
   Leads tab of "Traction Outsourcing Leads" and sends the usual email.
   sourcePage is the page the visitor was on, plus " | <subject>" when the
   button names a property, plot or plan (data-popup-subject). Load /js/form-guard.js first.
   ========================================================= */
(function () {
    var LEAD_FORM_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyeu2T0WE1M-4d2erYY9IUazEKTsWPmuG9cnIYK61PQkdfY8OqvvOTubLFcFJRfdL5iVw/exec";

    function $(id) { return document.getElementById(id); }
    var modal = $('leadPopupModal');
    var success = $('leadPopupSuccess');
    var form = $('leadPopupForm');
    if (!modal || !form) return;

    var statusEl = $('leadPopupStatus');
    var submitBtn = $('leadPopupSubmit');
    var defaultBtnText = submitBtn.innerText;
    var subjectEl = $('leadPopupSubject');
    var subject = '';   // what the visitor is enquiring about (a property, plot or plan), if the button says

    function close(dlg) { if (dlg && dlg.open) dlg.close(); }

    document.querySelectorAll('dialog [data-close-dialog]').forEach(function (b) {
        b.addEventListener('click', function () { close(b.closest('dialog')); });
    });
    [modal, success].forEach(function (dlg) {
        if (dlg) dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    });

    document.addEventListener('click', function (e) {
        var opener = e.target.closest('[data-open-lead-popup]');
        if (!opener) return;
        e.preventDefault();
        subject = (opener.getAttribute('data-popup-subject') || '').trim();
        if (subjectEl) {
            subjectEl.hidden = !subject;
            subjectEl.textContent = '';
            if (subject) {
                var b = document.createElement('strong');
                b.textContent = subject;
                subjectEl.appendChild(document.createTextNode('Enquiring about: '));
                subjectEl.appendChild(b);
            }
        }
        statusEl.textContent = '';
        submitBtn.disabled = false;
        submitBtn.innerText = defaultBtnText;
        modal.showModal();
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Spam guard: hidden trap field + speed check (see /js/form-guard.js).
        if (window.formGuard && window.formGuard.blocked(form, statusEl)) return;

        var data = {
            // The property, plot or plan is added to sourcePage so it shows in the Leads sheet and email.
            sourcePage: window.location.pathname + (subject ? ' | ' + subject : ''),
            name: form.name.value.trim(),
            phone: form.phone.value.trim(),
            companyName: form.companyName.value.trim(),
            email: form.email.value.trim()
        };
        if (window.formGuard) Object.assign(data, window.formGuard.fields(form));

        if (!(data.name && data.phone && data.companyName && data.email)) {
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
            modal.close();
            success.showModal();
        })
        .catch(function () {
            statusEl.textContent = 'Something went wrong. Please try again in a moment.';
            statusEl.style.color = '#c0392b';
            submitBtn.disabled = false;
            submitBtn.innerText = defaultBtnText;
        });
    });
})();
