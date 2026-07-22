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
  // subindo linearmente até a BASE do mundo em WARMUP_DISTANCE px (~3s).
  // As curvas de velocidade em si vivem POR MUNDO em WORLDS (D-16).
  WARMUP_DISTANCE: 700,
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
  // D-23: o marcador de recorde é a skin do player em 10% de opacidade —
  // "você de ontem" parado na pista. Subir se ficar ilegível numa paleta.
  RECORD_GHOST_ALPHA: 0.1,
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

// Economia de gemas (T07B-02/03, D-11): recompensa RARA de alto risco.
// 2 janelas de spawn por partida — a gema nasce no 1º obstáculo após um
// ponto sorteado dentro da janela ("talvez agora venha algo raro").
export const ECONOMY = {
  // Gemas em BARRAS FLUTUANTES (D-18): posições como FRAÇÃO do comprimento
  // do mundo (1ª cedo e fácil — educa a mecânica; 2ª no último terço).
  // A barra substitui um slot de obstáculo — gema nunca nasce impossível.
  GEM_POSITIONS_FRAC: [0.2, 0.65],
  CONTINUE_COST: 3, // gemas para continuar de onde morreu (1x por partida)
  CONTINUE_OFFER_SEC: 4, // janela da oferta de continue no game over
} as const;

// Bloco flutuante (D-18, D-22): PLATAFORMA-OBSTÁCULO divisor de rota —
// propina EM CIMA (pulo alto + pouso no bloco), votos EMBAIXO (rota segura,
// coletados correndo por baixo, sem pular). Pousar em cima é seguro; bater
// nas LATERAIS ou no FUNDO mata (mesma regra dos obstáculos verticais).
export const GEM_BAR = {
  WIDTH: 120,
  HEIGHT: 24, // espesso como obstáculo (D-22) — leitura de "bloco sólido"
  BAR_ABOVE_GROUND: 104, // base do bloco: player (64px) passa por baixo com folga
  GEM_ABOVE_BAR: 42, // propina flutua sobre o topo (~170px do chão; apex ≈ 230)
  VOTES_BELOW_GROUND_H: 46, // linha de votos sob o bloco (na altura do corpo)
} as const;

// Mundos/fases da campanha (D-16, supersede D-14): cada cidade é um MUNDO
// selecionável com FIM e layout FIXO (semente). Paleta = tema do mundo —
// silhueta/hitbox dos obstáculos seguem sagradas (SIZES congelado; tints
// quase-brancos). Dificuldade cresce por mundo; SP é mais suave que o
// balanceamento antigo (pedido do dono). Trocar o seed = trocar o layout —
// versionar no sufixo ('-v1') para invalidar coleções antigas se preciso.
export const WORLDS = [
  {
    id: 'sp',
    name: 'São Paulo',
    lengthM: 600,
    seed: 'sp-v1',
    bg: 0x1e293b,
    groundTint: 0xffffff,
    obstacleTint: 0xffffff,
    speed: { START: 210, BASE: 250, INC: 12, INTERVAL: 550, MAX: 380 },
  },
  {
    id: 'rj',
    name: 'Rio de Janeiro',
    lengthM: 900,
    seed: 'rj-v1',
    bg: 0x134e4a,
    groundTint: 0xf5deb3,
    obstacleTint: 0xffe8cc,
    speed: { START: 230, BASE: 270, INC: 15, INTERVAL: 500, MAX: 430 },
  },
  {
    id: 'bsb',
    name: 'Brasília',
    lengthM: 1200,
    seed: 'bsb-v1',
    bg: 0x312e81,
    groundTint: 0xc7d2fe,
    obstacleTint: 0xe4e4ff,
    speed: { START: 240, BASE: 290, INC: 16, INTERVAL: 480, MAX: 460 },
  },
] as const;
export type WorldDef = (typeof WORLDS)[number];

// Inimigos (D-25, milestone Inimigos & Terreno): personagem que ANDA na direção
// do player (mais rápido que o scroll → "vem pra cima"). Pisar em cima (stomp) =
// votos com combo simples; contato lateral/frontal = morte. Substitui parte dos
// slots de obstáculo 'high' (§7-E) — os 'low' seguem para preservar o slide.
export const ENEMY = {
  W: 40, // hitbox (arte real vem depois — RN-07: trocam de arte, não de tamanho)
  H: 60,
  WALK_SPEED: 70, // somado ao scroll do mundo = velocidade de aproximação
  STOMP_BOUNCE: -380, // quica ao pisar (menor que o pulo normal, PHYSICS.JUMP_VELOCITY)
  STOMP_VOTES: 3, // votos-base por stomp
  STOMP_COMBO_BONUS: 2, // cada stomp encadeado NO AR soma +2 votos (combo — §7-F)
  HIGH_SLOT_CHANCE: 0.6, // fração dos slots de obstáculo 'high' que viram inimigo
} as const;

// 2º inimigo (D-25): CÂMERA de imprensa VOADORA — ameaça "lá no alto" que o
// player DESLIZA por baixo (dá uso defensivo ao agachar). Ocupa parte dos slots
// de obstáculo 'low' (§9-6). Não stompável: qualquer contato mata (o dodge é
// geométrico — a hitbox agachada passa por baixo). Aproxima na mesma velocidade
// do repórter (reusa ENEMY.WALK_SPEED no spawn/sync).
export const CAMERA = {
  W: 44, // hitbox (arte pode exceder — RN-07)
  H: 40,
  // base da hitbox acima do chão — MESMO valor do obstacle-low (slide-under já
  // calibrado): a hitbox agachada (32px) passa por baixo, a em pé (64px) bate.
  CLEARANCE: 44,
  LOW_SLOT_CHANCE: 0.5, // fração dos slots 'low' que viram câmera (resto = obstacle-low)
} as const;

// reta final limpa: os últimos metros antes da linha de chegada não têm
// obstáculos — a vitória se CELEBRA, não se rouba no último frame
export const FINISH_CLEAR_M = 60;

// Dimensões dos placeholders/hitboxes (RN-07 — trocam de arte, não de tamanho)
export const SIZES = {
  PLAYER: { W: 44, H: 64, SLIDE_H: 32, SCREEN_X: 100 },
  OBSTACLE_HIGH: { W: 44, H: 72 }, // no chão — pular por cima
  OBSTACLE_LOW: { W: 44, H: 160, CLEARANCE: 44 }, // suspenso — só passa deslizando
  GROUND_H: 12,
} as const;
