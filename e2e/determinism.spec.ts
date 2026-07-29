import { test, expect, type Page } from '@playwright/test';

// PORTÃO DE DETERMINISMO DO LAYOUT (D-16).
//
// Por que este arquivo existe: o layout das 3 fases é gerado por um RNG SEMEADO
// por mundo (`world.seed`), então a fase é idêntica para todos os jogadores e em
// todas as partidas. Recordes e coleções de propina já salvos nos aparelhos
// foram feitos NESSES layouts. Qualquer sorteio novo que passe pelo MESMO rng
// desloca toda a sequência seguinte e troca a fase inteira — silenciosamente.
//
// O jogo tem um precedente para isso: o TerrainSystem usa um rng próprio
// (`${seed}-terrain`) exatamente para não deslocar a sequência de ameaças
// (GameScene.createTerrain). Este teste é o que transforma essa convenção em
// regra verificável, em vez de disciplina.
//
// A asserção central não é "o layout é bonito", é ARITMÉTICA: `spawnObstacle()`
// consome EXATAMENTE 3 sorteios (kind · linha de risco · linha fácil) e
// `spawnGemBar()` consome ZERO. Logo o total de sorteios é sempre múltiplo de 3.
// Um sorteio novo enfiado neste rng quebra o múltiplo E desalinha os kinds.
//
// ⚠️ Não substituir por um golden dos VALORES do rng: isso só provaria que a
// semente não mudou, e passaria intacto justamente no bug que importa (alguém
// consumindo um sorteio a mais do mesmo stream).

// O menu busca o ranking real do Supabase de produção. Stubar remove a fonte de
// flake mais provável e deixa o boot determinístico.
async function stubRanking(page: Page): Promise<void> {
  await page.route('**/rest/v1/scores*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

// Espera a GameScene estar ATIVA — não só existir.
//
// ⚠️ Obrigatório: em dev o React StrictMode monta o GameShell duas vezes, então
// `window.__game` aponta para a 1ª instância (já destruída) por alguns
// milissegundos. Ler os grupos nessa janela devolve objetos destruídos —
// `getTotalUsed()` estoura em `children.size`. Quando a GameScene fica ativa, o
// __game já é a instância viva. É o mesmo guard que os testes de share usam.
async function waitForLiveGameScene(page: Page): Promise<void> {
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

// Mantém a run viva pelo tempo da captura.
//
// ⚠️ Sem isto o teste é inútil: sem input o player bate no 1º inimigo em ~4s
// (morte instantânea), a GameScene faz shutdown e os grupos são destruídos —
// os sorteios param em 3 ou 6 e o wait estoura por um motivo que não é o testado.
// Usa a carência de invulnerabilidade que JÁ existe em produção (o guard de
// gameOver e de hitEnemy leem o mesmo campo), em vez de inventar um modo de teste.
async function makeInvulnerable(page: Page): Promise<void> {
  await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as { invulnerableUntil: number };
    scene.invulnerableUntil = Number.MAX_SAFE_INTEGER;
  });
}

// Instrumenta o rng DO SPAWNER (não o global) e registra cada valor consumido.
//
// A janela para instalar o espião é confortável: o spawner nasce em create(),
// mas a intro cinematográfica congela o mundo por ~900ms (update() retorna cedo)
// e só então a distância começa a andar — o 1º slot de ameaça exige
// SPAWN.FIRST_GAP (560px) a ~210px/s, ou seja mais ~2,6s. Nada spawnou ainda.
async function spyOnSpawnerRng(page: Page): Promise<void> {
  const alreadySpawned = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as {
      spawner: { rng: { frac: () => number } };
      enemies: Phaser.Physics.Arcade.Group;
    };
    const draws: number[] = [];
    (window as unknown as { __draws: number[] }).__draws = draws;
    const rng = scene.spawner.rng;
    const original = rng.frac.bind(rng);
    // atribuição na INSTÂNCIA (sombreia o método do protótipo) — não vaza para
    // outros RandomDataGenerator, como o do terreno
    rng.frac = (): number => {
      const value = original();
      draws.push(value);
      return value;
    };
    return scene.enemies.getTotalUsed();
  });
  // se algo já tivesse spawnado, o espião perderia os primeiros sorteios e o
  // teste mediria uma sequência truncada — falha do teste, não do jogo
  expect(alreadySpawned, 'o espião do rng foi instalado tarde demais').toBe(0);
}

