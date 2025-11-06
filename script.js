// ===== Data =====
// Surah names
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
// ---- Reader/Mushaf helpers ----

// === Failsafe Bootstrap Reciters (shows instantly) ===
const RECITERS_BOOTSTRAP = [
  { id:"husary", name:"محمود الحصري", moshaf:[{name:"مرتل", server:"https://download.quranicaudio.com/quran/husary/murattal/"}] },
  { id:"minshawi", name:"محمد صديق المنشاوي", moshaf:[{name:"مرتل", server:"https://download.quranicaudio.com/quran/minshawi/murattal/"},{name:"مجود", server:"https://download.quranicaudio.com/quran/minshawi/mujawwad/"}] },
  { id:"abdul_basit", name:"عبدالباسط عبدالصمد", moshaf:[{name:"مرتل", server:"https://download.quranicaudio.com/quran/abdul_basit/murattal/"},{name:"مجود", server:"https://download.quranicaudio.com/quran/abdul_basit/mujawwad/"}] },
  { id:"sudais", name:"عبدالرحمن السديس", moshaf:[{name:"حفص/مرتل", server:"https://download.quranicaudio.com/quran/abdulrahman_al_sudais/"}] },
  { id:"afasy", name:"مشاري العفاسي", moshaf:[{name:"حفص/مرتل", server:"https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/"}] }
];
function useBootstrapReciters(){
  try{
    RECITERS_FULL = RECITERS_BOOTSTRAP.slice();
    renderReaders(document.getElementById('readerSelect'));
    const mushSel = document.getElementById('mushafSelect');
    if(mushSel) renderMushaf(mushSel, document.getElementById('readerSelect').value);
  }catch(_){}
}

