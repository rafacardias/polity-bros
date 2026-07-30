import Phaser from 'phaser';
import { GEM_BAR, HEALTH } from '../config/constants';
import { SPRITE_ASSETS, SPRITESHEET_ASSETS, WORLD_BACKGROUNDS } from '../data/assets-manifest';

// Placeholders visuais (RN-07): retângulos coloridos gerados em runtime.
// Na Fase 3 estes keys passam a apontar para sprites reais carregados
// via this.load.* — os keys ('player', 'obstacle', 'vote') NÃO mudam.
// 'player' já saiu daqui: virou arquivo real (assets-manifest → SPRITE_ASSETS).
const PLACEHOLDERS = [
  // player-slide já saiu daqui: virou sheet animado real (assets-manifest →
  // SPRITESHEET_ASSETS), ciclo de corrida-agachada gerado do personagem em pé.
  { key: 'obstacle-high', width: 44, height: 72, color: 0xef4444 },
  { key: 'obstacle-low', width: 44, height: 160, color: 0xf97316 },
  // inimigo (D-25): agora arte real de arquivo — sheet 'enemy-walk' (repórter)
  // carregado via SPRITESHEET_ASSETS. Sem placeholder aqui (saiu do runtime).
  { key: 'vote', width: 24, height: 24, color: 0xfacc15 },
  // bloco flutuante (D-22 → D-26): plataforma NÃO-LETAL. Cor de concreto/slate
  // (não mais vermelho de "perigo") — o player pousa no topo (propina); não mata
  { key: 'gem-bar', width: GEM_BAR.WIDTH, height: GEM_BAR.HEIGHT, color: 0x64748b },
] as const;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.createProgressBar();
    // Sprites REAIS de arquivo (Fase 3) declarados no manifest — o restante
    // segue placeholder gerado em runtime (generatePlaceholderTextures).
    // Guard idempotente: em teoria a PreloadScene roda 1x, mas evita re-load
    // se a textura já existir.
    for (const { key, path } of SPRITE_ASSETS) {
      if (!this.textures.exists(key)) this.load.image(key, path);
    }
    // Sheets animados (Fase 3) — frames de tamanho fixo p/ montar animações.
    for (const { key, path, frameWidth, frameHeight } of SPRITESHEET_ASSETS) {
      if (!this.textures.exists(key)) this.load.spritesheet(key, path, { frameWidth, frameHeight });
    }
    // Fundos de parallax por mundo (Fase 3) — key 'bg-<world>'. Mundos sem
    // entrada seguem com a cor sólida de WorldDef.bg (sem camada de skyline).
    for (const [world, path] of Object.entries(WORLD_BACKGROUNDS)) {
      const key = `bg-${world}`;
      if (!this.textures.exists(key)) this.load.image(key, path);
    }
    // Áudio (T05-06/RF-10) já usa arquivos reais — tons sintéticos
    // provisórios em /assets/audio, mesmos keys que valem para os
    // arquivos finais.
    this.load.audio('sfx-jump', 'assets/audio/sfx-jump.wav');
    this.load.audio('sfx-vote', 'assets/audio/sfx-vote.wav');
    this.load.audio('sfx-death', 'assets/audio/sfx-death.wav');
    this.load.audio('sfx-combo', 'assets/audio/sfx-combo.wav');
    this.load.audio('sfx-gem', 'assets/audio/sfx-gem.wav');
    this.load.audio('music', 'assets/audio/music.wav');
  }

  create(): void {
    this.generatePlaceholderTextures();
    this.generatePropinaTexture();
    this.generateApprovalTexture();
    this.generateGroundTexture();
    this.scene.start('GameScene');
  }

  // APROVAÇÃO (D-31): santinho de campanha em forma de CORAÇÃO — branco com
  // borda verde. O coração é a única forma que lê como "vida" a 26px num
  // celular; o santinho é o que amarra na satírica política.
  //
  // Desenhado com arcos + linhas (geometria), NÃO com fillText('♥'): emoji e
  // glifos decorativos em canvas renderizam diferente entre iOS e Android e
  // podem ser cortados pela métrica da fonte. O 'V' da cédula e o '$' da propina
  // são aceitáveis porque são ASCII em monospace; um coração não é.
  private generateApprovalTexture(): void {
    if (this.textures.exists('approval')) return; // idempotente em restart
    const s = HEALTH.PICKUP_W;
    const canvas = this.textures.createCanvas('approval', s, s);
    if (!canvas) return;
    const ctx = canvas.context;
    const heart = (scale: number): void => {
      const cx = s / 2;
      const top = s * (0.5 - 0.22 * scale); // altura dos dois lóbulos
      const r = s * 0.24 * scale; // raio de cada lóbulo
      const bottom = s * (0.5 + 0.4 * scale); // ponta inferior
      ctx.beginPath();
      ctx.arc(cx - r * 0.92, top, r, Math.PI * 0.9, Math.PI * 2.1);
      ctx.arc(cx + r * 0.92, top, r, Math.PI * 0.9, Math.PI * 2.1);
      ctx.lineTo(cx, bottom);
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = '#16a34a'; // borda verde (mesmo verde da nota de propina)
    heart(1);
    ctx.fillStyle = '#f8fafc'; // papel do santinho
    heart(0.72);
    canvas.refresh();
  }

  // PROPINA (D-21): nota verde com $ no centro — o colecionável raro do jogo.
  // Canvas texture (não Graphics) porque precisa desenhar TEXTO ($). O key
  // segue 'gem' de propósito: renomear keys/ids quebraria carteiras e
  // coleções já salvas — só o VISUAL e os textos mudam.
  private generatePropinaTexture(): void {
    if (this.textures.exists('gem')) return; // idempotente em restart
    const canvas = this.textures.createCanvas('gem', 30, 18);
    if (!canvas) return;
    const ctx = canvas.context;
    ctx.fillStyle = '#16a34a'; // verde nota
    ctx.fillRect(0, 0, 30, 18);
    ctx.strokeStyle = '#bbf7d0'; // filete claro = borda da cédula
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 28, 16);
    ctx.fillStyle = '#f0fdf4';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 15, 10);
    canvas.refresh();
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
