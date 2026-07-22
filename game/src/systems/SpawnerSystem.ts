import Phaser from 'phaser';
import { Obstacle } from '../entities/Obstacle';
import { Enemy } from '../entities/Enemy';
import { Collectible } from '../entities/Collectible';
import { CAMERA, ECONOMY, ENEMY, FINISH_CLEAR_M, GEM_BAR, SCORE, SPAWN, SIZES } from '../config/constants';
import type { TerrainSystem } from './TerrainSystem';

type Kind = 'high' | 'low'; // high = pular por cima; low/suspenso = deslizar por baixo

// Geração procedural com object pooling (RF-06, RF-11, RN-01): grupos com
// maxSize, get() reutiliza instâncias desativadas — nunca new/destroy no loop.
export class SpawnerSystem {
  private lastSpawnX = 0;
  private currentDistance = 0; // mundo do player no frame atual (offset de terreno)
  // ledger das linhas de voto (T07A-03): lineId → progresso. Entrada some na
  // primeira quebra (voto perdido) ou na completude — não cresce sem limite.
  private lineLedger = new Map<number, { total: number; collected: number }>();
  private nextLineId = 1;
  // paleta da cidade atual (T07B-01, D-14): tint quase-branco, atmosfera
  // sem tocar silhueta/hitbox
  private obstacleTint = 0xffffff;
  // Gemas em barras flutuantes (D-18): posições FIXAS (fração do mundo);
  // gemas já coletadas neste aparelho não renascem (coleção persistente) —
  // a barra e os votos de baixo continuam aparecendo.
  private gemTargets: { index: number; atM: number; collected: boolean }[];
  // Contabilidade das 3 estrelas (D-17): "TODOS os coletáveis" = nenhum voto
  // comum perdido E cada bloco flutuante resolvido (propina OU linha de
  // votos completa — a exclusividade da rota não penaliza).
  private missedVotes = 0;
  private barOutcomes = new Map<
    number,
    { gemPresent: boolean; gemTaken: boolean; votesMissed: number }
  >();

  // rng SEMEADO por mundo (D-16): todo sorteio de layout passa por ele —
  // mesma fase para todos os jogadores, em todas as partidas
  constructor(
    private scene: Phaser.Scene,
    private obstacles: Phaser.Physics.Arcade.Group,
    private votes: Phaser.Physics.Arcade.Group,
    private gems: Phaser.Physics.Arcade.Group,
    private bars: Phaser.Physics.Arcade.Group,
    private enemies: Phaser.Physics.Arcade.Group,
    private rng: Phaser.Math.RandomDataGenerator,
    private worldLengthPx: number,
    collectedGemIndices: number[],
    private terrain: TerrainSystem,
  ) {
    const lengthM = worldLengthPx / SCORE.PX_PER_M;
    const playableEndM = lengthM - FINISH_CLEAR_M;
    this.gemTargets = ECONOMY.GEM_POSITIONS_FRAC.map((frac, index) => ({
      index,
      atM: Math.min(frac * lengthM, playableEndM - 20),
      collected: collectedGemIndices.includes(index),
    }));
  }

  update(distance: number, speed: number): void {
    this.currentDistance = distance; // usado por spawnGroundTop (offset do degrau)
    const gap = Math.max(SPAWN.GAP_MIN, SPAWN.GAP_BASE - distance * SPAWN.GAP_TIGHTEN);
    // 1º obstáculo usa FIRST_GAP (T07A-05): respiro de leitura pro novato
    const target = this.lastSpawnX === 0 ? SPAWN.FIRST_GAP : gap;
    // reta final limpa (D-16): nada spawna com base além do fim jogável.
    // O spawn nasce ~1 tela à frente do player, então desconta a largura.
    const spawnAheadPx = this.scene.scale.width - SIZES.PLAYER.SCREEN_X;
    const playableEndPx = this.worldLengthPx - FINISH_CLEAR_M * SCORE.PX_PER_M;
    const canSpawn = distance + spawnAheadPx < playableEndPx;
    if (canSpawn && distance - this.lastSpawnX >= target) {
      // ponto de gema atingido → a barra flutuante OCUPA o slot do obstáculo
      // (gema nunca nasce colada em obstáculo = nunca impossível — D-18)
      const gemTarget = this.gemTargets.find((g) => distance / SCORE.PX_PER_M >= g.atM);
      if (gemTarget) {
        this.gemTargets = this.gemTargets.filter((g) => g !== gemTarget);
        this.spawnGemBar(speed, gemTarget);
      } else {
        this.spawnObstacle(speed, gap);
      }
      this.lastSpawnX = distance;
    }
    this.recycleMissedVotes();
  }

