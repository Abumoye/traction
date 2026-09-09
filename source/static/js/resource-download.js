/* =========================================================
   Traction Outsourcing Limited — Free Resource Download Modal
   Used on /resources/ for the "Get Document" / "Get Book" flow on
   free resources. Powered by EmailJS (https://www.emailjs.com) — a
   free client-side email-sending service, since this site is static
   and has no backend server of its own to send email from.

   ONE EMAILJS ACCOUNT, TWO EMAIL SERVICES/TEMPLATES — the book keeps
   its own Service + Template inside the same tractionoutsourcing@gmail.com
   EmailJS account, so its confirmation email is tracked and worded
   separately from the Payroll template's, even though both still send
   from, reply to, and BCC the same tractionoutsourcing@gmail.com inbox:
     - "default" group — used by every resource EXCEPT the featured
       book (e.g. the Payroll Excel template).
     - "book" group — used only by the featured book (the template
       sets this via the button's data-resource-group="book"
       attribute, driven by "emailjs_group": "book" on the featured
       entry in content/pages/resources.json).
   A resource with no "emailjs_group" set falls back to "default".
   Because both groups live in the same account, they share one Public
   Key (Account -> General) — only the Service ID and Template ID
   differ per group.

   SETUP REQUIRED FOR THE "book" GROUP (one-time, about 5 minutes):
   1. Log into the existing EmailJS account (tractionoutsourcing@gmail.com).
   2. Email Services -> Add New Service -> connect
      tractionoutsourcing@gmail.com again as a second, separate service
      -> copy the new Service ID it gives you (this will differ from
      the "default" group's Service ID even though it's the same Gmail
      address).
   3. Email Templates -> Create New Template (separate from the
      "default" group's template, so the book's wording/subject can
      differ if you want). In the template body, use these variable
      names so they get filled in automatically:
        {{to_name}}        - the visitor's name
        {{to_email}}       - the visitor's email (also set this as the
                              template's "To email" field)
        {{document_title}} - which resource they requested
        {{document_link}}  - the direct download link to send them
        {{from_name}}      - "Traction Outsourcing Limited" (sent by the
                              form on every submission, use it in the
                              template's "From Name" field)
        {{reply_to}}       - tractionoutsourcing@gmail.com (use it in
                              the template's "Reply To" field)
      -> copy the Template ID.
   4. In that same template's settings, set "BCC" to
      tractionoutsourcing@gmail.com (same inbox as the "default" group).
   5. Paste the new Service ID and Template ID into the "book" entry in
      RESOURCE_EMAILJS_CONFIGS below and redeploy. The Public Key stays
      the same as the "default" group's — no need to look it up again.
   Until the "book" group's Service ID and Template ID are filled in,
   the book's form will politely tell visitors it isn't ready yet
   instead of failing silently — the "default" group (Payroll template,
   etc.) keeps working normally the whole time.
   ========================================================= */

const RESOURCE_EMAILJS_CONFIGS = {
    default: {
        serviceId: "service_1oodwas",
        templateId: "template_crleo3n",
        publicKey: "p_j0hUJOA7fqSRNrK",
        replyTo: "tractionoutsourcing@gmail.com"
    },
    // "book" group — same EmailJS account and same
    // tractionoutsourcing@gmail.com inbox as "default" (sends from,
    // replies to, and BCCs that same address), just tracked through
    // its own Email Service + Template so the book's confirmation
    // email is distinct from the Payroll template's. Fill in serviceId
    // and templateId once that second Service/Template is created;
    // publicKey is shared with "default" since it's the same account.
    book: {
        serviceId: "REPLACE_WITH_BOOK_SERVICE_ID",
        templateId: "REPLACE_WITH_BOOK_TEMPLATE_ID",
        publicKey: "p_j0hUJOA7fqSRNrK",
        replyTo: "tractionoutsourcing@gmail.com"
    }
};

document.addEventListener('DOMContentLoaded', function () {
    const dialog = document.getElementById('resourceModal');
    if (!dialog) return;

    function isGroupConfigured(config) {
        return !!config
            && config.serviceId.indexOf('REPLACE_WITH') !== 0
            && config.templateId.indexOf('REPLACE_WITH') !== 0
            && config.publicKey.indexOf('REPLACE_WITH') !== 0;
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
            const group = btn.getAttribute('data-resource-group') || 'default';

            form.reset();
            titleEl.textContent = 'Get "' + title + '"';
            fileUrlInput.value = fileUrl;
            form.dataset.resourceTitle = title;
            form.dataset.resourceGroup = group;
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
        const group = form.dataset.resourceGroup || 'default';
        const config = RESOURCE_EMAILJS_CONFIGS[group] || RESOURCE_EMAILJS_CONFIGS.default;

        if (!name || !email) {
            statusEl.textContent = 'Please fill in your name and email.';
            statusEl.style.color = '#c0392b';
            return;
        }

        if (!isGroupConfigured(config) || !window.emailjs) {
            statusEl.textContent = 'This form is not fully set up yet. Please reach us on WhatsApp instead.';
            statusEl.style.color = '#c0392b';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Sending...';
        statusEl.textContent = '';

        // fileUrl is a site-relative path (e.g. "/downloads/x.xlsx"). A
        // relative path is meaningless once it's sitting in someone's
        // inbox, so turn it into a full, clickable URL before sending.
        const absoluteFileUrl = fileUrl.indexOf('http') === 0
            ? fileUrl
            : window.location.origin + fileUrl;

        emailjs.send(config.serviceId, config.templateId, {
            to_name: name,
            to_email: email,
            document_title: title,
            document_link: absoluteFileUrl,
            from_name: 'Traction Outsourcing Limited',
            reply_to: config.replyTo
        }, {
            publicKey: config.publicKey
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
