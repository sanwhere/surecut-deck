// surecut-deck host - tabletten gelen buton basimlarini Windows eylemlerine cevirir.
//
// Mimari:
//   HTTP  : public/ altindaki PWA'yi servis eder
//   WS    : tablet ile canli baglanti (buton basimi, config senkronu)
//   Helper: InputHelper.exe uzun omurlu calisir, stdin uzerinden tus olayi alir

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');
const { WebSocketServer } = require('ws');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const TOKEN_PATH = path.join(DATA_DIR, 'token.txt');
const HOST_INI_PATH = path.join(DATA_DIR, 'host.ini');
const HELPER_EXE = path.join(ROOT, 'helper', 'InputHelper.exe');

// ---------------------------------------------------------------- yapilandirma

const DEFAULT_CONFIG = {
  settings: { columns: 4 },
  pages: [
    {
      id: 'main',
      name: 'Ana',
      buttons: [
        { id: 'b1', label: 'Kopyala', icon: '📋', color: '#3b82f6', action: { type: 'hotkey', keys: 'ctrl+c' } },
        { id: 'b2', label: 'Yapıştır', icon: '📌', color: '#3b82f6', action: { type: 'hotkey', keys: 'ctrl+v' } },
        { id: 'b3', label: 'Geri Al', icon: '↩️', color: '#3b82f6', action: { type: 'hotkey', keys: 'ctrl+z' } },
        { id: 'b4', label: 'Görev Yön.', icon: '📊', color: '#ef4444', action: { type: 'hotkey', keys: 'ctrl+shift+esc' } },
        { id: 'b5', label: 'Oynat/Dur', icon: '⏯️', color: '#22c55e', action: { type: 'hotkey', keys: 'playpause' } },
        { id: 'b6', label: 'Sonraki', icon: '⏭️', color: '#22c55e', action: { type: 'hotkey', keys: 'nexttrack' } },
        { id: 'b7', label: 'Ses +', icon: '🔊', color: '#22c55e', action: { type: 'hotkey', keys: 'volumeup' } },
        { id: 'b8', label: 'Ses -', icon: '🔉', color: '#22c55e', action: { type: 'hotkey', keys: 'volumedown' } },
        { id: 'b9', label: 'Masaüstü', icon: '🖥️', color: '#a855f7', action: { type: 'hotkey', keys: 'win+d' } },
        { id: 'b10', label: 'Kilitle', icon: '🔒', color: '#a855f7', action: { type: 'hotkey', keys: 'win+l' } },
        { id: 'b11', label: 'Not Defteri', icon: '📝', color: '#f59e0b', action: { type: 'launch', target: 'notepad.exe' } },
        { id: 'b12', label: 'Gezgin', icon: '📁', color: '#f59e0b', action: { type: 'launch', target: 'explorer.exe' } }
      ]
    }
  ]
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg.pages || !Array.isArray(cfg.pages) || cfg.pages.length === 0) cfg.pages = DEFAULT_CONFIG.pages;
    if (!cfg.settings) cfg.settings = { ...DEFAULT_CONFIG.settings };
    return cfg;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 30;

// Yazmadan ONCE mevcut dosyanin kopyasini al. Bayat bir istemcinin ustune
// yazmasi gibi durumlarda kullanicinin butonlari geri alinabilsin diye.
function backupConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(CONFIG_PATH, path.join(BACKUP_DIR, `config-${stamp}.json`));

    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('config-')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
    }
  } catch { /* yedek alinamazsa kayit yine de yapilsin */ }
}

function saveConfig(cfg, rev) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  backupConfig();
  // Once gecici dosyaya yaz, sonra tasi. Yazma sirasinda cokme olursa config bozulmaz.
  const tmp = CONFIG_PATH + '.tmp';
  const out = { rev: rev || null, settings: cfg.settings, pages: cfg.pages };
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_PATH);
}

