// Uctan uca surukleme sinamasi: gercek bir tarayicida bir ogeyi tutup baska
// bir sayfanin sekmesine birakir ve yapilandirmanin gercekten degistigini
// dogrular.
//
// Birim testleri tasima islemini kapsiyor ama isaretcinin sekmenin uzerinde
// olup olmadigini anlamak tarayici gerektiriyor: hayaletin isaretciyi
// engellemesi, uzun basma suresi, olay sirasi ancak burada ortaya cikar.
//
// Gereksinim: calisan host ve Edge (ya da Chrome).
//   node tests\dragtest.js

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 9222;
const DECK = 'http://127.0.0.1:8791/?lang=en';
const PROFILE = path.join(require('os').tmpdir(), 'surecut-dragtest');

const EDGES = [
  process.env['ProgramFiles(x86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.ProgramFiles + '\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.ProgramFiles + '\\Google\\Chrome\\Application\\chrome.exe'
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
    const c = new CDP(ws);
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      const w = c.waiting.get(m.id);
      if (w) { c.waiting.delete(m.id); m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result); }
    });
    return c;
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + expr);
    return r.result.value;
  }
  mouse(type, x, y) {
    return this.send('Input.dispatchMouseEvent', {
      type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1
    });
  }
}

let fail = 0;
function ok(cond, name, extra) {
  if (cond) console.log('  OK    ' + name);
  else { fail++; console.log('  HATA  ' + name + (extra ? '  -> ' + extra : '')); }
}

(async () => {
  const exe = EDGES.find((p) => p && fs.existsSync(p));
  if (!exe) { console.log('Edge/Chrome bulunamadi, sinama atlandi'); process.exit(0); }

  const browser = spawn(exe, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, DECK
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    // Tarayicinin hata ayiklama ucunu acmasini bekle.
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) {
      await sleep(250);
      try {
        const list = await getJson('http://127.0.0.1:' + PORT + '/json');
        targets = list.filter((t) => t.type === 'page' && t.url.indexOf('8791') >= 0);
        if (!targets.length) targets = null;
      } catch { /* henuz hazir degil */ }
    }
    if (!targets) throw new Error('tarayici hata ayiklama ucu acilmadi');

    cdp = await CDP.attach(targets[0].webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');

    // Yapilandirmanin gelmesini bekle.
    for (let i = 0; i < 40; i++) {
      const n = await cdp.eval('(typeof config !== "undefined" && config.pages) ? config.pages.length : 0');
      if (n >= 2) break;
      await sleep(250);
    }

    const pageCount = await cdp.eval('config.pages.length');
    if (pageCount < 2) { console.log('en az iki sayfa gerekli, sinama atlandi'); process.exit(0); }

    // Duzenleme moduna gec ve ilk sayfayi ac.
    await cdp.eval('activePage = 0; editing = true; render();');
    await sleep(400);

    const before = await cdp.eval('JSON.stringify(config.pages.map(p => p.buttons.length))');
    const movedId = await cdp.eval('config.pages[0].buttons[0].id');
    ok(!!movedId, 'tasinacak oge var', 'id=' + movedId);

    // Ilk butonun ve ikinci sayfa sekmesinin ekran konumlari.
    const box = await cdp.eval(`(() => {
      const b = document.querySelector('#grid .btn').getBoundingClientRect();
      const t = document.querySelector('[data-page="1"]').getBoundingClientRect();
      return JSON.stringify({
        bx: b.left + b.width / 2, by: b.top + b.height / 2,
        tx: t.left + t.width / 2, ty: t.top + t.height / 2
      });
    })()`);
    const { bx, by, tx, ty } = JSON.parse(box);

    // Basili tut, sekmeye surukle, birak.
    await cdp.mouse('mousePressed', bx, by);
    await sleep(700);                       // LONG_PRESS_MS (500) gecsin
    const dragging = await cdp.eval('!!dragState');
    ok(dragging, 'basili tutunca surukleme basladi');

    // Kucuk adimlarla ilerle: tek sicrayista gitmek gercek kullanimi yansitmaz.
    for (let i = 1; i <= 6; i++) {
      await cdp.mouse('mouseMoved', bx + ((tx - bx) * i) / 6, by + ((ty - by) * i) / 6);
      await sleep(60);
    }

    const marked = await cdp.eval('!!document.querySelector(\'[data-page="1"].drop-target\')');
    ok(marked, 'hedef sekme isaretlendi');

    const dropPage = await cdp.eval('dragState ? dragState.dropPage : -99');
    ok(dropPage === 1, 'birakma hedefi ikinci sayfa', 'dropPage=' + dropPage);

    await cdp.mouse('mouseReleased', tx, ty);
    await sleep(600);

    const after = await cdp.eval('JSON.stringify(config.pages.map(p => p.buttons.length))');
    const b0 = JSON.parse(before), a0 = JSON.parse(after);
    ok(a0[0] === b0[0] - 1, 'kaynak sayfa bir eksildi', before + ' -> ' + after);
    ok(a0[1] === b0[1] + 1, 'hedef sayfa bir arttti', before + ' -> ' + after);

    const landed = await cdp.eval(`config.pages[1].buttons[config.pages[1].buttons.length - 1].id === ${JSON.stringify(movedId)}`);
    ok(landed, 'oge hedefin sonuna kondu');

    const cleared = await cdp.eval('!dragState && !document.body.classList.contains("dragging") && !document.querySelector(".drop-target")');
    ok(cleared, 'surukleme durumu temizlendi');

    // Tasidigimiz ogeyi geri koy: sinama kalici iz birakmasin.
    await cdp.eval('moveItemToPage(config.pages, 1, config.pages[1].buttons.length - 1, 0); saveConfig();');
    await sleep(500);
    const restored = await cdp.eval('JSON.stringify(config.pages.map(p => p.buttons.length))');
    ok(restored === before, 'sinama sonrasi eski haline dondu', restored);
  } catch (e) {
    fail++;
    console.log('  HATA  ' + e.message);
  } finally {
    if (cdp) try { cdp.ws.close(); } catch { /* zaten kapali */ }
    try { browser.kill(); } catch { /* zaten oldu */ }
  }

  console.log('\n' + (fail ? fail + ' SORUN' : 'TUM TESTLER GECTI') + '\n');
  process.exit(fail ? 1 : 0);
})();
