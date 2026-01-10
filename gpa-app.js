(() => {
  const LS_KEY='gpa_app_v3';
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
  const toast=$('toast'), toastText=$('toastText');
  let lastToastAt=0;

  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const num=(v)=>{const x=Number(String(v??'').replace(',','.')); return Number.isFinite(x)?x:0;}
  const pad2=(n)=>String(n).padStart(2,'0');

  // robust rounding against floating errors (e.g., 3.625 becoming 3.62)
  const roundN = (x, n) => {
    const p = 10 ** n;
    return Math.round((x + 1e-12) * p) / p;
  };
  const fmtGpa = (v) => {
    const r = roundN(v, 2);
    return (Math.abs(r - Math.round(r)) < 1e-12) ? String(Math.round(r)) : r.toFixed(2);
  };
  const fmtNum = (v) => {
    const r = roundN(v, 2);
    if (Math.abs(r) < 1e-12) return '0';
    return (Math.abs(r - Math.round(r)) < 1e-12) ? String(Math.round(r)) : r.toFixed(2);
  };

  function setTheme(mode){
    const isDark = mode==='dark';
    document.documentElement.classList.toggle('dark',isDark);
    sun.classList.toggle('hidden',!isDark);
    moon.classList.toggle('hidden',isDark);
  }

  function openSheet(){sheetBackdrop.classList.remove('hidden'); sheet.classList.remove('translate-y-full');}
  function closeSheetFn(){sheetBackdrop.classList.add('hidden'); sheet.classList.add('translate-y-full');}

  function showToast(msg){
    const now=Date.now();
    if(now-lastToastAt<1800) return;
    lastToastAt=now;
    toastText.textContent=msg;
    toast.classList.remove('hidden');
    toast.animate([{transform:'translate(-50%, 10px)',opacity:0},{transform:'translate(-50%, 0)',opacity:1}],{duration:180,easing:'ease-out',fill:'both'});
    setTimeout(()=>{toast.animate([{opacity:1},{opacity:0}],{duration:220,fill:'both'}).onfinish=()=>toast.classList.add('hidden');},1400);
  }

  function burst(){
    const root=document.body, count=16;
    for(let i=0;i<count;i++){
      const p=document.createElement('div');
      p.style.position='fixed'; p.style.left='50%'; p.style.top='18%';
      p.style.width='8px'; p.style.height='8px'; p.style.borderRadius='999px';
      p.style.background=`hsl(${Math.random()*360} 90% 60%)`;
      p.style.zIndex='60';
      const angle=(Math.PI*2)*(i/count)+(Math.random()*0.25);
      const dist=90+Math.random()*60;
      const dx=Math.cos(angle)*dist, dy=Math.sin(angle)*dist;
      root.appendChild(p);
      p.animate([{transform:`translate(-50%,-50%) translate(0,0)`,opacity:1},
                 {transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${Math.random()*360}deg)`,opacity:0}],
                {duration:650+Math.random()*250,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
      setTimeout(()=>p.remove(),1000);
    }
  }

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
    localStorage.setItem('gpa_app_v3_state', JSON.stringify(state));
  }
  function load(){ try{const raw=localStorage.getItem('gpa_app_v3_state'); return raw?JSON.parse(raw):null;}catch{return null;} }

  function card(index, initGrade='A', initHours=3, open=false){
    const n=pad2(index);
    return `
    <div class="bg-white/92 dark:bg-slate-900/80 rounded-2xl shadow-soft border border-slate-200/70 dark:border-slate-700/60 overflow-hidden" data-card>
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

    if(cumHours>0){
      if(cumGpa>=3.85) { showToast('🔥 ممتاز جدًا'); burst(); }
      else if(cumGpa>=3.5) showToast('✨ أداء رائع');
    }

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

  GRADES.forEach(g=>{const o=document.createElement('option'); o.value=g; o.textContent=g; newGrade.appendChild(o);});
  newGrade.value='A';

  prevHoursEl.addEventListener('input',recalc);
  prevGpaEl.addEventListener('input',recalc);

  fab.addEventListener('click',openSheet);
  closeSheet.addEventListener('click',closeSheetFn);
  sheetBackdrop.addEventListener('click',closeSheetFn);
  addCourse.addEventListener('click',()=>{addCard(newGrade.value, num(newHours.value)||3, true); closeSheetFn();});

  resetBtn.addEventListener('click',()=>{localStorage.removeItem('gpa_app_v3_state'); hydrate(null);});

  toggleTheme.addEventListener('click',()=>{
    const isDark=document.documentElement.classList.contains('dark');
    setTheme(isDark?'light':'dark');
    save();
  });

  hydrate(load());
})();