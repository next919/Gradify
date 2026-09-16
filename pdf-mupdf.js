let mupdf=null,hb=null,bidi=null,arabicFontData=null;
const $=id=>document.getElementById(id);
const fileInput=$('fileInput'),pickBtn=$('pickBtn'),uploadCard=$('uploadCard'),workspace=$('workspace');
const engineStatus=$('engineStatus'),fileName=$('fileName'),pageInfo=$('pageInfo'),prevBtn=$('prevBtn'),nextBtn=$('nextBtn'),saveBtn=$('saveBtn');
const pageViewport=$('pageViewport'),pageArea=$('pageArea'),pageImage=$('pageImage'),pageStage=$('pageStage'),textLayer=$('textLayer'),pageStatus=$('pageStatus');
const inlineEditor=$('inlineEditor'),editCount=$('editCount'),arabicState=$('arabicState'),selectionInfo=$('selectionInfo');

let originalBytes=null,sourceName='',documentRef=null,currentPage=0,pageCount=0;
let currentBounds=[0,0,595,842],currentItems=[],edits=[],activeItem=null,pageObjectURL=null;
let committing=false;
const mobile=()=>matchMedia('(max-width:860px)').matches||/iPhone|iPad|Android/i.test(navigator.userAgent);
// Arabic digits need an Arabic-capable font, but are NOT RTL letters.
const hasArabic=s=>/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s||'');
const hasArabicLetters=s=>/[\p{Script=Arabic}]/u.test(String(s||'').replace(/[^\p{Letter}]/gu,''));
const textDirection=s=>hasArabicLetters(s)?'rtl':'ltr';
const numericField=s=>/[0-9٠-٩۰-۹]/.test(s)&&/^[0-9٠-٩۰-۹\s/.,:()+%−–—\-٫٬]+$/.test(s);
const numericPart=s=>/^[0-9٠-٩۰-۹/.,:()+%−–—\-٫٬]+$/.test(s);
const numericFragment=s=>numericField(s)||numericPart(String(s).trim());
let arabicEnginePromise=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cleanFontName=s=>String(s||'').replace(/^[A-Z]{6}\+/,'').replace(/[,_-]+/g,' ').trim();

function status(msg,error=false){engineStatus.textContent=msg;engineStatus.style.color=error?'#b80f16':'';}
function keyFor(page,bbox,text){return `${page}|${bbox.map(v=>Number(v).toFixed(2)).join(',')}|${String(text||'').replace(/\s+/g,' ').trim().slice(0,120)}`;}
function getEdit(item){return edits.find(e=>e.key===keyFor(currentPage,item.bbox,item.text));}
function updateCount(){editCount.textContent=String(edits.length);}
function normalizeBBox(b){if(!b)return null;if(Array.isArray(b)&&b.length>=4)return b.slice(0,4).map(Number);if(typeof b==='object'){if(['x','y','w','h'].every(k=>Number.isFinite(Number(b[k])))){const x=+b.x,y=+b.y;return[x,y,x+(+b.w),y+(+b.h)];}if(['x0','y0','x1','y1'].every(k=>Number.isFinite(Number(b[k]))))return[+b.x0,+b.y0,+b.x1,+b.y1];}return null;}

async function initEngine(){try{status('جاري تحميل MuPDF.js…');mupdf=await import('https://cdn.jsdelivr.net/npm/mupdf@1.28.1/dist/mupdf.js');status('MuPDF.js جاهز. اختر ملف PDF.');}catch(e){console.error(e);status('تعذر تحميل MuPDF.js. جرّب Safari أو Chrome مع اتصال إنترنت.',true);pickBtn.disabled=true;}}
initEngine();

async function ensureArabicEngine(){
  if(hb&&bidi&&arabicFontData)return;
  if(arabicEnginePromise)return arabicEnginePromise;
  arabicEnginePromise=(async()=>{
    const [hbMod,bidiMod,fontRes]=await Promise.all([
      import('https://cdn.jsdelivr.net/npm/harfbuzzjs@1.6.1/dist/index.mjs'),
      import('https://cdn.jsdelivr.net/npm/bidi-js@1.1.0/dist/bidi.mjs'),
      fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf',{cache:'force-cache'})
    ]);
    if(!fontRes.ok)throw new Error('تعذر تحميل خط العربية التجريبي');
    const data=await fontRes.arrayBuffer();
    // Use the same real font in browser fallback and vector export, not an uninstalled CSS name.
    const face=new FontFace('Gradify Arabic',data,{weight:'100 900'});
    await face.load();document.fonts.add(face);
    hb=hbMod;bidi=bidiMod.default();arabicFontData=data;
  })();
  try{await arabicEnginePromise;}finally{arabicEnginePromise=null;}
}

