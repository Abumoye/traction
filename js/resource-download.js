/* =========================================================
   Traction Outsourcing Limited — Free Resource Download Modal
   Used on /books/ for the "Get Document" flow on free resources.
   Powered by EmailJS (https://www.emailjs.com) — a free client-side
   email-sending service, since this site is static and has no backend
   server of its own to send email from.

   SETUP REQUIRED (one-time, about 5 minutes):
   1. Create a free account at https://www.emailjs.com
   2. Email Services -> Add New Service -> connect the Gmail address
      tractionoutsourcing@gmail.com -> copy the Service ID it gives you.
   3. Email Templates -> Create New Template. In the template body, use
      these variable names so they get filled in automatically:
        {{to_name}}        - the visitor's name
        {{to_email}}       - the visitor's email (also set this as the
                              template's "To email" field)
        {{document_title}} - which resource they requested
        {{document_link}}  - the direct download link to send them
        {{from_name}}      - "Traction Outsourcing Limited" (sent by the
                              form on every submission, use it in the
                              template's "From Name" field)
        {{reply_to}}       - tractionoutsourcing@gmail.com (use it in the
                              template's "Reply To" field, so a reply from
                              the recipient comes straight back to you)
      -> copy the Template ID.
   4. In that same template's settings, set "BCC" to
      tractionoutsourcing@gmail.com. This is what sends you a copy every
      time someone downloads a resource, at no extra cost (EmailJS bills
      per send, not per recipient on the message).
   5. Account -> General -> copy your Public Key.
   6. Paste all three values (Service ID, Template ID, Public Key) into
      the constants below and redeploy.
   Until these are filled in, the form will politely tell visitors it
   isn't ready yet instead of failing silently.
   ========================================================= */

const RESOURCE_EMAILJS_SERVICE_ID = "REPLACE_WITH_YOUR_EMAILJS_SERVICE_ID";
const RESOURCE_EMAILJS_TEMPLATE_ID = "REPLACE_WITH_YOUR_EMAILJS_TEMPLATE_ID";
const RESOURCE_EMAILJS_PUBLIC_KEY = "REPLACE_WITH_YOUR_EMAILJS_PUBLIC_KEY";

document.addEventListener('DOMContentLoaded', function () {
    const dialog = document.getElementById('resourceModal');
    if (!dialog) return;

    const isConfigured = RESOURCE_EMAILJS_SERVICE_ID.indexOf('REPLACE_WITH') !== 0
        && RESOURCE_EMAILJS_TEMPLATE_ID.indexOf('REPLACE_WITH') !== 0
        && RESOURCE_EMAILJS_PUBLIC_KEY.indexOf('REPLACE_WITH') !== 0;

    if (isConfigured && window.emailjs) {
        emailjs.init({ publicKey: RESOURCE_EMAILJS_PUBLIC_KEY });
    }

    const form = document.getElementById('resourceForm');
    const titleEl = document.getElementById('resourceModalTitle');
    const fileUrlInput = document.getElementById('resourceFileUrl');
    const nameInput = document.getElementById('resourceName');
    const emailInput = document.getElementById('resourceEmail');
    const submitBtn = document.getElementById('resourceSubmitBtn');
    const statusEl = document.getElementById('resourceFormStatus');
    const closeBtn = document.getElementById('resourceModalClose');
    const defaultBtnText = submitBtn.innerText;

    document.querySelectorAll('.resource-download-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const title = btn.getAttribute('data-resource-title') || 'This Document';
            const fileUrl = btn.getAttribute('data-resource-file') || '';

            form.reset();
            titleEl.textContent = 'Get "' + title + '"';
            fileUrlInput.value = fileUrl;
            form.dataset.resourceTitle = title;
            statusEl.textContent = '';
            statusEl.style.color = '';
            submitBtn.disabled = false;
            submitBtn.innerText = defaultBtnText;

            dialog.showModal();
            nameInput.focus();
        });
    });

    function closeModal() {
        dialog.close();
    }

    closeBtn.addEventListener('click', closeModal);

    // Click on the backdrop area (outside the form) closes the dialog.
    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeModal();
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const fileUrl = fileUrlInput.value;
        const title = form.dataset.resourceTitle || 'This Document';

        if (!name || !email) {
            statusEl.textContent = 'Please fill in your name and email.';
            statusEl.style.color = '#c0392b';
            return;
        }

        if (!isConfigured || !window.emailjs) {
            statusEl.textContent = 'This form is not fully set up yet. Please reach us on WhatsApp instead.';
            statusEl.style.color = '#c0392b';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Sending...';
        statusEl.textContent = '';

        emailjs.send(RESOURCE_EMAILJS_SERVICE_ID, RESOURCE_EMAILJS_TEMPLATE_ID, {
            to_name: name,
            to_email: email,
            document_title: title,
            document_link: fileUrl,
            from_name: 'Traction Outsourcing Limited',
            reply_to: 'tractionoutsourcing@gmail.com'
        }).then(function () {
            statusEl.textContent = 'Sent! Check ' + email + ' for the download link.';
            statusEl.style.color = '#1e7e34';
            submitBtn.innerText = defaultBtnText;
            submitBtn.disabled = false;
            setTimeout(closeModal, 2500);
        }).catch(function () {
            statusEl.textContent = 'Something went wrong. Please try again or reach us on WhatsApp.';
            statusEl.style.color = '#c0392b';
            submitBtn.innerText = defaultBtnText;
            submitBtn.disabled = false;
        });
    });
});
