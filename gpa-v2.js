const coursesEl=document.getElementById('courses')
const gpaEl=document.getElementById('gpa')
const addBtn=document.getElementById('add')

const map={
"A+":4,"A":3.75,"B+":3.5,"B":3,
"C+":2.5,"C":2,"D+":1.5,"D":1,"F":0
}

function courseCard(){
return `
<div class="bg-white rounded-xl p-4 shadow space-y-3">
<select class="grade w-full border rounded p-2">
<option>A+</option><option>A</option><option>B+</option><option>B</option>
<option>C+</option><option>C</option><option>D+</option><option>D</option><option>F</option>
</select>
<input type="number" class="hours w-full border rounded p-2" value="3" min="0">
</div>`
}

function calc(){
let points=0,hours=0
document.querySelectorAll('.grade').forEach((g,i)=>{
const h=parseFloat(document.querySelectorAll('.hours')[i].value)||0
points+=map[g.value]*h
hours+=h
})
gpaEl.textContent=hours? (points/hours).toFixed(2):"0.00"
}

addBtn.onclick=()=>{
coursesEl.insertAdjacentHTML('beforeend',courseCard())
coursesEl.querySelectorAll('select,input').forEach(e=>e.oninput=calc)
calc()
}

addBtn.click()
