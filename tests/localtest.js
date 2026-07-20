// Yerel baglantinin eslestirme kodu olmadan dogrulandigini ve uzaktan baglantinin
// hala kod istedigini kontrol eder.
const WebSocket = require('ws');
const os = require('os');

function lanAddress() {
  const ifaces = os.networkInterfaces();
  for (const addrs of Object.values(ifaces))
    for (const a of addrs || [])
      if (a.family === 'IPv4' && !a.internal && a.address.startsWith('192.168.')) return a.address;
  return null;
}

function tryConnect(host, token) {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://' + host + ':8791');
    let done = false;
    const finish = (r) => { if (!done) { done = true; try { ws.close(); } catch {} resolve(r); } };

    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token: token })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'authed') finish('AUTHED');
      else if (m.type === 'error') finish('REDDEDILDI');
    });
    ws.on('close', () => finish('KAPANDI'));
    ws.on('error', () => finish('BAGLANTI HATASI'));
    setTimeout(() => finish('ZAMAN ASIMI'), 6000);
  });
}

(async () => {
  let fails = 0;
  const check = (name, ok, got) => {
    if (!ok) fails++;
    console.log('  ' + (ok ? 'OK  ' : 'HATA') + '  ' + name + '  ->  ' + got);
  };

  console.log('\n--- yerel/uzak kimlik dogrulama ---\n');

  const a = await tryConnect('127.0.0.1', '');
  check('yerel baglanti kod istemiyor', a === 'AUTHED', a);

  const lan = lanAddress();
  if (lan) {
    const b = await tryConnect(lan, 'YANLISKOD');
    check('uzak baglanti yanlis kodu reddediyor', b === 'REDDEDILDI' || b === 'KAPANDI', b);

    const tok = require('fs').readFileSync(require('path').join(__dirname, 'token.txt'), 'utf8').trim();
    const c = await tryConnect(lan, tok);
    check('uzak baglanti dogru kodu kabul ediyor', c === 'AUTHED', c);
  } else {
    console.log('  --  LAN adresi bulunamadi, uzak testler atlandi');
  }

  console.log('\n' + (fails === 0 ? 'TUM TESTLER GECTI' : fails + ' TEST BASARISIZ') + '\n');
  process.exit(fails === 0 ? 0 : 1);
})();
