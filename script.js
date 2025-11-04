// Collapsible sections + lazy init for Quran, nav opens target, global search
document.addEventListener('DOMContentLoaded', () => {
  // Force close all sections on initial load (avoid appearing open on homepage)
  document.querySelectorAll('.section-acc').forEach(d => d.removeAttribute('open'));

  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();

  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); }));
  }

  // Let nav links open their target <details> section
  document.querySelectorAll('[data-open]').forEach(a => {
    a.addEventListener('click', (e) => {
      const sel = a.getAttribute('data-open');
      const details = document.querySelector(sel);
      if (details) { details.open = true; setTimeout(() => details.scrollIntoView({behavior:'smooth', block:'start'}), 50); }
    });
  });

  // Global search (simple index)
  const AI_TOOLS = [
    { name:'ChatGPT', desc:'مساعد ذكي للكتابة والبرمجة والبحث السريع.', site:'https://chat.openai.com/', app:'' },
    { name:'Perplexity', desc:'بحث بالذكاء الاصطناعي مع مصادر.', site:'https://www.perplexity.ai/', app:'' },
    { name:'Claude', desc:'قراءة طويلة وتحليل ممتاز.', site:'https://claude.ai/', app:'' },
    { name:'Gemini', desc:'أدوات Google للبحث والكتابة والصور.', site:'https://gemini.google.com/', app:'' }
  ];
  const USEFUL = [
    { name:'mp3quran', desc:'مكتبة تلاوات وروابط مباشرة', link:'https://mp3quran.net/' },
    { name:'أذكار', desc:'أذكار الصباح والمساء', link:'https://azkar.cc/' },
    { name:'ويكيبيديا', desc:'معلومات عامة', link:'https://ar.wikipedia.org/' }
  ];
  const ENGLISH = [
    { name:'Duolingo', desc:'تعلم مفردات وقواعد بطريقة ممتعة', link:'https://www.duolingo.com/' },
    { name:'BBC Learning English', desc:'دروس واستماع وقراءة', link:'https://www.bbc.co.uk/learningenglish/' },
    { name:'EngVid', desc:'فيديوهات مدرسين محترفين', link:'https://www.engvid.com/' }
  ];

  // Render AI tools / useful / english when opened (lazy)
  function renderOnce(detailsId, renderer) {
    const el = document.getElementById(detailsId);
    if (!el) return;
    el.addEventListener('toggle', () => {
      if (el.open && !el.dataset.inited) { el.dataset.inited = '1'; renderer(); }
    });
  }

  renderOnce('sec-ai', () => {
    const aiGrid = document.getElementById('aiGrid');
    AI_TOOLS.forEach(t => {
      const c = document.createElement('article'); c.className='card tool';
      c.innerHTML = `<h3>${t.name}</h3><p class="muted">${t.desc}</p>
        <div class="links"><a class="btn tiny" target="_blank" rel="noopener" href="${t.site}">الموقع</a>
        ${t.app ? `<a class="btn tiny ghost" target="_blank" rel="noopener" href="${t.app}">التطبيق</a>`:''}</div>`;
      aiGrid.appendChild(c);
    });
  });

  renderOnce('sec-useful', () => {
    const usefulGrid = document.getElementById('usefulGrid');
    USEFUL.forEach(s => {
      const c = document.createElement('article'); c.className='card';
      c.innerHTML = `<h3>${s.name}</h3><p class="muted">${s.desc}</p><a class="btn tiny" target="_blank" href="${s.link}">زيارة</a>`;
      usefulGrid.appendChild(c);
    });
  });

  renderOnce('sec-english', () => {
    const englishGrid = document.getElementById('englishGrid');
    ENGLISH.forEach(s => {
      const c = document.createElement('article'); c.className='card';
      c.innerHTML = `<h3>${s.name}</h3><p class="muted">${s.desc}</p><a class="btn tiny" target="_blank" href="${s.link}">زيارة</a>`;
      englishGrid.appendChild(c);
    });
  });

  // Simple global search
  const siteSearch = document.getElementById('siteSearch');
  const resultsBox = document.getElementById('searchResults');
  const index = [
    { title:'القرآن الكريم', text:'mp3quran جميع القراء بحث تشغيل', href:'#sec-quran', open:'#sec-quran' },
    { title:'مواقع الذكاء الاصطناعي', text:AI_TOOLS.map(t=>t.name).join(' '), href:'#sec-ai', open:'#sec-ai' },
    { title:'الشروحات', text:'دروس وأدلة', href:'#sec-tuts', open:'#sec-tuts' },
    { title:'مواقع مفيدة', text:USEFUL.map(s=>s.name).join(' '), href:'#sec-useful', open:'#sec-useful' },
    { title:'تعلم الإنجليزية', text:ENGLISH.map(s=>s.name).join(' '), href:'#sec-english', open:'#sec-english' }
  ];
  siteSearch.addEventListener('input', () => {
    const q = siteSearch.value.trim();
    if (!q) { resultsBox.hidden = true; resultsBox.innerHTML=''; return; }
    const matches = index.filter(i => (i.title + ' ' + i.text).includes(q)).slice(0,8);
    resultsBox.innerHTML = matches.length
      ? matches.map(m => `<a href="${m.href}" data-open="${m.open}">${m.title}</a>`).join('')
      : '<span class="muted" style="padding:.5rem">لا نتائج.</span>';
    resultsBox.hidden = false;
  });
  resultsBox.addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a) return;
    const sel = a.getAttribute('data-open'); const det = sel && document.querySelector(sel);
    if (det) det.open = true;
    resultsBox.hidden = true;
  });
  document.addEventListener('click', (e) => { if (!resultsBox.contains(e.target) && e.target !== siteSearch) resultsBox.hidden = true; });

  // Quran section (lazy init when opened)
  renderOnce('sec-quran', () => initQuran());

  // ===== Quran logic
  function initQuran(){
    const API = 'https://mp3quran.net/api/v3/reciters?language=ar';
    const SURAHS = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
    const reciterSearch = document.getElementById('reciterSearch');
    const reciterSelect = document.getElementById('reciterSelect');
    const moshafSelect  = document.getElementById('moshafSelect');
    const surahSearch   = document.getElementById('surahSearch');
    const list          = document.getElementById('surahList');

    const audio = document.getElementById('audio');
    const pTitle = document.querySelector('.p-title');
    const pSub   = document.querySelector('.p-sub');
    const pToggle= document.getElementById('pToggle');
    const pStop  = document.getElementById('pStop');
    const pSeek  = document.getElementById('pSeek');
    const openSrc= document.getElementById('openSrc');

    reciterSearch.disabled = reciterSelect.disabled = moshafSelect.disabled = surahSearch.disabled = false;

    let RECITERS = []; let filtered = [];
    let currentReciter = null; let currentMoshaf = null; let qSurah = '';

    function useFallback(){
      RECITERS = [{
        id: 99901, name:'عبد الباسط (مرتل) — بديل',
        moshaf:[{ name:'افتراضي', surah_total:114, server:'https://server7.mp3quran.net/basit/', surah_list:'' }]
      },{
        id: 99902, name:'المنشاوي (مرتل) — بديل',
        moshaf:[{ name:'افتراضي', surah_total:114, server:'https://server7.mp3quran.net/minsh/', surah_list:'' }]
      }];
      filtered = RECITERS; fillReciters();
    }

    fetch(API).then(r => r.json()).then(data => {
      RECITERS = data && data.reciters ? data.reciters : [];
      filtered = RECITERS.length ? RECITERS : (useFallback(), []);
      if (RECITERS.length) fillReciters();
    }).catch(useFallback);

    function fillReciters(){
      reciterSelect.innerHTML = '';
      filtered.forEach(r => { const opt=document.createElement('option'); opt.value=r.id; opt.textContent=r.name; reciterSelect.appendChild(opt); });
      if (filtered.length){ currentReciter = filtered[0]; fillMoshaf(); }
    }

    reciterSearch.addEventListener('input', () => {
      const q = reciterSearch.value.trim();
      filtered = !q ? RECITERS : RECITERS.filter(r => r.name.includes(q));
      fillReciters();
    });

    reciterSelect.addEventListener('change', () => {
      const id = Number(reciterSelect.value);
      currentReciter = RECITERS.find(r => r.id === id) || filtered.find(r => String(r.id)===String(id));
      fillMoshaf();
    });

    function fillMoshaf(){
      moshafSelect.innerHTML = '';
      if (!currentReciter || !currentReciter.moshaf) return;
      currentReciter.moshaf.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.server; opt.textContent = `${m.name} — ${m.surah_total} سورة`; opt.dataset.list = m.surah_list || '';
        moshafSelect.appendChild(opt);
      });
      currentMoshaf = currentReciter.moshaf[0] || null;
      renderSurahs();
    }

    moshafSelect.addEventListener('change', () => {
      currentMoshaf = { server: moshafSelect.value,
        name: moshafSelect.options[moshafSelect.selectedIndex].textContent,
        surah_list: moshafSelect.options[moshafSelect.selectedIndex].dataset.list };
      renderSurahs();
    });

    function renderSurahs(){
      list.innerHTML = '';
      if (!currentMoshaf) return;
      const available = (currentMoshaf.surah_list && String(currentMoshaf.surah_list).length)
        ? String(currentMoshaf.surah_list).split(',').map(n => Number(n.trim()))
        : Array.from({length:114}, (_,i)=>i+1);

      const filteredSurahs = available.filter(n => {
        if (!qSurah) return true; const name = SURAHS[n-1] || ''; return name.includes(qSurah) || String(n)===qSurah;
      });

      filteredSurahs.forEach(n => {
        const name = SURAHS[n-1] || `سورة ${n}`;
        const card = document.createElement('div'); card.className='surah';
        card.innerHTML = `<div class="num">${String(n).padStart(2,'0')}</div>
          <div class="meta"><strong>${name}</strong><small>${currentReciter.name}</small></div>
          <div class="play"><button class="btn tiny">تشغيل</button></div>`;
        card.querySelector('.btn').addEventListener('click', () => play(n, name));
        list.appendChild(card);
      });
    }

    surahSearch.addEventListener('input', () => { qSurah = surahSearch.value.trim(); renderSurahs(); });

    function play(n, name){
      if (!currentMoshaf || !currentMoshaf.server) return;
      const base = currentMoshaf.server.endsWith('/') ? currentMoshaf.server : (currentMoshaf.server + '/');
      const url = base + String(n).padStart(3,'0') + '.mp3';
      if (audio.src !== url) audio.src = url;
      audio.play();
      pTitle.textContent = name; pSub.textContent = currentReciter.name + ' — ' + String(n).padStart(3,'0');
      document.getElementById('pToggle').textContent = '⏸';
      const open = document.getElementById('openSrc'); open.href = url; open.style.display='inline-block';
    }

    document.getElementById('pToggle').addEventListener('click', () => {
      if (!audio.src) return;
      if (audio.paused){ audio.play(); document.getElementById('pToggle').textContent='⏸'; }
      else { audio.pause(); document.getElementById('pToggle').textContent='▶️'; }
    });
    document.getElementById('pStop').addEventListener('click', () => { if (!audio.src) return; audio.pause(); audio.currentTime=0; document.getElementById('pToggle').textContent='▶️'; });
    audio.addEventListener('timeupdate', () => { if (audio.duration) document.getElementById('pSeek').value = (audio.currentTime/audio.duration)*100; });
    document.getElementById('pSeek').addEventListener('input', (e) => { if (audio.duration) audio.currentTime = (e.target.value/100)*audio.duration; });
  }
});
