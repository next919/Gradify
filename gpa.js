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

  const LS_KEY = "gradify_gpa_seu_v1";

  function getScale() {
    const v = document.querySelector('input[name="scale"]:checked')?.value || "5";
    return Number(v);
  }

  // درجات لا تدخل في حساب المعدل (حسب الشائع: ناجح/راسب بدون درجة/منسحب/مستمر/غير مكتمل/معفى)
  const EXCLUDED = new Set(["NP","NF","IP","IC","W","E"]);

  // جدول SEU: تحويل النسبة إلى تقدير (A+..F)
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

  // نقاط التقدير (SEU) حسب النظام
  function letterToGpa(letter, scale) {
    const L = (letter || "").toUpperCase().trim();
    if (!L) return NaN;
    if (EXCLUDED.has(L)) return NaN;

    if (scale === 5) {
      const map5 = {
        "A+": 5.00, "A": 4.75, "B+": 4.50, "B": 4.00,
        "C+": 3.50, "C": 3.00, "D+": 2.50, "D": 2.00,
        // في بعض الجداول يظهر F=1.00 على نظام 5 — اعتمدناه هنا
        "F": 1.00,
        // حالات خاصة قد تظهر في الجامعة
        "DN": 1.00
      };
      return (L in map5) ? map5[L] : NaN;
    }

    // نظام 4 (SEU)
    const map4 = {
      "A+": 4.00, "A": 3.75, "B+": 3.50, "B": 3.00,
      "C+": 2.50, "C": 2.00, "D+": 1.50, "D": 1.00,
      // غالباً F=0 على نظام 4
      "F": 0.00
    };
    return (L in map4) ? map4[L] : NaN;
  }

  function parseNumber(v) {
    const n = Number(String(v ?? "").replace(",", "."));
    return isFinite(n) ? n : NaN;
  }

  function rowTemplate() {
    return `
      <tr class="border-t border-ink-200">
        <td class="p-3 min-w-[220px]">
          <input data-k="name" class="w-full rounded-lg border border-ink-200 px-3 py-2" placeholder="مثال: MIS101" />
        </td>
        <td class="p-3 min-w-[160px]">
          <input data-k="grade" class="w-full rounded-lg border border-ink-200 px-3 py-2 mono" placeholder="مثال: 92 أو A" />
          <div class="text-[11px] text-ink-500 mt-1">يدعم: 0-100 أو A+..F أو NP/W/IP...</div>
        </td>
        <td class="p-3 min-w-[140px]">
          <input data-k="hours" type="number" min="0" step="1" class="w-full rounded-lg border border-ink-200 px-3 py-2 mono" value="3" />
        </td>
        <td class="p-3 whitespace-nowrap mono text-ink-700">
          <span data-k="letter">—</span>
        </td>
        <td class="p-3 whitespace-nowrap mono text-ink-700">
          <span data-k="points">0.00</span>
        </td>
        <td class="p-3">
          <button class="del px-3 py-2 rounded-lg border border-ink-200 hover:shadow-soft">حذف</button>
        </td>
      </tr>
    `;
  }

  function setHint() {
    const mode = gradeModeEl.value;
    modeHintEl.textContent =
      mode === "percent"
        ? "أدخل نسبة 0 إلى 100 وسيتم تحويلها تلقائياً إلى تقدير حسب SEU."
        : "أدخل التقدير مثل: A+ / A / B+ ... أو NP / W / IP (لا تدخل في الحساب).";
  }

  function readRows() {
    const scale = getScale();
    const mode = gradeModeEl.value;

    const trs = [...rowsEl.querySelectorAll("tr")];
    return trs.map((tr) => {
      const name = tr.querySelector('[data-k="name"]').value.trim();
      const gradeRaw = tr.querySelector('[data-k="grade"]').value.trim();
      const hours = parseNumber(tr.querySelector('[data-k="hours"]').value);

      let letter = "";
      if (mode === "percent") {
        letter = percentToLetter(parseNumber(gradeRaw));
      } else {
        letter = (gradeRaw || "").toUpperCase().trim();
      }

      const gpa = letterToGpa(letter, scale);
      const hrs = isFinite(hours) ? Math.max(0, hours) : NaN;

      // إذا درجة مستبعدة: لا نحتسب ساعاتها ولا نقاطها (حسب الشائع)
      const excluded = EXCLUDED.has(letter);
      const points = (!excluded && isFinite(hrs) && isFinite(gpa)) ? (hrs * gpa) : 0;
      const countedHours = (!excluded && isFinite(hrs) && isFinite(gpa)) ? hrs : 0;

      return { name, gradeRaw, hours: hrs, letter, gpa, points, countedHours, excluded };
    });
  }

  function renderRowComputed(items) {
    const trs = [...rowsEl.querySelectorAll("tr")];
    items.forEach((it, i) => {
      const tr = trs[i];
      if (!tr) return;
      tr.querySelector('[data-k="letter"]').textContent = it.letter ? it.letter : "—";
      tr.querySelector('[data-k="points"]').textContent = (it.points || 0).toFixed(2);
    });
  }

  function calc() {
    const scale = getScale();

    const prevHours = Math.max(0, parseNumber(prevHoursEl.value) || 0);
    const prevGpa = Math.max(0, Math.min(scale, parseNumber(prevGpaEl.value) || 0));

    const items = readRows();
    renderRowComputed(items);

    const semHours = items.reduce((a, x) => a + (x.countedHours || 0), 0);
    const semPoints = items.reduce((a, x) => a + (x.points || 0), 0);
    const semGpa = semHours > 0 ? (semPoints / semHours) : 0;

    const cumHours = prevHours + semHours;
    const prevPoints = prevHours * prevGpa;
    const cumGpa = cumHours > 0 ? ((prevPoints + semPoints) / cumHours) : 0;

    semHoursEl.textContent = semHours.toFixed(0);
    semPointsEl.textContent = semPoints.toFixed(2);
    semGpaEl.textContent = semGpa.toFixed(2);

    cumHoursEl.textContent = cumHours.toFixed(0);
    cumGpaEl.textContent = cumGpa.toFixed(2);

    if (prevHours > 0) {
      cumNoteEl.textContent = "التراكمي = (نقاط سابقاً + نقاط هذا الفصل) ÷ (ساعات سابقة + ساعات هذا الفصل).";
    } else {
      cumNoteEl.textContent = "إذا لم تُدخل ساعات/معدل سابق، التراكمي هنا يساوي معدل هذا الفصل.";
    }

    saveState();
  }

  function addRow(data) {
    rowsEl.insertAdjacentHTML("beforeend", rowTemplate());
    const tr = rowsEl.querySelector("tr:last-child");
    if (!tr) return;

    const nameEl = tr.querySelector('[data-k="name"]');
    const gradeEl = tr.querySelector('[data-k="grade"]');
    const hoursEl = tr.querySelector('[data-k="hours"]');

    if (data) {
      nameEl.value = data.name || "";
      gradeEl.value = data.gradeRaw || "";
      hoursEl.value = isFinite(data.hours) ? data.hours : 3;
    }

    tr.querySelector(".del").addEventListener("click", () => {
      tr.remove();
      calc();
    });

    [nameEl, gradeEl, hoursEl].forEach((el) => el.addEventListener("input", calc));
    calc();
  }

  function resetAll() {
    if (!confirm("أكيد تريد إعادة الضبط؟")) return;
    rowsEl.innerHTML = "";
    prevHoursEl.value = 0;
    prevGpaEl.value = 0;
    localStorage.removeItem(LS_KEY);
    addRow({ hours: 3 });
    addRow({ hours: 3 });
    addRow({ hours: 3 });
    calc();
  }

  function saveState() {
    const state = {
      scale: getScale(),
      prevHours: prevHoursEl.value,
      prevGpa: prevGpaEl.value,
      gradeMode: gradeModeEl.value,
      rows: readRows().map(r => ({ name: r.name, gradeRaw: r.gradeRaw, hours: r.hours }))
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);

      const target = String(s.scale || 5);
      const radio = document.querySelector(`input[name="scale"][value="${target}"]`);
      if (radio) radio.checked = true;

      prevHoursEl.value = s.prevHours ?? 0;
      prevGpaEl.value = s.prevGpa ?? 0;
      gradeModeEl.value = s.gradeMode || "percent";
      setHint();

      rowsEl.innerHTML = "";
      (s.rows || []).forEach(addRow);
      if (!(s.rows || []).length) {
        addRow({ hours: 3 }); addRow({ hours: 3 }); addRow({ hours: 3 });
      }
      calc();
      return true;
    } catch {
      return false;
    }
  }

  document.querySelectorAll('input[name="scale"]').forEach(r => r.addEventListener("change", calc));
  [prevHoursEl, prevGpaEl].forEach(el => el.addEventListener("input", calc));

  gradeModeEl.addEventListener("change", () => {
    setHint();
    calc();
  });

  addRowBtn.addEventListener("click", () => addRow({ hours: 3 }));
  resetBtn.addEventListener("click", resetAll);

  setHint();
  if (!loadState()) {
    addRow({ hours: 3 });
    addRow({ hours: 3 });
    addRow({ hours: 3 });
    calc();
  }
})();