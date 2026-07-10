const BEST_STORAGE_PREFIX = 'polity-bros:best:';

// Recorde pessoal POR MUNDO (T07A-04 + D-16): melhor score/distância/votos
// já atingidos NESTE aparelho, NAQUELE mundo — o marcador de quase-vitória
// na pista só faz sentido comparando corridas da mesma fase. I/O de
// localStorage fica no System; ScoreSystem permanece lógica pura.
// (O recorde global pré-mundos, na chave antiga sem sufixo, fica ignorado —
// distâncias do modo infinito não são comparáveis às fases com fim.)
export interface BestRecord {
  score: number;
  distance: number;
  votes: number; // votos em UMA partida — critério de unlock de skin (T07B-04)
}

const EMPTY: BestRecord = { score: 0, distance: 0, votes: 0 };

export class BestScoreSystem {
  static load(worldId: string): BestRecord {
    try {
      const raw = localStorage.getItem(BEST_STORAGE_PREFIX + worldId);
      if (!raw) return { ...EMPTY };
      const parsed = JSON.parse(raw) as Partial<BestRecord>;
      return {
        score: parsed.score ?? 0,
        distance: parsed.distance ?? 0,
        votes: parsed.votes ?? 0,
      };
    } catch {
      return { ...EMPTY }; // storage bloqueado → sem recorde
    }
  }

  // Salva os novos máximos e devolve o recorde ANTERIOR — é contra ele que
  // a GameOverScene calcula o "faltaram Xm" da quase-vitória.
  static update(worldId: string, result: BestRecord): BestRecord {
    const prev = BestScoreSystem.load(worldId);
    try {
      localStorage.setItem(
        BEST_STORAGE_PREFIX + worldId,
        JSON.stringify({
          score: Math.max(prev.score, result.score),
          distance: Math.max(prev.distance, result.distance),
          votes: Math.max(prev.votes, result.votes),
        }),
      );
    } catch {
      // storage indisponível: o jogo segue, só perde a persistência
    }
    return prev;
  }
}
