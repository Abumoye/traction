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
   3. window.applyFields.isPdf(file): resolves true only for a real PDF —
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
    document.addEventListener('DOMContentLoaded', function () { initDigitInputs(); initWordLimits(); });
})();
