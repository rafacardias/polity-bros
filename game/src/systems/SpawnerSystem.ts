import Phaser from 'phaser';
import { Obstacle } from '../entities/Obstacle';
import { SPAWN, SIZES } from '../config/constants';

type Kind = 'high' | 'low'; // high = pular por cima; low/suspenso = deslizar por baixo

// Geração procedural com object pooling (RF-06, RN-01): grupo com maxSize,
// get() reutiliza instâncias desativadas — nunca new/destroy no game loop.
export class SpawnerSystem {
  private lastSpawnX = 0;

  constructor(
    private scene: Phaser.Scene,
    private obstacles: Phaser.Physics.Arcade.Group,
  ) {}

  update(distance: number, speed: number): void {
    const gap = Math.max(SPAWN.GAP_MIN, SPAWN.GAP_BASE - distance * SPAWN.GAP_TIGHTEN);
    if (distance - this.lastSpawnX >= gap) {
      this.spawnObstacle(speed);
      this.lastSpawnX = distance;
    }
  }

  private spawnObstacle(speed: number): void {
    const { width, height } = this.scene.scale;
    const groundTop = height - SIZES.GROUND_H;
    const kind: Kind = Math.random() < 0.5 ? 'high' : 'low';
    const spec = kind === 'high' ? SIZES.OBSTACLE_HIGH : SIZES.OBSTACLE_LOW;
    // âncora nos pés (origin 0.5,1): y é a BASE do obstáculo
    const y = kind === 'high' ? groundTop : groundTop - SIZES.OBSTACLE_LOW.CLEARANCE;
    const x = width + spec.W;

    const obstacle = this.obstacles.get(x, y) as Obstacle | null;
    if (!obstacle) return; // pool exausto — não criar além do maxSize

    obstacle.setTexture(kind === 'high' ? 'obstacle-high' : 'obstacle-low');
    obstacle.setOrigin(0.5, 1);
    obstacle.reset(x, y);
    const body = obstacle.body as Phaser.Physics.Arcade.Body;
    body.setSize(spec.W, spec.H, false);
    body.setOffset(0, 0);
    body.setAllowGravity(false);
    body.immovable = true;
    obstacle.setVelocityX(-speed);
    obstacle.setData('kind', kind);
  }
}