// Host ayarlari (port) ve eslestirme kodu config.json disinda tutulur; boylece tray
// uygulamasi kullanici butonlarina hic dokunmadan bunlari degistirebilir.
function loadHostSettings() {
  const s = { port: 8791 };
  try {
    for (const line of fs.readFileSync(HOST_INI_PATH, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (k === 'port') s.port = Number(v) || s.port;
    }
  } catch { /* dosya yoksa varsayilan kullanilir */ }
  return s;
}

function loadToken() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    const t = fs.readFileSync(TOKEN_PATH, 'utf8').trim().toUpperCase();
    if (t) return t;
  } catch { /* asagida uretilir */ }

  // Eski surumlerde kod config.json icindeydi; varsa tasi ki kullanici yeniden eslestirmesin.
  let legacy = null;
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (c && typeof c.token === 'string' && c.token.trim()) {
      legacy = c.token.trim().toUpperCase();
      delete c.token;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2), 'utf8');
    }
  } catch { /* config yoksa sorun degil */ }

  const tok = legacy || crypto.randomBytes(4).toString('hex').toUpperCase();
  fs.writeFileSync(TOKEN_PATH, tok, 'utf8');
  return tok;
}

let config = loadConfig();
delete config.token;

// Yapilandirma jetonu. Her kayitta YENIDEN URETILIR ve config.json icinde saklanir.
//
// Onceden bellekte artan bir sayacti (`let revision = 1`) ve host her yeniden
// baslayisinda 1'e sifirlaniyordu. Uzun suredir acik duran bayat bir istemci de
// elinde 1 tutuyorsa sayilar tutuyor, bayat kaydi KABUL ediliyor ve aradaki
// degisiklikler siliniyordu. Rastgele jeton yeniden baslatmadan etkilenmez ve
// carpisamaz.
function newToken() { return crypto.randomBytes(8).toString('hex'); }

let revision = (typeof config.rev === 'string' && config.rev) ? config.rev : newToken();
delete config.rev;   // istemciye giden kopyada tutulmaz, ayrica gonderilir

// Touchpad'den gelen olaylarin sayaci. Jestin gercekten sunucuya ulasip
// ulasmadigini disaridan gormek icin /api/status'ta yayinlanir.
const mouseStats = {};
const hostSettings = loadHostSettings();
const PORT = Number(process.env.PORT) || hostSettings.port;
const TOKEN = loadToken();

// ---------------------------------------------------------------- input helper

let helper = null;
let helperQueue = [];

function startHelper() {
  if (!fs.existsSync(HELPER_EXE)) {
    console.error(`[helper] ${HELPER_EXE} bulunamadi. Once derle:\n  build-helper.cmd`);
    return;
  }
  helper = spawn(HELPER_EXE, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  helper.stdout.setEncoding('utf8');

  let buf = '';
  helper.stdout.on('data', (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      const waiter = helperQueue.shift();
      if (waiter) {
        if (line.startsWith('ERR ')) waiter.reject(new Error(line.slice(4)));
        else waiter.resolve(line);
      }
    }
  });

  helper.stderr.setEncoding('utf8');
  helper.stderr.on('data', (d) => console.error('[helper stderr]', d.trim()));

  helper.on('exit', (code) => {
    console.error(`[helper] cikti (kod ${code}), 1 sn sonra yeniden baslatiliyor`);
    helper = null;
    // Bekleyen istekleri serbest birak, aksi halde cagiranlar sonsuza kadar asili kalir.
    helperQueue.forEach((w) => w.reject(new Error('helper yeniden baslatildi')));
    helperQueue = [];
    setTimeout(startHelper, 1000);
  });

  console.log('[helper] baslatildi');
}

function helperSend(line) {
  return new Promise((resolve, reject) => {
    if (!helper || !helper.stdin.writable) return reject(new Error('helper calismiyor'));
    const timer = setTimeout(() => reject(new Error('helper zaman asimi')), 5000);
    helperQueue.push({
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); }
    });
    helper.stdin.write(line + '\n');
  });
}

