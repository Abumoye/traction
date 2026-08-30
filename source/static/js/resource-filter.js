/* =========================================================
   Traction Outsourcing Limited — Books & Resources filter
   Used on /books/. Three pills (All / Free / Paid) toggle which
   resources are visible. Every filterable item -- the featured
   book banner and each card in the 3-column grid -- carries a
   shared [data-resource-type] attribute, set by the template from
   its resource_type field in content/pages/books.json.
   ========================================================= */
document.addEventListener('DOMContentLoaded', function () {
    var pills = document.querySelectorAll('.filter-pill[data-resource-filter]');
    if (!pills.length) return;

    function applyFilter(filter) {
        document.querySelectorAll('[data-resource-type]').forEach(function (el) {
            var type = el.getAttribute('data-resource-type');
            el.hidden = !(filter === 'all' || type === filter);
        });

        // A resource-grid section whose items (featured banner and/or
        // grid cards) are all hidden by the filter would otherwise leave
        // its heading/sub floating above nothing -- hide the whole
        // section in that case.
        document.querySelectorAll('[data-resource-grid]').forEach(function (section) {
            var items = section.querySelectorAll('[data-resource-type]');
            var anyVisible = Array.prototype.some.call(items, function (c) { return !c.hidden; });
            section.hidden = items.length > 0 && !anyVisible;
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
