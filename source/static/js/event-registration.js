/* =========================================================
   Traction Outsourcing Limited — T-ICR 2026 Registration Handler
   Used on /events/register/ only.

   Submits to a DEDICATED Google Apps Script Web App (formType:
   "event-registration"), separate from the lead-form script, which
   appends the entry to a Google Sheet and sends a WhatsApp notification
   to the team — no email or invoice is sent. Shares the same Web App
   URL as event-affiliate.js (one script, one deployment, two forms —
   routed by formType).

   SETUP REQUIRED: see /docs/tcr-events-backend-setup.md for the full
   step-by-step (new Sheet, new Apps Script project, deployment) and
   paste the resulting Web App URL below.
   ========================================================= */

const EVENT_REGISTRATION_SCRIPT_URL = "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('eventRegisterForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('eventRegisterFormStatus');
    const defaultBtnText = submitBtn.innerText;

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (EVENT_REGISTRATION_SCRIPT_URL === "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL") {
            statusEl.textContent = "This form is not fully set up yet. Please reach us on WhatsApp instead.";
            statusEl.style.color = "#c0392b";
            return;
        }

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
            statusEl.textContent = "Thank you. Your registration has been received — our team will reach out to you shortly with payment details.";
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
