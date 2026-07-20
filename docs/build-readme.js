// README'yi rehberin icerik dosyasindan uretir.
//
//   node docs\build-readme.js en
//
// Rehber icerigi (guide.<lang>.json) HTML rehberle ORTAKTIR; README'ye ozel
// teknik bolumler readme-extra.<lang>.md dosyasinda durur. Boylece anlatim tek
// kaynaktan gelir, iki yerde ayri ayri guncellenmez.
//
// Markdown'da CSS yok, bu yuzden tablet cercevesi gorselin icine gomulu
// surumu kullanilir (docs\frame-shots.ps1 uretir).

const fs = require('fs');
const path = require('path');

const LANG = process.argv[2] || 'en';
const DOCS = __dirname;
const ROOT = path.join(DOCS, '..');

const content = JSON.parse(fs.readFileSync(path.join(DOCS, `guide.${LANG}.json`), 'utf8'));
const extraPath = path.join(DOCS, `readme-extra.${LANG}.md`);
const extra = fs.existsSync(extraPath) ? fs.readFileSync(extraPath, 'utf8') : '';

// Icerikte kucuk HTML etiketleri var (rehber HTML icin). Markdown karsiliklarina cevir.
function md(s) {
  return String(s)
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    .replace(/<b>(.*?)<\/b>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<\/?[a-z][^>]*>/gi, '');
}

// Cerceveli surum varsa onu kullan; masaustu goruntulerinde zaten gercek
// pencere kenarligi oldugu icin cerceve uretilmiyor.
function imgPath(src) {
  const framed = path.join(DOCS, 'shots', 'framed', src);
  return fs.existsSync(framed) ? `docs/shots/framed/${src}` : `docs/shots/${src}`;
}

function figure(f) {
  const out = [`![${md(f.caption || '')}](${imgPath(f.src)})`];
  if (f.caption) out.push('', `<sub>${md(f.caption)}</sub>`);
  if (f.callouts && f.callouts.length) {
    out.push('', '<sub>' + f.callouts.map((c) => `**${md(c.label)}**`).join(' · ') + '</sub>');
  }
  return out.join('\n');
}

function table(t) {
  if (!t) return '';
  const head = `| ${t.head.map(md).join(' | ')} |`;
  const rule = `|${t.head.map(() => '---').join('|')}|`;
  const rows = t.rows.map((r) => `| ${r.map(md).join(' | ')} |`);
  return [head, rule, ...rows].join('\n');
}

const out = [];

// --- baslik ---
// Proje adi basligin kendisi olsun: GitHub depo adini gosterse de README
// kendini tanitmali. Ad, "Surecut Deck: Kullanim Rehberi" kalibindan alinir.
// Ayirac dile gore degisiyor (iki nokta, tam genislikli iki nokta, tire).
const projectName = String(content.title).split(/[:：—–|]/)[0].trim();

out.push(`# ${projectName}`, '');
out.push(`**${md(content.heroTitle)}**`, '');
out.push(`> ${md(content.eyebrow)}`, '');
out.push(md(content.heroLead), '');
out.push(figure(content.heroFigure), '');

// Diger dillerdeki rehberler: yalnizca gercekten uretilmis olanlari bagla.
const NAMES = {
  en: 'English', tr: 'Türkçe', es: 'Español', fr: 'Français', de: 'Deutsch',
  it: 'Italiano', pt: 'Português', ru: 'Русский', uk: 'Українська', pl: 'Polski',
  ar: 'العربية', fa: 'فارسی', ur: 'اردو', zh: '中文', ja: '日本語', ko: '한국어',
  hi: 'हिन्दी', bn: 'বাংলা', id: 'Indonesia', vi: 'Tiếng Việt'
};
const guides = Object.keys(NAMES)
  .filter((l) => fs.existsSync(path.join(DOCS, `guide-${l}.html`)))
  .map((l) => `[${NAMES[l]}](docs/guide-${l}.html)`);
if (guides.length > 1) out.push(`📖 Illustrated guide: ${guides.join(' · ')}`, '');

// --- nasil calisir ---
out.push(`## ${md(content.pillars.title)}`, '');
out.push(`| | |`, `|---|---|`);
content.pillars.items.forEach((i) => out.push(`| **${md(i.k)}** | ${md(i.v)} |`));
out.push('');

// --- kurulum ---
out.push(`## ${md(content.setup.title)}`, '');
content.setup.steps.forEach((s) => {
  out.push(`### ${md(s.n)}. ${md(s.title)}`, '', md(s.body), '');
  if (s.figure) out.push(figure(s.figure), '');
});

// --- bolumler ---
content.sections.forEach((s) => {
  out.push(`## ${md(s.title)}`, '', md(s.body), '');
  if (s.note) out.push(`> ${md(s.note)}`, '');
  (s.figures || []).forEach((f) => out.push(figure(f), ''));
  if (s.table) out.push(table(s.table), '');
});

// --- uyarilar ---
out.push(`## ${md(content.notes.title)}`, '');
content.notes.items.forEach((i) => out.push(`**${md(i.k)}.** ${md(i.v)}`, ''));

// --- teknik ek ---
if (extra) out.push('---', '', extra.trim(), '');

const target = path.join(ROOT, LANG === 'en' ? 'README.md' : `README.${LANG}.md`);
fs.writeFileSync(target, out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n', 'utf8');
console.log(`${path.basename(target)}  ${(fs.statSync(target).size / 1024).toFixed(1)} KB`);
