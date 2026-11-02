'use strict';

/* Speicherort der Daten. Wer Tageswerk auf zwei PCs nutzt, legt die Datei in einen Ordner, den OneDrive, Dropbox oder
   Google Drive abgleicht, und wählt auf beiden PCs denselben Ordner. Speichert der andere PC, lädt diese App die Daten neu. */

async function refreshLocation() {
  try { ui.dataLoc = await window.api.dataLocation(); } catch { ui.dataLoc = null; }
  if (ui.view === 'settings' && !ui.modal) render('update');
}

function storageSetting() {
  const loc = ui.dataLoc;
  if (loc === undefined) { refreshLocation(); return ''; }
  if (!loc) return '';
  const p = ui.pendingLoc;
  return `
  <div class="storage">
    <div class="storage-row">
      ${icon(loc.custom ? 'cloud' : 'hard-drive')}
      <div class="storage-text">
        <b>${loc.custom ? dt('Eigener Ordner', 'Custom folder') : dt('Standard-Ordner der App', 'App default folder')}</b>
        <span class="mono" title="${esc(loc.dir)}">${esc(loc.dir)}</span>
      </div>
      <div class="btn-row">
        <button class="btn small" data-action="loc-choose">${icon('folder-input')}${dt('Ordner wählen', 'Choose folder')}</button>
        ${loc.custom ? `<button class="btn small ghost" data-action="loc-reset">${dt('Zurück zum Standard', 'Back to default')}</button>` : ''}
      </div>
    </div>
    ${loc.missing ? `<div class="error">${dt(`Der gewählte Ordner ist gerade nicht erreichbar (${esc(loc.wanted)}). Bis er wieder da ist, speichert die App im Standard-Ordner.`, `The chosen folder is not reachable right now (${esc(loc.wanted)}). Until it is back, the app saves to the default folder.`)}</div>` : ''}
    ${p ? `
    <div class="confirm-box">
      <span>${dt('In diesem Ordner liegen schon Tageswerk-Daten, z. B. von deinem anderen PC. Welche willst du behalten?', 'This folder already contains Tageswerk data, e.g. from your other PC. Which do you want to keep?')}</span>
      <div class="btn-row">
        <button class="btn small primary" data-action="loc-use">${icon('download')}${dt('Daten aus dem Ordner laden', 'Load data from the folder')}</button>
        <button class="btn small danger" data-action="loc-take">${icon('upload')}${dt('Meine Daten dorthin, die anderen ersetzen', 'Move my data there, replace the other')}</button>
        <button class="btn small ghost" data-action="loc-cancel">${dt('Abbrechen', 'Cancel')}</button>
      </div>
    </div>` : ''}
    <div class="setting-note">${icon('info')}<span>${dt('Für zwei PCs: einen Ordner in OneDrive, Dropbox oder Google Drive wählen und auf dem anderen PC denselben Ordner. Speichert ein PC, übernimmt der andere die Änderungen nach ein paar Sekunden. Am besten nicht an beiden gleichzeitig eintragen.', 'For two PCs: choose a folder in OneDrive, Dropbox or Google Drive and the same folder on the other PC. When one PC saves, the other picks up the changes after a few seconds. Best not to edit on both at the same time.')}</span></div>
  </div>`;
}

// Erst alles Offene speichern, dann umziehen und neu laden
async function moveData(dir, mode) {
  try {
    await window.api.dataMove(dir, mode, state);
    toast(mode === 'use' ? dt('Daten aus dem Ordner geladen', 'Loaded data from the folder') : dt('Daten umgezogen', 'Data moved'));
    setTimeout(() => location.reload(), 600);
  } catch {
    toast(dt('Der Ordner konnte nicht verwendet werden.', 'The folder could not be used.'));
  }
}

async function storageAction(a) {
  switch (a) {
    case 'loc-choose': {
      const r = await window.api.dataChoose();
      if (!r) return true;
      if (r.exists) { ui.pendingLoc = r; render('update'); } else moveData(r.dir, 'take');
      return true;
    }
    case 'loc-use': moveData(ui.pendingLoc.dir, 'use'); ui.pendingLoc = null; return true;
    case 'loc-take': moveData(ui.pendingLoc.dir, 'take'); ui.pendingLoc = null; return true;
    case 'loc-cancel': ui.pendingLoc = null; render('update'); return true;
    case 'loc-reset':
      await window.api.dataResetLocation(state);
      toast(dt('Daten liegen wieder im Standard-Ordner', 'Data is back in the default folder'));
      setTimeout(() => location.reload(), 600);
      return true;
  }
  return false;
}

// Änderungen vom anderen PC übernehmen, ohne dass jemand etwas tun muss
window.api?.onDataExternal?.(async () => {
  if (ui.modal || document.activeElement?.matches('input, textarea')) { ui.externalPending = true; return; }
  await applyExternal();
});
async function applyExternal() {
  ui.externalPending = false;
  await load();
  if (typeof onDataChanged === 'function') onDataChanged();
  render('update');
  toast(dt('Änderungen vom anderen PC übernommen', 'Picked up changes from your other PC'));
}
setInterval(() => { if (ui.externalPending && !ui.modal && !document.activeElement?.matches('input, textarea')) applyExternal(); }, 2000);
