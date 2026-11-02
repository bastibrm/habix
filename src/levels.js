'use strict';

/* Level und Ränge. XP werden immer aus den gespeicherten Daten berechnet, damit nichts doppelt zählt
   (z. B. durch An- und Abhaken). Ein Aufstieg wird einmal gefeiert und in state.levelSeen gemerkt.
   Arbeit und Finanzen zählen bewusst nicht mit. */

const XP = { habit: 10, perfect: 20, task: 8, taskPrio: 4, mood: 3 };
const BADGE_XP = { 7: 50, 30: 150, 66: 300, 100: 500, 365: 1500 };
const RANKS = [
  { from: 1, name: 'Lehrling', icon: 'hammer', color: '#b9895f', text: 'Jeder fängt mal an. Die ersten Häkchen zählen am meisten.' },
  { from: 5, name: 'Geselle', icon: 'wrench', color: '#9aa7b6', text: 'Die Routine sitzt langsam. Du weißt, was du tust.' },
  { from: 10, name: 'Handwerker', icon: 'ruler', color: '#3fc6f2', text: 'Verlässlich, Tag für Tag. Darauf kann man bauen.' },
  { from: 15, name: 'Meister', icon: 'award', color: '#4fd6a4', text: 'Deine Gewohnheiten laufen fast von allein.' },
  { from: 20, name: 'Werkmeister', icon: 'crown', color: '#f2b84b', text: 'Du planst deine Tage, statt dich von ihnen treiben zu lassen.' },
  { from: 30, name: 'Baumeister', icon: 'castle', color: '#ff8f6b', text: 'Aus vielen kleinen Tagen ist etwas Großes geworden.' },
  { from: 40, name: 'Großmeister', icon: 'gem', color: '#9585ff', text: 'Nur wenige halten so lange durch.' },
  { from: 50, name: 'Legende', icon: 'sparkles', color: '#ff7ab6', text: 'Tageswerk ist für dich kein Programm mehr, sondern ein Lebensstil.' },
];

// XP, die man für den Schritt von Level n auf n+1 braucht
const xpForLevel = (n) => 80 + 20 * n;

function levelFromXp(xp) {
  let level = 1, rest = xp;
  while (rest >= xpForLevel(level)) { rest -= xpForLevel(level); level++; }
  return { level, into: rest, need: xpForLevel(level) };
}

const rankOf = (level) => [...RANKS].reverse().find((r) => level >= r.from);
const nextRankOf = (level) => RANKS.find((r) => r.from > level);

let xpCache = null;
function computeXp() {
  if (xpCache) return xpCache;
  const parts = { habits: 0, perfect: 0, badges: 0, tasks: 0, mood: 0 };
  const today = todayKey();
  // Gewohnheiten (abgehakt oder Menge erreicht)
  for (const h of state.habits) {
    for (const k of Object.keys(state.log)) if (state.log[k].includes(h.id) && !isAmount(h)) parts.habits += XP.habit;
    if (isAmount(h)) for (const k of Object.keys(state.amounts)) if ((state.amounts[k][h.id] || 0) >= h.target) parts.habits += XP.habit;
    for (const d of Object.keys(state.badges[h.id] || {})) parts.badges += BADGE_XP[d] || 0;
  }
  // Perfekte Tage
  const first = state.habits.length ? state.habits.map((h) => h.createdAt).sort()[0] : null;
  if (first) for (const k of range(first, today)) if (dayRate(k, state.habits) === 1) parts.perfect += XP.perfect;
  // Aufgaben und Stimmung
  for (const t of state.tasks) if (t.done) parts.tasks += XP.task + (t.prio ? XP.taskPrio : 0);
  for (const k of Object.keys(state.journal)) if (state.journal[k].mood) parts.mood += XP.mood;
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  xpCache = { total, parts, ...levelFromXp(total) };
  return xpCache;
}

function rankBadge(rank, level, size = '') {
  return `<span class="rank-badge ${size}" style="--r:${rank.color}">${icon(rank.icon)}<b>${level}</b></span>`;
}

function renderLevelCard() {
  const el = document.getElementById('level-card');
  if (!el) return;
  const x = computeXp();
  const rank = rankOf(x.level);
  const share = x.into / x.need;
  el.style.setProperty('--r', rank.color);
  el.style.setProperty('--deg', `${Math.round(share * 360)}deg`);
  el.title = `${rank.name} · Level ${x.level} · ${x.into} / ${x.need} XP`;
  el.setAttribute('aria-label', el.title);
  // Inhalt nur beim Rangwechsel neu bauen, damit das Symbol nicht flackert
  if (el.dataset.rank !== rank.name) {
    el.dataset.rank = rank.name;
    el.innerHTML = `
      <span class="lv-ring"><span class="lv-ico">${icon(rank.icon)}</span></span>
      <span class="lv-txt"><b id="lv-level"></b><small>${rank.name}</small></span>
      <span class="lv-xp" id="lv-xp"></span>`;
    lucide.createIcons();
  }
  document.getElementById('lv-level').textContent = `Level ${x.level}`;
  document.getElementById('lv-xp').textContent = `${x.into} / ${x.need} XP`;
}

