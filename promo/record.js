'use strict';

/* Nimmt das Werbevideo Bild für Bild auf und setzt es mit der Musik zu einer MP4 zusammen.
   Start:  node_modules\electron\dist\electron.exe promo\record.js [--test] [--from=Sekunde] [--to=Sekunde]
   --test speichert nur einzelne Standbilder nach promo/out/test-*.png */

const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
const TL = require('./timeline.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const W = TL.width, H = TL.height, FPS = TL.fps;
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}`));
const TEST = !!arg('test');
const FROM = Number((arg('from') || '').split('=')[1] || 0);
const TO = Number((arg('to') || '').split('=')[1] || TL.duration);

const LOG = path.join(__dirname, 'out', 'record.log');
const log = (...a) => { const line = a.join(' '); console.log(line); try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}
`); } catch {} };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

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

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('disable-gpu-vsync');

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(LOG, '');
  log('Start');
  const srv = await serve();
  log('Server auf Port', srv.address().port);
  const port = srv.address().port;
  const win = new BrowserWindow({
    width: W, height: H, useContentSize: true, show: false, frame: false,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  win.webContents.setFrameRate(60);
  // Die App selbst ohne eigene Animationen, damit jedes Bild von der Zeitleiste bestimmt ist
  log('Fenster erstellt');
  await win.loadURL(`http://127.0.0.1:${port}/promo/stage.html`);
  log('Bühne geladen');
  // Erst nach dem Laden der Bühne: Die App startet erst in prepare() und sieht dann schon die Einstellung
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }] });
  log('Medien gesetzt');
  win.webContents.on('console-message', (_e, _l, msg) => log('Seite:', msg));
  try {
    log(await Promise.race([
      win.webContents.executeJavaScript('window.prepare()'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('prepare dauert zu lange')), 30000)),
    ]));
  } catch (e) {
    log('Fehler:', e.message);
    const probe = 'JSON.stringify({ ready: document.readyState, app: !!document.getElementById("app").contentWindow?.state, src: document.getElementById("app").src })';
    log('Status:', await win.webContents.executeJavaScript(probe).catch((x) => x.message));
    app.quit();
    return;
  }

  const capture = async () => {
    let img = await win.webContents.capturePage();
    const s = img.getSize();
    if (s.width !== W || s.height !== H) img = img.resize({ width: W, height: H, quality: 'best' });
    return img;
  };

  if (TEST) {
    // Standbilder an markanten Stellen; die Zeit läuft dabei vorwärts durch, damit Klicks passieren
    const shots = (process.env.SHOTS || '1.0,4.6,6.2,7.7,8.9,10.5,13.3,15.0,16.2,17.8,19.5,20.5,22.8,24.6,25.6,26.2,26.6,27.6,28.7,29.7,30.3,30.6,31.6,33.6,34.5,35.3,36.6,38.0,38.6,39.3,40.2,42.0').split(',').map(Number);
    let next = 0;
    for (let f = 0; f <= Math.ceil(TL.duration * FPS) && next < shots.length; f++) {
      const t = f / FPS;
      await win.webContents.executeJavaScript(`window.renderAt(${t})`);
      if (t >= shots[next]) {
        fs.writeFileSync(path.join(OUT, `test-${String(shots[next]).replace('.', '_')}.png`), (await capture()).toPNG());
        log('Standbild', shots[next]);
        next++;
      }
    }
    srv.close();
    app.quit();
    return;
  }

  const videoFile = path.join(OUT, 'video-only.mp4');
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', videoFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));

  const total = Math.round(TL.duration * FPS);
  const started = Date.now();
  for (let f = 0; f < total; f++) {
    const t = f / FPS;
    await win.webContents.executeJavaScript(`window.renderAt(${t})`);
    if (t < FROM || t > TO) continue;
    await write((await capture()).toBitmap());
    if (f % 30 === 0) {
      const done = (f + 1) / total, el = (Date.now() - started) / 1000;
      log(`Bild ${f + 1}/${total} (${Math.round(done * 100)} %), noch ca. ${Math.round(el / done - el)} s`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));

  // Ton dazu
  const finalFile = path.join(OUT, 'Habix-Promo.mp4');
  await new Promise((r) => spawn(ffmpeg, ['-y', '-loglevel', 'error', '-i', videoFile, '-i', path.join(OUT, 'audio.wav'),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', finalFile], { stdio: 'inherit' }).on('close', r));
  log('Fertig:', finalFile);
  srv.close();
  app.quit();
});
