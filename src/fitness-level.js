'use strict';

/* Eigenes Fitness-Level: XP nur aus dem Fitness-Bereich, eigene Ränge mit Prüfungen.
   Wie beim Haupt-Level wird alles aus den gespeicherten Daten berechnet, damit nichts doppelt zählt.
   Ein Aufstieg wird einmal gefeiert und in state.fitness.lvSeen und state.fitness.rankSeen gemerkt.
   Das Haupt-Level bekommt seinen Fitness-Anteil weiterhin über fitnessXp(). */

const FXP = { workout: 30, set: 1, pr: 15, cardio: 10, cardio10: 1, steps: 8, food: 6, kcal: 8, protein: 6, water: 4, sleep: 2, sleep7: 4, weight: 2, fast: 10, week: 60 };

// trial: [Kennzahl, Ziel]. Kennzahlen: workouts, weeks (Wochen mit Wochenziel), weekRun (am Stück), prs, cardio, tons
const FIT_RANKS = [
  { from: 1, name: 'Neuling', en: 'Newbie', icon: 'sprout', color: '#9aa7b6', text: 'Jeder fängt mal an. Das erste Training zählt am meisten.', textEn: 'Everyone starts somewhere. The first workout counts the most.' },
  { from: 4, name: 'Gym-Gänger', en: 'Gym Goer', icon: 'dumbbell', color: '#b9895f', trial: ['workouts', 5], text: 'Das Gym kennt dich jetzt beim Namen.', textEn: 'The gym knows your name now.' },
  { from: 8, name: 'Athlet', en: 'Athlete', icon: 'activity', color: '#3fc6f2', trial: ['weeks', 2], text: 'Training ist kein Vorsatz mehr, sondern Plan.', textEn: 'Training is no longer a resolution, it is a plan.' },
  { from: 12, name: 'Kraftpaket', en: 'Powerhouse', icon: 'biceps-flexed', color: '#ff9d4d', trial: ['prs', 5], text: 'Die Gewichte gehen hoch. Du wirst stärker, Woche für Woche.', textEn: 'The weights keep going up. You get stronger week by week.' },
  { from: 16, name: 'Ausdauer-Ass', en: 'Endurance Ace', icon: 'heart-pulse', color: '#ff6b8a', trial: ['cardio', 10], text: 'Kraft und Ausdauer. Dir geht so schnell nicht die Puste aus.', textEn: 'Strength and stamina. You do not run out of breath easily.' },
  { from: 20, name: 'Eisenkrieger', en: 'Iron Warrior', icon: 'swords', color: '#7f9cff', trial: ['workouts', 50], text: '50 Trainings. Das Eisen hat Respekt vor dir.', textEn: '50 workouts. The iron respects you.' },
  { from: 25, name: 'Spartaner', en: 'Spartan', icon: 'shield', color: '#4fd6a4', trial: ['weekRun', 4], text: 'Einen ganzen Monat jede Woche geliefert. Disziplin pur.', textEn: 'Delivered every week for a whole month. Pure discipline.' },
  { from: 30, name: 'Biest', en: 'Beast', icon: 'flame', color: '#ff6b4a', trial: ['tons', 100], text: '100 Tonnen bewegt. Das ist mehr als ein Blauwal wiegt.', textEn: '100 tonnes moved. That is more than a blue whale weighs.' },
  { from: 36, name: 'Titan', en: 'Titan', icon: 'mountain', color: '#34c2a0', trial: ['workouts', 150], text: 'Dein Training steht wie ein Berg.', textEn: 'Your training stands like a mountain.' },
  { from: 42, name: 'Olympionike', en: 'Olympian', icon: 'medal', color: '#5fa8ff', trial: ['weekRun', 12], text: 'Ein Vierteljahr ohne eine verpasste Woche. Wettkampfniveau.', textEn: 'A quarter year without missing a week. Competition level.' },
  { from: 50, name: 'Legende', en: 'Legend', icon: 'trophy', color: '#ffb547', trial: ['workouts', 300], text: '300 Trainings. Im Gym erzählt man sich von dir.', textEn: '300 workouts. People at the gym talk about you.' },
  { from: 60, name: 'Halbgott', en: 'Demigod', icon: 'zap', color: '#e0c341', trial: ['weekRun', 26], text: 'Ein halbes Jahr jede Woche. Fast nicht mehr menschlich.', textEn: 'Every week for half a year. Barely human anymore.' },
  { from: 75, name: 'Unbesiegbar', en: 'Unbreakable', icon: 'crown', color: '#c48bff', trial: ['weekRun', 52], text: 'Ein ganzes Jahr ohne Lücke. Dich hält nichts mehr auf.', textEn: 'A whole year without a gap. Nothing can stop you now.' },
];
const FIT_TRIAL = {
  workouts: (n) => dt(`${n} Trainings beendet`, `${n} workouts finished`),
  weeks: (n) => dt(`In ${n} Wochen das Wochenziel geschafft`, `Weekly goal reached in ${n} weeks`),
  weekRun: (n) => dt(`${n} Wochen am Stück das Wochenziel geschafft`, `Weekly goal ${n} weeks in a row`),
  prs: (n) => dt(`${n} neue Bestleistungen`, `${n} new personal bests`),
  cardio: (n) => dt(`${n} Cardio-Einheiten`, `${n} cardio sessions`),
  tons: (n) => dt(`${n} Tonnen insgesamt bewegt`, `${n} tonnes moved in total`),
};
const fitRankName = (r) => dt(r.name, r.en);
const fitTrialOk = (r, st) => !r.trial || st[r.trial[0]] >= r.trial[1];

