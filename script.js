// سنة تلقائية في الفوتر + تنقل وتفعيل الروابط + كشف العناصر أثناء التمرير + تبديل الثيم
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const nav = document.getElementById('site-nav');
  const toggle = document.querySelector('.nav-toggle');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false');
    }));
  }

  // تفعيل رابط القسم الحالي
  const links = document.querySelectorAll('#site-nav a');
  const sections = [...links].map(a => document.querySelector(a.getAttribute('href')));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.id;
      const link = document.querySelector(`#site-nav a[href="#${id}"]`);
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        if (link) link.classList.add('active');
      }
    });
  }, {rootMargin: '-60% 0px -35% 0px', threshold: 0});
  sections.filter(Boolean).forEach(sec => obs.observe(sec));

  // إظهار العناصر تدريجياً
  const revealEls = document.querySelectorAll('.reveal');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add('visible'); revealObs.unobserve(e.target); } });
  }, {threshold: 0.15});
  revealEls.forEach(el => revealObs.observe(el));

  // تبديل الثيم (داكن/فاتح)
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      themeBtn.setAttribute('aria-pressed', String(next === 'dark'));
    });
  }
});
