// Applies text edits to a PDF without rasterising anything.
import { analyzePage, pageFonts, winAnsiEncode } from './analyze.js';
import { blankFor, splice, fmt } from './content.js';
import { ShapeFont, layoutLine, needsShaping, hasArabic, guessBundled, isBoldName, cleanBaseName, subsetTrueType, bundledList, visualRuns, styleClass, VISUAL_ORDER_MARK, NO_TEXT, toVisualCluster } from './fonts.js';

const { PDFDocument, PDFName, degrees } = window.PDFLib;

const LINE_GAP = 1.35;

// Build a ShapeFont over the subset embedded in the PDF (cached per font object).
function embeddedShapeFont(lib, pdfFont) {
  if (!pdfFont || !pdfFont.sfnt || pdfFont.sfnt.isCFF) return null;
  const key = 'pdf:' + pdfFont.key + ':' + pdfFont.baseFont;
  if (lib.shapeFonts.has(key)) return lib.shapeFonts.get(key);
  let sf = null;
  try { sf = new ShapeFont(lib.hb, pdfFont.fontBytes, { id: key, source: 'pdf', label: cleanBaseName(pdfFont.baseFont) }); } catch (e) { sf = null; }
  lib.shapeFonts.set(key, sf);
  return sf;
}

// Lays out Latin text with a PDF simple font's own widths (no font file needed).
class PdfWidthFont {
  constructor(pdfFont, key) {
    this.pdfFont = pdfFont; this.id = 'pdfw:' + key + ':' + pdfFont.baseFont; this.upem = 1000;
    this.source = 'pdf'; this.label = cleanBaseName(pdfFont.baseFont); this.sfnt = { family: this.label };
  }
  covers(ch) { return winAnsiEncode(ch) >= 0; }
  gidFor(ch) { return winAnsiEncode(ch); }
  shape(text, dir) {
    const out = [...text].map((ch, i) => { const c = winAnsiEncode(ch); return { g: c < 0 ? 0 : c, cl: i, ax: c < 0 ? 0 : this.pdfFont.width(c), ay: 0, dx: 0, dy: 0 }; });
    return dir === 'rtl' ? out.reverse() : out;
  }
}

// Look-alike fonts shipped with Windows, tried when the original font is missing.
const SIMILAR = [
  [/adobearabic/, ['ArabicTypesetting', 'TraditionalArabic'], ['TraditionalArabic-Bold', 'SakkalMajalla-Bold']],
  [/traditionalarabic|lotus|badr|mitra|nazanin|kfgqpc|uthman/, ['TraditionalArabic', 'ArabicTypesetting'], ['TraditionalArabic-Bold']],
  [/simplifiedarabic|naskh|times/, ['SimplifiedArabic', 'TimesNewRomanPSMT'], ['SimplifiedArabic-Bold', 'TimesNewRomanPS-BoldMT']],
  [/majalla/, ['SakkalMajalla'], ['SakkalMajalla-Bold']],
  [/helvetica|arial|geezapro/, ['ArialMT'], ['Arial-BoldMT']],
  [/tahoma|segoe|dubai|frutiger|myriad/, ['Tahoma', 'SegoeUI'], ['Tahoma-Bold', 'SegoeUI-Bold']],
];
function similarLocal(lib, baseName, bold) {
  if (!lib.localFonts) return null;
  const n = baseName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [re, reg, bld] of SIMILAR) {
    if (!re.test(n)) continue;
    for (const ps of bold ? [...bld, ...reg] : reg) {
      const fd = lib.localFonts.find((f) => f.postscriptName === ps);
      if (fd) return fd;
    }
  }
  return null;
}

// Metric-compatible stand-ins for the PDF standard fonts.
function metricAlias(name, bold) {
  const n = name.toLowerCase();
  const b = bold || /bold/.test(n);
  if (/helvetica|arial/.test(n)) return b ? 'Arial-BoldMT' : 'ArialMT';
  if (/times/.test(n)) return b ? 'TimesNewRomanPS-BoldMT' : 'TimesNewRomanPSMT';
  if (/courier/.test(n)) return b ? 'CourierNewPS-BoldMT' : 'CourierNewPSMT';
  return name;
}

const isBlank = (ch) => /\s|[​-‏؜]/.test(ch || '');

