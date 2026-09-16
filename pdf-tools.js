(() => {
  const { PDFDocument } = window.PDFLib || {};
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const fileArea = document.getElementById('fileArea');
  const fileList = document.getElementById('fileList');
  const fileSummary = document.getElementById('fileSummary');
  const addMoreBtn = document.getElementById('addMoreBtn');
  const mergeBtn = document.getElementById('mergeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const status = document.getElementById('status');

  let files = [];

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const setStatus = (message = '', type = '') => {
    status.textContent = message;
    status.className = `status${type ? ` ${type}` : ''}`;
  };

  const isPdf = (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const addFiles = (incoming) => {
    const valid = [...incoming].filter(isPdf);
    if (!valid.length) {
      setStatus('اختر ملفات PDF صالحة.', 'error');
      return;
    }
    files.push(...valid);
    renderFiles();
    setStatus('');
  };

  const moveFile = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= files.length) return;
    [files[index], files[newIndex]] = [files[newIndex], files[index]];
    renderFiles();
  };

  const removeFile = (index) => {
    files.splice(index, 1);
    renderFiles();
  };

  const renderFiles = () => {
    fileList.innerHTML = '';
    fileArea.hidden = files.length === 0;
    dropZone.hidden = files.length > 0;

    const total = files.reduce((sum, f) => sum + f.size, 0);
    fileSummary.textContent = `${files.length} ملف — ${formatBytes(total)}`;

    files.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'fileItem';

      const badge = document.createElement('div');
      badge.className = 'dropIcon';
      badge.textContent = index + 1;

      const meta = document.createElement('div');
      meta.className = 'fileMeta';
      meta.innerHTML = `<div class="fileName"></div><div class="fileSize">${formatBytes(file.size)}</div>`;
      meta.querySelector('.fileName').textContent = file.name;

      const controls = document.createElement('div');
      controls.className = 'orderBtns';

      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'iconBtn';
      up.textContent = '↑';
      up.title = 'تحريك لأعلى';
      up.disabled = index === 0;
      up.addEventListener('click', () => moveFile(index, -1));

      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'iconBtn';
      down.textContent = '↓';
      down.title = 'تحريك لأسفل';
      down.disabled = index === files.length - 1;
      down.addEventListener('click', () => moveFile(index, 1));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'iconBtn removeBtn';
      remove.textContent = 'حذف';
      remove.addEventListener('click', () => removeFile(index));

      controls.append(up, down, remove);
      item.append(badge, meta, controls);
      fileList.appendChild(item);
    });
  };

  const downloadBlob = (bytes, filename) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const mergePdfs = async () => {
    if (!PDFDocument) {
      setStatus('تعذر تحميل محرك PDF. تأكد من اتصال الإنترنت وأعد المحاولة.', 'error');
      return;
    }
    if (files.length < 2) {
      setStatus('اختر ملفين PDF على الأقل للدمج.', 'error');
      return;
    }

    mergeBtn.disabled = true;
    clearBtn.disabled = true;
    setStatus('جاري دمج الملفات محليًا على جهازك...');

    try {
      const merged = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        setStatus(`جاري معالجة الملف ${i + 1} من ${files.length}...`);
        const bytes = await files[i].arrayBuffer();
        const source = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
        const copiedPages = await merged.copyPages(source, source.getPageIndices());
        copiedPages.forEach((page) => merged.addPage(page));
      }

      const output = await merged.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
        updateFieldAppearances: false
      });

      downloadBlob(output, `gradify-merged-${Date.now()}.pdf`);
      setStatus('تم الدمج بنجاح. الملف الجديد جاهز للتنزيل.', 'success');
    } catch (error) {
      console.error(error);
      const message = /encrypted/i.test(String(error))
        ? 'أحد الملفات محمي بكلمة مرور أو بتشفير لا تدعمه النسخة الحالية.'
        : 'تعذر دمج أحد الملفات. جرّب ملف PDF آخر أو نسخة غير محمية.';
      setStatus(message, 'error');
    } finally {
      mergeBtn.disabled = false;
      clearBtn.disabled = false;
    }
  };

  dropZone.addEventListener('click', () => fileInput.click());
  addMoreBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    addFiles(e.target.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  mergeBtn.addEventListener('click', mergePdfs);
  clearBtn.addEventListener('click', () => {
    files = [];
    renderFiles();
    setStatus('');
  });
})();
