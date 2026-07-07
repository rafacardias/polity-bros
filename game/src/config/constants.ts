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
