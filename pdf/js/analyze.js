// Reads PDF font dictionaries and page content into editable text lines.
import { interpret, parseCMap, apply } from './content.js';
import { parseSfnt } from './fonts.js';

const { PDFName, PDFDict, PDFArray, PDFNumber, PDFStream, PDFRef, PDFString, PDFHexString, decodePDFRawStream } = window.PDFLib;

export function streamBytes(s) {
  if (!s) return new Uint8Array(0);
  try { return decodePDFRawStream(s).decode(); } catch (e) {
    try { return s.getContents(); } catch (e2) { return new Uint8Array(0); }
  }
}

const WIN = { 128: 0x20AC, 130: 0x201A, 131: 0x0192, 132: 0x201E, 133: 0x2026, 134: 0x2020, 135: 0x2021, 136: 0x02C6, 137: 0x2030, 138: 0x0160, 139: 0x2039, 140: 0x0152, 142: 0x017D, 145: 0x2018, 146: 0x2019, 147: 0x201C, 148: 0x201D, 149: 0x2022, 150: 0x2013, 151: 0x2014, 152: 0x02DC, 153: 0x2122, 154: 0x0161, 155: 0x203A, 156: 0x0153, 158: 0x017E, 159: 0x0178 };
export const winAnsiDecode = (c) => String.fromCharCode(WIN[c] || c);
export function winAnsiEncode(ch) {
  const u = ch.charCodeAt(0);
  if (u >= 32 && u < 127) return u;
  if (u >= 160 && u <= 255) return u;
  for (const [k, v] of Object.entries(WIN)) if (v === u) return +k;
  return -1;
}
const AGL = { space: ' ', period: '.', comma: ',', colon: ':', semicolon: ';', hyphen: '-', parenleft: '(', parenright: ')', slash: '/', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', quotesingle: "'", quotedbl: '"', exclam: '!', question: '?', at: '@', ampersand: '&', percent: '%', dollar: '$', numbersign: '#', asterisk: '*', plus: '+', equal: '=', underscore: '_', bracketleft: '[', bracketright: ']', endash: '–', emdash: '—', quoteleft: '‘', quoteright: '’', quotedblleft: '“', quotedblright: '”', bullet: '•' };
function glyphNameToUni(n) {
  if (!n) return '';
  if (n.length === 1) return n;
  if (AGL[n]) return AGL[n];
  let m = /^uni([0-9A-Fa-f]{4})/.exec(n); if (m) return String.fromCharCode(parseInt(m[1], 16));
  m = /^u([0-9A-Fa-f]{4,6})$/.exec(n); if (m) return String.fromCodePoint(parseInt(m[1], 16));
  return '';
}

function standardMetrics(baseFont) {
  const n = (baseFont || '').replace(/^[A-Z]{6}\+/, '').toLowerCase().replace(/[^a-z]/g, '');
  const bold = /bold|black|heavy/.test(n), ital = /italic|oblique/.test(n);
  let fam = null;
  if (/helvetica|arial/.test(n)) fam = 'Helvetica';
  else if (/times/.test(n)) fam = 'Times';
  else if (/courier/.test(n)) fam = 'Courier';
  if (!fam) return null;
  const name = fam === 'Times'
    ? 'Times-' + (bold && ital ? 'BoldItalic' : bold ? 'Bold' : ital ? 'Italic' : 'Roman')
    : fam + (bold && ital ? '-BoldOblique' : bold ? '-Bold' : ital ? '-Oblique' : '');
  try { return window.PDFLib.StandardFontEmbedder.for(name); } catch (e) { return null; }
}

export class PdfFont {
  constructor(doc, dict, ref) {
    const ctx = doc.context;
    const L = (x) => (x instanceof PDFRef ? ctx.lookup(x) : x);
    const G = (d, k) => (d ? L(d.get(PDFName.of(k))) : undefined);
    const N = (x) => (x instanceof PDFNumber ? x.asNumber() : 0);
    const nm = (x) => (x instanceof PDFName ? x.decodeText() : '');
    this.ref = ref;
    this.key = ref ? ref.toString() : 'direct';
    this.subtype = nm(G(dict, 'Subtype'));
    this.baseFont = nm(G(dict, 'BaseFont'));
    this.isType0 = this.subtype === 'Type0';
    this.toUni = new Map();
    const tu = G(dict, 'ToUnicode');
    if (tu instanceof PDFStream) this.toUni = parseCMap(streamBytes(tu)).map;
    let desc, fontDict = dict;
    if (this.isType0) {
      const enc = G(dict, 'Encoding');
      this.encoding = enc instanceof PDFName ? enc.decodeText() : 'embedded';
      this.codeLen = 2;
      if (enc instanceof PDFStream) {
        const sp = parseCMap(streamBytes(enc)).spaces;
        this.spaces = sp.length ? sp : null;
      }
      const df = G(dict, 'DescendantFonts');
      const cid = df instanceof PDFArray ? L(df.get(0)) : null;
      fontDict = cid;
      this.cidSubtype = nm(G(cid, 'Subtype'));
      const c2g = G(cid, 'CIDToGIDMap');
      this.cidToGidIdentity = !c2g || nm(c2g) === 'Identity';
      this.dw = G(cid, 'DW') ? N(G(cid, 'DW')) : 1000;
      this.w = new Map();
      const W = G(cid, 'W');
      if (W instanceof PDFArray) {
        const a = W.asArray().map(L);
        for (let i = 0; i < a.length;) {
          const c1 = N(a[i]);
          if (a[i + 1] instanceof PDFArray) {
            a[i + 1].asArray().map(L).forEach((w, k) => this.w.set(c1 + k, N(w)));
            i += 2;
          } else {
            const c2 = N(a[i + 1]), w = N(a[i + 2]);
            for (let c = c1; c <= c2 && c - c1 < 65536; c++) this.w.set(c, w);
            i += 3;
          }
        }
      }
      desc = G(cid, 'FontDescriptor');
    } else {
      this.codeLen = 1;
      this.firstChar = N(G(dict, 'FirstChar'));
      const W = G(dict, 'Widths');
      this.widths = W instanceof PDFArray ? W.asArray().map((x) => N(L(x))) : [];
      desc = G(dict, 'FontDescriptor');
      this.missingWidth = desc ? N(G(desc, 'MissingWidth')) : 0;
      const enc = G(dict, 'Encoding');
      this.encoding = enc instanceof PDFName ? enc.decodeText() : enc instanceof PDFDict ? 'dict' : 'builtin';
      this.diffs = new Map();
      if (enc instanceof PDFDict) {
        const be = G(enc, 'BaseEncoding'); if (be) this.encoding = nm(be);
        const d = G(enc, 'Differences');
        if (d instanceof PDFArray) {
          let c = 0;
          for (const x of d.asArray().map(L)) { if (x instanceof PDFNumber) c = x.asNumber(); else if (x instanceof PDFName) this.diffs.set(c++, x.decodeText()); }
        }
      }
      // Standard 14 fonts may come without Widths: use the official metrics.
      if (!this.widths.length) this.std = standardMetrics(this.baseFont);
      const fm = G(dict, 'FontMatrix');
      this.fmScale = fm instanceof PDFArray ? N(L(fm.get(0))) * 1000 : 1;
    }
    this.ascent = desc ? N(G(desc, 'Ascent')) / 1000 : 0.8;
    this.descent = desc ? N(G(desc, 'Descent')) / 1000 : -0.2;
    if (!this.ascent || this.ascent > 1.5) this.ascent = 0.8;
    if (!this.descent || this.descent < -1) this.descent = -0.2;
    this.fontWeight = desc ? N(G(desc, 'FontWeight')) : 0;
    this.flags = desc ? N(G(desc, 'Flags')) : 0;
    this.fontBytes = null; this.fontKind = null;
    if (desc) {
      const f2 = G(desc, 'FontFile2'), f3 = G(desc, 'FontFile3');
      if (f2 instanceof PDFStream) { this.fontBytes = streamBytes(f2); this.fontKind = 'TrueType'; }
      else if (f3 instanceof PDFStream) {
        const st = nm(G(f3.dict, 'Subtype'));
        this.fontBytes = streamBytes(f3); this.fontKind = st === 'OpenType' ? 'OpenType' : 'CFF';
      }
    }
    this.sfnt = null;
    if (this.fontBytes && (this.fontKind === 'TrueType' || this.fontKind === 'OpenType')) {
      try { this.sfnt = parseSfnt(this.fontBytes); } catch (e) { this.sfnt = null; }
    }
    void fontDict; void PDFString; void PDFHexString;
  }
  // Horizontal centre of a glyph's ink, in em units (null if unknown).
  inkCenter(code) {
    const f = this.sfnt;
    if (!f || f.isCFF || !this.isType0 || !this.cidToGidIdentity) return null;
    const r = f.glyphRange(code);
    if (!r || r[1] <= r[0]) return null;
    const o = f.tables.glyf.offset + r[0];
    return (f.dv.getInt16(o + 2) + f.dv.getInt16(o + 6)) / 2 / f.upem;
  }
  get bold() { return /bold|black|heavy/i.test(this.baseFont) || this.fontWeight >= 600 || !!(this.flags & 0x40000); }
  splitCodes(bytes) {
    const out = [];
    if (this.codeLen === 1) { for (const b of bytes) out.push({ code: b, len: 1 }); return out; }
    if (this.spaces) {
      for (let i = 0; i < bytes.length;) {
        let done = false;
        for (let len = 1; len <= 4 && !done; len++) {
          if (i + len > bytes.length) break;
          let c = 0; for (let k = 0; k < len; k++) c = c * 256 + bytes[i + k];
          if (this.spaces.some((s) => s.len === len && c >= s.lo && c <= s.hi)) { out.push({ code: c, len }); i += len; done = true; }
        }
        if (!done) { out.push({ code: bytes[i], len: 1 }); i++; }
      }
      return out;
    }
    for (let i = 0; i + 1 < bytes.length; i += 2) out.push({ code: (bytes[i] << 8) | bytes[i + 1], len: 2 });
    return out;
  }
  width(code) {
    if (this.isType0) return this.w.has(code) ? this.w.get(code) : this.dw;
    if (this.std) { try { return this.std.widthOfTextAtSize(this.toUnicode(code) || ' ', 1000); } catch (e) { return 500; } }
    const i = code - this.firstChar;
    const w = i >= 0 && i < this.widths.length ? this.widths[i] : this.missingWidth || 500;
    return w * (this.fmScale || 1);
  }
  toUnicode(code) {
    if (this.toUni.has(code)) return this.toUni.get(code);
    if (this.isType0) return '';
    if (this.diffs && this.diffs.has(code)) return glyphNameToUni(this.diffs.get(code));
    return winAnsiDecode(code);
  }
}

export function pageFonts(doc, page) {
  const ctx = doc.context;
  const res = page.node.Resources();
  const fdict = res ? res.lookup(PDFName.of('Font')) : null;
  const cache = new Map();
  const cacheByRef = doc.__fontCache || (doc.__fontCache = new Map());
  return (name) => {
    if (cache.has(name)) return cache.get(name);
    let f = null;
    if (fdict instanceof PDFDict) {
      const raw = fdict.get(PDFName.of(name));
      const dict = raw instanceof PDFRef ? ctx.lookup(raw) : raw;
      if (dict instanceof PDFDict) {
        const k = raw instanceof PDFRef ? raw.toString() : null;
        if (k && cacheByRef.has(k)) f = cacheByRef.get(k);
        else {
          try { f = new PdfFont(doc, dict, raw instanceof PDFRef ? raw : null); } catch (e) { console.warn('font', name, e); f = null; }
          if (k) cacheByRef.set(k, f);
        }
      }
    }
    cache.set(name, f);
    return f;
  };
}

export function pageContentBytes(doc, page) {
  const ctx = doc.context;
  const c = page.node.Contents();
  const list = [];
  if (c instanceof PDFStream) list.push(c);
  else if (c instanceof PDFArray) for (const x of c.asArray()) { const s = x instanceof PDFRef ? ctx.lookup(x) : x; if (s instanceof PDFStream) list.push(s); }
  const parts = list.map(streamBytes);
  const len = parts.reduce((a, p) => a + p.length + 1, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; out[o++] = 10; }
  return out;
}

export function analyzePage(doc, pageIndex) {
  const page = doc.getPage(pageIndex);
  const bytes = pageContentBytes(doc, page);
  const fonts = pageFonts(doc, page);
  const { runs } = interpret(bytes, fonts);
  runs.forEach((r, i) => { r.id = i; });
  return { bytes, runs, lines: groupLines(runs, pageIndex) };
}

const ARAB = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

const normUni = (u) => { const n = u.normalize('NFKC'); return n.trim() ? n.replace(/^\s+/, '') : n; };
const isMark = (u) => { const n = u.normalize('NFKC').replace(/\s/g, ''); return n.length > 0 && /^\p{M}+$/u.test(n); };

// Joining behaviour of Arabic presentation forms (left = towards the next letter in reading order).
const FORM = new Map();
(() => {
  const groups = [];
  for (let cp = 0xFB50; cp <= 0xFEFC; cp++) {
    if (cp >= 0xFC00 && cp <= 0xFDFF) continue; // ligature block handled by ranges below
    const n = String.fromCharCode(cp).normalize('NFKC');
    if (n.length === 1 && n.charCodeAt(0) === cp) continue;
    if (/\s/.test(n)) continue;
    const last = groups[groups.length - 1];
    if (last && last.n === n && last.end === cp - 1) { last.cps.push(cp); last.end = cp; }
    else groups.push({ n, cps: [cp], end: cp });
  }
  const forms4 = ['isol', 'fin', 'init', 'med'];
  for (const g of groups) g.cps.forEach((cp, i) => FORM.set(cp, g.cps.length === 1 ? 'isol' : forms4[i] || 'isol'));
  const ranges = [[0xFC00, 0xFC63, 'isol'], [0xFC64, 0xFC96, 'fin'], [0xFC97, 0xFCDE, 'init'], [0xFCDF, 0xFCF4, 'med'],
    [0xFCF5, 0xFD10, 'isol'], [0xFD11, 0xFD2C, 'fin'], [0xFD2D, 0xFD33, 'init'], [0xFD34, 0xFD3B, 'med'], [0xFDF0, 0xFDFB, 'isol']];
  for (const [a, b, f] of ranges) for (let cp = a; cp <= b; cp++) FORM.set(cp, f);
})();
const RIGHT_JOINING = new Set([...'اأإآٱدذرزژوؤةڈڑۀۃۄۅۆۇۈۉۊۋۍۏ']);
function formOf(u) {
  const ch = [...(u || '')];
  if (!ch.length) return null;
  return { first: FORM.get(ch[0].codePointAt(0)) || (RIGHT_JOINING.has(ch[0]) ? 'rj' : null),
    last: FORM.get(ch[ch.length - 1].codePointAt(0)) || (RIGHT_JOINING.has(ch[ch.length - 1]) ? 'rj' : null) };
}
// glyph on the left in visual order: does it connect to the glyph on its right?
function joinsRight(u) { const f = formOf(u); if (!f || !f.first) return true; return f.first === 'fin' || f.first === 'med'; }
// glyph on the right in visual order: does it connect to the glyph on its left?
function joinsLeft(u) { const f = formOf(u); if (!f || !f.last) return true; return f.last === 'init' || f.last === 'med'; }

// PDF producers often map shared glyphs to Persian letters; prefer Arabic ones in Arabic text.
export function normalizeArabic(t) {
  if (/[پچژگ]/.test(t)) return t; // clearly Persian
  return t.replace(/ی/g, 'ي').replace(/ک/g, 'ك');
}

function groupLines(runs, pageIndex) {
  const items = [];
  for (const r of runs) {
    if (!r.font || !r.glyphs.length || r.Tr === 3 || r.Tr === 7) continue;
    const m = r.trm;
    if (Math.abs(m[1]) > 1e-3 * Math.abs(m[0]) || Math.abs(m[2]) > 1e-3 * Math.abs(m[3]) || m[0] <= 0 || m[3] <= 0) continue;
    const size = r.fs * m[3];
    if (size < 1) continue;
    const [x0, y] = apply(m, 0, 0);
    const [x1] = apply(m, r.tx, 0);
    const glyphs = r.glyphs.map((g) => {
      const ic = isMark(g.uni || ' ') ? r.font.inkCenter(g.code) : null;
      const x = apply(m, g.x, 0)[0];
      return { x, w: g.w * m[0], uni: g.uni, run: r.id, cx: ic == null ? null : x + ic * r.fs * r.Th * m[0] };
    });
    const blank = glyphs.every((g) => !g.uni || /^\s+$/.test(g.uni));
    const markOnly = !blank && glyphs.every((g) => !g.uni || /^\s+$/.test(g.uni) || isMark(g.uni));
    const inked = glyphs.filter((g) => g.uni && !/^\s+$/.test(g.uni));
    const gx0 = inked.length ? Math.min(...inked.map((g) => g.x)) : Math.min(x0, x1);
    const gx1 = inked.length ? Math.max(...inked.map((g) => g.x + g.w)) : Math.max(x0, x1);
    items.push({ run: r, x0: gx0, x1: gx1, y, size, glyphs, blank, markOnly });
  }
  items.sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const lines = [];
  for (const it of items) {
    if (it.markOnly) continue;
    let best = null;
    for (const L of lines) {
      if (Math.abs(L.y - it.y) > 0.3 * Math.min(L.size, it.size)) continue;
      const ratio = it.size / L.size;
      if (!it.blank && (ratio < 0.6 || ratio > 1.7)) continue;
      const gap = Math.max(L.x0 - it.x1, it.x0 - L.x1, 0);
      if (gap > 2.2 * Math.max(L.size, it.size)) continue;
      best = L; break;
    }
    if (!best) { best = { y: it.y, size: it.size, x0: it.x0, x1: it.x1, items: [] }; lines.push(best); }
    best.items.push(it);
    best.x0 = Math.min(best.x0, it.x0); best.x1 = Math.max(best.x1, it.x1);
    if (!it.blank) best.size = Math.max(best.size, it.size);
  }
  // merge lines that ended up split because of processing order
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < lines.length && !changed; i++) for (let j = i + 1; j < lines.length && !changed; j++) {
      const A = lines[i], B = lines[j];
      if (Math.abs(A.y - B.y) > 0.3 * Math.min(A.size, B.size)) continue;
      const gap = Math.max(A.x0 - B.x1, B.x0 - A.x1, 0);
      if (gap > 2.2 * Math.max(A.size, B.size)) continue;
      A.items.push(...B.items); A.x0 = Math.min(A.x0, B.x0); A.x1 = Math.max(A.x1, B.x1); A.size = Math.max(A.size, B.size);
      lines.splice(j, 1); changed = true;
    }
  }
  // diacritics drawn as separate runs (e.g. Chrome/Skia) belong to the line they sit on
  for (const it of items.filter((i) => i.markOnly)) {
    let best = null, bd = Infinity;
    for (const L of lines) {
      if (it.y < L.y - 0.7 * L.size || it.y > L.y + 1.2 * L.size) continue;
      if (it.x1 < L.x0 - L.size || it.x0 > L.x1 + L.size) continue;
      const d = Math.abs(it.y - L.y);
      if (d < bd) { bd = d; best = L; }
    }
    if (best) best.items.push(it);
  }
  const out = [];
  lines.forEach((L) => {
    const content = L.items.filter((i) => !i.blank);
    if (!content.length) return;
    // dominant font/colour by glyph count
    const score = new Map();
    for (const it of content) score.set(it.run, (score.get(it.run) || 0) + it.glyphs.length);
    const main = [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // spaces come from gaps: PDF producers often overlap space glyphs with kerning
    const all = L.items.flatMap((i) => i.glyphs).filter((g) => g.uni && !/^\s+$/.test(g.uni));
    const bases = all.filter((g) => !isMark(g.uni)).sort((a, b) => a.x - b.x).map((g) => ({ ...g, marks: [] }));
    for (const m of all.filter((g) => isMark(g.uni))) {
      const c = m.cx != null ? m.cx : m.x + m.w / 2;
      let best = null, bd = Infinity;
      for (const b of bases) {
        const d = c < b.x ? b.x - c : c > b.x + b.w ? c - b.x - b.w : 0;
        if (d < bd) { bd = d; best = b; }
      }
      if (best) best.marks.push({ u: normUni(m.uni), c });
    }
    // Some producers (e.g. Adobe) draw each word as its own run with no space glyph.
    // Arabic presentation forms tell us where a word ends even when advances overlap.
    // Only for producers that never emit space glyphs in their Arabic font (otherwise spaces are explicit).
    const arabicFonts = new Set(L.items.filter((i) => i.glyphs.some((g) => ARAB.test(g.uni || ''))).map((i) => i.run.fontKey));
    const hasSpaceGlyphs = L.items.some((i) => arabicFonts.has(i.run.fontKey) && i.glyphs.some((g) => g.uni && /^\s+$/.test(g.uni)));
    const usesForms = !hasSpaceGlyphs && bases.some((g) => /[ﭐ-﷿ﹰ-﻿]/.test(g.uni));
    let vis = '';
    let prevEnd = null, prev = null;
    for (const g of bases) {
      let u = normUni(g.uni);
      if (ARAB.test(u)) {
        // place each mark on the ligature component it sits over (components run right-to-left)
        const comps = [...u].map((ch) => [ch]);
        for (const mk of g.marks) {
          const k = comps.length;
          const idx = k > 1 && g.w > 0 ? Math.max(0, Math.min(k - 1, Math.floor(((g.x + g.w - mk.c) / g.w) * k))) : 0;
          comps[idx].push(mk.u);
        }
        u = [...comps.flat().join('')].reverse().join('');
      } else u += g.marks.map((mk) => mk.u).join('');
      const gap = prevEnd === null ? 0 : g.x - prevEnd;
      const wordBreak = usesForms && prev && prev.run !== g.run && gap > -0.3 * L.size
        && !joinsRight(prev.uni) && !joinsLeft(g.uni) && ARAB.test(prev.uni) && ARAB.test(g.uni);
      if (prevEnd !== null && (gap > 0.1 * L.size || wordBreak)) vis += ' ';
      vis += u;
      prevEnd = prevEnd === null ? g.x + g.w : Math.max(prevEnd, g.x + g.w);
      prev = g;
    }
    vis = normalizeArabic(vis.replace(/\s+/g, ' ').trim());
    const x0 = Math.min(...content.map((i) => i.x0)), x1 = Math.max(...content.map((i) => i.x1));
    // style (font/size/colour) used by each kind of text in this line
    const tally = {};
    for (const it of content) for (const g of it.glyphs) {
      const u = g.uni ? normUni(g.uni) : '';
      const k = ARAB.test(u) && !isMark(u) ? 'ar' : /[A-Za-zÀ-ɏ]/.test(u) ? 'la' : /[0-9]/.test(u) ? 'num' : null;
      if (!k) continue;
      tally[k] = tally[k] || new Map();
      tally[k].set(it.run, (tally[k].get(it.run) || 0) + 1);
    }
    const styles = {};
    for (const [k, m] of Object.entries(tally)) {
      const r = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
      styles[k] = { fontKey: r.fontKey, font: r.font, size: r.fs * r.trm[3], fill: r.fill };
    }
    const mainKey = Object.keys(styles).find((k) => styles[k].fontKey === main.fontKey && Math.abs(styles[k].size - main.fs * main.trm[3]) < 0.01) || null;
    const f = main.font;
    out.push({
      styles, mainKey,
      id: `p${pageIndex}l${out.length}`,
      page: pageIndex,
      runIds: L.items.map((i) => i.run.id),
      x0, x1, baseline: L.items.find((i) => i.run === main).y,
      size: main.fs * main.trm[3],
      ascent: f.ascent, descent: f.descent,
      visual: vis,
      rtl: ARAB.test(vis),
      fontKey: main.fontKey,
      font: f,
      fill: main.fill,
    });
  });
  return out;
}
