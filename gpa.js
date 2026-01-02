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

  const LS_KEY = "gradify_gpa_seu_v4";
  const GRADE_OPTIONS = ["A+","A","B+","B","C+","C","D+","D","F"];
  const COURSE_OPTIONS = ["مقرر 01","مقرر 02","مقرر 03","مقرر 04","مقرر 05","مقرر 06"];

  function getScale() {
    const v = document.querySelector('input[name="scale"]:checked')?.value || "5";
    return Number(v);
  }

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

  function optionsHtml(list, selected, placeholder) {
    const ph = placeholder ? `<option value="" disabled ${selected?"" :"selected"}>${placeholder}</option>` : "";
    return ph + list.map(v => `<option value="${v}" ${v===selected?'selected':''}>${v}</option>`).join("");
  }

  function buildCourseSelect(selected) {
    const sel = (selected || "").trim();
    const list = COURSE_OPTIONS.includes(sel) ? COURSE_OPTIONS : [sel || COURSE_OPTIONS[0], ...COURSE_OPTIONS.filter(x => x !== sel)];
    return `
      <select data-k="course" class="w-full rounded-xl border border-ink-200 px-3 py-2">
        ${optionsHtml(list, sel || list[0], null)}
      </select>
    `;
  }

  function buildGradeControl(raw) {
    if (gradeModeEl.value === "letter") {
      const sel = (raw || "").toUpperCase().trim();
      return `
        <select data-k="gradeSel" class="w-full rounded-xl border border-ink-200 px-3 py-2 mono">
          ${optionsHtml(GRADE_OPTIONS, sel, "اختر التقدير")}
        </select>
      `;
    }
    const v = (!isNaN(Number(raw)) ? raw : "");
    return `<input data-k="gradeIn" class="w-full rounded-xl border border-ink-200 px-3 py-2 mono" placeholder="0 - 100" value="${v}" inputmode="decimal" />`;
  }

  function getRowGradeRaw(row) {
    if (gradeModeEl.value === "letter") {
      const sel = row.querySelector('[data-k="gradeSel"]');
      return sel ? sel.value : "";
    }
    const inp = row.querySelector('[data-k="gradeIn"]');
    return inp ? inp.value.trim() : "";
  }

  function rowTemplate(index, data) {
    const num = pad2(index);
    const hours = (Number.isFinite(data?.hours) ? data.hours : 3);
    const raw = (data?.gradeRaw || "");
    const course = (data?.course || `مقرر ${num}`);

    return `
      <div class="card rounded-2xl p-4 bg-ink-50/40" data-row>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-ink-900 text-white mono" data-k="num">${num}</span>
            <div class="text-sm text-ink-600">مادة</div>
          </div>
          <button class="del px-3 py-2 rounded-xl border border-ink-200 bg-white hover:shadow-soft">حذف</button>
        </div>

        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div class="lg:col-span-4">
            <label class="block text-xs text-ink-600 mb-1">اسم المقرر</label>
            <div data-k="courseWrap">${buildCourseSelect(course)}</div>
          </div>

          <div class="lg:col-span-4">
            <label class="block text-xs text-ink-600 mb-1">الدرجة</label>
            <div data-k="gradeWrap">${buildGradeControl(raw)}</div>
          </div>

          <div class="lg:col-span-2">
            <label class="block text-xs text-ink-600 mb-1">عدد الساعات</label>
            <input data-k="hours" type="number" min="0" step="1" class="w-full rounded-xl border border-ink-200 px-3 py-2 mono bg-white" value="${hours}" inputmode="numeric" />
          </div>

          <div class="lg:col-span-2 grid grid-cols-2 lg:grid-cols-1 gap-2">
            <div class="rounded-xl border border-ink-200 bg-white px-3 py-2">
              <div class="text-[11px] text-ink-500">التقدير</div>
              <div class="mono text-ink-900" data-k="letter">—</div>
            </div>
            <div class="rounded-xl border border-ink-200 bg-white px-3 py-2">
              <div class="text-[11px] text-ink-500">النقاط</div>
              <div class="mono text-ink-900" data-k="points">0.00</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function readRows() {
    const scale = getScale();
    const rows = [...rowsEl.querySelectorAll('[data-row]')];

    return rows.map(row => {
      const course = row.querySelector('[data-k="course"]')?.value || "";
      const hours = parseNumber(row.querySelector('[data-k="hours"]')?.value);
      const raw = getRowGradeRaw(row);

      let letter = "";
      if (gradeModeEl.value === "percent") letter = percentToLetter(parseNumber(raw));
      else letter = (raw || "").toUpperCase().trim();

      const gpa = letterToGpa(letter, scale);
      const hrs = isFinite(hours) ? Math.max(0, hours) : NaN;

      const points = (isFinite(hrs) && isFinite(gpa)) ? (hrs * gpa) : 0;
      const countedHours = (isFinite(hrs) && isFinite(gpa)) ? hrs : 0;

      return { course, gradeRaw: raw, hours: hrs, letter, gpa, points, countedHours };
    });
  }

  function renderRowComputed(items) {
    const rows = [...rowsEl.querySelectorAll('[data-row]')];
    items.forEach((it, i) => {
      const row = rows[i];
      if (!row) return;
      row.querySelector('[data-k="letter"]').textContent = it.letter || "—";
      row.querySelector('[data-k="points"]').textContent = (it.points || 0).toFixed(2);
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

  function renumber() {
    const rows = [...rowsEl.querySelectorAll('[data-row]')];
    rows.forEach((row, idx) => {
      row.querySelector('[data-k="num"]').textContent = pad2(idx + 1);
    });
  }

  function bindRowEvents(row) {
    row.querySelector(".del")?.addEventListener("click", () => {
      row.remove();
      renumber();
      calc();
    });

    row.querySelector('[data-k="course"]')?.addEventListener("change", calc);
    row.querySelector('[data-k="hours"]')?.addEventListener("input", calc);

    const gradeEl = row.querySelector('[data-k="gradeSel"], [data-k="gradeIn"]');
    if (gradeEl) {
      gradeEl.addEventListener("input", calc);
      gradeEl.addEventListener("change", calc);
    }
  }

  function addRow(data) {
    const idx = rowsEl.querySelectorAll('[data-row]').length + 1;
    rowsEl.insertAdjacentHTML("beforeend", rowTemplate(idx, data));
    const row = rowsEl.querySelector('[data-row]:last-child');
    if (!row) return;
    bindRowEvents(row);
    renumber();
    calc();
  }

  function refreshGradeControls() {
    const rows = [...rowsEl.querySelectorAll('[data-row]')];
    rows.forEach(row => {
      const wrap = row.querySelector('[data-k="gradeWrap"]');
      const raw = getRowGradeRaw(row);
      wrap.innerHTML = buildGradeControl(raw);
      bindRowEvents(row);
    });
    calc();
  }

  function resetAll() {
    if (!confirm("أكيد تريد إعادة الضبط؟")) return;
    rowsEl.innerHTML = "";
    prevHoursEl.value = 0;
    prevGpaEl.value = 0;
    localStorage.removeItem(LS_KEY);

    for (let i=0;i<6;i++) addRow({ hours: 3, course: COURSE_OPTIONS[i] });
    refreshGradeControls();
    calc();
  }

  function saveState() {
    const state = {
      scale: getScale(),
      prevHours: prevHoursEl.value,
      prevGpa: prevGpaEl.value,
      gradeMode: gradeModeEl.value,
      rows: readRows().map(r => ({ course: r.course, gradeRaw: r.gradeRaw, hours: r.hours }))
    };
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
      (s.rows || []).forEach(r => addRow(r));

      if (!(s.rows || []).length) {
        for (let i=0;i<6;i++) addRow({ hours: 3, course: COURSE_OPTIONS[i] });
      }

      refreshGradeControls();
      renumber();
      calc();
      return true;
    } catch {
      return false;
    }
  }

  // events
  document.querySelectorAll('input[name="scale"]').forEach(r => r.addEventListener("change", calc));
  [prevHoursEl, prevGpaEl].forEach(el => el.addEventListener("input", calc));
  gradeModeEl.addEventListener("change", () => { setHint(); refreshGradeControls(); });

  addRowBtn.addEventListener("click", () => addRow({ hours: 3 }));
  resetBtn.addEventListener("click", resetAll);

  setHint();
  if (!loadState()) {
    for (let i=0;i<6;i++) addRow({ hours: 3, course: COURSE_OPTIONS[i] });
    refreshGradeControls();
    calc();
  }
})();