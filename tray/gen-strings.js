// tray-<lang>.json dosyalarini Strings.Generated.cs'e cevirir.
//
//   node tray\gen-strings.js <ceviri-klasoru>
//
// Ceviriler neden dogrudan C#'a yazilmiyor: dizeler ajanlardan/cevirmenlerden
// JSON olarak geliyor ve C# kacislarini (\n, tirnak, ters bolu) elle dogru
// yazmak hataya cok acik. Uretec bunu bir kez, dogru yapiyor.

const fs = require('fs');
const path = require('path');

const src = process.argv[2] || path.join(__dirname, 'lang');
const out = path.join(__dirname, 'Strings.Generated.cs');

// C# kaynak dizesi olarak kacir. Satir sonlari gercek kacis dizisi olarak
// yazilir, yoksa kaynak dosyada satir kirilir ve derlenmez.
function cs(s) {
  return '"' + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t') + '"';
}

const files = fs.readdirSync(src).filter((f) => /^tray-[a-z]{2}\.json$/.test(f)).sort();
if (!files.length) { console.error('ceviri dosyasi bulunamadi: ' + src); process.exit(1); }

// Ingilizce anahtar kumesi olcut: eksik ya da fazla anahtar sessizce gecmesin.
const enKeys = require('./lang-keys.json');

const blocks = [];
const report = [];

for (const f of files) {
  const lang = f.slice(5, 7);
  const d = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));

  const missing = enKeys.filter((k) => !(k in d));
  const extra = Object.keys(d).filter((k) => enKeys.indexOf(k) < 0);
  report.push('  ' + lang + '  ' + Object.keys(d).length + ' anahtar' +
    (missing.length ? '  EKSIK: ' + missing.join(',') : '') +
    (extra.length ? '  FAZLA: ' + extra.join(',') : ''));
  if (missing.length || extra.length) process.exitCode = 1;

  const lines = enKeys.filter((k) => k in d).map((k) => '            ' + cs(k) + ', ' + cs(d[k]) + ',');
  // Son virgulu kirp.
  if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');

  blocks.push('        Add(' + cs(lang) + ', new string[] {\n' + lines.join('\n') + '\n        });');
}

const body = [
  '// URETILEN DOSYA. Elle duzenleme: kaynak tray\\lang\\tray-<lang>.json,',
  '// uretec tray\\gen-strings.js.',
  '',
  'static partial class L',
  '{',
  '    static partial void BuildRest()',
  '    {',
  blocks.join('\n\n'),
  '    }',
  '}',
  ''
].join('\n');

fs.writeFileSync(out, body, 'utf8');
console.log(report.join('\n'));
console.log('  yazildi: tray\\Strings.Generated.cs  (' + files.length + ' dil)');
