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

// REGRA DA ESCASSEZ (D-31): com a barra cheia o santinho não pode aparecer —
// recompensa que não recompensa nada vira ruído e queima a raridade do item.
test('o santinho NÃO aparece com a aprovação cheia', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await startRun(page);

  // invulnerável para a barra ficar cheia toda a run (sem isso o player
  // esbarraria, a barra cairia e o item passaria a poder aparecer — o teste
  // mediria o oposto do que pretende)
  await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as { invulnerableUntil: number };
    scene.invulnerableUntil = Number.MAX_SAFE_INTEGER;
  });
  await page.waitForTimeout(18_000); // vários slots de ameaça passam nesse tempo

  const state = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as {
      health: number;
      approvals: Phaser.Physics.Arcade.Group;
    };
    return { health: scene.health, used: scene.approvals.getTotalUsed() };
  });

  expect(state.health, 'o teste precisa da barra cheia para valer').toBe(3);
  expect(state.used, 'nenhum santinho deveria ter se materializado').toBe(0);
});

// ...e com a barra incompleta ele aparece e recupera 1 segmento, sem tocar nos
// votos (RN-04: a aparição varia por jogador, então creditar score aqui faria o
// teto de pontos variar também).
test('o santinho aparece com a barra incompleta e recupera 1 segmento', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await startRun(page);

  await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as {
      invulnerableUntil: number;
      health: number;
      refreshApprovalBar: () => void;
    };
    scene.invulnerableUntil = Number.MAX_SAFE_INTEGER; // não morrer durante a espera
    scene.health = 1;
    scene.refreshApprovalBar();
  });

  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as
        | { approvals?: Phaser.Physics.Arcade.Group }
        | undefined;
      if (!scene?.approvals?.children) return false;
      return scene.approvals.getTotalUsed() > 0;
    },
    undefined,
    { timeout: 30_000 },
  );

  // coleta chamando o mesmo caminho do overlap (mover o player até o item
  // dependeria de acertar o pulo e tornaria o teste um teste de física)
  const result = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as {
      health: number;
      approvals: Phaser.Physics.Arcade.Group;
      collectApproval: (item: unknown) => void;
      score: { getSnapshot: () => { votes: number } };
    };
    const before = scene.score.getSnapshot().votes;
    const item = scene.approvals.children.entries.find(
      (c) => (c as Phaser.Physics.Arcade.Sprite).active,
    );
    scene.collectApproval(item);
    return { health: scene.health, votesBefore: before, votesAfter: scene.score.getSnapshot().votes };
  });

  expect(result.health, 'coletar deveria devolver exatamente 1 segmento').toBe(2);
  expect(
    result.votesAfter,
    'o santinho não pode creditar votos — a fórmula de score é validada no servidor',
  ).toBe(result.votesBefore);
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

// ─────────────────────────────────────────────────────────────────────────────
// D-35 — controle durante o pisca pós-impacto.
//
// O bug relatado no celular: ao levar o impacto o player piscava e "não aceitava
// comandos de saltar ou abaixar", batendo nos obstáculos seguintes até morrer.
// A causa não era o pisca: era o impacto acontecer com o player NO AR. Enquanto
// !onGround, todo toque caía no ramo de fast-fall — não existia caminho de
// código que chamasse startJump() com sucesso até os pés tocarem o chão.
//
// Esta suíte é a rede que faltava: o arquivo já mexia em invulnerableUntil, mas
// não tinha UM caso de pular/agachar durante a carência.

interface ControlScene extends DamageScene {
  player: {
    y: number;
    isSliding: boolean;
    body: { velocity: { y: number } };
    startJump: () => boolean;
    slide: (on: boolean) => void;
    onGround: boolean;
  };
  inputSystem: { airDive: boolean; resetTransient: () => void };
}

// ⚠️ Não extraia a busca da cena para um helper de módulo: o corpo do
// page.evaluate é serializado e executado NO NAVEGADOR, onde nada do escopo do
// Node existe. Só o tipo (apagado na compilação) pode ser compartilhado.

