import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useExerciseMap } from '../exercises.js';
import { isFilled, sessionVolume } from '../sessions.js';
import { cardioTitle, cardioDetails } from '../cardio.js';
import { activitiesBetween } from '../activity.js';
import { fmtWeekday, fmtTime, fmtDuration, fmtKg, relativeDay } from '../format.js';
import { Thumb } from '../components/ExerciseBrowser.jsx';
import CardioIcon from '../components/CardioIcon.jsx';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const VIEWS = [['', 'Lista'], ['exercicios', 'Por exercício']];

export default function History() {
  const [params, setParams] = useSearchParams();
  const view = params.get('ver') ?? '';
  const exMap = useExerciseMap();
  if (view === 'calendario') return <Navigate to="/progresso/calendario" replace />; // link antigo

  return (
    <>
      <header className="page-header"><h1>Histórico</h1></header>
      <div className="segmented" role="tablist">
        {VIEWS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''}
            onClick={() => setParams(k ? { ver: k } : {}, { replace: true })}>{label}</button>
        ))}
      </div>
      {view === 'exercicios' ? <ExerciseList exMap={exMap} /> : <ActivityList exMap={exMap} />}
    </>
  );
}

/* ---------- Lista (musculação + cardio, agrupada por mês) ---------- */

function ActivityList({ exMap }) {
  const acts = useLiveQuery(() => activitiesBetween(0, Infinity).then(a => a.reverse()), []);
  if (!acts) return null;
  if (!acts.length) return <p className="empty">Nenhum treino registrado ainda.</p>;

  const months = [];
  for (const a of acts) {
    const name = new Date(a.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const label = name[0].toUpperCase() + name.slice(1);
    if (months.at(-1)?.label !== label) months.push({ label, items: [] });
    months.at(-1).items.push(a);
  }
  return months.map(m => (
    <section key={m.label}>
      <h2 className="section-title month">{m.label}</h2>
      <ul className="ex-list">{m.items.map(a => <ActivityRow key={a.id} a={a} exMap={exMap} />)}</ul>
    </section>
  ));
}

export function DumbbellIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
    </svg>
  );
}

export function ActivityRow({ a, exMap }) {
  return <li>{a.kind === 'cardio' ? <CardioRow c={a.item} /> : <SessionRow s={a.item} exMap={exMap} />}</li>;
}

function SessionRow({ s, exMap }) {
  const sets = s.exercises.reduce((n, e) => n + e.sets.filter(isFilled).length, 0);
  const names = exMap ? s.exercises.filter(e => e.sets.some(isFilled)).map(e => exMap.get(e.exerciseId)?.name).filter(Boolean) : [];
  return (
    <Link className="ex-row h-row" to={`/sessao/${s.id}`}>
      <i className="kind-bar s" aria-hidden="true" />
      <span className="strength-badge" aria-hidden="true"><DumbbellIcon /></span>
      <div className="ex-meta">
        <div className="h-top">
          <span className="ex-name">{s.workoutName}</span>
          <span className="muted small">{fmtWeekday(s.startedAt)} · {fmtTime(s.startedAt)}</span>
        </div>
        <div className="stat-chips">
          <span>⏱ {fmtDuration(s.durationSec)}</span>
          <span>{plural(sets, 'série', 'séries')}</span>
          <span>{fmtKg(Math.round(sessionVolume(s)))} kg</span>
        </div>
        {names.length > 0 && <div className="ex-sub h-names">{names.join(', ')}</div>}
      </div>
    </Link>
  );
}

function CardioRow({ c }) {
  return (
    <Link className="ex-row h-row" to={`/cardio/${c.id}`}>
      <i className="kind-bar c" aria-hidden="true" />
      <span className="cardio-badge"><CardioIcon type={c.type} size={22} /></span>
      <div className="ex-meta">
        <div className="h-top">
          <span className="ex-name">{cardioTitle(c)}</span>
          <span className="muted small">{fmtWeekday(c.date)} · {fmtTime(c.date)}</span>
        </div>
        <div className="ex-sub">{cardioDetails(c)}</div>
      </div>
    </Link>
  );
}

/* ---------- Por exercício (atalho para os gráficos) ---------- */

function ExerciseList({ exMap }) {
  const sessions = useLiveQuery(
    () => db.sessions.orderBy('startedAt').reverse().filter(s => s.status === 'done').toArray(), []);
  if (!sessions || !exMap) return null;
  const rows = new Map();
  for (const s of sessions) { // do mais recente para o mais antigo
    for (const e of s.exercises) {
      if (!e.sets.some(isFilled)) continue;
      const r = rows.get(e.exerciseId) ?? { id: e.exerciseId, last: s.startedAt, ids: new Set() };
      r.ids.add(s.id);
      rows.set(e.exerciseId, r);
    }
  }
  const list = [...rows.values()].filter(r => exMap.has(r.id));
  if (!list.length) return <p className="empty">Os exercícios aparecem aqui depois da primeira sessão.</p>;
  return (
    <ul className="ex-list" style={{ marginTop: 12 }}>
      {list.map(r => {
        const e = exMap.get(r.id);
        return (
          <li key={r.id}>
            <Link className="ex-row" to={`/exercicio/${encodeURIComponent(r.id)}`}>
              <Thumb e={e} />
              <div className="ex-meta">
                <div className="ex-name">{e.name}</div>
                <div className="ex-sub">{r.ids.size} {r.ids.size === 1 ? 'sessão' : 'sessões'} · última {relativeDay(r.last)}</div>
              </div>
              <span className="chev">›</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