// ---------------------------------------------------------------- eylemler

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runAction(action, depth = 0) {
  if (!action || typeof action !== 'object') throw new Error('gecersiz eylem');
  if (depth > 5) throw new Error('eylem ic ice sinirini asti');

  switch (action.type) {
    case 'hotkey':
      if (!action.keys) throw new Error('hotkey icin keys gerekli');
      return helperSend('KEY ' + action.keys);

    case 'text':
      if (typeof action.text !== 'string') throw new Error('text icin text gerekli');
      return helperSend('TEXT ' + action.text.replace(/\r?\n/g, '\n'));

    case 'launch': {
      if (!action.target) throw new Error('launch icin target gerekli');
      // start ile ac: exe, klasor veya kayitli protokol hepsi calisir.
      const args = action.args ? ' ' + action.args : '';
      return new Promise((resolve, reject) => {
        exec(`start "" "${action.target}"${args}`, { shell: 'cmd.exe' }, (err) =>
          err ? reject(err) : resolve('OK'));
      });
    }

    case 'url': {
      if (!action.url) throw new Error('url icin url gerekli');
      if (!/^https?:\/\//i.test(action.url)) throw new Error('sadece http/https');
      return new Promise((resolve, reject) => {
        exec(`start "" "${action.url}"`, { shell: 'cmd.exe' }, (err) =>
          err ? reject(err) : resolve('OK'));
      });
    }

    case 'command': {
      if (!action.command) throw new Error('command icin command gerekli');
      const usePs = action.shell !== 'cmd';
      return new Promise((resolve, reject) => {
        const child = usePs
          ? exec(action.command, { shell: 'powershell.exe', windowsHide: true, timeout: 30000 })
          : exec(action.command, { shell: 'cmd.exe', windowsHide: true, timeout: 30000 });
        let out = '';
        child.stdout && child.stdout.on('data', (d) => { out += d; });
        child.stderr && child.stderr.on('data', (d) => { out += d; });
        child.on('close', (code) =>
          code === 0 ? resolve(out.trim().slice(0, 500) || 'OK')
                     : reject(new Error(`cikis kodu ${code}: ${out.trim().slice(0, 200)}`)));
        child.on('error', reject);
      });
    }

    case 'mouse': {
      // Tek seferlik fare eylemi (buton olarak). Touchpad akisi ayri mesajla gelir.
      const op = action.op || 'click';
      if (op === 'click' || op === 'down' || op === 'up') {
        const btn = ['left', 'right', 'middle'].includes(action.button) ? action.button : 'left';
        return helperSend((op === 'click' ? 'MCLICK ' : op === 'down' ? 'MDOWN ' : 'MUP ') + btn);
      }
      if (op === 'move') return helperSend(`MMOVE ${Math.round(action.dx || 0)} ${Math.round(action.dy || 0)}`);
      if (op === 'scroll') return helperSend(`MSCROLL ${Number(action.amount) || 0}`);
      throw new Error('bilinmeyen fare islemi: ' + op);
    }

    case 'sequence': {
      if (!Array.isArray(action.steps)) throw new Error('sequence icin steps gerekli');
      for (const step of action.steps) await runAction(step, depth + 1);
      return 'OK';
    }

    case 'delay':
      await sleep(Math.min(Number(action.ms) || 100, 10000));
      return 'OK';

    default:
      throw new Error('bilinmeyen eylem tipi: ' + action.type);
  }
}

// ---------------------------------------------------------------- http

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) { reject(new Error('govde cok buyuk')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Tray uygulamasinin surukle-birak ile buton eklemesi icin kullandigi uclar.
// Sadece ayni makineden erisilebilir.
async function handleApi(req, res, url) {
  if (!isLoopback(req)) { sendJson(res, 403, { ok: false, error: 'sadece yerel' }); return true; }

  if (url.pathname === '/api/status' && req.method === 'GET') {
    let remote = 0, local = 0;
    wss.clients.forEach((c) => {
      if (c.readyState !== c.OPEN || !c.authed) return;
      if (c.isLocal) local++; else remote++;
    });
    // remote = tablet gibi agdan baglanan istemciler; tray tiklamasi buna gore davranir.
    sendJson(res, 200, { ok: true, remote: remote, local: local, mouse: mouseStats });
    return true;
  }

  if (url.pathname === '/api/pages' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, pages: config.pages.map((p) => ({ id: p.id, name: p.name })) });
    return true;
  }

  if (url.pathname === '/api/button' && req.method === 'POST') {
    try {
      const b = JSON.parse(await readBody(req));
      const page = config.pages.find((p) => p.id === b.pageId) || config.pages[0];
      if (!page) throw new Error('sayfa yok');
      if (!b.action || !b.action.type) throw new Error('eylem gerekli');

      const btn = {
        id: 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36),
        label: String(b.label || 'Buton').slice(0, 40),
        icon: b.icon || '⚡',
        color: /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#3b82f6',
        action: b.action
      };
      if (b.iconUrl) btn.iconUrl = String(b.iconUrl).slice(0, 200);

      page.buttons.push(btn);
      revision = newToken();
      saveConfig(config, revision);
      broadcastConfig(null);
      console.log(`[api] buton eklendi: ${btn.label} -> ${page.name}`);
      sendJson(res, 200, { ok: true, id: btn.id });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    if (await handleApi(req, res, url)) return;
    sendJson(res, 404, { ok: false, error: 'bilinmeyen uc' });
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';

  // Dizin disina cikmayi engelle (path traversal).
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bulunamadi');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      // no-store sart: ETag/Last-Modified gondermedigimiz icin "no-cache" ile Chrome
      // dogrulama yapamayip eski dosyayi kullaniyor ve duzeltmeler tablete ulasmiyor.
      'Cache-Control': 'no-store, must-revalidate'
    });
    res.end(data);
  });
});

