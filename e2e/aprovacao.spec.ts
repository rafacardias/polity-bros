import { test, expect, type Page } from '@playwright/test';

// Sistema de APROVAÇÃO (D-31): o contato com o inimigo deixou de matar na hora e
// passou a custar 1/3 da barra. Estes testes amarram as três coisas que podem
// quebrar em silêncio: a contagem, a carência e o fluxo de morte no último
// impacto.
//
// ⚠️ A suíte roda contra o Supabase de PRODUÇÃO (ver playwright.config.ts). Os
// testes que chegam ao game over interceptam a Edge Function submit-score —
// nada aqui escreve no ranking real.

// Com 3+ propinas o gameOver desvia para a oferta de CONTINUE (4s) e só emite
// game:gameover depois. Zerar deixa o caminho de morte determinístico.
async function emptyWallet(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('polity-bros:gems', '0'));
}

async function stubRanking(page: Page): Promise<void> {
  await page.route('**/rest/v1/scores*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

async function stubScoreSubmit(page: Page): Promise<void> {
  await page.route('**/functions/v1/submit-score', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{}}' }),
  );
}

async function startRun(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await page.locator('#game-container canvas').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      return !!game?.scene.keys.GameScene?.scene.isActive();
    },
    undefined,
    { timeout: 15_000 },
  );
}

interface DamageScene {
  health: number;
  invulnerableUntil: number;
  takeDamage: (source?: unknown) => void;
  hitEnemy: (enemy: unknown) => void;
  enemies: Phaser.Physics.Arcade.Group;
  scene: { isActive: () => boolean };
}

// ⚠️ Todo bloco que aplica dano ZERA a carência entre os impactos. Sem isso os
// i-frames engolem as chamadas seguidas e o teste mediria 1 impacto acreditando
// ter aplicado N — passaria com o sistema quebrado.

// O teste de ponta a ponta que não simula nada: deixa o jogo rodar SEM input e
// espera a colisão de verdade acontecer. Antes desta feature, esbarrar uma vez
// terminava a partida em ~4s — este teste falharia por definição.
test('esbarrar de verdade num inimigo custa aprovação, não a partida', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  // sem tocar em nada, o player caminha até o 1º repórter e leva o impacto
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as
        | { health?: number }
        | undefined;
      return (scene?.health ?? 3) < 3;
    },
    undefined,
    { timeout: 25_000 },
  );

  const state = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as DamageScene;
    return { health: scene.health, active: scene.scene.isActive() };
  });

  expect(state.active, 'a run tem de sobreviver ao primeiro esbarrão real').toBe(true);
  expect(state.health).toBeLessThan(3);
  expect(state.health).toBeGreaterThan(0);
});

test('dois impactos NÃO encerram a partida — a barra cai para 1/3', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  const result = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as DamageScene;
    let gameOverEmitted = false;
    window.addEventListener('game:gameover', () => {
      gameOverEmitted = true;
    });
    for (let i = 0; i < 2; i++) {
      scene.invulnerableUntil = 0; // sem isto a carência engole o 2º impacto
      scene.takeDamage();
    }
    return { health: scene.health, active: scene.scene.isActive(), gameOverEmitted };
  });

  expect(result.health).toBe(1);
  expect(result.active, 'a run tem de continuar depois de 2 impactos').toBe(true);
  expect(result.gameOverEmitted, 'game:gameover não pode disparar antes do 3º impacto').toBe(false);
});

test('a carência impede que um mesmo obstáculo custe dois segmentos', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  const health = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as DamageScene;
    scene.invulnerableUntil = 0;
    scene.takeDamage(); // este conta
    scene.takeDamage(); // este cai na carência
    scene.takeDamage(); // e este também
    return scene.health;
  });

  expect(health, 'três chamadas seguidas deveriam custar UM segmento só').toBe(2);
});

test('o terceiro impacto encerra a partida pelo fluxo de morte de sempre', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  const emitted = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        window.addEventListener('game:gameover', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 10_000);
      }),
  );

  await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as DamageScene;
    for (let i = 0; i < 3; i++) {
      scene.invulnerableUntil = 0;
      scene.takeDamage();
    }
  });

  expect(await emitted, 'o 3º impacto tem de cair no gameOver() de sempre').toBe(true);
  // e a tela final realmente entra: sem isto, um emit sem transição passaria
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      return !!game?.scene.getScenes(true).some((s) => s.scene.key === 'GameOverScene');
    },
    undefined,
    { timeout: 10_000 },
  );
});

// Anti-dano-duplo: o overlap dispara em frames seguidos e a carência só começa
// DEPOIS do primeiro golpe, então sem desativar a ameaça um único repórter
// levaria 2 segmentos de uma vez.
test('a ameaça que acertou sai de cena', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  // espera um inimigo real nascer — usar um objeto de mentira não provaria nada
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as
        | { enemies?: Phaser.Physics.Arcade.Group }
        | undefined;
      if (!scene?.enemies?.children) return false;
      return scene.enemies.getTotalUsed() > 0;
    },
    undefined,
    { timeout: 25_000 },
  );

  const result = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as DamageScene;
    const enemy = scene.enemies.children.entries.find(
      (c) => (c as Phaser.Physics.Arcade.Sprite).active,
    ) as Phaser.Physics.Arcade.Sprite;
    scene.invulnerableUntil = 0;
    scene.takeDamage(enemy);
    return { enemyActive: enemy.active, health: scene.health };
  });

  expect(result.health).toBe(2);
  expect(result.enemyActive, 'a ameaça que causou o dano tem de ser desativada').toBe(false);
});

