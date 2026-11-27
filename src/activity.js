import { db } from './db.js';

/*
 * Atividades = sessões de musculação finalizadas + registros de cardio.
 * Semana começa na segunda-feira.
 */
export const DAY = 86400000;
export const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const startOfWeek = ts => { const d = new Date(startOfDay(ts)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
export const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };

/** Lista ordenada (mais antiga primeiro) de { kind: 'strength'|'cardio', date, id, item } no intervalo [from, to). */
export async function activitiesBetween(from, to) {
  const [sessions, cardio] = await Promise.all([
    db.sessions.where('startedAt').between(from, to, true, false).filter(s => s.status === 'done').toArray(),
    db.cardio.where('date').between(from, to, true, false).toArray(),
  ]);
  return [
    ...sessions.map(s => ({ kind: 'strength', date: s.startedAt, id: s.id, item: s })),
    ...cardio.map(c => ({ kind: 'cardio', date: c.date, id: c.id, item: c })),
  ].sort((a, b) => a.date - b.date);
}

/** Map(dayKey → { strength: n, cardio: n, items: [...] }) */
export function byDay(acts) {
  const m = new Map();
  for (const a of acts) {
    const k = dayKey(a.date);
    const d = m.get(k) ?? { strength: 0, cardio: 0, items: [] };
    d[a.kind]++; d.items.push(a);
    m.set(k, d);
  }
  return m;
}
