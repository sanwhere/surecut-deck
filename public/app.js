// surecut-deck istemci - WS ile host'a baglanir, buton izgarasini cizer, duzenlemeyi yonetir.

const $ = (id) => document.getElementById(id);

// Temalar. Govde renkleri CSS'te [data-theme] altinda; burada her temanin
// vurgu rengi ve butonlara onerilen paleti tutulur.
// Nord, Gruvbox, Solarized, Catppuccin ve Rose Pine renkleri resmi paletlerinden
// alindi (kaynaklar README'de). Kehribar ve Fosfor kasten iki renklidir.
const THEMES = {
  dark: {
    nameKey: 'thDark', hintKey: 'thDarkHint',
    accent: '#3b82f6',
    colors: ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#64748b']
  },
  nord: {
    name: 'Nord', hintKey: 'thNordHint',
    accent: '#88c0d0',
    colors: ['#5e81ac', '#88c0d0', '#8fbcbb', '#a3be8c', '#ebcb8b', '#d08770', '#bf616a', '#b48ead', '#d8dee9']
  },
  gruvbox: {
    name: 'Gruvbox', hintKey: 'thGruvboxHint',
    accent: '#d79921',
    colors: ['#d79921', '#98971a', '#cc241d', '#d65d0e', '#458588', '#689d6a', '#b16286', '#7c6f64']
  },
  solarized: {
    name: 'Solarized', hintKey: 'thSolarizedHint',
    accent: '#268bd2',
    colors: ['#268bd2', '#2aa198', '#859900', '#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#586e75']
  },
  mocha: {
    name: 'Mocha', hintKey: 'thMochaHint',
    accent: '#cba6f7',
    colors: ['#cba6f7', '#89b4fa', '#94e2d5', '#a6e3a1', '#f9e2af', '#fab387', '#f38ba8', '#f5c2e7', '#6c7086']
  },
  rosepine: {
    name: 'Rosé Pine', hintKey: 'thRoseHint',
    accent: '#c4a7e7',
    colors: ['#c4a7e7', '#9ccfd8', '#31748f', '#f6c177', '#ebbcba', '#eb6f92', '#908caa', '#6e6a86']
  },
  amber: {
    nameKey: 'thAmber', hintKey: 'thAmberHint',
    accent: '#ffb000',
    colors: ['#ffb000', '#e09a00', '#c08400', '#9a7000', '#ffc740', '#ff8c00', '#75540a', '#4a3607']
  },
  phosphor: {
    nameKey: 'thPhosphor', hintKey: 'thPhosphorHint',
    accent: '#33ff77',
    colors: ['#33ff77', '#22cc5e', '#19a34a', '#0f7a36', '#5cff96', '#8affb5', '#0b5526', '#2ee06a']
  },
  light: {
    nameKey: 'thLight', hintKey: 'thLightHint',
    accent: '#2563eb',
    colors: ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#db2777', '#0d9488', '#475569']
  },
  solarizedLight: {
    nameKey: 'thSolarizedLight', hintKey: 'thSolarizedLightHint',
    accent: '#268bd2',
    colors: ['#268bd2', '#2aa198', '#859900', '#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#586e75']
  },
  dawn: {
    name: 'Dawn', hintKey: 'thDawnHint',
    accent: '#907aa9',
    colors: ['#907aa9', '#56949f', '#286983', '#ea9d34', '#d7827e', '#b4637a', '#797593', '#9893a5']
  }
};

const ACCENTS = ['#3b82f6', '#2563eb', '#5b7c99', '#22c55e', '#0d9488', '#a855f7',
                 '#ec4899', '#ef4444', '#f59e0b', '#9a6b3f', '#64748b', '#111827'];

// Buton zemini acik renkse yazi koyu olmali. Sabit beyaz yazi, kehribar/fosfor
// gibi parlak zeminlerde ve kullanicinin sectigi acik ozel renklerde okunmuyordu.
function readableText(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  // WCAG relatif parlaklik
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.45 ? '#141109' : '#ffffff';
}

function toHsl(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = h * 60;
    if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  return { h, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
}

// Renklilik olcusu olarak HSL doygunlugu DEGIL kroma (max-min) kullanilir.
// HSL doygunlugu uc parlakliklarda yaniltir: #d8dee9 gozle gri olmasina ragmen
// doygunlugu 0.28 cikip mavinin en yakin adayi oluyordu.
function chromaOf(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

const NEUTRAL_CHROMA = 0.12;

// Bir rengi hedef paletin EN YAKIN TONDAKI rengine esler. Boylece tema
// degisince mavi buton yeni temanin mavisi, kirmizi olan kirmizisi olur;
// kullanicinin kurdugu renk duzeni korunur, sadece tonlar temaya cevrilir.
function mapColorToPalette(color, pal) {
  const c = toHsl(color);
  const cands = pal.map((p) => ({ p, hsl: toHsl(p), k: chromaOf(p) })).filter((x) => x.hsl);
  if (!c || !cands.length) return pal[0];

  const neutrals = cands.filter((x) => x.k < NEUTRAL_CHROMA);
  const chromatic = cands.filter((x) => x.k >= NEUTRAL_CHROMA);

  // Gri/notr kaynak, paletin en notr rengine gitsin.
  if (chromaOf(color) < NEUTRAL_CHROMA) {
    const pool = neutrals.length ? neutrals : cands;
    return pool.reduce((a, b) => (b.k < a.k ? b : a)).p;
  }

  // Renkli kaynak sadece renkli adaylar arasindan secilsin, griye/beyaza dusmesin.
  const pool = chromatic.length ? chromatic : cands;
  let best = pool[0], bestD = Infinity;
  for (const x of pool) {
    let d = Math.abs(x.hsl.h - c.h);
    if (d > 180) d = 360 - d;          // ton cemberi: 350 ile 10 arasi 20 derecedir
    if (d < bestD) { bestD = d; best = x; }
  }
  return best.p;
}

function theme() { return THEMES[(config.settings && config.settings.theme)] || THEMES.dark; }
function palette() { return theme().colors; }
function accent() { return (config.settings && config.settings.accent) || theme().accent; }

const KEY_PRESETS = [
  'ctrl+c', 'ctrl+v', 'ctrl+z', 'ctrl+y', 'ctrl+s', 'ctrl+a', 'ctrl+f',
  'alt+tab', 'alt+f4', 'win+d', 'win+e', 'win+l', 'ctrl+shift+esc',
  'playpause', 'nexttrack', 'prevtrack', 'volumeup', 'volumedown', 'mute',
  'f5', 'f11', 'enter', 'esc', 'delete', 'printscreen'
];

let ws = null;
let token = localStorage.getItem('sd_token') || '';
let config = { settings: { columns: 4 }, pages: [] };
let activePage = 0;
let editing = false;
let editIndex = -1;      // -1 = yeni buton
let editColor = THEMES.dark.accent;   // openEditor gercek degeri temadan alir
let editIconUrl = '';
let reqSeq = 0;
let configRevision = null;   // sunucudan gelen yapilandirma surumu
let lastStats = null;        // son sistem olcumu
let statsSubbed = false;     // sunucuya olcum aboneligi bildirdik mi
const pending = new Map();

// ---------------------------------------------------------------- baglanti

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));

  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.type === 'authed') {
      localStorage.setItem('sd_token', token);
      if (checkAssetVersion(msg.assetVersion)) return;
      config = msg.config;
      configRevision = msg.revision;
      if (activePage >= config.pages.length) activePage = 0;
      $('pair').classList.add('hidden');
      $('app').classList.remove('hidden');
      $('status').classList.add('on');
      render();
      return;
    }

    if (msg.type === 'config') {
      if (checkAssetVersion(msg.assetVersion)) return;
      config = msg.config;
      configRevision = msg.revision;
      if (activePage >= config.pages.length) activePage = 0;
      render();
      return;
    }

    if (msg.type === 'error') {
      $('pairError').textContent = msg.message;
      return;
    }

    if (msg.type === 'stats') {
      lastStats = msg.stats;
      updateWidgets(lastStats);
      return;
    }

    if (msg.type === 'result') {
      const cb = pending.get(msg.id);
      if (cb) { pending.delete(msg.id); cb(msg); }
      return;
    }
  };

  ws.onclose = (ev) => {
    $('status').classList.remove('on');
    // Baglanti koptu: sunucu aboneligi zaten dusurdu, biz de unutalim ki
    // yeniden baglandigimizda tekrar istensin.
    statsSubbed = false;
    // 4003 = token reddedildi; yeniden denemek anlamsiz, eslestirme ekranina don.
    if (ev.code === 4003) {
      localStorage.removeItem('sd_token');
      token = '';
      $('app').classList.add('hidden');
      $('pair').classList.remove('hidden');
      $('pairError').textContent = t('badCode');
      return;
    }
    setTimeout(connect, 1500);
  };

  ws.onerror = () => ws.close();
}