  // Bloco flutuante (D-18, D-22): plataforma-obstáculo no meio de um vão
  // limpo — propina em cima (pulo alto + pouso), votos embaixo (rota segura,
  // passando reto por baixo). A GameScene registra um COLLIDER com o player:
  // pousar no topo é seguro; laterais/fundo matam (kind 'block').
  private spawnGemBar(speed: number, target: { index: number; collected: boolean }): void {
    const { width } = this.scene.scale;
    const x = width + GEM_BAR.WIDTH;
    const groundTop = this.spawnGroundTop(x); // monta no degrau local (D-26)
    const barY = groundTop - GEM_BAR.BAR_ABOVE_GROUND;

    // estrela 3 (D-17): o bloco entra na contabilidade — satisfeito por
    // propina coletada OU linha de baixo completa
    this.barOutcomes.set(target.index, {
      gemPresent: !target.collected,
      gemTaken: false,
      votesMissed: 0,
    });

    const bar = this.bars.get(x, barY) as Collectible | null;
    if (bar) {
      bar.setTexture('gem-bar');
      bar.setOrigin(0.5, 1);
      bar.reset(x, barY);
      bar.setAngle(0);
      bar.setData('kind', 'block'); // deathCause 'block' na telemetria (D-22)
      const body = bar.body as Phaser.Physics.Arcade.Body;
      body.setSize(GEM_BAR.WIDTH, GEM_BAR.HEIGHT, false);
      body.setOffset(0, 0);
      body.setAllowGravity(false);
      body.immovable = true; // plataforma: o player pousa e o bloco não cede
      // friction 0: o bloco em movimento NÃO arrasta o player junto — no
      // world-scroll o player "corre" sobre o bloco ficando no X fixo da tela
      body.friction.set(0, 0);
      bar.setVelocityX(-speed);
    }

    // propina sobre o bloco — só se ainda não coletada neste aparelho
    if (!target.collected) {
      this.spawnGem(x, barY - GEM_BAR.HEIGHT - GEM_BAR.GEM_ABOVE_BAR, speed, target.index);
    }
    // votos sob o bloco: a rota "segura" que compete com a propina
    this.spawnVoteLine(
      x - SPAWN.VOTE_SPACING,
      groundTop - GEM_BAR.VOTES_BELOW_GROUND_H,
      speed,
      target.index,
    );
  }

  // Voto que saiu da tela sem coleta: quebra a linha no ledger e devolve ao
  // pool. O ciclo de vida de "miss" vive AQUI (junto do ledger), por isso o
  // Collectible não se auto-desativa mais. Gemas perdidas só voltam ao pool.
  private recycleMissedVotes(): void {
    this.votes.children.iterate((child) => {
      const vote = child as Collectible;
      if (vote.active && vote.x < -vote.width) {
        this.lineLedger.delete(vote.getData('lineId') as number);
        this.countMissedVote(vote); // contabilidade das 3 estrelas (D-17)
        vote.deactivate();
      }
      return true;
    });
    this.gems.children.iterate((child) => {
      const gem = child as Collectible;
      if (gem.active && gem.x < -gem.width) gem.deactivate();
      return true;
    });
    this.bars.children.iterate((child) => {
      const bar = child as Collectible;
      if (bar.active && bar.x < -bar.width) bar.deactivate();
      return true;
    });
  }

  // Topo do chão no X REAL de spawn da entidade (não na borda da tela), JÁ
  // descontando a altura do degrau local (D-26): a entidade "monta" no degrau
  // em vez de flutuar/enterrar. Amostrar no X exato evita o erro de 1 nível
  // perto de uma quina de degrau (a entidade nasce ~W px além da borda). Como
  // entidade e terreno rolam na MESMA velocidade em X, ela permanece sobre o
  // mesmo segmento por toda a vida — salvo inimigos, que andam mais rápido e
  // por isso "sobem/descem" o terreno a cada frame (GameScene.rideEnemiesOnTerrain).
  private spawnGroundTop(screenX: number): number {
    const base = this.scene.scale.height - SIZES.GROUND_H;
    const worldX = this.currentDistance + (screenX - SIZES.PLAYER.SCREEN_X);
    return base - this.terrain.groundOffsetAt(worldX);
  }

