# Como Adicionar Novos Jogos na Plataforma

> Manual para adicionar jogos futuros à Polity Games — plataforma multi-jogos
> onde o Polity Bros é o primeiro título.

## Arquitetura real (Polity Bros)

Cada jogo é um **pacote Phaser independente** (workspace npm), montado por um
componente React "shell" que cria e destrói a instância Phaser dentro de um
`<div>` — **nunca iframe** (D-05). Hoje só existe um jogo:

```
/game                          # pacote 'game' (workspace) — Polity Bros
  /src
    index.ts                   # export createGame(), GAME_EVENTS, SHELL_EVENTS
    /scenes                    # Boot → Preload → Game → GameOver
    /entities /systems /config /lib

/web                           # shell React da plataforma
  /src
    /components
      GameShell.tsx            # monta o Phaser de 'game' num <div id="game-container">
      MenuScreen.tsx           # menu principal — card "Polity Bros" (D-07)
      RankingScreen.tsx        # Top 10 público
    App.tsx                    # troca entre telas (menu/game/ranking) via useState — SPA sem router
```

Um segundo jogo seguiria o mesmo padrão: um novo pacote-workspace (ex.
`game-2`) exportando seu próprio `createGame()`, e um novo componente shell
(ex. `GameShell2.tsx`) montado a partir de um novo card no `MenuScreen`. Não
existe hoje uma pasta `web/src/games/*` por jogo — cada jogo é o próprio
pacote workspace, e o shell React que o monta.

## Contrato de comunicação (CustomEvents)

Phaser e React rodam no **mesmo documento** (nunca isolados por iframe), então
a única ponte permitida é `CustomEvent` no `window`. O contrato é declarado
**uma única vez** por jogo, em `<pacote>/src/lib/game-events.ts` — o shell
importa as constantes de lá, nunca redeclara as strings.

Contrato do Polity Bros (`game/src/lib/game-events.ts`):

| Evento | Direção | Payload | Quando |
|---|---|---|---|
| `menu:play` | React → Phaser | `{}` | Shell dispara assim que o Phaser sinaliza `ready` (RF-02) |
| `menu:restart` | React → Phaser | `{}` | Reservado — hoje o restart acontece só dentro do próprio Phaser (toque/tecla na GameOverScene) |
| `game:score` | Phaser → React | `{ score, votes, distance }` | Emitido a cada ~250ms durante a partida (throttled) |
| `game:gameover` | Phaser → React | `{ score, votes, distance, elapsedSec }` | Emitido uma vez, ao morrer |

O shell reage a `game:gameover` chamando `web/src/lib/submitScore.ts`, que
autentica com a sessão anônima do Supabase e invoca a Edge Function
`submit-score` — o cliente **nunca** grava direto na tabela `scores` (D-08).

## Passos para adicionar um novo jogo

1. Criar o pacote em `/<nome-do-jogo>` como workspace novo (`package.json` com
   `"exports": {".": "./src/index.ts"}`, registrado em `workspaces` na raiz).
2. Exportar `createGame(parent): Phaser.Game` e o contrato de eventos próprio
   em `<nome-do-jogo>/src/lib/game-events.ts` (mesmo formato acima).
3. Criar um shell React (`web/src/components/<NomeDoJogo>Shell.tsx`) que monta
   o Phaser num `<div>`, escuta `game:gameover` e envia o score.
4. Adicionar o card do jogo no `MenuScreen.tsx` e a troca de tela em `App.tsx`.
5. Criar spec em `/specs` antes de codar (D-01 — SDD).
6. Se o jogo tiver ranking, replicar o padrão de D-08: tabela própria com RLS
   (leitura pública, escrita só via Edge Function).