// XP für den Schritt von Level n auf n+1, ab Level 25 etwas steiler
const fitXpForLevel = (n) => 60 + 15 * n + (n > 25 ? Math.round((n - 25) ** 2 / 2) : 0);
function fitLevelFromXp(xp) {
  let level = 1, rest = xp;
  while (rest >= fitXpForLevel(level)) { rest -= fitXpForLevel(level); level++; }
  return { level, into: rest, need: fitXpForLevel(level) };
}
function fitRankIndexOf(level, st) {
  let i = 0;
  while (i + 1 < FIT_RANKS.length && level >= FIT_RANKS[i + 1].from && fitTrialOk(FIT_RANKS[i + 1], st)) i++;
  return i;
}

// XP-Anteile ab einem Tag (from = null: alles). Erfolge zählen nur insgesamt, nicht pro Woche.
function fitXpParts(from = null) {
  const f = fit();
  const g = needs();
  const today = todayKey();
  const inRange = (k) => !from || k >= from;
  const parts = { training: 0, prs: 0, cardio: 0, food: 0, body: 0, weeks: 0, ach: 0 };
  const st = { workouts: 0, prs: 0, cardio: 0, weeks: 0, weekRun: 0, tons: 0 };
  for (const w of f.workouts) {
    st.tons += volumeOf(w) / 1000;
    if (!inRange(w.date)) continue;
    st.workouts++;
    parts.training += FXP.workout + Math.min(30, doneSets(w)) * FXP.set;
  }
  // Bestleistung: eine Übung übertrifft ihr bisher bestes geschätztes Maximum um mindestens 1 % (das erste Mal zählt nicht)
  const names = new Set(f.workouts.flatMap((w) => w.exercises.map((e) => e.name.trim().toLowerCase())));
  for (const n of names) {
    let best = 0, first = true;
    for (const h of exerciseHistory(n)) {
      if (!first && h.orm > best * 1.01 && inRange(h.date)) st.prs++;
      best = Math.max(best, h.orm);
      first = false;
    }
  }
  parts.prs = st.prs * FXP.pr;
  for (const c of f.cardio) if (inRange(c.date)) { st.cardio++; parts.cardio += FXP.cardio + Math.floor((c.min || 0) / 10) * FXP.cardio10; }
  for (const [k, v] of Object.entries(f.steps)) if (inRange(k) && v >= f.stepGoal) parts.cardio += FXP.steps;
  for (const [k, list] of Object.entries(f.food)) {
    if (!inRange(k) || !list.length) continue;
    if (list.length >= 3) parts.food += FXP.food;
    if (sumOf(list, 'p') >= g.p) parts.food += FXP.protein;
    // Kalorienziel nur für abgeschlossene Tage, sonst springt es über den Tag hin und her
    const goal = goalFor(k);
    if (k < today && list.length >= 3 && Math.abs(kcalOf(list) - goal) <= goal * 0.1) parts.food += FXP.kcal;
  }
  for (const [k, ml] of Object.entries(f.water)) if (inRange(k) && ml >= g.water) parts.food += FXP.water;
  for (const [k, s] of Object.entries(f.sleep)) if (inRange(k)) parts.body += FXP.sleep + (s.h >= 7 ? FXP.sleep7 : 0);
  parts.body += Object.keys(f.weights).filter(inRange).length * FXP.weight;
  parts.body += f.fasting.log.filter((x) => inRange(keyOf(new Date(x.end))) && (Date.parse(x.end) - Date.parse(x.start)) / 3600000 >= x.goal).length * FXP.fast;
  // Wochenziele: jede geschaffte Woche, dazu die längste Folge am Stück (die laufende Woche unterbricht nicht)
  const set = activeSet();
  if (set.size) {
    const now = thisMonday();
    let run = 0;
    for (let m = mondayOf([...set].sort()[0]); m <= now; m = addDays(m, 7)) {
      const need = weekNeed(m, f.weekGoal);
      if (need === null) continue;
      if (activeDays(m, addDays(m, 6), set) >= need) {
        run++;
        st.weekRun = Math.max(st.weekRun, run);
        if (inRange(m)) { st.weeks++; parts.weeks += FXP.week; }
      } else if (m !== now) run = 0;
    }
  }
  if (!from) parts.ach = achievements().filter((a) => a.done).reduce((a, b) => a + b.xp, 0);
  return { parts, st, total: Object.values(parts).reduce((a, b) => a + b, 0) };
}

