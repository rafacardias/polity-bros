// Valores de balanceamento centralizados (design.md §5).
// Ajustes de "game feel" acontecem AQUI, nunca espalhados pelo código.

export const PHYSICS = {
  GRAVITY: 1400,
  RUN_SPEED: 260,
  JUMP_VELOCITY: -520,
  JUMP_HOLD_FORCE: 28, // aplicado por frame enquanto segura (pulo variável)
  JUMP_CUT: -420, // corta o pulo ao soltar cedo (pulo curto)
  // calibrado por medição E2E: tap ≈ 90px de apex (passa o obstáculo alto de
  // 72px com margem justa); segurar ≈ 230px (rotas de risco/recompensa RF-11)
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
  // Gesto touch (RN-02/RN-08): o toque no chão pula IMEDIATAMENTE (mesmo
  // timing do teclado — paridade exata). Se o dedo descer SWIPE_INTENT_PX
  // dentro da janela de cancelamento, a intenção real era deslizar: o pulo
  // nascente (1-2 frames) é abortado e vira slide na hora. Sem isso, swipe
  // no Safari virava "pula no touchstart, desliza no touchend".
  SWIPE_CANCEL_WINDOW_MS: 140, // janela p/ swipe converter o pulo em slide
  SWIPE_INTENT_PX: 14, // deslocamento ↓ que caracteriza swipe (tap desleixado fica bem abaixo)
  SLIDE_MS: 550, // duração do slide após soltar o dedo (swipe/flick)
} as const;

// Dimensões dos placeholders/hitboxes (RN-07 — trocam de arte, não de tamanho)
export const SIZES = {
  PLAYER: { W: 44, H: 64, SLIDE_H: 32, SCREEN_X: 100 },
  OBSTACLE_HIGH: { W: 44, H: 72 }, // no chão — pular por cima
  OBSTACLE_LOW: { W: 44, H: 160, CLEARANCE: 44 }, // suspenso — só passa deslizando
  GROUND_H: 12,
} as const;
