import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Novas telas abrem no topo; ao voltar (POP), cada tela restaura a própria rolagem se quiser.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useLayoutEffect(() => { if (type !== 'POP') window.scrollTo(0, 0); }, [pathname, type]);
  return null;
}
