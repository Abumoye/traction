/* Careers hub: filter roles by search text and Open / Closed tabs. Pure progressive
   enhancement: with no JavaScript every role stays visible. */
(function () {
    var grid = document.getElementById('careersGrid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.job-card-v2'));
    var input = document.getElementById('careersSearch');
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-careers-toolbar] [data-filter]'));
    var empty = document.getElementById('careersEmpty');
    var state = 'all';

    function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }

    function apply() {
        var q = norm(input ? input.value : '');
        var shown = 0;
        cards.forEach(function (card) {
            var okText = !q || q.split(' ').every(function (w) { return card.getAttribute('data-search').indexOf(w) !== -1; });
            var okState = state === 'all' || card.getAttribute('data-state') === state;
            var show = okText && okState;
            card.hidden = !show;
            if (show) shown++;
        });
        if (empty) empty.hidden = shown !== 0;
    }

    tabs.forEach(function (btn) {
        btn.addEventListener('click', function () {
            state = btn.getAttribute('data-filter');
            tabs.forEach(function (b) { var on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
            apply();
        });
    });
    if (input) input.addEventListener('input', apply);
    var reset = document.getElementById('careersReset');
    if (reset) reset.addEventListener('click', function () { if (input) input.value = ''; tabs[0].click(); });
})();