// Acik sayfada olcum isteyen bir gosterge varsa abone ol, yoksa birak.
// Sunucu son abone gidince olcum surecini kapatiyor: kimse bakmiyorken
// arka planda CPU harcanmasin diye.
function syncStatsSub() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const want = pageNeedsStats(config.pages[activePage]);
  if (want === statsSubbed) return;
  statsSubbed = want;
  ws.send(JSON.stringify({ type: 'statsSub', on: want }));
}

// Arayuz dosyalari degistiyse sayfayi yenile. Calisan bir sayfa kendi JS'ini
// yeniden cekmez; bu olmadan her kod degisikliginde elle yenilemek gerekiyordu.
let myAssetVersion = null;

function checkAssetVersion(v) {
  if (!v) return false;
  if (myAssetVersion === null) { myAssetVersion = v; return false; }
  if (v === myAssetVersion) return false;
  toast(t('uiUpdated'));
  setTimeout(() => location.reload(), 400);
  return true;
}

function request(payload, cb) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    toast(t('noConnection'), true);
    return;
  }
  const id = ++reqSeq;
  if (cb) pending.set(id, cb);
  ws.send(JSON.stringify({ ...payload, id }));
}

function saveConfig(cb) {
  request({ type: 'saveConfig', revision: configRevision, config: { settings: config.settings, pages: config.pages } }, (r) => {
    // Sunucu kaydi kabul edince yeni surumu doner; almazsak sonraki kaydimiz
    // bayat sayilip reddedilir.
    if (r.ok && r.revision) configRevision = r.revision;
    if (!r.ok) toast(r.message, true);
    if (cb) cb(r);
  });
}

// ---------------------------------------------------------------- cizim

function render() {
  applyTheme();
  renderTabs();
  renderGrid();
  applyBars();
  applyFab();
  $('colsInput').value = config.settings.columns || 4;
  $('autoHide').checked = autoHideOn();
  $('hideFab').checked = !!(config.settings && config.settings.hideFab);
  $('stretchFill').checked = !!(config.settings && config.settings.stretchFill);
}

// ---------------------------------------------------------------- tema

function applyTheme() {
  const key = (config.settings && config.settings.theme) || 'dark';
  document.documentElement.dataset.theme = THEMES[key] ? key : 'dark';
  // Vurgu rengi temanin varsayilaninin uzerine biner.
  document.documentElement.style.setProperty('--accent', accent());
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = getComputedStyle(document.documentElement)
      .getPropertyValue('--surface').trim() || '#2a2a2e';
  }
}

// ---------------------------------------------------------------- touchpad

const TAP_MAX_MS = 260;        // bundan uzun basma tik sayilmaz
const TAP_MAX_MOVE = 12;       // bundan cok kayarsa surukleme sayilir
const LONGPRESS_MS = 550;      // uzun bas = sag tik
const SCROLL_PX = 16;          // kac piksel = bir tekerlek centigi (kesirli gonderilir)
const DOUBLE_TAP_MS = 320;     // iki dokunus bu sure icindeyse cift dokunus
const DOUBLE_TAP_DIST = 45;    // ve birbirine bu kadar yakinsa
const PINCH_PX = 70;           // parmak arasi mesafe -> yakinlastirma centigi
const SWIPE_MIN = 90;          // uc parmak kaydirmasi icin en az yol
const MODE_DIST = 30;          // kistirma icin NET mesafe degisimi
const MODE_MOVE = 2;           // kaydirmayi kilitlemek icin NET merkez hareketi
const MODE_WINDOW = 350;       // kistirmaya gecis yalnizca bu sure icinde olabilir
const AXIS_LOCK = 1.4;         // baskin eksen digerinin bu kati ise eksen kilitlenir

// Uc parmak jestleri. Windows'un kendi dokunmatik yuzey kisayollariyla ayni.
const THREE_FINGER = {
  up:    { keys: 'win+tab',        labelKey: 'taskView' },
  down:  { keys: 'win+d',          labelKey: 'showDesktop' },
  left:  { keys: 'ctrl+win+left',  labelKey: 'prevDesktop' },
  right: { keys: 'ctrl+win+right', labelKey: 'nextDesktop' }
};

const tpPointers = new Map();
let tpMoved = 0;
let tpStartTime = 0;
let tpHandled = false;         // uzun basma tetiklendiyse tik gonderme
let tpLongTimer = null;
let tpDragLock = false;
let tpMaxPointers = 0;

// Cift dokunus ve cift-dokunup-surukleme
let tpLastTapEnd = 0;
let tpLastTapPos = { x: 0, y: 0 };
let tpDoubleCandidate = false; // bu dokunus bir cift dokunusun ikincisi mi
let tpDragActive = false;      // cift dokunup surukleme: sol tus basili

// Iki parmak: kaydirma mi kistirma mi. Bir jest icinde MOD KILITLENIR;
// yoksa parmaklar arasi mesafe dogal olarak oynadigi icin surekli kistirmaya
// atlayip kaydirmayi blokluyordu.
let tpMode = null;             // 'scroll' | 'pinch' | null
let tpPrevDist = 0;
let tpPrevCx = 0, tpPrevCy = 0;
// Mod karari NET degisime bakar. Onceki surumde mutlak degisimler birikiyordu;
// kaydirma sirasindaki dogal parmak titresimi birbirini goturmeyip toplandigi
// icin jest yanlislikla kistirmaya kilitleniyor ve kaydirma hic calismiyordu.
let tpStartDist = 0, tpStartCx = 0, tpStartCy = 0;
let tpAxis = null;             // 'v' | 'h' | null - kaydirma ekseni kilidi
let tpTwoStart = 0;            // ikinci parmagin indigi an

// Uc parmak kaydirmasi
let tpSwipeDx = 0, tpSwipeDy = 0;

// Her pointermove'da dizi kopyalamak (spread) dusuk guclu tablette
// gereksiz cop uretiyordu; degerleri dogrudan dolasarak hesapla.
function tpTwoFingerState() {
  let x0 = 0, y0 = 0, x1 = 0, y1 = 0, i = 0;
  for (const p of tpPointers.values()) {
    if (i === 0) { x0 = p.x; y0 = p.y; }
    else if (i === 1) { x1 = p.x; y1 = p.y; }
    i++;
    if (i === 2) break;
  }
  return { dist: Math.hypot(x0 - x1, y0 - y1), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// Ekranda ne algilandigini gosterir: jest tutmuyorsa sebebi hemen gorulur.
function tpStatus(text) {
  const el = $('tpStatus');
  el.textContent = text || '';
  el.classList.toggle('on', !!text);
}

function tpScrollDir() {
  // 'normal' = Windows dokunmatik yuzeyi gibi: parmak asagi -> sayfa asagi.
  // 'reverse' = dokunmatik ekran gibi: parmak asagi -> icerik asagi.
  return (config.settings && config.settings.scrollDir === 'reverse') ? 1 : -1;
}

function tpScrollSpeed() {
  const v = Number(config.settings && config.settings.scrollSpeed);
  return v >= 0.4 && v <= 3 ? v : 1;
}

// Hareketleri kare basina toplayip tek mesajda gonder: her pointermove'da
// ayri mesaj atmak dusuk guclu tablette agi ve helper'i bogyordu.
let tpPendingDx = 0, tpPendingDy = 0, tpFlushQueued = false;
let tpPendScroll = 0, tpPendHScroll = 0, tpPendZoom = 0;

function tpSensitivity() {
  const v = Number(config.settings && config.settings.mouseSensitivity);
  return v >= 0.5 && v <= 4 ? v : 1.8;
}

// Kare basina tek toplu gonderim: hareket, kaydirma ve yakinlastirma.
function tpFlush() {
  tpFlushQueued = false;

  const dx = Math.round(tpPendingDx), dy = Math.round(tpPendingDy);
  if (dx || dy) {
    // Yuvarlama artigini sakla, yavas hareketlerde imlec takilmasin.
    tpPendingDx -= dx;
    tpPendingDy -= dy;
    sendMouse({ op: 'move', dx, dy });
  }

  // Kaydirma KESIRLI gonderilir. Tam centige yuvarlamak hem zipzip
  // kaydirmaya hem de kucuk hareketlerin hic islememesine yol aciyordu.
  if (Math.abs(tpPendScroll) > 0.01) {
    sendMouse({ op: 'scroll', amount: tpPendScroll });
    tpPendScroll = 0;
  }
  if (Math.abs(tpPendHScroll) > 0.01) {
    sendMouse({ op: 'hscroll', amount: tpPendHScroll });
    tpPendHScroll = 0;
  }
  if (Math.abs(tpPendZoom) > 0.01) {
    sendMouse({ op: 'zoom', amount: tpPendZoom });
    tpPendZoom = 0;
  }
}

function tpQueueFlush() {
  if (!tpFlushQueued) { tpFlushQueued = true; requestAnimationFrame(tpFlush); }
}

function sendMouse(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'mouse', ...payload }));
}

