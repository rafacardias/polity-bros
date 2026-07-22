import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Entity } from '../entities/Entity';
import { Obstacle } from '../entities/Obstacle';
import { Enemy } from '../entities/Enemy';
import { Collectible } from '../entities/Collectible';
import { getSelectedSkin, skinTextures } from '../lib/skins';
import { InputSystem } from '../systems/InputSystem';
import { SpawnerSystem } from '../systems/SpawnerSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { BestScoreSystem, type BestRecord } from '../systems/BestScoreSystem';
import { OnboardingSystem } from '../systems/OnboardingSystem';
import { WalletSystem } from '../systems/WalletSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { emitGameEvent, GAME_EVENTS, type GameEventPayload } from '../lib/game-events';
import { ECONOMY, ENEMY, JUICE, SCORE, SIZES, type WorldDef } from '../config/constants';
import { WorldSystem } from '../systems/WorldSystem';
import { GemCollectionSystem } from '../systems/GemCollectionSystem';
import { WorldVotesSystem } from '../systems/WorldVotesSystem';

const SCORE_EMIT_INTERVAL_MS = 250; // cadência do game:score (D-05) — 60/s seria ruído

// Intro cinematográfica (estilo Mario Run): close-up no personagem correndo no
// lugar (mundo/score/tempo PARADOS, HUD oculto), câmera afasta em ~0.9s e o
// jogo começa. Pulável no 1º toque para não ferir o restart rápido (RN-03).
const INTRO = { ZOOM: 1.9, MS: 900 } as const;

