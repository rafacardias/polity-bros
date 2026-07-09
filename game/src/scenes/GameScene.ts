import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { Collectible } from '../entities/Collectible';
import { InputSystem } from '../systems/InputSystem';
import { SpawnerSystem } from '../systems/SpawnerSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { BestScoreSystem, type BestRecord } from '../systems/BestScoreSystem';
import { OnboardingSystem } from '../systems/OnboardingSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { emitGameEvent, GAME_EVENTS } from '../lib/game-events';
import { JUICE, SCORE, SIZES } from '../config/constants';

const SCORE_EMIT_INTERVAL_MS = 250; // cadência do game:score (D-05) — 60/s seria ruído

// Loop principal (design.md §2). Auto-run world-scroll (RF-04): o Player fica
// em X fixo e o cenário/obstáculos deslizam para a esquerda na velocidade
// corrente. Velocidade fixa neste bloco; ProgressionSystem entra na T04-11.
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputSystem!: InputSystem;
  private spawner!: SpawnerSystem;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private votes!: Phaser.Physics.Arcade.Group;
  private votesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private score!: ScoreSystem;
  private progression!: ProgressionSystem;
  private audio!: AudioSystem;
  private muteButton!: Phaser.GameObjects.Text;
  private voteBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private comboText!: Phaser.GameObjects.Text;
  private comboTween?: Phaser.Tweens.Tween;
  private bestRecord!: BestRecord;
  private recordLine!: Phaser.GameObjects.Rectangle;
  private recordLabel!: Phaser.GameObjects.Text;
  private recordCelebrated = false;
  private onboardingHint?: Phaser.GameObjects.Text;
  private onboardingPulse?: Phaser.Tweens.Tween;
  private emitAccumulator = 0;
  private elapsedMs = 0;
  private isGameOver = false;

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
    this.spawner = new SpawnerSystem(this, this.obstacles, this.votes);

    // RF-07: qualquer contato com obstáculo encerra a partida
    this.physics.add.overlap(this.player, this.obstacles, (_p, o) =>
      this.gameOver(o as Obstacle),
    );
    // RF-11: coletar voto incrementa o contador do HUD
    this.physics.add.overlap(this.player, this.votes, (_p, v) =>
      this.collectVote(v as Collectible),
    );

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

    this.score = new ScoreSystem();
    this.createHud(width);
    this.bestRecord = BestScoreSystem.load();
    this.recordCelebrated = false;
    this.createRecordMarker();
    this.createOnboardingHint();
    this.audio.startMusic();
    this.cameras.main.fadeIn(JUICE.FADE_IN_MS, 0, 0, 0);

    this.progression = new ProgressionSystem();
    this.emitAccumulator = 0;
    this.elapsedMs = 0;
    this.isGameOver = false;
  }

  // HUD (RF-03/T04-12): score, votos e distância sempre visíveis, fora da
  // área de ação do polegar (RN-02)
  private createHud(width: number): void {
    const style = { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' };
    this.scoreText = this.add
      .text(width / 2, 10, 'SCORE 0', { ...style, fontSize: '20px' })
      .setOrigin(0.5, 0)
      .setDepth(10);
    this.votesText = this.add
      .text(width - 12, 10, 'VOTOS 0', { ...style, color: '#facc15' })
      .setOrigin(1, 0)
      .setDepth(10);
    this.distanceText = this.add
      .text(12, 10, '0m', { ...style, color: '#94a3b8' })
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
    this.distanceText.setText(`${snap.distance}m`);
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
    this.votesText.setText(`VOTOS ${this.score.getSnapshot().votes}`);
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

  // Marcador do recorde pessoal na pista (T07A-04, D-10): a "linha de
  // chegada" do seu melhor run se aproxima — quase-vitória visível, sem
  // mexer em dificuldade. Invisível na primeira partida (sem recorde).
  private createRecordMarker(): void {
    const groundTop = this.scale.height - SIZES.GROUND_H;
    this.recordLine = this.add
      .rectangle(0, groundTop, 3, 140, 0xfacc15, 0.7)
      .setOrigin(0.5, 1)
      .setDepth(4)
      .setVisible(false);
    this.recordLabel = this.add
      .text(0, groundTop - 146, '🏁 RECORDE', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#facc15',
      })
      .setOrigin(0.5, 1)
      .setDepth(4)
      .setVisible(false);
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

  private updateRecordMarker(): void {
    if (this.bestRecord.distance <= 0) return; // primeira partida: sem marcador
    const bestPx = this.bestRecord.distance * SCORE.PX_PER_M;
    const x = SIZES.PLAYER.SCREEN_X + (bestPx - this.score.getDistancePx());
    const visible = x > -24 && x < this.scale.width + 48;
    this.recordLine.setVisible(visible).setX(x);
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
    this.elapsedMs += delta;
    this.inputSystem.update();
    this.progression.update(delta); // dificuldade crescente (RF-09)
    const speed = this.progression.speed;
    const step = (speed * delta) / 1000;
    this.groundTile.tilePositionX += step;
    this.score.addDistance(step); // pontos por distância/tempo (RF-08)
    this.spawner.update(this.progression.distance, speed);
    this.syncWorldSpeed(speed);
    this.player.update(time, delta);
    this.updateHud();
    this.updateRecordMarker();

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
  }

  // RF-07 + contrato D-05: congela o mundo, avisa o shell (game:gameover)
  // e passa o resultado para a GameOverScene (RF-03)
  private gameOver(killer?: Obstacle): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.physics.pause();
    this.player.setTint(0x94a3b8);
    this.audio.death();
    // impacto legível (T07A-02): shake + flash curtos, dentro do beat de
    // 450ms que já segura a troca de cena — morte "registra" antes da UI
    this.cameras.main.shake(JUICE.SHAKE_DURATION_MS, JUICE.SHAKE_INTENSITY);
    this.cameras.main.flash(JUICE.FLASH_DURATION_MS, 239, 68, 68);

    const snapshot = this.score.getSnapshot();
    // elapsedSec (T05-04): a Edge Function submit-score usa pra teto de
    // plausibilidade (RN-04) — não faz parte do ScoreSnapshot em si.
    const elapsedSec = this.elapsedMs / 1000;
    // deathCause (T07A-05): telemetria de onde/como se morre — calibra a
    // curva fixa com dados reais (D-10). Sem killer identificado → 'unknown',
    // nunca um palpite que polua a calibração.
    const deathCause = killer
      ? killer.getData('kind') === 'low'
        ? ('obstacle-low' as const)
        : ('obstacle-high' as const)
      : ('unknown' as const);
    emitGameEvent(GAME_EVENTS.GAME_OVER, { ...snapshot, elapsedSec, deathCause });

    // quase-vitória (T07A-04): salva os novos máximos e leva o recorde
    // ANTERIOR para a GameOverScene calcular o "faltaram Xm"
    const prevBest = BestScoreSystem.update(snapshot);
    const gameOverData = {
      ...snapshot,
      newBestScore: snapshot.score > prevBest.score,
      tiedRecord: prevBest.score > 0 && snapshot.score === prevBest.score,
      distanceGapM: Math.max(0, prevBest.distance - snapshot.distance),
      scoreGap: Math.max(0, prevBest.score - snapshot.score),
    };
    // beat curto para a morte "registrar" antes da troca de tela
    this.time.delayedCall(450, () => this.scene.start('GameOverScene', gameOverData));
  }
}
