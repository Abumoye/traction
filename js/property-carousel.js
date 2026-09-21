/* =========================================================
   Traction Properties — property card image carousel.
   Each [data-carousel] element (inside a .property-card) holds a
   stack of absolutely-positioned .property-carousel-slide elements.
   Prev/next arrows and dots (only rendered when a listing has more
   than one image) cycle which slide carries the .active class.
   ========================================================= */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
        var slides = carousel.querySelectorAll('.property-carousel-slide');
        var dots = carousel.querySelectorAll('.property-carousel-dot');
        if (slides.length < 2) return;

        var index = 0;

        function show(i) {
            index = (i + slides.length) % slides.length;
            slides.forEach(function (s, si) { s.classList.toggle('active', si === index); });
            dots.forEach(function (d, di) { d.classList.toggle('active', di === index); });
        }

        var prev = carousel.querySelector('.property-carousel-prev');
        var next = carousel.querySelector('.property-carousel-next');
        if (prev) prev.addEventListener('click', function (e) { e.preventDefault(); show(index - 1); });
        if (next) next.addEventListener('click', function (e) { e.preventDefault(); show(index + 1); });
        dots.forEach(function (dot, di) {
            dot.addEventListener('click', function (e) { e.preventDefault(); show(di); });
        });
    });
});
