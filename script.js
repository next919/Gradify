// Gradify home page
const SURAHS = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];

// [name, description, url]
const AI = {
  "محادثة وكتابة": [
    ["ChatGPT", "مساعد للمحادثة والكتابة والشرح والبرمجة.", "https://chatgpt.com"],
    ["Claude", "مساعد قوي في الكتابة الطويلة وتحليل الملفات.", "https://claude.ai"],
    ["Gemini", "مساعد Google مع تكامل خدماتها.", "https://gemini.google.com"],
    ["Microsoft Copilot", "مساعد مايكروسوفت المدمج مع Office.", "https://copilot.microsoft.com"],
    ["DeepSeek", "نموذج قوي في الرياضيات والبرمجة.", "https://chat.deepseek.com"],
    ["Poe", "عدة نماذج ذكاء في منصة واحدة.", "https://poe.com"],
  ],
  "بحث ومذاكرة": [
    ["Perplexity", "بحث ذكي مع مصادر لكل إجابة.", "https://www.perplexity.ai"],
    ["NotebookLM", "ارفع ملخصاتك وكتبك واسأل عنها مباشرة.", "https://notebooklm.google.com"],
    ["Consensus", "إجابات من الأبحاث العلمية المحكّمة.", "https://consensus.app"],
    ["Elicit", "مساعد للبحث العلمي ومراجعة الدراسات.", "https://elicit.com"],
    ["Khanmigo", "مساعد تعليمي من أكاديمية خان.", "https://www.khanmigo.ai"],
  ],
  "صور وتصميم": [
    ["Canva", "تصميم سهل بقوالب جاهزة وأدوات ذكية.", "https://www.canva.com"],
    ["Midjourney", "توليد صور فنية عالية الجودة.", "https://www.midjourney.com"],
    ["Adobe Firefly", "توليد وتعديل الصور من أدوبي.", "https://firefly.adobe.com"],
    ["Leonardo AI", "توليد صور وتصاميم بأساليب متنوعة.", "https://leonardo.ai"],
    ["Ideogram", "صور تحتوي نصوصًا واضحة، مناسبة للشعارات.", "https://ideogram.ai"],
    ["Gamma", "عروض تقديمية جاهزة من فكرة أو ملف.", "https://gamma.app"],
  ],
  "فيديو وصوت": [
    ["Runway", "توليد وتحرير الفيديو بالذكاء الاصطناعي.", "https://runwayml.com"],
    ["ElevenLabs", "تحويل النص إلى صوت واقعي بعدة لغات.", "https://elevenlabs.io"],
    ["Descript", "تحرير الصوت والفيديو بتعديل النص المكتوب.", "https://www.descript.com"],
    ["Synthesia", "فيديوهات بمقدّم افتراضي من النص.", "https://www.synthesia.io"],
    ["Suno", "تأليف مقاطع صوتية وموسيقية من وصف.", "https://suno.com"],
  ],
  "برمجة": [
    ["GitHub Copilot", "إكمال الكود واقتراحات أثناء البرمجة.", "https://github.com/features/copilot"],
    ["Cursor", "محرر أكواد مبني حول الذكاء الاصطناعي.", "https://cursor.com"],
    ["Replit", "برمجة ونشر من المتصفح مع مساعد ذكي.", "https://replit.com"],
    ["Hugging Face", "آلاف النماذج الجاهزة للتجربة.", "https://huggingface.co"],
  ],
  "تدقيق وصياغة": [
    ["Grammarly", "تدقيق الكتابة الإنجليزية وتحسين الأسلوب.", "https://www.grammarly.com"],
    ["QuillBot", "إعادة صياغة وتلخيص النصوص.", "https://quillbot.com"],
    ["Notion AI", "تلخيص وكتابة داخل ملاحظاتك.", "https://www.notion.com/product/ai"],
  ],
};

