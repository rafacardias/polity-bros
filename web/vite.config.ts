import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
  // .env vive na raiz do monorepo — evita duplicar VITE_SUPABASE_* aqui
  envDir: '..',
});
