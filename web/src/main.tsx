import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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
if ('serviceWorker' in navigator && import.meta.env.MODE === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[pwa] service worker registration failed', err);
    });
  });
}
