// ===== Data =====
// Surah names
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];

// Reciters with direct bases (quranicaudio.com). بعض القراءات قد لا توفر جميع السور، وهذا طبيعي.
const RECITERS = [
  { id:"abdul_basit_mujawwad", name:"عبدالباسط (مجود)", base:"https://download.quranicaudio.com/quran/abdul_basit/mujawwad/", ext:".mp3" },
  { id:"abdul_basit_murattal", name:"عبدالباسط (مرتل)", base:"https://download.quranicaudio.com/quran/abdul_basit/murattal/", ext:".mp3" },
  { id:"husary_mujawwad", name:"الحصري (مجود)", base:"https://download.quranicaudio.com/quran/husary/mujawwad/", ext:".mp3" },
  { id:"husary_murattal", name:"الحصري (مرتل)", base:"https://download.quranicaudio.com/quran/husary/murattal/", ext:".mp3" },
  { id:"minshawi_mujawwad", name:"المنشاوي (مجود)", base:"https://download.quranicaudio.com/quran/minshawi/mujawwad/", ext:".mp3" },
  { id:"minshawi_murattal", name:"المنشاوي (مرتل)", base:"https://download.quranicaudio.com/quran/minshawi/murattal/", ext:".mp3" },
  { id:"maher", name:"ماهر المعيقلي", base:"https://download.quranicaudio.com/quran/maher_al_muaiqly/", ext:".mp3" },
  { id:"sudais", name:"عبدالرحمن السديس", base:"https://download.quranicaudio.com/quran/abdulrahman_al_sudais/", ext:".mp3" },
  { id:"afasy", name:"مشاري العفاسي", base:"https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/", ext:".mp3" },
  { id:"shuraym", name:"سعود الشريم", base:"https://download.quranicaudio.com/quran/saud_alshuraim/", ext:".mp3" },
  { id:"ajamy", name:"أحمد العجمي", base:"https://download.quranicaudio.com/quran/ahmed_ibn_ali_al_ajamy/", ext:".mp3" },
  { id:"ghamdi", name:"علي جابر/الغامدي (قد تختلف)", base:"https://download.quranicaudio.com/quran/ali_al_huthaify/", ext:".mp3" },
  { id:"abdullah_basfar", name:"عبدالله بصفر", base:"https://download.quranicaudio.com/quran/abdullah_basfar/", ext:".mp3" },
  { id:"abdelkafi", name:"محمود خليل الحصري (تلاوات أخرى)", base:"https://download.quranicaudio.com/quran/muhammad_siddeeq_al-minshaawee_with_children/", ext:".mp3" },
];

// 20+ AI sites
const AI_SITES = [
  {name:"ChatGPT", url:"https://chat.openai.com", desc:"محادثة وتوليد نصوص متعددة اللغات.", featured:true},
  {name:"Gemini", url:"https://gemini.google.com", desc:"مساعد جوجل متعدد الوسائط (نص/صورة/كود).", featured:true},
  {name:"Claude", url:"https://claude.ai", desc:"مساعد كتابي ذكي من Anthropic؛ قوي في المستندات.", featured:true},
  {name:"Midjourney", url:"https://midjourney.com", desc:"إنشاء صور فنية عالية الجودة من وصف نصي."},
  {name:"DALL·E", url:"https://openai.com/dall-e-3", desc:"توليد صور واقعية وإبداعية من النصوص."},
  {name:"Stable Diffusion Web", url:"https://stability.ai", desc:"أدوات توليد صور مفتوحة المصدر."},
  {name:"Runway", url:"https://runwayml.com", desc:"تحويل نص إلى فيديو وتحرير فيديو بالذكاء الاصطناعي."},
  {name:"Perplexity", url:"https://www.perplexity.ai", desc:"محرك بحث ذكي مع مراجع موثوقة."},
  {name:"Phind", url:"https://www.phind.com", desc:"بحث للمبرمجين مع إجابات دقيقة."},
  {name:"Cohere", url:"https://cohere.com", desc:"نماذج لغة وتضمينات للمنتجات."},
  {name:"Copy.ai", url:"https://www.copy.ai", desc:"توليد نصوص تسويقية ومنشورات."},
  {name:"Jasper", url:"https://www.jasper.ai", desc:"محتوى تسويقي محترف للشركات."},
  {name:"Notion AI", url:"https://www.notion.so/product/ai", desc:"تلخيص/تحسين المستندات داخل Notion."},
  {name:"Fireflies", url:"https://fireflies.ai", desc:"تفريغ الاجتماعات وتلخيصها تلقائيًا."},
  {name:"Otter.ai", url:"https://otter.ai", desc:"تفريغ اجتماعات وزيارات صوتية."},
  {name:"Descript", url:"https://www.descript.com", desc:"تحرير صوت/فيديو بالذكاء الاصطناعي."},
  {name:"Krea", url:"https://www.krea.ai", desc:"رسم تفاعلي وStyle Transfer للصور."},
  {name:"HeyGen", url:"https://www.heygen.com", desc:"أفاتار فيديو بصوتك ولغتك."},
  {name:"ElevenLabs", url:"https://elevenlabs.io", desc:"تحويل نص إلى صوت واقعي بعدة لهجات."},
  {name:"Suno", url:"https://suno.ai", desc:"توليد موسيقى وأغاني من نص."},
  {name:"Gamma", url:"https://gamma.app", desc:"عروض تقديمية ومواقع بنقرة واحدة."},
  {name:"Tome", url:"https://tome.app", desc:"عروض تفاعلية مدعومة بالذكاء الاصطناعي."},
];

