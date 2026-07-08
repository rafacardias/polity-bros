import Phaser from 'phaser';
import { onGameEvent, SHELL_EVENTS } from '../lib/game-events';
import type { ScoreSnapshot } from '../systems/ScoreSystem';

// Fim de partida (RF-03). O game:gameover é emitido pela GameScene no
// momento da morte; aqui exibimos o resultado e aceitamos reinício por
// toque/Espaço OU pelo shell React via menu:restart (contrato D-05).
// Morrer e recomeçar em 1 toque (RN-03).
export class GameOverScene extends Phaser.Scene {
  private restarted = false;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data: ScoreSnapshot): void {
    const { width, height } = this.scale;
    this.restarted = false;

    const style = { fontFamily: 'monospace', color: '#ffffff', align: 'center' as const };
    this.add
      .text(width / 2, height * 0.3, 'FIM DE JOGO', { ...style, fontSize: '32px' })
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        height * 0.42,
        `SCORE ${data.score ?? 0}\n\nVOTOS ${data.votes ?? 0} · ${data.distance ?? 0}m`,
        { ...style, fontSize: '20px' },
      )
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.62, 'toque para jogar de novo', {
        ...style,
        fontSize: '16px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    // reinício vindo do shell React (botão "Jogar de novo" — T05)
    const offRestart = onGameEvent(SHELL_EVENTS.RESTART, () => this.restart());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offRestart);

    // pequeno atraso: o toque da morte não pode reiniciar sem querer (RN-03)
    this.time.delayedCall(400, () => {
      this.input.once('pointerdown', () => this.restart());
      this.input.keyboard!.once('keydown-SPACE', () => this.restart());
    });
  }

  private restart(): void {
    if (this.restarted) return; // toque + menu:restart simultâneos = 1 reinício
    this.restarted = true;
    this.scene.start('GameScene');
  }
}