  // troca de cidade (T07B-01): novos obstáculos nascem com o tint da paleta;
  // os já ativos são retintados pela GameScene para consistência visual
  setObstacleTint(tint: number): void {
    this.obstacleTint = tint;
  }

  // voto perdido: se pertencia a um bloco flutuante conta no desfecho do
  // bloco (pode ser perdoado pela propina); senão é perda comum → sem 3⭐
  private countMissedVote(vote: Collectible): void {
    const barIndex = vote.getData('barIndex') as number | undefined;
    if (barIndex !== undefined && barIndex >= 0) {
      const outcome = this.barOutcomes.get(barIndex);
      if (outcome) outcome.votesMissed += 1;
      return;
    }
    this.missedVotes += 1;
  }

  // propina coletada → o bloco dela está resolvido (D-17)
  onGemCollected(gemIndex: number): void {
    const outcome = this.barOutcomes.get(gemIndex);
    if (outcome) outcome.gemTaken = true;
  }

  // Chamado na vitória (D-16): votos ainda ativos que o player JÁ passou
  // (ficaram para trás, incolectáveis) contam como perdidos — sem isso a
  // reta final "engoliria" misses e daria 3⭐ indevida.
  finalizeMisses(playerLeftX: number): void {
    this.votes.children.iterate((child) => {
      const vote = child as Collectible;
      if (vote.active && vote.x < playerLeftX) {
        this.countMissedVote(vote);
        vote.deactivate();
      }
      return true;
    });
  }

