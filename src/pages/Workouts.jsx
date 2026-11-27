import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useExerciseMap, muscleLabel } from '../exercises.js';
import { createWorkout, duplicateWorkout, deleteWorkout, moveWorkout } from '../workouts.js';
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

  let latestId = null;
  for (const [wid, ts] of lastDone) if (!latestId || ts > lastDone.get(latestId)) latestId = wid;

  const showBackupReminder = backupDays === null || (backupDays != null && backupDays > BACKUP_REMINDER_DAYS);

  return (
    <>
      <header className="page-header">
        <h1>Treinos</h1>
        <button className="btn small primary" onClick={create}>+ Novo</button>
      </header>

      {active && <ActiveBanner s={active} />}

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

      <ul className="w-list">
        {workouts.map((w, i) => {
          const muscles = exMap
            ? [...new Set(w.items.flatMap(it => exMap.get(it.exerciseId)?.primary ?? []))].slice(0, 3).map(muscleLabel).join(' · ')
            : '';
          const last = lastDone.get(w.id);
          const isLatest = w.id === latestId;
          return (
            <li key={w.id} className={isLatest ? 'w-card latest' : 'w-card'}>
              <Link to={`/treino/${w.id}`} className="w-main">
                {isLatest && <div className="latest-tag">Último realizado</div>}
                <div className="w-name">{w.name || 'Sem nome'}</div>
                <div className="ex-sub">
                  {w.items.length} {w.items.length === 1 ? 'exercício' : 'exercícios'}{muscles && ` · ${muscles}`}
                </div>
                <div className="ex-sub">{last ? `Feito ${relativeDay(last)}` : 'Ainda não realizado'}</div>
              </Link>
              <div className="w-side">
                <button className="btn small primary" onClick={() => start(w)}>Iniciar</button>
                <button className="icon-btn" aria-label={`Opções de ${w.name}`} onClick={() => setMenu(menu === w.id ? null : w.id)}>⋯</button>
              </div>
              {menu === w.id && (
                <div className="w-actions">
                  <button onClick={() => nav(`/treino/${w.id}`)}>Editar</button>
                  <button disabled={i === 0} onClick={() => moveWorkout(w.id, -1)}>↑ Subir</button>
                  <button disabled={i === workouts.length - 1} onClick={() => moveWorkout(w.id, 1)}>↓ Descer</button>
                  <button onClick={async () => { await duplicateWorkout(w.id); setMenu(null); }}>Duplicar</button>
                  <button className="danger" onClick={async () => {
                    if (confirm(`Excluir o treino “${w.name}”? O histórico das sessões feitas com ele é mantido.`)) {
                      await deleteWorkout(w.id); setMenu(null);
                    }
                  }}>Excluir</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
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
      <Link to="/historico?ver=calendario" className="week-top plain">
        <span><strong>Esta semana</strong> · {total} {total === 1 ? 'treino' : 'treinos'}</span>
        <span className="muted small">Calendário ›</span>
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