pickBtn.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',async e=>{const f=e.target.files?.[0];fileInput.value='';if(!f)return;if(f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name)){status('اختر ملف PDF صالح.',true);return;}await openFile(f);});
function destroyDocument(){try{documentRef?.destroy?.()}catch{}documentRef=null;}
async function openFile(file){if(!mupdf){status('المحرك لم يجهز بعد.',true);return;}try{status('جاري فتح الملف محليًا…');originalBytes=new Uint8Array(await file.arrayBuffer());sourceName=file.name;destroyDocument();documentRef=mupdf.Document.openDocument(originalBytes,'application/pdf');pageCount=documentRef.countPages();currentPage=0;edits=[];activeItem=null;updateCount();fileName.textContent=file.name;uploadCard.hidden=true;workspace.hidden=false;await renderPage();}catch(e){console.error(e);status(`تعذر فتح الملف: ${e?.message||e}`,true);}}

function extractSegments(json){const list=[];for(const block of json?.blocks||[]){if(block?.type&&block.type!=='text')continue;for(const line of block?.lines||[]){const text=String(line?.text||'').trim();const bbox=normalizeBBox(line?.bbox);if(!text||!bbox||bbox[2]<=bbox[0]||bbox[3]<=bbox[1])continue;const f=line.font||{};list.push({text,bbox,origin:[Number(line.x)||bbox[0],Number(line.y)||bbox[3]],fontName:cleanFontName(f.name||''),family:f.family||'sans-serif',weight:f.weight||'normal',style:f.style||'normal',size:Number(f.size)||Math.max(8,(bbox[3]-bbox[1])*.8),wmode:line.wmode||0});}}return list;}
function recoverNumericOrder(segments,st){
  if(typeof st.walk!=='function')return segments;
  const lines=[];let chars=[];
  st.walk({beginLine(){chars=[];},onChar(c,origin,font,size,quad){
    chars.push({c:String(c),x:origin[0],y:origin[1],quad:[...quad]});
  },endLine(){lines.push(chars);}});
  for(const item of segments){
    if(!hasArabic(item.text)&&!numericField(item.text))continue;
    // preserve-spans makes each JSON line match one walked line; verify by geometry too.
    const candidates=lines.filter(row=>row.length&&row.every(c=>c.x>=item.bbox[0]-.5&&c.x<=item.bbox[2]+.5&&c.y>=item.bbox[1]-.5&&c.y<=item.bbox[3]+.5));
    const row=candidates.find(row=>row.map(c=>c.c).join('').trim()===item.text);
    if(!row)continue;
    const text=row.map(c=>c.c).join('').trim();
    if(numericField(text))item.text=[...row].sort((a,b)=>a.x-b.x).map(c=>c.c).join('').trim();
    else {
      // Preserve logical Arabic words and spaces; repair only contiguous numeric subsequences.
      const result=[];let run=[];
      const flush=()=>{result.push(...run.sort((a,b)=>a.x-b.x).map(c=>c.c));run=[];};
      for(const ch of row){if(numericPart(ch.c))run.push(ch);else{flush();result.push(ch.c);}}flush();
      item.text=result.join('').trim();
    }
    item.text=item.text.normalize('NFKC');
  }
  return segments;
}
function mergeNearbySegments(src){if(src.length<2)return src;const used=new Set(),out=[];for(let i=0;i<src.length;i++){if(used.has(i))continue;let group=[src[i]];used.add(i);let changed=true;while(changed){changed=false;for(let j=0;j<src.length;j++){if(used.has(j))continue;const a=group[group.length-1],b=src[j];const ac=(a.bbox[1]+a.bbox[3])/2,bc=(b.bbox[1]+b.bbox[3])/2;const fs=Math.max(a.size,b.size,8);const sameRow=Math.abs(ac-bc)<=fs*.55;const gap=Math.max(0,Math.max(a.bbox[0],b.bbox[0])-Math.min(a.bbox[2],b.bbox[2]));if(sameRow&&(a.fontName===b.fontName||(numericFragment(a.text)&&numericFragment(b.text)))&&Math.abs(a.size-b.size)<.5&&textDirection(a.text)===textDirection(b.text)&&numericFragment(a.text)===numericFragment(b.text)&&gap<=Math.max(3,fs*.35)){group.push(b);used.add(j);changed=true;}}}
if(group.length===1){out.push(group[0]);continue;}const rtl=group.some(x=>hasArabicLetters(x.text));group.sort((a,b)=>rtl?b.bbox[0]-a.bbox[0]:a.bbox[0]-b.bbox[0]);let text='';for(let k=0;k<group.length;k++){if(k){const p=group[k-1],q=group[k];const gap=rtl?p.bbox[0]-q.bbox[2]:q.bbox[0]-p.bbox[2];text+=/\s$/.test(p.text)||/^\s/.test(q.text)?'':gap>Math.max(.5,p.size*.08)?' ':'';}text+=group[k].text;}const bbox=[Math.min(...group.map(x=>x.bbox[0])),Math.min(...group.map(x=>x.bbox[1])),Math.max(...group.map(x=>x.bbox[2])),Math.max(...group.map(x=>x.bbox[3]))];const dom=group.reduce((a,b)=>a.size>=b.size?a:b);out.push({...dom,text,bbox,origin:[rtl?bbox[2]:bbox[0],dom.origin[1]]});}return out;}
function cssFont(item){
  const name=cleanFontName(item.fontName),n=name.toLowerCase(),original=name?`${JSON.stringify(name)},`:'';
  if(hasArabic(item.newText??item.text??item.oldText))return original+'"Gradify Arabic","Geeza Pro",Arial,sans-serif';
  if(n.includes('arial'))return original+'Arial,Helvetica,sans-serif';
  if(n.includes('helvetica'))return original+'Helvetica,Arial,sans-serif';
  if(n.includes('times'))return original+'"Times New Roman",Times,serif';
  if(n.includes('courier')||item.family==='monospace')return original+'Courier,monospace';
  return original+(item.family==='serif'?'Georgia,"Times New Roman",serif':'Arial,Helvetica,sans-serif');
}
const measureContext=document.createElement('canvas').getContext('2d');
function fittedFontSize(item,text){
  const size=item.fontSize||item.size||8;
  if(!text||!measureContext)return size;
  measureContext.font=`${item.style||'normal'} ${item.weight||'normal'} ${size}px ${cssFont({...item,newText:text})}`;
  const m=measureContext.measureText(text),w=item.bbox[2]-item.bbox[0],h=item.bbox[3]-item.bbox[1];
  const inkH=(m.actualBoundingBoxAscent||size*.8)+(m.actualBoundingBoxDescent||size*.2);
  return size*Math.min(1,w/Math.max(m.width,1),h/Math.max(inkH,1));
}
// PDF -> base stage -> zoomed viewport. All page children share the same transform.
const view={baseScale:1,zoomScale:1,panX:0,panY:0,width:0,height:0};
let transformFrame=0,qualityTimer=0,renderedScale=0,renderGeneration=0,previewRequest=0;
function stageScale(){return view.baseScale;}
function pdfToStage(x,y){return {x:(x-currentBounds[0])*view.baseScale,y:(y-currentBounds[1])*view.baseScale};}
function clientToPdf(clientX,clientY){
  const rect=pageViewport.getBoundingClientRect(),s=view.baseScale*view.zoomScale;
  return {x:(clientX-rect.left-view.panX)/s+currentBounds[0],y:(clientY-rect.top-view.panY)/s+currentBounds[1]};
}
function clampPan(){
  const w=view.width*view.zoomScale,h=view.height*view.zoomScale;
  const vv=window.visualViewport;
  const visibleHeight=activeItem&&!inlineEditor.hidden&&vv?clamp(vv.offsetTop+vv.height-pageViewport.getBoundingClientRect().top,1,pageViewport.clientHeight):pageViewport.clientHeight;
  view.panX=w<=pageViewport.clientWidth?(pageViewport.clientWidth-w)/2:clamp(view.panX,pageViewport.clientWidth-w,0);
  view.panY=h<=visibleHeight?0:clamp(view.panY,visibleHeight-h,0);
}
function applyTransform(){
  transformFrame=0;clampPan();
  pageStage.style.transform=`translate(${view.panX}px,${view.panY}px) scale(${view.zoomScale})`;
}
function queueTransform(){if(!transformFrame)transformFrame=requestAnimationFrame(applyTransform);}
function layoutPage(reset=false){
  const w=currentBounds[2]-currentBounds[0],h=currentBounds[3]-currentBounds[1];
  const old=view.baseScale,oldWidth=view.width,oldHeight=view.height;
  view.baseScale=Math.min(1,pageViewport.clientWidth/Math.max(1,w));
  view.width=w*view.baseScale;view.height=h*view.baseScale;
  if(reset){view.zoomScale=1;view.panX=0;view.panY=0;}
  else if(oldWidth&&oldHeight){view.panX*=view.baseScale/old;view.panY*=view.baseScale/old;}
  pageStage.style.width=`${view.width}px`;pageStage.style.height=`${view.height}px`;
  applyTransform();renderOverlay();if(activeItem&&!inlineEditor.hidden)positionEditor();
}
function zoomAt(zoom,clientX,clientY,previousX=clientX,previousY=clientY){
  const r=pageViewport.getBoundingClientRect(),next=clamp(zoom,1,5),ratio=next/view.zoomScale;
  view.panX=clientX-r.left-(previousX-r.left-view.panX)*ratio;
  view.panY=clientY-r.top-(previousY-r.top-view.panY)*ratio;
  view.zoomScale=next;clampPan();queueTransform();
}
function targetRenderScale(){
  const w=currentBounds[2]-currentBounds[0],h=currentBounds[3]-currentBounds[1];
  // Bound the decoded bitmap (and MuPDF working memory), particularly on iPhone.
  return Math.min(Math.max(1,view.baseScale*view.zoomScale*(window.devicePixelRatio||1)),Math.sqrt(8000000/(w*h)),4096/Math.max(w,h));
}
async function renderPreview(force=false){
  if(!documentRef)return;
  const scale=targetRenderScale();if(!force&&scale<=renderedScale*1.15){pageStatus.textContent=`تكبير ${Math.round(view.zoomScale*100)}% — معاينة ${Math.round(renderedScale*72)} DPI — ${currentItems.length} منطقة نصية`;return;}
  const generation=renderGeneration,request=++previewRequest;let page=null,pix=null,url=null;
  try{
    page=documentRef.loadPage(currentPage);
    pix=page.toPixmap(mupdf.Matrix.scale(scale,scale),mupdf.ColorSpace.DeviceRGB,false,true,'View','CropBox');
    url=URL.createObjectURL(new Blob([pix.asPNG()],{type:'image/png'}));
    pix.destroy();pix=null;page.destroy();page=null;
    const decoded=new Image();decoded.src=url;await decoded.decode();
    if(generation!==renderGeneration||request!==previewRequest){URL.revokeObjectURL(url);return;}
    const old=pageObjectURL;pageObjectURL=url;pageImage.src=url;renderedScale=scale;
    if(old)URL.revokeObjectURL(old);
    pageStatus.textContent=`تكبير ${Math.round(view.zoomScale*100)}% — معاينة ${Math.round(scale*72)} DPI — ${currentItems.length} منطقة نصية`;
  }catch(e){if(url)URL.revokeObjectURL(url);if(generation===renderGeneration)pageStatus.textContent=`تعذر تحسين المعاينة: ${e?.message||e}`;}
  finally{try{pix?.destroy?.()}catch{}try{page?.destroy?.()}catch{}}
}
function scheduleQuality(){clearTimeout(qualityTimer);qualityTimer=setTimeout(()=>{if(!gesture)void renderPreview();},180);}
async function renderPage(){
  if(!documentRef)return;commitActive(false);hideEditor();resetGesture();
  clearTimeout(qualityTimer);renderGeneration++;renderedScale=0;pageImage.removeAttribute('src');
  if(pageObjectURL){URL.revokeObjectURL(pageObjectURL);pageObjectURL=null;}
  currentItems=[];textLayer.innerHTML='';pageStatus.textContent='جاري إنشاء معاينة عالية الدقة…';
  prevBtn.disabled=currentPage<=0;nextBtn.disabled=currentPage>=pageCount-1;
  pageInfo.textContent=`الصفحة ${currentPage+1} من ${pageCount}`;
  let page=null,st=null;
  try{
    page=documentRef.loadPage(currentPage);currentBounds=page.getBounds();
    st=page.toStructuredText('preserve-spans,preserve-whitespace,accurate-bboxes,accurate-ascenders');
    currentItems=mergeNearbySegments(recoverNumericOrder(extractSegments(JSON.parse(st.asJSON())),st));
    layoutPage(true);
    arabicState.textContent=currentItems.some(x=>hasArabic(x.text))?'العربية: تم اكتشاف نص عربي ✓':'العربية: لا يوجد نص عربي ظاهر';
    selectionInfo.textContent='اضغط على أي نص في الصفحة.';
  }catch(e){console.error(e);pageStatus.textContent=`خطأ في العرض: ${e?.message||e}`;return;}
  finally{try{st?.destroy?.()}catch{}try{page?.destroy?.()}catch{}}
  const generation=renderGeneration;
  if(currentItems.some(item=>hasArabic(item.text)))void ensureArabicEngine().then(()=>{
    if(generation!==renderGeneration)return;renderOverlay();if(activeItem)positionEditor();
  }).catch(e=>{console.warn(e);arabicState.textContent='العربية: تعذر تحميل خط المعاينة';});
  await renderPreview(true);
}