// Can this laid-out text be drawn with the font already inside the PDF?
function reuseTarget(pdfFont, fontKey, sfFromPdf, layout, lines) {
  if (!pdfFont || !pdfFont.sfnt) return null;
  const sub = pdfFont.sfnt;
  if (pdfFont.isType0) {
    if (!pdfFont.cidToGidIdentity || (pdfFont.encoding !== 'Identity-H')) return null;
    for (const L of layout) for (const g of L.glyphs) {
      if (!sub.hasGlyph(g.gid) && !isBlank(g.uni)) return null;
      if (g.gid >= sub.numGlyphs) return null;
    }
    return { kind: 'reuse', fontKey, pdfFont, code: (g) => g.gid, hex: (c) => c.toString(16).padStart(4, '0'), width: (c) => pdfFont.width(c) };
  }
  if (pdfFont.subtype === 'TrueType' && /WinAnsi/.test(pdfFont.encoding) && sfFromPdf) {
    const text = lines.join('');
    if (hasArabic(text)) return null;
    for (const ch of text) {
      const c = winAnsiEncode(ch);
      if (c < 0 || pdfFont.width(c) <= 0) return null;
      if (!isBlank(ch) && !sub.hasGlyph(sfFromPdf.gidFor(ch))) return null;
    }
    return { kind: 'reuse-simple', fontKey, pdfFont, width: (c) => pdfFont.width(c), hex: (c) => c.toString(16).padStart(2, '0') };
  }
  return null;
}

// Do the glyph ids of a full font match those used in the PDF subset?
function sameGlyphIds(full, sfFromPdf, pdfFont) {
  if (!sfFromPdf || !pdfFont.sfnt) return false;
  if (full.sfnt.numGlyphs !== pdfFont.sfnt.numGlyphs) return false;
  let checked = 0;
  for (const [, uni] of pdfFont.toUni) {
    if (!uni || uni.length !== 1 || /\s/.test(uni)) continue;
    const a = full.gidFor(uni), b = sfFromPdf.gidFor(uni);
    if (b && a !== b) return false;
    if (b) checked++;
    if (checked >= 12) break;
  }
  return checked > 0;
}

// Decide which fonts render an edit. Returns {fonts:[ShapeFont], layout, targets:Map(sf.id->target), status}
export async function resolveEdit(edit, lib) {
  const r = await resolveMulti(edit, lib) || await resolveInner(edit, lib);
  r.status.missing = r.layout.some((L) => L.missing);
  return r;
}

// A line that mixes styles (e.g. Arabic label + Latin value in another font/size):
// resolve each style on its own so every part keeps its original font, size and colour.
async function resolveMulti(edit, lib) {
  const styles = edit.styles;
  if (!styles || edit.fontChoice !== 'auto' || !edit.baseSize) return null;
  const keys = Object.keys(styles);
  const distinct = new Set(keys.map((k) => styles[k].fontKey + '|' + Math.round(styles[k].size * 10)));
  if (distinct.size < 2) return null;
  const dir = edit.dir || (hasArabic(edit.text) || edit.rtl ? 'rtl' : 'ltr');
  const lines = (edit.text || '').split('\n');
  const fallbackKey = (k) => (styles[k] ? k : k === 'num' && styles.la ? 'la' : k === 'la' && styles.num ? 'num' : edit.mainKey && styles[edit.mainKey] ? edit.mainKey : keys[0]);
  const parts = {};
  for (const t of lines) for (const run of visualRuns(t, dir)) {
    const k = fallbackKey(styleClass(run.text) || edit.mainKey || keys[0]);
    parts[k] = (parts[k] || '') + run.text + ' ';
  }
  const per = {};
  for (const k of Object.keys(parts)) {
    const st = styles[k];
    const sub = await resolveInner({ ...edit, styles: null, text: parts[k].trim() || ' ', pdfFont: st.font, fontKey: st.fontKey, fill: st.fill }, lib);
    per[k] = { fonts: sub.layout.fonts, targets: sub.targets, status: sub.status, scale: st.size / edit.baseSize, fill: st.fill };
  }
  const styleOf = (runText) => {
    const k = fallbackKey(styleClass(runText) || edit.mainKey || keys[0]);
    const p = per[k] || Object.values(per)[0];
    return { fonts: p.fonts, scale: p.scale, key: per[k] ? k : Object.keys(per)[0] };
  };
  const layout = lines.map((t) => layoutLine(t, dir, null, styleOf));
  for (const L of layout) for (const g of L.glyphs) {
    const p = per[g.key];
    g.target = p.targets.get(g.font.id) || { kind: 'embed' };
    g.fill = p.fill;
  }
  const order = ['ar', 'la', 'num'].filter((k) => per[k]);
  const statuses = order.map((k) => ({ ...per[k].status, part: k }));
  const bad = statuses.find((x) => x.kind === 'fallback' || x.kind === 'mixed' || x.kind === 'similar');
  return { layout, targets: new Map(), status: { ...(bad || statuses[0]), parts: statuses } };
}

