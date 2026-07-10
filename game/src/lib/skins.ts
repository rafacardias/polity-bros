import { WalletSystem } from '../systems/WalletSystem';
import { WorldVotesSystem } from '../systems/WorldVotesSystem';

// Skins desbloqueáveis (T07B-04, D-11): variantes de COR do placeholder —
// sem pay-to-win (cor não muda física nem hitbox). Identificadores NEUTROS
// por regra de direção de arte: cores, nunca figuras políticas — caricatura
// vive só no asset final (Fase 3).
// Fonte ÚNICA do catálogo: o React (MenuScreen) importa daqui via 'game'.

const SKIN_STORAGE_KEY = 'polity-bros:skin';
const OWNED_STORAGE_KEY = 'polity-bros:skins-owned';

export type SkinUnlock =
  | { type: 'default' }
  // D-19: 1 skin desbloqueável POR MUNDO — votos ACUMULADOS jogando aquele
  // mundo (farm, nunca regride). Substitui os critérios de recorde da 7B,
  // que saíam fácil demais (feedback do dono).
  | { type: 'world-votes'; world: string; value: number }
  | { type: 'gems'; value: number }; // compra com propinas (sink da economia)

export interface SkinDef {
  id: string;
  label: string;
  color: number; // tint aplicado à textura branca do player (Phaser)
  css: string; // mesma cor para a UI React
  unlock: SkinUnlock;
  requirement: string; // texto curto exibido no menu
}

export const SKINS: readonly SkinDef[] = [
  {
    id: 'verde',
    label: 'Verde',
    color: 0x4ade80,
    css: '#4ade80',
    unlock: { type: 'default' },
    requirement: 'inicial',
  },
  {
    id: 'azul',
    label: 'Azul',
    color: 0x60a5fa,
    css: '#60a5fa',
    unlock: { type: 'world-votes', world: 'sp', value: 100 },
    requirement: '100 votos em São Paulo',
  },
  {
    id: 'rosa',
    label: 'Rosa',
    color: 0xf472b6,
    css: '#f472b6',
    unlock: { type: 'world-votes', world: 'rj', value: 150 },
    requirement: '150 votos no Rio',
  },
  {
    id: 'roxo',
    label: 'Roxo',
    color: 0xa78bfa,
    css: '#a78bfa',
    unlock: { type: 'world-votes', world: 'bsb', value: 200 },
    requirement: '200 votos em Brasília',
  },
  {
    id: 'dourado',
    label: 'Dourado',
    color: 0xfacc15,
    css: '#facc15',
    unlock: { type: 'gems', value: 10 },
    requirement: '10 💵',
  },
] as const;

function ownedIds(): string[] {
  try {
    const raw = localStorage.getItem(OWNED_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function isSkinUnlocked(def: SkinDef): boolean {
  switch (def.unlock.type) {
    case 'default':
      return true;
    case 'world-votes':
      return WorldVotesSystem.total(def.unlock.world) >= def.unlock.value;
    case 'gems':
      return ownedIds().includes(def.id);
  }
}

// progresso 0..1 rumo ao desbloqueio — a galeria (D-19) mostra "quase lá"
export function skinProgress(def: SkinDef): number {
  switch (def.unlock.type) {
    case 'default':
      return 1;
    case 'world-votes':
      return Math.min(1, WorldVotesSystem.total(def.unlock.world) / def.unlock.value);
    case 'gems':
      return ownedIds().includes(def.id)
        ? 1
        : Math.min(1, WalletSystem.balance() / def.unlock.value);
  }
}

// compra com gemas; true também quando já possui (idempotente)
export function buySkin(id: string): boolean {
  const def = SKINS.find((s) => s.id === id);
  if (!def || def.unlock.type !== 'gems') return false;
  if (ownedIds().includes(id)) return true;
  if (!WalletSystem.spend(def.unlock.value)) return false;
  try {
    localStorage.setItem(OWNED_STORAGE_KEY, JSON.stringify([...ownedIds(), id]));
  } catch {
    // sem storage nem o débito persistiu — estado segue consistente
  }
  return true;
}

// skin selecionada, SEMPRE validada contra o unlock (regrediu? volta à inicial)
export function getSelectedSkin(): SkinDef {
  try {
    const id = localStorage.getItem(SKIN_STORAGE_KEY);
    const def = SKINS.find((s) => s.id === id);
    if (def && isSkinUnlocked(def)) return def;
  } catch {
    // storage indisponível → skin inicial
  }
  return SKINS[0];
}

export function selectSkin(id: string): boolean {
  const def = SKINS.find((s) => s.id === id);
  if (!def || !isSkinUnlocked(def)) return false;
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, id);
    return true;
  } catch {
    return false;
  }
}

// saldo exposto para a UI React (o WalletSystem em si não sai do pacote)
export function gemBalance(): number {
  return WalletSystem.balance();
}
