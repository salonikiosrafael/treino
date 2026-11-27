import { db, newId } from './db.js';

export const CARDIO_TYPES = [
  { key: 'bike', label: 'Bike' },
  { key: 'esteira', label: 'Esteira' },
  { key: 'natacao', label: 'Natação' },
  { key: 'outro', label: 'Outro' },
];
export const cardioTypeLabel = t => CARDIO_TYPES.find(x => x.key === t)?.label ?? 'Cardio';
export const cardioTitle = c => (c.type === 'outro' && c.label ? c.label : cardioTypeLabel(c.type));

export const INTENSITY_LABELS = {
  1: 'muito leve', 2: 'leve', 3: 'leve', 4: 'moderada', 5: 'moderada',
  6: 'um pouco forte', 7: 'forte', 8: 'muito forte', 9: 'quase máxima', 10: 'máxima',
};

export function blankCardio() {
  return { type: 'esteira', label: '', date: Date.now(), durationMin: null, incline: null, speed: null, distanceKm: null, intensity: null };
}

export async function saveCardio(c) {
  const now = Date.now();
  const rec = { ...c, id: c.id ?? newId('c'), createdAt: c.createdAt ?? now, updatedAt: now };
  if (rec.type !== 'outro') rec.label = '';
  await db.cardio.put(rec);
  return rec.id;
}

export const deleteCardio = id => db.cardio.delete(id);

const num = n => String(Math.round(n * 100) / 100).replace('.', ',');

/** "30 min · 5,2 km · 8 km/h · incl. 3% · intensidade 6/10" */
export function cardioDetails(c) {
  const parts = [];
  if (c.durationMin != null) parts.push(`${num(c.durationMin)} min`);
  if (c.distanceKm != null) parts.push(c.type === 'natacao' ? `${num(c.distanceKm * 1000)} m` : `${num(c.distanceKm)} km`);
  if (c.speed != null) parts.push(`${num(c.speed)} km/h`);
  if (c.incline != null) parts.push(`incl. ${num(c.incline)}%`);
  if (c.intensity != null) parts.push(`intensidade ${c.intensity}/10`);
  return parts.join(' · ');
}
