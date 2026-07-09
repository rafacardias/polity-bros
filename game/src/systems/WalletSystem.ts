const GEMS_STORAGE_KEY = 'polity-bros:gems';

// Carteira de gemas (T07B-02/03, D-11): meta-moeda ganha jogando, LOCAL por
// aparelho na v1.0 (sync cross-device = backlog). Gemas não afetam score nem
// ranking — trapacear aqui é trapacear consigo mesmo, por isso client-side
// é aceitável (a integridade competitiva continua na Edge Function).
export class WalletSystem {
  static balance(): number {
    try {
      const raw = localStorage.getItem(GEMS_STORAGE_KEY);
      const n = raw === null ? 0 : Number(raw);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  static add(amount: number): number {
    const next = WalletSystem.balance() + Math.max(0, Math.floor(amount));
    try {
      localStorage.setItem(GEMS_STORAGE_KEY, String(next));
    } catch {
      // storage indisponível: gema desta sessão não persiste — o jogo segue
    }
    return next;
  }

  // false = saldo insuficiente (nada é debitado)
  static spend(amount: number): boolean {
    const cost = Math.max(0, Math.floor(amount));
    const current = WalletSystem.balance();
    if (current < cost) return false;
    try {
      localStorage.setItem(GEMS_STORAGE_KEY, String(current - cost));
    } catch {
      return false; // não conseguiu persistir o débito → não libera a compra
    }
    return true;
  }
}
