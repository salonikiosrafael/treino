import { db, newId } from './db.js';

/** Medidas corporais. Todas opcionais; o peso é a principal. */
export const BODY_FIELDS = [
  { key: 'weight', label: 'Peso', unit: 'kg', decimal: true, max: 400 },
  { key: 'bodyFat', label: '% de gordura', unit: '%', decimal: true, max: 70 },
  { key: 'waist', label: 'Cintura', unit: 'cm', decimal: true, max: 250 },
  { key: 'chest', label: 'Peito', unit: 'cm', decimal: true, max: 250 },
  { key: 'arm', label: 'Braço', unit: 'cm', decimal: true, max: 100 },
  { key: 'thigh', label: 'Coxa', unit: 'cm', decimal: true, max: 150 },
  { key: 'hip', label: 'Quadril', unit: 'cm', decimal: true, max: 250 },
  { key: 'calf', label: 'Panturrilha', unit: 'cm', decimal: true, max: 100 },
];
export const bodyField = k => BODY_FIELDS.find(f => f.key === k);

export const blankBody = () => ({ date: Date.now(), ...Object.fromEntries(BODY_FIELDS.map(f => [f.key, null])) });
export const hasAnyValue = b => BODY_FIELDS.some(f => b[f.key] != null);

export async function saveBody(b) {
  const now = Date.now();
  const rec = { ...b, id: b.id ?? newId('b'), createdAt: b.createdAt ?? now, updatedAt: now };
  await db.body.put(rec);
  return rec.id;
}
export const deleteBody = id => db.body.delete(id);

/** Registros do mais antigo ao mais recente. */
export const allBody = () => db.body.orderBy('date').toArray();
