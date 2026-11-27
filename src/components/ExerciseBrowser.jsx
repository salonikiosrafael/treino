import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAllExercises, equipmentLabel, muscleLabel, imageUrl, normalize, variationSort, MUSCLES, EQUIPMENT,
} from '../exercises.js';

// Estado da busca/filtros/rolagem guardado em memória, por tela,
// para não perder a posição ao abrir um exercício e voltar.
const saved = {};
const byLabel = obj => Object.entries(obj).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

/**
 * mode="browse": toque abre o detalhe.
 * mode="pick": toque chama onPick(exercício); picked = Map(id → quantidade).
 */
export default function ExerciseBrowser({ stateKey, mode = 'browse', onPick, picked }) {
  const all = useAllExercises();
  const init = saved[stateKey] ?? { q: '', muscle: '', equip: '', open: [], scrollY: 0 };
  const [q, setQ] = useState(init.q);
  const [muscle, setMuscle] = useState(init.muscle);
  const [equip, setEquip] = useState(init.equip);
  const [open, setOpen] = useState(() => new Set(init.open));
  const stateRef = useRef();
  stateRef.current = { q, muscle, equip, open: [...open] };

  // layout cleanup roda antes do ScrollToTop da próxima tela zerar a rolagem
  useLayoutEffect(() => () => { saved[stateKey] = { ...stateRef.current, scrollY: window.scrollY }; }, [stateKey]);
  useLayoutEffect(() => { if (all && init.scrollY) window.scrollTo(0, init.scrollY); }, [!!all]); // eslint-disable-line

  const groups = useMemo(() => {
    if (!all) return [];
    const nq = normalize(q.trim());
    const list = all.filter(e =>
      (!muscle || e.primary.includes(muscle)) &&
      (!equip || e.equipment === equip) &&
      (!nq || normalize(e.name).includes(nq) || normalize(e.group).includes(nq) || normalize(e.nameEn ?? '').includes(nq)));
    const map = new Map();
    for (const e of list) {
      if (!map.has(e.group)) map.set(e.group, []);
      map.get(e.group).push(e);
    }
    return [...map.entries()]
      .map(([name, items]) => ({ name, items: items.sort(variationSort) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [all, q, muscle, equip]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const searching = q.trim().length > 0;
  const toggle = name => setOpen(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });

  return (
    <>
      <div className="search">
        <input type="search" placeholder="Buscar exercício…" value={q} onChange={e => setQ(e.target.value)} enterKeyHint="search" />
        <Chips label="Grupo muscular" value={muscle} onChange={setMuscle} options={byLabel(MUSCLES)} />
        <Chips label="Equipamento" value={equip} onChange={setEquip} options={byLabel(EQUIPMENT)} />
      </div>
      {!all ? <p className="empty">Carregando…</p> : (
        <>
          <p className="count">
            {total} {total === 1 ? 'exercício' : 'exercícios'} · {groups.length} {groups.length === 1 ? 'movimento' : 'movimentos'}
            {(muscle || equip) && <button className="link" onClick={() => { setMuscle(''); setEquip(''); }}>Limpar filtros</button>}
          </p>
          <ul className="ex-list">
            {groups.map(g => g.items.length === 1
              ? <ExerciseRow key={g.items[0].id} e={g.items[0]} mode={mode} onPick={onPick} count={picked?.get(g.items[0].id)} />
              : <GroupRow key={g.name} g={g} expanded={searching || open.has(g.name)} onToggle={() => toggle(g.name)}
                  mode={mode} onPick={onPick} picked={picked} />)}
          </ul>
          {total === 0 && (
            <p className="empty">Nada encontrado.{' '}
              {mode === 'browse' && <Link to="/biblioteca/novo">Cadastrar exercício personalizado</Link>}
            </p>
          )}
        </>
      )}
    </>
  );
}

function Chips({ label, value, onChange, options }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      <button role="radio" aria-checked={!value} className={!value ? 'chip on' : 'chip'} onClick={() => onChange('')}>
        {label === 'Equipamento' ? 'Todo equipamento' : 'Todos os músculos'}
      </button>
      {options.map(([k, v]) => (
        <button key={k} role="radio" aria-checked={value === k} className={value === k ? 'chip on' : 'chip'}
          onClick={() => onChange(value === k ? '' : k)}>{v}</button>
      ))}
    </div>
  );
}

function Thumb({ e }) {
  return (
    <div className="thumb">
      {e?.images?.[0]
        ? <img src={imageUrl(e.images[0])} alt="" loading="lazy" decoding="async" width="56" height="56" />
        : <span aria-hidden="true">{(e?.name ?? '?').slice(0, 1)}</span>}
    </div>
  );
}
export { Thumb };

function GroupRow({ g, expanded, onToggle, mode, onPick, picked }) {
  const withImg = g.items.find(e => e.images.length) ?? g.items[0];
  const muscles = [...new Set(g.items.flatMap(e => e.primary))].slice(0, 3).map(muscleLabel).join(' · ');
  return (
    <li className={expanded ? 'group open' : 'group'}>
      <button className="ex-row group-head" onClick={onToggle} aria-expanded={expanded}>
        <Thumb e={withImg} />
        <div className="ex-meta">
          <div className="ex-name">{g.name}</div>
          <div className="ex-sub">{g.items.length} variações · {muscles}</div>
        </div>
        <span className="chev" aria-hidden="true">›</span>
      </button>
      {expanded && (
        <ul className="variations">
          {g.items.map(e => <ExerciseRow key={e.id} e={e} mode={mode} onPick={onPick} count={picked?.get(e.id)} />)}
        </ul>
      )}
    </li>
  );
}

function ExerciseRow({ e, mode, onPick, count }) {
  const body = (
    <>
      <Thumb e={e} />
      <div className="ex-meta">
        <div className="ex-name">{e.name}</div>
        <div className="ex-sub">
          {[equipmentLabel(e.equipment), ...e.primary.map(muscleLabel)].join(' · ')}
          {e.custom && <span className="tag">Personalizado</span>}
        </div>
      </div>
      {mode === 'pick' && <span className={count ? 'pick-badge on' : 'pick-badge'}>{count ? `✓${count > 1 ? ` ${count}` : ''}` : '+'}</span>}
    </>
  );
  return (
    <li>
      {mode === 'pick'
        ? <button className="ex-row" onClick={() => onPick(e)}>{body}</button>
        : <Link className="ex-row" to={`/exercicio/${encodeURIComponent(e.id)}`}>{body}</Link>}
    </li>
  );
}
