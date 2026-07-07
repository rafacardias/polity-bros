import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { PHYSICS, SIZES } from '../config/constants';

// Loop principal (design.md §2). Auto-run world-scroll (RF-04): o Player fica
// em X fixo e o cenário/obstáculos deslizam para a esquerda na velocidade
// corrente. Velocidade fixa neste bloco; ProgressionSystem entra na T04-11.
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private distance = 0;
  private speed = PHYSICS.RUN_SPEED;

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

    this.distance = 0;
    this.speed = PHYSICS.RUN_SPEED;
  }

  update(time: number, delta: number): void {
    const step = (this.speed * delta) / 1000;
    this.distance += step;
    this.groundTile.tilePositionX += step;
    this.player.update(time, delta);
  }
}
