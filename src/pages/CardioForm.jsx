import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db.js';
import { CARDIO_TYPES, INTENSITY_LABELS, blankCardio, saveCardio, deleteCardio, cardioTypeLabel, cardioDetails } from '../cardio.js';
import CardioIcon from '../components/CardioIcon.jsx';
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

  const derived = paceInfo(form);
  const summary = cardioDetails(form);

  return (
    <>
      <Header nav={nav} title={isNew ? 'Registrar cardio' : 'Editar cardio'} />

      <section className="cardio-hero">
        <div className="cardio-hero-icon"><CardioIcon type={form.type} size={34} /></div>
        <div>
          <div className="cardio-hero-title">{form.type === 'outro' ? (form.label.trim() || 'Outra atividade') : cardioTypeLabel(form.type)}</div>
          <div className="cardio-hero-sub">{summary || 'Escolha a atividade e a duração'}</div>
        </div>
      </section>

      <div className="type-tiles" role="radiogroup" aria-label="Tipo de cardio">
        {CARDIO_TYPES.map(t => (
          <button key={t.key} role="radio" aria-checked={form.type === t.key}
            className={form.type === t.key ? 'type-tile on' : 'type-tile'} onClick={() => set({ type: t.key })}>
            <CardioIcon type={t.key} size={28} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {form.type === 'outro' && (
        <input className="field other-input" placeholder="Qual atividade? (ex: elíptico, corrida na rua)" value={form.label}
          onChange={e => set({ label: e.target.value })} />
      )}

      <section className="card">
        <div className="card-head"><h2>Duração</h2><span className="muted small">obrigatório</span></div>
        <NumField className="big-field" suffix="min" value={form.durationMin} min={1} max={600} allowEmpty placeholder="0"
          onCommit={v => set({ durationMin: v })} />
        <div className="quick-chips">
          {[10, 15, 20, 30, 45, 60].map(m => (
            <button key={m} className={form.durationMin === m ? 'chip on' : 'chip'} onClick={() => set({ durationMin: m })}>{m} min</button>
          ))}
        </div>
        <label className="when-row">
          <span className="muted">Quando</span>
          <input type="datetime-local" value={toLocalInput(form.date)} onChange={e => {
            const ts = new Date(e.target.value).getTime();
            if (Number.isFinite(ts)) set({ date: ts });
          }} />
        </label>
      </section>

      <section className="card">
        <div className="card-head"><h2>Detalhes</h2><span className="muted small">opcional</span></div>
        <div className="cardio-grid">
          {swim
            ? <NumField label="Distância" suffix="m" value={form.distanceKm != null ? Math.round(form.distanceKm * 1000) : null} max={20000} allowEmpty
                onCommit={v => set({ distanceKm: v == null ? null : v / 1000 })} />
            : <NumField label="Distância" suffix="km" decimal value={form.distanceKm} max={300} allowEmpty
                onCommit={v => set({ distanceKm: v })} />}
          <NumField label="Velocidade" suffix="km/h" decimal value={form.speed} max={80} allowEmpty onCommit={v => set({ speed: v })} />
          {!swim && <NumField label="Inclinação" suffix="%" decimal value={form.incline} max={40} allowEmpty onCommit={v => set({ incline: v })} />}
        </div>
        {derived && <p className="derived">{derived}</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Intensidade</h2>
          <span className="muted small">como você sentiu</span>
        </div>
        <div className="rpe-big" style={form.intensity ? { color: rpeColor(form.intensity) } : undefined}>
          {form.intensity != null ? <><strong>{form.intensity}</strong>/10 · {INTENSITY_LABELS[form.intensity]}</> : <span className="muted">Toque para escolher</span>}
        </div>
        <div className="rpe" role="radiogroup" aria-label="Intensidade percebida">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} role="radio" aria-checked={form.intensity === n}
              className={form.intensity === n ? 'on' : form.intensity != null && n < form.intensity ? 'fill' : ''}
              style={{ '--rpe': rpeColor(n) }}
              onClick={() => set({ intensity: form.intensity === n ? null : n })}>{n}</button>
          ))}
        </div>
        <div className="rpe-scale muted small"><span>leve</span><span>moderada</span><span>máxima</span></div>
      </section>

      {!isNew && <button className="btn danger block" style={{ marginTop: 8 }} onClick={remove}>Excluir registro</button>}

      <div className="add-bar">
        {error && <span className="error small save-error">{error}</span>}
        <button className="btn primary block cardio-save" onClick={save}>Salvar</button>
      </div>
    </>
  );
}

const rpeColor = n => `hsl(${140 - ((n - 1) * 140) / 9} 70% 48%)`;

/** Ritmo/velocidade média calculados a partir de distância e duração. */
function paceInfo(c) {
  if (!c.durationMin || !c.distanceKm) return null;
  const fmt = n => String(Math.round(n * 10) / 10).replace('.', ',');
  const mmss = min => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`;
  if (c.type === 'natacao') return `Ritmo: ${mmss(c.durationMin / (c.distanceKm * 10))} min/100 m`;
  return `Velocidade média: ${fmt(c.distanceKm / (c.durationMin / 60))} km/h · ritmo ${mmss(c.durationMin / c.distanceKm)} min/km`;
}

function Header({ nav, title }) {
  return (
    <header className="page-header">
      <button className="btn small ghost" onClick={() => nav(-1)}>‹ Voltar</button>
      <h1 className="header-title">{title}</h1>
    </header>
  );
}
