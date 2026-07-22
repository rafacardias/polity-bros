import { Entity } from './Entity';

// Inimigo pooled (D-25): personagem que ANDA na direção do player. Pisar em
// cima (stomp) = votos; contato lateral/frontal = morte — a colisão é resolvida
// na GameScene pelo padrão "veio de cima" (topo-seguro, à prova de plataforma
// em movimento). Quem configura textura/hitbox/velocidade é o SpawnerSystem;
// aqui só o ciclo de vida do pool (RN-01). Arte e animação de caminhada entram
// num próximo slice do milestone (por ora, placeholder colorido — RN-07).
export class Enemy extends Entity {
  update(): void {
    if (this.x < -this.width) this.deactivate(); // volta ao pool fora da tela
  }
}