// English catalogs (expanded)
const ENGLISH = {
  listen: [
    {name:"BBC Learning English", url:"https://www.bbc.co.uk/learningenglish", desc:"مواد صوتية وفيديو مع نصوص."},
    {name:"VOA Learning English", url:"https://learningenglish.voanews.com", desc:"أخبار مبسطة مع صوت بطيء."},
    {name:"Elllo", url:"https://elllo.org", desc:"مقاطع استماع قصيرة بلهجات متنوعة."},
    {name:"TED-Ed", url:"https://ed.ted.com", desc:"فيديوهات تعليمية قصيرة مع تسميات."},
    {name:"Listen A Minute", url:"https://listenaminute.com", desc:"مقاطع دقيقة مع نص وأسئلة."},
    {name:"Podbean ESL", url:"https://www.podbean.com/podcast-tag/esl", desc:"بودكاست ESL متعدد المصادر."},
    {name:"ESL Lab", url:"https://www.esl-lab.com", desc:"اختبارات استماع مع نصوص وأسئلة."}
  ],
  all: [
    {name:"Duolingo", url:"https://www.duolingo.com", desc:"تعلم ممتع تدريجي."},
    {name:"British Council", url:"https://learnenglish.britishcouncil.org", desc:"دروس وامتحانات ومحادثات."},
    {name:"BBC Learning English (Site)", url:"https://www.bbc.co.uk/learningenglish", desc:"مستويات شاملة وتمارين."},
    {name:"EngVid", url:"https://www.engvid.com", desc:"مئات الدروس بالفيديو."},
    {name:"Coursera (Free tracks)", url:"https://www.coursera.org", desc:"مسارات جامعية مجانية مع شهادات مدفوعة."},
    {name:"Khan Academy (Grammar)", url:"https://www.khanacademy.org/humanities/grammar", desc:"قواعد مفصلة وتمارين."}
  ],
  write: [
    {name:"Grammarly", url:"https://www.grammarly.com", desc:"تدقيق لغوي وشرح الأخطاء."},
    {name:"QuillBot", url:"https://quillbot.com", desc:"إعادة صياغة ومفردات (بحذر)."},
    {name:"Vocabulary.com", url:"https://www.vocabulary.com", desc:"تعلّم كلمات مع أمثلة واختبارات."},
    {name:"WordReference", url:"https://www.wordreference.com", desc:"قاموس ومترادفات ومصطلحات."},
    {name:"AnkiWeb", url:"https://ankiweb.net", desc:"بطاقات تكرار متباعد لحفظ الكلمات."},
    {name:"Grammarly Handbook", url:"https://www.grammarly.com/handbook", desc:"مقالات تشرح القواعد والكتابة."}
  ],
  kids: [
    {name:"Starfall", url:"https://www.starfall.com", desc:"قراءة وقصص للأطفال."},
    {name:"PBS Kids", url:"https://pbskids.org", desc:"ألعاب تعليمية ممتعة."},
    {name:"ABCya", url:"https://www.abcya.com", desc:"أنشطة للقراءة والكتابة."},
    {name:"National Geographic Kids", url:"https://kids.nationalgeographic.com", desc:"محتوى علمي تفاعلي."},
    {name:"Fun English Games", url:"https://www.funenglishgames.com", desc:"ألعاب وأنشطة ممتعة."}
  ],
  other: [
    {name:"Duolingo (Chinese)", url:"https://www.duolingo.com/course/zh/en/Learn-Chinese", desc:"الصينية من الصفر."},
    {name:"HelloChinese", url:"https://www.hellochinese.cc", desc:"أفضل تطبيق للصينية للمبتدئين."},
    {name:"LingoDeer", url:"https://www.lingodeer.com", desc:"لغات آسيوية (كوري/ياباني/صيني)." },
    {name:"Busuu", url:"https://www.busuu.com", desc:"لغات متعددة مع مسارات منظمة."},
    {name:"Memrise", url:"https://www.memrise.com", desc:"حفظ كلمات ببطاقات وتكرار."}
  ]
};

