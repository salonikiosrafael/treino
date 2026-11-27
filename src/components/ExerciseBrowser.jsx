import { useLayoutEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom';
import {
  useAllExercises, equipmentLabel, muscleLabel, imageUrl, normalize, variationSort, EQUIPMENT,
  REGIONS, regionOf, slug,
} from '../exercises.js';

/*
 * Biblioteca em 3 níveis, cada um com sua própria URL (o "voltar" funciona normalmente):
 *   {base}                       → regiões (Peito, Costas…) + busca
 *   {base}/m/:region             → movimentos da região (Supino inclinado, Supino reto…)
 *   {base}/m/:region/:group      → grade com as variações do movimento
 * ?q= busca em todos os níveis · ?eq= filtra por equipamento.
 *
 * mode="browse": tocar abre o detalhe.
 * mode="pick": tocar na imagem abre o detalhe; tocar no nome/+ adiciona ao treino (onPick).
 */

const scrolls = {}; // rolagem por tela, restaurada ao voltar

export default function ExerciseBrowser({ base, title, right, mode = 'browse', onPick, picked }) {
  const all = useAllExercises();
  const { region, group } = useParams();
  const [params, setParams] = useSearchParams();
  const loc = useLocation();
  const navType = useNavigationType();
  const nav = useNavigate();
  const q = params.get('q') ?? '';
  const eq = params.get('eq') ?? '';
  const depth = loc.state?.d ?? 0;

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true, state: loc.state });
  };
  // navegação interna: conta a profundidade para o "Concluir" do seletor voltar tudo de uma vez
  const go = to => nav(to, { state: { d: depth + 1 } });
  const qs = eq ? `?eq=${encodeURIComponent(eq)}` : '';
  const detailPath = e => (mode === 'pick' ? `${base}/ex/${encodeURIComponent(e.id)}` : `/exercicio/${encodeURIComponent(e.id)}`);

  const scrollKey = loc.pathname + loc.search;
  useLayoutEffect(() => () => { scrolls[scrollKey] = window.scrollY; }, [scrollKey]);
  useLayoutEffect(() => {
    if (all && navType === 'POP' && scrolls[scrollKey]) window.scrollTo(0, scrolls[scrollKey]);
  }, [!!all, scrollKey]); // eslint-disable-line

  // exercícios filtrados por equipamento e busca
  const list = useMemo(() => {
    if (!all) return null;
    const nq = normalize(q.trim());
    return all.filter(e =>
      (!eq || e.equipment === eq) &&
      (!nq || normalize(e.name).includes(nq) || normalize(e.group).includes(nq) || normalize(e.nameEn ?? '').includes(nq)));
  }, [all, q, eq]);

  const regionInfo = REGIONS.find(r => r.key === region);
  const movements = useMemo(() => {
    if (!list || !region) return [];
    const map = new Map();
    for (const e of list) {
      if (regionOf(e) !== region) continue;
      const k = slug(e.group);
      if (!map.has(k)) map.set(k, { key: k, name: e.group, items: [] });
      map.get(k).items.push(e);
    }
    return [...map.values()]
      .map(g => ({ ...g, items: g.items.sort(variationSort) }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, 'pt-BR'));
  }, [list, region]);
  const movement = group ? movements.find(m => m.key === group) : null;

  const back = () => (loc.key !== 'default' ? nav(-1) : nav(base, { replace: true }));
  const heading = movement?.name ?? regionInfo?.label;

  return (
    <>
      <header className="page-header">
        {region
          ? <><button className="btn small ghost" onClick={back}>‹ Voltar</button><h1 className="header-title">{heading}</h1></>
          : <h1>{title}</h1>}
        {right}
      </header>

      <div className="search">
        <input type="search" placeholder={region ? `Buscar em ${heading ?? ''}…` : 'Buscar exercício…'} value={q}
          onChange={e => setParam('q', e.target.value)} enterKeyHint="search" />
        <div className="chips" role="radiogroup" aria-label="Equipamento">
          <button role="radio" aria-checked={!eq} className={!eq ? 'chip on' : 'chip'} onClick={() => setParam('eq', '')}>Todo equipamento</button>
          {Object.entries(EQUIPMENT).map(([k, v]) => (
            <button key={k} role="radio" aria-checked={eq === k} className={eq === k ? 'chip on' : 'chip'}
              onClick={() => setParam('eq', eq === k ? '' : k)}>{v}</button>
          ))}
        </div>
      </div>

      {!list ? <p className="empty">Carregando…</p>
        : q.trim() ? (
          // busca: grade direto com tudo que casar (dentro da região/movimento atual, se houver)
          <Grid items={rankSearch(movement ? movement.items : region ? movements.flatMap(m => m.items) : list, q)}
            mode={mode} onPick={onPick} picked={picked} detailPath={detailPath} emptyText="Nada encontrado." />
        )
          : !region ? <RegionList list={list} onOpen={k => go(`${base}/m/${k}${qs}`)} />
            : !group ? <MovementList movements={movements} onOpen={m => go(`${base}/m/${region}/${m.key}${qs}`)} />
              : <Grid items={movement?.items ?? []} mode={mode} onPick={onPick} picked={picked} detailPath={detailPath}
                  emptyText="Nenhuma variação com esse equipamento." />}
    </>
  );
}

