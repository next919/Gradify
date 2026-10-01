import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { analyzePage } from './analyze.js';
import { buildPdf, resolveEdit } from './engine.js';
import { FontLibrary, bundledList, visualToLogical, hasArabic, cleanBaseName, guessBundled } from './fonts.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.mjs';
const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
const LINE_GAP = 1.35;

const $ = (id) => document.getElementById(id);
const lib = new FontLibrary();
const S = {
  orig: null, name: 'document', libDoc: null, pdf: null, bytes: null,
  analyses: new Map(), edits: [], undo: [], redo: [],
  scale: 1, mode: 'edit', pageEls: [], rendering: new Map(), editing: null,
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
    S.orig = buf; S.libDoc = libDoc; S.name = file.name.replace(/\.pdf$/i, '');
    S.analyses.clear(); S.edits = []; S.undo = []; S.redo = [];
    await lib.init();
    await loadPdfjs(buf);
    const first = await S.pdf.getPage(1);
    const vp = first.getViewport({ scale: 1 });
    S.scale = Math.min(1.6, Math.max(0.5, (Math.min(window.innerWidth, 1100) - 48) / vp.width));
    $('empty').hidden = true; $('pages').hidden = false; $('tools').hidden = false; $('saveBtn').hidden = false;
    document.title = file.name + ' – محرر PDF العربي';
    buildPages();
    updateButtons();
  } catch (e) {
    console.error(e);
    toast('تعذّر فتح الملف: ' + e.message);
  } finally { busy(false); }
}

async function loadPdfjs(bytes) {
  if (S.pdf) S.pdf.destroy();
  S.bytes = bytes;
  S.pdf = await pdfjsLib.getDocument({
    data: bytes.slice(), cMapUrl: PDFJS_CDN + 'cmaps/', cMapPacked: true,
    standardFontDataUrl: PDFJS_CDN + 'standard_fonts/', isEvalSupported: false,
  }).promise;
}

function analysis(pi) {
  if (!S.analyses.has(pi)) {
    let a;
    try { a = analyzePage(S.libDoc, pi); } catch (e) { console.warn('analyze', e); a = { runs: [], lines: [] }; }
    S.analyses.set(pi, a);
  }
  return S.analyses.get(pi);
}

// ---------- page rendering ----------
let observer = null;
function buildPages() {
  const wrap = $('pages');
  wrap.innerHTML = '';
  S.pageEls = [];
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) renderPage(+en.target.dataset.page);
  }, { rootMargin: '600px 0px' });
  const libPages = S.libDoc.getPages();
  libPages.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'page';
    el.dataset.page = i;
    const { width, height } = p.getSize();
    const rot = (p.getRotation().angle % 180) !== 0;
    el.style.width = (rot ? height : width) * S.scale + 'px';
    el.style.height = (rot ? width : height) * S.scale + 'px';
    el.innerHTML = `<canvas></canvas><div class="overlay"></div><span class="num">${i + 1} / ${libPages.length}</span>`;
    el.querySelector('.overlay').addEventListener('click', (ev) => onOverlayClick(ev, i));
    wrap.appendChild(el);
    S.pageEls.push(el);
    observer.observe(el);
  });
  wrap.classList.toggle('mode-edit', S.mode === 'edit');
  wrap.classList.toggle('mode-add', S.mode === 'add');
  $('zoomLabel').textContent = Math.round(S.scale * 100) + '%';
}

async function renderPage(pi, force = false) {
  const el = S.pageEls[pi];
  if (!el) return;
  if (!force && el.dataset.rendered === String(S.scale) + ':' + S.pdfVersion) return;
  if (S.rendering.get(pi)) { S.rendering.get(pi).cancel(); }
  const page = await S.pdf.getPage(pi + 1);
  const vp = page.getViewport({ scale: S.scale });
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
  canvas.style.width = vp.width + 'px'; canvas.style.height = vp.height + 'px';
  el.style.width = vp.width + 'px'; el.style.height = vp.height + 'px';
  const task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] });
  S.rendering.set(pi, task);
  try { await task.promise; } catch (e) { if (e && e.name === 'RenderingCancelledException') return; throw e; }
  S.rendering.delete(pi);
  el.querySelector('canvas').replaceWith(canvas);
  el.dataset.rendered = String(S.scale) + ':' + S.pdfVersion;
  el._vp = vp;
  drawOverlay(pi);
}

