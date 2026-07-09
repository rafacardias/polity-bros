import { SCORE } from '../config/constants';

// Payload dos eventos game:score / game:gameover (contrato D-05)
export interface ScoreSnapshot {
  score: number;
  votes: number;
  distance: number;
}

// Pontuação (RF-08, RF-11): lógica pura, sem I/O.
// score = distância percorrida (em "metros" = px/10) + votos × VOTE_POINTS.
// A distância acumula em px fracionário e converte só na leitura — somar
// floor() por frame perderia as frações (e zeraria o score em speed baixa).
export class ScoreSystem {
  private distancePx = 0;
  private votes = 0;

  reset(): void {
    this.distancePx = 0;
    this.votes = 0;
  }

  addDistance(px: number): void {
    this.distancePx += px;
  }

  addVote(): void {
    this.votes += 1;
  }

  // linha completa de votos (T07A-03): bônus em VOTOS, não em pontos avulsos —
  // mantém a fórmula validada pela Edge Function (ver SCORE.LINE_BONUS_VOTES)
  addLineBonus(): void {
    this.votes += SCORE.LINE_BONUS_VOTES;
  }

  getSnapshot(): ScoreSnapshot {
    const distance = Math.floor(this.distancePx / SCORE.PX_PER_M);
    return {
      score: distance + this.votes * SCORE.VOTE_POINTS,
      votes: this.votes,
      distance,
    };
  }
}
