import { test, expect, type Page } from '@playwright/test';

// Smoke E2E (T07E-03): o caminho crítico que NUNCA pode quebrar —
// menu abre → ranking abre (com edição de nome, T07D-02) → jogo dá boot.
// Só leituras públicas; nenhum teste escreve no banco de produção.

// Erros de console viram falha (Definition of Done: zero erros no browser).
// Ignora falhas de rede de telemetria/analytics (gate desligado por design).
//
// Também ignora o rate limit de sign-in anônimo: a suíte roda contra o Supabase
// de PRODUÇÃO e, ao executar a bateria cross-device várias vezes seguidas, o
// mesmo IP estoura o limite de sign-ins e o app loga o erro. É limitação do
// ambiente de teste, não defeito do jogo — o caminho certo é um projeto
// Supabase separado para testes (backlog).
const IGNORED_CONSOLE = [/rate limit/i, /429/];

const ignored = (text: string): boolean => IGNORED_CONSOLE.some((re) => re.test(text));

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    if (!ignored(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (!ignored(msg.text())) errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test('menu hub renderiza com JOGAR fixo e pilha de menus', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /JOGAR/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ranking/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Fases/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('ranking abre com Top 10 e bloco de nome (T07D-02)', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Ranking/i }).click();
  await expect(page.getByText('Seu nome no ranking')).toBeVisible();
  // lista carregou: ou tem entradas, ou o estado vazio explícito
  await expect(page.getByText(/pts|Carregando…|ninguém/i).first()).toBeVisible();
  // espera o fetch público resolver sem erro de console
  await page.waitForTimeout(2500);
  expect(errors).toEqual([]);
});

test('jogo dá boot: canvas do Phaser aparece ao tocar JOGAR', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await expect(page.locator('#game-container canvas').first()).toBeVisible({ timeout: 15_000 });
  // dá tempo do BootScene/PreloadScene rodarem — crash aqui = console error
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});
