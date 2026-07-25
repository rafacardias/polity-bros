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
| D-06 | Escopo MVP = vertical slice; ideias extras vão para Visão Futura | ✅ Ativa (Enemy → D-25) |
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
| D-21 | Gema renomeada para **PROPINA** (nota verde com $); ids de código continuam `gem` | ✅ Ativa |
| D-22 | Bloco flutuante vira plataforma-obstáculo: subir em cima = ok; laterais/fundo = morte | ⤳ superseded D-26 |
| D-23 | Marcador de recorde = "fantasma" da skin do player com 10% de opacidade | ✅ Ativa |
| D-24 | Menu hub v2: Jogar fixo embaixo (sempre clicável); Fases/Ranking/Skins/Continue acima; tremidinha no Continue com ≥3 propinas | ✅ Ativa |
| D-25 | Inimigos entram como mecânica central (stomp = votos); evolui D-06 | ✅ Ativa |
| D-26 | Geometria estática NÃO mata; letalidade só nos inimigos (supersede D-22) | ✅ Ativa |
| D-27 | Faixa presidencial na ÚLTIMA fase (capital): qualquer skin veste faixa = payoff "virei presidente" | ✅ Ativa |
| D-28 | Elenco de skins 100% 3D; políticos por lado viram FICTÍCIOS (sem imitar pessoa real) | ✅ Ativa |

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

## D-21 — Colecionável raro = "PROPINA" (2026-07-10, feedback do dono sobre a 7C)
**Contexto:** D-18 previa renome futuro da gema. O dono decidiu: o losango vira uma **nota verde com $ no centro**, chamada **propina** — sátira perfeitamente alinhada ao tema do jogo (propina compra "continue"… e skins).
**Decisão:** todo texto visível ao jogador usa **propina/propinas** (💵). Identificadores de código, keys de textura e chaves de localStorage **continuam `gem`** (convenção: código em inglês neutro; renomear chaves quebraria carteiras existentes).
**Consequência:** placeholder muda de losango roxo para nota verde; textos de HUD, oferta de continue, menu e educação da 1ª propina atualizados. Loja da Fase 9 vende PROPINAS por dinheiro real.

## D-22 — Bloco flutuante é plataforma-obstáculo (supersede parcial D-18)
**Contexto:** na T07C-02 a barra era um divisor VISUAL (não colidia). O dono quer bloco sólido estilo Mario: **mais espesso, o player pode SUBIR em cima**; colidir com as **laterais ou o fundo mata**.
**Decisão:** o bloco entra no grupo de colisão: pouso por cima = plataforma (dá para correr sobre ele e pegar a propina); contato lateral ou por baixo = morte (mesma regra dos obstáculos). Geometria mantém a escolha de rota: propina em cima (pulo alto + pouso), votos embaixo (passar reto por baixo, sem pular).
**Consequência:** nova causa de morte `block` na telemetria; tensão nova — pular debaixo do bloco é erro fatal legível (bloco tem cara de obstáculo, não de cenário).

## D-23 — Recorde vira "fantasma" do player
**Contexto:** o marcador do recorde pessoal (T07A-04) era uma linha vertical abstrata.
**Decisão:** substituir a linha pela **silhueta da skin atual do player com 10% de opacidade** parada no ponto do recorde — "você de ontem" te esperando na pista. Celebração "DISTÂNCIA RECORDE!" ao ultrapassar permanece.
**Consequência:** leitura emocional mais forte (competir consigo mesmo é literal). Opacidade é ajustável em constants se 10% ficar ilegível em alguma paleta.

## D-24 — Menu hub v2: layout e tremidinha (detalha D-20)
**Contexto:** dono enviou mockup do menu (2026-07-10).
**Decisão:** botão **Jogar** fixo no canto inferior, **pressionável a qualquer momento** (RN-03 vale no menu). Acima dele, nesta ordem: **Fases · Ranking · Skins · Continue**. O botão Continue mostra ícone de propina + contagem e, quando o jogador tem **≥3 propinas**, ganha animação de "tremidinha" a cada 1s (chamado pro uso da moeda).
**Consequência:** T07C-05 implementa este layout; a loja futura (Fase 9, desabilitada) vive dentro de Continue.

