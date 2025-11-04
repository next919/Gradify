// Gradify — Full site with global search + Quran section (mp3quran API)
document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();

  // ===== Navbar toggle (mobile)
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  // ===== AI Tools data (editable)
  const AI_TOOLS = [
    { name:'ChatGPT', desc:'مساعد ذكي للكتابة والبرمجة والبحث السريع.', site:'https://chat.openai.com/', app:'' },
    { name:'Perplexity', desc:'بحث بالذكاء الاصطناعي مع مصادر.', site:'https://www.perplexity.ai/', app:'' },
    { name:'Claude', desc:'قراءة طويلة وتحليل ممتاز.', site:'https://claude.ai/', app:'' },
    { name:'Gemini', desc:'أدوات Google للبحث والكتابة والصور.', site:'https://gemini.google.com/', app:'' },
    { name:'Copilot', desc:'مساعد مايكروسوفت للبحث وتوليد الصور.', site:'https://copilot.microsoft.com/', app:'' }
  ];
  const aiGrid = document.getElementById('aiGrid');
  if (aiGrid) {
    AI_TOOLS.forEach(t => {
      const card = document.createElement('article');
      card.className = 'card tool';
      card.innerHTML = `<h3>${t.name}</h3><p class="muted">${t.desc}</p>
        <div class="links"><a class="btn tiny" target="_blank" rel="noopener" href="${t.site}">الموقع</a>
        ${t.app ? `<a class="btn tiny ghost" target="_blank" rel="noopener" href="${t.app}">التطبيق</a>`:''}</div>`;
      aiGrid.appendChild(card);
    });
  }

  // ===== Global search (simple client index)
  const siteSearch = document.getElementById('siteSearch');
  const resultsBox = document.getElementById('searchResults');
  const index = [
    { title:'القرآن الكريم', text:'mp3quran جميع القراء بحث وتشغيل', href:'#quran' },
    { title:'الشروحات', text:'دروس، شروحات، أدلة', href:'#tutorials' },
    { title:'مواقع الذكاء الاصطناعي', text:'ChatGPT Perplexity Claude Gemini Copilot', href:'#ai-tools' },
    { title:'تواصل', text:'بريد التواصل وروابط سريعة', href:'#contact' },
    // Also index AI tools by name/desc
    ...AI_TOOLS.map(t => ({ title:`${t.name} — أداة ذكاء اصطناعي`, text:t.desc, href:'#ai-tools' }))
  ];
  if (siteSearch && resultsBox) {
    siteSearch.addEventListener('input', () => {
      const q = siteSearch.value.trim();
      if (!q) { resultsBox.hidden = true; resultsBox.innerHTML = ''; return; }
      const matches = index.filter(i => (i.title+i.text).includes(q)).slice(0,8);
      resultsBox.innerHTML = matches.length
        ? matches.map(m => `<a href="${m.href}" onclick="document.getElementById('searchResults').hidden=true">${m.title}</a>`).join('')
        : '<span class="muted" style="padding:.5rem">لا نتائج.</span>';
      resultsBox.hidden = false;
    });
    document.addEventListener('click', (e) => {
      if (!resultsBox.contains(e.target) && e.target !== siteSearch) resultsBox.hidden = true;
    });
  }

  // ===== Quran section (API)
  const API = 'https://mp3quran.net/api/v3/reciters?language=ar';
  const SURAHS = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];

  const reciterSearch = document.getElementById('reciterSearch');
  const reciterSelect = document.getElementById('reciterSelect');
  const moshafSelect  = document.getElementById('moshafSelect');
  const surahSearch   = document.getElementById('surahSearch');
  const list = document.getElementById('surahList');

  const audio = document.getElementById('audio');
  const pTitle = document.querySelector('.p-title');
  const pSub = document.querySelector('.p-sub');
  const pToggle = document.getElementById('pToggle');
  const pStop = document.getElementById('pStop');
  const pSeek = document.getElementById('pSeek');
  const openSrc = document.getElementById('openSrc');

  let RECITERS = []; let filtered = [];
  let currentReciter = null; let currentMoshaf = null; let qSurah = '';

  fetch(API).then(r => r.json()).then(data => {
    RECITERS = data && data.reciters ? data.reciters : [];
    filtered = RECITERS;
    fillReciters();
  }).catch(() => reciterSelect.innerHTML = '<option>تعذر جلب القرّاء</option>');

  function fillReciters() {
    reciterSelect.innerHTML = '';
    filtered.forEach(r => {
      const opt = document.createElement('option'); opt.value = r.id; opt.textContent = r.name; reciterSelect.appendChild(opt);
    });
    if (filtered.length) { currentReciter = filtered[0]; fillMoshaf(); }
  }

  reciterSearch.addEventListener('input', () => {
    const q = reciterSearch.value.trim();
    filtered = !q ? RECITERS : RECITERS.filter(r => r.name.includes(q));
    fillReciters();
  });

  reciterSelect.addEventListener('change', () => {
    const id = Number(reciterSelect.value);
    currentReciter = RECITERS.find(r => r.id === id);
    fillMoshaf();
  });

  function fillMoshaf() {
    moshafSelect.innerHTML = '';
    if (!currentReciter || !currentReciter.moshaf) return;
    currentReciter.moshaf.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.server;
      opt.textContent = `${m.name} — ${m.surah_total} سورة`;
      opt.dataset.list = m.surah_list || '';
      moshafSelect.appendChild(opt);
    });
    currentMoshaf = currentReciter.moshaf[0] || null;
    renderSurahs();
  }

  moshafSelect.addEventListener('change', () => {
    currentMoshaf = {
      server: moshafSelect.value,
      name: moshafSelect.options[moshafSelect.selectedIndex].textContent,
      surah_list: moshafSelect.options[moshafSelect.selectedIndex].dataset.list
    };
    renderSurahs();
  });

  function renderSurahs() {
    list.innerHTML = '';
    if (!currentMoshaf) return;
    const available = (currentMoshaf.surah_list && String(currentMoshaf.surah_list).length)
      ? String(currentMoshaf.surah_list).split(',').map(n => Number(n.trim()))
      : Array.from({length:114}, (_,i)=>i+1);

    const filteredSurahs = available.filter(n => {
      if (!qSurah) return true;
      const name = SURAHS[n-1] || '';
      return name.includes(qSurah) || String(n) === qSurah;
    });

    filteredSurahs.forEach(n => {
      const name = SURAHS[n-1] || `سورة ${n}`;
      const card = document.createElement('div');
      card.className = 'surah';
      card.innerHTML = `
        <div class="num">${String(n).padStart(2,'0')}</div>
        <div class="meta"><strong>${name}</strong><small>${currentReciter.name}</small></div>
        <div class="play"><button class="btn tiny">تشغيل</button></div>`;
      card.querySelector('.btn').addEventListener('click', () => play(n, name));
      list.appendChild(card);
    });
  }

  surahSearch.addEventListener('input', () => { qSurah = surahSearch.value.trim(); renderSurahs(); });

  function play(n, name) {
    if (!currentMoshaf || !currentMoshaf.server) return;
    const base = currentMoshaf.server.endsWith('/') ? currentMoshaf.server : (currentMoshaf.server + '/');
    const url = base + String(n).padStart(3,'0') + '.mp3';
    if (audio.src !== url) audio.src = url;
    audio.play();
    pTitle.textContent = name;
    pSub.textContent = currentReciter.name + ' — ' + String(n).padStart(3,'0');
    pToggle.textContent = '⏸';
    openSrc.href = url; openSrc.style.display = 'inline-block';
  }

  pToggle.addEventListener('click', () => { if (!audio.src) return; if (audio.paused){ audio.play(); pToggle.textContent='⏸'; } else { audio.pause(); pToggle.textContent='▶️'; } });
  pStop.addEventListener('click', () => { if (!audio.src) return; audio.pause(); audio.currentTime = 0; pToggle.textContent = '▶️'; });
  document.getElementById('audio').addEventListener('timeupdate', () => { const a = document.getElementById('audio'); if (a.duration) pSeek.value = (a.currentTime/a.duration)*100; });
  pSeek.addEventListener('input', () => { const a = document.getElementById('audio'); if (a.duration) a.currentTime = (pSeek.value/100)*a.duration; });
});