const USEFUL = [
  {name:'Archive.org', desc:'أرشيف الكتب والملفات.', url:'https://archive.org'},
  {name:'Remove.bg', desc:'إزالة خلفية الصور.', url:'https://remove.bg'},
  {name:'TinyPNG', desc:'ضغط صور بدون فقدان الجودة.', url:'https://tinypng.com'},
  {name:'PDF Candy', desc:'أدوات PDF شاملة.', url:'https://pdfcandy.com'},
  {name:'Canva', desc:'تصميم سريع وسهل للقوالب.', url:'https://www.canva.com'},
  {name:'Photopea', desc:'بديل فوتوشوب في المتصفح.', url:'https://photopea.com'}
];

// Optional direct send: put your Web3Forms key here; otherwise mailto fallback works.
const WEB3FORMS_KEY = ""; // ضع مفتاحك هنا للإرسال المباشر

// ===== Helpers =====
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function renderCards(containerId, items){ 
  const el = document.getElementById(containerId); if(!el) return;
  el.innerHTML = items.map(i => `<article class="card ${i.featured?'featured':''}">
    <h3>${i.name}</h3><p>${i.desc}</p>
    <a class="btn small" href="${i.url}" target="_blank" rel="noopener">زيارة</a>
  </article>`).join('');
}

// ===== Quran: Listening Player =====
function initQuran(){
  const readerSel = $('#readerSelect');
  RECITERS.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id; o.textContent = r.name; readerSel.appendChild(o);
  });

  const surahSel = $('#surahSelect');
  SURAH_NAMES.forEach((n, i) => {
    const o = document.createElement('option');
    o.value = (i+1).toString().padStart(3,'0');
    o.textContent = `${i+1} — ${n}`; surahSel.appendChild(o);
  });

  const player = $('#player');
  function buildUrl(){
    const r = RECITERS.find(x=>x.id===readerSel.value) || RECITERS[0];
    const s = surahSel.value;
    return `${r.base}${s}${r.ext}`;
  }
  $('#playBtn').addEventListener('click', ()=>{
    player.src = buildUrl();
    player.play().catch(()=>{});
  });

  // Reading list
  const grid = $('#readGrid');
  function renderReadList(filter=""){
    const q = filter.trim();
    grid.innerHTML = SURAH_NAMES.map((n,i)=>({name:n,idx:i+1}))
      .filter(x => !q || x.name.includes(q))
      .map(x => `<article class="card">
        <h3>${x.idx} — ${x.name}</h3>
        <div class="row">
          <a class="btn small" href="https://quran.com/${x.idx}" target="_blank" rel="noopener">قراءة</a>
          <button class="btn small ghost" data-play="${x.idx}">استماع</button>
        </div>
      </article>`).join('');
    $$('#readGrid [data-play]').forEach(b=>b.addEventListener('click',()=>{
      const idx = String(b.getAttribute('data-play')).padStart(3,'0');
      $('#surahSelect').value = idx;
      $('.tab-btn[data-tab="listenTab"]').click();
      $('#playBtn').click();
    }));
  }
  renderReadList();
  $('#surahSearch').addEventListener('input', e=> renderReadList(e.target.value));

  // Tabs
  $$('.tab-btn').forEach(btn => btn.addEventListener('click', ()=>{
    $$('.tab-btn').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-pane').forEach(x=>x.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
  }));
}

