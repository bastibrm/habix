'use strict';
/* Google Kalender: Anmeldung im Browser (OAuth für Desktop-Apps mit PKCE und Rückruf auf 127.0.0.1)
   und Zugriff auf die Kalender-API. Der Zugang (Refresh-Token) liegt verschlüsselt im App-Ordner,
   die Oberfläche bekommt ihn nie zu sehen, sie ruft nur google:api auf.
   Es können mehrere Google-Konten verbunden sein, jedes mit eigenem Zugang (Schlüssel ist die E-Mail-Adresse).
   Die Zugangsdaten der App (Client-ID und -Secret aus der Google Cloud) stehen in google-oauth.json.
   Bei Desktop-Apps ist das Secret laut Google kein Geheimnis, es darf in der App mitgeliefert werden. */
const { app, shell, safeStorage, net } = require('electron');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events'];
const API = 'https://www.googleapis.com/calendar/v3';
const tokenFile = () => path.join(app.getPath('userData'), 'google.bin');

function client() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'google-oauth.json'), 'utf8'));
    const o = c.installed || c;
    return o.client_id && o.client_secret ? { id: o.client_id, secret: o.client_secret } : null;
  } catch { return null; }
}

let accounts = null; // [{ email, refresh, access, expires }]
function loadAccounts() {
  if (accounts) return accounts;
  try {
    const raw = fs.readFileSync(tokenFile());
    const data = JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8'));
    accounts = Array.isArray(data.accounts) ? data.accounts : data.refresh ? [data] : []; // früher gab es nur ein Konto
  } catch { accounts = []; }
  return accounts;
}
function storeAccounts() {
  if (!accounts.length) { try { fs.unlinkSync(tokenFile()); } catch { /* schon weg */ } return; }
  const json = JSON.stringify({ accounts });
  fs.writeFileSync(tokenFile(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : json);
}
const accountOf = (email) => loadAccounts().find((a) => a.email === email);

async function tokenRequest(params) {
  const c = client();
  const r = await net.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, ...params }).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `HTTP ${r.status}`); e.code = j.error; throw e; }
  return j;
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const emailOf = (idToken) => {
  try { return JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8')).email || ''; } catch { return ''; }
};
const page = (title, text) => `<!doctype html><meta charset="utf-8"><title>Habix</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#141517;color:#e8eaed;font:16px system-ui,sans-serif;text-align:center">
<div><div style="font-size:40px;color:#1e90ff">●</div><h1 style="font-size:22px;margin:12px 0 6px">${title}</h1><p style="color:#9aa0a6;margin:0">${text}</p></div>`;

// Anmeldung: Browser öffnen, auf den Rückruf warten, Code gegen Token tauschen
let pending = null;
function login(lang) {
  const c = client();
  if (!c) return Promise.reject(Object.assign(new Error('not-configured'), { code: 'not-configured' }));
  if (pending) { pending.cancel(); pending = null; }
  const en = lang === 'en';
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const stateTok = b64url(crypto.randomBytes(16));
  return new Promise((resolve, reject) => {
    let done = false;
    const server = http.createServer(async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/') { res.writeHead(404); res.end(); return; }
      const finish = (ok, err) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(ok ? page(en ? 'Connected to Google' : 'Mit Google verbunden', en ? 'You can close this tab and go back to Habix.' : 'Du kannst diesen Tab schließen und zu Habix zurückgehen.')
          : page(en ? 'Sign-in cancelled' : 'Anmeldung abgebrochen', en ? 'Go back to Habix and try again.' : 'Geh zurück zu Habix und versuch es noch einmal.'));
        cleanup();
        if (ok) resolve(ok); else reject(err);
      };
      if (u.searchParams.get('state') !== stateTok) { finish(null, new Error('state')); return; }
      const code = u.searchParams.get('code');
      if (!code) { finish(null, Object.assign(new Error('denied'), { code: 'denied' })); return; }
      try {
        const port = server.address().port;
        const t = await tokenRequest({ code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: `http://127.0.0.1:${port}` });
        if (!t.refresh_token) throw new Error('no-refresh');
        const email = emailOf(t.id_token || '') || `Google ${loadAccounts().length + 1}`;
        const acc = { email, refresh: t.refresh_token, access: t.access_token, expires: Date.now() + (t.expires_in - 60) * 1000 };
        // Dasselbe Konto noch einmal angemeldet: Zugang erneuern statt doppelt
        accounts = [...loadAccounts().filter((a) => a.email !== email), acc];
        storeAccounts();
        finish({ email });
      } catch (e) { finish(null, e); }
    });
    const timer = setTimeout(() => { cleanup(); reject(Object.assign(new Error('timeout'), { code: 'timeout' })); }, 5 * 60 * 1000);
    function cleanup() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      server.close();
      pending = null;
    }
    pending = { cancel: () => { cleanup(); reject(Object.assign(new Error('cancelled'), { code: 'cancelled' })); } };
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const q = new URLSearchParams({
        client_id: c.id, redirect_uri: `http://127.0.0.1:${port}`, response_type: 'code', scope: SCOPES.join(' '),
        code_challenge: challenge, code_challenge_method: 'S256', state: stateTok, access_type: 'offline', prompt: 'select_account consent',
      });
      shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
    });
  });
}

function cancelLogin() { if (pending) pending.cancel(); }

async function accessToken(email, force = false) {
  const t = accountOf(email);
  if (!t) throw Object.assign(new Error('signed-out'), { code: 'signed-out' });
  if (!force && t.access && t.expires > Date.now()) return t.access;
  try {
    const r = await tokenRequest({ refresh_token: t.refresh, grant_type: 'refresh_token' });
    Object.assign(t, { access: r.access_token, expires: Date.now() + (r.expires_in - 60) * 1000 });
    storeAccounts();
    return t.access;
  } catch (e) {
    // Zugang wurde bei Google widerrufen, ist abgelaufen oder gehört zu einem früheren Client der App:
    // dieses Konto abmelden, die Oberfläche bietet neu anmelden an
    if (e.code === 'invalid_grant' || e.code === 'unauthorized_client') { logout(email, false); throw Object.assign(new Error('signed-out'), { code: 'signed-out' }); }
    throw e;
  }
}

// Ein Aufruf der Kalender-API; nur Pfade unter /users/me/calendarList und /calendars/ sind erlaubt
async function api(email, method, p, body) {
  if (!/^\/(users\/me\/calendarList|calendars\/)/.test(p)) throw new Error('path');
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) throw new Error('method');
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await net.fetch(API + p, {
      method,
      headers: { Authorization: `Bearer ${await accessToken(email, attempt > 0)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401 && attempt === 0) continue;
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* leer */ }
    return { status: r.status, ok: r.ok, json };
  }
}

function logout(email, revoke = true) {
  const t = accountOf(email);
  if (!t) return;
  if (revoke && t.refresh) net.fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh)}`, { method: 'POST' }).catch(() => {});
  accounts = loadAccounts().filter((a) => a !== t);
  storeAccounts();
}

function status() {
  return { configured: !!client(), accounts: loadAccounts().map((a) => a.email) };
}

module.exports = { login, cancelLogin, api, logout, status };
