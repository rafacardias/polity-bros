import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';

// Sessão anônima COMPARTILHADA entre os testes (T07E-03): sem isto, cada
// teste × cada run criaria um usuário anônimo novo em produção — poluição
// no auth e estouro do rate limit de sign-ins por IP (~30/h), que derruba
// a suíte inteira com "Request rate limit reached".
// process.cwd() = raiz do repo (onde o playwright.config.ts vive)
const STATE_PATH = path.join(process.cwd(), 'e2e', '.auth', 'state.json');

setup('cria (ou reusa) a sessão anônima compartilhada', async ({ page }) => {
  if (fs.existsSync(STATE_PATH)) return; // já existe: os testes reutilizam

  await page.goto('/');
  // espera o aquecimento de sessão do App gravar o token no localStorage
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Object.keys(window.localStorage).some(
            (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
          ),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  await page.context().storageState({ path: STATE_PATH });
});
