import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { Collectible } from '../entities/Collectible';
import { InputSystem } from '../systems/InputSystem';
import { SpawnerSystem } from '../systems/SpawnerSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { emitGameEvent, GAME_EVENTS } from '../lib/game-events';
import { SIZES } from '../config/constants';

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
    this.physics.add.overlap(this.player, this.obstacles, () => this.gameOver());
    // RF-11: coletar voto incrementa o contador do HUD
    this.physics.add.overlap(this.player, this.votes, (_p, v) =>
      this.collectVote(v as Collectible),
    );

    this.score = new ScoreSystem();
    this.createHud(width);
    this.audio.startMusic();

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
    vote.deactivate(); // pooling: nunca destroy (RN-01)
    this.score.addVote();
    this.votesText.setText(`VOTOS ${this.score.getSnapshot().votes}`);
    this.audio.vote();
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
  private gameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.physics.pause();
    this.player.setTint(0x94a3b8);
    this.audio.death();

    const snapshot = this.score.getSnapshot();
    // elapsedSec (T05-04): a Edge Function submit-score usa pra teto de
    // plausibilidade (RN-04) — não faz parte do ScoreSnapshot em si.
    const elapsedSec = this.elapsedMs / 1000;
    emitGameEvent(GAME_EVENTS.GAME_OVER, { ...snapshot, elapsedSec });
    // beat curto para a morte "registrar" antes da troca de tela
    this.time.delayedCall(450, () => this.scene.start('GameOverScene', snapshot));
  }
}
