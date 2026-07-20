// Sistem gostergeleri. Butonlarla ayni izgarada dururlar, dolayisiyla sayfa,
// sutun, ekrana yay ve suruklemeyle siralama ozelliklerini oldugu gibi kullanirlar.
//
// Butonlar basilmak icin var, gostergeler okunmak icin. Bu yuzden dolgulu ve
// kabarik degil, panele gomulu bir alet gibi duruyorlar: yuzey rengi zemin,
// atanan renk yalnizca yayin uzerinde.
//
// Cizim ve guncelleme ayrilmistir: renderWidget() DOM'u bir kez kurar,
// updateWidgets() saniyede bir yalnizca sayilari ve yay uzunlugunu degistirir.
// Her olcumde izgarayi bastan cizmek suruklemeyi ve duzenlemeyi bozardi.

// 270 derecelik yay: altta acik kalan bosluk etiket icin yer birakiyor ve
// gostergeye kadran gorunumu veriyor. pathLength="100" sayesinde dolgu
// hesabi dogrudan yuzde, yariçapa bagli bir aritmetik gerekmiyor.
const GAUGE_ARC = 'M21.72 78.28 A40 40 0 1 1 78.28 78.28';

const WIDGET_TYPES = {
  cpu: {
    labelKey: 'wCpu', icon: '⚙', shape: 'gauge', warn: 90,
    read: (s) => (s && typeof s.cpu === 'number' ? s.cpu : null)
  },
  gpu: {
    labelKey: 'wGpu', icon: '🎮', shape: 'gauge', warn: 90,
    read: (s) => (s && typeof s.gpu === 'number' ? s.gpu : null)
  },
  ram: {
    labelKey: 'wRam', icon: '🧠', shape: 'gauge', warn: 90,
    read: (s) => (s && s.ram ? s.ram.pct : null),
    sub: (s) => (s && s.ram ? bytesShort(s.ram.used) + ' / ' + bytesShort(s.ram.total) : '')
  },
  disk: {
    labelKey: 'wDisk', icon: '💽', shape: 'gauge', warn: 90,
    read: (s, w) => { const d = pickDrive(s, w); return d ? d.pct : null; },
    sub: (s, w) => {
      const d = pickDrive(s, w);
      return d ? bytesShort(d.total - d.used) + ' ' + t('wFree') : '';
    },
    // Etiket surucu harfini tasisin: iki disk gostergesi yan yana ayirt edilebilsin.
    label: (w) => t('wDisk') + (w.drive ? ' ' + w.drive : '')
  },
  diskio: {
    labelKey: 'wDiskIo', icon: '📀', shape: 'gauge', warn: 90,
    read: (s) => (s && typeof s.diskBusy === 'number' ? s.diskBusy : null)
  },
  temp: {
    labelKey: 'wTemp', icon: '🌡', shape: 'gauge', unit: '°', warn: 80,
    // Sicaklik yuzde degil: 20-95 C araligini yaya esliyoruz, yoksa yay hep
    // dolu gorunur ve degisim fark edilmez.
    min: 20, max: 95,
    read: (s) => (s && typeof s.temp === 'number' ? s.temp : null),
    // Sicaklik okunamiyorsa sebebini soyle: yetki sorunu host'u yonetici olarak
    // calistirinca cozulur, donanimin termal bolge yayinlamamasi cozulmez.
    // Ikisine ayni seyi demek kullaniciyi bosuna ugrastirirdi.
    why: (s) => (s && s.tempWhy === 'admin' ? t('wNeedsAdmin') : t('wNotSupported'))
  },
  net: {
    labelKey: 'wNet', icon: '🌐', shape: 'net',
    read: (s) => (s && s.net ? s.net.down + s.net.up : null)
  },
  uptime: {
    labelKey: 'wUptime', icon: '⏱', shape: 'text',
    text: (s) => (s && typeof s.uptime === 'number' ? uptimeShort(s.uptime) : '—')
  },
  clock: {
    labelKey: 'wClock', icon: '🕒', shape: 'text', local: true,
    text: () => {
      const d = new Date();
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    },
    sub: () => new Date().toLocaleDateString(LANG, { weekday: 'short', day: 'numeric', month: 'short' })
  }
};