function rectToCss(b){const p=pdfToStage(b[0],b[1]),s=stageScale();return{left:p.x,top:p.y,width:(b[2]-b[0])*s,height:(b[3]-b[1])*s};}
function renderOverlay(){textLayer.innerHTML='';const s=stageScale();for(const item of currentItems){const ed=getEdit(item);if(!ed)continue;const r=rectToCss(item.bbox);const p=document.createElement('div');p.className='editPreview';p.textContent=ed.newText;p.dir=textDirection(ed.newText);p.style.left=`${r.left}px`;p.style.top=`${r.top}px`;p.style.width=`${Math.max(1,r.width)}px`;p.style.height=`${Math.max(r.height,fittedFontSize(ed,ed.newText)*s*1.18)}px`;p.style.fontSize=`${Math.max(1,fittedFontSize(ed,ed.newText)*s)}px`;p.style.fontFamily=cssFont(ed);p.style.fontWeight=ed.weight||'normal';p.style.fontStyle=ed.style||'normal';p.style.textAlign=textDirection(ed.newText)==='rtl'?'right':'left';textLayer.appendChild(p);}if(activeItem&&!inlineEditor.hidden)drawActiveBox(activeItem);}
function drawActiveBox(item){textLayer.querySelector('.activeOutline')?.remove();const r=rectToCss(item.bbox);const b=document.createElement('div');b.className='textHit active activeOutline';b.style.left=`${r.left}px`;b.style.top=`${r.top}px`;b.style.width=`${Math.max(2,r.width)}px`;b.style.height=`${Math.max(2,r.height)}px`;b.style.pointerEvents='none';textLayer.appendChild(b);}
function pickItemAt(clientX,clientY){
  const {x,y}=clientToPdf(clientX,clientY),s=view.baseScale*view.zoomScale,pad=(mobile()?16:6)/s;
  const distance=it=>{const b=it.bbox;return Math.hypot(Math.max(b[0]-x,0,x-b[2]),Math.max(b[1]-y,0,y-b[3]));};
  const candidates=currentItems.filter(it=>distance(it)<=pad);
  return candidates.sort((a,b)=>distance(a)-distance(b)||Math.abs(y-(a.bbox[1]+a.bbox[3])/2)-Math.abs(y-(b.bbox[1]+b.bbox[3])/2))[0]||null;
}
// Touch events are the single owner on touch devices (no duplicate pointer taps).
let gesture=null,mouseId=null;
const point=t=>({x:t.clientX,y:t.clientY});
function metrics(points){const a=points[0],b=points[1];return b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))}:{...a,d:0};}
function resetGesture(){const id=mouseId;gesture=null;mouseId=null;if(id!==null&&pageViewport.hasPointerCapture(id))pageViewport.releasePointerCapture(id);pageViewport.classList.remove('is-dragging');}
function beginGesture(points,target){
  const m=metrics(points);gesture={...m,startX:m.x,startY:m.y,count:points.length,moved:points.length>1,nativeEditor:points.length===1&&inlineEditor.contains(target),tapItem:pickItemAt(m.x,m.y)};
  clearTimeout(qualityTimer);
}
function moveGesture(points){
  if(!gesture||!points.length)return;const m=metrics(points);
  if(points.length!==gesture.count){gesture={...gesture,...m,count:points.length,moved:true,nativeEditor:false};return;}
  if(points.length>1){zoomAt(view.zoomScale*m.d/gesture.d,m.x,m.y,gesture.x,gesture.y);gesture.moved=true;}
  else if(!gesture.nativeEditor){
    if(Math.hypot(m.x-gesture.startX,m.y-gesture.startY)>(mobile()?12:6))gesture.moved=true;
    if(gesture.moved){view.panX+=m.x-gesture.x;view.panY+=m.y-gesture.y;clampPan();queueTransform();}
  }
  Object.assign(gesture,m);pageViewport.classList.toggle('is-dragging',gesture.moved);
}
function tapAt(x,y,item=pickItemAt(x,y)){if(!documentRef)return;if(item===activeItem&&!inlineEditor.hidden)return;commitActive(true);if(item)openEditor(item);}
pageViewport.addEventListener('touchstart',e=>{
  if(!documentRef)return;
  const points=Array.from(e.touches,point);
  if(gesture){gesture.moved=true;gesture.nativeEditor=false;Object.assign(gesture,metrics(points),{count:points.length});}
  else beginGesture(points,e.target);
  if(points.length>1&&e.cancelable)e.preventDefault();
},{passive:false});
pageViewport.addEventListener('touchmove',e=>{
  if(!gesture)return;if(!gesture.nativeEditor||e.touches.length>1){if(e.cancelable)e.preventDefault();moveGesture(Array.from(e.touches,point));}
},{passive:false});
pageViewport.addEventListener('touchend',e=>{
  if(!gesture)return;
  if(e.touches.length){gesture.moved=true;gesture.nativeEditor=false;Object.assign(gesture,metrics(Array.from(e.touches,point)),{count:e.touches.length});return;}
  const g=gesture;resetGesture();
  if(!g.nativeEditor){if(e.cancelable)e.preventDefault();if(!g.moved)tapAt(g.x,g.y,g.tapItem);}
  scheduleQuality();
},{passive:false});
pageViewport.addEventListener('touchcancel',()=>{resetGesture();scheduleQuality();});
// Safari's non-standard gesture events must not zoom the HTML document here.
for(const type of ['gesturestart','gesturechange','gestureend'])pageViewport.addEventListener(type,e=>{if(documentRef&&e.cancelable)e.preventDefault();},{passive:false});
pageViewport.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||e.button!==0||!documentRef||inlineEditor.contains(e.target))return;
  e.preventDefault();mouseId=e.pointerId;beginGesture([point(e)],e.target);pageViewport.setPointerCapture(e.pointerId);
});
pageViewport.addEventListener('pointermove',e=>{if(e.pointerId===mouseId)moveGesture([point(e)]);});
pageViewport.addEventListener('pointerup',e=>{
  if(e.pointerId!==mouseId)return;const g=gesture;resetGesture();
  if(pageViewport.hasPointerCapture(e.pointerId))pageViewport.releasePointerCapture(e.pointerId);
  if(g&&!g.moved)tapAt(e.clientX,e.clientY);scheduleQuality();
});
for(const type of ['pointercancel','lostpointercapture'])pageViewport.addEventListener(type,e=>{if(e.pointerId===mouseId){resetGesture();scheduleQuality();}});
// No click suppression window: native editor taps, long-press and selection handles remain available.
pageViewport.addEventListener('wheel',e=>{
  if(!documentRef)return;
  if(e.ctrlKey||e.metaKey){e.preventDefault();zoomAt(view.zoomScale*Math.exp(-e.deltaY*.01),e.clientX,e.clientY);scheduleQuality();}
  else{const x=view.panX,y=view.panY;view.panX-=e.deltaX;view.panY-=e.deltaY;clampPan();if(x!==view.panX||y!==view.panY){e.preventDefault();queueTransform();}}
},{passive:false});
document.addEventListener('pointerdown',e=>{if(!pageViewport.contains(e.target))commitActive(true);});

