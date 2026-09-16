const SOURCE_URL = 'pdf-mupdf.js?v=6';

function replaceRange(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Patch start not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Patch end not found: ${endMarker}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const response = await fetch(SOURCE_URL, { cache: 'no-store' });
if (!response.ok) throw new Error(`Unable to load editor source: ${response.status}`);
let source = await response.text();

// Add one high-resolution tile over the normal full-page preview. The tile is
// rendered only for the visible PDF area after pinch/pan, so 400–500% zoom can
// remain sharp on mobile without allocating a gigantic full-page bitmap.
source = source.replace(
  'let transformFrame=0,qualityTimer=0,renderedScale=0,renderGeneration=0,previewRequest=0;',
  'let transformFrame=0,qualityTimer=0,renderedScale=0,renderGeneration=0,previewRequest=0,zoomTile=null,zoomTileURL=null;'
);

source = source.replace(
  'view.zoomScale=next;clampPan();queueTransform();',
  "view.zoomScale=next;if(zoomTile)zoomTile.style.visibility='hidden';clampPan();queueTransform();"
);

source = source.replace(
  "clearTimeout(qualityTimer);renderGeneration++;renderedScale=0;pageImage.removeAttribute('src');",
  "clearTimeout(qualityTimer);renderGeneration++;renderedScale=0;pageImage.removeAttribute('src');if(zoomTile){zoomTile.remove();zoomTile=null;}if(zoomTileURL){URL.revokeObjectURL(zoomTileURL);zoomTileURL=null;}"
);

const previewReplacement = `function basePreviewScale(){
  const dpr=window.devicePixelRatio||1;
  return Math.min(4,Math.max(1.5,view.baseScale*dpr*1.45));
}
function visiblePdfRect(){
  const s=Math.max(.0001,view.baseScale*view.zoomScale),w=currentBounds[2]-currentBounds[0],h=currentBounds[3]-currentBounds[1];
  const vw=pageViewport.clientWidth/s,vh=pageViewport.clientHeight/s;
  let x0=currentBounds[0]+(-view.panX)/s,y0=currentBounds[1]+(-view.panY)/s;
  let x1=x0+vw,y1=y0+vh;
  const ox=vw*.12,oy=vh*.12;
  x0=clamp(x0-ox,currentBounds[0],currentBounds[2]);y0=clamp(y0-oy,currentBounds[1],currentBounds[3]);
  x1=clamp(x1+ox,currentBounds[0],currentBounds[2]);y1=clamp(y1+oy,currentBounds[1],currentBounds[3]);
  if(x1<=x0){x0=currentBounds[0];x1=currentBounds[2];}
  if(y1<=y0){y0=currentBounds[1];y1=currentBounds[3];}
  return [x0,y0,x1,y1];
}
async function loadPreviewPage(){
  const list=edits.filter(e=>e.page===currentPage);
  if(!list.length)return {page:documentRef.loadPage(currentPage),tempDoc:null};
  if(list.some(e=>hasArabic(e.newText)))await ensureArabicEngine();
  const tempDoc=mupdf.Document.openDocument(originalBytes,'application/pdf');
  const pdf=typeof tempDoc.asPDF==='function'?tempDoc.asPDF():tempDoc;
  const page=pdf.loadPage(currentPage);
  for(const e of list){const red=page.createAnnotation('Redaction');red.setRect(expandRect(e.bbox,.35));red.update?.();}
  page.applyRedactions(false,mupdf.PDFPage.REDACT_IMAGE_NONE,mupdf.PDFPage.REDACT_LINE_ART_NONE,mupdf.PDFPage.REDACT_TEXT_REMOVE);
  for(const e of list){
    if(!e.newText)continue;
    if(hasArabic(e.newText))await addArabicVector(page,pdf,e);
    else{const a=page.createAnnotation('FreeText');a.setRect(expandRect(e.bbox,.35));a.setContents(e.newText);a.setDefaultAppearance(daFont(e),e.fontSize,[0,0,0]);a.update();}
  }
  page.update?.();
  return {page,tempDoc};
}
async function renderFullPreview(page,generation,request){
  const scale=basePreviewScale();let pix=null,url=null;
  try{
    pix=page.toPixmap(mupdf.Matrix.scale(scale,scale),mupdf.ColorSpace.DeviceRGB,false,true,'View','CropBox');
    url=URL.createObjectURL(new Blob([pix.asPNG()],{type:'image/png'}));
    pix.destroy();pix=null;
    const decoded=new Image();decoded.src=url;await decoded.decode();
    if(generation!==renderGeneration||request!==previewRequest){URL.revokeObjectURL(url);return false;}
    const old=pageObjectURL;pageObjectURL=url;pageImage.src=url;if(old)URL.revokeObjectURL(old);
    return true;
  }finally{try{pix?.destroy?.()}catch{}}
}
async function renderSharpTile(page,generation,request){
  if(view.zoomScale<=1.12){if(zoomTile)zoomTile.style.visibility='hidden';return null;}
  const rect=visiblePdfRect(),dpr=window.devicePixelRatio||1;
  let scale=Math.min(14,Math.max(basePreviewScale(),view.baseScale*view.zoomScale*dpr));
  const pixelBudget=mobile()?7000000:12000000;
  const area=Math.max(1,(rect[2]-rect[0])*(rect[3]-rect[1]));
  scale=Math.min(scale,Math.sqrt(pixelBudget/area));
  const matrix=mupdf.Matrix.scale(scale,scale);
  const bbox=[Math.floor(rect[0]*scale),Math.floor(rect[1]*scale),Math.ceil(rect[2]*scale),Math.ceil(rect[3]*scale)];
  let pix=null,dev=null,url=null;
  try{
    pix=new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB,bbox,false);pix.clear(255);
    dev=new mupdf.DrawDevice(mupdf.Matrix.identity,pix);
    page.run(dev,matrix);
    try{page.runPageWidgets?.(dev,matrix)}catch{}
    try{for(const annot of page.getAnnotations?.()||[]){try{annot.run(dev,matrix)}finally{try{annot.destroy?.()}catch{}}}}catch{}
    dev.close?.();dev=null;
    url=URL.createObjectURL(new Blob([pix.asPNG()],{type:'image/png'}));pix.destroy();pix=null;
    const decoded=new Image();decoded.src=url;await decoded.decode();
    if(generation!==renderGeneration||request!==previewRequest){URL.revokeObjectURL(url);return null;}
    if(!zoomTile){zoomTile=document.createElement('img');zoomTile.alt='';zoomTile.setAttribute('aria-hidden','true');Object.assign(zoomTile.style,{position:'absolute',zIndex:'2',pointerEvents:'none',userSelect:'none'});pageStage.appendChild(zoomTile);}
    const old=zoomTileURL;zoomTileURL=url;zoomTile.src=url;
    zoomTile.style.left=\`${(rect[0]-currentBounds[0])*view.baseScale}px\`;
    zoomTile.style.top=\`${(rect[1]-currentBounds[1])*view.baseScale}px\`;
    zoomTile.style.width=\`${(rect[2]-rect[0])*view.baseScale}px\`;
    zoomTile.style.height=\`${(rect[3]-rect[1])*view.baseScale}px\`;
    zoomTile.style.visibility='visible';
    if(old)URL.revokeObjectURL(old);
    return scale;
  }finally{try{dev?.close?.()}catch{}try{pix?.destroy?.()}catch{}}
}
async function renderPreview(force=false){
  if(!documentRef)return;
  const generation=renderGeneration,request=++previewRequest;let page=null,tempDoc=null;
  try{
    ({page,tempDoc}=await loadPreviewPage());
    if(force||!pageImage.src)await renderFullPreview(page,generation,request);
    const tileScale=await renderSharpTile(page,generation,request);
    if(generation!==renderGeneration||request!==previewRequest)return;
    renderedScale=tileScale||basePreviewScale();
    pageStatus.textContent=\`تكبير ${Math.round(view.zoomScale*100)}% — ${tileScale?'منطقة مرئية عالية الدقة':'صفحة عالية الدقة'} ${Math.round(renderedScale*72)} DPI — ${currentItems.length} منطقة نصية\`;
  }catch(e){if(generation===renderGeneration)pageStatus.textContent=\`تعذر تحسين المعاينة: ${e?.message||e}\`;console.error(e);}
  finally{try{page?.destroy?.()}catch{}try{tempDoc?.destroy?.()}catch{}}
}
`;

source = replaceRange(source, 'function targetRenderScale(){', 'function scheduleQuality()', previewReplacement + 'function scheduleQuality()');

// The committed edit is now rendered by MuPDF itself in the page preview. Do
// not paint a white HTML rectangle over the PDF after the edit.
source = replaceRange(
  source,
  'function renderOverlay(){',
  'function drawActiveBox',
  "function renderOverlay(){textLayer.innerHTML='';if(activeItem&&!inlineEditor.hidden)drawActiveBox(activeItem);}\nfunction drawActiveBox"
);

source = source.replace(
  'if(rerender)renderOverlay();',
  'if(rerender){renderOverlay();renderedScale=0;void renderPreview(true);}'
);

source = source.replace(
  "window.addEventListener('pagehide',e=>{if(!e.persisted){clearTimeout(qualityTimer);renderGeneration++;if(pageObjectURL)URL.revokeObjectURL(pageObjectURL);destroyDocument();}});",
  "window.addEventListener('pagehide',e=>{if(!e.persisted){clearTimeout(qualityTimer);renderGeneration++;if(pageObjectURL)URL.revokeObjectURL(pageObjectURL);if(zoomTileURL)URL.revokeObjectURL(zoomTileURL);destroyDocument();}});"
);

const blobURL = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(blobURL);
} finally {
  URL.revokeObjectURL(blobURL);
}
