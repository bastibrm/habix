'use strict';

/* Finanzen: Kontoauszug als CSV importieren, automatisch einordnen, Abos erkennen, Budgets planen.
   Alles bleibt lokal. state.finance = { enabled, tx: [], rules: {}, subs: [], dismissed: [], budgets: {}, imports: [] } */

const FIN_CATS = [
  { id: 'income', name: 'Einnahmen', icon: 'banknote', color: '#4fd6a4', words: ['gehalt', 'lohn', 'bezuege', 'bezüge', 'rente', 'kindergeld', 'erstattung', 'gutschrift', 'salary'] },
  { id: 'housing', name: 'Wohnen', icon: 'house', color: '#7aa2ff', words: ['miete', 'nebenkosten', 'hausverwaltung', 'wohnungs', 'strom', 'stadtwerke', 'gas ', 'vattenfall', 'eon', 'e.on', 'enbw', 'rundfunk', 'gez', 'grundsteuer'] },
  { id: 'groceries', name: 'Lebensmittel', icon: 'shopping-basket', color: '#57e3b4', words: ['rewe', 'edeka', 'aldi', 'lidl', 'netto', 'penny', 'kaufland', 'real ', 'globus', 'norma', 'tegut', 'denns', 'alnatura', 'bäckerei', 'baeckerei', 'metzgerei', 'getränke', 'flaschenpost'] },
  { id: 'dining', name: 'Essen & Lieferdienste', icon: 'utensils', color: '#ffc46b', words: ['lieferando', 'wolt', 'uber eats', 'mcdonald', 'burger king', 'kfc', 'subway', 'starbucks', 'restaurant', 'pizza', 'döner', 'doener', 'cafe', 'café', 'imbiss', 'vapiano'] },
  { id: 'transport', name: 'Mobilität', icon: 'car', color: '#5ee0ff', words: ['shell', 'aral', 'esso', 'jet ', 'total', 'tankstelle', 'deutsche bahn', 'db vertrieb', 'db fernverkehr', 'bvg', 'mvg', 'hvv', 'vrr', 'rmv', 'deutschlandticket', 'uber', 'bolt', 'tier ', 'lime', 'sixt', 'parken', 'parkhaus', 'flixbus', 'adac', 'kfz'] },
  { id: 'subs', name: 'Abos & Streaming', icon: 'tv', color: '#ff7ab6', words: ['netflix', 'spotify', 'disney', 'amazon prime', 'prime video', 'apple.com', 'itunes', 'youtube', 'dazn', 'sky ', 'audible', 'playstation', 'xbox', 'nintendo', 'steam', 'patreon', 'chatgpt', 'openai', 'adobe', 'microsoft', 'google storage', 'icloud'] },
  { id: 'phone', name: 'Internet & Handy', icon: 'smartphone', color: '#8f7bff', words: ['telekom', 'vodafone', 'o2 ', 'telefonica', '1&1', 'congstar', 'drillisch', 'freenet', 'mobilfunk', 'internet'] },
  { id: 'shopping', name: 'Shopping', icon: 'shopping-bag', color: '#ff8f6b', words: ['amazon', 'zalando', 'otto', 'ebay', 'mediamarkt', 'saturn', 'ikea', 'h&m', 'zara', 'primark', 'dm-drogerie', 'dm drogerie', 'rossmann', 'müller', 'douglas', 'paypal', 'klarna', 'temu', 'shein', 'decathlon', 'thalia'] },
  { id: 'insurance', name: 'Versicherungen', icon: 'shield', color: '#aab3c2', words: ['versicherung', 'allianz', 'huk', 'axa', 'ergo', 'debeka', 'signal iduna', 'generali', 'devk', 'r+v', 'krankenkasse', 'tk ', 'aok', 'barmer'] },
  { id: 'health', name: 'Gesundheit & Sport', icon: 'heart-pulse', color: '#ef5d6f', words: ['apotheke', 'arzt', 'praxis', 'zahnarzt', 'klinik', 'optiker', 'fielmann', 'mcfit', 'fitx', 'fitness', 'urban sports', 'gym', 'clever fit'] },
  { id: 'leisure', name: 'Freizeit & Reisen', icon: 'plane', color: '#c4f06b', words: ['kino', 'cinemaxx', 'eventim', 'booking.com', 'airbnb', 'lufthansa', 'ryanair', 'eurowings', 'hotel', 'reise', 'tui', 'expedia'] },
  { id: 'cash', name: 'Bargeld', icon: 'banknote', color: '#d99a5b', words: ['geldautomat', 'bargeld', 'auszahlung', 'atm', 'cash'] },
  { id: 'savings', name: 'Sparen & Umbuchungen', icon: 'piggy-bank', color: '#3fc6f2', words: ['umbuchung', 'sparplan', 'sparen', 'tagesgeld', 'depot', 'trade republic', 'scalable', 'comdirect depot', 'flatex', 'wertpapier', 'übertrag', 'uebertrag'] },
  { id: 'other', name: 'Sonstiges', icon: 'ellipsis', color: '#8d95a8', words: [] },
];
const catOf = (id) => FIN_CATS.find((c) => c.id === id) || FIN_CATS[FIN_CATS.length - 1];
const fin = () => (state.finance ||= { enabled: false, tx: [], rules: {}, subs: [], dismissed: [], budgets: {}, imports: [] });
const eur = (v, sign = false) => `${sign && v > 0 ? '+' : ''}${new Intl.NumberFormat(LOCALE(), { style: 'currency', currency: 'EUR' }).format(v)}`;
const normName = (s) => String(s || '').toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-zäöüß&+. ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');

