const { app, BrowserWindow, ipcMain, nativeTheme, shell, Tray, Menu, nativeImage, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Speicherort: normalerweise der App-Ordner. Wer zwei PCs nutzt, wählt z. B. einen OneDrive-Ordner,
// der Pfad dazu steht in speicherort.json im App-Ordner. Fehlt der Ordner (OneDrive nicht da), gilt der App-Ordner.
const locFile = () => path.join(app.getPath('userData'), 'speicherort.json');
function customDir() {
  try { return JSON.parse(fs.readFileSync(locFile(), 'utf8')).dir || null; } catch { return null; }
}
function dataDir() {
  const d = customDir();
  return d && fs.existsSync(d) ? d : app.getPath('userData');
}
const DATA_NAME = 'habix-daten.json';
const dataFile = () => path.join(dataDir(), DATA_NAME);

/* Die App hieß früher Tageswerk. Ihre Daten lagen in %APPDATA%\Tageswerk als tageswerk-daten.json (bzw. im gewählten Ordner).
   Beim Start wird übernommen, was dort neuer ist als die Habix-Datei. Nach dem Update ändert sich die alte Datei nicht mehr,
   dann passiert hier nichts mehr. Die alte Datei bleibt zur Sicherheit liegen, eine überschriebene neue wird vorher gesichert. */
const OLD_NAME = 'tageswerk-daten.json';
function adoptOld(oldFile, newFile) {
  try {
    if (!fs.existsSync(oldFile)) return false;
    if (fs.existsSync(newFile)) {
      if (fs.statSync(oldFile).mtimeMs <= fs.statSync(newFile).mtimeMs) return false;
      fs.copyFileSync(newFile, newFile.replace(/\.json$/, '.vor-uebernahme.json'));
    }
    fs.mkdirSync(path.dirname(newFile), { recursive: true });
    fs.copyFileSync(oldFile, newFile);
    return true;
  } catch { return false; }
}
function migrateFromTageswerk() {
  const userData = app.getPath('userData');
  const oldUser = path.join(app.getPath('appData'), 'Tageswerk');
  if (oldUser !== userData && fs.existsSync(oldUser)) {
    adoptOld(path.join(oldUser, OLD_NAME), path.join(userData, DATA_NAME));
    // Gewählter Speicherort und Sicherungen kommen beim ersten Mal mit
    const oldLoc = path.join(oldUser, 'speicherort.json');
    if (fs.existsSync(oldLoc) && !fs.existsSync(locFile())) fs.copyFileSync(oldLoc, locFile());
    const oldBackups = path.join(oldUser, 'backups');
    if (fs.existsSync(oldBackups) && !fs.existsSync(backupDir())) fs.cpSync(oldBackups, backupDir(), { recursive: true });
  }
  // Im eigenen Ordner (z. B. OneDrive) liegt die Datei ebenfalls noch unter dem alten Namen
  const d = customDir();
  if (d && fs.existsSync(d)) adoptOld(path.join(d, OLD_NAME), path.join(d, DATA_NAME));
}
const backupDir = () => path.join(app.getPath('userData'), 'backups');
const asset = (name) => path.join(__dirname, 'assets', name);
const startHidden = process.argv.includes('--hidden');
try { migrateFromTageswerk(); } catch { /* ohne alte Daten einfach weiter */ }

// Zeitzone: muss vor dem ersten Fenster gesetzt sein, eine Änderung braucht deshalb einen Neustart
const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
function savedTimeZone() {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'))?.settings?.timeZone || 'system';
  } catch {
    return 'system';
  }
}
const activeTimeZone = savedTimeZone();
if (activeTimeZone !== 'system') process.env.TZ = activeTimeZone;

let win = null;
let tray = null;
let quitting = false;
let settings = { closeToTray: true, autostart: false, lang: 'de' };
let trayStatus = { work: false, clocked: false, paused: false, since: null, today: '0:00', open: 0 };
let updateState = { status: 'idle', version: null, progress: 0, error: null };

// Nur eine Instanz: ein zweiter Start holt das vorhandene Fenster nach vorn
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());
app.setAppUserModelId('Habix');

