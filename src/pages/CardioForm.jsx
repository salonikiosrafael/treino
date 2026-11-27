import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db.js';
import { CARDIO_TYPES, INTENSITY_LABELS, blankCardio, saveCardio, deleteCardio } from '../cardio.js';
import { toLocalInput } from '../format.js';
import NumField from '../components/NumField.jsx';

/** Registrar (/cardio/novo) ou editar (/cardio/:id) uma atividade de cardio. Só grava ao tocar em Salvar. */
export default function CardioForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = !id;
  const [form, setFormState] = useState(isNew ? blankCardio() : undefined);
  const latest = useRef(form);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isNew) return;
    db.cardio.get(id).then(c => { latest.current = c ?? null; setFormState(c ?? null); });
  }, [id, isNew]);

  const set = patch => { latest.current = { ...latest.current, ...patch }; setFormState(latest.current); };

  if (form === undefined) return null;
  if (form === null) return <><Header nav={nav} title="Cardio" /><p className="empty">Registro não encontrado.</p></>;

  const swim = form.type === 'natacao';

  async function save() {
    // espera um tique para o campo em foco confirmar o valor (onBlur) antes de ler
    await new Promise(r => setTimeout(r, 0));
    const c = latest.current;
    if (!c.durationMin) { setError('Informe a duração.'); return; }
    if (c.type === 'outro' && !c.label.trim()) { setError('Descreva a atividade (ex: elíptico, corrida na rua).'); return; }
    await saveCardio({ ...c, label: c.label.trim() });
    nav(-1);
  }

  async function remove() {
    if (!confirm('Excluir este registro de cardio? Não dá para desfazer.')) return;
    await deleteCardio(form.id);
    nav(-1);
  }

  return (
    <>
      <Header nav={nav} title={isNew ? 'Registrar cardio' : 'Editar cardio'} />

      <section className="card">
        <h2>Tipo</h2>
        <div className="segmented" role="radiogroup">
          {CARDIO_TYPES.map(t => (
            <button key={t.key} role="radio" aria-checked={form.type === t.key}
              className={form.type === t.key ? 'on' : ''} onClick={() => set({ type: t.key })}>{t.label}</button>
          ))}
        </div>
        {form.type === 'outro' && (
          <input className="field" style={{ marginTop: 10 }} placeholder="Qual atividade? (ex: elíptico)" value={form.label}
            onChange={e => set({ label: e.target.value })} />
        )}
      </section>

      <section className="card">
        <div className="meta-grid">
          <label className="num">
            <span className="num-label">Data e hora</span>
            <input type="datetime-local" value={toLocalInput(form.date)} onChange={e => {
              const ts = new Date(e.target.value).getTime();
              if (Number.isFinite(ts)) set({ date: ts });
            }} />
          </label>
          <NumField label="Duração *" suffix="min" value={form.durationMin} min={1} max={600} allowEmpty placeholder="obrigatório"
            onCommit={v => set({ durationMin: v })} />
        </div>
        <h3 className="opt-title">Opcional</h3>
        <div className="cardio-grid">
          {swim
            ? <NumField label="Distância" suffix="m" value={form.distanceKm != null ? Math.round(form.distanceKm * 1000) : null} max={20000} allowEmpty
                onCommit={v => set({ distanceKm: v == null ? null : v / 1000 })} />
            : <NumField label="Distância" suffix="km" decimal value={form.distanceKm} max={300} allowEmpty
                onCommit={v => set({ distanceKm: v })} />}
          <NumField label="Velocidade" suffix="km/h" decimal value={form.speed} max={80} allowEmpty onCommit={v => set({ speed: v })} />
          {!swim && <NumField label="Inclinação" suffix="%" decimal value={form.incline} max={40} allowEmpty onCommit={v => set({ incline: v })} />}
        </div>

        <div className="num-label" style={{ marginTop: 14 }}>
          Intensidade percebida {form.intensity != null && <span className="muted">— {form.intensity}/10, {INTENSITY_LABELS[form.intensity]}</span>}
        </div>
        <div className="rpe" role="radiogroup" aria-label="Intensidade percebida">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} role="radio" aria-checked={form.intensity === n} className={form.intensity === n ? 'on' : ''}
              onClick={() => set({ intensity: form.intensity === n ? null : n })}>{n}</button>
          ))}
        </div>
      </section>

      {error && <p className="error small">{error}</p>}
      <button className="btn primary block" onClick={save}>Salvar</button>
      {!isNew && <button className="btn danger block" style={{ marginTop: 16 }} onClick={remove}>Excluir registro</button>}
    </>
  );
}

function Header({ nav, title }) {
  return (
    <header className="page-header">
      <button className="btn small ghost" onClick={() => nav(-1)}>‹ Voltar</button>
      <h1 className="header-title">{title}</h1>
    </header>
  );
}
