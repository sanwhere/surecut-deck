// Ceviri dosyasini denetler: sozdizimi, eksik/fazla anahtar, bos deger,
// yer tutucu ({name}, {count}, {step}) tutarliligi.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n.js'), 'utf8');

// Tarayici globalleri olmadan calistirmak icin sahte ortam kur.
const sandbox = {
  localStorage: { getItem: () => null, setItem: () => {} },
  navigator: { languages: ['en'] },
  document: { documentElement: {}, querySelectorAll: () => [] }
};
const fn = new Function('localStorage', 'navigator', 'document',
  src + '\nreturn { I18N, LANG_NAMES, RTL_LANGS, t, setLang };');

let mod;
try {
  mod = fn(sandbox.localStorage, sandbox.navigator, sandbox.document);
} catch (e) {
  console.log('\nSOZDIZIMI HATASI: ' + e.message + '\n');
  process.exit(1);
}

const { I18N, LANG_NAMES, RTL_LANGS } = mod;
const langs = Object.keys(I18N);
const enKeys = Object.keys(I18N.en).sort();

let fails = 0;
const bad = (msg) => { fails++; console.log('  HATA  ' + msg); };

console.log('\n--- ceviri denetimi ---\n');
console.log('  dil sayisi: ' + langs.length + '  (' + langs.join(', ') + ')');
console.log('  anahtar sayisi (en): ' + enKeys.length + '\n');

for (const l of langs) {
  const keys = Object.keys(I18N[l]).sort();
  const missing = enKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !enKeys.includes(k));
  const empty = keys.filter((k) => !String(I18N[l][k]).trim());

  // Yer tutucular birebir ayni olmali, yoksa mesajda {count} gibi ham metin gorunur.
  const phMismatch = enKeys.filter((k) => {
    if (!I18N[l][k]) return false;
    const ph = (s) => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(',');
    return ph(I18N.en[k]) !== ph(I18N[l][k]);
  });

  const problems = [];
  if (missing.length) problems.push('eksik: ' + missing.join(', '));
  if (extra.length) problems.push('fazla: ' + extra.join(', '));
  if (empty.length) problems.push('bos: ' + empty.join(', '));
  if (phMismatch.length) problems.push('yer tutucu uyusmuyor: ' + phMismatch.join(', '));

  if (problems.length) { bad(l + ' -> ' + problems.join(' | ')); }
  else console.log('  OK    ' + l.padEnd(4) + LANG_NAMES[l]);
}

console.log('');
const noName = langs.filter((l) => !LANG_NAMES[l]);
if (noName.length) bad('LANG_NAMES eksik: ' + noName.join(', '));
else console.log('  OK    tum dillerin gorunen adi var');

const rtlUnknown = RTL_LANGS.filter((l) => !I18N[l]);
if (rtlUnknown.length) bad('RTL listesinde olmayan dil: ' + rtlUnknown.join(', '));
else console.log('  OK    RTL listesi gecerli (' + RTL_LANGS.join(', ') + ')');

console.log('\n' + (fails === 0 ? 'TUM DILLER TUTARLI' : fails + ' SORUN') + '\n');
process.exit(fails === 0 ? 0 : 1);
