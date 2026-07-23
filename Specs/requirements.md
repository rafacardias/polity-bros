# Polity Bros — Requirements (MVP)

> Fonte da verdade do ESCOPO. Se algo não está aqui, não entra no MVP.
> Linguagem: EARS — "QUANDO <gatilho>, o sistema DEVE <comportamento>".
> Cada requisito tem ID (RF/RN) para rastreio.

## 1. Visão do MVP
Um **vertical slice jogável**: UMA fase de auto-runner, 1 personagem, obstáculos
por cima E por baixo, votos colecionáveis, pontuação, game over e ranking online
— rodando no shell React (Polity Games), publicável na Vercel, jogável no celular.

**Fora do MVP → ver seção 8 (Visão Futura).**

## 2. Personas
- **Jogador casual (mobile):** entra pelo link, joga em <10s, quer bater recorde.
- **Dono/dev (Rafael):** não-técnico, evolui via LLM + specs.

## 3. Requisitos Funcionais (RF)

### Plataforma / Shell (React)
- **RF-01** — QUANDO o jogador abre a URL, o sistema DEVE exibir o **menu principal** da Polity Games com o card "Polity Bros" e botão **Jogar**.
- **RF-02** — QUANDO o jogador clica em **Jogar**, o sistema DEVE montar o jogo Phaser no container div e iniciar a fase.
- **RF-03** — QUANDO o jogo emite `game:gameover`, o shell DEVE exibir a tela de fim com pontuação, votos e botões **Jogar de novo** e **Ver ranking**.

### Gameplay (Phaser)
- **RF-04** — O sistema DEVE mover o cenário continuamente (auto-run à direita). O jogador NÃO controla o avanço horizontal (pilar do gênero).
- **RF-05 (revisado)** — O InputSystem DEVE suportar, com o MESMO modelo de timing em mobile e desktop:
  - **Pulo curto:** tap rápido (mobile) / ↑ ou Espaço rápido (desktop).
  - **Pulo alto (variável):** tap segurado / ↑ ou Espaço segurado — quanto mais tempo, mais alto (até um teto).
  - **Descer/deslizar:** swipe ↓ ou tap no ar (mobile) / ↓ (desktop) — desce rápido no ar e desliza sob obstáculos baixos no chão.
- **RF-06** — O SpawnerSystem DEVE gerar proceduralmente obstáculos **altos** (pular por cima) e **baixos/suspensos** (deslizar por baixo), reutilizando objetos de um pool.
- **RF-07** — QUANDO o personagem colide com um obstáculo, o sistema DEVE encerrar a partida.
- **RF-08** — ENQUANTO a partida ocorre, o ScoreSystem DEVE incrementar a pontuação por distância/tempo sobrevivido.
- **RF-09** — CONFORME o tempo passa, o ProgressionSystem DEVE aumentar a dificuldade (velocidade e densidade de obstáculos).
- **RF-10** — O AudioSystem DEVE tocar SFX de pulo, voto, colisão e música de fundo, respeitando a política de autoplay (só após interação).
- **RF-11 (revisado — votos, D-04)** — O SpawnerSystem DEVE posicionar **votos** ao longo da fase, incluindo em **rotas de risco/recompensa** (ex.: linha de votos que exige pulo alto perto de um obstáculo). Coletar voto incrementa um contador exibido no HUD.

### Retenção & Social (Fase 7 — D-09…D-15)
- **RF-15 (micro-onboarding)** — QUANDO um jogador abre o jogo pela primeira vez no aparelho, o sistema DEVE exibir um hint mínimo e não intrusivo dos controles (tap = pulo curto, segurar = pulo alto, swipe ↓ = slide), que desaparece após a primeira interação/partida (flag local). **Critério: usuário novo em mobile Safari entende e executa os 3 comandos em ≤5s.**
- **RF-16 (share sem atrito)** — QUANDO o jogador pede para compartilhar, o sistema DEVE gerar a imagem (screenshot + frame + score + CTA) **mesmo sem login** (nome genérico + convite suave a logar). Login concede identidade: nome no ranking/share, recordes cross-device, perfil. Imagem/vídeo NÃO são persistidos em banco — só o score.

### Ranking (Supabase)
- **RF-12** — QUANDO uma partida termina, o sistema DEVE enviar a pontuação para validação server-side (Edge Function) antes de gravar.
- **RF-13** — QUANDO o jogador abre o ranking, o sistema DEVE exibir os **Top 10** scores (leitura pública).
- **RF-14** — Para gravar um score, o jogador DEVE estar autenticado (Auth anônima); a escrita é restrita ao próprio usuário.

## 4. Requisitos Não-Funcionais (RN)
- **RN-01 (Performance)** — ~60fps em celular real de gama média. Sem `new`/`destroy` no game loop.
- **RN-02 (Mobile-first / one-hand)** — Jogável com uma mão; toda ação alcançável sem cobrir a área de jogo. Layout responsivo.
- **RN-03 (Sessão curta)** — Uma partida típica dura ~1–2 min; morrer e recomeçar em 1 toque.
- **RN-04 (Segurança)** — Scores do cliente não-confiáveis; validação de plausibilidade (teto por tempo + rate limit) em Edge Function. RLS em todas as tabelas.
- **RN-05 (Arquitetura)** — Phaser em container div (nunca iframe); comunicação via CustomEvents.
- **RN-06 (Manutenibilidade)** — TypeScript strict; Systems = lógica pura; Entities sem acesso a Supabase.
- **RN-07 (Assets)** — Placeholder art (retângulos) até a Fase 3. Nenhuma lógica bloqueada por arte final.
- **RN-08 (Paridade de input)** — Desktop e mobile DEVEM usar o mesmo modelo de timing, para justiça no ranking.

