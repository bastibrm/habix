'use strict';

/* Level und Ränge. XP werden immer aus den gespeicherten Daten berechnet, damit nichts doppelt zählt
   (z. B. durch An- und Abhaken). Ein Aufstieg wird einmal gefeiert und in state.levelSeen und state.rankSeen gemerkt.
   Arbeit und Finanzen zählen bewusst nicht mit, Fitness schon (Trainings, Cardio, Ernährung und Erfolge).
   Für jeden Rang braucht es zwei Dinge: das Level und eine bestandene Rangprüfung (z. B. 5 perfekte Tage am Stück).
   Dazu gibt es jede Woche eine Wochenaufgabe mit Bonus-XP. */

const XP = { habit: 10, perfect: 20, task: 8, taskPrio: 4, mood: 3 };
const BADGE_XP = { 7: 50, 30: 150, 66: 300, 100: 500, 365: 1500 };

// trial: [Kennzahl, Ziel, Text]. Kennzahlen: perfect (perfekte Tage insgesamt), run (perfekte Tage am Stück),
// streak (längste Serie einer Gewohnheit), tasks (erledigte Aufgaben)
const RANKS = [
  { from: 1, name: 'Rookie', en: 'Rookie', icon: 'sprout', color: '#9aa7b6', text: 'Frisch dabei. Die ersten Häkchen zählen am meisten.', textEn: 'Fresh in the game. The first ticks count the most.' },
  { from: 4, name: 'Grinder', en: 'Grinder', icon: 'dumbbell', color: '#b9895f', text: 'Du ziehst es jeden Tag durch, auch wenn es mal zäh ist.', textEn: 'You push through every day, even when it gets tough.' },
  { from: 8, name: 'Hustler', en: 'Hustler', icon: 'rocket', color: '#3fc6f2', trial: ['perfect', 3], text: 'Kein langes Überlegen. Du machst einfach.', textEn: 'No overthinking. You just get it done.' },
  { from: 12, name: 'Macher', en: 'Doer', icon: 'hammer', color: '#ff9d4d', trial: ['streak', 7], text: 'Du redest nicht, du lieferst.', textEn: 'You don’t talk, you deliver.' },
  { from: 16, name: 'Maschine', en: 'Machine', icon: 'cog', color: '#7f9cff', trial: ['perfect', 10], text: 'Deine Routine läuft wie von selbst.', textEn: 'Your routine runs on its own.' },
  { from: 20, name: 'Beast', en: 'Beast', icon: 'flame', color: '#ff6b4a', trial: ['run', 5], text: 'Die erste richtige Serie. Jetzt bist du nicht mehr aufzuhalten.', textEn: 'Your first real streak. Now nothing can hold you back.' },
  { from: 25, name: 'Boss', en: 'Boss', icon: 'crown', color: '#f2b84b', trial: ['tasks', 30], text: 'Du hast deinen Tag im Griff, nicht er dich.', textEn: 'You run your day, not the other way round.' },
  { from: 30, name: 'Elite', en: 'Elite', icon: 'shield', color: '#4fd6a4', trial: ['streak', 30], text: 'Du gehörst zu den wenigen, die so lange dranbleiben.', textEn: 'You are one of the few who stick with it this long.' },
  { from: 36, name: 'Champion', en: 'Champion', icon: 'medal', color: '#5fa8ff', trial: ['perfect', 50], text: '50 perfekte Tage. Das ist Meisterschaftsniveau.', textEn: '50 perfect days. That is championship level.' },
  { from: 42, name: 'Ikone', en: 'Icon', icon: 'star', color: '#ff7ab6', trial: ['run', 14], text: 'Andere schauen zu dir hoch.', textEn: 'Others look up to you.' },
  { from: 50, name: 'Titan', en: 'Titan', icon: 'mountain', color: '#34c2a0', trial: ['streak', 66], text: 'Kaum noch zu stoppen. Deine Gewohnheiten stehen wie ein Berg.', textEn: 'Almost unstoppable. Your habits stand like a mountain.' },
  { from: 60, name: 'Juggernaut', en: 'Juggernaut', icon: 'zap', color: '#e0c341', trial: ['perfect', 120], text: 'Du rollst einfach durch, egal was kommt.', textEn: 'You roll right through, whatever comes.' },
  { from: 70, name: 'Legende', en: 'Legend', icon: 'sparkles', color: '#9585ff', trial: ['streak', 100], text: 'Hundert Tage am Stück. Darüber erzählt man sich Geschichten.', textEn: 'A hundred days in a row. People tell stories about this.' },
  { from: 85, name: 'GOAT', en: 'GOAT', icon: 'trophy', color: '#ffb547', trial: ['run', 30], text: 'Greatest of all time. Ein ganzer Monat ohne einen einzigen Fehltag.', textEn: 'Greatest of all time. A whole month without a single miss.' },
  { from: 100, name: 'Unsterblich', en: 'Immortal', icon: 'infinity', color: '#c48bff', trial: ['streak', 365], text: 'Ein ganzes Jahr ohne Lücke. Das schafft fast niemand.', textEn: 'A whole year without a gap. Almost nobody gets here.' },
];
const TRIAL_TEXT = {
  perfect: (n) => dt(`${n} perfekte Tage insgesamt`, `${n} perfect days in total`),
  run: (n) => dt(`${n} perfekte Tage am Stück`, `${n} perfect days in a row`),
  streak: (n) => dt(`Eine Gewohnheit ${n} Tage am Stück`, `One habit ${n} days in a row`),
  tasks: (n) => dt(`${n} Aufgaben erledigt`, `${n} tasks done`),
};
const rankName = (r) => dt(r.name, r.en);
const trialOk = (r, st) => !r.trial || st[r.trial[0]] >= r.trial[1];

