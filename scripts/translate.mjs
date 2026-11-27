// Junta os mapeamentos pt-BR (data/i18n) e gera src/data/exercises.json no formato do app.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { imgFile } from './img-path.mjs';
import { groupOf } from '../src/groups.js';

const ex = JSON.parse(await readFile('data/filtered.json', 'utf8'));
const terms = JSON.parse(await readFile('data/i18n/terms.json', 'utf8'));
const names = {};
for (const f of (await readdir('data/i18n')).filter(f => /^names-\d+\.json$/.test(f)).sort()) {
  Object.assign(names, JSON.parse(await readFile(`data/i18n/${f}`, 'utf8')));
}

const missing = [];
const unknownTerms = new Set();
const byPt = {};
const out = ex.map(e => {
  const name = names[e.name];
  if (!name) missing.push(e.name);
  for (const k of [...e.primaryMuscles, ...e.secondaryMuscles]) if (!terms.muscles[k]) unknownTerms.add(k);
  if (!terms.equipment[e.equipment]) unknownTerms.add(e.equipment);
  (byPt[name] ??= []).push(e.name);
  return {
    id: e.id,
    name: name ?? e.name,
    nameEn: e.name,
    group: groupOf(name ?? e.name),
    equipment: e.equipment, // chaves em inglês; o app traduz via terms.json
    primary: e.primaryMuscles,
    secondary: e.secondaryMuscles,
    force: e.force,
    mechanic: e.mechanic,
    level: e.level,
    instructions: e.instructions, // inglês por enquanto
    images: e.images.map(imgFile),
  };
});

const extra = Object.keys(names).filter(k => !ex.some(e => e.name === k));
await mkdir('src/data', { recursive: true });
await writeFile('src/data/exercises.json', JSON.stringify(out));
await writeFile('src/data/terms.json', JSON.stringify(terms));

console.log(`exercícios: ${out.length} | sem tradução: ${missing.length} | termos sem tradução: ${unknownTerms.size} | mapeamentos sobrando: ${extra.length}`);
if (missing.length) console.log('faltando:', missing);
if (unknownTerms.size) console.log('termos:', [...unknownTerms]);
if (extra.length) console.log('sobrando:', extra);
const dup = Object.entries(byPt).filter(([, v]) => v.length > 1);
if (dup.length) console.log('nomes pt duplicados:', JSON.stringify(dup));
