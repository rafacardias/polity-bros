import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail fast (CLAUDE.md): sem fallback silencioso para secrets ausentes.
if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Cliente único, só com a anon key (D-08) — a service role NUNCA entra aqui.
export const supabase = createClient(url, anonKey);
