import Phaser from 'phaser';
import { GAME_CONFIG } from './config/game-config';

// Scene TEMPORÁRIA só para provar que o setup renderiza (T04-01).
// Será substituída por BootScene/PreloadScene/GameScene/GameOverScene na T04-02.
class SetupScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SetupScene' });
  }

  create(): void {
    const text = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Polity Bros — setup OK', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.scale.on(Phaser.Scale.Events.RESIZE, (size: Phaser.Structs.Size) => {
      text.setPosition(size.width / 2, size.height / 2);
    });
  }
}

const game = new Phaser.Game({ ...GAME_CONFIG, scene: [SetupScene] });

// O GameShell (React) importa este default para montar/desmontar o jogo (design.md §6)
export default game;
