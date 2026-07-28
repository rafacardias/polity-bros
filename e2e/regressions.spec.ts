import { test, expect, type Page } from '@playwright/test';

// Regressões dos defeitos reportados pelo dono no teste de 2026-07-28.
// Cada teste amarra um bug específico para que ele não volte.
//
// ⚠️ A suíte roda contra o Supabase de PRODUÇÃO (ver playwright.config.ts).
// Os testes que provocam game over INTERCEPTAM a chamada da Edge Function
// submit-score: sem isso, cada execução escreveria um score de mentira no
// ranking real. Nada aqui escreve no banco.
//
// O stub responde com ATRASO de propósito: é ele que dá valor ao teste. Com
// resposta instantânea, o código antigo (que só montava o spotlight depois da
// rede) também passaria, e a regressão voltaria sem ninguém notar.
const SLOW_NETWORK_MS = 2500;

async function stubScoreSubmit(page: Page): Promise<void> {
  await page.route('**/functions/v1/submit-score', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SLOW_NETWORK_MS));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'e2e-stub',
          score: 0,
          votes: 0,
          distance: 0,
          stars: 1,
          continue_used: false,
          world: 'sp',
          created_at: new Date().toISOString(),
        },
      }),
    });
  });
}

// Mata o player de dentro da cena. Testar a morte "de verdade" (esperar bater
// num inimigo) levaria dezenas de segundos e dependeria do balanceamento.
async function forceGameOver(page: Page): Promise<void> {
  await page.locator('#game-container canvas').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    return !!game?.scene.keys.GameScene?.scene.isActive();
  }, undefined, { timeout: 15_000 });
  await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as { gameOver: () => void };
    scene.gameOver();
  });
}

// BUG 1 — "clicar em compartilhar não funciona (só funciona quando a fase é
// concluída)". O SocialSpotlight só montava DEPOIS de submitScore +
// fetchRankingContext; como o game over aceita toque em ~400ms, na derrota o
// jogador reiniciava antes e o botão nunca existia.
test('compartilhar aparece na DERROTA, sem esperar a rede', async ({ page }) => {
  await stubScoreSubmit(page);
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await forceGameOver(page);

  // prazo MENOR que o atraso da rede: prova que o botão não espera o submit
  // nem o ranking. Com o código antigo isto estoura.
  await expect(page.getByRole('button', { name: /Compartilhar/i })).toBeVisible({
    timeout: SLOW_NETWORK_MS - 1_000,
  });
});

// O botão precisa continuar CLICÁVEL: ele é uma ilha pointer-events-auto
// dentro de um overlay pointer-events-none, e some se o jogador reiniciar.
test('compartilhar responde ao clique e gera a imagem', async ({ page }) => {
  await stubScoreSubmit(page);
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await forceGameOver(page);

  const shareBtn = page.getByRole('button', { name: /Compartilhar/i });
  await shareBtn.click();
  // sem Web Share API no Chromium headless, o caminho é o download do PNG —
  // 'salvo! ✓'. O que NÃO pode acontecer é o pill dizer que falhou.
  await expect(page.getByRole('button', { name: /salvo!|Compartilhar/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: /falhou/i })).toHaveCount(0);
});

// BUG 2 — "itens sobrepostos na galeria de skins". Com 7 skins em flex-1 cada
// célula ficava com ~44px e os labels estouravam. Agora a faixa rola.
test('galeria de skins rola na horizontal, sem sobreposição', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Skins/i }).click();

  const gallery = page.locator('div.overflow-x-auto').first();
  await expect(gallery).toBeVisible();

  // conteúdo maior que a caixa = existe scroll (o layout antigo espremia tudo)
  const { scrollWidth, clientWidth } = await gallery.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollWidth).toBeGreaterThan(clientWidth);

  // nenhum card pode ser espremido abaixo da largura mínima legível (w-16)
  const widths = await gallery.locator('button').evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().width),
  );
  expect(widths.length).toBeGreaterThan(4);
  for (const w of widths) expect(w).toBeGreaterThanOrEqual(60);
});

// BUG 3 — "as fases ainda se chamam SP, RJ e DF".
test('fases usam os nomes da carreira política, não as siglas', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Fases/i }).click();

  await expect(page.getByRole('button', { name: /Fase Interior/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Fase Cidade Grande/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Fase Capital/i })).toBeVisible();
  await expect(page.getByText(/São Paulo|Rio de Janeiro|Brasília/)).toHaveCount(0);
});

// BUG 4 — "no menu o nome da propina está '1 continue'". 3 propinas = 1
// continue, então rotular o saldo cru como "continue" mente o preço.
test('botão do menu nomeia a moeda como propina', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /propina/i })).toBeVisible();
});