const EN = {
  "الاستماع": [
    ["BBC Learning English", "مقاطع قصيرة مع نصوص وتمارين.", "https://www.bbc.co.uk/learningenglish"],
    ["VOA Learning English", "أخبار مبسّطة بسرعة مناسبة للمتعلم.", "https://learningenglish.voanews.com"],
    ["ELLLO", "حوارات حقيقية قصيرة مع تفريغ نصي.", "https://elllo.org"],
    ["TED Talks", "محاضرات ملهمة مع ترجمة.", "https://www.ted.com/talks"],
  ],
  "شامل": [
    ["British Council", "دروس لكل المهارات والمستويات.", "https://learnenglish.britishcouncil.org"],
    ["Khan Academy Grammar", "القواعد بشرح وتمارين.", "https://www.khanacademy.org/humanities/grammar"],
    ["Coursera — English", "دورات من جامعات عالمية.", "https://www.coursera.org/browse/language-learning/learning-english"],
  ],
  "الكتابة والمفردات": [
    ["Cambridge Dictionary", "قاموس مع النطق والأمثلة.", "https://dictionary.cambridge.org"],
    ["Vocabulary.com", "تعلّم الكلمات بالتدريب الذكي.", "https://www.vocabulary.com"],
    ["Quizlet", "بطاقات مراجعة للمفردات.", "https://quizlet.com"],
    ["Hemingway Editor", "اجعل كتابتك أوضح وأبسط.", "https://hemingwayapp.com"],
  ],
  "للأطفال": [
    ["British Council Kids", "ألعاب وقصص وأغانٍ للصغار.", "https://learnenglishkids.britishcouncil.org"],
    ["Starfall", "تعلّم القراءة للمبتدئين.", "https://www.starfall.com/h/"],
    ["Nat Geo Kids", "قراءة علمية ممتعة.", "https://kids.nationalgeographic.com"],
  ],
  "لغات أخرى": [
    ["Duolingo", "تعلّم عشرات اللغات بأسلوب ممتع.", "https://www.duolingo.com"],
    ["Memrise", "مفردات بنطق متحدثين حقيقيين.", "https://www.memrise.com"],
    ["Busuu", "دروس مع تصحيح من متحدثين أصليين.", "https://www.busuu.com"],
  ],
};

const USEFUL = [
  ["Remove.bg", "إزالة خلفية الصور بضغطة.", "https://www.remove.bg"],
  ["TinyPNG", "ضغط الصور بدون فقدان واضح للجودة.", "https://tinypng.com"],
  ["Photopea", "بديل فوتوشوب يعمل في المتصفح.", "https://www.photopea.com"],
  ["Squoosh", "تغيير حجم وصيغة الصور.", "https://squoosh.app"],
  ["Desmos", "آلة حاسبة ورسم بياني للرياضيات.", "https://www.desmos.com/calculator"],
  ["Wolfram Alpha", "حل المسائل خطوة بخطوة.", "https://www.wolframalpha.com"],
  ["Zotero", "تنظيم المراجع والتوثيق للبحوث.", "https://www.zotero.org"],
  ["WeTransfer", "إرسال الملفات الكبيرة.", "https://wetransfer.com"],
  ["Archive.org", "مكتبة رقمية لكتب وملفات قديمة.", "https://archive.org"],
];

const PALETTE = [
  ["var(--violet-soft)", "var(--violet)"], ["var(--blue-soft)", "var(--blue)"], ["var(--primary-soft)", "var(--primary)"],
  ["var(--amber-soft)", "var(--amber)"], ["var(--rose-soft)", "var(--rose)"], ["var(--gold-soft)", "#a46b10"],
];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function cardHTML([name, desc, url], colorIndex) {
  const [bg, fg] = PALETTE[colorIndex % PALETTE.length];
  const letter = name.replace(/^the\s+/i, "").charAt(0).toUpperCase();
  return `<a class="card" href="${esc(url)}" target="_blank" rel="noopener">
    <div class="head"><span class="mono" style="background:${bg};color:${fg}">${esc(letter)}</span><h3 dir="auto">${esc(name)}</h3></div>
    <p>${esc(desc)}</p></a>`;
}

function tabbed(groups, tabsSel, gridSel, allLabel) {
  const names = Object.keys(groups);
  const tabs = [allLabel, ...names].filter(Boolean);
  const tabsEl = $(tabsSel), gridEl = $(gridSel);
  const show = (t) => {
    tabsEl.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.t === t));
    const items = t === allLabel ? names.flatMap((n, i) => groups[n].map((x) => [x, i])) : groups[t].map((x) => [x, names.indexOf(t)]);
    gridEl.innerHTML = items.map(([x, i]) => cardHTML(x, i)).join("");
  };
  tabsEl.innerHTML = tabs.map((t) => `<button class="tab" type="button" data-t="${esc(t)}">${esc(t)}</button>`).join("");
  tabsEl.addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) show(b.dataset.t); });
  show(tabs[0]);
}

