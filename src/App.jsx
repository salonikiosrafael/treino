import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Library from './pages/Library.jsx';
import CustomExerciseForm from './pages/CustomExerciseForm.jsx';
import Settings from './pages/Settings.jsx';
import Session from './pages/Session.jsx';
import History from './pages/History.jsx';
import Workouts from './pages/Workouts.jsx';
import WorkoutEditor from './pages/WorkoutEditor.jsx';
import WorkoutPicker from './pages/WorkoutPicker.jsx';
import ExerciseDetail from './pages/ExerciseDetail.jsx';
import CardioForm from './pages/CardioForm.jsx';
import Progress, { CalendarPage } from './pages/Progress.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import UpdatePrompt from './components/UpdatePrompt.jsx';

const TABS = [
  { to: '/', label: 'Treinos', also: ['/treino/'], icon: 'M4 10h2v4H4zM7 7h2v10H7zM15 7h2v10h-2zM18 10h2v4h-2zM9 11h6v2H9z' },
  { to: '/progresso', label: 'Progresso', icon: 'M3 20h18v-2H3zM5 16h3V10H5zM10.5 16h3V4h-3zM16 16h3v-8h-3z' },
  { to: '/biblioteca', label: 'Biblioteca', also: ['/exercicio/'], icon: 'M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.6l3.8-1 3.9 15.4-3.8 1z' },
  { to: '/historico', label: 'Histórico', also: ['/sessao/', '/cardio/'], icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 4h-2v6l5 3 1-1.7-4-2.3z' },
  { to: '/ajustes', label: 'Ajustes', icon: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3h-4l-.3 2.9a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7 7 0 0 0 1.7 1L11 21h4l.3-2.9a7 7 0 0 0 1.7-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z' },
];

export default function App() {
  const { pathname } = useLocation();
  return (
    <div className="app">
      <main className="content">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Workouts />} />
          <Route path="/treino/:id" element={<WorkoutEditor />} />
          <Route path="/treino/:id/adicionar" element={<WorkoutPicker />} />
          <Route path="/treino/:id/adicionar/m/:region" element={<WorkoutPicker />} />
          <Route path="/treino/:id/adicionar/m/:region/:group" element={<WorkoutPicker />} />
          <Route path="/treino/:id/adicionar/ex/:exId" element={<ExerciseDetail />} />
          <Route path="/exercicio/:id" element={<ExerciseDetail />} />
          <Route path="/biblioteca" element={<Library />} />
          <Route path="/biblioteca/m/:region" element={<Library />} />
          <Route path="/biblioteca/m/:region/:group" element={<Library />} />
          <Route path="/biblioteca/novo" element={<CustomExerciseForm />} />
          <Route path="/biblioteca/editar/:id" element={<CustomExerciseForm />} />
          <Route path="/sessao/:id" element={<Session />} />
          <Route path="/cardio/novo" element={<CardioForm />} />
          <Route path="/cardio/:id" element={<CardioForm />} />
          <Route path="/progresso" element={<Progress />} />
          <Route path="/progresso/calendario" element={<CalendarPage />} />
          <Route path="/historico" element={<History />} />
          <Route path="/ajustes" element={<Settings />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) => (isActive || t.also?.some(p => pathname.startsWith(p)) ? 'tab active' : 'tab')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
      <UpdatePrompt />
    </div>
  );
}
