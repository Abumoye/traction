/* =========================================================
   Traction Properties — multi-facet property filter.
   Used on pages with a [data-property-filter-bar] (e.g. Houses For
   Rent). Filters .property-card elements by location, bedrooms,
   house type, and road access (each a <select data-property-filter>),
   combined with a free-text search against each card's unique
   property ID (data-property-id). All active filters must match --
   this is an AND, not an OR.
   ========================================================= */
document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('[data-property-filter-bar]');
    if (!bar) return;

    var searchInput = document.getElementById('propertyIdSearch');
    var selects = bar.querySelectorAll('select[data-property-filter]');
    var resetBtn = document.getElementById('propertyFilterReset');
    var cards = document.querySelectorAll('.property-card');
    var emptyMsg = document.getElementById('propertyFilterEmpty');

    function applyFilters() {
        var search = ((searchInput && searchInput.value) || '').trim().toLowerCase();
        var active = {};
        selects.forEach(function (sel) {
            var key = sel.getAttribute('data-property-filter');
            if (sel.value) active[key] = sel.value.toLowerCase();
        });

        var anyVisible = false;
        cards.forEach(function (card) {
            var matches = true;
            if (active.location && (card.getAttribute('data-location') || '').toLowerCase() !== active.location) matches = false;
            if (active.bedrooms && (card.getAttribute('data-bedrooms') || '').toLowerCase() !== active.bedrooms) matches = false;
            if (active['house-type'] && (card.getAttribute('data-house-type') || '').toLowerCase() !== active['house-type']) matches = false;
            if (active['road-access'] && (card.getAttribute('data-road-access') || '').toLowerCase() !== active['road-access']) matches = false;
            if (search) {
                var id = (card.getAttribute('data-property-id') || '').toLowerCase();
                if (!id || id.indexOf(search) === -1) matches = false;
            }
            card.hidden = !matches;
            if (matches) anyVisible = true;
        });

        if (emptyMsg) emptyMsg.hidden = anyVisible;
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    selects.forEach(function (sel) { sel.addEventListener('change', applyFilters); });
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            if (searchInput) searchInput.value = '';
            selects.forEach(function (sel) { sel.value = ''; });
            applyFilters();
        });
    }
});
