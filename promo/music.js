'use strict';

/* Musik und Soundeffekte für das Werbevideo (Version 3), komplett per Code erzeugt (keine fremden Aufnahmen, keine Lizenzfragen).
   Entspannter Chill-Hop: E-Piano, warme Fläche, weicher Bass, lockeres Schlagzeug im halben Tempo, 96 BPM.
   Aufruf: node promo/music.js  → schreibt promo/out/audio.wav */

const fs = require('fs');
const path = require('path');
const TL = require('./timeline.js');

const SR = 44100;
const DUR = TL.duration;
const N = Math.ceil(SR * DUR);
const BEAT = TL.BEAT, BAR = TL.BAR;
const bar = TL.bar;
const music = [new Float32Array(N), new Float32Array(N)];
const sfx = [new Float32Array(N), new Float32Array(N)];
const verbSend = new Float32Array(N);

const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
const TAU = Math.PI * 2;
let seed = 2024;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function put(bus, i, v, pan = 0) {
  if (i < 0 || i >= N) return;
  const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
  bus[0][i] += v * l * 1.414;
  bus[1][i] += v * r * 1.414;
}

/* ================= Aufbau ================= */

// Abschnitte in Takten
const SECTIONS = [
  { a: 0, z: 2, name: 'intro' },
  { a: 2, z: 27, name: 'main' },
  { a: 27, z: 30, name: 'soft' },
  { a: 30, z: 33, name: 'main' },
  { a: 33, z: 36, name: 'outro' },
];
const secAt = (t) => SECTIONS.find((s) => t >= bar(s.a) && t < bar(s.z))?.name || 'outro';

// Abmaj9 – Gm7 – Fm9 – Ebmaj7, ein Akkord pro Takt
const CHORDS = [
  { notes: [56, 60, 63, 67, 70], bass: 44 },
  { notes: [55, 58, 62, 65, 69], bass: 43 },
  { notes: [53, 56, 60, 63, 67], bass: 41 },
  { notes: [51, 55, 58, 62, 65], bass: 39 },
];
const chordAt = (t) => CHORDS[Math.floor(t / BAR + 1e-6) % 4];
const swing = (step16) => (step16 % 2 ? BEAT * 0.07 : 0); // leichtes Swing-Gefühl auf den Sechzehnteln

/* ================= Instrumente ================= */

// E-Piano: FM-Ton mit weichem Anschlag und Tremolo
function epiano(t, note, vel, len, pan = 0) {
  const f = mtof(note);
  const i0 = Math.floor(t * SR);
  const n = Math.floor(SR * (len + 1.2));
  for (let j = 0; j < n; j++) {
    const tt = j / SR;
    const idx = 1.4 * Math.exp(-tt * 6) + 0.25;
    const mod = Math.sin(TAU * f * tt) * idx;
    const bellish = Math.sin(TAU * f * 14 * tt) * 0.04 * Math.exp(-tt * 30);
    let env = Math.min(1, tt / 0.004) * Math.exp(-tt * 1.6);
    if (tt > len) env *= Math.max(0, 1 - (tt - len) / 1.2);
    const trem = 1 + 0.12 * Math.sin(TAU * 4.5 * tt);
    const v = (Math.sin(TAU * f * tt + mod) + bellish) * env * vel * trem;
    put(music, i0 + j, v, pan + 0.25 * Math.sin(TAU * 4.5 * tt) * 0.3);
    if (i0 + j < N) verbSend[i0 + j] += v * 0.25;
  }
}

function renderPiano() {
  for (let c = 0; c < Math.ceil(DUR / BAR); c++) {
    const t0 = c * BAR;
    const s = secAt(t0);
    const ch = CHORDS[c % 4];
    const vol = { intro: 0.055, main: 0.06, soft: 0.065, outro: 0.055 }[s] * (s === 'outro' ? Math.max(0, 1 - (t0 - bar(33)) / bar(3)) : 1);
    // Akkord leicht gebrochen auf der Eins, kürzer wiederholt auf der „Und“ der Zwei
    ch.notes.forEach((n, k) => epiano(t0 + k * 0.018, n, vol * (k === 0 ? 1 : 0.8), BAR * 0.5, -0.3 + k * 0.15));
    if (s !== 'intro' && s !== 'outro') ch.notes.slice(1, 4).forEach((n, k) => epiano(t0 + BEAT * 1.5 + swing(1) + k * 0.012, n + 12 * (k === 2 ? 0 : 0), vol * 0.55, BEAT * 0.8, 0.2 - k * 0.2));
    if (s === 'main' || s === 'soft') ch.notes.slice(2).forEach((n, k) => epiano(t0 + BEAT * 3 + k * 0.015, n, vol * 0.45, BEAT * 0.9, 0.3));
  }
}

