import { track } from '@vercel/analytics';
import type { GameEventPayload } from 'game';

// Telemetria leve (T07A-05, D-10): entender ONDE e COMO os jogadores morrem
// para calibrar a curva fixa com dados reais — sem tabela nova no banco e
// sem tocar a Edge Function.
//
// Gate por env: sem VITE_ENABLE_ANALYTICS=true, nenhum evento é enviado e o
// script /_vercel/insights nem é injetado (ver main.tsx) — evita 404 no
// console antes de o dono ativar Web Analytics no painel da Vercel.
export const analyticsEnabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';

const RUN_STATS_KEY = 'polity-bros:run-stats';
const MAX_LOCAL_RUNS = 20;

interface LocalRunStat {
  distance: number;
  elapsedSec: number;
  deathCause: string;
}

export function trackRunEnd(payload: GameEventPayload): void {
  saveLocalRun(payload);
  if (!analyticsEnabled) return;
  track('run_end', {
    score: payload.score,
    votes: payload.votes,
    distance: payload.distance,
    elapsed_sec: Math.round(payload.elapsedSec ?? 0),
    death_cause: payload.deathCause ?? 'unknown',
    gems: payload.gems ?? 0,
    continue_used: payload.continueUsed ?? false, // review 7B: calibração
  });
}

// Amostra local das últimas corridas: matéria-prima de calibração (e insumo
// futuro caso o DDA do backlog seja justificado por dados — D-10).
function saveLocalRun(payload: GameEventPayload): void {
  try {
    const raw = localStorage.getItem(RUN_STATS_KEY);
    const runs = raw ? (JSON.parse(raw) as LocalRunStat[]) : [];
    runs.push({
      distance: payload.distance,
      elapsedSec: Math.round(payload.elapsedSec ?? 0),
      deathCause: payload.deathCause ?? 'unknown',
    });
    localStorage.setItem(RUN_STATS_KEY, JSON.stringify(runs.slice(-MAX_LOCAL_RUNS)));
  } catch {
    // storage indisponível: telemetria local é best-effort, o jogo segue
  }
}
