import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from './db.js';
import { groupOf } from './groups.js';
import terms from './data/terms.json';

export const MUSCLES = terms.muscles;
export const EQUIPMENT = terms.equipment;
export const muscleLabel = k => MUSCLES[k] ?? k;
export const equipmentLabel = k => EQUIPMENT[k] ?? k;

const IMG_BASE = `${import.meta.env.BASE_URL}img/ex/`;
export const imageUrl = path => IMG_BASE + path;

// Ordem de "popularidade" para listar variações dentro de um grupo.
const EQUIP_RANK = ['barbell', 'dumbbell', 'machine', 'cable', 'e-z curl bar', 'body only', 'kettlebells', 'bands'];
const LEVEL_RANK = { beginner: 0, intermediate: 1, expert: 2 };
export function variationSort(a, b) {
  return (EQUIP_RANK.indexOf(a.equipment) - EQUIP_RANK.indexOf(b.equipment))
    || ((LEVEL_RANK[a.level] ?? 0) - (LEVEL_RANK[b.level] ?? 0))
    || a.name.localeCompare(b.name, 'pt-BR');
}

// O dataset (≈555 exercícios) é carregado sob demanda, em um chunk separado.
let cache = null;
export function loadBuiltin() {
  cache ??= import('./data/exercises.json').then(m => m.default);
  return cache;
}

function normalizeCustom(c) {
  return { ...c, custom: true, group: groupOf(c.name), images: [], secondary: [], instructions: [] };
}

/** Exercícios do dataset + personalizados do usuário, ordenados por nome. */
export function useAllExercises() {
  const [builtin, setBuiltin] = useState(null);
  useEffect(() => { loadBuiltin().then(setBuiltin); }, []);
  const custom = useLiveQuery(() => db.customExercises.toArray(), []);
  return useMemo(() => {
    if (!builtin || !custom) return null;
    return [...custom.map(normalizeCustom), ...builtin].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [builtin, custom]);
}

/** Map id → exercício (inclui personalizados). */
export function useExerciseMap() {
  const all = useAllExercises();
  return useMemo(() => all && new Map(all.map(e => [e.id, e])), [all]);
}

export const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
