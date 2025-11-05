document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.section-acc').forEach(d => d.removeAttribute('open'));
  const toggle=document.querySelector('.nav-toggle'); const nav=document.getElementById('mainNav');
  if(toggle&&nav){ toggle.addEventListener('click',()=>{ const open=nav.classList.toggle('open'); toggle.setAttribute('aria-expanded',String(open)); });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{ nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); })); }
  document.addEventListener('click',(e)=>{ const a=e.target.closest('a'); if(!a) return;
    const isBrand=a.classList.contains('brand-link')||a.closest('.brand-link');
    const href=(a.getAttribute('href')||'').replace(location.origin,'');
    const isHome=['#top','#home','/','/#top',location.pathname+'#top'].includes(href);
    if(isBrand||isHome){ e.preventDefault(); document.querySelectorAll('.section-acc').forEach(d=>d.removeAttribute('open')); window.scrollTo({top:0,behavior:'smooth'}); }
  });
  const y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();
  const ai = [
    {name:'ChatGPT', desc:'محادثة وتوليد نصوص.', url:'https://chat.openai.com'},
    {name:'Gemini', desc:'مساعد جوجل متعدد الوسائط.', url:'https://gemini.google.com'},
    {name:'Claude', desc:'مساعد كتابي ذكي.', url:'https://claude.ai'},
  ];
  const useful = [
    {name:'Archive.org', desc:'أرشيف الكتب والملفات.', url:'https://archive.org'},
    {name:'Remove.bg', desc:'إزالة خلفية الصور.', url:'https://remove.bg'},
  ];
  const eng = {
    listen:[{name:'BBC Learning English', desc:'محتوى صوتي ومرئي.', url:'https://www.bbc.co.uk/learningenglish'}],
    speak:[{name:'Elsa Speak', desc:'تدريب نطق (مدفوع/مجاني).', url:'https://elsaspeak.com'}],
    pod:[{name:'ESLPod', desc:'بودكاست انجليزي مبسّط.', url:'https://www.eslpod.com'}],
    all:[{name:'Duolingo', desc:'تعلّم تفاعلي ممتع.', url:'https://www.duolingo.com'}],
    paid:[{name:'Coursera', desc:'دورات احترافية.', url:'https://www.coursera.org'}]
  };
  function fillCards(id,items){ const el=document.getElementById(id); if(!el) return;
    el.innerHTML=items.map(i=>`<article class="card"><h3>${i.name}</h3><p>${i.desc}</p><a class="btn small" href="${i.url}" target="_blank" rel="noopener">زيارة</a></article>`).join(''); }
  fillCards('aiGrid', ai); fillCards('usefulGrid', useful);
  fillCards('engListen', eng.listen); fillCards('engSpeak', eng.speak); fillCards('engPod', eng.pod); fillCards('engAll', eng.all); fillCards('engPaid', eng.paid);
  const form=document.getElementById('contactForm'); const msg=document.getElementById('formMsg'); const agree=document.getElementById('agree'); const mailto=document.getElementById('mailtoFallback');
  function fillMailtoHref(){ const data=new FormData(form);
    const subject=encodeURIComponent(data.get('subject')||'تواصل جديد');
    const body=encodeURIComponent('الاسم: '+(data.get('name')||'')+'\\nالبريد: '+(data.get('email')||'')+'\\n\\n'+(data.get('message')||''));
    mailto.href=`mailto:support@gradifysa.com?subject=${subject}&body=${body}`; }
  if(mailto){ mailto.addEventListener('mouseenter', fillMailtoHref); mailto.addEventListener('focus', fillMailtoHref); }
  if(form){ form.addEventListener('submit',(e)=>{ e.preventDefault(); msg.textContent=''; if(!agree.checked){ msg.textContent='من فضلك وافق على إرسال البيانات أولاً.'; return; }
    if(!form.checkValidity()){ msg.textContent='تحقق من الحقول المطلوبة.'; return; } fillMailtoHref(); window.location.href = mailto.href; msg.textContent='تم فتح برنامج البريد لإرسال رسالتك.'; }); }
});