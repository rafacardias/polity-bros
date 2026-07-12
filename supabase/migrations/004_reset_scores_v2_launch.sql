-- Reset AUTORIZADO pelo dono (autorização permanente até o lançamento
-- público, registrada na 002; pacote 7C aprovado em 2026-07-12): zera os
-- scores feitos sob as regras v1 (sem estrelas/mundos/multiplicador) —
-- ranking v2 nasce limpo, justo para todos. Idempotente em tabela vazia.
truncate table public.scores;
