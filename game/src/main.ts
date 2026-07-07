import Phaser from 'phaser';
import { GAME_CONFIG } from './config/game-config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';

// Fluxo de Scenes (design.md §2): Boot → Preload → Game → GameOver.
// GameScene e GameOverScene entram nas tasks T04-04+ e T04-13.
const game = new Phaser.Game({ ...GAME_CONFIG, scene: [BootScene, PreloadScene] });

// O GameShell (React) importa este default para montar/desmontar o jogo (design.md §6)
export default game;