function renderReaders(readerSel){
  readerSel.innerHTML = (RECITERS_FULL||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
}
function getReaderById(id){ return (RECITERS_FULL||[]).find(x=>String(x.id)===String(id)); }
function renderMushaf(mushafSel, readerId){
  const R = getReaderById(readerId);
  const list = (R && Array.isArray(R.moshaf))? R.moshaf : [];
  mushafSel.innerHTML = list.map(m=>`<option value="${(m.name||'').replace(/\\s+/g,'_')}">${m.name||'—'}</option>`).join('');
}
function findVariant(reciterId, mushafKey){
  const R = getReaderById(reciterId); if(!R) return null;
  const M = (R.moshaf||[]).find(m => (m.name||'').replace(/\\s+/g,'_')===mushafKey);
  if(!M) return null;
  let base = normHttps(M.server||''); if(!base.endsWith('/')) base+='/';
  return { base, ext:'.mp3', name:`${R.name} — ${M.name||''}` };
}

// ---- Filters for Listen tab ----
let ALL_RECITERS = RECITERS.slice();
function renderReaderOptions(filter=""){
  const readerSel = $('#readerSelect'); const mushafSel = $('#mushafSelect');
  await ensureRecitersFull();
  // Populate readers & mushaf
  const readerSel = $('#readerSelect'); const mushafSel = $('#mushafSelect');
  if(readerSel){
    renderReaders(readerSel); if(mushafSel){ renderMushaf(mushafSel, readerSel.value); }
  }

  const q = (filter||"").trim();
  let list = ALL_RECITERS;
  if(q){ list = ALL_RECITERS.filter(r => (r.name||"").includes(q)); }
  const prev = readerSel.value;
  readerSel.innerHTML = list.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  if(list.some(r=>r.id===prev)) readerSel.value = prev;
}
function renderSurahOptions(filter=""){
  const surahSel = $('#surahSelect');
  // Guaranteed initial population (surahs)
  const surahSel = $('#surahSelect');
  if(surahSel){
    surahSel.innerHTML = SURAH_NAMES.map((n,i)=>`<option value="${String(i+1).padStart(3,'0')}">${i+1} — ${n}</option>`).join('');
  }

  const q = (filter||"").trim();
  let items = SURAH_NAMES.map((n,i)=>({name:n, idx:i+1}));
  if(q){
    const num = parseInt(q,10);
    items = items.filter(x => (!isNaN(num) && (x.idx===num || String(x.idx).padStart(3,'0').includes(String(num)))) || x.name.includes(q));
  }
  const prev = surahSel.value;
  surahSel.innerHTML = items.map(x=>`<option value="${String(x.idx).padStart(3,'0')}">${x.idx} — ${x.name}</option>`).join('');
  if(items.some(x=>String(x.idx).padStart(3,'0')===prev)) surahSel.value = prev;
}




// ===== Full Reciters (MP3Quran) with Mushaf =====
let RECITERS_FULL = []; // [{id,name, moshaf:[{name, server, surah_total}]}]
let RECITERS = [];     // flat variants for backward compatibility
let RECITERS_READY = false;

function normHttps(u){ try{ return u.replace(/^http:\/\//i,'https://'); }catch(_){ return u; } }

function flattenReciters(){
  RECITERS = [];
  RECITERS_FULL.forEach(r=>{
    if(Array.isArray(r.moshaf)){
      r.moshaf.forEach(m=>{
        if(!m.server) return;
        let base = normHttps(m.server);
        if(!base.endsWith('/')) base += '/';
        RECITERS.push({
          id: `${r.id}__${(m.name||'').replace(/\s+/g,'_')}`,
          name: `${r.name} — ${m.name||''}`.trim(),
          base: base,
          ext: '.mp3',
          _rid: r.id,
          _mname: m.name||''
        });
      });
    }
  });
}

async function fetchRecitersFull(){
  try{
    const res = await fetch('https://www.mp3quran.net/api/v3/reciters?language=ar', {cache:'no-store'});
    if(res.ok){
      const data = await res.json();
      if(data && Array.isArray(data.reciters)){
        RECITERS_FULL = data.reciters.map(r=>({ id:String(r.id), name:r.name||'قارئ', moshaf:Array.isArray(r.moshaf)? r.moshaf.map(m=>({name:m.name||'', server:m.server||'', surah_total:m.surah_total||0})) : [] }));
        flattenReciters();
        return true;
      }
    }
  }catch(e){}
  try{
    const res2 = await fetch('https://www.mp3quran.net/api/_arabic.json', {cache:'no-store'});
    if(res2.ok){
      const data2 = await res2.json();
      if(data2 && Array.isArray(data2.reciters)){
        RECITERS_FULL = data2.reciters.map((r,idx)=>({ id:String(r.id||idx+1), name:r.name||'قارئ', moshaf:Array.isArray(r.moshaf)? r.moshaf.map(m=>({name:m.name||'', server:m.server||r.Server||''})) : [{name:r.rewaya||'', server:r.Server||''}] }));
        flattenReciters();
        return true;
      }
    }
  }catch(e){}
  // fallback minimal curated
  RECITERS_FULL = [
    { id:"husary", name:"محمود الحصري", moshaf:[{name:"مرتل", server:"https://download.quranicaudio.com/quran/husary/murattal/"}] },
    { id:"minshawi", name:"محمد صديق المنشاوي", moshaf:[{name:"مرتل", server:"https://download.quranicaudio.com/quran/minshawi/murattal/"},{name:"مجود", server:"https://download.quranicaudio.com/quran/minshawi/mujawwad/"}] },
    { id:"abdul_basit", name:"عبدالباسط عبدالصمد", moshaf:[{name:"مرتل", server:"https://download.quranicaudio.com/quran/abdul_basit/murattal/"},{name:"مجود", server:"https://download.quranicaudio.com/quran/abdul_basit/mujawwad/"}] },
    { id:"sudais", name:"عبدالرحمن السديس", moshaf:[{name:"حفص/مرتل", server:"https://download.quranicaudio.com/quran/abdulrahman_al_sudais/"}] },
    { id:"afasy", name:"مشاري العفاسي", moshaf:[{name:"حفص/مرتل", server:"https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/"}] }
  ];
  flattenReciters();
  return false;
}

async function ensureRecitersFull(){
  if(RECITERS_READY) return;
  // show bootstrap immediately so the UI is never empty
  useBootstrapReciters();
  // fetch with timeout
  const controller = new AbortController();
  const tm = setTimeout(()=>controller.abort(), 6000);
  try{
    const ok = await fetchRecitersFull();
    if(ok){
      // replace lists with full set
      const rSel = document.getElementById('readerSelect');
      const mSel = document.getElementById('mushafSelect');
      if(rSel){ renderReaders(rSel); if(mSel) renderMushaf(mSel, rSel.value); }
    }
  }catch(_){ /* ignore */ }
  clearTimeout(tm);
  RECITERS_READY = true;
}


// --- Ensure RECITERS has data (fallback if empty) ---
if (!Array.isArray(RECITERS) || RECITERS.length === 0){
  window.__RECITERS_FALLBACK__ = [
    { id:"husary_murattal", name:"الحصري — مرتل", base:"https://download.quranicaudio.com/quran/husary/murattal/", ext:".mp3" },
    { id:"minshawi_murattal", name:"المنشاوي — مرتل", base:"https://download.quranicaudio.com/quran/minshawi/murattal/", ext:".mp3" },
    { id:"abdul_basit_murattal", name:"عبدالباسط — مرتل", base:"https://download.quranicaudio.com/quran/abdul_basit/murattal/", ext:".mp3" },
    { id:"abdul_basit_mujawwad", name:"عبدالباسط — مجود", base:"https://download.quranicaudio.com/quran/abdul_basit/mujawwad/", ext:".mp3" },
    { id:"minshawi_mujawwad", name:"المنشاوي — مجود", base:"https://download.quranicaudio.com/quran/minshawi/mujawwad/", ext:".mp3" }
  ];
  try { RECITERS.push(...window.__RECITERS_FALLBACK__); } catch(_){}
}



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
const WEB3FORMS_KEY = "219a1c52-9eb6-449d-b48a-a1b06dc3f95e"; // ضع مفتاحك هنا للإرسال المباشر

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
async function initQuran(){
  await ensureRecitersFull();
  try{ if(!Array.isArray(RECITERS) || RECITERS.length===0){ throw new Error('no reciters'); } }catch(e){ /* handled by fallback above */ }
  const readerSel = $('#readerSelect'); const mushafSel = $('#mushafSelect');
  await ensureRecitersFull();
  // Populate readers & mushaf
  const readerSel = $('#readerSelect'); const mushafSel = $('#mushafSelect');
  if(readerSel){
    renderReaders(readerSel); if(mushafSel){ renderMushaf(mushafSel, readerSel.value); }
  }

  ALL_RECITERS = RECITERS.slice();
  renderReaderOptions();
  document.getElementById('readerSearch').addEventListener('input', e=> renderReaderOptions(e.target.value));
  /*RECITERS.forEach(r => {*/
    const o = document.createElement('option');
    o.value = r.id; o.textContent = r.name; /*readerSel.appendChild(o);
  });*/

  const surahSel = $('#surahSelect');
  // Guaranteed initial population (surahs)
  const surahSel = $('#surahSelect');
  if(surahSel){
    surahSel.innerHTML = SURAH_NAMES.map((n,i)=>`<option value="${String(i+1).padStart(3,'0')}">${i+1} — ${n}</option>`).join('');
  }

  renderSurahOptions();
  document.getElementById('surahFilter').addEventListener('input', e=> renderSurahOptions(e.target.value));
  /*SURAH_NAMES.forEach((n, i) => {*/
    const o = document.createElement('option');
    o.value = (i+1).toString().padStart(3,'0');
    o.textContent = `${i+1} — ${n}`; /*surahSel.appendChild(o);
  });*/

  const player = $('#player');
  function buildUrl(){
    const readerSel = document.getElementById('readerSelect');
    const mushafSel = document.getElementById('mushafSelect');
    const surahSel  = document.getElementById('surahSelect');
    const surah = surahSel ? surahSel.value : '001';
    if(readerSel && mushafSel){
      const picked = findVariant(readerSel.value, mushafSel.value);
      if(picked){ return `${picked.base}${surah}.mp3`; }
    }
    // fallback to first available
    try{
      const R = (RECITERS_FULL && RECITERS_FULL[0]) ? RECITERS_FULL[0] : null;
      const M = (R && R.moshaf && R.moshaf[0]) ? R.moshaf[0] : null;
      if(M && M.server){ let b = M.server.endsWith('/')? M.server : M.server+'/'; return `${b}${surah}.mp3`; }
    }catch(_){}
    return '';
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


// ===== Quick Player (homepage) =====
function initQuickPlayer(){
  const qReader = document.getElementById('quickReader');
  const qSurah = document.getElementById('quickSurah');
  const mainReader = document.getElementById('readerSelect');
  const mainSurah = document.getElementById('surahSelect');
  const quickPlay = document.getElementById('quickPlay');
  if(!qReader || !qSurah || !mainReader || !mainSurah) return;

  // If main selects are empty (for any reason), rebuild them now
  if(!mainReader.options.length){
    mainReader.innerHTML = (RECITERS||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  }
  if(!mainSurah.options.length){
    mainSurah.innerHTML = SURAH_NAMES.map((n,i)=>`<option value="${String(i+1).padStart(3,'0')}">${i+1} — ${n}</option>`).join('');
  }

  // populate quick selects from main
  qReader.innerHTML = Array.from(mainReader.options).map(o => `<option value="${o.value}">${o.textContent}</option>`).join('');
  qSurah.innerHTML  = Array.from(mainSurah.options).map(o => `<option value="${o.value}">${o.textContent}</option>`).join('');

  // sync both ways
  qReader.addEventListener('change', ()=>{ mainReader.value = qReader.value; });
  mainReader.addEventListener('change', ()=>{ if(qReader) qReader.value = mainReader.value; });

  qSurah.addEventListener('change', ()=>{ mainSurah.value = qSurah.value; });
  mainSurah.addEventListener('change', ()=>{ if(qSurah) qSurah.value = mainSurah.value; });

  // play (uses the same #player element shared in quick player)
  quickPlay.addEventListener('click', ()=>{
    const mainPlay = document.getElementById('playBtn');
    if(mainPlay){ mainPlay.click(); }
  });
}


// ===== Site-wide Search =====
function arNorm(s){
  if(!s) return '';
  const diacritics = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
  return s.replace(diacritics,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ٱ/g,'ا').toLowerCase();
}
function buildIndex(){
  const idx = [];
  (SURAH_NAMES||[]).forEach((n,i)=> idx.push({t:'quran', k:`${i+1} ${n}`, url:`https://quran.com/${i+1}`}));
  (RECITERS_FULL||[]).forEach(r=> idx.push({t:'reciters', k:r.name, rid:r.id}));
  (AI_SITES||[]).forEach(a=> idx.push({t:'ai', k:`${a.name} ${a.desc||''}`, url:a.url}));
  const EN = (typeof ENGLISH!=='undefined')? ENGLISH : {listen:[],all:[],write:[],kids:[],other:[]};
  [...(EN.listen||[]),...(EN.all||[]),...(EN.write||[]),...(EN.kids||[]),...(EN.other||[])].forEach(e=> idx.push({t:'english', k:`${e.name} ${e.desc||''}`, url:e.url}));
  (USEFUL||[]).forEach(u=> idx.push({t:'useful', k:`${u.name} ${u.desc||''}`, url:u.url}));
  return idx;
}
function filterByPrefix(q){ const m=q.match(/^@(q|ai|en|us)\s+(.*)$/i); if(!m) return null; const map={q:'quran',ai:'ai',en:'english',us:'useful'}; return {type:map[m[1].toLowerCase()], rest:m[2]}; }
function doSearch(q, idx, allowed){
  const p=filterByPrefix(q); let qn=q; let types=allowed; if(p){ types=new Set([p.type]); qn=p.rest; }
  const qq=arNorm(qn); const res=[];
  for(const it of idx){ if(!types.has(it.t)) continue; const kk=arNorm(it.k); if(kk.includes(qq)){ res.push(it); if(res.length>30) break; } }
  return res;
}
function renderSearchResults(list){
  const box=document.getElementById('siteSearchResults'); if(!box) return;
  if(!list.length){ box.classList.remove('show'); box.innerHTML=''; return; }
  box.innerHTML = list.map(it=>`<div class="item" data-t="${it.t}" data-url="${it.url||''}" data-rid="${it.rid||''}">${it.k}</div>`).join('');
  box.classList.add('show');
  box.querySelectorAll('.item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const t=el.getAttribute('data-t'), url=el.getAttribute('data-url'), rid=el.getAttribute('data-rid');
      if(t==='quran' && url){ window.open(url,'_blank'); return; }
      if(url){ window.open(url,'_blank'); return; }
      if(t==='reciters' && rid){
        const readerSel=document.getElementById('readerSelect');
        if(readerSel){ readerSel.value=rid; readerSel.dispatchEvent(new Event('change')); const opener=document.querySelector('[data-open=\"#sec-quran\"]'); if(opener) opener.click(); }
      }
    });
  });
}
function initSiteSearch(){
  const inp=document.getElementById('siteSearchInput'), advBtn=document.getElementById('siteSearchAdvBtn'), advPanel=document.getElementById('siteSearchAdvanced');
  const idx=buildIndex(); const allowed=new Set(['quran','reciters','ai','english','useful']); if(!inp) return;
  inp.addEventListener('input', ()=>{ const v=inp.value.trim(); if(!v){ renderSearchResults([]); return; } renderSearchResults(doSearch(v, idx, allowed)); });
  document.addEventListener('click', (e)=>{ if(!e.target.closest('.site-search')){ const box=document.getElementById('siteSearchResults'); if(box) box.classList.remove('show'); } });
  if(advBtn && advPanel){
    advBtn.addEventListener('click', ()=>{ const vis=advPanel.hasAttribute('hidden'); if(vis) advPanel.removeAttribute('hidden'); else advPanel.setAttribute('hidden',''); advBtn.setAttribute('aria-expanded', String(vis)); });
    advPanel.querySelectorAll('.adv-src').forEach(cb=> cb.addEventListener('change', ()=>{ if(cb.checked) allowed.add(cb.value); else allowed.delete(cb.value); const v=inp.value.trim(); if(v){ renderSearchResults(doSearch(v, idx, allowed)); } }));
  }
}


// ===== Reading Mode, Favorites, Mini Player =====
function initReadingMode(){
  const tgl = document.getElementById('readingModeToggle');
  if(!tgl) return;
  tgl.addEventListener('change', ()=>{
    const root = document.querySelector('body');
    if(tgl.checked) root.classList.add('reading-mode'); else root.classList.remove('reading-mode');
    try{ localStorage.setItem('reading_mode', tgl.checked ? '1' : '0'); }catch(_){}
  });
  try{ if(localStorage.getItem('reading_mode')==='1'){ tgl.checked = true; tgl.dispatchEvent(new Event('change')); } }catch(_){}
}

function favKey(rid, mkey, surah){ return `${rid}::${mkey}::${surah}`; }
function getFavs(){
  try{ return JSON.parse(localStorage.getItem('q_favs')||'[]'); }catch(_){ return []; }
}
function setFavs(arr){ try{ localStorage.setItem('q_favs', JSON.stringify(arr)); }catch(_){ } }
function renderFavs(){
  const box = document.getElementById('favoritesList'); if(!box) return;
  const list = getFavs();
  if(!list.length){ box.innerHTML = '<div class="muted">لا توجد عناصر مضافة.</div>'; return; }
  box.innerHTML = list.map(it=>`
    <div class="fav-item">
      <div>${it.label}</div>
      <div class="row">
        <button class="btn small" data-jump="${it.key}">تشغيل</button>
        <button class="btn small ghost" data-del="${it.key}">حذف</button>
      </div>
    </div>
  `).join('');
  // bind
  box.querySelectorAll('[data-del]').forEach(b=> b.addEventListener('click', ()=>{
    const key = b.getAttribute('data-del');
    const arr = getFavs().filter(x=>x.key!==key);
    setFavs(arr); renderFavs();
  }));
  box.querySelectorAll('[data-jump]').forEach(b=> b.addEventListener('click', ()=>{
    const key = b.getAttribute('data-jump');
    const arr = getFavs(); const it = arr.find(x=>x.key===key);
    if(!it) return;
    const readerSel = document.getElementById('readerSelect');
    const mushafSel = document.getElementById('mushafSelect');
    const surahSel  = document.getElementById('surahSelect');
    if(readerSel) readerSel.value = it.rid;
    if(mushafSel){ renderMushaf(mushafSel, it.rid); mushafSel.value = it.mkey; }
    if(surahSel) surahSel.value = it.surah;
    const opener = document.querySelector('[data-open="#sec-quran"]'); if(opener) opener.click();
    const play = document.getElementById('playBtn'); if(play) play.click();
  }));
}

function initFavorites(){
  const addBtn = document.getElementById('favAddBtn');
  const clrBtn = document.getElementById('favClearBtn');
  if(addBtn){
    addBtn.addEventListener('click', ()=>{
      const readerSel = document.getElementById('readerSelect');
      const mushafSel = document.getElementById('mushafSelect');
      const surahSel  = document.getElementById('surahSelect');
      if(!readerSel || !surahSel) return;
      const rid = readerSel.value;
      const mkey = mushafSel ? mushafSel.value : '';
      const surah = surahSel.value;
      const key = favKey(rid, mkey, surah);
      const R = (RECITERS_FULL||[]).find(r=>String(r.id)===String(rid));
      let mname=''; if(R && mushafSel){ const M = (R.moshaf||[]).find(m => (m.name||'').replace(/\s+/g,'_')===mkey); mname = M? (M.name||'') : ''; }
      const label = `${R?R.name:'قارئ'} — ${mname||'مصحف'} — ${parseInt(surah,10)} ${SURAH_NAMES[parseInt(surah,10)-1]||''}`;
      const arr = getFavs(); if(!arr.some(x=>x.key===key)){ arr.unshift({key, rid, mkey, surah, label}); setFavs(arr.slice(0,100)); }
      renderFavs();
    });
  }
  if(clrBtn){ clrBtn.addEventListener('click', ()=>{ setFavs([]); renderFavs(); }); }
  renderFavs();
}

function initMiniBar(){
  const mini = document.getElementById('miniPlayerBar');
  if(!mini) return;
  const label = document.getElementById('miniNowLabel');
  const miniPlay = document.getElementById('miniPlayBtn');
  const gotoBtn = document.getElementById('miniGotoBtn');
  const audio = document.getElementById('player');

  function updateLabel(){
    const readerSel = document.getElementById('readerSelect');
    const mushafSel = document.getElementById('mushafSelect');
    const surahSel  = document.getElementById('surahSelect');
    const rn = (RECITERS_FULL||[]).find(r=>String(r.id)===String(readerSel?.value))?.name || 'قارئ';
    const mn = mushafSel ? mushafSel.options[mushafSel.selectedIndex]?.textContent || '' : '';
    const sn = surahSel ? SURAH_NAMES[parseInt(surahSel.value,10)-1] || '' : '';
    label.textContent = `${rn}${mn?' — '+mn:''}${sn?' — '+sn:''}`;
  }

  document.getElementById('readerSelect')?.addEventListener('change', updateLabel);
  document.getElementById('mushafSelect')?.addEventListener('change', updateLabel);
  document.getElementById('surahSelect')?.addEventListener('change', updateLabel);

  miniPlay.addEventListener('click', ()=>{
    if(!audio) return;
    if(audio.paused){ audio.play().catch(()=>{}); } else { audio.pause(); }
  });
  gotoBtn?.addEventListener('click', ()=>{
    const opener = document.querySelector('[data-open="#sec-quran"]'); if(opener) opener.click();
  });

  // Initial label
  updateLabel();
}

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
  initNav(); initCatalogs(); initQuran(); initQuickPlayer(); initContact(); initSiteSearch(); initReadingMode(); initFavorites(); initMiniBar();
});
