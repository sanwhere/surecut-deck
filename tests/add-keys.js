// i18n.js icindeki HER dil blogunun 'screen:' anahtarindan sonra yeni anahtarlari ekler.
// Elle 20 blogu duzenlemek hataya acik; bu betik tek seferlik ve tekrar calistirilabilir
// (anahtar zaten varsa o dili atlar).
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'public', 'i18n.js');

const NEW = {
  en: { stretchFill: 'Stretch buttons to fill the screen', stretchHint: 'Rows share the full height, so no empty space is left below.' },
  tr: { stretchFill: 'Butonları ekrana yay', stretchHint: 'Satırlar yüksekliği paylaşır, altta boşluk kalmaz.' },
  es: { stretchFill: 'Estirar los botones para llenar la pantalla', stretchHint: 'Las filas reparten toda la altura, sin espacio vacío abajo.' },
  fr: { stretchFill: 'Étirer les boutons sur tout l\'écran', stretchHint: 'Les rangées se partagent toute la hauteur, sans espace vide en bas.' },
  de: { stretchFill: 'Schaltflächen über den ganzen Bildschirm strecken', stretchHint: 'Die Zeilen teilen sich die volle Höhe, unten bleibt kein leerer Raum.' },
  it: { stretchFill: 'Estendi i pulsanti a tutto lo schermo', stretchHint: 'Le righe si dividono tutta l\'altezza, senza spazio vuoto in basso.' },
  pt: { stretchFill: 'Esticar os botões para preencher o ecrã', stretchHint: 'As linhas dividem toda a altura, sem espaço vazio em baixo.' },
  ru: { stretchFill: 'Растянуть кнопки на весь экран', stretchHint: 'Строки делят всю высоту, снизу не остаётся пустого места.' },
  uk: { stretchFill: 'Розтягнути кнопки на весь екран', stretchHint: 'Рядки ділять усю висоту, знизу не лишається порожнього місця.' },
  pl: { stretchFill: 'Rozciągnij przyciski na cały ekran', stretchHint: 'Wiersze dzielą całą wysokość, na dole nie zostaje puste miejsce.' },
  ar: { stretchFill: 'مدّ الأزرار لملء الشاشة', stretchHint: 'تتقاسم الصفوف الارتفاع كاملًا فلا تبقى مساحة فارغة في الأسفل.' },
  fa: { stretchFill: 'کشیدن دکمه‌ها برای پر کردن صفحه', stretchHint: 'ردیف‌ها تمام ارتفاع را تقسیم می‌کنند و پایین جای خالی نمی‌ماند.' },
  ur: { stretchFill: 'بٹنوں کو پوری اسکرین پر پھیلائیں', stretchHint: 'قطاریں پوری اونچائی بانٹ لیتی ہیں، نیچے خالی جگہ نہیں بچتی۔' },
  zh: { stretchFill: '拉伸按钮填满屏幕', stretchHint: '各行平分整个高度，底部不会留下空白。' },
  ja: { stretchFill: 'ボタンを画面いっぱいに広げる', stretchHint: '行が高さを分け合うので、下に余白が残りません。' },
  ko: { stretchFill: '버튼을 화면 가득 채우기', stretchHint: '행이 전체 높이를 나눠 가져 아래에 빈 공간이 남지 않습니다.' },
  hi: { stretchFill: 'बटनों को पूरी स्क्रीन पर फैलाएँ', stretchHint: 'पंक्तियाँ पूरी ऊँचाई बाँट लेती हैं, नीचे खाली जगह नहीं बचती।' },
  bn: { stretchFill: 'বোতাম পুরো পর্দায় ছড়িয়ে দিন', stretchHint: 'সারিগুলো পুরো উচ্চতা ভাগ করে নেয়, নিচে ফাঁকা জায়গা থাকে না।' },
  id: { stretchFill: 'Regangkan tombol memenuhi layar', stretchHint: 'Baris membagi seluruh tinggi, sehingga tidak ada ruang kosong di bawah.' },
  vi: { stretchFill: 'Kéo giãn nút cho đầy màn hình', stretchHint: 'Các hàng chia đều toàn bộ chiều cao, không còn khoảng trống bên dưới.' }
};

// JS kaynak icin string kacisi (tek tirnak)
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

let src = fs.readFileSync(FILE, 'utf8');
let added = 0, skipped = 0, notFound = [];

for (const lang of Object.keys(NEW)) {
  // Dil blogunun sinirlarini bul
  const start = src.indexOf('I18N.' + lang + ' = {');
  if (start < 0) { notFound.push(lang); continue; }
  const end = src.indexOf('\n};', start);
  const block = src.slice(start, end);

  if (block.includes('stretchFill:')) { skipped++; continue; }

  // 'screen:' anahtarindan sonraki ilk virgule ekle (hem tek satirli hem cok
  // anahtarli satir bicimleri icin calisir)
  const m = /screen: (?:'(?:[^'\\]|\\.)*')\s*,/.exec(block);
  if (!m) { notFound.push(lang); continue; }

  const insertAt = start + m.index + m[0].length;
  const ins = '\n  stretchFill: ' + q(NEW[lang].stretchFill) +
              ', stretchHint: ' + q(NEW[lang].stretchHint) + ',';
  src = src.slice(0, insertAt) + ins + src.slice(insertAt);
  added++;
}

fs.writeFileSync(FILE, src, 'utf8');
console.log('eklendi: ' + added + ', zaten vardi: ' + skipped +
            (notFound.length ? ', BULUNAMADI: ' + notFound.join(', ') : ''));
process.exit(notFound.length ? 1 : 0);