// Warme Fläche: wenige gefilterte Sägezähne, langsam ein- und ausblendend
function renderPad() {
  for (let c = 0; c < Math.ceil(DUR / BAR); c++) {
    const t0 = c * BAR;
    const ch = CHORDS[c % 4];
    const i0 = Math.floor(t0 * SR), i1 = Math.min(N, Math.floor((t0 + BAR + 0.6) * SR));
    const ph = ch.notes.slice(0, 4).map(() => [rnd(), rnd()]);
    let lpL = 0, lpR = 0;
    for (let i = i0; i < i1; i++) {
      const t = i / SR, local = t - t0;
      const s = secAt(Math.min(t, t0 + BAR - 0.001));
      let vol = { intro: 0.7, main: 0.55, soft: 0.8, outro: 0.7 }[s];
      if (s === 'outro') vol *= Math.max(0, 1 - (t - bar(33)) / bar(3));
      if (t < 2) vol *= t / 2;
      const env = Math.min(1, local / 0.6) * (local > BAR ? Math.max(0, 1 - (local - BAR) / 0.6) : 1);
      let L = 0, R = 0;
      ch.notes.slice(0, 4).forEach((n, k) => {
        for (let v = 0; v < 2; v++) {
          const f = mtof(n - 12 + (v ? 0.07 : -0.07));
          ph[k][v] = (ph[k][v] + f / SR) % 1;
          const saw = 2 * ph[k][v] - 1;
          if (v) R += saw; else L += saw;
        }
      });
      const cut = 700 + 250 * Math.sin(t * 0.4);
      const a = 1 - Math.exp(-TAU * cut / SR);
      lpL += a * (L - lpL); lpR += a * (R - lpR);
      music[0][i] += lpL * 0.012 * vol * env; music[1][i] += lpR * 0.012 * vol * env;
    }
  }
}

// Weicher Bass: Sinus mit etwas Obertönen, Grundton auf der Eins und kurz vor der Drei
function renderBass() {
  for (let c = 0; c < Math.ceil(DUR / BAR); c++) {
    const t0 = c * BAR;
    const s = secAt(t0);
    if (s === 'intro' || s === 'outro') continue;
    const ch = CHORDS[c % 4];
    for (const [off, len, oct] of [[0, BEAT * 1.6, 0], [BEAT * 2.5, BEAT * 1.3, 0], [BEAT * 3.5 + swing(1), BEAT * 0.45, 7]]) {
      const f = mtof(ch.bass + oct);
      const i0 = Math.floor((t0 + off) * SR);
      for (let j = 0; j < SR * len; j++) {
        const tt = j / SR;
        const env = Math.min(1, tt / 0.01) * Math.min(1, (len - tt) / 0.05) * (0.75 + 0.25 * Math.exp(-tt * 3));
        const v = (Math.sin(TAU * f * tt) + 0.18 * Math.sin(TAU * f * 2 * tt)) * env * (s === 'soft' ? 0.12 : 0.17);
        put(music, i0 + j, v);
      }
    }
  }
}

function kick(t, vol) {
  const i0 = Math.floor(t * SR);
  let ph = 0;
  for (let j = 0; j < SR * 0.35; j++) {
    const tt = j / SR;
    ph += (50 + 70 * Math.exp(-tt * 28)) / SR;
    put(music, i0 + j, Math.sin(TAU * ph) * Math.exp(-tt * 9) * vol);
  }
}

function snare(t, vol) {
  const i0 = Math.floor(t * SR);
  let lp = 0, ph = 0;
  for (let j = 0; j < SR * 0.3; j++) {
    const tt = j / SR;
    const n = noise();
    lp += 0.35 * (n - lp);
    ph += 210 / SR;
    const v = (lp * Math.exp(-tt * 14) * 0.7 + Math.sin(TAU * ph) * Math.exp(-tt * 35) * 0.4) * vol;
    put(music, i0 + j, v, 0.05);
    if (i0 + j < N) verbSend[i0 + j] += v * 0.7;
  }
}