function openTouchpad() {
  closeFabMenu();
  document.body.classList.add('touchpad-open');   // yuzen butonu gizler
  $('touchpad').classList.remove('hidden');
  $('tpSens').value = tpSensitivity();
  $('tpScrollSpeed').value = tpScrollSpeed();
  renderScrollDir();
  tpDragLock = false;
  $('tpDrag').classList.remove('active');
}

function closeTouchpad() {
  if (tpDragLock) { sendMouse({ op: 'up', button: 'left' }); tpDragLock = false; }
  clearTimeout(tpLongTimer);
  tpPointers.clear();
  $('touchpad').classList.add('hidden');
  document.body.classList.remove('touchpad-open');
}

{
  const surf = $('tpSurface');

  surf.addEventListener('pointerdown', (e) => {
    surf.setPointerCapture(e.pointerId);
    tpPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (tpPointers.size === 1) {
      tpMoved = 0;
      tpStartTime = Date.now();
      tpHandled = false;
      tpMaxPointers = 1;
      tpSwipeDx = tpSwipeDy = 0;

      // Onceki dokunusun hemen ardindan ve yakinina geldiyse: cift dokunus.
      const dt = Date.now() - tpLastTapEnd;
      tpDoubleCandidate = dt < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - tpLastTapPos.x, e.clientY - tpLastTapPos.y) < DOUBLE_TAP_DIST;

      clearTimeout(tpLongTimer);
      tpLongTimer = setTimeout(() => {
        // Parmak neredeyse hic kaymadiysa uzun basma = sag tik
        if (tpPointers.size === 1 && tpMoved < TAP_MAX_MOVE) {
          tpHandled = true;
          if (navigator.vibrate) navigator.vibrate(30);
          sendMouse({ op: 'click', button: 'right' });
        }
      }, LONGPRESS_MS);
    } else {
      tpMaxPointers = Math.max(tpMaxPointers, tpPointers.size);
      clearTimeout(tpLongTimer);   // birden fazla parmak: uzun basma iptal
      tpDoubleCandidate = false;
      if (tpPointers.size === 2) {
        tpStatus(t('twoFingers'));
        const st = tpTwoFingerState();
        tpPrevDist = tpStartDist = st.dist;
        tpPrevCx = tpStartCx = st.cx;
        tpPrevCy = tpStartCy = st.cy;
        tpMode = null;
        tpAxis = null;
        tpTwoStart = Date.now();
        // Ikinci parmak inmeden once tek parmak olarak biriken imlec hareketini
        // at; yoksa kaydirmaya baslarken imlec bir siciriyor.
        tpPendingDx = tpPendingDy = 0;
      }
    }
  });

  surf.addEventListener('pointermove', (e) => {
    const p = tpPointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    tpMoved += Math.hypot(dx, dy);

    // Uc ve daha fazla parmak: birakinca yon belirlensin diye yolu topla.
    if (tpPointers.size >= 3) {
      if (e.pointerId === tpPointers.keys().next().value) { tpSwipeDx += dx; tpSwipeDy += dy; }
      return;
    }

    if (tpPointers.size === 2) {
      // Iki parmagin ORTALAMASI kullanilir. Onceki surumde sadece ilk parmagin
      // hareketine bakiliyordu; o parmak sabit kalirsa hic kaydirmiyordu.
      const st = tpTwoFingerState();
      const dCx = st.cx - tpPrevCx, dCy = st.cy - tpPrevCy;
      const dDist = st.dist - tpPrevDist;
      tpPrevCx = st.cx; tpPrevCy = st.cy; tpPrevDist = st.dist;

      // NET degisimler: titresim birbirini goturur.
      const netDist = Math.abs(st.dist - tpStartDist);
      const netX = st.cx - tpStartCx, netY = st.cy - tpStartCy;
      const netMove = Math.hypot(netX, netY);

      // VARSAYILAN KAYDIRMADIR. Esik bekleyip sonra karar vermek "gec algiliyor"
      // hissi veriyordu; artik iki parmak deger degmez kaydirma baslar ve sadece
      // net bir kistirma imzasi gorulurse (kisa bir pencere icinde) moda gecilir.
      if (!tpMode) {
        if (netDist > MODE_DIST && netDist > netMove * 1.6 && Date.now() - tpTwoStart < MODE_WINDOW) {
          tpMode = 'pinch';
          tpStatus(t('zooming'));
        } else if (netMove > MODE_MOVE || Date.now() - tpTwoStart >= MODE_WINDOW) {
          tpMode = 'scroll';
          // Eksen kilidi: dikey kaydirirken yanlara kaymasin.
          const ax = Math.abs(netX), ay = Math.abs(netY);
          tpAxis = ay > ax * AXIS_LOCK ? 'v' : (ax > ay * AXIS_LOCK ? 'h' : null);
          tpStatus(tpAxis === 'h' ? t('hscrolling') : t('scrolling'));
        }
      }

      if (tpMode === 'pinch') {
        tpPendZoom += dDist / PINCH_PX;
      } else {
        // mod henuz kilitlenmemis olsa da kaydir: bekleme yok.
        const dir = tpScrollDir();
        const px = SCROLL_PX / tpScrollSpeed();
        if (tpAxis !== 'h') tpPendScroll += (dCy / px) * dir;
        if (tpAxis !== 'v') tpPendHScroll += (dCx / px) * dir;
      }
      tpQueueFlush();
      return;
    }

    // Coklu parmak jesti sirasinda bir parmak kalkarsa kalan parmak imleci
    // oynatmasin; kaydirmanin sonunda imlec sicriyordu.
    if (tpMaxPointers >= 2) return;

    // Cift dokunup surukleme: ikinci dokunusta parmak kayarsa sol tusu basili
    // tut. Metin secmek ve pencere tasimak icin.
    if (tpDoubleCandidate && !tpDragActive && tpMoved > TAP_MAX_MOVE) {
      tpDragActive = true;
      tpHandled = true;
      clearTimeout(tpLongTimer);
      if (navigator.vibrate) navigator.vibrate(25);
      sendMouse({ op: 'down', button: 'left' });
    }

    const s = tpSensitivity();
    tpPendingDx += dx * s;
    tpPendingDy += dy * s;
    tpQueueFlush();
  });

  const endPointer = (e) => {
    if (!tpPointers.has(e.pointerId)) return;
    tpPointers.delete(e.pointerId);
    if (tpPointers.size > 0) return;      // hala parmak var

    clearTimeout(tpLongTimer);
    tpFlush();

    // Cift dokunup surukleme bittiyse tusu birak.
    if (tpDragActive) {
      sendMouse({ op: 'up', button: 'left' });
      tpDragActive = false;
      tpHandled = true;
    }

    // Uc parmak kaydirmasi: yonu belirle ve kisayolu gonder.
    if (tpMaxPointers >= 3) {
      const ax = Math.abs(tpSwipeDx), ay = Math.abs(tpSwipeDy);
      if (Math.max(ax, ay) >= SWIPE_MIN) {
        const dir = ay > ax ? (tpSwipeDy < 0 ? 'up' : 'down') : (tpSwipeDx < 0 ? 'left' : 'right');
        const g = THREE_FINGER[dir];
        if (g) {
          sendMouse({ op: 'keys', keys: g.keys });
          toast(t(g.labelKey));
          if (navigator.vibrate) navigator.vibrate(25);
        }
      }
      tpHandled = true;
    }

    const dur = Date.now() - tpStartTime;
    const wasTap = !tpHandled && dur < TAP_MAX_MS && tpMoved < TAP_MAX_MOVE;

    if (wasTap) {
      // Iki parmakla dokunma = sag tik (masaustu touchpad aliskanligi).
      // Cift dokunmada ozel bir sey gondermeye gerek yok: art arda iki sol tik
      // zaten isletim sisteminde cift tik olarak yorumlanir. Tek tikin ilk
      // dokunusta gecikmeden gitmesi de boylece korunur.
      sendMouse({ op: 'click', button: tpMaxPointers >= 2 ? 'right' : 'left' });
      if (navigator.vibrate) navigator.vibrate(12);
      tpLastTapEnd = Date.now();
      tpLastTapPos = { x: e.clientX, y: e.clientY };
    } else {
      tpLastTapEnd = 0;      // surukleme sonrasi cift dokunus sayilmasin
    }

    tpMode = null;
    tpAxis = null;
    tpSwipeDx = tpSwipeDy = 0;
    setTimeout(() => { if (tpPointers.size === 0) tpStatus(''); }, 500);
    tpMaxPointers = 0;
    tpDoubleCandidate = false;
  };

  surf.addEventListener('pointerup', endPointer);
  surf.addEventListener('pointercancel', endPointer);
}

$('tpClose').onclick = closeTouchpad;
$('tpLeft').onclick = () => sendMouse({ op: 'click', button: 'left' });
$('tpMid').onclick = () => sendMouse({ op: 'click', button: 'middle' });
$('tpRight').onclick = () => sendMouse({ op: 'click', button: 'right' });

