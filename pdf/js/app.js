import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { analyzePage } from './analyze.js';
import { buildPdf, resolveEdit, assemble, appendPdf, appendBlank, applyStamps } from './engine.js';
import { FontLibrary, bundledList, visualToLogical, hasArabic, cleanBaseName } from './fonts.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.mjs';
const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
const LINE_GAP = 1.35;

const $ = (id) => document.getElementById(id);
const lib = new FontLibrary();
// Document state is a snapshot { orig, libDoc, edits, plan, stamps }:
//  orig/libDoc: the source PDF (grows when files are merged or blank pages added)
//  edits: text and image edits, each tied to a source page index (e.page)
//  plan: final page order [{o: source index, rot}]; stamps: page numbers / watermark
const S = {
  orig: null, name: 'document', libDoc: null, pdf: null, baseCount: 0,
  analyses: new Map(), edits: [], plan: [], stamps: null, undo: [], redo: [],
  scale: 1, mode: 'edit', pageEls: [], rendering: new Map(), editing: null, placing: null,
  pdfVersion: 0, selected: new Set(), current: 0,
};
window.__nidaaPdf = S; // handy for debugging
S.lib = lib;

// ---------- helpers ----------
function toast(msg, ms = 3500) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, ms);
}
const busy = (on) => { $('busy').hidden = !on; };
const hex2 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
function fillToHex(fill) {
  if (!fill) return '#000000';
  const v = fill.vals;
  if (fill.op === 'g') return '#' + hex2(v[0]).repeat(3);
  if (fill.op === 'rg') return '#' + v.slice(0, 3).map(hex2).join('');
  if (fill.op === 'k') { const [c, m, y, k] = v; return '#' + [c, m, y].map((x) => hex2((1 - x) * (1 - k))).join(''); }
  return '#000000';
}
const clone = (a) => a.map((e) => ({ ...e }));
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const round2 = (v) => Math.round(v * 100) / 100;
const applyM = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function invM(m) {
  const d = m[0] * m[3] - m[1] * m[2];
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
}
// visual frame of a rendered (pdf.js) page: local coords upright as displayed -> user space; null when not rotated
function frameFor(page) {
  const [x1, y1, x2, y2] = page.view;
  const w = x2 - x1, h = y2 - y1;
  const r = ((page.rotate % 360) + 360) % 360;
  if (r === 90) return [0, 1, -1, 0, x1 + w, y1];
  if (r === 180) return [-1, 0, 0, -1, x1 + w, y1 + h];
  if (r === 270) return [0, -1, 1, 0, x1, y1 + h];
  return null;
}
function download(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

// ---------- snapshots & building ----------
const snap = () => ({ orig: S.orig, libDoc: S.libDoc, edits: S.edits, plan: S.plan, stamps: S.stamps });
function applySnap(sn) { S.orig = sn.orig; S.libDoc = sn.libDoc; S.edits = sn.edits; S.plan = sn.plan; S.stamps = sn.stamps; }
const identityPlan = (plan, n) => plan.length === n && plan.every((p, i) => p.o === i && !p.rot);
const hasStamps = (st) => !!(st && (st.numbers || st.watermark));
const hasChanges = () => S.orig && (S.edits.length || !identityPlan(S.plan, S.libDoc.getPageCount()) || hasStamps(S.stamps) || S.libDoc.getPageCount() !== S.baseCount);

async function buildFinal(sn, plan = sn.plan) {
  let bytes = sn.orig;
  if (sn.edits.length) bytes = await buildPdf(sn.orig, clone(sn.edits), lib);
  if (!identityPlan(plan, sn.libDoc.getPageCount())) bytes = await assemble(bytes, plan);
  return applyStamps(bytes, sn.stamps, lib);
}

// ---------- file loading ----------
async function openFile(file) {
  if (!file) return;
  busy(true);
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    let libDoc;
    try { libDoc = await PDFLib.PDFDocument.load(buf, { updateMetadata: false }); }
    catch (e) {
      if (/encrypt/i.test(e.message)) { toast('هذا الملف محمي بكلمة مرور أو مشفّر، ولا يمكن تعديله هنا.'); return; }
      throw e;
    }
    closeEditor(); cancelPlacing();
    S.orig = buf; S.libDoc = libDoc; S.name = file.name.replace(/\.pdf$/i, '');
    S.baseCount = libDoc.getPageCount();
    S.analyses.clear(); S.edits = []; S.undo = []; S.redo = []; S.stamps = null;
    S.plan = libDoc.getPageIndices().map((o) => ({ o, rot: 0 }));
    S.selected.clear(); S.current = 0;
    await lib.init();
    await loadPdfjs(buf);
    const first = await S.pdf.getPage(1);
    const vp = first.getViewport({ scale: 1 });
    const sideW = window.innerWidth > 720 ? 200 : 0;
    S.scale = Math.min(1.6, Math.max(0.5, (Math.min(window.innerWidth - sideW, 1100) - 48) / vp.width));
    $('empty').hidden = true; $('workspace').hidden = false; $('tools').hidden = false; $('saveBtn').hidden = false;
    $('sidebar').classList.toggle('closed', window.innerWidth <= 720);
    document.title = file.name + ' – محرر PDF العربي';
    layoutSidebar();
    buildPages();
    renderThumbs();
    updateButtons();
  } catch (e) {
    console.error(e);
    toast('تعذّر فتح الملف: ' + e.message);
  } finally { busy(false); }
}

async function loadPdfjs(bytes) {
  if (S.pdf) S.pdf.destroy();
  S.pdf = await pdfjsLib.getDocument({
    data: bytes.slice(), cMapUrl: PDFJS_CDN + 'cmaps/', cMapPacked: true,
    standardFontDataUrl: PDFJS_CDN + 'standard_fonts/', isEvalSupported: false,
  }).promise;
}

function analysis(o) {
  if (!S.analyses.has(o)) {
    let a;
    try { a = analyzePage(S.libDoc, o); } catch (e) { console.warn('analyze', e); a = { runs: [], lines: [] }; }
    S.analyses.set(o, a);
  }
  return S.analyses.get(o);
}
const srcOf = (i) => (S.plan[i] ? S.plan[i].o : -1);
const viewOf = (o) => S.plan.findIndex((p) => p.o === o);

// ---------- page rendering ----------
let observer = null;
function pageSize(i) {
  const p = S.plan[i], lp = S.libDoc.getPage(p.o);
  const { width, height } = lp.getSize();
  const rot = ((lp.getRotation().angle + p.rot) % 180) !== 0;
  return rot ? [height, width] : [width, height];
}
function buildPages() {
  const wrap = $('pages');
  wrap.innerHTML = '';
  S.pageEls = [];
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) renderPage(+en.target.dataset.page);
  }, { rootMargin: '600px 0px' });
  S.plan.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'page';
    el.dataset.page = i;
    const [w, h] = pageSize(i);
    el.style.width = w * S.scale + 'px';
    el.style.height = h * S.scale + 'px';
    el.innerHTML = `<canvas></canvas><div class="overlay"></div><span class="num">${i + 1} / ${S.plan.length}</span>`;
    el.querySelector('.overlay').addEventListener('click', (ev) => onOverlayClick(ev, i));
    wrap.appendChild(el);
    S.pageEls.push(el);
    observer.observe(el);
  });
  wrap.classList.toggle('mode-edit', S.mode === 'edit');
  wrap.classList.toggle('mode-add', S.mode === 'add');
  $('zoomLabel').textContent = Math.round(S.scale * 100) + '%';
  $('pageCount').textContent = `${S.plan.length} صفحة`;
}

