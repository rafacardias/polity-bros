# Spec — Inimigos & Terreno (Milestone)

> **Status:** RASCUNHO para aprovação do dono. Nada é implementado até as
> **Decisões em Aberto (§7)** serem travadas. Esta spec ABRE o milestone e
> registra a mudança de paradigma; a IA implementa a partir dela, não inventa.
>
> **Origem:** brainstorm do dono (2026-07-22) inspirado no Super Mario Run.
> **Fundação já pronta:** o sistema "skin = personagem animado" (idle/corrida/
> agachado) da Fase 4 é a MESMA base técnica dos inimigos — não há retrabalho.

---

## 1. Visão em uma frase
O jogo sobe de **"desvie de obstáculos estáticos que matam"** para
**"corra por um terreno com degraus que só barram + enfrente inimigos animados
que você desvia OU pula em cima para ganhar votos"** — um platformer-runner
satírico ao estilo Mario Run.

## 2. Mudança de paradigma (antes → depois)

| Elemento | Hoje (MVP) | Depois (este milestone) |
|---|---|---|
| Geometria estática | Obstáculos que **matam** no contato (RF-07) | **Degraus/plataformas** que só **barram** — nunca matam |
| Ameaça | Retângulos parados | **Personagens animados** que **andam na direção** do player |
| Interação com a ameaça | Só desviar (pular/deslizar) | Desviar **ou pular em cima** (stomp) |
| Recompensa da ameaça | Nenhuma | **Stomp = votos** (rota de risco/recompensa) |
| Tema | Genérico | **Repórteres/jornalistas** com perguntas capciosas que o político evita |

## 3. Decisões travadas que este milestone REVERTE
Reversão consciente (não pode entrar sem virar ADR — regra dura do projeto):

- **D-06** listava `Enemy` como fora do MVP ("sem inimigos"). → **Proposta D-25:**
  inimigos passam a ser mecânica central (o MVP jogável já provou o núcleo;
  agora evoluímos o núcleo).
- **D-22** definiu o bloco flutuante como **plataforma-obstáculo que mata** pelas
  laterais/fundo. → **Proposta D-26:** geometria estática **não mata** — vira
  degrau/plataforma; a letalidade migra 100% para os inimigos.

> Os ADRs D-25/D-26 só entram em `docs/DECISIONS.md` quando as decisões do §7
> forem travadas.

## 4. Mecânicas propostas (recomendações da IA)

### 4.1 Terreno em degraus (Ideia 1 — "só para o player")
- O chão deixa de ser plano: ganha **degraus/plataformas** de alturas variadas.
- **Degraus baixos:** o player sobe automaticamente (auto-step), sem pular.
- **Degraus/paredes altos:** exigem **pulo** para subir em cima.
- **Nunca matam.** Encostar numa parede que não venceu = fica barrado por um
  instante (não morre) — ver decisão §7-A sobre o que acontece ao não vencer.
- O **bloco flutuante (D-22)** vira uma dessas plataformas não-letais (propina
  em cima segue como recompensa de rota alta).

### 4.2 Inimigos animados (Ideias 2 e 3)
- Nova entidade **`Enemy`** (com **object pooling** obrigatório — RN-01).
- **Anda na direção do player** (move-se para a esquerda mais rápido que o
  scroll do mundo → "vem pra cima"). Animação de caminhada própria.
- **Colisão (reaproveita o padrão D-22 topo-seguro):**
  - Player **cai em cima** → **stomp**: inimigo é derrotado (poof + SFX),
    player quica, **+votos**.
  - Player **encosta de lado/frente** → **game over** (mantém os stakes; ver §7-B).
- **Telegrafado:** o inimigo entra na tela com folga de leitura (morte justa,
  nunca "cheap death").

### 4.3 Tema e arte (satírico-leve, no estilo pixel do jogo)
- Inimigos = o que o político **evita**: **repórter com microfone** (pergunta
  capciosa), **câmera/CPI**, **fake news**. Começar com **1–2 tipos** (§7-D).
- Pipeline de arte idêntico ao das skins (idle/walk sheets, fundo magenta,
  recorte por componente conectado — já validado na Fase 4).

