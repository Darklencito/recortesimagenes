import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registro fallido: la app sigue funcionando sin offline */
      });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) r.unregister();
    }).catch(() => undefined);
  }
}
