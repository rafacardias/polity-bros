import Phaser from 'phaser';

// Placeholders visuais (RN-07): retângulos coloridos gerados em runtime.
// Na Fase 3 estes keys passam a apontar para sprites reais carregados
// via this.load.* — os keys ('player', 'obstacle', 'vote') NÃO mudam.
const PLACEHOLDERS = [
  { key: 'player', width: 44, height: 64, color: 0x4ade80 },
  { key: 'player-slide', width: 44, height: 32, color: 0x4ade80 },
  { key: 'obstacle-high', width: 44, height: 72, color: 0xef4444 },
  { key: 'obstacle-low', width: 44, height: 160, color: 0xf97316 },
  { key: 'vote', width: 24, height: 24, color: 0xfacc15 },
] as const;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.createProgressBar();
    // Assets reais (sprites + áudio) entram AQUI na Fase 3 via this.load.*.
    // Com a fila vazia, a barra completa instantaneamente — comportamento
    // esperado enquanto só existem placeholders gerados em runtime.
  }

  create(): void {
    this.generatePlaceholderTextures();
    this.generateGroundTexture();
    this.scene.start('GameScene');
  }

  private createProgressBar(): void {
    const { width, height } = this.scale;
    const barWidth = Math.min(320, width * 0.7);
    const barHeight = 18;

    const label = this.add
      .text(width / 2, height / 2 - 32, 'Carregando…', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const frame = this.add
      .rectangle(width / 2, height / 2, barWidth + 8, barHeight + 8)
      .setStrokeStyle(2, 0xffffff);
    const bar = this.add
      .rectangle((width - barWidth) / 2, height / 2, 1, barHeight, 0x4ade80)
      .setOrigin(0, 0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar.width = Math.max(1, barWidth * value);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      // UI de loading é descartável (fora do game loop — pooling não se aplica)
      label.destroy();
      frame.destroy();
      bar.destroy();
    });
  }

  private generatePlaceholderTextures(): void {
    const graphics = this.add.graphics();
    for (const { key, width, height, color } of PLACEHOLDERS) {
      if (this.textures.exists(key)) continue; // idempotente em restart
      graphics.clear();
      graphics.fillStyle(color, 1);
      graphics.fillRect(0, 0, width, height);
      graphics.generateTexture(key, width, height);
    }
    graphics.destroy();
  }

  // faixa listrada do chão — o deslocamento do padrão dá a leitura de
  // velocidade do auto-run (RF-04) mesmo sem parallax (Fase 3)
  private generateGroundTexture(): void {
    if (this.textures.exists('ground')) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x3f3f46, 1);
    graphics.fillRect(0, 0, 64, 12);
    graphics.fillStyle(0x71717a, 1);
    graphics.fillRect(0, 0, 32, 12);
    graphics.generateTexture('ground', 64, 12);
    graphics.destroy();
  }
}