## 5. Ligação com o filtro de retenção
Este milestone acerta vários gatilhos do filtro do `CLAUDE.md` de uma vez:
- **Votos em rotas de risco/recompensa** → stomp é literalmente isso.
- **Quase-vitória frequente** → escapar/pular do repórter no último frame.
- **Tensão crescente com flow** → ameaças que se aproximam, telegrafadas.
- **Sensação de crescimento/maestria** → platforming = skill expression.
- **"Da próxima eu consigo"** → morte por inimigo é sempre legível/justa.
- **FOMO/social** → tema (pular no repórter) é altamente compartilhável.

## 6. Requisitos (rascunho — RF/RN novos)
- **RF-IT1:** terreno com degraus não-letais; auto-step em degraus baixos, pulo
  nos altos.
- **RF-IT2:** entidade `Enemy` pooled, animada, que se aproxima do player.
- **RF-IT3:** stomp (pouso no topo) derrota o inimigo, quica o player e concede votos.
- **RF-IT4:** contato lateral/frontal com inimigo = fim de jogo (§7-B).
- **RN-IT1:** manter ~60fps no celular real com N inimigos + terreno (pooling, sem GC no loop).
- **RN-IT2:** toda ameaça é telegrafada (janela mínima de leitura antes do impacto).
- **RN-IT3:** nada já testado/validado (skins, intro, HUD, física) pode regredir.

## 7. ⚠️ DECISÕES EM ABERTO (preciso de você antes de implementar)
São as escolhas de design que mudam o que eu construo. Minha recomendação em **negrito**.

- **A) Terreno que "não mata" num auto-runner:** o player fica em X fixo e o
  mundo vem pra ele. Se ele NÃO vencer um degrau alto, o que acontece?
  1. **Auto-climb suave (recomendado):** o jogo o "levanta" pelo degrau, sem punição — 100% sem morte, mais casual.
  2. Fica barrado e é empurrado até "ficar pra trás" (sair da tela) = uma forma de derrota **sem** ser por contato letal.
  3. Só existem degraus que dá pra vencer sempre (level design garante) — parede intransponível não existe.
- **B) Bater no inimigo de lado = ?** **Game over (recomendado — mantém tensão)**,
  ou só perde votos / é empurrado (mais casual, menos stakes)?
- **C) Existe buraco/queda (pit) que mata?** Platforming clássico tem. **Sem buracos
  no 1º corte (recomendado)** para não empilhar fontes de morte de uma vez.
- **D) Quantos tipos de inimigo no 1º corte?** **1–2 (recomendado):** repórter +
  câmera/CPI. Mais variedade entra depois.
- **E) Os obstáculos atuais (altos/baixos que matam) saem de vez** e viram
  degraus/inimigos, **ou coexistem** por um tempo? **Substituir (recomendado)** —
  o paradigma "estático não mata" fica claro e sem contradição.
- **F) Stomp:** quantos votos por inimigo? Tem **combo** (stomps seguidos valem
  mais)? **Recomendo:** valor fixo pequeno + combo simples (cada stomp encadeado soma).

## 8. Riscos (honestidade de sócio)
- **Rework de colisão** é o maior risco: mexe no coração da física já afinada.
  Mitigação: fatiar em passos atômicos, re-testar o **Gate de Diversão** no
  celular a cada passo (RN-IT3).
- **Balanceamento:** inimigos que se aproximam + terreno mudam a curva de
  dificuldade — vai pedir tuning no celular real.
- **Arte:** novos sheets de inimigos (mesmo pipeline das skins, risco baixo).
- **Escopo:** é a maior fatia de gameplay até hoje — melhor entregar em
  incrementos jogáveis (terreno → 1 inimigo → stomp → 2º inimigo → tuning).

## 9. Esboço de tarefas (após travar o §7)
Sequência incremental, cada passo jogável e commit atômico + E2E:
1. **Terreno em degraus** (SpawnerSystem gera plataformas; auto-step; sem letalidade).
2. **Converter/retirar obstáculos letais** (D-26) — geometria estática deixa de matar.
3. **Entidade `Enemy`** (pooled) + animação de caminhada + aproximação do player.
4. **Colisão stomp** (topo = derrota + quica + votos; lateral = §7-B).
5. **Arte do 1º inimigo** (repórter) via pipeline das skins.
6. **2º inimigo** (câmera/CPI) + variedade de spawn.
7. **Balanceamento + Gate de Diversão** no celular real (dono aprova).
8. **ADRs D-25/D-26** formalizados em `docs/DECISIONS.md`.

---

**Próximo passo:** dono responde o §7 (nem que seja "aceito as recomendadas") →
eu formalizo os ADRs e começo pela tarefa 1 (terreno), em incrementos jogáveis.