async function renderPage(i, force = false) {
  const el = S.pageEls[i];
  if (!el) return;
  const key = String(S.scale) + ':' + S.pdfVersion;
  if (!force && el.dataset.rendered === key) return;
  if (S.rendering.get(i)) { S.rendering.get(i).cancel(); }
  const page = await S.pdf.getPage(i + 1);
  const vp = page.getViewport({ scale: S.scale });
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
  canvas.style.width = vp.width + 'px'; canvas.style.height = vp.height + 'px';
  el.style.width = vp.width + 'px'; el.style.height = vp.height + 'px';
  const task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] });
  S.rendering.set(i, task);
  try { await task.promise; } catch (e) { if (e && e.name === 'RenderingCancelledException') return; throw e; }
  S.rendering.delete(i);
  if (S.pageEls[i] !== el) return;
  el.querySelector('canvas').replaceWith(canvas);
  el.dataset.rendered = key;
  el._vp = vp; el._page = page;
  drawOverlay(i);
}

// bounding view rectangle of a box given in user space (or in local coords when a frame is given)
function viewRect(vp, box, frame) {
  const [x0, y0, x1, y1] = box;
  const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => (frame ? applyM(frame, x, y) : [x, y])).map(([x, y]) => vp.convertToViewportPoint(x, y));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
function imageCorners(e) {
  const a = ((e.angle || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const p0 = [e.x, e.y], p1 = [e.x + e.w * c, e.y + e.w * s];
  const up = [-e.h * s, e.h * c];
  return [p0, p1, [p1[0] + up[0], p1[1] + up[1]], [p0[0] + up[0], p0[1] + up[1]]];
}
function imageViewRect(vp, e) {
  const pts = imageCorners(e).map(([x, y]) => vp.convertToViewportPoint(x, y));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
const place = (div, r) => Object.assign(div.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });

function lineBox(l) {
  return [l.x0, l.baseline + l.size * l.descent - l.size * 0.05, l.x1, l.baseline + l.size * l.ascent + l.size * 0.05];
}
function editBox(e) {
  const n = (e.text || '').split('\n').length;
  const w = e.width != null ? e.width : e.x1 - e.x0;
  let x0;
  if (e.align === 'left') x0 = e.x0; else if (e.align === 'center') x0 = (e.x0 + e.x1) / 2 - w / 2; else x0 = e.x1 - w;
  return [x0, e.baseline - e.size * 0.3 - (n - 1) * e.size * LINE_GAP, x0 + Math.max(w, e.size), e.baseline + e.size * 0.9];
}

function drawOverlay(i) {
  const el = S.pageEls[i];
  const vp = el && el._vp; if (!vp) return;
  const ov = el.querySelector('.overlay');
  ov.innerHTML = '';
  const o = srcOf(i);
  // existing lines are editable only while the page keeps its original orientation
  if (!S.plan[i].rot) {
    const an = analysis(o);
    const editedLines = new Set(S.edits.filter((e) => e.page === o && e.lineId).map((e) => e.lineId));
    for (const l of an.lines) {
      if (editedLines.has(l.id)) continue;
      const d = document.createElement('div');
      d.className = 'hot';
      place(d, viewRect(vp, lineBox(l)));
      d.title = 'اضغط للتعديل';
      d.addEventListener('click', (ev) => { if (S.mode !== 'edit') return; ev.stopPropagation(); startEditLine(i, l); });
      ov.appendChild(d);
    }
  }
  for (const e of S.edits.filter((x) => x.page === o && x.type !== 'image' && x.text)) {
    const d = document.createElement('div');
    d.className = 'editbox';
    place(d, viewRect(vp, editBox(e), e.frame));
    d.title = 'اضغط لتعديل هذا النص';
    d.addEventListener('click', (ev) => { ev.stopPropagation(); startEditExisting(e); });
    ov.appendChild(d);
  }
  for (const e of S.edits.filter((x) => x.page === o && x.type === 'image')) {
    const d = document.createElement('div');
    d.className = 'imgbox';
    place(d, imageViewRect(vp, e));
    d.title = 'اضغط لتحريك الصورة أو تغيير حجمها';
    d.addEventListener('click', (ev) => { ev.stopPropagation(); startPlacing({ bytes: e.imgBytes, type: e.imgType, id: e.imgId, url: e.imgUrl, aspect: e.aspect }, e); });
    ov.appendChild(d);
  }
}

// ---------- text editing ----------
async function ensureLocalFonts() {
  if (lib.localState === 'unknown' && lib.localSupported) {
    await lib.requestLocal();
    updateLocalChip();
  }
}

function startEditLine(i, line) {
  const before = lib.localState;
  ensureLocalFonts().then(() => {
    if (before !== lib.localState && S.editing) { fontOptions(S.editing.e); updateStatus(); }
  });
  const text = visualToLogical(line.visual);
  openEditor({
    id: 'e' + Date.now(), page: srcOf(i), type: 'edit', lineId: line.id, removeRuns: line.runIds,
    text, original: text, fontKey: line.fontKey, pdfFont: line.font, fill: line.fill,
    color: fillToHex(line.fill), colorChanged: false, size: round2(line.size),
    align: line.rtl ? 'right' : 'left', rtl: line.rtl, x0: line.x0, x1: line.x1, baseline: line.baseline,
    fontChoice: 'auto', cover: lineBox(line),
    styles: line.styles, mainKey: line.mainKey, baseSize: line.size,
    // the line uses Arabic-Indic digits only: typed digits follow the same style
    hindiDigits: /[٠-٩]/.test(line.visual) && !/[0-9]/.test(line.visual),
  }, true);
}
function startEditExisting(e) {
  openEditor({ ...e }, false);
}
function onOverlayClick(ev, i) {
  if (S.mode !== 'add' || S.editing || S.placing) return;
  const el = S.pageEls[i];
  if (!el._vp) return;
  const r = el.getBoundingClientRect();
  const [ux, uy] = el._vp.convertToPdfPoint(ev.clientX - r.left, ev.clientY - r.top);
  const frame = el._page ? frameFor(el._page) : null;
  const [x, y] = frame ? applyM(invM(frame), ux, uy) : [ux, uy];
  const size = 14;
  openEditor({
    id: 'e' + Date.now(), page: srcOf(i), type: 'add', text: '', size, color: '#000000', colorChanged: true,
    align: 'right', rtl: true, x0: x, x1: x, baseline: y - size * 0.8, fontChoice: 'bundled:amiri', frame,
  }, true);
}

function fontOptions(e) {
  const sel = $('edFont');
  sel.innerHTML = '';
  const add = (parent, value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; parent.appendChild(o); };
  if (e.pdfFont) {
    add(sel, 'auto', 'تلقائي – نفس الخط الأصلي (' + cleanBaseName(e.pdfFont.baseFont).split(/[-,]/)[0] + ')');
  }
  const g1 = document.createElement('optgroup'); g1.label = 'خطوط عربية مدمجة';
  for (const b of bundledList) { add(g1, 'bundled:' + b.id, b.label); }
  sel.appendChild(g1);
  if (lib.localFonts) {
    const g2 = document.createElement('optgroup'); g2.label = 'من خطوط جهازك';
    const wanted = ['TraditionalArabic', 'SimplifiedArabic', 'SakkalMajalla', 'ArialMT', 'Arial-BoldMT', 'Tahoma', 'TimesNewRomanPSMT', 'SegoeUI', 'Dubai-Regular', 'Andalus', 'ArabicTypesetting', 'Calibri', 'AdobeArabic-Regular', 'Aldhabi'];
    const seen = new Set();
    for (const w of wanted) {
      const fd = lib.localFonts.find((f) => f.postscriptName === w);
      if (fd && !seen.has(fd.postscriptName)) { seen.add(fd.postscriptName); add(g2, 'local:' + fd.postscriptName, fd.fullName); }
    }
    if (g2.children.length) sel.appendChild(g2);
  }
  const g3 = document.createElement('optgroup'); g3.label = 'أخرى';
  for (const sf of lib.uploaded.values()) if (!sel.querySelector(`option[value="${CSS.escape(sf.id)}"]`)) add(g3, sf.id, sf.label);
  add(g3, '__upload', 'رفع ملف خط (TTF/OTF)…');
  sel.appendChild(g3);
  sel.value = e.fontChoice;
  if (sel.value !== e.fontChoice) sel.value = e.pdfFont ? 'auto' : 'bundled:amiri';
}

let textEl = null, coverEl = null, statusTimer = null;

function openEditor(e, isNew) {
  closeEditor(); cancelPlacing();
  const i = viewOf(e.page);
  const el = S.pageEls[i];
  if (!el || !el._vp) return;
  S.editing = { e, isNew };
  const vp = el._vp;
  const ov = el.querySelector('.overlay');
  // cover the original text while typing
  if (e.cover || !isNew) {
    coverEl = document.createElement('div');
    coverEl.className = 'cover';
    const r = e.cover ? viewRect(vp, e.cover) : viewRect(vp, editBox(e), e.frame);
    place(coverEl, r);
    coverEl.style.background = sampleBg(el, r);
    ov.appendChild(coverEl);
  }
  textEl = document.createElement('textarea');
  textEl.className = 'ed-text';
  textEl.spellcheck = false;
  textEl.value = e.text;
  textEl.dir = hasArabic(e.text) || e.rtl ? 'rtl' : 'ltr';
  textEl.addEventListener('input', () => {
    if (S.editing.e.hindiDigits && /[0-9]/.test(textEl.value)) {
      const pos = textEl.selectionStart;
      textEl.value = textEl.value.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + +d));
      textEl.setSelectionRange(pos, pos);
    }
    S.editing.e.text = textEl.value; layoutTextEl(); scheduleStatus();
  });
  textEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); closeEditor(); }
    else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); applyEdit(); }
  });
  ov.appendChild(textEl);
  fontOptions(e);
  $('edSize').value = e.size;
  $('edColor').value = e.color || '#000000';
  document.querySelectorAll('[data-align]').forEach((b) => b.classList.toggle('active', b.dataset.align === e.align));
  $('edDelete').hidden = isNew && e.type === 'add';
  $('editor').hidden = false;
  layoutTextEl();
  keepVisible(textEl);
  textEl.focus({ preventScroll: true });
  if (e.type === 'edit' && isNew) textEl.select();
  updateStatus();
}

