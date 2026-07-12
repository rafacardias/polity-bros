import { ensureSession } from './session';
import { supabase } from './supabase';

// T07D-02: mesma regra do banco (supabase/migrations/005_profiles.sql, check
// constraint em `username`) — validar no cliente evita round-trip pra erro óbvio.
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

export interface OwnProfile {
  username: string;
}

export type SaveUsernameResult = { ok: true } | { ok: false; reason: 'invalid' | 'taken' | 'error' };

// Busca o perfil do jogador logado (sessão anônima). Retorna null se ainda
// não escolheu um nome — RankingScreen usa isso pra decidir "definir nome".
export async function fetchOwnProfile(): Promise<OwnProfile | null> {
  const session = await ensureSession();

  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('player_id', session.user.id)
    .maybeSingle<OwnProfile>();

  if (error) {
    console.error('[fetchOwnProfile] failed', error);
    return null;
  }
  return data;
}

// Cria/atualiza o username do dono da sessão. Upsert por player_id (RLS só
// permite insert/update do próprio auth.uid(), então não há como forjar outro).
export async function saveUsername(username: string): Promise<SaveUsernameResult> {
  if (!USERNAME_RE.test(username)) {
    return { ok: false, reason: 'invalid' };
  }

  const session = await ensureSession();

  const { error } = await supabase
    .from('profiles')
    .upsert({ player_id: session.user.id, username }, { onConflict: 'player_id' });

  if (error) {
    // 23505 = unique violation no índice case-insensitive de username (nome já em uso).
    if (error.code === '23505') {
      return { ok: false, reason: 'taken' };
    }
    console.error('[saveUsername] failed', error);
    return { ok: false, reason: 'error' };
  }
  return { ok: true };
}
