// Sayfalar arasi tasima islemini dogrular.
//
// Surukleme etkilesiminin kendisi (isaretcinin hangi sekmenin uzerinde oldugu)
// tarayici gerektiriyor, ama asil is olan "ogeyi su sayfadan su sayfaya al"
// adimi DOM'a dokunmuyor ve burada sinaniyor. Gecersiz her durumda diziyi
// oldugu gibi birakmasi onemli: yarim kalan bir tasima ogeyi yok ederdi.
//
//   node tests\movetest.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  OK    ' + name); }
  else { fail++; console.log('  HATA  ' + name + (extra ? '  -> ' + extra : '')); }
}
function eq(a, b, name) { ok(a === b, name, 'beklenen ' + JSON.stringify(b) + ', gelen ' + JSON.stringify(a)); }

// app.js tarayici icin yazilmis duz bir script; yalnizca sinanan fonksiyonu
// ayiklayip calistiriyoruz, tum dosyayi degerlendirmek DOM isterdi.
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const start = src.indexOf('function moveItemToPage(');
if (start < 0) { console.log('moveItemToPage bulunamadi'); process.exit(1); }
const end = src.indexOf('\n}', start) + 2;

const ctx = { Array, console };
vm.createContext(ctx);
vm.runInContext(src.slice(start, end) + '\n;globalThis.moveItemToPage = moveItemToPage;', ctx);
const move = ctx.moveItemToPage;

const pages = () => ([
  { name: 'Ana', buttons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
  { name: 'Iki', buttons: [{ id: 'x' }] },
  { name: 'Uc', buttons: [] }
]);

console.log('\n--- basarili tasima ---');
{
  const p = pages();
  eq(move(p, 0, 1, 1), true, 'tasima true doner');
  eq(p[0].buttons.map((b) => b.id).join(''), 'ac', 'oge kaynaktan cikarildi');
  eq(p[1].buttons.map((b) => b.id).join(''), 'xb', 'oge hedefin SONUNA eklendi');
}
{
  const p = pages();
  move(p, 0, 0, 2);
  eq(p[2].buttons.map((b) => b.id).join(''), 'a', 'bos sayfaya tasinabilir');
  eq(p[0].buttons.length, 2, 'kaynak bir eksildi');
}

console.log('\n--- tasinmamasi gereken durumlar ---');
{
  const p = pages();
  const before = JSON.stringify(p);
  eq(move(p, 0, 1, 0), false, 'ayni sayfaya tasima reddedilir');
  eq(JSON.stringify(p), before, 'dizi degismedi');
}
{
  const p = pages();
  const before = JSON.stringify(p);
  eq(move(p, 0, 1, -1), false, 'hedef yoksa reddedilir');
  eq(JSON.stringify(p), before, 'dizi degismedi');
}
{
  const p = pages();
  const before = JSON.stringify(p);
  eq(move(p, 0, 1, 9), false, 'olmayan sayfaya tasima reddedilir');
  eq(JSON.stringify(p), before, 'dizi degismedi');
}
{
  // Sayfa silinmesi ile birakilma ayni ana denk gelirse indeks bayat olabilir.
  const p = pages();
  const before = JSON.stringify(p);
  eq(move(p, 0, 7, 1), false, 'bayat indeks reddedilir');
  eq(JSON.stringify(p), before, 'dizi degismedi');
}
{
  const p = pages();
  eq(move(p, 0, -1, 1), false, 'negatif indeks reddedilir');
}
{
  eq(move(null, 0, 0, 1), false, 'sayfa dizisi yoksa reddedilir');
  eq(move([{ name: 'x' }, { name: 'y' }], 0, 0, 1), false, 'buton dizisi yoksa reddedilir');
}

console.log('\n--- tasinan oge korunur ---');
{
  const p = pages();
  // Gostergeler de ayni yoldan tasiniyor; alanlarinin hicbiri kaybolmamali.
  p[0].buttons[0] = { id: 'g', kind: 'widget', widget: 'disk', drive: 'C:', style: 'bar', color: '#abc' };
  move(p, 0, 0, 1);
  const moved = p[1].buttons[p[1].buttons.length - 1];
  eq(JSON.stringify(moved), JSON.stringify({ id: 'g', kind: 'widget', widget: 'disk', drive: 'C:', style: 'bar', color: '#abc' }),
    'gosterge tum alanlariyla tasindi');
}

console.log('\n' + (fail ? fail + ' SORUN' : 'TUM TESTLER GECTI') + '  (' + pass + ' kontrol)\n');
process.exit(fail ? 1 : 0);
