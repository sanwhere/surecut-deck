// tray\lang\*.json icinde satir sonlarinin DUZ METIN olarak yazildigi dosyalari
// duzeltir: "\n" iki karakter (ters bolu + n) olarak durursa mesaj kutusunda
// satir atlamak yerine bu iki karakter gorunur.
//
//   node tray\fix-escapes.js
//
// Hangi dosyanin bozuk oldugu bakisla anlasilmiyor, cunku JSON ikisini de
// kabul ediyor. Olcut: bir dizede ters bolu + n varsa metin kacisi kacirilmis.

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'lang');
const BS = String.fromCharCode(92);   // ters bolu
let touched = 0;

for (const f of fs.readdirSync(dir).filter((x) => /^tray-[a-z]{2}\.json$/.test(x))) {
  const p = path.join(dir, f);
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;

  for (const k of Object.keys(d)) {
    const v = d[k];
    if (typeof v !== 'string') continue;
    if (v.indexOf(BS + 'n') < 0 && v.indexOf(BS + 'r') < 0 && v.indexOf(BS + 't') < 0) continue;
    d[k] = v
      .split(BS + 'r' + BS + 'n').join('\r\n')
      .split(BS + 'n').join('\n')
      .split(BS + 'r').join('\r')
      .split(BS + 't').join('\t');
    n++;
  }

  if (n) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8');
    console.log('  ' + f + ': ' + n + ' dize duzeltildi');
    touched++;
  }
}

console.log(touched ? '  ' + touched + ' dosya' : '  hepsi zaten dogru');
