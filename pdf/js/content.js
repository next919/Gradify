// Content-stream tokenizer and text interpreter.
// Works on the raw decoded bytes so unchanged parts are copied byte-for-byte.

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);

export function tokenize(bytes) {
  const toks = [];
  const n = bytes.length;
  let i = 0;
  while (i < n) {
    const c = bytes[i];
    if (WS.has(c)) { i++; continue; }
    if (c === 37) { while (i < n && bytes[i] !== 10 && bytes[i] !== 13) i++; continue; } // comment
    const start = i;
    if (c === 40) { // literal string
      const out = [];
      let depth = 1; i++;
      while (i < n && depth > 0) {
        let b = bytes[i];
        if (b === 92) {
          i++; b = bytes[i];
          if (b === 110) out.push(10); else if (b === 114) out.push(13); else if (b === 116) out.push(9);
          else if (b === 98) out.push(8); else if (b === 102) out.push(12);
          else if (b === 13) { if (bytes[i + 1] === 10) i++; }
          else if (b === 10) { /* line continuation */ }
          else if (b >= 48 && b <= 55) {
            let v = b - 48, k = 1;
            while (k < 3 && bytes[i + 1] >= 48 && bytes[i + 1] <= 55) { i++; v = v * 8 + bytes[i] - 48; k++; }
            out.push(v & 255);
          } else out.push(b);
          i++; continue;
        }
        if (b === 40) depth++;
        else if (b === 41) { depth--; if (depth === 0) { i++; break; } }
        out.push(b); i++;
      }
      toks.push({ t: 'str', v: Uint8Array.from(out), s: start, e: i });
      continue;
    }
    if (c === 60) {
      if (bytes[i + 1] === 60) { toks.push({ t: '<<', s: i, e: i + 2 }); i += 2; continue; }
      i++; let hex = '';
      while (i < n && bytes[i] !== 62) { const h = bytes[i]; if (!WS.has(h)) hex += String.fromCharCode(h); i++; }
      i++;
      if (hex.length % 2) hex += '0';
      const v = new Uint8Array(hex.length / 2);
      for (let k = 0; k < v.length; k++) v[k] = parseInt(hex.substr(k * 2, 2), 16);
      toks.push({ t: 'str', v, hex: true, s: start, e: i });
      continue;
    }
    if (c === 62 && bytes[i + 1] === 62) { toks.push({ t: '>>', s: i, e: i + 2 }); i += 2; continue; }
    if (c === 91) { toks.push({ t: '[', s: i, e: i + 1 }); i++; continue; }
    if (c === 93) { toks.push({ t: ']', s: i, e: i + 1 }); i++; continue; }
    if (c === 123 || c === 125) { i++; continue; }
    if (c === 47) {
      i++; let name = '';
      while (i < n && !WS.has(bytes[i]) && !DELIM.has(bytes[i])) {
        if (bytes[i] === 35 && i + 2 < n) { name += String.fromCharCode(parseInt(String.fromCharCode(bytes[i + 1], bytes[i + 2]), 16)); i += 3; }
        else { name += String.fromCharCode(bytes[i]); i++; }
      }
      toks.push({ t: 'name', v: name, s: start, e: i });
      continue;
    }
    let word = '';
    while (i < n && !WS.has(bytes[i]) && !DELIM.has(bytes[i])) { word += String.fromCharCode(bytes[i]); i++; }
    if (word === '') { i++; continue; }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) toks.push({ t: 'num', v: parseFloat(word), s: start, e: i });
    else {
      toks.push({ t: 'op', v: word, s: start, e: i });
      if (word === 'ID') { // inline image data: skip to EI
        i++;
        while (i < n) {
          if (bytes[i] === 69 && bytes[i + 1] === 73 && WS.has(bytes[i - 1]) && (i + 2 >= n || WS.has(bytes[i + 2]) || DELIM.has(bytes[i + 2]))) break;
          i++;
        }
      }
    }
  }
  return toks;
}

// Group tokens into operations: {op, args, s, e}
export function parseOps(bytes) {
  const toks = tokenize(bytes);
  const ops = [];
  let args = [], argStart = -1;
  const stack = [];
  for (const tk of toks) {
    if (tk.t === '[' || tk.t === '<<') {
      if (argStart < 0) argStart = tk.s;
      stack.push({ kind: tk.t, items: [] });
      continue;
    }
    if (tk.t === ']' || tk.t === '>>') {
      const fr = stack.pop();
      const val = fr ? (fr.kind === '[' ? { t: 'arr', v: fr.items } : { t: 'dict', v: fr.items }) : null;
      if (!val) continue;
      if (stack.length) stack[stack.length - 1].items.push(val); else args.push(val);
      continue;
    }
    if (stack.length) { stack[stack.length - 1].items.push(tk); continue; }
    if (tk.t === 'op' && tk.v !== 'true' && tk.v !== 'false' && tk.v !== 'null') {
      ops.push({ op: tk.v, args, s: argStart >= 0 ? argStart : tk.s, e: tk.e });
      args = []; argStart = -1;
      continue;
    }
    if (argStart < 0) argStart = tk.s;
    args.push(tk);
  }
  return ops;
}

