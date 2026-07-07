import Phaser from 'phaser';

// Primeira Scene do fluxo Boot → Preload → Game → GameOver (design.md §2).
// Responsabilidade única: garantir ajustes globais e disparar o Preload.
// A escala responsiva (Scale.RESIZE) já vem configurada no GAME_CONFIG.
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.scene.start('PreloadScene');
  }
}
