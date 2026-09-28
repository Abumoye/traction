/* =========================================================
   Traction Outsourcing Limited — Job Application Form Handler
   Used on /apply/real-estate-sales-manager-100/ only.

   Submits to a DEDICATED Google Apps Script Web App (formType: "apply"),
   separate from the lead-form / events scripts. Appends the entry to a
   Google Sheet and saves the uploaded CV to a Google Drive folder, then
   stores a link to the file in the Sheet row. No automated WhatsApp
   message is sent; an optional internal email notification can be added
   on the Apps Script side (see the setup doc).

   The role title below is sent with every submission so the same Sheet /
   Apps Script can be reused for future job postings just by duplicating
   this file (or by changing APPLY_ROLE_TITLE) for a new page.

   SETUP REQUIRED: Replace APPLY_FORM_SCRIPT_URL below with your deployed
   Google Apps Script Web App URL. See /docs/apply-form-backend-setup.md
   for the full deployment guide and the Apps Script code to paste.
   ========================================================= */

const APPLY_FORM_SCRIPT_URL = "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL";
const APPLY_ROLE_TITLE = "Real Estate Sales Manager";
const APPLY_MAX_CV_BYTES = 5 * 1024 * 1024; // 5MB

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

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (APPLY_FORM_SCRIPT_URL === "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL") {
            setStatus("This form is not fully set up yet. Please reach us on WhatsApp instead.", true);
            return;
        }

        const cvFile = form.cv.files[0];

        const data = {
            formType: "apply",
            role: APPLY_ROLE_TITLE,
            sourcePage: window.location.pathname,
            fullName: form.fullName.value.trim(),
            gender: form.gender.value.trim(),
            phone: form.phone.value.trim(),
            location: form.location.value.trim(),
            yearsExperience: form.yearsExperience.value.trim(),
            salesExperience: form.salesExperience.value.trim()
        };

        const requiredValid = data.fullName && data.gender && data.phone && data.location
            && data.yearsExperience && data.salesExperience && cvFile;

        if (!requiredValid) {
            setStatus("Please fill in every field and attach your CV before submitting.", true);
            return;
        }

        const isPdf = cvFile.type === "application/pdf" || /\.pdf$/i.test(cvFile.name);
        if (!isPdf) {
            setStatus("Your CV must be a PDF file.", true);
            return;
        }

        if (cvFile.size > APPLY_MAX_CV_BYTES) {
            setStatus("Your CV is too large. Please upload a PDF under 5MB.", true);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Uploading...";
        statusEl.textContent = "";

        const reader = new FileReader();

        reader.onload = function () {
            // result looks like "data:application/pdf;base64,JVBERi0xLj..."
            // — strip everything up to and including the comma.
            const base64 = reader.result.split(',')[1];

            data.cvFileName = cvFile.name;
            data.cvMimeType = cvFile.type || "application/pdf";
            data.cvBase64 = base64;

            submitBtn.innerText = "Submitting...";

            fetch(APPLY_FORM_SCRIPT_URL, {
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
