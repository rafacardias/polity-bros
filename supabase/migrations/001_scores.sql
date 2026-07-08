-- supabase/migrations/001_scores.sql
create table if not exists scores (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references auth.users(id) on delete cascade,
  game_id    text not null default 'polity-bros',
  score      integer not null check (score >= 0),
  votes      integer not null default 0 check (votes >= 0),
  distance   integer not null default 0 check (distance >= 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_scores_rank on scores (game_id, score desc);
create index if not exists idx_scores_recent on scores (created_at desc);

alter table scores enable row level security;

create policy "scores are public read" on scores for select using (true);
-- SEM policy de INSERT/UPDATE/DELETE: com RLS ativa e nenhuma policy de escrita,
-- o cliente (anon key) NÃO consegue gravar nada. Escrita acontece SÓ pela Edge
-- Function submit-score (service role, que bypassa RLS) — D-08.
