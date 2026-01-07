(() => {
  const LS_KEY='gpa_app_v1';
  const MAP={"A+":4,"A":3.75,"B+":3.5,"B":3,"C+":2.5,"C":2,"D+":1.5,"D":1,"F":0};
  const GRADES=["A+","A","B+","B","C+","C","D+","D","F"];
  const $=(id)=>document.getElementById(id);

  const coursesEl=$('courses');
  const semGpaEl=$('semGpa'), cumGpaEl=$('cumGpa');
  const semHoursEl=$('semHours'), cumHoursEl=$('cumHours');
  const semPointsEl=$('semPoints'), cumPointsEl=$('cumPoints');
  const semBar=$('semBar'), cumBar=$('cumBar');

  const prevHoursEl=$('prevHours'), prevGpaEl=$('prevGpa');
  const resetBtn=$('reset');

  const fab=$('fab'), sheet=$('sheet'), sheetBackdrop=$('sheetBackdrop');
  const closeSheet=$('closeSheet'), addCourse=$('addCourse');
  const newGrade=$('newGrade'), newHours=$('newHours');

  const toggleTheme=$('toggleTheme'), sun=$('sun'), moon=$('moon');

  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const num=(v)=>{const x=Number(String(v??'').replace(',','.')); return Number.isFinite(x)?x:0;}
  const pad2=(n)=>String(n).padStart(2,'0');

  const fmtGpa=(v)=> (Math.abs(v-Math.round(v))<1e-9) ? String(Math.round(v)) : v.toFixed(2);
  const fmtNum=(v)=> (Math.abs(v)<1e-9) ? '0' : (Math.abs(v-Math.round(v))<1e-9 ? String(Math.round(v)) : v.toFixed(2));

  function setTheme(mode){
    const isDark = mode==='dark';
    document.documentElement.classList.toggle('dark',isDark);
    sun.classList.toggle('hidden',!isDark);
    moon.classList.toggle('hidden',isDark);
  }

  function openSheet(){sheetBackdrop.classList.remove('hidden'); sheet.classList.remove('translate-y-full');}
  function closeSheetFn(){sheetBackdrop.classList.add('hidden'); sheet.classList.add('translate-y-full');}

  function save(){
    const state={
      prevHours:num(prevHoursEl.value),
      prevGpa:num(prevGpaEl.value),
      courses:[...coursesEl.querySelectorAll('[data-card]')].map(card=>({
        grade:card.querySelector('.grade').value,
        hours:num(card.querySelector('.hrs').value),
        open:card.querySelector('details').open
      })),
      theme: document.documentElement.classList.contains('dark')?'dark':'light'
    };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function load(){
    try{const raw=localStorage.getItem(LS_KEY); return raw?JSON.parse(raw):null;}catch{return null;}
  }

  function card(index, initGrade='A', initHours=3, open=false){
    const n=pad2(index);
    return `
    <div class="bg-white dark:bg-slate-900/80 rounded-2xl shadow-soft border border-slate-200/70 dark:border-slate-700/60 overflow-hidden" data-card>
      <details class="group" ${open?'open':''}>
        <summary class="px-4 py-3 cursor-pointer select-none flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-700/60">
          <div class="title font-extrabold">مادة ${n}</div>
          <div class="flex items-center gap-2">
            <span class="mini text-[11px] text-slate-500 dark:text-slate-300 tabular-nums"></span>
            <span class="text-slate-500 dark:text-slate-300 group-open:rotate-180 transition">▾</span>
          </div>
        </summary>

        <div class="p-4 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="text-[11px] text-slate-500 dark:text-slate-300 mb-1">التقدير</div>
              <select class="grade w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-950/30">
                ${GRADES.map(g=>`<option value="${g}" ${g===initGrade?'selected':''}>${g}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="text-[11px] text-slate-500 dark:text-slate-300 mb-1">الساعات</div>
              <select class="hrs w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-950/30">
                ${[1,2,3,4].map(h=>`<option value="${h}" ${h===initHours?'selected':''}>${h}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div class="text-[11px] text-slate-500 dark:text-slate-300">نقاط المادة</div>
              <div class="points font-extrabold tabular-nums">0</div>
            </div>
            <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div class="text-[11px] text-slate-500 dark:text-slate-300">قيمة التقدير</div>
              <div class="gval font-extrabold tabular-nums">0</div>
            </div>
          </div>

          <button type="button" class="remove w-full rounded-xl border border-slate-200 dark:border-slate-700 py-3 font-bold text-red-600 active:opacity-80">حذف المادة</button>
        </div>
      </details>
    </div>`;
  }

  function reindex(){
    [...coursesEl.querySelectorAll('[data-card]')].forEach((c,i)=>{c.querySelector('.title').textContent='مادة '+pad2(i+1);});
  }

  function recalc(){
    let semPoints=0, semHours=0;
    [...coursesEl.querySelectorAll('[data-card]')].forEach(cardEl=>{
      const grade=cardEl.querySelector('.grade').value;
      const hrs=num(cardEl.querySelector('.hrs').value);
      const gp=MAP[grade]??0;
      const points=gp*hrs;

      cardEl.querySelector('.points').textContent=fmtNum(points);
      cardEl.querySelector('.gval').textContent=fmtNum(gp);
      cardEl.querySelector('.mini').textContent=`${grade} • ${hrs}`;

      semPoints+=points; semHours+=hrs;
    });

    const semGpa=semHours?(semPoints/semHours):0;

    const prevH=Math.max(0,num(prevHoursEl.value));
    const prevG=clamp(num(prevGpaEl.value),0,4);
    const prevPoints=prevH*prevG;

    const cumHours=prevH+semHours;
    const cumPoints=prevPoints+semPoints;
    const cumGpa=cumHours?(cumPoints/cumHours):0;

    semGpaEl.textContent=fmtGpa(semGpa);
    cumGpaEl.textContent=fmtGpa(cumGpa);

    semHoursEl.textContent=String(Math.round(semHours));
    cumHoursEl.textContent=String(Math.round(cumHours));

    semPointsEl.textContent=fmtNum(semPoints);
    cumPointsEl.textContent=fmtNum(cumPoints);

    semBar.style.width=`${clamp((semGpa/4)*100,0,100)}%`;
    cumBar.style.width=`${clamp((cumGpa/4)*100,0,100)}%`;

    save();
  }

  function bindCard(cardEl){
    cardEl.querySelectorAll('select').forEach(el=>el.addEventListener('change',recalc));
    cardEl.querySelector('details').addEventListener('toggle',save);
    cardEl.querySelector('.remove').addEventListener('click',()=>{cardEl.remove(); reindex(); recalc();});
  }

  function addCard(initGrade='A', initHours=3, open=false){
    coursesEl.insertAdjacentHTML('beforeend', card(coursesEl.children.length+1, initGrade, initHours, open));
    bindCard(coursesEl.lastElementChild);
    reindex(); recalc();
  }

  function hydrate(state){
    prevHoursEl.value=state?.prevHours ?? 0;
    prevGpaEl.value=state?.prevGpa ?? 0;

    coursesEl.innerHTML='';
    const list = state?.courses?.length ? state.courses : null;
    if(list){ list.forEach(c=>addCard(c.grade??'A', c.hours??3, !!c.open)); }
    else { for(let i=0;i<5;i++) addCard('A',3,i===0); }

    setTheme(state?.theme ?? 'light');
    recalc();
  }

  // sheet grade options
  GRADES.forEach(g=>{const o=document.createElement('option'); o.value=g; o.textContent=g; newGrade.appendChild(o);});
  newGrade.value='A';

  // events
  prevHoursEl.addEventListener('input',recalc);
  prevGpaEl.addEventListener('input',recalc);

  fab.addEventListener('click',openSheet);
  closeSheet.addEventListener('click',closeSheetFn);
  sheetBackdrop.addEventListener('click',closeSheetFn);

  addCourse.addEventListener('click',()=>{addCard(newGrade.value, num(newHours.value)||3, true); closeSheetFn();});

  resetBtn.addEventListener('click',()=>{localStorage.removeItem(LS_KEY); hydrate(null);});

  toggleTheme.addEventListener('click',()=>{
    const isDark=document.documentElement.classList.contains('dark');
    setTheme(isDark?'light':'dark');
    save();
  });

  // init
  hydrate(load());
})();
