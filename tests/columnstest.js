// Sayfa basina sutun sayisini dogrular.
//
// Onemli olan geriye donuk davranis: sayfanin kendi degeri yoksa genel ayar
// gecerli olmali, yoksa bu ozellik eklendigi anda herkesin duzeni bozulurdu.
//
//   node tests\columnstest.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function eq(a, b, name) {
  if (a === b) { pass++; console.log('  OK    ' + name); }
  else { fail++; console.log('  HATA  ' + name + '  -> beklenen ' + b + ', gelen ' + a); }
}

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const start = src.indexOf('function pageColumns(');
if (start < 0) { console.log('pageColumns bulunamadi'); process.exit(1); }
const end = src.indexOf('\n}', start) + 2;

const ctx = { Number, config: null, console };
vm.createContext(ctx);
vm.runInContext(src.slice(start, end) + '\n;globalThis.pageColumns = pageColumns;', ctx);
const cols = (page, settings) => { ctx.config = { settings: settings || {} }; return ctx.pageColumns(page); };

console.log('\n--- geri donuk davranis ---');
eq(cols({ name: 'Ana' }, { columns: 5 }), 5, 'sayfanin kendi degeri yoksa genel ayar');
eq(cols({ name: 'Ana' }, {}), 4, 'hicbir ayar yoksa varsayilan dort');
eq(cols(null, { columns: 6 }), 6, 'sayfa yoksa genel ayar');

console.log('\n--- sayfaya ozel deger ---');
eq(cols({ columns: 4 }, { columns: 5 }), 4, 'sayfa kendi degerini kullanir');
eq(cols({ columns: 8 }, { columns: 2 }), 8, 'sayfa degeri geneli ezer');

console.log('\n--- gecersiz degerler ---');
// Elle duzenlenmis bir yapilandirma sacma bir sayi tasiyabilir; izgarayi
// bozmaktansa gecerli olana dusmek gerekiyor.
eq(cols({ columns: 0 }, { columns: 5 }), 5, 'sifir yok sayilir');
eq(cols({ columns: 99 }, { columns: 5 }), 5, 'aralik disi yok sayilir');
eq(cols({ columns: 1 }, { columns: 5 }), 5, 'ikiden kucuk yok sayilir');
eq(cols({ columns: 'abc' }, { columns: 5 }), 5, 'sayi olmayan yok sayilir');
eq(cols({ columns: 3.5 }, { columns: 5 }), 3.5, 'ondalik aralik icindeyse gecer');
eq(cols({ columns: 4 }, { columns: 99 }), 4, 'genel ayar bozuksa sayfa degeri yine gecerli');
eq(cols({}, { columns: -1 }), 4, 'her ikisi de bozuksa varsayilan');

console.log('\n' + (fail ? fail + ' SORUN' : 'TUM TESTLER GECTI') + '  (' + pass + ' kontrol)\n');
process.exit(fail ? 1 : 0);
