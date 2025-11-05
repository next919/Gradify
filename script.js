document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.section-acc').forEach(d => { if(d.id !== 'sec-contact') d.removeAttribute('open'); });

  const toggle=document.querySelector('.nav-toggle'); const nav=document.getElementById('mainNav');
  if(toggle&&nav){ toggle.addEventListener('click',()=>{ const open=nav.classList.toggle('open'); toggle.setAttribute('aria-expanded',String(open)); });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{ nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); })); }

  document.addEventListener('click',(e)=>{ const a=e.target.closest('a'); if(!a) return;
    const isBrand=a.classList.contains('brand-link')||a.closest('.brand-link');
    const href=(a.getAttribute('href')||'').replace(location.origin,'');
    const isHome=['#top','#home','/','/#top',location.pathname+'#top'].includes(href);
    if(isBrand||isHome){ e.preventDefault(); document.querySelectorAll('.section-acc').forEach(d=>d.removeAttribute('open')); window.scrollTo({top:0,behavior:'smooth'}); }
  });

  document.querySelectorAll('[data-open]').forEach(a=>a.addEventListener('click',()=>{ const sel=a.getAttribute('data-open'); const d=sel&&document.querySelector(sel); if(d){ d.open=true; setTimeout(()=>d.scrollIntoView({behavior:'smooth',block:'start'}),40); } }));

  // Contact form
  (function initContact(){
    const form   = document.getElementById('contactForm');
    if(!form) return;
    const msg    = document.getElementById('formMsg');
    const button = document.getElementById('sendBtn');
    const mailto = document.getElementById('mailtoFallback');
    const agree  = document.getElementById('agree');
    const endpoint = (document.getElementById('formEndpoint')||{}).value || '';

    const getFormData = () => new FormData(form);

    function fillMailtoHref(){
      const data = getFormData();
      const subject = encodeURIComponent(data.get('subject') || 'تواصل جديد');
      const body = encodeURIComponent('الاسم: '+(data.get('name')||'')+'\nالبريد: '+(data.get('email')||'')+'\n\n'+(data.get('message')||''));
      mailto.href = `mailto:support@gradifysa.com?subject=${subject}&body=${body}`;
    }
    if (mailto) {
      mailto.addEventListener('mouseenter', fillMailtoHref);
      mailto.addEventListener('focus', fillMailtoHref);
    }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      msg.textContent = '';

      if(!agree.checked){ msg.textContent = 'من فضلك وافق على إرسال البيانات أولاً.'; return; }
      if(!form.checkValidity()){ msg.textContent = 'تحقق من الحقول المطلوبة.'; return; }

      button.disabled = true; button.textContent = 'جارٍ الإرسال…';

      const data = getFormData();

      if(!endpoint.includes('/f/') || endpoint.includes('your-id-here')){
        fillMailtoHref();
        window.location.href = mailto.href;
        msg.textContent = 'تم فتح برنامج البريد لإرسال رسالتك.';
        button.disabled = false; button.textContent = 'إرسال';
        return;
      }

      try {
        const res = await fetch(endpoint, { method:'POST', body:data, headers:{'Accept':'application/json'} });
        if(res.ok){ msg.textContent = 'تم الإرسال بنجاح. سنرد خلال 24 ساعة بإذن الله.'; form.reset(); }
        else{ msg.textContent = 'تعذر الإرسال عبر الخدمة، يمكنك استخدام البريد المباشر.'; }
      } catch (err) {
        msg.textContent = 'حدث خلل في الشبكة. استخدم البريد المباشر من فضلك.';
      } finally {
        button.disabled = false; button.textContent = 'إرسال';
      }
    });
  })();
});