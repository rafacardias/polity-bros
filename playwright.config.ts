import { defineConfig, devices } from '@playwright/test';

// E2E smoke (T07E-03): roda contra o vite dev do workspace web.
// ⚠️ Usa o banco de PRODUÇÃO (mesmo .env do dev) — os testes só fazem
// leituras públicas e boot do jogo; nenhum teste escreve score/perfil.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'], // viewport mobile: o alvo do projeto é celular
  },
  webServer: {
    command: 'npm run dev -w web -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
