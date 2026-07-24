import { WalletSystem } from '../systems/WalletSystem';

// Skins = PERSONAGENS (Fase 4, supersede D-11 "cores"): cada skin é um político
// com arte própria (idle + corrida + agachado), key de textura por SkinDef.char.
// Sem pay-to-win: trocar de personagem não muda física nem hitbox (RN-07 — a
// caixa segue fixa em SIZES.PLAYER). Elenco 3D liberado: Centrão (default),
// militantes Patriota/Comunista e políticos FICTÍCIOS Direita/Esquerda (escolher
// o lado na 1ª tela = identidade + FOMO social). Juiz e 1ª Dama ficam "em breve".
// Fonte ÚNICA do catálogo: o React (MenuScreen) importa daqui via 'game'.

const SKIN_STORAGE_KEY = 'polity-bros:skin';

export type SkinUnlock =
  | { type: 'default' } // liberada de fábrica
  | { type: 'locked' }; // "em breve" — ainda sem arte/definição

export interface SkinDef {
  id: string;
  label: string; // nome exibido (ex.: 'Bolsonaro')
  side?: string; // legenda de lado (ex.: 'Direita') — opcional
  char: string; // prefixo das texturas: 'centrao' | 'patriota' | 'direita' … ('' se locked)
  unlock: SkinUnlock;
  requirement: string; // texto curto exibido no menu
}

export const SKINS: readonly SkinDef[] = [
  // Centrão: personagem BASE default (pedido do dono 2026-07-24). Político
  // genérico/fisiológico = identificação nacional ampla, sem polarizar. As skins
  // de figura (Direita/Esquerda) viram PAGAS na Fase 9 (monetização da paixão
  // política); por ora seguem liberadas.
  {
    id: 'centrao',
    label: 'Centrão',
    char: 'centrao',
    unlock: { type: 'default' },
    requirement: 'liberado',
  },
  // Militantes 3D (2026-07-24): a torcida política de rua, um por lado. Identificação
  // ampla (o eleitor comum, não o político). Estilo 3D-cartoon coeso com o Centrão.
  {
    id: 'patriota',
    label: 'Patriota',
    char: 'patriota',
    unlock: { type: 'default' },
    requirement: 'liberado',
  },
  {
    id: 'comunista',
    label: 'Comunista',
    char: 'comunista',
    unlock: { type: 'default' },
    requirement: 'liberado',
  },
  // Políticos por LADO (2026-07-24): personagens FICTÍCIOS 3D que evocam o lado sem
  // imitar pessoa real (a gravata verde-amarela lê direita; a camisa vermelha + barba
  // grisalha lê esquerda). Substituem as antigas skins pixel Bolsonaro/Lula — que eram
  // pessoas reais (risco de imagem) e destoavam do 3D. As figuras reais ficam p/ a Fase 9
  // (pagas), se e quando fizer sentido. Ambos liberados de fábrica.
  {
    id: 'direita',
    label: 'Direita',
    char: 'direita',
    unlock: { type: 'default' },
    requirement: 'liberado',
  },
  {
    id: 'esquerda',
    label: 'Esquerda',
    char: 'esquerda',
    unlock: { type: 'default' },
    requirement: 'liberado',
  },
  {
    id: 'juiz',
    label: 'Juiz',
    char: '',
    unlock: { type: 'locked' },
    requirement: 'em breve',
  },
  {
    id: 'primeira-dama',
    label: '1ª Dama',
    char: '',
    unlock: { type: 'locked' },
    requirement: 'em breve',
  },
] as const;

// texturas de um personagem — o Player e o menu derivam os keys daqui, sem
// espalhar convenção de nome de asset pelo código. `variant='faixa'` devolve os
// keys da faixa presidencial (<char>-faixa*), usados só na última fase (capital):
// a mesma convenção vale pra qualquer skin — basta ter os assets carregados.
export function skinTextures(
  def: SkinDef,
  variant?: 'faixa',
): { idle: string; run: string; slide: string } {
  const char = def.char || 'player';
  const s = variant === 'faixa' ? '-faixa' : '';
  return { idle: `${char}${s}`, run: `${char}${s}-run`, slide: `${char}${s}-slide` };
}

export function isSkinUnlocked(def: SkinDef): boolean {
  return def.unlock.type === 'default';
}

// skin selecionada, SEMPRE validada contra o unlock (locked/desconhecida → default)
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
  if (!def || !isSkinUnlocked(def)) return false; // locked não seleciona
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, id);
    return true;
  } catch {
    return false;
  }
}

// saldo de propinas exposto para a UI React (o WalletSystem não sai do pacote) —
// usado pelo painel Continue do menu
export function gemBalance(): number {
  return WalletSystem.balance();
}