function rectOf(vp, x0, y0, x1, y1) {
  const r = vp.convertToViewportRectangle([x0, y0, x1, y1]);
  return { left: Math.min(r[0], r[2]), top: Math.min(r[1], r[3]), width: Math.abs(r[2] - r[0]), height: Math.abs(r[3] - r[1]) };
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

function drawOverlay(pi) {
  const el = S.pageEls[pi];
  const vp = el._vp; if (!vp) return;
  const ov = el.querySelector('.overlay');
  ov.innerHTML = '';
  const an = analysis(pi);
  const editedLines = new Set(S.edits.filter((e) => e.page === pi && e.lineId).map((e) => e.lineId));
  for (const l of an.lines) {
    if (editedLines.has(l.id)) continue;
    const d = document.createElement('div');
    d.className = 'hot';
    place(d, rectOf(vp, ...lineBox(l)));
    d.title = 'اضغط للتعديل';
    d.addEventListener('click', (ev) => { if (S.mode !== 'edit') return; ev.stopPropagation(); startEditLine(pi, l); });
    ov.appendChild(d);
  }
  for (const e of S.edits.filter((x) => x.page === pi && x.text)) {
    const d = document.createElement('div');
    d.className = 'editbox';
    place(d, rectOf(vp, ...editBox(e)));
    d.title = 'اضغط لتعديل هذا النص';
    d.addEventListener('click', (ev) => { ev.stopPropagation(); startEditExisting(e); });
    ov.appendChild(d);
  }
}

// ---------- editing ----------
async function ensureLocalFonts() {
  if (lib.localState === 'unknown' && lib.localSupported) {
    await lib.requestLocal();
    updateLocalChip();
  }
}

function startEditLine(pi, line) {
  const before = lib.localState;
  ensureLocalFonts().then(() => {
    if (before !== lib.localState && S.editing) { fontOptions(S.editing.e); updateStatus(); }
  });
  const text = visualToLogical(line.visual);
  openEditor({
    id: 'e' + Date.now(), page: pi, type: 'edit', lineId: line.id, removeRuns: line.runIds,
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
function onOverlayClick(ev, pi) {
  if (S.mode !== 'add' || S.editing) return;
  const el = S.pageEls[pi];
  const r = el.getBoundingClientRect();
  const [x, y] = el._vp.convertToPdfPoint(ev.clientX - r.left, ev.clientY - r.top);
  const size = 14;
  openEditor({
    id: 'e' + Date.now(), page: pi, type: 'add', text: '', size, color: '#000000', colorChanged: true,
    align: 'right', rtl: true, x0: x, x1: x, baseline: y - size * 0.8, fontChoice: 'bundled:amiri',
  }, true);
}
const round2 = (v) => Math.round(v * 100) / 100;

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
  closeEditor();
  S.editing = { e, isNew };
  const el = S.pageEls[e.page];
  const vp = el._vp;
  const ov = el.querySelector('.overlay');
  // cover the original text while typing
  if (e.cover || !isNew) {
    coverEl = document.createElement('div');
    coverEl.className = 'cover';
    const box = e.cover || editBox(e);
    const r = rectOf(vp, ...box);
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
  // toolbar
  fontOptions(e);
  $('edSize').value = e.size;
  $('edColor').value = e.color || '#000000';
  document.querySelectorAll('[data-align]').forEach((b) => b.classList.toggle('active', b.dataset.align === e.align));
  $('edDelete').hidden = isNew && e.type === 'add';
  $('editor').hidden = false;
  layoutTextEl();
  // keep the text box clear of the docked toolbar
  keepVisible();
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

let previewFaces = new Map();
async function previewFamily(sf) {
  if (!sf) return null;
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
  const el = S.pageEls[e.page];
  const vp = el._vp;
  const px = e.size * S.scale;
  const lines = (textEl.value || ' ').split('\n');
  textEl.style.fontSize = px + 'px';
  textEl.style.lineHeight = LINE_GAP;
  textEl.style.color = e.color || '#000';
  textEl.style.textAlign = e.align === 'center' ? 'center' : e.align;
  // measure
  const meas = document.createElement('span');
  meas.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-size:${px}px;font-family:${textEl.style.fontFamily || 'inherit'}`;
  document.body.appendChild(meas);
  let w = 0;
  for (const l of lines) { meas.textContent = l || ' '; w = Math.max(w, meas.getBoundingClientRect().width); }
  meas.remove();
  w = Math.max(w + px * 0.6, 40);
  const [ax, ay] = vp.convertToViewportPoint(e.align === 'left' ? e.x0 : e.align === 'center' ? (e.x0 + e.x1) / 2 : e.x1, e.baseline);
  let left = e.align === 'left' ? ax : e.align === 'center' ? ax - w / 2 : ax - w;
  const h = lines.length * px * LINE_GAP;
  const top = ay - px * 1.05 - (lines.length - 1) * px * LINE_GAP;
  Object.assign(textEl.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
  dockEditor();
}

// Keep the text box clear of the docked toolbar: scroll, or push the pages down near the top.
function keepVisible() {
  if (!textEl) return;
  const edBottom = $('editor').getBoundingClientRect().bottom;
  let tr = textEl.getBoundingClientRect();
  if (tr.top < edBottom + 12) window.scrollBy(0, tr.top - edBottom - 24);
  tr = textEl.getBoundingClientRect();
  if (tr.top < edBottom + 12) {
    const cur = parseFloat(getComputedStyle($('pages')).paddingTop) || 0;
    $('pages').style.paddingTop = Math.ceil(cur + edBottom + 24 - tr.top) + 'px';
  }
}
new ResizeObserver(() => { if (S.editing) { dockEditor(); keepVisible(); } }).observe(document.getElementById('editor'));

// The edit toolbar sits fixed under the header so it never covers the text being edited.
function dockEditor() {
  const ed = $('editor');
  const bar = document.querySelector('.bar');
  ed.style.top = bar.getBoundingClientRect().bottom + 'px';
  document.body.style.setProperty('--ed-h', ed.hidden ? '0px' : ed.offsetHeight + 'px');
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
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function closeEditor() {
  if (textEl) textEl.remove();
  if (coverEl) coverEl.remove();
  textEl = coverEl = null;
  S.editing = null;
  $('pages').style.paddingTop = '';
  $('editor').hidden = true;
  document.body.style.setProperty('--ed-h', '0px');
}

async function applyEdit(del = false) {
  if (!S.editing) return;
  const { e, isNew } = S.editing;
  e.text = del ? '' : textEl.value.replace(/\s+$/g, '');
  if (isNew && e.type === 'edit' && e.text === e.original && !del) { closeEditor(); return; }
  if (isNew && e.type === 'add' && !e.text) { closeEditor(); return; }
  const next = S.edits.filter((x) => x.id !== e.id);
  if (e.type === 'add' && !e.text) { /* removing an added text */ }
  else next.push({ ...e });
  closeEditor();
  await commit(next);
}

function commit(nextEdits, fromHistory = false) {
  S.pending = (S.pending || Promise.resolve()).then(() => doCommit(nextEdits, fromHistory));
  return S.pending;
}

async function doCommit(nextEdits, fromHistory = false) {
  busy(true);
  try {
    const bytes = await buildPdf(S.orig, clone(nextEdits), lib);
    if (!fromHistory) { S.undo.push(S.edits); S.redo = []; }
    S.edits_prev = S.edits;
    S.edits = nextEdits;
    await loadPdfjs(bytes);
    S.pdfVersion = (S.pdfVersion || 0) + 1;
    const pages = new Set([...nextEdits, ...S.edits_prev].map((e) => e.page));
    await Promise.all([...pages].map((p) => renderPage(p, true)));
  } catch (err) {
    console.error(err);
    toast('حدث خطأ أثناء تطبيق التعديل: ' + err.message);
  } finally { busy(false); updateButtons(); }
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
}

function updateLocalChip() {
  const b = $('localBtn');
  if (!lib.localSupported) { b.textContent = 'خطوط الجهاز: غير مدعومة في هذا المتصفح'; b.disabled = true; b.title = 'استخدم Chrome أو Edge للاستفادة من خطوط جهازك'; return; }
  if (lib.localState === 'granted') { b.textContent = '✓ خطوط الجهاز مفعّلة'; b.classList.add('on'); }
  else if (lib.localState === 'denied') { b.textContent = 'خطوط الجهاز: مرفوضة'; b.classList.remove('on'); }
  else { b.textContent = 'تفعيل خطوط الجهاز'; b.classList.remove('on'); }
}

function updateButtons() {
  $('undo').disabled = !S.undo.length;
  $('redo').disabled = !S.redo.length;
}

async function doUndo() { closeEditor(); if (S.pending) await S.pending; if (!S.undo.length) return; S.redo.push(S.edits); await commit(S.undo.pop(), true); }
async function doRedo() { closeEditor(); if (S.pending) await S.pending; if (!S.redo.length) return; S.undo.push(S.edits); await commit(S.redo.pop(), true); }

async function save() {
  if (!S.orig) return;
  if (S.editing) await applyEdit();
  if (S.pending) await S.pending;
  busy(true);
  try {
    const bytes = S.edits.length ? await buildPdf(S.orig, clone(S.edits), lib) : S.orig;
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = S.name + (S.edits.length ? '-edited' : '') + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  } catch (err) { console.error(err); toast('تعذّر الحفظ: ' + err.message); }
  finally { busy(false); }
}

// quick=true resizes immediately (canvases stretch) and leaves sharp re-rendering for later
function setZoom(z, quick = false) {
  S.scale = Math.max(0.4, Math.min(4, z));
  if (S.editing) applyEdit();
  const libPages = S.libDoc.getPages();
  S.pageEls.forEach((el, i) => {
    const p = libPages[i];
    const { width, height } = p.getSize();
    const rot = (p.getRotation().angle % 180) !== 0;
    const w = (rot ? height : width) * S.scale, h = (rot ? width : height) * S.scale;
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
    S.mode = b.dataset.mode; closeEditor();
    document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x === b));
    $('pages').classList.toggle('mode-edit', S.mode === 'edit');
    $('pages').classList.toggle('mode-add', S.mode === 'add');
  });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  document.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) openFile(f); });
  document.addEventListener('keydown', (e) => {
    if (S.editing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  window.addEventListener('resize', () => { if (S.editing) layoutTextEl(); else dockEditor(); });
  // While editing, pressing anywhere outside the text box and toolbar applies the edit.
  document.addEventListener('pointerdown', (ev) => {
    if (!S.editing) return;
    if (ev.target.closest('.ed-text, #editor')) return;
    const inPage = !!ev.target.closest('#pages');
    applyEdit();
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
    if (S.editing || ev.target.closest('.hot, .editbox, .ed-text')) return;
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
  window.addEventListener('beforeunload', (e) => { if (S.edits.length) { e.preventDefault(); e.returnValue = ''; } });
  bindEditorControls();
  updateLocalChip();
  lib.init().catch((e) => console.error(e));
  void guessBundled;
}
init();

// Test hook: open a PDF from a URL (used for local testing only).
window.__openUrl = async (url) => { const r = await fetch(url); const b = await r.blob(); await openFile(new File([b], url.split('/').pop())); };
