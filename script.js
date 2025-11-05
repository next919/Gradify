document.addEventListener('DOMContentLoaded',()=>{
  const y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();
  const f=document.getElementById('contactForm'); if(!f) return;
  const m=document.getElementById('msg'); const btn=document.getElementById('sendBtn');
  f.addEventListener('submit', (e)=>{
    e.preventDefault(); m.textContent='تم فتح برنامج البريد لإرسال رسالتك.';
    const data=new FormData(f);
    const subject=encodeURIComponent('رسالة من Gradify — '+(data.get('name')||''));
    const body=encodeURIComponent('الاسم: '+(data.get('name')||'')+'\nالبريد: '+(data.get('email')||'')+'\n\n'+(data.get('message')||''));
    window.location.href=`mailto:support@gradifysa.com?subject=${subject}&body=${body}`;
  });
});