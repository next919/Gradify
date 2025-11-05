const reciters = [
  { id: 'abdelbasset', name: 'الشيخ عبدالباسط (مجود)', base: 'https://download.quranicaudio.com/quran/abdul_basit/mujawwad/' },
  { id: 'alafasy', name: 'الشيخ مشاري العفاسي', base: 'https://server12.mp3quran.net/afs/' }
];

const surahNames = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام"];

const reciterSelect = document.getElementById("reciterSelect");
const surahList = document.getElementById("surahList");
const search = document.getElementById("surahSearch");
const player = document.getElementById("player");

reciters.forEach(r => {
  const opt = document.createElement("option");
  opt.value = r.id;
  opt.textContent = r.name;
  reciterSelect.appendChild(opt);
});

function renderList() {
  surahList.innerHTML = "";
  surahNames.forEach((name, i) => {
    if (!name.includes(search.value)) return;
    const div = document.createElement("div");
    div.textContent = (i+1).toString().padStart(3,'0') + " - " + name;
    div.onclick = () => {
      const rec = reciters.find(r => r.id === reciterSelect.value);
      player.src = rec.base + (i+1).toString().padStart(3,'0') + ".mp3";
      player.play();
    };
    surahList.appendChild(div);
  });
}

search.oninput = renderList;
reciterSelect.onchange = renderList;
renderList();
