'use strict';

/* Ton für das Werbevideo (Version 4): der Song „Long Road“ von Infraction (promo/song.mp3, von Anfang an)
   plus leise Klick- und Freischalt-Geräusche an den Stellen aus timeline.js.
   Aufruf: node promo/music.js  → schreibt promo/out/audio.wav */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
const TL = require('./timeline.js');

const SR = 44100;
const DUR = TL.duration;
const N = Math.ceil(SR * DUR);
const sfx = [new Float32Array(N), new Float32Array(N)];

const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
const TAU = Math.PI * 2;
let seed = 2024;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;

function put(bus, i, v, pan = 0) {
  if (i < 0 || i >= N) return;
  const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
  bus[0][i] += v * l * 1.414;
  bus[1][i] += v * r * 1.414;
}

/* ================= Song laden ================= */

const song = spawnSync(ffmpeg, ['-loglevel', 'error', '-i', path.join(__dirname, 'song.mp3'), '-f', 'f32le', '-ac', '2', '-ar', String(SR), 'pipe:1'], { maxBuffer: 1 << 30 });
if (song.status !== 0) throw new Error(`Song konnte nicht gelesen werden: ${song.stderr}`);
const pcm = new Float32Array(song.stdout.buffer, song.stdout.byteOffset, Math.floor(song.stdout.length / 4));

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
  swish(t) { noiseSweep(t - 0.15, 0.45, 0.09, 400, 3500); },
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
  // Weicher Tastenanschlag beim Tippen, leicht unterschiedlich je Taste
  key(t, e) {
    const i0 = Math.floor(t * SR);
    const f = 2400 + ((e.v * 397) % 900);
    for (let j = 0; j < SR * 0.025; j++) {
      const tt = j / SR;
      put(sfx, i0 + j, (Math.sin(TAU * f * tt) * 0.5 + noise() * 0.5) * Math.exp(-tt * 380) * 0.09, ((e.v % 5) - 2) * 0.08);
    }
  },
  sparkle(t) { [84, 87, 91, 94].forEach((n, k) => bell(t + k * 0.06, n, 0.03, -0.5 + k * 0.3, 0.4)); },
  lock(t) { [[0, 62], [0.13, 58]].forEach(([d, n]) => bell(t + d, n, 0.07, 0, 0.12)); },
  unlock(t) { [68, 72, 75, 80].forEach((n, k) => bell(t + k * 0.08, n, 0.07, -0.3 + k * 0.2, 0.9)); noiseSweep(t - 0.1, 0.6, 0.05, 1500, 6000); },
  levelup(t) { [68, 72, 75, 80, 84].forEach((n, k) => bell(t + k * 0.1, n, 0.07, -0.4 + k * 0.2, 1.0)); },
};
// Klick- und Tippgeräusche gehen unter der Musik ohnehin unter, deshalb nur noch der Song
if (process.argv.includes('--sfx')) for (const e of TL.sfx) FX[e.type]?.(e.t, e);

/* ================= Zusammenmischen ================= */

// Der Song bleibt, wie er ist; die Effekte liegen leise darüber. Am Ende sanft ausblenden.
const SFX_GAIN = 0.75;
const mix = [new Float32Array(N), new Float32Array(N)];
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.max(0, Math.min(1, (DUR - t) / 2.5));
  for (let c = 0; c < 2; c++) {
    const s = 2 * i + c < pcm.length ? pcm[2 * i + c] : 0;
    mix[c][i] = (s + sfx[c][i] * SFX_GAIN) * fade;
    peak = Math.max(peak, Math.abs(mix[c][i]));
  }
}
// Nur leiser machen, falls die Effekte über die Spitze hinausgehen
const gain = peak > 0.99 ? 0.99 / peak : 1;
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
console.log(`audio.wav geschrieben: ${DUR.toFixed(2)}s, Song ${(pcm.length / 2 / SR).toFixed(2)}s, Spitze ${peak.toFixed(2)}, Faktor ${gain.toFixed(2)}`);
