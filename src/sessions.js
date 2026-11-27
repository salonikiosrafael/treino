import { db, newId } from './db.js';

const emptySet = () => ({ kg: null, reps: null, rir: null });
const withIds = s => ({ ...s, exerciseIds: [...new Set(s.exercises.map(e => e.exerciseId))] });

export const getActiveSession = () => db.sessions.where('status').equals('active').first();

export async function startSession(workoutId) {
  const w = await db.workouts.get(workoutId);
  if (!w) throw new Error('Treino não encontrado');
  const notes = await db.exerciseNotes.bulkGet(w.items.map(it => it.exerciseId));
  const s = withIds({
    id: newId('s'),
    workoutId: w.id,
    workoutName: w.name || 'Sem nome',
    status: 'active',
    startedAt: Date.now(),
    finishedAt: null,
    durationSec: null,
    exercises: w.items.map((it, i) => ({
      uid: newId('e'),
      exerciseId: it.exerciseId,
      ...(it.superset ? { superset: it.superset } : {}),
      ...(it.assisted ? { assisted: true } : {}),
      planned: { sets: it.sets, repMin: it.repMin, repMax: it.repMax, increment: it.increment },
      note: notes[i]?.text ?? '',
      sets: Array.from({ length: it.sets }, emptySet), // campos começam VAZIOS
    })),
  });
  await db.sessions.add(s);
  return s.id;
}

/** Leitura-modificação-escrita atômica de uma sessão. */
export function updateSession(id, fn) {
  return db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id);
    if (!s) return;
    await db.sessions.put(withIds(fn(structuredClone(s))));
  });
}

export function updateExercise(sessionId, uid, fn) {
  return updateSession(sessionId, s => {
    s.exercises = s.exercises.map(e => (e.uid === uid ? fn(e) : e));
    return s;
  });
}

export const addSet = (sid, uid) => updateExercise(sid, uid, e => ({ ...e, sets: [...e.sets, emptySet()] }));
export const removeSet = (sid, uid, i) => updateExercise(sid, uid, e => ({ ...e, sets: e.sets.filter((_, n) => n !== i) }));
export const setField = (sid, uid, i, field, value) =>
  updateExercise(sid, uid, e => ({ ...e, sets: e.sets.map((st, n) => (n === i ? { ...st, [field]: value } : st)) }));

/*
 * Dropset: uma série pode ter `drops: [{ kg, reps }]` — as reduções de carga feitas logo em seguida.
 * Campo opcional dentro do documento da sessão (sem índice): sessões antigas simplesmente não têm.
 * Os drops entram no volume, mas não na progressão (que olha só a carga/reps da série principal).
 */
const mapSet = (e, i, fn) => ({ ...e, sets: e.sets.map((st, n) => (n === i ? fn(st) : st)) });
export const addDrop = (sid, uid, i) => updateExercise(sid, uid, e => mapSet(e, i, st => ({ ...st, drops: [...(st.drops ?? []), { kg: null, reps: null }] })));
export const removeDrop = (sid, uid, i, j) => updateExercise(sid, uid, e => mapSet(e, i, st => ({ ...st, drops: (st.drops ?? []).filter((_, n) => n !== j) })));
export const setDropField = (sid, uid, i, j, field, value) =>
  updateExercise(sid, uid, e => mapSet(e, i, st => ({ ...st, drops: (st.drops ?? []).map((d, n) => (n === j ? { ...d, [field]: value } : d)) })));
const dropFilled = d => d.kg != null || d.reps != null;
/** Liga/desliga "com auxílio" (gravitron) para um exercício desta sessão. */
export const setAssisted = (sid, uid, on) => updateExercise(sid, uid, ({ assisted: _old, ...e }) => (on ? { ...e, assisted: true } : e)); // eslint-disable-line no-unused-vars

export const cleanSet = st => (st.drops ? { ...st, drops: st.drops.filter(dropFilled) } : st);

/** Troca o exercício só nesta sessão. Com clearSets, as séries voltam a ficar vazias (mesma quantidade). */
export async function swapExercise(sid, uid, newExerciseId, { clearSets = false } = {}) {
  const note = await db.exerciseNotes.get(newExerciseId);
  // ao trocar de variação, o "com auxílio" volta a desligado (a chave só existe em exercícios de peso corporal)
  return updateExercise(sid, uid, ({ assisted: _old, ...e }) => ({ // eslint-disable-line no-unused-vars
    ...e, exerciseId: newExerciseId, note: note?.text ?? '',
    sets: clearSets ? e.sets.map(emptySet) : e.sets,
  }));
}

/** Nota fixa: salva na tabela de notas (aparece nas próximas vezes) e na sessão atual. */
export async function saveNote(sid, uid, exerciseId, text) {
  await db.exerciseNotes.put({ exerciseId, text, updatedAt: Date.now() });
  return updateExercise(sid, uid, e => ({ ...e, note: text }));
}

export const isFilled = st => st.kg != null || st.reps != null;
export const filledSets = e => e.sets.filter(isFilled);

/** Finaliza: guarda data, duração e só as séries preenchidas. Retorna false se nada foi registrado. */
export async function finishSession(id) {
  const s = await db.sessions.get(id);
  if (!s) return false;
  const exercises = s.exercises.map(e => ({ ...e, sets: filledSets(e).map(cleanSet) }));
  if (!exercises.some(e => e.sets.length)) return false;
  const finishedAt = Date.now();
  await db.sessions.put(withIds({
    ...s, exercises, status: 'done', finishedAt, durationSec: Math.round((finishedAt - s.startedAt) / 1000),
  }));
  return true;
}

export const deleteSession = id => db.sessions.delete(id);

/** Última vez que o exercício foi feito antes de `before` (em sessões finalizadas). */
export async function lastPerformance(exerciseId, before, excludeId) {
  const list = await db.sessions.where('exerciseIds').equals(exerciseId).toArray();
  let best = null;
  for (const s of list) {
    if (s.status !== 'done' || s.id === excludeId || s.startedAt >= before) continue;
    if (!best || s.startedAt > best.startedAt) best = s;
  }
  if (!best) return null;
  const sets = best.exercises.filter(e => e.exerciseId === exerciseId).flatMap(e => e.sets).filter(isFilled);
  return { date: best.startedAt, sessionId: best.id, sets };
}

/** Data da última sessão finalizada de cada treino: Map(workoutId → startedAt). */
export async function lastDoneByWorkout() {
  const done = await db.sessions.where('status').equals('done').toArray();
  const m = new Map();
  for (const s of done) if (!m.has(s.workoutId) || m.get(s.workoutId) < s.startedAt) m.set(s.workoutId, s.startedAt);
  return m;
}

/** Volume de uma série, incluindo os drops. */
export const setVolume = st =>
  (st.kg ?? 0) * (st.reps ?? 0) + (st.drops ?? []).reduce((a, d) => a + (d.kg ?? 0) * (d.reps ?? 0), 0);
// Exercícios com auxílio (gravitron) não entram no volume: ali os kg são ajuda, não carga.
export const sessionVolume = s => s.exercises.reduce((v, e) => (e.assisted ? v : v + e.sets.reduce((a, st) => a + setVolume(st), 0)), 0);
