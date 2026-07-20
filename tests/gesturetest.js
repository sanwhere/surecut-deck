// Iki parmak jestinde mod kararini (kaydirma / kistirma) sinar.
// app.js'teki karar mantiginin kopyasi; sentetik parmak verisiyle beslenir.
//
// Asil sinanan: parmaklar arasi mesafenin dogal titresimi jesti yanlislikla
// kistirmaya kilitliyor mu? Onceki surumde mutlak degisimler BIRIKTIGI icin
// kilitliyordu ve kaydirma hic calismiyordu.

const MODE_DIST = 30;
const MODE_MOVE = 2;
const MODE_WINDOW = 350;
const AXIS_LOCK = 1.4;
const FRAME_MS = 16;      // kare basina gecen sure (60fps)

// Bir jesti kare kare oynatip hangi modun secildigini dondurur.
function runGesture(frames) {
  const f0 = frames[0];
  const startDist = Math.hypot(f0.a.x - f0.b.x, f0.a.y - f0.b.y);
  const startCx = (f0.a.x + f0.b.x) / 2, startCy = (f0.a.y + f0.b.y) / 2;

  let mode = null, axis = null;
  let scrolled = 0, zoomed = 0;
  let prevDist = startDist, prevCy = startCy;

  frames.slice(1).forEach((f, i) => {
    const elapsed = (i + 1) * FRAME_MS;
    const dist = Math.hypot(f.a.x - f.b.x, f.a.y - f.b.y);
    const cx = (f.a.x + f.b.x) / 2, cy = (f.a.y + f.b.y) / 2;
    const netDist = Math.abs(dist - startDist);
    const netX = cx - startCx, netY = cy - startCy;
    const netMove = Math.hypot(netX, netY);

    if (!mode) {
      if (netDist > MODE_DIST && netDist > netMove * 1.6 && elapsed < MODE_WINDOW) mode = 'pinch';
      else if (netMove > MODE_MOVE || elapsed >= MODE_WINDOW) {
        mode = 'scroll';
        const ax = Math.abs(netX), ay = Math.abs(netY);
        axis = ay > ax * AXIS_LOCK ? 'v' : (ax > ay * AXIS_LOCK ? 'h' : null);
      }
    }

    // mod kilitlenmemis olsa bile kaydirilir (bekleme yok)
    if (mode === 'pinch') zoomed += Math.abs(dist - prevDist);
    else scrolled += Math.abs(cy - prevCy);

    prevDist = dist; prevCy = cy;
  });

  return { mode, axis, scrolled, zoomed, framesToScroll: frames.length };
}

// --- sentetik jestler ---

// Duz dikey kaydirma
function scrollDown(steps = 30, wobble = 0) {
  const fr = [];
  for (let i = 0; i < steps; i++) {
    // wobble: parmaklarin birbirine gore dogal oynamasi (sinus, isaret degistirir)
    const w = wobble * Math.sin(i * 0.9);
    fr.push({ a: { x: 420 - w / 2, y: 200 + i * 4 }, b: { x: 540 + w / 2, y: 200 + i * 4 } });
  }
  return fr;
}

// Yatay kaydirma
function scrollRight(steps = 30) {
  const fr = [];
  for (let i = 0; i < steps; i++) {
    fr.push({ a: { x: 300 + i * 4, y: 300 }, b: { x: 420 + i * 4, y: 300 } });
  }
  return fr;
}

// Gercek kistirma: parmaklar birbirinden uzaklasiyor, merkez sabit
function pinchOut(steps = 25) {
  const fr = [];
  for (let i = 0; i < steps; i++) {
    fr.push({ a: { x: 480 - i * 4, y: 300 }, b: { x: 540 + i * 4, y: 300 } });
  }
  return fr;
}

// Cok yavas kaydirma (kare basina 1px)
function slowScroll(steps = 40) {
  const fr = [];
  for (let i = 0; i < steps; i++) {
    fr.push({ a: { x: 420, y: 250 + i }, b: { x: 540, y: 250 + i } });
  }
  return fr;
}

