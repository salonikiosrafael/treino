import { useRegisterSW } from 'virtual:pwa-register/react';

// Mostra um aviso quando há versão nova. O usuário decide quando atualizar
// (os dados ficam no IndexedDB e não são afetados pela atualização do app).
export default function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="toast" role="status">
      <span>Nova versão disponível.</span>
      <button className="btn small primary" onClick={() => updateServiceWorker(true)}>Atualizar</button>
      <button className="btn small ghost" onClick={() => setNeedRefresh(false)}>Depois</button>
    </div>
  );
}