// ------------------------------------------------------------------ bicimler

function bytesShort(n) {
  if (!Number.isFinite(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)) + ' ' + u[i];
}

function rateShort(bytesPerSec) {
  if (!Number.isFinite(bytesPerSec)) return '—';
  return bytesShort(bytesPerSec) + '/s';
}

function uptimeShort(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return d + t('wDayShort') + ' ' + h + t('wHourShort');
  if (h > 0) return h + t('wHourShort') + ' ' + m + t('wMinShort');
  return m + t('wMinShort');
}

function pickDrive(stats, w) {
  if (!stats || !Array.isArray(stats.disks) || !stats.disks.length) return null;
  if (w && w.drive) {
    const hit = stats.disks.find((d) => d.id === w.drive);
    if (hit) return hit;
    // Secilen surucu artik yoksa uydurma bir deger gostermektense bos birakiyoruz.
    return null;
  }
  return stats.disks[0];
}

// Deger araligini yayin 0-100 dolgusuna esler.
function gaugeFraction(def, value) {
  const min = typeof def.min === 'number' ? def.min : 0;
  const max = typeof def.max === 'number' ? def.max : 100;
  if (max <= min) return 0;
  const f = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, f));
}

// Bosluk yolun kendisinden (100) uzun olmali. "0 100" verilirse desen tam yol
// boyunda tekrar eder ve yuvarlak uc yuzunden yayin HER IKI ucunda birer nokta
// belirir; deger sifirken gosterge iki noktali gorunuyordu.
function dashFor(fraction) {
  return fraction.toFixed(1) + ' 200';
}

function widgetLabel(w) {
  const def = WIDGET_TYPES[w.widget];
  if (!def) return w.label || '';
  if (w.label) return w.label;
  return def.label ? def.label(w) : t(def.labelKey);
}

// ------------------------------------------------------------------- cizim

