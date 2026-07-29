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

// A carteira vive em localStorage e o storageState compartilhado fotografa a
// origem inteira. Com 3+ propinas, gameOver() desvia para a oferta de continue
// (4s) e só emite o game:gameover depois — os testes quebrariam com um timeout
// que não explica nada. Zerar deixa o caminho de morte determinístico.
async function emptyWallet(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('polity-bros:gems', '0'));
}

// O ranking também é stubado: sem isto o teste depende da latência do Supabase
// de produção e do conteúdo real do Top 7 — a fonte de flake mais provável.
async function stubRanking(page: Page): Promise<void> {
  await page.route('**/rest/v1/scores*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

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
  await page.locator('#game-container canvas').first().waitFor({ state: 'visible', timeout: 15_000 });
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
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await forceGameOver(page);

  // prazo MENOR que o atraso da rede: prova que o botão não espera o submit
  // nem o ranking. Com o código antigo isto estoura.
  await expect(page.getByRole('button', { name: /Compartilhar/i })).toBeVisible({
    timeout: SLOW_NETWORK_MS - 1_000,
  });

  // ...e o ranking REALMENTE chega depois: sem isto o teste passaria com o
  // spotlight preso em "carregando" para sempre.
  await expect(page.getByText('…').first()).toBeHidden({ timeout: SLOW_NETWORK_MS + 5_000 });
});

// O pill é a única ilha clicável do overlay e sobrevive ao recolhimento do
// sheet. Ele NÃO pode atravessar para a run seguinte: durante a intro (~900ms)
// o update() não emite game:score, e o botão da partida anterior ficava vivo
// por cima do jogo novo — no canto do polegar, compartilhando o score velho e
// engolindo o toque que deveria pular a intro.
test('compartilhar some ao recomeçar, não vaza para a run seguinte', async ({ page }) => {
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await forceGameOver(page);
  await expect(page.getByRole('button', { name: /Compartilhar/i })).toBeVisible({
    timeout: 5_000,
  });

  // Reinicia como o jogador faria: um toque na tela do game over. Mouse cru
  // porque o overlay do spotlight cobre a viewport (pointer-events-none, o
  // toque atravessa até o Phaser) e o actionability check do Playwright ficaria
  // esperando um elemento que nunca "recebe" o clique.
  //
  // ⚠️ O toque é RETENTADO em vez de um sleep fixo de 900ms. O GameOverScene só
  // arma o listener de reinício 400ms depois de entrar (GameOverScene.ts:104), e
  // ele próprio entra 450ms após a morte — sob carga (a suíte cross-device roda
  // 4 perfis de aparelho em paralelo) esse orçamento estoura, o clique cai antes
  // do listener existir e o teste falhava esperando um restart que nunca vinha.
  // Cliques extras são inofensivos: na run nova um toque só pula a intro.
  // ⚠️ Esperar a GameOverScene ENTRAR antes de clicar. gameOver() não derruba a
  // GameScene: a troca de cena acontece 450ms depois, num delayedCall. Sem este
  // guard, "a GameScene está ativa?" já responde SIM no instante da morte e o
  // teste se declararia reiniciado sem nunca ter reiniciado.
  await page.waitForFunction(
    () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      return !!game?.scene.getScenes(true).some((s) => s.scene.key === 'GameOverScene');
    },
    undefined,
    { timeout: 10_000 },
  );

  const box = await page.locator('#game-container canvas').first().boundingBox();
  await expect
    .poll(
      async () => {
        await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 3);
        return page.evaluate(() => {
          const game = (window as unknown as { __game?: Phaser.Game }).__game;
          return !!game?.scene.getScenes(true).some((s) => s.scene.key === 'GameScene');
        });
      },
      {
        message: 'o toque na tela de game over não reiniciou a partida',
        intervals: [300, 300, 300, 500, 500, 500, 1000],
        timeout: 10_000,
      },
    )
    .toBe(true);

  // já no primeiro instante da run nova o pill tem de ter sumido — não depois
  // de a intro terminar (a intro leva ~900ms sem emitir game:score)
  await expect(page.getByTestId('share-pill')).toHaveCount(0, { timeout: 800 });
});

