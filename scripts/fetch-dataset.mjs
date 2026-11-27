// Baixa o dataset Free Exercise DB (Unlicense) para data/raw/exercises.json
import { writeFile, mkdir } from 'node:fs/promises';
const URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
await mkdir('data/raw', { recursive: true });
const res = await fetch(URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const text = await res.text();
JSON.parse(text); // valida
await writeFile('data/raw/exercises.json', text);
console.log(`ok: ${(text.length / 1024).toFixed(0)} KB`);
