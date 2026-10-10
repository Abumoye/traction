/* =========================================================
   Traction Outsourcing Limited — spam guard for every website form.
   Load this BEFORE the page's own form script.

   Two quiet checks, no CAPTCHA and nothing for real visitors to do:

   1. Hidden trap field ("website_url"): added to every form, invisible to
      people, but spam bots fill in every field they find. A form with the
      trap filled in is never sent.
   2. Speed check: a person cannot read and fill a form within 3 seconds of
      the page opening, a script can. Too-fast submissions are held back
      (the visitor is asked to try again) and are rejected by the server.

   Each form script calls:
     window.formGuard.blocked(form, statusEl)  -> true = stop, do not send
     window.formGuard.fields(form)             -> extra fields to add to the
                                                  payload (trap + elapsedMs)
   The Google Apps Script handlers check the same two fields, so spam
   posted straight to the script URL (skipping the page) is rejected too.
   Phone numbers are NOT restricted here, so international (diaspora)
   numbers still work.
   ========================================================= */
(function () {
    var MIN_MS = 3000;
    var TRAP_NAME = 'website_url';
    var startedAt = Date.now();

    function addTrap(form) {
        if (form.id === 'loginForm' || form.querySelector('[data-form-trap]')) return;
        var wrap = document.createElement('div');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.style.cssText = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;';
        wrap.innerHTML = '<label>Leave this field empty<input type="text" name="' + TRAP_NAME +
            '" value="" tabindex="-1" autocomplete="off" data-form-trap></label>';
        form.appendChild(wrap);
    }

    function trapValue(form) {
        var trap = form.querySelector('[data-form-trap]');
        return trap ? trap.value : '';
    }

    function elapsed() {
        return Date.now() - startedAt;
    }

    window.formGuard = {
        // True when the submission must not be sent.
        blocked: function (form, statusEl) {
            if (trapValue(form)) return true;   // bot: stay silent
            if (elapsed() < MIN_MS) {           // too fast: ask to retry
                if (statusEl) {
                    statusEl.textContent = 'Please take a moment to check your details, then submit again.';
                    statusEl.style.color = '#c0392b';
                }
                return true;
            }
            return false;
        },
        // Added to the data sent to the server, which re-checks both.
        fields: function (form) {
            var f = {};
            f[TRAP_NAME] = trapValue(form);
            f.elapsedMs = elapsed();
            return f;
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('form').forEach(addTrap);
    });
})();
