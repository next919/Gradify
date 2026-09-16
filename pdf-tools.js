(() => {
  'use strict';

  const PDFLibRef = window.PDFLib || {};
  const { PDFDocument, StandardFonts, rgb } = PDFLibRef;
  const pdfjsLib = window.pdfjsLib;
  const fontkitRef = window.fontkit;

  const ARABIC_FONT_URL = 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansArabic/hinted/ttf/NotoSansArabic-Regular.ttf';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  if (pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const $ = (id) => document.getElementById(id);
  const toolTabs = [...document.querySelectorAll('.toolTab')];
  const editorTool = $('editorTool');
  const mergeTool = $('mergeTool');

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const isPdf = (file) => file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

  const setStatus = (element, message = '', type = '') => {
    if (!element) return;
    element.textContent = message;
    element.className = `status${type ? ` ${type}` : ''}`;
  };

  const downloadPdf = (bytes, filename) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  };

  const safeFilename = (name, fallback = 'document') => {
    const base = (name || fallback).replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '');
    return base || fallback;
  };

  const openTool = (name) => {
    toolTabs.forEach((tab) => {
      const active = tab.dataset.tool === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const editorActive = name === 'editor';
    editorTool.hidden = !editorActive;
    mergeTool.hidden = editorActive;
    editorTool.classList.toggle('active', editorActive);
    mergeTool.classList.toggle('active', !editorActive);
  };
  toolTabs.forEach((tab) => tab.addEventListener('click', () => openTool(tab.dataset.tool)));

  const editorFileInput = $('editorFileInput');
  const editorDropZone = $('editorDropZone');
  const editorWorkspace = $('editorWorkspace');
  const editorFileName = $('editorFileName');
  const editorFileMeta = $('editorFileMeta');
  const changeEditorFileBtn = $('changeEditorFileBtn');
  const currentPageLabel = $('currentPageLabel');
  const pageCountLabel = $('pageCountLabel');
  const prevPageBtn = $('prevPageBtn');
  const nextPageBtn = $('nextPageBtn');
  const previewShell = $('previewShell');
  const previewStage = $('previewStage');
  const pdfCanvas = $('pdfCanvas');
  const textOverlayLayer = $('textOverlayLayer');
  const arabicText = $('arabicText');
  const fontSize = $('fontSize');
  const fontColor = $('fontColor');
  const colorValue = $('colorValue');
  const coverOldText = $('coverOldText');
  const addTextBtn = $('addTextBtn');
  const updateTextBtn = $('updateTextBtn');
  const deleteTextBtn = $('deleteTextBtn');
  const clearEditsBtn = $('clearEditsBtn');
  const saveEditedPdfBtn = $('saveEditedPdfBtn');
  const selectionHint = $('selectionHint');
  const editCountLabel = $('editCountLabel');
  const editorStatus = $('editorStatus');

  const editorState = {
    file: null,
    bytes: null,
    pdf: null,
    currentPage: 1,
    pageCount: 0,
    pageWidth: 0,
    pageHeight: 0,
    cssScale: 1,
    overlays: [],
    selectedId: null,
    renderToken: 0,
    fontBytes: null,
  };

  let overlayId = 0;

  const editorReady = () => PDFDocument && pdfjsLib && fontkitRef;

  const updateEditorButtons = () => {
    const selected = editorState.overlays.find((item) => item.id === editorState.selectedId);
    updateTextBtn.disabled = !selected;
    deleteTextBtn.disabled = !selected;
    clearEditsBtn.disabled = editorState.overlays.length === 0;
    saveEditedPdfBtn.disabled = editorState.overlays.length === 0 || !editorState.file;
    editCountLabel.textContent = `${editorState.overlays.length} ${editorState.overlays.length === 1 ? 'تعديل' : 'تعديلات'}`;
    if (selected) {
      selectionHint.textContent = `تم تحديد نص في الصفحة ${selected.page}. يمكنك تحديثه أو سحبه.`;
      selectionHint.classList.add('active');
    } else {
      selectionHint.textContent = 'لم يتم تحديد أي نص مضاف.';
      selectionHint.classList.remove('active');
    }
  };

  const selectOverlay = (id, syncControls = true) => {
    editorState.selectedId = id;
    const selected = editorState.overlays.find((item) => item.id === id);
    if (selected && syncControls) {
      arabicText.value = selected.text;
      fontSize.value = selected.fontSize;
      fontColor.value = selected.color;
      colorValue.textContent = selected.color.toUpperCase();
      coverOldText.checked = selected.cover;
    }
    renderOverlays();
    updateEditorButtons();
  };

  const clearSelection = () => selectOverlay(null, false);

  const makeOverlayElement = (item) => {
    const div = document.createElement('div');
    div.className = `addedText${item.id === editorState.selectedId ? ' selected' : ''}${item.cover ? ' cover' : ''}`;
    div.dataset.id = String(item.id);
    div.textContent = item.text;
    div.style.right = `${item.right * 100}%`;
    div.style.top = `${item.top * 100}%`;
    div.style.fontSize = `${Math.max(8, item.fontSize * editorState.cssScale)}px`;
    div.style.color = item.color;
    div.title = 'اسحب النص لتغيير مكانه';

    div.addEventListener('pointerdown', (event) => beginDrag(event, item, div));
    div.addEventListener('click', (event) => {
      event.stopPropagation();
      selectOverlay(item.id);
    });
    return div;
  };

  const renderOverlays = () => {
    textOverlayLayer.innerHTML = '';
    editorState.overlays
      .filter((item) => item.page === editorState.currentPage)
      .forEach((item) => textOverlayLayer.appendChild(makeOverlayElement(item)));
  };

  const beginDrag = (event, item, element) => {
    event.preventDefault();
    event.stopPropagation();
    selectOverlay(item.id, true);
    element.setPointerCapture?.(event.pointerId);
    element.classList.add('dragging');

    const stageRect = previewStage.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = elementRect.left - stageRect.left;
    const startTop = elementRect.top - stageRect.top;

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const left = Math.max(0, Math.min(stageRect.width - width, startLeft + dx));
      const top = Math.max(0, Math.min(stageRect.height - height, startTop + dy));
      const right = stageRect.width - left - width;
      item.right = Math.max(0, Math.min(1, right / stageRect.width));
      item.top = Math.max(0, Math.min(1, top / stageRect.height));
      element.style.right = `${item.right * 100}%`;
      element.style.top = `${item.top * 100}%`;
    };

    const onEnd = () => {
      element.classList.remove('dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onEnd, { once: true });
    window.addEventListener('pointercancel', onEnd, { once: true });
  };

  const renderEditorPage = async () => {
    if (!editorState.pdf) return;
    const token = ++editorState.renderToken;
    setStatus(editorStatus, `جاري عرض الصفحة ${editorState.currentPage}...`, 'loading');

    try {
      const page = await editorState.pdf.getPage(editorState.currentPage);
      if (token !== editorState.renderToken) return;
      const baseViewport = page.getViewport({ scale: 1 });
      editorState.pageWidth = baseViewport.width;
      editorState.pageHeight = baseViewport.height;

      const available = Math.max(260, Math.min(860, previewShell.clientWidth - 28));
      const scale = Math.max(0.32, Math.min(1.55, available / baseViewport.width));
      editorState.cssScale = scale;
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      pdfCanvas.width = Math.floor(viewport.width * dpr);
      pdfCanvas.height = Math.floor(viewport.height * dpr);
      pdfCanvas.style.width = `${viewport.width}px`;
      pdfCanvas.style.height = `${viewport.height}px`;
      previewStage.style.width = `${viewport.width}px`;
      previewStage.style.height = `${viewport.height}px`;

      const context = pdfCanvas.getContext('2d', { alpha: false });
      await page.render({
        canvasContext: context,
        viewport,
        transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0],
      }).promise;

      if (token !== editorState.renderToken) return;
      currentPageLabel.textContent = editorState.currentPage;
      pageCountLabel.textContent = editorState.pageCount;
      prevPageBtn.disabled = editorState.currentPage <= 1;
      nextPageBtn.disabled = editorState.currentPage >= editorState.pageCount;
      clearSelection();
      renderOverlays();
      setStatus(editorStatus, 'المعاينة جاهزة. أضف النص ثم اسحبه إلى موضعه.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(editorStatus, 'تعذر عرض هذه الصفحة. جرّب ملف PDF آخر.', 'error');
    }
  };

  const loadEditorFile = async (file) => {
    if (!isPdf(file)) {
      setStatus(editorStatus, 'اختر ملف PDF صالحًا.', 'error');
      return;
    }
    if (!editorReady()) {
      setStatus(editorStatus, 'تعذر تحميل محرك التحرير. أعد تحميل الصفحة وتأكد من اتصال الإنترنت.', 'error');
      return;
    }

    setStatus(editorStatus, 'جاري فتح الملف محليًا...', 'loading');
    editorDropZone.hidden = true;
    editorWorkspace.hidden = false;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      editorState.file = file;
      editorState.bytes = bytes;
      editorState.pdf = pdf;
      editorState.currentPage = 1;
      editorState.pageCount = pdf.numPages;
      editorState.overlays = [];
      editorState.selectedId = null;
      editorFileName.textContent = file.name;
      editorFileMeta.textContent = `${formatBytes(file.size)} • ${pdf.numPages} ${pdf.numPages === 1 ? 'صفحة' : 'صفحات'}`;
      updateEditorButtons();
      await renderEditorPage();
    } catch (error) {
      console.error(error);
      editorState.file = null;
      editorState.bytes = null;
      editorState.pdf = null;
      editorWorkspace.hidden = true;
      editorDropZone.hidden = false;
      const encrypted = /password|encrypted/i.test(String(error));
      setStatus(editorStatus, encrypted ? 'الملف محمي بكلمة مرور ولا يمكن فتحه في النسخة الحالية.' : 'تعذر فتح ملف PDF. جرّب نسخة أخرى من الملف.', 'error');
    }
  };

  const addEditorText = () => {
    const text = arabicText.value.trim();
    if (!text) {
      setStatus(editorStatus, 'اكتب النص الذي تريد إضافته أولًا.', 'error');
      arabicText.focus();
      return;
    }
    if (!editorState.file) {
      setStatus(editorStatus, 'اختر ملف PDF أولًا.', 'error');
      return;
    }

    const item = {
      id: ++overlayId,
      page: editorState.currentPage,
      text,
      fontSize: Math.max(8, Math.min(96, Number(fontSize.value) || 22)),
      color: fontColor.value || '#111827',
      cover: coverOldText.checked,
      right: 0.10,
      top: 0.14,
    };
    editorState.overlays.push(item);
    selectOverlay(item.id, false);
    setStatus(editorStatus, 'تمت إضافة النص. اسحبه الآن إلى المكان المطلوب.', 'success');
  };

  const updateSelectedText = () => {
    const selected = editorState.overlays.find((item) => item.id === editorState.selectedId);
    if (!selected) return;
    const text = arabicText.value.trim();
    if (!text) {
      setStatus(editorStatus, 'لا يمكن تحديث النص بقيمة فارغة.', 'error');
      return;
    }
    selected.text = text;
    selected.fontSize = Math.max(8, Math.min(96, Number(fontSize.value) || 22));
    selected.color = fontColor.value || '#111827';
    selected.cover = coverOldText.checked;
    renderOverlays();
    updateEditorButtons();
    setStatus(editorStatus, 'تم تحديث النص المحدد.', 'success');
  };

  const deleteSelectedText = () => {
    if (!editorState.selectedId) return;
    editorState.overlays = editorState.overlays.filter((item) => item.id !== editorState.selectedId);
    editorState.selectedId = null;
    renderOverlays();
    updateEditorButtons();
    setStatus(editorStatus, 'تم حذف التعديل المحدد.', 'success');
  };

  const clearAllEdits = () => {
    if (!editorState.overlays.length) return;
    if (!window.confirm('هل تريد مسح جميع التعديلات المضافة؟')) return;
    editorState.overlays = [];
    editorState.selectedId = null;
    renderOverlays();
    updateEditorButtons();
    setStatus(editorStatus, 'تم مسح جميع التعديلات.', 'success');
  };

  const hexToRgb = (hex) => {
    const clean = (hex || '#111827').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
    return {
      r: parseInt(full.slice(0, 2), 16) / 255,
      g: parseInt(full.slice(2, 4), 16) / 255,
      b: parseInt(full.slice(4, 6), 16) / 255,
    };
  };

  const classifyChar = (char) => {
    if (/[A-Za-z0-9]/.test(char)) return 'latin';
    if (/[\u0660-\u0669\u06F0-\u06F9]/.test(char)) return 'arabicDigit';
    if (/\s/.test(char)) return 'space';
    return 'arabic';
  };

  const splitLogicalRuns = (line) => {
    if (!line) return [];
    const runs = [];
    let current = '';
    let currentType = null;

    for (const char of [...line]) {
      let type = classifyChar(char);
      if (type === 'space') type = currentType || 'arabic';
      if (currentType && type !== currentType) {
        runs.push({ type: currentType, text: current });
        current = char;
        currentType = type;
      } else {
        current += char;
        currentType = type;
      }
    }
    if (current) runs.push({ type: currentType || 'arabic', text: current });
    return runs;
  };

  const getRunFont = (run, fonts) => run.type === 'latin' ? fonts.latin : fonts.arabic;

  const measureRtlLine = (line, size, fonts) => splitLogicalRuns(line).reduce((total, run) => {
    const font = getRunFont(run, fonts);
    return total + font.widthOfTextAtSize(run.text, size);
  }, 0);

  const drawRtlLine = (page, line, rightX, y, size, color, fonts) => {
    let cursor = rightX;
    const runs = splitLogicalRuns(line);
    for (const run of runs) {
      const font = getRunFont(run, fonts);
      const width = font.widthOfTextAtSize(run.text, size);
      cursor -= width;
      page.drawText(run.text, { x: cursor, y, size, font, color });
    }
  };

  const loadArabicFontBytes = async () => {
    if (editorState.fontBytes) return editorState.fontBytes;
    const response = await fetch(ARABIC_FONT_URL, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Arabic font download failed: ${response.status}`);
    editorState.fontBytes = new Uint8Array(await response.arrayBuffer());
    return editorState.fontBytes;
  };

  const saveEditedPdf = async () => {
    if (!editorState.file || !editorState.bytes || !editorState.overlays.length) return;
    if (!PDFDocument || !fontkitRef) {
      setStatus(editorStatus, 'تعذر تحميل محرك حفظ PDF.', 'error');
      return;
    }

    saveEditedPdfBtn.disabled = true;
    setStatus(editorStatus, 'جاري تضمين الخط العربي وحفظ الملف محليًا...', 'loading');

    try {
      const doc = await PDFDocument.load(editorState.bytes.slice(), { ignoreEncryption: false, updateMetadata: false });
      doc.registerFontkit(fontkitRef);
      const arabicFontBytes = await loadArabicFontBytes();
      const arabicFont = await doc.embedFont(arabicFontBytes, { subset: true });
      const latinFont = await doc.embedFont(StandardFonts.Helvetica);
      const fonts = { arabic: arabicFont, latin: latinFont };

      for (const item of editorState.overlays) {
        const page = doc.getPage(item.page - 1);
        const { width, height } = page.getSize();
        const size = item.fontSize;
        const lineHeight = size * 1.45;
        const lines = item.text.split(/\r?\n/);
        const rightX = width * (1 - item.right);
        const topY = height * item.top;
        const widths = lines.map((line) => measureRtlLine(line || ' ', size, fonts));
        const maxWidth = Math.max(...widths, size);
        const padding = Math.max(2, size * 0.15);
        const blockHeight = (lines.length * lineHeight) + (padding * 2);

        if (item.cover) {
          page.drawRectangle({
            x: Math.max(0, rightX - maxWidth - padding),
            y: Math.max(0, height - topY - blockHeight),
            width: Math.min(width, maxWidth + (padding * 2)),
            height: Math.min(height, blockHeight),
            color: rgb(1, 1, 1),
            borderWidth: 0,
          });
        }

        const c = hexToRgb(item.color);
        const color = rgb(c.r, c.g, c.b);
        lines.forEach((line, index) => {
          const baseline = height - topY - size - padding - (index * lineHeight);
          drawRtlLine(page, line, rightX - padding, baseline, size, color, fonts);
        });
      }

      const output = await doc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
        updateFieldAppearances: false,
      });
      const base = safeFilename(editorState.file.name, 'gradify-document');
      downloadPdf(output, `${base}-edited-ar.pdf`);
      setStatus(editorStatus, 'تم حفظ الملف. الصفحة الأصلية لم تتحول إلى صورة.', 'success');
    } catch (error) {
      console.error(error);
      const message = /font|fetch|network/i.test(String(error))
        ? 'تعذر تحميل الخط العربي المطلوب للحفظ. تحقق من الإنترنت وحاول مرة أخرى.'
        : 'تعذر حفظ التعديلات على هذا الملف. جرّب PDF آخر غير محمي.';
      setStatus(editorStatus, message, 'error');
    } finally {
      updateEditorButtons();
    }
  };

  editorDropZone.addEventListener('click', () => editorFileInput.click());
  changeEditorFileBtn.addEventListener('click', () => editorFileInput.click());
  editorFileInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) loadEditorFile(file);
    editorFileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((name) => editorDropZone.addEventListener(name, (event) => {
    event.preventDefault();
    editorDropZone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach((name) => editorDropZone.addEventListener(name, (event) => {
    event.preventDefault();
    editorDropZone.classList.remove('dragover');
  }));
  editorDropZone.addEventListener('drop', (event) => {
    const file = [...event.dataTransfer.files].find(isPdf);
    if (file) loadEditorFile(file);
  });

  prevPageBtn.addEventListener('click', async () => {
    if (editorState.currentPage <= 1) return;
    editorState.currentPage -= 1;
    await renderEditorPage();
  });
  nextPageBtn.addEventListener('click', async () => {
    if (editorState.currentPage >= editorState.pageCount) return;
    editorState.currentPage += 1;
    await renderEditorPage();
  });
  textOverlayLayer.addEventListener('click', (event) => {
    if (event.target === textOverlayLayer) clearSelection();
  });
  previewStage.addEventListener('click', (event) => {
    if (event.target === pdfCanvas) clearSelection();
  });
  fontColor.addEventListener('input', () => { colorValue.textContent = fontColor.value.toUpperCase(); });
  addTextBtn.addEventListener('click', addEditorText);
  updateTextBtn.addEventListener('click', updateSelectedText);
  deleteTextBtn.addEventListener('click', deleteSelectedText);
  clearEditsBtn.addEventListener('click', clearAllEdits);
  saveEditedPdfBtn.addEventListener('click', saveEditedPdf);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!editorState.pdf) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderEditorPage, 180);
  });

  const mergeFileInput = $('mergeFileInput');
  const mergeDropZone = $('mergeDropZone');
  const mergeFileArea = $('mergeFileArea');
  const mergeFileList = $('mergeFileList');
  const mergeFileSummary = $('mergeFileSummary');
  const mergeAddMoreBtn = $('mergeAddMoreBtn');
  const mergeBtn = $('mergeBtn');
  const mergeClearBtn = $('mergeClearBtn');
  const mergeStatus = $('mergeStatus');
  let mergeFiles = [];

  const renderMergeFiles = () => {
    mergeFileList.innerHTML = '';
    mergeFileArea.hidden = mergeFiles.length === 0;
    mergeDropZone.hidden = mergeFiles.length > 0;
    const total = mergeFiles.reduce((sum, file) => sum + file.size, 0);
    mergeFileSummary.textContent = `${mergeFiles.length} ملف • ${formatBytes(total)}`;

    mergeFiles.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'fileItem';
      const number = document.createElement('span');
      number.className = 'fileIndex';
      number.textContent = index + 1;
      const meta = document.createElement('div');
      meta.className = 'fileMeta';
      meta.innerHTML = '<div class="fileName"></div><div class="fileSize"></div>';
      meta.querySelector('.fileName').textContent = file.name;
      meta.querySelector('.fileSize').textContent = formatBytes(file.size);
      const controls = document.createElement('div');
      controls.className = 'orderBtns';

      const up = document.createElement('button');
      up.type = 'button'; up.className = 'iconBtn'; up.textContent = '↑'; up.title = 'تحريك لأعلى'; up.disabled = index === 0;
      up.addEventListener('click', () => { [mergeFiles[index - 1], mergeFiles[index]] = [mergeFiles[index], mergeFiles[index - 1]]; renderMergeFiles(); });
      const down = document.createElement('button');
      down.type = 'button'; down.className = 'iconBtn'; down.textContent = '↓'; down.title = 'تحريك لأسفل'; down.disabled = index === mergeFiles.length - 1;
      down.addEventListener('click', () => { [mergeFiles[index + 1], mergeFiles[index]] = [mergeFiles[index], mergeFiles[index + 1]]; renderMergeFiles(); });
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'iconBtn removeBtn'; remove.textContent = 'حذف';
      remove.addEventListener('click', () => { mergeFiles.splice(index, 1); renderMergeFiles(); });
      controls.append(up, down, remove);
      row.append(number, meta, controls);
      mergeFileList.appendChild(row);
    });
  };

  const addMergeFiles = (incoming) => {
    const valid = [...incoming].filter(isPdf);
    if (!valid.length) {
      setStatus(mergeStatus, 'اختر ملفات PDF صالحة.', 'error');
      return;
    }
    mergeFiles.push(...valid);
    renderMergeFiles();
    setStatus(mergeStatus, '');
  };

  const mergePdfs = async () => {
    if (!PDFDocument) {
      setStatus(mergeStatus, 'تعذر تحميل محرك PDF.', 'error');
      return;
    }
    if (mergeFiles.length < 2) {
      setStatus(mergeStatus, 'اختر ملفين على الأقل.', 'error');
      return;
    }
    mergeBtn.disabled = true;
    mergeClearBtn.disabled = true;
    setStatus(mergeStatus, 'جاري دمج الملفات محليًا...', 'loading');
    try {
      const merged = await PDFDocument.create();
      for (let i = 0; i < mergeFiles.length; i += 1) {
        setStatus(mergeStatus, `جاري معالجة الملف ${i + 1} من ${mergeFiles.length}...`, 'loading');
        const bytes = await mergeFiles[i].arrayBuffer();
        const source = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }
      const output = await merged.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50, updateFieldAppearances: false });
      downloadPdf(output, `gradify-merged-${Date.now()}.pdf`);
      setStatus(mergeStatus, 'تم الدمج بدون تحويل الصفحات إلى صور.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(mergeStatus, /encrypted/i.test(String(error)) ? 'أحد الملفات محمي أو مشفر.' : 'تعذر دمج أحد الملفات.', 'error');
    } finally {
      mergeBtn.disabled = false;
      mergeClearBtn.disabled = false;
    }
  };

  mergeDropZone.addEventListener('click', () => mergeFileInput.click());
  mergeAddMoreBtn.addEventListener('click', () => mergeFileInput.click());
  mergeFileInput.addEventListener('change', (event) => {
    addMergeFiles(event.target.files || []);
    mergeFileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((name) => mergeDropZone.addEventListener(name, (event) => {
    event.preventDefault(); mergeDropZone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach((name) => mergeDropZone.addEventListener(name, (event) => {
    event.preventDefault(); mergeDropZone.classList.remove('dragover');
  }));
  mergeDropZone.addEventListener('drop', (event) => addMergeFiles(event.dataTransfer.files));
  mergeBtn.addEventListener('click', mergePdfs);
  mergeClearBtn.addEventListener('click', () => { mergeFiles = []; renderMergeFiles(); setStatus(mergeStatus, ''); });

  updateEditorButtons();
})();