// Wird in onDataChanged (levels.js) zurückgesetzt
let fitLvCache = null;
function computeFitLevel() {
  if (fitLvCache) return fitLvCache;
  const all = fitXpParts();
  const week = fitXpParts(thisMonday()).total;
  const lv = fitLevelFromXp(all.total);
  const ri = fitRankIndexOf(lv.level, all.st);
  fitLvCache = { ...all, week, ...lv, rankIndex: ri, rank: FIT_RANKS[ri], nextRank: FIT_RANKS[ri + 1] || null };
  return fitLvCache;
}

// Zeile unter dem Balken: was als Nächstes kommt
function fitNextLine(x) {
  const next = x.nextRank;
  const toLevel = dt(`Noch ${fmtNum(x.need - x.into)} XP bis Level ${x.level + 1}`, `${fmtNum(x.need - x.into)} XP to level ${x.level + 1}`);
  if (!next) return toLevel;
  if (x.level < next.from) return `${toLevel} · ${dt(`${next.name} ab Level ${next.from}`, `${next.en} from level ${next.from}`)}`;
  const [k, n] = next.trial;
  return `${toLevel} · ${dt(`Prüfung für ${next.name}`, `Trial for ${next.en}`)}: ${FIT_TRIAL[k](n)} (${fmtNum(Math.min(Math.floor(x.st[k]), n))} / ${fmtNum(n)})`;
}

/* ================= Anzeige oben neben dem Gesamt-Level ================= */

// Nur sichtbar, wenn der Fitness-Bereich an ist. Das Schild „Fitness“ mit Hantel unterscheidet sie vom Gesamt-Level.
function renderFitLevelPill() {
  const el = document.getElementById('fit-level-card');
  if (!el) return;
  if (!state.fitness?.enabled) { el.hidden = true; el.dataset.rank = ''; return; }
  el.hidden = false;
  const x = computeFitLevel();
  const r = x.rank;
  el.style.setProperty('--r', r.color);
  el.style.setProperty('--deg', `${Math.round((x.into / x.need) * 360)}deg`);
  el.title = `${dt('Fitness-Level', 'Fitness level')}: ${fitRankName(r)} · Level ${x.level} · ${x.into} / ${x.need} XP`;
  el.setAttribute('aria-label', el.title);
  const key = `${r.name}|${state.settings?.lang}`;
  if (el.dataset.rank !== key) {
    el.dataset.rank = key;
    el.innerHTML = `
      <span class="lv-ring"><span class="lv-ico">${icon(r.icon)}</span></span>
      <span class="lv-tag">${icon('dumbbell')}Fitness</span>
      <span class="lv-txt"><b class="fit-lv-level"></b><small>${fitRankName(r)}</small></span>
      <span class="lv-xp fit-lv-xp"></span>`;
    lucide.createIcons();
  }
  el.querySelector('.fit-lv-level').textContent = `Level ${x.level}`;
  el.querySelector('.fit-lv-xp').textContent = `${x.into} / ${x.need} XP`;
}

/* ================= Karte auf der Fitness-Übersicht ================= */

