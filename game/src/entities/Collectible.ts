import { Entity } from './Entity';

// O "voto" (D-04, RF-11) — coletável pooled. Quem posiciona/configura é o
// SpawnerSystem; quem pontua é a GameScene via ScoreSystem. Aqui, só o
// ciclo de vida do pool.
export class Collectible extends Entity {
  update(): void {
    if (this.x < -this.width) this.deactivate(); // volta ao pool fora da tela
  }
}