// O botão precisa continuar CLICÁVEL: ele é uma ilha pointer-events-auto
// dentro de um overlay pointer-events-none, e some se o jogador reiniciar.
test('compartilhar responde ao clique e gera a imagem', async ({ page, browserName }) => {
  // Só no Chromium: este teste afirma o caminho de FALLBACK (<a download>), que
  // o WebKit headless não dispara. E no iPhone real o fallback nem é usado —
  // lá existe navigator.share, então o caminho é o share sheet nativo, que
  // nenhum browser headless consegue exercitar. Rodar aqui provaria o oposto
  // do que acontece no aparelho.
  test.skip(browserName !== 'chromium', 'fallback de download não existe no WebKit');
  await emptyWallet(page);
  await stubRanking(page);
  await stubScoreSubmit(page);
  await page.goto('/');
  await page.getByRole('button', { name: /JOGAR/i }).click();
  await forceGameOver(page);

  // localiza pelo testid, não pelo texto: o rótulo muda para "salvo! ✓" e um
  // locator por nome perderia o botão justamente no estado que queremos afirmar
  const shareBtn = page.getByTestId('share-pill');
  const download = page.waitForEvent('download', { timeout: 10_000 });
  await shareBtn.click();

  // Sem Web Share API no browser de teste, o caminho é determinístico:
  // compõe o PNG → baixa → pill vira 'salvo! ✓'. Afirmar o ESTADO TERMINAL,
  // e não "salvo OU Compartilhar": 'Compartilhar' é o rótulo ocioso, presente
  // antes do clique e de volta 2s após um erro — a asserção passaria com o
  // share 100% quebrado.
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.png$/);
  await expect(shareBtn).toHaveText(/salvo!/i, { timeout: 5_000 });
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

// BUG 5 — "o salto das skins mostra o personagem parado olhando pra frente".
// enterAir() usava '<char>.png' (retrato de frente); agora usa '<char>-air',
// que é um frame congelado da corrida (D-29).
// 'centrao' incluído de propósito: é a skin default de todo jogador novo, a
// mais jogada, e era a única sem asset '-air' próprio (dependia do fallback).
for (const char of ['centrao', 'patriota', 'comunista', 'direita', 'esquerda']) {
  test(`skin ${char} pula na pose de perfil, não no retrato de frente`, async ({ page }) => {
    await page.addInitScript(
      (skin) => window.localStorage.setItem('polity-bros:skin', skin),
      char,
    );
    await page.goto('/');
    await page.getByRole('button', { name: /JOGAR/i }).click();
    await page.locator('#game-container canvas').first().waitFor({ state: 'visible', timeout: 15_000 });
    // o canvas já aparece no preload — esperar o Player existir de fato
    await page.waitForFunction(
      () => {
        const game = (window as unknown as { __game?: Phaser.Game }).__game;
        const scene = game?.scene.keys.GameScene as unknown as { player?: unknown } | undefined;
        return !!scene?.player;
      },
      undefined,
      { timeout: 15_000 },
    );

    // Pula DE VERDADE e observa as texturas durante o voo. Empurrar o sprite
    // pelo eixo y não serve: blocked.down só é recalculado no próximo passo da
    // física, então em telas altas o player ainda se dizia "no chão" e o teste
    // lia a textura de corrida — falha do teste, não do jogo.
    const seen = await page.evaluate(async () => {
      const game = (window as unknown as { __game?: Phaser.Game }).__game;
      const scene = game?.scene.keys.GameScene as unknown as {
        player: Phaser.Physics.Arcade.Sprite;
      };
      const keys = new Set<string>();
      scene.player.setVelocityY(-620); // impulso de pulo
      // amostra ao longo do arco: subida, ápice e queda
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        keys.add(scene.player.texture.key);
      }
      return [...keys];
    });

    expect(seen, `texturas vistas no voo: ${seen.join(', ')}`).toContain(`${char}-air`);
  });
}