// Wochenaufgaben, jede Woche eine andere (für alle gleich, damit vergangene Wochen fest bleiben)
const WEEKLY = [
  { id: 'perfect', xp: 60, de: 'Schaff 4 perfekte Tage', en: 'Have 4 perfect days' },
  { id: 'mood', xp: 40, de: 'Trag an 6 Tagen deine Stimmung ein', en: 'Log your mood on 6 days' },
  { id: 'rate', xp: 70, de: 'Schaff 90 % deiner Gewohnheiten der Woche', en: 'Complete 90% of this week’s habits' },
  { id: 'tasks', xp: 50, de: 'Erledige 8 Aufgaben', en: 'Finish 8 tasks' },
  { id: 'half', xp: 50, de: 'Jeden Tag mindestens die Hälfte schaffen', en: 'Do at least half every day' },
];
const weekIndex = (monday) => Math.round((parseKey(monday) - parseKey('2024-01-01')) / 604800000);
const weeklyOf = (monday) => WEEKLY[((weekIndex(monday) % WEEKLY.length) + WEEKLY.length) % WEEKLY.length];

function weeklyProgress(monday) {
  const w = weeklyOf(monday);
  const today = todayKey();
  const sunday = addDays(monday, 6);
  const days = range(monday, sunday < today ? sunday : today);
  const hs = state.habits;
  let have = 0, need = 1;
  if (w.id === 'perfect') { need = 4; have = days.filter((k) => dayRate(k, hs) === 1).length; }
  if (w.id === 'mood') { need = 6; have = days.filter((k) => state.journal[k]?.mood).length; }
  if (w.id === 'tasks') { need = 8; have = state.tasks.filter((t) => t.done && t.doneAt && keyOf(new Date(t.doneAt)) >= monday && keyOf(new Date(t.doneAt)) <= sunday).length; }
  if (w.id === 'rate') { const p = periodRate(monday, sunday, hs); need = Math.max(1, Math.ceil(p.scheduled * 0.9)); have = p.done; }
  if (w.id === 'half') {
    need = 7;
    // Tage ohne geplante Gewohnheit zählen als geschafft
    have = days.filter((k) => { const r = dayRate(k, hs); return r === null || r >= 0.5; }).length;
  }
  return { ...w, have: Math.min(have, need), need, done: have >= need, monday };
}

// XP, die man für den Schritt von Level n auf n+1 braucht. Ab Level 25 wird es spürbar steiler.
const xpForLevel = (n) => 80 + 20 * n + (n > 25 ? Math.round((n - 25) ** 2 / 2) : 0);

function levelFromXp(xp) {
  let level = 1, rest = xp;
  while (rest >= xpForLevel(level)) { rest -= xpForLevel(level); level++; }
  return { level, into: rest, need: xpForLevel(level) };
}

