import Phaser from 'phaser';
import { GAME_CONFIG } from './config/game-config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

export { GAME_EVENTS, SHELL_EVENTS, emitGameEvent, onGameEvent } from './lib/game-events';
export type { GameEventPayload } from './lib/game-events';
// Skins (T07B-04): catálogo/estado no pacote 'game' (fonte única);
// o MenuScreen React consome daqui — nunca duplicar o catálogo no /web.
export {
  SKINS,
  isSkinUnlocked,
  buySkin,
  getSelectedSkin,
  selectSkin,
  gemBalance,
  skinProgress,
} from './lib/skins';
export type { SkinDef } from './lib/skins';
// Mundos (T07C-01, D-16): catálogo + seleção/desbloqueio para o menu React
export { WORLDS } from './config/constants';
export type { WorldDef } from './config/constants';
export { WorldSystem } from './systems/WorldSystem';
// Progresso de skin por mundo (D-19): a galeria mostra o farm de votos
export { WorldVotesSystem } from './systems/WorldVotesSystem';

// Entrada PÚBLICA do pacote 'game' (design.md §6/§9).
// Cada chamada cria uma instância NOVA — o shell React controla o ciclo de
// vida (createGame no mount, game.destroy(true) no unmount), o que torna
// montar → desmontar → remontar seguro.
export function createGame(parent: string | HTMLElement = 'game-container'): Phaser.Game {
  return new Phaser.Game({
    ...GAME_CONFIG,
    parent,
    scene: [BootScene, PreloadScene, GameScene, GameOverScene],
  });
}