function hat(t, vol, pan) {
  const i0 = Math.floor(t * SR);
  let lp = 0;
  for (let j = 0; j < SR * 0.05; j++) {
    const n = noise();
    lp += 0.5 * (n - lp);
    put(music, i0 + j, (n - lp) * Math.exp(-(j / SR) * 60) * vol, pan);
  }
}

// Schlagzeug im halben Tempo: Kick auf der Eins (und der Zwei-Und), Snare auf der Drei, lockere Hats
function renderDrums() {
  for (let c = 0; c < Math.ceil(DUR / BAR); c++) {
    const t0 = c * BAR;
    const s = secAt(t0);
    if (s === 'intro' || s === 'outro') continue;
    const soft = s === 'soft';
    if (!soft) {
      kick(t0, 0.5);
      kick(t0 + BEAT * 1.5 + swing(1), 0.32);
      snare(t0 + BEAT * 2, 0.24);
      if (c % 2) kick(t0 + BEAT * 3.5 + swing(1), 0.25);
    }
    for (let k = 0; k < 8; k++) {
      const th = t0 + k * BEAT / 2 + (k % 2 ? BEAT * 0.08 : 0);
      hat(th, (k % 2 ? 0.035 : 0.06) * (soft ? 0.6 : 1), k % 2 ? 0.3 : -0.2);
    }
  }
}

// Leise Melodie mit Glöckchen-Klang, hier und da
function renderMelody() {
  const phrase = [[0, 75, 1], [1.5, 72, 0.5], [2, 70, 1.5], [4, 74, 1], [5.5, 70, 0.5], [6, 67, 2], [8, 72, 1], [9.5, 68, 0.5], [10, 67, 1], [11, 65, 1], [12, 67, 3]];
  for (const startBar of [6, 14, 22, 30]) {
    for (const [beat, note, len] of phrase) {
      const t0 = bar(startBar) + beat * BEAT;
      const f = mtof(note);
      const i0 = Math.floor(t0 * SR);
      const d = len * BEAT;
      for (let j = 0; j < SR * (d + 0.8); j++) {
        const tt = j / SR;
        let env = Math.min(1, tt / 0.01) * Math.exp(-tt * 2.2);
        if (tt > d) env *= Math.max(0, 1 - (tt - d) / 0.8);
        const v = (Math.sin(TAU * f * tt) * 0.8 + Math.sin(TAU * f * 2 * tt) * 0.15 * Math.exp(-tt * 4)) * env * 0.045;
        put(music, i0 + j, v, 0.2);
        if (i0 + j < N) verbSend[i0 + j] += v * 0.6;
      }
    }
  }
}

// Leichtes Knistern wie von einer Schallplatte
function renderVinyl() {
  let lp = 0;
  for (let i = 0; i < N; i++) {
    const n = noise();
    lp += 0.05 * (n - lp);
    let v = lp * 0.012;
    if (rnd() < 0.00025) v += noise() * 0.06;
    put(music, i, v, (rnd() - 0.5) * 0.6);
  }
}

/* ================= Hall ================= */

function renderReverb(srcBus) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ d, buf: new Float32Array(d), i: 0, lp: 0 }));
  const aps = [225, 556, 441].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = srcBus[n];
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * 0.6 + c.lp * 0.4;
      c.buf[c.i] = x + c.lp * 0.84;
      c.i = (c.i + 1) % c.d;
      y += o;
    }
    y /= combs.length;
    for (const a of aps) {
      const o = a.buf[a.i];
      const v = y + o * -0.5;
      a.buf[a.i] = v;
      a.i = (a.i + 1) % a.d;
      y = o + v * 0.5;
    }
    out[n] = y;
  }
  const pre = Math.floor(0.015 * SR);
  for (let n = 0; n < N; n++) {
    music[0][n] += out[n] * 0.9;
    if (n + pre < N) music[1][n + pre] += out[n] * 0.9;
  }
}

/* ================= Soundeffekte (leise und weich) ================= */

