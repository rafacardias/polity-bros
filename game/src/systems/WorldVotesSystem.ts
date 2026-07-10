// Votos ACUMULADOS por mundo (D-19): moeda de desbloqueio das skins — cada
// mundo tem 1 skin desbloqueável por "farmar" votos jogando aquele mundo.
// Local por aparelho (mesma regra da carteira, D-11); acumula a cada fim de
// run (morte OU vitória) — progresso nunca se perde, só cresce.
const STORAGE_PREFIX = 'polity-bros:votes-acc:';

export class WorldVotesSystem {
  static total(worldId: string): number {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + worldId);
      const parsed = raw ? Number(raw) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    } catch {
      return 0;
    }
  }

  static add(worldId: string, votes: number): number {
    const next = this.total(worldId) + Math.max(0, Math.floor(votes));
    try {
      localStorage.setItem(STORAGE_PREFIX + worldId, String(next));
    } catch {
      // storage indisponível: progresso desta run não persiste — o jogo segue
    }
    return next;
  }
}
