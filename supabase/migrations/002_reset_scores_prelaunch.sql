-- Limpeza pré-lançamento AUTORIZADA pelo dono (2026-07-09): zera scores de
-- teste e os feitos sob regras antigas (pré-7A: sem bônus de linha, sem
-- aquecimento) — ranking novo sob regras novas, justo para todos.
-- O dono autorizou resets da tabela sempre que necessário ATÉ o lançamento
-- público em brazukagames.com.br. Idempotente em ambiente novo (tabela vazia).
truncate table public.scores;