function bell(t, note, vol = 0.3, pan = 0, decay = 1) {
  const f = mtof(note);
  const parts = [[1, 1, 2.2], [2.0, 0.5, 1.4], [2.76, 0.35, 1.0], [4.07, 0.2, 0.6], [5.4, 0.12, 0.4]];
  const i0 = Math.floor(t * SR);
  for (let j = 0; j < SR * 2.2 * decay; j++) {
    const tt = j / SR;
    let v = 0;
    for (const [r, a, d] of parts) v += Math.sin(TAU * f * r * tt) * a * Math.exp(-tt / (d * decay));
    put(sfx, i0 + j, v * vol * Math.min(1, tt / 0.003), pan);
  }
}

function noiseSweep(t, len, vol, lo, hi, panFrom = -0.6, panTo = 0.6) {
  const i0 = Math.floor(t * SR);
  let lp = 0, lp2 = 0;
  for (let j = 0; j < SR * len; j++) {
    const k = j / (SR * len);
    const a = 1 - Math.exp(-TAU * (lo + (hi - lo) * Math.sin(Math.PI * k)) / SR);
    const n = noise();
    lp += a * (n - lp); lp2 += a * (lp - lp2);
    put(sfx, i0 + j, lp2 * Math.sin(Math.PI * k) ** 1.5 * vol * 2.2, panFrom + (panTo - panFrom) * k);
  }
}

const FX = {
  shimmer(t) { [68, 72, 75, 79, 82].forEach((n, k) => bell(t + 0.6 + k * 0.12, n, 0.035, -0.4 + k * 0.2, 1.5)); },
  whoosh(t) { noiseSweep(t, 0.9, 0.12, 200, 2500); },
  swish(t) { noiseSweep(t - 0.15, 0.45, 0.07, 400, 3500); },
  click(t) {
    const i0 = Math.floor(t * SR);
    for (let j = 0; j < SR * 0.03; j++) {
      const tt = j / SR;
      put(sfx, i0 + j, Math.sin(TAU * 1900 * tt) * Math.exp(-tt * 280) * 0.22 + (j < 80 ? noise() * 0.08 * (1 - j / 80) : 0), 0.1);
    }
  },
  pop(t) {
    const i0 = Math.floor(t * SR);
    let ph = 0;
    for (let j = 0; j < SR * 0.12; j++) {
      const tt = j / SR;
      ph += (800 - 450 * Math.min(1, tt / 0.07)) / SR;
      put(sfx, i0 + j, Math.sin(TAU * ph) * Math.exp(-tt * 30) * 0.2);
    }
  },
  sparkle(t) { [84, 87, 91, 94].forEach((n, k) => bell(t + k * 0.06, n, 0.03, -0.5 + k * 0.3, 0.4)); },
  lock(t) { [[0, 62], [0.13, 58]].forEach(([d, n]) => bell(t + d, n, 0.07, 0, 0.12)); },
  unlock(t) { [68, 72, 75, 80].forEach((n, k) => bell(t + k * 0.08, n, 0.07, -0.3 + k * 0.2, 0.9)); noiseSweep(t - 0.1, 0.6, 0.05, 1500, 6000); },
  chime(t, e) { bell(t, e.note || 77, 0.09, -0.15, 1.5); bell(t + 0.12, (e.note || 77) + 7, 0.06, 0.2, 1.4); },
  levelup(t) { [68, 72, 75, 80, 84].forEach((n, k) => bell(t + k * 0.1, n, 0.07, -0.4 + k * 0.2, 1.0)); },
};

/* ================= Zusammenmischen ================= */

renderPad();
renderPiano();
renderBass();
renderDrums();
renderMelody();
renderVinyl();
renderReverb(verbSend);
for (const e of TL.sfx) FX[e.type]?.(e.t, e);

let peak = 0;
const mix = [new Float32Array(N), new Float32Array(N)];
for (let c = 0; c < 2; c++) {
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const fade = Math.min(1, t / 1.0) * Math.max(0, Math.min(1, (DUR - t) / 2.0));
    const v = Math.tanh((music[c][i] + sfx[c][i]) * 1.1) / Math.tanh(1.1);
    mix[c][i] = v * fade;
    peak = Math.max(peak, Math.abs(mix[c][i]));
  }
}
const gain = 0.89 / (peak || 1);
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8);
out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[0][i] * gain)) * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[1][i] * gain)) * 32767), 46 + i * 4);
}
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', 'audio.wav'), out);
console.log(`audio.wav geschrieben: ${DUR.toFixed(2)}s, Spitze vorher ${peak.toFixed(2)}`);
