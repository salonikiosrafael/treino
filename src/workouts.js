import { db, newId } from './db.js';

export const DEFAULTS = { sets: 3, repMin: 8, repMax: 12, increment: 2.5 };

export const newItem = exerciseId => ({ uid: newId('i'), exerciseId, ...DEFAULTS });

export async function createWorkout(name = 'Novo treino') {
  const last = await db.workouts.orderBy('order').last();
  const now = Date.now();
  const w = { id: newId('w'), name, order: (last?.order ?? 0) + 1, items: [], archived: false, createdAt: now, updatedAt: now };
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
  await updateWorkout(copyId, { items: w.items.map(it => ({ ...it, uid: newId('i') })), archived: !!w.archived });
  return copyId;
}

export function deleteWorkout(id) {
  return db.workouts.delete(id);
}

/** Coloca no plano (archived=false) ou guarda fora dele (true); entra no fim da lista de destino. */
export async function setArchived(id, archived) {
  const last = await db.workouts.orderBy('order').last();
  return db.workouts.update(id, { archived, order: (last?.order ?? 0) + 1, updatedAt: Date.now() });
}

/** Troca a posição do treino com o vizinho da mesma lista (plano ou guardados). dir = -1 sobe, +1 desce. */
export function moveWorkout(id, dir) {
  return db.transaction('rw', db.workouts, async () => {
    const all = await db.workouts.orderBy('order').toArray();
    const me = all.find(w => w.id === id);
    const list = all.filter(w => !!w.archived === !!me?.archived);
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

/** Próximo da sequência: o treino do plano que vem depois do último feito (volta ao início no fim). */
export function nextInPlan(sessions, workouts) {
  const plan = workouts.filter(w => !w.archived);
  if (!plan.length) return null;
  const last = sessions.find(s => plan.some(w => w.id === s.workoutId));
  if (!last) return plan[0];
  const i = plan.findIndex(w => w.id === last.workoutId);
  return plan[(i + 1) % plan.length];
}


/*
 * Biset/superset: itens CONSECUTIVOS com o mesmo `superset` (id) formam um grupo.
 * Campo opcional dentro do documento do treino (e copiado para a sessão) — sem índice, sem migração;
 * treinos e sessões antigos simplesmente não têm.
 */

/** Remove ids de grupo que não ligam pelo menos 2 itens vizinhos. */
export function normalizeSupersets(items) {
  return items.map((it, i) => {
    if (!it.superset) return it;
    const linked = items[i - 1]?.superset === it.superset || items[i + 1]?.superset === it.superset;
    if (linked) return it;
    const { superset, ...rest } = it; // eslint-disable-line no-unused-vars
    return rest;
  });
}

/** Junta o item i com o próximo (i+1) no mesmo grupo. */
export function linkWithNext(items, i) {
  if (i < 0 || i >= items.length - 1) return items;
  const sid = items[i].superset ?? items[i + 1].superset ?? newId('ss');
  const old = items[i + 1].superset;
  return normalizeSupersets(items.map((it, n) => {
    if (n === i || n === i + 1) return { ...it, superset: sid };
    if (old && old !== sid && it.superset === old) return { ...it, superset: sid }; // une dois grupos
    return it;
  }));
}

/** Separa o item i do próximo: os itens depois de i ganham um id novo. */
export function unlinkFromNext(items, i) {
  const sid = items[i]?.superset;
  if (!sid || items[i + 1]?.superset !== sid) return items;
  const fresh = newId('ss');
  return normalizeSupersets(items.map((it, n) => (n > i && it.superset === sid ? { ...it, superset: fresh } : it)));
}

/**
 * Para cada índice: null (exercício solo) ou { letter: 'A', pos: 1, size: 2, first, last }.
 * Só agrupa itens vizinhos com o mesmo id.
 */
export function supersetInfo(items) {
  const out = items.map(() => null);
  let letter = 0;
  for (let i = 0; i < items.length;) {
    const sid = items[i].superset;
    let j = i;
    while (sid && j + 1 < items.length && items[j + 1].superset === sid) j++;
    if (j > i) {
      const L = String.fromCharCode(65 + (letter++ % 26));
      for (let k = i; k <= j; k++) out[k] = { letter: L, pos: k - i + 1, size: j - i + 1, first: k === i, last: k === j };
    }
    i = j + 1;
  }
  return out;
}

export const supersetName = size => (size === 2 ? 'Biset' : size === 3 ? 'Triset' : 'Superset');
