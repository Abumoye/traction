# Employee Training page: course registrations and specialized requests

Page: `/services/employee-training/` (source: `source/content/pages/service-employee-training.json`).

## What visitors can do

- Click a course card (or "What you will get") to open its pop-up: track banner, duration and delivery, "What you will get:", and a Register button.
- **Register** opens a small form (Full Name, Phone, Company, Email) with the course already filled in.
- **Request A Specialized Training** (bottom band) opens the same form with an extra "What training do you need?" box.

Both go to the same Google Apps Script Web App as the lead form on the ATH Recruiters page (`LEAD_FORM_SCRIPT_URL`, also set at the top of `source/static/js/training-courses.js`; if that URL ever changes, change it in **both** `lead-form.js` and `training-courses.js`).

## Where the entries go

Spreadsheet **Traction Outsourcing Leads**, new tab **Employee Training** (created automatically on the first submission):

`Timestamp | Course | Track | Name | Phone Number | Company Name | Email | What They Need (specialized requests) | Source Page`

Specialized requests have Course = "Specialized training request". Each entry also sends an email to tractionoutsourcing@gmail.com ("Employee Training: <course> - <name>").

Until the script below is updated and redeployed, submissions are NOT lost: the old script saves them on the **Leads** tab, and the course name is in the Source Page column (for example `/services/employee-training/ | Chef`...). The specialized request text (the "What training do you need?" box) is only kept after the update.

## One-time script update (the user does this)

1. Open the **Traction Outsourcing Leads** sheet, then Extensions > Apps Script.
2. Select all the code, delete it, and paste the whole of `docs/lead-form-handler.gs` (it is the full current script plus the Employee Training handler; nothing else changes). Save.
3. Deploy > Manage deployments > pencil (Edit) > Version: **New version** > Deploy. Saving alone is not enough. The web address stays the same.
4. Test: register for one course on the live page and check the new "Employee Training" tab and the email.

## Adding or changing courses

Courses live in the `training-track` sections of the page JSON: `title`, `duration`, `mode`, and `gets` (the "What you will get:" list). The `id` is the title in lower case with dashes; keep it unique.

## Track banners (one per track)

2400 x 600 px JPG (4:1), under ~300 KB, subject kept in the middle (phones crop the sides). Save in `source/static/images/training/` and set `"banner": "/images/training/<track-id>.jpg"` and `"banner_alt"` on that track's section. Track ids: `leadership-management`, `business-finance`, `ai-computer-literacy`, `workplace-management`, `customer-service`. Without a banner the page shows a dark-to-orange band with the track icon.
