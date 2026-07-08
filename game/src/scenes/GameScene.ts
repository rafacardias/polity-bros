import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { Collectible } from '../entities/Collectible';
import { InputSystem } from '../systems/InputSystem';
import { SpawnerSystem } from '../systems/SpawnerSystem';
import { PHYSICS, SIZES } from '../config/constants';

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
  private groundTile!: Phaser.GameObjects.TileSprite;
  private distance = 0;
  private speed = PHYSICS.RUN_SPEED;
  private votesCollected = 0; // provisório — vira ScoreSystem na T04-10
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

    this.player = new Player(this, SIZES.PLAYER.SCREEN_X, groundTop);
    this.inputSystem = new InputSystem(this, this.player);

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

    this.votesCollected = 0;
    this.votesText = this.add
      .text(width - 12, 10, 'VOTOS 0', { fontFamily: 'monospace', fontSize: '16px', color: '#facc15' })
      .setOrigin(1, 0)
      .setDepth(10);

    this.distance = 0;
    this.speed = PHYSICS.RUN_SPEED;
    this.isGameOver = false;
  }

  private collectVote(vote: Collectible): void {
    vote.deactivate(); // pooling: nunca destroy (RN-01)
    this.votesCollected += 1;
    this.votesText.setText(`VOTOS ${this.votesCollected}`);
  }

  update(time: number, delta: number): void {
    if (this.isGameOver) return;
    this.inputSystem.update();
    const step = (this.speed * delta) / 1000;
    this.distance += step;
    this.groundTile.tilePositionX += step;
    this.spawner.update(this.distance, this.speed);
    this.player.update(time, delta);
  }

  // Fim de partida provisório dentro da própria Scene: congela a física e
  // reinicia no toque. A GameOverScene + emissão de game:gameover (contrato
  // D-05) entram na T04-13 — aqui é só o encerramento exigido pelo RF-07.
  private gameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.physics.pause();
    this.player.setTint(0x94a3b8);

    const { width, height } = this.scale;
    this.add
      .text(width / 2, height * 0.4, 'GAME OVER\n\ntoque ou Espaço para reiniciar', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: width * 0.9 },
      })
      .setOrigin(0.5);

    // pequeno atraso evita que o toque da morte reinicie sem querer (RN-03)
    this.time.delayedCall(350, () => {
      this.input.once('pointerdown', () => this.scene.restart());
      this.input.keyboard!.once('keydown-SPACE', () => this.scene.restart());
    });
  }
}
