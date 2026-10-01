// Font handling: sfnt parsing, glyph-preserving TrueType subsetting,
// HarfBuzz shaping with bidi, and font source resolution.
import bidiFactory from '../vendor/bidi.min.mjs';

const bidi = bidiFactory();
let hbPromise = null;
export function loadHB() {
  if (!hbPromise) {
    hbPromise = window.createHarfBuzz({ locateFile: (f) => 'vendor/' + f }).then((m) => window.hbjs(m));
  }
  return hbPromise;
}

// ---------- sfnt ----------
export function parseSfnt(bytes, index = 0) {
  let dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let base = 0;
  if (dv.getUint32(0) === 0x74746366) { // 'ttcf'
    const n = dv.getUint32(8);
    base = dv.getUint32(12 + 4 * Math.min(index, n - 1));
  }
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  const flavor = dv.getUint32(base);
  const numTables = dv.getUint16(base + 4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = base + 12 + i * 16;
    tables[tag(o)] = { offset: dv.getUint32(o + 8), length: dv.getUint32(o + 12) };
  }
  const f = { bytes, dv, tables, flavor, isCFF: flavor === 0x4f54544f || !!tables['CFF '] || !!tables['CFF2'], isTTC: base > 0 || dv.getUint32(0) === 0x74746366 };
  const head = tables.head;
  f.upem = head ? dv.getUint16(head.offset + 18) : 1000;
  f.bbox = head ? [dv.getInt16(head.offset + 36), dv.getInt16(head.offset + 38), dv.getInt16(head.offset + 40), dv.getInt16(head.offset + 42)] : [0, -200, 1000, 800];
  f.locFmt = head ? dv.getInt16(head.offset + 50) : 0;
  f.numGlyphs = tables.maxp ? dv.getUint16(tables.maxp.offset + 4) : 0;
  const hhea = tables.hhea;
  f.ascent = hhea ? dv.getInt16(hhea.offset + 4) : f.bbox[3];
  f.descent = hhea ? dv.getInt16(hhea.offset + 6) : f.bbox[1];
  f.numHM = hhea ? dv.getUint16(hhea.offset + 34) : 0;
  const os2 = tables['OS/2'];
  f.fsType = os2 ? dv.getUint16(os2.offset + 8) : 0;
  f.weight = os2 ? dv.getUint16(os2.offset + 4) : 400;
  f.capHeight = os2 && os2.length >= 90 ? dv.getInt16(os2.offset + 88) : f.ascent;
  f.advance = (gid) => {
    const h = tables.hmtx; if (!h || !f.numHM) return f.upem / 2;
    const i = Math.min(gid, f.numHM - 1);
    return dv.getUint16(h.offset + i * 4);
  };
  f.glyphRange = (gid) => {
    const l = tables.loca; if (!l || gid >= f.numGlyphs) return null;
    let a, b;
    if (f.locFmt === 0) { a = dv.getUint16(l.offset + gid * 2) * 2; b = dv.getUint16(l.offset + gid * 2 + 2) * 2; }
    else { a = dv.getUint32(l.offset + gid * 4); b = dv.getUint32(l.offset + gid * 4 + 4); }
    return [a, b];
  };
  f.hasGlyph = (gid) => {
    if (gid === 0) return false;
    if (f.isCFF) return gid < f.numGlyphs;
    const r = f.glyphRange(gid);
    return !!r && r[1] > r[0];
  };
  f.psName = readName(f, 6) || readName(f, 4) || 'Font';
  f.family = readName(f, 16) || readName(f, 1) || f.psName;
  return f;
}

function readName(f, id) {
  const t = f.tables.name; if (!t) return '';
  const dv = f.dv, o = t.offset;
  const count = dv.getUint16(o + 2), strOff = o + dv.getUint16(o + 4);
  let best = '';
  for (let i = 0; i < count; i++) {
    const r = o + 6 + i * 12;
    const pid = dv.getUint16(r), eid = dv.getUint16(r + 2), nid = dv.getUint16(r + 6);
    if (nid !== id) continue;
    const len = dv.getUint16(r + 8), off = strOff + dv.getUint16(r + 10);
    if (pid === 3 || pid === 0) {
      let s = '';
      for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(dv.getUint16(off + k));
      return s;
    }
    if (pid === 1 && eid === 0 && !best) for (let k = 0; k < len; k++) best += String.fromCharCode(f.bytes[off + k]);
  }
  return best;
}

// Extract a single face from a TTC into a standalone sfnt.
function standalone(f) {
  if (!f.isTTC) return f.bytes;
  const tags = Object.keys(f.tables).sort();
  return buildSfnt(f.flavor, tags.map((t) => ({ tag: t, data: f.bytes.subarray(f.tables[t].offset, f.tables[t].offset + f.tables[t].length) })));
}

