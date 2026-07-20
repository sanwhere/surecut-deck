// Gosterge mantigini tarayicisiz dogrular: yay hesabi, bicimlendirme, gecmis
// ve kivilcim cizgisi. Kucuk bir DOM taklidi kuruyoruz; amac cizimin gorunumu
// degil, ureilen sayilarin ve niteliklerin dogrulugu.
//
//   node tests\widgettest.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  OK    ' + name); }
  else { fail++; console.log('  HATA  ' + name + (extra ? '  -> ' + extra : '')); }
}
function eq(a, b, name) { ok(a === b, name, 'beklenen ' + JSON.stringify(b) + ', gelen ' + JSON.stringify(a)); }

// ------------------------------------------------------------- DOM taklidi

function makeEl(tag) {
  return {
    tagName: tag,
    children: [],
    attrs: {},
    classes: new Set(),
    dataset: {},
    style: { _p: {}, setProperty(k, v) { this._p[k] = v; }, removeProperty(k) { delete this._p[k]; } },
    _text: '',
    set textContent(v) { this._text = String(v); this.children.length = 0; },
    get textContent() { return this._text; },
    // widgets.js siniflari hem className hem setAttribute ile veriyor.
    set className(v) { String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classes.add(c)); },
    get className() { return [...this.classes].join(' '); },
    set innerHTML(v) { this._html = v; parseStub(this, v); },
    get innerHTML() { return this._html || ''; },
    classList: {
      add: function () { for (const c of arguments) this._o.classes.add(c); },
      toggle: function (c, on) { on ? this._o.classes.add(c) : this._o.classes.delete(c); },
      contains: function (c) { return this._o.classes.has(c); }
    },
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') String(v).split(/\s+/).forEach((c) => this.classes.add(c)); },
    getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    querySelector(sel) { return findAll(this, sel)[0] || null; },
    querySelectorAll(sel) { return findAll(this, sel); }
  };
}

// innerHTML yerine yalnizca testte kullandigimiz kaliplari tanir.
function parseStub(parent, html) {
  const re = /<span class="([^"]+)"(?: data-net="(\w+)")?>([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    const el = makeEl('span');
    el.classList._o = el;
    m[1].split(/\s+/).forEach((c) => el.classes.add(c));
    if (m[2]) el.attrs['data-net'] = m[2];
    el._text = m[3];
    parent.children.push(el);
  }
}

function findAll(root, sel) {
  const out = [];
  const attr = sel.match(/^\[([\w-]+)="([^"]+)"\]$/);
  const cls = sel.replace(/^\./, '');
  (function walk(n) {
    for (const c of n.children) {
      if (attr ? c.attrs[attr[1]] === attr[2] : c.classes.has(cls)) out.push(c);
      walk(c);
    }
  })(root);
  return out;
}

function newTile() {
  const el = makeEl('div');
  el.classList._o = el;
  return el;
}

// ---------------------------------------------------------------- yukleme

const ctx = {
  console,
  Number, Math, String, Date, Array, JSON, Object,
  LANG: 'en',
  // Gercek ceviriler yerine anahtarin kendisi: test dile bagimli olmasin.
  t: (k) => ({ wFree: 'free', wNoData: 'unavailable', wDayShort: 'd', wHourShort: 'h', wMinShort: 'm' }[k] || k),
  accent: () => '#3b82f6',
  document: {
    createElement: makeEl,
    createElementNS: (ns, tag) => { const e = makeEl(tag); e.classList._o = e; return e; },
    querySelectorAll: () => []
  }
};
ctx.document.createElement = (tag) => { const e = makeEl(tag); e.classList._o = e; return e; };
vm.createContext(ctx);
// Tarayicida bu dosya duz bir script; vm icinde ise ust duzey const/let
// baglama global olmuyor (function bildirimleri oluyor). Testin gorebilmesi
// icin sonuna kucuk bir disa aktarim ekliyoruz.
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'widgets.js'), 'utf8')
  + '\n;globalThis.WIDGET_TYPES = WIDGET_TYPES; globalThis.GAUGE_ARC = GAUGE_ARC;';
vm.runInContext(src, ctx);

