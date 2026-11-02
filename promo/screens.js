'use strict';

/* Screenshots der App für die Webseite (docs/img). Start:
   node_modules\electron\dist\electron.exe promo\screens.js
   Läuft mit eigenen Testdaten (Beispieldaten), die echten Daten bleiben unberührt. */

const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'img');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml' };
app.setPath('userData', path.join(app.getPath('temp'), 'tageswerk-screens'));
app.commandLine.appendSwitch('force-device-scale-factor', '1');

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/src/index.html`;
  const win = new BrowserWindow({ width: 1600, height: 960, useContentSize: true, show: false, webPreferences: { offscreen: true } });
  await win.loadURL(url);
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }] });
  const js = (c) => win.webContents.executeJavaScript(c);
  await js(`localStorage.clear(); localStorage.setItem('tageswerk', JSON.stringify({ habits: [], onboarded: true, settings: { lang: 'de', weeklyReview: false, remindHabits: false, remindShift: false, remindEvents: false, remindClockOut: false } })); 1`);
  await win.loadURL(url);
  await wait(1500);
  await js(`(async () => {
    window.celebrateBadge = () => {}; window.maybeShowReview = () => {};
    closeModal(); loadDemo();
    await new Promise((r) => { const s = document.createElement('script'); s.src = '../promo/bridge.js'; s.onload = r; document.head.appendChild(s); });
    const st = document.createElement('style');
    st.textContent = '.demo-banner, .toast { display: none !important; } ::-webkit-scrollbar { width: 0 !important; }';
    document.head.appendChild(st);
    __promo.setup(); __promo.enableWork(); __promo.enableFinance();
    // Ein paar Gewohnheiten und die Stimmung schon eingetragen, damit die Startseite nach Alltag aussieht
    const k = todayKey();
    active().filter((h) => !isAmount(h)).slice(0, 3).forEach((h) => { state.log[k] ||= []; if (!state.log[k].includes(h.id)) state.log[k].push(h.id); });
    (state.journal[k] ||= {}).mood = 4;
    save(); __promo.go('today');
    return 1;
  })()`);
  await wait(800);

  const shot = async (name, code, delay = 900) => {
    await js(`(async () => { ${code}; return 1; })()`);
    await wait(delay);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `${name}.jpg`), img.toJPEG(90));
    console.log('Bild', name);
  };
  await shot('heute', "__promo.go('today'); document.getElementById('scroller').scrollTop = 0");
  await shot('uebersicht', '__promo.habitsPrevMonth()');
  await shot('statistiken', "__promo.go('stats')");
  await shot('kalender', "__promo.calMode('week'); const s = document.getElementById('wk-scroll'); if (s) s.scrollTop = 7.5 * 48");
  await shot('stundenplan', "__promo.go('schedule')");
  await shot('finanzen', "__promo.go('finance')");
  await shot('level', "__promo.go('today'); openLevelPanel()");
  await shot('anpassen', "closeModal(); ui.dashEdit = true; __promo.go('today')");
  await shot('hell', "ui.dashEdit = false; __promo.theme('light'); __promo.go('today')");
  srv.close();
  app.exit(0);
});
