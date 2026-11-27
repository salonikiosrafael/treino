import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useExerciseMap } from '../exercises.js';
import { isFilled, sessionVolume } from '../sessions.js';
import { exerciseHistory, summarizeExercise } from '../progression.js';
import { fmtDuration, fmtKg, fmtSets, relativeDay } from '../format.js';
import { Thumb } from '../components/ExerciseBrowser.jsx';

/** Resumo exibido ao finalizar uma sessão: números, comparação com a última vez do mesmo treino e recordes. */
export default function SessionSummary() {
  const { id } = useParams();
  const nav = useNavigate();
  const exMap = useExerciseMap();
  const data = useLiveQuery(async () => {
    const s = await db.sessions.get(id);
    if (!s) return null;
    const prev = (await db.sessions.where('workoutId').equals(s.workoutId).toArray())
      .filter(x => x.status === 'done' && x.id !== s.id && x.startedAt < s.startedAt)
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
    const ids = [...new Set(s.exercises.filter(e => e.sets.some(isFilled)).map(e => e.exerciseId))];
    const records = [];
    for (const exId of ids) {
      const cur = summarizeExercise(s, exId);
      const hist = await exerciseHistory(exId, { before: s.startedAt, excludeId: s.id });
      if (!cur || !hist.length) continue;
      const bestKg = Math.max(...hist.map(h => h.maxKg));
      const bestE = Math.max(...hist.map(h => h.e1rm));
      if (cur.maxKg > bestKg) records.push({ exId, text: `Carga: ${fmtKg(cur.maxKg)} kg (antes ${fmtKg(bestKg)})` });
      else if (cur.e1rm > bestE + 0.01) records.push({ exId, text: `1RM estimado: ${fmtKg(Math.round(cur.e1rm))} kg (antes ${fmtKg(Math.round(bestE))})` });
    }
    return { s, prev, records };
  }, [id]);

  if (data === undefined || !exMap) return null;
  if (!data) return <p className="empty">Sessão não encontrada. <Link to="/">Voltar</Link></p>;
  const { s, prev, records } = data;
  const sets = s.exercises.reduce((n, e) => n + e.sets.filter(isFilled).length, 0);
  const vol = sessionVolume(s);

  const delta = (cur, old, fmt) => {
    if (old == null || !old) return null;
    const d = cur - old;
    if (Math.abs(d) < 0.5) return <span className="delta same">= igual à última vez</span>;
    return <span className={d > 0 ? 'delta up' : 'delta down'}>{d > 0 ? '▲' : '▼'} {fmt(Math.abs(d))} vs. última vez</span>;
  };

  return (
    <>
      <section className="summary-hero">
        <div className="sum-emoji" aria-hidden="true">{records.length ? '🏆' : '💪'}</div>
        <div className="sum-title">Treino concluído!</div>
        <div className="sum-sub">{s.workoutName}</div>
      </section>

      <div className="tiles">
        <div className="tile"><div className="tile-n">{fmtDuration(s.durationSec)}</div><div className="tile-l">duração</div>
          {delta(s.durationSec ?? 0, prev?.durationSec, n => fmtDuration(Math.round(n)))}</div>
        <div className="tile"><div className="tile-n">{sets}</div><div className="tile-l">séries</div></div>
        <div className="tile"><div className="tile-n">{fmtKg(Math.round(vol))}<small> kg</small></div><div className="tile-l">volume</div>
          {delta(vol, prev ? sessionVolume(prev) : null, n => `${fmtKg(Math.round(n))} kg`)}</div>
      </div>
      {prev && <p className="muted small center">Comparado com a última vez deste treino ({relativeDay(prev.startedAt)}).</p>}

      {records.length > 0 && (
        <section className="card records">
          <h2>🏆 {records.length === 1 ? 'Novo recorde' : `${records.length} novos recordes`}</h2>
          <ul>
            {records.map(r => (
              <li key={r.exId}><strong>{exMap.get(r.exId)?.name ?? 'Exercício'}</strong><span>{r.text}</span></li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="section-title">Exercícios</h2>
      <ul className="ex-list">
        {s.exercises.filter(e => e.sets.some(isFilled)).map(e => {
          const ex = exMap.get(e.exerciseId);
          return (
            <li key={e.uid}>
              <div className="ex-row">
                <Thumb e={ex} />
                <div className="ex-meta">
                  <div className="ex-name">{ex?.name ?? 'Exercício'}</div>
                  <div className="ex-sub">{fmtSets(e.sets.filter(isFilled))}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button className="btn primary block" style={{ marginTop: 20 }} onClick={() => nav('/', { replace: true })}>Concluir</button>
      <Link to={`/sessao/${s.id}`} className="btn ghost block center" style={{ marginTop: 6 }}>Ver ou editar sessão</Link>
    </>
  );
}
