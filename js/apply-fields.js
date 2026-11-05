/* =========================================================
   Traction Outsourcing Limited — shared helpers for job application forms.
   Load this BEFORE the page's own apply script.

   1. Digits-only inputs: any <input data-digits-only="11"> only accepts
      digits (letters, spaces and signs are stripped as you type or paste),
      stops at the given length, and updates a "0/11" counter in the element
      marked data-counter-for="<input name>".
   2. Word-limited text boxes: any <textarea data-max-words="150"> accepts
      letters, numbers, signs and spaces, but stops at the given number of
      words (extra words are cut off as you type or paste) and updates the
      "0/150 words" counter in the element marked data-words-for="<name>".
   3. "Other" boxes: a <select> followed by <input data-other-for="<select name>">
      shows that text box (and makes it required) only while the select is on
      its "Other" option, and hides and clears it again otherwise.
   4. Searchable dropdowns: a <select data-searchable="placeholder text"> is
      turned into a type-to-search box with a filtered list (the real select
      stays in the page, hidden, and always holds the chosen value, so forms,
      validation and "Other" boxes work unchanged). Without JavaScript the
      plain select still works. An option named "Other" is always kept at the
      bottom of the list.
   5. window.applyFields.isPdf(file): resolves true only for a real PDF —
      checks the file name, the browser-reported type AND the file's first
      bytes (%PDF-), so a renamed picture or Word file is rejected.
   ========================================================= */
