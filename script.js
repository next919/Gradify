document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('mainNav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false');
  }));

  const themeBtn = document.getElementById('themeToggle');
  themeBtn?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    themeBtn.setAttribute('aria-pressed', String(next === 'dark'));
  });

  // ===== Quran data (editable) =====
  const QURAN_DATA = [
    { id:'abdulbasit', name:'الشيخ عبد الباسط', surahs:[
      { num:1, title:'الفاتحة', url:'https://download.quranicaudio.com/quran/abdul_baset/mujawwad/001.mp3' },
      { num:36, title:'يس', url:'https://download.quranicaudio.com/quran/abdul_baset/mujawwad/036.mp3' },
      { num:55, title:'الرحمن', url:'https://download.quranicaudio.com/quran/abdul_baset/mujawwad/055.mp3' }
    ]},
    { id:'minshawi', name:'الشيخ المنشاوي', surahs:[
      { num:19, title:'مريم', url:'https://download.quranicaudio.com/quran/minshawi/murattal/019.mp3' },
      { num:67, title:'الملك', url:'https://download.quranicaudio.com/quran/minshawi/murattal/067.mp3' },
      { num:112, title:'الإخلاص', url:'https://download.quranicaudio.com/quran/minshawi/murattal/112.mp3' }
    ]}
  ];

  const readersWrap = document.querySelector('.readers');
  const surahList = document.getElementById('surahList');
  let currentReader = QURAN_DATA[0].id;

  function renderReaders(){
    readersWrap.innerHTML = '';
    QURAN_DATA.forEach(r => {
      const b = document.createElement('button');
      b.className = 'reader-pill'; b.setAttribute('role','tab');
      b.setAttribute('aria-selected', String(r.id === currentReader));
      b.textContent = r.name;
      b.addEventListener('click', () => { currentReader = r.id; renderReaders(); renderSurahs(); });
      readersWrap.appendChild(b);
    });
  }

  function renderSurahs(){
    const reader = QURAN_DATA.find(r => r.id === currentReader);
    surahList.innerHTML = '';
    reader.surahs.forEach(s => {
      const el = document.createElement('div');
      el.className = 'surah';
      el.innerHTML = `
        <div class="num">${s.num}</div>
        <div class="meta"><strong>${s.title}</strong><small>${reader.name}</small></div>
        <div class="play"><button class="play-btn">تشغيل</button></div>`;
      el.querySelector('.play-btn').addEventListener('click', () => playTrack(s.url, s.title, reader.name));
      surahList.appendChild(el);
    });
  }

  renderReaders(); renderSurahs();

  // Sticky player
  const audio = document.getElementById('audio');
  const pTitle = document.querySelector('.p-title');
  const pSub = document.querySelector('.p-sub');
  const pToggle = document.getElementById('pToggle');
  const pStop = document.getElementById('pStop');
  const pSeek = document.getElementById('pSeek');

  function playTrack(url, title, reader){
    if(audio.src !== url){ audio.src = url; }
    audio.play();
    pTitle.textContent = title;
    pSub.textContent = reader;
    pToggle.textContent = '⏸';
  }
  pToggle.addEventListener('click', () => {
    if(!audio.src) return;
    if(audio.paused){ audio.play(); pToggle.textContent = '⏸'; }
    else { audio.pause(); pToggle.textContent = '▶️'; }
  });
  pStop.addEventListener('click', () => {
    if(!audio.src) return;
    audio.pause(); audio.currentTime = 0; pToggle.textContent = '▶️';
  });
  audio.addEventListener('timeupdate', () => {
    if(audio.duration) pSeek.value = (audio.currentTime / audio.duration) * 100;
  });
  pSeek.addEventListener('input', () => {
    if(audio.duration) audio.currentTime = (pSeek.value / 100) * audio.duration;
  });

  // ===== AI Tools (editable) =====
  const AI_TOOLS = [
    {
      name: 'ChatGPT',
      desc: 'مساعد ذكي للكتابة والبرمجة والبحث السريع. مناسب للأفكار، التلخيص، والأكواد.',
      site: 'https://chat.openai.com/',
      app: ''
    },
    {
      name: 'Perplexity',
      desc: 'محرك بحث قائم على الذكاء الاصطناعي يوفّر إجابات مع مصادر موثوقة.',
      site: 'https://www.perplexity.ai/',
      app: ''
    },
    {
      name: 'Claude',
      desc: 'مساعد ذكي من Anthropic ممتاز في القراءة الطويلة والتحليل.',
      site: 'https://claude.ai/',
      app: ''
    },
    {
      name: 'Gemini',
      desc: 'أدوات Google للذكاء الاصطناعي للبحث والكتابة والصور.',
      site: 'https://gemini.google.com/',
      app: ''
    },
    {
      name: 'Microsoft Copilot',
      desc: 'مساعد يعمل مع خدمات مايكروسوفت وBing، جيد للبحث السريع وتوليد الصور.',
      site: 'https://copilot.microsoft.com/',
      app: ''
    },
    {
      name: 'Midjourney',
      desc: 'مولّد صور قوي (من خلال Discord) لإنشاء تصاميم وصور إبداعية.',
      site: 'https://www.midjourney.com/',
      app: ''
    },
    {
      name: 'Leonardo AI',
      desc: 'توليد صور وتصميمات جاهزة للاستخدام مع تحكم أكبر في الأنماط.',
      site: 'https://leonardo.ai/',
      app: ''
    },
    {
      name: 'Runway',
      desc: 'أدوات فيديو وصوت وصور مدعومة بالذكاء الاصطناعي — تحرير وإخراج سريع.',
      site: 'https://runwayml.com/',
      app: ''
    }
  ];

  const aiGrid = document.getElementById('aiGrid');
  function renderTools(){
    aiGrid.innerHTML = '';
    AI_TOOLS.forEach(t => {
      const card = document.createElement('article');
      card.className = 'card tool';
      card.innerHTML = `
        <h3>${t.name}</h3>
        <p class="muted">${t.desc}</p>
        <div class="links">
          <a class="btn tiny" target="_blank" rel="noopener" href="${t.site}">الموقع</a>
          ${t.app ? `<a class="btn tiny ghost" target="_blank" rel="noopener" href="${t.app}">التطبيق</a>` : ''}
        </div>
      `;
      aiGrid.appendChild(card);
    });
  }
  renderTools();
});