/* ================= CSV lesen ================= */

function csvRows(text) {
  text = text.replace(/^﻿/, '');
  const sample = text.split(/\r?\n/).slice(0, 40);
  const score = (d) => sample.filter((l) => l.split(d).length > 3).length;
  const delim = [';', ',', '\t'].sort((a, b) => score(b) - score(a))[0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim()));
}

const normHead = (h) => h.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\s+/g, ' ').trim();
function findCol(head, keys, exclude = []) {
  for (const k of keys) {
    const i = head.findIndex((h, n) => !exclude.includes(n) && (h === k || h.startsWith(k)));
    if (i >= 0) return i;
  }
  return -1;
}

function parseAmount(s) {
  let t = String(s).replace(/[€$\s]|EUR/g, '').replace(/[−–]/g, '-');
  if (!t) return NaN;
  const lc = t.lastIndexOf(','), ld = t.lastIndexOf('.');
  if (lc > -1 && ld > -1) t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (lc > -1) t = t.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return Number(t);
}

function parseDate(s) {
  const t = String(s).trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(t);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${pad(+m[2])}-${pad(+m[1])}`; }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

function categorize(name, purpose, amount) {
  const f = fin();
  const rule = f.rules[normName(name)];
  if (rule) return rule;
  const text = ` ${name} ${purpose} `.toLowerCase();
  if (amount > 0) {
    if (catOf('savings').words.some((w) => text.includes(w))) return 'savings';
    return 'income';
  }
  for (const c of FIN_CATS) if (c.id !== 'income' && c.words.some((w) => text.includes(w))) return c.id;
  return 'other';
}

function parseStatement(text) {
  const rows = csvRows(text);
  const DATE = ['buchungstag', 'buchungsdatum', 'buchung', 'booking date', 'started date', 'completed date', 'transaction date', 'datum', 'date', 'valutadatum', 'valuta', 'wertstellung'];
  const AMOUNT = ['betrag (€)', 'betrag (eur)', 'betrag', 'umsatz in eur', 'umsatz', 'amount (eur)', 'amount'];
  let hi = -1, head = null;
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const h = rows[i].map(normHead);
    if (findCol(h, DATE) >= 0 && findCol(h, AMOUNT) >= 0) { hi = i; head = h; break; }
  }
  if (hi < 0) throw new Error('kein Kopf');
  const cDate = findCol(head, DATE);
  const cAmount = findCol(head, AMOUNT);
  const cPayee = findCol(head, ['zahlungsempfaenger*in', 'zahlungsempfaenger', 'empfaenger']);
  const cPayer = findCol(head, ['zahlungspflichtige*r', 'zahlungspflichtiger'], [cPayee]);
  const cName = findCol(head, ['beguenstigter/zahlungspflichtiger', 'name zahlungsbeteiligter', 'auftraggeber/empfaenger', 'auftraggeber / beguenstigter', 'auftraggeber/zahlungsempfaenger', 'partner name', 'payee', 'counterparty', 'name', 'description', 'beschreibung', 'auftraggeber']);
  const cPurpose = findCol(head, ['verwendungszweck', 'vorgang/verwendungszweck', 'payment reference', 'reference', 'buchungstext', 'vorgang', 'umsatzart', 'beschreibung', 'description', 'type'], [cName]);
  const cSH = findCol(head, ['soll/haben', 's/h']);
  const seen = {};
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    if (r.length < 2) continue;
    const date = parseDate(r[cDate] || '');
    let amount = parseAmount(r[cAmount] || '');
    if (!date || !Number.isFinite(amount) || amount === 0) continue;
    if (cSH >= 0 && /^s/i.test(r[cSH] || '') && amount > 0) amount = -amount;
    let name = '';
    if (cPayee >= 0 || cPayer >= 0) name = amount < 0 ? (r[cPayee] || r[cPayer] || '') : (r[cPayer] || r[cPayee] || '');
    if (!name && cName >= 0) name = r[cName] || '';
    const purpose = cPurpose >= 0 ? (r[cPurpose] || '') : '';
    if (!name) name = purpose.split(/\s{2,}|\//)[0] || '—';
    const base = `${date}|${amount.toFixed(2)}|${name}|${purpose}`;
    seen[base] = (seen[base] || 0) + 1;
    out.push({ id: `${base}#${seen[base]}`, date, amount: Math.round(amount * 100) / 100, name: name.slice(0, 120), purpose: purpose.replace(/\s+/g, ' ').slice(0, 300) });
  }
  if (!out.length) throw new Error('keine Buchungen');
  return out;
}