function editorText(){return String(inlineEditor.textContent||'').replace(/\n/g,'');}
function selectEditorText(el){try{const range=document.createRange(),sel=getSelection();range.selectNodeContents(el);sel.removeAllRanges();sel.addRange(range);}catch{}}
function positionEditor(){
  if(!activeItem)return;
  const item=activeItem,r=rectToCss(item.bbox),s=stageScale(),basePt=getEdit(item)?.fontSize||item.size||8;
  const visualPx=Math.max(1,fittedFontSize({...item,fontSize:basePt},editorText())*s),fontPx=Math.max(16,visualPx),localScale=visualPx/fontPx;
  // iOS focus auto-zoom is avoided with >=16px computed font size; local transform preserves PDF size.
  inlineEditor.style.fontSize=`${fontPx}px`;inlineEditor.style.transform=`scale(${localScale})`;
  inlineEditor.style.left=`${r.left}px`;inlineEditor.style.top=`${r.top}px`;
  inlineEditor.style.width=`${Math.max(1,Math.min(view.width-r.left,r.width))/localScale}px`;
  inlineEditor.style.height=`${Math.max(r.height,visualPx*1.2)/localScale}px`;
}
function revealEditor(){
  if(!activeItem||inlineEditor.hidden)return;
  const rect=inlineEditor.getBoundingClientRect(),vp=pageViewport.getBoundingClientRect(),vv=window.visualViewport;
  const top=Math.max(vp.top,vv?.offsetTop||0)+8,bottom=Math.min(vp.bottom,(vv?.offsetTop||0)+(vv?.height||innerHeight))-8;
  if(bottom<=top)return;
  if(rect.bottom>bottom)view.panY-=rect.bottom-bottom;else if(rect.top<top)view.panY+=top-rect.top;
  clampPan();queueTransform();
}
function openEditor(item){
  activeItem=item;const ed=getEdit(item),value=ed?.newText??item.text;
  inlineEditor.hidden=false;inlineEditor.textContent=value;inlineEditor.dir=textDirection(value);
  inlineEditor.style.textAlign=textDirection(value)==='rtl'?'right':'left';inlineEditor.style.fontFamily=cssFont(item);
  inlineEditor.style.fontWeight=item.weight||'normal';inlineEditor.style.fontStyle=item.style||'normal';
  positionEditor();selectionInfo.textContent=`${item.fontName||item.family} · ${(ed?.fontSize||item.size||8).toFixed(1)} pt${hasArabic(value)?' · Arabic Vector':''}`;
  renderOverlay();inlineEditor.focus({preventScroll:true});selectEditorText(inlineEditor);revealEditor();
}
function hideEditor(){inlineEditor.hidden=true;activeItem=null;queueTransform();textLayer.querySelector('.activeOutline')?.remove();}
let composing=false;
inlineEditor.addEventListener('compositionstart',()=>{composing=true;});
inlineEditor.addEventListener('compositionend',()=>{composing=false;positionEditor();});
inlineEditor.addEventListener('input',()=>{if(!activeItem)return;const txt=editorText();inlineEditor.dir=textDirection(txt);inlineEditor.style.textAlign=textDirection(txt)==='rtl'?'right':'left';if(!composing)positionEditor();});
inlineEditor.addEventListener('keydown',e=>{if(e.isComposing||composing)return;if(e.key==='Enter'){e.preventDefault();inlineEditor.blur();}if(e.key==='Escape'){e.preventDefault();hideEditor();selectionInfo.textContent='تم إلغاء التعديل الحالي.';}});
inlineEditor.addEventListener('blur',()=>{commitActive(true);});
function commitActive(rerender=true){if(committing||!activeItem||inlineEditor.hidden)return;committing=true;try{const item=activeItem,newText=editorText(),key=keyFor(currentPage,item.bbox,item.text);edits=edits.filter(e=>e.key!==key);if(newText!==item.text)edits.push({key,page:currentPage,bbox:[...item.bbox],oldText:item.text,newText,origin:[...item.origin],fontSize:fittedFontSize(item,newText),fontName:item.fontName||'',family:item.family||'sans-serif',weight:item.weight||'normal',style:item.style||'normal',rtl:textDirection(newText)==='rtl'});updateCount();inlineEditor.hidden=true;activeItem=null;queueTransform();selectionInfo.textContent=newText===item.text?'لم يتغير النص.':'تم حفظ التعديل محليًا ✓';if(rerender)renderOverlay();}finally{committing=false;}}
prevBtn.addEventListener('click',async()=>{commitActive(false);if(currentPage>0){currentPage--;await renderPage();}});nextBtn.addEventListener('click',async()=>{commitActive(false);if(currentPage<pageCount-1){currentPage++;await renderPage();}});

