# Event class registrations: backend setup

Covers the pop-up registration form on event pages such as
`/services/events/structure/` (free online classes). It is separate from
the T-ICR forms (`docs/tcr-events-backend-setup.md`) and the lead form.

- **What it stores:** Full Name, Organization, Phone Number, Email, State of
  Residence, plus the event name and page. One Sheet, one tab per event (tab
  named after the event slug, e.g. `structure`), created automatically.
- **Confirmation email:** each registrant is emailed automatically with the
  class details (date, time, access link). A ninth column, **Confirmation
  Email**, shows `Sent` or `Failed: reason` for every row.
- **Duplicates:** a repeated email for the same event is ignored (and not
  emailed twice).
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

## Confirmation emails

Emails are defined in the `EVENT_EMAILS` block at the top of the script, one
entry per event (the key is the event slug). The Structure class entry holds
its title, date, time and Google Meet link. To change the date, time or link,
edit that entry, then **Deploy → Manage deployments → Edit → New version**.

- They are sent from the Google account that owns the script, with
  "Traction Outsourcing Limited" as the sender name and replies going to
  `EMAIL_REPLY_TO`.
- **First time only:** in the Apps Script editor pick `authorizeEmail` in the
  toolbar, click **Run**, and accept the permission screen. Then create a
  new deployment version as above.
- **Daily limit:** a free Gmail account can send about 100 emails a day, a
  Google Workspace account about 1,500. Anyone over the limit is saved in the
  sheet as `Failed: ...`; run `resendMissingConfirmations` the next day (or
  from a larger account) to email them.
- An event with no `EVENT_EMAILS` entry saves registrations but sends no email.

## Adding the next event

On the new event's page JSON add a `modal-form` section with its own
`event_slug` and `event_name`, plus `data-open-modal` buttons. The same
script and Sheet are reused; each event gets its own tab automatically. To
email its registrants, add an `EVENT_EMAILS` entry with the same slug.