function importStatement(text, fileName) {
  const f = fin();
  const rows = parseStatement(text);
  const have = new Set(f.tx.map((t) => t.id));
  let added = 0;
  for (const r of rows) {
    if (have.has(r.id)) continue;
    f.tx.push({ ...r, cat: categorize(r.name, r.purpose, r.amount) });
    added++;
  }
  f.tx.sort((a, b) => b.date.localeCompare(a.date));
  f.imports.push({ name: fileName, date: todayKey(), count: added });
  f.enabled = true;
  save();
  return { added, skipped: rows.length - added, last: rows.reduce((m, r) => (r.date > m ? r.date : m), '') };
}

async function pickStatement(afterUnlock = false) {
  if (!window.api?.finFile) { toast('Der Import ist nur in der Desktop-App verfügbar.'); return; }
  try {
    const r = await window.api.finFile();
    if (!r) return;
    const res = importStatement(r.text, r.name);
    closeModal();
    toast(res.skipped ? `${res.added} neue Buchungen importiert, ${res.skipped} waren schon da` : `${res.added} Buchungen importiert`);
    if (res.last) ui.finMonth = res.last.slice(0, 7);
    if (afterUnlock) { confetti(); renderSidebar(); setTimeout(() => go('finance'), 250); } else render('update');
  } catch {
    toast('Die Datei konnte nicht gelesen werden. Lade den Kontoauszug als CSV-Datei aus dem Online-Banking herunter.');
  }
}

/* ================= Abos und Fixkosten ================= */

const PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
const INTERVAL_LABEL = { monthly: 'monatlich', quarterly: 'vierteljährlich', yearly: 'jährlich' };
const INTERVAL_DAYS = { monthly: 30.4, quarterly: 91.3, yearly: 365 };

function detectSubs() {
  const f = fin();
  const groups = {};
  for (const t of f.tx) {
    if (t.amount >= 0 || ['cash', 'savings'].includes(t.cat)) continue;
    const k = normName(t.name);
    if (!k) continue;
    (groups[k] ||= []).push(t);
  }
  const known = new Set([...f.subs.map((s) => s.key), ...f.dismissed]);
  const latest = f.tx[0]?.date || todayKey();
  const out = [];
  for (const [k, list] of Object.entries(groups)) {
    if (list.length < 2 || known.has(k)) continue;
    list.sort((a, b) => a.date.localeCompare(b.date));
    const gaps = list.slice(1).map((t, i) => daysBetween(list[i].date, t.date)).sort((a, b) => a - b);
    const gap = gaps[Math.floor(gaps.length / 2)];
    const amounts = list.map((t) => -t.amount).sort((a, b) => a - b);
    const amt = amounts[Math.floor(amounts.length / 2)];
    if (amounts.some((a) => Math.abs(a - amt) > amt * 0.15 + 1)) continue;
    const interval = gap >= 26 && gap <= 35 ? 'monthly' : gap >= 84 && gap <= 98 ? 'quarterly' : gap >= 350 && gap <= 380 ? 'yearly' : null;
    if (!interval) continue;
    const last = list[list.length - 1];
    if (daysBetween(last.date, latest) > INTERVAL_DAYS[interval] * 1.6) continue; // läuft wohl nicht mehr
    out.push({ key: k, name: last.name, amount: Math.round(amt * 100) / 100, interval, next: addDays(last.date, Math.round(INTERVAL_DAYS[interval])), cat: last.cat === 'other' ? 'subs' : last.cat, count: list.length });
  }
  return out.sort((a, b) => b.amount * PER_MONTH[b.interval] - a.amount * PER_MONTH[a.interval]);
}

// Nächster Fälligkeitstag eines Abos ab heute
function nextDue(s) {
  let k = s.next || todayKey();
  const step = s.interval === 'yearly' ? 12 : s.interval === 'quarterly' ? 3 : 1;
  let guard = 0;
  while (k < todayKey() && guard++ < 500) { const d = parseKey(k); d.setMonth(d.getMonth() + step); k = keyOf(d); }
  return k;
}

/* ================= Ansicht ================= */

function monthTx(ym) { return fin().tx.filter((t) => t.date.startsWith(ym)); }