// Surukle kilidi: sol tusu basili tutar, pencere tasima/secim icin.
$('tpDrag').onclick = () => {
  tpDragLock = !tpDragLock;
  $('tpDrag').classList.toggle('active', tpDragLock);
  sendMouse({ op: tpDragLock ? 'down' : 'up', button: 'left' });
  if (navigator.vibrate) navigator.vibrate(20);
};

$('tpSens').oninput = (e) => {
  config.settings.mouseSensitivity = Number(e.target.value);
};
$('tpSens').onchange = () => saveConfig();

function renderScrollDir() {
  const rev = (config.settings && config.settings.scrollDir) === 'reverse';
  $('tpDirNormal').classList.toggle('active', !rev);
  $('tpDirReverse').classList.toggle('active', rev);
}

function setScrollDir(dir) {
  config.settings.scrollDir = dir;
  renderScrollDir();
  saveConfig();
  tpStatus(dir === 'reverse' ? t('revScroll') : t('normScroll'));
  setTimeout(() => { if (tpPointers.size === 0) tpStatus(''); }, 1200);
}

$('tpDirNormal').onclick = () => setScrollDir('normal');
$('tpDirReverse').onclick = () => setScrollDir('reverse');

$('tpScrollSpeed').oninput = (e) => { config.settings.scrollSpeed = Number(e.target.value); };
$('tpScrollSpeed').onchange = () => saveConfig();

// ---------------------------------------------------------------- sayfa kaydirma

// Izgarada yatay kaydirma ile sayfa degistir. Duzenleme modunda kapali:
// orada ayni jest butonlari yeniden siralamak icin kullaniliyor.
const SWIPE_MIN_X = 60;        // sayfa degistirmek icin en az yatay yol
const SWIPE_RATIO = 1.6;       // yatay hareket dikeyin bu kati olmali
const SWIPE_MAX_MS = 800;

let swipeStart = null;
let swipeConsumed = false;     // jest kaydirmaya donustuyse tiklamayi yut

{
  const grid = $('grid');

  grid.addEventListener('pointerdown', (e) => {
    if (editing || !config.pages || config.pages.length < 2) { swipeStart = null; return; }
    swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    swipeConsumed = false;
  });

  grid.addEventListener('pointermove', (e) => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x, dy = e.clientY - swipeStart.y;
    if (Math.abs(dx) > SWIPE_MIN_X * 0.7 && Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO) {
      swipeConsumed = true;
    }
  });

  const finish = (e) => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x, dy = e.clientY - swipeStart.y;
    const dt = Date.now() - swipeStart.t;
    swipeStart = null;
    if (dt > SWIPE_MAX_MS) return;
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;

    const n = config.pages.length;
    activePage = (activePage + (dx < 0 ? 1 : -1) + n) % n;
    render();
    // Cubuklar gizliyken hangi sayfada oldugun sekmelerden gorunmuyor.
    toast(config.pages[activePage].name);
    if (navigator.vibrate) navigator.vibrate(15);
  };

  grid.addEventListener('pointerup', finish);
  grid.addEventListener('pointercancel', () => { swipeStart = null; });

  // Kaydirma sonrasi parmagin kalktigi buton tetiklenmesin.
  grid.addEventListener('click', (e) => {
    if (!swipeConsumed) return;
    swipeConsumed = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

// ---------------------------------------------------------------- yuzen menu

// Cubuklar gizliyken ve izgara doluyken uzun basacak bos alan kalmiyordu;
// bu buton her zaman erisilebilir tek nokta. Sayfa sekmeleri de baslikta
// oldugu icin sayfa gecisi de buraya kondu.
const FAB_DRAG_MIN = 8;        // bu kadar kayarsa tiklama degil tasima sayilir

function fabPos() {
  const p = config.settings && config.settings.fabPos;
  const x = p && Number(p.x), y = p && Number(p.y);
  return {
    x: Number.isFinite(x) ? Math.min(96, Math.max(2, x)) : 94,
    y: Number.isFinite(y) ? Math.min(94, Math.max(4, y)) : 86
  };
}

function applyFab() {
  const p = fabPos();
  const fab = $('fab');
  fab.style.left = p.x + '%';
  fab.style.top = p.y + '%';

  const hidden = !!(config.settings && config.settings.hideFab);
  fab.classList.toggle('hidden', hidden);
  if (hidden) closeFabMenu();
  positionFabMenu();
}

function positionFabMenu() {
  const p = fabPos();
  const menu = $('fabMenu');
  // Menu butonun hangi tarafinda acilacak: ekran kenarindan tasmasin.
  menu.classList.toggle('left', p.x > 55);
  menu.classList.toggle('up', p.y > 50);
  menu.style.left = p.x + '%';
  menu.style.top = p.y + '%';
}

function openFabMenu() {
  renderFabPages();
  positionFabMenu();
  $('fabMenu').classList.remove('hidden');
  $('fab').classList.add('active');
}

function closeFabMenu() {
  $('fabMenu').classList.add('hidden');
  $('fab').classList.remove('active');
}

function renderFabPages() {
  const box = $('fabPages');
  box.innerHTML = '';
  if (config.pages.length < 2) return;
  config.pages.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fab-page' + (i === activePage ? ' active' : '');
    b.dataset.page = String(i);
    b.textContent = p.name;
    b.onclick = () => { activePage = i; closeFabMenu(); render(); };
    box.appendChild(b);
  });
}

{
  const fab = $('fab');
  let dragging = false, moved = 0, sx = 0, sy = 0;

  fab.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fab.setPointerCapture(e.pointerId);
    dragging = false; moved = 0; sx = e.clientX; sy = e.clientY;
  });

  fab.addEventListener('pointermove', (e) => {
    if (!fab.hasPointerCapture(e.pointerId)) return;
    moved = Math.hypot(e.clientX - sx, e.clientY - sy);
    if (moved < FAB_DRAG_MIN) return;
    dragging = true;
    closeFabMenu();
    config.settings.fabPos = {
      x: Math.min(96, Math.max(2, (e.clientX / window.innerWidth) * 100)),
      y: Math.min(94, Math.max(4, (e.clientY / window.innerHeight) * 100))
    };
    applyFab();
  });

  fab.addEventListener('pointerup', () => {
    if (dragging) { saveConfig(); return; }
    $('fabMenu').classList.contains('hidden') ? openFabMenu() : closeFabMenu();
  });
}

$('fabMenu').addEventListener('click', (e) => {
  const btn = e.target.closest('.fab-item');
  if (!btn) return;
  closeFabMenu();
  switch (btn.dataset.act) {
    case 'bars': revealBars(12000); break;      // menuden gelince daha uzun kalsin
    case 'edit': $('editToggle').click(); revealBars(12000); break;
    case 'theme': renderThemeModal(); $('themeModal').classList.remove('hidden'); break;
    case 'fs': $('fsToggle').click(); break;
  }
});

// Disariya dokununca menuyu kapat
document.addEventListener('pointerdown', (e) => {
  const menu = $('fabMenu');
  if (menu.classList.contains('hidden')) return;
  if (e.target.closest('#fabMenu') || e.target.closest('#fab')) return;
  closeFabMenu();
}, true);

// ---------------------------------------------------------------- cubuk gizleme

const BARS_REVEAL_HOLD_MS = 3000;   // bos alana bu kadar basili tutunca geri gelir
const BARS_AUTOHIDE_MS = 6000;      // gorundukten sonra bu kadar sonra tekrar gizlenir

let barsTimer = null;

function autoHideOn() { return !!(config.settings && config.settings.autoHideBars); }

function setBarsHidden(hidden) {
  document.body.classList.toggle('bars-hidden', hidden);
}

function revealBars(ms) {
  setBarsHidden(false);
  clearTimeout(barsTimer);
  // Duzenleme modunda cubuklar gerekli; orada gizleme.
  if (autoHideOn() && !editing) {
    barsTimer = setTimeout(() => setBarsHidden(true), ms || BARS_AUTOHIDE_MS);
  }
}

function applyBars() {
  clearTimeout(barsTimer);
  setBarsHidden(autoHideOn() && !editing);
}

// Cubuklarla etkilesim sayaci sifirlasin, is yaparken kaybolmasinlar.
['header', 'editBar'].forEach((id) => {
  const el = $(id) || document.querySelector('header');
  if (el) el.addEventListener('pointerdown', () => revealBars(), true);
});

// Bos alana uzun basma: gizli cubuklari geri getirir.
function attachRevealGesture() {
  const grid = $('grid');
  grid.addEventListener('pointerdown', (e) => {
    if (!autoHideOn()) return;
    // Sadece bos alan: butonun kendisi degil.
    if (e.target !== grid && !e.target.classList.contains('empty')) return;

    const sx = e.clientX, sy = e.clientY;
    const timer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30);
      revealBars();
      detach();
    }, BARS_REVEAL_HOLD_MS);

    const onMove = (ev) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 14) { clearTimeout(timer); detach(); }
    };
    const onUp = () => { clearTimeout(timer); detach(); };
    const detach = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });
}

attachRevealGesture();

