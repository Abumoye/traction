/* =========================================================
   Traction Outsourcing Limited — Storekeeping Assistant (Kuje) Application Form
   Used on /apply/storekeeping-assistant-kuje/ only.

   Submits to the SAME Google Apps Script Web App as the other job
   application form, but with formType "apply-storekeeper" so the script
   files the entry on its own tab ("Storekeeper Kuje") in the same
   Google Sheet. No CV upload on this form.

   See /docs/apply-form-backend-setup.md for the Apps Script code (it must
   include the "apply-storekeeper" handler) and how to redeploy.
   ========================================================= */

const STOREKEEPER_FORM_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx0ZVyCU3EUcVB4BSzBbV1UIZy0a0ThpmoTk0Up0CeffTmE6QmhWNQR8gLxrojcqpKL/exec";
const STOREKEEPER_ROLE_TITLE = "Storekeeping Assistant (Kuje)";

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('applyForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('applyFormStatus');
    const successModal = document.getElementById('applyFormSuccessModal');
    const defaultBtnText = submitBtn.innerText;

    // Date of birth can't be in the future.
    const today = new Date();
    const pad = function (n) { return String(n).padStart(2, '0'); };
    form.dob.max = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    form.dob.min = '1940-01-01';

    if (successModal) {
        successModal.addEventListener('click', function (e) {
            if (e.target === successModal) successModal.close();
        });
        successModal.querySelectorAll('[data-close-success-modal]').forEach(function (btn) {
            btn.addEventListener('click', function () { successModal.close(); });
        });
    }

    function setStatus(message, isError) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? "#c0392b" : "#1e7e34";
    }

    function resetButton() {
        submitBtn.disabled = false;
        submitBtn.innerText = defaultBtnText;
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const data = {
            formType: "apply-storekeeper",
            role: STOREKEEPER_ROLE_TITLE,
            sourcePage: window.location.pathname,
            firstName: form.firstName.value.trim(),
            lastName: form.lastName.value.trim(),
            gender: form.gender.value.trim(),
            location: form.location.value.trim(),
            dob: form.dob.value.trim(), // YYYY-MM-DD
            resumeImmediately: form.resumeImmediately.value.trim()
        };

        if (!(data.firstName && data.lastName && data.gender && data.location && data.dob && data.resumeImmediately)) {
            setStatus("Please fill in every field before submitting.", true);
            return;
        }

        if (data.dob > form.dob.max || data.dob < form.dob.min) {
            setStatus("Please enter a valid date of birth.", true);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Submitting...";
        statusEl.textContent = "";

        fetch(STOREKEEPER_FORM_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
        })
        .then(function () {
            statusEl.textContent = "";
            form.reset();
            resetButton();
            if (successModal) {
                successModal.showModal();
            } else {
                setStatus("Thank you for your application. We will reach out to qualified candidates.", false);
            }
        })
        .catch(function () {
            setStatus("Something went wrong. Please try again or reach us on WhatsApp.", true);
            resetButton();
        });
    });
});
