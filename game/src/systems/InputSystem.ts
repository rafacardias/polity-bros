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
//   - tap no ar DURANTE a recuperação de impacto (D-35) → intenção de PULO,
//     bufferizada e cobrada no instante do pouso (a exceção existe porque quem
//     levava o impacto no ar não tinha caminho nenhum para pular até aterrissar)
export class InputSystem {
  private enabled = true;
  private holding = false;
  private holdStart = 0;
  private touchDownY = 0;
  private touchDownAt = 0;
  private touchJumping = false; // pulo iniciado por toque, cancelável por swipe
  private swipeHold = false; // slide mantido enquanto o dedo segue na tela
  private airDive = false;
  private slideTimer: Phaser.Time.TimerEvent | null = null;
  // Intenção de pulo que chegou com o player no ar (D-35). Cobrada no pouso
  // dentro de INPUT.JUMP_BUFFER_MS; -∞ = sem intenção pendente.
  private jumpBufferedAt = Number.NEGATIVE_INFINITY;
  // Prazo da janela de recuperação pós-impacto (D-35), empurrado pela Scene.
  private recoveringUntil = 0;
  // Um gesto por vez. Hoje é no-op (game-config fixa activePointers: 1), mas
  // deixa a invariante explícita se alguém subir esse número.
  private activePointerId: number | null = null;

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
    // O Phaser NÃO entrega como 'pointerup' a soltura que acontece fora do
    // canvas — sem isto, arrastar o dedo para fora no meio de um fast-fall
    // deixava airDive/sliding presos e o player corria agachado (D-35).
    scene.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
  }

  // Oferta de CONTINUE (T07B-03): o gameplay-input desliga durante a morte
  // para o toque no botão não virar pulo fantasma no revive; estado
  // transitório é zerado para não vazar entre a morte e a volta.
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.resetTransient();
      this.recoveringUntil = 0; // a recuperação não é um gesto: morre com o input
    }
  }

  // Zera TODO gesto em curso. Chamado ao desligar o input (morte/vitória) e
  // também no impacto (D-35): um dedo preso no meio de um fast-fall não pode
  // sobreviver ao pisca — era assim que o player aterrissava agachado e seguia
  // agachado (hitbox 44×32) direto para o próximo obstáculo.
  resetTransient(): void {
    this.holding = false;
    this.touchJumping = false;
    this.swipeHold = false;
    // Desfaz SÓ o agachamento nascido de fast-fall: sem isto o `sliding` ficaria
    // órfão (o pointerup não teria mais como desfazê-lo). Um slide DELIBERADO
    // (tecla ↓ / swipe) sobrevive de propósito — obrigar o player a levantar no
    // meio de um slide sob uma câmera criaria dano novo (RN-07).
    if (this.airDive) {
      this.airDive = false;
      this.player.slide(false);
    }
    this.jumpBufferedAt = Number.NEGATIVE_INFINITY;
    this.activePointerId = null;
    this.cancelSlideTimer();
  }

  // A Scene avisa o impacto (D-35). Push com PRAZO, não flag booleana: expira
  // sozinho (sem timer para vazar no shutdown) e é explícito no ponto onde a
  // decisão é tomada. A janela de INPUT é coisa distinta da de invulnerabilidade
  // — ela acaba quando o jogador volta ao chão (ver update), e o prazo é só o
  // teto para quem ainda está no ar. O InputSystem continua sem escutar nada;
  // quem faz a ponte é a Scene.
  setRecovering(durationMs: number): void {
    this.recoveringUntil = this.scene.time.now + durationMs;
  }

  private get recovering(): boolean {
    return this.scene.time.now < this.recoveringUntil;
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    if (this.activePointerId !== null && p.id !== this.activePointerId) return;
    this.activePointerId = p.id;
    if (!this.player.onGround) {
      if (this.recovering) {
        // Recuperando do impacto: o toque no ar é PEDIDO DE PULO, não mergulho.
        // beginJump() falha (sem chão) e deixa a intenção no buffer, cobrada
        // pelo tryBufferedJump() no primeiro frame de contato com o chão.
        this.touchDownY = p.y;
        this.touchDownAt = this.scene.time.now;
        this.beginJump();
        return;
      }
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
    if (!this.enabled) return;
    if (p.id !== this.activePointerId) return;
    if (this.touchJumping && this.isSwipeDown(p)) {
      this.touchJumping = false;
      this.holding = false;
      this.player.abortJumpToSlide(); // a intenção era descer, não subir
      this.swipeHold = true;
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    if (p.id !== this.activePointerId) return;
    this.activePointerId = null; // antes dos ramos: todos eles encerram o gesto
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
    if (!this.enabled) return;
    this.cancelSlideTimer();
    this.swipeHold = false;
    this.player.slide(false);
    this.holding = true;
    this.holdStart = this.scene.time.now;
    if (this.player.startJump()) {
      this.audio.jump();
      this.jumpBufferedAt = Number.NEGATIVE_INFINITY;
    } else {
      // Sem chão: a intenção NÃO é descartada, fica no buffer (D-35).
      this.jumpBufferedAt = this.scene.time.now;
    }
  }

  // Cobra a intenção de pulo guardada, no primeiro frame em que ela couber.
  //
  // Invariante que evita o bug óbvio: o buffer só é gravado por beginJump(). O
  // fast-fall NÃO passa por lá, então quem mergulha para stompar nunca quica
  // sozinho ao tocar o chão.
  private tryBufferedJump(): void {
    if (!this.enabled) return;
    // Dedo/tecla ainda pressionado durante a recuperação = "quero pular", e a
    // vontade não expira enquanto o gesto durar: sem esta renovação, segurar o
    // dedo por mais de JUMP_BUFFER_MS na queda perderia o pulo justamente no
    // caso que motivou o D-35 (tocar e segurar em pânico depois do impacto).
    if (this.recovering && this.holding && !this.player.onGround) {
      this.jumpBufferedAt = this.scene.time.now;
    }
    if (this.scene.time.now - this.jumpBufferedAt > INPUT.JUMP_BUFFER_MS) return;
    if (!this.player.startJump()) return;
    this.jumpBufferedAt = Number.NEGATIVE_INFINITY;
    this.cancelSlideTimer();
    this.audio.jump();
    // Repõe a janela do pulo variável (RF-05): sem isto TODO pulo bufferizado
    // sairia curto, porque HOLD_MAX_MS teria sido consumida no ar — e quem
    // segurou o dedo esperando o pulo alto receberia um pulinho.
    if (this.holding) this.holdStart = this.scene.time.now;
  }

  private endJump(): void {
    if (!this.holding) return;
    this.holding = false;
    if (this.scene.time.now - this.holdStart < INPUT.HOLD_MAX_MS) {
      this.player.cutJump(); // soltou cedo = pulo curto
    }
  }

  private beginSlide(timed: boolean): void {
    if (!this.enabled) return;
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

  // Autocura de gesto preso (D-35): há gesto de TOQUE em curso, mas nenhum
  // ponteiro encostado na tela — o evento de soltura se perdeu (touchcancel do
  // iOS, app em background, aba trocada). Sem isto o player fica correndo
  // agachado indefinidamente. Só flags de TOQUE: `holding` é compartilhado com
  // o teclado e não pode entrar aqui.
  private releaseStuckGesture(): void {
    if (!this.enabled) return;
    if (!this.airDive && !this.swipeHold && !this.touchJumping) return;
    if (this.scene.input.manager.pointers.some((p) => p.isDown)) return;
    this.resetTransient();
  }

  update(): void {
    this.releaseStuckGesture();
    this.tryBufferedJump();
    // A recuperação existe para trazer o jogador de volta ao chão EM CONTROLE:
    // cumprida a missão, ela acaba na hora e o fast-fall volta (RF-05), sem
    // depender do relógio. O prazo de RECOVERY_INPUT_MS é só o teto de segurança
    // para quem ainda está no ar.
    if (this.recoveringUntil !== 0 && this.player.onGround) this.recoveringUntil = 0;
    if (this.holding && this.scene.time.now - this.holdStart < INPUT.HOLD_MAX_MS) {
      this.player.holdJump(); // pulo variável (RF-05)
    }
  }
}