async function resolveInner(edit, lib) {
  const lines = (edit.text || '').split('\n');
  const pdfFont = edit.pdfFont || null;
  const baseName = pdfFont ? cleanBaseName(pdfFont.baseFont) : '';
  const bold = edit.bold != null ? edit.bold : pdfFont ? pdfFont.bold || isBoldName(baseName) : false;
  const dir = edit.dir || (hasArabic(edit.text) || edit.rtl ? 'rtl' : 'ltr');
  const fallback = await lib.bundled(edit.fallbackId || guessBundled(baseName), bold);
  let extras = null;
  const extraFonts = async () => {
    if (!extras) {
      extras = [];
      for (const b of bundledList) extras.push(await lib.bundled(b.id, bold));
      for (const ps of ['SegoeUISymbol', 'SegoeUI', 'ArialUnicodeMS', 'Tahoma']) {
        const fd = lib.localFonts && lib.localFonts.find((f) => f.postscriptName === ps);
        if (fd) extras.push(await lib.fromLocal(fd));
      }
    }
    return extras;
  };
  const layRaw = (fonts) => { const out = lines.map((t) => layoutLine(t, dir, fonts)); out.fonts = fonts; return out; };
  let lay = layRaw;
  if (layRaw([fallback]).some((L) => L.missing)) {
    const ex = await extraFonts();
    lay = (fonts) => layRaw([...fonts, ...ex.filter((f) => !fonts.includes(f))]);
  }
  const choice = edit.fontChoice || 'auto';
  const targets = new Map();
  const embedT = { kind: 'embed' };
  const sfPdf = pdfFont ? embeddedShapeFont(lib, pdfFont) : null;

  const tryFull = (full, how) => {
    const layout = lay([full, fallback]);
    const usedFull = layout.every((L) => L.fonts.every((f) => f === full));
    if (pdfFont && usedFull && sameGlyphIds(full, sfPdf, pdfFont)) {
      const t = reuseTarget(pdfFont, edit.fontKey, sfPdf, layout, lines);
      if (t) { targets.set(full.id, t); return { layout, targets, status: { kind: 'original', font: baseName, how } }; }
    }
    targets.set(full.id, embedT); targets.set(fallback.id, embedT);
    return { layout, targets, status: { kind: usedFull ? 'same' : 'mixed', font: full.sfnt.family, how, fallback: fallback.label } };
  };

  if (choice === 'auto' && pdfFont) {
    // 1. Original embedded font, when no Arabic joining is needed
    if (sfPdf && !needsShaping(edit.text)) {
      const layout = lay([sfPdf]);
      const t = reuseTarget(pdfFont, edit.fontKey, sfPdf, layout, lines);
      if (t && layout.every((L) => !L.missing && L.fonts.every((f) => f === sfPdf))) { targets.set(sfPdf.id, t); return { layout, targets, status: { kind: 'original', font: baseName, how: 'pdf' } }; }
    }
    // 1b. Standard font the PDF never embedded (e.g. Helvetica): keep using it as-is,
    // positioned with the PDF's own (or the official standard) widths.
    if (!pdfFont.fontBytes && !pdfFont.isType0 && pdfFont.subtype !== 'Type3' && !hasArabic(edit.text)
      && [...edit.text.replace(/\n/g, '')].every((ch) => winAnsiEncode(ch) >= 0)
      && (pdfFont.std || pdfFont.widths.length)) {
      const pw = new PdfWidthFont(pdfFont, edit.fontKey);
      const layout = lay([pw]);
      if (layout.every((L) => L.fonts.every((f) => f === pw))) {
        targets.set(pw.id, { kind: 'reuse-simple', fontKey: edit.fontKey, pdfFont, width: (c) => pdfFont.width(c), hex: (c) => c.toString(16).padStart(2, '0') });
        return { layout, targets, status: { kind: 'original', font: baseName, how: 'standard' } };
      }
    }
    // 2. Same font from this device
    const fd = lib.findLocal(pdfFont.baseFont);
    if (fd) {
      const full = await lib.fromLocal(fd);
      return tryFull(full, 'local');
    }
    // 3. Uploaded by the user
    const up = lib.findUpload(pdfFont.baseFont);
    if (up) return tryFull(up, 'upload');
  }
  if (choice === 'auto' && pdfFont) {
    // 4. A similar-looking font installed on this device
    const sim = similarLocal(lib, baseName, bold);
    if (sim) {
      const full = await lib.fromLocal(sim);
      const layout = lay([full, fallback]);
      targets.set(full.id, embedT); targets.set(fallback.id, embedT);
      return { layout, targets, status: { kind: 'similar', font: full.sfnt.family, wanted: baseName } };
    }
  }
  if (choice !== 'auto' && choice !== 'original') {
    const sf = lib.byId(choice) || (choice.startsWith('bundled:') ? await lib.bundled(choice.split(':')[1], bold) : null);
    if (sf) {
      const layout = lay([sf, fallback]);
      targets.set(sf.id, embedT); targets.set(fallback.id, embedT);
      return { layout, targets, status: { kind: 'chosen', font: sf.label || sf.sfnt.family } };
    }
  }
  if (choice === 'original' && sfPdf) {
    const layout = lay([sfPdf, fallback]);
    const t = reuseTarget(pdfFont, edit.fontKey, sfPdf, layout.map((L) => ({ glyphs: L.glyphs.filter((g) => g.font === sfPdf) })), lines);
    if (t) { targets.set(sfPdf.id, t); targets.set(fallback.id, embedT); return { layout, targets, status: { kind: 'original', font: baseName, how: 'pdf' } }; }
  }
  // 4. Closest bundled font
  const layout = lay([fallback]);
  targets.set(fallback.id, embedT);
  return { layout, targets, status: { kind: pdfFont ? 'fallback' : 'chosen', font: fallback.label, wanted: baseName } };
}

