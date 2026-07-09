import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { INPUT } from '../config/constants';
import type { AudioSystem } from './AudioSystem';

// Única fonte de input (RF-05, RN-08). Teclado e touch usam EXATAMENTE o
// mesmo modelo de timing: o pulo inicia no down (tecla OU toque) e o arco
// varia com o tempo segurado (janela HOLD_MAX_MS) — paridade total.
//
// Touch (RN-02 — mobile-first):
//   - tap / tap-hold no chão → pulo curto / variável (instantâneo, sem latência)
//   - swipe ↓ dentro da janela de cancelamento → a intenção era descer:
//     o pulo nascente é ABORTADO e vira slide imediatamente (corrige o
//     "sobe antes de descer" sentido no Safari, onde o swipe só era
//     reconhecido no touchend)
//   - segurar após o swipe → continua deslizando; soltar → completa SLIDE_MS
//   - tap com o player no ar → descida rápida (fast-fall)
export class InputSystem {
  private holding = false;
  private holdStart = 0;
  private touchDownY = 0;
  private touchDownAt = 0;
  private touchJumping = false; // pulo iniciado por toque, cancelável por swipe
  private swipeHold = false; // slide mantido enquanto o dedo segue na tela
  private airDive = false;
  private slideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private audio: AudioSystem,
  ) {
    const kb = scene.input.keyboard!;
    const up = kb.addKey('UP');
    const space = kb.addKey('SPACE');
    const down = kb.addKey('DOWN');

    up.on('down', () => this.beginJump());
    space.on('down', () => this.beginJump());
    up.on('up', () => this.endJump());
    space.on('up', () => this.endJump());
    down.on('down', () => this.beginSlide(false)); // segura ↓ = desliza enquanto segurar
    down.on('up', () => this.player.slide(false));

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (!this.player.onGround) {
      // no ar não há ambiguidade: tap = descida rápida imediata (RF-05)
      this.airDive = true;
      this.player.slide(true);
      return;
    }
    this.touchDownY = p.y;
    this.touchDownAt = this.scene.time.now;
    this.touchJumping = true;
    this.beginJump(); // instantâneo — mesmo timing do teclado (RN-08)
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.touchJumping && this.isSwipeDown(p)) {
      this.touchJumping = false;
      this.holding = false;
      this.player.abortJumpToSlide(); // a intenção era descer, não subir
      this.swipeHold = true;
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (this.airDive) {
      this.airDive = false;
      this.player.slide(false);
      return;
    }
    if (this.swipeHold) {
      this.swipeHold = false;
      this.beginSlide(true); // soltou após swipe → garante a duração do slide
      return;
    }
    if (this.touchJumping && this.isSwipeDown(p)) {
      // flick tão rápido que nenhum pointermove chegou antes do up
      this.touchJumping = false;
      this.holding = false;
      this.player.abortJumpToSlide();
      this.beginSlide(true);
      return;
    }
    this.touchJumping = false;
    this.endJump();
  }

  private isSwipeDown(p: Phaser.Input.Pointer): boolean {
    return (
      this.scene.time.now - this.touchDownAt <= INPUT.SWIPE_CANCEL_WINDOW_MS &&
      p.y - this.touchDownY > INPUT.SWIPE_INTENT_PX
    );
  }

  private beginJump(): void {
    this.cancelSlideTimer();
    this.swipeHold = false;
    this.player.slide(false);
    this.holding = true;
    this.holdStart = this.scene.time.now;
    if (this.player.startJump()) this.audio.jump();
  }

  private endJump(): void {
    if (!this.holding) return;
    this.holding = false;
    if (this.scene.time.now - this.holdStart < INPUT.HOLD_MAX_MS) {
      this.player.cutJump(); // soltou cedo = pulo curto
    }
  }

  private beginSlide(timed: boolean): void {
    this.cancelSlideTimer();
    this.player.slide(true);
    if (timed) {
      this.slideTimer = this.scene.time.delayedCall(INPUT.SLIDE_MS, () => {
        this.player.slide(false);
        this.slideTimer = null;
      });
    }
  }

  private cancelSlideTimer(): void {
    if (this.slideTimer) {
      this.slideTimer.remove();
      this.slideTimer = null;
    }
  }

  update(): void {
    if (this.holding && this.scene.time.now - this.holdStart < INPUT.HOLD_MAX_MS) {
      this.player.holdJump(); // pulo variável (RF-05)
    }
  }
}
