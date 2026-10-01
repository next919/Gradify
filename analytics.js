// Google Analytics 4 for gradifysa.com (only on the live domain, never on local copies)
(function () {
  var ID = 'G-FQ9PE4464B';
  var host = location.hostname;
  if (host !== 'gradifysa.com' && host !== 'www.gradifysa.com') return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID);
})();