function colorOps(edit, g) {
  const fill = !edit.colorChanged && g && g.fill ? g.fill : !edit.colorChanged ? edit.fill : null;
  if (fill) return `${fill.vals.map(fmt).join(' ')} ${fill.op}`;
  const h = (edit.color || '#000000').replace('#', '');
  const v = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255);
  return `${v.map(fmt).join(' ')} rg`;
}

const targetOf = (res, g) => g.target || res.targets.get(g.font.id) || { kind: 'embed' };

// Produce the content-stream operators for one edit.
function emitEdit(edit, res, fontName, gsName) {
  const fs = edit.size;
  let out = 'q ';
  // frame: maps the edit's local (visual) coordinates to page user space, for rotated pages and watermarks
  if (edit.frame) out += `${edit.frame.map(fmt).join(' ')} cm `;
  if (gsName) out += `/${gsName} gs `;
  out += 'BT ';
  let curColor = null;
  res.layout.forEach((L, li) => {
    const w = L.width * fs;
    const y = edit.baseline - li * fs * LINE_GAP;
    let xs;
    if (edit.align === 'left') xs = edit.x0;
    else if (edit.align === 'center') xs = (edit.x0 + edit.x1) / 2 - w / 2;
    else xs = edit.x1 - w;
    let cur = null; // {name, size, y, x}
    let tj = [];
    const flush = () => { if (tj.length) out += `[${tj.join(' ')}] TJ `; tj = []; };
    for (const g of L.glyphs) {
      const t = targetOf(res, g);
      const gfs = fs * (g.scale || 1);
      const X = xs + g.x * fs, Y = y + g.y * fs;
      let code, hex, wid;
      if (t.kind === 'reuse') { code = t.code(g); hex = t.hex(code); wid = t.width(code); }
      else if (t.kind === 'reuse-simple') { code = winAnsiEncode(g.uni || ' '); if (code < 0) code = 32; hex = t.hex(code); wid = t.width(code); }
      else { const e = res.embed(g.font, g); code = g.gid; hex = code.toString(16).padStart(4, '0'); wid = e.width; }
      const name = fontName(g.font, t);
      const color = colorOps(edit, g);
      const newFont = !cur || cur.name !== name || Math.abs(cur.size - gfs) > 1e-3;
      if (newFont || Math.abs(cur.y - Y) > 1e-3 || color !== curColor) {
        flush();
        if (color !== curColor) { out += color + ' '; curColor = color; }
        if (newFont) out += `/${name} ${fmt(gfs)} Tf `;
        out += `1 0 0 1 ${fmt(X)} ${fmt(Y)} Tm `;
        cur = { name, size: gfs, y: Y, x: X };
      } else {
        const adj = ((cur.x - X) * 1000) / gfs;
        if (Math.abs(adj) > 0.01) tj.push(fmt(adj));
      }
      tj.push(`<${hex}>`);
      cur.x = X + (wid * gfs) / 1000;
    }
    flush();
  });
  return out + 'ET Q\n';
}

