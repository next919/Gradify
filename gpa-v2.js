const coursesEl=document.getElementById('courses');
const gpaEl=document.getElementById('gpa');
const addBtn=document.getElementById('add');
const countEl=document.getElementById('count');
const hoursTotalEl=document.getElementById('hoursTotal');
const pointsTotalEl=document.getElementById('pointsTotal');

const MAP={"A+":4,"A":3.75,"B+":3.5,"B":3,"C+":2.5,"C":2,"D+":1.5,"D":1,"F":0};

const gradeOptions=["A+","A","B+","B","C+","C","D+","D","F"];
const hourOptions=[1,2,3,4];

function pad2(n){return String(n).padStart(2,'0');}

function card(index){
  const n=pad2(index);
  return `
  <div class="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden" data-card>
    <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
      <div class="title font-bold">مادة ${n}</div>
      <button class="remove text-sm font-semibold text-red-600 active:opacity-70">حذف</button>
    </div>

    <div class="p-4 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <div class="text-[11px] text-slate-500">التقدير</div>
          <select class="grade w-full rounded-xl border border-slate-200 px-3 py-2 bg-white">
            ${gradeOptions.map(g=>`<option value="${g}">${g}</option>`).join('')}
          </select>
        </div>
        <div class="space-y-1">
          <div class="text-[11px] text-slate-500">عدد الساعات</div>
          <select class="hours w-full rounded-xl border border-slate-200 px-3 py-2 bg-white">
            ${hourOptions.map(h=>`<option value="${h}" ${h===3?'selected':''}>${h}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <div class="text-[11px] text-slate-500">النقاط</div>
          <div class="font-bold tabular-nums points">0.00</div>
        </div>
        <div class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <div class="text-[11px] text-slate-500">النقاط/ساعة</div>
          <div class="font-bold tabular-nums gpaOne">0.00</div>
        </div>
      </div>
    </div>
  </div>`;
}

function reindex(){
  [...coursesEl.querySelectorAll('[data-card]')].forEach((c,i)=>{
    c.querySelector('.title').textContent = 'مادة ' + pad2(i+1);
  });
  countEl.textContent = coursesEl.querySelectorAll('[data-card]').length;
}

function recalc(){
  let totalPoints=0, totalHours=0;
  const cards=[...coursesEl.querySelectorAll('[data-card]')];
  cards.forEach(card=>{
    const g=card.querySelector('.grade').value;
    const h=parseFloat(card.querySelector('.hours').value)||0;
    const gp=MAP[g];
    const p=gp*h;
    card.querySelector('.points').textContent = p.toFixed(2);
    card.querySelector('.gpaOne').textContent = gp.toFixed(2);
    totalPoints+=p; totalHours+=h;
  });
  gpaEl.textContent = totalHours ? (totalPoints/totalHours).toFixed(2) : '0.00';
  hoursTotalEl.textContent = totalHours.toFixed(0);
  pointsTotalEl.textContent = totalPoints.toFixed(2);
}

function bind(cardEl){
  cardEl.querySelectorAll('select').forEach(el=>el.addEventListener('change',recalc));
  cardEl.querySelector('.remove').addEventListener('click',()=>{
    cardEl.remove();
    reindex();
    recalc();
  });
}

function add(){
  coursesEl.insertAdjacentHTML('beforeend', card(coursesEl.children.length+1));
  const el=coursesEl.lastElementChild;
  bind(el);
  reindex();
  recalc();
}

addBtn.addEventListener('click', add);

// start with 2 cards
add(); add();
