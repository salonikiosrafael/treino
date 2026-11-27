// Filtra o dataset bruto: só musculação em academia.
import { readFile, writeFile } from 'node:fs/promises';
const CATEGORIES = new Set(['strength', 'powerlifting']);
const EQUIPMENT = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'e-z curl bar', 'kettlebells', 'bands']);
const raw = JSON.parse(await readFile('data/raw/exercises.json', 'utf8'));
const out = raw.filter(e => CATEGORIES.has(e.category) && EQUIPMENT.has(e.equipment));
await writeFile('data/filtered.json', JSON.stringify(out, null, 1));
const imgs = out.reduce((n, e) => n + e.images.length, 0);
console.log(`filtrados: ${out.length} de ${raw.length} | imagens: ${imgs}`);
