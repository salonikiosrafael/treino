import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useExerciseMap } from '../exercises.js';
import { isFilled, sessionVolume } from '../sessions.js';
import { cardioTitle, cardioDetails } from '../cardio.js';
import { activitiesBetween, byDay, startOfWeek, addDays, dayKey } from '../activity.js';
import { fmtWeekday, fmtTime, fmtDuration, fmtKg, relativeDay } from '../format.js';
import { Thumb } from '../components/ExerciseBrowser.jsx';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const VIEWS = [['', 'Lista'], ['calendario', 'Calendário'], ['exercicios', 'Por exercício']];

export default function History() {
  const [params, setParams] = useSearchParams();
  const view = params.get('ver') ?? '';
  const exMap = useExerciseMap();

  return (
    <>
      <header className="page-header"><h1>Histórico</h1></header>
      <div className="segmented" role="tablist">
        {VIEWS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''}
            onClick={() => setParams(k ? { ver: k } : {}, { replace: true })}>{label}</button>
        ))}
      </div>
      {view === 'calendario' ? <Calendar params={params} setParams={setParams} exMap={exMap} />
        : view === 'exercicios' ? <ExerciseList exMap={exMap} />
          : <ActivityList exMap={exMap} />}
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

function ActivityRow({ a, exMap }) {
  return <li>{a.kind === 'cardio' ? <CardioRow c={a.item} /> : <SessionRow s={a.item} exMap={exMap} />}</li>;
}

function SessionRow({ s, exMap }) {
  const sets = s.exercises.reduce((n, e) => n + e.sets.filter(isFilled).length, 0);
  const names = exMap ? s.exercises.map(e => exMap.get(e.exerciseId)?.name).filter(Boolean) : [];
  return (
    <Link className="ex-row h-row" to={`/sessao/${s.id}`}>
      <i className="kind-bar s" aria-hidden="true" />
      <div className="ex-meta">
        <div className="h-top">
          <span className="ex-name">{s.workoutName}</span>
          <span className="muted small">{fmtWeekday(s.startedAt)} · {fmtTime(s.startedAt)}</span>
        </div>
        <div className="ex-sub">
          {fmtDuration(s.durationSec)} · {plural(s.exercises.length, 'exercício', 'exercícios')} · {plural(sets, 'série', 'séries')} · {fmtKg(sessionVolume(s))} kg
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
      <div className="ex-meta">
        <div className="h-top">
          <span className="ex-name">Cardio · {cardioTitle(c)}</span>
          <span className="muted small">{fmtWeekday(c.date)} · {fmtTime(c.date)}</span>
        </div>
        <div className="ex-sub">{cardioDetails(c)}</div>
      </div>
    </Link>
  );
}

/* ---------- Calendário mensal de consistência ---------- */

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function Calendar({ params, setParams, exMap }) {
  const now = new Date();
  const [y, m] = (params.get('mes') ?? `${now.getFullYear()}-${now.getMonth() + 1}`).split('-').map(Number);
  const first = new Date(y, m - 1, 1).getTime();
  const nextMonth = new Date(y, m, 1).getTime();
  const gridStart = startOfWeek(first);
  const weeks = Math.round((startOfWeek(addDays(nextMonth, -1)) - gridStart) / (7 * 86400000)) + 1;
  const gridEnd = addDays(gridStart, weeks * 7);

  const acts = useLiveQuery(() => activitiesBetween(gridStart, gridEnd), [gridStart, gridEnd]);
  const [picked, setPicked] = useState(null);

  const go = delta => {
    const d = new Date(y, m - 1 + delta, 1);
    setPicked(null);
    setParams({ ver: 'calendario', mes: `${d.getFullYear()}-${d.getMonth() + 1}` }, { replace: true });
  };

  if (!acts) return null;
  const days = byDay(acts);
  const today = dayKey(Date.now());
  const inMonth = acts.filter(a => a.date >= first && a.date < nextMonth);
  const monthDays = byDay(inMonth);
  const summary = {
    days: monthDays.size,
    strength: inMonth.filter(a => a.kind === 'strength').length,
    cardio: inMonth.filter(a => a.kind === 'cardio').length,
  };
  const pickedKey = picked ?? (monthDays.has(today) ? today : null);
  const pickedDay = pickedKey ? days.get(pickedKey) : null;
  const isCurrent = y === now.getFullYear() && m === now.getMonth() + 1;
  const monthName = new Date(first).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const title = monthName[0].toUpperCase() + monthName.slice(1);

  return (
    <>
      <div className="cal-nav">
        <button className="btn small ghost" onClick={() => go(-1)} aria-label="Mês anterior">‹</button>
        <h2 className="cal-title">{title}</h2>
        <button className="btn small ghost" onClick={() => go(1)} aria-label="Próximo mês" disabled={isCurrent}>›</button>
      </div>

      <section className="card cal">
        <div className="cal-grid cal-head">
          {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          <span title="Treinos na semana">Sem.</span>
        </div>
        {Array.from({ length: weeks }, (_, wi) => {
          const ws = addDays(gridStart, wi * 7);
          let count = 0;
          const cells = Array.from({ length: 7 }, (_, di) => {
            const ts = addDays(ws, di);
            const k = dayKey(ts);
            const d = days.get(k);
            if (d) count += d.strength + d.cardio;
            const out = new Date(ts).getMonth() !== m - 1;
            const cls = ['cal-day', out && 'out', k === today && 'today', k === pickedKey && 'picked',
              d?.strength && d?.cardio ? 'both' : d?.strength ? 'str' : d?.cardio ? 'car' : ''].filter(Boolean).join(' ');
            return (
              <button key={k} className={cls} onClick={() => setPicked(k)} disabled={!d}
                aria-label={`${new Date(ts).getDate()}${d ? `: ${d.strength} musculação, ${d.cardio} cardio` : ''}`}>
                <span className="n">{new Date(ts).getDate()}</span>
                <span className="dots">
                  {d?.strength > 0 && <i className="dot s" />}
                  {d?.cardio > 0 && <i className="dot c" />}
                </span>
              </button>
            );
          });
          return (
            <div className="cal-grid" key={wi}>
              {cells}
              <span className={count ? 'cal-week' : 'cal-week zero'}>{count}</span>
            </div>
          );
        })}
        <div className="cal-legend muted small">
          <span><i className="dot s" /> Musculação</span>
          <span><i className="dot c" /> Cardio</span>
          <span>Sem. = treinos na semana</span>
        </div>
      </section>

      <p className="cal-summary">
        <strong>{summary.days}</strong> {summary.days === 1 ? 'dia treinado' : 'dias treinados'}
        <span className="muted"> · {summary.strength} musculação · {summary.cardio} cardio</span>
      </p>

      {pickedDay && (
        <section>
          <h2 className="section-title">{fmtWeekday(pickedDay.items[0].date)}</h2>
          <ul className="ex-list">{pickedDay.items.map(a => <ActivityRow key={a.id} a={a} exMap={exMap} />)}</ul>
        </section>
      )}
    </>
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
