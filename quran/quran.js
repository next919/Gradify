// Gradify — Quran: read & listen ayah by ayah, repeat for memorization, full-surah listening, search.
const API = "https://api.alquran.cloud/v1";
const RECITERS = [
  ["ar.alafasy", "مشاري العفاسي"], ["ar.husary", "محمود خليل الحصري"], ["ar.husarymujawwad", "الحصري (مجوّد)"],
  ["ar.abdulsamad", "عبدالباسط عبدالصمد"], ["ar.abdurrahmaansudais", "عبدالرحمن السديس"], ["ar.saoodshuraym", "سعود الشريم"],
  ["ar.mahermuaiqly", "ماهر المعيقلي"], ["ar.ahmedajamy", "أحمد بن علي العجمي"], ["ar.hudhaify", "علي الحذيفي"],
  ["ar.muhammadayyoub", "محمد أيوب"], ["ar.muhammadjibreel", "محمد جبريل"], ["ar.shaatree", "أبو بكر الشاطري"],
  ["ar.abdullahbasfar", "عبدالله بصفر"], ["ar.hanirifai", "هاني الرفاعي"], ["ar.ibrahimakhbar", "إبراهيم الأخضر"],
  ["ar.aymanswoaid", "أيمن سويد"],
];
const NAMES = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const MEDINAN = new Set([2,3,4,5,8,9,22,24,33,47,48,49,55,57,58,59,60,61,62,63,64,65,66,76,98,99,110]);
const BASMALA_RE = /^بِسْمِ\s+\S+\s+\S+\s+\S+\s*/;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const arNum = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const pad3 = (n) => String(n).padStart(3, "0");