// Detector de IMPULSO, amostrado por frame.
//
// Medir o pico de velocidade não funciona: o pulo nasce em -520, o cutJump do
// tap corta para -420 em ~1ms e a gravidade come 23px por frame — o pico vive
// menos de um quadro e o rAF passa por cima dele. O que é robusto é a DIREÇÃO:
// a gravidade só faz vy CRESCER, então qualquer queda relevante de vy entre dois
// quadros é necessariamente um impulso para cima (startJump / quique do stomp).
// Contar impulsos responde as duas perguntas desta suíte sem depender de timing:
// "pulou?" (>= 1) e "pulou duas vezes no mesmo salto?" (> 1).
async function installMotionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __probe?: { impulses: number; minVy: number };
      __game?: Phaser.Game;
    };
    w.__probe = { impulses: 0, minVy: 0 };
    let prevVy: number | null = null;
    const tick = (): void => {
      const scene = w.__game?.scene.keys.GameScene as unknown as
        | { player?: { body?: { velocity?: { y?: number } } } }
        | undefined;
      const vy = scene?.player?.body?.velocity?.y;
      if (typeof vy === 'number' && w.__probe) {
        if (vy < w.__probe.minVy) w.__probe.minVy = vy;
        // Duas condições, e a segunda não é decorativa: o POUSO também derruba
        // vy de uma vez (+700 → 0) e seria contado como impulso, deixando o
        // teste verde pelo motivo errado. Impulso PARA CIMA termina com vy
        // negativo; o pouso termina em zero.
        // 200 de folga: o holdJump (-28/frame, quase anulado pela gravidade)
        // nunca chega perto, e o pulo (>= 420) sempre passa.
        if (prevVy !== null && vy < prevVy - 200 && vy < -100) w.__probe.impulses += 1;
        prevVy = vy;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function readProbe(page: Page): Promise<{ impulses: number; minVy: number }> {
  return page.evaluate(() => {
    const w = window as unknown as { __probe: { impulses: number; minVy: number } };
    return w.__probe;
  });
}

// Espera o player estar CAINDO. Instalar o probe só depois disto elimina o
// resíduo do pulo programático do setup — a partir daí, qualquer impulso medido
// só pode ter vindo do toque que o teste deu.
async function waitUntilFalling(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
        .GameScene as unknown as ControlScene).player.body.velocity.y > 0,
    undefined,
    { timeout: 5_000 },
  );
}

// A intro cinematográfica congela o mundo por ~1s e o player NÃO está no chão
// enquanto ela roda — startJump() simplesmente falha. Todo teste de input tem
// de esperar a intro terminar, senão mede o jogo antes de o jogo começar.
async function waitForRunReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const scene = (window as unknown as { __game: Phaser.Game }).__game.scene.keys
        .GameScene as unknown as ControlScene & { introActive: boolean };
      return !scene.introActive && scene.player.onGround;
    },
    undefined,
    { timeout: 15_000 },
  );
}

// Sobe e espera sair do chão de verdade: o impacto precisa acontecer NO AR, que
// é a condição que produzia o travamento.
async function jumpAndLeaveGround(page: Page): Promise<void> {
  await waitForRunReady(page);
  await page.evaluate(() => ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene).player.startJump());
  await page.waitForFunction(() => !((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene).player.onGround, undefined, { timeout: 5_000 });
}

async function canvasCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('#game-container canvas').first().boundingBox();
  if (!box) throw new Error('canvas sem boundingBox');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('durante o pisca, o toque no ar vira PULO ao aterrissar', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  // box ANTES do impacto: cada ida ao navegador consome janela de recuperação
  const { x, y } = await canvasCenter(page);
  await jumpAndLeaveGround(page);
  await page.evaluate(() => {
    const scene = ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene);
    scene.invulnerableUntil = 0;
    scene.takeDamage(); // impacto NO AR — o caso que travava
  });

  await waitUntilFalling(page);
  await installMotionProbe(page);
  // o toque TEM de acontecer com o player no ar; no chão o pulo já funcionava
  // antes do fix e o teste passaria sem provar nada
  expect(
    await page.evaluate(() => ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene).player.onGround),
  ).toBe(false);
  await page.mouse.move(x, y);
  await page.mouse.down(); // tocar e SEGURAR: o reflexo de pânico do jogador

  // ANTES do fix: o toque virava fast-fall e NENHUM impulso para cima acontecia
  // — o jogador descia mais rápido em vez de pular, e batia no obstáculo seguinte.
  await expect
    .poll(async () => (await readProbe(page)).impulses, { timeout: 5_000 })
    .toBeGreaterThanOrEqual(1);

  // e com o dedo AINDA na tela ele não pode estar agachado: correr agachado
  // (hitbox 44×32) era o que o entregava aos obstáculos seguintes
  expect(await page.evaluate(() => ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene).player.isSliding)).toBe(false);
  await page.mouse.up();
});

