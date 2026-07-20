// Belge ekran goruntuleri icin gecici, Ingilizce etiketli bir gosterge sayfasi
// ekler/kaldirir. Kullanicinin kendi sayfalarina dokunmaz.
//
//   node tests\docspage.js add
//   node tests\docspage.js remove
const WebSocket = require('ws');

const MODE = process.argv[2] === 'remove' ? 'remove' : 'add';
const PAGE_ID = 'demo-docs';

// Iki bicem de gorunsun: kadran ve cubuk. Renkler Nord paletinden, rehberdeki
// diger goruntulerle ayni gorsel dilde dursun diye.
const ITEMS = [
  { kind: 'widget', widget: 'cpu',    color: '#88c0d0' },
  { kind: 'widget', widget: 'ram',    color: '#a3be8c' },
  { kind: 'widget', widget: 'gpu',    color: '#b48ead' },
  { kind: 'widget', widget: 'disk',   color: '#ebcb8b', drive: 'C:' },

  { kind: 'widget', widget: 'cpu',    color: '#88c0d0', style: 'bar' },
  { kind: 'widget', widget: 'ram',    color: '#a3be8c', style: 'bar' },
  { kind: 'widget', widget: 'net',    color: '#5e81ac' },
  { kind: 'widget', widget: 'clock',  color: '#d08770' },

  { kind: 'widget', widget: 'diskio', color: '#8fbcbb' },
  { kind: 'widget', widget: 'uptime', color: '#81a1c1' },
  { kind: 'widget', widget: 'temp',   color: '#bf616a' },
  // Bir buton: gostergelerin siradan butonlarla ayni izgarada durdugu gorunsun.
  { label: 'Task Mgr', icon: '📊', color: '#bf616a', action: { type: 'hotkey', keys: 'ctrl+shift+esc' } }
];

const ws = new WebSocket('ws://127.0.0.1:8791');
ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token: '' })));

ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());

  if (m.type === 'authed') {
    const cfg = m.config;
    cfg.pages = cfg.pages.filter((p) => p.id !== PAGE_ID);

    if (MODE === 'add') {
      cfg.pages.unshift({
        id: PAGE_ID,
        name: 'System',
        columns: 4,
        buttons: ITEMS.map((b, i) => Object.assign({ id: 'd' + i }, b))
      });
    }

    ws.send(JSON.stringify({
      type: 'saveConfig', id: 1, revision: m.revision,
      config: { settings: cfg.settings, pages: cfg.pages }
    }));
    return;
  }

  if (m.type === 'result') {
    console.log(m.ok ? (MODE === 'add' ? 'belge sayfasi eklendi' : 'belge sayfasi kaldirildi') : 'HATA: ' + m.message);
    process.exit(m.ok ? 0 : 1);
  }
});

setTimeout(() => { console.log('zaman asimi'); process.exit(1); }, 10000);