// ---------- settings ----------
const DEFAULTS = { volume: 1, reciter: "ar.alafasy", repAyah: "1", repRange: "1", speed: "1", size: 1.9, tafsir: false, hifz: false, basmala: true, follow: true, surah: 1 };
let prefs = { ...DEFAULTS };
try { prefs = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("gradify-quran") || "{}") }; } catch (e) { /* private mode */ }
const savePrefs = () => { try { localStorage.setItem("gradify-quran", JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

// ---------- state ----------
const S = { surah: 1, ayahs: [], audioOk: false, idx: -1, ayahPlays: 0, rangePlays: 0, inBasmala: false, started: false, loadSeq: 0 };
const audio = new Audio();
audio.preload = "auto";
const preloader = new Audio();
preloader.preload = "auto";

// ---------- read mode ----------
function fillSelects() {
  $("#surah").innerHTML = NAMES.map((n, i) => `<option value="${i + 1}">${i + 1}. ${n}</option>`).join("");
  $("#reciter").innerHTML = RECITERS.map(([id, n]) => `<option value="${id}">${n}</option>`).join("");
  $("#reciter").value = prefs.reciter;
  $("#repAyah").value = prefs.repAyah;
  $("#repRange").value = prefs.repRange;
  $("#speed").value = prefs.speed;
  $("#optTafsir").checked = prefs.tafsir;
  $("#optHifz").checked = prefs.hifz;
  $("#optBasmala").checked = prefs.basmala;
  $("#optFollow").checked = prefs.follow;
  document.documentElement.style.setProperty("--qsize", prefs.size + "rem");
}

function fillRange(count, from = 1, to = count) {
  const opts = Array.from({ length: count }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  $("#from").innerHTML = opts; $("#to").innerHTML = opts;
  $("#from").value = from; $("#to").value = to;
}
const range = () => {
  let a = +$("#from").value, b = +$("#to").value;
  if (a > b) [a, b] = [b, a];
  return [a - 1, b - 1];
};

async function loadSurah(n, focusAyah = 0) {
  stop();
  const seq = ++S.loadSeq;
  S.surah = n; prefs.surah = n; savePrefs();
  $("#surah").value = n;
  $("#surahTitle").textContent = "سورة " + NAMES[n - 1];
  $("#surahMeta").textContent = `${MEDINAN.has(n) ? "مدنية" : "مكية"} • ${arNum(COUNTS[n - 1])} آية`;
  $("#basmala").hidden = n === 1 || n === 9;
  $("#ayat").innerHTML = '<div class="loading">جارٍ تحميل السورة…</div>';
  fillRange(COUNTS[n - 1], focusAyah || 1);
  try {
    const r = await fetch(`${API}/surah/${n}/editions/quran-uthmani,${prefs.reciter},ar.muyassar`);
    const j = await r.json();
    if (seq !== S.loadSeq) return;
    const [text, aud, taf] = j.data;
    S.ayahs = text.ayahs.map((a, i) => {
      let t = a.text.replace(/^﻿/, "");
      if (i === 0 && n !== 1 && n !== 9) t = t.replace(BASMALA_RE, "");
      return { n: a.numberInSurah, text: t, audio: aud.ayahs[i].audio, tafsir: taf.ayahs[i].text };
    });
    renderAyat();
    if (focusAyah) { highlight(focusAyah - 1, true); }
    updateInfo();
  } catch (e) {
    if (seq === S.loadSeq) $("#ayat").innerHTML = '<div class="loading">تعذّر تحميل السورة. تأكد من الاتصال وحاول مرة أخرى.</div>';
  }
}

async function changeReciter() {
  prefs.reciter = $("#reciter").value; savePrefs();
  const wasPlaying = !audio.paused, at = S.idx;
  stop();
  try {
    const r = await fetch(`${API}/surah/${S.surah}/${prefs.reciter}`);
    const j = await r.json();
    j.data.ayahs.forEach((a, i) => { if (S.ayahs[i]) S.ayahs[i].audio = a.audio; });
    if (wasPlaying && at >= 0) { S.started = true; playAyah(at); }
  } catch (e) { /* keep old audio */ }
  updateInfo();
}

function renderAyat() {
  const list = $("#optTafsir").checked;
  const box = $("#ayat");
  box.classList.toggle("list", list);
  box.classList.toggle("hifz", $("#optHifz").checked);
  $("#hifzHint").hidden = !$("#optHifz").checked;
  box.innerHTML = S.ayahs.map((a, i) =>
    `<span class="ayah" data-i="${i}"><span class="t">${esc(a.text)}</span> <span class="num">۝${arNum(a.n)}</span>${list ? `<span class="tafsir">${esc(a.tafsir)}</span>` : ""}</span> `
  ).join("");
  if (S.idx >= 0) highlight(S.idx, false);
}

function highlight(i, scroll) {
  document.querySelectorAll(".ayah.current").forEach((el) => el.classList.remove("current"));
  const el = document.querySelector(`.ayah[data-i="${i}"]`);
  if (!el) return;
  el.classList.add("current");
  if (scroll && $("#optFollow").checked) {
    const r = el.getBoundingClientRect();
    if (r.top < 90 || r.bottom > innerHeight - 110) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// ---------- playback ----------
function needBasmala(i) {
  const [from] = range();
  return $("#optBasmala").checked && i === from && from === 0 && S.surah !== 1 && S.surah !== 9;
}

function play(src) {
  audio.src = src;
  audio.playbackRate = +$("#speed").value;
  audio.play().catch(() => {});
}

function playAyah(i) {
  const a = S.ayahs[i];
  if (!a) return;
  S.idx = i;
  highlight(i, true);
  updateInfo();
  play(a.audio);
  const next = S.ayahs[i + 1];
  if (next) preloader.src = next.audio;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: `سورة ${NAMES[S.surah - 1]} — الآية ${a.n}`, artist: $("#reciter").selectedOptions[0].textContent, album: "القرآن الكريم — Gradify" });
  }
}

function start(fromIdx) {
  const [from] = range();
  const i = fromIdx ?? from;
  S.started = true; S.ayahPlays = 0; S.rangePlays = 0;
  if (needBasmala(i)) {
    S.inBasmala = true; S.idx = i; highlight(i, true); updateInfo("البسملة");
    play(S.ayahs[0].audio.replace(/\/\d+\.mp3$/, "/1.mp3"));
  } else { S.inBasmala = false; playAyah(i); }
}

function stop() {
  audio.pause(); S.started = false; S.inBasmala = false;
  setPlayIcon(false);
}

audio.addEventListener("ended", () => {
  if (!S.started) return;
  if (S.inBasmala) { S.inBasmala = false; playAyah(S.idx); return; }
  const repA = +$("#repAyah").value, repR = +$("#repRange").value;
  const [from, to] = range();
  S.ayahPlays++;
  if (repA === 0 || S.ayahPlays < repA) { playAyah(S.idx); return; }
  S.ayahPlays = 0;
  if (S.idx < to) { playAyah(S.idx + 1); return; }
  S.rangePlays++;
  if (repR === 0 || S.rangePlays < repR) { playAyah(from); return; }
  S.started = false; setPlayIcon(false); updateInfo("انتهت التلاوة");
});
audio.addEventListener("play", () => setPlayIcon(true));
audio.addEventListener("pause", () => setPlayIcon(false));
audio.addEventListener("error", () => { if (S.started) updateInfo("تعذّر تشغيل الصوت، جرّب قارئًا آخر"); });

function setPlayIcon(on) {
  const b = $("#pPlay");
  b.textContent = on ? "❚❚" : "▶"; b.title = on ? "إيقاف مؤقت" : "تشغيل";
  b.classList.toggle("playing", on);
}

function updateInfo(note) {
  const [from, to] = range();
  const i = S.idx >= 0 ? S.idx : from;
  const a = S.ayahs[i];
  $("#pTitle").textContent = a ? `سورة ${NAMES[S.surah - 1]} — الآية ${arNum(a.n)}` : `سورة ${NAMES[S.surah - 1]}`;
  const repA = +$("#repAyah").value, repR = +$("#repRange").value;
  const bits = [$("#reciter").selectedOptions[0]?.textContent || ""];
  if (repA !== 1) bits.push(`تكرار الآية ${repA === 0 ? "∞" : `${arNum(Math.min(S.ayahPlays + 1, repA))}/${arNum(repA)}`}`);
  if (repR !== 1) bits.push(`المقطع ${repR === 0 ? "∞" : `${arNum(Math.min(S.rangePlays + 1, repR))}/${arNum(repR)}`}`);
  bits.push(`من ${arNum(from + 1)} إلى ${arNum(to + 1)}`);
  $("#pSub").textContent = note || bits.join(" • ");
  const total = to - from + 1;
  $("#pProg").style.width = S.idx >= 0 ? `${Math.max(0, Math.min(1, (S.idx - from + 1) / total)) * 100}%` : "0";
}

function step(d) {
  if (!S.ayahs.length) return;
  const i = Math.max(0, Math.min(S.ayahs.length - 1, (S.idx < 0 ? range()[0] : S.idx) + d));
  S.ayahPlays = 0; S.inBasmala = false; S.started = true;
  const [from, to] = range();
  if (i < from) $("#from").value = i + 1;
  if (i > to) $("#to").value = i + 1;
  playAyah(i);
}

// ---------- listen mode (full surahs, MP3Quran) ----------
const L = { reciters: [], current: null, moshaf: null, surah: 0, loaded: false };
async function loadReciters() {
  if (L.loaded) return;
  L.loaded = true;
  try {
    const r = await fetch("https://www.mp3quran.net/api/v3/reciters?language=ar");
    L.reciters = (await r.json()).reciters.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    const riwayat = [...new Set(L.reciters.flatMap((x) => x.moshaf.map((m) => m.name)))].sort((a, b) => a.localeCompare(b, "ar"));
    $("#riwaya").innerHTML = '<option value="">كل الروايات</option>' + riwayat.map((n) => `<option>${esc(n)}</option>`).join("");
    renderReciters();
  } catch (e) {
    L.loaded = false;
    $("#reciterList").innerHTML = '<div class="loading">تعذّر تحميل القرّاء.</div>';
  }
}
function renderReciters() {
  const q = $("#reciterSearch").value.trim(), rw = $("#riwaya").value;
  const list = L.reciters.filter((x) => (!q || x.name.includes(q)) && (!rw || x.moshaf.some((m) => m.name === rw)));
  $("#reciterList").innerHTML = list.length
    ? list.map((x) => `<button type="button" class="reciter${L.current && L.current.id === x.id ? " active" : ""}" data-id="${x.id}">${esc(x.name)}<small>${x.moshaf.length > 1 ? `${arNum(x.moshaf.length)} روايات` : esc(x.moshaf[0].name)}</small></button>`).join("")
    : '<div class="loading">لا يوجد قارئ مطابق.</div>';
}
function pickReciter(id) {
  L.current = L.reciters.find((x) => x.id === +id);
  if (!L.current) return;
  const rw = $("#riwaya").value;
  L.moshaf = L.current.moshaf.find((m) => m.name === rw)
    || L.current.moshaf.find((m) => m.name.includes("حفص") && m.name.includes("مرتل"))
    || L.current.moshaf.find((m) => m.name.includes("حفص")) || L.current.moshaf[0];
  $("#lReciter").textContent = L.current.name;
  const sel = $("#lMoshafSel");
  sel.hidden = L.current.moshaf.length < 2;
  sel.innerHTML = L.current.moshaf.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
  sel.value = L.moshaf.id;
  renderReciters(); renderListenSurahs();
}
function renderListenSurahs() {
  if (!L.moshaf) return;
  $("#lMoshaf").textContent = `${L.moshaf.name} • ${arNum(L.moshaf.surah_total)} سورة`;
  const avail = String(L.moshaf.surah_list).split(",").map(Number);
  $("#lSurahs").innerHTML = avail.map((n) => `<button type="button" class="sbtn${n === L.surah ? " active" : ""}" data-s="${n}"><span>${arNum(n)}</span>${NAMES[n - 1]}</button>`).join("");
}
function playListen(n) {
  stop();
  L.surah = n;
  const a = $("#lAudio");
  a.src = L.moshaf.server + pad3(n) + ".mp3";
  a.play().catch(() => {});
  renderListenSurahs();
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: `سورة ${NAMES[n - 1]}`, artist: L.current.name, album: "القرآن الكريم — Gradify" });
}

// ---------- search mode ----------
async function search(q) {
  const box = $("#results");
  box.innerHTML = '<div class="loading">جارٍ البحث…</div>';
  try {
    const r = await fetch(`${API}/search/${encodeURIComponent(q)}/all/quran-simple-clean`);
    const j = await r.json();
    const m = (j.data && j.data.matches) || [];
    if (!m.length) { box.innerHTML = '<div class="loading">لا توجد نتائج. جرّب كلمة أخرى بدون تشكيل.</div>'; return; }
    const hl = (t) => esc(t).split(esc(q)).join(`<mark>${esc(q)}</mark>`);
    box.innerHTML = `<p style="margin:0;color:var(--muted)">${arNum(j.data.count)} نتيجة${m.length < j.data.count ? ` (أول ${arNum(m.length)})` : ""}</p>` +
      m.slice(0, 60).map((x) => `<div class="result"><div class="t">${hl(x.text)}</div>
        <div class="meta"><span>سورة ${NAMES[x.surah.number - 1]} — الآية ${arNum(x.numberInSurah)}</span>
        <span><button class="btn small" type="button" data-go="${x.surah.number}:${x.numberInSurah}">اقرأ واستمع</button></span></div></div>`).join("");
  } catch (e) { box.innerHTML = '<div class="loading">تعذّر البحث. حاول مرة أخرى.</div>'; }
}

// ---------- modes & wiring ----------
function setMode(m) {
  document.querySelectorAll(".modeTabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
  $("#modeRead").hidden = m !== "read";
  $("#modeListen").hidden = m !== "listen";
  $("#modeSearch").hidden = m !== "search";
  $("#player").hidden = m === "listen";
  if (m === "listen") { stop(); loadReciters(); } else { $("#lAudio").pause(); }
}

function parseHash() {
  const h = location.hash.slice(1);
  if (h === "listen") return { mode: "listen" };
  if (h === "search") return { mode: "search" };
  const p = new URLSearchParams(h);
  const s = +p.get("s"), a = +p.get("a");
  return { mode: "read", s: s >= 1 && s <= 114 ? s : 0, a: a >= 1 ? a : 0 };
}

document.addEventListener("DOMContentLoaded", () => {
  $("#menuBtn").onclick = () => $("#nav").classList.toggle("open");
  fillSelects();

  $("#surah").onchange = () => { loadSurah(+$("#surah").value); history.replaceState(null, "", `#s=${$("#surah").value}`); };
  $("#reciter").onchange = changeReciter;
  ["#repAyah", "#repRange"].forEach((id) => $(id).onchange = () => { prefs[id === "#repAyah" ? "repAyah" : "repRange"] = $(id).value; savePrefs(); updateInfo(); });
  ["#from", "#to"].forEach((id) => $(id).onchange = () => { S.rangePlays = 0; updateInfo(); });
  $("#speed").onchange = () => { prefs.speed = $("#speed").value; savePrefs(); audio.playbackRate = +prefs.speed; };
  $("#optTafsir").onchange = () => { prefs.tafsir = $("#optTafsir").checked; savePrefs(); renderAyat(); };
  $("#optHifz").onchange = () => { prefs.hifz = $("#optHifz").checked; savePrefs(); renderAyat(); };
  $("#optBasmala").onchange = () => { prefs.basmala = $("#optBasmala").checked; savePrefs(); };
  $("#optFollow").onchange = () => { prefs.follow = $("#optFollow").checked; savePrefs(); };
  const setSize = (d) => { prefs.size = Math.max(1.3, Math.min(3.2, +(prefs.size + d).toFixed(2))); savePrefs(); document.documentElement.style.setProperty("--qsize", prefs.size + "rem"); };
  $("#fontUp").onclick = () => setSize(0.15);
  $("#fontDown").onclick = () => setSize(-0.15);

  $("#ayat").addEventListener("click", (e) => {
    const el = e.target.closest(".ayah"); if (!el) return;
    const i = +el.dataset.i;
    if ($("#optHifz").checked) el.classList.add("shown");
    const [, to] = range();
    $("#from").value = i + 1;
    if (to < i) $("#to").value = S.ayahs.length;
    start(i);
  });

  $("#pPlay").onclick = () => {
    if (!S.ayahs.length) return;
    if (!S.started) start();
    else if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };
  // volume (also applies to the full-surah player)
  const applyVol = () => {
    const v = +$("#pVol").value;
    audio.volume = v; $("#lAudio").volume = v;
    $("#pMute").textContent = v === 0 ? "🔇" : v < 0.5 ? "🔉" : "🔊";
    $("#pVol").style.background = "";
  };
  $("#pVol").value = prefs.volume; applyVol();
  $("#pVol").oninput = () => { applyVol(); if (+$("#pVol").value > 0) prefs.volume = +$("#pVol").value; savePrefs(); };
  $("#pMute").onclick = (e) => { e.preventDefault(); $("#pVol").value = +$("#pVol").value > 0 ? 0 : (prefs.volume || 1); applyVol(); };
  $("#pNext").onclick = () => step(1);
  $("#pPrev").onclick = () => step(-1);
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => $("#pPlay").click());
    navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
    navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
  }
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, textarea") || $("#modeRead").hidden) return;
    if (e.code === "Space") { e.preventDefault(); $("#pPlay").click(); }
    if (e.key === "ArrowLeft") step(1);
    if (e.key === "ArrowRight") step(-1);
  });

  document.querySelectorAll(".modeTabs button").forEach((b) => b.onclick = () => {
    setMode(b.dataset.mode);
    history.replaceState(null, "", b.dataset.mode === "read" ? `#s=${S.surah}` : `#${b.dataset.mode}`);
  });

  $("#reciterSearch").oninput = renderReciters;
  $("#riwaya").onchange = renderReciters;
  $("#reciterList").addEventListener("click", (e) => { const b = e.target.closest(".reciter"); if (b) pickReciter(b.dataset.id); });
  $("#lMoshafSel").onchange = () => { L.moshaf = L.current.moshaf.find((m) => m.id === +$("#lMoshafSel").value); renderListenSurahs(); };
  $("#lSurahs").addEventListener("click", (e) => { const b = e.target.closest(".sbtn"); if (b) playListen(+b.dataset.s); });
  $("#lAudio").addEventListener("ended", () => {
    if (!$("#lAuto").checked || !L.moshaf) return;
    const avail = String(L.moshaf.surah_list).split(",").map(Number);
    const next = avail[avail.indexOf(L.surah) + 1];
    if (next) playListen(next);
  });
  $("#lAudio").addEventListener("play", () => audio.pause());

  $("#searchForm").onsubmit = (e) => { e.preventDefault(); search($("#q").value.trim()); };
  $("#results").addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]"); if (!b) return;
    const [s, a] = b.dataset.go.split(":").map(Number);
    setMode("read"); history.replaceState(null, "", `#s=${s}&a=${a}`);
    loadSurah(s, a).then(() => { $("#to").value = a; updateInfo(); });
  });

  const h = parseHash();
  setMode(h.mode);
  loadSurah(h.s || prefs.surah || 1, h.a);
});
