# Polity Bros — Tasks (Backlog Priorizado)

> Cada task = 1 commit atômico (conventional commits).
> P0 = crítico para o MVP jogável · P1 = importante pós-slice · P2 = backlog v2.
> ⚠️ Regra: NÃO avançar de fase sem passar no Gate anterior. Slice antes de escalar.

---

## Fase 3 — Pré-Produção de Assets
> Roda em PARALELO ao código. Enquanto assets não chegam, código usa placeholders (retângulos).
- [ ] [P1] T03-01: Spec visual de cada personagem (arquétipo, cores, proporções)
- [ ] [P1] T03-02: Sprites de personagens (idle, run, jump, fall, slide, hurt, victory, defeat)
- [ ] [P1] T03-03: Sprites de obstáculos (altos + baixos/suspensos) e votos
- [ ] [P1] T03-04: Backgrounds de cenários (parallax layers)
- [ ] [P1] T03-05: Áudio (música + SFX: pulo, voto, colisão)
- [ ] [P1] T03-06: Otimizar e comprimir assets (usar `ffmpeg` para áudio)

## Fase 4 — Vertical Slice (o coração — TUDO P0) ✅ CONCLUÍDA
- [x] [P0] T04-01: Setup Vite + Phaser 3 + TypeScript strict — *RN-06*
- [x] [P0] T04-02: BootScene + PreloadScene (carregam placeholders) — *RN-07*
- [x] [P0] T04-03: **MenuScreen React** (não Scene Phaser) monta GameShell em container div; botão Jogar → `menu:play` — *RF-01, RF-02, RN-05, D-07*
- [x] [P0] T04-04: Auto-run à direita (cenário + Player retângulo) — *RF-04*
- [x] [P0] T04-05: InputSystem — pulo curto + **pulo variável** (segurar) + **slide/descer** — *RF-05, RN-08*
- [x] [P0] T04-06: PhysicsSystem (gravidade, jump arc, fast-fall) — *RF-05*
- [x] [P0] T04-07: SpawnerSystem com object pooling — obstáculos **altos E baixos** — *RF-06, RN-01*
- [x] [P0] T04-08: Colisão Player×Obstáculo → game over — *RF-07*
- [x] [P0] T04-09: Votos colecionáveis + rotas risco/recompensa; contador no HUD — *RF-11*
- [x] [P0] T04-10: ScoreSystem (pontos por distância/tempo) — *RF-08*
- [x] [P0] T04-11: ProgressionSystem (dificuldade crescente) — *RF-09*
- [x] [P0] T04-12: HUD (score, votos, distância) — *RF-03*
- [x] [P0] T04-13: GameOverScene emite `game:gameover` + restart (`menu:restart`) — *RF-03, RF-12*
- [x] [P0] T04-14: **🎮 Gate de Diversão** — testado pelo dono no celular real em 2026-07-09; aprovado ("tudo funcionando bem") — *RN-01, RN-02, RN-03*

## Fase 5 — Ranking online + Áudio (fecha o MVP)
- [x] [P0] T05-01: Migration `scores` (+votos) + RLS + índices — *RF-12..14, RN-04*
- [x] [P0] T05-02: Supabase Auth anônima (jogador ganha player_id) — *RF-14*
- [x] [P0] T05-03: Edge Function `submit-score` (sanity check + rate limit) — **caminho ÚNICO de escrita de score** (service role); cliente NUNCA insere direto — *RF-12, RN-04, D-08*
- [x] [P0] T05-04: Envio do score à Edge Function ao morrer (via GameShell, com JWT + elapsedSec) — *RF-12, D-08*
- [x] [P0] T05-05: Tela de ranking React (Top 10, leitura pública) — *RF-13*
- [x] [P0] T05-06: AudioSystem (SFX + música, respeita autoplay) — *RF-10*
- [x] [P0] T05-07: Menu principal da plataforma — **card Polity Bros dentro do MenuScreen React** (ver T04-03) — *RF-01, D-07*
- [x] [P0] T05-08: **✅ Gate de MVP** — loop completo funciona + score falso rejeitado pela Edge Function + deploy verde — *Critérios seção 7, D-08*

## Fase 6 — Deploy inicial + entrega mínima
- [x] [P0] T06-01: Deploy Vercel (game + web) com env vars corretas (inclui `SUPABASE_SERVICE_ROLE_KEY` só na Edge Function) — *D-08*
- [x] [P0] T06-02: README ("como rodar") + `docs/adding-games.md` (contrato CustomEvents)
- [x] [P1] T06-03: Landing page (hero + CTA)
- [x] [P1] T06-04: SEO (meta tags, OG, sitemap)
- [x] [P1] T06-05: PWA (manifest, service worker, ícones)

## Fase 7 — "Loop de Compulsão" (replanejada em 2026-07-09 — D-09…D-15)
> Substitui a Fase 7 original (T07-01 → 7A; T07-02 → T07B-04; T07-03 → T07B-01/D-14;
> T07-04 → coberto pelos critérios de unlock, achievements formais no backlog).
> Teste no celular do dono ao fim de CADA sub-fase. Deploy só com OK explícito.

