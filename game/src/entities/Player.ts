import Phaser from 'phaser';
import { Entity } from './Entity';
import { PHYSICS, SIZES } from '../config/constants';

// Auto-run (RF-04, D-03): o avanço é do CENÁRIO (world-scroll) — o Player
// fica em X fixo na tela e só controla o eixo vertical (pulo/slide).
// Âncora nos pés (origin 0.5, 1): trocar a hitbox no slide mantém os pés
// no chão sem matemática de offset.
export class Player extends Entity {
  private sliding = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player'); // placeholder retângulo (RN-07)
    this.setOrigin(0.5, 1);
    // gravidade vem do GAME_CONFIG (arcade.gravity.y) — não duplicar aqui
    this.setCollideWorldBounds(true);
  }

  get isSliding(): boolean {
    return this.sliding;
  }

  get onGround(): boolean {
    return (this.body as Phaser.Physics.Arcade.Body).blocked.down;
  }

  // chamado ao iniciar o toque/tecla (RF-05); retorna se pulou de fato —
  // InputSystem usa isso pra só disparar o SFX de pulo quando ele acontece
  startJump(): boolean {
    if (!this.onGround) return false;
    this.slide(false); // pular cancela o slide
    this.setVelocityY(PHYSICS.JUMP_VELOCITY);
    return true;
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
      this.setTexture('player-slide');
      body.setSize(SIZES.PLAYER.W, SIZES.PLAYER.SLIDE_H, false);
      body.setOffset(0, 0);
      if (!body.blocked.down) this.setVelocityY(PHYSICS.FAST_FALL); // desce rápido no ar
    } else {
      this.setTexture('player');
      body.setSize(SIZES.PLAYER.W, SIZES.PLAYER.H, false);
      body.setOffset(0, 0);
    }
  }

  update(_time: number, _delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y > PHYSICS.MAX_FALL_SPEED) this.setVelocityY(PHYSICS.MAX_FALL_SPEED);
  }
}
