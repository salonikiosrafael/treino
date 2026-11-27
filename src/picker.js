import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db.js';
import { newItem, updateItems } from './workouts.js';

// uids adicionados nesta visita ao seletor (um segundo toque desfaz sem perguntar)
const addedNow = new Set();
export const resetPickSession = () => addedNow.clear();

/** Estado de "adicionar exercícios" a um treino: quantas vezes cada exercício está nele e a ação de tocar. */
export function useWorkoutPicker(workoutId) {
  const w = useLiveQuery(() => (workoutId ? db.workouts.get(workoutId) : undefined), [workoutId]);
  const picked = useMemo(() => {
    const m = new Map();
    for (const it of w?.items ?? []) m.set(it.exerciseId, (m.get(it.exerciseId) ?? 0) + 1);
    return m;
  }, [w]);

  async function onPick(e) {
    const existing = (w?.items ?? []).filter(it => it.exerciseId === e.id);
    if (!existing.length) {
      const it = newItem(e.id);
      addedNow.add(it.uid);
      return updateItems(workoutId, items => [...items, it]);
    }
    const undoable = existing.find(it => addedNow.has(it.uid));
    if (undoable) return updateItems(workoutId, items => items.filter(x => x.uid !== undoable.uid));
    if (confirm(`“${e.name}” já está no treino. Remover?`)) {
      return updateItems(workoutId, items => items.filter(x => x.exerciseId !== e.id));
    }
  }

  return { workout: w, picked, onPick, count: w?.items.length ?? 0 };
}