// Fensterknöpfe oben rechts: durchsichtig, Symbolfarbe passend zum Theme
function overlayColors() {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#00000000', symbolColor: '#c9cace', height: 44 }
    : { color: '#00000000', symbolColor: '#3b3d43', height: 44 };
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 660,
    title: 'Habix',
    icon: asset('icon.png'),
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141517' : '#eef0f2',
    titleBarStyle: 'hidden',
    titleBarOverlay: overlayColors(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Uhr, Fokus-Timer und Erinnerungen laufen auch weiter, wenn das Fenster versteckt ist
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Externe Links im Standardbrowser öffnen statt in der App
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Das X versteckt die App nur, wenn das so eingestellt ist
  win.on('close', (e) => {
    if (!quitting && settings.closeToTray && tray) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function quit() {
  quitting = true;
  app.quit();
}

/* ---------- Texte des Hauptprozesses (Taskleiste, Dialoge) ---------- */

const MAIN_EN = {
  'Nicht eingestempelt': 'Not clocked in', 'Ausstempeln': 'Clock out', 'Einstempeln': 'Clock in',
  'Pause beenden': 'End break', 'Pause machen': 'Take a break', 'Habix öffnen': 'Open Habix', 'Beenden': 'Quit',
  'Alle Gewohnheiten erledigt': 'All habits done', 'Backup speichern': 'Save backup', 'Backup wiederherstellen': 'Restore backup',
  'Habix-Backup': 'Habix backup', 'Kalender importieren': 'Import calendar', 'Kalender': 'Calendar', 'Kontoauszug importieren': 'Import bank statement',
};
const L = (de) => (settings.lang === 'en' ? MAIN_EN[de] || de : de);

/* ---------- Symbol in der Taskleiste ---------- */

function sendTray(action) {
  win?.webContents.send('tray:action', action);
}

function updateTray() {
  if (!tray) return;
  const s = trayStatus;
  const img = s.clocked ? (s.paused ? 'tray-pause.png' : 'tray-active.png') : 'tray.png';
  tray.setImage(nativeImage.createFromPath(asset(img)));
  const en = settings.lang === 'en';
  const statusLine = s.clocked
    ? (s.paused ? (en ? `On a break · clocked in since ${s.since}` : `Pause · seit ${s.since} Uhr eingestempelt`) : (en ? `Clocked in since ${s.since}` : `Eingestempelt seit ${s.since} Uhr`))
    : L('Nicht eingestempelt');
  tray.setToolTip(s.work ? `Habix · ${statusLine} · ${en ? 'today' : 'heute'} ${s.today} h` : 'Habix');
  tray.setContextMenu(Menu.buildFromTemplate([
    ...(s.work ? [{ label: statusLine, enabled: false }, { label: en ? `Worked today: ${s.today} h` : `Heute gearbeitet: ${s.today} h`, enabled: false }] : []),
    { label: s.open ? (en ? `${s.open} ${s.open === 1 ? 'habit' : 'habits'} left` : `${s.open} ${s.open === 1 ? 'Gewohnheit' : 'Gewohnheiten'} offen`) : L('Alle Gewohnheiten erledigt'), enabled: false },
    { type: 'separator' },
    ...(updateState.status === 'ready' ? [{ label: en ? `Install update ${updateState.version}` : `Update auf ${updateState.version} installieren`, click: installUpdate }, { type: 'separator' }] : []),
    ...(s.work ? [{ label: L(s.clocked ? 'Ausstempeln' : 'Einstempeln'), click: () => sendTray('clock') }] : []),
    ...(s.work && s.clocked ? [{ label: L(s.paused ? 'Pause beenden' : 'Pause machen'), click: () => sendTray('pause') }] : []),
    { type: 'separator' },
    { label: L('Habix öffnen'), click: showWindow },
    { label: L('Beenden'), click: quit },
  ]));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(asset('tray.png')));
  tray.on('click', showWindow);
  updateTray();
}

/* ---------- Updates über GitHub Releases ---------- */

function sendUpdate(patch) {
  updateState = { ...updateState, ...patch };
  win?.webContents.send('update:state', updateState);
  updateTray();
}

// Updates gibt es erst, wenn in package.json ein echtes GitHub-Konto eingetragen ist (siehe build.publish)
function updatesConfigured() {
  if (!app.isPackaged) return false;
  try { return !fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8').includes('DEIN-GITHUB-NAME'); } catch { return false; }
}

function checkForUpdates() {
  if (!updatesConfigured()) return;
  autoUpdater.checkForUpdates().catch((e) => sendUpdate({ status: 'error', error: String(e?.message || e).split('\n')[0] }));
}

function installUpdate() {
  quitting = true;
  autoUpdater.quitAndInstall(true, true);
}

function setupUpdater() {
  if (!updatesConfigured()) return; // in der Entwicklung und vor der ersten Veröffentlichung gibt es nichts zu aktualisieren
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ status: 'checking', error: null }));
  autoUpdater.on('update-available', (i) => sendUpdate({ status: 'downloading', version: i.version, progress: 0 }));
  autoUpdater.on('update-not-available', () => sendUpdate({ status: 'latest', checkedAt: Date.now() }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ status: 'downloading', progress: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => sendUpdate({ status: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => sendUpdate({ status: 'error', error: String(e?.message || e).split('\n')[0] }));
  setTimeout(checkForUpdates, 8000);
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}

/* ---------- Autostart ---------- */

function applyAutostart(on) {
  // In der Entwicklung startet electron.exe mit dem App-Ordner, in der fertigen .exe direkt
  const args = app.isPackaged ? ['--hidden'] : [app.getAppPath(), '--hidden'];
  app.setLoginItemSettings({ openAtLogin: !!on, path: process.execPath, args });
  // Die App hieß früher Tageswerk: deren Eintrag zeigt nach dem Update auf eine gelöschte .exe und wird entfernt
  app.setLoginItemSettings({ openAtLogin: false, name: 'Tageswerk' });
}

/* ---------- IPC ---------- */

ipcMain.handle('data:load', () => {
  watchData();
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    return null;
  }
});

function writeData(file, data) {
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

ipcMain.handle('data:save', (_e, data) => {
  const file = dataFile();
  writeData(file, data);
  try { lastOwnWrite = fs.statSync(file).mtimeMs; } catch { /* egal */ }
  return true;
});

// Ein anderer PC hat im gemeinsamen Ordner gespeichert: Fenster neu laden lassen
let watched = null;
let lastOwnWrite = 0;
function watchData() {
  const file = dataFile();
  if (watched === file) return;
  if (watched) fs.unwatchFile(watched);
  watched = null;
  if (!customDir()) return; // im normalen App-Ordner schreibt niemand sonst
  watched = file;
  try { lastOwnWrite = fs.statSync(file).mtimeMs; } catch { lastOwnWrite = 0; }
  fs.watchFile(file, { interval: 3000 }, (cur) => {
    if (!cur.mtimeMs || Math.abs(cur.mtimeMs - lastOwnWrite) < 5) return;
    lastOwnWrite = cur.mtimeMs;
    win?.webContents.send('data:external');
  });
}

ipcMain.handle('data:location', () => {
  const custom = customDir();
  return { dir: dataDir(), custom: !!custom, missing: !!custom && !fs.existsSync(custom), wanted: custom };
});

ipcMain.handle('data:choose', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Ordner für deine Habix-Daten wählen', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const dir = r.filePaths[0];
  adoptOld(path.join(dir, OLD_NAME), path.join(dir, DATA_NAME));
  return { dir, exists: fs.existsSync(path.join(dir, DATA_NAME)) };
});

// mode 'take': die aktuellen Daten in den neuen Ordner mitnehmen, 'use': die Daten aus dem Ordner verwenden
ipcMain.handle('data:move', (_e, dir, mode, data) => {
  if (!dir || !fs.existsSync(dir)) throw new Error('Ordner nicht gefunden');
  if (mode === 'take') writeData(path.join(dir, DATA_NAME), data);
  fs.writeFileSync(locFile(), JSON.stringify({ dir }, null, 2), 'utf8');
  watchData();
  return true;
});

// Zurück in den App-Ordner, die aktuellen Daten kommen mit
ipcMain.handle('data:reset-location', (_e, data) => {
  writeData(path.join(app.getPath('userData'), DATA_NAME), data);
  try { fs.unlinkSync(locFile()); } catch { /* war schon weg */ }
  watchData();
  return true;
});

ipcMain.handle('theme:set', (_e, mode) => {
  nativeTheme.themeSource = ['light', 'dark'].includes(mode) ? mode : 'system';
  return nativeTheme.shouldUseDarkColors;
});

ipcMain.handle('data:reveal', () => shell.showItemInFolder(dataFile()));

ipcMain.handle('update:get', () => ({ ...updateState, current: app.getVersion(), packaged: app.isPackaged, configured: updatesConfigured() }));
ipcMain.handle('update:check', () => checkForUpdates());
ipcMain.handle('update:install', () => installUpdate());

ipcMain.handle('tz:info', () => ({ system: systemTimeZone, active: activeTimeZone === 'system' ? systemTimeZone : activeTimeZone, setting: activeTimeZone }));
ipcMain.handle('app:relaunch', () => {
  quitting = true;
  app.relaunch({ args: process.argv.slice(1).filter((a) => a !== '--hidden') });
  app.exit(0);
});
ipcMain.handle('window:show', () => showWindow());

ipcMain.handle('settings:apply', (_e, s) => {
  const autostartChanged = s.autostart !== undefined && s.autostart !== settings.autostart;
  settings = { ...settings, ...s };
  updateTray();
  if (autostartChanged) applyAutostart(settings.autostart);
  return true;
});

ipcMain.handle('tray:status', (_e, s) => {
  trayStatus = { ...trayStatus, ...s };
  updateTray();
  return true;
});

const stamp = () => new Date().toISOString().slice(0, 10);

ipcMain.handle('backup:export', async (_e, data) => {
  const r = await dialog.showSaveDialog(win, {
    title: L('Backup speichern'),
    defaultPath: path.join(app.getPath('documents'), `habix-backup-${stamp()}.json`),
    filters: [{ name: L('Habix-Backup'), extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true };
});

ipcMain.handle('backup:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: L('Backup wiederherstellen'),
    properties: ['openFile'],
    filters: [{ name: L('Habix-Backup'), extensions: ['json'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  try {
    return { name: path.basename(r.filePaths[0]), data: JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')) };
  } catch {
    return { error: 'unreadable' };
  }
});

// Wöchentliche Sicherung, die letzten 8 bleiben erhalten
ipcMain.handle('backup:auto', (_e, data) => {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `habix-${stamp()}.json`), JSON.stringify(data), 'utf8');
  // Auch die alten Sicherungen von Tageswerk zählen mit, sortiert nach Datum
  const day = (f) => f.match(/^(?:habix|tageswerk)-(\d{4}-\d{2}-\d{2})\.json$/)?.[1];
  const files = fs.readdirSync(dir).filter(day).sort((a, b) => day(a).localeCompare(day(b)));
  for (const f of files.slice(0, Math.max(0, files.length - 8))) fs.unlinkSync(path.join(dir, f));
  return true;
});

// Kalender: Abo-Adresse laden (im Hauptprozess, damit es keine Browser-Sperren gibt)
ipcMain.handle('cal:fetch', async (_e, url) => {
  const u = String(url).replace(/^webcal:/i, 'https:');
  if (!/^https?:\/\//i.test(u)) throw new Error('Ungültige Adresse');
  const r = await net.fetch(u, { headers: { Accept: 'text/calendar, */*' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  if (text.length > 20 * 1024 * 1024) throw new Error('Kalender zu groß');
  return text;
});

ipcMain.handle('cal:file', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: L('Kalender importieren'),
    properties: ['openFile'],
    filters: [{ name: L('Kalender'), extensions: ['ics', 'ical', 'ifb'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return { name: path.basename(r.filePaths[0]), text: fs.readFileSync(r.filePaths[0], 'utf8') };
});

// Kontoauszug: CSV lesen, Zeichensatz erkennen (viele Banken exportieren in Windows-1252)
ipcMain.handle('fin:file', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: L('Kontoauszug importieren'),
    properties: ['openFile'],
    filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const buf = fs.readFileSync(r.filePaths[0]);
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buf);
  return { name: path.basename(r.filePaths[0]), text };
});

ipcMain.handle('backup:folder', () => {
  fs.mkdirSync(backupDir(), { recursive: true });
  shell.openPath(backupDir());
});

nativeTheme.on('updated', () => {
  if (win && !win.isDestroyed()) {
    win.setTitleBarOverlay(overlayColors());
    win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#141517' : '#eef0f2');
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupUpdater();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => app.quit());
