// Belge ekran goruntuleri icin gecici, Ingilizce etiketli bir sayfa ekler/kaldirir.
//   node data\demopage.js add
//   node data\demopage.js remove
const WebSocket = require('ws');

const MODE = process.argv[2] === 'remove' ? 'remove' : 'add';
const PAGE_ID = 'demo-guide';

const BUTTONS = [
  { label: 'Copy',        icon: '📋', color: '#5e81ac', action: { type: 'hotkey', keys: 'ctrl+c' } },
  { label: 'Paste',       icon: '📌', color: '#5e81ac', action: { type: 'hotkey', keys: 'ctrl+v' } },
  { label: 'Undo',        icon: '↩️', color: '#5e81ac', action: { type: 'hotkey', keys: 'ctrl+z' } },
  { label: 'Task Mgr',    icon: '📊', color: '#bf616a', action: { type: 'hotkey', keys: 'ctrl+shift+esc' } },
  { label: 'Lock',        icon: '🔒', color: '#b48ead', action: { type: 'hotkey', keys: 'win+l' } },

  { label: 'Play/Pause',  icon: '⏯️', color: '#a3be8c', action: { type: 'hotkey', keys: 'playpause' } },
  { label: 'Next',        icon: '⏭️', color: '#a3be8c', action: { type: 'hotkey', keys: 'nexttrack' } },
  { label: 'Volume +',    icon: '🔊', color: '#a3be8c', action: { type: 'hotkey', keys: 'volumeup' } },
  { label: 'Mute',        icon: '🔇', color: '#8fbcbb', action: { type: 'hotkey', keys: 'mute' } },
  { label: 'Mouse',       icon: '🖱️', color: '#88c0d0', action: { type: 'touchpad' } },

  { label: 'Notepad',     icon: '📝', color: '#ebcb8b', action: { type: 'launch', target: 'notepad.exe' } },
  { label: 'Explorer',    icon: '📁', color: '#ebcb8b', action: { type: 'launch', target: 'explorer.exe' } },
  { label: 'Docs',        icon: '🌐', color: '#d08770', action: { type: 'url', url: 'https://example.com' } },
  { label: 'Signature',   icon: '✍️', color: '#d08770', action: { type: 'text', text: 'Best regards,' } },
  { label: 'Screenshot',  icon: '📷', color: '#b48ead', action: { type: 'sequence', steps: [
      { type: 'hotkey', keys: 'win+shift+s' }, { type: 'delay', ms: 300 } ] } }
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
        name: 'Deck',
        buttons: BUTTONS.map((b, i) => Object.assign({ id: 'demo' + i }, b))
      });
    }

    ws.send(JSON.stringify({
      type: 'saveConfig', id: 1, revision: m.revision,
      config: { settings: cfg.settings, pages: cfg.pages }
    }));
    return;
  }

  if (m.type === 'result') {
    console.log(m.ok ? (MODE === 'add' ? 'demo sayfasi eklendi' : 'demo sayfasi kaldirildi') : 'HATA: ' + m.message);
    process.exit(m.ok ? 0 : 1);
  }
});

setTimeout(() => { console.log('zaman asimi'); process.exit(1); }, 10000);