export const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];
export const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const num = (a) => (a && a.t === 'num' ? a.v : 0);

// Walk the page content, returning every text-show operation with its geometry.
// fonts: (resourceName) => FontInfo | null
export function interpret(bytes, fonts) {
  const ops = parseOps(bytes);
  const runs = [];
  let gs = { ctm: [1, 0, 0, 1, 0, 0], fill: { op: 'g', vals: [0] }, fillCS: 'DeviceGray', Tc: 0, Tw: 0, Th: 1, TL: 0, Tf: null, fs: 0, Tr: 0, Ts: 0 };
  const stack = [];
  let Tm = [1, 0, 0, 1, 0, 0], Tlm = [1, 0, 0, 1, 0, 0];
  let inText = false;

  const csComps = (cs) => ({ DeviceGray: 1, CalGray: 1, DeviceRGB: 3, CalRGB: 3, Lab: 3, DeviceCMYK: 4 }[cs] || 0);

  const show = (op, strTok, arrItems, extraBefore) => {
    const font = gs.Tf ? fonts(gs.Tf) : null;
    const startTm = Tm.slice();
    let tx = 0;
    const glyphs = [];
    const doStr = (bytesV) => {
      const codes = font ? font.splitCodes(bytesV) : Array.from(bytesV).map((b) => ({ code: b, len: 1 }));
      for (const { code, len } of codes) {
        const w0 = font ? font.width(code) / 1000 : 0.5;
        const isSpace = len === 1 && code === 32;
        const adv = (w0 * gs.fs + gs.Tc + (isSpace ? gs.Tw : 0)) * gs.Th;
        glyphs.push({ code, x: tx, w: w0 * gs.fs * gs.Th, uni: font ? font.toUnicode(code) : String.fromCharCode(code) });
        tx += adv;
      }
    };
    if (strTok) doStr(strTok.v);
    if (arrItems) for (const it of arrItems) {
      if (it.t === 'str') doStr(it.v);
      else if (it.t === 'num') tx -= (it.v / 1000) * gs.fs * gs.Th;
    }
    const trm = mul([1, 0, 0, 1, 0, gs.Ts], mul(startTm, gs.ctm));
    runs.push({
      opIndex: op.idx, s: op.s, e: op.e, op: op.op, extraBefore,
      fontKey: gs.Tf, font, fs: gs.fs, Th: gs.Th, Tr: gs.Tr, fill: gs.fill,
      trm, tx, glyphs,
      ctm: gs.ctm.slice(), Tm: startTm,
    });
    Tm = mul([1, 0, 0, 1, tx, 0], Tm);
  };

  ops.forEach((o, k) => { o.idx = k; });
  for (const op of ops) {
    const a = op.args;
    switch (op.op) {
      case 'q': stack.push({ ...gs, ctm: gs.ctm.slice() }); break;
      case 'Q': if (stack.length) gs = stack.pop(); break;
      case 'cm': gs.ctm = mul(a.map(num), gs.ctm); break;
      case 'BT': inText = true; Tm = [1, 0, 0, 1, 0, 0]; Tlm = Tm.slice(); break;
      case 'ET': inText = false; break;
      case 'Tc': gs.Tc = num(a[0]); break;
      case 'Tw': gs.Tw = num(a[0]); break;
      case 'Tz': gs.Th = num(a[0]) / 100; break;
      case 'TL': gs.TL = num(a[0]); break;
      case 'Tr': gs.Tr = num(a[0]); break;
      case 'Ts': gs.Ts = num(a[0]); break;
      case 'Tf': gs.Tf = a[0] && a[0].v; gs.fs = num(a[1]); break;
      case 'Td': Tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], Tlm); Tm = Tlm.slice(); break;
      case 'TD': gs.TL = -num(a[1]); Tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], Tlm); Tm = Tlm.slice(); break;
      case 'Tm': Tlm = a.map(num); Tm = Tlm.slice(); break;
      case 'T*': Tlm = mul([1, 0, 0, 1, 0, -gs.TL], Tlm); Tm = Tlm.slice(); break;
      case 'Tj': show(op, a[0], null, ''); break;
      case 'TJ': show(op, null, a[0] && a[0].t === 'arr' ? a[0].v : [], ''); break;
      case "'":
        Tlm = mul([1, 0, 0, 1, 0, -gs.TL], Tlm); Tm = Tlm.slice();
        show(op, a[0], null, 'T* ');
        break;
      case '"':
        gs.Tw = num(a[0]); gs.Tc = num(a[1]);
        Tlm = mul([1, 0, 0, 1, 0, -gs.TL], Tlm); Tm = Tlm.slice();
        show(op, a[2], null, `${num(a[0])} Tw ${num(a[1])} Tc T* `);
        break;
      case 'g': gs.fill = { op: 'g', vals: [num(a[0])] }; gs.fillCS = 'DeviceGray'; break;
      case 'rg': gs.fill = { op: 'rg', vals: a.map(num) }; gs.fillCS = 'DeviceRGB'; break;
      case 'k': gs.fill = { op: 'k', vals: a.map(num) }; gs.fillCS = 'DeviceCMYK'; break;
      case 'cs': gs.fillCS = a[0] && a[0].v; gs.fill = { op: 'g', vals: [0] }; break;
      case 'sc': case 'scn': {
        const vals = a.filter((x) => x.t === 'num').map((x) => x.v);
        const k = csComps(gs.fillCS) || vals.length;
        if (k === 1) gs.fill = { op: 'g', vals: vals.slice(0, 1) };
        else if (k === 3) gs.fill = { op: 'rg', vals: vals.slice(0, 3) };
        else if (k === 4) gs.fill = { op: 'k', vals: vals.slice(0, 4) };
        break;
      }
      default: break;
    }
  }
  void inText;
  return { ops, runs };
}