function buildSfnt(flavor, list) {
  list = list.slice().sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const n = list.length;
  let size = 12 + n * 16;
  for (const t of list) size += (t.data.length + 3) & ~3;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, flavor);
  dv.setUint16(4, n);
  let es = 0; while ((1 << (es + 1)) <= n) es++;
  dv.setUint16(6, (1 << es) * 16); dv.setUint16(8, es); dv.setUint16(10, n * 16 - (1 << es) * 16);
  let off = 12 + n * 16;
  list.forEach((t, i) => {
    const r = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[r + k] = t.tag.charCodeAt(k);
    out.set(t.data, off);
    let sum = 0;
    const padded = (t.data.length + 3) & ~3;
    for (let k = 0; k < padded; k += 4) sum = (sum + dv.getUint32(off + k)) >>> 0;
    dv.setUint32(r + 4, sum); dv.setUint32(r + 8, off); dv.setUint32(r + 12, t.data.length);
    off += padded;
  });
  return out;
}

// Keep glyph ids stable; drop outlines of unused glyphs.
export function subsetTrueType(f, gids) {
  if (f.isCFF || !f.tables.glyf || !f.tables.loca) return standalone(f);
  const keep = new Set([0, ...gids]);
  const glyf = f.tables.glyf;
  const queue = [...keep];
  while (queue.length) { // composite dependencies
    const g = queue.pop();
    const r = f.glyphRange(g);
    if (!r || r[1] <= r[0]) continue;
    const o = glyf.offset + r[0];
    if (f.dv.getInt16(o) >= 0) continue;
    let p = o + 10, flags;
    do {
      flags = f.dv.getUint16(p); const comp = f.dv.getUint16(p + 2);
      if (!keep.has(comp)) { keep.add(comp); queue.push(comp); }
      p += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
    } while (flags & 0x20);
  }
  const n = f.numGlyphs;
  const parts = []; let total = 0;
  const loca = new Uint8Array((n + 1) * 4); const ldv = new DataView(loca.buffer);
  for (let g = 0; g < n; g++) {
    ldv.setUint32(g * 4, total);
    if (!keep.has(g)) continue;
    const r = f.glyphRange(g);
    if (!r || r[1] <= r[0]) continue;
    const d = f.bytes.subarray(glyf.offset + r[0], glyf.offset + r[1]);
    parts.push(d); total += d.length;
    const pad = (4 - (d.length % 4)) % 4;
    if (pad) { parts.push(new Uint8Array(pad)); total += pad; }
  }
  ldv.setUint32(n * 4, total);
  const glyfOut = new Uint8Array(total); let o = 0;
  for (const p of parts) { glyfOut.set(p, o); o += p.length; }
  const tbl = (t) => f.bytes.subarray(f.tables[t].offset, f.tables[t].offset + f.tables[t].length);
  const head = tbl('head').slice();
  const hdv = new DataView(head.buffer);
  hdv.setUint32(8, 0); hdv.setInt16(50, 1);
  const list = [{ tag: 'head', data: head }, { tag: 'loca', data: loca }, { tag: 'glyf', data: glyfOut }];
  for (const t of ['hhea', 'hmtx', 'maxp', 'cvt ', 'fpgm', 'prep', 'OS/2', 'name']) if (f.tables[t]) list.push({ tag: t, data: tbl(t) });
  return buildSfnt(0x00010000, list);
}

// ---------- shaping ----------
const ARABIC = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
export const hasArabic = (s) => ARABIC.test(s);
const JOINING = /[ؠ-يٮ-ۓۺ-ۿݐ-ݿࢠ-ࣿ]/;
export const needsShaping = (s) => JOINING.test(s);

export class ShapeFont {
  constructor(hb, bytes, meta = {}) {
    this.bytes = bytes;
    this.sfnt = parseSfnt(bytes, meta.index || 0);
    this.blob = hb.createBlob(bytes);
    this.face = hb.createFace(this.blob, meta.index || 0);
    this.font = hb.createFont(this.face);
    this.hb = hb;
    this.upem = this.sfnt.upem;
    Object.assign(this, meta);
    this.id = meta.id || 'f' + Math.random().toString(36).slice(2, 8);
  }
  shape(text, dir) {
    const buf = this.hb.createBuffer();
    buf.addText(text);
    buf.guessSegmentProperties();
    buf.setDirection(dir);
    buf.setClusterLevel(1);
    this.hb.shape(this.font, buf, '');
    const out = buf.json();
    buf.destroy();
    return out;
  }
  covers(ch) {
    if (!this._uni) this._uni = new Set(this.face.collectUnicodes());
    return this._uni.has(ch.codePointAt(0));
  }
  gidFor(ch) {
    const r = this.shape(ch, 'ltr');
    return r.length === 1 ? r[0].g : 0;
  }
}

