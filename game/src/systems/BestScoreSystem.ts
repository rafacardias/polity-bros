const BEST_STORAGE_KEY = 'polity-bros:best';

// Recorde pessoal (T07A-04, D-10): melhor score e maior distância já
// atingidos NESTE aparelho. Score e distância são acompanhados de forma
// independente — o marcador na pista usa distância (espacial); a mensagem
// de recorde usa score (o que vale no ranking). I/O de localStorage fica
// no System; ScoreSystem permanece lógica pura.
export interface BestRecord {
  score: number;
  distance: number;
}

export class BestScoreSystem {
  static load(): BestRecord {
    try {
      const raw = localStorage.getItem(BEST_STORAGE_KEY);
      if (!raw) return { score: 0, distance: 0 };
      const parsed = JSON.parse(raw) as Partial<BestRecord>;
      return { score: parsed.score ?? 0, distance: parsed.distance ?? 0 };
    } catch {
      return { score: 0, distance: 0 }; // storage bloqueado/corrompido → sem recorde
    }
  }

  // Salva os novos máximos e devolve o recorde ANTERIOR — é contra ele que
  // a GameOverScene calcula o "faltaram Xm" da quase-vitória.
  static update(result: BestRecord): BestRecord {
    const prev = BestScoreSystem.load();
    try {
      localStorage.setItem(
        BEST_STORAGE_KEY,
        JSON.stringify({
          score: Math.max(prev.score, result.score),
          distance: Math.max(prev.distance, result.distance),
        }),
      );
    } catch {
      // storage indisponível: o jogo segue, só perde a persistência
    }
    return prev;
  }
}
