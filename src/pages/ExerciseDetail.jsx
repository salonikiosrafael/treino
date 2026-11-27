import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAllExercises, equipmentLabel, muscleLabel, imageUrl, variationSort } from '../exercises.js';
import { Thumb } from '../components/ExerciseBrowser.jsx';
import { exerciseHistory } from '../progression.js';
import { fmtSets, relativeDay } from '../format.js';
import { useWorkoutPicker } from '../picker.js';

const ProgressCharts = lazy(() => import('../components/ProgressCharts.jsx'));

export default function ExerciseDetail() {
  // /exercicio/:id (biblioteca) ou /treino/:id/adicionar/ex/:exId (escolhendo para um treino)
  const { id: rawId, exId } = useParams();
  const id = exId ?? rawId;
  const workoutId = exId ? rawId : null;
  const pick = useWorkoutPicker(workoutId);
  const nav = useNavigate();
  const loc = useLocation();
  const all = useAllExercises();
  const e = all?.find(x => x.id === id);
  const history = useLiveQuery(() => exerciseHistory(id), [id]);
  const variations = useMemo(
    () => (all && e ? all.filter(x => x.group === e.group && x.id !== e.id).sort(variationSort) : []),
    [all, e],
  );

  if (!all) return null;
  if (!e) return <><BackHeader nav={nav} /><p className="empty">Exercício não encontrado.</p></>;

  return (
    <>
      <BackHeader nav={nav} right={e.custom && <Link className="btn small ghost" to={`/biblioteca/editar/${e.id}`}>Editar</Link>} />
      <AnimatedImages images={e.images} name={e.name} />
      <h1 className="detail-title">{e.name}</h1>
      {e.nameEn && <p className="muted small detail-en">{e.nameEn}</p>}

      <section className="card">
        <dl className="facts">
          <dt>Equipamento</dt><dd>{equipmentLabel(e.equipment)}</dd>
          <dt>Músculos principais</dt><dd>{e.primary.map(muscleLabel).join(', ') || '—'}</dd>
          {e.secondary.length > 0 && <><dt>Secundários</dt><dd>{e.secondary.map(muscleLabel).join(', ')}</dd></>}
        </dl>
      </section>

      <Progress history={history} />

      {e.instructions.length > 0 && (
        <section className="card">
          <h2>Execução <span className="muted small">(em inglês)</span></h2>
          <ol className="steps" lang="en">{e.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </section>
      )}

      {variations.length > 0 && (
        <section>
          <h2 className="section-title">Variações — {e.group}</h2>
          <ul className="ex-list">
            {variations.map(v => (
              <li key={v.id}>
                <Link className="ex-row" replace state={loc.state}
                  to={workoutId ? `/treino/${workoutId}/adicionar/ex/${encodeURIComponent(v.id)}` : `/exercicio/${encodeURIComponent(v.id)}`}>
                  <Thumb e={v} />
                  <div className="ex-meta">
                    <div className="ex-name">{v.name}</div>
                    <div className="ex-sub">{equipmentLabel(v.equipment)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {workoutId && pick.workout && <AddBar e={e} count={pick.picked.get(e.id) ?? 0} onPick={pick.onPick} nav={nav} />}
    </>
  );
}

/** Barra fixa no rodapé ao escolher exercícios para um treino. */
function AddBar({ e, count, onPick, nav }) {
  return (
    <div className="add-bar">
      {count
        ? <><span className="add-bar-in">✓ Já está no treino</span>
            <button className="btn danger" onClick={() => onPick(e)}>Remover</button></>
        : <button className="btn primary block" onClick={async () => { await onPick(e); nav(-1); }}>+ Adicionar ao treino</button>}
    </div>
  );
}

function BackHeader({ nav, right }) {
  return (
    <header className="page-header">
      <button className="btn small ghost" onClick={() => nav(-1)}>‹ Voltar</button>
      <span style={{ flex: 1 }} />
      {right}
    </header>
  );
}

/** Alterna entre as imagens (posição inicial/final) a cada ~1s para simular o movimento. */
function AnimatedImages({ images, name }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (images.length < 2) return;
    const t = setInterval(() => setI(n => (n + 1) % images.length), 1000);
    return () => clearInterval(t);
  }, [images]);
  if (!images.length) return <div className="hero hero-empty">{name.slice(0, 1)}</div>;
  return (
    <div className="hero">
      {images.map((src, n) => (
        <img key={src} src={imageUrl(src)} alt={n === 0 ? name : ''} className={n === i ? 'on' : ''} />
      ))}
    </div>
  );
}

function Progress({ history }) {
  if (!history) return null;
  if (!history.length) return <p className="muted small center progress-empty">Os gráficos de evolução aparecem depois da primeira sessão com este exercício.</p>;
  const last = history.at(-1);
  return (
    <>
      <h2 className="section-title">Progresso <span className="muted small">· {history.length} {history.length === 1 ? 'sessão' : 'sessões'}</span></h2>
      <p className="muted small progress-last">Última vez ({relativeDay(last.date)}): {fmtSets(last.sets)}</p>
      {history.length < 2
        ? <p className="muted small progress-empty">Com 2 sessões ou mais, os gráficos aparecem aqui.</p>
        : <Suspense fallback={<p className="muted small">Carregando gráficos…</p>}><ProgressCharts history={history} /></Suspense>}
    </>
  );
}