export async function buildPdf(originalBytes, edits, lib) {
  const doc = await PDFDocument.load(originalBytes, { updateMetadata: false, ignoreEncryption: false });
  const ctx = doc.context;
  const embedded = new Map(); // sf.id -> {sf, ref, glyphs: Map gid->uni}
  const byPage = new Map();
  for (const e of edits) { if (!byPage.has(e.page)) byPage.set(e.page, []); byPage.get(e.page).push(e); }

  const images = new Map(); // imgId -> embedded image
  for (const [pi, allEdits] of byPage) {
    const page = doc.getPage(pi);
    const pageEdits = allEdits.filter((e) => e.type !== 'image');
    const imageEdits = allEdits.filter((e) => e.type === 'image');
    if (pageEdits.length) await applyTextEdits(doc, pi, page, pageEdits, lib, embedded);
    for (const e of imageEdits) {
      let img = images.get(e.imgId);
      if (!img) {
        img = e.imgType === 'jpg' ? await doc.embedJpg(e.imgBytes) : await doc.embedPng(e.imgBytes);
        images.set(e.imgId, img);
      }
      page.drawImage(img, { x: e.x, y: e.y, width: e.w, height: e.h, rotate: degrees(e.angle || 0) });
    }
  }

  for (const ent of embedded.values()) writeType0(doc, ent);
  return doc.save({ useObjectStreams: false });
}

async function applyTextEdits(doc, pi, page, pageEdits, lib, embedded) {
  const ctx = doc.context;
  {
    const an = analyzePage(doc, pi);
    const fontsOf = pageFonts(doc, page);
    const reps = [];
    const removed = new Set();
    for (const e of pageEdits) for (const id of e.removeRuns || []) {
      if (removed.has(id)) continue;
      const r = an.runs[id];
      if (r) { reps.push({ s: r.s, e: r.e, text: blankFor(r) }); removed.add(id); }
    }
    const newContent = splice(an.bytes, reps);
    page.node.normalize();
    const names = new Map();
    const fontName = (sf, t) => {
      if (t.kind !== 'embed') return t.fontKey;
      if (!names.has(sf.id)) {
        const ent = embedded.get(sf.id);
        names.set(sf.id, page.node.newFontDictionary('NdF', ent.ref).decodeText());
      }
      return names.get(sf.id);
    };
    let additions = '';
    const gsNames = new Map();
    const gsFor = (op) => {
      if (op == null || op >= 1) return null;
      if (!gsNames.has(op)) {
        const gs = ctx.obj({ Type: 'ExtGState', ca: op, CA: op });
        gsNames.set(op, page.node.newExtGState('NdGS', ctx.register(gs)).decodeText());
      }
      return gsNames.get(op);
    };
    for (const e of pageEdits) {
      if (!e.text || !e.text.trim()) continue;
      if (e.fontKey) e.pdfFont = fontsOf(e.fontKey) || e.pdfFont;
      const res = await resolveEdit(e, lib);
      res.embed = (sf, g) => {
        if (!embedded.has(sf.id)) embedded.set(sf.id, { sf, ref: ctx.nextRef(), glyphs: new Map() });
        const ent = embedded.get(sf.id);
        if (!ent.glyphs.has(g.gid) || (!ent.glyphs.get(g.gid) && g.uni)) ent.glyphs.set(g.gid, g.uni);
        return { width: Math.round((sf.sfnt.advance(g.gid) * 1000) / sf.upem) };
      };
      // allocate refs before names are requested
      res.layout.forEach((L) => L.glyphs.forEach((g) => { if (targetOf(res, g).kind === 'embed') res.embed(g.font, g); }));
      additions += emitEdit(e, res, fontName, gsFor(e.opacity));
    }
    const s1 = ctx.flateStream(concatBytes(new TextEncoder().encode('q\n'), newContent, new TextEncoder().encode('\nQ\n')));
    const s2 = ctx.flateStream(new TextEncoder().encode(additions));
    page.node.set(PDFName.of('Contents'), ctx.obj([ctx.register(s1), ctx.register(s2)]));
  }
}

