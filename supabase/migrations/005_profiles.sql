-- supabase/migrations/005_profiles.sql
-- T07D-02 / RN-04: perfil público (username) para exibição no ranking.
-- 1 linha por usuário (player_id é a própria PK) — cada jogador tem um único
-- nome de exibição, trocável, sujeito a rate-limit no cliente/UX (fora do
-- banco, RN-04 item 4).
create table if not exists public.profiles (
  player_id  uuid primary key references auth.users(id) on delete cascade,
  -- 3–16 chars, apenas [a-zA-Z0-9_]: evita nomes vazios/gigantes no ranking
  -- e, por restringir o charset, elimina de saída qualquer vetor de XSS ou
  -- "poluição visual" (emojis, RTL override, espaços zero-width etc.).
  username   text not null check (username ~ '^[a-zA-Z0-9_]{3,16}$'),
  updated_at timestamptz not null default now()
);

-- Unicidade case-insensitive: "Lula" e "lula" são o mesmo nome pro ranking
-- (evita impersonation e confusão visual entre jogadores).
create unique index if not exists idx_profiles_username_lower
  on public.profiles (lower(username));

-- Mantém updated_at correto a cada troca de nome, sem depender do cliente
-- mandar o valor certo (fail-safe contra client bug/clock skew).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''  -- hardening: search_path fixo (advisor do Supabase)
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Leitura pública: o ranking precisa exibir o nome de qualquer jogador,
-- inclusive para visitantes não autenticados (anon key).
create policy "profiles are public read" on public.profiles
  for select using (true);

-- Escrita restrita ao dono do próprio perfil — sem validação server-side
-- complexa aqui (diferente de scores), então RLS por auth.uid() basta.
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = player_id);

create policy "profiles update own" on public.profiles
  for update using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

-- SEM policy de DELETE: ninguém apaga o próprio perfil pelo cliente
-- (evita órfãos de referência/UX de "sumir" do ranking sem querer).
