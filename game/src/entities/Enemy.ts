import Phaser from 'phaser';
import { Entity } from './Entity';

// Sheets de animação (globais no anims manager da cena).
const WALK_KEY = 'enemy-walk'; // repórter — caminha no chão
const FLY_KEY = 'enemy-fly'; // câmera de imprensa — voa no alto

// Inimigo pooled (D-25): DOIS tipos no mesmo pool/grupo, distinguidos pelo
// data 'kind' (setado no SpawnerSystem) e pela animação tocada no spawn:
//  • repórter (playWalk): anda na direção do player; pular por cima OU pisar
//    em cima (stomp) = votos; contato lateral/frontal = morte.
//  • câmera (playFly): voa no alto; deslizar por baixo = seguro; qualquer
//    contato = morte (ameaça pura — dá uso defensivo ao agachar).
// A GameScene decide stomp/morte em hitEnemy conforme o 'kind'. Aqui vivem só
// o ciclo de vida do pool (RN-01) e a criação/execução das animações.
export class Enemy extends Entity {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, WALK_KEY); // textura inicial (o spawn escolhe walk/fly)
    this.ensureAnimation(WALK_KEY);
    this.ensureAnimation(FLY_KEY);
  }

  // Cria a animação de 4 frames uma vez (guard) — o pool instancia vários
  // inimigos, mas a anim é global. Guard de textura evita quebrar se o sheet
  // ainda não estiver carregado (na prática o PreloadScene garante que está).
  private ensureAnimation(key: string): void {
    if (this.scene.anims.exists(key)) return;
    if (!this.scene.textures.exists(key)) return;
    this.scene.anims.create({
      key,
      frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1,
    });
  }

  // Toca a caminhada/voo ao (re)entrar em cena vindo do pool. Nomes próprios
  // (não 'play') para não sombrear Phaser.Sprite.play(key, ...).
  playWalk(): void {
    this.anims.play(WALK_KEY, true);
  }

  playFly(): void {
    this.anims.play(FLY_KEY, true);
  }

  update(): void {
    if (this.x < -this.width) this.deactivate(); // volta ao pool fora da tela
  }
}
