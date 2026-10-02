/* =========================================================
   Traction Outsourcing Limited — Storekeeping Assistant (Kuje) Application Form
   Used on /apply/storekeeping-assistant-kuje/ only.
   Needs /js/apply-fields.js loaded first (digits-only phone + PDF check).

   Submits to the SAME Google Apps Script Web App as the other job
   application form, but with formType "apply-storekeeper" so the script
   files the entry on its own tab ("Storekeeper Kuje") in the same
   Google Sheet and saves the uploaded CV (PDF only) to Google Drive.

   See /docs/apply-form-backend-setup.md for the Apps Script code (it must
   include the "apply-storekeeper" handler) and how to redeploy.
   ========================================================= */

const STOREKEEPER_FORM_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx0ZVyCU3EUcVB4BSzBbV1UIZy0a0ThpmoTk0Up0CeffTmE6QmhWNQR8gLxrojcqpKL/exec";
const STOREKEEPER_ROLE_TITLE = "Storekeeping Assistant (Kuje)";
const STOREKEEPER_MAX_CV_BYTES = 5 * 1024 * 1024; // 5MB
const STOREKEEPER_PHONE_DIGITS = 11;

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

    // Reject anything that isn't a real PDF (or is too big) the moment it is chosen.
    function checkCvFile(file) {
        if (!file) return Promise.resolve("");
        if (file.size > STOREKEEPER_MAX_CV_BYTES) {
            return Promise.resolve("Your CV is too large. Please upload a PDF under 5MB.");
        }
        return window.applyFields.isPdf(file).then(function (ok) {
            return ok ? "" : "Only PDF files are accepted. Please upload your CV as a PDF (not a picture or Word document).";
        });
    }

    form.cv.addEventListener('change', function () {
        statusEl.textContent = "";
        const file = form.cv.files[0];
        if (!file) return;
        checkCvFile(file).then(function (problem) {
            if (problem) {
                form.cv.value = "";
                setStatus(problem, true);
            }
        });
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const cvFile = form.cv.files[0];

        const data = {
            formType: "apply-storekeeper",
            role: STOREKEEPER_ROLE_TITLE,
            sourcePage: window.location.pathname,
            firstName: form.firstName.value.trim(),
            lastName: form.lastName.value.trim(),
            phone: form.phone.value.trim(),
            email: form.email.value.trim(),
            gender: form.gender.value.trim(),
            location: form.location.value.trim(),
            dob: form.dob.value.trim(), // YYYY-MM-DD
            resumeImmediately: form.resumeImmediately.value.trim()
        };

        if (!(data.firstName && data.lastName && data.phone && data.email && data.gender
              && data.location && data.dob && data.resumeImmediately && cvFile)) {
            setStatus("Please fill in every field and attach your CV before submitting.", true);
            return;
        }

        if (!new RegExp('^[0-9]{' + STOREKEEPER_PHONE_DIGITS + '}$').test(data.phone)) {
            setStatus("Phone number must be exactly 11 digits, numbers only (e.g. 08052033145).", true);
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
            setStatus("Please enter a valid email address.", true);
            return;
        }

        if (data.dob > form.dob.max || data.dob < form.dob.min) {
            setStatus("Please enter a valid date of birth.", true);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Checking...";
        statusEl.textContent = "";

        checkCvFile(cvFile).then(function (problem) {
            if (problem) {
                form.cv.value = "";
                setStatus(problem, true);
                resetButton();
                return;
            }

            submitBtn.innerText = "Uploading...";
            const reader = new FileReader();

            reader.onload = function () {
                // result looks like "data:application/pdf;base64,JVBERi0xLj..."
                data.cvFileName = cvFile.name;
                data.cvMimeType = "application/pdf";
                data.cvBase64 = reader.result.split(',')[1];

                submitBtn.innerText = "Submitting...";

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
            };

            reader.onerror = function () {
                setStatus("We couldn't read your CV file. Please try again.", true);
                resetButton();
            };

            reader.readAsDataURL(cvFile);
        });
    });
});
