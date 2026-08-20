/* Glass nav: condenses on scroll, mobile menu toggle, dropdown handling. */
document.addEventListener('DOMContentLoaded', function () {
  var header = document.getElementById('siteHeader');
  var hamburger = document.getElementById('hamburgerBtn');
  var navLinks = document.getElementById('navLinks');

  function onScroll() {
    if (!header) return;
    if (window.scrollY > 12) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('active');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('active') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
        navLinks.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Mobile dropdown toggles (desktop uses :hover via CSS)
  document.querySelectorAll('.dropdown > button').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (window.innerWidth > 900) return; // desktop handled by hover
      e.preventDefault();
      var parent = btn.closest('.dropdown');
      var wasOpen = parent.classList.contains('open');
      document.querySelectorAll('.dropdown.open').forEach(function (d) { d.classList.remove('open'); });
      if (!wasOpen) parent.classList.add('open');
    });
  });
});