// ===== Contact Form =====
function initContact(){
  const form = $('#contactForm'), msg=$('#formMsg'), sendBtn=$('#sendBtn'), agree=$('#agree'), mailto=$('#mailtoFallback');
  const year = $('#year'); if(year) year.textContent = new Date().getFullYear();

  function fillMailtoHref(){
    const data = new FormData(form);
    const subject = encodeURIComponent(data.get('subject') || 'تواصل جديد');
    const body = encodeURIComponent(
      'الاسم: ' + (data.get('name')||'') + '\\n' +
      'البريد: ' + (data.get('email')||'') + '\\n\\n' +
      (data.get('message')||'')
    );
    mailto.href = `mailto:support@gradifysa.com?subject=${subject}&body=${body}`;
  }
  if(mailto){ mailto.addEventListener('mouseenter', fillMailtoHref); mailto.addEventListener('focus', fillMailtoHref); }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault(); msg.textContent='';
    if(!agree.checked){ msg.textContent='من فضلك وافق على إرسال البيانات أولاً.'; return; }
    if(!form.checkValidity()){ msg.textContent='تحقق من الحقول المطلوبة.'; return; }

    if(WEB3FORMS_KEY){
      try{
        sendBtn.disabled=true; sendBtn.textContent='جارٍ الإرسال...';
        const data = new FormData(form);
        data.append('access_key', WEB3FORMS_KEY);
        const res = await fetch('https://api.web3forms.com/submit', { method:'POST', body:data });
        const out = await res.json();
        if(out.success){ msg.textContent='تم الإرسال بنجاح. سنعود إليك قريبًا.'; form.reset(); }
        else { msg.textContent='تعذر الإرسال عبر الخدمة. سيتم فتح البريد الآن.'; fillMailtoHref(); window.location.href = mailto.href; }
      }catch(err){
        msg.textContent='حدث خلل مؤقت. سيتم فتح البريد الآن.'; fillMailtoHref(); window.location.href = mailto.href;
      }finally{ sendBtn.disabled=false; sendBtn.textContent='إرسال'; }
    }else{
      fillMailtoHref();
      window.location.href = mailto.href;
      msg.textContent='تم فتح برنامج البريد لإرسال رسالتك.';
    }
  });
}

// ===== English/AI/Useful =====
function initCatalogs(){
  renderCards('aiGrid', AI_SITES);
  renderCards('usefulGrid', USEFUL);
  renderCards('engListen', ENGLISH.listen);
  renderCards('engAll', ENGLISH.all);
  renderCards('engWrite', ENGLISH.write);
  renderCards('engKids', ENGLISH.kids);
  renderCards('otherLangs', ENGLISH.other);
}

// ===== Nav / Sections =====
function initNav(){
  $$('.section-acc').forEach(d => d.removeAttribute('open'));
  const toggle=$('.nav-toggle'); const nav=$('#mainNav');
  if(toggle&&nav){ toggle.addEventListener('click',()=>{ const open=nav.classList.toggle('open'); toggle.setAttribute('aria-expanded',String(open)); });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{ nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); })); }
  document.addEventListener('click',(e)=>{ const a=e.target.closest('a'); if(!a) return;
    const isBrand=a.classList.contains('brand-link')||a.closest('.brand-link');
    const href=(a.getAttribute('href')||'').replace(location.origin,'');
    const isHome=['#top','#home','/','/#top',location.pathname+'#top'].includes(href);
    if(isBrand||isHome){ e.preventDefault(); $$('.section-acc').forEach(d=>d.removeAttribute('open')); window.scrollTo({top:0,behavior:'smooth'}); }
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  initNav(); initCatalogs(); initQuran(); initContact();
});
