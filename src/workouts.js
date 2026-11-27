import { db, newId } from './db.js';

export const DEFAULTS = { sets: 3, repMin: 8, repMax: 12, increment: 2.5 };

export const newItem = exerciseId => ({ uid: newId('i'), exerciseId, ...DEFAULTS });

export async function createWorkout(name = 'Novo treino') {
  const last = await db.workouts.orderBy('order').last();
  const now = Date.now();
  const w = { id: newId('w'), name, order: (last?.order ?? 0) + 1, items: [], createdAt: now, updatedAt: now };
  await db.workouts.add(w);
  return w.id;
}

export function updateWorkout(id, changes) {
  return db.workouts.update(id, { ...changes, updatedAt: Date.now() });
}

/** Aplica uma função sobre os itens de forma atômica (evita perder edições concorrentes). */
export function updateItems(id, fn) {
  return db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id);
    if (!w) return;
    await db.workouts.update(id, { items: fn(w.items), updatedAt: Date.now() });
  });
}

export async function duplicateWorkout(id) {
  const w = await db.workouts.get(id);
  if (!w) return;
  const copyId = await createWorkout(`${w.name} (cópia)`);
  await updateWorkout(copyId, { items: w.items.map(it => ({ ...it, uid: newId('i') })) });
  return copyId;
}

export function deleteWorkout(id) {
  return db.workouts.delete(id);
}

/** Troca a posição do treino com o vizinho (dir = -1 sobe, +1 desce). */
export function moveWorkout(id, dir) {
  return db.transaction('rw', db.workouts, async () => {
    const list = await db.workouts.orderBy('order').toArray();
    const i = list.findIndex(w => w.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((w, n) => db.workouts.update(w.id, { order: n + 1 })));
  });
}

export const moveInArray = (arr, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

/** Ids de treinos que usam o exercício (para impedir exclusão de personalizado em uso). */
export async function workoutsUsing(exerciseId) {
  const all = await db.workouts.toArray();
  return all.filter(w => w.items.some(it => it.exerciseId === exerciseId));
}

// Números em pt-BR: aceita vírgula.
export const parseNum = s => {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export const fmtNum = n => (n == null ? '' : String(n).replace('.', ','));