// Höchster Rang, für den Level und alle Prüfungen bis dahin reichen
function rankIndexOf(level, st) {
  let i = 0;
  while (i + 1 < RANKS.length && level >= RANKS[i + 1].from && trialOk(RANKS[i + 1], st)) i++;
  return i;
}
const rankOf = (level) => RANKS[rankIndexOf(level, computeXp().stats)];

let xpCache = null;
function computeXp() {
  if (xpCache) return xpCache;
  const parts = { habits: 0, perfect: 0, badges: 0, tasks: 0, mood: 0, weekly: 0, fitness: 0 };
  const stats = { perfect: 0, run: 0, streak: 0, tasks: 0, challenges: 0, chWeeks: 0 };
  const today = todayKey();
  // Gewohnheiten (abgehakt oder Menge erreicht)
  for (const h of state.habits) {
    for (const k of Object.keys(state.log)) if (state.log[k].includes(h.id) && !isAmount(h)) parts.habits += XP.habit;
    if (isAmount(h)) for (const k of Object.keys(state.amounts)) if ((state.amounts[k][h.id] || 0) >= h.target) parts.habits += XP.habit;
    for (const d of Object.keys(state.badges[h.id] || {})) parts.badges += BADGE_XP[d] || 0;
    stats.streak = Math.max(stats.streak, bestStreak(h));
  }
  // Perfekte Tage, dazu die längste Folge (Tage ohne geplante Gewohnheit unterbrechen nicht, ein offener heutiger Tag auch nicht)
  const first = state.habits.length ? state.habits.map((h) => h.createdAt).sort()[0] : null;
  if (first) {
    let run = 0;
    for (const k of range(first, today)) {
      const r = dayRate(k, state.habits);
      if (r === 1) { parts.perfect += XP.perfect; stats.perfect++; run++; stats.run = Math.max(stats.run, run); }
      else if (r !== null && k !== today) run = 0;
    }
    // Wochenaufgaben aller Wochen seit Beginn
    const chFrom = typeof chStart === 'function' ? chStart() : '9999';
    for (let m = mondayOf(first); m <= today; m = addDays(m, 7)) {
      if (m >= chFrom) { const c = challengeWeek(m); parts.weekly += c.xp; stats.challenges += c.done; if (c.all) stats.chWeeks++; continue; }
      const w = weeklyProgress(m); if (w.done) parts.weekly += w.xp;
    }
  }
  // Aufgaben und Stimmung
  for (const t of state.tasks) if (t.done) { parts.tasks += XP.task + (t.prio ? XP.taskPrio : 0); stats.tasks++; }
  for (const k of Object.keys(state.journal)) if (state.journal[k].mood) parts.mood += XP.mood;
  if (typeof fitnessXp === 'function') parts.fitness = fitnessXp();
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  const lv = levelFromXp(total);
  const ri = rankIndexOf(lv.level, stats);
  xpCache = { total, parts, stats, ...lv, rankIndex: ri, rank: RANKS[ri], nextRank: RANKS[ri + 1] || null };
  return xpCache;
}

function rankBadge(rank, level, size = '') {
  return `<span class="rank-badge ${size}" style="--r:${rank.color}">${icon(rank.icon)}<b>${level}</b></span>`;
}

function renderLevelCard() {
  const el = document.getElementById('level-card');
  if (!el) return;
  const x = computeXp();
  const rank = x.rank;
  const share = x.into / x.need;
  const cos = typeof cosmeticNow === 'function' ? cosmeticNow() : { color: null, title: null };
  el.style.setProperty('--r', cos.color?.color || rank.color);
  el.classList.toggle('cos-rainbow', cos.color?.id === 'rainbow');
  el.style.setProperty('--deg', `${Math.round(share * 360)}deg`);
  // Ist Fitness an, stehen oben zwei Level: dieses heißt dann „Gesamt“, damit man sie auseinanderhält
  const fitOn = !!state.fitness?.enabled;
  el.title = `${fitOn ? `${dt('Gesamt-Level', 'Overall level')}: ` : ''}${rankName(rank)}${cos.title ? ` · ${dt(`„${cosName(cos.title)}“`, `“${cosName(cos.title)}”`)}` : ''} · Level ${x.level} · ${x.into} / ${x.need} XP`;
  el.setAttribute('aria-label', el.title);
  // Inhalt nur beim Rangwechsel neu bauen, damit das Symbol nicht flackert
  const key = `${rank.name}|${state.settings?.lang}|${fitOn}|${cos.title?.id || ''}`;
  if (el.dataset.rank !== key) {
    el.dataset.rank = key;
    el.innerHTML = `
      <span class="lv-ring"><span class="lv-ico">${icon(rank.icon)}</span></span>
      ${fitOn ? `<span class="lv-tag">${icon('sparkles')}${dt('Gesamt', 'Overall')}</span>` : ''}
      <span class="lv-txt"><b id="lv-level"></b><small>${cos.title ? esc(cosName(cos.title)) : rankName(rank)}</small></span>
      <span class="lv-xp" id="lv-xp"></span>`;
    lucide.createIcons();
  }
  document.getElementById('lv-level').textContent = `Level ${x.level}`;
  document.getElementById('lv-xp').textContent = `${x.into} / ${x.need} XP`;
  if (typeof renderFitLevelPill === 'function') renderFitLevelPill();
  if (typeof layoutThought === 'function') requestAnimationFrame(() => layoutThought(undefined, true));
}