function fitLevelCard() {
  const x = computeFitLevel();
  const r = x.rank;
  return `
  <article class="card s12 fade-in fit-lv-card" style="--r:${r.color}">
    <button class="fit-lv-badge" data-action="fit-level" aria-label="${dt('Fitness-Level ansehen', 'View fitness level')}">${rankBadge(r, x.level, 'big')}</button>
    <div class="fit-lv-text">
      <div class="eyebrow">${dt('Fitness-Level', 'Fitness level')}</div>
      <b>${fitRankName(r)} <span>· Level ${x.level}</span></b>
      <div class="meter"><span data-anim="w" style="width:${(x.into / x.need) * 100}%"></span></div>
      <small>${esc(fitNextLine(x))}</small>
    </div>
    <div class="fit-lv-stats">
      <div><b>+${num(x.week)}</b><small>${dt('XP diese Woche', 'XP this week')}</small></div>
      <div><b>${num(x.st.prs)}</b><small>${dt('Bestleistungen', 'Personal bests')}</small></div>
      <div><b>${num(weekStreaks().cur)}</b><small>${dt('Wochen in Folge', 'Weeks in a row')}</small></div>
    </div>
    <button class="btn small" data-action="fit-level">${icon('chevrons-up')}<span>${dt('Ränge und XP', 'Ranks and XP')}</span></button>
  </article>`;
}

function openFitLevel() {
  const x = computeFitLevel();
  const r = x.rank;
  const p = x.parts;
  const rows = [
    ['dumbbell', dt('Training beendet', 'Workout finished'), dt(`+${FXP.workout}, +${FXP.set} je Satz`, `+${FXP.workout}, +${FXP.set} per set`), p.training],
    ['trophy', dt('Neue Bestleistung', 'New personal best'), `+${FXP.pr}`, p.prs],
    ['calendar-check', dt('Wochenziel geschafft', 'Weekly goal reached'), `+${FXP.week}`, p.weeks],
    ['heart-pulse', dt('Cardio und Schritte', 'Cardio and steps'), dt(`+${FXP.cardio} (+1 je 10 min), Schrittziel +${FXP.steps}`, `+${FXP.cardio} (+1 per 10 min), step goal +${FXP.steps}`), p.cardio],
    ['apple', dt('Ernährung und Wasser', 'Nutrition and water'), dt(`Tag eingetragen +${FXP.food}, Kalorienziel +${FXP.kcal}, Eiweiß +${FXP.protein}, Trinkziel +${FXP.water}`, `Day logged +${FXP.food}, calorie goal +${FXP.kcal}, protein +${FXP.protein}, water goal +${FXP.water}`), p.food],
    ['moon', dt('Schlaf, Gewicht, Fasten', 'Sleep, weight, fasting'), dt(`Schlaf +${FXP.sleep} (ab 7 h +${FXP.sleep + FXP.sleep7}), Gewicht +${FXP.weight}, Fasten +${FXP.fast}`, `Sleep +${FXP.sleep} (7 h+ +${FXP.sleep + FXP.sleep7}), weight +${FXP.weight}, fast +${FXP.fast}`), p.body],
    ['award', dt('Erfolge', 'Achievements'), '+25 bis +400', p.ach],
  ];
  const trialLine = (rk) => {
    if (!rk.trial) return '';
    const [k, n] = rk.trial, have = Math.min(Math.floor(x.st[k]), n);
    return `<span class="rank-trial ${have >= n ? 'ok' : ''}">${icon(have >= n ? 'check' : 'swords')}${FIT_TRIAL[k](n)}${have < n ? ` · ${fmtNum(have)} / ${fmtNum(n)}` : ''}</span>`;
  };
  openPanel(`
    <div class="card-head">
      <div><div class="eyebrow">Fitness</div><h2 class="panel-title" style="font-size:22px">${dt('Fitness-Level und Ränge', 'Fitness level and ranks')}</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="${dt('Schließen', 'Close')}">${icon('x')}</button>
    </div>
    <div class="lv-hero fit-lv-hero" style="--r:${r.color}">
      ${rankBadge(r, x.level, 'big')}
      <div class="lv-hero-text">
        <b>${fitRankName(r)}</b>
        <span>Level ${x.level} · ${dt(`insgesamt ${fmtNum(x.total)} XP · diese Woche +${fmtNum(x.week)}`, `${fmtNum(x.total)} XP in total · +${fmtNum(x.week)} this week`)}</span>
        <div class="meter"><span data-anim="w" style="width:${(x.into / x.need) * 100}%"></span></div>
        <small>${esc(fitNextLine(x))}</small>
      </div>
    </div>
    <div class="lv-cols">
      <div>
        <div class="label-sm">${dt('So sammelst du Fitness-XP', 'How you earn fitness XP')}</div>
        <div class="xp-list">${rows.map(([ic, l, v, sum]) => `<div class="xp-row fit-xp-row">${icon(ic)}<span>${l}<small>${v}</small></span><b>${num(sum)}</b></div>`).join('')}</div>
        <div class="setting-note lv-note">${icon('info')}<span>${dt('Das Fitness-Level ist eigenständig. Für jeden neuen Rang brauchst du das Level und eine bestandene Prüfung. Dein Haupt-Level bekommt weiterhin einen Teil der Fitness-XP.', 'The fitness level is separate. Each new rank needs the level and a passed trial. Your main level still gets a share of your fitness XP.')}</span></div>
      </div>
      <div>
        <div class="label-sm">${dt(`Ränge · ${x.rankIndex + 1} von ${FIT_RANKS.length}`, `Ranks · ${x.rankIndex + 1} of ${FIT_RANKS.length}`)}</div>
        <div class="rank-list">${FIT_RANKS.map((rk, i) => {
          const got = i <= x.rankIndex;
          return `
          <div class="rank-row ${got ? 'got' : ''} ${i === x.rankIndex ? 'now' : ''} ${i === x.rankIndex + 1 ? 'next' : ''}" style="--r:${rk.color}">
            <span class="rank-ico">${icon(got ? rk.icon : 'lock')}</span>
            <span class="rank-name">${fitRankName(rk)}${!got ? trialLine(rk) : ''}</span><span class="rank-from">${dt(`ab Level ${rk.from}`, `from level ${rk.from}`)}</span>
          </div>`;
        }).join('')}</div>
      </div>
    </div>`, 'wide');
}

