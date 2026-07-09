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
// Tetos de plausibilidade (RN-04): generosos acima do limite físico do jogo
// (speed máx 460px/s = 46m/s; throughput máx de votos do spawner ~10.5/s).
const MAX_DISTANCE_M_PER_SEC = 50;
const MAX_VOTES_PER_SEC = 15;
// Rate limit por player_id (RN-04).
const MIN_SUBMIT_INTERVAL_SEC = 2;
const MAX_SUBMITS_PER_WINDOW = 30;
const WINDOW_MINUTES = 10;

interface ScorePayload {
  score: number;
  votes: number;
  distance: number;
  elapsedSec: number;
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isValidPayload(body: unknown): body is ScorePayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    isNonNegInt(b.score) &&
    isNonNegInt(b.votes) &&
    isNonNegInt(b.distance) &&
    typeof b.elapsedSec === "number" &&
    Number.isFinite(b.elapsedSec) &&
    b.elapsedSec > 0
  );
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

  if (!isValidPayload(body)) {
    return json({ error: "invalid_payload" }, 400);
  }
  const { score, votes, distance, elapsedSec } = body;

  // consistência com a fórmula de ScoreSystem.getSnapshot()
  if (score !== distance + votes * VOTE_POINTS) {
    return json({ error: "score_mismatch" }, 400);
  }

  if (
    distance > elapsedSec * MAX_DISTANCE_M_PER_SEC ||
    votes > elapsedSec * MAX_VOTES_PER_SEC
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
    .insert({ player_id: playerId, game_id: GAME_ID, score, votes, distance })
    .select("id, score, votes, distance, created_at")
    .single();

  if (insertError) {
    return json({ error: "insert_failed" }, 500);
  }

  return json({ data: inserted }, 201);
}

export default {
  fetch: withSupabase<Database>({ auth: "user" }, submitScore),
};
