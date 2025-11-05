document.addEventListener('DOMContentLoaded', () => {
  const y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();

  // ---------- Quran (demo) ----------
  const reciters = [
    { id:'abdelbasset', name:'الشيخ عبدالباسط (مجود)', base:'https://download.quranicaudio.com/quran/abdul_basit/mujawwad/', count:114 },
    { id:'alafasy', name:'الشيخ مشاري العفاسي', base:'https://server12.mp3quran.net/afs/', count:114 }
  ];
  const reciterSelect = document.getElementById('reciterSelect');
  const surahSearch   = document.getElementById('surahSearch');
  const surahList     = document.getElementById('surahList');
  const surahNames = ['الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج','نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس','التكوير','الإنفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص','الفلق','الناس'];
  function two(n){return String(n).padStart(3,'0');}
  function buildReciters(){ reciters.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.name;reciterSelect.appendChild(o)});reciterSelect.value=reciters[0].id;renderSurahs();}
  function currentReciter(){ return reciters.find(r=>r.id===reciterSelect.value)||reciters[0]; }
  function renderSurahs(){ surahList.innerHTML=''; const r=currentReciter(); const term=(surahSearch.value||'').trim(); surahNames.forEach((name,i)=>{ const num=i+1; if(term && !(name.includes(term)||String(num).includes(term))) return; const url=r.base+two(num)+'.mp3'; const d=document.createElement('div'); d.className='surah'; d.innerHTML=`<div class="num">${String(num).padStart(2,'0')}</div><div class="meta"><strong>${name}</strong><br><small>${r.name}</small></div><audio class="play" controls preload="none" src="${url}"></audio>`; surahList.appendChild(d); }); }
  reciterSelect?.addEventListener('change',renderSurahs);
  surahSearch?.addEventListener('input',renderSurahs);
  buildReciters();

  // ---------- AI Tools ----------
  const aiTools=[
    {title:'ChatGPT',url:'https://chat.openai.com',desc:'مساعد ذكي للمحادثة والبرمجة.'},
    {title:'Claude',url:'https://claude.ai',desc:'محادث آمن بفهم عميق.'},
    {title:'Perplexity',url:'https://www.perplexity.ai',desc:'بحث ذكي مع مصادر.'},
    {title:'Midjourney',url:'https://www.midjourney.com',desc:'توليد صور بالنص.'},
    {title:'Leonardo',url:'https://leonardo.ai',desc:'مولد صور احترافي.'},
    {title:'Runway',url:'https://runwayml.com',desc:'فيديو وذكاء اصطناعي.'},
    {title:'Codeium',url:'https://codeium.com',desc:'مكمل كود مجاني.'},
    {title:'GitHub Copilot',url:'https://github.com/features/copilot',desc:'مساعد برمجة داخل VS Code.'},
    {title:'Notion AI',url:'https://www.notion.so/product/ai',desc:'مساعدة وتلخيص داخل Notion.'},
    {title:'Tome',url:'https://tome.app',desc:'عروض تقديمية تلقائية.'},
    {title:'ElevenLabs',url:'https://elevenlabs.io',desc:'نص إلى صوت واقعي.'},
    {title:'Descript',url:'https://www.descript.com',desc:'تحرير صوت/فيديو.'}
  ];
  const useful=[
    {title:'Archive.org',url:'https://archive.org',desc:'أرشيف الكتب والملفات.'},
    {title:'Libgen',url:'https://libgen.li',desc:'محرك بحث للكتب.'},
    {title:'Unsplash',url:'https://unsplash.com',desc:'صور مجانية عالية الجودة.'},
    {title:'TinyPNG',url:'https://tinypng.com',desc:'ضغط الصور بجودة ممتازة.'},
    {title:'Remove.bg',url:'https://remove.bg',desc:'إزالة الخلفية آليًا.'},
    {title:'Canva',url:'https://www.canva.com',desc:'تصميم سريع.'}
  ];
  const tuts=[
    {title:'رفع موقعك على GitHub Pages',url:'https://pages.github.com',desc:'خطوات بسيطة لنشر HTML.'},
    {title:'أساسيات Tailwind CSS',url:'https://tailwindcss.com/docs',desc:'مرجع للأدوات.'},
    {title:'تعلم Git بسرعة',url:'https://learngitbranching.js.org',desc:'تدريب تفاعلي.'}
  ];
  const eng={
    listen:[
      {title:'BBC Learning English',url:'https://www.bbc.co.uk/learningenglish',desc:'مقاطع يومية وتمارين.'},
      {title:'VOA Learning English',url:'https://learningenglish.voanews.com',desc:'أخبار مبسطة.'},
      {title:'ELLLO',url:'https://elllo.org',desc:'مكتبة للاستماع.'}
    ],
    speak:[
      {title:'TalkEnglish',url:'https://www.talkenglish.com',desc:'حوارات ونطق.'},
      {title:'YouGlish',url:'https://youglish.com',desc:'نطق من اليوتيوب.'},
      {title:'Elsa Speak (مدفوع)',url:'https://elsaspeak.com',desc:'تدريب نطق بالذكاء الاصطناعي.'}
    ],
    pod:[
      {title:'The English We Speak',url:'https://www.bbc.co.uk/programmes/p02pc9zn/episodes/downloads',desc:'تعبيرات شائعة.'},
      {title:'6 Minute English',url:'https://www.bbc.co.uk/programmes/p02pc9ny/episodes/downloads',desc:'بودكاست قصير.'},
      {title:'All Ears English',url:'https://www.allearsenglish.com',desc:'محادثات عملية.'}
    ],
    all:[
      {title:'Duolingo',url:'https://www.duolingo.com',desc:'تعلم مجاني تدريجي.'},
      {title:'Lingoda (مدفوع)',url:'https://www.lingoda.com',desc:'حصص مباشرة.'},
      {title:'Coursera English',url:'https://www.coursera.org',desc:'كورسات وشهادات.'}
    ],
    paid:[
      {title:'Udemy English',url:'https://www.udemy.com/courses/language/english',desc:'دورات رخيصة في العروض.'},
      {title:'Cambly',url:'https://www.cambly.com',desc:'محادثة مع متحدثين أصليين.'},
      {title:'italki',url:'https://www.italki.com',desc:'دروس واحد-لواحد.'}
    ]
  };
  function cardHTML(i){return `<article class="card"><h3>${i.title}</h3><p>${i.desc||''}</p><a class="btn small" href="${i.url}" target="_blank" rel="noopener">زيارة</a></article>`;}
  function fillGrid(id,list){const el=document.getElementById(id); if(!el) return; el.innerHTML=list.map(cardHTML).join('');}
  fillGrid('aiGrid',aiTools); fillGrid('usefulGrid',useful); fillGrid('tutorialsGrid',tuts);
  fillGrid('engListen',eng.listen); fillGrid('engSpeak',eng.speak); fillGrid('engPod',eng.pod); fillGrid('engAll',eng.all); fillGrid('engPaid',eng.paid);

  // ---------- Contact form via Formspree (myzbrgpb) ----------
  const tsInput=document.getElementById('loaded_at'); if(tsInput) tsInput.value=String(Date.now());
  const form=document.getElementById('contactForm'), submitBtn=document.getElementById('submitBtn'), messageStatus=document.getElementById('messageStatus'), agree=document.getElementById('agree');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!agree.checked){messageStatus.textContent='يرجى الموافقة على إرسال البيانات.';return;}
    if(!form.checkValidity()){messageStatus.textContent='تحقق من الحقول المطلوبة.';return;}
    const honey=document.getElementById('hp'); const loaded=parseInt((tsInput&&tsInput.value)||'0',10);
    if(honey&&honey.value.trim()!==''){messageStatus.textContent='تم رفض الإرسال.';return;}
    if(Date.now()-loaded<3000){messageStatus.textContent='يرجى الانتظار لحظة ثم حاول مرة أخرى.';return;}
    submitBtn.disabled=true; const original=submitBtn.textContent; submitBtn.textContent='جاري الإرسال...';
    try{ const res=await fetch('https://formspree.io/f/myzbrgpb',{method:'POST',headers:{'Accept':'application/json'},body:new FormData(form)});
      if(res.ok){ messageStatus.textContent='✅ تم إرسال رسالتك بنجاح!'; form.reset(); if(tsInput) tsInput.value=String(Date.now()); }
      else{ messageStatus.textContent='⚠️ تعذّر الإرسال. حاول لاحقًا.'; }
    }catch(_){ messageStatus.textContent='❌ خطأ في الشبكة.'; }
    finally{ submitBtn.disabled=false; submitBtn.textContent=original; }
  });

  document.querySelectorAll('[data-open]').forEach(a=>a.addEventListener('click',()=>{const sel=a.getAttribute('data-open'); const d=sel&&document.querySelector(sel); if(d){d.open=true; setTimeout(()=>d.scrollIntoView({behavior:'smooth',block:'start'}),40);}}));
});