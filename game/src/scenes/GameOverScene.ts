import Phaser from 'phaser';
import { onGameEvent, SHELL_EVENTS } from '../lib/game-events';
import type { ScoreSnapshot } from '../systems/ScoreSystem';
import { WalletSystem } from '../systems/WalletSystem';
import { ECONOMY } from '../config/constants';

// snapshot + contexto de quase-vitória (T07A-04), calculado pela GameScene
// contra o recorde ANTERIOR à partida
export interface GameOverData extends ScoreSnapshot {
  newBestScore?: boolean;
  tiedRecord?: boolean;
  distanceGapM?: number;
  scoreGap?: number;
  won?: boolean; // D-16: cruzou a linha de chegada
  stars?: number; // D-17: 1..3 — `score` já vem multiplicado
  gems?: number; // propinas coletadas NA run (educação da 1ª — D-18)
  worldName?: string;
  unlockedWorld?: string | null; // nome do mundo recém-desbloqueado
}

// educação da 1ª propina (D-18/D-21): UMA vez por aparelho, na primeira
// tela de fim após coletar a primeira propina da vida
const GEM_EDUCATION_KEY = 'polity-bros:gem-education';

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
    // vitória (D-16) muda o tom inteiro da tela: completou a fase é FESTA
    const title = data.won ? '🏁 FASE COMPLETA!' : 'FIM DE JOGO';
    const titleColor = data.won ? '#4ade80' : '#ffffff';
    this.add
      .text(width / 2, height * 0.28, title, { ...style, fontSize: '30px', color: titleColor })
      .setOrigin(0.5);
    if (data.won && data.worldName) {
      this.add
        .text(width / 2, height * 0.335, `Você atravessou ${data.worldName}!`, {
          ...style,
          fontSize: '15px',
          color: '#94a3b8',
        })
        .setOrigin(0.5);
    }
    // estrelas (D-17): a nota da fase + o multiplicador que ela valeu.
    // Na derrota (1⭐) o convite mostra o caminho: terminar a fase = ×2.
    const stars = data.stars ?? 1;
    if (data.won) {
      const starLine = this.add
        .text(width / 2, height * 0.385, `${'⭐'.repeat(stars)}  score ×${stars}`, {
          ...style,
          fontSize: '20px',
          color: '#facc15',
        })
        .setOrigin(0.5)
        .setScale(0);
      this.tweens.add({ targets: starLine, scale: 1, duration: 420, ease: 'Back.easeOut' });
      if (stars < 3) {
        this.add
          .text(width / 2, height * 0.425, 'colete TUDO para ⭐⭐⭐ (×3)', {
            ...style,
            fontSize: '12px',
            color: '#94a3b8',
          })
          .setOrigin(0.5);
      }
    }
    this.add
      .text(
        width / 2,
        height * (data.won ? 0.47 : 0.42),
        `SCORE ${data.score ?? 0}\n\nVOTOS ${data.votes ?? 0} · ${data.distance ?? 0}m`,
        { ...style, fontSize: '20px' },
      )
      .setOrigin(0.5);
    // na vitória, as linhas de estrelas empurram o layout para baixo
    this.createNearMissLine(data, width, height, style, data.won ? 0.555 : 0.52);
    this.createUnlockLine(data, width, height, style, data.won ? 0.61 : 0.58);
    this.add
      .text(width / 2, height * (data.won ? 0.665 : 0.62), 'toque para jogar de novo', {
        ...style,
        fontSize: '16px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);
    this.createGemEducation(data, width, height, style);

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
    yFrac = 0.52,
  ): void {
    let msg = '';
    let color = '#94a3b8';
    if (data.won && !data.newBestScore && !data.tiedRecord) return; // vitória sem recorde: sem "faltaram"
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
      .text(width / 2, height * yFrac, msg, { ...style, fontSize: '16px', color })
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

  // Desbloqueio de mundo (D-16): a RECOMPENSA explícita de terminar a fase —
  // "entardeceu e continuo na mesma fase" nunca mais (feedback do dono)
  private createUnlockLine(
    data: GameOverData,
    width: number,
    height: number,
    style: { fontFamily: string; color: string; align: 'center' },
    yFrac = 0.58,
  ): void {
    if (!data.unlockedWorld) return;
    const line = this.add
      .text(width / 2, height * yFrac, `🔓 ${data.unlockedWorld} desbloqueado!`, {
        ...style,
        fontSize: '18px',
        color: '#facc15',
      })
      .setOrigin(0.5)
      .setScale(0);
    this.tweens.add({
      targets: line,
      scale: 1,
      duration: 450,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: line,
          scale: 1.08,
          duration: 420,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  // 1ª propina da vida (D-18): explica a moeda no momento de maior atenção —
  // a tela de fim logo após a coleta. "3 💵 = 1 continue" planta o objetivo
  // ("faltam 2 pra eu voltar de onde morri") sem tutorial chato.
  private createGemEducation(
    data: GameOverData,
    width: number,
    height: number,
    style: { fontFamily: string; color: string; align: 'center' },
  ): void {
    if (!data.gems || data.gems <= 0) return;
    let seen = false;
    try {
      seen = localStorage.getItem(GEM_EDUCATION_KEY) === 'true';
      if (!seen) localStorage.setItem(GEM_EDUCATION_KEY, 'true');
    } catch {
      // sem storage: mostra sempre — melhor repetir a dica que nunca dar
    }
    if (seen) return;

    const balance = WalletSystem.balance();
    const line = this.add
      .text(
        width / 2,
        height * 0.76,
        `💵 Você achou uma PROPINA!\nJunte ${ECONOMY.CONTINUE_COST} e compre 1 CONTINUE` +
          ` pra voltar de onde morreu.\nVocê tem ${balance} 💵`,
        { ...style, fontSize: '13px', color: '#4ade80', backgroundColor: '#0f172acc' },
      )
      .setOrigin(0.5)
      .setPadding(12, 8, 12, 8)
      .setScale(0);
    this.tweens.add({
      targets: line,
      scale: 1,
      duration: 420,
      ease: 'Back.easeOut',
      delay: 250,
    });
  }

  private restart(): void {
    if (this.restarted) return; // toque + menu:restart simultâneos = 1 reinício
    this.restarted = true;
    this.scene.start('GameScene');
  }
}
