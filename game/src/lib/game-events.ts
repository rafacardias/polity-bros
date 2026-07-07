// Fonte ÚNICA do contrato de eventos React ↔ Phaser (design.md §6, D-05).
// O /web importa tudo daqui via pacote 'game' — nunca duplicar estas strings.

export const GAME_EVENTS = {
  SCORE: 'game:score',
  GAME_OVER: 'game:gameover',
} as const;

export const SHELL_EVENTS = {
  PLAY: 'menu:play',
  RESTART: 'menu:restart',
} as const;

// Payload dos eventos Phaser → React (game:score, game:gameover)
export interface GameEventPayload {
  score: number;
  votes: number;
  distance: number;
}

export function emitGameEvent(evt: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(evt, { detail }));
}

export function onGameEvent<T = unknown>(evt: string, cb: (detail: T) => void): () => void {
  const handler = (e: Event): void => cb((e as CustomEvent).detail as T);
  window.addEventListener(evt, handler);
  return () => window.removeEventListener(evt, handler);
}
