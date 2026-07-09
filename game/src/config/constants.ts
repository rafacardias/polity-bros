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
  FIRST_GAP: 560, // 1º obstáculo mais longe: respiro pro novato ler os controles
  GAP_BASE: 420,
  GAP_MIN: 220,
  GAP_TIGHTEN: 0.02,
  VOTE_LINE_CHANCE: 0.4, // linha de risco/recompensa junto ao obstáculo (RF-11)
  EASY_VOTE_CHANCE: 0.35, // linha fácil no meio do vão entre obstáculos
  VOTE_COUNT: 3, // votos por linha
  VOTE_SPACING: 30, // espaçamento horizontal entre votos
  VOTE_RISK_HEIGHT: 90, // altura da linha de risco acima da BASE do obstáculo
  VOTE_EASY_HEIGHT: 46, // altura da linha fácil acima do chão (pede pulinho)
} as const;

export const PROGRESSION = {
  // Aquecimento FIXO e igual pra todos (T07A-05, D-10): largada mais lenta
  // subindo linearmente até SPEED_BASE em WARMUP_DISTANCE px (~3s). Depois,
  // degraus normais. Nada disso é adaptativo — fairness do ranking (RN-08).
  SPEED_START: 220,
  WARMUP_DISTANCE: 700,
  SPEED_BASE: 260,
  SPEED_INC: 15,
  SPEED_INTERVAL: 500,
  SPEED_MAX: 460,
} as const;

export const SCORE = {
  VOTE_POINTS: 10, // pontos por voto coletado (RF-11)
  PX_PER_M: 10, // conversão px → "metros" exibidos/pontuados (RF-08)
  // Bônus por linha COMPLETA de votos (T07A-03), concedido EM VOTOS: a Edge
  // Function valida score === distance + votes × VOTE_POINTS (RN-04) — pontos
  // fora dessa fórmula seriam rejeitados como trapaça.
  LINE_BONUS_VOTES: 2,
} as const;

export const AUDIO = {
  SFX_VOLUME: 0.5,
  MUSIC_VOLUME: 0.4,
} as const;

// Game feel (T07A-02, D-09). Amplitudes de squash/stretch são pequenas e
// curtas de propósito: o corpo físico do Arcade acompanha a escala do sprite,
// então valores altos distorceriam a hitbox percebida (fairness > estética).
export const JUICE = {
  VOTE_BURST_COUNT: 8, // partículas por voto coletado
  VOTE_BURST_LIFESPAN_MS: 350,
  SHAKE_DURATION_MS: 200, // screen shake na morte
  SHAKE_INTENSITY: 0.012,
  FLASH_DURATION_MS: 120, // flash vermelho na morte
  SQUASH_SCALE: 0.12, // ±12% por ~90ms no pulo/aterrissagem
  SQUASH_DURATION_MS: 90,
  FADE_IN_MS: 200, // transição de entrada da GameScene
  COMBO_BURST_COUNT: 20, // explosão maior no momento "uau" (T07A-03)
  COMBO_TEXT_MS: 750, // duração do texto flutuante "LINHA PERFEITA!"
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