// ---------- page operations ----------
const INHERITED = ['Resources', 'MediaBox', 'CropBox', 'Rotate'];

// Reorder / drop / rotate pages. plan = [{o: sourceIndex, rot: 0|90|180|270}]
export async function assemble(bytes, plan) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = doc.getPages();
  // pin inherited attributes on each page so moving it in the tree keeps its size, rotation and resources
  for (const pg of pages) for (const k of INHERITED) {
    const name = PDFName.of(k);
    if (!pg.node.get(name)) { const v = pg.node.getInheritableAttribute(name); if (v) pg.node.set(name, v); }
  }
  for (let i = pages.length - 1; i >= 0; i--) doc.removePage(i);
  plan.forEach((p, i) => {
    const pg = pages[p.o];
    doc.insertPage(i, pg);
    if (p.rot) pg.setRotation(degrees((((pg.getRotation().angle + p.rot) % 360) + 360) % 360));
  });
  return doc.save({ useObjectStreams: false });
}

// Append all pages of another PDF; returns new bytes and how many pages were added.
export async function appendPdf(bytes, otherBytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const other = await PDFDocument.load(otherBytes, { updateMetadata: false });
  const copied = await doc.copyPages(other, other.getPageIndices());
  copied.forEach((p) => doc.addPage(p));
  return { bytes: await doc.save({ useObjectStreams: false }), added: copied.length };
}

export async function appendBlank(bytes, width, height) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.addPage([width, height]);
  return doc.save({ useObjectStreams: false });
}

// Matrix from a page's visual coordinates (origin bottom-left as displayed, x right, y up) to user space.
export function visualFrame(page) {
  const box = page.getCropBox ? page.getCropBox() : page.getMediaBox();
  const { x, y, width: w, height: h } = box;
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  if (r === 90) return { m: [0, 1, -1, 0, x + w, y], W: h, H: w };
  if (r === 180) return { m: [-1, 0, 0, -1, x + w, y + h], W: w, H: h };
  if (r === 270) return { m: [0, -1, 1, 0, x, y + h], W: h, H: w };
  return { m: [1, 0, 0, 1, x, y], W: w, H: h };
}

const mulM = (a, b) => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];
const toArabicDigits = (s) => String(s).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// Page numbers and watermark, drawn upright on every page whatever its rotation.
export async function applyStamps(bytes, stamps, lib) {
  if (!stamps || (!stamps.numbers && !stamps.watermark)) return bytes;
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = doc.getPages();
  const edits = [];
  pages.forEach((page, i) => {
    const { m, W, H } = visualFrame(page);
    const n = stamps.numbers;
    if (n && !(n.skipFirst && i === 0)) {
      const first = n.start || 1;
      const num = first + i - (n.skipFirst ? 1 : 0);
      const total = first + pages.length - 1 - (n.skipFirst ? 1 : 0);
      let text = n.format === 'of' ? `${num} / ${total}` : n.format === 'page' ? `صفحة ${num} من ${total}` : `${num}`;
      if (n.digits === 'arabic') text = toArabicDigits(text);
      const size = n.size || 10, margin = n.margin || 24;
      const top = n.pos && n.pos[0] === 't';
      const side = n.pos ? n.pos[1] : 'c';
      const x = side === 'r' ? W - margin : side === 'l' ? margin : W / 2;
      const align = side === 'r' ? 'right' : side === 'l' ? 'left' : 'center';
      edits.push({ type: 'add', page: i, text, size, color: n.color || '#555555', colorChanged: true, align, x0: x, x1: x,
        baseline: top ? H - margin - size * 0.8 : margin, rtl: /[\u0600-\u06FF]/.test(text), fontChoice: 'bundled:plex', frame: m });
    }
    const w = stamps.watermark;
    if (w && w.text && w.text.trim()) {
      const size = w.size || Math.round(Math.min(W, H) / 7);
      const cx = W / 2, cy = H / 2, a = ((w.angle ?? 45) * Math.PI) / 180;
      const rot = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
      const frame = mulM(mulM(mulM([1, 0, 0, 1, -cx, -cy], rot), [1, 0, 0, 1, cx, cy]), m);
      edits.push({ type: 'add', page: i, text: w.text.trim(), size, color: w.color || '#808080', colorChanged: true, align: 'center',
        x0: cx, x1: cx, baseline: cy - size * 0.35, rtl: /[\u0600-\u06FF]/.test(w.text), fontChoice: 'bundled:plex', frame, opacity: w.opacity ?? 0.15 });
    }
  });
  return edits.length ? buildPdf(bytes, edits, lib) : bytes;
}

