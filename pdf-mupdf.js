let mupdf = null;
const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const pickBtn = $('pickBtn');
const uploadCard = $('uploadCard');
const workspace = $('workspace');
const engineStatus = $('engineStatus');
const fileName = $('fileName');
const pageInfo = $('pageInfo');
const prevBtn = $('prevBtn');
const nextBtn = $('nextBtn');
const saveBtn = $('saveBtn');
const pageImage = $('pageImage');
const pageStage = $('pageStage');
const textLayer = $('textLayer');
const pageStatus = $('pageStatus');
const selectionHelp = $('selectionHelp');
const selectionForm = $('selectionForm');
const originalText = $('originalText');
const replacementText = $('replacementText');
const fontSize = $('fontSize');
const applyBtn = $('applyBtn');
const deleteEditBtn = $('deleteEditBtn');
const inlineEditor = $('inlineEditor');
const editCount = $('editCount');
const arabicState = $('arabicState');

let originalBytes = null;
let sourceName = '';
let documentRef = null;
let pdfRef = null;
let currentPage = 0;
let pageCount = 0;
let currentBounds = [0,0,595,842];
let currentItems = [];
let selectedItem = null;
let edits = [];
let pageObjectURL = null;

function status(message, error=false){
  engineStatus.textContent = message;
  engineStatus.style.color = error ? '#b80f16' : '';
}
function hasArabic(s){ return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(s || ''); }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function escapeKeyText(s){ return String(s||'').replace(/\s+/g,' ').trim().slice(0,80); }
function editKey(page,bbox,text){ return `${page}|${bbox.map(v=>Number(v).toFixed(2)).join(',')}|${escapeKeyText(text)}`; }
function findEdit(item){ const key=editKey(currentPage,item.bbox,item.text); return edits.find(e=>e.key===key); }
function updateEditCount(){ editCount.textContent=String(edits.length); }

async function initEngine(){
  try{
    status('جاري تحميل محرك MuPDF.js الرسمي…');
    mupdf = await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.1/dist/mupdf.js');
    status('MuPDF.js جاهز. اختر ملف PDF للاختبار.');
  }catch(err){
    console.error(err);
    status('تعذر تحميل MuPDF.js. افتح الصفحة في Safari/Chrome وتأكد من اتصال الإنترنت.', true);
    pickBtn.disabled = true;
  }
}
initEngine();

pickBtn.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change', async (e)=>{
  const file=e.target.files?.[0];
  fileInput.value='';
  if(!file) return;
  if(!/\.pdf$/i.test(file.name) && file.type!=='application/pdf'){
    status('اختر ملف PDF صالح.',true);return;
  }
  await openFile(file);
});

async function openFile(file){
  if(!mupdf){ status('محرك MuPDF.js لم يجهز بعد.',true); return; }
  try{
    status('جاري فتح الملف محليًا…');
    originalBytes = new Uint8Array(await file.arrayBuffer());
    sourceName = file.name;
    destroyDocument();
    documentRef = mupdf.Document.openDocument(originalBytes, 'application/pdf');
    pdfRef = typeof documentRef.asPDF === 'function' ? documentRef.asPDF() : documentRef;
    pageCount = documentRef.countPages();
    currentPage=0; edits=[]; selectedItem=null; updateEditCount();
    fileName.textContent=file.name;
    uploadCard.hidden=true; workspace.hidden=false;
    await renderPage();
  }catch(err){
    console.error(err);
    status(`تعذر فتح الملف: ${err?.message || err}`,true);
  }
}

function destroyDocument(){
  try{ documentRef?.destroy?.(); }catch{}
  documentRef=null;pdfRef=null;
}

function normalizeBBox(raw){
  if(!raw) return null;
  if(Array.isArray(raw) && raw.length>=4){
    const [a,b,c,d]=raw.map(Number);
    return [a,b,c,d];
  }
  if(typeof raw==='object'){
    if(['x','y','w','h'].every(k=>Number.isFinite(Number(raw[k])))){
      const x=Number(raw.x),y=Number(raw.y),w=Number(raw.w),h=Number(raw.h);
      return [x,y,x+w,y+h];
    }
    if(['x0','y0','x1','y1'].every(k=>Number.isFinite(Number(raw[k])))){
      return [Number(raw.x0),Number(raw.y0),Number(raw.x1),Number(raw.y1)];
    }
  }
  return null;
}
function spanText(span){
  if(typeof span?.text==='string') return span.text;
  if(Array.isArray(span?.chars)) return span.chars.map(c=>c.c ?? c.char ?? c.text ?? '').join('');
  return '';
}
function extractItems(json){
  const out=[];
  const blocks=json?.blocks || [];
  for(const block of blocks){
    if(block?.type && block.type!=='text') continue;
    for(const line of block?.lines || []){
      const spans=line?.spans || [];
      if(spans.length){
        for(const span of spans){
          const text=spanText(span).trim();
          const bbox=normalizeBBox(span.bbox || line.bbox);
          if(text && bbox && bbox[2]>bbox[0] && bbox[3]>bbox[1]) out.push({text,bbox,size:Number(span.size)||0,font:span.font||''});
        }
      }else{
        const text=(line?.text || (line?.chars||[]).map(c=>c.c||'').join('')).trim();
        const bbox=normalizeBBox(line?.bbox);
        if(text && bbox) out.push({text,bbox,size:Number(line.size)||0,font:line.font||''});
      }
    }
  }
  return out;
}

