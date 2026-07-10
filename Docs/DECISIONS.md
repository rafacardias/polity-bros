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
| D-09 | Fase 7 = "Loop de Compulsão" (game feel → meta-progressão → identidade/social → robustez) | ✅ Ativa |
| D-10 | Sem DDA na v1.0: curva fixa + quase-vitória por feedback + telemetria leve | ✅ Ativa |
| D-11 | Economia de gemas sem dinheiro real na v1.0; pagamentos → Fase 9 | ✅ Ativa |
| D-12 | Share de imagem sem login; login = pertencimento/persistência; vídeo adiado | ✅ Ativa |
| D-13 | Login social = só Google na v1.0 (upgrade da conta anônima); Facebook adiado | ✅ Ativa |
| D-14 | 3 "cidades da campanha" (SP→RJ→Brasília) só por paleta; silhueta/hitbox intocadas | ✅ Ativa |
| D-15 | Game over: ranking em spotlight ~3s, mas replay disponível desde o frame 1 | ✅ Ativa |
| D-16 | Fases/mundos com FIM e layout FIXO (SP 600m → RJ 900m → BSB 1200m); sem modo infinito na v1.0 | ✅ Ativa |
| D-17 | Estrelas ×1/×2/×3 multiplicam o score; fórmula v2 na Edge Function + schema v2 | ✅ Ativa |
| D-18 | Gema = moeda (continues/skins); spawn seguro em barra flutuante; coleção persistente por mundo | ✅ Ativa |
| D-19 | 1 skin desbloqueável POR MUNDO (votos acumulados no mundo); galeria com cinza "offline" | ✅ Ativa |
| D-20 | Menu vira hub: botões cidades/skins/continue(gemas); supersede parcial D-14 (cidade = mundo, não transição) | ✅ Ativa |

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

## D-09 — Fase 7 = "Loop de Compulsão"
**Contexto:** MVP validado (Fases 4–6, dono aprovou no celular real). Brainstorm de retenção do dono em 2026-07-09 (controle + progresso + expectativa; dopamina vem da antecipação), endurecido em 2ª rodada com revisão externa de outra LLM. Prazo-alvo: eleições out/2026.
**Decisão:** substituir a Fase 7 original ("polish" genérico) por 4 sub-fases orientadas ao loop ação→resposta→recompensa→novo objetivo: **7A** game feel/onboarding/quase-vitória → **7B** meta-progressão → **7C** identidade/social → **7D** robustez. Arte real continua adiada (RN-07); teste no celular do dono ao fim de cada sub-fase.
**Consequência:** `specs/tasks.md` Fase 7 reescrita (T07A-*…T07D-*); `PROGRESS.md` criado na raiz como visão não-técnica e contexto portátil para outras LLMs.

## D-10 — Fairness > adaptação (sem DDA na v1.0)
**Contexto:** dono pediu comportamento "smart game" (dificuldade adaptativa estilo Castle Crush). DDA por jogador tornaria scores incomparáveis e quebraria RN-08 (paridade/ranking justo).
**Decisão:** **nenhuma dificuldade adaptativa na v1.0.** Em vez disso: (a) curva de aquecimento FIXA bem calibrada em `constants.ts`; (b) engenharia de quase-vitória por feedback — marcador do recorde na pista, "faltaram Xm", destaque de novo recorde; (c) telemetria leve por eventos de analytics (distância/causa da morte, duração da run) — sem tabela nova e sem tocar a Edge Function.
**Consequência:** DDA vira backlog (§8) condicionado a dados da telemetria. A curva que pontua é idêntica para todos, sempre.

## D-11 — Economia de gemas sem dinheiro real na v1.0
**Contexto:** dono listou monetização (continues R$1–10, skins R$5–10, remover ads R$5, funding). Gateway de pagamento (Pix/cartão) + entitlements + obrigações fiscais = semanas de trabalho antes de validar retenção ("Engagement → Retention → Revenue, nessa ordem").
**Decisão:** v1.0 lança com economia fechada de **gemas**: colecionável raro (1–2/partida, rota de risco) troca por **continues** (revive 1x/partida) e skins. Carteira é **local por aparelho** (localStorage). Pagamentos reais, banner ads, "remover ads" e funding de jogos futuros → Fase 9. Sync de carteira cross-device → backlog.
**Consequência:** o loop de compulsão (gema→continue→skin) funciona 100% sem backend novo nem risco de atrasar o lançamento pré-eleição.

## D-12 — Share sem atrito; login = pertencimento (supersede parcial do §8 original)
**Contexto:** spec original exigia login para compartilhar. O share de imagem é o principal loop de aquisição viral (jogador → imagem com CTA → novo jogador); atrito nesse ponto mata o loop.
**Decisão:** compartilhar **imagem** (canvas: screenshot + frame + score + CTA "bata este recorde em <URL>", via Web Share API + fallback download/galeria) **funciona para anônimo** — com nome genérico e convite suave a logar. Login entrega o que acumula valor: nome persistente, identidade no ranking, recordes cross-device, perfil/histórico. **Vídeo da partida adiado** para spike técnico pós-v1.0 (gravar canvas compete por CPU com o jogo — risco direto aos 60fps de RN-01; iOS Safari instável).
**Consequência:** RF-16 criado; imagem e vídeo NÃO são persistidos em banco — só o score.

## D-13 — Login social: só Google na v1.0
**Contexto:** dono pediu Google + Facebook OAuth. Facebook exige app aprovado pela Meta (revisão de semanas, requisitos de privacidade) — dependência externa incompatível com o prazo.
**Decisão:** **Google OAuth** apenas, implementado como **upgrade da conta anônima** (`linkIdentity` do Supabase — o jogador não perde scores/identidade ao logar). Facebook → backlog.
**Consequência:** pré-requisito do dono: credencial OAuth no Google Cloud Console (guiada passo a passo em T07C-01).

