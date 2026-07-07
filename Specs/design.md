# Spec: Design (Arquitetura & Design Técnico) — MVP

> **Projeto:** Polity Bros (jogo) · Polity Games (plataforma)
> **Status:** ATIVO — fonte da verdade técnica do MVP
> **Escopo:** SOMENTE o vertical slice. Ideias além → requirements.md §8 (Visão Futura).
> **Regra:** Phaser em container DIV (NUNCA iframe). Comunicação só via CustomEvents.

---

## 1. Arquitetura (MVP)

┌───────────────────────── VERCEL (Hosting + CDN) ─────────────────────────┐
│                                                                          │
│  React Shell (Vite + React + Tailwind)      Phaser Game (Vite + TS)      │
│  ┌────────────────────────────┐             ┌──────────────────────────┐ │
│  │ MenuScreen (card + Jogar)  │ CustomEvents │ Scenes: Boot→Preload→    │ │
│  │ GameShell (monta Phaser    │◄───────────►│ Game→GameOver             │ │
│  │   em <div>)                │  (DOM bus)   │ Systems: Input, Physics,  │ │
│  │ Leaderboard (Top 10)       │             │ Spawner, Score, Progress, │ │
│  └────────────────────────────┘             │ Audio                     │ │
│            │ supabase-js                     │ Entities: Player,         │ │
│            ▼                                  │ Obstacle, Collectible    │ │
│  ┌──────────────────────────────────────────┴──────────────────────────┐ │
│  │ SUPABASE: PostgreSQL · Auth (anônima) · Edge Function submit-score    │ │
│  │ Tabela: scores (RLS)                                                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘


**Separação de responsabilidades:**
- **React Shell:** menu da plataforma, montagem do Phaser (DIV), leaderboard, chamada à Edge Function.
- **Phaser Game:** gameplay, física, input, render, áudio, game loop.
- **Supabase:** persistência + validação de score server-side.
- **Regra de acesso:** Supabase é tocado pelo React Shell e pela Edge Function. **Entities NUNCA acessam Supabase.** Systems não fazem I/O de rede; só emitem eventos.

---

## 2. Scenes do Phaser (MVP)
BootScene → PreloadScene → GameScene → GameOverScene ↑ │ └── restart ───┘

> MenuScene fica no **React Shell** (não é Scene Phaser no MVP), pra manter o menu da plataforma unificado.

| Scene | Arquivo | Responsabilidade |
|---|---|---|
| BootScene | `scenes/BootScene.ts` | Configurar escala responsiva; iniciar Preload |
| PreloadScene | `scenes/PreloadScene.ts` | Carregar placeholders + áudio; barra de progresso |
| GameScene | `scenes/GameScene.ts` | Loop: input, física, spawn, colisão, score, HUD |
| GameOverScene | `scenes/GameOverScene.ts` | Score final; emite `game:gameover`; escuta `menu:restart` |