console.log('\n--- bicimlendirme ---');
eq(ctx.bytesShort(0), '0 B', 'sifir bayt');
eq(ctx.bytesShort(1024), '1.0 KB', 'tam kilobayt');
eq(ctx.bytesShort(1536), '1.5 KB', 'bucuk kilobayt');
eq(ctx.bytesShort(102748106752), '96 GB', '96 GB bellek');
eq(ctx.rateShort(5734), '5.6 KB/s', 'ag hizi');
eq(ctx.uptimeShort(90), '1m', 'bir dakika');
eq(ctx.uptimeShort(3660), '1h 1m', 'bir saat');
eq(ctx.uptimeShort(277500), '3d 5h', 'uc gun');

console.log('\n--- yay hesabi ---');
const gauge = ctx.WIDGET_TYPES.cpu;
eq(ctx.gaugeFraction(gauge, 0), 0, 'yuzde sifir');
eq(ctx.gaugeFraction(gauge, 50), 50, 'yuzde elli');
eq(ctx.gaugeFraction(gauge, 150), 100, 'aralik disi yukari kirpilir');
eq(ctx.gaugeFraction(gauge, -5), 0, 'aralik disi asagi kirpilir');
// Sicaklik yuzde degil: 20-95 araligi yaya esleniyor.
const temp = ctx.WIDGET_TYPES.temp;
eq(ctx.gaugeFraction(temp, 20), 0, 'sicaklik alt sinir');
eq(ctx.gaugeFraction(temp, 95), 100, 'sicaklik ust sinir');
eq(ctx.gaugeFraction(temp, 57.5), 50, 'sicaklik orta');

console.log('\n--- dasharray boslugu ---');
// Bosluk yol uzunlugundan (100) buyuk olmali, yoksa yuvarlak uc yuzunden
// yayin her iki ucunda nokta beliriyor.
const gap = Number(ctx.dashFor(0).split(' ')[1]);
ok(gap > 100, 'bosluk yol uzunlugundan buyuk', 'gap=' + gap);
eq(ctx.dashFor(0).split(' ')[0], '0.0', 'sifirda dolgu yok');

console.log('\n--- kadran gostergesi ---');
const cpuTile = newTile();
ctx.renderWidget(cpuTile, { widget: 'cpu', color: '#5e81ac' });
ctx.updateWidget(cpuTile, { cpu: 42 });
eq(cpuTile.querySelector('.w-val').textContent, '42', 'cpu degeri yazildi');
eq(cpuTile.querySelector('.w-fill').getAttribute('stroke-dasharray'), '42.0 200', 'yay yuzde 42');
ok(!cpuTile.classes.has('w-warn'), 'esik altinda uyari yok');
ctx.updateWidget(cpuTile, { cpu: 95 });
ok(cpuTile.classes.has('w-warn'), 'esik ustunde uyari var');
ctx.updateWidget(cpuTile, { cpu: 10 });
ok(!cpuTile.classes.has('w-warn'), 'esik altina dununce uyari kalkar');

console.log('\n--- olcum yoksa ---');
const tempTile = newTile();
ctx.renderWidget(tempTile, { widget: 'temp' });
ctx.updateWidget(tempTile, { temp: null });
eq(tempTile.querySelector('.w-val').textContent, '—', 'okunamayan deger tire');
ok(tempTile.classes.has('w-na'), 'okunamayan gosterge isaretli');

// Sicaklikta iki basarisizlik ayri seydir: yetki sorunu host'u yonetici
// calistirinca cozulur, donanimin bildirmemesi cozulmez. Ayni seyi demek
// kullaniciyi cozumu olmayan bir sey icin ugrastirirdi.
ctx.updateWidget(tempTile, { temp: null, tempWhy: 'admin' });
eq(tempTile.querySelector('.w-sub').textContent, 'wNeedsAdmin', 'yetki eksikse yonetici denir');
ctx.updateWidget(tempTile, { temp: null, tempWhy: 'none' });
eq(tempTile.querySelector('.w-sub').textContent, 'wNotSupported', 'donanim bildirmiyorsa oyle denir');
ctx.updateWidget(tempTile, { temp: 42, tempWhy: null });
eq(tempTile.querySelector('.w-val').textContent, '42', 'yetki gelince deger gosterilir');
ok(!tempTile.classes.has('w-na'), 'deger gelince isaret kalkar');

// Sebebi olmayan olcumler yine sade "okunamiyor" der.
const gpuTile = newTile();
ctx.renderWidget(gpuTile, { widget: 'gpu' });
ctx.updateWidget(gpuTile, { gpu: null });
eq(gpuTile.querySelector('.w-sub').textContent, 'unavailable', 'sebep yoksa sade mesaj');
// Sifir ile "yok" ayri seyler: sifir gecerli bir olcum.
const zeroTile = newTile();
ctx.renderWidget(zeroTile, { widget: 'cpu' });
ctx.updateWidget(zeroTile, { cpu: 0 });
eq(zeroTile.querySelector('.w-val').textContent, '0', 'sifir deger gosterilir');
ok(!zeroTile.classes.has('w-na'), 'sifir "okunamiyor" degildir');