## D-14 — "Cidades da campanha" por paleta (absorve variação de temas)
**Contexto:** dono pediu tiers/níveis com mudança de cenário (Brasília, RJ, SP). Arte real está adiada, e mudar a forma dos obstáculos comprometeria a leitura de risco.
**Decisão:** 3 cidades na ordem **SP → RJ → Brasília** (clímax no Planalto), ativadas por marcos de distância/score. Muda **apenas** paleta/atmosfera do cenário e dos obstáculos + banner de transição ("Você chegou em …!"). **Silhueta e hitbox intocadas** — `SIZES` em `game/src/config/constants.ts` permanece congelado; contraste obstáculo×fundo verificado por paleta.
**Consequência:** o antigo T07-03 ("variação de temas") deixa de ser gap: versão light entra na v1.0; temas com arte/mecânica própria seguem no §8.

## D-15 — Game over: spotlight de ranking sem bloquear o replay
**Contexto:** dono desenhou pop-up final com ranking dominando ~3s. RN-03 exige "morrer e recomeçar em 1 toque" — o spotlight não pode travar o loop.
**Decisão:** "**Jogar de novo**" fica fixo e clicável **desde o primeiro frame** do game over. O card de ranking (partida atual no topo; top-7 pessoal com destaque e posição global; top-7 global) brilha acima por ~3s e recolhe animado num botão; um toque pula a animação. Demais ações: login Google (se anônimo), CONTINUE por gemas, compartilhar, perfil.
**Consequência:** recompensa emocional + loop rápido coexistem; layout mobile de 1 mão (RN-02).

## D-16 — Fases/mundos com fim e layout fixo (2º brainstorm, 2026-07-10)
**Contexto:** dono testou a 7B e pediu o pivô: corrida infinita → fases com FIM (modelo Super Mario Run, a inspiração original do §8). Transição de cidade in-run pareceu "entardeceu, continuo na mesma fase" — sem recompensa.
**Decisão:** 3 mundos selecionáveis no menu, com FIM: **SP 600m → RJ 900m → Brasília 1200m**. Layout **FIXO** por mundo (geração com semente — pré-requisito de "coletar todos" e do replay estratégico; o sorteio atual fica para um futuro modo infinito). Countdown regressivo no HUD ("faltam Xm"). Próximo mundo desbloqueia ao TERMINAR o anterior. Dificuldade cresce por mundo; fase 1 um pouco mais fácil que o atual. **Sem modo infinito na v1.0** — escolha consciente do dono, ciente do risco de empate no teto do ranking quando os melhores gabaritarem (mitigação: desempate por precedência; revisão com telemetria na Fase 10; modo infinito no backlog §8).
**Consequência:** supersede parcial de D-14 (paletas viram TEMA de cada mundo, não transição in-run — a transição pode permanecer como detalhe estético dentro de um mundo se couber).

## D-17 — Estrelas multiplicam o score (fórmula v2)
**Decisão:** fim de partida classifica: ⭐ morreu no caminho · ⭐⭐ chegou ao fim vivo (mín. de coletáveis) · ⭐⭐⭐ chegou ao fim com TODOS os coletáveis (a escolha gema-vs-voto na barra flutuante NÃO penaliza — "todos" considera a exclusividade). Score final = base × estrelas.
**Consequência:** Edge Function v2 (`score === (distance + votes×10) × stars`, tetos por mundo) + migration em `scores` (colunas `stars`, `continue_used`, `world`). Ranking exibe estrelas e o selo **"🏅 sem continue"** (nomeado assim — "anti-cheat" acusaria quem pagou o preço justo em gemas).

## D-18 — Gema: moeda do jogo, spawn seguro, coleção persistente
**Contexto:** gemas nasciam em posições IMPOSSÍVEIS (ex.: após obstáculo de deslizar). Difícil ≠ impossível.
**Decisão:** gema vive em **barra horizontal flutuante** (gema em cima, votos embaixo — decisão forçada, replay para pegar o resto). Posições FIXAS por mundo; gema coletada **não reaparece** (coleção persistente por mundo). 1ª gema do jogo é fácil; pop-up pós-morte educa ("3 💎 = 1 continue"). Gema é a MOEDA: compra continues (3) e skins de compra. Loja futura (Fase 9): **gemas por dinheiro real** (desabilitada na v1.0). Dono quer renomear o objeto no futuro (conceito mantido).

## D-19 — Skins: 1 desbloqueável por mundo
**Contexto:** a skin rosa (30 votos/partida) saiu fácil demais.
**Decisão:** 1 skin desbloqueável POR MUNDO, por **votos acumulados jogando aquele mundo** (farming do mundo); skins de compra continuam por gemas. Galeria no menu: skin clicada amplia com nome; bloqueadas em **tons de cinza "offline"** (sem cadeado).

## D-20 — Menu vira hub
**Decisão:** menu ganha três botões: **cidades** (seleção/desbloqueio de mundos, ícone de mapa), **skins** (galeria, ícone de personagem) e **continue** (ícone de gema + contagem; ali viverá a loja de gemas por R$ da Fase 9, desabilitada).

---

## Como adicionar uma decisão
1. Próximo ID sequencial (D-09…).
2. Nunca editar uma decisão antiga para "mudar de ideia" — crie nova com `**Supersede:** D-XX`.
3. Atualize o Índice.
4. Reflita o impacto em `/specs` e, se estratégico, no Notion.