function viewFinance() {
  const f = fin();
  const latest = f.tx[0]?.date?.slice(0, 7) || todayKey().slice(0, 7);
  const ym = ui.finMonth || latest;
  const list = monthTx(ym);
  const income = list.filter((t) => t.amount > 0 && t.cat !== 'savings').reduce((a, t) => a + t.amount, 0);
  const spend = -list.filter((t) => t.amount < 0 && t.cat !== 'savings').reduce((a, t) => a + t.amount, 0);
  const saved = -list.filter((t) => t.cat === 'savings').reduce((a, t) => a + t.amount, 0);
  const fixed = f.subs.reduce((a, s) => a + s.amount * PER_MONTH[s.interval], 0);
  const title = new Intl.DateTimeFormat(LOCALE(), { month: 'long', year: 'numeric' }).format(parseKey(`${ym}-01`));

  // Ausgaben nach Kategorie
  const byCat = {};
  for (const t of list) if (t.amount < 0 && t.cat !== 'savings') byCat[t.cat] = (byCat[t.cat] || 0) - t.amount;
  const cats = FIN_CATS.filter((c) => c.id !== 'income' && c.id !== 'savings' && (byCat[c.id] || f.budgets[c.id]))
    .map((c) => ({ c, spent: byCat[c.id] || 0, budget: f.budgets[c.id] || 0 })).sort((a, b) => b.spent - a.spent);
  const maxSpent = Math.max(1, ...cats.map((x) => x.spent));

  // 6 Monate Verlauf
  const months = [];
  for (let i = 5; i >= 0; i--) { const d = parseKey(`${ym}-01`); d.setMonth(d.getMonth() - i); months.push(keyOf(d).slice(0, 7)); }
  const hist = months.map((m) => {
    const l = monthTx(m);
    return { m, inc: l.filter((t) => t.amount > 0 && t.cat !== 'savings').reduce((a, t) => a + t.amount, 0), out: -l.filter((t) => t.amount < 0 && t.cat !== 'savings').reduce((a, t) => a + t.amount, 0) };
  });
  const histMax = Math.max(1, ...hist.flatMap((h) => [h.inc, h.out]));

  // Monatsplan: Ø Einnahmen der letzten 3 Monate mit Daten
  const incomeMonths = hist.slice(-4, -1).filter((h) => h.inc > 0);
  const avgIncome = incomeMonths.length ? incomeMonths.reduce((a, h) => a + h.inc, 0) / incomeMonths.length : income;
  const budgetSum = Object.values(f.budgets).reduce((a, b) => a + (b || 0), 0);
  const free = avgIncome - fixed - budgetSum;
  const saveRate = income > 0 ? Math.max(0, (income - spend) / income) : null;

  const suggestions = detectSubs();
  const q = (ui.finSearch || '').toLowerCase();
  const shown = list.filter((t) => (!ui.finCat || t.cat === ui.finCat) && (!q || `${t.name} ${t.purpose}`.toLowerCase().includes(q)));
  const limit = ui.finLimit || 40;

  return `
  <header class="head fade-in">
    <div><div class="eyebrow">${esc(title)}</div><h1>Finanzen</h1></div>
    <div class="head-actions">
      <div class="week-nav">
        <button class="icon-btn" data-action="fin-month" data-dir="-1" aria-label="Voriger Monat">${icon('chevron-left')}</button>
        ${navNowBtn('fin-month', navMonthLabel(ym), ym === latest, dt('Zum neuesten Monat', 'Go to the latest month'))}
        <button class="icon-btn" data-action="fin-month" data-dir="1" aria-label="Nächster Monat">${icon('chevron-right')}</button>
      </div>
      <button class="btn" data-action="fin-sub-new">${icon('repeat')}Abo hinzufügen</button>
      <button class="btn primary" data-action="fin-import">${icon('upload')}Kontoauszug importieren</button>
    </div>
  </header>

  <section class="grid">
    <article class="card s3 fade-in fin-tile">
      <div class="card-head"><h2 class="muted">Einnahmen</h2><div class="icon-btn" style="color:var(--good)">${icon('arrow-down-left')}</div></div>
      <div class="fin-num good">${eur(income)}</div>
      <div class="sub">${list.filter((t) => t.amount > 0).length} Buchungen</div>
    </article>
    <article class="card s3 fade-in fin-tile">
      <div class="card-head"><h2 class="muted">Ausgaben</h2><div class="icon-btn" style="color:var(--bad)">${icon('arrow-up-right')}</div></div>
      <div class="fin-num bad">${eur(spend)}</div>
      <div class="sub">${list.filter((t) => t.amount < 0).length} Buchungen${saved ? ` · ${eur(saved)} gespart` : ''}</div>
    </article>
    <article class="card s3 fade-in fin-tile">
      <div class="card-head"><h2 class="muted">Saldo</h2><div class="icon-btn">${icon('scale')}</div></div>
      <div class="fin-num ${income - spend >= 0 ? 'good' : 'bad'}">${eur(income - spend, true)}</div>
      <div class="sub">${saveRate === null ? 'Keine Einnahmen in diesem Monat' : `Sparquote ${pct(saveRate)}`}</div>
    </article>
    <article class="card s3 fade-in fin-tile">
      <div class="card-head"><h2 class="muted">Fixkosten</h2><div class="icon-btn" style="color:var(--violet)">${icon('repeat')}</div></div>
      <div class="fin-num">${eur(fixed)}</div>
      <div class="sub">pro Monat · ${eur(fixed * 12)} im Jahr</div>
    </article>

    <article class="card s8 fade-in">
      <div class="card-head"><div><h2>Ausgaben nach Kategorie</h2><div class="sub">Klick auf ein Budget, um es festzulegen. Die Leiste wird rot, je näher du am Budget bist.</div></div></div>
      ${cats.length ? `<div class="fin-cats">${cats.map(({ c, spent, budget }) => {
        const used = budget ? spent / budget : null;
        return `
        <div class="fin-cat">
          <span class="fin-cat-ico" style="--c:${c.color}">${icon(c.icon)}</span>
          <span class="fin-cat-name">${c.name}</span>
          <div class="fin-cat-bar"><span style="width:${(budget ? Math.min(1, used) : spent / maxSpent) * 100}%;${budget ? `--p:${progHue(1 - Math.min(1, used))}` : `background:${c.color}`}"></span></div>
          <span class="fin-cat-sum">${eur(spent)}</span>
          ${ui.finBudgetEdit === c.id
            ? `<form class="fin-budget-form" data-fin-budget="${c.id}"><input class="input small-input" id="fin-budget-${c.id}" inputmode="decimal" value="${budget || ''}" placeholder="z. B. 300"><button class="btn small primary" type="submit">OK</button></form>`
            : `<button class="fin-budget ${budget && used > 1 ? 'over' : ''}" data-action="fin-budget" data-cat="${c.id}">${budget ? `von ${eur(budget)}` : 'Budget festlegen'}</button>`}
        </div>`;
      }).join('')}</div>` : '<div class="muted">In diesem Monat gibt es keine Ausgaben.</div>'}
    </article>

    <div class="col s4">
      <article class="card fade-in">
        <div class="card-head"><div><h2>Monatsplan</h2><div class="sub">Was dir im Monat frei bleibt</div></div><div class="icon-btn">${icon('target')}</div></div>
        <div class="plan-list">
          <div><span>Ø Einnahmen</span><b class="good">${eur(avgIncome)}</b></div>
          <div><span>Fixkosten und Abos</span><b>− ${eur(fixed)}</b></div>
          <div><span>Budgets</span><b>− ${eur(budgetSum)}</b></div>
          <div class="plan-total"><span>Frei verfügbar</span><b class="${free >= 0 ? 'good' : 'bad'}">${eur(free)}</b></div>
        </div>
      </article>
      <article class="card fade-in">
        <div class="card-head"><div><h2>Verlauf</h2><div class="sub">Einnahmen und Ausgaben, 6 Monate</div></div></div>
        <div class="fin-hist">${hist.map((h) => `
          <div class="fin-hist-col ${h.m === ym ? 'now' : ''}" title="${esc(h.m)}: +${eur(h.inc)} / −${eur(h.out)}">
            <div class="fin-hist-bars"><span class="inc" data-anim="h" style="height:${(h.inc / histMax) * 100}%"></span><span class="out" data-anim="h" style="height:${(h.out / histMax) * 100}%"></span></div>
            <span class="fin-hist-label">${new Intl.DateTimeFormat(LOCALE(), { month: 'short' }).format(parseKey(`${h.m}-01`))}</span>
          </div>`).join('')}</div>
      </article>
    </div>

    <article class="card s6 fade-in">
      <div class="card-head">
        <div><h2>Abos und Fixkosten</h2><div class="sub">${f.subs.length ? `${f.subs.length} Einträge · ${eur(fixed)} im Monat` : 'Noch keine eingetragen'}</div></div>
        <button class="icon-btn" data-action="fin-sub-new" title="Abo hinzufügen">${icon('plus')}</button>
      </div>
      ${f.subs.length ? `<div class="sub-list">${[...f.subs].sort((a, b) => nextDue(a).localeCompare(nextDue(b))).map((s) => `
        <button class="sub-row" data-action="fin-sub-edit" data-id="${s.id}">
          <span class="fin-cat-ico" style="--c:${catOf(s.cat).color}">${icon(catOf(s.cat).icon)}</span>
          <span class="sub-name"><b>${esc(s.name)}</b><small>${INTERVAL_LABEL[s.interval]} · nächste Abbuchung ${esc(fmtShort(nextDue(s)))}</small></span>
          <span class="sub-amt"><b>${eur(s.amount)}</b>${s.interval !== 'monthly' ? `<small>${eur(s.amount * PER_MONTH[s.interval])} / Monat</small>` : ''}</span>
        </button>`).join('')}</div>` : ''}
      ${suggestions.length ? `
        <div class="label-sm" style="margin-top:4px">Erkannt in deinen Buchungen</div>
        <div class="sub-list">${suggestions.slice(0, 6).map((s) => `
          <div class="sub-row suggest">
            <span class="fin-cat-ico" style="--c:${catOf(s.cat).color}">${icon(catOf(s.cat).icon)}</span>
            <span class="sub-name"><b>${esc(s.name)}</b><small>${INTERVAL_LABEL[s.interval]} · ${s.count}× abgebucht</small></span>
            <span class="sub-amt"><b>${eur(s.amount)}</b></span>
            <span class="btn-row"><button class="btn small primary" data-action="fin-sub-accept" data-key="${esc(s.key)}">Übernehmen</button><button class="btn small ghost" data-action="fin-sub-dismiss" data-key="${esc(s.key)}">Ignorieren</button></span>
          </div>`).join('')}</div>` : ''}
      ${!f.subs.length && !suggestions.length ? '<div class="muted">Wiederkehrende Abbuchungen werden hier automatisch vorgeschlagen, sobald sie mindestens zweimal im Kontoauszug stehen.</div>' : ''}
    </article>

    <article class="card s6 fade-in">
      <div class="card-head">
        <div><h2>Buchungen</h2><div class="sub">${shown.length} von ${list.length} in diesem Monat</div></div>
      </div>
      <div class="fin-filter">
        <label class="fin-search">${icon('search')}<input id="fin-search" data-fin-search placeholder="Suchen, z. B. REWE" value="${esc(ui.finSearch || '')}" autocomplete="off"></label>
        <select class="input" id="fin-cat-filter" data-fin-cat-filter>
          <option value="">Alle Kategorien</option>
          ${FIN_CATS.map((c) => `<option value="${c.id}" ${ui.finCat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="tx-list">
        ${shown.slice(0, limit).map((t) => `
          <div class="tx-row">
            <span class="tx-date">${esc(fmtShort(t.date))}</span>
            <span class="tx-main"><b>${esc(t.name)}</b><small>${esc(t.purpose)}</small></span>
            <button class="tx-cat" style="--c:${catOf(t.cat).color}" data-action="fin-tx-cat" data-id="${esc(t.id)}" title="Kategorie ändern">${icon(catOf(t.cat).icon)}<span>${catOf(t.cat).name}</span></button>
            <span class="tx-amt ${t.amount > 0 ? 'good' : ''}">${eur(t.amount, true)}</span>
          </div>`).join('') || '<div class="muted">Keine Buchungen gefunden.</div>'}
        ${shown.length > limit ? `<button class="btn small ghost" data-action="fin-more">Weitere ${Math.min(40, shown.length - limit)} anzeigen</button>` : ''}
      </div>
    </article>
  </section>`;
}

/* ================= Freischalten ================= */

function openFinanceUnlock() {
  openPanel(`
    <div class="unlock">
      <div class="unlock-icon">${icon('wallet')}<span class="unlock-lock">${icon('lock')}</span></div>
      <div class="eyebrow">Bereich Finanzen</div>
      <h2 class="panel-title">Behalte dein Geld im Blick</h2>
      <p>Lade einen Kontoauszug hoch, und Habix ordnet deine Ausgaben, erkennt Abos und hilft dir beim Planen.</p>
      <ul class="unlock-list">
        <li>${icon('file-spreadsheet')}<div><b>Kontoauszug als CSV</b><span>Im Online-Banking unter Umsätze bei „Export“ oder „Download“ als CSV speichern. Klappt bei Sparkasse, Volksbank, DKB, ING, Commerzbank, comdirect, N26 und vielen mehr.</span></div></li>
        <li>${icon('shield')}<div><b>Ohne Bank-Login</b><span>Du gibst nirgends Zugangsdaten ein. Die Datei bleibt auf deinem PC.</span></div></li>
        <li>${icon('repeat')}<div><b>Abos und Budgets</b><span>Wiederkehrende Kosten werden erkannt, Budgets zeigen dir, wo du stehst.</span></div></li>
      </ul>
      <div class="btn-row unlock-actions">
        <button class="btn ghost" data-action="close-modal">Nicht jetzt</button>
        <button class="btn primary" data-action="fin-unlock-import">${icon('upload')}Kontoauszug hochladen</button>
      </div>
    </div>`, 'narrow');
}

/* ================= Abo-Dialog und Kategorie wechseln ================= */

function openSubEditor(sub) {
  ui.subEdit = sub ? { ...sub, confirmDelete: false } : { id: null, name: '', amount: '', interval: 'monthly', next: todayKey(), cat: 'subs', confirmDelete: false };
  renderSubEditor(true);
}

function renderSubEditor(first = false) {
  const e = ui.subEdit;
  const html = `
    <div class="card-head"><h2 class="panel-title" style="font-size:20px">${e.id ? 'Abo bearbeiten' : 'Abo hinzufügen'}</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="field"><label for="se-name">Name</label><input class="input" id="se-name" data-sub-field="name" maxlength="60" placeholder="z. B. Netflix" value="${esc(e.name)}"></div>
    <div class="ce-row">
      <div class="field"><label for="se-amount">Betrag in €</label><input class="input" id="se-amount" data-sub-field="amount" inputmode="decimal" value="${esc(String(e.amount))}" placeholder="z. B. 12,99"></div>
      <div class="field"><label for="se-interval">Abbuchung</label><select class="input" id="se-interval" data-sub-field="interval">
        ${Object.entries(INTERVAL_LABEL).map(([v, l]) => `<option value="${v}" ${e.interval === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="ce-row">
      <div class="field"><label for="se-next">Nächste Abbuchung</label><input class="input" type="date" id="se-next" data-sub-field="next" value="${e.next || ''}"></div>
      <div class="field"><label for="se-cat">Kategorie</label><select class="input" id="se-cat" data-sub-field="cat">
        ${FIN_CATS.filter((c) => c.id !== 'income').map((c) => `<option value="${c.id}" ${e.cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
    </div>
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot">
      ${e.id ? (e.confirmDelete
        ? `<div class="btn-row"><span class="error">Abo löschen?</span><button class="btn small danger" data-action="fin-sub-delete-yes">Löschen</button><button class="btn small ghost" data-action="fin-sub-delete-no">Nein</button></div>`
        : `<button class="btn small danger" data-action="fin-sub-delete">${icon('trash-2')}Löschen</button>`) : ''}
      <div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button><button class="btn primary" data-action="fin-sub-save">${icon('check')}Speichern</button></div>
    </div>`;
  if (first) { openPanel(html); return; }
  const m = document.querySelector('#modal .modal');
  if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
}

function saveSub() {
  const e = ui.subEdit;
  const amount = parseAmount(String(e.amount));
  if (!e.name.trim()) { e.error = 'Gib dem Abo einen Namen.'; renderSubEditor(); return; }
  if (!(amount > 0)) { e.error = 'Gib einen Betrag größer als 0 ein, z. B. 12,99.'; renderSubEditor(); return; }
  const f = fin();
  const data = { name: e.name.trim(), amount: Math.round(amount * 100) / 100, interval: e.interval, next: e.next || todayKey(), cat: e.cat, key: e.key || normName(e.name) };
  if (e.id) Object.assign(f.subs.find((s) => s.id === e.id), data);
  else f.subs.push({ id: uid(), ...data });
  ui.subEdit = null;
  save();
  closeModal();
  toast('Abo gespeichert');
  render('update');
}

function openTxCategory(id) {
  const t = fin().tx.find((x) => x.id === id);
  if (!t) return;
  ui.txEdit = { id, rule: true };
  openPanel(`
    <div class="card-head"><div><div class="eyebrow">${esc(fmtShort(t.date))} · ${eur(t.amount, true)}</div><h2 class="panel-title" style="font-size:20px">${esc(t.name)}</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    ${t.purpose ? `<div class="sub" style="margin:0">${esc(t.purpose)}</div>` : ''}
    <div class="cat-pick">${FIN_CATS.map((c) => `<button class="cat-opt ${t.cat === c.id ? 'on' : ''}" style="--c:${c.color}" data-action="fin-tx-set" data-cat="${c.id}">${icon(c.icon)}${c.name}</button>`).join('')}</div>
    <label class="setting" for="fin-rule" style="border:0;padding:0"><div><b>Immer so einordnen</b><span>Gilt auch für alle anderen Buchungen von „${esc(t.name)}“</span></div><input type="checkbox" class="switch" id="fin-rule" data-action="fin-rule" checked></label>`, 'narrow');
}

function setTxCategory(cat) {
  const f = fin();
  const t = f.tx.find((x) => x.id === ui.txEdit.id);
  if (!t) return;
  if (ui.txEdit.rule) {
    const k = normName(t.name);
    f.rules[k] = cat;
    for (const x of f.tx) if (normName(x.name) === k && Math.sign(x.amount) === Math.sign(t.amount)) x.cat = cat;
  } else t.cat = cat;
  ui.txEdit = null;
  save();
  closeModal();
  toast(`Eingeordnet als ${catOf(cat).name}`);
  render('update');
}

document.addEventListener('input', (e) => {
  const f = e.target.dataset?.subField;
  if (f && ui.subEdit) ui.subEdit[f] = e.target.value;
  if (e.target.matches('[data-fin-search]')) {
    ui.finSearch = e.target.value;
    clearTimeout(ui.finSearchTimer);
    ui.finSearchTimer = setTimeout(() => {
      const pos = e.target.selectionStart;
      render('update');
      const el = document.getElementById('fin-search');
      el?.focus();
      el?.setSelectionRange(pos, pos);
    }, 250);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-fin-cat-filter]')) { ui.finCat = e.target.value || null; ui.finLimit = 40; render('update'); }
  if (e.target.matches('[data-sub-field]') && ui.subEdit) ui.subEdit[e.target.dataset.subField] = e.target.value;
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-fin-budget]');
  if (!form) return;
  e.preventDefault();
  const cat = form.dataset.finBudget;
  const v = parseAmount(form.querySelector('input').value || '0');
  const f = fin();
  if (Number.isFinite(v) && v > 0) f.budgets[cat] = Math.round(v * 100) / 100; else delete f.budgets[cat];
  ui.finBudgetEdit = null;
  save();
  toast(f.budgets[cat] ? `Budget für ${catOf(cat).name}: ${eur(f.budgets[cat])}` : 'Budget entfernt');
  render('update');
});

function financeAction(a, el) {
  const f = fin();
  switch (a) {
    case 'fin-unlock-import': pickStatement(true); return true;
    case 'fin-import': pickStatement(false); return true;
    case 'fin-toggle':
      f.enabled = el.checked;
      save();
      renderSidebar();
      toast(el.checked ? 'Bereich Finanzen ist aktiv' : 'Bereich Finanzen ist aus. Deine Daten bleiben gespeichert.');
      return true;
    case 'fin-month': {
      const dir = Number(el.dataset.dir);
      const latest = f.tx[0]?.date?.slice(0, 7) || todayKey().slice(0, 7);
      const from = ui.finMonth || latest;
      if (dir === 0) ui.finMonth = latest;
      else { const d = parseKey(`${from}-01`); d.setMonth(d.getMonth() + dir); ui.finMonth = keyOf(d).slice(0, 7); }
      ui.finLimit = 40;
      slideRender(slideDir(from, ui.finMonth));
      return true;
    }
    case 'fin-budget':
      ui.finBudgetEdit = el.dataset.cat; render('update');
      document.getElementById(`fin-budget-${el.dataset.cat}`)?.focus();
      return true;
    case 'fin-more': ui.finLimit = (ui.finLimit || 40) + 40; render('update'); return true;
    case 'fin-tx-cat': openTxCategory(el.dataset.id); return true;
    case 'fin-rule': ui.txEdit.rule = el.checked; return true;
    case 'fin-tx-set': setTxCategory(el.dataset.cat); return true;
    case 'fin-sub-new': openSubEditor(null); return true;
    case 'fin-sub-edit': openSubEditor(f.subs.find((s) => s.id === el.dataset.id)); return true;
    case 'fin-sub-save': saveSub(); return true;
    case 'fin-sub-delete': ui.subEdit.confirmDelete = true; renderSubEditor(); return true;
    case 'fin-sub-delete-no': ui.subEdit.confirmDelete = false; renderSubEditor(); return true;
    case 'fin-sub-delete-yes':
      f.subs = f.subs.filter((s) => s.id !== ui.subEdit.id);
      ui.subEdit = null; save(); closeModal(); toast('Abo gelöscht'); render('update');
      return true;
    case 'fin-sub-accept': {
      const s = detectSubs().find((x) => x.key === el.dataset.key);
      if (s) { f.subs.push({ id: uid(), name: s.name, amount: s.amount, interval: s.interval, next: s.next, cat: s.cat, key: s.key }); save(); toast(`„${s.name}“ als Abo übernommen`); render('update'); }
      return true;
    }
    case 'fin-sub-dismiss': f.dismissed.push(el.dataset.key); save(); render('update'); return true;
  }
  return false;
}


/* ================= Beispieldaten ================= */

function loadFinanceDemo() {
  const f = fin();
  const today = todayKey();
  const tx = [];
  const add = (date, amount, name, purpose) => tx.push({ id: `demo|${date}|${amount}|${name}|${tx.length}`, date, amount, name, purpose, demo: true });
  for (let m = 2; m >= 0; m--) {
    const d = parseKey(today); d.setDate(1); d.setMonth(d.getMonth() - m);
    const ym = keyOf(d).slice(0, 7);
    const day = (n) => `${ym}-${pad(Math.min(n, 28))}`;
    if (day(1) > today) continue;
    add(day(1), 2650, 'Muster GmbH', 'Gehalt');
    add(day(2), -890, 'Hausverwaltung Schulz', 'Miete');
    add(day(3), -62, 'Stadtwerke', 'Abschlag Strom');
    add(day(5), -13.99, 'Netflix', 'Netflix Monatsabo');
    add(day(6), -10.99, 'Spotify', 'Spotify Premium');
    add(day(8), -29.99, 'Vodafone', 'Mobilfunk Rechnung');
    add(day(10), -24.90, 'McFit', 'Mitgliedsbeitrag');
    add(day(15), -58, 'Deutschlandticket', 'DB Vertrieb Abo');
    add(day(25), -200, 'Umbuchung Tagesgeld', 'Sparen');
    for (const n of [4, 9, 13, 18, 22, 27]) add(day(n), -Math.round((25 + Math.random() * 55) * 100) / 100, ['REWE', 'ALDI', 'Lidl', 'EDEKA'][n % 4], 'Kartenzahlung');
    for (const n of [7, 19]) add(day(n), -Math.round((12 + Math.random() * 25) * 100) / 100, n === 7 ? 'Lieferando' : 'Pizzeria Roma', 'Kartenzahlung');
    add(day(12), -Math.round((20 + Math.random() * 90) * 100) / 100, 'Amazon', 'Bestellung');
    add(day(16), -Math.round((40 + Math.random() * 30) * 100) / 100, 'Aral', 'Tankstelle');
  }
  f.tx = [...f.tx.filter((t) => !t.demo), ...tx.filter((t) => t.date <= today).map((t) => ({ ...t, cat: categorize(t.name, t.purpose, t.amount) }))]
    .sort((a, b) => b.date.localeCompare(a.date));
  f.budgets = Object.keys(f.budgets).length ? f.budgets : { groceries: 300, dining: 80, shopping: 100 };
  f.demoBudgets = true;
  f.enabled = true;
  f.demo = true;
}

function clearFinanceDemo() {
  const f = fin();
  if (!f.demo) return;
  f.tx = f.tx.filter((t) => !t.demo);
  if (f.demoBudgets) f.budgets = {};
  f.subs = f.subs.filter((s) => !s.demo);
  f.demo = false;
  f.demoBudgets = false;
  if (!f.tx.length) f.enabled = false;
}
