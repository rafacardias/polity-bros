import { Entity } from './Entity';

// O "voto" (D-04, RF-11) — coletável pooled. Quem posiciona/configura E
// recicla é o SpawnerSystem (a reciclagem fora da tela precisa atualizar o
// ledger de linhas — T07A-03); quem pontua é a GameScene via ScoreSystem.
export class Collectible extends Entity {
  update(): void {
    // ciclo de vida gerido por SpawnerSystem.recycleMissedVotes()
  }
}
