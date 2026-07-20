import Phaser from 'phaser';
import { Entity } from './Entity';
import { JUICE, PHYSICS, SIZES } from '../config/constants';
import { getSelectedSkin } from '../lib/skins';

// Auto-run (RF-04, D-03): o avanço é do CENÁRIO (world-scroll) — o Player
// fica em X fixo na tela e só controla o eixo vertical (pulo/slide).
// Âncora nos pés (origin 0.5, 1): trocar a hitbox no slide mantém os pés
// no chão sem matemática de offset.
export class Player extends Entity {
  private sliding = false;
  private wasOnGround = true;
  private juiceTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player'); // sprite real do personagem (Fase 3)
    this.setOrigin(0.5, 1);
    // gravidade vem do GAME_CONFIG (arcade.gravity.y) — não duplicar aqui
    this.setCollideWorldBounds(true);
    this.lockStandingHitbox(); // hitbox fixa 44×64, independe do tamanho da arte
    this.applySkinTint(); // cor da skin selecionada (T07B-04)
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

  // tint da skin — também usado pelo revive (T07B-03), que precisa desfazer
  // o cinza da morte voltando ao visual da skin. Skin default = personagem na
  // cor natural do sprite (clearTint); skins desbloqueáveis = tint por cima.
  applySkinTint(): void {
    const skin = getSelectedSkin();
    if (skin.unlock.type === 'default') {
      this.clearTint();
    } else {
      this.setTint(skin.color);
    }
  }

  get isSliding(): boolean {
    return this.sliding;
  }

  get onGround(): boolean {
    // blocked.down = chão do mundo; touching.down = em pé sobre o bloco
    // flutuante (D-22, collider dinâmico) — nos dois casos pode pular
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
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
  // reassenta os pés no chão e desliza — o "hop" de 1-2 frames some na hora
  abortJumpToSlide(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setVelocityY(0);
    this.setY(this.scene.physics.world.bounds.bottom);
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
      this.setTexture('player-slide');
      body.setSize(SIZES.PLAYER.W, SIZES.PLAYER.SLIDE_H, false);
      body.setOffset(0, 0);
      if (!body.blocked.down) this.setVelocityY(PHYSICS.FAST_FALL); // desce rápido no ar
    } else {
      this.setTexture('player');
      this.lockStandingHitbox(); // sprite real 57×72 → hitbox 44×64 recentrada
    }
  }

  update(_time: number, _delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y > PHYSICS.MAX_FALL_SPEED) this.setVelocityY(PHYSICS.MAX_FALL_SPEED);

    // aterrissagem (transição ar→chão) → squash. Fora do slide: a hitbox do
    // slide é intencional e não pode ser tocada pela escala do juice.
    const grounded = this.onGround;
    if (grounded && !this.wasOnGround && !this.sliding) this.playSquash();
    this.wasOnGround = grounded;
  }
}