async function renderPage(){
  if(!documentRef) return;
  closeInlineEditor();
  textLayer.innerHTML='';
  pageStatus.textContent='جاري إنشاء معاينة عالية الدقة…';
  prevBtn.disabled=currentPage<=0; nextBtn.disabled=currentPage>=pageCount-1;
  pageInfo.textContent=`الصفحة ${currentPage+1} من ${pageCount}`;

  let page=null, pixmap=null, stext=null;
  try{
    page=documentRef.loadPage(currentPage);
    currentBounds=page.getBounds();
    const pageW=Math.max(1,currentBounds[2]-currentBounds[0]);
    const pageH=Math.max(1,currentBounds[3]-currentBounds[1]);
    const dpr=window.devicePixelRatio||1;
    const scale=clamp(dpr*1.65,2.5,4);
    pixmap=page.toPixmap(mupdf.Matrix.scale(scale,scale),mupdf.ColorSpace.DeviceRGB,false,true,'View','CropBox');
    const png=pixmap.asPNG();
    if(pageObjectURL) URL.revokeObjectURL(pageObjectURL);
    pageObjectURL=URL.createObjectURL(new Blob([png],{type:'image/png'}));
    pageImage.src=pageObjectURL;
    pageStage.style.aspectRatio=`${pageW}/${pageH}`;
    const maxCss=Math.min(pageW, Math.max(280, document.querySelector('.pageArea').clientWidth-24));
    pageStage.style.width=`${maxCss}px`;

    stext=page.toStructuredText('preserve-spans,preserve-whitespace');
    let parsed={};
    try{ parsed=JSON.parse(stext.asJSON()); }catch{ parsed={}; }
    currentItems=extractItems(parsed);
    renderTextLayer();
    pageStatus.textContent=`معاينة ${Math.round(scale*72)} DPI — تم التعرف على ${currentItems.length} منطقة نصية`;
    arabicState.textContent=currentItems.some(x=>hasArabic(x.text)) ? 'العربية: تم اكتشاف نص عربي ✓' : 'العربية: لم يكتشف نص عربي بهذه الصفحة';
  }catch(err){
    console.error(err);
    pageStatus.textContent=`خطأ في عرض الصفحة: ${err?.message || err}`;
  }finally{
    try{stext?.destroy?.()}catch{}
    try{pixmap?.destroy?.()}catch{}
    try{page?.destroy?.()}catch{}
  }
}

function renderTextLayer(){
  textLayer.innerHTML='';
  const [x0,y0,x1,y1]=currentBounds;
  const w=x1-x0,h=y1-y0;
  currentItems.forEach((item,index)=>{
    const [a,b,c,d]=item.bbox;
    const hit=document.createElement('div');
    hit.className='textHit';
    hit.dataset.index=String(index);
    hit.style.left=`${((a-x0)/w)*100}%`;
    hit.style.top=`${((b-y0)/h)*100}%`;
    hit.style.width=`${Math.max(.4,((c-a)/w)*100)}%`;
    hit.style.height=`${Math.max(.7,((d-b)/h)*100)}%`;
    hit.title=item.text;
    const existing=findEdit(item);
    if(existing){
      hit.classList.add('edited');
      const preview=document.createElement('span');
      preview.textContent=existing.newText;
      preview.dir='auto';
      preview.style.cssText='position:absolute;inset:-2px;background:#fff;color:#111;display:flex;align-items:center;padding:0 2px;overflow:visible;white-space:pre;line-height:1.15;';
      preview.style.fontSize=`${Math.max(9,existing.fontSize)}px`;
      hit.appendChild(preview);
    }
    hit.addEventListener('click',(ev)=>{ev.preventDefault();ev.stopPropagation();selectItem(index,hit);});
    textLayer.appendChild(hit);
  });
}

function selectItem(index,hit){
  document.querySelectorAll('.textHit.active').forEach(x=>x.classList.remove('active'));
  hit.classList.add('active');
  selectedItem=currentItems[index];
  const existing=findEdit(selectedItem);
  originalText.value=selectedItem.text;
  replacementText.value=existing?.newText ?? selectedItem.text;
  const estimated=Math.round(selectedItem.size || Math.max(8,(selectedItem.bbox[3]-selectedItem.bbox[1])*.75));
  fontSize.value=String(existing?.fontSize || clamp(estimated,8,48));
  selectionHelp.hidden=true; selectionForm.hidden=false;
  openInlineEditor(selectedItem,existing);
}

