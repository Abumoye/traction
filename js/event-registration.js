/* =========================================================
   Traction Outsourcing Limited — T-ICR 2026 Registration Handler
   Used on /events/register/ only.

   Submits to the SAME Google Apps Script Web App used by js/lead-form.js
   (formType: "event-registration"), which appends the entry to a Google
   Sheet, works out Early Bird vs Standard pricing, generates a PDF
   invoice, and emails it from t-icr@tolnigeria.com.

   SETUP REQUIRED: the deployed Apps Script needs to be updated with the
   new formType handler before this works — see the "T-ICR 2026
   Registration Form" section in /docs/lead-form-setup.md.
   ========================================================= */

const EVENT_REGISTRATION_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyeu2T0WE1M-4d2erYY9IUazEKTsWPmuG9cnIYK61PQkdfY8OqvvOTubLFcFJRfdL5iVw/exec";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('eventRegisterForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('eventRegisterFormStatus');
    const defaultBtnText = submitBtn.innerText;

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const data = {
            formType: "event-registration",
            sourcePage: window.location.pathname,
            name: form.fullName.value.trim(),
            phone: form.phone.value.trim(),
            email: form.email.value.trim(),
            referral: form.referral.value.trim()
        };

        if (!data.name || !data.phone || !data.email) {
            statusEl.textContent = "Please fill in your name, phone number, and email before submitting.";
            statusEl.style.color = "#c0392b";
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Processing...";
        statusEl.textContent = "";

        fetch(EVENT_REGISTRATION_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
        })
        .then(function () {
            statusEl.textContent = "Thank you. Please check " + data.email + " (including spam/junk) for an invoice from t-icr@tolnigeria.com with your payment amount and account details. Reply to that email with your receipt once paid.";
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
