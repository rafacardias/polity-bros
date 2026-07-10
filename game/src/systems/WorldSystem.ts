import { WORLDS, type WorldDef } from '../config/constants';

const SELECTED_STORAGE_KEY = 'polity-bros:world';
const UNLOCKED_STORAGE_KEY = 'polity-bros:worlds-unlocked';

// Mundos (T07C-01, D-16): seleção + desbloqueio persistidos por aparelho.
// Regra: só se chega ao mundo N terminando o mundo N-1. O primeiro mundo é
// sempre desbloqueado. Consumido pelo jogo E pelo menu React (via barrel).
export class WorldSystem {
  static unlockedIds(): string[] {
    const first = WORLDS[0].id;
    try {
      const raw = localStorage.getItem(UNLOCKED_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const ids = Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === 'string')
        : [];
      return ids.includes(first) ? ids : [first, ...ids];
    } catch {
      return [first];
    }
  }

  static isUnlocked(id: string): boolean {
    return WorldSystem.unlockedIds().includes(id);
  }

  // mundo selecionado, SEMPRE validado contra o desbloqueio
  static selected(): WorldDef {
    try {
      const id = localStorage.getItem(SELECTED_STORAGE_KEY);
      const def = WORLDS.find((w) => w.id === id);
      if (def && WorldSystem.isUnlocked(def.id)) return def;
    } catch {
      // storage indisponível → primeiro mundo
    }
    return WORLDS[0];
  }

  static select(id: string): boolean {
    const def = WORLDS.find((w) => w.id === id);
    if (!def || !WorldSystem.isUnlocked(id)) return false;
    try {
      localStorage.setItem(SELECTED_STORAGE_KEY, id);
      return true;
    } catch {
      return false;
    }
  }

  // terminar um mundo desbloqueia o PRÓXIMO; retorna o mundo recém-aberto
  // (para o pop-up de vitória) ou null se já estava aberto / não há próximo
  static unlockNext(finishedId: string): WorldDef | null {
    const index = WORLDS.findIndex((w) => w.id === finishedId);
    const next = index >= 0 ? WORLDS[index + 1] : undefined;
    if (!next || WorldSystem.isUnlocked(next.id)) return null;
    try {
      localStorage.setItem(
        UNLOCKED_STORAGE_KEY,
        JSON.stringify([...WorldSystem.unlockedIds(), next.id]),
      );
    } catch {
      return null; // sem storage o desbloqueio não persiste — não anunciar
    }
    return next;
  }
}
