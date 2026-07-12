import { FunctionsFetchError } from '@supabase/supabase-js';
import type { GameEventPayload } from 'game';
import { enqueueScore } from './scoreQueue';
import { ensureSession } from './session';
import { supabase } from './supabase';

export interface SubmittedScore {
  id: string;
  score: number;
  votes: number;
  distance: number;
  stars: number;
  continue_used: boolean;
  world: string;
  created_at: string;
}

// Shape exato do body aceito pela Edge Function submit-score. elapsedSec é
// obrigatório aqui (submitScore só chega a montar o body depois de checar
// que existe); stars/continueUsed/world seguem opcionais — o servidor tem
// defaults pra payloads do app v1 (D-17).
export type ScoreBody = Pick<GameEventPayload, 'score' | 'votes' | 'distance' | 'stars' | 'continueUsed' | 'world'> & {
  elapsedSec: number;
};

// Chamada crua à Edge Function, sem lógica de sessão/retry. Exportada só
// para o drain da fila offline (scoreQueue.ts) reusar — nunca duplicar a
// chamada de invoke em dois lugares (RN-01).
export function postScore(body: ScoreBody) {
  return supabase.functions.invoke<{ data: SubmittedScore }>('submit-score', { body });
}

// D-08: único caminho de escrita em `scores` — chama a Edge Function
// submit-score autenticada com o JWT da sessão anônima. O cliente nunca
// faz INSERT direto (RLS bloqueia; a Edge Function valida e usa service role).
export async function submitScore(payload: GameEventPayload): Promise<SubmittedScore | null> {
  if (payload.elapsedSec === undefined) return null;
  // v2 (D-17): score já vem multiplicado por stars; a Edge Function valida
  // score === (distance + votes×10) × stars e os tetos por mundo (D-16)
  const { score, votes, distance, elapsedSec, stars, continueUsed, world } = payload;
  const body: ScoreBody = { score, votes, distance, elapsedSec, stars, continueUsed, world };

  try {
    await ensureSession();
  } catch (err) {
    console.error('[submitScore] no session available', err);
    return null;
  }

  const { data, error } = await postScore(body);

  if (error) {
    // RN-01: falha de REDE não descarta o score — ele entra na fila local e
    // volta a ser tentado quando a conexão voltar (drainScoreQueue). Rejeição
    // de validação/anti-cheat (FunctionsHttpError, ex.: score_mismatch) segue
    // sem retry — nunca deve ser reenviada.
    if (error instanceof FunctionsFetchError || !navigator.onLine) {
      enqueueScore(body);
      return null;
    }
    console.error('[submitScore] rejected', error);
    return null;
  }
  return data?.data ?? null;
}
