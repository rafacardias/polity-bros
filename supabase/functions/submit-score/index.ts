// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { Database } from "./database.types.ts";

// D-08: caminho ÚNICO de escrita em `scores`. O cliente nunca faz INSERT
// direto (RLS não tem policy de escrita) — só esta função, com service role,
// grava depois de validar. player_id vem do JWT (ctx.userClaims), nunca do
// corpo da requisição — impede um jogador gravar em nome de outro.

const GAME_ID = "polity-bros";
const VOTE_POINTS = 10; // SCORE.VOTE_POINTS em game/src/config/constants.ts
// Tetos de plausibilidade (RN-04): generosos acima do limite físico do jogo.
// Distância: speed máx 460px/s = 46m/s. Votos: pior caso físico pós-7A é
// 10 votos/obstáculo (2 linhas × 3 coletados + 2×2 de bônus LINE_BONUS_VOTES,
// T07A-03) × ~2.09 obstáculos/s no pico ≈ 20.9/s — teto em 25 mantém o
// invariante "nenhum payload legítimo é rejeitado" com folga.
const MAX_DISTANCE_M_PER_SEC = 50;
const MAX_VOTES_PER_SEC = 25;
// Anti-cheat robusto (RN-04): votos são espaçados por DISTÂNCIA, não por
// tempo — atrelar o teto de votos só a elapsedSec (que o cliente controla e
// não tinha limite superior) deixava forjar votos infinitos. Gap mínimo de
// obstáculo = 22m (GAP_MIN 220px ÷ PX_PER_M 10) com pior caso ~10 votos/
// obstáculo ⇒ ~0.45 votos/m no pico; teto 0.75/m + base fixa dá folga larga
// sobre qualquer run legítima sem deixar o número escapar da distância real.
const MAX_VOTES_PER_M = 0.75;
const MAX_VOTES_BASE = 20; // folga p/ bônus de linha em runs muito curtas
// Teto absoluto de tempo: a run mais longa plausível (bsb 1200m na velocidade
// mínima ~21m/s ≈ 57s) nem chega perto — corta elapsedSec forjado que descola
// os limites físicos acima.
const MAX_ELAPSED_SEC = 300;
// Mundos com FIM (D-16): distância nunca passa do comprimento da fase
// (folga de 5m para o frame de cruzamento). Espelha WORLDS em constants.ts.
const WORLD_LENGTH_M: Record<string, number> = { sp: 600, rj: 900, bsb: 1200 };
const WORLD_LENGTH_SLACK_M = 5;
// Sem modo infinito na v1.0 (D-16): nenhuma run legítima passa do maior
// mundo — vale como teto absoluto de distância inclusive p/ payloads v1
// (sem world declarado), fechando o furo de distância ilimitada.
const MAX_DISTANCE_M = 1200 + WORLD_LENGTH_SLACK_M;
// Rate limit por player_id (RN-04).
const MIN_SUBMIT_INTERVAL_SEC = 2;
const MAX_SUBMITS_PER_WINDOW = 30;
const WINDOW_MINUTES = 10;

// v2 (D-17): stars/continueUsed/world são OPCIONAIS com default — o app v1
// em produção (que não os envia) continua aceito durante a transição.
interface ScorePayload {
  score: number;
  votes: number;
  distance: number;
  elapsedSec: number;
  stars: number; // 1..3 — score deve ser (distance + votes×10) × stars
  continueUsed: boolean; // selo "🏅 sem continue" no ranking (D-17)
  world: string; // 'sp' | 'rj' | 'bsb' (D-16)
  // false = payload do app v1 (sem mundos): tetos por fase não se aplicam —
  // o app antigo tem corridas legitimamente mais longas que 600m
  worldProvided: boolean;
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function parsePayload(body: unknown): ScorePayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const base =
    isNonNegInt(b.score) &&
    isNonNegInt(b.votes) &&
    isNonNegInt(b.distance) &&
    typeof b.elapsedSec === "number" &&
    Number.isFinite(b.elapsedSec) &&
    b.elapsedSec > 0;
  if (!base) return null;

