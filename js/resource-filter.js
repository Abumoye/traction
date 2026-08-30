/* =========================================================
   Traction Outsourcing Limited — Books & Resources filter
   Used on /books/. Three pills (All / Free / Paid) toggle which
   resources are visible. Works across different section types
   (the "book" showcase section and "resource-grid" cards) via a
   shared [data-resource-type] attribute, set by the template from
   each item's resource_type field in content/pages/books.json.
   ========================================================= */
document.addEventListener('DOMContentLoaded', function () {
    var pills = document.querySelectorAll('.filter-pill[data-resource-filter]');
    if (!pills.length) return;

    function applyFilter(filter) {
        document.querySelectorAll('[data-resource-type]').forEach(function (el) {
            var type = el.getAttribute('data-resource-type');
            el.hidden = !(filter === 'all' || type === filter);
        });

        // A resource-grid section whose cards are all hidden by the filter
        // would otherwise leave its heading/sub floating above nothing --
        // hide the whole section in that case.
        document.querySelectorAll('[data-resource-grid]').forEach(function (section) {
            var cards = section.querySelectorAll('.resource-card');
            var anyVisible = Array.prototype.some.call(cards, function (c) { return !c.hidden; });
            section.hidden = cards.length > 0 && !anyVisible;
        });
    }

    pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
            pills.forEach(function (p) { p.classList.remove('active'); });
            pill.classList.add('active');
            applyFilter(pill.getAttribute('data-resource-filter'));
        });
    });
});
