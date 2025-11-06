
// ----- Static curated reciters + mushaf (HTTPS) -----
const RECITERS = [
  { id:"husary", name:"محمود الحصري", moshaf:[
    {name:"مرتل (حفص)", base:"https://download.quranicaudio.com/quran/husary/murattal/"},
    {name:"مجود",        base:"https://download.quranicaudio.com/quran/husary/mujawwad/"}
  ]},
  { id:"minshawi", name:"محمد صديق المنشاوي", moshaf:[
    {name:"مرتل", base:"https://download.quranicaudio.com/quran/minshawi/murattal/"},
    {name:"مجود", base:"https://download.quranicaudio.com/quran/minshawi/mujawwad/"}
  ]},
  { id:"abdul_basit", name:"عبدالباسط عبدالصمد", moshaf:[
    {name:"مرتل", base:"https://download.quranicaudio.com/quran/abdul_basit/murattal/"},
    {name:"مجود", base:"https://download.quranicaudio.com/quran/abdul_basit/mujawwad/"}
  ]},
  { id:"sudais", name:"عبدالرحمن السديس", moshaf:[
    {name:"حفص/مرتل", base:"https://download.quranicaudio.com/quran/abdulrahman_al_sudais/"}
  ]},
  { id:"afasy", name:"مشاري العفاسي", moshaf:[
    {name:"حفص/مرتل", base:"https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/"}
  ]},
  { id:"shuraym", name:"سعود الشريم", moshaf:[
    {name:"حفص/مرتل", base:"https://download.quranicaudio.com/quran/saud_alshuraim/"}
  ]},
  { id:"ajamy", name:"أحمد العجمي", moshaf:[
    {name:"حفص/مرتل", base:"https://download.quranicaudio.com/quran/ahmed_ibn_ali_al_ajamy/"}
  ]},
  { id:"huthaify", name:"علي الحذيفي", moshaf:[
    {name:"حفص/مرتل", base:"https://download.quranicaudio.com/quran/ali_al_huthaify/"}
  ]},
  { id:"basfar", name:"عبدالله بصفر", moshaf:[
    {name:"حفص/مرتل", base:"https://download.quranicaudio.com/quran/abdullah_basfar/"}
  ]}
];

const SURAH_NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبإ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];

const $ = s => document.querySelector(s);
function pad3(n){ return String(n).padStart(3,'0'); }

function fillReaders(){
  const r = $('#reader');
  r.innerHTML = RECITERS.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
}
function fillMushaf(){
  const rid = $('#reader').value;
  const m = $('#mushaf');
  const R = RECITERS.find(x=>x.id===rid);
  const list = (R && R.moshaf) ? R.moshaf : [];
  m.innerHTML = list.map(x=>`<option value="${x.base}">${x.name}</option>`).join('');
}
function fillSurahs(){
  const s = $('#surah');
  s.innerHTML = SURAH_NAMES.map((n,i)=>`<option value="${pad3(i+1)}">${i+1} — ${n}</option>`).join('');
}

function currentSrc(){
  let base = $('#mushaf').value || "";
  if(base && !base.endsWith('/')) base += '/';
  const surah = $('#surah').value || '001';
  return base + surah + ".mp3";
}

function boot(){
  fillReaders();
  fillMushaf();
  fillSurahs();
  $('#reader').addEventListener('change', ()=>{ fillMushaf(); });
  $('#playBtn').addEventListener('click', ()=>{
    const src = currentSrc();
    const player = $('#player');
    player.src = src;
    player.play().catch(()=>{});
  });
}
document.addEventListener('DOMContentLoaded', boot);
