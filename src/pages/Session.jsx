import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useAllExercises, equipmentLabel, variationSort } from '../exercises.js';
import {
  updateSession, addSet, removeSet, setField, swapExercise, saveNote, finishSession, deleteSession,
  isFilled, sessionVolume, addDrop, removeDrop, setDropField, cleanSet,
} from '../sessions.js';
import { exerciseHistory, suggest } from '../progression.js';
import { fmtClock, fmtSets, relativeDay, fmtKg, toLocalInput } from '../format.js';
import { parseNum, fmtNum } from '../workouts.js';
import { useNow } from '../hooks.js';
import { Thumb } from '../components/ExerciseBrowser.jsx';
import NumField from '../components/NumField.jsx';

/** Sessão em andamento (status 'active') ou edição de uma sessão do histórico (status 'done'). */
export default function Session() {
  const { id } = useParams();
  const nav = useNavigate();
  const s = useLiveQuery(() => db.sessions.get(id), [id]);
  const all = useAllExercises();
  const exMap = useMemo(() => all && new Map(all.map(e => [e.id, e])), [all]);

  // Ao sair da edição de uma sessão finalizada, descarta linhas de série deixadas vazias.
  useEffect(() => () => {
    updateSession(id, x => (x.status === 'done'
      ? { ...x, exercises: x.exercises.map(e => ({ ...e, sets: e.sets.filter(isFilled).map(cleanSet) })) }
      : x));
  }, [id]);

  if (s === undefined || !exMap) return null;
  if (!s) return <p className="empty">Sessão não encontrada. <Link to="/historico">Ver histórico</Link></p>;

  const live = s.status === 'active';

  async function finish() {
    const pending = s.exercises.reduce((n, e) => n + e.sets.filter(st => !isFilled(st)).length, 0);
    const msg = pending ? `Finalizar o treino? ${pending} série(s) vazia(s) serão descartadas.` : 'Finalizar o treino?';
    if (!confirm(msg)) return;
    const ok = await finishSession(id);
    if (!ok) {
      if (confirm('Nenhuma série foi registrada. Descartar esta sessão?')) { await deleteSession(id); nav('/', { replace: true }); }
      return;
    }
    nav('/', { replace: true });
  }

  async function discard() {
    const msg = live ? 'Cancelar esta sessão? Tudo o que foi registrado nela será perdido.' : 'Excluir esta sessão do histórico? Não dá para desfazer.';
    if (!confirm(msg)) return;
    await deleteSession(id);
    nav(live ? '/' : '/historico', { replace: true });
  }

  return (
    <>
      <header className="page-header session-header">
        <button className="btn small ghost" onClick={() => nav(live ? '/' : '/historico')}>‹ {live ? 'Treinos' : 'Histórico'}</button>
        <span style={{ flex: 1 }} />
        {live && <button className="btn small primary" onClick={finish}>Finalizar</button>}
      </header>

      <SessionHero s={s} live={live} />
      {!live && <HistoryMeta s={s} />}

      <ol className="sx-list">
        {s.exercises.map((ex, i) => (
          <ExerciseBlock key={ex.uid} s={s} ex={ex} index={i} exMap={exMap} all={all} />
        ))}
      </ol>

      {live && <button className="btn primary block" onClick={finish}>Finalizar treino</button>}
      <button className="btn danger block" style={{ marginTop: 16 }} onClick={discard}>
        {live ? 'Cancelar sessão' : 'Excluir sessão'}
      </button>
    </>
  );
}