function expandRect(r,p=.7){return[r[0]-p,r[1]-p,r[2]+p,r[3]+p];}
function daFont(e){if(e.family==='serif'||/times/i.test(e.fontName))return'TiRo';if(e.family==='monospace'||/courier/i.test(e.fontName))return'Cour';return'Helv';}
function weightValue(e){const s=`${e.weight||''} ${e.fontName||''}`.toLowerCase();if(/black|heavy|900/.test(s))return 900;if(/extra.?bold|800/.test(s))return 800;if(/bold|700/.test(s))return 700;if(/semi.?bold|600/.test(s))return 600;if(/medium|500/.test(s))return 500;return 400;}

function getVisualRuns(text){
  if(!text)return [];
  if(!bidi||numericField(text))return[{text,direction:textDirection(text)}];
  const embedding=bidi.getEmbeddingLevels(text,textDirection(text)),levels=embedding.levels,runs=[];
  let start=0;
  for(let i=1;i<=text.length;i++)if(i===text.length||levels[i]!==levels[start]){
    const level=levels[start];runs.push({text:text.slice(start,i),direction:level%2?'rtl':'ltr',level});start=i;
  }
  const max=Math.max(...runs.map(r=>r.level)),odd=runs.filter(r=>r.level%2).map(r=>r.level);
  if(odd.length)for(let level=max;level>=Math.min(...odd);level--){
    for(let i=0;i<runs.length;){if(runs[i].level<level){i++;continue;}let end=i+1;while(end<runs.length&&runs[end].level>=level)end++;
      runs.splice(i,end-i,...runs.slice(i,end).reverse());i=end;
    }
  }
  return runs;
}

