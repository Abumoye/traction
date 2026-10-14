# Event class registrations: backend setup

Covers the pop-up registration form on event pages such as
`/services/events/structure/` (free online classes). It is separate from
the T-ICR forms (`docs/tcr-events-backend-setup.md`) and the lead form.

- **What it stores:** Full Name, Organization, Phone Number, Email, State of
  Residence, plus the event name and page. One Sheet, one tab per event (tab
  named after the event slug, e.g. `structure`), created automatically.
- **Duplicates:** a repeated email for the same event is ignored.
- **Spam:** same hidden-field and speed checks as the other forms; blocked
  entries go to a `Blocked` tab.

## Set up (about 5 minutes)

1. Create a new Google Sheet named **Traction Outsourcing Event Registrations**.
2. **Extensions → Apps Script**. Delete the starter code and paste the full
   contents of `event-class-handler.gs`. Save. (Optional: put an email
   address in `NOTIFY_EMAIL` to be emailed on every registration.)
3. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access:
   **Anyone**. Authorize when asked, then copy the Web app URL.
4. In `source/static/js/event-modal-registration.js`, replace
   `REPLACE_WITH_YOUR_DEPLOYED_APPS_SCRIPT_URL` with that URL, commit and push.

Until step 4 is done, the pop-up form opens WhatsApp with the person's
details already typed in, so nobody is lost.

To change the script later: **Deploy → Manage deployments → Edit → New
version** (the URL stays the same).

## Adding the next event

On the new event's page JSON add a `modal-form` section with its own
`event_slug` and `event_name`, plus `data-open-modal` buttons. The same
script and Sheet are reused; each event gets its own tab automatically.
