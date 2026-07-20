// Fare enjeksiyonunu dogrular. Tiklama GONDERMEZ - odaktaki pencereye
// istenmeyen tik atmamak icin.
//
// Iki tuzak var:
//  1) Windows "isaretci hassasiyetini artir" ayari goreli harekete ivme uygular,
//     yani 60 piksel gonderince imlec 60'tan fazla gidebilir. Bu yuzden birebir
//     esitlik degil YON ve makul buyukluk kontrol edilir.
//  2) Kullanici o sirada fareyi elle oynatirsa olcum bozulur. Once bir kontrol
//     olcumu yapilip mudahale tespit edilir.
const WebSocket = require('ws');
const { execFile } = require('child_process');

function cursorPos() {
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    $p = [System.Windows.Forms.Cursor]::Position
    "$($p.X),$($p.Y)"`;
  return new Promise((res, rej) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', ps], (e, out) => {
      if (e) return rej(e);
      const [x, y] = out.trim().split(',').map(Number);
      res({ x, y });
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ws = new WebSocket('ws://127.0.0.1:8791');
let fails = 0;
const check = (n, ok, got) => { if (!ok) fails++; console.log('  ' + (ok ? 'OK  ' : 'HATA') + '  ' + n + (got ? '  ->  ' + got : '')); };

ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token: '' })));

ws.on('message', async (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.type !== 'authed') return;

  console.log('\n--- fare kontrolu ---\n');

  // Kontrol olcumu: hicbir sey gondermeden imlec kendi kendine oynuyor mu?
  const c1 = await cursorPos();
  await sleep(600);
  const c2 = await cursorPos();
  if (c1.x !== c2.x || c1.y !== c2.y) {
    console.log('  !! imlec kendiliginden hareket ediyor (fare elle kullaniliyor).');
    console.log('  !! Fareye dokunmayi birak ve testi tekrar calistir.\n');
    process.exit(2);
  }
  console.log('  imlec sabit, olcum guvenilir. Baslangic: ' + c2.x + ',' + c2.y + '\n');

  const start = c2;

  // 1) Buyuk tek hareket: yon ve makul buyukluk
  ws.send(JSON.stringify({ type: 'mouse', op: 'move', dx: 200, dy: 150 }));
  await sleep(400);
  const p1 = await cursorPos();
  const d1x = p1.x - start.x, d1y = p1.y - start.y;
  check('goreli hareket dogru yonde', d1x > 60 && d1y > 40, d1x + ',' + d1y + ' (ivme nedeniyle 200,150 ile birebir olmayabilir)');

  // 2) Ters yon: geri gelmeli
  ws.send(JSON.stringify({ type: 'mouse', op: 'move', dx: -200, dy: -150 }));
  await sleep(400);
  const p2 = await cursorPos();
  check('ters yonde hareket', (p2.x - p1.x) < -60 && (p2.y - p1.y) < -40, (p2.x - p1.x) + ',' + (p2.y - p1.y));

  // 3) Akis: touchpad'in gonderdigi gibi cok sayida kucuk hareket birikmeli
  const before3 = await cursorPos();
  for (let i = 0; i < 30; i++) ws.send(JSON.stringify({ type: 'mouse', op: 'move', dx: 4, dy: 0 }));
  await sleep(800);
  const after3 = await cursorPos();
  check('30 kucuk hareket birikti', (after3.x - before3.x) > 40 && Math.abs(after3.y - before3.y) < 15,
        (after3.x - before3.x) + ',' + (after3.y - before3.y));

  // 4) Kaydirma baglantiyi bozmamali
  ws.send(JSON.stringify({ type: 'mouse', op: 'scroll', amount: 0 }));
  ws.send(JSON.stringify({ type: 'mouse', op: 'hscroll', amount: 0 }));
  await sleep(250);
  check('kaydirma komutlari baglantiyi bozmadi', ws.readyState === WebSocket.OPEN);

  // Imleci baslangica dondur
  const cur = await cursorPos();
  ws.send(JSON.stringify({ type: 'mouse', op: 'move', dx: start.x - cur.x, dy: start.y - cur.y }));
  await sleep(400);
  const back = await cursorPos();
  console.log('\n  imlec son konum: ' + back.x + ',' + back.y + ' (baslangic ' + start.x + ',' + start.y + ')');

  console.log('\n' + (fails === 0 ? 'TUM TESTLER GECTI' : fails + ' TEST BASARISIZ') + '\n');
  process.exit(fails === 0 ? 0 : 1);
});

ws.on('error', (e) => { console.log('WS HATA: ' + e.message); process.exit(1); });
setTimeout(() => { console.log('zaman asimi'); process.exit(1); }, 40000);
