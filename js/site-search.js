/* =========================================================
   Traction Outsourcing: site-wide search
   Client-side only (static site, no backend). Loads one prebuilt
   JSON file (/site-search-index.json, generated at build time from
   every public page, article and resource) the first time a visitor
   focuses the search box, then ranks matches in the browser.

   Two front ends share the same engine:
     - the homepage hero box (dropdown of top results)
     - the /search/ results page (full list with type filters)
   ========================================================= */
(function () {
  var INDEX_URL = '/site-search-index.json';
  var WA_URL = 'https://wa.me/2348052033145?text=' +
    encodeURIComponent('Hi, I could not find what I was looking for on your website.');

  var TYPE_META = {
    Service:     { label: 'Service',     icon: 'fa-briefcase',       plural: 'Services' },
    Event:       { label: 'Event',       icon: 'fa-calendar-days',   plural: 'Events' },
    Article:     { label: 'Article',     icon: 'fa-newspaper',       plural: 'Articles' },
    Careers:     { label: 'Careers',     icon: 'fa-users',           plural: 'Careers' },
    Job:         { label: 'Job',         icon: 'fa-user-tie',        plural: 'Careers' },
    Resource:    { label: 'Resource',    icon: 'fa-file-arrow-down', plural: 'Resources' },
    Brand:       { label: 'Brand',       icon: 'fa-building',        plural: 'Brands' },
    Partnership: { label: 'Partnership', icon: 'fa-handshake',       plural: 'Partnerships' },
    Page:        { label: 'Page',        icon: 'fa-file-lines',      plural: 'Pages' }
  };
  // Filter pills on the results page, in this order.
  var FILTERS = ['Services', 'Events', 'Articles', 'Careers', 'Resources', 'Brands', 'Partnerships', 'Pages'];

  // Words that mean (nearly) the same thing to a visitor. Typing any word in a
  // group also finds pages that only contain the others. Multi-word entries are
  // split into their words. Add a new row when you spot a gap.
  var GROUPS = [
    'recruit recruitment recruiter recruiting hire hiring headhunt headhunting talent placement sourcing candidate candidates shortlist staffing',
    'job jobs career careers vacancy vacancies employment opening openings internship apply',
    'train training trainer trainings course courses workshop workshops learning coaching upskill upskilling class classes masterclass seminar certificate certification',
    'online virtual webinar zoom meet livestream',
    'payroll salary salaries wage wages paye payslip remuneration pension deduction deductions compensation',
    'outsourcing outsource outsourced manpower workforce',
    'hr human personnel',
    'restructure restructuring organogram reorganise reorganization reorganisation turnaround downsizing merger',
    'startup start-up register registration cac incorporate incorporation',
    'advisory advice consulting consultant consultancy strategy strategic guidance mentor',
    'event events retreat retreats conference summit kigali rwanda t-icr',
    'property properties estate house houses land lands apartment apartments rent rental lease landlord tenant',
    'contact phone whatsapp email address location office enquiry inquiry',
    'price prices pricing cost costs fee fees charge charges rate rates quote',
    'book ebook e-book download downloads template templates resource resources guide pdf excel',
    'review reviews testimonial testimonials feedback',
    'leadership leader manager managers management boss bosses executive executives supervisor',
    'romance romantic dating love couple affair',
    'health hmo insurance hallmark medical',
    'bank banks banking fintech',
    'handbook policy policies manual',
    'fire dismiss dismissal terminate termination sack sacking disciplinary resign resignation',
    'leave vacation holiday absence',
    'interview interviews screening vetting',
    'performance appraisal kpi kpis evaluation productivity',
    'culture engagement morale retention turnover motivation',
    'support helpdesk',
    'cheap affordable inexpensive'
  ];
  var SYNONYMS = (function () {
    var map = {};
    GROUPS.forEach(function (g) {
      var words = g.split(/\s+/).filter(Boolean);
      words.forEach(function (w) {
        var set = map[w] || (map[w] = []);
        words.forEach(function (o) { if (o !== w && set.indexOf(o) === -1) set.push(o); });
      });
    });
    return map;
  })();
  var STOP = { the: 1, a: 1, an: 1, of: 1, and: 1, for: 1, to: 1, in: 1, on: 1, at: 1, is: 1, are: 1, my: 1, i: 1, we: 1, how: 1, do: 1, can: 1, you: 1, your: 1, with: 1, what: 1, where: 1 };

  var state = { index: null, promise: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9₦]+/g, ' ').trim();
  }
  // Light stemmer so "trainings"/"training"/"trained" meet at "train".
  function stem(w) {
    if (w.length > 5 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(es|ed)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function lev1(a, b) { // true when the words differ by at most one edit
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
  }

  function words(str) { var t = norm(str); return t ? t.split(' ') : []; }
  function prep(e) {
    e._tw = words(e.t);
    e._hw = words(e.h);
    e._dw = words(e.d);
    e._kw = words(e.kw + ' ' + e.k + ' ' + e.u.replace(/[\/-]+/g, ' '));
    e._t = ' ' + e._tw.join(' ') + ' ';
    e._d = ' ' + e._dw.join(' ') + ' ';
    var bw = words(e.b), map = {};
    for (var i = 0; i < bw.length; i++) map[bw[i]] = (map[bw[i]] || 0) + 1;
    e._b = ' ' + bw.join(' ') + ' ';
    e._bm = map;
    e._bk = Object.keys(map);
    e._fz = e._tw.concat(e._hw).filter(function (w) { return w.length > 4; });
    return e;
  }

  function load() {
    if (state.index) return Promise.resolve(state.index);
    if (!state.promise) {
      state.promise = fetch(INDEX_URL).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (data) {
        state.index = data.map(prep);
        return state.index;
      }).catch(function (err) {
        state.promise = null;
        console.error('Site search index failed to load', err);
        return [];
      });
    }
    return state.promise;
  }

  // How well does word list `ws` contain query word q? 2 = whole word (or same stem),
  // 1 = starts with q, 0 = no. A short q may only prefix-match a short word, so "excel"
  // does not match "excellence" but "train" still matches "training".
  function wmatch(ws, q, noPrefix) {
    var best = 0, sq = stem(q);
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (w === q || stem(w) === sq) return 2;
      if (!best && !noPrefix && w.indexOf(q) === 0 && (q.length >= 6 || w.length <= q.length + 4)) best = 1;
    }
    return best;
  }
  function bodyHits(e, q) {
    var sq = stem(q), exact = (e._bm[q] || 0) + (sq !== q ? (e._bm[sq] || 0) : 0), pre = 0;
    for (var i = 0; i < e._bk.length; i++) {
      var w = e._bk[i];
      if (w !== q && w !== sq && w.indexOf(q) === 0 && (q.length >= 6 || w.length <= q.length + 4)) pre += e._bm[w];
    }
    return { exact: exact, pre: pre };
  }

  // Score one query term (plus related words) against one entry. 0 = no match.
  function termScore(e, term) {
    var variants = [{ q: term, w: 1, direct: true }];
    var st = stem(term);
    if (st !== term && st.length > 2) variants.push({ q: st, w: 0.9, direct: true });
    (SYNONYMS[term] || SYNONYMS[st] || []).forEach(function (x) { variants.push({ q: x, w: 0.4, direct: false }); });

    var best = 0;
    variants.forEach(function (v) {
      var q = v.q, s = 0, m;
      var np = !v.direct; // related words must match whole words, never prefixes
      m = wmatch(e._tw, q, np); s += m === 2 ? 20 : m === 1 ? 9 : 0;
      m = wmatch(e._hw, q, np); s += m === 2 ? 14 : m === 1 ? 6 : 0;
      m = wmatch(e._kw, q, np); s += m === 2 ? 14 : m === 1 ? 6 : 0;
      m = wmatch(e._dw, q, np); s += m === 2 ? 5 : m === 1 ? 2.5 : 0;
      if (v.direct) {
        var h = bodyHits(e, q);
        if (h.exact) s += 1.5 + Math.min(h.exact, 6) * 0.4;
        else if (h.pre) s += 0.8 + Math.min(h.pre, 6) * 0.2;
        if (!s && q.length >= 5) { // forgive a one-letter typo in titles and headings
          for (var i = 0; i < e._fz.length; i++) { if (lev1(q, e._fz[i])) { s += 6; break; } }
        }
      }
      best = Math.max(best, s * v.w);
    });
    return best;
  }

  var TYPE_BOOST = { Service: 3, Event: 2.5, Careers: 2.5, Job: 1.5, Resource: 1.5, Brand: 1.5, Partnership: 1, Page: 1, Article: 0 };

  function search(query) {
    var terms = norm(query).split(' ').filter(function (t) { return t && !STOP[t]; });
    if (!terms.length) terms = norm(query).split(' ').filter(Boolean);
    if (!terms.length || !state.index) return { terms: [], results: [] };

    var phraseStr = terms.join(' ');
    var full = [], partial = [];
    state.index.forEach(function (e) {
      var sum = 0, hits = 0;
      terms.forEach(function (t) { var s = termScore(e, t); if (s > 0) { sum += s; hits++; } });
      if (!hits) return;
      var phrase = terms.length > 1 && (e._t.indexOf(' ' + phraseStr + ' ') !== -1 || e._d.indexOf(' ' + phraseStr + ' ') !== -1 || e._b.indexOf(' ' + phraseStr + ' ') !== -1);
      var total = sum + (phrase ? 10 : 0) + (TYPE_BOOST[e.k] || 0);
      (hits === terms.length ? full : partial).push({ e: e, s: total });
    });
    function byScore(a, b) { return b.s - a.s; }
    full.sort(byScore);
    partial.sort(byScore);
    // Pages that match every word come first. Near-misses (only some words) are
    // added only when there are few full matches, and always rank below them.
    partial.forEach(function (r) { r.s *= 0.5; });
    var results = full.length >= 3 ? full : full.concat(partial.slice(0, 8));
    // Drop the long tail of weak matches (a word that only appears once in a body).
    var top = results.length ? results[0].s : 0;
    // When nothing matches strongly (top < 6, e.g. a word that appears only inside an article's text),
    // keep those weaker matches instead of showing "no results"; strong searches still drop the long tail.
    var floor = top < 6 ? 1.5 : Math.max(3, top * 0.15);
    results = results.filter(function (r) { return r.s >= floor; }).slice(0, 40);
    return { terms: terms, results: results, exact: full.length };
  }

  function snippet(e, terms) {
    // Prefer the page description when it already mentions the search; otherwise
    // show the passage of the page text around the first match.
    var variants = [];
    terms.forEach(function (t) { variants.push(t); var st = stem(t); if (st !== t && st.length > 2) variants.push(st); });
    function find(hay) {
      var low = hay.toLowerCase();
      for (var i = 0; i < variants.length; i++) { var k = low.indexOf(variants[i]); if (k !== -1) return k; }
      return -1;
    }
    var desc = e.d || '', body = e.b || '', text;
    if (desc && find(desc) !== -1) {
      text = desc.length > 180 ? desc.slice(0, 177) + '…' : desc;
    } else {
      var idx = body ? find(body) : -1;
      if (idx === -1) {
        text = desc || body.slice(0, 160);
        if (text.length > 180) text = text.slice(0, 177) + '…';
      } else {
        var start = Math.max(0, idx - 55), end = Math.min(body.length, idx + 115);
        text = (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
      }
    }
    return highlight(text, terms);
  }
  function highlight(text, terms) {
    var out = esc(text);
    var words = [];
    terms.forEach(function (t) { words.push(escRe(esc(t))); var s = stem(t); if (s !== t && s.length > 2) words.push(escRe(esc(s))); });
    if (!words.length) return out;
    return out.replace(new RegExp('(' + words.join('|') + ')', 'ig'), '<mark>$1</mark>');
  }

  var searchEventTimer = null, lastTracked = '';
  function track(q) {
    clearTimeout(searchEventTimer);
    q = (q || '').trim().toLowerCase();
    if (q.length < 3 || q === lastTracked) return;
    searchEventTimer = setTimeout(function () {
      lastTracked = q;
      if (typeof window.gtag === 'function') window.gtag('event', 'search', { search_term: q });
    }, 1200);
  }

  function meta(e) { return TYPE_META[e.k] || TYPE_META.Page; }

  function unavailableHtml() {
    return '<div class="ss-empty"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i>' +
      '<p><strong>Search is not available right now.</strong></p>' +
      '<p>Please try again in a moment, or <a href="/#services">browse our services</a>, ' +
      '<a href="/articles/">read our articles</a> or <a href="' + WA_URL + '" target="_blank" rel="noopener">ask us on WhatsApp</a>.</p></div>';
  }

  function noResultsHtml(q) {
    return '<div class="ss-empty"><i class="fas fa-circle-question" aria-hidden="true"></i>' +
      '<p><strong>No results for “' + esc(q) + '”.</strong></p>' +
      '<p>Try a simpler word, or <a href="/#services">browse our services</a>, ' +
      '<a href="/articles/">read our articles</a> or <a href="/apply/">see open roles</a>. ' +
      'You can also <a href="' + WA_URL + '" target="_blank" rel="noopener">ask us on WhatsApp</a>.</p></div>';
  }

  /* ---------------- Homepage dropdown ---------------- */
  function initBox(form) {
    var input = form.querySelector('input[name="q"]');
    var panel = form.querySelector('.site-search-panel');
    if (!input || !panel) return;
    var MAX = 7;
    var active = -1, items = [];
    var shortPh = input.getAttribute('data-short-placeholder');
    var longPh = input.getAttribute('placeholder');

    function fitPlaceholder() {
      if (shortPh && longPh) input.setAttribute('placeholder', window.innerWidth <= 560 ? shortPh : longPh);
    }
    fitPlaceholder();
    window.addEventListener('resize', fitPlaceholder);

    function open() { panel.hidden = false; input.setAttribute('aria-expanded', 'true'); }
    function close() { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; input.removeAttribute('aria-activedescendant'); }
    function setActive(i) {
      if (!items.length) return;
      active = (i + items.length) % items.length;
      items.forEach(function (el, n) { el.classList.toggle('is-active', n === active); el.setAttribute('aria-selected', n === active ? 'true' : 'false'); });
      input.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    }

    function render() {
      var q = input.value.trim();
      if (!q) { panel.innerHTML = ''; close(); return; }
      if (!state.index) { panel.innerHTML = unavailableHtml(); items = []; open(); return; }
      var res = search(q);
      var list = res.results;
      if (!list.length) { panel.innerHTML = noResultsHtml(q); items = []; open(); return; }
      var shown = list.slice(0, MAX);
      var html = '<ul class="ss-list" role="presentation">' + shown.map(function (r, n) {
        var e = r.e, m = meta(e);
        return '<li role="presentation"><a role="option" id="ssOpt' + n + '" aria-selected="false" class="ss-item" href="' + esc(e.u) + '">' +
          '<span class="ss-ico"><i class="fas ' + m.icon + '" aria-hidden="true"></i></span>' +
          '<span class="ss-main"><span class="ss-title">' + highlight(e.t, res.terms) + '</span>' +
          '<span class="ss-snip">' + snippet(e, res.terms) + '</span></span>' +
          '<span class="ss-type">' + esc(m.label) + '</span></a></li>';
      }).join('') + '</ul>';
      html += '<a class="ss-all" href="/search/?q=' + encodeURIComponent(q) + '">See all ' + list.length + ' result' + (list.length === 1 ? '' : 's') + ' for “' + esc(q) + '” <i class="fas fa-arrow-right" aria-hidden="true"></i></a>';
      panel.innerHTML = html;
      items = [].slice.call(panel.querySelectorAll('.ss-item'));
      active = -1;
      open();
    }

    input.addEventListener('focus', function () { load().then(function () { if (input.value.trim()) render(); }); });
    input.addEventListener('input', function () {
      load().then(render);
      track(input.value);
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (panel.hidden) render(); setActive(active + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(active - 1); }
      else if (ev.key === 'Escape') { close(); }
      else if (ev.key === 'Enter' && active > -1 && items[active]) { ev.preventDefault(); window.location.href = items[active].getAttribute('href'); }
    });
    form.addEventListener('submit', function (ev) {
      if (!input.value.trim()) { ev.preventDefault(); input.focus(); }
    });
    document.addEventListener('click', function (ev) { if (!form.contains(ev.target)) close(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var t = ev.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      ev.preventDefault();
      input.focus();
    });
  }

  /* ---------------- /search/ results page ---------------- */
  function initPage(root) {
    var form = root.querySelector('form');
    var input = root.querySelector('input[name="q"]');
    var pills = root.querySelector('.ss-filters');
    var out = root.querySelector('.ss-page-results');
    var count_ = root.querySelector('.ss-page-count');
    var filter = 'All', last = null;

    function paint() {
      if (!last) return;
      var q = input.value.trim();
      var list = last.results.filter(function (r) { return filter === 'All' || meta(r.e).plural === filter; });
      var typesPresent = {};
      last.results.forEach(function (r) { typesPresent[meta(r.e).plural] = (typesPresent[meta(r.e).plural] || 0) + 1; });
      pills.innerHTML = ['All'].concat(FILTERS.filter(function (f) { return typesPresent[f]; })).map(function (f) {
        var n = f === 'All' ? last.results.length : typesPresent[f];
        return '<button type="button" class="filter-pill' + (f === filter ? ' active' : '') + '" data-f="' + f + '">' + f + ' (' + n + ')</button>';
      }).join('');
      count_.textContent = list.length + (list.length === 1 ? ' result' : ' results') + ' for “' + q + '”';
      out.innerHTML = list.map(function (r) {
        var e = r.e, m = meta(e);
        return '<a class="ss-card" href="' + esc(e.u) + '">' +
          '<span class="ss-ico"><i class="fas ' + m.icon + '" aria-hidden="true"></i></span>' +
          '<span class="ss-main"><span class="ss-type-line">' + esc(m.label) + '</span>' +
          '<span class="ss-title">' + highlight(e.t, last.terms) + '</span>' +
          '<span class="ss-snip">' + snippet(e, last.terms) + '</span>' +
          '<span class="ss-url">tolnigeria.com' + esc(e.u) + '</span></span></a>';
      }).join('');
    }

    function run() {
      var q = input.value.trim();
      var url = q ? '/search/?q=' + encodeURIComponent(q) : '/search/';
      try { history.replaceState(null, '', url); } catch (e) { /* ignore */ }
      if (!q) { pills.innerHTML = ''; out.innerHTML = ''; count_.textContent = 'Type something to search the whole website.'; last = null; return; }
      filter = 'All';
      load().then(function () {
        if (!state.index) { pills.innerHTML = ''; out.innerHTML = unavailableHtml(); count_.textContent = ''; return; }
        last = search(q);
        if (!last.results.length) { pills.innerHTML = ''; out.innerHTML = noResultsHtml(q); count_.textContent = ''; return; }
        paint();
      });
      track(q);
    }

    pills.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-f]');
      if (!b) return;
      filter = b.getAttribute('data-f');
      paint();
    });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); run(); });
    input.addEventListener('input', run);

    var q0 = new URLSearchParams(window.location.search).get('q') || '';
    input.value = q0;
    run();
    if (!q0) input.focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.querySelector('form.site-search[data-mode="dropdown"]');
    if (box) initBox(box);
    var page = document.getElementById('siteSearchPage');
    if (page) initPage(page);
  });

  window.SiteSearch = { load: load, search: search, _state: state };
})();