function renderThemeModal() {
  const list = $('themeList');
  list.innerHTML = '';
  const current = (config.settings && config.settings.theme) || 'dark';

  Object.keys(THEMES).forEach((key) => {
    const th = THEMES[key];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card' + (key === current ? ' sel' : '');
    // Kartin kendisi o temanin renklerini gostersin: secmeden onizleme.
    card.dataset.preview = key;

    const sw = document.createElement('div');
    sw.className = 'theme-swatches';
    th.colors.slice(0, 5).forEach((c) => {
      const d = document.createElement('i');
      d.style.background = c;
      sw.appendChild(d);
    });

    const nm = document.createElement('div');
    nm.className = 'theme-name';
    nm.textContent = th.nameKey ? t(th.nameKey) : th.name;

    const hn = document.createElement('div');
    hn.className = 'theme-hint';
    hn.textContent = t(th.hintKey);

    card.append(sw, nm, hn);
    card.onclick = () => {
      const pal = th.colors;

      // Butonlarin hepsi ayni renkteyse ton eslemesi cesitlilik URETEMEZ:
      // tek renk yine tek renge gider ve tema degistikce her sey tek renk kalir.
      // Bu durumda paleti sirayla dagit; kullanicinin kurdugu bir renk duzeni
      // varsa (birden fazla renk) tonlari koruyarak cevir.
      const distinct = new Set();
      config.pages.forEach((pg) => pg.buttons.forEach((b) => {
        if (b.color) distinct.add(String(b.color).toLowerCase());
      }));
      const spread = distinct.size <= 1;

      let n = 0;
      config.pages.forEach((pg) => pg.buttons.forEach((b) => {
        b.color = spread ? pal[n % pal.length]
                         : (b.color ? mapColorToPalette(b.color, pal) : pal[n % pal.length]);
        n++;
      }));

      config.settings.theme = key;
      // Tema degisince eski vurgu rengi uyumsuz kalabilir; temanin kendi rengine don.
      config.settings.accent = th.accent;
      applyTheme();
      renderThemeModal();
      renderGrid();
      saveConfig();
    };
    list.appendChild(card);
  });

  const row = $('accentRow');
  row.innerHTML = '';
  const cur = accent().toLowerCase();
  ACCENTS.forEach((c) => {
    const s = document.createElement('div');
    s.className = 'swatch' + (c.toLowerCase() === cur ? ' sel' : '');
    s.style.background = c;
    s.onclick = () => {
      config.settings.accent = c;
      applyTheme();
      renderThemeModal();
      renderGrid();
      saveConfig();
    };
    row.appendChild(s);
  });

  const custom = !ACCENTS.some((c) => c.toLowerCase() === cur);
  const picker = document.createElement('label');
  picker.className = 'swatch picker' + (custom ? ' sel' : '');
  picker.title = 'Özel vurgu rengi';
  picker.style.background = custom ? accent() : 'transparent';
  picker.textContent = custom ? '' : '🎨';
  const input = document.createElement('input');
  input.type = 'color';
  input.value = /^#[0-9a-f]{6}$/i.test(accent()) ? accent() : '#3b82f6';
  input.oninput = () => {
    config.settings.accent = input.value;
    applyTheme();
    renderGrid();
  };
  // Surukleme bitince kaydet; her piksel degisiminde ag trafigi olmasin.
  input.onchange = () => { renderThemeModal(); saveConfig(); };
  picker.appendChild(input);
  row.appendChild(picker);

  const prev = $('palettePreview');
  prev.innerHTML = '';
  palette().forEach((c) => {
    const d = document.createElement('i');
    d.style.background = c;
    prev.appendChild(d);
  });
}

$('themeToggle').onclick = () => { renderThemeModal(); $('themeModal').classList.remove('hidden'); };
$('themeClose').onclick = () => $('themeModal').classList.add('hidden');
$('themeDone').onclick = () => $('themeModal').classList.add('hidden');
$('themeModal').onclick = (e) => { if (e.target === $('themeModal')) $('themeModal').classList.add('hidden'); };

function recolorAll(fn, label) {
  const total = config.pages.reduce((n, pg) => n + pg.buttons.length, 0);
  if (!confirm(t('recolorConfirm', { count: total }))) return;
  config.pages.forEach((pg) => pg.buttons.forEach((b, i) => { b.color = fn(i); }));
  saveConfig(() => toast(label));
  renderGrid();
}

// Sirayla dagit: ayni sayfadaki komsu butonlar farkli ama uyumlu renk alsin.
$('applyPalette').onclick = () => {
  const p = palette();
  recolorAll((i) => p[i % p.length], t('paletteApplied'));
};

// Tek renk: en sade ve tutarli gorunum.
$('applyMono').onclick = () => {
  const a = accent();
  recolorAll(() => a, t('monoApplied'));
};

function renderTabs() {
  const tabs = $('pageTabs');
  tabs.innerHTML = '';
  config.pages.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'tab' + (i === activePage ? ' active' : '');
    // Surukleme sirasinda birakma hedefi olabilmesi icin indeksini tasiyor.
    el.dataset.page = String(i);
    el.textContent = p.name;
    el.onclick = () => {
      if (editing && i === activePage) {
        const name = prompt(t('pageName'), p.name);
        if (name && name.trim()) { p.name = name.trim(); saveConfig(); render(); }
        return;
      }
      activePage = i;
      render();
    };
    tabs.appendChild(el);
  });
}