console.log('\n--- disk secimi ---');
const diskStats = { disks: [{ id: 'C:', used: 50, total: 100, pct: 50 }, { id: 'D:', used: 10, total: 100, pct: 10 }] };
const dTile = newTile();
ctx.renderWidget(dTile, { widget: 'disk', drive: 'D:' });
ctx.updateWidget(dTile, diskStats);
eq(dTile.querySelector('.w-val').textContent, '10', 'secilen surucu okunur');
eq(ctx.widgetLabel({ widget: 'disk', drive: 'D:' }), 'wDisk D:', 'etiket surucuyu tasir');
// Cikarilmis surucu icin baska bir diskin degerini gostermek yaniltici olurdu.
const goneTile = newTile();
ctx.renderWidget(goneTile, { widget: 'disk', drive: 'Z:' });
ctx.updateWidget(goneTile, diskStats);
ok(goneTile.classes.has('w-na'), 'olmayan surucu okunamiyor sayilir');

console.log('\n--- ag ve kivilcim ---');
const netTile = newTile();
ctx.renderWidget(netTile, { widget: 'net' });
ctx.updateWidget(netTile, { net: { down: 5734, up: 1024 } });
eq(netTile.querySelector('[data-net="down"]').textContent, '5.6 KB/s', 'indirme hizi');
eq(netTile.querySelector('[data-net="up"]').textContent, '1.0 KB/s', 'yukleme hizi');
eq(netTile.querySelector('.w-spark-line').getAttribute('points'), '', 'tek ornekle cizgi cizilmez');
ctx.updateWidget(netTile, { net: { down: 2000, up: 0 } });
const pts = netTile.querySelector('.w-spark-line').getAttribute('points');
ok(pts.split(' ').length === 2, 'iki ornekle iki nokta', pts);
for (let i = 0; i < 60; i++) ctx.updateWidget(netTile, { net: { down: i * 100, up: 0 } });
ok(netTile._hist.length === 40, 'gecmis 40 ornekle sinirli', 'uzunluk=' + netTile._hist.length);
const many = netTile.querySelector('.w-spark-line').getAttribute('points').split(' ');
eq(many.length, 40, 'cizgi gecmis kadar nokta tasir');
ok(many.every((p) => /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(p)), 'nokta bicimi gecerli', many[0]);

console.log('\n--- yazi rengi ---');
{
  // Yazi rengi secilmediyse gosterge temanin metin rengine birakilmali:
  // degiskeni bos bir degerle yazmak temayi ezerdi.
  const plain = newTile();
  ctx.renderWidget(plain, { widget: 'cpu', color: '#5e81ac' });
  eq(plain.style._p['--w-fg'], undefined, 'secilmeyince yazi rengi degiskeni yok');
  eq(plain.style._p['--w-color'], '#5e81ac', 'yay rengi yazilir');

  const tinted = newTile();
  ctx.renderWidget(tinted, { widget: 'cpu', color: '#5e81ac', fg: '#ffee00' });
  eq(tinted.style._p['--w-fg'], '#ffee00', 'secilen yazi rengi yazilir');
  ok(tinted.style._p['--w-fg-dim'], 'etiketler icin solukluk da yazilir');
}

console.log('\n--- abonelik karari ---');
ok(ctx.pageNeedsStats({ buttons: [{ kind: 'widget', widget: 'cpu' }] }), 'cpu olcum ister');
ok(!ctx.pageNeedsStats({ buttons: [{ kind: 'widget', widget: 'clock' }] }), 'saat olcum istemez');
ok(!ctx.pageNeedsStats({ buttons: [{ label: 'Kopyala' }] }), 'sade buton olcum istemez');
ok(!ctx.pageNeedsStats(null), 'sayfa yoksa olcum istemez');
ok(ctx.pageNeedsStats({ buttons: [{ label: 'x' }, { kind: 'widget', widget: 'ram' }] }), 'karisik sayfada olcum ister');

console.log('\n' + (fail ? fail + ' SORUN' : 'TUM TESTLER GECTI') + '  (' + pass + ' kontrol)\n');
process.exit(fail ? 1 : 0);