  const stars = b.stars === undefined ? 1 : b.stars;
  if (!isNonNegInt(stars) || stars < 1 || stars > 3) return null;
  const continueUsed = b.continueUsed === undefined ? false : b.continueUsed;
  if (typeof continueUsed !== "boolean") return null;
  const worldProvided = b.world !== undefined;
  const world = worldProvided ? b.world : "sp";
  if (typeof world !== "string" || !(world in WORLD_LENGTH_M)) return null;
  // stars > 1 sem declarar o mundo = payload forjado tentando escapar do
  // teto "só quem cruza a linha multiplica" — rejeitar na entrada
  if (stars > 1 && !worldProvided) return null;

  return {
    score: b.score as number,
    votes: b.votes as number,
    distance: b.distance as number,
    elapsedSec: b.elapsedSec as number,
    stars,
    continueUsed,
    world,
    worldProvided,
  };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

// withSupabase cuida do preflight CORS e injeta os headers na resposta —
// auth:"user" exige verify_jwt=true (config.toml) e valida o JWT anônimo
// antes do handler rodar.
async function submitScore(req: Request, ctx: import("@supabase/server").SupabaseContext<Database>) {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const playerId = ctx.userClaims?.id;
  if (!playerId) {
    return json({ error: "invalid_session" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const payload = parsePayload(body);
  if (!payload) {
    return json({ error: "invalid_payload" }, 400);
  }
  const { score, votes, distance, elapsedSec, stars, continueUsed, world, worldProvided } =
    payload;

  // fórmula v2 (D-17): score final = base × estrelas. Com stars=1 (app v1 ou
  // morte) degrada para a fórmula original — retrocompatível.
  if (score !== (distance + votes * VOTE_POINTS) * stars) {
    return json({ error: "score_mismatch" }, 400);
  }

  // teto por mundo (D-16), só para payloads v2 (worldProvided): distância
  // limitada ao comprimento da fase; e 2-3 estrelas EXIGEM ter cruzado a
  // linha (distance == comprimento da fase). A completude de coletáveis da
  // 3ª estrela não é verificável no servidor (estado do cliente) — risco
  // aceito e documentado (D-17); os demais tetos limitam o dano.
  if (worldProvided) {
    const lengthM = WORLD_LENGTH_M[world];
    if (distance > lengthM + WORLD_LENGTH_SLACK_M) {
      return json({ error: "implausible_score" }, 400);
    }
    if (stars > 1 && distance < lengthM) {
      return json({ error: "implausible_score" }, 400);
    }
  }

  // teto absoluto de tempo e distância — barram payloads forjados (ex.:
  // elapsedSec astronômico p/ inflar os limites por segundo) e cobrem também
  // o caminho v1 sem world declarado, onde os tetos por mundo não rodam.
  if (elapsedSec > MAX_ELAPSED_SEC || distance > MAX_DISTANCE_M) {
    return json({ error: "implausible_score" }, 400);
  }

  // votos limitados por DISTÂNCIA (robusto: distance é capada acima) E por
  // tempo — defesa em profundidade. A base fixa evita falso-positivo em runs
  // curtas (bônus de linha logo no 1º obstáculo).
  if (
    distance > elapsedSec * MAX_DISTANCE_M_PER_SEC ||
    votes > elapsedSec * MAX_VOTES_PER_SEC ||
    votes > distance * MAX_VOTES_PER_M + MAX_VOTES_BASE
  ) {
    return json({ error: "implausible_score" }, 400);
  }

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { data: recent, error: recentError } = await ctx.supabaseAdmin
    .from("scores")
    .select("created_at")
    .eq("player_id", playerId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (recentError) {
    return json({ error: "internal_error" }, 500);
  }
  if (recent.length > 0) {
    const sinceLastMs = Date.now() - new Date(recent[0].created_at).getTime();
    if (sinceLastMs < MIN_SUBMIT_INTERVAL_SEC * 1000) {
      return json({ error: "rate_limited" }, 429);
    }
  }
  if (recent.length >= MAX_SUBMITS_PER_WINDOW) {
    return json({ error: "rate_limited" }, 429);
  }

  const { data: inserted, error: insertError } = await ctx.supabaseAdmin
    .from("scores")
    .insert({
      player_id: playerId,
      game_id: GAME_ID,
      score,
      votes,
      distance,
      stars,
      continue_used: continueUsed,
      world,
    })
    .select("id, score, votes, distance, stars, continue_used, world, created_at")
    .single();

  if (insertError) {
    return json({ error: "insert_failed" }, 500);
  }

  return json({ data: inserted }, 201);
}

export default {
  fetch: withSupabase<Database>({ auth: "user" }, submitScore),
};