function pdfPathFromCommands(commands,ox,oy,scale){let out='',cx=0,cy=0;const tr=(x,y)=>[ox+x*scale,oy+y*scale];for(const cmd of commands){const t=String(cmd.type||'').toUpperCase(),v=cmd.values||[];if(t==='M'){[cx,cy]=tr(v[0],v[1]);out+=`${cx.toFixed(3)} ${cy.toFixed(3)} m\n`;}else if(t==='L'){[cx,cy]=tr(v[0],v[1]);out+=`${cx.toFixed(3)} ${cy.toFixed(3)} l\n`;}else if(t==='C'){const p1=tr(v[0],v[1]),p2=tr(v[2],v[3]),p3=tr(v[4],v[5]);out+=`${p1[0].toFixed(3)} ${p1[1].toFixed(3)} ${p2[0].toFixed(3)} ${p2[1].toFixed(3)} ${p3[0].toFixed(3)} ${p3[1].toFixed(3)} c\n`;[cx,cy]=p3;}else if(t==='Q'){const q=tr(v[0],v[1]),p=tr(v[2],v[3]),c1=[cx+(q[0]-cx)*2/3,cy+(q[1]-cy)*2/3],c2=[p[0]+(q[0]-p[0])*2/3,p[1]+(q[1]-p[1])*2/3];out+=`${c1[0].toFixed(3)} ${c1[1].toFixed(3)} ${c2[0].toFixed(3)} ${c2[1].toFixed(3)} ${p[0].toFixed(3)} ${p[1].toFixed(3)} c\n`;[cx,cy]=p;}else if(t==='Z')out+='h\n';}return out;}

