/* FAQ Accordion — tolnigeria.com
   Works with the .faq-item / h3 / p structure used sitewide.
   Clicking an item opens it and closes any other open item on the page. */

(function () {
    function initFaq() {
        var items = document.querySelectorAll('.faq-item');
        if (!items.length) return;

        items.forEach(function (item) {
            var heading = item.querySelector('h3');
            if (!heading) return;

            /* Make heading keyboard accessible */
            heading.setAttribute('tabindex', '0');
            heading.setAttribute('role', 'button');
            heading.setAttribute('aria-expanded', 'false');

            function toggle() {
                var isOpen = item.classList.contains('open');

                /* Close all items first */
                items.forEach(function (other) {
                    other.classList.remove('open');
                    var h = other.querySelector('h3');
                    if (h) h.setAttribute('aria-expanded', 'false');
                });

                /* If it was closed, open it */
                if (!isOpen) {
                    item.classList.add('open');
                    heading.setAttribute('aria-expanded', 'true');
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