function svgEl(name, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Gostergeyi bir kez kurar. Canli degerler updateWidget() ile gelir.
function renderWidget(el, w) {
  const def = WIDGET_TYPES[w.widget];
  el.classList.add('widget');
  el.dataset.widget = w.widget;

  const color = w.color || accent();
  el.style.setProperty('--w-color', color);

  if (!def) {
    el.classList.add('w-unknown');
    el.textContent = '?';
    return;
  }

  const body = document.createElement('div');
  body.className = 'w-body';

  if (def.shape === 'gauge') {
    const svg = svgEl('svg', { class: 'w-gauge', viewBox: '0 0 100 100' });
    svg.appendChild(svgEl('path', { class: 'w-track', d: GAUGE_ARC, pathLength: '100' }));
    const fill = svgEl('path', { class: 'w-fill', d: GAUGE_ARC, pathLength: '100' });
    fill.setAttribute('stroke-dasharray', dashFor(0));
    svg.appendChild(fill);
    body.appendChild(svg);

    const read = document.createElement('div');
    read.className = 'w-read';
    read.innerHTML = '<span class="w-val">—</span><span class="w-unit"></span>';
    read.querySelector('.w-unit').textContent = def.unit || '%';
    body.appendChild(read);
  } else if (def.shape === 'net') {
    const wrap = document.createElement('div');
    wrap.className = 'w-net-wrap';
    const rows = document.createElement('div');
    rows.className = 'w-net';
    rows.innerHTML =
      '<div class="w-net-row"><span class="w-net-arrow">↓</span><span class="w-net-val" data-net="down">—</span></div>' +
      '<div class="w-net-row"><span class="w-net-arrow">↑</span><span class="w-net-val" data-net="up">—</span></div>';
    wrap.appendChild(rows);
    const spark = svgEl('svg', { class: 'w-spark', viewBox: '0 0 100 24', preserveAspectRatio: 'none' });
    spark.appendChild(svgEl('polyline', { class: 'w-spark-line', points: '' }));
    wrap.appendChild(spark);
    body.appendChild(wrap);
  } else {
    const read = document.createElement('div');
    read.className = 'w-read w-read-text';
    read.innerHTML = '<span class="w-val">—</span>';
    body.appendChild(read);
  }

  el.appendChild(body);

  const foot = document.createElement('div');
  foot.className = 'w-foot';
  const lab = document.createElement('span');
  lab.className = 'w-label';
  lab.textContent = widgetLabel(w);
  foot.appendChild(lab);
  const sub = document.createElement('span');
  sub.className = 'w-sub';
  foot.appendChild(sub);
  el.appendChild(foot);

  el._widget = w;
  el._hist = [];
}

// Tek bir gostergeyi gelen olcume gore tazeler.
function updateWidget(el, stats) {
  const w = el._widget;
  if (!w) return;
  const def = WIDGET_TYPES[w.widget];
  if (!def) return;

  const sub = el.querySelector('.w-sub');

  if (def.shape === 'text') {
    const valEl = el.querySelector('.w-val');
    if (valEl) valEl.textContent = def.text(stats);
    if (sub) sub.textContent = def.sub ? def.sub(stats) : '';
    return;
  }

  if (def.shape === 'net') {
    const n = stats && stats.net;
    const down = el.querySelector('[data-net="down"]');
    const up = el.querySelector('[data-net="up"]');
    if (down) down.textContent = n ? rateShort(n.down) : '—';
    if (up) up.textContent = n ? rateShort(n.up) : '—';
    pushHistory(el, n ? n.down + n.up : 0);
    drawSpark(el);
    el.classList.toggle('w-na', !n);
    return;
  }

  const value = def.read(stats, w);
  const valEl = el.querySelector('.w-val');
  const fill = el.querySelector('.w-fill');
  const available = typeof value === 'number' && Number.isFinite(value);

  el.classList.toggle('w-na', !available);

  if (!available) {
    if (valEl) valEl.textContent = '—';
    if (fill) fill.setAttribute('stroke-dasharray', dashFor(0));
    if (sub) sub.textContent = def.why ? def.why(stats) : t('wNoData');
    return;
  }

  if (valEl) valEl.textContent = Math.round(value);
  if (fill) {
    const f = gaugeFraction(def, value);
    fill.setAttribute('stroke-dasharray', dashFor(f));
  }
  if (sub) sub.textContent = def.sub ? def.sub(stats, w) : '';

  // Esigi asinca yay ve sayi uyari rengine kayar. Renk tek basina degil,
  // sayiyla birlikte degisiyor ki renk goremeyenler icin de fark edilir olsun.
  const warn = typeof w.warn === 'number' ? w.warn : def.warn;
  el.classList.toggle('w-warn', typeof warn === 'number' && value >= warn);
}

function pushHistory(el, v) {
  if (!el._hist) el._hist = [];
  el._hist.push(v);
  if (el._hist.length > 40) el._hist.shift();
}

function drawSpark(el) {
  const line = el.querySelector('.w-spark-line');
  if (!line) return;
  const h = el._hist || [];
  if (h.length < 2) { line.setAttribute('points', ''); return; }
  const max = Math.max.apply(null, h) || 1;
  const step = 100 / (h.length - 1);
  const pts = h.map((v, i) => (i * step).toFixed(1) + ',' + (24 - (v / max) * 22).toFixed(1));
  line.setAttribute('points', pts.join(' '));
}

// Ekrandaki tum gostergeleri tazeler.
function updateWidgets(stats) {
  document.querySelectorAll('.btn.widget').forEach((el) => updateWidget(el, stats));
}

// Saat gibi olcum gerektirmeyen gostergeler sunucudan bagimsiz ilerlemeli.
function tickLocalWidgets() {
  document.querySelectorAll('.btn.widget').forEach((el) => {
    const w = el._widget;
    if (w && WIDGET_TYPES[w.widget] && WIDGET_TYPES[w.widget].local) updateWidget(el, null);
  });
}

// Acik sayfada olcum isteyen bir gosterge var mi? Sunucu buna gore olcum
// surecini baslatip durduruyor, kimse bakmiyorken CPU harcanmasin diye.
function pageNeedsStats(page) {
  if (!page || !Array.isArray(page.buttons)) return false;
  return page.buttons.some((b) => {
    if (!b || b.kind !== 'widget') return false;
    const def = WIDGET_TYPES[b.widget];
    return !!def && !def.local;
  });
}