// ---------- search ----------
const norm = (s) => (s || "").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase();
function buildIndex() {
  const idx = [
    { k: "محرر PDF تعديل ملفات pdf", label: "محرر PDF العربي", t: "أداة", url: "pdf/" },
    { k: "نداء مواقيت الصلاة الأذان برنامج", label: "نداء — مواقيت الصلاة", t: "أداة", url: "nidaa/" },
    { k: "حاسبة المعدل gpa تراكمي", label: "حاسبة المعدل", t: "أداة", url: "gpa.html" },
    { k: "القرآن الكريم مصحف قراءة استماع تفسير", label: "القرآن الكريم", t: "قسم", url: "quran/" },
    { k: "تواصل معنا اتصل", label: "تواصل معنا", t: "قسم", url: "#contact" },
  ];
  SURAHS.forEach((n, i) => idx.push({ k: `سورة ${n} ${i + 1}`, label: `سورة ${n}`, t: `السورة ${i + 1}`, url: `quran/#s=${i + 1}` }));
  const ext = (groups, t) => Object.values(groups).flat().forEach(([n, d, u]) => idx.push({ k: `${n} ${d}`, label: n, t, url: u, ext: true }));
  ext(AI, "ذكاء اصطناعي"); ext(EN, "الإنجليزية"); ext({ x: USEFUL }, "موقع مفيد");
  return idx;
}

function initSearch() {
  const input = $("#globalSearch"), box = $("#searchResults");
  const idx = buildIndex();
  input.addEventListener("input", () => {
    const q = norm(input.value.trim());
    if (!q) { box.classList.remove("show"); return; }
    const res = idx.filter((x) => norm(x.k).includes(q)).slice(0, 14);
    box.innerHTML = res.length
      ? res.map((x, i) => `<div data-i="${i}"><b>${esc(x.label)}</b><small>${esc(x.t)}</small></div>`).join("")
      : '<div><small>لا توجد نتائج</small></div>';
    box.classList.add("show");
    box.onclick = (e) => {
      const el = e.target.closest("[data-i]"); if (!el) return;
      const r = res[+el.dataset.i];
      box.classList.remove("show"); input.value = "";
      if (r.ext) window.open(r.url, "_blank", "noopener"); else location.href = r.url;
    };
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { const f = box.querySelector("[data-i]"); if (f) f.click(); } });
  document.addEventListener("click", (e) => { if (!e.target.closest(".searchBox")) box.classList.remove("show"); });
}

// ---------- verse of the day ----------
async function dailyAyah() {
  const day = Math.floor(Date.now() / 86400000);
  const n = ((day * 7919) % 6236) + 1;
  try {
    const r = await fetch(`https://api.alquran.cloud/v1/ayah/${n}/editions/quran-uthmani,ar.alafasy`);
    const [t, a] = (await r.json()).data;
    let text = t.text.replace(/^﻿/, "");
    const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
    if (t.numberInSurah === 1 && t.surah.number !== 1 && text.startsWith(BASMALA)) text = text.slice(BASMALA.length).trim();
    $("#dailyText").textContent = text;
    $("#dailySurah").textContent = `سورة ${SURAHS[t.surah.number - 1]} — الآية ${t.numberInSurah}`;
    $("#dailyOpen").href = `quran/#s=${t.surah.number}&a=${t.numberInSurah}`;
    const audio = new Audio();
    audio.preload = "none";
    audio.src = a.audio;
    const btn = $("#dailyPlay");
    btn.disabled = false;
    btn.onclick = () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
    audio.onplay = () => { btn.textContent = "❚❚ إيقاف"; };
    audio.onpause = audio.onended = () => { btn.textContent = "▶ استمع"; };
  } catch (e) {
    $("#dailyText").textContent = "إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا";
    $("#dailySurah").textContent = "سورة الشرح — الآية 6";
  }
}

// ---------- contact ----------
function initContact() {
  const form = $("#contactForm"), note = $("#formNote");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; note.className = "formNote"; note.textContent = "جارٍ الإرسال…";
    try {
      const r = await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { Accept: "application/json" }, body: new FormData(form) });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "error");
      form.reset(); note.className = "formNote ok"; note.textContent = "✓ وصلتنا رسالتك، شكرًا لك.";
    } catch (err) {
      note.className = "formNote err"; note.textContent = "تعذّر الإرسال. تأكد من الاتصال وجرّب مرة أخرى.";
    } finally { btn.disabled = false; }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  $("#menuBtn").onclick = () => $("#nav").classList.toggle("open");
  $("#nav").addEventListener("click", (e) => { if (e.target.closest("a")) $("#nav").classList.remove("open"); });
  tabbed(AI, "#aiTabs", "#aiGrid", "الكل");
  tabbed(EN, "#enTabs", "#enGrid", "الكل");
  $("#usefulGrid").innerHTML = USEFUL.map((x, i) => cardHTML(x, i)).join("");
  initSearch();
  initContact();
  dailyAyah();
});