// Replacement text for a text-show op that keeps the pen advance but draws nothing.
export function blankFor(run) {
  const fsTh = run.fs * run.Th;
  if (!fsTh) return run.extraBefore + '[] TJ';
  const n = -(run.tx * 1000) / fsTh;
  return `${run.extraBefore}[${fmt(n)}] TJ`;
}

export function fmt(v) {
  if (!isFinite(v)) return '0';
  const r = Math.round(v * 1000) / 1000;
  return (Object.is(r, -0) ? 0 : r).toString();
}

// Apply byte-range replacements [{s,e,text}] to the content bytes.
export function splice(bytes, reps) {
  reps = reps.slice().sort((x, y) => x.s - y.s);
  const parts = [];
  let pos = 0;
  const enc = new TextEncoder();
  for (const r of reps) {
    if (r.s < pos) continue;
    parts.push(bytes.subarray(pos, r.s));
    parts.push(enc.encode(' ' + r.text + ' '));
    pos = r.e;
  }
  parts.push(bytes.subarray(pos));
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Minimal CMap parsing (ToUnicode + codespace ranges)
export function parseCMap(bytes) {
  const toks = tokenize(bytes);
  const map = new Map();
  const spaces = [];
  const utf16 = (b) => {
    let s = '';
    for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]);
    if (b.length % 2) s += String.fromCharCode(b[b.length - 1]);
    return s;
  };
  const code = (b) => b.reduce((a, x) => a * 256 + x, 0);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t !== 'op') continue;
    if (t.v === 'begincodespacerange') {
      for (i++; i < toks.length && !(toks[i].t === 'op' && toks[i].v === 'endcodespacerange'); i += 2) {
        if (toks[i].t === 'str' && toks[i + 1] && toks[i + 1].t === 'str')
          spaces.push({ len: toks[i].v.length, lo: code(toks[i].v), hi: code(toks[i + 1].v) });
      }
    } else if (t.v === 'beginbfchar') {
      for (i++; i < toks.length && !(toks[i].t === 'op' && toks[i].v === 'endbfchar'); i += 2) {
        if (toks[i].t === 'str' && toks[i + 1] && toks[i + 1].t === 'str') map.set(code(toks[i].v), utf16(toks[i + 1].v));
      }
    } else if (t.v === 'beginbfrange') {
      i++;
      while (i < toks.length && !(toks[i].t === 'op' && toks[i].v === 'endbfrange')) {
        const lo = toks[i], hi = toks[i + 1], dst = toks[i + 2];
        if (!lo || !hi || !dst || lo.t !== 'str' || hi.t !== 'str') { i++; continue; }
        const a = code(lo.v), b = code(hi.v);
        if (dst.t === 'str') {
          const base = Array.from(dst.v);
          for (let c = a; c <= b && c - a < 65536; c++) {
            const d = base.slice();
            let add = c - a, k = d.length - 1;
            while (add > 0 && k >= 0) { const s = d[k] + add; d[k] = s & 255; add = s >> 8; k--; }
            map.set(c, utf16(d));
          }
          i += 3;
        } else if (dst.t === '[') {
          let j = i + 3, c = a;
          while (j < toks.length && toks[j].t !== ']') { if (toks[j].t === 'str') map.set(c++, utf16(toks[j].v)); j++; }
          i = j + 1;
        } else i += 3;
      }
    }
  }
  return { map, spaces };
}
