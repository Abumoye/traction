/* =========================================================
   Traction Outsourcing Limited — Business Strategy Officer Application Form
   Used on /apply/business-strategy-officer/ only.
   Needs /js/apply-fields.js loaded first (digits-only phone + PDF check).

   Submits to the SAME Google Apps Script Web App as the other job
   application form, but with formType "apply-strategy-officer" so the script
   files the entry on its own tab ("Business Strategy Officer") in the same
   Google Sheet and saves the uploaded CV (PDF only) to Google Drive.

   See /docs/apply-form-backend-setup.md for the Apps Script code (it must
   include the "apply-strategy-officer" handler) and how to redeploy.
   ========================================================= */

const STRATEGY_FORM_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx0ZVyCU3EUcVB4BSzBbV1UIZy0a0ThpmoTk0Up0CeffTmE6QmhWNQR8gLxrojcqpKL/exec";
const STRATEGY_ROLE_TITLE = "Business Strategy Officer";
const STRATEGY_MAX_CV_BYTES = 5 * 1024 * 1024; // 5MB
const STRATEGY_PHONE_DIGITS = 11;
const STRATEGY_MAX_ESSAY_WORDS = 150;

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('applyForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('applyFormStatus');
    const successModal = document.getElementById('applyFormSuccessModal');
    const defaultBtnText = submitBtn.innerText;

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
        if (file.size > STRATEGY_MAX_CV_BYTES) {
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
            formType: "apply-strategy-officer",
            role: STRATEGY_ROLE_TITLE,
            sourcePage: window.location.pathname,
            fullName: form.fullName.value.trim(),
            email: form.email.value.trim(),
            phone: form.phone.value.trim(),
            location: form.location.value.trim(),
            yearsExperience: form.yearsExperience.value.trim(),
            essay: form.essay.value.trim()
        };

        if (!(data.fullName && data.email && data.phone && data.location
              && data.yearsExperience && data.essay && cvFile)) {
            setStatus("Please fill in every field and attach your CV before submitting.", true);
            return;
        }

        if (!new RegExp('^[0-9]{' + STRATEGY_PHONE_DIGITS + '}$').test(data.phone)) {
            setStatus("Phone number must be exactly 11 digits, numbers only (e.g. 08052033145).", true);
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
            setStatus("Please enter a valid email address.", true);
            return;
        }

        const essayWords = window.applyFields.countWords(data.essay);
        if (essayWords > STRATEGY_MAX_ESSAY_WORDS) {
            setStatus("Your essay is over " + STRATEGY_MAX_ESSAY_WORDS + " words. Please shorten it.", true);
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

                fetch(STRATEGY_FORM_SCRIPT_URL, {
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