(function () {
    function initDigitInputs() {
        document.querySelectorAll('[data-digits-only]').forEach(function (input) {
            var max = parseInt(input.getAttribute('data-digits-only'), 10) || 11;
            var counter = document.querySelector('[data-counter-for="' + input.name + '"]');

            function update() {
                var digits = input.value.replace(/\D/g, '');
                // A pasted international number (e.g. +234 805 203 3145) becomes 0805 203 3145.
                if (digits.length === 13 && digits.indexOf('234') === 0) digits = '0' + digits.slice(3);
                digits = digits.slice(0, max);
                if (input.value !== digits) input.value = digits;
                if (counter) {
                    counter.textContent = digits.length + '/' + max;
                    counter.classList.toggle('complete', digits.length === max);
                }
            }

            input.addEventListener('input', update);
            input.addEventListener('keypress', function (e) {
                if (e.key && e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault();
            });
            if (input.form) input.form.addEventListener('reset', function () { setTimeout(update, 0); });
            update();
        });
    }

    function countWords(text) {
        var m = String(text || '').match(/\S+/g);
        return m ? m.length : 0;
    }

    // Cuts text off right after its max-th word, keeping everything before it.
    function limitWords(text, max) {
        var re = /\S+/g, m, count = 0, end = text.length;
        while ((m = re.exec(text)) !== null) {
            count++;
            if (count === max) { end = m.index + m[0].length; break; }
        }
        return count >= max ? text.slice(0, end) : text;
    }

    function initWordLimits() {
        document.querySelectorAll('[data-max-words]').forEach(function (box) {
            var max = parseInt(box.getAttribute('data-max-words'), 10) || 150;
            var counter = document.querySelector('[data-words-for="' + box.name + '"]');

            function update() {
                var words = countWords(box.value);
                if (words > max) {
                    box.value = limitWords(box.value, max);
                    words = max;
                }
                if (counter) {
                    counter.textContent = words + '/' + max + ' words';
                    counter.classList.toggle('complete', words === max);
                }
            }

            box.addEventListener('input', update);
            if (box.form) box.form.addEventListener('reset', function () { setTimeout(update, 0); });
            update();
        });
    }

    function initOtherInputs() {
        document.querySelectorAll('input[data-other-for]').forEach(function (box) {
            var select = box.form && box.form.elements[box.getAttribute('data-other-for')];
            if (!select) return;
            var trigger = box.getAttribute('data-other-value') || 'Other';

            function update() {
                var on = select.value === trigger;
                box.hidden = !on;
                box.required = on;
                if (!on) box.value = '';
            }

            select.addEventListener('change', update);
            box.form.addEventListener('reset', function () { setTimeout(update, 0); });
            update();
        });
    }

    function initSearchableSelects() {
        var uid = 0;
        function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

        document.querySelectorAll('select[data-searchable]').forEach(function (select) {
            var form = select.form;
            var id = 'ss' + (++uid);
            var trigger = 'Other';
            var items = Array.prototype.slice.call(select.options)
                .filter(function (o) { return o.value; })
                .map(function (o) { return { value: o.value, key: norm(o.value) }; });

            var wrap = document.createElement('div');
            wrap.className = 'search-select';
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'search-select-input';
            input.autocomplete = 'off';
            input.spellcheck = false;
            input.placeholder = select.getAttribute('data-searchable') || select.getAttribute('data-placeholder') || 'Search';
            input.setAttribute('aria-label', input.placeholder);
            input.setAttribute('role', 'combobox');
            input.setAttribute('aria-autocomplete', 'list');
            input.setAttribute('aria-expanded', 'false');
            input.setAttribute('aria-controls', id + '-list');
            var list = document.createElement('ul');
            list.className = 'search-select-list';
            list.id = id + '-list';
            list.setAttribute('role', 'listbox');
            list.hidden = true;

            select.parentNode.insertBefore(wrap, select);
            wrap.appendChild(input);
            wrap.appendChild(select);
            wrap.appendChild(list);
            select.classList.add('search-select-native');
            select.tabIndex = -1;
            select.setAttribute('aria-hidden', 'true');

            var shown = [];
            var active = -1;
            var openState = false;
            var fromInvalid = false;

            function setActive(i) {
                var opts = list.querySelectorAll('[role=option]');
                if (active >= 0 && opts[active]) opts[active].classList.remove('is-active');
                active = i;
                if (active >= 0 && opts[active]) {
                    opts[active].classList.add('is-active');
                    input.setAttribute('aria-activedescendant', opts[active].id);
                    var el = opts[active];
                    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
                    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
                } else {
                    input.removeAttribute('aria-activedescendant');
                }
            }

            function render(query) {
                var words = norm(query).split(' ').filter(Boolean);
                shown = items.filter(function (it) {
                    if (it.value === trigger) return false;
                    return words.every(function (w) { return it.key.indexOf(w) !== -1; });
                });
                // Best matches first: names that start with what was typed, then names that
                // contain it as one phrase, then names that just contain all the words.
                var phrase = words.join(' ');
                if (phrase) {
                    var rank = function (it) { return it.key.indexOf(phrase) === 0 ? 0 : (it.key.indexOf(phrase) !== -1 ? 1 : 2); };
                    shown = shown.map(function (it, i) { return { it: it, r: rank(it), i: i }; })
                        .sort(function (a, b) { return a.r - b.r || a.i - b.i; })
                        .map(function (x) { return x.it; });
                }
                var hasOther = items.some(function (it) { return it.value === trigger; });
                list.innerHTML = '';
                shown.forEach(function (it, i) { add(it.value, i); });
                if (!shown.length && words.length) {
                    var none = document.createElement('li');
                    none.className = 'search-select-empty';
                    none.textContent = 'No match found. Choose "' + trigger + '" below to type yours.';
                    list.appendChild(none);
                }
                if (hasOther) { shown.push({ value: trigger }); add(trigger, shown.length - 1); }
                var sel = shown.findIndex(function (it) { return it.value === select.value; });
                setActive(sel >= 0 ? sel : (words.length && shown.length ? 0 : -1));
                if (sel >= 0) list.scrollTop = list.querySelectorAll('[role=option]')[sel].offsetTop;
                else list.scrollTop = 0;
            }

            function add(value, i) {
                var li = document.createElement('li');
                li.id = id + '-o' + i;
                li.setAttribute('role', 'option');
                li.textContent = value;
                if (value === select.value) li.setAttribute('aria-selected', 'true');
                li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(value); });
                list.appendChild(li);
            }

            function open() {
                if (openState) return;
                openState = true;
                list.hidden = false;
                input.setAttribute('aria-expanded', 'true');
            }

            function close() {
                openState = false;
                list.hidden = true;
                input.setAttribute('aria-expanded', 'false');
                input.removeAttribute('aria-activedescendant');
                input.value = select.value || '';
            }

            function choose(value) {
                select.value = value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                close();
                if (value === trigger && form) {
                    var other = form.querySelector('input[data-other-for="' + select.name + '"]');
                    if (other && !other.hidden) other.focus();
                }
            }

            input.addEventListener('focus', function () {
                if (fromInvalid) { fromInvalid = false; return; }
                input.select();
                render('');
                open();
            });
            input.addEventListener('click', function () {
                if (!openState) { render(''); open(); }
            });
            input.addEventListener('input', function () {
                render(input.value);
                open();
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (!openState) { render(input.value === select.value ? '' : input.value); open(); return; }
                    var n = shown.length;
                    if (!n) return;
                    setActive(e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1));
                } else if (e.key === 'Enter') {
                    if (openState) {
                        e.preventDefault();
                        if (active >= 0 && shown[active]) choose(shown[active].value);
                    }
                } else if (e.key === 'Escape') {
                    if (openState) { e.preventDefault(); close(); }
                }
            });
            input.addEventListener('blur', function () {
                if (!openState) return;
                // Tab away after typing an exact name: take it.
                var typed = norm(input.value);
                var exact = items.find(function (it) { return it.key === typed; });
                if (exact && exact.value !== select.value) {
                    select.value = exact.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
                close();
            });
            select.addEventListener('invalid', function () {
                fromInvalid = true;
                wrap.classList.add('is-invalid');
                input.focus();
                setTimeout(function () { fromInvalid = false; }, 0);
            });
            select.addEventListener('change', function () {
                wrap.classList.remove('is-invalid');
                if (!openState) input.value = select.value || '';
            });
            if (form) form.addEventListener('reset', function () {
                setTimeout(function () { input.value = select.value || ''; close(); }, 0);
            });
            input.value = select.value || '';
        });
    }

    function isPdf(file) {
        if (!file) return Promise.resolve(false);
        var nameOk = /\.pdf$/i.test(file.name);
        var typeOk = !file.type || file.type === 'application/pdf';
        if (!nameOk || !typeOk) return Promise.resolve(false);
        return file.slice(0, 1024).arrayBuffer().then(function (buf) {
            var head = new Uint8Array(buf);
            var text = '';
            for (var i = 0; i < head.length; i++) text += String.fromCharCode(head[i]);
            return text.indexOf('%PDF-') !== -1;
        }).catch(function () { return false; });
    }

    window.applyFields = { isPdf: isPdf, countWords: countWords };
    document.addEventListener('DOMContentLoaded', function () { initDigitInputs(); initWordLimits(); initOtherInputs(); initSearchableSelects(); });
})();