// O CONTINUE é a monetização: pagar 3 propinas tem de comprar uma vida INTEIRA,
// não um fiapo de barra.
test('o CONTINUE pago restaura a aprovação cheia', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('polity-bros:gems', '3'));
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as DamageScene;
    for (let i = 0; i < 3; i++) {
      scene.invulnerableUntil = 0;
      scene.takeDamage();
    }
  });

  // ⚠️ Espera a oferta ABRIR de fato (ela entra 500ms após a morte, num
  // delayedCall) em vez de dormir um tempo fixo: sob a carga da suíte
  // cross-device esse orçamento estoura e o aceite cairia no vazio.
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as
        | { continueUi?: unknown[] }
        | undefined;
      return (scene?.continueUi?.length ?? 0) > 0;
    },
    undefined,
    { timeout: 10_000 },
  );

  // Aceita com o MOUSE no botão, não com ENTER: eventos de teclado sintéticos
  // não chegam de forma confiável ao input do Phaser em todos os perfis de
  // aparelho (achado da sessão de 2026-07-28). O aceite escuta pointerdown de
  // cena + bounds do botão, então um clique real no centro dele é o caminho
  // que o jogador de verdade percorre.
  const canvas = await page.locator('#game-container canvas').first().boundingBox();
  const btn = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as {
      continueUi: Phaser.GameObjects.Text[];
    };
    const b = scene.continueUi[1].getBounds(); // [dim, btn, countdown]
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.click(canvas!.x + btn.x, canvas!.y + btn.y);

  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as DamageScene;
      return scene.scene.isActive() && scene.health === 3;
    },
    undefined,
    { timeout: 10_000 },
  );
});

// A barra é HUD: durante a intro cinematográfica (close-up de ~900ms) o HUD é
// ocultado, e um elemento novo que não entre em setHudVisible vaza por cima.
test('a barra fica oculta durante a intro cinematográfica', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();

  // lê no primeiro instante em que a cena existe, ainda dentro da intro
  const hiddenDuringIntro = await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as
        | {
            introActive?: boolean;
            approvalTrack?: Phaser.GameObjects.Rectangle;
            scene: { isActive: () => boolean };
          }
        | undefined;
      if (!scene?.approvalTrack || !scene.scene.isActive()) return undefined;
      if (!scene.introActive) return undefined; // já passou da intro: tenta de novo
      return { visible: scene.approvalTrack.visible };
    },
    undefined,
    { timeout: 15_000 },
  );

  expect((await hiddenDuringIntro.jsonValue()).visible).toBe(false);

  // ...e reaparece quando a intro acaba (senão o teste passaria com a barra
  // invisível para sempre)
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as {
        approvalTrack: Phaser.GameObjects.Rectangle;
      };
      return scene.approvalTrack.visible;
    },
    undefined,
    { timeout: 10_000 },
  );
});

// D-31: com 3 impactos por vida terminar a fase ficou acessível, então o
// prestígio migrou para a 3ª estrela — que MULTIPLICA o score. Sem esta regra o
// ranking encheria de scores inflados em relação às linhas históricas, feitas
// quando um toque matava.
test('a 3ª estrela exige terminar sem escândalo', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  // vitória LIMPA: nenhum coletável perdido e nenhum impacto → 3⭐
  const clean = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as {
      tookDamage: boolean;
      stars: number;
      finishWorld: () => void;
    };
    scene.tookDamage = false;
    scene.finishWorld();
    return scene.stars;
  });
  expect(clean, 'terminar limpo tem de valer 3 estrelas').toBe(3);

  // mesma vitória, mas tendo levado um escândalo → 2⭐
  await page.reload();
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      return !!game?.scene.keys.GameScene?.scene.isActive();
    },
    undefined,
    { timeout: 15_000 },
  );
  const damaged = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as {
      tookDamage: boolean;
      stars: number;
      finishWorld: () => void;
    };
    scene.tookDamage = true;
    scene.finishWorld();
    return scene.stars;
  });
  expect(damaged, 'terminar tendo levado impacto tem de valer 2 estrelas').toBe(2);
});

// RN-02 (mobile): a barra não pode encostar no "faltam Xm", que fica na
// esquerda. Roda nos 4 perfis de aparelho da suíte cross-device — a tela de
// 320px é a apertada.
test('a barra não colide com o contador de distância', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await startRun(page);
  // depois da intro o HUD volta a ser visível e os bounds são reais
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as {
        approvalTrack?: Phaser.GameObjects.Rectangle;
      };
      return !!scene?.approvalTrack?.visible;
    },
    undefined,
    { timeout: 15_000 },
  );

  // sobreposição calculada à mão: `Phaser` não é global na página (o jogo é
  // bundlado por Vite), então Phaser.Geom.Rectangle.Overlaps não existe aqui
  const overlaps = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as {
      approvalTrack: Phaser.GameObjects.Rectangle;
      distanceText: Phaser.GameObjects.Text;
    };
    const a = scene.approvalTrack.getBounds();
    const b = scene.distanceText.getBounds();
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  });

  expect(overlaps, 'a barra de aprovação está por cima do "faltam Xm"').toBe(false);
});
