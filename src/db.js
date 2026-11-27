import Dexie from 'dexie';

/*
 * REGRA PERMANENTE: nenhuma atualização pode apagar ou corromper dados dos usuários.
 *
 * Como evoluir o banco:
 *  - NUNCA edite uma versão já publicada (nem os índices dela).
 *  - Para mudar algo, adicione db.version(N+1).stores({...}) com só as tabelas alteradas/novas
 *    e, se precisar transformar dados, um .upgrade(tx => ...) que preserve tudo o que existe.
 *  - Nunca use `null` para apagar tabela com dados sem migrá-los antes.
 *  - Teste a migração partindo de um banco da versão anterior com dados.
 *  - Backups (src/backup.js) guardam o dbVersion. Se um .upgrade() transformar o formato dos
 *    registros, aplique a mesma transformação ao importar um backup de versão anterior.
 */
export const db = new Dexie('treino');

// v1 — Fase 1
db.version(1).stores({
  // id string "custom-..." para nunca colidir com ids do dataset
  customExercises: 'id, name, equipment, createdAt',
  // pares chave/valor (tema, data do último backup, etc.)
  settings: 'key',
});

// v2 — Fase 2: treinos. Só adiciona tabela nova; v1 permanece intacta.
// workout = { id, name, order, items: [{ uid, exerciseId, sets, repMin, repMax, increment }], createdAt, updatedAt }
db.version(2).stores({
  workouts: 'id, order, updatedAt',
});

// v3 — Fase 3: sessões e notas por exercício. Só adiciona tabelas novas.
// session = {
//   id, workoutId, workoutName (cópia do nome na hora), status: 'active' | 'done',
//   startedAt, finishedAt, durationSec, exerciseIds: [...] (índice multiEntry p/ histórico por exercício),
//   exercises: [{ uid, exerciseId, planned: { sets, repMin, repMax, increment }, note, sets: [{ kg, reps, rir, drops? }] }]
//   (drops = [{ kg, reps }] opcional, adicionado em 2026-11 sem mudar índices — sessões antigas não têm)
// }
// exerciseNote = { exerciseId, text, updatedAt }  — nota "fixa" que aparece nas próximas sessões
db.version(3).stores({
  sessions: 'id, workoutId, status, startedAt, *exerciseIds',
  exerciseNotes: 'exerciseId',
});

// v4 — Fase 5: cardio. Só adiciona tabela nova.
// cardio = { id, date (início, ms), type: 'bike'|'esteira'|'natacao'|'outro', label (descrição p/ 'outro'),
//            durationMin, incline (%), speed (km/h), distanceKm, intensity (1–10), createdAt, updatedAt }
db.version(4).stores({
  cardio: 'id, date, type',
});

// v5 — "Meu plano": treinos ganham o campo `archived` (false = no plano, true = guardado fora do plano).
// Mesmas tabelas/índices; o upgrade só acrescenta archived: false em todos os treinos existentes,
// então tudo o que o usuário já tinha continua no plano. Registros sem o campo (ex: backup antigo)
// também são tratados como "no plano" (!w.archived), então importar um backup v4 continua funcionando.
db.version(5).stores({}).upgrade(tx =>
  tx.table('workouts').toCollection().modify(w => { if (w.archived === undefined) w.archived = false; }));

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return db.settings.put({ key, value });
}

/** Pede ao navegador para não apagar os dados sob pressão de espaço. */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'granted';
  return (await navigator.storage.persist()) ? 'granted' : 'denied';
}

export function newId(prefix) {
  const rnd = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${rnd}`;
}

export const newCustomId = () => newId('custom');