function openInlineEditor(item,existing){
  const [x0,y0,x1,y1]=currentBounds; const w=x1-x0,h=y1-y0;
  const [a,b,c,d]=item.bbox;
  inlineEditor.hidden=false;
  inlineEditor.value=existing?.newText ?? item.text;
  inlineEditor.style.left=`${((a-x0)/w)*100}%`;
  inlineEditor.style.top=`${((b-y0)/h)*100}%`;
  inlineEditor.style.width=`${Math.max(12,((c-a)/w)*100)}%`;
  inlineEditor.style.height=`${Math.max(3.5,((d-b)/h)*100+1)}%`;
  inlineEditor.style.fontSize=`${Math.max(12,Number(fontSize.value)||14)}px`;
  setTimeout(()=>{inlineEditor.focus();inlineEditor.select();},30);
}
function closeInlineEditor(){ inlineEditor.hidden=true; }
inlineEditor.addEventListener('input',()=>{replacementText.value=inlineEditor.value;});
replacementText.addEventListener('input',()=>{if(!inlineEditor.hidden) inlineEditor.value=replacementText.value;});
fontSize.addEventListener('input',()=>{if(!inlineEditor.hidden) inlineEditor.style.fontSize=`${Number(fontSize.value)||14}px`;});
inlineEditor.addEventListener('keydown',(e)=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();applySelectedEdit();}
  if(e.key==='Escape'){closeInlineEditor();}
});
applyBtn.addEventListener('click',applySelectedEdit);
function applySelectedEdit(){
  if(!selectedItem) return;
  const key=editKey(currentPage,selectedItem.bbox,selectedItem.text);
  edits=edits.filter(e=>e.key!==key);
  const newText=replacementText.value;
  if(newText!==selectedItem.text){
    edits.push({key,page:currentPage,bbox:[...selectedItem.bbox],oldText:selectedItem.text,newText,fontSize:clamp(Number(fontSize.value)||14,6,72),font:selectedItem.font||''});
  }
  updateEditCount(); closeInlineEditor(); renderTextLayer();
  pageStatus.textContent='تم تسجيل التعديل محليًا. اضغط حفظ PDF لتجربة الملف الناتج.';
}
deleteEditBtn.addEventListener('click',()=>{
  if(!selectedItem) return;
  const key=editKey(currentPage,selectedItem.bbox,selectedItem.text);
  edits=edits.filter(e=>e.key!==key);updateEditCount();renderTextLayer();closeInlineEditor();
  replacementText.value=selectedItem.text;
});

prevBtn.addEventListener('click',async()=>{if(currentPage>0){currentPage--;await renderPage();}});
nextBtn.addEventListener('click',async()=>{if(currentPage<pageCount-1){currentPage++;await renderPage();}});

function expandRect(rect,pad=.8){return [rect[0]-pad,rect[1]-pad,rect[2]+pad,rect[3]+pad];}
async function saveEditedPdf(){
  if(!originalBytes||!mupdf) return;
  if(!edits.length){pageStatus.textContent='لا توجد تعديلات للحفظ.';return;}
  saveBtn.disabled=true;
  pageStatus.textContent='جاري إنشاء PDF تجريبي بدون إعادة تصوير الصفحات…';
  let freshDoc=null;
  try{
    freshDoc=mupdf.Document.openDocument(originalBytes,'application/pdf');
    const pdf=typeof freshDoc.asPDF==='function'?freshDoc.asPDF():freshDoc;
    const byPage=new Map();
    for(const e of edits){if(!byPage.has(e.page))byPage.set(e.page,[]);byPage.get(e.page).push(e);}

    for(const [pageIndex,pageEdits] of byPage){
      const page=pdf.loadPage(pageIndex);
      // 1) remove only text content in the selected rectangles. Images and line art are preserved.
      for(const e of pageEdits){
        const red=page.createAnnotation('Redaction');
        red.setRect(expandRect(e.bbox,.6));
        red.update?.();
      }
      page.applyRedactions(false,mupdf.PDFPage.REDACT_IMAGE_NONE,mupdf.PDFPage.REDACT_LINE_ART_NONE,mupdf.PDFPage.REDACT_TEXT_REMOVE);

      // 2) place replacement as editable FreeText. This is intentionally the Arabic compatibility test.
      for(const e of pageEdits){
        if(!e.newText) continue;
        const a=page.createAnnotation('FreeText');
        a.setRect(expandRect(e.bbox,1));
        a.setContents(e.newText);
        a.setDefaultAppearance('Helv',e.fontSize,[0,0,0]);
        a.update();
      }
      page.update?.();
      page.destroy?.();
    }

    const buffer=pdf.saveToBuffer('incremental');
    const bytes=buffer.asUint8Array();
    const blob=new Blob([bytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=sourceName.replace(/\.pdf$/i,'')+'-mupdf-test.pdf';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    pageStatus.textContent='تم حفظ النسخة التجريبية. افتحها الآن وافحص وضوح الصفحة والعربية.';
  }catch(err){
    console.error(err);
    pageStatus.textContent=`فشل الحفظ في هذا الملف: ${err?.message || err}`;
  }finally{
    saveBtn.disabled=false;
    try{freshDoc?.destroy?.()}catch{}
  }
}
saveBtn.addEventListener('click',saveEditedPdf);

window.addEventListener('beforeunload',()=>{if(pageObjectURL)URL.revokeObjectURL(pageObjectURL);destroyDocument();});
