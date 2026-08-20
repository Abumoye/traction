/* =========================================================
   Traction Outsourcing Limited — T-ICR 2026 Affiliate Sign-Up Handler
   Used on /events/affiliate/ only.

   Submits to the SAME Google Apps Script Web App used by js/lead-form.js
   (formType: "event-affiliate"), which appends the entry to a separate
   Google Sheet tab, auto-assigns a sequential affiliate code
   (aff/tol/NNN/YY), and emails it to the affiliate.

   SETUP REQUIRED: the deployed Apps Script needs to be updated with the
   new formType handler before this works — see the "T-ICR 2026
   Affiliate Sign-Up Form" section in /docs/lead-form-setup.md.
   ========================================================= */

const EVENT_AFFILIATE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyeu2T0WE1M-4d2erYY9IUazEKTsWPmuG9cnIYK61PQkdfY8OqvvOTubLFcFJRfdL5iVw/exec";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('affiliateForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('affiliateFormStatus');
    const defaultBtnText = submitBtn.innerText;

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const data = {
            formType: "event-affiliate",
            sourcePage: window.location.pathname,
            name: form.name.value.trim(),
            gender: form.gender.value.trim(),
            age: form.age.value.trim(),
            email: form.email.value.trim(),
            phone: form.phone.value.trim(),
            state: form.state.value.trim(),
            consent: form.consent.checked
        };

        const requiredValid = data.name && data.gender && data.age && data.email
            && data.phone && data.state && data.consent;

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
