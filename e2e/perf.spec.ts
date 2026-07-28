import { test, expect } from '@playwright/test';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// T08-02 (performance): mede o que dá para medir sem aparelho físico — FPS do
// loop do Phaser, memória do heap, tempo até o jogo aparecer e peso dos assets.
//
// Honestidade sobre o alcance: headless não tem GPU de celular, nem bateria,
// nem calor. Estes números pegam REGRESSÃO (algo ficou 2× mais pesado que
// ontem), não substituem o teste no celular real exigido pelo DoD.

// RN-01 fala em ~60fps. O piso é 50 para não falhar por ruído de CI, já com
// 4× de CPU throttle — quem passa aqui tem folga no aparelho de verdade.
const MIN_FPS = 50;
const CPU_THROTTLE = 4;
const MAX_BOOT_MS = 12_000;
const MAX_HEAP_MB = 400;

test('mantém FPS jogável com CPU 4× mais lenta', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CPU throttling exige o protocolo do Chrome');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await page.locator('#game-container canvas').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      return !!(game?.scene.keys.GameScene as unknown as { player?: unknown } | undefined)?.player;
    },
    undefined,
    { timeout: 15_000 },
  );

  // amostra depois de um aquecimento: os primeiros frames incluem o custo de
  // criação da cena e puxariam a média para baixo sem representar o jogo
  await page.waitForTimeout(1500);
  const samples: number[] = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(250);
    samples.push(
      await page.evaluate(() => {
        const game = (window as unknown as { __game?: Phaser.Game }).__game;
        return game?.loop.actualFps ?? 0;
      }),
    );
  }

  const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  console.log(`FPS (mediana, CPU ${CPU_THROTTLE}×): ${median.toFixed(1)} — amostras ${samples.map((s) => s.toFixed(0)).join(',')}`);
  expect(median).toBeGreaterThan(MIN_FPS);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});

test('jogo aparece dentro do orçamento de boot', async ({ page }) => {
  const started = Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await page.locator('#game-container canvas').waitFor({ state: 'visible', timeout: MAX_BOOT_MS });
  const elapsed = Date.now() - started;
  console.log(`boot até o canvas: ${elapsed}ms`);
  expect(elapsed).toBeLessThan(MAX_BOOT_MS);
});

test('heap não estoura o orçamento durante a partida', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'performance.memory só existe no Chrome');

  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await page.locator('#game-container canvas').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(4000); // deixa o spawner reciclar o pool algumas vezes

  const heapMB = await page.evaluate(() => {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return mem ? mem.usedJSHeapSize / (1024 * 1024) : 0;
  });
  console.log(`heap em uso: ${heapMB.toFixed(1)}MB`);
  expect(heapMB).toBeLessThan(MAX_HEAP_MB);
});

// Orçamento de peso: celular em 4G paga cada byte. Este teste não abre o
// browser — lê o disco. Serve de alarme quando alguém sobe um asset gigante.
test('assets cabem no orçamento de download', () => {
  const ASSETS = join(process.cwd(), 'game', 'public', 'assets');
  const MAX_SINGLE_MB = 1.2;
  const MAX_TOTAL_MB = 6;

  const walk = (dir: string): { path: string; mb: number }[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return [{ path: full.slice(ASSETS.length + 1), mb: statSync(full).size / (1024 * 1024) }];
    });

  const files = walk(ASSETS);
  const total = files.reduce((sum, f) => sum + f.mb, 0);
  const heaviest = [...files].sort((a, b) => b.mb - a.mb).slice(0, 5);
  console.log(
    `assets: ${files.length} arquivos, ${total.toFixed(2)}MB\n` +
      heaviest.map((f) => `  ${f.mb.toFixed(2)}MB  ${f.path}`).join('\n'),
  );

  for (const f of files) expect(f.mb, `${f.path} passou do teto individual`).toBeLessThan(MAX_SINGLE_MB);
  expect(total, 'soma dos assets passou do teto').toBeLessThan(MAX_TOTAL_MB);
});
