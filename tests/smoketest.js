// Host'u tablet olmadan test eder. Odak calan veya veri kaybettirebilecek hicbir sey yapmaz:
// tus enjeksiyonu NumLock ac/kapa ile dogrulanir, sonra eski haline dondurulur.
const WebSocket = require('ws');
const { execFile } = require('child_process');

const token = process.argv[2];
const ws = new WebSocket('ws://127.0.0.1:8791');
let id = 0;
const waits = new Map();

function call(payload) {
  return new Promise((res) => {
    const n = ++id;
    waits.set(n, res);
    ws.send(JSON.stringify({ ...payload, id: n }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// NumLock durumunu Win32 GetKeyState ile oku.
function numLock() {
  const ps = `
    Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;
      public class K { [DllImport("user32.dll")] public static extern short GetKeyState(int k); }' -ErrorAction SilentlyContinue
    [K]::GetKeyState(0x90) -band 1`;
  return new Promise((res, rej) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', ps], (e, out) =>
      e ? rej(e) : res(out.trim()));
  });
}

let failures = 0;
function check(name, ok, extra) {
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK  ' : 'HATA'}  ${name}${extra ? '  ->  ' + extra : ''}`);
}

ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token })));

ws.on('message', async (raw) => {
  const m = JSON.parse(raw.toString());

  if (m.type === 'error') { console.log('AUTH HATA:', m.message); process.exit(1); }

  if (m.type === 'result') {
    const w = waits.get(m.id);
    if (w) { waits.delete(m.id); w(m); }
    return;
  }

  if (m.type !== 'authed') return;

  console.log('\n--- surecut-deck host testi ---\n');
  check('kimlik dogrulama', true);
  check('yapilandirma geldi', m.config.pages.length > 0,
        `${m.config.pages.length} sayfa, ${m.config.pages[0].buttons.length} buton`);

  // 1) Tus enjeksiyonu: NumLock'u degistir, dogrula, geri al.
  const before = await numLock();
  await call({ type: 'test', action: { type: 'hotkey', keys: 'numlock' } });
  await sleep(250);
  const after = await numLock();
  check('SendInput tus enjeksiyonu', before !== after, `numlock ${before} -> ${after}`);
  await call({ type: 'test', action: { type: 'hotkey', keys: 'numlock' } });   // eski haline dondur
  await sleep(250);
  const restored = await numLock();
  check('numlock geri alindi', restored === before, `${restored}`);

  // 2) Gecersiz tus reddedilmeli
  let r = await call({ type: 'test', action: { type: 'hotkey', keys: 'boyleBirTusYok' } });
  check('gecersiz tus reddi', !r.ok, r.message);

  // 3) Komut calistirma
  r = await call({ type: 'test', action: { type: 'command', shell: 'powershell', command: 'Write-Output merhaba' } });
  check('powershell komutu', r.ok && r.message.includes('merhaba'), r.message);

  // 4) Basarisiz komut hata dondurmeli
  r = await call({ type: 'test', action: { type: 'command', shell: 'powershell', command: 'exit 3' } });
  check('basarisiz komut hata veriyor', !r.ok, r.message);

  // 5) url dogrulamasi: http disi sema reddedilmeli
  r = await call({ type: 'test', action: { type: 'url', url: 'file:///C:/Windows/System32' } });
  check('http disi url reddi', !r.ok, r.message);

  // 6) Sirali adimlar (sadece gecikme, gorsel etki yok)
  r = await call({ type: 'test', action: { type: 'sequence', steps: [{ type: 'delay', ms: 50 }, { type: 'delay', ms: 50 }] } });
  check('sirali adimlar', r.ok);

  // 7) Bilinmeyen eylem tipi reddedilmeli
  r = await call({ type: 'test', action: { type: 'rmdir' } });
  check('bilinmeyen eylem reddi', !r.ok, r.message);

  console.log(`\n${failures === 0 ? 'TUM TESTLER GECTI' : failures + ' TEST BASARISIZ'}\n`);
  process.exit(failures === 0 ? 0 : 1);
});

ws.on('error', (e) => { console.log('WS HATA:', e.message); process.exit(1); });
setTimeout(() => { console.log('zaman asimi'); process.exit(1); }, 45000);
