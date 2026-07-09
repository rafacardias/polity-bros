import { PROGRESSION } from '../config/constants';

// Dificuldade progressiva (RF-09): a velocidade do mundo sobe em degraus a
// cada SPEED_INTERVAL px percorridos, até SPEED_MAX. Lógica pura (RN-06).
export class ProgressionSystem {
  private dist = 0;
  private curSpeed: number = PROGRESSION.SPEED_START;

  update(delta: number): void {
    this.dist += (this.curSpeed * delta) / 1000;
    // aquecimento (T07A-05, D-10): rampa linear SPEED_START → SPEED_BASE,
    // FIXA e igual pra todos; degraus só começam após o aquecimento
    if (this.dist < PROGRESSION.WARMUP_DISTANCE) {
      const t = this.dist / PROGRESSION.WARMUP_DISTANCE;
      this.curSpeed =
        PROGRESSION.SPEED_START + (PROGRESSION.SPEED_BASE - PROGRESSION.SPEED_START) * t;
      return;
    }
    const steps = Math.floor((this.dist - PROGRESSION.WARMUP_DISTANCE) / PROGRESSION.SPEED_INTERVAL);
    this.curSpeed = Math.min(
      PROGRESSION.SPEED_MAX,
      PROGRESSION.SPEED_BASE + steps * PROGRESSION.SPEED_INC,
    );
  }

  get speed(): number {
    return this.curSpeed;
  }

  get distance(): number {
    return Math.floor(this.dist);
  }

  reset(): void {
    this.dist = 0;
    this.curSpeed = PROGRESSION.SPEED_START;
  }
}
