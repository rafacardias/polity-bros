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

## Fase 4 — Vertical Slice (o coração — TUDO P0)
- [ ] [P0] T04-01: Setup Vite + Phaser 3 + TypeScript strict — *RN-06*
- [ ] [P0] T04-02: BootScene + PreloadScene (carregam placeholders) — *RN-07*
- [ ] [P0] T04-03: **MenuScreen React** (não Scene Phaser) monta GameShell em container div; botão Jogar → `menu:play` — *RF-01, RF-02, RN-05, D-07*
- [ ] [P0] T04-04: Auto-run à direita (cenário + Player retângulo) — *RF-04*
- [ ] [P0] T04-05: InputSystem — pulo curto + **pulo variável** (segurar) + **slide/descer** — *RF-05, RN-08*
- [ ] [P0] T04-06: PhysicsSystem (gravidade, jump arc, fast-fall) — *RF-05*
- [ ] [P0] T04-07: SpawnerSystem com object pooling — obstáculos **altos E baixos** — *RF-06, RN-01*
- [ ] [P0] T04-08: Colisão Player×Obstáculo → game over — *RF-07*
- [ ] [P0] T04-09: Votos colecionáveis + rotas risco/recompensa; contador no HUD — *RF-11*
- [ ] [P0] T04-10: ScoreSystem (pontos por distância/tempo) — *RF-08*
- [ ] [P0] T04-11: ProgressionSystem (dificuldade crescente) — *RF-09*
- [ ] [P0] T04-12: HUD (score, votos, distância) — *RF-03*
- [ ] [P0] T04-13: GameOverScene emite `game:gameover` + restart (`menu:restart`) — *RF-03, RF-12*
- [ ] [P0] T04-14: **🎮 Gate de Diversão** — testar no celular real, uma mão, ~60fps. Se não for divertido, iterar AQUI antes de escalar. — *RN-01, RN-02, RN-03*

## Fase 5 — Ranking online + Áudio (fecha o MVP)
- [ ] [P0] T05-01: Migration `scores` (+votos) + RLS + índices — *RF-12..14, RN-04*
- [ ] [P0] T05-02: Supabase Auth anônima (jogador ganha player_id) — *RF-14*
- [ ] [P0] T05-03: Edge Function `submit-score` (sanity check + rate limit) — **caminho ÚNICO de escrita de score** (service role); cliente NUNCA insere direto — *RF-12, RN-04, D-08*
- [ ] [P0] T05-04: Envio do score à Edge Function ao morrer (via GameShell, com JWT + elapsedSec) — *RF-12, D-08*
- [ ] [P0] T05-05: Tela de ranking React (Top 10, leitura pública) — *RF-13*
- [ ] [P0] T05-06: AudioSystem (SFX + música, respeita autoplay) — *RF-10*
- [ ] [P0] T05-07: Menu principal da plataforma — **card Polity Bros dentro do MenuScreen React** (ver T04-03) — *RF-01, D-07*
- [ ] [P0] T05-08: **✅ Gate de MVP** — loop completo funciona + score falso rejeitado pela Edge Function + deploy verde — *Critérios seção 7, D-08*

## Fase 6 — Deploy inicial + entrega mínima
- [ ] [P0] T06-01: Deploy Vercel (game + web) com env vars corretas (inclui `SUPABASE_SERVICE_ROLE_KEY` só na Edge Function) — *D-08*
- [ ] [P0] T06-02: README ("como rodar") + `docs/adding-games.md` (contrato CustomEvents)
- [ ] [P1] T06-03: Landing page (hero + CTA)
- [ ] [P1] T06-04: SEO (meta tags, OG, sitemap)
- [ ] [P1] T06-05: PWA (manifest, service worker, ícones)

## Fase 7 — Polish (só APÓS o MVP validar diversão)
- [ ] [P1] T07-01: Juice (partículas, screen shake, transições)
- [ ] [P1] T07-02: Personagens adicionais + habilidade única (sem pay-to-win)
- [ ] [P1] T07-03: Variação de fases / temas
- [ ] [P2] T07-04: Achievements

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
