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

  // px cru (não floored) — o marcador de recorde na pista (T07A-04) precisa
  // de posição contínua; metros floored fariam o marcador andar em saltos
  getDistancePx(): number {
    return this.distancePx;
  }

  addVote(): void {
    this.votes += 1;
  }

  // vários votos de uma vez (recompensa de stomp — D-25): passa pelo MESMO
  // contador de votos, mantendo a fórmula validada pela Edge Function (RN-04)
  addVotes(n: number): void {
    this.votes += n;
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
