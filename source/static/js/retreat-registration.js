/* =========================================================
   Traction Outsourcing Limited — Retreat Registration Handler
   Used on /events/register/ only.
   Submits to the same Google Apps Script Web App used by
   js/lead-form.js, tagged with formType: "retreat-registration"
   so the script can route it to its own sheet, save the receipt
   file to Drive, and send a confirmation email to the registrant.

   SETUP REQUIRED: see /docs/lead-form-setup.md for the Apps Script
   changes needed (new sheet tab, Drive folder, confirmation email).
   ========================================================= */

const RETREAT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyeu2T0WE1M-4d2erYY9IUazEKTsWPmuG9cnIYK61PQkdfY8OqvvOTubLFcFJRfdL5iVw/exec";

const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('retreatForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const statusEl = document.getElementById('retreatFormStatus');
    const defaultBtnText = submitBtn.innerText;

    const groupToggle = form.querySelector('input[name="groupTicket"]');
    const groupSizeWrap = document.getElementById('groupSizeWrap');
    const groupSizeInput = form.querySelector('input[name="groupSize"]');

    // Show/hide "how many in your group" based on the Group Ticket select
    const groupSelect = form.querySelector('select[name="groupTicket"]');
    if (groupSelect && groupSizeWrap) {
        groupSelect.addEventListener('change', function () {
            const isGroup = groupSelect.value === 'Yes';
            groupSizeWrap.style.display = isGroup ? 'block' : 'none';
            groupSizeInput.required = isGroup;
            if (!isGroup) groupSizeInput.value = '';
        });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (RETREAT_SCRIPT_URL === "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL") {
            statusEl.textContent = "This form is not fully set up yet. Please reach us on WhatsApp instead.";
            statusEl.style.color = "#c0392b";
            return;
        }

        const fileInput = form.querySelector('input[name="receiptFile"]');
        const file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;

        if (file && file.size > MAX_RECEIPT_SIZE_BYTES) {
            statusEl.textContent = "Your receipt file is larger than 5MB. Please compress it or email it to partner@tolnigeria.com instead.";
            statusEl.style.color = "#c0392b";
            return;
        }

        const data = {
            formType: "retreat-registration",
            sourcePage: window.location.pathname,
            name: form.fullName.value.trim(),
            email: form.email.value.trim(),
            phone: form.phone.value.trim(),
            companyName: form.companyName.value.trim(),
            jobTitle: form.jobTitle.value.trim(),
            gender: form.gender.value.trim(),
            nationality: form.nationality.value.trim(),
            groupTicket: form.groupTicket.value.trim(),
            groupSize: form.groupTicket.value === 'Yes' ? form.groupSize.value.trim() : '',
            paymentMade: form.paymentMade.value.trim()
        };

        const requiredValid = data.name && data.email && data.phone && data.companyName
            && data.jobTitle && data.gender && data.nationality && data.groupTicket
            && data.paymentMade && (data.groupTicket !== 'Yes' || data.groupSize);

        if (!requiredValid) {
            statusEl.textContent = "Please fill in every required field before submitting.";
            statusEl.style.color = "#c0392b";
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Submitting...";
        statusEl.textContent = "";

        function sendData(payload) {
            fetch(RETREAT_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            })
            .then(function () {
                statusEl.textContent = "Thank you. Your registration has been received, a confirmation email is on its way, and our team will reach out within 24 hours.";
                statusEl.style.color = "#1e7e34";
                form.reset();
                if (groupSizeWrap) groupSizeWrap.style.display = 'none';
                submitBtn.innerText = defaultBtnText;
                submitBtn.disabled = false;
            })
            .catch(function () {
                statusEl.textContent = "Something went wrong. Please try again or reach us on WhatsApp.";
                statusEl.style.color = "#c0392b";
                submitBtn.innerText = defaultBtnText;
                submitBtn.disabled = false;
            });
        }

        if (file) {
            const reader = new FileReader();
            reader.onload = function () {
                // result looks like "data:<mime>;base64,<data>"
                const base64 = reader.result.split(',')[1];
                data.receiptFileName = file.name;
                data.receiptFileType = file.type;
                data.receiptFileData = base64;
                sendData(data);
            };
            reader.onerror = function () {
                statusEl.textContent = "We could not read your receipt file. Please try a different file or submit without it.";
                statusEl.style.color = "#c0392b";
                submitBtn.innerText = defaultBtnText;
                submitBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        } else {
            sendData(data);
        }
    });
});
