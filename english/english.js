// English page: links from shared data, business English tabs with badges
document.addEventListener("DOMContentLoaded", () => {
  const G = window.GRADIFY, UI = window.GradifyUI, T = G.TOOLS;
  const $ = (s) => document.querySelector(s);
  UI.initMenu();
  const links = { testBtn: T.efset, testBtn2: T.efset, stepTest: T.efset, testCam: T.cambridgeTest, stepSix: T.sixMinute, stepAnki: T.anki, stepYouglish: T.youglish, stepTandem: T.tandem, stepHello: T.hellotalk };
  Object.entries(links).forEach(([id, url]) => { const a = document.getElementById(id); if (a) a.href = url; });

  const BADGE = { "مجاني": "b-free", "مدفوع": "b-paid", "بودكاست": "b-pod", "يوتيوب": "b-yt" };
  const names = Object.keys(G.BIZ);
  const tabs = ["الكل", ...names];
  const card = ([n, d, u], cat, i) => UI.cardHTML([n, d, u], i).replace('class="card"', 'class="card bizCard"')
    .replace("</a>", `<span class="badge ${BADGE[cat]}">${UI.esc(cat)}</span></a>`);
  const show = (t) => {
    $("#bizTabs").querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.t === t));
    const cats = t === "الكل" ? names : [t];
    $("#bizGrid").innerHTML = cats.flatMap((c) => G.BIZ[c].map((x) => card(x, c, names.indexOf(c)))).join("");
  };
  $("#bizTabs").innerHTML = tabs.map((t) => `<button class="tab" type="button" data-t="${UI.esc(t)}">${UI.esc(t)}</button>`).join("");
  $("#bizTabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) show(b.dataset.t); });
  show("الكل");

  UI.tabbed(G.EN, "#enTabs", "#enGrid", "الكل");
});
