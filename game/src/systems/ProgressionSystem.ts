import { PROGRESSION, type WorldDef } from '../config/constants';

// Dificuldade progressiva (RF-09) parametrizada POR MUNDO (D-16): cada
// mundo tem sua curva (SP mais suave, Brasília mais dura), todas FIXAS e
// iguais para todos os jogadores (D-10/RN-08). Lógica pura (RN-06).
export class ProgressionSystem {
  private dist = 0;
  private curSpeed: number;
  private stumbleMs = 0; // tropeço pós-impacto (D-31)

  constructor(private speedCfg: WorldDef['speed']) {
    this.curSpeed = speedCfg.START;
  }

  update(delta: number): void {
    if (this.stumbleMs > 0) this.stumbleMs = Math.max(0, this.stumbleMs - delta);
    // integra pelo GETTER (já com o tropeço), não por curSpeed cru.
    //
    // ⚠️ Se `dist` andasse na velocidade cheia enquanto o mundo VISÍVEL
    // desacelera, o spawner e o terreno — que são indexados por `distance` —
    // avançariam à frente do chão desenhado: o terreno deslizaria sob os pés do
    // player e as entidades "montariam" em degraus errados. O tropeço só é
    // coerente se speed e dist saírem da mesma fonte.
    this.dist += (this.speed * delta) / 1000;
    // aquecimento (T07A-05, D-10): rampa linear START → BASE, fixa p/ todos
    if (this.dist < PROGRESSION.WARMUP_DISTANCE) {
      const t = this.dist / PROGRESSION.WARMUP_DISTANCE;
      this.curSpeed = this.speedCfg.START + (this.speedCfg.BASE - this.speedCfg.START) * t;
      return;
    }
    const steps = Math.floor((this.dist - PROGRESSION.WARMUP_DISTANCE) / this.speedCfg.INTERVAL);
    this.curSpeed = Math.min(this.speedCfg.MAX, this.speedCfg.BASE + steps * this.speedCfg.INC);
  }

  // Velocidade EFETIVA do mundo. A curva de dificuldade segue calculada sobre
  // curSpeed cru (inalterada); o tropeço é uma máscara temporária por cima.
  get speed(): number {
    if (this.stumbleMs <= 0) return this.curSpeed;
    const t = this.stumbleMs / PROGRESSION.STUMBLE_MS; // 1 → 0
    return this.curSpeed * (1 - (1 - PROGRESSION.STUMBLE_FACTOR) * t);
  }

  get distance(): number {
    return Math.floor(this.dist);
  }

  // Impacto (D-31): cai para STUMBLE_FACTOR e recupera LINEARMENTE até 1.0 —
  // "levou o golpe e retomou o passo". Como a curva de dificuldade é indexada
  // por `dist`, o tropeço também atrasa de leve o próximo degrau de velocidade:
  // parte do custo.
  stumble(): void {
    this.stumbleMs = PROGRESSION.STUMBLE_MS;
  }

  reset(): void {
    this.dist = 0;
    this.curSpeed = this.speedCfg.START;
    this.stumbleMs = 0;
  }
}
