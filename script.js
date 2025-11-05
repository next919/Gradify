document.addEventListener('DOMContentLoaded', () => {
  // year
  const y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();

  // Fill load timestamp for anti-spam (>=3s)
  const ts = Date.now();
  const tsInput = document.getElementById('loaded_at');
  if (tsInput) tsInput.value = String(ts);

  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const messageStatus = document.getElementById('messageStatus');
  const agree = document.getElementById('agree');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageStatus.textContent = '';
    if (!agree.checked) { messageStatus.textContent = 'يرجى الموافقة على إرسال البيانات.'; return; }
    if (!form.checkValidity()) { messageStatus.textContent = 'تحقق من الحقول المطلوبة.'; return; }

    // Anti-spam checks
    const honey = document.getElementById('hp');
    if (honey && honey.value.trim() !== '') {
      messageStatus.textContent = 'تم رفض الإرسال.';
      return;
    }
    const loaded = parseInt(tsInput.value || '0', 10);
    if (Date.now() - loaded < 3000) { // أقل من 3 ثوانٍ
      messageStatus.textContent = 'يرجى الانتظار لحظة ثم حاول مرة أخرى.';
      return;
    }

    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = 'جاري الإرسال...';

    const formData = new FormData(form);

    try {
      const response = await fetch('https://formspree.io/f/myzbrgwb', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      });
      if (response.ok) {
        messageStatus.textContent = '✅ تم إرسال رسالتك بنجاح! سنرد عليك خلال 24 ساعة.';
        form.reset();
        if (tsInput) tsInput.value = String(Date.now());
      } else {
        messageStatus.textContent = '⚠️ تعذر الإرسال. حاول مرة أخرى لاحقًا.';
      }
    } catch (err) {
      messageStatus.textContent = '❌ خطأ في الشبكة. تحقق من اتصالك.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  });
});