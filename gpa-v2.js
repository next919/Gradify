document.addEventListener('DOMContentLoaded',()=>{
const courses=document.getElementById('courses')
const add=document.getElementById('add')
const semGpa=document.getElementById('semGpa')
const cumGpa=document.getElementById('cumGpa')
const prevHours=document.getElementById('prevHours')
const prevGpa=document.getElementById('prevGpa')

const MAP={"A+":4,"A":3.75,"B+":3.5,"B":3,"C+":2.5,"C":2,"D+":1.5,"D":1,"F":0}

function card(i){
return `<div class="bg-white rounded-xl border p-4">
<div class="font-bold mb-2">مادة ${String(i).padStart(2,'0')}</div>
<select class="grade w-full border rounded px-3 py-2 mb-2">
${Object.keys(MAP).map(g=>`<option>${g}</option>`).join('')}
</select>
<select class="hrs w-full border rounded px-3 py-2">
<option>1</option><option>2</option><option selected>3</option><option>4</option>
</select>
</div>`}

function recalc(){
let sp=0,sh=0
document.querySelectorAll('.grade').forEach((g,i)=>{
const h=+document.querySelectorAll('.hrs')[i].value
sp+=MAP[g.value]*h
sh+=h
})
const sem=sh?sp/sh:0
const ph=+prevHours.value||0
const pg=+prevGpa.value||0
const cp=(ph*pg)+sp
const ch=ph+sh
const cum=ch?cp/ch:0
semGpa.textContent=sem.toFixed(2)+"/4"
cumGpa.textContent=cum.toFixed(2)+"/4"
}

add.onclick=()=>{courses.insertAdjacentHTML('beforeend',card(courses.children.length+1));bind();recalc()}
function bind(){document.querySelectorAll('select').forEach(e=>e.onchange=recalc)}
prevHours.oninput=prevGpa.oninput=recalc

for(let i=0;i<5;i++) add.click()
})
