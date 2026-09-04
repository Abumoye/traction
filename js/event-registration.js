/* =========================================================
   Traction Outsourcing Limited — T-ICR 2026 Registration Handler
   Used on /events/register/ only.

   Submits to a DEDICATED Google Apps Script Web App (formType:
   "event-registration"), separate from the lead-form script, which
   appends the entry to a Google Sheet — no email or invoice is sent
   from Apps Script. Shares the same Web App URL as event-affiliate.js
   (one script, one deployment, two forms — routed by formType).

   After a successful submission, the visitor's own browser is sent to
   WhatsApp with a pre-filled message -- this is purely client-side
   (a wa.me link), not something Apps Script sends on the team's behalf.

   SETUP REQUIRED: see /docs/tcr-events-backend-setup.md for the full
   step-by-step (new Sheet, new Apps Script project, deployment) and
   paste the resulting Web App URL below.
   ========================================================= */

const EVENT_REGISTRATION_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMQo0BeqiJpbPuEvt_76xIbZXDu-A5HK7Q193iuu4Ii9GCIP0MdKzzmCmubQ0SSAGC/exec";
const EVENT_REGISTRATION_WHATSAPP_NUMBER = "2347047082697";
const EVENT_REGISTRATION_WHATSAPP_MESSAGE = "Hello, I am interested in TICR 2026";

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
            statusEl.textContent = "Thank you. Your registration has been received — redirecting you to WhatsApp now.";
            statusEl.style.color = "#1e7e34";
            form.reset();
            submitBtn.innerText = defaultBtnText;
            submitBtn.disabled = false;

            // Give the visitor a moment to see the confirmation message
            // before sending them on to WhatsApp.
            var whatsappUrl = "https://wa.me/" + EVENT_REGISTRATION_WHATSAPP_NUMBER +
                "?text=" + encodeURIComponent(EVENT_REGISTRATION_WHATSAPP_MESSAGE);
            window.setTimeout(function () {
                window.location.href = whatsappUrl;
            }, 1200);
        })
        .catch(function () {
            statusEl.textContent = "Something went wrong. Please try again or reach us on WhatsApp.";
            statusEl.style.color = "#c0392b";
            submitBtn.innerText = defaultBtnText;
            submitBtn.disabled = false;
        });
    });
});
