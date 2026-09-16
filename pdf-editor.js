(async () => {
  const $ = (id) => document.getElementById(id);
  const engineNotice = $('engineNotice');
  const pdfInput = $('pdfInput');
  const pickPdf = $('pickPdf');
  const uploadPanel = $('uploadPanel');
  const editorApp = $('editorApp');
  const fileNameEl = $('fileName');
  const fileMeta = $('fileMeta');
  const prevPage = $('prevPage');
  const nextPage = $('nextPage');
  const pageCounter = $('pageCounter');
  const savePdf = $('savePdf');
  const resetEdits = $('resetEdits');
  const viewerScroll = $('viewerScroll');
  const pageStage = $('pageStage');
  const canvas = $('pdfCanvas');
  const textLayer = $('textLayer');
  const textStats = $('textStats');
  const selectionInfo = $('selectionInfo');
  const editBar = $('editBar');
  const finishLineEdit = $('finishLineEdit');
  const cancelLineEdit = $('cancelLineEdit');
  const statusBar = $('statusBar');

  let mupdf;
  let documentRef = null;
  let originalBytes = null;
  let originalFileName = '';
  let currentPage = 0;
  let pageCount = 0;
  let currentCssScale = 1;
  let currentBounds = [0, 0, 595, 842];
  let currentLines = [];
  let activeEditor = null;
  let activeKey = null;
  const edits = new Map();

  const setStatus = (message = '', type = '') => {
    statusBar.textContent = message;
    statusBar.className = `statusBar${type ? ` ${type}` : ''}`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
  };

  const hasArabic = (text) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text || '');
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  async function loadMuPDF() {
    const sources = [
      'https://cdn.jsdelivr.net/npm/mupdf@1.28.1/dist/mupdf.js',
      'https://unpkg.com/mupdf@1.28.1/dist/mupdf.js'
    ];
    let lastError;
    for (const src of sources) {
      try {
        return await import(src);
      } catch (error) {
        lastError = error;
        console.warn('MuPDF source failed:', src, error);
      }
    }
    throw lastError || new Error('تعذر تحميل MuPDF.js');
  }

  try {
    mupdf = await loadMuPDF();
    engineNotice.textContent = 'MuPDF.js جاهز — افتح ملف PDF لبدء اختبار التحرير العربي.';
    engineNotice.className = 'notice ready';
    pickPdf.disabled = false;
  } catch (error) {
    console.error(error);
    engineNotice.textContent = 'تعذر تحميل MuPDF.js. جرّب تحديث الصفحة أو إيقاف مانع المحتوى مؤقتًا.';
    engineNotice.className = 'notice error';
    return;
  }

  function destroyCurrentDocument() {
    closeInlineEditor(true);
    if (documentRef) {
      try { documentRef.destroy(); } catch (_) {}
      documentRef = null;
    }
  }

  async function openPdf(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      engineNotice.textContent = 'اختر ملف PDF صالحًا.';
      engineNotice.className = 'notice error';
      return;
    }
    setStatus('جاري فتح الملف واستخراج النص…');
    try {
      destroyCurrentDocument();
      edits.clear();
      originalBytes = new Uint8Array(await file.arrayBuffer());
      originalFileName = file.name;
      documentRef = mupdf.Document.openDocument(originalBytes, 'application/pdf');
      pageCount = documentRef.countPages();
      currentPage = 0;
      fileNameEl.textContent = file.name;
      fileMeta.textContent = `${pageCount} صفحة · ${formatBytes(file.size)}`;
      uploadPanel.hidden = true;
      editorApp.hidden = false;
      engineNotice.hidden = true;
      await renderPage();
      setStatus('اضغط على أي سطر داخل الصفحة لتعديله مباشرة.');
    } catch (error) {
      console.error(error);
      destroyCurrentDocument();
      setStatus('تعذر فتح الملف. قد يكون محميًا أو يستخدم بنية PDF غير مدعومة في هذه التجربة.', 'error');
      editorApp.hidden = true;
      uploadPanel.hidden = false;
      engineNotice.hidden = false;
    }
  }

  async function renderPage() {
    if (!documentRef) return;
    closeInlineEditor(false);
    textLayer.innerHTML = '';
    textStats.textContent = 'جاري التحليل…';
    setStatus(`جاري عرض الصفحة ${currentPage + 1} بأعلى دقة مناسبة للشاشة…`);

    const page = documentRef.loadPage(currentPage);
    let stext = null;
    let pixmap = null;
    let pngBuffer = null;
    let imageUrl = null;
    try {
      currentBounds = page.getBounds('CropBox');
      const pageWidth = currentBounds[2] - currentBounds[0];
      const pageHeight = currentBounds[3] - currentBounds[1];
      const available = Math.max(280, Math.min(1000, viewerScroll.clientWidth - 28));
      currentCssScale = available / pageWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const renderScale = Math.min(5, currentCssScale * dpr * 1.08);

      pixmap = page.toPixmap(
        mupdf.Matrix.scale(renderScale, renderScale),
        mupdf.ColorSpace.DeviceRGB,
        true,
        false,
        'View',
        'CropBox'
      );
      pngBuffer = pixmap.asPNG();
      const blob = new Blob([pngBuffer.asUint8Array()], { type: 'image/png' });
      imageUrl = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.width = `${pageWidth * currentCssScale}px`;
      canvas.style.height = `${pageHeight * currentCssScale}px`;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      pageStage.style.width = `${pageWidth * currentCssScale}px`;
      pageStage.style.height = `${pageHeight * currentCssScale}px`;
      textLayer.style.width = pageStage.style.width;
      textLayer.style.height = pageStage.style.height;

      stext = page.toStructuredText('preserve-spans,preserve-whitespace');
      const json = JSON.parse(stext.asJSON());
      currentLines = [];
      let lineIndex = 0;
      for (const block of json.blocks || []) {
        if (block.type !== 'text') continue;
        for (const line of block.lines || []) {
          const text = (line.text || '').trim();
          if (!text || !line.bbox || line.bbox.w <= 0 || line.bbox.h <= 0) continue;
          const record = { ...line, text, id: lineIndex++ };
          currentLines.push(record);
          addTextHit(record);
        }
      }

      textStats.textContent = currentLines.length
        ? `${currentLines.length} سطر قابل للتحديد`
        : 'لم يتم العثور على طبقة نص قابلة للتحرير';
      pageCounter.textContent = `${currentPage + 1} / ${pageCount}`;
      prevPage.disabled = currentPage <= 0;
      nextPage.disabled = currentPage >= pageCount - 1;
      setStatus(currentLines.length
        ? 'المعاينة جاهزة. اضغط على النص نفسه لبدء التعديل.'
        : 'هذه الصفحة لا تحتوي نصًا قابلًا للاستخراج؛ قد تكون ممسوحة ضوئيًا أو تستخدم ترميزًا خاصًا.', currentLines.length ? '' : 'error');
    } finally {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (pngBuffer) try { pngBuffer.destroy?.(); } catch (_) {}
      if (pixmap) try { pixmap.destroy(); } catch (_) {}
      if (stext) try { stext.destroy(); } catch (_) {}
      try { page.destroy(); } catch (_) {}
    }
  }

  function lineKey(line) {
    return `${currentPage}:${line.id}`;
  }

  function addTextHit(line) {
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'textHit';
    hit.dataset.lineId = String(line.id);
    const x = (line.bbox.x - currentBounds[0]) * currentCssScale;
    const y = (line.bbox.y - currentBounds[1]) * currentCssScale;
    const w = line.bbox.w * currentCssScale;
    const h = line.bbox.h * currentCssScale;
    hit.style.left = `${x}px`;
    hit.style.top = `${y}px`;
    hit.style.width = `${Math.max(w, 8)}px`;
    hit.style.height = `${Math.max(h, 8)}px`;
    hit.setAttribute('aria-label', `تعديل النص: ${line.text}`);
    hit.title = line.text;
    const key = lineKey(line);
    if (edits.has(key)) hit.classList.add('changed');
    hit.addEventListener('click', () => selectLine(line, hit));
    textLayer.appendChild(hit);
  }

  function selectLine(line, hit) {
    closeInlineEditor(false);
    textLayer.querySelectorAll('.textHit.active').forEach((el) => el.classList.remove('active'));
    hit.classList.add('active');
    const key = lineKey(line);
    activeKey = key;
    const existing = edits.get(key);
    const value = existing ? existing.replacement : line.text;
    const rtl = hasArabic(value || line.text);

    const editor = document.createElement('textarea');
    editor.className = 'inlineEditor';
    editor.value = value;
    editor.dir = rtl ? 'rtl' : 'ltr';
    editor.style.textAlign = rtl ? 'right' : 'left';
    editor.style.fontWeight = line.font?.weight === 'bold' ? '700' : '400';
    editor.style.fontStyle = line.font?.style === 'italic' ? 'italic' : 'normal';
    editor.style.fontSize = `${Math.max(12, (line.font?.size || 12) * currentCssScale)}px`;

    const x = (line.bbox.x - currentBounds[0]) * currentCssScale;
    const y = (line.bbox.y - currentBounds[1]) * currentCssScale;
    const originalW = line.bbox.w * currentCssScale;
    const pageW = currentBounds[2] - currentBounds[0];
    const maxW = pageW * currentCssScale - x - 4;
    const wantedW = Math.max(originalW + 20, 130);
    editor.style.left = `${x}px`;
    editor.style.top = `${Math.max(0, y - 2)}px`;
    editor.style.width = `${Math.min(maxW, wantedW)}px`;
    editor.style.height = `${Math.max(line.bbox.h * currentCssScale + 10, 34)}px`;

    editor.addEventListener('input', () => {
      editor.dir = hasArabic(editor.value) ? 'rtl' : 'ltr';
      editor.style.textAlign = hasArabic(editor.value) ? 'right' : 'left';
      rememberEdit(line, editor.value);
    });
    editor.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') finishActiveEdit();
      if (event.key === 'Escape') cancelActiveEdit();
    });

    textLayer.appendChild(editor);
    activeEditor = { editor, line, hit };
    rememberEdit(line, value);
    showSelection(line, value);
    editBar.hidden = false;
    requestAnimationFrame(() => {
      editor.focus();
      editor.select();
    });
  }

  function rememberEdit(line, replacement) {
    const key = lineKey(line);
    const dirty = replacement !== line.text;
    if (!dirty) {
      edits.delete(key);
    } else {
      edits.set(key, {
        page: currentPage,
        lineId: line.id,
        original: line.text,
        replacement,
        bbox: { ...line.bbox },
        font: { ...(line.font || {}) }
      });
    }
    if (activeEditor) activeEditor.hit.classList.toggle('changed', dirty);
    showSelection(line, replacement);
  }

  function showSelection(line, replacement) {
    const fontName = line.font?.name || 'غير معروف';
    selectionInfo.className = 'selectionInfo';
    selectionInfo.innerHTML = `
      <b>النص المحدد</b>
      <span>${escapeHtml(replacement)}</span>
      <code>${escapeHtml(fontName)} · ${line.font?.size || '—'} pt</code>
    `;
  }

  function closeInlineEditor(keepDraft = false) {
    if (!activeEditor) return;
    if (!keepDraft) rememberEdit(activeEditor.line, activeEditor.editor.value);
    activeEditor.editor.remove();
    activeEditor.hit.classList.remove('active');
    activeEditor = null;
    activeKey = null;
    editBar.hidden = true;
  }

  function finishActiveEdit() {
    if (!activeEditor) return;
    const hit = activeEditor.hit;
    closeInlineEditor(false);
    hit.classList.toggle('changed', edits.has(`${currentPage}:${hit.dataset.lineId}`));
    selectionInfo.className = 'selectionInfo empty';
    selectionInfo.textContent = 'تم اعتماد التعديل. يمكنك اختيار سطر آخر أو حفظ الملف.';
  }

  function cancelActiveEdit() {
    if (!activeEditor) return;
    const { line, hit, editor } = activeEditor;
    const key = lineKey(line);
    edits.delete(key);
    editor.remove();
    hit.classList.remove('active', 'changed');
    activeEditor = null;
    activeKey = null;
    editBar.hidden = true;
    selectionInfo.className = 'selectionInfo empty';
    selectionInfo.textContent = 'تم إلغاء تعديل السطر.';
  }

  function expandedRect(edit, pageBounds) {
    const padX = 0.8;
    const padY = 0.4;
    return [
      Math.max(pageBounds[0], edit.bbox.x - padX),
      Math.max(pageBounds[1], edit.bbox.y - padY),
      Math.min(pageBounds[2], edit.bbox.x + edit.bbox.w + padX),
      Math.min(pageBounds[3], edit.bbox.y + edit.bbox.h + padY)
    ];
  }

  async function saveEditedDocument() {
    closeInlineEditor(false);
    const dirtyEdits = [...edits.values()].filter((e) => e.replacement !== e.original);
    if (!dirtyEdits.length) {
      setStatus('لا توجد تعديلات لحفظها بعد.', 'error');
      return;
    }
    savePdf.disabled = true;
    resetEdits.disabled = true;
    setStatus(`جاري حفظ ${dirtyEdits.length} تعديل بدون إعادة تصوير صفحات PDF…`);

    let workDoc = null;
    try {
      workDoc = mupdf.Document.openDocument(originalBytes.slice(), 'application/pdf');
      const pdfDoc = workDoc.asPDF();
      const byPage = new Map();
      for (const edit of dirtyEdits) {
        if (!byPage.has(edit.page)) byPage.set(edit.page, []);
        byPage.get(edit.page).push(edit);
      }

      for (const [pageIndex, pageEdits] of byPage.entries()) {
        const page = pdfDoc.loadPage(pageIndex);
        try {
          const bounds = page.getBounds('CropBox');
          for (const edit of pageEdits) {
            const redact = page.createAnnotation('Redact');
            redact.setRect(expandedRect(edit, bounds));
            redact.update();
          }
          page.applyRedactions(
            false,
            mupdf.PDFPage.REDACT_IMAGE_NONE,
            mupdf.PDFPage.REDACT_LINE_ART_NONE,
            mupdf.PDFPage.REDACT_TEXT_REMOVE
          );

          for (const edit of pageEdits) {
            const replacement = edit.replacement.trim();
            if (!replacement) continue;
            const rtl = hasArabic(replacement);
            const rect = expandedRect(edit, bounds);
            const extra = Math.min(edit.bbox.w * 0.45, 90);
            if (rtl) rect[0] = Math.max(bounds[0], rect[0] - extra);
            else rect[2] = Math.min(bounds[2], rect[2] + extra);

            const annot = page.createAnnotation('FreeText');
            annot.setRect(rect);
            annot.setContents(replacement);
            if (annot.setLanguage) annot.setLanguage(rtl ? 'ar-SA' : 'en');
            const size = Math.max(5, Math.min(72, edit.font?.size || edit.bbox.h * 0.82 || 12));
            if (annot.setDefaultAppearance) annot.setDefaultAppearance('Helv', size, [0, 0, 0]);
            if (annot.setQuadding) annot.setQuadding(rtl ? 2 : 0);

            if (annot.hasRichContents?.()) {
              const dir = rtl ? 'rtl' : 'ltr';
              const align = rtl ? 'right' : 'left';
              annot.setRichDefaults?.(`font-size:${size}pt; font-family:sans-serif; direction:${dir}; text-align:${align}; color:#000000;`);
              annot.setRichContents(
                replacement,
                `<p dir="${dir}" style="font-size:${size}pt; font-family:sans-serif; direction:${dir}; text-align:${align}; margin:0; color:#000000;">${escapeHtml(replacement)}</p>`
              );
            }
            annot.update();
          }
          page.update();
        } finally {
          page.destroy();
        }
      }

      const output = pdfDoc.saveToBuffer('garbage,compress');
      const bytes = output.asUint8Array();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = originalFileName.replace(/\.pdf$/i, '') || 'document';
      a.href = url;
      a.download = `${base}-gradify-edited.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      output.destroy?.();
      setStatus('تم إنشاء الملف. افحص الآن اتصال الحروف العربية والوضوح عند التكبير 400% أو أكثر.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(`تعذر حفظ التعديل في هذا الملف: ${error?.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      if (workDoc) try { workDoc.destroy(); } catch (_) {}
      savePdf.disabled = false;
      resetEdits.disabled = false;
    }
  }

  pickPdf.addEventListener('click', () => pdfInput.click());
  pdfInput.addEventListener('change', () => {
    const [file] = pdfInput.files || [];
    if (file) openPdf(file);
    pdfInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((name) => pickPdf.addEventListener(name, (e) => {
    e.preventDefault();
    if (!pickPdf.disabled) pickPdf.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach((name) => pickPdf.addEventListener(name, (e) => {
    e.preventDefault();
    pickPdf.classList.remove('drag');
  }));
  pickPdf.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) openPdf(file);
  });
  prevPage.addEventListener('click', async () => {
    if (currentPage <= 0) return;
    closeInlineEditor(false);
    currentPage--;
    await renderPage();
  });
  nextPage.addEventListener('click', async () => {
    if (currentPage >= pageCount - 1) return;
    closeInlineEditor(false);
    currentPage++;
    await renderPage();
  });
  finishLineEdit.addEventListener('click', finishActiveEdit);
  cancelLineEdit.addEventListener('click', cancelActiveEdit);
  savePdf.addEventListener('click', saveEditedDocument);
  resetEdits.addEventListener('click', async () => {
    closeInlineEditor(true);
    edits.clear();
    selectionInfo.className = 'selectionInfo empty';
    selectionInfo.textContent = 'تم مسح جميع التعديلات.';
    await renderPage();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    if (!documentRef) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderPage(), 220);
  });
})();
