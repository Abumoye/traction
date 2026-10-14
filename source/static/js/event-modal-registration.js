/* =========================================================
   Traction Outsourcing Limited — pop-up event registration

   Used on event pages that register people through a pop-up form (for
   example the free online classes under /services/events/). It:
     1. opens the pop-up when someone clicks any button marked
        data-open-modal="<popup id>" (or when the page is opened with
        #register in the address),
     2. closes it (X button, outside click, Escape),
     3. sends the entry to the "event class registrations" Google Apps
        Script (see /docs/event-class-registration-setup.md), then shows
        a thank-you pop-up.

   The pop-up form carries data-event-slug and data-event-name, which are
   saved with every entry, so one script and one Sheet tab per event
   covers every future class.

   The Web App URL below belongs to the "Event Registrations" Google
   Apps Script (see /docs/event-class-registration-setup.md). If it is ever
   replaced with the placeholder text, the form hands the entry to WhatsApp
   instead, so nobody is lost.
   ========================================================= */

const EVENT_MODAL_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxyA5fx4VyJ7pPeiDHufd6JW1DqNLFN5jtswix7dXaI-D4oti5gqMHydbevOuSGFeYjxA/exec";
const EVENT_MODAL_WHATSAPP_NUMBER = "2347047082697";

document.addEventListener('DOMContentLoaded', function () {
    const modals = document.querySelectorAll('dialog.event-modal');
    if (!modals.length) return;

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal && !modal.open) modal.showModal();
    }

    document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            openModal(btn.getAttribute('data-open-modal'));
        });
    });
    if (window.location.hash === '#register') openModal(modals[0].id);

    modals.forEach(function (modal) {
        const form = modal.querySelector('form');
        const submitBtn = form.querySelector('button[type="submit"]');
        const statusEl = document.getElementById(form.id + 'Status');
        const successModal = document.getElementById(form.id + 'SuccessModal');
        const defaultBtnText = submitBtn.innerText;

        modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
        modal.querySelectorAll('[data-close-modal]').forEach(function (b) {
            b.addEventListener('click', function () { modal.close(); });
        });
        if (successModal) {
            successModal.addEventListener('click', function (e) { if (e.target === successModal) successModal.close(); });
            successModal.querySelectorAll('[data-close-success-modal]').forEach(function (b) {
                b.addEventListener('click', function () { successModal.close(); });
            });
        }

        function setStatus(message, isError) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? "#c0392b" : "#1e7e34";
        }
        function resetButton() { submitBtn.disabled = false; submitBtn.innerText = defaultBtnText; }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Spam guard: hidden trap field + speed check (see /js/form-guard.js).
            if (window.formGuard && window.formGuard.blocked(form, statusEl)) return;

            const data = {
                formType: "event-class-registration",
                eventSlug: form.getAttribute('data-event-slug'),
                eventName: form.getAttribute('data-event-name'),
                sourcePage: window.location.pathname,
                name: form.fullName.value.trim(),
                organization: form.organization.value.trim(),
                phone: form.phone.value.trim(),
                email: form.email.value.trim(),
                state: form.state.value
            };
            if (window.formGuard) Object.assign(data, window.formGuard.fields(form));

            if (!data.name || !data.organization || !data.phone || !data.email || !data.state) {
                setStatus("Please fill in every field before submitting.", true);
                return;
            }

            // Until the Apps Script is deployed (see the setup doc), registrations
            // go to WhatsApp as a ready-typed message so nobody is lost.
            if (EVENT_MODAL_SCRIPT_URL === "REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL") {
                const text = "Hello, I would like to register for " + data.eventName + ".\n" +
                    "Name: " + data.name + "\nOrganization: " + data.organization + "\n" +
                    "Phone: " + data.phone + "\nEmail: " + data.email + "\nState: " + data.state;
                window.open("https://wa.me/" + EVENT_MODAL_WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text), "_blank", "noopener");
                form.reset();
                modal.close();
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerText = "Registering...";
            setStatus("", false);

            fetch(EVENT_MODAL_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(data)
            })
            .then(function () {
                form.reset();
                resetButton();
                modal.close();
                if (successModal) successModal.showModal();
            })
            .catch(function () {
                setStatus("Something went wrong. Please try again or register on WhatsApp.", true);
                resetButton();
            });
        });
    });
});
