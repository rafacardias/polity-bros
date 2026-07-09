import Phaser from 'phaser';
import { onGameEvent, SHELL_EVENTS } from '../lib/game-events';
import type { ScoreSnapshot } from '../systems/ScoreSystem';

// snapshot + contexto de quase-vitória (T07A-04), calculado pela GameScene
// contra o recorde ANTERIOR à partida
export interface GameOverData extends ScoreSnapshot {
  newBestScore?: boolean;
  tiedRecord?: boolean;
  distanceGapM?: number;
  scoreGap?: number;
}

// Fim de partida (RF-03). O game:gameover é emitido pela GameScene no
// momento da morte; aqui exibimos o resultado e aceitamos reinício por
// toque/Espaço OU pelo shell React via menu:restart (contrato D-05).
// Morrer e recomeçar em 1 toque (RN-03).
export class GameOverScene extends Phaser.Scene {
  private restarted = false;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data: GameOverData): void {
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
    this.createNearMissLine(data, width, height, style);
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

  // Quase-vitória (T07A-04, D-10): recorde novo celebra; derrota mostra o
  // quão PERTO ficou — combustível do "só mais uma" sem tocar dificuldade.
  private createNearMissLine(
    data: GameOverData,
    width: number,
    height: number,
    style: { fontFamily: string; color: string; align: 'center' },
  ): void {
    let msg = '';
    let color = '#94a3b8';
    if (data.newBestScore) {
      msg = '🏆 NOVO RECORDE!';
      color = '#facc15';
    } else if (data.tiedRecord) {
      msg = 'empatou com seu recorde!';
    } else if ((data.distanceGapM ?? 0) > 0) {
      msg = `faltaram ${data.distanceGapM}m pro seu recorde!`;
    } else if ((data.scoreGap ?? 0) > 0) {
      msg = `faltaram ${data.scoreGap} pontos pro seu recorde!`;
    }
    if (!msg) return;

    const line = this.add
      .text(width / 2, height * 0.52, msg, { ...style, fontSize: '16px', color })
      .setOrigin(0.5);
    if (data.newBestScore) {
      this.tweens.add({
        targets: line,
        scale: 1.12,
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private restart(): void {
    if (this.restarted) return; // toque + menu:restart simultâneos = 1 reinício
    this.restarted = true;
    this.scene.start('GameScene');
  }
}