## 5. Contrato de Eventos (React ↔ Phaser)
| Evento | Direção | Payload |
|---|---|---|
| `menu:play` | React → Phaser | `{}` |
| `game:score` | Phaser → React | `{ score: number, votes: number, distance: number }` |
| `game:gameover` | Phaser → React | `{ score: number, votes: number, distance: number, elapsedSec: number }` |
| `menu:restart` | React → Phaser | `{}` |

## 6. Modelo de dados (mínimo)
scores id uuid pk player_id uuid -> auth.users (escrita SÓ via Edge Function/service role — D-08; sem policy de INSERT para o cliente) game_id text default 'polity-bros' score int votes int default 0 distance int default 0 created_at timestamptz default now() índices: (game_id, score desc), (created_at desc)


## 7. Critérios de aceite do MVP
- [x] Abrir URL → menu → jogar → pular/deslizar → coletar votos → morrer → ver score → ver Top 10 → jogar de novo. (verificado via Chrome/Playwright contra o backend remoto)
- [ ] Funciona no celular real a ~60fps, jogável com uma mão. (não testado em device físico — ambiente sem celular disponível)
- [ ] Pulo variável perceptível (segurar pula mais alto). (calibrado na Fase 4, T04-06 — não re-verificado nesta sessão)
- [x] Score falso (ex.: 999999 instantâneo) é REJEITADO pela Edge Function.
- [x] Zero erro de console; deploy verde na Vercel. (https://polity-bros.vercel.app — loop completo verificado contra o deploy de produção)

## 8. Visão Futura (backlog — NÃO implementar no MVP)
> Inspirado em Super Mario Run. Registrado para não perder ideias. Cada item
> vira sua própria spec quando (e se) for priorizado após o MVP validado.

- **Personagens desbloqueáveis** com traço único (ex.: pulo mais alto), sem pay-to-win no ranking. *(Versão light — skins por variante de cor via gemas/conquistas — entrou na v1.0, T07B-04/D-11; habilidade única continua aqui.)*
- **Seleção de personagens estilo Mario/Luigi** — arquétipos da polarização brasileira (um inspirado em Lula, outro em Bolsonaro) como opções jogáveis. Direção de arte: pixel-art fofo/minimalista, reconhecível sem descaracterizar (referências registradas no Documento de Memória).
- **Coletável extra "dinheiro/propina"** (sátira "são todos iguais") como segundo colecionável, sem virar mecânica principal.
- **Power-up "viralizou"** — publicação viral dá poder temporário e troca a música de fundo enquanto durar.
- **Login Facebook** como 2º provider OAuth. *(Google entrou na v1.0 — D-13; Facebook adiado por exigir revisão da Meta.)*
- **Vídeo da partida compartilhável** (íntegra <30s / timelapse até 30s, com frame + CTA) — adiado por risco aos 60fps ao gravar canvas em mobile (D-12). **Próximo passo definido: spike técnico de 1 dia (MediaRecorder no celular real) pós-v1.0.** *(A IMAGEM de share entrou na v1.0 — RF-16.)*
- **Pagamentos reais** — continues (R$1/3, R$5/20, R$10/50), skins (R$5–10), "remover ads" (R$5), banner de ads após 5 partidas, botões de funding de jogos futuros na landing → Fase 9, após retenção validada (D-11). Pré-requisito sem código: aplicação no AdSense + escolha de gateway (Pix/cartão).
- **Sync de carteira de gemas cross-device** — na v1.0 a carteira é local por aparelho (D-11).
- **Dificuldade adaptativa (DDA)** — só se a telemetria da v1.0 provar necessidade, e nunca na curva que pontua (D-10).
- **Obstáculos móveis / inimigos (Enemy — cortado do MVP em D-06)** — entram conforme a dificuldade sobe: no chão, vindo contra o player, "eleitores cobrando promessas" e "repórteres com perguntas" (o candidato se esquiva); no ar, ameaças voadoras (tema a definir — ex.: drone de fake news) para pressionar o slide/timing.
- **Múltiplos mundos/temas**, cada um introduzindo 1 mecânica nova. *(Versão light — "cidades da campanha" SP→RJ→Brasília só por paleta — entrou na v1.0, T07B-01/D-14.)*
- **Rotas alternadas cima/baixo no terreno alto** — em trechos de chão mais elevado, o jogador ESCOLHE seguir por cima (rota de risco: mais desafio, mais recompensa/votos) ou por baixo (rota segura: menos prêmio) — clássico "votos em rota de risco/recompensa" do filtro de retenção. Exige level design MANUAL (não o terreno procedural atual), por isso é feature de FASES ELABORADAS pós-MVP, não do terreno em degraus da v1.0 (pedido do dono, 2026-07-23).
- **Modo Desafio** (no-hit, speed run, alvo de votos).
- **Ghost race assíncrono** contra fantasmas de amigos/global.
- **Modo Kingdom** (base-building com os votos coletados).
- **Eventos sazonais** server-driven + feature flags.
- **Modo alternativo com controle direcional completo** (subir/descer/parar/voltar) — a ideia dos 4 swipes, como um SEGUNDO jogo/gênero na plataforma, não como runner.
- **Battle pass / cosméticos** (monetização sem bloquear progressão).
- **Save cross-device** com conta + notificações de re-engajamento.

