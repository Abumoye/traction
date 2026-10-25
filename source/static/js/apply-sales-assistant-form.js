/* =========================================================
   Traction Outsourcing Limited — Sales Assistant (Wuse 2) Application Form
   Used on /apply/sales-assistant/ only.
   Needs /js/apply-fields.js loaded first (digits-only phone + PDF check).

   Submits to the SAME Google Apps Script Web App as the other job
   application form, but with formType "apply-sales-assistant" so the script
   files the entry on its own tab ("Sales Assistant") in the same
   Google Sheet and saves the uploaded CV (PDF only) to Google Drive.

   See /docs/apply-form-backend-setup.md for the Apps Script code (it must
   include the "apply-sales-assistant" handler) and how to redeploy.
   ========================================================= */

const SALES_ASSISTANT_FORM_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx0ZVyCU3EUcVB4BSzBbV1UIZy0a0ThpmoTk0Up0CeffTmE6QmhWNQR8gLxrojcqpKL/exec";
const SALES_ASSISTANT_ROLE_TITLE = "Sales Assistant";
const SALES_ASSISTANT_MAX_CV_BYTES = 5 * 1024 * 1024; // 5MB
const SALES_ASSISTANT_PHONE_DIGITS = 11;

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
        if (file.size > SALES_ASSISTANT_MAX_CV_BYTES) {
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

        // Spam guard: hidden trap field + speed check (see /js/form-guard.js).
        if (window.formGuard && window.formGuard.blocked(form, statusEl)) return;

        const cvFile = form.cv.files[0];

        const data = {
            formType: "apply-sales-assistant",
            role: SALES_ASSISTANT_ROLE_TITLE,
            sourcePage: window.location.pathname,
            fullName: form.fullName.value.trim(),
            gender: form.gender.value.trim(),
            age: form.age.value.trim(), // as at 31 October 2026
            phone: form.phone.value.trim(),
            email: form.email.value.trim(),
            resumeImmediately: form.resumeImmediately.value.trim(),
            livesInAbuja: form.livesInAbuja.value.trim(),
            speaksHausa: form.speaksHausa.value.trim()
        };
        if (window.formGuard) Object.assign(data, window.formGuard.fields(form));

        if (!(data.fullName && data.gender && data.age && data.phone && data.email
              && data.resumeImmediately && data.livesInAbuja && data.speaksHausa && cvFile)) {
            setStatus("Please fill in every field and attach your CV before submitting.", true);
            return;
        }

        if (!new RegExp('^[0-9]{' + SALES_ASSISTANT_PHONE_DIGITS + '}$').test(data.phone)) {
            setStatus("Phone number must be exactly 11 digits, numbers only (e.g. 08052033145).", true);
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
            setStatus("Please enter a valid email address.", true);
            return;
        }

        const ageNum = Number(data.age);
        if (!/^[0-9]{1,3}$/.test(data.age) || ageNum < 16 || ageNum > 70) {
            setStatus("Please enter your age in years (a number between 16 and 70).", true);
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

                fetch(SALES_ASSISTANT_FORM_SCRIPT_URL, {
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
