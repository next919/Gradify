(function () {
  const $ = (id) => document.getElementById(id);

  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const rowsEl = $("rows");
  const addRowBtn = $("addRow");
  const resetBtn = $("resetAll");

  const prevHoursEl = $("prevHours");
  const prevGpaEl = $("prevGpa");
  const gradeModeEl = $("gradeMode");
  const modeHintEl = $("modeHint");

  const semHoursEl = $("semHours");
  const semPointsEl = $("semPoints");
  const semGpaEl = $("semGpa");
  const cumHoursEl = $("cumHours");
  const cumGpaEl = $("cumGpa");
  const cumNoteEl = $("cumNote");

  const LS_KEY = "gradify_gpa_seu_v2";
  const GRADE_OPTIONS = ["A+","A","B+","B","C+","C","D+","D","F"];

  function getScale() {
    const v = document.querySelector('input[name="scale"]:checked')?.value || "5";
    return Number(v);
  }

  const EXCLUDED = new Set(["NP","NF","IP","IC","W","E"]);

  function percentToLetter(p) {
    const n = Number(p);
    if (!isFinite(n)) return "";
    if (n >= 95) return "A+";
    if (n >= 90) return "A";
    if (n >= 85) return "B+";
    if (n >= 80) return "B";
    if (n >= 75) return "C+";
    if (n >= 70) return "C";
    if (n >= 65) return "D+";
    if (n >= 60) return "D";
    return "F";
  }

  function letterToGpa(letter, scale) {
    const L = (letter || "").toUpperCase().trim();
    if (!L) return NaN;
    if (EXCLUDED.has(L)) return NaN;

    if (scale === 5) {
      const map5 = {"A+":5.00,"A":4.75,"B+":4.50,"B":4.00,"C+":3.50,"C":3.00,"D+":2.50,"D":2.00,"F":1.00};
      return (L in map5) ? map5[L] : NaN;
    }
    const map4 = {"A+":4.00,"A":3.75,"B+":3.50,"B":3.00,"C+":2.50,"C":2.00,"D+":1.50,"D":1.00,"F":0.00};
    return (L in map4) ? map4[L] : NaN;
  }

  function parseNumber(v) {
    const n = Number(String(v ?? "").replace(",", "."));
    return isFinite(n) ? n : NaN;
  }

  function pad2(n){ return String(n).padStart(2,"0"); }

  function setHint() {
    modeHintEl.textContent = gradeModeEl.value === "percent"
      ? "أدخل نسبة 0 إلى 100 وسيتم تحويلها تلقائياً إلى A+..F."
      : "اختر التقدير من القائمة: A+ / A / B+ / B / C+ / C / D+ / D / F";
  }

  function optionsHtml(selected) {
    return GRADE_OPTIONS.map(g => `<option value="${g}" ${g===selected?'selected':''}>${g}</option>`).join("");
  }

  function getRowGradeRaw(tr) {
    if (gradeModeEl.value === "letter") {
      const sel = tr.querySelector('[data-k="gradeSel"]');
      return sel ? sel.value : "";
    }
    const inp = tr.querySelector('[data-k="gradeIn"]');
    return inp ? inp.value.trim() : "";
  }

  function buildGradeControl(raw) {
    if (gradeModeEl.value === "letter") {
      return `
        <select data-k="gradeSel" class="w-full rounded-lg border border-ink-200 px-3 py-2 mono">
          <option value="" disabled ${raw ? "" : "selected"}>اختر</option>
          ${optionsHtml(raw)}
        </select>
      `;
    }
    const v = (!isNaN(Number(raw)) ? raw : "");
    return `<input data-k="gradeIn" class="w-full rounded-lg border border-ink-200 px-3 py-2 mono" placeholder="0 - 100" value="${v}" />`;
  }

  function rowTemplate(index, data) {
    const num = pad2(index);
    const name = (data?.name) ? data.name : `مقرر ${num}`;
    const hours = (Number.isFinite(data?.hours) ? data.hours : 3);
    const raw = (data?.gradeRaw || "");
    return `
      <tr class="border-t border-ink-200">
        <td class="p-3 whitespace-nowrap mono text-ink-700" data-k="num">${num}</td>
        <td class="p-3 min-w-[220px]">
          <input data-k="name" class="w-full rounded-lg border border-ink-200 px-3 py-2" value="${escapeHtml(name)}" />
        </td>
        <td class="p-3 min-w-[170px]">
          <div data-k="gradeWrap">${buildGradeControl(raw)}</div>
        </td>
        <td class="p-3 min-w-[140px]">
          <input data-k="hours" type="number" min="0" step="1" class="w-full rounded-lg border border-ink-200 px-3 py-2 mono" value="${hours}" />
        </td>
        <td class="p-3 whitespace-nowrap mono text-ink-700"><span data-k="letter">—</span></td>
        <td class="p-3 whitespace-nowrap mono text-ink-700"><span data-k="points">0.00</span></td>
        <td class="p-3"><button class="del px-3 py-2 rounded-lg border border-ink-200 hover:shadow-soft">حذف</button></td>
      </tr>
    `;
  }

  function escapeHtml(str) {
    return String(str ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }

  function readRows() {
    const scale = getScale();
    const trs = [...rowsEl.querySelectorAll("tr")];
    return trs.map(tr => {
      const name = tr.querySelector('[data-k="name"]').value.trim();
      const hours = parseNumber(tr.querySelector('[data-k="hours"]').value);
      const raw = getRowGradeRaw(tr);

      let letter = "";
      if (gradeModeEl.value === "percent") letter = percentToLetter(parseNumber(raw));
      else letter = (raw || "").toUpperCase().trim();

      const gpa = letterToGpa(letter, scale);
      const hrs = isFinite(hours) ? Math.max(0, hours) : NaN;

      const excluded = EXCLUDED.has(letter);
      const points = (!excluded && isFinite(hrs) && isFinite(gpa)) ? (hrs * gpa) : 0;
      const countedHours = (!excluded && isFinite(hrs) && isFinite(gpa)) ? hrs : 0;

      return { name, gradeRaw: raw, hours: hrs, letter, gpa, points, countedHours };
    });
  }

  function renderRowComputed(items) {
    const trs = [...rowsEl.querySelectorAll("tr")];
    items.forEach((it,i) => {
      const tr = trs[i];
      if (!tr) return;
      tr.querySelector('[data-k="letter"]').textContent = it.letter || "—";
      tr.querySelector('[data-k="points"]').textContent = (it.points || 0).toFixed(2);
    });
  }

  function calc() {
    const scale = getScale();
    const prevHours = Math.max(0, parseNumber(prevHoursEl.value) || 0);
    const prevGpa = Math.max(0, Math.min(scale, parseNumber(prevGpaEl.value) || 0));

    const items = readRows();
    renderRowComputed(items);

    const semHours = items.reduce((a,x) => a + (x.countedHours || 0), 0);
    const semPoints = items.reduce((a,x) => a + (x.points || 0), 0);
    const semGpa = semHours > 0 ? (semPoints / semHours) : 0;

    const cumHours = prevHours + semHours;
    const cumGpa = cumHours > 0 ? ((prevHours * prevGpa + semPoints) / cumHours) : 0;

    semHoursEl.textContent = semHours.toFixed(0);
    semPointsEl.textContent = semPoints.toFixed(2);
    semGpaEl.textContent = semGpa.toFixed(2);

    cumHoursEl.textContent = cumHours.toFixed(0);
    cumGpaEl.textContent = cumGpa.toFixed(2);

    cumNoteEl.textContent = prevHours > 0
      ? "التراكمي = (نقاط سابقاً + نقاط هذا الفصل) ÷ (ساعات سابقة + ساعات هذا الفصل)."
      : "إذا لم تُدخل ساعات/معدل سابق، التراكمي هنا يساوي معدل هذا الفصل.";

    saveState();
  }

  function renumberCourses() {
    const trs = [...rowsEl.querySelectorAll("tr")];
    trs.forEach((tr, idx) => {
      const num = pad2(idx + 1);
      tr.querySelector('[data-k="num"]').textContent = num;
      const nameEl = tr.querySelector('[data-k="name"]');
      if (nameEl && /^مقرر\s+\d{2}$/u.test(nameEl.value.trim())) nameEl.value = `مقرر ${num}`;
    });
  }

  function bindRowEvents(tr) {
    const nameEl = tr.querySelector('[data-k="name"]');
    const hoursEl = tr.querySelector('[data-k="hours"]');
    const gradeEl = tr.querySelector('[data-k="gradeSel"], [data-k="gradeIn"]');

    [nameEl, hoursEl].forEach(el => el.addEventListener("input", calc));
    if (gradeEl) { gradeEl.addEventListener("input", calc); gradeEl.addEventListener("change", calc); }

    tr.querySelector(".del").addEventListener("click", () => {
      tr.remove();
      renumberCourses();
      calc();
    });
  }

  function addRow(data) {
    const idx = rowsEl.querySelectorAll("tr").length + 1;
    rowsEl.insertAdjacentHTML("beforeend", rowTemplate(idx, data));
    const tr = rowsEl.querySelector("tr:last-child");
    if (!tr) return;
    bindRowEvents(tr);
    renumberCourses();
    calc();
  }

  function refreshGradeControls() {
    const trs = [...rowsEl.querySelectorAll("tr")];
    trs.forEach(tr => {
      const wrap = tr.querySelector('[data-k="gradeWrap"]');
      const raw = getRowGradeRaw(tr);
      wrap.innerHTML = buildGradeControl(raw);
      bindRowEvents(tr);
    });
    calc();
  }

  function resetAll() {
    if (!confirm("أكيد تريد إعادة الضبط؟")) return;
    rowsEl.innerHTML = "";
    prevHoursEl.value = 0;
    prevGpaEl.value = 0;
    localStorage.removeItem(LS_KEY);
    for (let i=0;i<6;i++) addRow({ hours: 3 });
    refreshGradeControls();
    calc();
  }

  function saveState() {
    const state = { scale: getScale(), prevHours: prevHoursEl.value, prevGpa: prevGpaEl.value, gradeMode: gradeModeEl.value,
      rows: readRows().map(r => ({ name: r.name, gradeRaw: r.gradeRaw, hours: r.hours })) };
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);

      const radio = document.querySelector(`input[name="scale"][value="${String(s.scale || 5)}"]`);
      if (radio) radio.checked = true;

      prevHoursEl.value = s.prevHours ?? 0;
      prevGpaEl.value = s.prevGpa ?? 0;
      gradeModeEl.value = s.gradeMode || "percent";
      setHint();

      rowsEl.innerHTML = "";
      (s.rows || []).forEach(addRow);
      if (!(s.rows || []).length) for (let i=0;i<6;i++) addRow({ hours: 3 });

      refreshGradeControls();
      renumberCourses();
      calc();
      return true;
    } catch { return false; }
  }

  document.querySelectorAll('input[name="scale"]').forEach(r => r.addEventListener("change", calc));
  [prevHoursEl, prevGpaEl].forEach(el => el.addEventListener("input", calc));
  gradeModeEl.addEventListener("change", () => { setHint(); refreshGradeControls(); });

  addRowBtn.addEventListener("click", () => addRow({ hours: 3 }));
  resetBtn.addEventListener("click", resetAll);

  setHint();
  if (!loadState()) {
    for (let i=0;i<6;i++) addRow({ hours: 3 });
    refreshGradeControls();
    calc();
  }
})();