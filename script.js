document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  const READERS = [
    { id:'basit',   name:'عبد الباسط (مرتل)', host:'server7.mp3quran.net',  path:'basit' },
    { id:'minsh',   name:'المنشاوي (مرتل)',   host:'server7.mp3quran.net',  path:'minsh' },
    { id:'sds',     name:'السديس',            host:'server11.mp3quran.net', path:'sds'   },
    { id:'afs',     name:'العفاسي',           host:'server11.mp3quran.net', path:'afs'   }
  ];

  const SURAHS = ['الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس'];
  const pad3 = n => String(n).padStart(3,'0');
  const buildUrl = (rId, n) => { const r = READERS.find(x=>x.id===rId); return `https://${r.host}/${r.path}/${pad3(n)}.mp3`; };

  let currentReader = READERS[0].id;
  let query = '';

  const readersWrap = document.querySelector('.readers');
  const list = document.getElementById('surahList');
  const searchBox = document.getElementById('searchBox');
  const audio = document.getElementById('audio');
  const pTitle = document.querySelector('.p-title');
  const pSub = document.querySelector('.p-sub');
  const pToggle = document.getElementById('pToggle');
  const pStop = document.getElementById('pStop');
  const pSeek = document.getElementById('pSeek');
  const openSrc = document.getElementById('openSrc');

  function renderReaders(){
    readersWrap.innerHTML = '';
    READERS.forEach(r => {
      const b = document.createElement('button');
      b.className = 'reader-pill'; b.setAttribute('role','tab');
      b.setAttribute('aria-selected', String(r.id===currentReader));
      b.textContent = r.name;
      b.addEventListener('click', ()=>{ currentReader=r.id; renderReaders(); renderList(); });
      readersWrap.appendChild(b);
    });
  }

  function renderList(){
    list.innerHTML = '';
    const q = query.trim();
    SURAHS.forEach((name, idx) => {
      const num = idx+1;
      const match = !q || name.includes(q) || String(num)===q;
      if(!match) return;
      const el = document.createElement('div');
      el.className = 'surah';
      el.innerHTML = `
        <div class="num">${num.toLocaleString('ar-EG')}</div>
        <div class="meta"><strong>${name}</strong><small>${READERS.find(r=>r.id===currentReader).name}</small></div>
        <div class="play"><button class="play-btn">تشغيل</button></div>`;
      el.querySelector('.play-btn').addEventListener('click', ()=>play(num, name));
      list.appendChild(el);
    });
  }

  function play(n, name){
    const url = buildUrl(currentReader, n);
    if(audio.src !== url) audio.src = url;
    audio.play();
    pTitle.textContent = name;
    pSub.textContent = READERS.find(r=>r.id===currentReader).name + ' — ' + String(n).padStart(3,'0');
    pToggle.textContent = '⏸';
    openSrc.href = url; openSrc.style.display='inline-block';
  }

  pToggle.addEventListener('click', ()=>{ if(!audio.src) return; if(audio.paused){audio.play(); pToggle.textContent='⏸';} else {audio.pause(); pToggle.textContent='▶️';} });
  pStop.addEventListener('click', ()=>{ if(!audio.src) return; audio.pause(); audio.currentTime=0; pToggle.textContent='▶️'; });
  audio.addEventListener('timeupdate', ()=>{ if(audio.duration) pSeek.value = (audio.currentTime/audio.duration)*100; });
  pSeek.addEventListener('input', ()=>{ if(audio.duration) audio.currentTime = (pSeek.value/100)*audio.duration; });
  searchBox.addEventListener('input', ()=>{ query = searchBox.value; renderList(); });

  renderReaders(); renderList();
});
