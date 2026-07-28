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
  // sessão anônima criada UMA vez (auth.setup.ts) e reusada por todos os
  // testes — evita criar um usuário anônimo por teste em produção e estourar
  // o rate limit de sign-ins por IP do Supabase Auth.
  // T08-01 (cross-device): o mesmo conjunto roda em 4 perfis de aparelho, com
  // engines diferentes (Chromium e WebKit) e viewports de 375px a 1024px.
  // Pega quebra de layout, regressão de render por engine e safe-area.
  // ⚠️ NÃO substitui o teste nos 5 aparelhos físicos: aqui não há GPU real,
  // calor, gesto de toque de verdade nem Safari do iOS de verdade.
  // Por padrão roda só o perfil Pixel 7 (o alvo principal, ciclo rápido);
  // a bateria completa sai com `npm run test:e2e -- --project=...` ou
  // `npm run test:e2e:devices`.
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'mobile',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/state.json' },
    },
    {
      name: 'iphone',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['iPhone 13'], storageState: 'e2e/.auth/state.json' },
    },
    {
      name: 'android-small',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Galaxy S9+'], storageState: 'e2e/.auth/state.json' },
    },
    {
      name: 'tablet',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['iPad Mini'], storageState: 'e2e/.auth/state.json' },
    },
  ],
  webServer: {
    command: 'npm run dev -w web -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
