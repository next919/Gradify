const SOURCE_URL = 'pdf-mupdf.js?v=6';

function replaceRange(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Patch start not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Patch end not found: ${endMarker}`);
  return source.slice(0, start) + replacement + source.slice(end);
}
function replaceOnce(source, needle, replacement) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Patch text not found: ${needle.slice(0,80)}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

const response = await fetch(SOURCE_URL, { cache: 'no-store' });
if (!response.ok) throw new Error(`Unable to load editor source: ${response.status}`);
let source = await response.text();

source = replaceRange(source, 'function targetRenderScale(){', 'async function renderPreview', `function targetRenderScale(){
  const w=currentBounds[2]-currentBounds[0],h=currentBounds[3]-currentBounds[1];
  const budget=mobile()?8000000:36000000;
  const maxDim=mobile()?4096:9000;
  return Math.min(
    Math.max(1,view.baseScale*view.zoomScale*(window.devicePixelRatio||1)),
    Math.sqrt(budget/Math.max(1,w*h)),
    maxDim/Math.max(w,h)
  );
}
`);

source = replaceRange(
  source,
  'function renderOverlay(){',
  'function drawActiveBox',
  `function renderOverlay(){
  textLayer.innerHTML='';
  if(activeItem&&!inlineEditor.hidden)drawActiveBox(activeItem);
}
`
);

const editHelpers = `
async function applyEditsToPdf(pdf, editList=edits){
  if(editList.some(e=>hasArabic(e.newText)))await ensureArabicEngine();
  const byPage=new Map();
  for(const e of editList){if(!byPage.has(e.page))byPage.set(e.page,[]);byPage.get(e.page).push(e);}
  for(const [pi,list] of byPage){
    const page=pdf.loadPage(pi);
    try{
      for(const e of list){
        const red=page.createAnnotation('Redaction');
        red.setRect(expandRect(e.bbox,.20));
        try{red.setOpacity?.(0)}catch{}
        red.update?.();
      }
      page.applyRedactions(false,mupdf.PDFPage.REDACT_IMAGE_NONE,mupdf.PDFPage.REDACT_LINE_ART_NONE,mupdf.PDFPage.REDACT_TEXT_REMOVE);
      for(const e of list){
        if(!e.newText)continue;
        if(hasArabic(e.newText)){
          await addArabicVector(page,pdf,e);
        }else{
          const a=page.createAnnotation('FreeText');
          a.setRect(expandRect(e.bbox,.12));
          a.setContents(e.newText);
          a.setDefaultAppearance(daFont(e),e.fontSize,[0,0,0]);
          try{a.setOpacity?.(1)}catch{}
          a.update();
        }
      }
      page.update?.();
    }finally{try{page.destroy?.()}catch{}}
  }
}

async function renderCommittedPreview(){
  if(!documentRef)return;
  const pageEdits=edits.filter(e=>e.page===currentPage);
  if(!pageEdits.length){await renderPreview(true);return;}
  const generation=renderGeneration,request=++previewRequest;
  let tempDoc=null,page=null,pix=null,dev=null,url=null;
  try{
    pageStatus.textContent='جاري تحديث معاينة الصفحة المعدلة…';
    tempDoc=mupdf.Document.openDocument(originalBytes,'application/pdf');
    const pdf=typeof tempDoc.asPDF==='function'?tempDoc.asPDF():tempDoc;
    await applyEditsToPdf(pdf,pageEdits);
    page=pdf.loadPage(currentPage);
    const bounds=page.getBounds(),scale=targetRenderScale();
    const bbox=[Math.floor(bounds[0]*scale),Math.floor(bounds[1]*scale),Math.ceil(bounds[2]*scale),Math.ceil(bounds[3]*scale)];
    pix=new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB,bbox,false);pix.clear(255);
    dev=new mupdf.DrawDevice(mupdf.Matrix.identity,pix);
    const matrix=mupdf.Matrix.scale(scale,scale);
    page.run(dev,matrix);
    try{page.runPageWidgets?.(dev,matrix)}catch{}
    try{
      for(const annot of page.getAnnotations?.()||[]){
        try{annot.run(dev,matrix)}finally{try{annot.destroy?.()}catch{}}
      }
    }catch{}
    dev.close?.();dev=null;
    url=URL.createObjectURL(new Blob([pix.asPNG()],{type:'image/png'}));
    pix.destroy();pix=null;
    const decoded=new Image();decoded.src=url;await decoded.decode();
    if(generation!==renderGeneration||request!==previewRequest){URL.revokeObjectURL(url);return;}
    const old=pageObjectURL;pageObjectURL=url;pageImage.src=url;renderedScale=scale;
    if(old)URL.revokeObjectURL(old);
    pageStatus.textContent=`التعديل ظاهر من PDF نفسه — معاينة ${Math.round(scale*72)} DPI`;
  }catch(e){
    console.error(e);
    if(url)URL.revokeObjectURL(url);
    pageStatus.textContent=`تعذر تحديث المعاينة: ${e?.message||e}`;
  }finally{
    try{dev?.close?.()}catch{}try{pix?.destroy?.()}catch{}try{page?.destroy?.()}catch{}try{tempDoc?.destroy?.()}catch{}
  }
}
`;

source = replaceOnce(source, 'function expandRect(r,p=.7){return[r[0]-p,r[1]-p,r[2]+p,r[3]+p];}', `function expandRect(r,p=.7){return[r[0]-p,r[1]-p,r[2]+p,r[3]+p];}\n${editHelpers}`);
source = replaceOnce(
  source,
  'if(rerender)renderOverlay();',
  'if(rerender){renderOverlay();void renderCommittedPreview();}'
);

const saveReplacement = `async function saveEditedPdf(){
  commitActive(false);
  if(!originalBytes||!mupdf)return;
  if(!edits.length){pageStatus.textContent='لا توجد تعديلات للحفظ.';return;}
  const oldLabel=saveBtn.textContent;
  saveBtn.disabled=true;saveBtn.textContent='جاري الحفظ…';
  pageStatus.textContent='جاري إنشاء PDF المعدّل…';
  let doc=null,downloadURL=null;
  try{
    doc=mupdf.Document.openDocument(originalBytes,'application/pdf');
    const pdf=typeof doc.asPDF==='function'?doc.asPDF():doc;
    await applyEditsToPdf(pdf,edits);
    const buf=pdf.saveToBuffer('compress=yes,garbage=compact,appearance=yes');
    const bytes=buf.asUint8Array();
    if(!bytes?.length)throw new Error('MuPDF أعاد ملفًا فارغًا');
    const blob=new Blob([bytes],{type:'application/pdf'});
    downloadURL=URL.createObjectURL(blob);
    const fileOut=sourceName.replace(/\.pdf$/i,'')+'-edited.pdf';
    const link=document.createElement('a');
    link.href=downloadURL;link.download=fileOut;link.textContent='تحميل الملف المعدّل';
    link.style.fontWeight='800';link.style.color='#b80f16';link.style.marginInlineStart='8px';
    document.body.appendChild(link);link.click();link.remove();
    pageStatus.textContent='تم إنشاء الملف ✓ إذا لم يبدأ التنزيل، اضغط هنا: ';
    const fallback=document.createElement('a');fallback.href=downloadURL;fallback.download=fileOut;fallback.textContent='تحميل PDF';fallback.style.fontWeight='900';fallback.style.color='#b80f16';pageStatus.appendChild(fallback);
    setTimeout(()=>{try{URL.revokeObjectURL(downloadURL)}catch{}},120000);
  }catch(e){
    console.error('PDF SAVE FAILED',e);
    pageStatus.textContent=`فشل الحفظ: ${e?.message||e}`;
    alert(`تعذر حفظ PDF:\n${e?.message||e}`);
  }finally{
    saveBtn.disabled=false;saveBtn.textContent=oldLabel;
    try{doc?.destroy?.()}catch{}
  }
}
`;
source = replaceRange(source, 'async function saveEditedPdf(){', "saveBtn.addEventListener('click',saveEditedPdf);", saveReplacement);

const blobURL=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
try{await import(blobURL);}finally{URL.revokeObjectURL(blobURL);}
