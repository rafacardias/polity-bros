import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { INPUT } from '../config/constants';

// Única fonte de input (RF-05, RN-08). Mapeia teclado E touch para o MESMO
// modelo de timing, para justiça no ranking:
// - pulo:     tap / ↑ / Espaço — segurar dentro da janela = pulo mais alto
// - descer:   swipe ↓ (slide temporizado) · segurar ↓ (desktop) · tap no ar
export class InputSystem {
  private holding = false;
  private holdStart = 0;
  private pointerDownY = 0;
  private airDive = false;
  private slideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
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

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerDownY = p.y;
      if (this.player.onGround) {
        this.beginJump();
      } else {
        this.airDive = true; // tap no ar = descida rápida (RF-05)
        this.player.slide(true);
      }
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.airDive) {
        this.airDive = false;
        this.player.slide(false);
        return;
      }
      if (p.y - this.pointerDownY > INPUT.SWIPE_DOWN_PX) {
        this.holding = false;
        this.beginSlide(true); // swipe ↓: dedo já soltou → slide temporizado
      } else {
        this.endJump();
      }
    });
  }

  private beginJump(): void {
    this.cancelSlideTimer();
    this.player.slide(false);
    this.holding = true;
    this.holdStart = this.scene.time.now;
    this.player.startJump();
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
