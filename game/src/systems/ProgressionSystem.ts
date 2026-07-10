import { PROGRESSION, type WorldDef } from '../config/constants';

// Dificuldade progressiva (RF-09) parametrizada POR MUNDO (D-16): cada
// mundo tem sua curva (SP mais suave, Brasília mais dura), todas FIXAS e
// iguais para todos os jogadores (D-10/RN-08). Lógica pura (RN-06).
export class ProgressionSystem {
  private dist = 0;
  private curSpeed: number;

  constructor(private speedCfg: WorldDef['speed']) {
    this.curSpeed = speedCfg.START;
  }

  update(delta: number): void {
    this.dist += (this.curSpeed * delta) / 1000;
    // aquecimento (T07A-05, D-10): rampa linear START → BASE, fixa p/ todos
    if (this.dist < PROGRESSION.WARMUP_DISTANCE) {
      const t = this.dist / PROGRESSION.WARMUP_DISTANCE;
      this.curSpeed = this.speedCfg.START + (this.speedCfg.BASE - this.speedCfg.START) * t;
      return;
    }
    const steps = Math.floor((this.dist - PROGRESSION.WARMUP_DISTANCE) / this.speedCfg.INTERVAL);
    this.curSpeed = Math.min(this.speedCfg.MAX, this.speedCfg.BASE + steps * this.speedCfg.INC);
  }

  get speed(): number {
    return this.curSpeed;
  }

  get distance(): number {
    return Math.floor(this.dist);
  }

  reset(): void {
    this.dist = 0;
    this.curSpeed = this.speedCfg.START;
  }
}
