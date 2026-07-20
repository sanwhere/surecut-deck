// Bayat istemcinin yapilandirmayi ezemedigini dogrular.
// Senaryo: iki istemci baglanir, A kaydeder (surum artar), sonra B ESKI surumle
// kaydetmeye calisir. B reddedilmeli ve A'nin degisikligi ayakta kalmali.
const WebSocket = require('ws');

function client(name) {
  const ws = new WebSocket('ws://127.0.0.1:8791');
  const st = { ws, name, config: null, revision: null, results: new Map(), seq: 0 };

  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.type === 'authed' || m.type === 'config') {
      st.config = m.config;
      st.revision = m.revision;
    }
    if (m.type === 'result') {
      const cb = st.results.get(m.id);
      if (cb) { st.results.delete(m.id); cb(m); }
    }
  });

  st.ready = new Promise((res) => {
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token: '' })));
    const t = setInterval(() => { if (st.config) { clearInterval(t); res(); } }, 50);
  });

  st.save = (cfg, revision) => new Promise((res) => {
    const id = ++st.seq;
    // Gercek istemci gibi davran: kabul edilen kaydin dondurdugu yeni surumu benimse.
    st.results.set(id, (m) => {
      if (m.ok && m.revision) st.revision = m.revision;
      res(m);
    });
    ws.send(JSON.stringify({ type: 'saveConfig', id, revision, config: cfg }));
  });

  return st;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let fails = 0;
  const check = (n, ok, got) => { if (!ok) fails++; console.log('  ' + (ok ? 'OK  ' : 'HATA') + '  ' + n + '  ->  ' + got); };

  console.log('\n--- bayat istemci korumasi ---\n');

  const A = client('A'), B = client('B');
  await Promise.all([A.ready, B.ready]);

  const startCount = A.config.pages[0].buttons.length;
  const startRev = A.revision;
  check('iki istemci de bagli', A.revision != null && B.revision === A.revision, 'surum ' + startRev);

  // A yeni bir buton ekleyip kaydeder.
  const aCfg = JSON.parse(JSON.stringify(A.config));
  aCfg.pages[0].buttons.push({
    id: 'test-a', label: 'A-TEST', icon: '🅰️', color: '#3b82f6',
    action: { type: 'hotkey', keys: 'f13' }
  });
  const r1 = await A.save({ settings: aCfg.settings, pages: aCfg.pages }, A.revision);
  check('A kaydi kabul edildi', r1.ok, r1.message);

  await sleep(300);

  // B hala eski surumu tutuyor (A'nin eklemesinden habersiz kopya) ve kaydetmeye calisir.
  const bCfg = JSON.parse(JSON.stringify(B.config));   // A'nin butonu bunda YOK
  bCfg.settings = { ...bCfg.settings, columns: 9 };
  const r2 = await B.save({ settings: bCfg.settings, pages: bCfg.pages }, startRev);
  check('B bayat kaydi REDDEDILDI', !r2.ok, r2.message);

  await sleep(400);

  // A'nin butonu duruyor mu, B tazelendi mi
  const nowCount = B.config.pages[0].buttons.length;
  check('A-TEST butonu ayakta', nowCount === startCount + 1 &&
        B.config.pages[0].buttons.some((x) => x.id === 'test-a'), nowCount + ' buton');
  check('B guncel surumu aldi', B.revision !== startRev, 'surum ' + B.revision);

  // ARDISIK KAYIT: ayni istemci ust uste kaydedebilmeli.
  // broadcastConfig gondereni disladigi icin, sunucu yeni surumu result ile
  // geri vermezse istemci eski surumde kalir ve ikinci kayit reddedilirdi.
  {
    const c1 = JSON.parse(JSON.stringify(A.config));
    c1.settings = { ...c1.settings, columns: 6 };
    const s1 = await A.save({ settings: c1.settings, pages: c1.pages }, A.revision);
    check('ardisik kayit 1', s1.ok, s1.message);

    const c2 = JSON.parse(JSON.stringify(A.config));
    c2.settings = { ...c2.settings, columns: 7 };
    const s2 = await A.save({ settings: c2.settings, pages: c2.pages }, A.revision);
    check('ardisik kayit 2 (ayni istemci)', s2.ok, s2.message);

    await sleep(300);
    check('sunucu result ile yeni surumu donuyor', !!s2.revision, 'surum ' + s2.revision);
  }

  // Temizlik: A-TEST butonunu sil
  const clean = JSON.parse(JSON.stringify(B.config));
  clean.pages[0].buttons = clean.pages[0].buttons.filter((x) => x.id !== 'test-a');
  const r3 = await B.save({ settings: clean.settings, pages: clean.pages }, B.revision);
  check('temizlik kaydi (guncel surumle) kabul edildi', r3.ok, r3.message);

  console.log('\n' + (fails === 0 ? 'TUM TESTLER GECTI' : fails + ' TEST BASARISIZ') + '\n');
  process.exit(fails === 0 ? 0 : 1);
})();

setTimeout(() => { console.log('zaman asimi'); process.exit(1); }, 25000);
