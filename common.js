// Gradify — shared helpers: link cards, tabs, menu, site search
(function () {
  const G = window.GRADIFY;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PALETTE = [
    ["var(--violet-soft)", "var(--violet)"], ["var(--blue-soft)", "var(--blue)"], ["var(--primary-soft)", "var(--primary)"],
    ["var(--amber-soft)", "var(--amber)"], ["var(--rose-soft)", "var(--rose)"], ["var(--gold-soft)", "#a46b10"],
  ];
  const root = document.currentScript && document.currentScript.dataset.root || "";

  function cardHTML([name, desc, url], colorIndex) {
    const [bg, fg] = PALETTE[colorIndex % PALETTE.length];
    const letter = name.charAt(0).toUpperCase();
    return `<a class="card" href="${esc(url)}" target="_blank" rel="noopener">
      <div class="head"><span class="mono" style="background:${bg};color:${fg}">${esc(letter)}</span><h3 dir="auto">${esc(name)}</h3></div>
      <p>${esc(desc)}</p></a>`;
  }

  function tabbed(groups, tabsSel, gridSel, allLabel) {
    const names = Object.keys(groups);
    const tabs = [allLabel, ...names];
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

  const norm = (s) => (s || "").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase();
  function searchIndex() {
    const idx = [
      { k: "القرآن الكريم مصحف قراءة استماع تفسير تجويد", label: "القرآن الكريم", t: "قسم", url: root + "quran/" },
      { k: "محرر PDF تعديل ملفات pdf", label: "محرر PDF العربي", t: "أداة", url: root + "pdf/" },
      { k: "حاسبة المعدل gpa تراكمي جامعة", label: "حاسبة المعدل", t: "أداة", url: root + "gpa.html" },
      { k: "نداء مواقيت الصلاة الأذان برنامج", label: "نداء — مواقيت الصلاة", t: "أداة", url: root + "nidaa/" },
      { k: "الذكاء الاصطناعي مواقع ai", label: "مواقع الذكاء الاصطناعي", t: "قسم", url: root + "ai/" },
      { k: "تعلم الإنجليزية english", label: "تعلّم الإنجليزية", t: "قسم", url: root + "english/" },
      { k: "سياسة الخصوصية", label: "سياسة الخصوصية", t: "صفحة", url: root + "privacy/" },
    ];
    G.SURAHS.forEach((n, i) => idx.push({ k: `سورة ${n} ${i + 1}`, label: `سورة ${n}`, t: `السورة ${i + 1}`, url: `${root}quran/#s=${i + 1}` }));
    const ext = (groups, t) => Object.values(groups).flat().forEach(([n, d, u]) => idx.push({ k: `${n} ${d}`, label: n, t, url: u, ext: true }));
    ext(G.AI, "ذكاء اصطناعي"); ext(G.EN, "الإنجليزية"); ext({ x: G.USEFUL }, "موقع مفيد");
    return idx;
  }
  function initSearch(inputSel, boxSel) {
    const input = $(inputSel), box = $(boxSel);
    if (!input) return;
    const idx = searchIndex();
    let res = [];
    input.addEventListener("input", () => {
      const q = norm(input.value.trim());
      if (!q) { box.classList.remove("show"); return; }
      res = idx.filter((x) => norm(x.k).includes(q)).slice(0, 14);
      box.innerHTML = res.length
        ? res.map((x, i) => `<div data-i="${i}"><b>${esc(x.label)}</b><small>${esc(x.t)}</small></div>`).join("")
        : "<div><small>لا توجد نتائج</small></div>";
      box.classList.add("show");
    });
    box.addEventListener("click", (e) => {
      const el = e.target.closest("[data-i]"); if (!el) return;
      const r = res[+el.dataset.i];
      box.classList.remove("show"); input.value = "";
      if (r.ext) window.open(r.url, "_blank", "noopener"); else location.href = r.url;
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { const f = box.querySelector("[data-i]"); if (f) f.click(); } });
    document.addEventListener("click", (e) => { if (!e.target.closest(".searchBox, .heroSearch")) box.classList.remove("show"); });
  }

  function initMenu() {
    const btn = $("#menuBtn"), nav = $("#nav");
    if (!btn || !nav) return;
    btn.onclick = () => nav.classList.toggle("open");
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) nav.classList.remove("open"); });
  }

  window.GradifyUI = { cardHTML, tabbed, initSearch, initMenu, esc };
})();
