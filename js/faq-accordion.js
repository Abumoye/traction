/* FAQ Accordion — tolnigeria.com
   Explicitly hides all answers on init, then toggles via JS.
   This ensures the accordion works regardless of CSS specificity. */

(function () {
    function initFaq() {
        var items = document.querySelectorAll('.faq-item');
        if (!items.length) return;

        /* On init: hide all answers explicitly */
        items.forEach(function (item) {
            var answer = item.querySelector('p, div.faq-answer');
            if (answer) answer.style.display = 'none';
        });

        items.forEach(function (item) {
            var heading = item.querySelector('h3');
            if (!heading) return;

            heading.setAttribute('tabindex', '0');
            heading.setAttribute('role', 'button');
            heading.setAttribute('aria-expanded', 'false');
            heading.style.cursor = 'pointer';

            function toggle() {
                var isOpen = item.classList.contains('open');

                /* Close ALL items */
                items.forEach(function (other) {
                    other.classList.remove('open');
                    var h = other.querySelector('h3');
                    if (h) h.setAttribute('aria-expanded', 'false');
                    var answers = other.querySelectorAll('p, div.faq-answer');
                    answers.forEach(function (a) { a.style.display = 'none'; });
                });

                /* Open clicked item if it was closed */
                if (!isOpen) {
                    item.classList.add('open');
                    heading.setAttribute('aria-expanded', 'true');
                    var answers = item.querySelectorAll('p, div.faq-answer');
                    answers.forEach(function (a) { a.style.display = 'block'; });
                }
            }

            heading.addEventListener('click', toggle);
            heading.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFaq);
    } else {
        initFaq();
    }
})();
