import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useExerciseMap } from '../exercises.js';
import { activitiesBetween, byDay, startOfWeek, addDays, dayKey } from '../activity.js';
import { fmtWeekday } from '../format.js';
import { ActivityRow } from '../pages/History.jsx';

/* ---------- Calendário mensal de consistência ---------- */

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export default function Calendar() {
  const [params, setParams] = useSearchParams();
  const exMap = useExerciseMap();
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
    setParams({ mes: `${d.getFullYear()}-${d.getMonth() + 1}` }, { replace: true });
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

