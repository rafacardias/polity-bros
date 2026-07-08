import Phaser from 'phaser';
import { Obstacle } from '../entities/Obstacle';
import { Collectible } from '../entities/Collectible';
import { SPAWN, SIZES } from '../config/constants';

type Kind = 'high' | 'low'; // high = pular por cima; low/suspenso = deslizar por baixo

// Geração procedural com object pooling (RF-06, RF-11, RN-01): grupos com
// maxSize, get() reutiliza instâncias desativadas — nunca new/destroy no loop.
export class SpawnerSystem {
  private lastSpawnX = 0;

  constructor(
    private scene: Phaser.Scene,
    private obstacles: Phaser.Physics.Arcade.Group,
    private votes: Phaser.Physics.Arcade.Group,
  ) {}

  update(distance: number, speed: number): void {
    const gap = Math.max(SPAWN.GAP_MIN, SPAWN.GAP_BASE - distance * SPAWN.GAP_TIGHTEN);
    if (distance - this.lastSpawnX >= gap) {
      this.spawnObstacle(speed, gap);
      this.lastSpawnX = distance;
    }
  }

  private spawnObstacle(speed: number, gap: number): void {
    const { width, height } = this.scene.scale;
    const groundTop = height - SIZES.GROUND_H;
    const kind: Kind = Math.random() < 0.5 ? 'high' : 'low';
    const spec = kind === 'high' ? SIZES.OBSTACLE_HIGH : SIZES.OBSTACLE_LOW;
    // âncora nos pés (origin 0.5,1): y é a BASE do obstáculo
    const y = kind === 'high' ? groundTop : groundTop - SIZES.OBSTACLE_LOW.CLEARANCE;
    const x = width + spec.W;

    const obstacle = this.obstacles.get(x, y) as Obstacle | null;
    if (obstacle) {
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

    // rota de risco/recompensa: linha de votos logo após o obstáculo, alta —
    // exige manter o pulo (high) ou pular logo depois do slide (low) (RF-11)
    if (Math.random() < SPAWN.VOTE_LINE_CHANCE) {
      this.spawnVoteLine(x + 60, y - SPAWN.VOTE_RISK_HEIGHT, speed);
    }
    // linha fácil no meio do vão: recompensa constante ao longo da fase (RF-11)
    if (Math.random() < SPAWN.EASY_VOTE_CHANCE) {
      this.spawnVoteLine(x + gap / 2, groundTop - SPAWN.VOTE_EASY_HEIGHT, speed);
    }
  }

  private spawnVoteLine(startX: number, y: number, speed: number): void {
    for (let i = 0; i < SPAWN.VOTE_COUNT; i++) {
      const vote = this.votes.get(startX + i * SPAWN.VOTE_SPACING, y) as Collectible | null;
      if (!vote) return; // pool exausto — não criar além do maxSize
      vote.setTexture('vote');
      vote.setOrigin(0.5, 0.5);
      vote.reset(startX + i * SPAWN.VOTE_SPACING, y);
      const body = vote.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      vote.setVelocityX(-speed);
    }
  }
}
