import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useExerciseMap, REGIONS } from '../exercises.js';
import { isFilled, getActiveSession, startSession } from '../sessions.js';
import { activitiesBetween, startOfWeek, startOfDay, addDays, dayKey, DAY } from '../activity.js';
import { fmtDuration, relativeDay } from '../format.js';
import Calendar from '../components/Calendar.jsx';
import { nextInPlan } from '../workouts.js';

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const regionOfMuscle = m => REGIONS.find(r => r.muscles.includes(m))?.key;
const regionLabel = k => REGIONS.find(r => r.key === k)?.label ?? k;
const daysAgo = ts => Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
const secOf = a => (a.kind === 'cardio' ? (a.item.durationMin ?? 0) * 60 : a.item.durationSec ?? 0);

/** Regiões musculares trabalhadas numa sessão (todas as principais de cada exercício com série preenchida). */
function sessionRegions(s, exMap) {
  const out = new Set();
  for (const e of s.exercises) {
    if (!e.sets.some(isFilled)) continue;
    for (const m of exMap.get(e.exerciseId)?.primary ?? []) {
      const r = regionOfMuscle(m);
      if (r) out.add(r);
    }
  }
  return [...out];
}

export default function Progress() {
  const exMap = useExerciseMap();
  const week = startOfWeek(Date.now());
  const data = useLiveQuery(async () => {
    const [thisWeek, lastWeek, sessions, workouts, lastCardio] = await Promise.all([
      activitiesBetween(week, addDays(week, 7)),
      activitiesBetween(addDays(week, -7), week),
      db.sessions.orderBy('startedAt').reverse().filter(s => s.status === 'done').toArray(),
      db.workouts.orderBy('order').toArray(),
      db.cardio.orderBy('date').last(),
    ]);
    return { thisWeek, lastWeek, sessions, workouts, lastCardio };
  }, [week]);

  if (!data || !exMap) return <ProgressHeader />;
  const { thisWeek, lastWeek, sessions, workouts, lastCardio } = data;
  const lastActivity = Math.max(sessions[0]?.startedAt ?? 0, lastCardio?.date ?? 0) || null;

  return (
    <>
      <ProgressHeader />
      <WeekCard week={week} acts={thisWeek} lastWeekSec={lastWeek.reduce((n, a) => n + secOf(a), 0)} />
      <div className="stat-row">
        <LastCard lastActivity={lastActivity} last={sessions[0]} lastCardio={lastCardio} />
        <NextCard sessions={sessions} workouts={workouts} />
      </div>
      <MusclesCard sessions={sessions} workouts={workouts} exMap={exMap} />
    </>
  );
}

function ProgressHeader() {
  return (
    <header className="page-header">
      <h1>Progresso</h1>
      <Link to="/progresso/calendario" className="icon-link" aria-label="Abrir calendário">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3zm12 8H5v9h14zM7 12h3v3H7z" /></svg>
      </Link>
    </header>
  );
}

/** Tempo de treino por dia da semana atual (segunda a domingo), total e média. */
function WeekCard({ week, acts, lastWeekSec }) {
  const perDay = WEEKDAYS.map((_, i) => {
    const k = dayKey(addDays(week, i));
    const day = acts.filter(a => dayKey(a.date) === k);
    return { k, sec: day.reduce((n, a) => n + secOf(a), 0), strength: day.some(a => a.kind === 'strength'), cardio: day.some(a => a.kind === 'cardio') };
  });
  const total = perDay.reduce((n, d) => n + d.sec, 0);
  const elapsed = Math.min(7, daysAgo(week) + 1); // dias da semana até hoje
  const trainedDays = perDay.filter(d => d.sec > 0 || d.strength || d.cardio).length;
  const max = Math.max(...perDay.map(d => d.sec), 1);
  const today = dayKey(Date.now());
  const diff = total - lastWeekSec;

  return (
    <section className="card">
      <div className="card-head">
        <h2>Esta semana</h2>
        <span className="muted small">{trainedDays} {trainedDays === 1 ? 'dia treinado' : 'dias treinados'}</span>
      </div>
      <div className="big-stats">
        <div><div className="big-num">{total ? fmtDuration(total) : '0 min'}</div><div className="muted small">tempo total</div></div>
        <div><div className="big-num">{fmtDuration(Math.round(total / elapsed))}</div><div className="muted small">média por dia</div></div>
      </div>
      <div className="bars" role="img" aria-label="Minutos de treino por dia da semana">
        {perDay.map((d, i) => (
          <div key={d.k} className={d.k === today ? 'bar-col today' : 'bar-col'}>
            <span className="bar-val">{d.sec ? Math.round(d.sec / 60) : ''}</span>
            <div className="bar-track">
              <div className={['bar', d.strength && 's', d.cardio && 'c'].filter(Boolean).join(' ')} style={{ height: `${(d.sec / max) * 100}%` }} />
            </div>
            <span className="bar-l">{WEEKDAYS[i]}</span>
          </div>
        ))}
      </div>
      <p className="muted small week-compare">
        {lastWeekSec
          ? `Semana passada: ${fmtDuration(lastWeekSec)} (${diff >= 0 ? '+' : '−'}${fmtDuration(Math.abs(diff))})`
          : 'Minutos por dia · média de segunda até hoje'}
      </p>
    </section>
  );
}

