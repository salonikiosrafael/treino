import { db, getSetting, setSetting } from './db.js';

/*
 * Formato do backup (JSON):
 * { app: 'treino', format: 1, dbVersion, exportedAt, tables: { <tabela>: [registros...] } }
 * Exporta TODAS as tabelas do banco automaticamente — tabelas criadas em fases futuras
 * (ex: cardio) entram sem precisar mexer aqui.
 */
export const BACKUP_FORMAT = 1;
const LOCAL_ONLY_SETTINGS = new Set(['lastBackupAt']); // não faz sentido restaurar

export async function buildBackup() {
  const tables = {};
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) tables[t.name] = await t.toArray();
  });
  tables.settings = tables.settings.filter(s => !LOCAL_ONLY_SETTINGS.has(s.key));
  return { app: 'treino', format: BACKUP_FORMAT, dbVersion: db.verno, exportedAt: Date.now(), tables };
}

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Gera o arquivo e abre o menu de compartilhamento (iOS: "Salvar em Arquivos" → iCloud Drive).
 * Sem suporte a compartilhar arquivos, faz download. Retorna 'shared' | 'downloaded' | 'cancelled'.
 */
export async function exportBackup() {
  const data = await buildBackup();
  const name = `treino-backup-${stamp()}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup do Treino' });
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      throw err;
    }
    await setSetting('lastBackupAt', Date.now());
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await setSetting('lastBackupAt', Date.now());
  return 'downloaded';
}

/** Lê e valida o arquivo. Lança Error com mensagem amigável se inválido. */
export async function readBackupFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (data?.app !== 'treino' || typeof data.tables !== 'object') throw new Error('Este arquivo não é um backup do Treino.');
  if (data.format > BACKUP_FORMAT || data.dbVersion > db.verno) {
    throw new Error('Este backup foi feito por uma versão mais nova do app. Atualize o app e tente de novo.');
  }
  const known = new Set(db.tables.map(t => t.name));
  for (const [name, rows] of Object.entries(data.tables)) {
    if (!known.has(name)) continue;
    if (!Array.isArray(rows)) throw new Error(`Backup corrompido (tabela ${name}).`);
  }
  return data;
}

export const summarize = tables => ({
  workouts: tables.workouts?.length ?? 0,
  sessions: (tables.sessions ?? []).filter(s => s.status === 'done').length,
  custom: tables.customExercises?.length ?? 0,
  cardio: tables.cardio?.length ?? 0,
});

/** Substitui todos os dados pelos do backup, numa única transação (tudo ou nada). */
export async function restoreBackup(data) {
  const lastBackupAt = await getSetting('lastBackupAt');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      const rows = data.tables[t.name];
      if (Array.isArray(rows) && rows.length) await t.bulkPut(rows);
    }
    if (lastBackupAt) await db.settings.put({ key: 'lastBackupAt', value: lastBackupAt });
  });
}

export const BACKUP_REMINDER_DAYS = 14;

/** Dias desde o último backup, ou null se nunca foi feito. */
export async function daysSinceBackup() {
  const ts = await getSetting('lastBackupAt');
  return ts ? Math.floor((Date.now() - ts) / 86400000) : null;
}
