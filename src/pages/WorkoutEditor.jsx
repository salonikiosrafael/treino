import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useExerciseMap, equipmentLabel } from '../exercises.js';
import {
  updateWorkout, updateItems, moveInArray, duplicateWorkout, deleteWorkout,
  normalizeSupersets, linkWithNext, unlinkFromNext, supersetInfo, supersetName,
} from '../workouts.js';
import { Fragment } from 'react';
import { Thumb } from '../components/ExerciseBrowser.jsx';
import NumField from '../components/NumField.jsx';

export default function WorkoutEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const w = useLiveQuery(() => db.workouts.get(id), [id]);
  const exMap = useExerciseMap();
  const [name, setName] = useState(null);
  const isNew = useRef(params.has('novo')); // foca o nome só na criação

  useEffect(() => { if (w && name === null) setName(w.name); }, [w, name]);
  useEffect(() => { if (params.has('novo')) nav(`/treino/${id}`, { replace: true }); }, []); // eslint-disable-line

  if (w === undefined) return null; // carregando
  if (!w) return <p className="empty">Treino não encontrado. <Link to="/">Voltar</Link></p>;
  if (name === null) return null;

  const ssInfo = supersetInfo(w.items);
  const setItem = (uid, changes) => updateItems(id, items => items.map(it => {
    if (it.uid !== uid) return it;
    const next = { ...it, ...changes };
    // mantém a faixa coerente
    if ('repMin' in changes && next.repMin > next.repMax) next.repMax = next.repMin;
    if ('repMax' in changes && next.repMax < next.repMin) next.repMin = next.repMax;
    return next;
  }));

  return (
    <>
      <header className="page-header">
        <button className="btn small ghost" onClick={() => nav('/')}>‹ Treinos</button>
        <span style={{ flex: 1 }} />
        <button className="btn small ghost" onClick={async () => { const c = await duplicateWorkout(id); nav(`/treino/${c}`, { replace: true }); }}>Duplicar</button>
      </header>

      <input
        className="title-input"
        value={name}
        placeholder="Nome do treino (ex: Push A)"
        autoFocus={isNew.current}
        onFocus={e => { if (isNew.current) { e.target.select(); isNew.current = false; } }}
        onChange={e => { setName(e.target.value); updateWorkout(id, { name: e.target.value.trim() }); }}
        aria-label="Nome do treino"
      />

      {w.items.length === 0 && <p className="empty">Nenhum exercício ainda.</p>}

      <ol className="items">
        {w.items.map((it, i) => {
          const e = exMap?.get(it.exerciseId);
          const ss = ssInfo[i];
          const linkedNext = ss && !ss.last;
          return (
            <Fragment key={it.uid}>
            <li className={['item-card', ss && 'ss', ss?.first && 'ss-first', ss?.last && 'ss-last'].filter(Boolean).join(' ')}>
              {ss?.first && <div className="ss-tag">{supersetName(ss.size)} {ss.letter} · sem descanso entre os exercícios</div>}
              <div className="item-head">
                <span className="item-pos">{ss ? `${ss.letter}${ss.pos}` : i + 1}</span>
                <Thumb e={e} />
                <div className="ex-meta">
                  {e
                    ? <Link to={`/exercicio/${encodeURIComponent(e.id)}`} className="ex-name plain">{e.name}</Link>
                    : <span className="ex-name">{exMap ? 'Exercício removido' : '…'}</span>}
                  {e && <div className="ex-sub">{equipmentLabel(e.equipment)}</div>}
                </div>
              </div>
              <div className={e?.equipment === 'body only' ? 'item-fields bw' : 'item-fields'}>
                <NumField label="Séries" value={it.sets} min={1} max={20} onCommit={v => setItem(it.uid, { sets: v })} />
                <div className="num range">
                  <span className="num-label">Repetições</span>
                  <span className="range-row">
                    <NumField value={it.repMin} min={1} max={100} onCommit={v => setItem(it.uid, { repMin: v })} />
                    <span className="muted">–</span>
                    <NumField value={it.repMax} min={1} max={100} onCommit={v => setItem(it.uid, { repMax: v })} />
                  </span>
                </div>
                {e?.equipment !== 'body only' && (
                  <NumField label="Incremento" decimal suffix="kg" value={it.increment} min={0} max={50} onCommit={v => setItem(it.uid, { increment: v })} />
                )}
              </div>
              {e?.equipment === 'body only' && (
                <AssistToggle on={!!it.assisted} onChange={on => setItem(it.uid, { assisted: on })} />
              )}
              <div className="item-actions">
                <button disabled={i === 0} onClick={() => updateItems(id, items => normalizeSupersets(moveInArray(items, i, -1)))} aria-label="Mover para cima">↑</button>
                <button disabled={i === w.items.length - 1} onClick={() => updateItems(id, items => normalizeSupersets(moveInArray(items, i, 1)))} aria-label="Mover para baixo">↓</button>
                <span style={{ flex: 1 }} />
                <button className="danger" onClick={() => updateItems(id, items => normalizeSupersets(items.filter(x => x.uid !== it.uid)))}>Remover</button>
              </div>
            </li>
            {i < w.items.length - 1 && (
              <li className={linkedNext ? 'link-row on' : 'link-row'}>
                {linkedNext
                  ? <button onClick={() => updateItems(id, items => unlinkFromNext(items, i))}>🔗 Juntos · separar</button>
                  : <button onClick={() => updateItems(id, items => linkWithNext(items, i))}>+ Juntar com o próximo (biset)</button>}
              </li>
            )}
            </Fragment>
          );
        })}
      </ol>

      <Link to={`/treino/${id}/adicionar`} className="btn primary block">+ Adicionar exercícios</Link>
      <button className="btn danger block" style={{ marginTop: 24 }} onClick={async () => {
        if (confirm(`Excluir o treino “${w.name || 'Sem nome'}”?`)) { await deleteWorkout(id); nav('/', { replace: true }); }
      }}>Excluir treino</button>
    </>
  );
}

/** Chave "Com auxílio (gravitron)" para exercícios de peso corporal. */
export function AssistToggle({ on, onChange, compact = false }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={on ? 'assist-toggle on' : 'assist-toggle'} onClick={() => onChange(!on)}>
      <span className="sw" aria-hidden="true"><i /></span>
      <span>Com auxílio (gravitron){!compact && <small>{on ? 'kg = ajuda: menos kg é mais difícil' : 'desligado: kg = carga extra, se houver'}</small>}</span>
    </button>
  );
}
