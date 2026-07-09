import React from 'react';
import ReactDOM from 'react-dom/client';
import { inject } from '@vercel/analytics';
import App from './App';
import './index.css';
import { analyticsEnabled } from './lib/telemetry';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA (T06-05) — registra depois do load pra não competir com o carregamento
// inicial; produção apenas (dev quebraria HMR se o SW servisse cache velho).
// Usa MODE em vez de import.meta.env.PROD: nesta stack (Vite 5.4.21 +
// @tailwindcss/vite) PROD/DEV saem invertidos num build de produção
// (MODE bate certo em "production") — MODE é o valor confiável aqui.
// Web Analytics (T07A-05): só injeta com o gate ligado (VITE_ENABLE_ANALYTICS)
// E em produção — sem o recurso ativo no painel Vercel, o script daria 404.
if (analyticsEnabled && import.meta.env.MODE === 'production') {
  inject();
}

if ('serviceWorker' in navigator && import.meta.env.MODE === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[pwa] service worker registration failed', err);
    });
  });
}