function scriptOf(ch) {
  if (ARABIC.test(ch)) return 'ar';
  if (/[A-Za-zÀ-ɏ]/.test(ch)) return 'la';
  return '';
}

// Split a line into shaping runs in visual order.
// Returns [{text, dir, clusterBase}] with clusterBase = index into the logical string.
export function visualRuns(text, baseDir) {
  const lv = bidi.getEmbeddingLevels(text, baseDir);
  const levels = lv.levels;
  const runs = [];
  let i = 0;
  while (i < text.length) {
    let j = i + 1;
    let scr = scriptOf(text[i]);
    while (j < text.length && levels[j] === levels[i]) {
      const s = scriptOf(text[j]);
      if (s && scr && s !== scr) break;
      if (s) scr = s;
      j++;
    }
    runs.push({ start: i, end: j, level: levels[i] });
    i = j;
  }
  const maxL = Math.max(0, ...runs.map((r) => r.level));
  let minOdd = Math.min(...runs.map((r) => r.level).filter((l) => l % 2), 99);
  for (let L = maxL; L >= minOdd && L > 0; L--) {
    for (let k = 0; k < runs.length;) {
      if (runs[k].level >= L) {
        let m = k; while (m < runs.length && runs[m].level >= L) m++;
        const seg = runs.slice(k, m).reverse();
        runs.splice(k, m - k, ...seg);
        k = m;
      } else k++;
    }
  }
  return runs.map((r) => ({ text: text.slice(r.start, r.end), dir: r.level % 2 ? 'rtl' : 'ltr', base: r.start }));
}

// Lay out one line with a primary font and fallbacks.
// Returns {glyphs:[{font, gid, x, y, uni}], width} in font-size-relative units (em = 1).
// Which original style a piece of text belongs to: Arabic, Latin letters, or Western digits.
export function styleClass(t) {
  if (ARABIC.test(t)) return 'ar';
  if (/[A-Za-zÀ-ɏ]/.test(t)) return 'la';
  if (/[0-9]/.test(t)) return 'num';
  return null;
}

// styleOf(runText) -> {fonts, scale, key} lets each run keep its own font and size.
export function layoutLine(text, baseDir, fonts, styleOf = null) {
  const glyphs = [];
  let pen = 0;
  const used = new Set();
  let missing = false;
  const pieces = [];
  for (const run of visualRuns(text, baseDir)) {
    const st = styleOf ? styleOf(run.text) : null;
    const runFonts = st ? st.fonts : fonts;
    run.scale = st ? st.scale : 1; run.key = st ? st.key : null;
    // split the run so every character uses the first font that has it
    const chars = [...run.text];
    const pick = (ch) => runFonts.find((f) => f.covers(ch)) || null;
    const segs = [];
    for (const ch of chars) {
      const neutral = /[\s​-‏؜]|\p{M}/u.test(ch);
      let f = neutral && segs.length ? segs[segs.length - 1].font : pick(ch);
      if (!f) { f = runFonts[0]; missing = true; }
      if (segs.length && segs[segs.length - 1].font === f) segs[segs.length - 1].text += ch;
      else segs.push({ font: f, text: ch });
    }
    if (run.dir === 'rtl') segs.reverse();
    for (const sg of segs) pieces.push({ text: sg.text, dir: run.dir, font: sg.font, scale: run.scale, key: run.key });
  }
  for (const run of pieces) {
    const chosen = run.font;
    const shaped = chosen.shape(run.text, run.dir);
    if (shaped.some((g) => g.g === 0 && !/\s/.test(run.text[g.cl] || ''))) missing = true;
    used.add(chosen);
    const clusters = [...new Set(shaped.map((g) => g.cl))].sort((a, b) => a - b);
    const clusterText = (cl) => {
      const idx = clusters.indexOf(cl);
      const next = idx + 1 < clusters.length ? clusters[idx + 1] : run.text.length;
      return run.text.slice(cl, next);
    };
    // Text for copy/search: marks go to zero-width glyphs, letters to the widest glyph.
    const uniOf = new Map();
    for (const cl of clusters) {
      const gs = shaped.filter((g) => g.cl === cl);
      let chars = [...clusterText(cl)];
      if (gs.length === 1) { uniOf.set(gs[0], chars.join('')); continue; }
      const zero = gs.filter((g) => g.ax === 0);
      // Some fonts draw «أ إ آ» as alef plus a separate hamza/madda glyph: split the letter the same way
      // (Unicode decomposition), so the mark glyph gets the mark and the lam-alef glyph always means «لا».
      if (zero.length > chars.filter((c) => /\p{M}/u.test(c)).length) {
        const nfd = [...chars.join('').normalize('NFD')];
        if (nfd.length > chars.length) chars = nfd;
      }
      const marks = chars.filter((c) => /\p{M}/u.test(c));
      const letters = chars.filter((c) => !/\p{M}/u.test(c));
      const wide = gs.filter((g) => g.ax !== 0).sort((a, b) => b.ax - a.ax);
      zero.forEach((g, i) => uniOf.set(g, i < marks.length ? marks[i] : ''));
      const rest = letters.join('') + marks.slice(zero.length).join('');
      if (wide.length) { uniOf.set(wide[0], rest); wide.slice(1).forEach((g) => uniOf.set(g, '')); }
      else if (zero.length) uniOf.set(zero[0], (uniOf.get(zero[0]) || '') + rest);
    }
    const k = run.scale || 1;
    for (const g of shaped) {
      const u = chosen.upem;
      glyphs.push({ font: chosen, gid: g.g, x: pen + (g.dx / u) * k, y: (g.dy / u) * k, uni: uniOf.get(g) || '', scale: k, key: run.key });
      pen += (g.ax / u) * k;
    }
  }
  return { glyphs, width: pen, fonts: [...used], missing };
}

