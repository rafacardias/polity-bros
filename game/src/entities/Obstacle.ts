import { Entity } from './Entity';

// Obstáculo pooled (RF-06, RN-01): 'high' no chão (pular por cima) ou
// 'low' suspenso (deslizar por baixo). Quem configura textura/hitbox/
// velocidade é o SpawnerSystem — aqui só o ciclo de vida do pool.
export class Obstacle extends Entity {
  update(): void {
    if (this.x < -this.width) this.deactivate(); // volta ao pool fora da tela
  }
}
