
// ----- Data (offline) -----
const RECITERS = [
  { id:"husary", name:"محمود الحصري", moshaf:[
    {name:"مرتل (حفص)", base:"https://download.quranicaudio.com/quran/husary/murattal/"},
    {name:"مجود",       base:"https://download.quranicaudio.com/quran/husary/mujawwad/"}
  ]},
  { id:"minshawi", name:"محمد صديق المنشاوي", moshaf:[
    {name:"مرتل", base:"https://download.quranicaudio.com/quran/minshawi/murattal/"},
    {name:"مجود", base:"https://download.quranicaudio.com/quran/minshawi/mujawwad/"}
  ]},
  { id:"abdul_basit", name:"عبدالباسط عبدالصمد", moshaf:[
    {name:"مرتل", base:"https://download.quranicaudio.com/quran/abdul_basit/murattal/"},
    {name:"مجود", base:"https://download.quranicaudio.com/quran/abdul_basit/mujawwad/"}
  ]},
  { id:"sudais", name:"عبدالرحمن السديس", moshaf:[{name:"حفص/مرتل", base:"https://download.quranicaudio.com/quran/abdulrahman_al_sudais/"}]},
  { id:"afasy", name:"مشاري العفاسي", moshaf:[{name:"حفص/مرتل", base:"https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/"}]}
];
const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبإ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AI_SITES = [
  {name:"ChatGPT", url:"https://chat.openai.com", desc:"محادثة ذكية"},
  {name:"Claude", url:"https://claude.ai", desc:"مساعد نصي"}
];
const ENGLISH = [
  {name:"BBC Learning English", url:"https://www.bbc.co.uk/learningenglish", desc:"دروس ومهارات"},
  {name:"ESL Fast", url:"https://eslfast.com", desc:"قصص ومحادثات"}
];

// ----- Helpers -----
const $ = q => document.querySelector(q);
const pad3 = n => String(n).padStart(3,'0');
function arNorm(s){ if(!s) return ''; const d=/[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]/g;
  return s.replace(d,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ٱ/g,'ا').toLowerCase(); }

// ----- Quran UI -----
function loadReaders(){ $('#reader').innerHTML = RECITERS.map(r=>`<option value="${r.id}">${r.name}</option>`).join(''); }
function loadMushaf(){ const R = RECITERS.find(r=>r.id === $('#reader').value); $('#mushaf').innerHTML = (R?.moshaf||[]).map(m=>`<option value="${m.base}">${m.name}</option>`).join(''); }
function loadSurahs(){ $('#surah').innerHTML = SURAH_NAMES.map((n,i)=>`<option value="${pad3(i+1)}">${i+1} — ${n}</option>`).join(''); }
function currentSrc(){ let base = $('#mushaf').value; if(base && !base.endsWith('/')) base+='/'; return `${base}${$('#surah').value}.mp3`; }

// ----- Search Index -----
function buildIndex(){
  const idx = [];
  SURAH_NAMES.forEach((n,i)=> idx.push({t:'quran', k:`${i+1} ${n}`, act:()=>{ location.hash='#quran'; $('#surah').value = pad3(i+1); }}));
  RECITERS.forEach(r=> idx.push({t:'reciters', k:r.name, act:()=>{ location.hash='#quran'; $('#reader').value = r.id; loadMushaf(); }}));
  AI_SITES.forEach(a=> idx.push({t:'ai', k:`${a.name} ${a.desc||''}`, url:a.url}));
  ENGLISH.forEach(e=> idx.push({t:'english', k:`${e.name} ${e.desc||''}`, url:e.url}));
  return idx;
}
function doSearch(q, idx, allowed){
  const qq = arNorm(q.trim()); if(!qq) return [];
  const out = [];
  for(const it of idx){
    if(!allowed.has(it.t)) continue;
    if(arNorm(it.k).includes(qq)){ out.push(it); if(out.length>=30) break; }
  }
  return out;
}
function renderSearchResults(list){
  const box = $('#siteSearchResults');
  if(!list.length){ box.classList.remove('show'); box.innerHTML=''; return; }
  const label = t=> ({quran:'سورة', reciters:'قارئ', ai:'ذكاء', english:'إنجليزي'})[t] || t;
  box.innerHTML = list.map(it=>`<div class="item"><span>${it.k}</span><small>${label(it.t)}</small></div>`).join('');
  box.classList.add('show');
  [...box.children].forEach((el,i)=>{
    el.addEventListener('click', ()=>{
      const row = list[i];
      box.classList.remove('show'); box.innerHTML='';
      if(row.act){ row.act(); }
      if(row.url){ window.open(row.url, '_blank'); }
    });
  });
}
function initSiteSearch(){
  const inp = $('#siteSearchInput'); const box = $('#siteSearchResults'); const advBtn = $('#siteSearchAdvBtn'); const advPanel = document.getElementById('siteSearchAdvanced');
  const idx = buildIndex(); const allowed = new Set(['quran','reciters','ai','english']);
  inp.addEventListener('input', ()=> renderSearchResults(doSearch(inp.value, idx, allowed)));
  document.addEventListener('click', (e)=>{ if(!e.target.closest('.site-search')){ box.classList.remove('show'); } });
  if(advBtn && advPanel){
    advBtn.addEventListener('click', ()=>{ const show = advPanel.hasAttribute('hidden'); if(show) advPanel.removeAttribute('hidden'); else advPanel.setAttribute('hidden',''); advBtn.setAttribute('aria-expanded', String(show)); });
    advPanel.querySelectorAll('.adv-src').forEach(cb=> cb.addEventListener('change', ()=>{ if(cb.checked) allowed.add(cb.value); else allowed.delete(cb.value); renderSearchResults(doSearch(inp.value, idx, allowed)); }));
  }
}

// ----- Boot -----
document.addEventListener('DOMContentLoaded', ()=>{
  loadReaders(); loadMushaf(); loadSurahs();
  document.getElementById('reader').addEventListener('change', loadMushaf);
  document.getElementById('playBtn').addEventListener('click', ()=>{ const p=$('#player'); p.src=currentSrc(); p.play().catch(()=>{}); });
  document.getElementById('aiList').innerHTML = AI_SITES.map(a=>`<li><a href="${a.url}" target="_blank">${a.name}</a></li>`).join('');
  document.getElementById('enList').innerHTML = ENGLISH.map(e=>`<li><a href="${e.url}" target="_blank">${e.name}</a></li>`).join('');
  initSiteSearch();
});