// ---------- copy/search text in the PDF ----------
// RTL text is drawn in visual order and PDF readers reverse it character by character when copying, so a glyph
// that stands for several RTL characters (a ligature such as lam-alef) lists them in visual order in our ToUnicode.
// The marker comment tells this editor to read them back the same way; older files and other producers use logical order.
export const VISUAL_ORDER_MARK = 'ligatures in visual order - arabic-pdf-editor';
// Glyphs a font adds on its own (no text) map to this invisible joiner: an empty mapping makes readers show junk.
export const NO_TEXT = String.fromCharCode(0x34f);
const isRtlCp = (cp) => (cp >= 0x590 && cp <= 0x8ff) || (cp >= 0xfb1d && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff);
export const toVisualCluster = (u) => { const a = [...u]; return a.length > 1 && isRtlCp(a[0].codePointAt(0)) ? a.reverse().join('') : u; };
export const fromVisualCluster = (v) => { const a = [...v]; return a.length > 1 && isRtlCp(a[a.length - 1].codePointAt(0)) ? a.reverse().join('') : v; };

// ---------- font name matching ----------
export function cleanBaseName(name) {
  return (name || '').replace(/^[A-Z]{6}\+/, '');
}
export function normName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(psmt|mt|ps)$/, '');
}
export function isBoldName(s) { return /bold|black|heavy|semibold|demi/i.test(s || ''); }

const BUNDLED = [
  { id: 'amiri', label: 'أميري (نسخ)', file: 'Amiri-Regular.ttf', bold: 'Amiri-Bold.ttf', style: 'naskh' },
  { id: 'plex', label: 'IBM Plex Sans Arabic', file: 'IBMPlexSansArabic-Regular.ttf', bold: 'IBMPlexSansArabic-Bold.ttf', style: 'sans' },
  { id: 'tajawal', label: 'تجوال (حديث)', file: 'Tajawal-Regular.ttf', bold: 'Tajawal-Bold.ttf', style: 'modern' },
  { id: 'scheh', label: 'شهرزاد (نسخ تقليدي)', file: 'ScheherazadeNew-Regular.ttf', bold: 'ScheherazadeNew-Bold.ttf', style: 'naskh2' },
];
export const bundledList = BUNDLED;

export function guessBundled(baseName) {
  const n = (baseName || '').toLowerCase();
  if (/kufi|cairo|tajawal|dubai|droid|frutiger|helvetica.*arabic|ge ?ss|din/.test(n)) return 'tajawal';
  if (/traditional|scheherazade|lotus|badr|mitra|nazanin|zar|kfgqpc|uthman/.test(n)) return 'scheh';
  if (/times|naskh|simplified|amiri|majalla|arabic typesetting|andalus|serif|georgia|garamond|cambria/.test(n)) return 'amiri';
  if (/arial|tahoma|segoe|calibri|verdana|sans|helvetica|noto|roboto|open|dejavu|plex|aptos/.test(n)) return 'plex';
  return 'amiri';
}

