// Kullanim rehberini uretir: icerik JSON + ekran goruntuleri -> tek dosya HTML.
//
//   node docs\build-guide.js en
//
// Ekran goruntuleri data URI olarak gomulur (Artifact CSP dis kaynaklari engeller).
// Yeni dil eklemek icin sadece docs\guide.<lang>.json yeterli; sablon degismez.

const fs = require('fs');
const path = require('path');

const LANG = process.argv[2] || 'en';
const DOCS = __dirname;
const SHOTS = path.join(DOCS, 'shots');

// --inline: gorselleri data URI olarak gomer. Katı bir CSP altinda yayinlarken
// (Artifact gibi) gerekli, ama her dil icin ~1 MB'lik dosya uretir.
// Varsayilan: shots/ klasorune goreli bag - depoda 20 dil tek gorsel setini paylasir.
const INLINE = process.argv.includes('--inline');

const content = JSON.parse(fs.readFileSync(path.join(DOCS, `guide.${LANG}.json`), 'utf8'));

const cache = new Map();
function dataUri(file) {
  if (!INLINE) return 'shots/' + file;
  if (cache.has(file)) return cache.get(file);
  const b = fs.readFileSync(path.join(SHOTS, file));
  const uri = 'data:image/png;base64,' + b.toString('base64');
  cache.set(file, uri);
  return uri;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Baslik metinleri HTML icerebilir (kalin, kod); kullanici metni degil, bizim icerigimiz.
function figure(f) {
  const img = `<img src="${dataUri(f.src)}" alt="${esc(f.caption || '')}" loading="lazy">`;
  const callouts = (f.callouts || []).map((c) =>
    `<span class="callout" style="left:${c.x}%;top:${c.y}%"><i></i>${esc(c.label)}</span>`).join('');

  // frame:"none" - cerceve goruntunun icine cizilmis (orn. yan yana iki tablet).
  const shell = f.frame === 'none'
    ? `<div class="bare">${img}${callouts}</div>`
    : f.frame === 'window'
      ? `<div class="win"><div class="win-bar"><s></s><s></s><s></s></div><div class="shot">${img}${callouts}</div></div>`
      : `<div class="tab"><div class="tab-cam"></div><div class="shot">${img}${callouts}</div><div class="tab-bar"></div></div>`;

  return `<figure class="plate">${shell}${f.caption ? `<figcaption>${f.caption}</figcaption>` : ''}</figure>`;
}

function table(t) {
  if (!t) return '';
  return `<div class="tablewrap"><table>
  <thead><tr>${t.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="k"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

const sectionsHtml = content.sections.map((s) => `
<section id="${s.id}">
  <p class="eyebrow">${esc(s.eyebrow)}</p>
  <h2>${s.title}</h2>
  <p class="lead">${s.body}</p>
  ${s.note ? `<aside class="note">${s.note}</aside>` : ''}
  ${(s.figures || []).map(figure).join('')}
  ${table(s.table)}
</section>`).join('');

const navHtml = content.sections.map((s, i) =>
  `<li><a href="#${s.id}"><b>${String(i + 1).padStart(2, '0')}</b>${esc(s.eyebrow)}</a></li>`).join('');

const html = `<title>${esc(content.title)}</title>
<style>
/* ------------------------------------------------------------------ tokens
   Palet Nord'dan turetildi: ekran goruntulerinin kendisi Nord oldugu icin
   gorseller sayfaya yapistirilmis gibi degil, sayfaya ait duruyor. */
:root {
  --paper:#eef1f5; --surface:#ffffff; --sunken:#e4e8ee;
  --ink:#2e3440; --ink-2:#4c566a; --ink-3:#6b7688;
  --line:#d3dae3; --line-soft:#e3e8ef;
  --accent:#5e81ac; --frost:#88c0d0;
  --warn:#b58a2b; --caution:#bf616a;
  --shadow:24px 24px 60px rgba(46,52,64,.10);
  --radius:14px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper:#1d222a; --surface:#252b35; --sunken:#1a1f26;
    --ink:#e5e9f0; --ink-2:#c2cad8; --ink-3:#8c97a8;
    --line:#39424f; --line-soft:#2f3742;
    --accent:#88c0d0; --frost:#8fbcbb;
    --warn:#ebcb8b; --caution:#d08770;
    --shadow:24px 24px 60px rgba(0,0,0,.35);
  }
}
:root[data-theme="dark"] {
  --paper:#1d222a; --surface:#252b35; --sunken:#1a1f26;
  --ink:#e5e9f0; --ink-2:#c2cad8; --ink-3:#8c97a8;
  --line:#39424f; --line-soft:#2f3742;
  --accent:#88c0d0; --frost:#8fbcbb;
  --warn:#ebcb8b; --caution:#d08770;
  --shadow:24px 24px 60px rgba(0,0,0,.35);
}
:root[data-theme="light"] {
  --paper:#eef1f5; --surface:#ffffff; --sunken:#e4e8ee;
  --ink:#2e3440; --ink-2:#4c566a; --ink-3:#6b7688;
  --line:#d3dae3; --line-soft:#e3e8ef;
  --accent:#5e81ac; --frost:#88c0d0;
  --warn:#b58a2b; --caution:#bf616a;
  --shadow:24px 24px 60px rgba(46,52,64,.10);
}

*, *::before, *::after { box-sizing: border-box; }

/* Web fontu gomulmuyor: CSP dis fontlari engelliyor ve sayfada zaten
   ~750KB gorsel var. Karakter agirlik, olcek ve harf araligiyla veriliyor. */
.gd {
  --sans: ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "Cascadia Mono", "SF Mono", "JetBrains Mono", Consolas, monospace;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 17px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
.gd :where(h1,h2,h3) { text-wrap: balance; margin: 0; }
.gd p { margin: 0; }

.wrap { max-width: 1240px; margin: 0 auto; padding: 0 28px; }

/* ------------------------------------------------------------------ hero */
.hero { padding: 84px 0 56px; border-bottom: 1px solid var(--line); }
.eyebrow {
  font-family: var(--mono); font-size: 11.5px; letter-spacing: .16em;
  text-transform: uppercase; color: var(--ink-3); margin: 0 0 18px;
}
.hero h1 {
  font-size: clamp(38px, 6vw, 68px); line-height: 1.02;
  letter-spacing: -.03em; font-weight: 800; max-width: 16ch;
}
.hero .lead { margin-top: 22px; max-width: 62ch; font-size: 19px; color: var(--ink-2); }

/* ------------------------------------------------------------------ layout */
.body { display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 56px; padding: 56px 0 40px; }
@media (max-width: 900px) { .body { grid-template-columns: 1fr; gap: 0; } }

.index { position: sticky; top: 28px; align-self: start; }
@media (max-width: 900px) { .index { display: none; } }
.index p {
  font-family: var(--mono); font-size: 11px; letter-spacing: .16em;
  text-transform: uppercase; color: var(--ink-3); margin-bottom: 14px;
}
.index ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.index a {
  display: flex; gap: 10px; align-items: baseline;
  padding: 6px 0; color: var(--ink-2); text-decoration: none;
  font-size: 14px; border-bottom: 1px solid transparent;
}
.index a b {
  font-family: var(--mono); font-size: 11px; color: var(--ink-3);
  font-variant-numeric: tabular-nums; font-weight: 500;
}
.index a:hover { color: var(--accent); }
.index a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.col { display: grid; gap: 76px; min-width: 0; }

section { display: grid; gap: 20px; scroll-margin-top: 24px; }
section h2 { font-size: clamp(25px, 3.2vw, 34px); letter-spacing: -.02em; font-weight: 750; }
section .lead { max-width: 66ch; color: var(--ink-2); }

/* ------------------------------------------------------------------ pillars */
.pillars { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px,1fr)); gap: 1px;
  background: var(--line); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.pillars div { background: var(--surface); padding: 22px 20px; display: grid; gap: 7px; align-content: start; }
.pillars b { font-size: 15.5px; letter-spacing: -.01em; }
.pillars span { font-size: 14.5px; color: var(--ink-3); line-height: 1.55; }

/* ------------------------------------------------------------------ steps */
.steps { display: grid; gap: 34px; }
.step { display: grid; grid-template-columns: 46px minmax(0,1fr); gap: 20px; align-items: start; }
.step .n {
  font-family: var(--mono); font-size: 26px; font-weight: 600; line-height: 1;
  color: var(--accent); font-variant-numeric: tabular-nums;
  border-top: 2px solid var(--accent); padding-top: 10px;
}
.step h3 { font-size: 19px; letter-spacing: -.01em; margin-bottom: 6px; }
.step p { color: var(--ink-2); max-width: 60ch; font-size: 16px; }

/* ------------------------------------------------------------------ plates */
.plate { margin: 6px 0 0; display: grid; gap: 12px; justify-items: start; }
.plate figcaption {
  font-family: var(--mono); font-size: 12.5px; line-height: 1.5;
  color: var(--ink-3); max-width: 60ch;
}

/* tablet govdesi: 1024x600 ekrani kusatan koyu cerceve */
.tab {
  background: linear-gradient(160deg,#3b424e,#242a33);
  padding: 20px 26px; border-radius: 22px; position: relative;
  box-shadow: var(--shadow); max-width: 100%;
}
.tab-cam {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  width: 6px; height: 6px; border-radius: 50%;
  background: #10141a; box-shadow: inset 0 0 0 1px rgba(255,255,255,.10);
}
.tab-bar {
  position: absolute; right: 9px; top: 50%; transform: translateY(-50%);
  width: 3px; height: 46px; border-radius: 3px; background: rgba(255,255,255,.12);
}
.tab .shot { border-radius: 5px; }

/* masaustu penceresi: tablet cerceveden bakisda ayrilsin */
/* cercevesi kendi icinde cizilmis gorseller: govde yok, sadece olcek */
.bare { max-width: 100%; }
.bare img { display: block; width: 100%; height: auto; }

.win {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 11px; overflow: hidden; box-shadow: var(--shadow); max-width: 100%;
}
.win-bar { display: flex; gap: 7px; padding: 11px 13px; background: var(--sunken); border-bottom: 1px solid var(--line); }
.win-bar s { width: 10px; height: 10px; border-radius: 50%; background: var(--line); }

.shot { position: relative; overflow: hidden; line-height: 0; }
.shot img { display: block; width: 100%; height: auto; }

.callout {
  position: absolute; transform: translate(-50%,-50%);
  font-family: var(--mono); font-size: 11px; letter-spacing: .04em;
  background: var(--accent); color: #fff; padding: 4px 9px; border-radius: 999px;
  white-space: nowrap; box-shadow: 0 3px 12px rgba(0,0,0,.3);
  display: flex; align-items: center; gap: 7px;
}
.callout i { width: 5px; height: 5px; border-radius: 50%; background: #fff; opacity: .85; }

/* ------------------------------------------------------------------ tables */
.tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 15px; }
th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
th {
  font-family: var(--mono); font-size: 11px; letter-spacing: .13em; text-transform: uppercase;
  color: var(--ink-3); font-weight: 500; background: var(--sunken);
  border-bottom: 1px solid var(--line);
}
td.k { white-space: nowrap; font-weight: 600; padding-right: 26px; }
td { color: var(--ink-2); }

/* kisayol notasyonu tus kapagi gibi: konuya ait, ucuz suslemeye kacmadan */
code {
  font-family: var(--mono); font-size: .86em;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); border-bottom-width: 2px;
  border-radius: 5px; padding: 1px 6px; white-space: nowrap;
}

/* ------------------------------------------------------------------ notes */
.note {
  border-left: 2px solid var(--warn); background: var(--surface);
  padding: 15px 18px; border-radius: 0 var(--radius) var(--radius) 0;
  font-size: 15.5px; color: var(--ink-2); max-width: 66ch;
}
.note em { font-style: normal; color: var(--ink); }

.notes { border-top: 1px solid var(--line); padding: 46px 0 0; display: grid; gap: 22px; }
.notes h2 { font-size: 24px; letter-spacing: -.01em; }
.notes dl { display: grid; gap: 1px; background: var(--line); border: 1px solid var(--line);
  border-radius: var(--radius); overflow: hidden; margin: 0; }
.notes .row { background: var(--surface); padding: 16px 18px; display: grid;
  grid-template-columns: 190px minmax(0,1fr); gap: 18px; }
@media (max-width: 640px) { .notes .row { grid-template-columns: 1fr; gap: 5px; } }
.notes dt { font-family: var(--mono); font-size: 12px; letter-spacing: .06em;
  text-transform: uppercase; color: var(--caution); padding-top: 2px; }
.notes dd { margin: 0; font-size: 15.5px; color: var(--ink-2); }

footer {
  border-top: 1px solid var(--line); margin-top: 56px; padding: 26px 0 60px;
  font-family: var(--mono); font-size: 12px; color: var(--ink-3); letter-spacing: .04em;
}

/* ------------------------------------------------------------------ motion */
@media (prefers-reduced-motion: no-preference) {
  section, .step, .pillars { animation: rise .5s cubic-bezier(.2,.7,.3,1) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
}
</style>

<div class="gd" dir="${content.dir}">
  <header class="hero">
    <div class="wrap">
      <p class="eyebrow">${esc(content.eyebrow)}</p>
      <h1>${esc(content.heroTitle)}</h1>
      <p class="lead">${esc(content.heroLead)}</p>
    </div>
  </header>

  <div class="wrap">
    <div class="body">
      <nav class="index" aria-label="Contents">
        <p>${esc(content.pillars.title)}</p>
        <ul>${navHtml}</ul>
      </nav>

      <div class="col">
        ${figure(content.heroFigure)}

        <section>
          <p class="eyebrow">${esc(content.pillars.title)}</p>
          <div class="pillars">
            ${content.pillars.items.map((i) => `<div><b>${esc(i.k)}</b><span>${esc(i.v)}</span></div>`).join('')}
          </div>
        </section>

        <section>
          <p class="eyebrow">${esc(content.setup.lead)}</p>
          <h2>${esc(content.setup.title)}</h2>
          <div class="steps">
            ${content.setup.steps.map((s) => `
            <div class="step">
              <div class="n">${esc(s.n)}</div>
              <div>
                <h3>${esc(s.title)}</h3>
                <p>${s.body}</p>
                ${s.figure ? figure(s.figure) : ''}
              </div>
            </div>`).join('')}
          </div>
        </section>

        ${sectionsHtml}

        <div class="notes">
          <h2>${esc(content.notes.title)}</h2>
          <dl>
            ${content.notes.items.map((i) => `<div class="row"><dt>${esc(i.k)}</dt><dd>${esc(i.v)}</dd></div>`).join('')}
          </dl>
        </div>

        <footer>${esc(content.footer)}</footer>
      </div>
    </div>
  </div>
</div>
`;

const out = path.join(DOCS, `guide-${LANG}.html`);
fs.writeFileSync(out, html, 'utf8');
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`${path.basename(out)}  ${kb} KB  ${INLINE ? `(${cache.size} gorsel gomulu)` : '(gorseller shots/ altinda)'}`);