test('fora da carência, o toque no ar continua sendo descida rápida (RF-05)', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  await jumpAndLeaveGround(page);
  const { x, y } = await canvasCenter(page);
  await page.mouse.move(x, y);
  await page.mouse.down();

  // sem impacto não há recuperação: o fast-fall tem de estar intacto
  await expect
    .poll(async () => page.evaluate(() => ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene).player.isSliding), { timeout: 3_000 })
    .toBe(true);
  await page.mouse.up();
});

test('o impacto zera o fast-fall em curso — ninguém aterrissa agachado', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  await jumpAndLeaveGround(page);
  const { x, y } = await canvasCenter(page);
  await page.mouse.move(x, y);
  await page.mouse.down(); // vira fast-fall + agachado

  await expect
    .poll(async () => page.evaluate(() => ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene).player.isSliding), { timeout: 3_000 })
    .toBe(true);

  const after = await page.evaluate(() => {
    const scene = ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene);
    scene.invulnerableUntil = 0;
    scene.takeDamage();
    return { sliding: scene.player.isSliding, airDive: scene.inputSystem.airDive };
  });

  expect(after.sliding, 'o agachamento de fast-fall tem de morrer com o impacto').toBe(false);
  expect(after.airDive).toBe(false);
  await page.mouse.up();
});

test('o buffer de pulo não vira pulo duplo', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  await waitForRunReady(page);
  await installMotionProbe(page);
  await page.evaluate(() => {
    const scene = ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene);
    scene.invulnerableUntil = 0;
    scene.takeDamage(); // abre a janela de recuperação (o cenário mais permissivo)
  });
  const { x, y } = await canvasCenter(page);
  await page.mouse.move(x, y);
  await page.mouse.click(x, y); // pulo de verdade, do chão
  await page.waitForTimeout(120);
  // no ar e ainda subindo: estes toques só podem BUFFERIZAR, nunca pular
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
  // ~420ms após a decolagem o player ainda está no ar (o tap sobe e desce em
  // ~600ms), então um 2º impulso aqui seria pulo duplo de verdade — e não o
  // buffer sendo cobrado no pouso, que é legítimo.
  await page.waitForTimeout(300);

  const probe = await readProbe(page);
  expect(probe.impulses, 'só pode existir UM impulso de pulo por salto').toBe(1);
});

test('gesto de toque preso se autocura quando nenhum dedo está na tela', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);

  await waitForRunReady(page);
  // simula o evento de soltura PERDIDO (touchcancel do iOS, app em background,
  // dedo solto fora do canvas): o estado fica preso sem nenhum ponteiro ativo
  await page.evaluate(() => {
    const scene = ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene);
    scene.inputSystem.airDive = true;
    scene.player.slide(true);
  });

  await expect
    .poll(async () => page.evaluate(() => ((window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as ControlScene).player.isSliding), { timeout: 3_000 })
    .toBe(false);
});

// D-36 — escassez do santinho. Antes não havia teto: o item era sorteado por
// slot de ameaça e, numa run com dano cedo, a capital cuspia ~10 santinhos. Item
// de resgate abundante esvazia a tensão da barra. O teto agora escala com a fase
// (1/2/3), acompanhando distância e dificuldade.
test('o santinho respeita o teto de aparições da fase', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await startRun(page);
  await waitForRunReady(page);

  // Percorre a fase INTEIRA no spawner, sempre pedindo santinho (barra
  // incompleta, o cenário mais permissivo que existe). O RNG é semeado por
  // mundo, então o resultado é determinístico.
  const result = await page.evaluate(() => {
    const scene = (window as unknown as { __game: Phaser.Game }).__game.scene.keys
      .GameScene as unknown as {
      world: { lengthM: number; approvalCap: number };
      spawner: { update: (d: number, s: number, needs: boolean) => void; approvalsSpawned: number };
    };
    const worldPx = scene.world.lengthM * 10; // SCORE.PX_PER_M
    for (let d = 0; d <= worldPx; d += 40) scene.spawner.update(d, 250, true);
    return { spawned: scene.spawner.approvalsSpawned, cap: scene.world.approvalCap };
  });

  expect(result.spawned, 'o teto por fase não pode ser furado').toBeLessThanOrEqual(result.cap);
  expect(result.spawned, 'o santinho não pode ter sumido do jogo').toBeGreaterThan(0);
});
