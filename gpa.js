// Gradify GPA calculator — Saudi unified grading table; the university only picks the default scale (4 or 5)
(() => {
  const $ = (s) => document.querySelector(s);
  // code, Arabic symbol, Arabic name, points /5, points /4, min %, counts in GPA
  const GRADES = [
    ["A+", "أ+", "ممتاز مرتفع", 5.0, 4.0, 95],
    ["A", "أ", "ممتاز", 4.75, 3.75, 90],
    ["B+", "ب+", "جيد جدًا مرتفع", 4.5, 3.5, 85],
    ["B", "ب", "جيد جدًا", 4.0, 3.0, 80],
    ["C+", "ج+", "جيد مرتفع", 3.5, 2.5, 75],
    ["C", "ج", "جيد", 3.0, 2.0, 70],
    ["D+", "د+", "مقبول مرتفع", 2.5, 1.5, 65],
    ["D", "د", "مقبول", 2.0, 1.0, 60],
    ["F", "هـ", "راسب", 1.0, 0, 0],
    ["DN", "ح", "محروم", 1.0, 0, null],
    ["NP", "ند", "ناجح دون درجة", null, null, null],
    ["NF", "هد", "راسب دون درجة", null, null, null],
    ["IP", "م", "مستمر", null, null, null],
    ["IC", "ل", "غير مكتمل", null, null, null],
    ["W", "ع", "منسحب بعذر", null, null, null],
    ["E", "عف", "معفي", null, null, null],
  ];
  const byCode = Object.fromEntries(GRADES.map((g) => [g[0], g]));
  const counts = (g) => g && g[3] != null;
  const RANGES = { "A+": "95 إلى 100", A: "90 إلى أقل من 95", "B+": "85 إلى أقل من 90", B: "80 إلى أقل من 85", "C+": "75 إلى أقل من 80", C: "70 إلى أقل من 75", "D+": "65 إلى أقل من 70", D: "60 إلى أقل من 65", F: "أقل من 60", NP: "60 فأكثر", NF: "أقل من 60" };

  // rating bands per scale: [min, label, colour]
  const BANDS = {
    5: [[4.5, "ممتاز", "linear-gradient(135deg,#16b08f,#0b7d6c)"], [3.75, "جيد جدًا", "linear-gradient(135deg,#3b8ee0,#2264b8)"], [2.75, "جيد", "linear-gradient(135deg,#e9b44c,#c98a1d)"], [2.0, "مقبول", "linear-gradient(135deg,#f08a3c,#d2661c)"], [0, "منخفض — انتبه للإنذار", "linear-gradient(135deg,#e2556f,#b8344f)"]],
    4: [[3.5, "ممتاز", "linear-gradient(135deg,#16b08f,#0b7d6c)"], [2.75, "جيد جدًا", "linear-gradient(135deg,#3b8ee0,#2264b8)"], [1.75, "جيد", "linear-gradient(135deg,#e9b44c,#c98a1d)"], [1.0, "مقبول", "linear-gradient(135deg,#f08a3c,#d2661c)"], [0, "منخفض — انتبه للإنذار", "linear-gradient(135deg,#e2556f,#b8344f)"]],
  };
  const NEUTRAL = "linear-gradient(135deg,#5d6e6a,#3e4b48)";

  // [name, default scale]; the scale can always be changed by the student
  const UNIS = [
    ["جامعة أخرى / عام", 0],
    ["جامعة الأمير مساعد بن عبدالرحمن (الإلكترونية سابقًا)", 4],
    ["جامعة الملك سعود", 5], ["جامعة الملك عبدالعزيز", 5], ["جامعة الإمام محمد بن سعود الإسلامية", 5],
    ["جامعة أم القرى", 5], ["جامعة الملك خالد", 5], ["جامعة القصيم", 5], ["جامعة الإمام عبدالرحمن بن فيصل", 5],
    ["جامعة الأميرة نورة بنت عبدالرحمن", 5], ["جامعة طيبة", 5], ["جامعة الطائف", 5], ["جامعة جدة", 5],
    ["جامعة جازان", 5], ["جامعة حائل", 5], ["جامعة تبوك", 5], ["جامعة الجوف", 5], ["جامعة نجران", 5],
    ["جامعة الباحة", 5], ["جامعة الحدود الشمالية", 5], ["جامعة المجمعة", 5], ["جامعة شقراء", 5],
    ["جامعة الأمير سطام بن عبدالعزيز", 5], ["جامعة بيشة", 5], ["جامعة حفر الباطن", 5], ["الجامعة الإسلامية", 5],
    ["جامعة الملك فيصل", 5],
    ["جامعة الملك فهد للبترول والمعادن", 4], ["جامعة الفيصل", 4], ["جامعة الأمير سلطان", 4],
  ];
  let state = { uni: 0, scale: 4, mode: "letter", prevHours: "", prevGpa: "", rows: [] };
  try { state = { ...state, ...JSON.parse(localStorage.getItem("gradify-gpa-v2") || "{}") }; } catch (e) { /* private mode */ }
  const freshRows = () => Array.from({ length: 6 }, newRow);
  if (!Array.isArray(state.rows) || !state.rows.length) state.rows = freshRows();
  const save = () => { try { localStorage.setItem("gradify-gpa-v2", JSON.stringify(state)); } catch (e) { /* ignore */ } };

  function newRow() { return { name: "", grade: "", pct: "", hours: 3 }; }
  const pctToCode = (p) => { const v = +p; if (p === "" || isNaN(v)) return null; return (GRADES.find((g) => g[5] != null && v >= g[5]) || byCode.F)[0]; };
  const codeOf = (r) => (state.mode === "letter" ? r.grade : pctToCode(r.pct));
  const pts = (g) => (state.scale === 5 ? g[3] : g[4]);
  const fmt = (v) => (v == null || isNaN(v) ? "—" : v.toFixed(2));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function gradeOptions(sel) {
    return `<option value=""${sel ? "" : " selected"}>اختر الدرجة</option>` + GRADES.map((g) => `<option value="${g[0]}"${g[0] === sel ? " selected" : ""}>${g[0]} — ${g[1]} ${g[2]}${counts(g) ? ` (${pts(g).toFixed(2)})` : " — لا يُحسب"}</option>`).join("");
  }

  function renderRows() {
    $("#rows").innerHTML = state.rows.map((r, i) => {
      const code = codeOf(r), g = byCode[code];
      const gradeInput = state.mode === "letter"
        ? `<select class="field small" data-k="grade" data-i="${i}" aria-label="الدرجة">${gradeOptions(r.grade)}</select>`
        : `<div><input class="field small" type="number" min="0" max="100" step="0.5" inputmode="decimal" placeholder="0 - 100" value="${esc(r.pct)}" data-k="pct" data-i="${i}" aria-label="الدرجة من 100"><div class="pts" data-pts="${i}">${g ? `${g[0]} • ${counts(g) ? pts(g).toFixed(2) : "—"}` : ""}</div></div>`;
      return `<div class="row">
        <span class="no">${i + 1}</span>
        <input class="field small name" placeholder="مثال: IT244" value="${esc(r.name)}" data-k="name" data-i="${i}" maxlength="40" aria-label="اسم المادة">
        ${gradeInput}
        <select class="field small" data-k="hours" data-i="${i}" aria-label="الساعات">${[1, 2, 3, 4, 5, 6].map((h) => `<option value="${h}"${+r.hours === h ? " selected" : ""}>${h} ساعات</option>`).join("")}</select>
        <button class="del" type="button" data-del="${i}" title="حذف المادة" aria-label="حذف المادة">✕</button>
      </div>`;
    }).join("");
  }

  function compute() {
    let sp = 0, sh = 0;
    state.rows.forEach((r, i) => {
      const g = byCode[codeOf(r)];
      if (state.mode === "number") { const el = document.querySelector(`[data-pts="${i}"]`); if (el) el.textContent = g ? `${g[0]} • ${counts(g) ? pts(g).toFixed(2) : "—"}` : ""; }
      if (!counts(g)) return;
      sp += pts(g) * +r.hours; sh += +r.hours;
    });
    const ph = Math.max(0, +state.prevHours || 0), pg = Math.min(state.scale, Math.max(0, +state.prevGpa || 0));
    const sem = sh ? sp / sh : null;
    const totalH = ph + sh;
    const cum = totalH ? (pg * ph + sp) / totalH : null;
    $("#rSem").textContent = fmt(sem);
    $("#rCum").textContent = fmt(cum);
    $("#rHours").textContent = sh;
    const shown = cum ?? sem;
    const band = shown == null ? null : BANDS[state.scale].find((b) => shown >= b[0] - 1e-9);
    $("#result").style.setProperty("--band", band ? band[2] : NEUTRAL);
    $("#rRate").textContent = band ? `التقدير: ${band[1]}` : "أضف موادك";
  }

  function renderStatic() {
    $("#uni").value = state.uni;
    document.querySelectorAll("#scaleSeg button").forEach((b) => b.classList.toggle("active", +b.dataset.v === state.scale));
    document.querySelectorAll("#modeSeg button").forEach((b) => b.classList.toggle("active", b.dataset.v === state.mode));
    $("#prevGpa").max = state.scale;
    $("#prevHours").value = state.prevHours;
    $("#prevGpa").value = state.prevGpa;
    $("#gradeTable").innerHTML = GRADES.map((g) => `<tr><td>${RANGES[g[0]] || "—"}</td><td>${g[2]}</td><td>${g[0]} / ${g[1]}</td><td>${g[3] != null ? g[3].toFixed(2) : "—"}</td><td>${g[4] != null && g[0] !== "F" && g[0] !== "DN" ? g[4].toFixed(2) : "—"}</td></tr>`).join("");
    $("#bands").innerHTML = BANDS[state.scale].map((b, i, a) => `<span style="background:${b[2]}"><b>${b[1].split(" —")[0]}</b><small>${i === 0 ? `${b[0].toFixed(2)} فأكثر` : `${b[0].toFixed(2)} – أقل من ${a[i - 1][0].toFixed(2)}`}</small></span>`).join("");
  }

  function all() { renderStatic(); renderRows(); compute(); save(); }

  document.addEventListener("DOMContentLoaded", () => {
    $("#menuBtn").onclick = () => $("#nav").classList.toggle("open");
    $("#uni").innerHTML = UNIS.map(([n, sc], i) => `<option value="${i}">${n}${sc ? ` — من ${sc}` : ""}</option>`).join("");
    $("#uni").onchange = () => { state.uni = +$("#uni").value; const sc = UNIS[state.uni][1]; if (sc) state.scale = sc; all(); };
    $("#scaleSeg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; state.scale = +b.dataset.v; all(); };
    $("#modeSeg").onclick = (e) => {
      const b = e.target.closest("button"); if (!b || b.dataset.v === state.mode) return;
      // carry values across: percentage -> letter, letter -> lowest percentage of that letter
      state.rows.forEach((r) => {
        if (b.dataset.v === "letter") { const c = pctToCode(r.pct); if (c) r.grade = c; }
        else if (byCode[r.grade] && byCode[r.grade][5] != null && r.pct === "") r.pct = String(byCode[r.grade][5]);
      });
      state.mode = b.dataset.v; all();
    };
    const onField = (e) => {
      const el = e.target, i = +el.dataset.i, k = el.dataset.k;
      if (!k || !state.rows[i]) return;
      state.rows[i][k] = el.value;
      compute(); save();
    };
    $("#rows").addEventListener("input", onField);
    $("#rows").addEventListener("change", onField);
    $("#rows").addEventListener("click", (e) => {
      const b = e.target.closest("[data-del]"); if (!b) return;
      state.rows.splice(+b.dataset.del, 1);
      if (!state.rows.length) state.rows.push(newRow());
      all();
    });
    $("#addRow").onclick = () => { state.rows.push(newRow()); all(); const last = document.querySelector("#rows .row:last-child select, #rows .row:last-child input[data-k=pct]"); if (last) last.focus(); };
    $("#reset").onclick = () => { if (!confirm("مسح كل المواد والبيانات؟")) return; state.rows = freshRows(); state.prevHours = ""; state.prevGpa = ""; all(); };
    $("#prevHours").oninput = () => { state.prevHours = $("#prevHours").value; compute(); save(); };
    $("#prevGpa").oninput = () => { state.prevGpa = $("#prevGpa").value; compute(); save(); };
    all();
  });
})();