## D-25 — Inimigos como mecânica central (evolui D-06)
**Contexto:** o MVP jogável (Fase 4) provou o núcleo. Brainstorm do dono (2026-07-22, ref. Super Mario Run) pede ameaças **animadas que andam na direção do player** e podem ser **"pisadas" (stomp)** por votos. D-06 listava `Enemy` como fora do MVP.
**Decisão:** `Enemy` vira entidade central (pooled, animada) que se aproxima do player. **Stomp** (pouso no topo) derrota o inimigo, quica o player e concede **votos** (com combo simples); contato **lateral/frontal = fim de jogo**. Tema: repórteres/CPI/fake news que o político evita (1–2 tipos no 1º corte). Toda ameaça é **telegrafada** (morte justa). Detalhado em `specs/inimigos-terreno.md` — §7 travado nas recomendadas (dono, 2026-07-22).
**Consequência:** reabre o slot `Enemy` (antes backlog); reaproveita o padrão topo-seguro do D-22 e a fundação de personagem animado das skins (Fase 4). Nova fonte de pontuação (stomp = votos).

## D-26 — Geometria estática não mata; letalidade só nos inimigos (supersede D-22)
**Supersede:** D-22.
**Contexto:** no D-22 o bloco flutuante matava pelas laterais/fundo. O dono quer que **nada estático mate** — degraus/plataformas só barram ou permitem subir; a ameaça vem **só dos inimigos** (D-25).
**Decisão:** geometria estática (degraus, plataformas, ex-blocos) é **não-letal** — o player sobe ou é barrado, nunca morre por encostar. O terreno ganha **degraus**: pequenos com auto-step, altos exigem pulo; degrau que não vencer faz **auto-climb suave** (sem punição). Os obstáculos letais atuais (altos/baixos) são **substituídos** por degraus/inimigos. **Sem buracos** que matam no 1º corte.
**Consequência:** remove a causa de morte `block` (D-22); simplifica o contrato de justiça (só inimigo mata). Rework de colisão no núcleo — cada passo re-testado no **Gate de Diversão** no celular (RN-IT3: nada validado pode regredir).

## D-27 — Faixa presidencial na última fase (payoff de carreira)
**Contexto:** a progressão de fases virou **carreira política** (interior → cidade grande → capital). O dono (2026-07-24) quer que chegar à **última fase (capital)** entregue um payoff visual: *"eu virei presidente"*.
**Decisão:** na fase **capital** (último mundo da progressão), **qualquer skin** veste a **faixa presidencial** (verde com listra amarela + medalhão). Convenção de asset genérica: `<char>-faixa`, `<char>-faixa-run`, `<char>-faixa-slide`. A **Scene** decide (é quem conhece o mundo) e passa a flag ao Player; a entidade só troca a textura, com **fallback seguro** (skin sem a variante carregada segue na arte normal). Regra à prova de rename: compara com `WORLDS[último]`, não com o id `bsb`. Hitbox intocada (RN-07). Nas fases 1 e 2 o personagem é idêntico ao já validado.
**Consequência:** só o **Centrão** tem a variante hoje (3D-cartoon gerada por IA sobre a arte aprovada, agachado forçado a ~61px pra ler como esquiva). Skins futuras (Direita/Esquerda, Fase 9) herdam a faixa sem novo código — basta subir os 3 assets `-faixa*`.

## D-28 — Elenco de skins 100% 3D; políticos por lado são fictícios
**Contexto:** migração pro 3D-cartoon (2026-07-24). O dono forneceu protótipos de militantes (direita/esquerda) e caricaturas 3D com o rosto REAL de Lula/Bolsonaro. Rosto real = risco de direito de imagem (lojas de app implicam) e foge do posicionamento "arquétipos, sem nomear pessoas reais". O próprio gerador de imagem **bloqueou** (filtro de pessoa pública) editar as fotos reais — confirmando o risco.
**Decisão:** o elenco liberado passa a ser **todo 3D-cartoon coeso**: **Centrão** (default), militantes **Patriota** (direita) e **Comunista** (esquerda), e políticos **Direita**/**Esquerda** — estes últimos **personagens fictícios** que evocam o lado por sinais (gravata verde-amarela / camisa vermelha + barba grisalha) **sem imitar ninguém real**. As skins pixel Bolsonaro/Lula (pessoas reais) saem do menu; as figuras reais, se um dia, ficam p/ a Fase 9 (pagas) — decisão consciente do dono. Convenção de char: `centrao`/`patriota`/`comunista`/`direita`/`esquerda`; hitbox fixa (RN-07).
**Consequência:** menu coeso e sem risco de imagem. Assets pixel `bolsonaro*`/`lula*` ficam órfãos (não carregados). Cada skin tem idle+corrida+agachado 3D; a faixa presidencial (D-27) hoje só o Centrão tem, mas qualquer skin herda ao ganhar a variante `<char>-faixa`.

---

## Como adicionar uma decisão
1. Próximo ID sequencial (D-09…).
2. Nunca editar uma decisão antiga para "mudar de ideia" — crie nova com `**Supersede:** D-XX`.
3. Atualize o Índice.
4. Reflita o impacto em `/specs` e, se estratégico, no Notion.