### 7A — Game Feel, Onboarding & Quase-vitória ✅ (aguardando validação do dono no celular)
- [x] [P0] T07A-01: PROGRESS.md (visão não-técnica na raiz) + DECISIONS.md D-09…D-15 + specs atualizadas — *D-09*
- [x] [P0] T07A-02: Juice — partículas na coleta, screen shake na morte, squash/stretch no pulo/aterrissagem, transições — *RN-01*
- [x] [P0] T07A-03: Momento "uau" — linha de votos completa → combo + SFX especial + explosão visual + bônus (em votos, fórmula anti-cheat preservada) — *RF-11*
- [x] [P0] T07A-04: Quase-vitória — marcador do recorde pessoal na pista + "faltaram Xm!"/empate no game over + celebração de novo recorde — *D-10*
- [x] [P0] T07A-05: Curva de aquecimento fixa (220→260 + FIRST_GAP) + telemetria leve (deathCause + run_end via Vercel Analytics com gate; amostra local p/ calibração); sem DB novo, sem tocar Edge Function — *D-10, RN-08*
- [x] [P0] T07A-06: Micro-onboarding first-run (tap/hold/swipe↓ ou teclado), some na 1ª interação ou 6s; 1x por aparelho — *RF-15, RN-02*

### 7B — Meta-progressão ✅ (aguardando validação do dono no celular)
- [x] [P0] T07B-01: Cidades da campanha (SP em 0m → RJ em 500m → Brasília em 1200m) — paleta + banner; silhueta/hitbox intocadas (`SIZES` congelado) — *D-14*
- [x] [P0] T07B-02: Gema rara — pooled, spawn sorteado em 2 janelas/partida em rota de pulo alto (GEM_HEIGHT), SFX próprio; carteira local (WalletSystem) — *D-11, RN-01*
- [x] [P0] T07B-03: Continue por gemas — oferta arcade in-scene (countdown 4s, botão tremendo), revive 1x/partida com pista limpa + 1.5s invencível; `game:gameover`/submit só na morte FINAL; oferta pausada não conta em elapsedSec — *D-11, RN-04*
- [x] [P0] T07B-04: Skins por variante de cor (verde/azul/rosa/dourado) — unlock por recorde, votos numa partida ou 10 gemas; catálogo único no pacote game; picker no MenuScreen; ids neutros — *D-11*

### 7C — Identidade & Social
- [ ] [P0] T07C-01: Google OAuth como upgrade da conta anônima (`linkIdentity`); pré-requisito: credencial OAuth do dono — *D-13, RF-14*
- [ ] [P0] T07C-02: Migration `profiles` (username) + RLS + edição de nome + ranking exibe nome — *RN-04*
- [ ] [P0] T07C-03: Pop-up final — replay fixo desde o frame 1; ranking em spotlight ~3s (atual + top-7 pessoal + top-7 global + posição), recolhe animado — *D-15, RN-02, RN-03*
- [ ] [P1] T07C-04: Imagem de share para todos — canvas (screenshot + frame + score + CTA) via Web Share API + fallback download/galeria — *D-12, RF-16*

### 7D — Robustez & fechamento
- [ ] [P0] T07D-01: Resiliência de rede — partida carregada roda 100% local; submit de score em fila com reenvio ao reconectar (sem prometer boot offline completo) — *RN-01*
- [ ] [P0] T07D-02: Revisão de segurança da superfície nova (profiles RLS, OAuth, submit-score com continues) — *RN-04*
- [ ] [P0] T07D-03: 🎮 Gate da Fase 7 — build/lint/typecheck verdes + E2E Playwright + celular real + deploy com OK explícito (inclui fix de música 6485f9e)

## Fase 8 — QA
- [ ] [P0] T08-01: Teste cross-device (5+ dispositivos)
- [ ] [P0] T08-02: Performance (FPS, memória, loading)
- [ ] [P0] T08-03: Playtesting com pessoas reais
- [ ] [P0] T08-04: Corrigir bugs P0/P1
- [ ] [P1] T08-05: Balanceamento final de dificuldade

## Fase 9 — Monetização & GTM (pós-produto validado)
- [ ] [P1] T09-01: Integrar ads (intersticial, rewarded, banner)
- [ ] [P1] T09-02: Share social (WhatsApp + genérico)
- [ ] [P1] T09-03: Assets de marketing (vídeo 15s, GIFs, screenshots)
- [ ] [P1] T09-04: Estratégia de divulgação (orgânico, comunidades)
- [ ] [P0] T09-05: Lançamento

## Fase 10 — Monitoramento & Iteração
- [ ] [P1] T10-01: Dashboard de analytics
- [ ] [P1] T10-02: Monitorar D1/D3/D7 e ajustar
- [ ] [P2] T10-03: Primeira atualização semanal (novo obstáculo)
- [ ] [P2] T10-04: Spec do segundo jogo da plataforma

## Backlog V2 (Pós-MVP)
- [ ] [P2] Multiplayer / ghost race assíncrono
- [ ] [P2] Skins / cosméticos
- [ ] [P2] Battle pass
- [ ] [P2] Modo Kingdom (base-building)
- [ ] [P2] Modo com controle direcional completo (4 direções) — como 2º gênero
- [ ] [P2] Notificações push
- [ ] [P2] Internacionalização (en/es)
- [ ] [P2] Save cross-device com conta
