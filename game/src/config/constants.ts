// Valores de balanceamento centralizados (design.md §5).
// Ajustes de "game feel" acontecem AQUI, nunca espalhados pelo código.

export const PHYSICS = {
  GRAVITY: 1400,
  RUN_SPEED: 260,
  JUMP_VELOCITY: -520,
  JUMP_HOLD_FORCE: 28, // aplicado por frame enquanto segura (pulo variável)
  JUMP_CUT: -180, // corta o pulo ao soltar cedo (pulo curto)
  FAST_FALL: 700,
  MAX_FALL_SPEED: 900,
} as const;

export const SPAWN = {
  GAP_BASE: 420,
  GAP_MIN: 220,
  GAP_TIGHTEN: 0.02,
  VOTE_LINE_CHANCE: 0.4,
} as const;

export const PROGRESSION = {
  SPEED_BASE: 260,
  SPEED_INC: 15,
  SPEED_INTERVAL: 500,
  SPEED_MAX: 460,
} as const;

export const INPUT = {
  HOLD_MAX_MS: 220, // janela do pulo variável (RF-05)
  SWIPE_DOWN_PX: 40, // limiar de swipe ↓ para slide (mobile)
  SLIDE_MS: 550, // duração do slide disparado por swipe (dedo já soltou)
} as const;

// Dimensões dos placeholders/hitboxes (RN-07 — trocam de arte, não de tamanho)
export const SIZES = {
  PLAYER: { W: 44, H: 64, SLIDE_H: 32, SCREEN_X: 100 },
  OBSTACLE_HIGH: { W: 44, H: 72 }, // no chão — pular por cima
  OBSTACLE_LOW: { W: 44, H: 160, CLEARANCE: 44 }, // suspenso — só passa deslizando
  GROUND_H: 12,
} as const;