const cache = new Map();
export async function fetchBytes(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); }).then((b) => new Uint8Array(b)));
  return cache.get(url);
}

// Font sources registry
export class FontLibrary {
  constructor() {
    this.hb = null;
    this.shapeFonts = new Map(); // key -> ShapeFont
    this.localFonts = null; // array of FontData
    this.localState = 'unknown'; // unknown | granted | denied | unsupported
    this.uploaded = new Map(); // normName -> ShapeFont
  }
  async init() { this.hb = await loadHB(); }
  get localSupported() { return 'queryLocalFonts' in window; }
  async requestLocal() {
    if (!this.localSupported) { this.localState = 'unsupported'; return false; }
    if (this.localFonts) return true;
    try {
      this.localFonts = await window.queryLocalFonts();
      this.localState = this.localFonts.length ? 'granted' : 'denied';
      return this.localFonts.length > 0;
    } catch (e) { this.localState = 'denied'; return false; }
  }
  findLocal(baseName) {
    if (!this.localFonts) return null;
    const raw = cleanBaseName(baseName);
    const [fam, sty] = raw.split(',');
    const want = normName(raw.replace(',', '-'));
    let hit = this.localFonts.find((f) => normName(f.postscriptName) === want || normName(f.fullName) === want);
    if (!hit && sty) {
      const fw = normName(fam);
      hit = this.localFonts.find((f) => (normName(f.postscriptName).startsWith(fw) || normName(f.family) === fw) && normName(f.style) === normName(sty));
    }
    if (!hit) {
      const fw = normName(fam.split('-')[0]);
      const bold = isBoldName(raw);
      const cands = this.localFonts.filter((f) => normName(f.family) === fw || normName(f.postscriptName).split(/(?=bold|regular|italic)/)[0] === fw);
      hit = cands.find((f) => isBoldName(f.style) === bold && !/italic|oblique/i.test(f.style)) || null;
    }
    return hit;
  }
  async fromLocal(fd) {
    const key = 'local:' + fd.postscriptName;
    if (this.shapeFonts.has(key)) return this.shapeFonts.get(key);
    const bytes = new Uint8Array(await (await fd.blob()).arrayBuffer());
    let index = 0;
    const dv = new DataView(bytes.buffer);
    if (dv.getUint32(0) === 0x74746366) { // pick the face whose PostScript name matches
      const n = dv.getUint32(8);
      for (let i = 0; i < n; i++) { if (parseSfnt(bytes, i).psName === fd.postscriptName) { index = i; break; } }
    }
    const sf = new ShapeFont(this.hb, bytes, { id: key, index, source: 'local', label: fd.fullName });
    this.shapeFonts.set(key, sf);
    return sf;
  }
  async bundled(id, bold) {
    const b = BUNDLED.find((x) => x.id === id) || BUNDLED[0];
    const file = bold ? b.bold : b.file;
    const key = 'bundled:' + file;
    if (this.shapeFonts.has(key)) return this.shapeFonts.get(key);
    const bytes = await fetchBytes('fonts/' + file);
    const sf = new ShapeFont(this.hb, bytes, { id: key, source: 'bundled', label: b.label + (bold ? ' – عريض' : '') });
    this.shapeFonts.set(key, sf);
    return sf;
  }
  addUpload(bytes, fileName) {
    const sf = new ShapeFont(this.hb, bytes, { source: 'upload' });
    sf.id = 'upload:' + sf.sfnt.psName;
    sf.label = sf.sfnt.family + ' (ملف مرفوع)';
    const bold = sf.sfnt.weight >= 600 || isBoldName(sf.sfnt.psName);
    this.uploaded.set(normName(sf.sfnt.psName), sf);
    this.uploaded.set(normName(sf.sfnt.family) + (bold ? ':bold' : ':regular'), sf);
    this.shapeFonts.set(sf.id, sf);
    void fileName;
    return sf;
  }
  findUpload(baseName) {
    const raw = cleanBaseName(baseName);
    const bold = isBoldName(raw);
    return this.uploaded.get(normName(raw.replace(',', '-')))
      || this.uploaded.get(normName(raw.split(/[-,]/)[0]) + (bold ? ':bold' : ':regular')) || null;
  }
  byId(id) { return this.shapeFonts.get(id) || null; }
}

// Recover reading order from glyphs sorted left-to-right.
export function visualToLogical(vis) {
  // NFC: a font that draws «إ» as alef + hamza leaves the letter decomposed in the PDF text
  if (!hasArabic(vis)) return vis.normalize('NFC');
  const lv = bidi.getEmbeddingLevels(vis, 'rtl');
  return bidi.getReorderedString(vis, lv).normalize('NFC');
}
