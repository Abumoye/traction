/* =========================================================
   Traction Outsourcing Limited — Lead Form Handler
   Used on every /services/*/ page.
   Submits to a Google Apps Script Web App tied to a Google Sheet.

   SETUP REQUIRED: Replace SCRIPT_URL below with your deployed
   Google Apps Script Web App URL. See /docs/lead-form-setup.md
   for the full deployment guide and the Apps Script code to paste.
   ========================================================= */

const LEAD_FORM_SCRIPT_URL = "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('leadForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('leadFormStatus');
    const defaultBtnText = submitBtn.innerText;

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (LEAD_FORM_SCRIPT_URL === "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL") {
            statusEl.textContent = "This form is not fully set up yet. Please reach us on WhatsApp instead.";
            statusEl.style.color = "#c0392b";
            return;
        }

        const data = {
            sourcePage: window.location.pathname,
            name: form.leadName.value.trim(),
            phone: form.leadPhone.value.trim(),
            companyName: form.leadCompany.value.trim(),
            email: form.leadEmail.value.trim()
        };

        if (!data.name || !data.phone || !data.companyName || !data.email) {
            statusEl.textContent = "Please fill in every field before submitting.";
            statusEl.style.color = "#c0392b";
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Submitting...";
        statusEl.textContent = "";

        fetch(LEAD_FORM_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
        })
        .then(function () {
            statusEl.textContent = "Thank you. Someone from our team will reach out shortly.";
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
