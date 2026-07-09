import type { GameEventPayload } from 'game';
import { ensureSession } from './session';
import { supabase } from './supabase';

export interface SubmittedScore {
  id: string;
  score: number;
  votes: number;
  distance: number;
  created_at: string;
}

// D-08: único caminho de escrita em `scores` — chama a Edge Function
// submit-score autenticada com o JWT da sessão anônima. O cliente nunca
// faz INSERT direto (RLS bloqueia; a Edge Function valida e usa service role).
export async function submitScore(payload: GameEventPayload): Promise<SubmittedScore | null> {
  if (payload.elapsedSec === undefined) return null;
  const { score, votes, distance, elapsedSec } = payload;

  try {
    await ensureSession();
  } catch (err) {
    console.error('[submitScore] no session available', err);
    return null;
  }

  const { data, error } = await supabase.functions.invoke<{ data: SubmittedScore }>(
    'submit-score',
    { body: { score, votes, distance, elapsedSec } },
  );

  if (error) {
    console.error('[submitScore] rejected', error);
    return null;
  }
  return data?.data ?? null;
}
