const COLLECTED_STORAGE_PREFIX = 'polity-bros:gems-collected:';

// Coleção persistente de gemas POR MUNDO (D-18): gema coletada na posição N
// do layout fixo NÃO reaparece nas próximas partidas — o replay vira caça
// ao que falta ("preciso jogar de novo pra pegar a dos 390m").
export class GemCollectionSystem {
  static collected(worldId: string): number[] {
    try {
      const raw = localStorage.getItem(COLLECTED_STORAGE_PREFIX + worldId);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed)
        ? parsed.filter((v): v is number => typeof v === 'number')
        : [];
    } catch {
      return [];
    }
  }

  static markCollected(worldId: string, gemIndex: number): void {
    const current = GemCollectionSystem.collected(worldId);
    if (current.includes(gemIndex)) return;
    try {
      localStorage.setItem(
        COLLECTED_STORAGE_PREFIX + worldId,
        JSON.stringify([...current, gemIndex]),
      );
    } catch {
      // sem storage a gema volta na próxima partida — aceitável
    }
  }
}
