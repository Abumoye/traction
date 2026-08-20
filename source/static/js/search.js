/* =========================================================
   Traction Outsourcing — Articles full-text search
   Client-side only (static site, no backend). Loads a prebuilt
   JSON index (title + excerpt + full article body for every
   article) and ranks matches by field weight. Also drives the
   category filter pills, combined with the live search query.
   ========================================================= */
(function () {
  var state = { index: [], query: '', category: 'all' };

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function score(article, terms) {
    var s = 0;
    var title = article.title.toLowerCase();
    var tag = (article.tag || '').toLowerCase();
    var excerpt = (article.excerpt || '').toLowerCase();
    var body = (article.body || '').toLowerCase();
    terms.forEach(function (term) {
      if (!term) return;
      if (title.includes(term)) s += 12;
      if (title.startsWith(term)) s += 6;
      if (tag.includes(term)) s += 5;
      if (excerpt.includes(term)) s += 4;
      if (body.includes(term)) {
        s += 2;
        // small bonus for repeated occurrences, capped
        var count = body.split(term).length - 1;
        s += Math.min(count, 5) * 0.5;
      }
    });
    return s;
  }

  function snippet(body, terms) {
    var lower = body.toLowerCase();
    var idx = -1;
    for (var i = 0; i < terms.length; i++) {
      if (!terms[i]) continue;
      var found = lower.indexOf(terms[i]);
      if (found !== -1) { idx = found; break; }
    }
    if (idx === -1) return body.slice(0, 160) + '…';
    var start = Math.max(0, idx - 70);
    var end = Math.min(body.length, idx + 140);
    var out = (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
    terms.forEach(function (term) {
      if (!term) return;
      var re = new RegExp('(' + escapeRegExp(term) + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  function render() {
    var grid = document.getElementById('articleGrid');
    var featured = document.getElementById('featuredArticle');
    var noResults = document.getElementById('noResults');
    var countEl = document.getElementById('resultsCount');
    if (!grid) return;

    var terms = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var pool = state.index.filter(function (a) {
      return state.category === 'all' || a.category === state.category;
    });

    var results;
    if (terms.length === 0) {
      results = pool.map(function (a) { return { article: a, s: 0 }; });
    } else {
      results = pool
        .map(function (a) { return { article: a, s: score(a, terms) }; })
        .filter(function (r) { return r.s > 0; })
        .sort(function (a, b) { return b.s - a.s; });
    }

    if (featured) featured.style.display = terms.length ? 'none' : '';

    if (!results.length) {
      grid.innerHTML = '';
      noResults.classList.add('show');
      countEl.textContent = '';
      return;
    }
    noResults.classList.remove('show');
    countEl.textContent = terms.length
      ? results.length + (results.length === 1 ? ' article found' : ' articles found') + ' for "' + state.query + '"'
      : '';

    grid.innerHTML = results.map(function (r) {
      var a = r.article;
      var body = terms.length ? snippet(a.body, terms) : (a.excerpt || '');
      return (
        '<a href="' + a.url + '" class="card insight-card reveal in-view">' +
        (a.image ? '<img src="' + a.image + '" alt="" loading="lazy">' : '') +
        '<div class="body">' +
        '<span class="tag-pill">' + a.tag + '</span>' +
        '<h3>' + a.title + '</h3>' +
        '<p>' + body + '</p>' +
        '<div style="font-size:13px;color:var(--ink-faint)"><i class="fas fa-clock"></i> ' + a.read_time + '</div>' +
        '</div></a>'
      );
    }).join('');
  }

  function wire(data) {
    state.index = data;
    var input = document.getElementById('articleSearch');
    var pills = document.querySelectorAll('.filter-pill');

    if (input) {
      input.addEventListener('input', function () {
        state.query = input.value;
        render();
      });
    }
    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        pills.forEach(function (p) { p.classList.remove('active'); });
        pill.classList.add('active');
        state.category = pill.dataset.filter;
        render();
      });
    });
    // Only render dynamically once a search/filter actually happens;
    // until then the server-rendered list (with the featured article) is shown.
  }

  function init(indexUrl) {
    fetch(indexUrl).then(function (r) { return r.json(); }).then(wire).catch(function (err) {
      console.error('Search index failed to load', err);
    });
  }

  // Used by standalone single-file previews, where the index is embedded
  // inline (window.__SEARCH_DATA__) instead of fetched, since there's no
  // server to fetch it from. The real build always uses init() above.
  function initWithData(data) { wire(data); }

  window.TractionSearch = { init: init, initWithData: initWithData, render: render, state: state };
})();
