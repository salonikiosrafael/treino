import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useExerciseMap, regionOf, regionLabel } from '../exercises.js';
import { Thumb } from '../components/ExerciseBrowser.jsx';
import { createWorkout, duplicateWorkout, deleteWorkout, moveWorkout, setArchived } from '../workouts.js';
import { getActiveSession, startSession, lastDoneByWorkout } from '../sessions.js';
import { relativeDay, fmtClock } from '../format.js';
import { daysSinceBackup, BACKUP_REMINDER_DAYS } from '../backup.js';
import { useNow } from '../hooks.js';
import { activitiesBetween, byDay, startOfWeek, addDays, dayKey } from '../activity.js';

export default function Workouts() {
  const nav = useNavigate();
  const workouts = useLiveQuery(() => db.workouts.orderBy('order').toArray(), []);
  const active = useLiveQuery(() => getActiveSession(), []);
  const lastDone = useLiveQuery(() => lastDoneByWorkout(), []);
  const backupDays = useLiveQuery(async () => {
    const n = await db.sessions.where('status').equals('done').count() + await db.cardio.count();
    return n ? daysSinceBackup() : -1; // -1 = sem registros ainda, não lembrar
  }, []);
  const exMap = useExerciseMap();
  const [menu, setMenu] = useState(null);
  const [showSaved, setShowSaved] = useState(false);

  async function create() {
    const id = await createWorkout();
    nav(`/treino/${id}?novo=1`);
  }

  async function start(w) {
    if (active) {
      alert(`Você já tem uma sessão em andamento (${active.workoutName}). Finalize ou cancele antes de começar outra.`);
      return nav(`/sessao/${active.id}`);
    }
    if (!w.items.length) {
      alert('Este treino não tem exercícios. Adicione alguns antes de começar.');
      return nav(`/treino/${w.id}`);
    }
    const id = await startSession(w.id);
    nav(`/sessao/${id}`);
  }

  if (!workouts || lastDone === undefined) return null;

  // próximo da sequência do plano: o que vem depois do último treino do plano realizado
  const planList = workouts.filter(w => !w.archived);
  let lastPlanIdx = -1;
  planList.forEach((w, i) => { if (lastDone.has(w.id) && (lastPlanIdx < 0 || lastDone.get(w.id) > lastDone.get(planList[lastPlanIdx].id))) lastPlanIdx = i; });
  const next = planList.length ? planList[(lastPlanIdx + 1) % planList.length] : null;

  const plan = workouts.filter(w => !w.archived);
  const saved = workouts.filter(w => w.archived);
  const cardProps = { exMap, lastDone, menu, setMenu, start, nav };

  const showBackupReminder = backupDays === null || (backupDays != null && backupDays > BACKUP_REMINDER_DAYS);

  return (
    <>
      <header className="page-header">
        <h1>Treinos</h1>
        <button className="btn small primary" onClick={create}>+ Novo</button>
      </header>

      {active ? <ActiveBanner s={active} /> : next && <NextHero w={next} exMap={exMap} last={lastDone.get(next.id)} onStart={() => start(next)} />}

      <WeekStrip />

      {showBackupReminder && (
        <Link to="/ajustes" className="reminder">
          {backupDays === null ? 'Você ainda não fez backup dos seus dados.' : `Último backup há ${backupDays} dias.`}
          <span>Exportar ›</span>
        </Link>
      )}

      {workouts.length === 0 && (
        <div className="empty">
          <p>Você ainda não tem treinos.</p>
          <button className="btn primary" onClick={create}>Criar meu primeiro treino</button>
        </div>
      )}

      {workouts.length > 0 && (
        <>
          <h2 className="section-title plan-title">Meu plano <span className="muted small">· {plan.length} {plan.length === 1 ? 'treino' : 'treinos'}</span></h2>
          {plan.length === 0 && <p className="muted small plan-empty">Nenhum treino no plano. Coloque um dos guardados abaixo (menu ⋯ → “Colocar no plano”) ou crie um novo.</p>}
          <ul className="w-list">
            {plan.map((w, i) => (
              <WorkoutCard key={w.id} w={w} {...cardProps} pos={i + 1} isNext={!active && w.id === next?.id} first={i === 0} lastInList={i === plan.length - 1} />
            ))}
          </ul>
        </>
      )}

      {saved.length > 0 && (
        <section className="saved">
          <button className="saved-head" onClick={() => setShowSaved(v => !v)} aria-expanded={showSaved}>
            <span><strong>Treinos guardados</strong> <span className="muted">· {saved.length}</span></span>
            <span className="muted small">{showSaved ? 'Ocultar' : 'Mostrar'} <span className={showSaved ? 'chev open' : 'chev'}>›</span></span>
          </button>
          {showSaved && (
            <>
              <p className="muted small saved-hint">Fora do plano, mas com tudo salvo. Coloque de volta quando quiser.</p>
              <ul className="w-list">
                {saved.map((w, i) => (
                  <WorkoutCard key={w.id} w={w} {...cardProps} archived first={i === 0} lastInList={i === saved.length - 1} />
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}

const regionsOf = (w, exMap) => (exMap
  ? [...new Set(w.items.map(it => exMap.get(it.exerciseId)).filter(Boolean).map(regionOf))].map(regionLabel)
  : []);

/** Destaque do topo: o próximo treino da sequência do plano. */
function NextHero({ w, exMap, last, onStart }) {
  const regions = regionsOf(w, exMap);
  return (
    <section className="next-hero">
      <div className="nh-label">Próximo treino do plano</div>
      <div className="nh-name">{w.name || 'Sem nome'}</div>
      <div className="nh-sub">{w.items.length} {w.items.length === 1 ? 'exercício' : 'exercícios'} · {last ? `feito ${relativeDay(last)}` : 'ainda não realizado'}</div>
      {regions.length > 0 && <div className="nh-chips">{regions.slice(0, 4).map(r => <span key={r}>{r}</span>)}</div>}
      <button className="btn nh-start" onClick={onStart}>Iniciar treino</button>
    </section>
  );
}

function WorkoutCard({ w, exMap, lastDone, isNext, pos, archived, first, lastInList, menu, setMenu, start, nav }) {
  const regions = regionsOf(w, exMap);
  const thumbs = exMap ? w.items.slice(0, 4).map(it => exMap.get(it.exerciseId)).filter(Boolean) : [];
  const last = lastDone.get(w.id);
  const open = menu === w.id;
  const act = fn => async () => { await fn(); setMenu(null); };
  return (
    <li className={['w-card', isNext && 'latest', archived && 'archived'].filter(Boolean).join(' ')}>
      {pos && <span className="w-pos">{pos}</span>}
      <Link to={`/treino/${w.id}`} className="w-main">
        {isNext && <div className="latest-tag">Próximo</div>}
        <div className="w-name">{w.name || 'Sem nome'}</div>
        {regions.length > 0 && <div className="region-chips">{regions.slice(0, 4).map(r => <span key={r} className="rchip">{r}</span>)}</div>}
        <div className="w-foot">
          {thumbs.length > 0 && <span className="w-thumbs">{thumbs.map((e, k) => <Thumb key={k} e={e} />)}</span>}
          <span className="ex-sub">{w.items.length} {w.items.length === 1 ? 'exercício' : 'exercícios'} · {last ? `feito ${relativeDay(last)}` : 'não realizado'}</span>
        </div>
      </Link>
      <div className="w-side">
        {archived
          ? <button className="btn small" onClick={() => setArchived(w.id, false)}>+ Plano</button>
          : <button className="btn small primary" onClick={() => start(w)}>Iniciar</button>}
        <button className="icon-btn" aria-label={`Opções de ${w.name}`} onClick={() => setMenu(open ? null : w.id)}>⋯</button>
      </div>
      {open && (
        <div className="w-actions">
          {archived
            ? <button onClick={act(() => setArchived(w.id, false))}>Colocar no plano</button>
            : <button onClick={act(() => setArchived(w.id, true))}>Tirar do plano</button>}
          {archived && <button onClick={() => start(w)}>Iniciar avulso</button>}
          <button onClick={() => nav(`/treino/${w.id}`)}>Editar</button>
          <button disabled={first} onClick={() => moveWorkout(w.id, -1)}>↑ Subir</button>
          <button disabled={lastInList} onClick={() => moveWorkout(w.id, 1)}>↓ Descer</button>
          <button onClick={act(() => duplicateWorkout(w.id))}>Duplicar</button>
          <button className="danger" onClick={async () => {
            if (confirm(`Excluir o treino “${w.name}”? O histórico das sessões feitas com ele é mantido.`)) {
              await deleteWorkout(w.id); setMenu(null);
            }
          }}>Excluir</button>
        </div>
      )}
    </li>
  );
}

function ActiveBanner({ s }) {
  const now = useNow(1000);
  return (
    <Link to={`/sessao/${s.id}`} className="active-banner">
      <span className="pulse" aria-hidden="true" />
      <div>
        <div className="w-name">{s.workoutName}</div>
        <div className="ex-sub">Sessão em andamento · {fmtClock(Math.max(0, Math.floor((now - s.startedAt) / 1000)))}</div>
      </div>
      <span className="btn small primary">Continuar</span>
    </Link>
  );
}

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Resumo da semana atual: um ponto por dia (musculação / cardio) e atalho para registrar cardio. */
function WeekStrip() {
  const week = startOfWeek(Date.now());
  const days = useLiveQuery(() => activitiesBetween(week, addDays(week, 7)).then(byDay), [week]);
  if (!days) return null;
  const total = [...days.values()].reduce((n, d) => n + d.strength + d.cardio, 0);
  const today = dayKey(Date.now());
  return (
    <section className="card week-card">
      <Link to="/progresso" className="week-top plain">
        <span><strong>Esta semana</strong> · {total} {total === 1 ? 'treino' : 'treinos'}</span>
        <span className="muted small">Progresso ›</span>
      </Link>
      <div className="week-days">
        {WEEKDAYS.map((w, i) => {
          const k = dayKey(addDays(week, i));
          const d = days.get(k);
          return (
            <div key={i} className={k === today ? 'wd today' : 'wd'}>
              <span className="wd-l">{w}</span>
              <span className="dots">
                {d?.strength > 0 && <i className="dot s" />}
                {d?.cardio > 0 && <i className="dot c" />}
                {!d && <i className="dot none" />}
              </span>
            </div>
          );
        })}
      </div>
      <Link to="/cardio/novo" className="btn small block cardio-btn">+ Registrar cardio</Link>
    </section>
  );
}
