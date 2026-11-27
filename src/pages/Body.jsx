import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { BODY_FIELDS, bodyField, blankBody, hasAnyValue, saveBody, deleteBody, allBody } from '../body.js';
import { fmtDate, fmtKg, toLocalInput, relativeDay } from '../format.js';
import NumField from '../components/NumField.jsx';

const LineChart = lazy(() => import('../components/ProgressCharts.jsx').then(m => ({ default: m.LineChart })));

/** Variação entre o primeiro e o último valor de uma medida: "−2,4 kg desde 01/10". */
export function bodyTrend(list, key) {
  const vals = list.filter(b => b[key] != null);
  if (!vals.length) return null;
  const last = vals.at(-1);
  const first = vals[0];
  return { last, first, diff: vals.length > 1 ? last[key] - first[key] : null, count: vals.length };
}

/** /corpo — gráfico da medida escolhida + lista de registros. */
export default function Body() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const list = useLiveQuery(allBody, []);
  if (!list) return null;

  const withData = BODY_FIELDS.filter(f => list.some(b => b[f.key] != null));
  const key = params.get('m') && bodyField(params.get('m')) ? params.get('m') : withData[0]?.key ?? 'weight';
  const f = bodyField(key);
  const trend = bodyTrend(list, key);
  const series = list.filter(b => b[key] != null).map(b => ({ date: b.date, value: b[key] }));

  return (
    <>
      <header className="page-header">
        <button className="btn small ghost" onClick={() => nav('/progresso')}>‹ Progresso</button>
        <h1 className="header-title">Corpo</h1>
        <Link to="/corpo/novo" className="btn small primary">+ Registrar</Link>
      </header>

      {!list.length ? (
        <div className="empty">
          <p>Registre seu peso e, se quiser, suas medidas para acompanhar a evolução.</p>
          <Link to="/corpo/novo" className="btn primary">Primeiro registro</Link>
        </div>
      ) : (
        <>
          {withData.length > 1 && (
            <div className="chips body-chips" role="radiogroup" aria-label="Medida">
              {withData.map(x => (
                <button key={x.key} role="radio" aria-checked={x.key === key} className={x.key === key ? 'chip on' : 'chip'}
                  onClick={() => setParams({ m: x.key }, { replace: true })}>{x.label}</button>
              ))}
            </div>
          )}
          <section className="card chart-card">
            <div className="chart-head">
              <h2>{f.label}</h2>
              {trend && <span className="muted small">atual <strong className="text">{fmtKg(trend.last[key])} {f.unit}</strong></span>}
            </div>
            {trend?.diff != null && (
              <p className={trend.diff === 0 ? 'body-diff' : trend.diff > 0 ? 'body-diff up' : 'body-diff down'}>
                {trend.diff > 0 ? '▲ +' : trend.diff < 0 ? '▼ −' : '= '}{fmtKg(Math.abs(Math.round(trend.diff * 10) / 10))} {f.unit} desde {fmtDate(trend.first.date)}
              </p>
            )}
            {series.length >= 2
              ? <Suspense fallback={<p className="muted small">Carregando gráfico…</p>}><LineChart history={series} metric={{ key: 'value', unit: f.unit }} /></Suspense>
              : <p className="muted small">Com 2 registros ou mais, o gráfico aparece aqui.</p>}
          </section>

          <h2 className="section-title">Registros</h2>
          <ul className="ex-list">
            {list.slice().reverse().map(b => (
              <li key={b.id}>
                <Link className="ex-row body-row" to={`/corpo/${b.id}`}>
                  <div className="ex-meta">
                    <div className="h-top"><span className="ex-name">{b.weight != null ? `${fmtKg(b.weight)} kg` : 'Medidas'}</span>
                      <span className="muted small">{relativeDay(b.date)}</span></div>
                    <div className="stat-chips">
                      {BODY_FIELDS.filter(x => x.key !== 'weight' && b[x.key] != null).map(x => <span key={x.key}>{x.label} {fmtKg(b[x.key])} {x.unit}</span>)}
                    </div>
                  </div>
                  <span className="chev">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** /corpo/novo e /corpo/:id */
export function BodyForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = !id;
  const [form, setFormState] = useState(isNew ? blankBody() : undefined);
  const latest = useRef(form);
  const [error, setError] = useState(null);
  const lastEntry = useLiveQuery(() => db.body.orderBy('date').last(), []);

  useEffect(() => {
    if (isNew) return;
    db.body.get(id).then(b => { latest.current = b ?? null; setFormState(b ?? null); });
  }, [id, isNew]);

  const set = patch => { latest.current = { ...latest.current, ...patch }; setFormState(latest.current); };
  if (form === undefined) return null;
  if (form === null) return <p className="empty">Registro não encontrado. <Link to="/corpo">Voltar</Link></p>;

  async function save() {
    await new Promise(r => setTimeout(r, 0)); // deixa o campo em foco confirmar o valor
    if (!hasAnyValue(latest.current)) { setError('Preencha pelo menos o peso ou uma medida.'); return; }
    await saveBody(latest.current);
    nav(-1);
  }
  async function remove() {
    if (!confirm('Excluir este registro? Não dá para desfazer.')) return;
    await deleteBody(form.id);
    nav(-1);
  }

  const [main, ...rest] = BODY_FIELDS;
  const ref = isNew ? lastEntry : null; // última medição como dica em cinza
  return (
    <>
      <header className="page-header">
        <button className="btn small ghost" onClick={() => nav(-1)}>‹ Voltar</button>
        <h1 className="header-title">{isNew ? 'Registrar medidas' : 'Editar registro'}</h1>
      </header>

      <section className="card">
        <div className="card-head"><h2>Peso</h2><span className="muted small">{ref?.weight != null ? `último: ${fmtKg(ref.weight)} kg` : ''}</span></div>
        <NumField className="big-field" decimal suffix="kg" value={form.weight} max={main.max} allowEmpty
          placeholder={ref?.weight != null ? fmtKg(ref.weight) : '0'} onCommit={v => set({ weight: v })} />
        <label className="when-row">
          <span className="muted">Data</span>
          <input type="datetime-local" value={toLocalInput(form.date)} onChange={e => {
            const ts = new Date(e.target.value).getTime();
            if (Number.isFinite(ts)) set({ date: ts });
          }} />
        </label>
      </section>

      <section className="card">
        <div className="card-head"><h2>Medidas</h2><span className="muted small">opcional</span></div>
        <div className="body-grid">
          {rest.map(x => (
            <NumField key={x.key} label={x.label} suffix={x.unit} decimal value={form[x.key]} max={x.max} allowEmpty
              placeholder={ref?.[x.key] != null ? fmtKg(ref[x.key]) : ''} onCommit={v => set({ [x.key]: v })} />
          ))}
        </div>
        <p className="muted small">Dica: meça sempre no mesmo horário (ex: de manhã, em jejum) para comparar melhor.</p>
      </section>

      {!isNew && <button className="btn danger block" onClick={remove}>Excluir registro</button>}
      <div className="add-bar">
        {error && <span className="error small save-error">{error}</span>}
        <button className="btn primary block cardio-save body-save" onClick={save}>Salvar</button>
      </div>
    </>
  );
}
