# Gradify — gradifysa.com

Static site on GitHub Pages (branch `main`, root; custom domain in `CNAME`).

| Path | What |
|---|---|
| `index.html`, `home.js` | Home: portal cards, site search, verse of the day, hidden «المزيد» (useful sites + Web3Forms contact) |
| `data.js`, `common.js`, `styles.css`, `analytics.js` | Shared data (surahs, AI, English, useful), UI helpers, styles, Google Analytics |
| `ai/`, `english/` | AI sites and English resources by category |
| `privacy/` | Privacy policy |
| `quran/` | Quran: read & listen ayah by ayah with repeat, tafsir, memorization mode; full surahs (MP3Quran); search |
| `pdf/` | Arabic PDF editor — copied from [next919/arabic-pdf-editor](https://github.com/next919/arabic-pdf-editor) by its `scripts/sync-to-gradify.py` (do not edit here) |
| `nidaa/` | Nidaa prayer-times app download page (link points to the latest release of next919/Nidaa-Downloads) |
| `gpa.html`, `gpa.js` | GPA calculator (Saudi unified table; university picks the default scale 4/5) |

Data sources: AlQuran Cloud API (text, ayah audio, tafsir al-Muyassar, search), MP3Quran API (full-surah reciters).

If a change doesn't show, hard refresh (Ctrl+F5) — Pages caches for ~10 minutes.
