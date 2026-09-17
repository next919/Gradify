// Save contract regression: real application edit function, strict MuPDF API double.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const element={addEventListener(){},getContext(){return null}};
const context={console,document:{getElementById:()=>element,createElement:()=>element,addEventListener(){}},window:{addEventListener(){}},ResizeObserver:class{observe(){}}};
vm.createContext(context);
const code=fs.readFileSync(require('node:path').join(__dirname,'../pdf-mupdf.js'),'utf8').replace('\ninitEngine();','');
vm.runInContext(code+'\nglobalThis.run=(doc,engine,list)=>{mupdf=engine;return applyPdfEdits(doc,list)}',context);
(async()=>{
 const events=[];let destroyed=0;
 const page={createAnnotation(type){assert.ok(['Redact','FreeText'].includes(type),type);events.push(type);return{setRect(){},setContents(){},setDefaultAppearance(){},update(){},destroy(){destroyed++}}},applyRedactions(...args){assert.deepEqual(args,[false,0,0,0]);events.push('apply')},update(){},destroy(){destroyed++}};
 const doc={loadPage:()=>page},engine={PDFPage:{REDACT_IMAGE_NONE:0,REDACT_LINE_ART_NONE:0,REDACT_TEXT_REMOVE:0}};
 await context.run(doc,engine,[{page:0,bbox:[10,10,30,20],newText:'2026',fontSize:10}]);
 assert.deepEqual(events,['Redact','apply','FreeText']);assert.equal(destroyed,3);
 console.log('PASS: valid redaction enum, preserve image/vector options, removal before replacement, resource cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
