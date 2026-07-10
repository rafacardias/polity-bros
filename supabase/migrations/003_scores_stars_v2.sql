-- supabase/migrations/003_scores_stars_v2.sql
-- Score v2 (D-17): estrelas multiplicam o score; selo "sem continue" no
-- ranking; mundo jogado para tetos de plausibilidade por fase (D-16).
-- Defaults cobrem linhas antigas e payloads do app v1 ainda em produção
-- (a Edge Function v2 é retrocompatível — deploy dela pode preceder o app).
alter table scores
  add column if not exists stars integer not null default 1
    check (stars between 1 and 3),
  add column if not exists continue_used boolean not null default false,
  add column if not exists world text not null default 'sp'
    check (world in ('sp', 'rj', 'bsb'));