function sampleBg(el, r) {
  try {
    const c = el.querySelector('canvas');
    const k = c.width / parseFloat(c.style.width);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const pts = [[r.left - 3, r.top + r.height / 2], [r.left + r.width + 3, r.top + r.height / 2], [r.left + r.width / 2, r.top - 2], [r.left + r.width / 2, r.top + r.height + 2]];
    const counts = new Map();
    for (const [x, y] of pts) {
      const d = ctx.getImageData(Math.max(0, Math.round(x * k)), Math.max(0, Math.round(y * k)), 1, 1).data;
      const key = `rgb(${d[0]},${d[1]},${d[2]})`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  } catch (err) { return '#fff'; }
}

const previewFaces = new Map();
async function previewFamily(sf) {
  if (!sf || !sf.bytes) return null;
  const fam = 'nd_' + sf.id.replace(/[^a-z0-9]/gi, '_');
  if (!previewFaces.has(fam)) {
    const face = new FontFace(fam, sf.bytes);
    previewFaces.set(fam, face.load().then((f) => { document.fonts.add(f); return fam; }).catch(() => null));
  }
  return previewFaces.get(fam);
}

function layoutTextEl() {
  if (!S.editing || !textEl) return;
  const { e } = S.editing;
  const el = S.pageEls[viewOf(e.page)];
  const vp = el._vp;
  const px = e.size * S.scale;
  const lines = (textEl.value || ' ').split('\n');
  textEl.style.fontSize = px + 'px';
  textEl.style.lineHeight = LINE_GAP;
  textEl.style.color = e.color || '#000';
  textEl.style.textAlign = e.align === 'center' ? 'center' : e.align;
  const meas = document.createElement('span');
  meas.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-size:${px}px;font-family:${textEl.style.fontFamily || 'inherit'}`;
  document.body.appendChild(meas);
  let w = 0;
  for (const l of lines) { meas.textContent = l || ' '; w = Math.max(w, meas.getBoundingClientRect().width); }
  meas.remove();
  w = Math.max(w + px * 0.6, 40);
  const lx = e.align === 'left' ? e.x0 : e.align === 'center' ? (e.x0 + e.x1) / 2 : e.x1;
  const [ux, uy] = e.frame ? applyM(e.frame, lx, e.baseline) : [lx, e.baseline];
  const [ax, ay] = vp.convertToViewportPoint(ux, uy);
  const left = e.align === 'left' ? ax : e.align === 'center' ? ax - w / 2 : ax - w;
  const h = lines.length * px * LINE_GAP;
  const top = ay - px * 1.05 - (lines.length - 1) * px * LINE_GAP;
  Object.assign(textEl.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
  dockEditor();
}

// Keep an element clear of the docked toolbar: scroll, or push the pages down near the top.
function keepVisible(target) {
  if (!target) return;
  const bar = !$('editor').hidden ? $('editor') : $('imgbar');
  const edBottom = bar.getBoundingClientRect().bottom;
  let tr = target.getBoundingClientRect();
  if (tr.top < edBottom + 12) window.scrollBy(0, tr.top - edBottom - 24);
  tr = target.getBoundingClientRect();
  if (tr.top < edBottom + 12) {
    const cur = parseFloat(getComputedStyle($('pages')).paddingTop) || 0;
    $('pages').style.paddingTop = Math.ceil(cur + edBottom + 24 - tr.top) + 'px';
  }
}
new ResizeObserver(() => { if (S.editing) { dockEditor(); keepVisible(textEl); } }).observe(document.getElementById('editor'));

// Edit toolbars sit fixed under the header so they never cover the content being edited.
function dockEditor() {
  const top = document.querySelector('.bar').getBoundingClientRect().bottom + 'px';
  $('editor').style.top = top;
  $('imgbar').style.top = top;
}
function layoutSidebar() {
  const h = document.querySelector('.bar').offsetHeight;
  const sb = $('sidebar');
  if (window.innerWidth > 720) { sb.style.top = h + 'px'; sb.style.height = `calc(100vh - ${h}px)`; }
  else { sb.style.top = ''; sb.style.height = ''; }
}

function scheduleStatus() { clearTimeout(statusTimer); statusTimer = setTimeout(updateStatus, 180); }

let statusSeq = 0;
async function updateStatus() {
  if (!S.editing) return;
  const seq = ++statusSeq;
  const { e } = S.editing;
  const st = $('edStatus');
  let res;
  try { res = await resolveEdit({ ...e, text: e.text || ' ' }, lib); } catch (err) { console.warn(err); st.textContent = ''; return; }
  if (!S.editing || S.editing.e !== e || seq !== statusSeq) return;
  e.width = Math.max(...res.layout.map((L) => L.width)) * e.size;
  const primary = res.layout[0]?.fonts[0] || null;
  const fam = await previewFamily(primary && primary.source === 'pdf' ? (lib.findLocal(e.pdfFont?.baseFont) ? await lib.fromLocal(lib.findLocal(e.pdfFont.baseFont)) : primary) : primary);
  if (seq !== statusSeq) return;
  if (textEl && fam) { textEl.style.fontFamily = `"${fam}", var(--ui)`; layoutTextEl(); }
  const s = res.status;
  st.className = 'ed-status';
  const missingNote = s.missing ? ' <span class="warn-inline">⚠ بعض الرموز غير متوفرة في الخطوط المتاحة وستظهر كمربع.</span>' : '';
  const localHint = lib.localSupported && lib.localState !== 'granted'
    ? ' <button class="link" data-act="local">اسمح باستخدام خطوط جهازك</button> أو'
    : '';
  if (s.parts && s.parts.length > 1) {
    const names = { ar: 'العربي', la: 'الإنجليزي', num: 'الأرقام' };
    const ok = s.parts.every((p) => p.kind === 'original' || p.kind === 'same');
    st.classList.add(ok ? 'ok' : 'warn');
    st.innerHTML = s.parts.map((p) => `${names[p.part]}: ${p.kind === 'original' || p.kind === 'same' ? '✓' : p.kind === 'similar' ? '≈' : '⚠'} <b>${esc(p.kind === 'fallback' || p.kind === 'similar' ? p.font + ' (بديل عن ' + cleanBaseName(p.wanted) + ')' : p.font)}</b>`).join(' · ')
      + (ok ? '' : `<br>${lib.localSupported && lib.localState !== 'granted' ? '<button class="link" data-act="local">اسمح باستخدام خطوط جهازك</button> أو ' : ''}<button class="link" data-act="upload">ارفع ملف الخط</button> لاستخدام الخط الأصلي بالضبط.`);
    if (s.missing) st.innerHTML += missingNote;
    return;
  }
  if (s.kind === 'original') { st.classList.add('ok'); st.innerHTML = `✓ نفس الخط الأصلي <b>${esc(s.font)}</b> – من داخل الملف نفسه`; }
  else if (s.kind === 'same') { st.classList.add('ok'); st.innerHTML = `✓ نفس الخط الأصلي <b>${esc(s.font)}</b> – ${s.how === 'upload' ? 'من الملف المرفوع' : 'من جهازك'}، وسيُضمَّن في الملف`; }
  else if (s.kind === 'mixed') { st.classList.add('warn'); st.innerHTML = `الخط <b>${esc(s.font)}</b> لا يحتوي بعض الحروف، فاستُخدم لها خط بديل`; }
  else if (s.kind === 'similar') { st.classList.add('warn'); st.innerHTML = `≈ الخط الأصلي <b>${esc(s.wanted)}</b> غير مثبّت، واستُخدم أقرب خط من جهازك: <b>${esc(s.font)}</b>. للحصول على نفس الخط بالضبط ثبّته أو <button class="link" data-act="upload">ارفع ملفه</button>.`; }
  else if (s.kind === 'chosen') { st.innerHTML = `الخط: <b>${esc(s.font)}</b> (سيُضمَّن في الملف)`; }
  else {
    st.classList.add('warn');
    st.innerHTML = `⚠ الخط الأصلي <b>${esc(s.wanted)}</b> غير متوفر كاملًا، واستُخدم أقرب خط: <b>${esc(s.font)}</b>.${localHint} <button class="link" data-act="upload">ارفع ملف الخط</button> لاستخدامه بالضبط.`;
  }
  if (missingNote) st.innerHTML += missingNote;
}

function closeEditor() {
  if (textEl) textEl.remove();
  if (coverEl) coverEl.remove();
  textEl = coverEl = null;
  S.editing = null;
  $('pages').style.paddingTop = '';
  $('editor').hidden = true;
}

async function applyEdit(del = false) {
  if (!S.editing) return;
  const { e, isNew } = S.editing;
  e.text = del ? '' : textEl.value.replace(/\s+$/g, '');
  if (isNew && e.type === 'edit' && e.text === e.original && !del) { closeEditor(); return; }
  if (isNew && e.type === 'add' && !e.text) { closeEditor(); return; }
  const next = S.edits.filter((x) => x.id !== e.id);
  if (!(e.type === 'add' && !e.text)) next.push({ ...e });
  closeEditor();
  await commit({ edits: next });
}

// ---------- committing changes ----------
function commit(patch, opts = {}) {
  S.pending = (S.pending || Promise.resolve()).then(() => doCommit(patch, opts));
  return S.pending;
}

async function doCommit(patch, { history = true } = {}) {
  busy(true);
  try {
    const prev = snap();
    const next = { ...prev, ...patch };
    const bytes = await buildFinal(next);
    if (history) { S.undo.push(prev); S.redo = []; }
    applySnap(next);
    await loadPdfjs(bytes);
    S.pdfVersion++;
    const structural = prev.plan !== next.plan || prev.libDoc !== next.libDoc || prev.stamps !== next.stamps;
    if (structural) {
      S.selected = new Set([...S.selected].filter((i) => i < S.plan.length));
      buildPages();
      renderThumbs();
    } else {
      const changed = new Set();
      for (const e of prev.edits) if (!next.edits.includes(e)) changed.add(e.page);
      for (const e of next.edits) if (!prev.edits.includes(e)) changed.add(e.page);
      // redraw in the background: the edit is already applied
      const views = [...changed].map(viewOf).filter((i) => i >= 0);
      views.forEach((i) => { renderPage(i, true); drawThumb(i, true); });
    }
  } catch (err) {
    console.error(err);
    toast('حدث خطأ أثناء تطبيق التعديل: ' + err.message);
  } finally { busy(false); updateButtons(); }
}

function updateButtons() {
  $('undo').disabled = !S.undo.length;
  $('redo').disabled = !S.redo.length;
}

async function doUndo() {
  closeEditor(); cancelPlacing();
  if (S.pending) await S.pending;
  if (!S.undo.length) return;
  const target = S.undo.pop();
  S.redo.push(snap());
  await commit(target, { history: false });
}
async function doRedo() {
  closeEditor(); cancelPlacing();
  if (S.pending) await S.pending;
  if (!S.redo.length) return;
  const target = S.redo.pop();
  S.undo.push(snap());
  await commit(target, { history: false });
}

async function save() {
  if (!S.orig) return;
  if (S.editing) await applyEdit();
  if (S.placing) applyPlacing();
  if (S.pending) await S.pending;
  busy(true);
  try {
    const changed = hasChanges();
    const bytes = changed ? await buildFinal(snap()) : S.orig;
    download(bytes, S.name + (changed ? '-edited' : '') + '.pdf');
  } catch (err) { console.error(err); toast('تعذّر الحفظ: ' + err.message); }
  finally { busy(false); }
}

// ---------- page panel (thumbnails) ----------
let thumbObserver = null;
function renderThumbs() {
  const box = $('thumbs');
  box.innerHTML = '';
  if (thumbObserver) thumbObserver.disconnect();
  thumbObserver = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) drawThumb(+en.target.dataset.i); }), { root: $('sidebar'), rootMargin: '400px' });
  S.plan.forEach((p, i) => {
    const t = document.createElement('div');
    t.className = 'thumb' + (S.selected.has(i) ? ' sel' : '') + (i === S.current ? ' current' : '');
    t.dataset.i = i;
    t.draggable = true;
    t.innerHTML = `<canvas class="tcanvas" width="10" height="14" style="width:120px;height:160px"></canvas>
      <div class="tbar"><input type="checkbox" ${S.selected.has(i) ? 'checked' : ''} aria-label="تحديد الصفحة ${i + 1}"><span class="n">${i + 1}</span>
      <button class="tbtn" data-act="rot" title="تدوير الصفحة" type="button">⟳</button><button class="tbtn" data-act="del" title="حذف الصفحة" type="button">✕</button></div>`;
    box.appendChild(t);
    thumbObserver.observe(t);
  });
  updateSel();
}
async function drawThumb(i, force = false) {
  const t = $('thumbs').children[i];
  if (!t || (!force && t.dataset.v === String(S.pdfVersion))) return;
  t.dataset.v = String(S.pdfVersion);
  try {
    const page = await S.pdf.getPage(i + 1);
    const v1 = page.getViewport({ scale: 1 });
    const scale = Math.min(120 / v1.width, 170 / v1.height);
    const vp = page.getViewport({ scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.className = 'tcanvas';
    c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
    c.style.width = vp.width + 'px'; c.style.height = vp.height + 'px';
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] }).promise;
    const old = t.querySelector('.tcanvas');
    if (old) old.replaceWith(c);
  } catch (e) { /* page vanished during a rebuild */ }
}
function updateSel() {
  const n = S.selected.size;
  $('sbSel').hidden = !n;
  $('selCount').textContent = `${n} محددة`;
  [...$('thumbs').children].forEach((t, i) => { t.classList.toggle('sel', S.selected.has(i)); const cb = t.querySelector('input'); if (cb) cb.checked = S.selected.has(i); });
}
function setCurrent(i) {
  if (i === S.current) return;
  const kids = $('thumbs').children;
  if (kids[S.current]) kids[S.current].classList.remove('current');
  S.current = i;
  if (kids[i]) { kids[i].classList.add('current'); }
}
const copyPlan = () => S.plan.map((p) => ({ ...p }));
async function rotatePages(idx) {
  if (S.pending) await S.pending;
  const plan = copyPlan();
  idx.forEach((i) => { if (plan[i]) plan[i].rot = (plan[i].rot + 90) % 360; });
  return commit({ plan });
}
async function deletePages(idx) {
  if (S.pending) await S.pending;
  if (idx.length >= S.plan.length) { toast('لا يمكن حذف كل الصفحات.'); return; }
  const drop = new Set(idx);
  S.selected.clear();
  return commit({ plan: S.plan.filter((_, i) => !drop.has(i)).map((p) => ({ ...p })) });
}
async function movePage(from, to) {
  if (S.pending) await S.pending;
  // to = insertion index in the current order
  if (to === from || to === from + 1) return;
  const plan = copyPlan();
  const [x] = plan.splice(from, 1);
  plan.splice(to > from ? to - 1 : to, 0, x);
  S.selected.clear();
  return commit({ plan });
}
async function insertBlank() {
  if (S.pending) await S.pending;
  busy(true);
  try {
    const i = Math.min(S.current, S.plan.length - 1);
    const { width, height } = S.libDoc.getPage(srcOf(i)).getSize();
    const bytes = await appendBlank(S.orig, width, height);
    const libDoc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    const plan = copyPlan();
    plan.splice(i + 1, 0, { o: libDoc.getPageCount() - 1, rot: S.plan[i].rot });
    await commit({ orig: bytes, libDoc, plan });
    toast(`أُضيفت صفحة فارغة بعد الصفحة ${i + 1}`);
  } catch (e) { console.error(e); toast('تعذّر إضافة الصفحة: ' + e.message); } finally { busy(false); }
}
async function mergeFiles(files) {
  if (!files.length) return;
  if (S.pending) await S.pending;
  busy(true);
  try {
    let bytes = S.orig, added = 0, count = S.libDoc.getPageCount();
    const plan = copyPlan();
    for (const f of files) {
      const r = await appendPdf(bytes, new Uint8Array(await f.arrayBuffer()));
      bytes = r.bytes;
      for (let k = 0; k < r.added; k++) plan.push({ o: count + k, rot: 0 });
      count += r.added; added += r.added;
    }
    const libDoc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    await commit({ orig: bytes, libDoc, plan });
    toast(`تمت إضافة ${added} صفحة في نهاية الملف`);
  } catch (e) {
    console.error(e);
    toast(/encrypt/i.test(e.message) ? 'أحد الملفات محمي بكلمة مرور ولا يمكن دمجه.' : 'تعذّر دمج الملف: ' + e.message);
  } finally { busy(false); }
}
async function extractPages(idx) {
  if (S.pending) await S.pending;
  busy(true);
  try {
    const plan = [...idx].sort((a, b) => a - b).map((i) => S.plan[i]);
    const bytes = await buildFinal(snap(), plan);
    download(bytes, `${S.name}-pages.pdf`);
  } catch (e) { console.error(e); toast('تعذّر استخراج الصفحات: ' + e.message); } finally { busy(false); }
}

function bindThumbs() {
  const box = $('thumbs');
  box.addEventListener('click', (ev) => {
    const t = ev.target.closest('.thumb'); if (!t) return;
    const i = +t.dataset.i;
    const act = ev.target.closest('[data-act]');
    if (act) { ev.stopPropagation(); if (act.dataset.act === 'rot') rotatePages([i]); else deletePages([i]); return; }
    if (ev.target.matches('input[type=checkbox]')) {
      if (ev.target.checked) S.selected.add(i); else S.selected.delete(i);
      updateSel(); return;
    }
    setCurrent(i);
    S.pageEls[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.innerWidth <= 720) $('sidebar').classList.add('closed');
  });
  let dragFrom = -1;
  box.addEventListener('dragstart', (ev) => {
    const t = ev.target.closest('.thumb'); if (!t) return;
    dragFrom = +t.dataset.i; t.classList.add('dragging');
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', String(dragFrom));
  });
  const clearMarks = () => [...box.children].forEach((c) => c.classList.remove('dropBefore', 'dropAfter', 'dragging'));
  const dropIndex = (ev, t) => {
    const r = t.getBoundingClientRect();
    const vertical = getComputedStyle(box).flexDirection.startsWith('column');
    const before = vertical ? ev.clientY < r.top + r.height / 2 : ev.clientX > r.left + r.width / 2; // RTL row: earlier pages sit to the right
    return { before, index: +t.dataset.i + (before ? 0 : 1) };
  };
  box.addEventListener('dragover', (ev) => {
    const t = ev.target.closest('.thumb'); if (!t || dragFrom < 0) return;
    ev.preventDefault();
    const { before } = dropIndex(ev, t);
    [...box.children].forEach((c) => c.classList.remove('dropBefore', 'dropAfter'));
    t.classList.add(before ? 'dropBefore' : 'dropAfter');
  });
  box.addEventListener('drop', (ev) => {
    const t = ev.target.closest('.thumb');
    ev.preventDefault();
    if (t && dragFrom >= 0) movePage(dragFrom, dropIndex(ev, t).index);
    dragFrom = -1; clearMarks();
  });
  box.addEventListener('dragend', () => { dragFrom = -1; clearMarks(); });
  // the document-level file drop must not fire for thumbnail drags
  box.addEventListener('dragenter', (ev) => { if (dragFrom >= 0) ev.stopPropagation(); });

  $('mergeBtn').onclick = () => $('mergeInput').click();
  $('mergeInput').onchange = () => { const fs = [...$('mergeInput').files]; $('mergeInput').value = ''; mergeFiles(fs); };
  $('blankBtn').onclick = insertBlank;
  $('selRotate').onclick = () => rotatePages([...S.selected]);
  $('selDelete').onclick = () => deletePages([...S.selected]);
  $('selExtract').onclick = () => extractPages([...S.selected]);
  $('selClear').onclick = () => { S.selected.clear(); updateSel(); };
  $('pagesBtn').onclick = () => { $('sidebar').classList.toggle('closed'); layoutSidebar(); };
}

// track the page in view to highlight its thumbnail
let scrollRaf = 0;
window.addEventListener('scroll', () => {
  if (scrollRaf || !S.pageEls.length) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const mid = window.innerHeight * 0.4;
    let best = 0, bd = Infinity;
    S.pageEls.forEach((el, i) => { const r = el.getBoundingClientRect(); const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid)); if (d < bd) { bd = d; best = i; } });
    setCurrent(best);
  });
}, { passive: true });

// ---------- images & signature ----------
async function toImage(file) {
  const type = /png/i.test(file.type) ? 'png' : /jpe?g/i.test(file.type) ? 'jpg' : null;
  const bitmap = await createImageBitmap(file);
  let bytes;
  if (type) bytes = new Uint8Array(await file.arrayBuffer());
  else { // other formats: convert to PNG
    const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
    c.getContext('2d').drawImage(bitmap, 0, 0);
    bytes = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
  }
  const t = type || 'png';
  return { bytes, type: t, id: 'img' + Date.now() + Math.random().toString(36).slice(2, 6), url: URL.createObjectURL(new Blob([bytes], { type: t === 'png' ? 'image/png' : 'image/jpeg' })), aspect: bitmap.width / bitmap.height };
}
async function canvasToImage(c) {
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, type: 'png', id: 'sig' + Date.now(), url: URL.createObjectURL(blob), aspect: c.width / c.height };
}
// crop transparent margins
function trimCanvas(src) {
  const ctx = src.getContext('2d');
  const { width: w, height: h } = src;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function visiblePageIndex() {
  const mid = window.innerHeight / 2;
  let best = 0, bd = Infinity;
  S.pageEls.forEach((el, i) => { const r = el.getBoundingClientRect(); const d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd && el._vp) { bd = d; best = i; } });
  return best;
}

let placerCover = null;
function startPlacing(img, existing = null) {
  closeEditor(); cancelPlacing();
  const i = existing ? viewOf(existing.page) : visiblePageIndex();
  const el = S.pageEls[i];
  if (!el || !el._vp) { toast('انتظر حتى تظهر الصفحة ثم حاول مرة أخرى.'); return; }
  const vp = el._vp;
  let rect;
  if (existing) {
    rect = imageViewRect(vp, existing);
    placerCover = document.createElement('div');
    placerCover.className = 'cover';
    place(placerCover, rect);
    placerCover.style.background = sampleBg(el, rect);
    el.querySelector('.overlay').appendChild(placerCover);
  } else {
    const pr = el.getBoundingClientRect();
    const visTop = Math.max(0, -pr.top + 80), visBottom = Math.min(vp.height, window.innerHeight - pr.top - 20);
    const w = Math.min(vp.width * 0.35, 240), h = w / img.aspect;
    rect = { left: (vp.width - w) / 2, top: Math.max(10, Math.min(vp.height - h - 10, (visTop + visBottom) / 2 - h / 2)), width: w, height: h };
  }
  const div = document.createElement('div');
  div.className = 'placer';
  div.innerHTML = `<img src="${img.url}" alt=""><span class="h tl" data-c="tl"></span><span class="h tr" data-c="tr"></span><span class="h bl" data-c="bl"></span><span class="h br" data-c="br"></span>`;
  place(div, rect);
  el.querySelector('.overlay').appendChild(div);
  S.placing = { i, img, edit: existing, div };
  $('imgDelete').hidden = !existing;
  $('imgbar').hidden = false;
  dockEditor();
  keepVisible(div);

  let st = null;
  div.addEventListener('pointerdown', (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const h = ev.target.closest('.h');
    st = { x: ev.clientX, y: ev.clientY, l: div.offsetLeft, t: div.offsetTop, w: div.offsetWidth, h: div.offsetHeight, mode: h ? h.dataset.c : 'move' };
    div.setPointerCapture(ev.pointerId);
  });
  div.addEventListener('pointermove', (ev) => {
    if (!st) return;
    const dx = ev.clientX - st.x, dy = ev.clientY - st.y;
    const pw = vp.width, ph = vp.height, a = img.aspect;
    let { l, t, w, h } = st;
    if (st.mode === 'move') {
      l = Math.max(-w / 2, Math.min(pw - w / 2, st.l + dx));
      t = Math.max(-h / 2, Math.min(ph - h / 2, st.t + dy));
    } else {
      const grow = st.mode.includes('r') ? dx : -dx;
      w = Math.max(24, st.w + grow); h = w / a;
      if (st.mode.includes('l')) l = st.l + st.w - w;
      if (st.mode.includes('t')) t = st.t + st.h - h;
    }
    place(div, { left: l, top: t, width: w, height: h });
  });
  const end = () => { st = null; };
  div.addEventListener('pointerup', end);
  div.addEventListener('pointercancel', end);
}
function cancelPlacing() {
  if (!S.placing) return;
  S.placing.div.remove();
  if (placerCover) { placerCover.remove(); placerCover = null; }
  S.placing = null;
  $('imgbar').hidden = true;
  $('pages').style.paddingTop = '';
}
function applyPlacing() {
  if (!S.placing) return;
  const { i, img, edit, div } = S.placing;
  const vp = S.pageEls[i]._vp;
  const l = div.offsetLeft, t = div.offsetTop, w = div.offsetWidth, h = div.offsetHeight;
  const p0 = vp.convertToPdfPoint(l, t + h), p1 = vp.convertToPdfPoint(l + w, t + h), p3 = vp.convertToPdfPoint(l, t);
  const e = {
    id: edit ? edit.id : 'i' + Date.now(), type: 'image', page: srcOf(i),
    imgId: img.id, imgType: img.type, imgBytes: img.bytes, imgUrl: img.url, aspect: img.aspect,
    x: p0[0], y: p0[1], w: Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), h: Math.hypot(p3[0] - p0[0], p3[1] - p0[1]),
    angle: (Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180) / Math.PI,
  };
  const next = S.edits.filter((x) => x.id !== e.id);
  next.push(e);
  cancelPlacing();
  commit({ edits: next });
}
function deletePlacing() {
  if (!S.placing) return;
  const { edit } = S.placing;
  cancelPlacing();
  if (edit) commit({ edits: S.edits.filter((x) => x.id !== edit.id) });
}

// signature pad
let sigColor = '#111827', sigImage = null, sigDirty = false;
function bindSignature() {
  const c = $('sigCanvas'), ctx = c.getContext('2d');
  let drawing = false, last = null;
  const pos = (ev) => { const r = c.getBoundingClientRect(); return [(ev.clientX - r.left) * (c.width / r.width), (ev.clientY - r.top) * (c.height / r.height)]; };
  c.addEventListener('pointerdown', (ev) => { drawing = true; last = pos(ev); c.setPointerCapture(ev.pointerId); ctx.beginPath(); ctx.arc(last[0], last[1], +$('sigWidth').value / 2, 0, Math.PI * 2); ctx.fillStyle = sigColor; ctx.fill(); sigDirty = true; });
  c.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    const p = pos(ev);
    ctx.strokeStyle = sigColor; ctx.lineWidth = +$('sigWidth').value; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last[0], last[1]);
    const mx = (last[0] + p[0]) / 2, my = (last[1] + p[1]) / 2;
    ctx.quadraticCurveTo(last[0], last[1], mx, my); ctx.lineTo(p[0], p[1]); ctx.stroke();
    last = p;
  });
  const stop = () => { drawing = false; };
  c.addEventListener('pointerup', stop); c.addEventListener('pointercancel', stop);
  $('sigClear').onclick = () => { ctx.clearRect(0, 0, c.width, c.height); sigDirty = false; };
  document.querySelectorAll('.swatch').forEach((b) => b.onclick = () => { sigColor = b.dataset.c; document.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === b)); });
  $('sigTabs').onclick = (ev) => {
    const b = ev.target.closest('[data-t]'); if (!b) return;
    document.querySelectorAll('#sigTabs .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
    $('sigDraw').hidden = b.dataset.t !== 'draw'; $('sigUpload').hidden = b.dataset.t !== 'upload';
  };
  $('sigPick').onclick = () => $('sigImageInput').click();
  $('sigImageInput').onchange = async () => {
    const f = $('sigImageInput').files[0]; $('sigImageInput').value = '';
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
      const id = cx.getImageData(0, 0, cv.width, cv.height), d = id.data;
      for (let p = 0; p < d.length; p += 4) { const m = Math.min(d[p], d[p + 1], d[p + 2]); if (m > 225) d[p + 3] = 0; else if (m > 180) d[p + 3] = Math.round(d[p + 3] * (225 - m) / 45); }
      cx.putImageData(id, 0, 0);
      sigImage = trimCanvas(cv) || cv;
      $('sigPreview').src = sigImage.toDataURL('image/png'); $('sigPreview').hidden = false;
    } catch (e) { toast('تعذّر قراءة الصورة'); }
  };
  $('sigUse').onclick = async () => {
    const uploadMode = !$('sigUpload').hidden;
    const src = uploadMode ? sigImage : (sigDirty ? trimCanvas(c) : null);
    if (!src) { toast(uploadMode ? 'اختر صورة التوقيع أولًا' : 'ارسم توقيعك أولًا'); return; }
    $('sigDlg').close();
    startPlacing(await canvasToImage(src));
  };
}

// ---------- page numbers & watermark ----------
function bindStamps() {
  $('numBtn').onclick = () => {
    const n = (S.stamps && S.stamps.numbers) || { pos: 'bc', format: 'n', digits: 'latin', start: 1, size: 10, skipFirst: false };
    $('numPos').value = n.pos; $('numFormat').value = n.format; $('numDigits').value = n.digits;
    $('numStart').value = n.start; $('numSize').value = n.size; $('numSkip').checked = !!n.skipFirst;
    $('numRemove').hidden = !(S.stamps && S.stamps.numbers);
    $('numDlg').showModal();
  };
  $('numApply').onclick = () => {
    const numbers = { pos: $('numPos').value, format: $('numFormat').value, digits: $('numDigits').value, start: Math.max(0, parseInt($('numStart').value, 10) || 1), size: Math.min(36, Math.max(6, +$('numSize').value || 10)), skipFirst: $('numSkip').checked };
    $('numDlg').close();
    commit({ stamps: { ...(S.stamps || {}), numbers } });
  };
  $('numRemove').onclick = () => { $('numDlg').close(); commit({ stamps: { ...(S.stamps || {}), numbers: null } }); };
  $('wmBtn').onclick = () => {
    const w = (S.stamps && S.stamps.watermark) || { text: '', opacity: 0.15, angle: 45, color: '#808080' };
    $('wmText').value = w.text; $('wmOpacity').value = Math.round(w.opacity * 100); $('wmAngle').value = String(w.angle); $('wmColor').value = w.color;
    $('wmRemove').hidden = !(S.stamps && S.stamps.watermark);
    $('wmDlg').showModal();
  };
  $('wmApply').onclick = () => {
    const text = $('wmText').value.trim();
    if (!text) { toast('اكتب نص العلامة المائية'); return; }
    const watermark = { text, opacity: +$('wmOpacity').value / 100, angle: +$('wmAngle').value, color: $('wmColor').value };
    $('wmDlg').close();
    commit({ stamps: { ...(S.stamps || {}), watermark } });
  };
  $('wmRemove').onclick = () => { $('wmDlg').close(); commit({ stamps: { ...(S.stamps || {}), watermark: null } }); };
}

// ---------- toolbar events ----------
function bindEditorControls() {
  $('edApply').onclick = () => applyEdit();
  $('edCancel').onclick = () => closeEditor();
  $('edDelete').onclick = () => applyEdit(true);
  $('edSize').oninput = () => { if (!S.editing) return; const v = parseFloat($('edSize').value); if (v > 0) { S.editing.e.size = v; layoutTextEl(); } };
  $('edColor').oninput = () => { if (!S.editing) return; S.editing.e.color = $('edColor').value; S.editing.e.colorChanged = true; layoutTextEl(); };
  document.querySelectorAll('[data-align]').forEach((b) => b.onclick = () => {
    if (!S.editing) return;
    S.editing.e.align = b.dataset.align;
    document.querySelectorAll('[data-align]').forEach((x) => x.classList.toggle('active', x === b));
    layoutTextEl(); textEl.focus();
  });
  $('edFont').onchange = async () => {
    if (!S.editing) return;
    const v = $('edFont').value;
    if (v === '__upload') { $('edFont').value = S.editing.e.fontChoice; $('fontInput').click(); return; }
    if (v.startsWith('local:')) {
      const fd = lib.localFonts.find((f) => 'local:' + f.postscriptName === v);
      if (fd) await lib.fromLocal(fd);
    }
    S.editing.e.fontChoice = v;
    if (v.startsWith('bundled:')) S.editing.e.fallbackId = v.split(':')[1];
    updateStatus(); textEl.focus();
  };
  $('edStatus').onclick = async (ev) => {
    const act = ev.target.dataset && ev.target.dataset.act;
    if (act === 'local') { await lib.requestLocal(); updateLocalChip(); if (S.editing) { fontOptions(S.editing.e); updateStatus(); } }
    if (act === 'upload') $('fontInput').click();
  };
  $('fontInput').onchange = async () => {
    const f = $('fontInput').files[0]; $('fontInput').value = '';
    if (!f) return;
    try {
      const sf = lib.addUpload(new Uint8Array(await f.arrayBuffer()), f.name);
      toast('تمت إضافة الخط: ' + sf.sfnt.family);
      if (S.editing) {
        const e = S.editing.e;
        const matches = e.pdfFont && lib.findUpload(e.pdfFont.baseFont) === sf;
        e.fontChoice = matches ? 'auto' : sf.id;
        fontOptions(e); updateStatus();
      }
    } catch (err) { toast('ملف الخط غير صالح'); }
  };
  $('imgApply').onclick = applyPlacing;
  $('imgCancel').onclick = cancelPlacing;
  $('imgDelete').onclick = deletePlacing;
  $('sigBtn').onclick = () => { closeEditor(); cancelPlacing(); $('sigDlg').showModal(); };
  $('imgBtn').onclick = () => $('imageInput').click();
  $('imageInput').onchange = async () => {
    const f = $('imageInput').files[0]; $('imageInput').value = '';
    if (!f) return;
    try { startPlacing(await toImage(f)); } catch (e) { toast('تعذّر قراءة الصورة'); }
  };
}

function updateLocalChip() {
  const b = $('localBtn');
  if (!lib.localSupported) { b.textContent = 'خطوط الجهاز: غير مدعومة في هذا المتصفح'; b.disabled = true; b.title = 'استخدم Chrome أو Edge للاستفادة من خطوط جهازك'; return; }
  if (lib.localState === 'granted') { b.textContent = '✓ خطوط الجهاز مفعّلة'; b.classList.add('on'); }
  else if (lib.localState === 'denied') { b.textContent = 'خطوط الجهاز: مرفوضة'; b.classList.remove('on'); }
  else { b.textContent = 'تفعيل خطوط الجهاز'; b.classList.remove('on'); }
}

// quick=true resizes immediately (canvases stretch) and leaves sharp re-rendering for later
function setZoom(z, quick = false) {
  S.scale = Math.max(0.4, Math.min(4, z));
  if (S.editing) applyEdit();
  if (S.placing) applyPlacing();
  S.pageEls.forEach((el, i) => {
    const [pw, ph] = pageSize(i);
    const w = pw * S.scale, h = ph * S.scale;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    const c = el.querySelector('canvas');
    if (c) { c.style.width = w + 'px'; c.style.height = h + 'px'; }
    if (quick) return;
    delete el.dataset.rendered;
    const r = el.getBoundingClientRect();
    if (r.bottom > -600 && r.top < window.innerHeight + 600) renderPage(i, true);
  });
  if (quick) S.pageEls.forEach((el) => { const ov = el.querySelector('.overlay'); if (ov) ov.innerHTML = ''; });
  $('zoomLabel').textContent = Math.round(S.scale * 100) + '%';
}

function init() {
  const open = () => $('fileInput').click();
  $('openBtn').onclick = open; $('openBtn2').onclick = open;
  $('fileInput').onchange = () => { const f = $('fileInput').files[0]; $('fileInput').value = ''; openFile(f); };
  $('saveBtn').onclick = save;
  $('undo').onclick = doUndo; $('redo').onclick = doRedo;
  $('zoomIn').onclick = () => setZoom(S.scale * 1.2);
  $('zoomOut').onclick = () => setZoom(S.scale / 1.2);
  $('localBtn').onclick = async () => { await lib.requestLocal(); updateLocalChip(); if (lib.localState === 'denied') toast('لم يُسمح بالوصول لخطوط الجهاز. يمكنك تفعيله من إعدادات الموقع في المتصفح.'); };
  document.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => {
    S.mode = b.dataset.mode; closeEditor(); cancelPlacing();
    document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x === b));
    $('pages').classList.toggle('mode-edit', S.mode === 'edit');
    $('pages').classList.toggle('mode-add', S.mode === 'add');
  });
  const drop = $('drop');
  const isFileDrag = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  ['dragenter', 'dragover'].forEach((t) => document.addEventListener(t, (e) => { if (!isFileDrag(e)) return; e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => { if (!isFileDrag(e)) return; e.preventDefault(); drop.classList.remove('over'); }));
  document.addEventListener('drop', (e) => {
    if (!isFileDrag(e)) return;
    const files = [...e.dataTransfer.files].filter((f) => /pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (!files.length) return;
    if (S.orig && e.target.closest && e.target.closest('#sidebar')) mergeFiles(files); // drop on the page panel = merge
    else openFile(files[0]);
  });
  document.addEventListener('keydown', (e) => {
    if (S.editing || document.querySelector('dialog[open]')) return;
    if (S.placing) {
      if (e.key === 'Escape') cancelPlacing();
      if (e.key === 'Enter') applyPlacing();
      if (e.key === 'Delete') deletePlacing();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  window.addEventListener('resize', () => { if (S.editing) layoutTextEl(); else dockEditor(); layoutSidebar(); });
  // While editing text or placing an image, pressing anywhere outside applies it.
  document.addEventListener('pointerdown', (ev) => {
    if (!S.editing && !S.placing) return;
    if (ev.target.closest('.ed-text, #editor, .placer, #imgbar, dialog')) return;
    const inPage = !!ev.target.closest('#pages');
    if (S.editing) applyEdit(); else applyPlacing();
    if (inPage) {
      // just save; don't also start a new edit or add text with the same press
      ev.preventDefault(); ev.stopPropagation();
      const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 400);
    }
  }, true);
  // Ctrl + mouse wheel zooms around the pointer (plain wheel keeps scrolling)
  let wheelZoom = null;
  $('pages').addEventListener('wheel', (ev) => {
    if (!ev.ctrlKey || !S.libDoc) return;
    ev.preventDefault();
    const factor = Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0015));
    const old = S.scale;
    const next = Math.max(0.4, Math.min(4, old * factor));
    if (Math.abs(next - old) < 1e-3) return;
    const P = $('pages');
    const pr = P.getBoundingClientRect();
    const ox = ev.clientX - pr.left, oy = ev.clientY;
    const docX = P.scrollLeft + ox, docY = window.scrollY + oy;
    setZoom(next, true);
    const k = next / old;
    P.scrollLeft = docX * k - ox;
    window.scrollTo(window.scrollX, docY * k - oy);
    clearTimeout(wheelZoom);
    wheelZoom = setTimeout(() => setZoom(S.scale), 160);
  }, { passive: false });
  // drag empty page areas to pan (useful when zoomed in)
  const pagesEl = $('pages');
  let pan = null;
  pagesEl.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'mouse' || (ev.button !== 0 && ev.button !== 1)) return;
    if (S.editing || S.placing || ev.target.closest('.hot, .editbox, .imgbox, .ed-text, .placer')) return;
    pan = { x: ev.clientX, y: ev.clientY, sl: pagesEl.scrollLeft, sy: window.scrollY, moved: false, id: ev.pointerId };
  });
  window.addEventListener('pointermove', (ev) => {
    if (!pan || ev.pointerId !== pan.id) return;
    const dx = ev.clientX - pan.x, dy = ev.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 5) return;
    if (!pan.moved) { pan.moved = true; pagesEl.classList.add('panning'); }
    pagesEl.scrollLeft = pan.sl - dx;
    window.scrollTo(window.scrollX, pan.sy - dy);
  });
  window.addEventListener('pointerup', () => {
    if (pan && pan.moved) {
      // swallow the click that ends a drag so it doesn't add text
      const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
    }
    pan = null; pagesEl.classList.remove('panning');
  });
  window.addEventListener('beforeunload', (e) => { if (hasChanges()) { e.preventDefault(); e.returnValue = ''; } });
  bindEditorControls();
  bindThumbs();
  bindSignature();
  bindStamps();
  updateLocalChip();
  lib.init().catch((e) => console.error(e));
}
init();

// Test hook: open a PDF from a URL (used for local testing only).
window.__openUrl = async (url) => { const r = await fetch(url); const b = await r.blob(); await openFile(new File([b], url.split('/').pop())); };
window.__ops = { movePage, rotatePages, deletePages, insertBlank, mergeFiles, extractPages, startPlacing, applyPlacing, canvasToImage, buildFinal: () => buildFinal(snap()), commit };
