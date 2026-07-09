import { supabase } from './supabase';

export interface RankingEntry {
  score: number;
  votes: number;
  distance: number;
  created_at: string;
}

// RF-13: leitura pública do Top 10 — RLS permite select sem autenticação.
export async function fetchTopScores(limit = 10): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('score, votes, distance, created_at')
    .eq('game_id', 'polity-bros')
    .order('score', { ascending: false })
    .limit(limit)
    .returns<RankingEntry[]>();

  if (error) {
    console.error('[fetchTopScores] failed', error);
    return [];
  }
  return data;
}