```typescript
// scenes/GameScene.ts (esqueleto — mostra orquestração dos Systems)
import Phaser from 'phaser';
import { InputSystem } from '../systems/InputSystem';
import { SpawnerSystem } from '../systems/SpawnerSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { Player } from '../entities/Player';
import { emitGameEvent, GAME_EVENTS } from '../lib/game-events';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private input!: InputSystem;
  private spawner!: SpawnerSystem;
  private score!: ScoreSystem;
  private progression!: ProgressionSystem;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private votes!: Phaser.Physics.Arcade.Group;

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    this.score = new ScoreSystem();
    this.progression = new ProgressionSystem();
    this.player = new Player(this, 100, this.scale.height - 100);
    this.input = new InputSystem(this, this.player);

    this.obstacles = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
    this.votes = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
    this.spawner = new SpawnerSystem(this, this.obstacles, this.votes);

    this.physics.add.overlap(this.player, this.obstacles, () => this.gameOver());
    this.physics.add.overlap(this.player, this.votes, (_p, v) => this.collectVote(v));
  }

  update(time: number, delta: number): void {
    this.input.update();
    this.progression.update(delta);
    this.spawner.update(this.progression.distance, this.progression.speed);
    this.score.addDistance((this.progression.speed * delta) / 1000);
    this.player.update(time, delta);
    emitGameEvent(GAME_EVENTS.SCORE, this.score.getSnapshot());
  }

  private collectVote(v: any): void {
    const pts = v.getData('points') ?? 10;
    this.score.addVote(pts);
    v.setActive(false).setVisible(false); // pooling: nunca destroy
  }

  private gameOver(): void {
    emitGameEvent(GAME_EVENTS.GAME_OVER, this.score.getSnapshot());
    this.scene.start('GameOverScene', this.score.getSnapshot());
  }
}

## 3. Entities (MVP)
Hierarquia mínima (sem Enemy, sem subclasses de Obstacle no MVP):

Phaser.Physics.Arcade.Sprite
  └── Entity (base, com reset()/deactivate() para pooling)
      ├── Player
      ├── Obstacle
      └── Collectible  (o "voto")

// entities/Entity.ts
import Phaser from 'phaser';

export abstract class Entity extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }
  abstract update(time: number, delta: number): void;
  reset(x: number, y: number): void {
    this.setPosition(x, y); this.setActive(true); this.setVisible(true);
    (this.body as Phaser.Physics.Arcade.Body).reset(x, y);
  }
  deactivate(): void { this.setActive(false); this.setVisible(false); }
}
// entities/Player.ts — auto-run + pulo variável + slide (RF-04, RF-05)
import { Entity } from './Entity';
import { PHYSICS } from '../config/constants';

export class Player extends Entity {
  private sliding = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player'); // placeholder retângulo
    this.setGravityY(PHYSICS.GRAVITY);
    this.setVelocityX(PHYSICS.RUN_SPEED); // avanço constante — jogador NÃO controla
    this.setCollideWorldBounds(true);
  }

  // chamado ao iniciar o toque/tecla
  startJump(): void {
    if ((this.body as Phaser.Physics.Arcade.Body).blocked.down) {
      this.setVelocityY(PHYSICS.JUMP_VELOCITY); // impulso inicial
    }
  }
  // chamado a cada frame ENQUANTO segura (pulo variável)
  holdJump(): void {
    if (this.body!.velocity.y < 0) {
      this.setVelocityY(this.body!.velocity.y - PHYSICS.JUMP_HOLD_FORCE);
    }
  }
  // chamado ao soltar cedo (corta o pulo → pulo curto)
  cutJump(): void {
    if (this.body!.velocity.y < PHYSICS.JUMP_CUT) this.setVelocityY(PHYSICS.JUMP_CUT);
  }
  // slide / fast-fall (RF-05)
  slide(active: boolean): void {
    this.sliding = active;
    if (active && !(this.body as Phaser.Physics.Arcade.Body).blocked.down) {
      this.setVelocityY(PHYSICS.FAST_FALL); // desce rápido no ar
    }
    this.setSize(this.width, active ? this.height * 0.5 : this.height); // hitbox baixa
  }

  update(): void {
    const b = this.body as Phaser.Physics.Arcade.Body;
    if (b.velocity.y > PHYSICS.MAX_FALL_SPEED) this.setVelocityY(PHYSICS.MAX_FALL_SPEED);
    this.setVelocityX(PHYSICS.RUN_SPEED); // reforça avanço constante
  }
}
// entities/Obstacle.ts — altos (pular) e baixos/suspensos (deslizar) (RF-06)
import { Entity } from './Entity';

export class Obstacle extends Entity {
  update(): void { if (this.x < -100) this.deactivate(); } // pooling ao sair da tela
}
// entities/Collectible.ts — o "voto" (RF-11)
import { Entity } from './Entity';

export class Collectible extends Entity {
  update(): void { if (this.x < -100) this.deactivate(); }
}

## 4. Systems (lógica; sem I/O de rede)
### 4.1 InputSystem (RF-05, RN-08) — mesmo timing em mobile e desktop
// systems/InputSystem.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';

const HOLD_MAX_MS = 220;      // janela do pulo variável
const SWIPE_DOWN_PX = 40;     // limiar de swipe para slide

export class InputSystem {
  private holding = false;
  private holdStart = 0;
  private pointerDownY = 0;

  constructor(private scene: Phaser.Scene, private player: Player) {
    const kb = scene.input.keyboard!;
    const up = kb.addKey('UP'), space = kb.addKey('SPACE'), down = kb.addKey('DOWN');

    up.on('down', () => this.beginJump()); space.on('down', () => this.beginJump());
    up.on('up', () => this.endJump());     space.on('up', () => this.endJump());
    down.on('down', () => this.player.slide(true));
    down.on('up',   () => this.player.slide(false));

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerDownY = p.y; this.beginJump();
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.y - this.pointerDownY > SWIPE_DOWN_PX) this.player.slide(true); // swipe ↓
      else this.endJump();
    });
  }

  private beginJump(): void { this.holding = true; this.holdStart = this.scene.time.now; this.player.startJump(); }
  private endJump(): void {
    if (!this.holding) return;
    this.holding = false;
    if (this.scene.time.now - this.holdStart < HOLD_MAX_MS) this.player.cutJump(); // soltou cedo = pulo curto
    this.player.slide(false);
  }

  update(): void {
    if (this.holding && this.scene.time.now - this.holdStart < HOLD_MAX_MS) this.player.holdJump();
  }
}

### 4.2 SpawnerSystem (RF-06, RF-11, RN-01) — pooling, obstáculos altos+baixos
// systems/SpawnerSystem.ts
import Phaser from 'phaser';
import { SPAWN } from '../config/constants';

type Kind = 'high' | 'low'; // high = pular por cima; low/suspenso = deslizar por baixo

export class SpawnerSystem {
  private lastSpawnX = 0;

  constructor(
    private scene: Phaser.Scene,
    private obstacles: Phaser.Physics.Arcade.Group,
    private votes: Phaser.Physics.Arcade.Group,
  ) {}

  update(distance: number, speed: number): void {
    const gap = Math.max(SPAWN.GAP_MIN, SPAWN.GAP_BASE - distance * SPAWN.GAP_TIGHTEN);
    if (distance - this.lastSpawnX >= gap) { this.spawn(distance); this.lastSpawnX = distance; }
  }

  private spawn(distance: number): void {
    const w = this.scene.scale.width, h = this.scene.scale.height;
    const kind: Kind = Math.random() < 0.5 ? 'high' : 'low';
    const y = kind === 'high' ? h - 40 : h - 120; // baixo/suspenso exige slide
    const o = this.obstacles.get(w + 60, y, 'obstacle') as Phaser.Physics.Arcade.Sprite;
    if (o) { o.setActive(true).setVisible(true); (o.body as Phaser.Physics.Arcade.Body).reset(w + 60, y);
             o.setVelocityX(-200); o.setData('kind', kind); }

    // rota de risco/recompensa: linha de votos perto do obstáculo (RF-11)
    if (Math.random() < SPAWN.VOTE_LINE_CHANCE) {
      for (let i = 0; i < 3; i++) {
        const v = this.votes.get(w + 120 + i * 30, y - 90, 'vote') as Phaser.Physics.Arcade.Sprite;
        if (v) { v.setActive(true).setVisible(true); (v.body as Phaser.Physics.Arcade.Body).reset(w + 120 + i*30, y - 90);
                 v.setVelocityX(-200); v.setData('points', 10); }
      }
    }
  }
}
### 4.3 ScoreSystem (RF-08, RF-11)
// systems/ScoreSystem.ts
export interface ScoreSnapshot { score: number; votes: number; distance: number; }

export class ScoreSystem {
  private score = 0; private votes = 0; private distance = 0;
  reset(): void { this.score = 0; this.votes = 0; this.distance = 0; }
  addVote(points = 10): void { this.votes += 1; this.score += points; }
  addDistance(m: number): void { this.distance += m; this.score += Math.floor(m); }
  getSnapshot(): ScoreSnapshot { return { score: this.score, votes: this.votes, distance: Math.floor(this.distance) }; }
}

### 4.4 ProgressionSystem (RF-09)
// systems/ProgressionSystem.ts
import { PROGRESSION } from '../config/constants';

export class ProgressionSystem {
  private dist = 0; private curSpeed = PROGRESSION.SPEED_BASE;
  update(delta: number): void {
    this.dist += (this.curSpeed * delta) / 1000;
    const steps = Math.floor(this.dist / PROGRESSION.SPEED_INTERVAL);
    this.curSpeed = Math.min(PROGRESSION.SPEED_MAX, PROGRESSION.SPEED_BASE + steps * PROGRESSION.SPEED_INC);
  }
  get speed(): number { return this.curSpeed; }
  get distance(): number { return Math.floor(this.dist); }
  reset(): void { this.dist = 0; this.curSpeed = PROGRESSION.SPEED_BASE; }
}

### 4.5 AudioSystem (RF-10)
// systems/AudioSystem.ts — SFX + música; respeita autoplay (só após 1ª interação)
import Phaser from 'phaser';
export class AudioSystem {
  constructor(private scene: Phaser.Scene) {}
  jump(): void { this.scene.sound.play('sfx-jump'); }
  vote(): void { this.scene.sound.play('sfx-vote'); }
  death(): void { this.scene.sound.play('sfx-death'); }
  startMusic(): void { if (!this.scene.sound.get('music')) this.scene.sound.play('music', { loop: true, volume: 0.5 }); }
}

## 5. Config central
// config/constants.ts
export const PHYSICS = {
  GRAVITY: 1400, RUN_SPEED: 260, JUMP_VELOCITY: -520,
  JUMP_HOLD_FORCE: 28,   // aplicado por frame enquanto segura (pulo variável)
  JUMP_CUT: -180,        // corta o pulo ao soltar cedo (pulo curto)
  FAST_FALL: 700, MAX_FALL_SPEED: 900,
} as const;

export const SPAWN = {
  GAP_BASE: 420, GAP_MIN: 220, GAP_TIGHTEN: 0.02, VOTE_LINE_CHANCE: 0.4,
} as const;

export const PROGRESSION = {
  SPEED_BASE: 260, SPEED_INC: 15, SPEED_INTERVAL: 500, SPEED_MAX: 460,
} as const;

// config/game-config.ts
import Phaser from 'phaser';
import { PHYSICS } from './constants';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { GameScene } from '../scenes/GameScene';
import { GameOverScene } from '../scenes/GameOverScene';

export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',            // container DIV — NUNCA iframe
  backgroundColor: '#1e1e2e',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%', autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: PHYSICS.GRAVITY }, debug: false } },
  render: { antialias: false, pixelArt: true, roundPixels: true },
  input: { activePointers: 1 },
  scene: [BootScene, PreloadScene, GameScene, GameOverScene],
};

## 6. Comunicação React ↔ Phaser (contrato ÚNICO)
// lib/game-events.ts  (compartilhado — mesma string dos dois lados)
export const GAME_EVENTS  = { SCORE: 'game:score', GAME_OVER: 'game:gameover' } as const;
export const SHELL_EVENTS = { PLAY: 'menu:play', RESTART: 'menu:restart' } as const;

export function emitGameEvent(evt: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(evt, { detail }));
}
export function onGameEvent(evt: string, cb: (d: any) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent).detail);
  window.addEventListener(evt, h);
  return () => window.removeEventListener(evt, h);
}

| Evento | Direção | Payload |
| --- | --- | --- |
| menu:play | React → Phaser | {} |
| menu:restart | React → Phaser | {} |
| game:score | Phaser → React_ | { score, votes, distance } |
| game:gameover | Phaser → React | { score, votes, distance } |

// components/GameShell.tsx — monta Phaser em DIV (NUNCA iframe)
// `game` é um PACOTE do monorepo (npm workspaces): dependência explícita no
// package.json do /web, consumido via factory createGame() — o React controla
// o ciclo de vida (cria no mount, destrói no unmount; instância nova a cada
// montagem, o que torna o restart/remontagem seguros).
import { useEffect } from 'react';
import { createGame, GAME_EVENTS, onGameEvent } from 'game';
import { submitScore } from '../lib/scores';

export function GameShell() {
  useEffect(() => {
    const game = createGame('game-container');
    const unsub = onGameEvent(GAME_EVENTS.GAME_OVER, (d) => submitScore(d));
    return () => { unsub(); game.destroy(true); };
  }, []);
  return <div id="game-container" className="w-full h-full" style={{ touchAction: 'none' }} />;
}

## 7. Supabase (MVP)
### 7.1 Schema + RLS
-- supabase/migrations/001_scores.sql
create table if not exists scores (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references auth.users(id) on delete cascade,
  game_id    text not null default 'polity-bros',
  score      integer not null check (score >= 0),
  votes      integer not null default 0 check (votes >= 0),
  distance   integer not null default 0 check (distance >= 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_scores_rank on scores (game_id, score desc);
create index if not exists idx_scores_recent on scores (created_at desc);

alter table scores enable row level security;

create policy "scores are public read" on scores for select using (true);
-- SEM policy de INSERT/UPDATE/DELETE: com RLS ativa e nenhuma policy de escrita,
-- o cliente (anon key) NÃO consegue gravar nada. Escrita acontece SÓ pela Edge
-- Function submit-score (service role, que bypassa RLS) — D-08.

### 7.2 Edge Function submit-score (RN-04 — inegociável no MVP)
// supabase/functions/submit-score/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_SCORE_PER_SEC = 400; // teto de plausibilidade (distância + votos)

Deno.serve(async (req) => {
  const { score, votes, distance, elapsedSec } = await req.json();
  // sanity check: score impossível para o tempo decorrido → rejeita
  if (score < 0 || elapsedSec <= 0 || score > elapsedSec * MAX_SCORE_PER_SEC) {
    return new Response(JSON.stringify({ ok: false, reason: 'implausible' }), { status: 422 });
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ ok: false }), { status: 401 });

  // TODO: rate limit por player_id (ex.: máx N inserts/min) via tabela ou KV
  const { error } = await supabase.from('scores')
    .insert({ player_id: user.id, score, votes, distance });
  return new Response(JSON.stringify({ ok: !error }), { status: error ? 500 : 200 });
});

### 7.3 Fluxo Game Over → persistência
1. Player colide → GameScene emite game:gameover { score, votes, distance }
2. GameShell (React) recebe → chama Edge Function submit-score (com JWT do usuário + elapsedSec)
3. Edge Function valida plausibilidade + auth → INSERT em scores (RLS)
4. GameShell consulta Top 10 (select público) → renderiza ranking
5. Botão "Jogar de novo" → emite menu:restart → GameScene reinicia

## 8. Performance (RN-01)
- Object pooling para obstáculos e votos — nunca new/destroy no loop.
- pixelArt: true, antialias: false, roundPixels: true.
- Arcade Physics (não Matter).
- Scale.RESIZE (sem letterbox) + touch-action: none no container.
- Áudio pré-carregado no PreloadScene.
- Metas: 60fps estável em celular médio · loading < 3s · bundle game < 2MB gzip.

## 9. Estrutura de pastas (MVP)
/game                        # pacote "game" do monorepo (exports -> src/index.ts)
  index.html
  vite.config.ts
  src/
    index.ts      # entrada PÚBLICA: createGame() + re-export do contrato de eventos
    main.ts       # dev harness standalone (npm run dev -w game, sem o shell)
    config/       game-config.ts · constants.ts · types.ts
    scenes/       BootScene · PreloadScene · GameScene · GameOverScene
    entities/     Entity · Player · Obstacle · Collectible
    systems/      InputSystem · SpawnerSystem · ScoreSystem · ProgressionSystem · AudioSystem
    lib/          game-events.ts (fonte ÚNICA do contrato — o /web importa do pacote 'game')
  public/assets/  (placeholders até Fase 3)
/web              # depende do pacote 'game' ("game": "*")
  src/
    components/   GameShell.tsx · Leaderboard.tsx · MenuScreen.tsx
    lib/          supabase.ts · scores.ts
/supabase
  migrations/     001_scores.sql
  functions/      submit-score/index.ts
    
## 10. Rastreabilidade RF → implementação  
| RF | Onde |
| --- | --- |
| RF-01/02/03 | MenuScreen, GameShell, GameOverScene |
| RF-04 | Player (velocityX constante) |
| RF-05 | InputSystem + Player (startJump/holdJump/cutJump/slide) |
| RF-06 | SpawnerSystem (kind high/low) + Obstacle |
| RF-07 | GameScene overlap → gameOver |
| RF-08/09 | ScoreSystem / ProgressionSystem |
| RF-10 | AudioSystem |
| RF-11 | SpawnerSystem (linha de votos) + Collectible + ScoreSystem.addVote |
| RF-12/13/14_ | Edge Function submit-score + scores RLS + Leaderboard |


