// Tema degisiminde renk eslemesini dogrular.
// app.js'teki mantigin kopyasi (tarayici olmadan calissin diye).

const THEMES = {
  dark:     ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#64748b'],
  nord:     ['#5e81ac', '#88c0d0', '#8fbcbb', '#a3be8c', '#ebcb8b', '#d08770', '#bf616a', '#b48ead', '#d8dee9'],
  gruvbox:  ['#d79921', '#98971a', '#cc241d', '#d65d0e', '#458588', '#689d6a', '#b16286', '#7c6f64'],
  solarized:['#268bd2', '#2aa198', '#859900', '#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#586e75'],
  mocha:    ['#cba6f7', '#89b4fa', '#94e2d5', '#a6e3a1', '#f9e2af', '#fab387', '#f38ba8', '#f5c2e7', '#6c7086'],
  rosepine: ['#c4a7e7', '#9ccfd8', '#31748f', '#f6c177', '#ebbcba', '#eb6f92', '#908caa', '#6e6a86'],
  amber:    ['#ffb000', '#e09a00', '#c08400', '#9a7000', '#ffc740', '#ff8c00', '#75540a', '#4a3607'],
  dawn:     ['#907aa9', '#56949f', '#286983', '#ea9d34', '#d7827e', '#b4637a', '#797593', '#9893a5']
};

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
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  return { h, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
}

function chromaOf(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

const NEUTRAL_CHROMA = 0.12;

function mapColorToPalette(color, pal) {
  const c = toHsl(color);
  const cands = pal.map((p) => ({ p, hsl: toHsl(p), k: chromaOf(p) })).filter((x) => x.hsl);
  if (!c || !cands.length) return pal[0];
  const neutrals = cands.filter((x) => x.k < NEUTRAL_CHROMA);
  const chromatic = cands.filter((x) => x.k >= NEUTRAL_CHROMA);
  if (chromaOf(color) < NEUTRAL_CHROMA) {
    const pool = neutrals.length ? neutrals : cands;
    return pool.reduce((a, b) => (b.k < a.k ? b : a)).p;
  }
  const pool = chromatic.length ? chromatic : cands;
  let best = pool[0], bestD = Infinity;
  for (const x of pool) {
    let d = Math.abs(x.hsl.h - c.h);
    if (d > 180) d = 360 - d;
    if (d < bestD) { bestD = d; best = x; }
  }
  return best.p;
}

const NAMES = ['mavi', 'yesil', 'kirmizi', 'turuncu', 'mor', 'pembe', 'teal', 'gri'];
let fails = 0;
const check = (n, ok, got) => {
  if (!ok) fails++;
  console.log('  ' + (ok ? 'OK  ' : 'HATA') + '  ' + n + (got ? '  ->  ' + got : ''));
};

console.log('\n--- tema degisiminde renk eslemesi ---\n');

for (const t of ['nord', 'gruvbox', 'solarized', 'mocha', 'rosepine', 'dawn']) {
  const out = THEMES.dark.map((c) => mapColorToPalette(c, THEMES[t]));
  console.log('dark -> ' + t);
  THEMES.dark.forEach((src, i) => console.log('        ' + NAMES[i].padEnd(8) + src + '  ->  ' + out[i]));

  // 1) Renkli kaynak notr/beyaza dusmemeli
  const bad = THEMES.dark.filter((c, i) => chromaOf(c) >= NEUTRAL_CHROMA && chromaOf(out[i]) < NEUTRAL_CHROMA);
  check(t + ': renkli butonlar renkli kaldi', bad.length === 0, bad.join(', '));

  // 2) Gercek notr gri, paletin en notr rengine gitmeli
  const grayOut = mapColorToPalette('#6b7280', THEMES[t]);
  const minK = Math.min.apply(null, THEMES[t].map(chromaOf));
  check(t + ': notr gri en notr renge gitti', Math.abs(chromaOf(grayOut) - minK) < 1e-9, grayOut);

  // 3) Ayrim korunmali
  const distinct = new Set(out).size;
  check(t + ': renk ayrimi korundu', distinct >= 5, distinct + ' farkli renk');
  console.log('');
}

// Iki renkli tema: tek aileye dusmesi beklenen davranis
{
  const out = THEMES.dark.map((c) => mapColorToPalette(c, THEMES.amber));
  console.log('dark -> amber (iki renkli, tek aileye dusmesi beklenir)');
  THEMES.dark.forEach((src, i) => console.log('        ' + NAMES[i].padEnd(8) + src + '  ->  ' + out[i]));
  check('amber: tonlar yine de ayrisiyor', new Set(out).size >= 3, new Set(out).size + ' farkli ton');
  console.log('');
}

// Kararlilik
let drift = 0;
for (const t of Object.keys(THEMES)) {
  for (const src of THEMES.dark) {
    const a = mapColorToPalette(src, THEMES[t]);
    if (mapColorToPalette(a, THEMES[t]) !== a) drift++;
  }
}
check('tekrar eslemede renk kaymasi yok', drift === 0, drift ? drift + ' kayma' : '');

// Tema zinciri
{
  let cur = THEMES.dark.slice();
  for (const t of ['nord', 'gruvbox', 'mocha', 'dark']) cur = cur.map((c) => mapColorToPalette(c, THEMES[t]));
  const broke = cur.filter((c, i) => chromaOf(THEMES.dark[i]) >= NEUTRAL_CHROMA && chromaOf(c) < NEUTRAL_CHROMA);
  check('4 tema gecisinden sonra renkler bozulmadi', broke.length === 0, new Set(cur).size + ' farkli renk kaldi');
}

console.log('\n' + (fails === 0 ? 'TUM TESTLER GECTI' : fails + ' TEST BASARISIZ') + '\n');
process.exit(fails === 0 ? 0 : 1);
