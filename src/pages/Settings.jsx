import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting, requestPersistence } from '../db.js';
import { applyTheme } from '../theme.js';
import { exportBackup, readBackupFile, restoreBackup, summarize, BACKUP_REMINDER_DAYS } from '../backup.js';
import { fmtDate, relativeDay } from '../format.js';

function BackupCard() {
  const lastBackupAt = useLiveQuery(() => db.settings.get('lastBackupAt').then(r => r?.value ?? null), []);
  const fileRef = useRef();
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function doExport() {
    setBusy(true); setMsg(null);
    try {
      const r = await exportBackup();
      if (r === 'shared') setMsg({ ok: true, text: 'Backup gerado. Escolha “Salvar em Arquivos” para guardar no iCloud Drive.' });
      if (r === 'downloaded') setMsg({ ok: true, text: 'Arquivo de backup baixado.' });
    } catch (e) {
      setMsg({ ok: false, text: `Não foi possível exportar: ${e.message}` });
    } finally { setBusy(false); }
  }

  async function doImport(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setMsg(null);
    try {
      const data = await readBackupFile(file);
      const incoming = summarize(data.tables);
      const current = summarize({
        workouts: await db.workouts.toArray(), sessions: await db.sessions.toArray(),
        customExercises: await db.customExercises.toArray(), cardio: await db.cardio.toArray(),
      });
      const ok = confirm(
        `Restaurar backup de ${fmtDate(data.exportedAt)}?\n\n` +
        `Arquivo: ${incoming.workouts} treinos, ${incoming.sessions} sessões, ${incoming.cardio} cardios, ${incoming.custom} exercícios personalizados.\n` +
        `Atual (será SUBSTITUÍDO): ${current.workouts} treinos, ${current.sessions} sessões, ${current.cardio} cardios, ${current.custom} exercícios personalizados.\n\n` +
        'Os dados atuais deste aparelho serão apagados e trocados pelos do arquivo.');
      if (!ok) return;
      setBusy(true);
      await restoreBackup(data);
      const theme = data.tables.settings?.find(s => s.key === 'theme')?.value ?? 'system';
      applyTheme(theme);
      setMsg({ ok: true, text: 'Dados restaurados com sucesso.' });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally { setBusy(false); }
  }

  const days = lastBackupAt ? Math.floor((Date.now() - lastBackupAt) / 86400000) : null;
  return (
    <section className="card">
      <h2>Backup</h2>
      <p className="muted small">Os dados ficam só neste aparelho. Exporte de vez em quando e guarde o arquivo no iCloud Drive.</p>
      <p>Último backup: <strong>{lastBackupAt === undefined ? '…' : lastBackupAt ? `${relativeDay(lastBackupAt)} (${fmtDate(lastBackupAt)})` : 'nunca'}</strong></p>
      {(days === null || days > BACKUP_REMINDER_DAYS) && lastBackupAt !== undefined && (
        <p className="warn small">{days === null ? 'Recomendado fazer o primeiro backup.' : `Faz mais de ${BACKUP_REMINDER_DAYS} dias desde o último backup.`}</p>
      )}
      <div className="btn-row">
        <button className="btn primary" disabled={busy} onClick={doExport}>Exportar dados</button>
        <button className="btn" disabled={busy} onClick={() => fileRef.current.click()}>Importar dados</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
      {msg && <p className={msg.ok ? 'ok small' : 'error small'}>{msg.text}</p>}
    </section>
  );
}

const THEMES = [['system', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']];

export default function Settings() {
  const theme = useLiveQuery(() => db.settings.get('theme').then(r => r?.value ?? 'system'), []);
  const [persist, setPersist] = useState(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    requestPersistence().then(setPersist);
    navigator.storage?.estimate?.().then(e => setUsage(e.usage));
  }, []);

  function chooseTheme(t) {
    applyTheme(t);
    setSetting('theme', t);
  }

  return (
    <>
      <header className="page-header"><h1>Ajustes</h1></header>
      <section className="card">
        <h2>Aparência</h2>
        <div className="segmented" role="radiogroup">
          {THEMES.map(([k, label]) => (
            <button key={k} role="radio" aria-checked={theme === k} className={theme === k ? 'on' : ''} onClick={() => chooseTheme(k)}>{label}</button>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Armazenamento</h2>
        <p className="muted">Seus dados ficam só neste aparelho. Nada é enviado para servidores.</p>
        <p>Armazenamento persistente: <strong>{
          { granted: 'ativo', denied: 'não concedido', unsupported: 'não suportado' }[persist] ?? '…'
        }</strong></p>
        {persist === 'denied' && <p className="muted small">No iPhone, adicione o app à Tela de Início para o sistema preservar os dados.</p>}
        {usage != null && <p className="muted small">Em uso: {(usage / 1048576).toFixed(1)} MB (inclui imagens offline)</p>}
      </section>
      <BackupCard />
      <p className="muted small center">Exercícios: Free Exercise DB (domínio público).</p>
    </>
  );
}
