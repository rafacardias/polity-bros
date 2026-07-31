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
  // Coyote time (D-35): graça para pular alguns frames DEPOIS de deixar o chão
  // (borda de degrau D-26, canto do bloco flutuante D-22, queda de frame no
  // celular). Abaixo de 100ms de propósito — acima disso vira "pulo do nada"
  // perceptível. Não abre pulo duplo: startJump() exige velocity.y >= 0 E
  // consome a janela ao pular.
  COYOTE_MS: 90,
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
  // Tropeço pós-impacto (D-31): o custo REAL do escândalo além da barra — o
  // mundo desacelera e recupera o passo. Menos distância percorrida = menos
  // pontos, SEM tocar na fórmula validada pela Edge Function (RN-04): nada é
  // subtraído do score, apenas deixa de ser somado.
  STUMBLE_MS: 420,
  STUMBLE_FACTOR: 0.72,
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

// APROVAÇÃO = a "vida" do candidato (D-31). O contato com o inimigo deixa de
// matar na hora e derruba 1/3 da barra; zerar cai no MESMO fluxo de gameOver()
// de sempre, inclusive a oferta paga de CONTINUE, que restaura a barra cheia.
export const HEALTH = {
  MAX: 3, // 3 impactos por vida; 1 impacto = 1 segmento = 1/3
  // O revive é uma 2ª chance COMPRADA: a pista à frente é limpa e o player
  // precisa de tempo para reentrar no flow sem morrer de novo de graça.
  REVIVE_IFRAME_MS: 1500,
  // Meio-ciclo do pisca. O número de repetições do tween DERIVA da duração da
  // carência (ver blinkPlayer), em vez de ser um literal solto: com 140ms e
  // 1500ms de carência dá repeat 4, exatamente o que estava escrito à mão.
  BLINK_HALF_MS: 140,
  // Carência pós-IMPACTO. Menor que a do revive de propósito: o revive é uma 2ª
  // chance comprada (a pista à frente é LIMPA), o impacto acontece no meio do
  // flow, com a pista intacta.
  HIT_IFRAME_MS: 1100,
  // Feedback do impacto — TODO menor que o da morte (cf. JUICE.SHAKE_*/FLASH_*):
  // a morte tem de continuar sendo o evento mais forte da tela.
  HIT_SHAKE_MS: 120, // morte: 200
  HIT_SHAKE_INTENSITY: 0.008, // morte: 0.012
  HIT_FLASH_MS: 90, // morte: 120
  // Squash mais forte que o do pouso (JUICE.SQUASH_SCALE 0.12) e ainda seguro:
  // o tween roda inteiro DENTRO da carência (ver Player.playHitSquash).
  HIT_SQUASH: 0.18,
  HIT_SQUASH_MS: 130,
  // Empurrão: recua e "recupera o passo" voltando a SCREEN_X por ease-out.
  // Recuar (para a esquerda) afasta das ameaças, que vêm da direita — o
  // empurrão nunca pode criar uma colisão nova.
  KNOCKBACK_PX: 34,
  KNOCKBACK_MS: 220,
  // Recuperação de CONTROLE pós-impacto (D-35). Durante esta janela, o toque com
  // o player NO AR vira intenção de pulo (bufferizada) em vez de descida rápida:
  // quem toma o impacto no ar não tinha caminho de código nenhum para pular até
  // tocar o chão, e morria na sequência de obstáculos.
  // Teto de segurança, derivado do PIOR caso de tempo no ar: levar o impacto na
  // DECOLAGEM de um pulo alto (hold) = ~630ms de subida + ~573ms de queda ≈
  // 1200ms. Dimensionar isto só pela queda (573ms) deixava o jogador atingido na
  // subida sem o pulo justamente no salto mais longo — o caso mais assustador.
  // Na prática quase nunca chega ao fim: a janela FECHA assim que os pés tocam o
  // chão (ver InputSystem.update), porque a partir daí o toque já pula sozinho.
  RECOVERY_INPUT_MS: 1300,
  // HUD: 3ª linha da coluna direita (y 10 → 32 → 54), ancorada na direita como
  // o 🗳️ e o 💵. Segmentos DISCRETOS: lê como "caiu 33%" e como barra ao mesmo
  // tempo. 3×26 + 2×3 = 84px de largura total.
  BAR_Y: 54,
  BAR_SEG_W: 26,
  BAR_SEG_H: 8,
  BAR_SEG_GAP: 3,
  // Cor dos segmentos RESTANTES por nível de aprovação (1/3 · 2/3 · cheia) — o
  // vocabulário de cor do resto do jogo: vermelho do flash de morte, amarelo
  // dos votos, verde da propina.
  BAR_COLORS: [0xef4444, 0xfacc15, 0x4ade80],
  BAR_LOST: 0xef4444, // segmento no instante em que colapsa
  BAR_EMPTY: 0x334155, // slot gasto (ainda legível como "havia 3 casas")
  // Trilha/contorno: garante contraste sobre QUALQUER céu de mundo (SP azul,
  // RJ teal, BSB índigo) — mesmo truque do stroke do distanceText.
  BAR_TRACK: 0x0f172a,
  // Coletável de aprovação (D-31): santinho de campanha em forma de CORAÇÃO.
  // O coração é a única forma que lê como "vida" num sprite de 26px no celular;
  // o santinho amarra na satírica política. Recupera 1 segmento e ZERO
  // votos/pontos — recompensa deliberadamente FORA da fórmula validada pela
  // Edge Function (RN-04), porque a aparição depende da barra do jogador.
  PICKUP_RESTORE: 1,
  PICKUP_W: 26, // arte
  PICKUP_H: 26,
  // hitbox DECLARADA (RN-07), um pouco generosa: a cabeçada tem de perdoar
  // alguns pixels de timing. Nunca herdada da textura.
  PICKUP_BODY_W: 30,
  PICKUP_BODY_H: 30,
  // altura do CENTRO acima do chão local: acima da cabeça em pé (64px) e bem
  // dentro do apex do tap (~90px) → cabeçada estilo Mario, sem exigir o hold
  PICKUP_ABOVE_GROUND: 100,
  PICKUP_CHANCE: 0.3, // sorteio POR slot de ameaça (rng próprio, SEMPRE corre)
  // Piso do espaçamento — nunca dois na tela, mesmo com a barra em 1/3. O
  // espaçamento REAL é derivado do mundo (comprimento ÷ teto+1, ver
  // SpawnerSystem), o que distribui os santinhos ao longo da fase em vez de
  // deixá-los sair todos em sequência logo após o primeiro dano.
  PICKUP_MIN_GAP_PX: 600,
  PICKUP_BURST_COUNT: 12,
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
  // Buffer de pulo (D-35): a intenção de pulo que chega com o player ainda no ar
  // é GUARDADA e cobrada no instante do pouso, em vez de descartada. Casa com
  // SWIPE_CANCEL_WINDOW_MS — é a mesma "unidade de gesto" do projeto (~8 frames).
  // Sem isto, um toque 1-3 frames antes de aterrissar simplesmente evapora, o que
  // no celular real (latência de toque, queda de frame) lê como "não aceita comando".
  JUMP_BUFFER_MS: 140,
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
// quase-brancos). Dificuldade cresce por mundo; a 1ª fase é mais suave que o
// balanceamento antigo (pedido do dono). Trocar o seed = trocar o layout —
// versionar no sufixo ('-v1') para invalidar coleções antigas se preciso.
//
// ⚠️ `id` ≠ `name` (D-30). Os labels seguem a carreira política do D-27
// (interior → cidade grande → capital), mas os ids 'sp'/'rj'/'bsb' são
// CHAVE DE PERSISTÊNCIA e não podem mudar: nomeiam o localStorage
// (polity-bros:best:*, votes-acc:*, gems-collected:*, worlds-unlocked), a
// seed do layout fixo, o CHECK da migration 003 e o WORLD_LENGTH_M da Edge
// Function. Renomear id apagaria recordes e coleções de todo mundo.
// Para exibir o nome de um mundo a partir do id, use worldLabel().
//
// `approvalCap` = teto de santinhos (vida) que podem nascer na fase. Escala
// 1/2/3 acompanhando a distância e a dificuldade: a fase 3 é o dobro da 1 e tem
// o dobro de ameaças, então um teto fixo a tornaria injusta. Antes não havia
// teto nenhum — quem tomava dano cedo via ~10 santinhos na capital, e o item de
// resgate abundante esvazia a tensão da barra de APROVAÇÃO.
export const WORLDS = [
  {
    id: 'sp',
    name: 'Interior',
    lengthM: 600,
    approvalCap: 1,
    seed: 'sp-v1',
    bg: 0x1e293b,
    groundTint: 0xffffff,
    obstacleTint: 0xffffff,
    speed: { START: 210, BASE: 250, INC: 12, INTERVAL: 550, MAX: 380 },
  },
  {
    id: 'rj',
    name: 'Cidade Grande',
    lengthM: 900,
    approvalCap: 2,
    seed: 'rj-v1',
    bg: 0x134e4a,
    groundTint: 0xf5deb3,
    obstacleTint: 0xffe8cc,
    speed: { START: 230, BASE: 270, INC: 15, INTERVAL: 500, MAX: 430 },
  },
  {
    id: 'bsb',
    name: 'Capital',
    lengthM: 1200,
    approvalCap: 3,
    seed: 'bsb-v1',
    bg: 0x312e81,
    groundTint: 0xc7d2fe,
    obstacleTint: 0xe4e4ff,
    speed: { START: 240, BASE: 290, INC: 16, INTERVAL: 480, MAX: 460 },
  },
] as const;
export type WorldDef = (typeof WORLDS)[number];

// Nome exibível de um mundo a partir do id persistido (ranking, share, spotlight).
// Antes esses lugares faziam `world.toUpperCase()` e mostravam o id cru ("SP",
// "RJ", "BSB") — o jogador via a sigla técnica em vez do nome da fase. Id
// desconhecido (score antigo, mundo removido) cai no próprio id em maiúsculas,
// que é feio mas nunca fica vazio.
export function worldLabel(id: string | null | undefined): string {
  const world = WORLDS.find((w) => w.id === id);
  return world ? world.name : String(id ?? '').toUpperCase();
}

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

// Terreno em degraus (D-26, milestone Inimigos & Terreno §4.1): o chão deixa de
// ser plano. Um "campo de altura" (height field) de segmentos em coordenada de
// MUNDO rola com o cenário; o ÚNICO ponto que importa para a física é a altura
// sob o player (X fixo), então um CORPO-CHÃO invisível e imóvel posicionado
// nessa altura faz o player pousar/pular NATIVAMENTE (onGround via touching.down)
// e SUBIR degraus por separação de corpos — sem tocar na física de pulo já
// calibrada (RN-IT3). Degraus NUNCA matam (§7-A "auto-climb suave"): quando o
// degrau sobe, o corpo-chão empurra o player para cima a CLIMB_RATE px/frame
// (subida visível, sem punição); descer é queda natural pela gravidade.
export const TERRAIN = {
  STEP_H: 40, // altura de 1 nível de degrau (px) — subível de pulo com folga
  MAX_LEVEL: 2, // níveis acima da base (0..2); "parede alta" = 2 níveis (80px)
  SEG_MIN: 240, // comprimento mín. de um segmento plano (px) — dá pé pra ler/pular
  SEG_MAX: 520, // comprimento máx. de um segmento plano (px)
  CLIMB_RATE: 12, // px/frame de auto-subida (suave, §7-A) — sobe rápido mas visível
  FLOOR_W: 140, // largura do corpo-chão invisível sob o player (X fixo)
  WARMUP_FLAT_PX: 720, // largada plana: respiro/onboarding antes do 1º degrau (par do WARMUP)
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
