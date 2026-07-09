import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Garante uma sessão anônima ativa (RF-14). supabase-js persiste a sessão em
// localStorage, então sign-in só roda na primeira visita do dispositivo.
export async function ensureSession(): Promise<Session> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session!;
}