// ---------------------------------------------------------------- websocket

const wss = new WebSocketServer({ server });

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcastConfig(except) {
  const payload = JSON.stringify({ type: 'config', config: publicConfig(), assetVersion: assetVersion(), revision });
  wss.clients.forEach((c) => {
    if (c !== except && c.readyState === c.OPEN && c.authed) c.send(payload);
  });
}

// Token'i istemciye asla geri gondermeyiz.
function publicConfig() {
  return { settings: config.settings, pages: config.pages };
}

// Arayuz dosyalarinin en yeni degisiklik zamani. Istemci bunu izler; degisince
// kendini yeniler, boylece kod guncellemesi sonrasi elle yenileme gerekmez.
function assetVersion() {
  let newest = 0;
  for (const f of ['index.html', 'app.js', 'style.css']) {
    try {
      const m = fs.statSync(path.join(PUBLIC_DIR, f)).mtimeMs;
      if (m > newest) newest = m;
    } catch { /* dosya yoksa atla */ }
  }
  return Math.floor(newest);
}

function isLoopback(req) {
  const a = (req && req.socket && req.socket.remoteAddress) || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

wss.on('connection', (ws, req) => {
  ws.authed = false;
  // Ayni makineden gelen baglanti kod istemez: burada calisan her sey zaten
  // dogrudan tus gonderebilir, kod sormak guvenlik katmiyor sadece zorluyor.
  ws.isLocal = isLoopback(req);

  const authTimer = setTimeout(() => {
    if (!ws.authed) ws.close(4001, 'kimlik dogrulama zaman asimi');
  }, 10000);

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'auth') {
      if (ws.isLocal) {
        ws.authed = true;
      } else {
        // Sabit sureli karsilastirma: token'i deneme-yanilma ile cozmeyi zorlastirir.
        const a = Buffer.from(String(msg.token || '').toUpperCase());
        const b = Buffer.from(TOKEN);
        ws.authed = a.length === b.length && crypto.timingSafeEqual(a, b);
      }
      if (ws.authed) {
        clearTimeout(authTimer);
        send(ws, { type: 'authed', config: publicConfig(), assetVersion: assetVersion(), revision });
        console.log(ws.isLocal ? '[ws] yerel istemci baglandi' : '[ws] istemci dogrulandi');
      } else {
        send(ws, { type: 'error', message: 'Eşleştirme kodu hatalı' });
        ws.close(4003, 'gecersiz token');
      }
      return;
    }

    if (!ws.authed) return;

    if (msg.type === 'press') {
      const page = config.pages.find((p) => p.id === msg.pageId);
      const btn = page && page.buttons.find((b) => b.id === msg.buttonId);
      if (!btn) return send(ws, { type: 'result', id: msg.id, ok: false, message: 'buton bulunamadi' });
      try {
        const out = await runAction(btn.action);
        send(ws, { type: 'result', id: msg.id, ok: true, message: String(out).slice(0, 200) });
        console.log(`[press] ${btn.label}`);
      } catch (e) {
        send(ws, { type: 'result', id: msg.id, ok: false, message: e.message });
        console.error(`[press] ${btn.label} HATA: ${e.message}`);
      }
      return;
    }

    // Touchpad akisi: saniyede onlarca mesaj gelir, bu yuzden yanit dondurmez
    // ve hata durumunda sessizce duser - tek bir kayip hareket onemli degil.
    if (msg.type === 'mouse') {
      // Akis komutlari yardimcinin yanitini BEKLEMEZ. Beklemek her hareket icin
      // bir gidis-donus gecikmesi ekliyor ve parmak takip ederken his olarak
      // gecikme yaratiyordu. Hata olursa tek bir olay duser, onemli degil.
      const fire = (line) => { helperSend(line).catch(() => {}); };
      const op = msg.op;
      mouseStats[op] = (mouseStats[op] || 0) + 1;   // tani icin: /api/status

      if (op === 'move') {
        const dx = Math.round(Number(msg.dx) || 0);
        const dy = Math.round(Number(msg.dy) || 0);
        if (dx || dy) fire(`MMOVE ${dx} ${dy}`);
      } else if (op === 'click' || op === 'down' || op === 'up') {
        const btn = ['left', 'right', 'middle'].includes(msg.button) ? msg.button : 'left';
        fire((op === 'click' ? 'MCLICK ' : op === 'down' ? 'MDOWN ' : 'MUP ') + btn);
      } else if (op === 'scroll') {
        const amt = Number(msg.amount) || 0;
        if (amt) fire(`MSCROLL ${amt.toFixed(3)}`);
      } else if (op === 'hscroll') {
        const amt = Number(msg.amount) || 0;
        if (amt) fire(`MHSCROLL ${amt.toFixed(3)}`);
      } else if (op === 'zoom') {
        // Ctrl+tekerlek. Yardimci tek cagrida yapar: uc ayri tura bolunse
        // arada bir mesaj dustugunde Ctrl basili kalirdi.
        const amt = Number(msg.amount) || 0;
        if (amt) fire(`MZOOM ${amt.toFixed(3)}`);
      } else if (op === 'keys') {
        // Jestlerin tetikledigi kisayollar (uc parmak vb.)
        if (typeof msg.keys === 'string' && msg.keys) fire('KEY ' + msg.keys);
      }
      return;
    }

    if (msg.type === 'test') {
      try {
        const out = await runAction(msg.action);
        send(ws, { type: 'result', id: msg.id, ok: true, message: String(out).slice(0, 200) });
      } catch (e) {
        send(ws, { type: 'result', id: msg.id, ok: false, message: e.message });
      }
      return;
    }

    if (msg.type === 'saveConfig') {
      try {
        if (!msg.config || !Array.isArray(msg.config.pages)) throw new Error('gecersiz config');

        // Bayat istemci korumasi: elindeki surum guncel degilse kaydi reddet ve
        // ona guncel yapilandirmayi gonder, kendini tazelesin.
        //
        // Surum ZORUNLU. Once "typeof === number" ile kosullamistik; surum alani
        // hic gondermeyen ESKI istemciler denetimi tamamen atlayip bayat kopyalarini
        // uzerine yaziyordu (uzun suredir acik duran bir duzenleyici penceresi
        // yuzunden bir buton bu sekilde kayboldu).
        if (typeof msg.revision !== 'string' || msg.revision !== revision) {
          send(ws, {
            type: 'result', id: msg.id, ok: false,
            message: 'Yapılandırma başka bir yerde değişmiş, ekran tazelendi'
          });
          send(ws, { type: 'config', config: publicConfig(), assetVersion: assetVersion(), revision });
          console.log('[config] bayat kayit reddedildi (istemci ' + msg.revision + ', sunucu ' + revision + ')');
          return;
        }

        config.pages = msg.config.pages;
        config.settings = msg.config.settings || config.settings;
        revision = newToken();
        saveConfig(config, revision);
        // Yeni surumu kaydedene de bildir. broadcastConfig goendereni disladigi icin
        // bunu yapmazsak istemci eski surumde kalir ve IKINCI kaydi hep reddedilir.
        send(ws, { type: 'result', id: msg.id, ok: true, message: 'kaydedildi', revision });
        broadcastConfig(ws);
        console.log(`[config] guncellendi (surum ${revision})`);
      } catch (e) {
        send(ws, { type: 'result', id: msg.id, ok: false, message: e.message });
      }
      return;
    }
  });

  ws.on('close', () => clearTimeout(authTimer));
});

// ---------------------------------------------------------------- baslat

function localAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
    }
  }
  return out;
}

startHelper();

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║           surecut-deck host aktif           ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`  Eşleştirme kodu:  ${TOKEN}\n`);
  console.log('  Tabletten şu adreslerden birini aç:');
  for (const { name, address } of localAddresses()) {
    console.log(`    http://${address}:${PORT}     (${name})`);
  }
  console.log('\n  Durdurmak için Ctrl+C\n');
});
