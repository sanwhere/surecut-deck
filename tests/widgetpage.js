// Gostergeleri denemek ve belgelemek icin gecici bir sayfa ekler/kaldirir.
//   node tests\widgetpage.js add
//   node tests\widgetpage.js remove
const WebSocket = require('ws');

const MODE = process.argv[2] === 'remove' ? 'remove' : 'add';
const PAGE_ID = 'demo-widgets';

const WIDGETS = [
  { widget: 'cpu',    color: '#5e81ac' },
  { widget: 'ram',    color: '#a3be8c' },
  { widget: 'gpu',    color: '#b48ead' },
  { widget: 'temp',   color: '#bf616a' },
  { widget: 'disk',   color: '#ebcb8b', drive: 'C:' },
  { widget: 'diskio', color: '#8fbcbb' },
  { widget: 'net',    color: '#88c0d0' },
  { widget: 'uptime', color: '#d08770' },
  { widget: 'clock',  color: '#81a1c1' }
];

const ws = new WebSocket('ws://127.0.0.1:8791');
ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token: '' })));

ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());

  if (m.type === 'authed') {
    const cfg = m.config;
    cfg.pages = cfg.pages.filter((p) => p.id !== PAGE_ID);

    if (MODE === 'add') {
      // Basa ekliyoruz: ekran goruntusu alirken istemci ilk sayfayla aciliyor.
      cfg.pages.unshift({
        id: PAGE_ID,
        name: 'Sistem',
        buttons: WIDGETS.map((w, i) => Object.assign({ id: 'w' + i, kind: 'widget' }, w))
      });
    }

    ws.send(JSON.stringify({
      type: 'saveConfig', id: 1, revision: m.revision,
      config: { settings: cfg.settings, pages: cfg.pages }
    }));
    return;
  }

  if (m.type === 'result') {
    console.log(m.ok ? (MODE === 'add' ? 'gosterge sayfasi eklendi' : 'gosterge sayfasi kaldirildi') : 'HATA: ' + m.message);
    process.exit(m.ok ? 0 : 1);
  }
});

setTimeout(() => { console.log('zaman asimi'); process.exit(1); }, 10000);