// busca: nomes que começam com o termo primeiro; depois agrupados por movimento
function rankSearch(items, q) {
  const nq = normalize(q.trim());
  const starts = e => (normalize(e.name).startsWith(nq) || normalize(e.group).startsWith(nq) ? 0 : 1);
  return items.slice().sort((a, b) => starts(a) - starts(b) || a.group.localeCompare(b.group, 'pt-BR') || variationSort(a, b));
}

/** Primeira imagem do movimento mais comum — representa a região/movimento na lista. */
function cover(items) {
  return items.find(e => e.images?.length) ?? items[0];
}

function RegionList({ list, onOpen }) {
  const rows = REGIONS.map(r => {
    const items = list.filter(e => regionOf(e) === r.key);
    const groups = new Map();
    for (const e of items) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
    const biggest = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    return { ...r, count: items.length, movements: groups.size, cover: cover(biggest.sort(variationSort)) };
  }).filter(r => r.count > 0);
  if (!rows.length) return <p className="empty">Nada com esse equipamento.</p>;
  return (
    <ul className="ex-list big-list">
      {rows.map(r => (
        <li key={r.key}>
          <button className="ex-row" onClick={() => onOpen(r.key)}>
            <Thumb e={r.cover} />
            <div className="ex-meta">
              <div className="ex-name">{r.label}</div>
              <div className="ex-sub">{r.count} {r.count === 1 ? 'exercício' : 'exercícios'} · {r.movements} {r.movements === 1 ? 'movimento' : 'movimentos'}</div>
            </div>
            <span className="chev" aria-hidden="true">›</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MovementList({ movements, onOpen }) {
  if (!movements.length) return <p className="empty">Nada com esse equipamento.</p>;
  return (
    <ul className="ex-list big-list">
      {movements.map(m => {
        const muscles = [...new Set(m.items.flatMap(e => e.primary))].slice(0, 3).map(muscleLabel).join(' · ');
        return (
          <li key={m.key}>
            <button className="ex-row" onClick={() => onOpen(m)}>
              <Thumb e={cover(m.items)} />
              <div className="ex-meta">
                <div className="ex-name">{m.name}</div>
                <div className="ex-sub">{m.items.length === 1 ? equipmentLabel(m.items[0].equipment) : `${m.items.length} variações`} · {muscles}</div>
              </div>
              <span className="chev" aria-hidden="true">›</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Grid({ items, mode, onPick, picked, detailPath, emptyText }) {
  if (!items.length) return <p className="empty">{emptyText}</p>;
  return (
    <>
      <p className="count">{items.length} {items.length === 1 ? 'exercício' : 'exercícios'}
        {mode === 'pick' && <span className="muted"> · toque na imagem para ver detalhes</span>}</p>
      <ul className="ex-grid">
        {items.map(e => <Card key={e.id} e={e} mode={mode} onPick={onPick} count={picked?.get(e.id)} to={detailPath(e)} />)}
      </ul>
    </>
  );
}

function CardImage({ e }) {
  return e.images?.[0]
    ? <img src={imageUrl(e.images[0])} alt="" loading="lazy" decoding="async" />
    : <span className="ex-card-empty" aria-hidden="true">{e.name.slice(0, 1)}</span>;
}

function Card({ e, mode, onPick, count, to }) {
  const sub = equipmentLabel(e.equipment);
  if (mode !== 'pick') {
    return (
      <li>
        <Link className="ex-card" to={to}>
          <div className="ex-card-img"><CardImage e={e} /></div>
          <div className="ex-card-foot">
            <span className="ex-card-name">{e.name}</span>
            <span className="ex-card-sub">{sub}{e.custom && ' · Personalizado'}</span>
          </div>
        </Link>
      </li>
    );
  }
  return (
    <li className={count ? 'ex-card in' : 'ex-card'}>
      <Link className="ex-card-img" to={to} aria-label={`Ver detalhes de ${e.name}`}>
        <CardImage e={e} />
        <span className="ex-card-info" aria-hidden="true">i</span>
      </Link>
      <button className="ex-card-foot" onClick={() => onPick(e)} aria-label={count ? `${e.name}: no treino` : `Adicionar ${e.name}`}>
        <span className="ex-card-name">{e.name}</span>
        <span className="ex-card-sub">{sub}</span>
        <span className={count ? 'pick-badge on' : 'pick-badge'}>{count ? `✓${count > 1 ? count : ''}` : '+'}</span>
      </button>
    </li>
  );
}

export function Thumb({ e }) {
  return (
    <div className="thumb">
      {e?.images?.[0]
        ? <img src={imageUrl(e.images[0])} alt="" loading="lazy" decoding="async" width="56" height="56" />
        : <span aria-hidden="true">{(e?.name ?? '?').slice(0, 1)}</span>}
    </div>
  );
}
