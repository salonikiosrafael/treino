import { db } from './db.js';
import { isFilled, setVolume } from './sessions.js';
import { fmtKg } from './format.js';

/*
 * Progressão por regras fixas (sem IA). Só gera TEXTO — nunca preenche campos.
 *
 * Por sessão, "carga" = maior carga registrada no exercício naquela sessão.
 * Regras, nesta ordem de prioridade:
 *  1. Todas as séries da última sessão no topo da faixa (e, com RIR, nenhuma série RIR 0
 *     com reps abaixo do topo)                       → "Suba para X kg" (carga + incremento)
 *  2. Abaixo do mínimo nas 2 últimas sessões seguidas → "Considere reduzir para X kg"
 *  3. Alguma série abaixo do mínimo na última        → "Mantenha X kg"
 *  4. Sem progresso de carga nem de reps nas 3 últimas sessões
 *     (cada uma comparada com a anterior)            → "Estagnado: ..."
 *  5. Caso contrário                                 → "Mantenha X kg e tente mais repetições"
 */

const round = (n, step = 0.25) => Math.round(n / step) * step;

/** Resumo de um exercício em uma sessão finalizada (várias ocorrências na mesma sessão são somadas). */
export function summarizeExercise(session, exerciseId) {
  const sets = session.exercises.filter(e => e.exerciseId === exerciseId).flatMap(e => e.sets).filter(isFilled);
  if (!sets.length) return null;
  const maxKg = Math.max(...sets.map(st => st.kg ?? 0));
  const repsAtMax = sets.filter(st => (st.kg ?? 0) === maxKg).reduce((a, st) => a + (st.reps ?? 0), 0);
  const volume = sets.reduce((a, st) => a + setVolume(st), 0);
  const e1rm = Math.max(...sets.map(st => epley(st.kg ?? 0, st.reps ?? 0)));
  return { date: session.startedAt, sessionId: session.id, sets, maxKg, repsAtMax, volume, e1rm };
}

/** 1RM estimado (Epley). Com 1 repetição, é a própria carga. */
export function epley(kg, reps) {
  if (!kg || !reps) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

/** Histórico do exercício em sessões finalizadas, do mais antigo para o mais recente. */
export async function exerciseHistory(exerciseId, { before = Infinity, excludeId } = {}) {
  const list = await db.sessions.where('exerciseIds').equals(exerciseId).toArray();
  return list
    .filter(s => s.status === 'done' && s.id !== excludeId && s.startedAt < before)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map(s => summarizeExercise(s, exerciseId))
    .filter(Boolean);
}

const belowMin = (h, repMin) => h.sets.some(st => (st.reps ?? 0) < repMin);
const progressed = (prev, cur) => cur.maxKg > prev.maxKg || (cur.maxKg === prev.maxKg && cur.repsAtMax > prev.repsAtMax);

/**
 * @param history  resumos do mais antigo ao mais recente (exerciseHistory)
 * @param planned  { repMin, repMax, increment } da sessão atual
 * @returns { kind: 'up'|'reduce'|'hold'|'stalled'|'reps', text } ou null sem histórico
 */
export function suggest(history, planned, { bodyweight = false } = {}) {
  const last = history.at(-1);
  if (!last || !planned) return null;
  const { repMin, repMax } = planned;
  const inc = planned.increment > 0 ? planned.increment : 2.5;
  const kg = last.maxKg;

  // Peso corporal sem carga extra: a progressão é por repetições, não por kg.
  if (bodyweight && !kg) return suggestBodyweight(history, repMin, repMax);

  const allTop = last.sets.every(st => (st.reps ?? 0) >= repMax);
  const rirFail = last.sets.some(st => st.rir === 0 && (st.reps ?? 0) < repMax);
  if (allTop && !rirFail) return { kind: 'up', text: `Suba para ${fmtKg(round(kg + inc))} kg` };

  const prev = history.at(-2);
  if (belowMin(last, repMin) && prev && belowMin(prev, repMin)) {
    const to = Math.max(0, round(kg - inc));
    return { kind: 'reduce', text: `Considere reduzir para ${fmtKg(to)} kg` };
  }
  if (belowMin(last, repMin)) return { kind: 'hold', text: `Mantenha ${fmtKg(kg)} kg` };

  if (history.length >= 4) {
    const tail = history.slice(-4);
    const stalled = [1, 2, 3].every(i => !progressed(tail[i - 1], tail[i]));
    if (stalled) return { kind: 'stalled', text: 'Estagnado: considere trocar a variação ou a faixa de repetições' };
  }

  return { kind: 'reps', text: `Mantenha ${fmtKg(kg)} kg e tente mais repetições` };
}

/** Mesmas regras, em repetições, para exercícios com o peso do corpo (ex: barra fixa, paralelas). */
function suggestBodyweight(history, repMin, repMax) {
  const last = history.at(-1);
  const prev = history.at(-2);
  if (last.sets.every(st => (st.reps ?? 0) >= repMax)) {
    return { kind: 'up', text: 'Topo da faixa em todas as séries: suba a meta de repetições ou adicione carga (ex: cinto com anilha)' };
  }
  if (belowMin(last, repMin) && prev && belowMin(prev, repMin)) {
    return { kind: 'reduce', text: 'Abaixo do mínimo de novo: considere uma versão mais fácil (ex: com auxílio) ou baixar a faixa de reps' };
  }
  if (belowMin(last, repMin)) return { kind: 'hold', text: `Mantenha e tente chegar a ${repMin} reps em todas as séries` };
  if (history.length >= 4) {
    const tail = history.slice(-4);
    const reps = h => h.sets.reduce((a, st) => a + (st.reps ?? 0), 0);
    if ([1, 2, 3].every(i => reps(tail[i]) <= reps(tail[i - 1]))) {
      return { kind: 'stalled', text: 'Estagnado: considere trocar a variação ou a faixa de repetições' };
    }
  }
  return { kind: 'reps', text: 'Tente fazer mais repetições que da última vez' };
}