test('o rng do layout consome exatamente 3 sorteios por slot de ameaça', async ({ page }) => {
  await stubRanking(page);
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await waitForLiveGameScene(page);
  await makeInvulnerable(page);
  await spyOnSpawnerRng(page);

  // roda o suficiente para vários slots de ameaça nascerem de fato
  await page.waitForFunction(
    () => (window as unknown as { __draws: number[] }).__draws.length >= 12,
    undefined,
    { timeout: 25_000 },
  );
  const draws = await page.evaluate(
    () => (window as unknown as { __draws: number[] }).__draws.slice(),
  );

  // INVARIANTE: 3 sorteios por slot (kind, linha de risco, linha fácil) e zero
  // de qualquer outra fonte. Um sorteio novo neste rng quebra aqui primeiro.
  expect(
    draws.length % 3,
    `sorteios consumidos: ${draws.length} — deveria ser múltiplo de 3 (3 por slot de ameaça). ` +
      `Sobra ${draws.length % 3}: alguma feature nova está consumindo do rng de LAYOUT ` +
      `em vez de um rng próprio semeado (ver createTerrain, que usa '\${seed}-terrain').`,
  ).toBe(0);

  // GOLDEN: a sequência de kinds do mundo 'sp' (seed 'sp-v1'). O 1º sorteio de
  // cada trio decide repórter (<0.5 = 'high') ou câmera voadora ('low').
  const kinds = draws.filter((_, i) => i % 3 === 0).map((v) => (v < 0.5 ? 'high' : 'low'));
  expect(
    kinds.slice(0, 4).join(','),
    'a fase sp mudou de layout — se foi intencional, o golden precisa mudar junto ' +
      'E os recordes/coleções já salvos nos aparelhos passam a valer para outra pista',
  ).toBe('low,low,high,high');
});

// A hitbox de coleta do voto NÃO deriva da textura: o Collectible pooled é
// construído com a textura __MISSING (Group#defaultKey é null) e setTexture()
// não redimensiona corpo Arcade no Phaser 3.90. Este número é o baseline para
// provar que trocar o visual do voto (quadrado amarelo → cédula) é neutro em
// BALANCEAMENTO, e não só "parece igual".
test('a hitbox de coleta do voto tem o tamanho de baseline', async ({ page }) => {
  await stubRanking(page);
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await waitForLiveGameScene(page);
  await makeInvulnerable(page);

  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as
        | { votes?: Phaser.Physics.Arcade.Group }
        | undefined;
      // `children` só existe enquanto o grupo está VIVO — se a cena tiver
      // caído, esperar em vez de estourar dentro do predicado
      if (!scene?.votes?.children) return false;
      return scene.votes.getTotalUsed() > 0;
    },
    undefined,
    { timeout: 25_000 },
  );

  const size = await page.evaluate(() => {
    const game = (window as unknown as { __game?: Phaser.Game }).__game;
    const scene = game?.scene.keys.GameScene as unknown as { votes: Phaser.Physics.Arcade.Group };
    const vote = scene.votes.children.entries.find(
      (c) => (c as Phaser.Physics.Arcade.Sprite).active,
    ) as Phaser.Physics.Arcade.Sprite;
    const body = vote.body as Phaser.Physics.Arcade.Body;
    return { w: body.width, h: body.height };
  });

  // 32×32 = a textura __MISSING com que o pool constrói o Collectible, NÃO os
  // 24×24 da arte do voto. Prova documentada de que o raio de coleta é
  // independente do visual: trocar o quadrado amarelo pela cédula não pode
  // mexer neste número.
  expect(
    size,
    'o raio de coleta do voto mudou — isso altera o BALANCEAMENTO, não só o visual',
  ).toEqual({ w: 32, h: 32 });
});
