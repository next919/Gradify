// Dependency-free regression tests for the production viewer state and event handlers.
// DOM/MuPDF are test doubles: this does NOT certify native Safari gestures or PDF output.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),frames=[],timers=new Map();let nextTimer=1,renders=0,destroys=0,revoked=[];
class Element {
  constructor(id){this.id=id;this.style={};this.hidden=id==='inlineEditor';this.listeners={};this.children=[];this.clientWidth=id==='pageViewport'?360:0;this.clientHeight=id==='pageViewport'?500:0;this.classList={remove(){},toggle(){}};this.textContent='';this.captures=new Set();}
  getContext(){return null;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  emit(type,props={}){const e={target:this,cancelable:true,preventDefault(){this.prevented=true},stopPropagation(){},...props};for(const fn of this.listeners[type]||[])fn(e);return e;}
  contains(el){return el===this||(this.id==='pageViewport'&&['textLayer','inlineEditor','pageImage'].includes(el?.id));}
  getBoundingClientRect(){if(this.id==='pageViewport')return{left:20,top:100,right:20+this.clientWidth,bottom:100+this.clientHeight};if(this.id==='inlineEditor'){const p=elements.get('pageViewport').getBoundingClientRect(),v=api.view;const left=p.left+v.panX+parseFloat(this.style.left)*v.zoomScale,top=p.top+v.panY+parseFloat(this.style.top)*v.zoomScale;return{left,top,bottom:top+20,right:left+50};}return{left:0,top:0};}
  appendChild(e){this.children.push(e)} querySelector(){return null} removeAttribute(){} remove(){} click(){}
  focus(){document.activeElement=this} blur(){document.activeElement=null;this.emit('blur')}
  setPointerCapture(id){this.captures.add(id)} hasPointerCapture(id){return this.captures.has(id)} releasePointerCapture(id){this.captures.delete(id)}
  set innerHTML(v){this.children=[]} get innerHTML(){return''}
}
const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)},createElement(){return new Element('new')},addEventListener(type,fn){this.listeners??={};(this.listeners[type]??=[]).push(fn)},body:new Element('body'),createRange(){return{selectNodeContents(){},collapse(){}}}};
const page={getBounds:()=>[10,20,610,1020],toStructuredText:()=>({asJSON:()=>JSON.stringify({blocks:[{lines:[{text:'Target',bbox:[260,320,340,340],x:260,y:337,font:{size:16,name:'Arial'}}]}]}),destroy(){destroys++}}),toPixmap(){renders++;return{asPNG:()=>new Uint8Array([1]),destroy(){destroys++}}},destroy(){destroys++}};
const doc={loadPage:()=>page,countPages:()=>2,destroy(){destroys++}};
const context={document,console,Blob,Uint8Array,Image:class{decode(){return Promise.resolve()}},URL:{createObjectURL:()=>`blob:${renders}`,revokeObjectURL:u=>revoked.push(u)},navigator:{userAgent:'iPhone'},matchMedia:()=>({matches:true}),getSelection:()=>({removeAllRanges(){},addRange(){}}),requestAnimationFrame:f=>(frames.push(f),frames.length),setTimeout:f=>{const id=nextTimer++;timers.set(id,f);return id},clearTimeout:id=>timers.delete(id),ResizeObserver:class{constructor(cb){this.cb=cb}observe(){}},innerHeight:900};
context.window={devicePixelRatio:3,addEventListener(){},visualViewport:{offsetTop:0,height:900,addEventListener(){}}};
const source=fs.readFileSync(require('node:path').join(__dirname,'../pdf-mupdf.js'),'utf8').replace('\ninitEngine();','\n// CDN startup disabled in test harness.');
vm.createContext(context);vm.runInContext(source+`\nglobalThis.api={view,mergeNearbySegments,textDirection,numericField,recoverNumericOrder,getVisualRuns,pdfToStage,clientToPdf,rectToCss,pickItemAt,zoomAt,applyTransform,layoutPage,renderPage,renderPreview,targetRenderScale,openEditor,commitActive,saveEditedPdf,resetGesture,getEdits:()=>edits,getGesture:()=>gesture,getPage:()=>currentPage,setup:(doc,engine)=>{documentRef=doc;mupdf=engine;pageCount=2;workspace.hidden=false;},setBidi:b=>{bidi=b},setBounds:b=>{currentBounds=b},setItems:i=>{currentItems=i}};`,context);
const api=context.api,$=id=>document.getElementById(id),vp=$('pageViewport');
function flush(){while(frames.length)frames.shift()()}
function near(a,b,label){assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`)}
function client(x,y){const p=api.pdfToStage(x,y),r=vp.getBoundingClientRect();return{x:r.left+api.view.panX+p.x*api.view.zoomScale,y:r.top+api.view.panY+p.y*api.view.zoomScale}}
function touch(type,points,target=$('textLayer')){return vp.emit(type,{target,touches:points.map(([clientX,clientY])=>({clientX,clientY}))})}
(async()=>{
api.setup(doc,{Matrix:{scale:(x,y)=>[x,y]},ColorSpace:{DeviceRGB:0}});await api.renderPage();flush();
assert.equal(api.view.zoomScale,1);near(api.view.width,360,'fit width');assert.equal(renders,1);
const focus=client(300,330),anchor=api.clientToPdf(focus.x,focus.y);
for(const zoom of [1.5,2.5,4,5,1]){api.zoomAt(zoom,focus.x,focus.y);flush();const p=api.clientToPdf(focus.x,focus.y);near(p.x,anchor.x,'pinch focal x');near(p.y,anchor.y,'pinch focal y');assert.equal(api.pickItemAt(focus.x,focus.y).text,'Target');}
api.zoomAt(99,focus.x,focus.y);flush();assert.equal(api.view.zoomScale,5);api.zoomAt(.1,focus.x,focus.y);flush();assert.equal(api.view.zoomScale,1);
// Two fingers followed by one finger must remain a pan, never an accidental edit.
assert.equal(touch('touchstart',[[150,280],[250,280]]).prevented,true);
touch('touchmove',[[75,280],[325,280]]);flush();near(api.view.zoomScale,2.5,'touch pinch');assert.equal(renders,1,'no MuPDF rendering during pinch');
touch('touchend',[[325,280]]);touch('touchmove',[[275,180]]);flush();touch('touchend',[]);assert.equal($('inlineEditor').hidden,true);
let p=client(300,330);assert.equal(api.pickItemAt(p.x,p.y).text,'Target');
touch('touchstart',[[p.x,p.y]]);touch('touchend',[]);assert.equal($('inlineEditor').hidden,false);assert.ok(parseFloat($('inlineEditor').style.fontSize)>=16);
$('inlineEditor').textContent='تاريخ 2026';$('inlineEditor').emit('input');assert.equal($('inlineEditor').dir,'rtl');
api.zoomAt(4,p.x,p.y);flush();const r=api.rectToCss([260,320,340,340]);near(parseFloat($('inlineEditor').style.left),r.left,'editor anchored to stage');
touch('touchstart',[[100,550]]);touch('touchmove',[[130,500]]);touch('touchend',[]);flush();assert.equal($('inlineEditor').hidden,false,'panning keeps edit active');
touch('touchstart',[[25,105]]);touch('touchend',[]);assert.equal($('inlineEditor').hidden,true);assert.equal(api.getEdits()[0].newText,'تاريخ 2026');
// Navigation commits against the old page and resets pan/zoom.
$('nextBtn').emit('click');await Promise.resolve();await Promise.resolve();flush();assert.equal(api.getPage(),1);assert.equal(api.view.zoomScale,1);assert.equal(api.view.panY,0);
$('prevBtn').emit('click');await Promise.resolve();await Promise.resolve();flush();assert.equal(api.getEdits().length,1);assert.equal($('textLayer').children[0].textContent,'تاريخ 2026');
// CropBox origins, resizing, clamping and bitmap memory limits.
for(const width of [360,740,300]){vp.clientWidth=width;api.layoutPage();for(const zoom of [1,1.5,2.5,4]){p=client(300,330);api.zoomAt(zoom,p.x,p.y);flush();p=client(300,330);assert.equal(api.pickItemAt(p.x,p.y).text,'Target');const scale=api.targetRenderScale();assert.ok(600*1000*scale*scale<=8000000.1);assert.ok(1000*scale<=4096.1);}}
api.view.panX=1e5;api.view.panY=-1e5;api.applyTransform();assert.equal(api.view.panX,0);near(api.view.panY,vp.clientHeight-api.view.height*api.view.zoomScale,'pan clamp');
touch('touchstart',[[50,150]]);touch('touchmove',[[80,170]]);touch('touchcancel',[]);assert.equal(api.getGesture(),null);
// Desktop pointer capture, drag suppression, click editing, and outside commit.
vp.clientWidth=900;api.layoutPage(true);p=client(300,330);
vp.emit('pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX:p.x,clientY:p.y});vp.emit('pointerup',{pointerId:1,clientX:p.x,clientY:p.y});assert.equal($('inlineEditor').hidden,false);assert.equal(vp.captures.size,0);
$('inlineEditor').textContent='Edited';for(const fn of document.listeners.pointerdown)fn({target:$('toolbar')});assert.equal($('inlineEditor').hidden,true);assert.equal(api.getEdits()[0].newText,'Edited');
vp.emit('pointerdown',{pointerId:2,pointerType:'mouse',button:0,clientX:p.x,clientY:p.y});vp.emit('pointermove',{pointerId:2,clientX:p.x+50,clientY:p.y-50});vp.emit('pointerup',{pointerId:2,clientX:p.x+50,clientY:p.y-50});assert.equal($('inlineEditor').hidden,true);
vp.emit('pointerdown',{pointerId:3,pointerType:'mouse',button:0,clientX:p.x,clientY:p.y});vp.emit('pointercancel',{pointerId:3});assert.equal(vp.captures.size,0);
api.zoomAt(4,p.x,p.y);flush();await api.renderPreview();assert.ok(renders>1);assert.ok(revoked.length>0);assert.ok(destroys>=renders*2);
const e=vp.emit('gesturestart');assert.equal(e.prevented,true);
assert.ok(!fs.readFileSync(require('node:path').join(__dirname,'../pdf-mupdf.html'),'utf8').includes('user-scalable=no'));
// Regression: numeric Arabic is LTR and the PDF extraction may enumerate glyphs backwards.
assert.equal(api.textDirection('٢٠٢٢/٠٦/٢٩'),'ltr');assert.equal(api.textDirection('شركة تجريبية'),'rtl');
const date='٢٠٢٢/٠٦/٢٩',chars=[...date].map((c,i)=>({c,x:100+i*6})).reverse();
const segments=[{text:chars.map(g=>g.c).join(''),bbox:[100,10,180,30]}];
api.recoverNumericOrder(segments,{walk(w){w.beginLine();for(const g of chars)w.onChar(g.c,[g.x,25],null,10,[g.x,10,g.x+6,10,g.x,30,g.x+6,30]);w.endLine();}});
assert.equal(segments[0].text,date);assert.equal(api.getVisualRuns(date)[0].direction,'ltr');
const pieces=[{text:'٢٩',bbox:[145,10,160,30],fontName:'Arabic'}, {text:'/',bbox:[140,10,145,30],fontName:'Latin'}, {text:'٠٦',bbox:[125,10,140,30],fontName:'Arabic'}, {text:'/',bbox:[120,10,125,30],fontName:'Latin'}, {text:'٢٠٢٢',bbox:[90,10,120,30],fontName:'Arabic'}].map(x=>({...x,size:20,origin:[x.bbox[0],25]}));
assert.equal(api.mergeNearbySegments(pieces)[0].text,date,'mixed-font date stays one LTR field');
api.setBidi({getEmbeddingLevels:()=>({levels:[1,1,1,1,2,2,2]})});
const mixed=api.getVisualRuns('طلب 123');assert.equal(mixed.map(x=>x.text).join(''),'123طلب ');assert.equal(mixed[0].direction,'ltr');assert.equal(mixed[1].direction,'rtl');
// A small touch wobble is a tap; the immediate native caret click is never suppressed.
vp.clientWidth=360;api.layoutPage(true);p=client(300,330);
touch('touchstart',[[p.x,p.y]]);touch('touchmove',[[p.x+8,p.y+2]]);touch('touchend',[]);assert.equal($('inlineEditor').hidden,false);
const caretClick=vp.emit('click',{target:$('inlineEditor')});assert.ok(!caretClick.prevented);
console.log('PASS: numeric extraction/direction, touch wobble and native caret click; fit, 100–500% focal zoom, crop origins, touch pinch/pan/tap/cancel, mouse capture/drag/click, exact hit testing, RTL editor, outside commit, navigation persistence, resize, bounds, render budget and cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});

