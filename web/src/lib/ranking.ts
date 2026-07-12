import { supabase } from './supabase';

export interface RankingEntry {
  player_id: string;
  username: string | null;
  score: number;
  votes: number;
  distance: number;
  stars: number;
  continue_used: boolean;
  world: string;
  created_at: string;
}

interface ScoreRow {
  player_id: string;
  score: number;
  votes: number;
  distance: number;
  stars: number;
  continue_used: boolean;
  world: string;
  created_at: string;
}

// RF-13: leitura pública do Top 10 — RLS permite select sem autenticação.
// T07D-02: username vem de `profiles` numa segunda query (não um join),
// porque scores/profiles são tabelas independentes sem FK declarada entre
// si — evita N+1 buscando todos os ids do Top 10 de uma vez só.
export async function fetchTopScores(limit = 10): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('player_id, score, votes, distance, stars, continue_used, world, created_at')
    .eq('game_id', 'polity-bros')
    .order('score', { ascending: false })
    .limit(limit)
    .returns<ScoreRow[]>();

  if (error) {
    console.error('[fetchTopScores] failed', error);
    return [];
  }

  const playerIds = [...new Set(data.map((row) => row.player_id))];
  const usernameByPlayerId = new Map<string, string>();

  if (playerIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('player_id, username')
      .in('player_id', playerIds)
      .returns<{ player_id: string; username: string }[]>();

    if (profilesError) {
      // Falha ao buscar nomes não deve derrubar o ranking — segue com "Anônimo".
      console.error('[fetchTopScores] profiles lookup failed', profilesError);
    } else {
      for (const profile of profiles) {
        usernameByPlayerId.set(profile.player_id, profile.username);
      }
    }
  }

  return data.map((row) => ({
    ...row,
    username: usernameByPlayerId.get(row.player_id) ?? null,
  }));
}
