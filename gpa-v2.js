const coursesEl=document.getElementById('courses')
const gpaEl=document.getElementById('gpa')
const addBtn=document.getElementById('add')

const map={
"A+":4,"A":3.75,"B+":3.5,"B":3,
"C+":2.5,"C":2,"D+":1.5,"D":1,"F":0
}

function courseCard(index){
return `
<div class="bg-white rounded-xl p-4 shadow space-y-3">
<div class="flex justify-between items-center font-bold">
<span>مادة ${String(index).padStart(2,"0")}</span>
<button class="remove text-red-500 text-sm">حذف</button>
</div>

<select class="grade w-full border rounded p-2">
<option>A+</option><option>A</option><option>B+</option><option>B</option>
<option>C+</option><option>C</option><option>D+</option><option>D</option><option>F</option>
</select>

<select class="hours w-full border rounded p-2">
<option>1</option>
<option>2</option>
<option selected>3</option>
<option>4</option>
</select>
</div>`
}

function recalc(){
let points=0,hours=0
document.querySelectorAll('.grade').forEach((g,i)=>{
const h=parseFloat(document.querySelectorAll('.hours')[i].value)
points+=map[g.value]*h
hours+=h
})
gpaEl.textContent=hours?(points/hours).toFixed(2):"0.00"
}

function refresh(){
document.querySelectorAll('.grade,.hours').forEach(e=>e.onchange=recalc)
document.querySelectorAll('.remove').forEach(b=>b.onclick=()=>{
b.parentElement.parentElement.remove()
reindex()
recalc()
})
}

function reindex(){
document.querySelectorAll('#courses > div').forEach((c,i)=>{
c.querySelector('span').textContent='مادة '+String(i+1).padStart(2,'0')
})
}

addBtn.onclick=()=>{
coursesEl.insertAdjacentHTML('beforeend',courseCard(coursesEl.children.length+1))
refresh()
recalc()
}

addBtn.click()
