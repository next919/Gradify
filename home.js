// Gradify home: search, verse of the day, "more" section, contact form
(function () {
  const $ = (s) => document.querySelector(s);
  const G = window.GRADIFY, UI = window.GradifyUI;

  async function dailyAyah() {
    const day = Math.floor(Date.now() / 86400000);
    const n = ((day * 7919) % 6236) + 1;
    try {
      const r = await fetch(`https://api.alquran.cloud/v1/ayah/${n}/editions/quran-uthmani,ar.alafasy`);
      const [t, a] = (await r.json()).data;
      let text = t.text.replace(/^﻿/, "");
      if (t.numberInSurah === 1 && t.surah.number !== 1) text = text.replace(/^بِسْمِ\s+\S+\s+\S+\s+\S+\s*/, "");
      $("#dailyText").textContent = text;
      $("#dailySurah").textContent = `سورة ${G.SURAHS[t.surah.number - 1]} — الآية ${t.numberInSurah}`;
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

  function initMore() {
    const btn = $("#moreBtn"), more = $("#more");
    const open = (v) => { more.hidden = !v; btn.setAttribute("aria-expanded", String(v)); };
    btn.onclick = () => open(more.hidden);
    // links like #contact or #useful open the section
    if (location.hash === "#useful" || location.hash === "#english") { open(true); setTimeout(() => document.querySelector(location.hash).scrollIntoView(), 50); }
  }

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
    UI.initMenu();
    UI.initSearch("#globalSearch", "#searchResults");
    $("#usefulGrid").innerHTML = G.USEFUL.map((x, i) => UI.cardHTML(x, i)).join("");
    initMore();
    initContact();
    dailyAyah();
  });
})();