// Nach jeder Änderung: neu rechnen, Seitenleiste aktualisieren, Aufstieg feiern
let levelTimer = null;
function onDataChanged() {
  xpCache = null;
  clearTimeout(levelTimer);
  levelTimer = setTimeout(checkLevelUp, 350);
}

function checkLevelUp() {
  const x = computeXp();
  renderLevelCard();
  if (!state.levelSeen) { state.levelSeen = x.level; save(); return; } // erster Start: still übernehmen
  if (x.level <= state.levelSeen) return;
  const before = state.levelSeen;
  state.levelSeen = x.level;
  save();
  const pill = document.getElementById('level-card');
  pill?.classList.remove('level-up');
  void pill?.offsetWidth;
  pill?.classList.add('level-up');
  if (state.demo || ui.modal || ui.panel) { toast(`Level ${x.level} erreicht!`); return; }
  const rank = rankOf(x.level), newRank = rankOf(before) !== rank;
  openPanel(`
    <div class="celebrate">
      <div class="big-rank" style="--r:${rank.color}">${icon(rank.icon)}<b>${x.level}</b></div>
      <div class="eyebrow">${newRank ? 'Neuer Rang' : 'Level aufgestiegen'}</div>
      <h2 class="panel-title">${newRank ? rank.name : `Level ${x.level}`}</h2>
      <p>${newRank ? rank.text : `Weiter so. Noch ${x.need - x.into} XP bis Level ${x.level + 1}.`}</p>
      <button class="btn primary" data-action="close-modal">Weiter</button>
    </div>`, 'narrow');
  confetti();
}

// Kleines „+10 XP“, das über dem angeklickten Element hochschwebt
function xpPop(el, amount) {
  if (!el || reduceMotion || !amount) return;
  const r = el.getBoundingClientRect();
  const p = document.createElement('span');
  p.className = 'xp-pop';
  p.textContent = `+${amount} XP`;
  p.style.left = `${r.left + r.width / 2}px`;
  p.style.top = `${r.top}px`;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1100);
}

function openLevelPanel() {
  const x = computeXp();
  const rank = rankOf(x.level), next = nextRankOf(x.level);
  const rows = [
    ['list-checks', 'Gewohnheit erledigt', `+${XP.habit}`, x.parts.habits],
    ['flame', 'Perfekter Tag', `+${XP.perfect}`, x.parts.perfect],
    ['award', 'Abzeichen (7 bis 365 Tage)', '+50 bis +1500', x.parts.badges],
    ['list-todo', 'Aufgabe erledigt', `+${XP.task}, wichtig +${XP.task + XP.taskPrio}`, x.parts.tasks],
    ['smile', 'Stimmung eingetragen', `+${XP.mood}`, x.parts.mood],
  ];
  openPanel(`
    <div class="card-head">
      <div><div class="eyebrow">Dein Fortschritt</div><h2 class="panel-title" style="font-size:22px">Level und Rang</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button>
    </div>
    <div class="lv-hero" style="--r:${rank.color}">
      ${rankBadge(rank, x.level, 'big')}
      <div class="lv-hero-text">
        <b>${rank.name}</b>
        <span>Level ${x.level} · insgesamt ${num(x.total)} XP</span>
        <div class="meter"><span data-anim="w" style="width:${(x.into / x.need) * 100}%"></span></div>
        <small>Noch ${x.need - x.into} XP bis Level ${x.level + 1}${next ? ` · ${next.name} ab Level ${next.from}` : ''}</small>
      </div>
    </div>
    <div class="lv-cols">
      <div>
        <div class="label-sm">So sammelst du XP</div>
        <div class="xp-list">${rows.map(([ic, l, v, sum]) => `<div class="xp-row">${icon(ic)}<span>${l}</span><em>${v}</em><b>${num(sum)}</b></div>`).join('')}</div>
      </div>
      <div>
        <div class="label-sm">Ränge</div>
        <div class="rank-list">${RANKS.map((r) => `
          <div class="rank-row ${x.level >= r.from ? 'got' : ''} ${r === rank ? 'now' : ''}" style="--r:${r.color}">
            <span class="rank-ico">${icon(x.level >= r.from ? r.icon : 'lock')}</span>
            <span class="rank-name">${r.name}</span><span class="rank-from">ab Level ${r.from}</span>
          </div>`).join('')}</div>
      </div>
    </div>`, 'wide');
}

function levelAction(a) {
  if (a === 'level-open') { openLevelPanel(); return true; }
  return false;
}
