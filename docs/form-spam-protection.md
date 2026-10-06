# Form spam protection

Every form on the site (service-page lead forms, partnerships, job applications, event registration and affiliate, resource downloads) has two quiet spam checks. Visitors never see them and there is no CAPTCHA.

1. **Hidden trap field** (`website_url`): added by `/js/form-guard.js` to every form. People cannot see it; spam bots fill in every field they find. If it has anything in it, the form is not sent.
2. **Speed check**: if a form is submitted less than 3 seconds after the page opened, it is held back and the visitor is asked to submit again. The time is sent to the server as `elapsedMs`.

The three Google Apps Script handlers (leads, job applications, events) repeat both checks, so spam posted straight to the script URL, skipping the website, is rejected as well. A direct post without the two fields is treated as spam.

Rejected entries are not added to your sheets and trigger no emails. They are written to a tab called **Blocked** (latest 500 kept) with the time, form, reason, page, name, email and phone, so if a real person is ever caught by mistake you can still see their details.

Phone numbers are deliberately **not** restricted on the lead and event forms, so international numbers work. (The job application forms keep their 11-digit Nigerian phone rule.)

## Adding a new form

1. Load `/js/form-guard.js` before the form's own script.
2. In the submit handler, straight after `e.preventDefault()`: `if (window.formGuard && window.formGuard.blocked(form, statusEl)) return;`
3. After building the `data` object: `if (window.formGuard) Object.assign(data, window.formGuard.fields(form));`
4. Make sure the Apps Script handler for that form calls `checkSpam(data)` first (see the scripts in the setup docs).

## Rolling it out

1. Merge and publish the website change first.
2. Wait about an hour, so visitors with an old copy of a page open are not rejected, then update the three Apps Scripts and redeploy each (**Deploy → Manage deployments → pencil → New version → Deploy**).
3. Check the **Blocked** tab after a few days. Real spam should show up there; real people should not.

Limits: this stops simple bots and scripts that post straight to the script URL. A determined bot that loads the page, waits, and avoids the trap field would still get through; if that ever happens, the next step would be Cloudflare Turnstile, a free invisible CAPTCHA.
