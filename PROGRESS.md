# PROGRESS.md — Polity Bros / Brazuka Games

> **O que é este arquivo:** o mapa do projeto em linguagem simples, para o dono (Rafael,
> não-técnico) acompanhar o trabalho SEM precisar decorar códigos de tarefa, e para
> qualquer outra IA/LLM entender o contexto completo do projeto ao ler este único arquivo.
> É atualizado a cada entrega relevante.
>
> **Última atualização:** 2026-07-09 (Fase 7A NO AR em produção; ranking zerado
> por autorização do dono — regras novas, placar novo)

---

## 1. O que é o projeto

**Polity Bros** é um jogo de corrida infinita (estilo Subway Surfers/Dino do Chrome) com
sátira política brasileira: um candidato corre pelo Brasil pulando obstáculos (CPIs, fake
news, buracos) e coletando **votos**. Vive dentro da **Brazuka Games / Polity Games**, uma
plataforma web feita para abrigar vários jogos no futuro.

- **Jogo no ar:** https://polity-bros.vercel.app
- **Objetivo de negócio:** validar o jogo ANTES das eleições de outubro/2026.
- **Visual atual:** blocos coloridos de propósito ("placeholder") — a mecânica vem
  primeiro, a arte final (pixel art fofo) vem depois. Isso é uma decisão, não um atraso.

**Tecnologia (resumo):** o jogo é feito em Phaser (motor de jogos web) dentro de um site
React; o placar online usa Supabase (banco de dados + login); hospedagem na Vercel.
Detalhes técnicos completos: `CLAUDE.md`, `specs/design.md`.

## 2. O que já está PRONTO e funcionando (testado e aprovado)

| Entrega | O que significa na prática |
|---|---|
| Jogo completo jogável | Pulo curto, pulo alto (segurar), deslizar, obstáculos, votos, dificuldade crescente, game over |
| Controles mobile | Mesmo timing no celular e no computador (ranking justo) |
| Placar online (Top 10) | Score enviado com proteção anti-trapaça (validação no servidor) |
| Login automático anônimo | Jogador ganha identidade sem criar conta |
| Som | Efeitos de pulo/voto/morte + música de fundo + botão de mudo |
| Site no ar | Deploy na Vercel, com SEO, ícones e modo app (PWA) |
| "Gate de Diversão" | O dono testou no celular real e aprovou (2026-07-09) |

Fases concluídas do plano técnico (`specs/tasks.md`): **Fases 4, 5 e 6**.

## 3. O que está sendo feito AGORA — Fase 7: "Loop de Compulsão"

Replanejada em 2026-07-09 após brainstorm de retenção do dono (tese: o jogador volta
quando sente que *a culpa da derrota foi dele, a vitória estava perto, e a próxima
tentativa pode ser melhor*). Quatro blocos, nesta ordem, com teste no celular do dono
ao fim de cada um:

### 7A — Sensação de jogo + "quase consegui" *(✅ NO AR em produção desde 2026-07-09, aprovada pelo dono)*
- [x] Este documento + registro das decisões
- [x] Efeitos visuais de impacto: partículas ao coletar voto, tela treme na morte, personagem "estica e amassa" no pulo
- [x] Momento "uau": completar uma linha de votos → "LINHA PERFEITA! +20" + som especial + explosão visual
- [x] Quase-vitória: bandeira 🏁 do seu recorde visível na pista + "faltaram Xm pro seu recorde!" (ou "empatou!") ao morrer + festa de novo recorde
- [x] Curva de início de partida calibrada (fixa e justa para todos) + medição anônima de onde os jogadores morrem (desligada até você ativar o Analytics — tarefa 6 da seção 6)
- [x] Mini-tutorial de primeira partida (tap = pulo, segurar = pulo alto, deslizar dedo = escorregar) — aparece 1x e some sozinho

### 7B — Progresso que fica (mesmo perdendo) *(✅ implementada em 2026-07-10 — falta seu teste no celular)*
- [x] "Cidades da campanha": o cenário muda de cor/clima — **SP (largada) → RJ (500m) → Brasília (1200m)**, com banner de chegada
- [x] **Gema rara 💎**: 1-2x por partida, em rota de pulo alto arriscado; vai direto pra sua carteira (mesmo morrendo depois)
- [x] **Continue**: ao morrer com 3+ gemas, aparece o botão CONTINUE (4s pra decidir); gasta 3 gemas, limpa a pista e revive — 1x por partida
- [x] **Skins**: 4 cores de personagem no menu — Azul (recorde 500+), Rosa (30 votos numa partida), Dourado (compra por 10 gemas)

