import Phaser from 'phaser';
import { Entity } from './Entity';
import { JUICE, PHYSICS, SIZES, TERRAIN } from '../config/constants';
import { getSelectedSkin, skinTextures } from '../lib/skins';

// Auto-run (RF-04, D-03): o avanço é do CENÁRIO (world-scroll) — o Player
// fica em X fixo na tela e só controla o eixo vertical (pulo/slide).
// Âncora nos pés (origin 0.5, 1): trocar a hitbox no slide mantém os pés
// no chão sem matemática de offset.
export class Player extends Entity {
  // Keys de textura/animação do PERSONAGEM da skin selecionada (Fase 4).
  // Derivados de skinTextures(): idle = '<char>', corrida = '<char>-run',
  // agachado = '<char>-slide'. A skin é lida UMA vez na construção (a troca
  // acontece no menu, antes da partida).
  private readonly idleKey: string;
  private readonly runKey: string;
  private readonly slideKey: string;
  private sliding = false;
  private wasOnGround = true;
  private juiceTween?: Phaser.Tweens.Tween;
  // Chão do terreno em degraus (D-26): Y dos pés do degrau sob o player (X fixo),
  // informado pela GameScene a cada frame. ∞ = sem terreno → usa só o world
  // bounds (base). O player SOBE até ele suavemente (auto-climb, §7-A) e o
  // reporta como "no chão" para poder pular. Não toca no pulo (velocity<0).
  private terrainFeetY = Number.POSITIVE_INFINITY;
  private groundedOnTerrain = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts?: { faixa?: boolean }) {
    const skin = getSelectedSkin();
    // Faixa presidencial (D-27): na ÚLTIMA fase (capital) qualquer skin veste a
    // faixa — payoff visual de "virei presidente". A Scene decide (é quem sabe o
    // mundo); a entidade só troca a textura. Fallback seguro: se a skin ainda não
    // tem a variante '<char>-faixa' carregada, cai na arte normal.
    const useFaixa = !!opts?.faixa && scene.textures.exists(skinTextures(skin, 'faixa').idle);
    const tex = skinTextures(skin, useFaixa ? 'faixa' : undefined);
    super(scene, x, y, tex.idle); // frame estático do personagem (pulo/queda)
    this.idleKey = tex.idle;
    this.runKey = tex.run;
    this.slideKey = tex.slide;
    this.setOrigin(0.5, 1);
    // gravidade vem do GAME_CONFIG (arcade.gravity.y) — não duplicar aqui
    this.setCollideWorldBounds(true);
    this.lockStandingHitbox(); // hitbox fixa 44×64, independe do tamanho da arte
    this.applySkinTint(); // cor da skin selecionada (T07B-04)
    this.createRunAnimation(); // ciclo de corrida (Fase 3)
    this.createSlideAnimation(); // ciclo de corrida-agachada (agachado animado)
  }

  // Animação de corrida (Fase 3): 4 frames do sheet 'player-run'. Global no
  // anims manager da cena — guard evita recriar em restart. Só é montada aqui;
  // o disparo/parada fica no state machine visual do update().
  private createRunAnimation(): void {
    if (this.scene.anims.exists(this.runKey)) return;
    this.scene.anims.create({
      key: this.runKey,
      frames: this.scene.anims.generateFrameNumbers(this.runKey, { start: 0, end: 3 }),
      frameRate: 12,
      repeat: -1,
    });
  }

  // Animação de corrida-AGACHADA (agachado animado): 4 frames do sheet
  // 'player-slide'. Antes o slide era uma textura estática ("parava de
  // correr" — feedback do dono); agora as pernas seguem em ciclo enquanto
  // desliza. frameRate um pouco mais alto dá a sensação de arrancada baixa.
  private createSlideAnimation(): void {
    if (this.scene.anims.exists(this.slideKey)) return;
    this.scene.anims.create({
      key: this.slideKey,
      frames: this.scene.anims.generateFrameNumbers(this.slideKey, { start: 0, end: 3 }),
      frameRate: 14,
      repeat: -1,
    });
  }

  // Hitbox EM PÉ fixa em SIZES.PLAYER (RN-07: "trocam de arte, não de
  // tamanho"). Centralizada na largura do sprite e ancorada nos pés — a arte
  // pode exceder a hitbox (braços/pernas/cabeça) sem afetar o fairness. Sem
  // isto, a hitbox default do Arcade seria o tamanho da textura, e trocar o
  // retângulo 44×64 pelo sprite real (57×72) mudaria a colisão.
  private lockStandingHitbox(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(SIZES.PLAYER.W, SIZES.PLAYER.H, false);
    body.setOffset(Math.round((this.width - SIZES.PLAYER.W) / 2), this.height - SIZES.PLAYER.H);
  }

  // Hitbox do SLIDE fixa em 44×SLIDE_H, centrada na largura da arte agachada e
  // ancorada nos pés — mesma invariante de fairness do standing (RN-07). Sem
  // isto, a hitbox herdaria o tamanho da textura do slide; centrar garante que
  // a caixa de colisão (44×32) não muda ao trocar o placeholder pela arte real.
  // Deve rodar DEPOIS de setTexture('player-slide') para ler this.width/height
  // já da textura agachada.
  private lockSlideHitbox(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(SIZES.PLAYER.W, SIZES.PLAYER.SLIDE_H, false);
    body.setOffset(Math.round((this.width - SIZES.PLAYER.W) / 2), this.height - SIZES.PLAYER.SLIDE_H);
  }

  // tint da skin — também usado pelo revive (T07B-03), que precisa desfazer
  // o cinza da morte voltando ao visual da skin. Skin default = personagem na
  // cor natural do sprite (clearTint); skins desbloqueáveis = tint por cima.
  // Skins agora são PERSONAGENS de arte própria (não mais tint de cor), então
  // o visual normal é sempre a textura limpa. Mantido porque o revive (T07B-03)
  // chama isto para DESFAZER o cinza da morte, voltando à arte do personagem.
  applySkinTint(): void {
    this.clearTint();
  }

  get isSliding(): boolean {
    return this.sliding;
  }

  get onGround(): boolean {
    // blocked.down = chão do mundo; touching.down = em pé sobre o bloco
    // flutuante (D-22, collider dinâmico); groundedOnTerrain = parado num degrau
    // do terreno (D-26) — nos três casos pode pular
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down || this.groundedOnTerrain;
  }

  // Chão do terreno em degraus (D-26): a GameScene informa a cada frame a altura
  // (Y dos pés) do degrau sob o player, que fica em X fixo. Passar ∞ = sem
  // terreno (só world bounds). O clamp acontece em applyTerrainFloor (update).
  setTerrainFloor(feetY: number): void {
    this.terrainFeetY = feetY;
  }

  // Auto-climb suave (§7-A): reposiciona os pés no degrau sob o player e o marca
  // "no chão". NÃO age enquanto sobe num pulo (velocity.y < 0) → a física de
  // pulo calibrada (RN-IT3) fica intocada. Na BASE (feetY = groundTop = world
  // bounds) o comportamento é idêntico ao de hoje: parado/queda batem no mesmo
  // Y. Só em degrau elevado o player é levantado ≤CLIMB_RATE px/frame (subida
  // visível, sem punição, nunca teleporta). Descer é queda natural (fica acima
  // do piso → gravidade puxa até o próximo degrau).
  private applyTerrainFloor(body: Phaser.Physics.Arcade.Body): void {
    if (!Number.isFinite(this.terrainFeetY) || body.velocity.y < 0) {
      this.groundedOnTerrain = false;
      return;
    }
    if (this.y >= this.terrainFeetY) {
      const climbed = Math.max(this.terrainFeetY, this.y - TERRAIN.CLIMB_RATE);
      this.setY(climbed);
      this.setVelocityY(0);
      this.groundedOnTerrain = true;
    } else {
      this.groundedOnTerrain = false; // acima do piso: caindo em direção a ele
    }
  }

  // chamado ao iniciar o toque/tecla (RF-05); retorna se pulou de fato —
  // InputSystem usa isso pra só disparar o SFX de pulo quando ele acontece
  startJump(): boolean {
    if (!this.onGround) return false;
    this.slide(false); // pular cancela o slide
    this.setVelocityY(PHYSICS.JUMP_VELOCITY);
    this.playStretch(); // game feel: alonga ao sair do chão (T07A-02)
    return true;
  }

  // squash & stretch (T07A-02): âncora nos pés (origin 0.5,1) faz a
  // deformação "brotar" do chão. Yoyo curto volta a escala a 1 — e com ela
  // a hitbox, que no Arcade acompanha a escala (ver JUICE em constants).
  private playStretch(): void {
    this.playJuiceTween(1 - JUICE.SQUASH_SCALE, 1 + JUICE.SQUASH_SCALE);
  }

  private playSquash(): void {
    this.playJuiceTween(1 + JUICE.SQUASH_SCALE, 1 - JUICE.SQUASH_SCALE);
  }

  private playJuiceTween(scaleX: number, scaleY: number): void {
    this.juiceTween?.stop();
    this.setScale(1, 1); // baseline estável mesmo interrompendo o tween anterior
    this.juiceTween = this.scene.tweens.add({
      targets: this,
      scaleX,
      scaleY,
      duration: JUICE.SQUASH_DURATION_MS,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => this.setScale(1, 1),
    });
  }

  // chamado a cada frame ENQUANTO segura, dentro da janela (pulo variável)
  holdJump(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y < 0) {
      this.setVelocityY(body.velocity.y - PHYSICS.JUMP_HOLD_FORCE);
    }
  }

  // chamado ao soltar cedo (corta o arco → pulo curto)
  cutJump(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y < PHYSICS.JUMP_CUT) {
      this.setVelocityY(PHYSICS.JUMP_CUT);
    }
  }

  // converte um pulo RECÉM-iniciado em slide (cancelamento por swipe ↓):
  // reassenta os pés no chão LOCAL (degrau, se houver — senão world bounds) e
  // desliza — o "hop" de 1-2 frames some na hora, sem "cair" do degrau (D-26)
  abortJumpToSlide(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setVelocityY(0);
    const floor = Number.isFinite(this.terrainFeetY)
      ? Math.min(this.scene.physics.world.bounds.bottom, this.terrainFeetY)
      : this.scene.physics.world.bounds.bottom;
    this.setY(floor);
    body.reset(this.x, this.y);
    this.slide(true);
  }

  // slide no chão / fast-fall no ar (RF-05)
  slide(active: boolean): void {
    if (this.sliding === active) return;
    this.sliding = active;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (active) {
      // um stretch de pulo ainda em curso (swipe-cancel dentro da janela)
      // não pode escalar a hitbox do slide — invariante de fairness
      this.juiceTween?.stop();
      this.setScale(1, 1);
      // toca o ciclo agachado (troca o sheet do run pelo do slide). play() já
      // aplica o frame 0, então this.width/height passam ao tamanho do frame
      // agachado antes de travar a hitbox — sem isto a caixa herdaria o tamanho
      // do sheet de corrida
      this.anims.play(this.slideKey, true);
      this.lockSlideHitbox(); // hitbox 44×32 centrada na arte agachada, ancorada nos pés
      if (!body.blocked.down) this.setVelocityY(PHYSICS.FAST_FALL); // desce rápido no ar
    } else {
      // volta ao estado em pé; o update() escolhe correr (chão) ou congelar (ar)
      this.anims.stop();
      this.setTexture(this.idleKey);
      this.lockStandingHitbox(); // arte em pé do personagem → hitbox 44×64 recentrada
    }
  }

  // Estado visual em CHÃO: toca o ciclo de corrida animado. Frames uniformes
  // (61×74) → a hitbox em pé (44×64) fica estável, trava só ao (re)entrar.
  private enterRun(): void {
    if (this.anims.currentAnim?.key === this.runKey && this.anims.isPlaying) return;
    this.anims.play(this.runKey, true);
    this.lockStandingHitbox();
  }

  // Estado visual no AR (pulo/queda): congela num sprite único em pé — sem
  // ciclo de pernas correndo no meio do salto.
  private enterAir(): void {
    if (this.anims.isPlaying) this.anims.stop();
    if (this.texture.key !== this.idleKey) {
      this.setTexture(this.idleKey);
      this.lockStandingHitbox();
    }
  }

  update(_time: number, _delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y > PHYSICS.MAX_FALL_SPEED) this.setVelocityY(PHYSICS.MAX_FALL_SPEED);
    this.applyTerrainFloor(body); // degraus (D-26): auto-climb + grounded no degrau

    // aterrissagem (transição ar→chão) → squash. Fora do slide: a hitbox do
    // slide é intencional e não pode ser tocada pela escala do juice.
    const grounded = this.onGround;
    if (grounded && !this.wasOnGround && !this.sliding) this.playSquash();
    this.wasOnGround = grounded;

    // state machine visual: corre no chão, congela no ar. O slide tem visual
    // próprio (setado em slide()) — não mexer enquanto agachado.
    if (!this.sliding) {
      if (grounded) this.enterRun();
      else this.enterAir();
    }
  }

  // congela a animação (usado pela cena na morte/game over, onde o update()
  // deixa de rodar mas o loop da anim continuaria sozinho no Phaser)
  freezeAnimation(): void {
    this.anims.stop();
  }
}
