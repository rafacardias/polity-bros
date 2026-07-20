// Manifest declarativo de assets reais (Fase 3). Ponto ÚNICO onde arte de
// arquivo é registrada: key → caminho servido de /public. A PreloadScene lê
// daqui; trocar/adicionar arte = editar este arquivo, sem tocar em cena nem
// entidade. Os keys seguem os placeholders (RN-07) — só a FONTE muda
// (textura gerada em runtime → arquivo). Keys ausentes aqui continuam como
// placeholder gerado no PreloadScene até terem arte.

export interface SpriteAsset {
  key: string;
  path: string; // relativo a /public (ex.: 'assets/sprites/player.png')
}

// Sprites de arquivo. Os demais keys (obstacle-*, vote, gem, ground)
// seguem gerados em runtime até receberem arte final.
export const SPRITE_ASSETS: readonly SpriteAsset[] = [
  { key: 'player', path: 'assets/sprites/player.png' },
  { key: 'player-slide', path: 'assets/sprites/player-slide.png' }, // pose agachada/slide (Fase 3)
] as const;

// Fundos de parallax POR MUNDO (D-16): id do mundo → skyline. Mundos ausentes
// deste mapa seguem com a cor sólida de fundo (WorldDef.bg). Preenchido à
// medida que cada cenário 16-bit é aprovado (piloto: SP).
export const WORLD_BACKGROUNDS: Readonly<Record<string, string>> = {
  sp: 'assets/bg/sp-skyline.png', // piloto Fase 3: skyline 16-bit de São Paulo
} as const;
