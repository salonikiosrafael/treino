import { Link, useParams } from 'react-router-dom';
import ExerciseBrowser from '../components/ExerciseBrowser.jsx';

export default function Library() {
  const { region } = useParams();
  return (
    <ExerciseBrowser base="/biblioteca" title="Biblioteca"
      right={!region && <Link to="/biblioteca/novo" className="btn small primary">+ Novo</Link>} />
  );
}
