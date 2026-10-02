/* =========================================================
   Traction Outsourcing Limited — shared helpers for job application forms.
   Load this BEFORE the page's own apply script.

   1. Digits-only inputs: any <input data-digits-only="11"> only accepts
      digits (letters, spaces and signs are stripped as you type or paste),
      stops at the given length, and updates a "0/11" counter in the element
      marked data-counter-for="<input name>".
   2. window.applyFields.isPdf(file): resolves true only for a real PDF —
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

    window.applyFields = { isPdf: isPdf };
    document.addEventListener('DOMContentLoaded', initDigitInputs);
})();
