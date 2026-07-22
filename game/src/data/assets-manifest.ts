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

// Sprite sheets animados (Fase 3): frames de tamanho fixo lado a lado. A
// PreloadScene carrega via load.spritesheet e as ANIMAÇÕES são montadas na
// entidade (ex.: Player cria a anim 'player-run' a partir dos frames 0–3).
export interface SpriteSheetAsset {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

// Sprites de arquivo. Os demais keys (obstacle-*, vote, gem, ground)
// seguem gerados em runtime até receberem arte final.
// Frames estáticos (idle/pulo/queda) — um por PERSONAGEM de skin (D-11/Fase 4:
// skin = personagem, não mais cor). O prefixo do key casa com SkinDef.char.
export const SPRITE_ASSETS: readonly SpriteAsset[] = [
  { key: 'player', path: 'assets/sprites/player.png' }, // Candidato (neutro, default)
  { key: 'bolsonaro', path: 'assets/sprites/bolsonaro.png' }, // skin Direita
  { key: 'lula', path: 'assets/sprites/lula.png' }, // skin Esquerda
] as const;

// Sheets animados por personagem: '<char>-run' (ciclo de corrida) e
// '<char>-slide' (corrida-agachada, bem mais baixo → lê como "duck"). Todos
// alinhados pelos pés na origem (0.5,1); mesmo tamanho por frame evita "tremor".
// Larguras variam por build do personagem (Lula mais encorpado etc.) — cada
// sheet declara seu frameWidth; a hitbox segue fixa em SIZES.PLAYER (RN-07).
export const SPRITESHEET_ASSETS: readonly SpriteSheetAsset[] = [
  { key: 'player-run', path: 'assets/sprites/player-run.png', frameWidth: 61, frameHeight: 74 },
  { key: 'player-slide', path: 'assets/sprites/player-slide.png', frameWidth: 60, frameHeight: 48 },
  { key: 'bolsonaro-run', path: 'assets/sprites/bolsonaro-run.png', frameWidth: 51, frameHeight: 72 },
  { key: 'bolsonaro-slide', path: 'assets/sprites/bolsonaro-slide.png', frameWidth: 44, frameHeight: 48 },
  { key: 'lula-run', path: 'assets/sprites/lula-run.png', frameWidth: 52, frameHeight: 72 },
  { key: 'lula-slide', path: 'assets/sprites/lula-slide.png', frameWidth: 47, frameHeight: 48 },
  // Inimigo (D-25): repórter satírico com microfone — ciclo de caminhada de 4
  // frames. Anda na direção do player (perfil virado à ESQUERDA). A hitbox
  // segue fixa em ENEMY (RN-07: arte ≠ tamanho); frame 49×68 excede os 40×60
  // da caixa e é recentrado nos pés no SpawnerSystem.
  { key: 'enemy-walk', path: 'assets/sprites/enemy-walk.png', frameWidth: 49, frameHeight: 68 },
] as const;

// Fundos de parallax POR MUNDO (D-16): id do mundo → skyline. Mundos ausentes
// deste mapa seguem com a cor sólida de fundo (WorldDef.bg). Preenchido à
// medida que cada cenário 16-bit é aprovado (piloto: SP).
export const WORLD_BACKGROUNDS: Readonly<Record<string, string>> = {
  sp: 'assets/bg/sp-skyline.png', // piloto Fase 3: skyline 16-bit de São Paulo
} as const;
