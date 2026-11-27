import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, newCustomId } from '../db.js';
import { MUSCLES, EQUIPMENT } from '../exercises.js';
import { workoutsUsing } from '../workouts.js';

const byLabel = obj => Object.entries(obj).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

export default function CustomExerciseForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', muscle: '', equipment: '' });
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    db.customExercises.get(id).then(e => {
      if (e) setForm({ name: e.name, muscle: e.primary[0] ?? '', equipment: e.equipment });
      setLoaded(true);
    });
  }, [id]);

  const set = k => ev => setForm(f => ({ ...f, [k]: ev.target.value }));

  async function save(ev) {
    ev.preventDefault();
    const name = form.name.trim();
    if (!name) return setError('Informe o nome.');
    if (!form.muscle) return setError('Escolha o grupo muscular.');
    if (!form.equipment) return setError('Escolha o equipamento.');
    const now = Date.now();
    if (id) {
      await db.customExercises.update(id, { name, primary: [form.muscle], equipment: form.equipment, updatedAt: now });
    } else {
      await db.customExercises.add({ id: newCustomId(), name, primary: [form.muscle], equipment: form.equipment, createdAt: now, updatedAt: now });
    }
    nav('/biblioteca');
  }

  async function remove() {
    const using = await workoutsUsing(id);
    if (using.length) {
      alert(`Este exercício está nos treinos: ${using.map(w => w.name).join(', ')}. Remova-o desses treinos antes de excluir.`);
      return;
    }
    if (!confirm(`Excluir “${form.name}”?`)) return;
    await db.customExercises.delete(id);
    nav('/biblioteca');
  }

  if (!loaded) return null;
  return (
    <>
      <header className="page-header">
        <button className="btn small ghost" onClick={() => nav(-1)}>‹ Voltar</button>
        <h1>{id ? 'Editar exercício' : 'Novo exercício'}</h1>
      </header>
      <form className="form" onSubmit={save}>
        <label>Nome
          <input value={form.name} onChange={set('name')} placeholder="Ex: Remada na máquina Hammer" autoFocus={!id} />
        </label>
        <label>Grupo muscular
          <select value={form.muscle} onChange={set('muscle')}>
            <option value="">Escolha…</option>
            {byLabel(MUSCLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Equipamento
          <select value={form.equipment} onChange={set('equipment')}>
            <option value="">Escolha…</option>
            {byLabel(EQUIPMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" type="submit">Salvar</button>
        {id && <button className="btn danger block" type="button" onClick={remove}>Excluir</button>}
      </form>
    </>
  );
}
