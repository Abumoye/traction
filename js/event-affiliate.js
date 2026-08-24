/* =========================================================
   Traction Outsourcing Limited — T-ICR 2026 Affiliate Sign-Up Handler
   Used on /events/affiliate/ only.

   Submits to a DEDICATED Google Apps Script Web App (formType:
   "event-affiliate"), separate from the lead-form / registration script,
   which appends the entry to a Google Sheet tab, auto-assigns a
   sequential affiliate code (aff/tol/NNN/YY), and emails it to the
   affiliate. This shares the SAME Web App URL as event-registration.js
   (one script, one deployment, two forms — routed by formType).

   SETUP REQUIRED: see /docs/tcr-events-backend-setup.md for the full
   step-by-step (new Sheet, new Apps Script project, deployment) and
   paste the resulting Web App URL below.
   ========================================================= */

const EVENT_AFFILIATE_SCRIPT_URL = "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('affiliateForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('affiliateFormStatus');
    const defaultBtnText = submitBtn.innerText;

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (EVENT_AFFILIATE_SCRIPT_URL === "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL") {
            statusEl.textContent = "This form is not fully set up yet. Please reach us on WhatsApp instead.";
            statusEl.style.color = "#c0392b";
            return;
        }

        const data = {
            formType: "event-affiliate",
            sourcePage: window.location.pathname,
            name: form.name.value.trim(),
            gender: form.gender.value.trim(),
            age: form.age.value.trim(),
            email: form.email.value.trim(),
            phone: form.phone.value.trim(),
            bankName: form.bankName.value.trim(),
            accountNumber: form.accountNumber.value.trim(),
            accountName: form.accountName.value.trim(),
            consent: form.consent.checked
        };

        const requiredValid = data.name && data.gender && data.age && data.email
            && data.phone && data.bankName && data.accountNumber && data.accountName && data.consent;

        if (!requiredValid) {
            statusEl.textContent = "Please fill in every field and accept the disclaimer before submitting.";
            statusEl.style.color = "#c0392b";
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Submitting...";
        statusEl.textContent = "";

        fetch(EVENT_AFFILIATE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
        })
        .then(function () {
            statusEl.textContent = "Thank you. Please check " + data.email + " (including spam/junk) for your unique affiliate code.";
            statusEl.style.color = "#1e7e34";
            form.reset();
            submitBtn.innerText = defaultBtnText;
            submitBtn.disabled = false;
        })
        .catch(function () {
            statusEl.textContent = "Something went wrong. Please try again or reach us on WhatsApp.";
            statusEl.style.color = "#c0392b";
            submitBtn.innerText = defaultBtnText;
            submitBtn.disabled = false;
        });
    });
});