### 7C — Identidade e compartilhamento
- [ ] Login com **Google** em 2 cliques (sem perder o histórico anônimo)
- [ ] Nome de usuário editável, exibido no ranking
- [ ] Tela de fim de partida nova: ranking em destaque por ~3s (seu score, seu top-7, top-7 global), **mas o botão "Jogar de novo" disponível desde o primeiro instante**
- [ ] **Imagem de compartilhamento** com moldura + score + convite "bata este recorde em <link>" — WhatsApp/Instagram/etc. **Funciona sem login** (logado, sai com seu nome)

### 7D — Robustez e fechamento
- [ ] Sem internet no meio da partida? O jogo continua normal; o score entra numa fila e é enviado quando a conexão voltar
- [ ] Revisão de segurança de tudo que é novo
- [ ] Testes finais + deploy (sempre com OK explícito do dono)

## 4. Decisões importantes já tomadas (o "porquê" completo em `docs/DECISIONS.md`)

| Decisão | Resumo |
|---|---|
| Sem dificuldade adaptativa (v1.0) | Curva IGUAL para todos = ranking justo. A sensação de "quase consegui" vem de feedback (marca do recorde), não de facilitar o jogo escondido |
| Gemas antes de dinheiro real | Continues/skins são ganhos jogando na v1.0. Pagamento real (Pix/cartão, R$) fica para a fase de monetização — integrar pagamento agora atrasaria o lançamento em semanas |
| Compartilhar não exige login | Compartilhar é como novos jogadores chegam — não pode ter atrito. Login serve para ACUMULAR valor: nome, ranking com identidade, recordes salvos |
| Imagem antes de vídeo | Vídeo da partida gravado no celular arrisca travar o jogo (60fps é inegociável). Imagem entrega ~80% do efeito viral. Vídeo será testado depois do lançamento |
| Só Google (Facebook depois) | Login com Facebook exige aprovação da Meta (semanas de espera) |
| Cenários mudam, obstáculos não | As cidades trocam cor/atmosfera, mas o formato/tamanho dos obstáculos nunca muda — a leitura do perigo é sagrada |

## 5. Fora da v1.0 (adiado DE PROPÓSITO — nada aqui é esquecimento)

Vídeo de compartilhamento (teste técnico pós-lançamento) · Login Facebook ·
Pagamentos reais / remover ads / banner de ads / botões de "funding" (→ Fase 9,
monetização) · Sincronizar gemas entre aparelhos · Dificuldade adaptativa (só se os
dados provarem necessidade) · Arte final pixel art (Fase 3) · Conquistas formais.

Se sobrar tempo após a v1.0: prioridade é um **segundo jogo** na plataforma, não a v2.0
do runner (decisão do dono, 2026-07-09).

## 6. Tarefas do DONO (paralelas, sem código)

1. Iniciar cadastro no **Google AdSense** (aprovação demora; destrava a fase de ads).
2. Criar credencial **Google OAuth** quando o Claude pedir (com passo a passo).
3. Decidir/registrar o domínio **brazukagames.com.br** (aparece no convite da imagem de share).
4. Limpar scores de teste no painel do Supabase (poluem o ranking real).
5. Autorizar o app do GitHub na Vercel (opcional; melhora o fluxo de deploy).
6. Ativar **Web Analytics** no painel da Vercel (projeto → Analytics → Enable).
   Depois disso o Claude liga a variável `VITE_ENABLE_ANALYTICS=true` no deploy —
   sem essa dupla ativação a telemetria fica desligada de propósito (evita erros).

## 7. Como testar em casa

- **Jogo completo no celular (recomendado):** `npm run dev -w web -- --host` e abrir o
  endereço IP mostrado no celular (mesma rede Wi-Fi). ⚠️ Usa o MESMO banco de produção.
- **Produção:** https://polity-bros.vercel.app

## 8. Glossário rápido

- **T04-14, T07A-02…** — códigos de tarefa do plano técnico (`specs/tasks.md`). Você não
  precisa decorá-los; este documento traduz tudo.
- **RF / RN** — requisito funcional / não-funcional (o que o jogo DEVE fazer, em `specs/requirements.md`).
- **Placeholder** — visual provisório (blocos coloridos) até a arte final.
- **Edge Function** — código que roda no servidor (Supabase) validando o score contra trapaça.
- **RLS** — trava de segurança do banco: cada jogador só mexe no que é dele.
- **PWA** — o site se comporta como app instalável no celular.
- **Juice / game feel** — os efeitos (tremida, partículas, som) que fazem o toque parecer "gostoso".
- **DDA** — dificuldade adaptativa por jogador (decidimos NÃO usar na v1.0 — ver seção 4).
