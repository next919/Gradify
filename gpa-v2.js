const coursesEl=document.getElementById('courses')
const addBtn=document.getElementById('add')
const gpaEl=document.getElementById('gpa')
const hoursTotalEl=document.getElementById('hoursTotal')
const pointsTotalEl=document.getElementById('pointsTotal')
const prevHoursEl=document.getElementById('prevHours')
const prevGpaEl=document.getElementById('prevGpa')

const MAP={A+:4,A:3.75,'B+':3.5,B:3,'C+':2.5,C:2,'D+':1.5,D:1,F:0}

function card(i){
return `
<div class="bg-white rounded-xl shadow border p-4 space-y-3">
  <div class="flex justify-between font-bold">
    <span>مادة ${String(i).padStart(2,'0')}</span>
    <button class="remove text-red-500 text-sm">حذف</button>
  </div>
  <select class="grade w-full border rounded-lg px-3 py-2">
    <option>A+</option><option>A</option><option>B+</option><option>B</option>
    <option>C+</option><option>C</option><option>D+</option><option>D</option><option>F</option>
  </select>
  <select class="hours w-full border rounded-lg px-3 py-2">
    <option>1</option><option>2</option><option selected>3</option><option>4</option>
  </select>
</div>`}

function recalc(){
let semPoints=0, semHours=0
document.querySelectorAll('.grade').forEach((g,i)=>{
const h=Number(document.querySelectorAll('.hours')[i].value)
const p=MAP[g.value]*h
semPoints+=p; semHours+=h
})
const prevH=Number(prevHoursEl.value)||0
const prevG=Number(prevGpaEl.value)||0
const totalHours=prevH+semHours
const totalPoints=prevH*prevG+semPoints
gpaEl.textContent= totalHours? (totalPoints/totalHours).toFixed(2):'0.00'
hoursTotalEl.textContent=totalHours
pointsTotalEl.textContent=totalPoints.toFixed(2)
}

function bind(){
document.querySelectorAll('.grade,.hours').forEach(e=>e.onchange=recalc)
document.querySelectorAll('.remove').forEach(b=>b.onclick=()=>{
b.parentElement.parentElement.remove(); renumber(); recalc()
})
}

function renumber(){
document.querySelectorAll('#courses > div').forEach((c,i)=>{
c.querySelector('span').textContent='مادة '+String(i+1).padStart(2,'0')
})
}

addBtn.onclick=()=>{
coursesEl.insertAdjacentHTML('beforeend',card(coursesEl.children.length+1))
bind(); recalc()
}

addBtn.click()
