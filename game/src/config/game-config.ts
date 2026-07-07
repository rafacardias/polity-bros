import Phaser from 'phaser';
import { PHYSICS } from './constants';

// Config base do jogo (design.md §5). As Scenes (Boot → Preload → Game →
// GameOver) são registradas em main.ts a partir da T04-02.
export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container', // container DIV — NUNCA iframe (D-05)
  backgroundColor: '#1e1e2e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: PHYSICS.GRAVITY }, debug: false },
  },
  render: { antialias: false, pixelArt: true, roundPixels: true },
  input: { activePointers: 1 },
};
