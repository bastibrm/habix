'use strict';

/* Kontaktbogen aus den Standbildern von record.js --test: node promo/sheet.js → promo/out/contact_1.png, contact_2.png … */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;

const OUT = path.join(__dirname, 'out');
const files = fs.readdirSync(OUT).filter((f) => /^test-[\d_]+\.png$/.test(f))
  .map((f) => ({ f, t: Number(f.slice(5, -4).replace('_', '.')) })).sort((a, b) => a.t - b.t);
const per = 12;
for (let s = 0; s * per < files.length; s++) {
  const part = files.slice(s * per, s * per + per);
  const args = ['-y', '-loglevel', 'error'];
  part.forEach((p) => args.push('-i', path.join(OUT, p.f)));
  const chains = part.map((p, i) => `[${i}:v]scale=640:360[v${i}]`);
  const layout = part.map((_, i) => `${(i % 4) * 640}_${Math.floor(i / 4) * 360}`).join('|');
  const filter = `${chains.join(';')};${part.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${part.length}:layout=${layout}`;
  args.push('-filter_complex', filter, '-frames:v', '1', path.join(OUT, `contact_${s + 1}.png`));
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8' });
  console.log(`contact_${s + 1}.png`, r.status === 0 ? 'ok' : r.stderr);
}
