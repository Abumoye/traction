/* Subtle scroll-reveal for sections marked .reveal — Apple-style fade/rise,
   not scroll-jacking. No-ops instantly for prefers-reduced-motion via CSS. */
document.addEventListener('DOMContentLoaded', function () {
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || !items.length) {
    items.forEach(function (el) { el.classList.add('in-view'); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  items.forEach(function (el, i) {
    el.style.transitionDelay = (Math.min(i % 3, 2) * 0.08) + 's';
    observer.observe(el);
  });
});
