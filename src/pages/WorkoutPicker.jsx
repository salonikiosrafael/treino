import { useEffect } from 'react';
import { useLocation, useNavigate, useNavigationType, useParams } from 'react-router-dom';
import { useWorkoutPicker, resetPickSession } from '../picker.js';
import ExerciseBrowser from '../components/ExerciseBrowser.jsx';

/** Adicionar exercícios a um treino: mesma biblioteca, mas tocar no nome adiciona. */
export default function WorkoutPicker() {
  const { id, region } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const navType = useNavigationType();
  const { picked, onPick, count } = useWorkoutPicker(id);

  // nova visita ao seletor (vindo do treino) → zera o "desfazer com um toque"
  useEffect(() => { if (!region && navType === 'PUSH') resetPickSession(); }, []); // eslint-disable-line

  // volta direto ao treino, não importa quantos níveis da biblioteca foram abertos
  const done = () => nav(-((loc.state?.d ?? 0) + 1));

  return (
    <ExerciseBrowser base={`/treino/${id}/adicionar`} title="Adicionar" mode="pick" onPick={onPick} picked={picked}
      right={<button className="btn small primary" onClick={done}>Concluir{count ? ` (${count})` : ''}</button>} />
  );
}
