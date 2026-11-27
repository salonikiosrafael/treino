// Baixa as imagens dos exercícios filtrados e converte para WebP (máx. 400px, q75).
// Saída: public/img/ex/<hash>-<n>.webp (nomes curtos: evita limite de caminho do Windows). Idempotente: pula arquivos já existentes.
import { readFile, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { imgFile } from './img-path.mjs';

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const OUT = 'public/img/ex/';
const ex = JSON.parse(await readFile('data/filtered.json', 'utf8'));
const jobs = ex.flatMap(e => e.images);

const exists = p => stat(p).then(() => true, () => false);
let done = 0, skipped = 0, bytes = 0;
const failed = [];

async function one(rel) {
  const dest = OUT + imgFile(rel);
  if (await exists(dest)) { skipped++; return; }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + rel.split('/').map(encodeURIComponent).join('/'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(dest), { recursive: true });
      const info = await sharp(buf).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 75 }).toFile(dest);
      bytes += info.size; done++;
      return;
    } catch (err) {
      if (attempt === 3) failed.push(`${rel}: ${err.message}`);
    }
  }
}

const CONCURRENCY = 12;
let i = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (i < jobs.length) await one(jobs[i++]);
}));
console.log(`convertidas: ${done} | já existiam: ${skipped} | falhas: ${failed.length} | novo total: ${(bytes / 1048576).toFixed(1)} MB`);
if (failed.length) console.log(failed.slice(0, 20).join('\n'));
