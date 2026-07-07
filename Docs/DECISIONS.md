# Polity Bros — Architecture Decision Records (ADR)

> Registro versionado das decisões travadas. Fonte da verdade técnica.
> Formato: cada decisão é imutável; mudou de ideia → nova decisão que *supersede* a anterior.
> Contexto estratégico/negócio fica no Notion (2º cérebro). Aqui só o "o quê" e "por quê" técnico.

---

## Índice
| ID | Decisão | Status |
|----|---------|--------|
| D-01 | Metodologia SDD (specs = fonte da verdade) | ✅ Ativa |
| D-02 | Stack: Phaser 3 + Vite + TypeScript / React + Tailwind / Supabase / Vercel | ✅ Ativa |
| D-03 | Gênero MVP: endless runner auto-run (1 mão, vertical) | ✅ Ativa |
| D-04 | Colecionável = "votos" (tema político do jogo) | ✅ Ativa |
| D-05 | Integração React ↔ Phaser via container DIV + CustomEvents (NUNCA iframe) | ✅ Ativa |
| D-06 | Escopo MVP = vertical slice; ideias extras vão para Visão Futura | ✅ Ativa |
| D-07 | MenuScreen vive no React Shell, não como Scene Phaser | ✅ Ativa |
| D-08 | Escrita de score só via Edge Function (service role) | ✅ Ativa |

---

## D-01 — Metodologia SDD
**Contexto:** projeto tocado com apoio de IA; risco de escopo derrapar.
**Decisão:** adotar Spec-Driven Development. `/specs/{requirements,design,tasks}.md` são a fonte da verdade. Código segue os specs, não o contrário.
**Consequência:** toda mudança relevante atualiza o spec antes/junto do código.

## D-02 — Stack técnica
**Decisão:**
- **Jogo:** Phaser 3 + Vite + **TypeScript** (strict).
- **Plataforma/Shell:** React + Vite + Tailwind.
- **Backend:** Supabase (PostgreSQL + Auth anônima + Edge Functions).
- **Hosting:** Vercel.
**Por quê:** Phaser = maduro p/ 2D; Vite = DX/bundle; TS = segurança de tipo (RN-06); Supabase = backend sem servidor próprio; Vercel = deploy simples + CDN.

## D-03 — Gênero do MVP
**Decisão:** endless runner com **auto-run** (avanço automático), jogável com **uma mão** em orientação **vertical**. Jogador só controla pulo (curto/variável) e slide.
**Por quê:** menor superfície de risco para provar diversão rápido; ótimo p/ mobile.
**Supersede parcial:** modo com controle direcional completo (4 direções) foi movido para Backlog V2 como possível 2º gênero.

## D-04 — Colecionável = "votos"
**Decisão:** o item coletável do jogo é **"voto"** (não "moeda"), coerente com o tema político.
**Consequência:** código, HUD, tabela `scores` (coluna `votes`) e assets usam "voto/votes".

## D-05 — Integração React ↔ Phaser
**Decisão:** Phaser é montado em um `<div id="game-container">` dentro do React. **Proibido iframe.** Comunicação exclusivamente via `CustomEvent` no `window` (DOM bus).
**Contrato:**
- React → Phaser: `menu:play`, `menu:restart`
- Phaser → React: `game:score`, `game:gameover`
**Por quê:** iframe quebra input/áudio/escala e isola contexto; DIV + eventos mantém performance e um único contexto DOM.

## D-06 — Escopo MVP = vertical slice
**Decisão:** MVP é o slice jogável mínimo. Fora do MVP (backlog): Enemy, AdsSystem, combos/multiplicador, double-jump/dash/shield, múltiplos temas, boss, multiplayer, skins, battle pass, i18n.
**Regra:** ideia nova → `requirements.md §8 (Visão Futura)`, nunca direto no código.

## D-07 — MenuScreen no React Shell
**Contexto:** a plataforma hospedará múltiplos jogos; o menu é da *plataforma*, não do jogo.
**Decisão:** o **MenuScreen é um componente React**, não uma Scene Phaser. As Scenes Phaser do MVP são apenas: `Boot → Preload → Game → GameOver`.
**Consequência:** remover `MenuScene` de `/game/src/scenes`. Card "Polity Bros" e navegação vivem em `/web`.

## D-08 — Escrita de score só via Edge Function
**Contexto:** ranking é alvo óbvio de trapaça.
**Decisão:** o cliente **nunca** faz `INSERT` direto em `scores`. Toda escrita passa pela Edge Function `submit-score` (service role), que valida:
- autenticação (JWT do usuário anônimo),
- plausibilidade (`score ≤ elapsedSec × teto`),
- rate limit por `player_id`.
**Consequência:** `SUPABASE_SERVICE_ROLE_KEY` existe só no ambiente da Edge Function (nunca no cliente). RLS permite leitura pública e bloqueia escrita direta.

---

## Como adicionar uma decisão
1. Próximo ID sequencial (D-09…).
2. Nunca editar uma decisão antiga para "mudar de ideia" — crie nova com `**Supersede:** D-XX`.
3. Atualize o Índice.
4. Reflita o impacto em `/specs` e, se estratégico, no Notion.
