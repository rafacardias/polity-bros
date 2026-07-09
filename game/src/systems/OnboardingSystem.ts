const ONBOARDED_STORAGE_KEY = 'polity-bros:onboarded';

// Micro-onboarding de primeira partida (T07A-06, RF-15): flag local que
// garante que o hint de controles aparece UMA vez por aparelho. A UI do
// hint vive na GameScene; aqui só a persistência da decisão.
export class OnboardingSystem {
  static isDone(): boolean {
    try {
      return localStorage.getItem(ONBOARDED_STORAGE_KEY) === 'true';
    } catch {
      // storage bloqueado: melhor mostrar o hint (ensinar > repetir)
      return false;
    }
  }

  static markDone(): void {
    try {
      localStorage.setItem(ONBOARDED_STORAGE_KEY, 'true');
    } catch {
      // sem storage o hint volta na próxima partida — aceitável
    }
  }
}
