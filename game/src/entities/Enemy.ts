import Phaser from 'phaser';
import { Entity } from './Entity';

// Key da animação de caminhada do inimigo (global no anims manager da cena).
const WALK_KEY = 'enemy-walk';

// Inimigo pooled (D-25): repórter satírico que ANDA na direção do player. Pisar
// em cima (stomp) = votos; contato lateral/frontal = morte — a colisão é
// resolvida na GameScene pelo padrão "veio de cima" (topo-seguro, à prova de
// plataforma em movimento). Quem configura hitbox/velocidade é o SpawnerSystem;
// aqui vivem só o ciclo de vida do pool (RN-01) e o ciclo de caminhada.
export class Enemy extends Entity {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, WALK_KEY); // sheet do repórter (frame 0 no idle do pool)
    this.createWalkAnimation();
  }

  // Ciclo de caminhada (4 frames do sheet 'enemy-walk'). Global no anims
  // manager — guard evita recriar quando o pool instancia vários inimigos.
  private createWalkAnimation(): void {
    if (this.scene.anims.exists(WALK_KEY)) return;
    this.scene.anims.create({
      key: WALK_KEY,
      frames: this.scene.anims.generateFrameNumbers(WALK_KEY, { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1,
    });
  }

  // Toca a caminhada ao (re)entrar em cena vindo do pool. Nome próprio (não
  // 'play') para não sombrear Phaser.Sprite.play(key, ...).
  playWalk(): void {
    this.anims.play(WALK_KEY, true);
  }

  update(): void {
    if (this.x < -this.width) this.deactivate(); // volta ao pool fora da tela
  }
}