// Nach jeder Änderung: neu rechnen, Seitenleiste aktualisieren, Aufstieg feiern
let levelTimer = null;
function onDataChanged() {
  xpCache = null;
  if (typeof fitLvCache !== 'undefined') fitLvCache = null;
  clearTimeout(levelTimer);
  levelTimer = setTimeout(checkLevelUp, 350);
}

function checkLevelUp() {
  if (typeof fitAchCheck === 'function') fitAchCheck();
  if (typeof fitLevelCheck === 'function') fitLevelCheck();
  if (typeof rewardsCheck === 'function') rewardsCheck();
  const x = computeXp();
  renderLevelCard();
  // Erster Start (oder erstes Mal mit Rangprüfungen): still übernehmen
  if (!state.levelSeen || state.rankSeen == null) { state.levelSeen = Math.max(state.levelSeen || 0, x.level); state.rankSeen = x.rankIndex; save(); return; }
  const newRank = x.rankIndex > state.rankSeen;
  if (x.level <= state.levelSeen && !newRank) return;
  state.levelSeen = Math.max(state.levelSeen, x.level);
  state.rankSeen = Math.max(state.rankSeen, x.rankIndex);
  save();
  const pill = document.getElementById('level-card');
  pill?.classList.remove('level-up');
  void pill?.offsetWidth;
  pill?.classList.add('level-up');
  if (state.demo || ui.modal || ui.panel) { toast(newRank ? dt(`Neuer Rang: ${rankName(x.rank)}`, `New rank: ${rankName(x.rank)}`) : `Level ${x.level} erreicht!`); return; }
  const rank = x.rank;
  // Level reicht, aber die Prüfung fehlt noch: beim Aufstieg darauf hinweisen
  const blocked = !newRank && x.nextRank && x.level >= x.nextRank.from;
  openPanel(`
    <div class="celebrate">
      <div class="big-rank" style="--r:${rank.color}">${icon(rank.icon)}<b>${x.level}</b></div>
      <div class="eyebrow">${newRank ? dt('Prüfung bestanden · Neuer Rang', 'Trial passed · New rank') : 'Level aufgestiegen'}</div>
      <h2 class="panel-title">${newRank ? rankName(rank) : `Level ${x.level}`}</h2>
      <p>${newRank ? dt(rank.text, rank.textEn) : blocked
        ? dt(`Für den Rang ${x.nextRank.name} fehlt dir noch die Prüfung: ${TRIAL_TEXT[x.nextRank.trial[0]](x.nextRank.trial[1])}.`, `To become ${x.nextRank.en} you still need to pass the trial: ${TRIAL_TEXT[x.nextRank.trial[0]](x.nextRank.trial[1])}.`)
        : `Weiter so. Noch ${x.need - x.into} XP bis Level ${x.level + 1}.`}</p>
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

// Wochen-Challenges als Block (Level-Fenster, Startseite); der Code dazu steht in rewards.js
const weeklyBlock = (compact = false) => challengesBlock(compact);

function openLevelPanel() {
  const x = computeXp();
  const rank = x.rank, next = x.nextRank;
  const rows = [
    ['list-checks', 'Gewohnheit erledigt', `+${XP.habit}`, x.parts.habits],
    ['flame', 'Perfekter Tag', `+${XP.perfect}`, x.parts.perfect],
    ['award', 'Abzeichen (7 bis 365 Tage)', '+50 bis +1500', x.parts.badges],
    ['swords', dt('Wochen-Challenges', 'Weekly challenges'), dt('+30 bis +80', '+30 to +80'), x.parts.weekly],
    ['list-todo', 'Aufgabe erledigt', `+${XP.task}, wichtig +${XP.task + XP.taskPrio}`, x.parts.tasks],
    ['smile', 'Stimmung eingetragen', `+${XP.mood}`, x.parts.mood],
    ...(state.fitness?.enabled ? [['dumbbell', 'Fitness: Training, Cardio, Erfolge', '+2 bis +400', x.parts.fitness]] : []),
  ];
  const trialLine = (r) => {
    if (!r.trial) return '';
    const [k, n] = r.trial, have = Math.min(x.stats[k], n);
    return `<span class="rank-trial ${have >= n ? 'ok' : ''}">${icon(have >= n ? 'check' : 'swords')}${TRIAL_TEXT[k](n)}${have < n ? ` · ${have} / ${n}` : ''}</span>`;
  };
  let nextLine = '';
  if (next) {
    const lvOk = x.level >= next.from;
    nextLine = lvOk
      ? dt(`Nächster Rang ${next.name}: Level erreicht, jetzt fehlt die Prüfung`, `Next rank ${next.en}: level reached, now pass the trial`)
      : dt(`${next.name} ab Level ${next.from}`, `${next.en} from level ${next.from}`);
  }
  openPanel(`
    <div class="card-head">
      <div><div class="eyebrow">Dein Fortschritt</div><h2 class="panel-title" style="font-size:22px">Level und Rang</h2></div>
      <div class="btn-row"><button class="btn small" data-action="showcase-open">${icon('gem')}${dt('Vitrine', 'Showcase')}</button>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    </div>
    <div class="lv-hero" style="--r:${rank.color}">
      ${rankBadge(rank, x.level, 'big')}
      <div class="lv-hero-text">
        <b>${rankName(rank)}${typeof cosTitleChip === 'function' ? cosTitleChip() : ''}</b>
        <span>Level ${x.level} · insgesamt ${num(x.total)} XP</span>
        <div class="meter"><span data-anim="w" style="width:${(x.into / x.need) * 100}%"></span></div>
        <small>${dt(`Noch ${x.need - x.into} XP bis Level ${x.level + 1}`, `${x.need - x.into} XP to level ${x.level + 1}`)}${nextLine ? ` · ${nextLine}` : ''}</small>
      </div>
    </div>
    ${weeklyBlock()}
    <div class="lv-cols">
      <div>
        <div class="label-sm">So sammelst du XP</div>
        <div class="xp-list">${rows.map(([ic, l, v, sum]) => `<div class="xp-row">${icon(ic)}<span>${l}</span><em>${v}</em><b>${num(sum)}</b></div>`).join('')}</div>
        <div class="setting-note lv-note">${icon('info')}<span>${dt('Für jeden neuen Rang brauchst du das Level und eine bestandene Prüfung. Ab Level 25 brauchen die Level etwas mehr XP.', 'Each new rank needs the level and a passed trial. From level 25, levels need a bit more XP.')}</span></div>
      </div>
      <div>
        <div class="label-sm">${dt(`Ränge · ${x.rankIndex + 1} von ${RANKS.length}`, `Ranks · ${x.rankIndex + 1} of ${RANKS.length}`)}</div>
        <div class="rank-list">${RANKS.map((r, i) => {
          const got = i <= x.rankIndex;
          return `
          <div class="rank-row ${got ? 'got' : ''} ${i === x.rankIndex ? 'now' : ''} ${i === x.rankIndex + 1 ? 'next' : ''}" style="--r:${r.color}">
            <span class="rank-ico">${icon(got ? r.icon : 'lock')}</span>
            <span class="rank-name">${rankName(r)}${!got ? trialLine(r) : ''}</span><span class="rank-from">${dt(`ab Level ${r.from}`, `from level ${r.from}`)}</span>
          </div>`;
        }).join('')}</div>
      </div>
    </div>`, 'wide');
}

function levelAction(a) {
  if (a === 'level-open') { openLevelPanel(); return true; }
  return false;
}
