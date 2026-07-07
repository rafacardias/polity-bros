import Phaser from 'phaser';
import { GAME_CONFIG } from './config/game-config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';

export { GAME_EVENTS, SHELL_EVENTS, emitGameEvent, onGameEvent } from './lib/game-events';
export type { GameEventPayload } from './lib/game-events';

// Entrada PÚBLICA do pacote 'game' (design.md §6/§9).
// Cada chamada cria uma instância NOVA — o shell React controla o ciclo de
// vida (createGame no mount, game.destroy(true) no unmount), o que torna
// montar → desmontar → remontar seguro.
export function createGame(parent: string | HTMLElement = 'game-container'): Phaser.Game {
  return new Phaser.Game({ ...GAME_CONFIG, parent, scene: [BootScene, PreloadScene] });
}