  // 3⭐ (D-17): nenhum voto comum perdido + cada bloco resolvido. Bloco com
  // propina presente é perdoado dos votos SE a propina foi pega (rota de
  // cima); sem propina (já coletada em run anterior) valem os votos.
  isPerfectRun(): boolean {
    if (this.missedVotes > 0) return false;
    for (const outcome of this.barOutcomes.values()) {
      const excusedByGem = outcome.gemPresent && outcome.gemTaken;
      if (!excusedByGem && outcome.votesMissed > 0) return false;
    }
    return true;
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

  private spawnObstacle(speed: number, gap: number): void {
    const { width } = this.scene.scale;
    const kind: Kind = this.rng.frac() < 0.5 ? 'high' : 'low';
    // Slots 'high' viram INIMIGO (D-25/§7-E): o player pula por cima OU pisa em
    // cima (stomp) por votos. 'low' segue obstáculo suspenso de deslizar por
    // baixo — preserva o slide/agachado. rng semeado mantém o layout FIXO (D-16).
    if (kind === 'high' && this.rng.frac() < ENEMY.HIGH_SLOT_CHANCE) {
      this.spawnEnemy(speed);
      return;
    }
    // Slots 'low' viram CÂMERA VOADORA (D-25/§9-6): ameaça no alto que se
    // desliza por baixo — animada e vindo na direção do player, no lugar do
    // obstáculo suspenso estático. rng semeado mantém o layout FIXO (D-16).
    if (kind === 'low' && this.rng.frac() < CAMERA.LOW_SLOT_CHANCE) {
      this.spawnFlyer(speed);
      return;
    }
    const spec = kind === 'high' ? SIZES.OBSTACLE_HIGH : SIZES.OBSTACLE_LOW;
    const x = width + spec.W;
    const groundTop = this.spawnGroundTop(x); // monta no degrau local (D-26)
    // âncora nos pés (origin 0.5,1): y é a BASE do obstáculo
    const y = kind === 'high' ? groundTop : groundTop - SIZES.OBSTACLE_LOW.CLEARANCE;

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

  // Inimigo (D-25): nasce no chão à direita e ANDA para a esquerda mais rápido
  // que o scroll (velocidade = scroll + WALK_SPEED) → aproxima-se do player.
  // NÃO é imóvel/collider: a GameScene registra um OVERLAP (como os obstáculos),
  // não um collider. Antes o inimigo era um collider imóvel — ao tocar o player
  // ele EMPURRAVA o corpo para fora do X fixo (bug: player deslizava de 100→16 e
  // "não pulava direito"). Overlap não separa corpos: o stomp/quique e a morte
  // são 100% decididos por código (hitEnemy), sem física empurrando o player.
  private spawnEnemy(speed: number): void {
    const { width } = this.scene.scale;
    const x = width + ENEMY.W;
    const groundTop = this.spawnGroundTop(x); // repórter caminha no degrau local (D-26)
    const enemy = this.enemies.get(x, groundTop) as Enemy | null;
    if (!enemy) return; // pool exausto — não criar além do maxSize (RN-01)
    enemy.setOrigin(0.5, 1);
    // Arte gerada virada à DIREITA (microfone estendido p/ frente-direita); o
    // inimigo anda p/ ESQUERDA → espelha para olhar na direção do movimento.
    // Sem isto, cara p/ direita + andar p/ esquerda = "moonwalk" (feedback do dono).
    enemy.setFlipX(true);
    enemy.reset(x, groundTop);
    enemy.playWalk(); // aplica o sheet do repórter + ciclo de caminhada (frame 0 fixa this.width/height)
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setSize(ENEMY.W, ENEMY.H, false);
    // hitbox 40×60 centrada na arte (49×68) e ancorada nos pés — arte ≠ hitbox
    // (RN-07): cabeça/microfone podem exceder a caixa sem afetar o fairness.
    // flipX não afeta o offset do corpo (espaço da textura), a caixa segue centrada.
    body.setOffset(Math.round((enemy.width - ENEMY.W) / 2), enemy.height - ENEMY.H);
    body.setAllowGravity(false); // fica no chão sem cair; só desliza no eixo X
    enemy.setVelocityX(-(speed + ENEMY.WALK_SPEED));
    enemy.setData('kind', 'enemy'); // telemetria: mapeado como obstacle-high por ora
    enemy.setData('aboveGround', 0); // repórter anda no chão → sobe/desce degraus (ride)
  }

  // Câmera de imprensa VOADORA (D-25/§9-6): reusa o pool de inimigos, mas voa no
  // ALTO (base da hitbox a CAMERA.CLEARANCE do chão, igual ao obstacle-low) e é
  // marcada 'camera' → hitEnemy trata como ameaça pura (contato = morte; o dodge
  // é deslizar por baixo). Também OVERLAP (não empurra o player).
  private spawnFlyer(speed: number): void {
    const { width } = this.scene.scale;
    const x = width + CAMERA.W;
    const groundTop = this.spawnGroundTop(x); // câmera voa relativa ao degrau local (D-26)
    const baseY = groundTop - CAMERA.CLEARANCE; // base da hitbox = topo do vão de passagem
    const enemy = this.enemies.get(x, baseY) as Enemy | null;
    if (!enemy) return; // pool exausto — não criar além do maxSize (RN-01)
    enemy.setOrigin(0.5, 1);
    enemy.setFlipX(false); // arte já com a lente à ESQUERDA (direção do movimento)
    enemy.reset(x, baseY);
    enemy.playFly(); // sheet da câmera + hover (frame 0 fixa this.width/height)
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setSize(CAMERA.W, CAMERA.H, false);
    // hitbox 44×40 no CORPO da câmera (base da arte), centrada na largura —
    // rotores/lente excedem a caixa sem afetar o fairness (RN-07)
    body.setOffset(Math.round((enemy.width - CAMERA.W) / 2), enemy.height - CAMERA.H);
    body.setAllowGravity(false); // voa: fica na altura fixa, só desliza no eixo X
    enemy.setVelocityX(-(speed + ENEMY.WALK_SPEED));
    enemy.setData('kind', 'camera'); // hitEnemy: câmera = morte no contato (não stompável)
    enemy.setData('aboveGround', CAMERA.CLEARANCE); // voa a CLEARANCE do chão local (ride)
  }

  // barIndex: votos que vivem sob um bloco flutuante (D-17) — a perda deles
  // pode ser perdoada pela propina; votos comuns passam undefined
  private spawnVoteLine(startX: number, y: number, speed: number, barIndex?: number): void {
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
      vote.setData('barIndex', barIndex ?? -1); // -1 = voto comum
      spawned += 1;
    }
    // 1 voto sozinho não é "linha" — sem fanfarra por coleta trivial
    if (spawned >= 2) this.lineLedger.set(lineId, { total: spawned, collected: 0 });
  }

  private spawnGem(x: number, y: number, speed: number, gemIndex: number): void {
    const gem = this.gems.get(x, y) as Collectible | null;
    if (!gem) return;
    gem.setTexture('gem'); // visual = nota de PROPINA (D-21); key segue 'gem'
    gem.setOrigin(0.5, 0.5);
    gem.reset(x, y);
    gem.setAngle(0); // nota reta — o losango era da era "gema"
    gem.setData('gemIndex', gemIndex); // coleção persistente por mundo (D-18)
    const body = gem.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    gem.setVelocityX(-speed);
  }
}