function concatBytes(...parts) {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function tagFor(s) {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let t = ''; for (let i = 0; i < 6; i++) { t += String.fromCharCode(65 + (h % 26)); h = Math.floor(h / 26) + i * 7; }
  return t;
}

function writeType0(doc, ent) {
  const ctx = doc.context;
  const { sf, glyphs } = ent;
  const f = sf.sfnt;
  const gids = [...glyphs.keys()].sort((a, b) => a - b);
  const data = subsetTrueType(f, gids);
  const psName = (f.psName || 'Font').replace(/[^A-Za-z0-9\-_]/g, '');
  const base = `${tagFor(psName + gids.join(','))}+${psName}`;
  const k = 1000 / f.upem;
  const cff = f.isCFF;
  const fileStream = cff
    ? ctx.flateStream(data, { Subtype: 'OpenType' })
    : ctx.flateStream(data, { Length1: data.length });
  const desc = ctx.obj({
    Type: 'FontDescriptor', FontName: base, Flags: 4,
    FontBBox: f.bbox.map((v) => Math.round(v * k)), ItalicAngle: 0,
    Ascent: Math.round(f.ascent * k), Descent: Math.round(f.descent * k),
    CapHeight: Math.round(f.capHeight * k), StemV: f.weight >= 600 ? 140 : 80,
  });
  desc.set(PDFName.of(cff ? 'FontFile3' : 'FontFile2'), ctx.register(fileStream));
  const W = [];
  for (let i = 0; i < gids.length;) {
    let j = i; const ws = [];
    while (j < gids.length && gids[j] === gids[i] + (j - i)) { ws.push(Math.round(f.advance(gids[j]) * k)); j++; }
    W.push(gids[i], ws); i = j;
  }
  const cid = ctx.obj({
    Type: 'Font', Subtype: cff ? 'CIDFontType0' : 'CIDFontType2', BaseFont: base,
    FontDescriptor: ctx.register(desc), DW: 0, W,
  });
  const csi = ctx.obj({});
  csi.set(PDFName.of('Registry'), window.PDFLib.PDFString.of('Adobe'));
  csi.set(PDFName.of('Ordering'), window.PDFLib.PDFString.of('Identity'));
  csi.set(PDFName.of('Supplement'), ctx.obj(0));
  cid.set(PDFName.of('CIDSystemInfo'), csi);
  if (!cff) cid.set(PDFName.of('CIDToGIDMap'), PDFName.of('Identity'));
  const tu = toUnicodeCMap(glyphs);
  const type0 = ctx.obj({
    Type: 'Font', Subtype: 'Type0', BaseFont: base, Encoding: 'Identity-H',
    DescendantFonts: [ctx.register(cid)],
    ToUnicode: ctx.register(ctx.flateStream(new TextEncoder().encode(tu))),
  });
  ctx.assign(ent.ref, type0);
}

function toUnicodeCMap(glyphs) {
  const entries = [...glyphs.entries()].map(([g, u]) => [g, u ? toVisualCluster(u) : NO_TEXT]).sort((a, b) => a[0] - b[0]);
  const hex = (s) => [...s].map((ch) => { const cp = ch.codePointAt(0); if (cp > 0xFFFF) { const v = cp - 0x10000; return ((0xD800 + (v >> 10)).toString(16) + (0xDC00 + (v & 1023)).toString(16)).toUpperCase(); } return cp.toString(16).padStart(4, '0').toUpperCase(); }).join('');
  let s = `%${VISUAL_ORDER_MARK}\n` + '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    s += `${chunk.length} beginbfchar\n`;
    for (const [g, u] of chunk) s += `<${g.toString(16).padStart(4, '0').toUpperCase()}> <${hex(u)}>\n`;
    s += 'endbfchar\n';
  }
  return s + 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
}
