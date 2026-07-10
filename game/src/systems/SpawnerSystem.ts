import Phaser from 'phaser';
import { Obstacle } from '../entities/Obstacle';
import { Collectible } from '../entities/Collectible';
import { ECONOMY, FINISH_CLEAR_M, SCORE, SPAWN, SIZES } from '../config/constants';

type Kind = 'high' | 'low'; // high = pular por cima; low/suspenso = deslizar por baixo

// Geração procedural com object pooling (RF-06, RF-11, RN-01): grupos com
// maxSize, get() reutiliza instâncias desativadas — nunca new/destroy no loop.
export class SpawnerSystem {
  private lastSpawnX = 0;
  // ledger das linhas de voto (T07A-03): lineId → progresso. Entrada some na
  // primeira quebra (voto perdido) ou na completude — não cresce sem limite.
  private lineLedger = new Map<number, { total: number; collected: number }>();
  private nextLineId = 1;
  // paleta da cidade atual (T07B-01, D-14): tint quase-branco, atmosfera
  // sem tocar silhueta/hitbox
  private obstacleTint = 0xffffff;
  // Gema rara (T07B-02, D-11/D-18): pontos definidos pelo RNG SEMEADO do
  // mundo — mesmas posições em toda partida (layout fixo, D-16). Só janelas
  // que cabem ANTES da reta final entram.
  private gemTargetsM: number[];

  // rng SEMEADO por mundo (D-16): todo sorteio de layout passa por ele —
  // mesma fase para todos os jogadores, em todas as partidas
  constructor(
    private scene: Phaser.Scene,
    private obstacles: Phaser.Physics.Arcade.Group,
    private votes: Phaser.Physics.Arcade.Group,
    private gems: Phaser.Physics.Arcade.Group,
    private rng: Phaser.Math.RandomDataGenerator,
    private worldLengthPx: number,
  ) {
    const playableEndM = worldLengthPx / SCORE.PX_PER_M - FINISH_CLEAR_M;
    this.gemTargetsM = ECONOMY.GEM_WINDOWS_M.filter(([min]) => min < playableEndM).map(
      ([min, max]) => min + this.rng.frac() * (Math.min(max, playableEndM) - min),
    );
  }

  update(distance: number, speed: number): void {
    const gap = Math.max(SPAWN.GAP_MIN, SPAWN.GAP_BASE - distance * SPAWN.GAP_TIGHTEN);
    // 1º obstáculo usa FIRST_GAP (T07A-05): respiro de leitura pro novato
    const target = this.lastSpawnX === 0 ? SPAWN.FIRST_GAP : gap;
    // reta final limpa (D-16): nada spawna com base além do fim jogável.
    // O spawn nasce ~1 tela à frente do player, então desconta a largura.
    const spawnAheadPx = this.scene.scale.width - SIZES.PLAYER.SCREEN_X;
    const playableEndPx = this.worldLengthPx - FINISH_CLEAR_M * SCORE.PX_PER_M;
    const canSpawn = distance + spawnAheadPx < playableEndPx;
    if (canSpawn && distance - this.lastSpawnX >= target) {
      this.spawnObstacle(speed, gap, distance);
      this.lastSpawnX = distance;
    }
    this.recycleMissedVotes();
  }

  // Voto que saiu da tela sem coleta: quebra a linha no ledger e devolve ao
  // pool. O ciclo de vida de "miss" vive AQUI (junto do ledger), por isso o
  // Collectible não se auto-desativa mais. Gemas perdidas só voltam ao pool.
  private recycleMissedVotes(): void {
    this.votes.children.iterate((child) => {
      const vote = child as Collectible;
      if (vote.active && vote.x < -vote.width) {
        this.lineLedger.delete(vote.getData('lineId') as number);
        vote.deactivate();
      }
      return true;
    });
    this.gems.children.iterate((child) => {
      const gem = child as Collectible;
      if (gem.active && gem.x < -gem.width) gem.deactivate();
      return true;
    });
  }

  // troca de cidade (T07B-01): novos obstáculos nascem com o tint da paleta;
  // os já ativos são retintados pela GameScene para consistência visual
  setObstacleTint(tint: number): void {
    this.obstacleTint = tint;
  }

  // Chamado pela GameScene ao coletar; true = a linha INTEIRA foi coletada
  // (momento "uau"). Linha já quebrada por miss não tem entrada → false.
  onVoteCollected(vote: Collectible): boolean {
    const entry = this.lineLedger.get(vote.getData('lineId') as number);
    if (!entry) return false;
    entry.collected += 1;
    if (entry.collected < entry.total) return false;
    this.lineLedger.delete(vote.getData('lineId') as number);
    return true;
  }

  private spawnObstacle(speed: number, gap: number, distancePx: number): void {
    const { width, height } = this.scene.scale;
    const groundTop = height - SIZES.GROUND_H;
    const kind: Kind = this.rng.frac() < 0.5 ? 'high' : 'low';
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
      obstacle.setTint(this.obstacleTint);
    }

    // gema rara (T07B-02): acima do obstáculo, altura que exige pulo alto
    // comprometido — risco máximo, recompensa rara
    const distanceM = distancePx / SCORE.PX_PER_M;
    if (this.gemTargetsM.length > 0 && distanceM >= this.gemTargetsM[0]) {
      this.gemTargetsM.shift();
      this.spawnGem(x + 30, groundTop - ECONOMY.GEM_HEIGHT, speed);
    }

    // rota de risco/recompensa: linha de votos logo após o obstáculo, alta —
    // exige manter o pulo (high) ou pular logo depois do slide (low) (RF-11)
    if (this.rng.frac() < SPAWN.VOTE_LINE_CHANCE) {
      this.spawnVoteLine(x + 60, y - SPAWN.VOTE_RISK_HEIGHT, speed);
    }
    // linha fácil no meio do vão: recompensa constante ao longo da fase (RF-11)
    if (this.rng.frac() < SPAWN.EASY_VOTE_CHANCE) {
      this.spawnVoteLine(x + gap / 2, groundTop - SPAWN.VOTE_EASY_HEIGHT, speed);
    }
  }

  private spawnVoteLine(startX: number, y: number, speed: number): void {
    const lineId = this.nextLineId++;
    let spawned = 0;
    for (let i = 0; i < SPAWN.VOTE_COUNT; i++) {
      const vote = this.votes.get(startX + i * SPAWN.VOTE_SPACING, y) as Collectible | null;
      if (!vote) break; // pool exausto — não criar além do maxSize
      vote.setTexture('vote');
      vote.setOrigin(0.5, 0.5);
      vote.reset(startX + i * SPAWN.VOTE_SPACING, y);
      const body = vote.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      vote.setVelocityX(-speed);
      vote.setData('lineId', lineId);
      spawned += 1;
    }
    // 1 voto sozinho não é "linha" — sem fanfarra por coleta trivial
    if (spawned >= 2) this.lineLedger.set(lineId, { total: spawned, collected: 0 });
  }

  private spawnGem(x: number, y: number, speed: number): void {
    const gem = this.gems.get(x, y) as Collectible | null;
    if (!gem) return;
    gem.setTexture('gem');
    gem.setOrigin(0.5, 0.5);
    gem.reset(x, y);
    gem.setAngle(45); // losango — leitura de "item especial" mesmo em placeholder
    const body = gem.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    gem.setVelocityX(-speed);
  }
}