/* ================= Aufstieg feiern ================= */

function fitLevelCheck() {
  const f = state.fitness;
  if (!f?.enabled) return;
  const x = computeFitLevel();
  // Erstes Mal und Beispieldaten: still übernehmen
  if (f.lvSeen == null || f.rankSeen == null || state.demo || f.demo) {
    if (f.lvSeen !== x.level || f.rankSeen !== x.rankIndex) { f.lvSeen = Math.max(f.lvSeen || 0, x.level); f.rankSeen = Math.max(f.rankSeen ?? 0, x.rankIndex); save(); }
    return;
  }
  const newRank = x.rankIndex > f.rankSeen;
  if (x.level <= f.lvSeen && !newRank) return;
  f.lvSeen = Math.max(f.lvSeen, x.level);
  f.rankSeen = Math.max(f.rankSeen, x.rankIndex);
  save();
  const pill = document.getElementById('fit-level-card');
  pill?.classList.remove('level-up');
  void pill?.offsetWidth;
  pill?.classList.add('level-up');
  const r = x.rank;
  if (ui.modal || ui.panel) {
    toast(newRank ? dt(`Neuer Fitness-Rang: ${r.name}`, `New fitness rank: ${r.en}`) : dt(`Fitness-Level ${x.level} erreicht!`, `Fitness level ${x.level} reached!`));
    return;
  }
  const blocked = !newRank && x.nextRank && x.level >= x.nextRank.from;
  openPanel(`
    <div class="celebrate">
      <div class="big-rank" style="--r:${r.color}">${icon(r.icon)}<b>${x.level}</b></div>
      <div class="eyebrow">${newRank ? dt('Fitness · Prüfung bestanden · Neuer Rang', 'Fitness · Trial passed · New rank') : dt('Fitness-Level aufgestiegen', 'Fitness level up')}</div>
      <h2 class="panel-title">${newRank ? fitRankName(r) : dt(`Fitness-Level ${x.level}`, `Fitness level ${x.level}`)}</h2>
      <p>${newRank ? dt(r.text, r.textEn) : blocked
        ? dt(`Für den Rang ${x.nextRank.name} fehlt dir noch die Prüfung: ${FIT_TRIAL[x.nextRank.trial[0]](x.nextRank.trial[1])}.`, `To become ${x.nextRank.en} you still need to pass the trial: ${FIT_TRIAL[x.nextRank.trial[0]](x.nextRank.trial[1])}.`)
        : dt(`Stark. Noch ${fmtNum(x.need - x.into)} XP bis Level ${x.level + 1}.`, `Strong. ${fmtNum(x.need - x.into)} XP to level ${x.level + 1}.`)}</p>
      <button class="btn primary" data-action="close-modal">${dt('Weiter', 'Continue')}</button>
    </div>`, 'narrow');
  confetti();
}

function fitLevelAction(a) {
  if (a === 'fit-level') { openFitLevel(); return true; }
  return false;
}
