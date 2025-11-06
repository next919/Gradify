
// ------- Stable Offline Data (No external API required) -------

// Surah names (1..114)
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبإ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];

// Curated full reciters with mushaf (HTTPS only)
const RECITERS_FULL = [
  { id:"husary", name:"محمود الحصري", moshaf:[
    {name:"مرتل", server:"https://download.quranicaudio.com/quran/husary/murattal/"},
    {name:"مجود", server:"https://download.quranicaudio.com/quran/husary/mujawwad/"}
  ]},
  { id:"minshawi", name:"محمد صديق المنشاوي", moshaf:[
    {name:"مرتل", server:"https://download.quranicaudio.com/quran/minshawi/murattal/"},
    {name:"مجود", server:"https://download.quranicaudio.com/quran/minshawi/mujawwad/"}
  ]},
  { id:"abdul_basit", name:"عبدالباسط عبدالصمد", moshaf:[
    {name:"مرتل", server:"https://download.quranicaudio.com/quran/abdul_basit/murattal/"},
    {name:"مجود", server:"https://download.quranicaudio.com/quran/abdul_basit/mujawwad/"}
  ]},
  { id:"sudais", name:"عبدالرحمن السديس", moshaf:[
    {name:"حفص/مرتل", server:"https://download.quranicaudio.com/quran/abdulrahman_al_sudais/"}
  ]},
  { id:"afasy", name:"مشاري العفاسي", moshaf:[
    {name:"حفص/مرتل", server:"https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/"}
  ]}
];

// Minimal catalogs for search
const AI_SITES = [
  {name:"ChatGPT", url:"https://chat.openai.com", desc:"محادثة ذكية"},
  {name:"Claude", url:"https://claude.ai", desc:"منافس قوي"}
];
const ENGLISH = { all:[
  {name:"BBC Learning English", url:"https://www.bbc.co.uk/learningenglish", desc:"من أفضل المصادر"},
  {name:"ESL Fast", url:"https://eslfast.com", desc:"قصص قصيرة ومحادثات"}
]};
const USEFUL = [
  {name:"Remove.bg", url:"https://remove.bg", desc:"إزالة خلفية الصور"},
  {name:"TinyPNG", url:"https://tinypng.com", desc:"ضغط الصور"}
];

// ------- Helpers -------
const $ = sel => document.querySelector(sel);
function pad3(n){ return String(n).padStart(3,'0'); }
function normHttps(u){ try{ return u.replace(/^http:\/\//i,'https://'); }catch(_){ return u; } }

function renderReaders(){
  const el = $('#readerSelect');
  el.innerHTML = RECITERS_FULL.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
}
function renderMushaf(){
  const r = $('#readerSelect').value;
  const el = $('#mushafSelect');
  const rec = RECITERS_FULL.find(x=>x.id===r);
  const list = (rec && rec.moshaf) ? rec.moshaf : [];
  el.innerHTML = list.map(m=>`<option value="${m.server}">${m.name}</option>`).join('');
}
function renderSurahs(){
  const el = $('#surahSelect');
  el.innerHTML = SURAH_NAMES.map((n,i)=>`<option value="${pad3(i+1)}">${i+1} — ${n}</option>`).join('');
}

function buildUrl(){
  const base = $('#mushafSelect').value;
  const surah = $('#surahSelect').value || '001';
  let b = normHttps(base);
  if(!b.endsWith('/')) b += '/';
  return `${b}${surah}.mp3`;
}

function initQuran(){
  renderReaders(); renderMushaf(); renderSurahs();
  $('#readerSelect').addEventListener('change', ()=>{ renderMushaf(); updateMini(); });
  $('#mushafSelect').addEventListener('change', updateMini);
  $('#surahSelect').addEventListener('change', updateMini);
  const player = $('#player');
  $('#playBtn').addEventListener('click', ()=>{
    const src = buildUrl();
    player.src = src;
    player.play().catch(()=>{});
  });
  updateMini();
}

function updateMini(){
  const r = RECITERS_FULL.find(x=>x.id===$('#readerSelect').value);
  const mush = $('#mushafSelect').selectedOptions[0]?.textContent || '';
  const sNum = parseInt($('#surahSelect').value||'1',10);
  const sName = SURAH_NAMES[sNum-1] || '';
  $('#miniNowLabel').textContent = `${r?r.name:'—'} — ${mush} — ${sNum} ${sName}`;
}

// ------- Lists -------
function renderLists(){
  $('#aiList').innerHTML = AI_SITES.map(a=>`<li><a href="${a.url}" target="_blank">${a.name}</a></li>`).join('');
  $('#enList').innerHTML = ENGLISH.all.map(e=>`<li><a href="${e.url}" target="_blank">${e.name}</a></li>`).join('');
  $('#usefulList').innerHTML = USEFUL.map(u=>`<li><a href="${u.url}" target="_blank">${u.name}</a></li>`).join('');
}

// ------- Site Search (offline index) -------
function arNorm(s){
  if(!s) return '';
  const diacritics=/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
  return s.replace(diacritics,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ٱ/g,'ا').toLowerCase();
}
function buildIndex(){
  const idx=[];
  SURAH_NAMES.forEach((n,i)=> idx.push({t:'quran', k:`${i+1} ${n}`, url:`#quran`, action:()=>{ document.getElementById('surahSelect').value = pad3(i+1); updateMini(); }}));
  RECITERS_FULL.forEach(r=> idx.push({t:'reciter', k:r.name, url:'#quran', action:()=>{ document.getElementById('readerSelect').value = r.id; renderMushaf(); updateMini(); }}));
  AI_SITES.forEach(a=> idx.push({t:'ai', k:`${a.name} ${a.desc||''}`, url:a.url}));
  ENGLISH.all.forEach(e=> idx.push({t:'english', k:`${e.name} ${e.desc||''}`, url:e.url}));
  USEFUL.forEach(u=> idx.push({t:'useful', k:`${u.name} ${u.desc||''}`, url:u.url}));
  return idx;
}
function doSearch(q, idx){
  const qq = arNorm(q.trim());
  if(!qq) return [];
  const res=[];
  for(const it of idx){
    if(arNorm(it.k).includes(qq)){ res.push(it); if(res.length>30) break; }
  }
  return res;
}
function initSearch(){
  const box = document.getElementById('siteSearchResults');
  const inp = document.getElementById('siteSearchInput');
  const idx = buildIndex();
  inp.addEventListener('input', ()=>{
    const list = doSearch(inp.value, idx);
    if(!list.length){ box.classList.remove('show'); box.innerHTML=''; return; }
    box.innerHTML = list.map(it=>`<div class="item" data-url="${it.url||''}">${it.k}</div>`).join('');
    box.classList.add('show');
    Array.from(box.children).forEach((el,i)=>{
      el.addEventListener('click', ()=>{
        const url = list[i].url;
        const act = list[i].action;
        if(act){ act(); location.hash = '#quran'; }
        else if(url){ window.open(url, '_blank'); }
        box.classList.remove('show');
      });
    });
  });
  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.site-search')) box.classList.remove('show');
  });
}

// ------- Mini bar -------
function initMiniBar(){
  const audio = document.getElementById('player');
  document.getElementById('miniPlayBtn').addEventListener('click', ()=>{
    if(audio.paused) audio.play().catch(()=>{}); else audio.pause();
  });
}

// ------- Boot -------
document.addEventListener('DOMContentLoaded', ()=>{
  initQuran();
  renderLists();
  initSearch();
  initMiniBar();
});