function renderGrid() {
  const grid = $('grid');
  const page = config.pages[activePage];
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${config.settings.columns || 4}, 1fr)`;
  grid.classList.toggle('editing', editing);
  grid.classList.toggle('stretch', !!(config.settings && config.settings.stretchFill));

  if (!page) return;

  if (page.buttons.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = editing
      ? t('emptyEdit')
      : t('emptyView');
    grid.appendChild(empty);
    return;
  }

  page.buttons.forEach((b, i) => {
    const el = document.createElement('button');
    el.className = 'btn';

    // Gostergeler ayni izgarada durur ama basilmaz: sayfa, sutun, ekrana yay ve
    // suruklemeyle siralama boylece hicbir ek is olmadan onlar icin de calisir.
    if (b.kind === 'widget') {
      renderWidget(el, b);
      if (editing) attachEditHandlers(el, i);
      grid.appendChild(el);
      return;
    }

    const bg = b.color || accent();
    el.style.background = bg;
    el.style.color = readableText(bg);
    // Windows'tan surukle-birak ile eklenen butonlarin gercek uygulama ikonu olur.
    if (b.iconUrl) {
      const img = document.createElement('img');
      img.className = 'icon-img';
      img.src = b.iconUrl;
      img.alt = '';
      // Gorsel yuklenemezse emoji'ye dus, buton bos gorunmesin.
      img.onerror = () => {
        const span = document.createElement('span');
        span.className = 'emoji';
        span.textContent = b.icon || '⚡';
        img.replaceWith(span);
      };
      el.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.className = 'emoji';
      span.textContent = b.icon || '⚡';
      el.appendChild(span);
    }

    const lab = document.createElement('span');
    lab.className = 'label';
    lab.textContent = b.label || '';
    el.appendChild(lab);

    // Duzenleme modunda tiklama yerine isaretci olaylari: kisa dokunus duzenler,
    // basili tutmak surukleyip siralar.
    if (editing) attachEditHandlers(el, i);
    else el.onclick = () => press(el, page.id, b.id);

    grid.appendChild(el);
  });

  // Gostergeler bos degerle acilmasin: elimizde son olcum varsa hemen bas,
  // yoksa aboneligi tazele ki sunucu olcum surecini baslatsin.
  syncStatsSub();
  if (lastStats) updateWidgets(lastStats);
  tickLocalWidgets();

  // Yeniden cizim suruklemenin ortasinda olduysa kaynak butonu yeniden isaretle.
  if (dragState) {
    dragState.el = grid.children[dragState.index] || null;
    if (dragState.el) dragState.el.classList.add('drag-src');
  }
}

// ---------------------------------------------------------------- surukleyip siralama

const LONG_PRESS_MS = 500;   // kasitli bir dokunus tablette 400ms'yi kolayca gecebiliyor
const MOVE_TOLERANCE = 10;

// Bir ogeyi bir sayfadan digerinin sonuna tasir. Basarisiz olursa hicbir sey
// degistirmeden false doner. DOM'a dokunmuyor: boylece surukleme etkilesiminden
// bagimsiz olarak test edilebiliyor.
function moveItemToPage(pages, fromPage, index, toPage) {
  if (!Array.isArray(pages)) return false;
  if (toPage < 0 || fromPage === toPage) return false;
  const src = pages[fromPage];
  const dst = pages[toPage];
  if (!src || !dst || !Array.isArray(src.buttons) || !Array.isArray(dst.buttons)) return false;
  if (index < 0 || index >= src.buttons.length) return false;

  const [item] = src.buttons.splice(index, 1);
  dst.buttons.push(item);
  return true;
}

let dragState = null;

function attachEditHandlers(el, index) {
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    let abandoned = false;
    let movedFar = false;

    const timer = setTimeout(() => {
      dragging = true;
      beginDrag(el, index, sx, sy);
    }, LONG_PRESS_MS);

    const onMove = (ev) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > MOVE_TOLERANCE) movedFar = true;
      if (dragging) { updateDrag(ev.clientX, ev.clientY); return; }
      // Basili tutma suresi dolmadan parmak kaydiysa bu bir kaydirma, surukleme degil.
      if (movedFar) {
        clearTimeout(timer);
        abandoned = true;
        detach();
      }
    };

    const onUp = () => {
      clearTimeout(timer);
      if (dragging) {
        const changed = endDrag();
        // Parmak hic kaymadiysa bu aslinda bir dokunustu: duzenleyiciyi ac.
        // Onceden uzun suren her dokunus surukleme sayilip sessizce yutuluyordu.
        if (!changed && !movedFar) openEditor(index);
      } else if (!abandoned) {
        openEditor(index);
      }
      detach();
    };

    const detach = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });
}

function beginDrag(el, index, x, y) {
  if (navigator.vibrate) navigator.vibrate(30);

  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.className = 'btn drag-ghost';
  ghost.style.background = el.style.background;
  ghost.style.width = r.width + 'px';
  ghost.style.height = r.height + 'px';
  document.body.appendChild(ghost);

  el.classList.add('drag-src');
  // origIndex: birakildiginda siralama gercekten degisti mi anlamak icin
  // dropPage: sayfa sekmesinin uzerine birakilirsa hedef sayfa
  dragState = { index, origIndex: index, el, ghost, offX: x - r.left, offY: y - r.top, dropPage: -1 };
  // Sekmeler surukleme boyunca birakma hedefi oldugunu belli etsin.
  document.body.classList.add('dragging');
  updateDrag(x, y);
}

// Isaretcinin altindaki sayfa sekmesi. Hem ustteki sekme seridi hem de
// cubuklar gizliyken kullanilan yuzen menu listesi hedef olabilir.
function pageTabAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const tab = el && el.closest ? el.closest('[data-page]') : null;
  if (!tab) return -1;
  const i = Number(tab.dataset.page);
  return Number.isInteger(i) && config.pages[i] ? i : -1;
}

function markDropPage(index) {
  document.querySelectorAll('[data-page].drop-target')
    .forEach((el) => el.classList.remove('drop-target'));
  if (index < 0) return;
  document.querySelectorAll('[data-page]').forEach((el) => {
    if (Number(el.dataset.page) === index) el.classList.add('drop-target');
  });
}

function updateDrag(x, y) {
  if (!dragState) return;

  dragState.ghost.style.left = (x - dragState.offX) + 'px';
  dragState.ghost.style.top = (y - dragState.offY) + 'px';

  // Once sayfa sekmelerine bak: bir sekmenin uzerindeysek izgarada siralama
  // yapmiyoruz, cunku niyet baska sayfaya tasimak.
  const page = pageTabAt(x, y);
  if (page >= 0 && page !== activePage) {
    if (dragState.dropPage !== page) {
      dragState.dropPage = page;
      markDropPage(page);
      if (navigator.vibrate) navigator.vibrate(10);
    }
    return;
  }
  if (dragState.dropPage !== -1) {
    dragState.dropPage = -1;
    markDropPage(-1);
  }

  const target = indexAt(x, y);
  if (target < 0 || target === dragState.index) return;

  // Diziyi aninda yeniden sirala; kullanici birakmadan sonucu gorsun.
  const buttons = config.pages[activePage].buttons;
  const [item] = buttons.splice(dragState.index, 1);
  buttons.splice(target, 0, item);
  dragState.index = target;
  renderGrid();
}

function indexAt(x, y) {
  const kids = $('grid').children;
  for (let i = 0; i < kids.length; i++) {
    const r = kids[i].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
  }
  return -1;
}

// Bir sey gercekten degistiyse true doner; degismediyse bosuna kayit yapmaz.
function endDrag() {
  if (!dragState) return false;

  const { index, origIndex, dropPage } = dragState;
  dragState.ghost.remove();
  if (dragState.el) dragState.el.classList.remove('drag-src');
  dragState = null;
  document.body.classList.remove('dragging');
  markDropPage(-1);

  // Sayfa sekmesinin uzerine birakildi: ogeyi o sayfanin sonuna tasi.
  if (moveItemToPage(config.pages, activePage, index, dropPage)) {
    renderGrid();
    saveConfig(() => toast(t('movedTo', { page: config.pages[dropPage].name || '' })));
    return true;
  }

  const changed = index !== origIndex;
  renderGrid();
  if (changed) saveConfig(() => toast(t('orderSaved')));
  return changed;
}

function press(el, pageId, buttonId) {
  if (navigator.vibrate) navigator.vibrate(15);

  // touchpad istemci tarafinda calisir; sunucuya gonderilecek bir eylem yok.
  const page = config.pages.find((p) => p.id === pageId);
  const btn = page && page.buttons.find((b) => b.id === buttonId);
  if (btn && btn.action && btn.action.type === 'touchpad') {
    openTouchpad();
    return;
  }

  request({ type: 'press', pageId, buttonId }, (r) => {
    if (r.ok) {
      el.classList.remove('flash');
      void el.offsetWidth;           // animasyonu yeniden tetiklemek icin reflow
      el.classList.add('flash');
    } else {
      el.classList.remove('fail');
      void el.offsetWidth;
      el.classList.add('fail');
      toast(r.message, true);
    }
  });
}

let toastTimer = null;
function toast(text, bad) {
  const el = $('toast');
  el.textContent = text;
  el.classList.toggle('bad', !!bad);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------- duzenleyici

function openEditor(index) {
  editIndex = index;
  const b = index >= 0 ? config.pages[activePage].buttons[index] : null;

  $('editorTitle').textContent = b ? t('editButton') : t('newButton');
  $('editorDelete').classList.toggle('hidden', !b);

  $('fLabel').value = b ? b.label || '' : '';
  $('fIcon').value = b ? b.icon || '' : '';
  editColor = b ? b.color || accent() : accent();

  // Surukle-birak ile gelen uygulama simgesi varsa koru; kullanici acikca kaldirabilir.
  editIconUrl = (b && b.iconUrl) || '';
  renderIconImage();

  const a = (b && b.action) || { type: 'hotkey', keys: '' };
  const isWidget = !!(b && b.kind === 'widget');
  $('fType').value = isWidget ? 'widget' : (a.type || 'hotkey');
  $('fWidget').value = isWidget ? b.widget : 'cpu';
  $('fStyle').value = (isWidget && b.style === 'bar') ? 'bar' : 'arc';
  fillDriveSelect(isWidget ? b.drive : '');
  // Sayfaya tasima yalnizca var olan bir ogede ve birden fazla sayfa varken anlamli.
  fillMoveSelect(b ? activePage : -1);
  $('fKeys').value = a.type === 'hotkey' ? a.keys || '' : '';
  $('fText').value = a.type === 'text' ? a.text || '' : '';
  $('fTarget').value = a.type === 'launch' ? a.target || '' : '';
  $('fArgs').value = a.type === 'launch' ? a.args || '' : '';
  $('fUrl').value = a.type === 'url' ? a.url || '' : '';
  $('fShell').value = a.type === 'command' ? a.shell || 'powershell' : 'powershell';
  $('fCommand').value = a.type === 'command' ? a.command || '' : '';
  $('fSequence').value = a.type === 'sequence' ? stepsToText(a.steps || []) : '';

  renderColors();
  renderEmojiSelection();
  syncPanes();
  $('editor').classList.remove('hidden');
}

function closeEditor() { $('editor').classList.add('hidden'); }

function renderIconImage() {
  const row = $('iconImgRow');
  if (editIconUrl) {
    $('iconImgPrev').src = editIconUrl;
    row.classList.remove('hidden');
  } else {
    row.classList.add('hidden');
  }
}

$('iconImgClear').onclick = () => { editIconUrl = ''; renderIconImage(); };

function renderColors() {
  const row = $('colorRow');
  row.innerHTML = '';

  palette().forEach((c) => {
    const s = document.createElement('div');
    s.className = 'swatch' + (c.toLowerCase() === editColor.toLowerCase() ? ' sel' : '');
    s.style.background = c;
    s.onclick = () => { editColor = c; renderColors(); renderWidgetPreview(); };
    row.appendChild(s);
  });

  // Hazir renklerin disinda bir renk secildiyse onu da goster.
  const custom = !palette().some((c) => c.toLowerCase() === editColor.toLowerCase());
  const picker = document.createElement('label');
  picker.className = 'swatch picker' + (custom ? ' sel' : '');
  picker.title = 'Özel renk';
  picker.style.background = custom ? editColor : 'transparent';
  picker.textContent = custom ? '' : '🎨';

  const input = document.createElement('input');
  input.type = 'color';
  input.value = /^#[0-9a-f]{6}$/i.test(editColor) ? editColor : '#3b82f6';
  input.oninput = () => { editColor = input.value; renderColors(); renderWidgetPreview(); };
  picker.appendChild(input);

  row.appendChild(picker);
}

function syncPanes() {
  const type = $('fType').value;
  document.querySelectorAll('.pane').forEach((p) => {
    p.classList.toggle('hidden', p.dataset.type !== type);
  });

  // Gostergenin emoji simgesi yok: yay ve sayi zaten kendisi. Simge alanlarini
  // gizleyip etiketin istege bagli oldugunu belirtiyoruz.
  const isWidget = type === 'widget';
  document.querySelectorAll('#editor .icon-field, #editor .icon-pick').forEach((el) => {
    el.classList.toggle('hidden', isWidget);
  });
  if (isWidget) syncWidgetFields();
}

// Gosterge turune gore hangi alanlarin anlamli oldugunu belirler.
function syncWidgetFields() {
  const kind = $('fWidget').value;
  const def = (typeof WIDGET_TYPES !== 'undefined') ? WIDGET_TYPES[kind] : null;
  $('fDriveRow').classList.toggle('hidden', kind !== 'disk');
  // Bicem secimi yalnizca doluluk gosteren olculer icin: ag, calisma suresi ve
  // saatin doldurulacak bir orani yok, onlara kadran ya da cubuk demek anlamsiz.
  $('fStyleRow').classList.toggle('hidden', !def || def.shape !== 'gauge');
  renderWidgetPreview();
}

// Olcum surecinden gelen surucu listesi. Henuz olcum yoksa yalnizca kayitli
// deger gosterilir; kullanicinin karsisina bos bir liste cikmasin.
function fillDriveSelect(current) {
  const sel = $('fDrive');
  if (!sel) return;
  const ids = (lastStats && Array.isArray(lastStats.disks) ? lastStats.disks.map((d) => d.id) : []);
  if (current && !ids.includes(current)) ids.unshift(current);
  sel.innerHTML = '';
  for (const id of ids) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = id;
    sel.appendChild(o);
  }
  if (current) sel.value = current;
}

// Ogeyi baska bir sayfaya tasima listesi. Suruklemek yalnizca ayni sayfa
// icinde siralama yapiyordu; sayfalar arasi tasimanin baska yolu yoktu.
function fillMoveSelect(currentPage) {
  const sel = $('fMove');
  const row = $('fMoveRow');
  if (!sel || !row) return;
  // Yeni oge zaten acik sayfaya eklenir, tasinacak bir sey yok.
  row.classList.toggle('hidden', currentPage < 0 || config.pages.length < 2);
  sel.innerHTML = '';
  config.pages.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = p.name || ('#' + (i + 1));
    sel.appendChild(o);
  });
  if (currentPage >= 0) sel.value = String(currentPage);
}

// Duzenleyicideki canli onizleme: kullanici kaydetmeden once gostergenin
// gercek degerle nasil durdugunu gorur.
function renderWidgetPreview() {
  const box = $('widgetPreview');
  if (!box) return;
  box.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'btn widget';
  const w = { widget: $('fWidget').value, color: editColor, style: $('fStyle').value };
  if (w.widget === 'disk' && $('fDrive').value) w.drive = $('fDrive').value;
  renderWidget(el, w);
  box.appendChild(el);
  updateWidget(el, lastStats);
}

// Sirali adimlari duz metne / metinden nesneye cevir.
function stepsToText(steps) {
  return steps.map((s) => {
    switch (s.type) {
      case 'hotkey': return 'key ' + s.keys;
      case 'text': return 'text ' + s.text;
      case 'delay': return 'delay ' + s.ms;
      case 'launch': return 'launch ' + s.target;
      case 'url': return 'url ' + s.url;
      case 'command': return 'cmd ' + s.command;
      default: return '';
    }
  }).filter(Boolean).join('\n');
}

function textToSteps(text) {
  const steps = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const sp = line.indexOf(' ');
    const verb = (sp < 0 ? line : line.slice(0, sp)).toLowerCase();
    const rest = sp < 0 ? '' : line.slice(sp + 1).trim();
    switch (verb) {
      case 'key': steps.push({ type: 'hotkey', keys: rest }); break;
      case 'text': steps.push({ type: 'text', text: rest }); break;
      case 'delay': steps.push({ type: 'delay', ms: Number(rest) || 100 }); break;
      case 'launch': steps.push({ type: 'launch', target: rest }); break;
      case 'url': steps.push({ type: 'url', url: rest }); break;
      case 'cmd': steps.push({ type: 'command', shell: 'powershell', command: rest }); break;
      default: throw new Error(t('unknownStep', { step: verb }));
    }
  }
  if (steps.length === 0) throw new Error(t('stepsEmpty'));
  return steps;
}

function buildAction() {
  const type = $('fType').value;
  switch (type) {
    case 'hotkey': {
      const keys = $('fKeys').value.trim();
      if (!keys) throw new Error(t('keysEmpty'));
      return { type: 'hotkey', keys };
    }
    case 'text': {
      const text = $('fText').value;
      if (!text) throw new Error(t('textEmpty'));
      return { type: 'text', text };
    }
    case 'launch': {
      const target = $('fTarget').value.trim();
      if (!target) throw new Error(t('targetEmpty'));
      const a = { type: 'launch', target };
      const args = $('fArgs').value.trim();
      if (args) a.args = args;
      return a;
    }
    case 'url': {
      const url = $('fUrl').value.trim();
      if (!/^https?:\/\//i.test(url)) throw new Error(t('urlInvalid'));
      return { type: 'url', url };
    }
    case 'command': {
      const command = $('fCommand').value.trim();
      if (!command) throw new Error(t('commandEmpty'));
      return { type: 'command', shell: $('fShell').value, command };
    }
    case 'touchpad':
      return { type: 'touchpad' };
    case 'widget':
      // Gostergenin eylemi yok; kaydedilen sey turu. saveButton() bunu gorup
      // butonu gosterge olarak isaretler.
      return null;
    default:
      throw new Error(t('unknownType'));
  }
}

// ---------------------------------------------------------------- olaylar

$('pairBtn').onclick = () => {
  const v = $('pairInput').value.trim().toUpperCase();
  if (!v) { $('pairError').textContent = t('enterCode'); return; }
  $('pairError').textContent = '';
  token = v;
  if (ws) ws.close();
  connect();
};

$('pairInput').onkeydown = (e) => { if (e.key === 'Enter') $('pairBtn').click(); };

$('editToggle').onclick = () => {
  editing = !editing;
  $('editToggle').classList.toggle('active', editing);
  $('editBar').classList.toggle('hidden', !editing);
  applyBars();          // duzenleme modunda cubuklar gizlenmesin
  renderGrid();
};

$('stretchFill').onchange = (e) => {
  config.settings.stretchFill = e.target.checked;
  renderGrid();
  saveConfig();
};

$('hideFab').onchange = (e) => {
  config.settings.hideFab = e.target.checked;
  applyFab();
  saveConfig();
};

$('autoHide').onchange = (e) => {
  config.settings.autoHideBars = e.target.checked;
  saveConfig();
  if (e.target.checked) {
    toast(t('barsHiddenTip'));
    revealBars(4000);
  } else {
    applyBars();
  }
};

$('addBtn').onclick = () => openEditor(-1);

$('addPageBtn').onclick = () => {
  const name = prompt(t('pageName'), t('pageDefault') + ' ' + (config.pages.length + 1));
  if (!name || !name.trim()) return;
  config.pages.push({ id: 'p' + Date.now().toString(36), name: name.trim(), buttons: [] });
  activePage = config.pages.length - 1;
  saveConfig();
  render();
};

$('delPageBtn').onclick = () => {
  if (config.pages.length <= 1) { toast(t('lastPageErr'), true); return; }
  if (!confirm(t('deletePageConfirm', { name: config.pages[activePage].name }))) return;
  config.pages.splice(activePage, 1);
  activePage = Math.max(0, activePage - 1);
  saveConfig();
  render();
};

$('colsInput').onchange = (e) => {
  const n = Math.min(10, Math.max(2, Number(e.target.value) || 4));
  config.settings.columns = n;
  e.target.value = n;
  saveConfig();
  renderGrid();
};

$('fType').onchange = syncPanes;
$('fWidget').onchange = syncWidgetFields;
$('fDrive').onchange = renderWidgetPreview;
$('fStyle').onchange = renderWidgetPreview;
$('editorClose').onclick = closeEditor;

$('editor').onclick = (e) => { if (e.target === $('editor')) closeEditor(); };

$('editorSave').onclick = () => {
  let action;
  try { action = buildAction(); } catch (e) { toast(e.message, true); return; }

  const id = editIndex >= 0 ? config.pages[activePage].buttons[editIndex].id : 'b' + Date.now().toString(36);
  let btn;

  if ($('fType').value === 'widget') {
    // Gostergede etiket bos birakilabilir: o zaman olcumun kendi adini kullanir,
    // yani "CPU" yazmak icin kullaniciya is dusmez.
    btn = { id, kind: 'widget', widget: $('fWidget').value, color: editColor };
    const label = $('fLabel').value.trim();
    if (label) btn.label = label;
    if ($('fStyle').value === 'bar') btn.style = 'bar';
    if (btn.widget === 'disk' && $('fDrive').value) btn.drive = $('fDrive').value;
  } else {
    btn = {
      id,
      label: $('fLabel').value.trim() || 'Buton',
      icon: $('fIcon').value.trim() || '⚡',
      color: editColor,
      action
    };
    if (editIconUrl) btn.iconUrl = editIconUrl;
  }

  // Hedef sayfa: kullanici listeden baska bir sayfa sectiyse oge oraya tasinir.
  const moveRow = $('fMoveRow');
  const target = (editIndex >= 0 && moveRow && !moveRow.classList.contains('hidden'))
    ? Number($('fMove').value) : activePage;
  const moving = target !== activePage && config.pages[target];

  if (editIndex >= 0) {
    if (moving) {
      // Once yerinde guncelle, sonra tasi: duzenlemede yapilan degisiklikler
      // de hedefe gitsin. Ayni islem surukleyip sekmeye birakinca da calisiyor.
      config.pages[activePage].buttons[editIndex] = btn;
      moveItemToPage(config.pages, activePage, editIndex, target);
    } else {
      config.pages[activePage].buttons[editIndex] = btn;
    }
  } else {
    config.pages[activePage].buttons.push(btn);
  }

  saveConfig(() => toast(moving ? t('movedTo', { page: config.pages[target].name || '' }) : t('saved')));
  closeEditor();
  renderGrid();
};

$('editorDelete').onclick = () => {
  if (editIndex < 0) return;
  if (!confirm(t('deleteButtonConfirm'))) return;
  config.pages[activePage].buttons.splice(editIndex, 1);
  saveConfig(() => toast(t('deleted')));
  closeEditor();
  renderGrid();
};

$('editorTest').onclick = () => {
  // Gostergenin calistirilacak bir eylemi yok; onizleme zaten canli.
  if ($('fType').value === 'widget') { toast(t('widgetLive')); return; }
  let action;
  try { action = buildAction(); } catch (e) { toast(e.message, true); return; }
  if (action.type === 'touchpad') { closeEditor(); openTouchpad(); return; }
  request({ type: 'test', action }, (r) => toast(r.ok ? t('ran') + ' ' + (r.message || 'OK') : r.message, !r.ok));
};

// Simge secici: kisayol kullanimina uygun secilmis emojiler.
const EMOJIS = (
  '📋📌✂️↩️↪️💾📁📂🗂️🔍🔎🖥️💻⌨️🖱️🖨️📷📹🎥🎬📺📻🎵🎶🎤🎧🔊🔉🔈🔇' +
  '⏯️▶️⏸️⏹️⏭️⏮️⏩⏪🔀🔁🔂⏏️🔌🔋⚡🔒🔓🔑🗝️🛡️⚙️🔧🔨🛠️🧰🧲🔬🔭' +
  '📝📄📃📑📊📈📉🗒️🗓️📅📆⏰⏱️⏲️🕐🔔🔕📢📣💬💭✉️📧📨📩📤📥📦🏷️' +
  '🌐🔗⛓️🚀✈️🏠🏢🏭🎮🕹️🎯🎲🃏🎨🖌️🖍️📐📏🧮💡🔦🕯️🪟🚪🗑️♻️' +
  '✅❌⭕❗❓⚠️🚫⛔🔴🟠🟡🟢🔵🟣⚫⚪🟥🟧🟨🟩🟦🟪⬛⬜⭐🌟💫🔥❄️' +
  '👤👥🧑‍💻🤖👻🐧🍎🪄🎁🏆🥇🎖️💎💰💳🧾📌🧭🗺️🌙☀️⛅🌈🎃🎄'
).match(/./gu) || [];

{
  const box = $('emojiGrid');
  EMOJIS.forEach((e) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'emoji-pick';
    b.textContent = e;
    b.onclick = () => {
      $('fIcon').value = e;
      // Emoji secilince uygulama gorseli yerine emoji gosterilsin.
      editIconUrl = '';
      renderIconImage();
      renderEmojiSelection();
    };
    box.appendChild(b);
  });
}

function renderEmojiSelection() {
  const cur = $('fIcon').value.trim();
  $('emojiGrid').querySelectorAll('.emoji-pick').forEach((b) => {
    b.classList.toggle('sel', b.textContent === cur);
  });
}

$('fIcon').addEventListener('input', renderEmojiSelection);

// Kisayol on ayarlarini doldur
{
  const box = $('keyPresets');
  KEY_PRESETS.forEach((k) => {
    const el = document.createElement('button');
    el.className = 'preset';
    el.type = 'button';
    el.textContent = k;
    el.onclick = () => { $('fKeys').value = k; };
    box.appendChild(el);
  });
}

// ---------------------------------------------------------------- tam ekran

// Ekran kilidi: kontrol tableti olarak kullanilirken ekranin sonmesini onler.
let wakeLock = null;

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* pil tasarrufu modunda reddedilebilir, onemli degil */ }
}

function releaseWakeLock() {
  if (wakeLock) { try { wakeLock.release(); } catch {} wakeLock = null; }
}

// Sekme arka plana gidince kilit dusuyor; geri donunce yeniden al.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isFullscreen() && !wakeLock) acquireWakeLock();
});

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

async function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) throw new Error('tarayıcı desteklemiyor');
  await req.call(el, { navigationUI: 'hide' });
  // Yatay kilit sadece tam ekranda calisir ve her cihazda desteklenmez.
  try { await screen.orientation.lock('landscape'); } catch {}
  await acquireWakeLock();
}

async function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit) await exit.call(document);
  try { screen.orientation.unlock(); } catch {}
  releaseWakeLock();
}

function updateFsButton() {
  const on = isFullscreen();
  $('fsToggle').textContent = on ? '⛶' : '⛶';
  $('fsToggle').classList.toggle('active', on);
  $('fsToggle').title = on ? t('exitFullscreen') : t('fullscreen');
}

$('fsToggle').onclick = async () => {
  try {
    if (isFullscreen()) {
      await exitFullscreen();
      localStorage.removeItem('sd_fullscreen');
    } else {
      await enterFullscreen();
      localStorage.setItem('sd_fullscreen', '1');   // sonraki acilista hatirla
    }
  } catch (e) {
    toast(t('fsFailed') + ' ' + e.message, true);
  }
  updateFsButton();
};

document.addEventListener('fullscreenchange', updateFsButton);
document.addEventListener('webkitfullscreenchange', updateFsButton);

// Tam ekran yalnizca kullanici hareketiyle acilabilir; tercih kayitliysa ilk dokunusta uygula.
if (localStorage.getItem('sd_fullscreen') === '1') {
  const once = async () => {
    document.removeEventListener('pointerdown', once);
    if (!isFullscreen()) { try { await enterFullscreen(); updateFsButton(); } catch {} }
  };
  document.addEventListener('pointerdown', once);
}

updateFsButton();

// Sessiz JS hatasi birakma: kullanici 'calismiyor' derken sebebi gorunmez kalmasin.
window.addEventListener('error', (e) => {
  try { toast('JS hatası: ' + (e.message || e.type), true); } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  try { toast('JS hatası: ' + ((e.reason && e.reason.message) || e.reason), true); } catch {}
});

// Kazara geri/yenile hareketlerini bastir
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---------------------------------------------------------------- baslangic

// ---------------------------------------------------------------- dil

function fillLangSelect(el) {
  el.innerHTML = '';
  Object.keys(LANG_NAMES).sort((a, b) => LANG_NAMES[a].localeCompare(LANG_NAMES[b])).forEach((code) => {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = LANG_NAMES[code];
    el.appendChild(o);
  });
  el.value = LANG;
}

// i18n.js applyI18n() sonunda bunu cagirir: metni JS'ten gelen parcalar da tazelensin.
function onLangChanged() {
  if (!config.pages) return;
  if ($('langSelect')) $('langSelect').value = LANG;
  if ($('pairLang')) $('pairLang').value = LANG;
  if (typeof updateFsButton === 'function') updateFsButton();
  if (config.pages.length) { renderTabs(); renderGrid(); }
  if (!$('themeModal').classList.contains('hidden')) renderThemeModal();
}

setLang(detectLang());
fillLangSelect($('langSelect'));
fillLangSelect($('pairLang'));

$('langSelect').onchange = (e) => setLang(e.target.value);
$('pairLang').onchange = (e) => setLang(e.target.value);

// Saat gostergesi olcum surecine ihtiyac duymaz; kendi basina ilerlesin.
setInterval(tickLocalWidgets, 1000);

// Ayni makineden acildiysa host kod istemez; dogrudan baglan.
const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);

if (token || isLocalHost) {
  connect();
} else {
  $('pair').classList.remove('hidden');
}
