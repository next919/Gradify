const RECITERS=[
{id:"husary",name:"محمود الحصري",moshaf:[
{name:"مرتل (حفص) — mp3quran",base:"https://server13.mp3quran.net/husr/"},
{name:"مرتل (حفص) — quranicaudio",base:"https://download.quranicaudio.com/quran/husary/murattal/"},
{name:"مجود — quranicaudio",base:"https://download.quranicaudio.com/quran/husary/mujawwad/"}
]},
{id:"minshawi",name:"محمد صديق المنشاوي",moshaf:[
{name:"مرتل — mp3quran",base:"https://server10.mp3quran.net/minsh/"},
{name:"مرتل — quranicaudio",base:"https://download.quranicaudio.com/quran/minshawi/murattal/"},
{name:"مجود — quranicaudio",base:"https://download.quranicaudio.com/quran/minshawi/mujawwad/"}
]},
{id:"abdul_basit",name:"عبدالباسط عبدالصمد",moshaf:[
{name:"مرتل — quranicaudio",base:"https://download.quranicaudio.com/quran/abdul_basit/murattal/"},
{name:"مجود — quranicaudio",base:"https://download.quranicaudio.com/quran/abdul_basit/mujawwad/"}
]},
{id:"sudais",name:"عبدالرحمن السديس",moshaf:[
{name:"حفص/مرتل — mp3quran",base:"https://server11.mp3quran.net/sds/"},
{name:"حفص/مرتل — quranicaudio",base:"https://download.quranicaudio.com/quran/abdulrahman_al_sudais/"}
]},
{id:"afasy",name:"مشاري العفاسي",moshaf:[
{name:"حفص/مرتل — mp3quran",base:"https://server8.mp3quran.net/afs/"},
{name:"حفص/مرتل — quranicaudio",base:"https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/"}
]},
{id:"shuraym",name:"سعود الشريم",moshaf:[
{name:"حفص/مرتل — mp3quran",base:"https://server7.mp3quran.net/shur/"},
{name:"حفص/مرتل — quranicaudio",base:"https://download.quranicaudio.com/quran/saud_alshuraim/"}
]},
{id:"ajamy",name:"أحمد العجمي",moshaf:[
{name:"حفص/مرتل — mp3quran",base:"https://server10.mp3quran.net/ajm/"},
{name:"حفص/مرتل — quranicaudio",base:"https://download.quranicaudio.com/quran/ahmed_ibn_ali_al_ajamy/"}
]},
{id:"huthaify",name:"علي الحذيفي",moshaf:[
{name:"حفص/مرتل — quranicaudio",base:"https://download.quranicaudio.com/quran/ali_al_huthaify/"}
]},
{id:"basfar",name:"عبدالله بصفر",moshaf:[
{name:"حفص/مرتل — mp3quran",base:"https://server6.mp3quran.net/bsfr/"},
{name:"حفص/مرتل — quranicaudio",base:"https://download.quranicaudio.com/quran/abdullah_basfar/"}
]}
];
const SURAH_NAMES=["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const AI=[["ChatGPT","مساعد ذكي للكتابة والشرح والبرمجة","https://chat.openai.com"],["Claude","مساعد نصي قوي للمستندات والتحليل","https://claude.ai"],["Gemini","مساعد Google للبحث والمهام","https://gemini.google.com"],["Perplexity","بحث ذكي مع مصادر","https://www.perplexity.ai"],["Runway","فيديو بالذكاء الاصطناعي","https://runwayml.com"],["ElevenLabs","تحويل النص إلى صوت واقعي","https://elevenlabs.io"],["Canva AI","تصميم سريع وقوالب","https://www.canva.com"],["Gamma","عروض تقديمية ومواقع","https://gamma.app"]];
const EN=[["BBC Learning English","دروس ومهارات ومقاطع صوتية","https://www.bbc.co.uk/learningenglish"],["VOA Learning English","أخبار مبسطة واستماع","https://learningenglish.voanews.com"],["ESL Fast","قصص ومحادثات قصيرة","https://eslfast.com"],["British Council","تعلم إنجليزي شامل","https://learnenglish.britishcouncil.org"],["EngVid","دروس فيديو مجانية","https://www.engvid.com"],["Vocabulary.com","تطوير المفردات","https://www.vocabulary.com"]];
const USEFUL=[["Remove.bg","إزالة خلفية الصور","https://remove.bg"],["TinyPNG","ضغط الصور","https://tinypng.com"],["Photopea","بديل فوتوشوب في المتصفح","https://photopea.com"],["PDF Candy","أدوات PDF","https://pdfcandy.com"],["Archive.org","أرشيف كتب وملفات","https://archive.org"],["Google Drive","تخزين ومشاركة الملفات","https://drive.google.com"]];
const $=s=>document.querySelector(s), pad3=n=>String(n).padStart(3,"0");
function fillReaders(){reader.innerHTML=RECITERS.map(r=>`<option value="${r.id}">${r.name}</option>`).join("")}
function fillMushaf(){const R=RECITERS.find(r=>r.id===reader.value);mushaf.innerHTML=(R?.moshaf||[]).map(m=>`<option value="${m.base}">${m.name}</option>`).join("")}
function fillSurah(){surah.innerHTML=SURAH_NAMES.map((n,i)=>`<option value="${pad3(i+1)}">${i+1} — ${n}</option>`).join("")}
function src(){let b=mushaf.value||""; if(b&&!b.endsWith("/")) b+="/"; return b+(surah.value||"001")+".mp3"}
function now(){const r=RECITERS.find(x=>x.id===reader.value)?.name||""; nowPlaying.textContent=`${r} — ${mushaf.selectedOptions[0]?.textContent||""} — ${surah.selectedOptions[0]?.textContent||""}`}
function cards(id,arr){$(id).innerHTML=arr.map(x=>`<a class="card" href="${x[2]}" target="_blank"><h3>${x[0]}</h3><p>${x[1]}</p><span>زيارة</span></a>`).join("")}
function norm(s){return (s||"").replace(/[إأآا]/g,"ا").replace(/ى/g,"ي").toLowerCase()}
function buildIndex(){let a=[];SURAH_NAMES.forEach((n,i)=>a.push({k:`${i+1} ${n}`,t:"سورة",go:()=>{location.hash="#quran";surah.value=pad3(i+1);now()}}));RECITERS.forEach(r=>a.push({k:r.name,t:"قارئ",go:()=>{location.hash="#quran";reader.value=r.id;fillMushaf();now()}}));[...AI,...EN,...USEFUL].forEach(x=>a.push({k:x[0]+" "+x[1],t:"رابط",url:x[2]}));["حاسبة المعدل gpa","الحاسبة المطورة","حاسبة سريعة"].forEach((k,i)=>a.push({k,t:"حاسبة",url:["gpa.html","gpa-app.html","gpa-v2.html"][i]}));return a}
document.addEventListener("DOMContentLoaded",()=>{menuBtn.onclick=()=>nav.classList.toggle("open");fillReaders();fillMushaf();fillSurah();cards("#aiGrid",AI);cards("#englishGrid",EN);cards("#usefulGrid",USEFUL);now();reader.onchange=()=>{fillMushaf();now()};mushaf.onchange=now;surah.onchange=now;function playWithFallback(){
  const s = surah.value || "001";
  const selected = src();
  const globalFallbacks = [
    "https://server13.mp3quran.net/husr/" + s + ".mp3",
    "https://server10.mp3quran.net/minsh/" + s + ".mp3",
    "https://server8.mp3quran.net/afs/" + s + ".mp3",
    "https://server11.mp3quran.net/sds/" + s + ".mp3"
  ];
  let tries = [selected, ...globalFallbacks.filter(x => x !== selected)];
  let i = 0;
  player.onerror = () => {
    i++;
    if(i < tries.length){
      player.src = tries[i];
      player.play().catch(()=>{});
    }
  };
  player.src = tries[0];
  player.play().catch(()=>{});
  now();
}
playBtn.onclick=playWithFallback;miniPlay.onclick=()=>{if(player.paused)player.play().catch(()=>{});else player.pause()};const idx=buildIndex();globalSearch.oninput=()=>{const q=norm(globalSearch.value);if(!q){searchResults.classList.remove("show");return}const res=idx.filter(x=>norm(x.k).includes(q)).slice(0,20);searchResults.innerHTML=res.map(x=>`<div><b>${x.k}</b><small>${x.t}</small></div>`).join("");searchResults.classList.add("show");[...searchResults.children].forEach((el,i)=>el.onclick=()=>{const r=res[i];searchResults.classList.remove("show"); if(r.go)r.go(); else if(r.url) window.open(r.url,"_blank","noopener")})};document.addEventListener("click",e=>{if(!e.target.closest(".searchBox"))searchResults.classList.remove("show")})});