function shapeRun(font,text,direction){const buffer=new hb.Buffer();buffer.addText(text);try{buffer.setDirection(direction==='rtl'?hb.Direction.RTL:hb.Direction.LTR);}catch{}buffer.guessSegmentProperties();hb.shape(font,buffer);const shaped=buffer.getGlyphInfosAndPositions();let pen=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const glyphs=[];for(const g of shaped){const gx=pen+(g.xOffset||0),gy=(g.yOffset||0),cmds=font.glyphToJson(g.codepoint)||[];for(const c of cmds){const v=c.values||[];for(let i=0;i+1<v.length;i+=2){const x=gx+v[i],y=gy+v[i+1];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}glyphs.push({gx,gy,cmds});pen+=(g.xAdvance||0);}try{buffer.destroy?.()}catch{}if(!Number.isFinite(minX)){minX=0;maxX=Math.max(1,pen);minY=0;maxY=1000;}return{glyphs,advance:pen,minX,maxX,minY,maxY};}

async function makeArabicAppearance(e){await ensureArabicEngine();const blob=new hb.Blob(arabicFontData),face=new hb.Face(blob),font=new hb.Font(face);font.setScale(1000,1000);try{if(font.setVariations&&hb.Variation)font.setVariations([new hb.Variation('wght',weightValue(e)),new hb.Variation('wdth',100)]);}catch{}const runs=getVisualRuns(e.newText),shapedRuns=runs.map(r=>({...r,shape:shapeRun(font,r.text,r.direction)}));let xCursor=0,globalMinX=Infinity,globalMaxX=-Infinity,globalMinY=Infinity,globalMaxY=-Infinity;for(const r of shapedRuns){r.offsetX=xCursor;globalMinX=Math.min(globalMinX,xCursor+r.shape.minX);globalMaxX=Math.max(globalMaxX,xCursor+r.shape.maxX);globalMinY=Math.min(globalMinY,r.shape.minY);globalMaxY=Math.max(globalMaxY,r.shape.maxY);xCursor+=Math.max(0,r.shape.advance);}const rawW=Math.max(1,globalMaxX-globalMinX),rawH=Math.max(1,globalMaxY-globalMinY),boxW=Math.max(1,e.bbox[2]-e.bbox[0]),boxH=Math.max(1,e.bbox[3]-e.bbox[1]);let scale=(e.fontSize||boxH)*1.0/1000;if(rawH*scale>boxH*1.08)scale*=boxH*1.02/(rawH*scale);if(rawW*scale>boxW*1.08)scale*=boxW*1.02/(rawW*scale);const xBase=textDirection(e.newText)==='rtl'?boxW-globalMaxX*scale:-globalMinX*scale;const baseline=Array.isArray(e.origin)?boxH-(e.origin[1]-e.bbox[1]):(boxH-rawH*scale)/2-globalMinY*scale;const yBase=clamp(baseline,-globalMinY*scale,Math.max(-globalMinY*scale,boxH-globalMaxY*scale));let content='q\n0 g\n';for(const r of shapedRuns){for(const g of r.shape.glyphs){content+=pdfPathFromCommands(g.cmds,xBase+(r.offsetX+g.gx)*scale,yBase+g.gy*scale,scale)+'f\n';}}content+='Q\n';try{font.destroy?.();face.destroy?.();blob.destroy?.()}catch{}return{content,bbox:[0,0,boxW,boxH]};}

async function addArabicVector(page,pdf,e){const ap=await makeArabicAppearance(e),a=page.createAnnotation('Stamp');a.setRect(e.bbox);try{a.setContents(e.newText)}catch{}const resources=pdf.newDictionary();a.setAppearance('N',null,mupdf.Matrix.identity,ap.bbox,resources,ap.content);return a;}

async function saveEditedPdf(){commitActive(false);if(!originalBytes||!mupdf)return;if(!edits.length){pageStatus.textContent='لا توجد تعديلات للحفظ.';return;}saveBtn.disabled=true;let doc=null;try{if(edits.some(e=>hasArabic(e.newText)))await ensureArabicEngine();pageStatus.textContent='جاري حفظ النصوص مع الحفاظ على الصفحة الأصلية كـ PDF…';doc=mupdf.Document.openDocument(originalBytes,'application/pdf');const pdf=typeof doc.asPDF==='function'?doc.asPDF():doc,byPage=new Map();for(const e of edits){if(!byPage.has(e.page))byPage.set(e.page,[]);byPage.get(e.page).push(e);}for(const [pi,list] of byPage){const page=pdf.loadPage(pi);for(const e of list){const red=page.createAnnotation('Redaction');red.setRect(expandRect(e.bbox,.35));red.update?.();}page.applyRedactions(false,mupdf.PDFPage.REDACT_IMAGE_NONE,mupdf.PDFPage.REDACT_LINE_ART_NONE,mupdf.PDFPage.REDACT_TEXT_REMOVE);for(const e of list){if(!e.newText)continue;if(hasArabic(e.newText)){await addArabicVector(page,pdf,e);}else{const a=page.createAnnotation('FreeText');a.setRect(expandRect(e.bbox,.35));a.setContents(e.newText);a.setDefaultAppearance(daFont(e),e.fontSize,[0,0,0]);a.update();}}page.update?.();page.destroy?.();}const buf=pdf.saveToBuffer('compress');const bytes=buf.asUint8Array(),blobOut=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blobOut),a=document.createElement('a');a.href=url;a.download=sourceName.replace(/\.pdf$/i,'')+'-edited.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);pageStatus.textContent='تم إنشاء الملف. العربية حُفظت كـ Vector مشكّل، بدون تحويل الصفحة إلى صورة.';}catch(e){console.error(e);pageStatus.textContent=`تعذر الحفظ: ${e?.message||e}`;}finally{saveBtn.disabled=false;try{doc?.destroy?.()}catch{}}}
saveBtn.addEventListener('click',saveEditedPdf);
let layoutFrame=0;
const resizeObserver=new ResizeObserver(()=>{
  if(!documentRef||layoutFrame)return;
  layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;resetGesture();layoutPage();scheduleQuality();});
});
resizeObserver.observe(pageViewport);
window.visualViewport?.addEventListener('resize',revealEditor);
window.addEventListener('pagehide',e=>{if(!e.persisted){clearTimeout(qualityTimer);renderGeneration++;if(pageObjectURL)URL.revokeObjectURL(pageObjectURL);destroyDocument();}});

