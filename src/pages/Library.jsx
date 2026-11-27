import { Link } from 'react-router-dom';
import ExerciseBrowser from '../components/ExerciseBrowser.jsx';

export default function Library() {
  return (
    <>
      <header className="page-header">
        <h1>Biblioteca</h1>
        <Link to="/biblioteca/novo" className="btn small primary">+ Novo</Link>
      </header>
      <ExerciseBrowser stateKey="library" />
    </>
  );
}
