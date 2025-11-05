document.addEventListener('DOMContentLoaded', () => {
  // close sections initially except contact (to show the new form)
  document.querySelectorAll('.section-acc').forEach(d => { if(d.id !== 'sec-contact') d.removeAttribute('open'); });

  // mobile nav + centered brand
  const toggle=document.querySelector('.nav-toggle'); const nav=document.getElementById('mainNav');
  if(toggle&&nav){ toggle.addEventListener('click',()=>{ const open=nav.classList.toggle('open'); toggle.setAttribute('aria-expanded',String(open)); });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{ nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); })); }

  // home -> close all
  document.addEventListener('click',(e)=>{ const a=e.target.closest('a'); if(!a) return;
    const isBrand=a.classList.contains('brand-link')||a.closest('.brand-link');
    const href=(a.getAttribute('href')||'').replace(location.origin,'');
    const isHome=['#top','#home','/','/#top',location.pathname+'#top'].includes(href);
    if(isBrand||isHome){ e.preventDefault(); document.querySelectorAll('.section-acc').forEach(d=>d.removeAttribute('open')); window.scrollTo({top:0,behavior:'smooth'}); }
  });

  // open target section smoothly
  document.querySelectorAll('[data-open]').forEach(a=>a.addEventListener('click',()=>{ const sel=a.getAttribute('data-open'); const d=sel&&document.querySelector(sel); if(d){ d.open=true; setTimeout(()=>d.scrollIntoView({behavior:'smooth',block:'start'}),40); } }));

  // year
  const y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();

  // ---- Contact form (Formspree / mailto fallback) ----
  const FORM_ENDPOINT = 'https://formspree.io/f/your-id-here'; // 👈 بدّلها بمعرفك من Formspree
  const form=document.getElementById('contactForm'); const msg=document.getElementById('formMsg'); const mailto=document.getElementById('mailtoFallback');
  if(form){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      msg.textContent='جارٍ الإرسال…';
      const data = new FormData(form);

      if(!FORM_ENDPOINT.includes('/f/') || FORM_ENDPOINT.includes('your-id-here')){
        const subject=encodeURIComponent(data.get('subject')||'تواصل جديد');
        const body=encodeURIComponent('الاسم: '+(data.get('name')||'')+'\nالبريد: '+(data.get('email')||'')+'\nالنوع: '+(data.get('type')||'')+'\nرقم الطلب: '+(data.get('order')||'')+'\n\n'+(data.get('message')||''));
        window.location.href=`mailto:support@gradifysa.com?subject=${subject}&body=${body}`;
        msg.textContent='تم فتح برنامج البريد لإرسال رسالتك.';
        return;
      }
      try{
        const res = await fetch(FORM_ENDPOINT, { method:'POST', headers:{'Accept':'application/json'}, body:data });
        if(res.ok){ msg.textContent='تم الإرسال بنجاح. سنرد خلال 24 ساعة بإذن الله.'; form.reset(); }
        else{ msg.textContent='تعذر الإرسال عبر الخدمة. جرّب زر البريد المباشر.'; }
      }catch(err){ msg.textContent='حدث خطأ في الشبكة. استخدم البريد المباشر من فضلك.'; }
    });

    if(mailto){
      mailto.addEventListener('click', ()=>{
        const data=new FormData(form);
        const subject=encodeURIComponent(data.get('subject')||'تواصل جديد');
        const body=encodeURIComponent('الاسم: '+(data.get('name')||'')+'\nالبريد: '+(data.get('email')||'')+'\nالنوع: '+(data.get('type')||'')+'\nرقم الطلب: '+(data.get('order')||'')+'\n\n'+(data.get('message')||''));
        mailto.href=`mailto:support@gradifysa.com?subject=${subject}&body=${body}`;
      });
    }
  }
});