document.addEventListener('DOMContentLoaded', () => {
  const coursesEl = document.getElementById('courses');
  const addBtn = document.getElementById('add');
  const gpaEl = document.getElementById('gpa');
  const hoursTotalEl = document.getElementById('hoursTotal');
  const pointsTotalEl = document.getElementById('pointsTotal');
  const prevHoursEl = document.getElementById('prevHours');
  const prevGpaEl = document.getElementById('prevGpa');

  const MAP = {"A+":4,"A":3.75,"B+":3.5,"B":3,"C+":2.5,"C":2,"D+":1.5,"D":1,"F":0};
  const grades = ["A+","A","B+","B","C+","C","D+","D","F"];
  const hours = [1,2,3,4];

  const pad2 = (n) => String(n).padStart(2,'0');
  const num = (v) => {
    const x = Number(String(v ?? '').replace(',','.'));
    return Number.isFinite(x) ? x : 0;
  };

  function card(i){
    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-card>
        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div class="title font-extrabold">مادة ${pad2(i)}</div>
          <button type="button" class="remove text-sm font-semibold text-red-600">حذف</button>
        </div>
        <div class="p-4 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="text-[11px] text-slate-500 mb-1">التقدير</div>
              <select class="grade w-full rounded-xl border border-slate-200 px-3 py-2 bg-white">
                ${grades.map(g=>`<option value="${g}">${g}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="text-[11px] text-slate-500 mb-1">الساعات</div>
              <select class="hrs w-full rounded-xl border border-slate-200 px-3 py-2 bg-white">
                ${hours.map(h=>`<option value="${h}" ${h===3?'selected':''}>${h}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <div class="text-[11px] text-slate-500">نقاط المادة</div>
              <div class="points font-bold tabular-nums">0.00</div>
            </div>
            <div class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <div class="text-[11px] text-slate-500">قيمة التقدير</div>
              <div class="gval font-bold tabular-nums">0.00</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function reindex(){
    [...coursesEl.querySelectorAll('[data-card]')].forEach((c, idx) => {
      c.querySelector('.title').textContent = 'مادة ' + pad2(idx+1);
    });
  }

  function recalc(){
    let semPoints = 0, semHours = 0;
    [...coursesEl.querySelectorAll('[data-card]')].forEach(cardEl => {
      const g = cardEl.querySelector('.grade').value;
      const h = num(cardEl.querySelector('.hrs').value);
      const gp = MAP[g];
      const p = gp * h;

      cardEl.querySelector('.points').textContent = p.toFixed(2);
      cardEl.querySelector('.gval').textContent = gp.toFixed(2);

      semPoints += p;
      semHours += h;
    });

    const prevH = Math.max(0, num(prevHoursEl.value));
    const prevG = Math.min(4, Math.max(0, num(prevGpaEl.value)));

    const totalHours = prevH + semHours;
    const totalPoints = prevH * prevG + semPoints;

    gpaEl.textContent = totalHours ? (totalPoints / totalHours).toFixed(2) : '0.00';
    hoursTotalEl.textContent = totalHours.toFixed(0);
    pointsTotalEl.textContent = totalPoints.toFixed(2);
  }

  function bind(cardEl){
    cardEl.querySelectorAll('select').forEach(el => el.addEventListener('change', recalc));
    cardEl.querySelector('.remove').addEventListener('click', () => {
      cardEl.remove();
      reindex();
      recalc();
    });
  }

  function addCard(){
    coursesEl.insertAdjacentHTML('beforeend', card(coursesEl.children.length + 1));
    const el = coursesEl.lastElementChild;
    bind(el);
    reindex();
    recalc();
  }

  // زر الإضافة
  addBtn.addEventListener('click', addCard);

  // بيانات سابقة
  prevHoursEl.addEventListener('input', recalc);
  prevGpaEl.addEventListener('input', recalc);

  // 5 خانات جاهزة
  for (let i=0;i<5;i++) addCard();
});
