// Gera os ícones PNG do app a partir de um SVG (halter estilizado).
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const svg = (pad) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f1115"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)" fill="#4ade80">
    <rect x="96" y="176" width="44" height="160" rx="14"/>
    <rect x="148" y="146" width="44" height="220" rx="14"/>
    <rect x="320" y="146" width="44" height="220" rx="14"/>
    <rect x="372" y="176" width="44" height="160" rx="14"/>
    <rect x="192" y="236" width="128" height="40" rx="8"/>
    <rect x="56" y="236" width="40" height="40" rx="8"/>
    <rect x="416" y="236" width="40" height="40" rx="8"/>
  </g>
</svg>`);

await mkdir('public/icons', { recursive: true });
const out = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.2], // margem para a área segura do maskable
  ['apple-touch-icon.png', 180, 0.08],
];
for (const [name, size, pad] of out) {
  await sharp(svg(pad)).resize(size, size).png().toFile(`public/icons/${name}`);
}
console.log('ícones gerados:', out.map(o => o[0]).join(', '));