let fails = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log('  ' + (ok ? 'OK  ' : 'HATA') + '  ' + name.padEnd(46) + got + (ok ? '' : '   (beklenen: ' + want + ')'));
};

// Kosul dogru mu; olculen degeri bilgi olarak yazar.
const checkTrue = (name, ok, info) => {
  if (!ok) fails++;
  console.log('  ' + (ok ? 'OK  ' : 'HATA') + '  ' + name.padEnd(46) + (info || ''));
};

console.log('\n--- iki parmak mod karari ---\n');

check('duz dikey kaydirma', runGesture(scrollDown(30, 0)).mode, 'scroll');
check('titresimli kaydirma (+-6px)', runGesture(scrollDown(30, 6)).mode, 'scroll');
check('cok titresimli kaydirma (+-14px)', runGesture(scrollDown(30, 14)).mode, 'scroll');
check('asiri titresimli kaydirma (+-24px)', runGesture(scrollDown(40, 24)).mode, 'scroll');
check('cok yavas kaydirma', runGesture(slowScroll()).mode, 'scroll');
check('yatay kaydirma', runGesture(scrollRight()).mode, 'scroll');
check('gercek kistirma', runGesture(pinchOut()).mode, 'pinch');

console.log('');
check('dikey kaydirmada eksen kilidi', runGesture(scrollDown(30, 6)).axis, 'v');
check('yatay kaydirmada eksen kilidi', runGesture(scrollRight()).axis, 'h');

// Asil sikayet: "cok zor algiliyor". Kaydirma ILK karelerde baslamali.
console.log('');
{
  const g = runGesture(scrollDown(30, 6));
  checkTrue('kaydirma ilk kareden itibaren isliyor', g.scrolled > 100, 'toplam ' + Math.round(g.scrolled) + 'px');
}
{
  // Cok kisa jest: sadece 4 kare (yaklasik 64ms) - yine de kaydirmali
  const g = runGesture(scrollDown(4, 4));
  checkTrue('cok kisa jest bile kaydiriyor', g.scrolled > 0, Math.round(g.scrolled) + 'px');
}
{
  // Kistirma sirasinda az miktarda kaydirma sizmasi kabul edilebilir olmali
  const g = runGesture(pinchOut());
  checkTrue('kistirmada yakinlastirma baskin', g.zoomed > g.scrolled * 3,
        'zoom ' + Math.round(g.zoomed) + 'px / scroll ' + Math.round(g.scrolled) + 'px');
}

// Eski (hatali) mantik ayni veride ne yapiyordu: birikimli mutlak degisim
function runOld(frames) {
  let prevDist = null, prevCx = 0, prevCy = 0, distAccum = 0, centAccum = 0, mode = null;
  for (const f of frames) {
    const dist = Math.hypot(f.a.x - f.b.x, f.a.y - f.b.y);
    const cx = (f.a.x + f.b.x) / 2, cy = (f.a.y + f.b.y) / 2;
    if (prevDist !== null) {
      distAccum += Math.abs(dist - prevDist);
      centAccum += Math.hypot(cx - prevCx, cy - prevCy);
      if (!mode) {
        if (distAccum > 20 && distAccum > centAccum * 1.4) mode = 'pinch';
        else if (centAccum > 5) mode = 'scroll';
      }
    }
    prevDist = dist; prevCx = cx; prevCy = cy;
  }
  return mode;
}

console.log('\n  (karsilastirma) eski mantik ayni verilerde:');
console.log('    titresimli kaydirma        -> ' + runOld(scrollDown(30, 14)));
console.log('    asiri titresimli kaydirma  -> ' + runOld(scrollDown(40, 24)));

console.log('\n' + (fails === 0 ? 'TUM TESTLER GECTI' : fails + ' TEST BASARISIZ') + '\n');
process.exit(fails === 0 ? 0 : 1);
