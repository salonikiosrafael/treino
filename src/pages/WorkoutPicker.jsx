import { useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { newItem, updateItems } from '../workouts.js';
import ExerciseBrowser from '../components/ExerciseBrowser.jsx';

export default function WorkoutPicker() {
  const { id } = useParams();
  const nav = useNavigate();
  const w = useLiveQuery(() => db.workouts.get(id), [id]);
  const addedNow = useRef(new Set()); // uids adicionados nesta visita (podem ser desfeitos com um toque)

  const picked = useMemo(() => {
    const m = new Map();
    for (const it of w?.items ?? []) m.set(it.exerciseId, (m.get(it.exerciseId) ?? 0) + 1);
    return m;
  }, [w]);

  async function onPick(e) {
    const existing = (w?.items ?? []).filter(it => it.exerciseId === e.id);
    if (!existing.length) {
      const it = newItem(e.id);
      addedNow.current.add(it.uid);
      return updateItems(id, items => [...items, it]);
    }
    const undoable = existing.find(it => addedNow.current.has(it.uid));
    if (undoable) return updateItems(id, items => items.filter(x => x.uid !== undoable.uid));
    if (confirm(`“${e.name}” já está no treino. Remover?`)) {
      return updateItems(id, items => items.filter(x => x.exerciseId !== e.id));
    }
  }

  const n = w?.items.length ?? 0;
  return (
    <>
      <header className="page-header">
        <h1 style={{ fontSize: 22 }}>Adicionar</h1>
        <button className="btn small primary" onClick={() => nav(-1)}>Concluir{n ? ` (${n})` : ''}</button>
      </header>
      <ExerciseBrowser stateKey="picker" mode="pick" onPick={onPick} picked={picked} />
    </>
  );
}