// Loop principal (design.md §2). Auto-run world-scroll (RF-04): o Player fica
// em X fixo e o cenário/obstáculos deslizam para a esquerda na velocidade
// corrente. Velocidade fixa neste bloco; ProgressionSystem entra na T04-11.
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputSystem!: InputSystem;
  private spawner!: SpawnerSystem;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private votes!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private bars!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group; // inimigos (D-25) — stomp por votos
  private stompCombo = 0; // stomps encadeados NO AR; zera ao tocar o chão (§7-F)
  private gemText!: Phaser.GameObjects.Text;
  private gemBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private runGems = 0;
  private votesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private groundTile!: Phaser.GameObjects.TileSprite;
  // Fundo de parallax (Fase 3): skyline atrás do gameplay, só existe se o
  // mundo tiver arte 'bg-<id>'. Rola a SKY_PARALLAX da velocidade do chão.
  private skyTile?: Phaser.GameObjects.TileSprite;
  private readonly SKY_PARALLAX = 0.35;
  private score!: ScoreSystem;
  private progression!: ProgressionSystem;
  private audio!: AudioSystem;
  private muteButton!: Phaser.GameObjects.Text;
  private voteBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private comboText!: Phaser.GameObjects.Text;
  private comboTween?: Phaser.Tweens.Tween;
  private bestRecord!: BestRecord;
  private recordGhost!: Phaser.GameObjects.Image;
  private recordLabel!: Phaser.GameObjects.Text;
  private recordCelebrated = false;
  private onboardingHint?: Phaser.GameObjects.Text;
  private onboardingPulse?: Phaser.Tweens.Tween;
  private world!: WorldDef;
  private won = false;
  private stars = 1; // D-17: ⭐ morreu · ⭐⭐ terminou · ⭐⭐⭐ terminou com tudo
  private unlockedWorldName: string | null = null;
  private announceBanner!: Phaser.GameObjects.Text;
  private finishLine!: Phaser.GameObjects.Rectangle;
  private finishLabel!: Phaser.GameObjects.Text;
  private emitAccumulator = 0;
  private elapsedMs = 0;
  private isGameOver = false;
  private introActive = false;
  private continueUsed = false;
  private invulnerableUntil = 0;
  private continueUi: Phaser.GameObjects.GameObject[] = [];
  private continueTimers: Phaser.Time.TimerEvent[] = [];
  private continueTapHandler?: (p: Phaser.Input.Pointer) => void;
  private continueKeyCleanup?: () => void;
  // payload da morte pendente enquanto a oferta de continue está aberta —
  // emitido no SHUTDOWN da cena se o jogador sair pro menu no meio (review
  // 7B: antes, o score dessa run era descartado silenciosamente)
  private pendingGameOverPayload?: GameEventPayload;
  // T07D-04 (D-12): dataURL do frame final (morte ou vitória) para a imagem
  // de compartilhamento. Preenchido de forma assíncrona/best-effort — lido
  // só no instante do emit, nunca aguardado (ver captureFinalFrame).
  private finalScreenshot?: string;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const groundTop = height - SIZES.GROUND_H;

    // chão = limite inferior do mundo físico; faixa visual rolante dá a
    // sensação de avanço mesmo antes de existirem obstáculos
    this.physics.world.setBounds(0, 0, width, groundTop);
    this.groundTile = this.add.tileSprite(
      width / 2,
      height - SIZES.GROUND_H / 2,
      width,
      SIZES.GROUND_H,
      'ground',
    );

    this.audio = new AudioSystem(this);
    this.player = new Player(this, SIZES.PLAYER.SCREEN_X, groundTop);
    this.inputSystem = new InputSystem(this, this.player, this.audio);

    // pools (RN-01): maxSize limita instâncias; get() reutiliza
    this.obstacles = this.physics.add.group({
      classType: Obstacle,
      maxSize: 24,
      runChildUpdate: true,
    });
    this.votes = this.physics.add.group({
      classType: Collectible,
      maxSize: 36,
      runChildUpdate: true,
    });
    this.gems = this.physics.add.group({
      classType: Collectible,
      maxSize: 4, // no máx. 2 por partida (ECONOMY.GEM_WINDOWS_M) + folga
      runChildUpdate: true,
    });
    this.bars = this.physics.add.group({
      classType: Collectible,
      maxSize: 3, // blocos flutuantes (D-18/D-22) — plataforma-obstáculo
      runChildUpdate: true,
    });
    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: 12, // inimigos (D-25) — pooling; update() recicla fora da tela
      runChildUpdate: true,
    });
    // mundo selecionado (D-16): layout FIXO via RNG semeado — a mesma fase
    // para todos os jogadores, em todas as partidas
    this.world = WorldSystem.selected();
    this.won = false;
    this.stars = 1;
    this.stompCombo = 0;
    this.unlockedWorldName = null;
    const rng = new Phaser.Math.RandomDataGenerator([this.world.seed]);
    this.spawner = new SpawnerSystem(
      this,
      this.obstacles,
      this.votes,
      this.gems,
      this.bars,
      this.enemies,
      rng,
      this.world.lengthM * SCORE.PX_PER_M,
      GemCollectionSystem.collected(this.world.id),
    );

    // RF-07: qualquer contato com obstáculo encerra a partida
    this.physics.add.overlap(this.player, this.obstacles, (_p, o) =>
      this.gameOver(o as Obstacle),
    );
    // RF-11: coletar voto incrementa o contador do HUD
    this.physics.add.overlap(this.player, this.votes, (_p, v) =>
      this.collectVote(v as Collectible),
    );
    // T07B-02: gema rara → carteira persistente
    this.physics.add.overlap(this.player, this.gems, (_p, g) =>
      this.collectGem(g as Collectible),
    );
    // D-22: bloco flutuante é plataforma-obstáculo — COLLIDER (separa os
    // corpos, dá pra ficar em pé no topo). Pouso por cima é seguro; contato
    // pelas laterais ou pelo fundo mata, como nos obstáculos verticais.
    this.physics.add.collider(this.player, this.bars, (_p, b) => {
      const pb = this.player.body as Phaser.Physics.Arcade.Body;
      const bb = (b as Collectible).body as Phaser.Physics.Arcade.Body;
      // Pouso EM CIMA = seguro (plataforma). Checagem GEOMÉTRICA pela posição
      // do frame ANTERIOR (body.prev): o player veio de cima se seus pés
      // estavam acima do topo da barra no frame passado. E imune a como o
      // Arcade resolveu o eixo neste frame — numa plataforma que desliza para a
      // esquerda, um pouso no topo as vezes era resolvido como toque lateral
      // (touching.right falso) e matava injustamente ao cair sobre a propina
      // (bug reportado pelo dono). Bater na lateral/fundo segue fatal (D-22).
      const cameFromAbove = pb.prev.y + pb.height <= bb.prev.y + 6;
      if (!cameFromAbove) this.gameOver(b as Collectible);
    });
    // Inimigo (D-25): OVERLAP (não collider) — como os obstáculos. Pisar em cima
    // (veio de cima) = STOMP por votos; contato lateral/frontal = morte. A decisão
    // é 100% de código (hitEnemy) pelo teste "veio de cima" (body.prev, à prova de
    // alvo em movimento). Overlap NÃO separa corpos: sem isto, o inimigo imóvel
    // empurrava o player para fora do X fixo (bug do "não pulava direito").
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.hitEnemy(e as Enemy));

    // emitter ÚNICO criado fora do loop; explode() reutiliza partículas do
    // pool interno do Phaser (RN-01 — nada de new/destroy por coleta)
    this.voteBurst = this.add.particles(0, 0, 'vote', {
      emitting: false,
      lifespan: JUICE.VOTE_BURST_LIFESPAN_MS,
      speed: { min: 80, max: 220 },
      angle: { min: 200, max: 340 }, // leque pra cima (o mundo corre pra esquerda)
      gravityY: 600,
      scale: { start: 0.7, end: 0 },
      quantity: JUICE.VOTE_BURST_COUNT,
    });
    this.voteBurst.setDepth(5);
    this.gemBurst = this.add.particles(0, 0, 'gem', {
      emitting: false,
      lifespan: 450,
      speed: { min: 100, max: 260 },
      angle: { min: 200, max: 340 },
      gravityY: 500,
      scale: { start: 0.8, end: 0 },
      rotate: { min: 0, max: 360 },
      quantity: 14,
    });
    this.gemBurst.setDepth(5);
    this.runGems = 0;

    this.score = new ScoreSystem();
    this.createHud(width);
    this.bestRecord = BestScoreSystem.load(this.world.id);
    this.recordCelebrated = false;
    this.createRecordMarker();
    this.createFinishMarker();
    this.applyWorldPalette();
    this.audio.startMusic();
    this.cameras.main.fadeIn(JUICE.FADE_IN_MS, 0, 0, 0);
    this.startIntro(); // close-up + zoom-out; o onboarding aparece ao final dela

    this.progression = new ProgressionSystem(this.world.speed);
    this.emitAccumulator = 0;
    this.elapsedMs = 0;
    this.isGameOver = false;
    this.continueUsed = false;
    this.invulnerableUntil = 0;
    this.pendingGameOverPayload = undefined;
    this.finalScreenshot = undefined; // T07D-04: não vazar frame de uma run anterior
    // rede de segurança do score (review 7B): sair da cena com uma morte
    // pendente (oferta aberta) ainda emite o game:gameover — o listener de
    // submit vive no App React, que sobrevive ao unmount do GameShell
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.pendingGameOverPayload) {
        // run terminou "por fora" (saiu pro menu na oferta): os votos ainda
        // contam pro progresso de skin do mundo (D-19) — nada se perde
        WorldVotesSystem.add(this.world.id, this.pendingGameOverPayload.votes);
        emitGameEvent(GAME_EVENTS.GAME_OVER, {
          ...this.pendingGameOverPayload,
          screenshot: this.finalScreenshot, // valor mais recente no instante do emit
        });
        this.pendingGameOverPayload = undefined;
      }
    });
  }

  // HUD (RF-03/T04-12): score, votos e distância sempre visíveis, fora da
  // área de ação do polegar (RN-02)
  private createHud(width: number): void {
    const style = { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' };
    this.scoreText = this.add
      .text(width / 2, 10, 'SCORE 0', { ...style, fontSize: '20px' })
      .setOrigin(0.5, 0)
      .setDepth(10);
    // votos por ÍCONE (ponto 6/HUD, ref. Mario Run): 🗳️ + número no lugar da
    // palavra "VOTOS" — linguagem universal, menos "cara de app" (par do 💵)
    this.votesText = this.add
      .text(width - 12, 10, '🗳️ 0', { ...style, color: '#facc15' })
      .setOrigin(1, 0)
      .setDepth(10);
    // carteira de propinas (T07B-02, D-21): saldo TOTAL do aparelho
    this.gemText = this.add
      .text(width - 12, 32, `💵 ${WalletSystem.balance()}`, { ...style, color: '#4ade80' })
      .setOrigin(1, 0)
      .setDepth(10);
    // countdown "faltam Xm": contorno escuro + negrito garantem leitura sobre
    // QUALQUER céu de mundo (SP azul-claro, RJ teal, BSB índigo). O cinza
    // anterior (#94a3b8) sumia no azul do skyline — feedback do dono. Y=52 para
    // não ficar sob o botão "← Menu" do shell React (que ocupa o topo-esquerdo).
    this.distanceText = this.add
      .text(12, 52, '0m', {
        ...style,
        fontStyle: 'bold',
        stroke: '#0f172a',
        strokeThickness: 4,
      })
      .setOrigin(0, 0)
      .setDepth(10);

    // mute (T05-06/RN-02): canto oposto ao botão "← Menu" do shell React,
    // fora da área de ação do polegar
    // texto flutuante do combo (T07A-03): UM objeto reutilizado por tween —
    // nada de criar/destruir texto dentro do loop (RN-01)
    this.comboText = this.add
      .text(0, 0, `LINHA PERFEITA! +${SCORE.LINE_BONUS_VOTES * SCORE.VOTE_POINTS}`, {
        ...style,
        fontSize: '18px',
        color: '#facc15',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    // banner central reutilizado (vitória de fase, anúncios) — um objeto só
    this.announceBanner = this.add
      .text(width / 2, this.scale.height * 0.42, '', {
        ...style,
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setVisible(false);

    this.muteButton = this.add
      .text(width - 12, this.scale.height - 10, this.sound.mute ? '🔇' : '🔊', {
        ...style,
        fontSize: '22px',
      })
      .setOrigin(1, 1)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const muted = this.audio.toggleMute();
        this.muteButton.setText(muted ? '🔇' : '🔊');
      });
  }

  private updateHud(): void {
    const snap = this.score.getSnapshot();
    this.scoreText.setText(`SCORE ${snap.score}`);
    // countdown regressivo (D-16): "faltam Xm" cria o senso de FIM DO MUNDO
    // ("cheguei tão perto, na próxima eu consigo") — pedido do 2º brainstorm
    this.distanceText.setText(`faltam ${Math.max(0, this.world.lengthM - snap.distance)}m`);
    // votesText atualiza em collectVote (evento raro, não a cada frame)
  }

  private collectVote(vote: Collectible): void {
    const { x, y } = vote;
    const lineComplete = this.spawner.onVoteCollected(vote); // antes do deactivate
    vote.deactivate(); // pooling: nunca destroy (RN-01)
    this.score.addVote();
    this.audio.vote();
    this.voteBurst.explode(JUICE.VOTE_BURST_COUNT, x, y); // T07A-02
    if (lineComplete) this.celebrateLine(x, y); // momento "uau" (T07A-03)
    this.votesText.setText(`🗳️ ${this.score.getSnapshot().votes}`);
  }

  // propina (T07B-02, D-11, D-21): vai DIRETO pra carteira persistente —
  // mesmo morrendo, a run deixou algo pra trás ("mesmo assim avancei")
  private collectGem(gem: Collectible): void {
    const { x, y } = gem;
    // coleção persistente por mundo (D-18): esta propina não renasce
    const gemIndex = gem.getData('gemIndex') as number | undefined;
    if (gemIndex !== undefined) {
      GemCollectionSystem.markCollected(this.world.id, gemIndex);
      this.spawner.onGemCollected(gemIndex); // bloco resolvido p/ 3⭐ (D-17)
    }
    gem.deactivate();
    this.runGems += 1;
    const balance = WalletSystem.add(1);
    this.gemText.setText(`💵 ${balance}`);
    this.audio.gem();
    this.gemBurst.explode(14, x, y);
    this.showFloatingText(x, y - 24, 'PROPINA! 💵');
  }

  // Inimigo tocado (D-25): "veio de cima" → STOMP; senão, morte (respeitando a
  // carência pós-revive). O teste por body.prev é imune ao eixo que o Arcade
  // escolhe ao colidir com um corpo que anda para a esquerda.
  private hitEnemy(enemy: Enemy): void {
    if (this.isGameOver) return;
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    const eb = enemy.body as Phaser.Physics.Arcade.Body;
    const cameFromAbove = pb.prev.y + pb.height <= eb.prev.y + 6;
    if (cameFromAbove) {
      this.stompEnemy(enemy);
      return;
    }
    if (this.time.now < this.invulnerableUntil) return; // carência pós-revive (T07B-03)
    this.gameOver(enemy);
  }

  // STOMP (D-25, §7-F): derrota o inimigo, quica o player e credita votos com
  // combo simples (cada stomp encadeado NO AR soma STOMP_COMBO_BONUS; o combo
  // zera ao tocar o chão — ver update()). Votos passam pelo contador (RN-04).
  private stompEnemy(enemy: Enemy): void {
    this.stompCombo += 1;
    const reward = ENEMY.STOMP_VOTES + (this.stompCombo - 1) * ENEMY.STOMP_COMBO_BONUS;
    this.score.addVotes(reward);
    enemy.deactivate(); // pooling: nunca destroy (RN-01)
    this.player.setVelocityY(ENEMY.STOMP_BOUNCE); // quica (game feel + reposiciona)
    this.audio.vote();
    this.voteBurst.explode(JUICE.VOTE_BURST_COUNT, enemy.x, enemy.y - ENEMY.H / 2);
    this.votesText.setText(`🗳️ ${this.score.getSnapshot().votes}`);
    this.showFloatingText(
      enemy.x,
      enemy.y - ENEMY.H,
      this.stompCombo > 1 ? `STOMP x${this.stompCombo}! +${reward}` : `STOMP! +${reward}`,
    );
  }

  // linha inteira coletada: bônus (em votos — ver SCORE.LINE_BONUS_VOTES),
  // fanfarra, explosão maior e texto flutuante
  private celebrateLine(x: number, y: number): void {
    this.score.addLineBonus();
    this.audio.combo();
    this.voteBurst.explode(JUICE.COMBO_BURST_COUNT, x, y);
    this.showFloatingText(x, y - 24, `LINHA PERFEITA! +${SCORE.LINE_BONUS_VOTES * SCORE.VOTE_POINTS}`);
  }

  // texto flutuante compartilhado (combo, novo recorde): UM objeto, um tween
  private showFloatingText(x: number, y: number, msg: string): void {
    this.comboTween?.stop();
    this.comboText.setText(msg).setPosition(x, y).setAlpha(1).setVisible(true);
    this.comboTween = this.tweens.add({
      targets: this.comboText,
      y: y - 48,
      alpha: 0,
      duration: JUICE.COMBO_TEXT_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => this.comboText.setVisible(false),
    });
  }

  // Marcador do recorde pessoal na pista (T07A-04, D-10, D-23): o "você de
  // ontem" — a skin atual do player parada no ponto do recorde, com 10% de
  // opacidade (fantasma). Quase-vitória visível, sem mexer em dificuldade.
  // Invisível na primeira partida (sem recorde).
  private createRecordMarker(): void {
    const groundTop = this.scale.height - SIZES.GROUND_H;
    this.recordGhost = this.add
      .image(0, groundTop, skinTextures(getSelectedSkin()).idle)
      .setOrigin(0.5, 1)
      .setAlpha(JUICE.RECORD_GHOST_ALPHA)
      .setDepth(4)
      .setVisible(false);
    this.recordLabel = this.add
      .text(0, groundTop - SIZES.PLAYER.H - 8, '🏁 RECORDE', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#facc15',
      })
      .setOrigin(0.5, 1)
      .setDepth(4)
      .setVisible(false);
  }

  // Intro cinematográfica (ponto 6, ref. Mario Run): zoom no personagem
  // correndo no lugar, HUD/tempo ocultos; a câmera afasta e o jogo "abre".
  // Enquanto ativa, o update() só anima o player (mundo/score congelados).
  private startIntro(): void {
    this.introActive = true;
    const { width, height } = this.scale;
    const cam = this.cameras.main;
    this.setHudVisible(false); // "o tempo ainda não conta"
    cam.setZoom(INTRO.ZOOM);
    cam.centerOn(this.player.x, this.player.y - 24); // close no personagem
    cam.pan(width / 2, height / 2, INTRO.MS, 'Sine.easeInOut');
    cam.zoomTo(1, INTRO.MS, 'Sine.easeInOut');
    this.time.delayedCall(INTRO.MS, () => this.endIntro());
    // pular no 1º toque/tecla — restart rápido não pode esperar a animação (RN-03)
    this.input.once('pointerdown', () => this.endIntro());
    this.input.keyboard?.once('keydown', () => this.endIntro());
  }

  private endIntro(): void {
    if (!this.introActive) return; // idempotente (timer + skip disputam)
    this.introActive = false;
    const { width, height } = this.scale;
    const cam = this.cameras.main;
    cam.panEffect.reset();
    cam.zoomEffect.reset();
    cam.setZoom(1);
    cam.centerOn(width / 2, height / 2); // volta à câmera fixa do runner
    this.setHudVisible(true);
    this.createOnboardingHint(); // só depois do zoom (respiro de leitura)
  }

  private setHudVisible(v: boolean): void {
    this.scoreText.setVisible(v);
    this.votesText.setVisible(v);
    this.gemText.setVisible(v);
    this.distanceText.setVisible(v);
  }

  // Micro-onboarding (T07A-06, RF-15): hint de controles UMA vez por
  // aparelho, mínimo e não-bloqueante. Some na 1ª interação (o jogador agiu
  // = entendeu) ou sozinho após 6s. FIRST_GAP + aquecimento (T07A-05) dão o
  // respiro de leitura antes do 1º obstáculo. Critério: entender em ≤5s.
  private createOnboardingHint(): void {
    if (OnboardingSystem.isDone()) return;
    const touch = this.sys.game.device.input.touch;
    const lines = touch
      ? 'TOQUE = pular\nSEGURE = pular mais alto\nDESLIZE ↓ = escorregar'
      : 'ESPAÇO ou ↑ = pular\nSEGURE = pular mais alto\n↓ = deslizar';
    this.onboardingHint = this.add
      .text(this.scale.width / 2, this.scale.height * 0.3, lines, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#0f172abf',
        padding: { x: 14, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.onboardingPulse = this.tweens.add({
      targets: this.onboardingHint,
      alpha: 0.75,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.input.once('pointerdown', () => this.dismissOnboarding(900));
    this.input.keyboard?.once('keydown', () => this.dismissOnboarding(900));
    this.time.delayedCall(6000, () => this.dismissOnboarding(500));
  }

  private dismissOnboarding(fadeMs: number): void {
    if (!this.onboardingHint) return;
    const hint = this.onboardingHint;
    this.onboardingHint = undefined; // idempotente (toque + timer)
    this.onboardingPulse?.stop();
    OnboardingSystem.markDone();
    this.tweens.add({
      targets: hint,
      alpha: 0,
      duration: fadeMs,
      onComplete: () => hint.setVisible(false),
    });
  }

  // Paleta = TEMA do mundo (D-16, supersede D-14): aplicada uma vez na
  // largada — fundo, chão e tint sutil dos obstáculos. Silhueta sagrada.
  private applyWorldPalette(): void {
    this.cameras.main.setBackgroundColor(this.world.bg);
    this.createSkyBackground();
    this.groundTile.setTint(this.world.groundTint);
    this.spawner.setObstacleTint(this.world.obstacleTint);
  }

  // Camada de skyline do mundo (Fase 3): parallax atrás de tudo (depth < 0).
  // A cor sólida de world.bg fica como fundo/fallback. A textura é escalada
  // para cobrir a altura sem repetir no eixo Y (só rola em X). A arte já vem
  // dessaturada para não competir com a silhueta dos obstáculos (D-16).
  private createSkyBackground(): void {
    const key = `bg-${this.world.id}`;
    if (!this.textures.exists(key)) return; // mundo sem skyline → cor sólida
    const { width, height } = this.scale;
    const groundTop = height - SIZES.GROUND_H;
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const scale = groundTop / src.height; // cobre a altura; repete só em X
    this.skyTile = this.add
      .tileSprite(0, 0, width, groundTop, key)
      .setOrigin(0, 0)
      .setTileScale(scale, scale)
      .setDepth(-10);
  }

  // Linha de chegada (D-16): quadriculada, se aproxima como o marcador de
  // recorde — o "fim do mundo" é VISÍVEL, não abstrato
  private createFinishMarker(): void {
    const groundTop = this.scale.height - SIZES.GROUND_H;
    this.finishLine = this.add
      .rectangle(0, groundTop, 6, 220, 0xffffff, 0.9)
      .setOrigin(0.5, 1)
      .setDepth(4)
      .setVisible(false);
    this.finishLabel = this.add
      .text(0, groundTop - 226, '🏁 CHEGADA', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1)
      .setDepth(4)
      .setVisible(false);
  }

  private updateFinishMarker(): void {
    const x =
      SIZES.PLAYER.SCREEN_X + (this.world.lengthM * SCORE.PX_PER_M - this.score.getDistancePx());
    const visible = x > -24 && x < this.scale.width + 48;
    this.finishLine.setVisible(visible).setX(x);
    this.finishLabel.setVisible(visible).setX(x);
  }

  // Vitória (D-16): cruzou a linha — celebração + desbloqueio do próximo
  // mundo + estrelas (D-17): ⭐⭐ por terminar, ⭐⭐⭐ por terminar com TODOS
  // os coletáveis (a escolha propina-vs-votos no bloco não penaliza).
  private finishWorld(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.won = true;
    // T07D-04: frame da vitória, ANTES de qualquer transição de cena — dá o
    // maior tempo possível pro snapshot assíncrono resolver antes do emit
    // (finalizeGameOver só roda 1500ms depois, via delayedCall abaixo)
    this.captureFinalFrame();
    // votos deixados para trás ainda ativos contam como perdidos ANTES de
    // fechar a conta das estrelas
    this.spawner.finalizeMisses(this.player.x - SIZES.PLAYER.W / 2);
    this.stars = this.spawner.isPerfectRun() ? 3 : 2;
    this.inputSystem.setEnabled(false);
    this.physics.pause();
    this.audio.combo();
    this.voteBurst.explode(24, this.player.x, this.player.y - 40);
    this.gemBurst.explode(10, this.player.x, this.player.y - 60);
    this.announceBanner
      .setText(`🏁 FASE COMPLETA!\n${'⭐'.repeat(this.stars)}`)
      .setAlpha(0)
      .setScale(0.8)
      .setVisible(true);
    this.tweens.add({
      targets: this.announceBanner,
      alpha: 1,
      scale: 1.1,
      duration: 350,
      ease: 'Back.easeOut',
    });

    this.unlockedWorldName = WorldSystem.unlockNext(this.world.id)?.name ?? null;
    this.pendingGameOverPayload = this.buildGameOverPayload();
    this.time.delayedCall(1500, () => this.finalizeGameOver());
  }

  private updateRecordMarker(): void {
    if (this.bestRecord.distance <= 0) return; // primeira partida: sem marcador
    const bestPx = this.bestRecord.distance * SCORE.PX_PER_M;
    const x = SIZES.PLAYER.SCREEN_X + (bestPx - this.score.getDistancePx());
    const visible = x > -24 && x < this.scale.width + 48;
    this.recordGhost.setVisible(visible).setX(x);
    this.recordLabel.setVisible(visible).setX(x);

    // texto diz DISTÂNCIA de propósito: o "recorde" oficial (game over e
    // ranking) é por SCORE — celebrar "NOVO RECORDE!" aqui contradiria a
    // tela de morte quando a distância cresce mas o score não (review 7A)
    if (!this.recordCelebrated && this.score.getDistancePx() > bestPx) {
      this.recordCelebrated = true; // 1x por partida
      this.audio.combo();
      this.showFloatingText(
        SIZES.PLAYER.SCREEN_X + 70,
        this.scale.height * 0.35,
        'DISTÂNCIA RECORDE!',
      );
    }
  }

  update(time: number, delta: number): void {
    if (this.isGameOver) return;
    // intro (ponto 6): personagem corre no lugar; nada avança até a câmera abrir
    if (this.introActive) {
      this.player.update(time, delta);
      return;
    }
    this.elapsedMs += delta;
    this.inputSystem.update();
    this.progression.update(delta); // dificuldade crescente (RF-09)
    const speed = this.progression.speed;
    const step = (speed * delta) / 1000;
    this.groundTile.tilePositionX += step;
    if (this.skyTile) this.skyTile.tilePositionX += step * this.SKY_PARALLAX; // parallax (Fase 3)
    this.score.addDistance(step); // pontos por distância/tempo (RF-08)
    this.spawner.update(this.progression.distance, speed);
    this.syncWorldSpeed(speed);
    this.player.update(time, delta);
    // Invariante do auto-runner (RF-04): o player fica SEMPRE em SCREEN_X — só
    // controla o eixo vertical. Trava o X para que NENHUMA colisão (bloco D-22,
    // resíduo físico) possa arrastá-lo para fora da posição fixa. Inimigos já são
    // overlap (não empurram), mas isto blinda a invariante contra qualquer fonte.
    if (this.player.x !== SIZES.PLAYER.SCREEN_X) this.player.x = SIZES.PLAYER.SCREEN_X;
    if (this.player.onGround) this.stompCombo = 0; // combo de stomp exige encadear NO AR
    this.updateHud();
    this.updateRecordMarker();
    this.updateFinishMarker();
    // fim do mundo (D-16): cruzou a distância da fase → vitória
    if (this.score.getSnapshot().distance >= this.world.lengthM) this.finishWorld();

    // contrato D-05: score periódico para o shell React (throttled)
    this.emitAccumulator += delta;
    if (this.emitAccumulator >= SCORE_EMIT_INTERVAL_MS) {
      this.emitAccumulator = 0;
      emitGameEvent(GAME_EVENTS.SCORE, this.score.getSnapshot());
    }
  }

  // mantém obstáculos/votos já spawnados na MESMA velocidade do chão quando
  // a progressão acelera — sem isso o mundo "rasga" a cada degrau de speed
  private syncWorldSpeed(speed: number): void {
    const sync = (child: Phaser.GameObjects.GameObject): boolean => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active) sprite.setVelocityX(-speed);
      return true;
    };
    this.obstacles.children.iterate(sync);
    this.votes.children.iterate(sync);
    this.gems.children.iterate(sync);
    this.bars.children.iterate(sync);
    // inimigos andam MAIS rápido que o scroll (aproximação) — sync com o offset
    this.enemies.children.iterate((child) => {
      const e = child as Phaser.Physics.Arcade.Sprite;
      if (e.active) e.setVelocityX(-(speed + ENEMY.WALK_SPEED));
      return true;
    });
  }

  // RF-07: morte. Com saldo e continue ainda não usado, abre a oferta
  // arcade (T07B-03) ANTES de finalizar — o game:gameover (e o submit de
  // score) só acontecem na morte definitiva. killer é Entity: obstáculo
  // vertical OU bloco flutuante (D-22) — o tipo vem do data 'kind'.
  private gameOver(killer?: Entity): void {
    if (this.isGameOver) return;
    if (this.time.now < this.invulnerableUntil) return; // carência pós-revive
    this.isGameOver = true;
    this.physics.pause();
    this.inputSystem.setEnabled(false);
    this.player.setTint(0x94a3b8);
    this.player.freezeAnimation(); // congela o ciclo de corrida no frame da morte
    this.audio.death();
    // impacto legível (T07A-02): shake + flash curtos — morte "registra"
    this.cameras.main.shake(JUICE.SHAKE_DURATION_MS, JUICE.SHAKE_INTENSITY);
    this.cameras.main.flash(JUICE.FLASH_DURATION_MS, 239, 68, 68);
    // T07D-04: captura o frame JÁ aqui, mesmo que a oferta de continue ainda
    // vá abrir — se o jogador aceitar (revive), este frame fica obsoleto e é
    // naturalmente sobrescrito na morte DEFINITIVA seguinte; se recusar/não
    // houver oferta, é exatamente o frame do fim de jogo real
    this.captureFinalFrame();

    // morte registrada JÁ como pendente: se o jogador sair pro menu durante
    // a oferta, o SHUTDOWN emite este payload e o score não se perde
    this.pendingGameOverPayload = this.buildGameOverPayload(killer);

    const canContinue =
      !this.continueUsed && WalletSystem.balance() >= ECONOMY.CONTINUE_COST;
    if (canContinue) {
      this.time.delayedCall(500, () => this.offerContinue(killer)); // beat da morte
      return;
    }
    this.finalizeGameOver(killer);
  }

  // T07D-04 (D-12): frame do momento final (morte/vitória) para a imagem de
  // compartilhamento. Assíncrono e best-effort: snapshot() sem coordenadas
  // devolve a IMAGEM INTEIRA via HTMLImageElement, cujo .src já é o dataURL
  // PNG pronto pra uso — nunca aguardamos o callback (RN de fluxo: falha ou
  // atraso na captura jamais pode travar/adiar o game:gameover).
  private captureFinalFrame(): void {
    try {
      this.game.renderer.snapshot((image) => {
        if (image instanceof HTMLImageElement) {
          this.finalScreenshot = image.src;
        }
      });
    } catch {
      // captura é um extra cosmético — nunca pode quebrar o fim de jogo
    }
  }

  private buildGameOverPayload(killer?: Entity): GameEventPayload {
    const snapshot = this.score.getSnapshot();
    // elapsedSec: teto de plausibilidade da Edge Function (RN-04).
    // deathCause: telemetria (D-10) — sem killer identificado → 'unknown'.
    const kind = killer?.getData('kind') as string | undefined;
    const deathCause: GameEventPayload['deathCause'] = !killer
      ? 'unknown'
      : kind === 'low'
        ? 'obstacle-low'
        : kind === 'block'
          ? 'block' // laterais/fundo do bloco flutuante (D-22)
          : 'obstacle-high';
    // score v2 (D-17): o score FINAL (submetido/ranqueado) é base × estrelas.
    // A Edge Function v2 valida score === (distance + votes×10) × stars.
    const stars = this.won ? this.stars : 1;
    return {
      ...snapshot,
      score: snapshot.score * stars,
      stars,
      elapsedSec: this.elapsedMs / 1000,
      deathCause: this.won ? undefined : deathCause, // vitória não tem killer
      gems: this.runGems, // T07B-02: gemas desta run
      continueUsed: this.continueUsed, // T07B-03: selo "sem continue" (D-17)
      world: this.world.id, // D-16
      won: this.won, // D-16: cruzou a linha de chegada
    };
  }

  // Oferta de continue (T07B-03, D-11): botão tremendo + countdown. Aceitar
  // gasta propinas e revive no lugar; recusar/estourar o tempo finaliza.
  private offerContinue(killer?: Entity): void {
    const { width, height } = this.scale;
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
      .setDepth(20)
      .setInteractive(); // absorve o hit-test de objetos sob a oferta (ex.: mute)
    const btn = this.add
      .text(width / 2, height * 0.45, `▶ CONTINUE — ${ECONOMY.CONTINUE_COST} 💵`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#0f172a',
        backgroundColor: '#facc15',
        padding: { x: 18, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(21);
    const countdown = this.add
      .text(width / 2, height * 0.56, `some em ${ECONOMY.CONTINUE_OFFER_SEC}s…`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.continueUi = [dim, btn, countdown];

    // "tremida rápida a cada 0.5s" (pedido do dono no brainstorm)
    this.tweens.add({
      targets: btn,
      x: '+=4',
      duration: 50,
      yoyo: true,
      repeat: -1,
      repeatDelay: 450,
    });

    // decisão única (aceitar/recusar), por qualquer via: toque, teclado
    // ou timeout — RN-03/D-15: recusar tem que ser IMEDIATO, sem esperar 4s
    let decided = false;
    const decide = (accepted: boolean): void => {
      if (decided) return;
      decided = true;
      this.closeContinueOffer();
      if (accepted && WalletSystem.spend(ECONOMY.CONTINUE_COST)) {
        this.revive();
        return;
      }
      this.finalizeGameOver(killer);
    };

    let remaining = ECONOMY.CONTINUE_OFFER_SEC;
    this.continueTimers = [
      this.time.addEvent({
        delay: 1000,
        repeat: ECONOMY.CONTINUE_OFFER_SEC - 1,
        callback: () => {
          remaining -= 1;
          countdown.setText(`some em ${remaining}s…`);
        },
      }),
      this.time.delayedCall(ECONOMY.CONTINUE_OFFER_SEC * 1000, () => decide(false)),
    ];

    // Aceite via pointerdown de CENA + bounds do botão (mesmo pipeline dos
    // pulos, comprovado em mouse E touch — hit-test por GameObject falhou
    // com mouse no harness). Bounds inflados p/ dedo no mobile (RN-02).
    // Toque FORA do botão = RECUSA imediata (review 7B: jogador com gemas
    // que não quer gastar volta a "recomeçar em 1 toque" — RN-03), com
    // carência de 600ms contra o tap reflexo pós-morte.
    const openedAt = this.time.now;
    const onTap = (p: Phaser.Input.Pointer): void => {
      const hitArea = Phaser.Geom.Rectangle.Inflate(btn.getBounds(), 16, 16);
      if (hitArea.contains(p.x, p.y)) {
        decide(true);
      } else if (this.time.now - openedAt > 600) {
        decide(false);
      }
    };
    this.input.on('pointerdown', onTap);
    this.continueTapHandler = onTap;

    // desktop: ENTER aceita, ESPAÇO recusa (mesmo músculo do restart rápido)
    const kb = this.input.keyboard;
    const onEnter = (): void => decide(true);
    const onSpace = (): void => decide(false);
    kb?.once('keydown-ENTER', onEnter);
    kb?.once('keydown-SPACE', onSpace);
    this.continueKeyCleanup = () => {
      kb?.off('keydown-ENTER', onEnter);
      kb?.off('keydown-SPACE', onSpace);
    };
  }

  private closeContinueOffer(): void {
    if (this.continueTapHandler) {
      this.input.off('pointerdown', this.continueTapHandler);
      this.continueTapHandler = undefined;
    }
    this.continueKeyCleanup?.();
    this.continueKeyCleanup = undefined;
    this.continueTimers.forEach((t) => t.remove());
    this.continueTimers = [];
    // destroy() NÃO mata tweens do alvo (Phaser 3.90) — sem o kill, a
    // tremida do botão seguiria mutando um Text destruído até o shutdown
    this.continueUi.forEach((o) => {
      this.tweens.killTweensOf(o);
      o.destroy(); // fora do game loop — ok (RN-01)
    });
    this.continueUi = [];
  }

  private revive(): void {
    this.continueUsed = true; // 1x por partida
    this.pendingGameOverPayload = undefined; // a run continua — morte cancelada
    // review 7B: morrer DESLIZANDO deixava a postura de slide congelada
    // (hitbox 32px "de graça" contra obstáculos baixos — fere RN-08)
    this.player.slide(false);
    this.gemText.setText(`💵 ${WalletSystem.balance()}`);
    // pista limpa à frente: revive nunca pode ser morte instantânea injusta —
    // vale para obstáculos verticais E blocos flutuantes (D-22, que matam
    // pelas laterais e chegariam voando no player recém-revivido)
    this.obstacles.children.iterate((child) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active) (sprite as Obstacle).deactivate();
      return true;
    });
    this.bars.children.iterate((child) => {
      const bar = child as Collectible;
      if (bar.active) bar.deactivate();
      return true;
    });
    // inimigos à frente também somem (D-25): revive nunca pode ser morte injusta
    this.enemies.children.iterate((child) => {
      const enemy = child as Enemy;
      if (enemy.active) enemy.deactivate();
      return true;
    });
    this.stompCombo = 0;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.stop();
    this.player.applySkinTint(); // desfaz o cinza da morte → cor da skin
    this.audio.gem();
    this.isGameOver = false;
    this.physics.resume();
    this.inputSystem.setEnabled(true);
    // carência com blink: invencível por 1.5s para reentrar no flow
    this.invulnerableUntil = this.time.now + 1500;
    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 140,
      yoyo: true,
      repeat: 4,
      onComplete: () => this.player.setAlpha(1),
    });
    // elapsedMs NÃO andou durante a oferta (update retorna cedo no game
    // over) — o teto de plausibilidade da Edge Function segue coerente
  }

  // contrato D-05: emite game:gameover (submit de score) e vai à GameOverScene
  private finalizeGameOver(killer?: Entity): void {
    const basePayload = this.pendingGameOverPayload ?? this.buildGameOverPayload(killer);
    this.pendingGameOverPayload = undefined; // emitido aqui, não no SHUTDOWN
    // screenshot lido só agora (T07D-04): pendingGameOverPayload pode ter sido
    // montado antes do snapshot assíncrono resolver — este é o valor mais
    // fresco possível no instante real do emit
    const payload: GameEventPayload = { ...basePayload, screenshot: this.finalScreenshot };
    emitGameEvent(GAME_EVENTS.GAME_OVER, payload);

    // recorde e tela final usam o score FINAL (base × estrelas, D-17) — o
    // mesmo número que vai pro ranking; comparar bases confundiria o jogador
    const stars = this.won ? this.stars : 1;
    const snapshot = this.score.getSnapshot();
    const finalSnapshot = { ...snapshot, score: snapshot.score * stars };
    // progresso de skin do mundo (D-19): votos da run acumulam SEMPRE —
    // morte ou vitória, o farm nunca é perdido
    WorldVotesSystem.add(this.world.id, snapshot.votes);

    // quase-vitória (T07A-04): salva os novos máximos DO MUNDO e leva o
    // recorde ANTERIOR para a GameOverScene calcular o "faltaram Xm"
    const prevBest = BestScoreSystem.update(this.world.id, finalSnapshot);
    const gameOverData = {
      ...finalSnapshot,
      stars, // D-17: exibidas na tela final
      gems: this.runGems, // D-18: dispara a educação da 1ª propina
      newBestScore: finalSnapshot.score > prevBest.score,
      tiedRecord: prevBest.score > 0 && finalSnapshot.score === prevBest.score,
      distanceGapM: Math.max(0, prevBest.distance - finalSnapshot.distance),
      scoreGap: Math.max(0, prevBest.score - finalSnapshot.score),
      won: this.won, // D-16: muda o pop-up (vitória vs derrota)
      worldName: this.world.name,
      unlockedWorld: this.unlockedWorldName, // D-16: anúncio de desbloqueio
    };
    // beat curto para a morte "registrar" antes da troca de tela
    this.time.delayedCall(450, () => this.scene.start('GameOverScene', gameOverData));
  }
}