/** Cabeçalho colorido: nome, cronômetro (ou data) e progresso das séries. */
function SessionHero({ s, live }) {
  const total = s.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = s.exercises.reduce((n, e) => n + e.sets.filter(isFilled).length, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <section className={live ? 'session-hero' : 'session-hero past'}>
      <div className="sh-top">
        <h1 className="sh-title">{s.workoutName}</h1>
        {live ? <LiveClock startedAt={s.startedAt} /> : <span className="sh-date">{new Date(s.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>}
      </div>
      <div className="sh-progress" aria-label={`${done} de ${total} séries`}><i style={{ width: `${pct}%` }} /></div>
      <div className="sh-stats">
        <span><strong>{done}</strong>/{total} séries</span>
        <span><strong>{s.exercises.length}</strong> {s.exercises.length === 1 ? 'exercício' : 'exercícios'}</span>
        <span><strong>{fmtKg(Math.round(sessionVolume(s)))}</strong> kg</span>
      </div>
    </section>
  );
}

function LiveClock({ startedAt }) {
  const now = useNow(1000);
  return <span className="sh-clock">{fmtClock(Math.max(0, Math.floor((now - startedAt) / 1000)))}</span>;
}

function HistoryMeta({ s }) {
  const sets = s.exercises.reduce((n, e) => n + e.sets.filter(isFilled).length, 0);
  return (
    <section className="card">
      <div className="meta-grid">
        <label className="num">
          <span className="num-label">Início</span>
          <input type="datetime-local" value={toLocalInput(s.startedAt)} onChange={e => {
            const ts = new Date(e.target.value).getTime();
            if (Number.isFinite(ts)) updateSession(s.id, x => ({ ...x, startedAt: ts, finishedAt: ts + (x.durationSec ?? 0) * 1000 }));
          }} />
        </label>
        <NumField label="Duração" suffix="min" value={s.durationSec != null ? Math.round(s.durationSec / 60) : null} min={0} max={600}
          onCommit={m => updateSession(s.id, x => ({ ...x, durationSec: m * 60, finishedAt: x.startedAt + m * 60000 }))} />
      </div>
      <p className="muted small">{sets} séries · volume {fmtKg(sessionVolume(s))} kg</p>
    </section>
  );
}

function ExerciseBlock({ s, ex, index, exMap, all }) {
  const e = exMap.get(ex.exerciseId);
  const history = useLiveQuery(() => exerciseHistory(ex.exerciseId, { before: s.startedAt, excludeId: s.id }), [ex.exerciseId, s.startedAt, s.id]);
  const last = history === undefined ? undefined : history.at(-1) ?? null;
  const tip = s.status === 'active' && history ? suggest(history, ex.planned) : null;
  const [swapOpen, setSwapOpen] = useState(false);
  const p = ex.planned;

  const filledCount = ex.sets.filter(isFilled).length;
  const complete = ex.sets.length > 0 && filledCount === ex.sets.length;

  return (
    <li className={complete ? 'sx-card complete' : 'sx-card'}>
      <div className="sx-head">
        <Thumb e={e} />
        <div className="ex-meta">
          <div className="sx-pos">Exercício {index + 1}{complete && <span className="sx-done"> · ✓ feito</span>}</div>
          {e
            ? <Link to={`/exercicio/${encodeURIComponent(e.id)}`} className="ex-name plain sx-name">{e.name}</Link>
            : <span className="ex-name">Exercício removido</span>}
          {p && <span className="meta-chip">{p.sets} × {p.repMin === p.repMax ? p.repMin : `${p.repMin}–${p.repMax}`} reps</span>}
        </div>
        <button className="btn small ghost swap-btn" onClick={() => setSwapOpen(o => !o)}>{swapOpen ? 'Fechar' : 'Trocar'}</button>
      </div>

      {swapOpen && <SwapList s={s} ex={ex} current={e} all={all} onDone={() => setSwapOpen(false)} />}

      <div className="ref">
        {last === undefined ? '…' : last
          ? <><span className="ref-label">Última vez · {relativeDay(last.date)}</span><span className="ref-sets">{fmtSets(last.sets) || '—'}</span></>
          : <span className="muted">Primeira vez neste exercício.</span>}
      </div>
      {tip && <div className={`tip tip-${tip.kind}`}>{tip.text}</div>}

      <NoteField s={s} ex={ex} />

      <div className="sets">
        <div className="set-row set-head">
          <span>Série</span><span>kg</span><span>Reps</span><span>RIR</span><span />
        </div>
        {ex.sets.map((st, i) => (
          <SetRow key={i} s={s} ex={ex} st={st} i={i} prev={last?.sets?.[i]} />
        ))}
        <button className="add-set" onClick={() => addSet(s.id, ex.uid)}>+ Adicionar série</button>
      </div>
    </li>
  );
}

/** Uma série: carga/reps/RIR, com o valor da última vez em cinza dentro do campo, e drops opcionais. */
function SetRow({ s, ex, st, i, prev }) {
  const [menu, setMenu] = useState(false);
  const done = st.kg != null && st.reps != null;
  return (
    <div className={done ? 'set-wrap done' : 'set-wrap'}>
      <div className="set-row">
        <span className="set-n">{done ? '✓' : i + 1}</span>
        <SetInput value={st.kg} decimal placeholder={prev?.kg != null ? fmtKg(prev.kg) : 'kg'}
          onSave={v => setField(s.id, ex.uid, i, 'kg', v)} />
        <SetInput value={st.reps} placeholder={prev?.reps != null ? String(prev.reps) : 'reps'}
          onSave={v => setField(s.id, ex.uid, i, 'reps', v)} />
        <SetInput value={st.rir} placeholder={prev?.rir != null ? String(prev.rir) : '–'} max={10}
          onSave={v => setField(s.id, ex.uid, i, 'rir', v)} />
        <button className="set-more" aria-label={`Opções da série ${i + 1}`} aria-expanded={menu} onClick={() => setMenu(m => !m)}>⋯</button>
      </div>
      {(st.drops ?? []).map((d, j) => (
        <div className="set-row drop-row" key={j}>
          <span className="drop-label">↓ drop</span>
          <SetInput value={d.kg} decimal placeholder="kg" onSave={v => setDropField(s.id, ex.uid, i, j, 'kg', v)} />
          <SetInput value={d.reps} placeholder="reps" onSave={v => setDropField(s.id, ex.uid, i, j, 'reps', v)} />
          <span />
          <button className="set-del" aria-label="Remover drop" onClick={() => removeDrop(s.id, ex.uid, i, j)}>×</button>
        </div>
      ))}
      {menu && (
        <div className="set-menu">
          <button onClick={() => { addDrop(s.id, ex.uid, i); setMenu(false); }}>↓ Adicionar dropset</button>
          <button className="danger" onClick={() => {
            if (!isFilled(st) || confirm(`Remover a série ${i + 1}?`)) { removeSet(s.id, ex.uid, i); setMenu(false); }
          }}>Remover série</button>
        </div>
      )}
    </div>
  );
}

/**
 * Campo de série: sempre começa vazio — o valor da última vez aparece só como dica em cinza (placeholder).
 * Salva a cada digitação para não perder nada se o app for fechado.
 */
function SetInput({ value, onSave, decimal = false, placeholder, max = 9999 }) {
  const [text, setText] = useState(fmtNum(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(fmtNum(value)); }, [value]);

  function change(t) {
    setText(t);
    if (t.trim() === '') return onSave(null);
    let n = parseNum(t);
    if (n == null || n < 0) return;
    if (!decimal) n = Math.round(n);
    onSave(Math.min(max, n));
  }

  return (
    <input
      className="set-input"
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      placeholder={placeholder}
      onFocus={e => { focused.current = true; e.target.select(); }}
      onBlur={() => { focused.current = false; setText(fmtNum(value)); }}
      onChange={e => change(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

function NoteField({ s, ex }) {
  const [text, setText] = useState(ex.note ?? '');
  const [open, setOpen] = useState(!!ex.note);
  const [focusNow, setFocusNow] = useState(false);
  const timer = useRef();
  useEffect(() => { setText(ex.note ?? ''); setOpen(o => o || !!ex.note); }, [ex.exerciseId]); // eslint-disable-line

  const save = t => { clearTimeout(timer.current); timer.current = setTimeout(() => saveNote(s.id, ex.uid, ex.exerciseId, t.trim()), 500); };
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!open) return <button className="note-add" onClick={() => { setOpen(true); setFocusNow(true); }}>+ Nota</button>;
  return (
    <textarea
      autoFocus={focusNow}
      className="note"
      rows={1}
      value={text}
      placeholder="Nota (ex: banco na posição 4) — aparece nas próximas vezes"
      onChange={e => { setText(e.target.value); save(e.target.value); }}
      onBlur={() => { clearTimeout(timer.current); saveNote(s.id, ex.uid, ex.exerciseId, text.trim()); }}
    />
  );
}

function SwapList({ s, ex, current, all, onDone }) {
  const options = useMemo(() => {
    if (!current) return [];
    return all.filter(x => x.group === current.group && x.id !== current.id).sort(variationSort);
  }, [all, current]);

  const [pending, setPending] = useState(null); // variação escolhida aguardando "manter ou limpar"
  const filled = ex.sets.filter(isFilled).length;

  async function pick(o, clearSets = false) {
    await swapExercise(s.id, ex.uid, o.id, { clearSets });
    onDone();
  }

  if (!options.length) return <p className="muted small swap-empty">Não há variações cadastradas para este movimento.</p>;
  if (pending) {
    return (
      <div className="swap-confirm">
        <p>Trocar para <strong>{pending.name}</strong>. Você já registrou {filled} {filled === 1 ? 'série' : 'séries'} neste exercício. O que fazer com {filled === 1 ? 'ela' : 'elas'}?</p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => pick(pending, false)}>Manter séries</button>
          <button className="btn" onClick={() => pick(pending, true)}>Limpar séries</button>
        </div>
        <button className="btn small ghost" onClick={() => setPending(null)}>Voltar às variações</button>
      </div>
    );
  }
  return (
    <ul className="ex-list swap-list">
      {options.map(o => (
        <li key={o.id}>
          <button className="ex-row" onClick={() => (filled ? setPending(o) : pick(o))}>
            <Thumb e={o} />
            <div className="ex-meta">
              <div className="ex-name">{o.name}</div>
              <div className="ex-sub">{equipmentLabel(o.equipment)}</div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