function LastCard({ lastActivity, last, lastCardio }) {
  const n = lastActivity ? daysAgo(lastActivity) : null;
  const what = lastCardio && (!last || lastCardio.date > last.startedAt) ? 'Cardio' : last?.workoutName;
  return (
    <section className="card stat-card">
      <div className="muted small">Último treino</div>
      {n == null
        ? <div className="big-num">—</div>
        : <div className="big-num">{n === 0 ? 'Hoje' : n === 1 ? '1 dia' : `${n} dias`}</div>}
      <div className="muted small">{n == null ? 'nenhum ainda' : n === 0 ? what : `atrás · ${what}`}</div>
    </section>
  );
}

function NextCard({ sessions, workouts }) {
  const nav = useNavigate();
  const next = nextInPlan(sessions, workouts);
  async function start() {
    const active = await getActiveSession();
    if (active) return nav(`/sessao/${active.id}`);
    if (!next.items.length) return nav(`/treino/${next.id}`);
    nav(`/sessao/${await startSession(next.id)}`);
  }
  return (
    <section className="card stat-card">
      <div className="muted small">Próximo do plano</div>
      {next
        ? <><div className="big-num next-name">{next.name || 'Sem nome'}</div>
            <button className="btn small primary" onClick={start}>Iniciar</button></>
        : <><div className="big-num">—</div><div className="muted small">monte seu plano em Treinos</div></>}
    </section>
  );
}

/**
 * Músculos: o que foi treinado nas últimas sessões e há quantos dias cada região não é treinada.
 * "Próximos" = regiões do plano há mais tempo sem treino.
 */
function MusclesCard({ sessions, workouts, exMap }) {
  const lastByRegion = new Map();
  for (const s of sessions) for (const r of sessionRegions(s, exMap)) if (!lastByRegion.has(r)) lastByRegion.set(r, s.startedAt);

  const planRegions = new Set();
  for (const w of workouts.filter(x => !x.archived)) {
    for (const it of w.items) for (const m of exMap.get(it.exerciseId)?.primary ?? []) {
      const r = regionOfMuscle(m);
      if (r) planRegions.add(r);
    }
  }
  const tracked = REGIONS.filter(r => planRegions.has(r.key) || lastByRegion.has(r.key))
    .map(r => ({ ...r, days: lastByRegion.has(r.key) ? daysAgo(lastByRegion.get(r.key)) : null }))
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999));
  const recent = sessions.slice(0, 3);

  return (
    <>
      <h2 className="section-title">Últimas sessões</h2>
      {recent.length === 0
        ? <p className="muted small">Os músculos treinados aparecem aqui depois da primeira sessão.</p>
        : (
          <ul className="ex-list recent-list">
            {recent.map(s => (
              <li key={s.id}>
                <Link to={`/sessao/${s.id}`} className="ex-row recent-row">
                  <div className="ex-meta">
                    <div className="h-top"><span className="ex-name">{s.workoutName}</span><span className="muted small">{relativeDay(s.startedAt)}</span></div>
                    <div className="region-chips">{sessionRegions(s, exMap).map(r => <span key={r} className="rchip">{regionLabel(r)}</span>)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

      {tracked.length > 0 && (
        <>
          <h2 className="section-title">Descanso por músculo <span className="muted small">· mais tempo sem treinar primeiro</span></h2>
          <section className="card rest-card">
            {tracked.map(r => {
              const level = r.days == null ? 'never' : r.days <= 2 ? 'fresh' : r.days <= 5 ? 'mid' : 'old';
              return (
                <div key={r.key} className="rest-row">
                  <span className="rest-name">{r.label}</span>
                  <span className={`rest-meter ${level}`}><i style={{ width: `${r.days == null ? 100 : Math.min(100, (r.days / 7) * 100)}%` }} /></span>
                  <span className="rest-days">{r.days == null ? 'nunca' : r.days === 0 ? 'hoje' : r.days === 1 ? 'ontem' : `${r.days} dias`}</span>
                </div>
              );
            })}
            <p className="muted small rest-legend">
              Os primeiros da lista são os próximos candidatos a treinar.
              {planRegions.size > 0 && ' Mostra os músculos do seu plano e os treinados recentemente.'}
            </p>
          </section>
        </>
      )}
    </>
  );
}

/** /progresso/calendario */
export function CalendarPage() {
  const nav = useNavigate();
  return (
    <>
      <header className="page-header">
        <button className="btn small ghost" onClick={() => nav('/progresso')}>‹ Progresso</button>
        <h1 className="header-title">Calendário</h1>
      </header>
      <Calendar />
    </>
  );
}
