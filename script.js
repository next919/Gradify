document.addEventListener('DOMContentLoaded', () => {
  const nav=document.getElementById('mainNav'); const t=document.querySelector('.nav-toggle');
  if(t&&nav){ t.addEventListener('click',()=>{nav.classList.toggle('open');}); }
  const y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();

  const form=document.getElementById('contactForm'); if(!form) return;
  const msg=document.getElementById('formMsg'); const btn=document.getElementById('sendBtn');
  const agree=document.getElementById('agree'); const mailto=document.getElementById('mailtoFallback');
  const accessKey=(document.getElementById('w3f_key')||{}).value||''; const to=(document.getElementById('w3f_to')||{}).value||'support@gradifysa.com';

  function fillMailto(){
    const data=new FormData(form);
    const subject=encodeURIComponent(data.get('subject')||'تواصل جديد');
    const body=encodeURIComponent('الاسم: '+(data.get('name')||'')+'\nالبريد: '+(data.get('email')||'')+'\n\n'+(data.get('message')||''));
    mailto.href=`mailto:${to}?subject=${subject}&body=${body}`;
  }
  if(mailto){ mailto.addEventListener('mouseenter', fillMailto); mailto.addEventListener('focus', fillMailto); }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault(); msg.textContent='';
    if(!agree.checked){ msg.textContent='من فضلك وافق على إرسال البيانات أولاً.'; return; }
    if(!form.checkValidity()){ msg.textContent='تحقق من الحقول المطلوبة.'; return; }

    btn.disabled=true; btn.textContent='جارٍ الإرسال…';
    const data=new FormData(form);
    data.append('access_key', accessKey);
    data.append('from_name', 'Gradify Contact Form');
    data.append('to', to);

    if(!accessKey || accessKey==='YOUR_WEB3FORMS_ACCESS_KEY'){
      if(mailto){ fillMailto(); window.location.href = mailto.href; msg.textContent='تم فتح برنامج البريد لإرسال رسالتك.'; }
      btn.disabled=false; btn.textContent='إرسال'; return;
    }

    try{
      const res=await fetch('https://api.web3forms.com/submit', { method:'POST', body:data });
      const j=await res.json();
      if(j.success){ msg.textContent='تم الإرسال بنجاح. شكرًا لتواصلك!'; form.reset(); }
      else{ msg.textContent='تعذر الإرسال عبر الخدمة. استخدم البريد المباشر.'; }
    }catch(err){ msg.textContent='حدث خلل في الشبكة. استخدم البريد المباشر.'; }
    finally{ btn.disabled=false; btn.textContent='إرسال'; }
  });
});