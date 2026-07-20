// Arayuzun kablolarini denetler: app.js'in aradigi her oge HTML'de var mi,
// HTML'in istedigi her ceviri anahtari sozlukte var mi.
//
// Bu ikisi sessizce kopabiliyor. $('fStyle') yanlis yazilirsa null doner ve
// hata ancak o alana dokunuldugunda ortaya cikar; eksik bir ceviri anahtari
// ise ekranda anahtarin kendisi olarak gorunur.
//
//   node tests\wiringtest.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(ROOT, 'public', 'i18n.js'), 'utf8');

let fail = 0;
function check(cond, name, detail) {
  if (cond) { console.log('  OK    ' + name); }
  else { fail++; console.log('  HATA  ' + name + (detail ? '\n        ' + detail : '')); }
}

const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

// app.js ve widgets.js ikisi de $() kullaniyor.
const scripts = ['app.js', 'widgets.js']
  .map((f) => fs.readFileSync(path.join(ROOT, 'public', f), 'utf8'))
  .join('\n');

const used = new Set([...scripts.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
const missingIds = [...used].filter((u) => !ids.has(u));
check(missingIds.length === 0,
  used.size + ' oge referansinin hepsi HTML\'de var',
  'HTML\'de bulunmayanlar: ' + missingIds.join(', '));

const I18N = (new Function(i18nSrc + '; return I18N;'))();
const langs = Object.keys(I18N);

const htmlKeys = new Set([...html.matchAll(/data-i18n(?:-title|-ph)?="([^"]+)"/g)].map((m) => m[1]));
const missingKeys = [...htmlKeys].filter((k) => I18N.en[k] === undefined);
check(missingKeys.length === 0,
  htmlKeys.size + ' i18n anahtarinin hepsi sozlukte var',
  'sozlukte olmayanlar: ' + missingKeys.join(', '));

// Yer tutuculu metinler: {page} gibi bir isaret cevrilirken dusurulurse
// kullanici hangi sayfaya tasindigini goremez.
const withVars = Object.keys(I18N.en).filter((k) => /\{\w+\}/.test(I18N.en[k]));
for (const key of withVars) {
  const vars = (I18N.en[key].match(/\{\w+\}/g) || []).sort();
  const bad = langs.filter((l) => {
    const v = I18N[l][key];
    if (v === undefined) return true;
    const got = (v.match(/\{\w+\}/g) || []).sort();
    return got.join(',') !== vars.join(',');
  });
  check(bad.length === 0,
    "'" + key + "' yer tutucusu " + vars.join(' ') + ' tum dillerde korunmus',
    'bozuk diller: ' + bad.join(', '));
}

console.log('\n' + (fail ? fail + ' SORUN' : 'TUM TESTLER GECTI') + '\n');
process.exit(fail ? 1 : 0);
