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
- [x] **Gema rara** (renomeada para **PROPINA 💵** na 7C): 2x por fase, em cima do bloco flutuante; vai direto pra sua carteira (mesmo morrendo depois)
- [x] **Continue**: ao morrer com 3+ gemas, aparece o botão CONTINUE (4s pra decidir); gasta 3 gemas, limpa a pista e revive — 1x por partida
- [x] **Skins**: 4 cores de personagem no menu — Azul (recorde 500+), Rosa (30 votos numa partida), Dourado (compra por 10 gemas)

### 7C — Mundos, Estrelas & Economia *(✅ implementada em 2026-07-10 — falta seu teste no celular + deploy)*
- [x] **3 fases com FIM**: São Paulo (600m) → Rio (900m) → Brasília (1200m); layout FIXO (decorar a fase faz parte); HUD com contagem regressiva "faltam Xm"; linha de chegada 🏁 visível; vencer desbloqueia a próxima cidade
- [x] **Bloco flutuante**: dá pra SUBIR em cima (e pegar a propina); bater na lateral ou por baixo MATA — a escolha propina × votos continua
- [x] **PROPINA 💵** (ex-gema): nota verde com $; educação da 1ª propina na tela de fim ("junte 3 = 1 continue")
- [x] **Estrelas**: ⭐ morreu · ⭐⭐ terminou a fase · ⭐⭐⭐ terminou coletando TUDO (a escolha do bloco não penaliza) — score final × 1/2/3
- [x] **Ranking v2**: mostra estrelas, cidade e o selo 🏅 de recorde SEM continue
- [x] **Fantasma do recorde**: sua skin com 10% de opacidade parada no ponto do seu recorde
- [x] **Menu hub**: JOGAR fixo embaixo (sempre clicável); menus Fases · Ranking · Skins · Continue; galeria de skins (amplia com nome; bloqueadas em cinza); Continue treme com 3+ propinas; loja futura desabilitada
- [x] **Skins v2**: 1 desbloqueável por cidade, por votos ACUMULADOS jogando aquela cidade — Azul (100 em SP), Rosa (150 no RJ), Roxo (200 em BSB) + Dourado (compra, 10 💵)
- ⚠️ Backend v2 pronto mas NÃO deployado: precisa do seu OK (migration no banco + Edge Function + app + zerar scores de teste)

### 7D — Identidade e compartilhamento
- [ ] Login com **Google** em 2 cliques (sem perder o histórico anônimo)
- [ ] Nome de usuário editável, exibido no ranking
- [ ] Tela de fim de partida social: ranking em destaque por ~3s (seu score, seu top-7, top-7 global), **mas o "Jogar de novo" disponível desde o primeiro instante**
- [ ] **Imagem de compartilhamento** com moldura + score + convite "bata este recorde em <link>" — WhatsApp/Instagram/etc. **Funciona sem login** (logado, sai com seu nome)

### 7E — Robustez e fechamento
- [ ] Sem internet no meio da partida? O jogo continua normal; o score entra numa fila e é enviado quando a conexão voltar
- [ ] Revisão de segurança de tudo que é novo
- [ ] Testes finais + deploy (sempre com OK explícito do dono)

## 3.5 📌 REGISTRO DO 2º BRAINSTORM (2026-07-10) — Mundos, Estrelas e Economia
> Solicitações do dono após testar a 7B. NADA daqui pode ser esquecido.
> Status: EM DISCUSSÃO (algumas perguntas abertas abaixo). Quando fechadas,
> viram D-16+ no DECISIONS.md e novas tasks na Fase 7.

**Mudança estrutural pedida: de corrida infinita para FASES/MUNDOS com fim.**

1. **Gema — correção urgente:** gemas estão nascendo em posições IMPOSSÍVEIS
   (ex.: colada após obstáculo baixo — sem tempo de deslizar + saltar).
   Difícil ≠ impossível. Primeira gema deve ser relativamente FÁCIL (longe de
   obstáculos, cedo na fase). Nova ideia: "barra horizontal flutuante" com
   gema EM CIMA e votos EMBAIXO — o jogador ESCOLHE um ou outro (replay para
   pegar o resto). Gema coletada NÃO reaparece na mesma posição da fase
   (coleção persistente por fase). Ao morrer após a 1ª gema: pop-up com
   animação de vitória EXPLICANDO a gema (3 = 1 continue).
2. **Gema = moeda do jogo:** compra continues e skins. No menu: botão com
   ícone de gema + palavra "continue" (mostra contagem atual; ali entrará a
   compra com dinheiro real, DESABILITADA por ora — Fase 9). Dono quer
   RENOMEAR o objeto/conceito "gema" no futuro (manter mecânica).
3. **Badge anti-cheat no ranking:** recordes SEM uso de continue ganham um
   selo ao lado da pontuação (exige gravar continue_used no banco).
4. **Cidades viram MUNDOS/FASES selecionáveis no menu** (botão "cidades" com
   mapa): fase tem FIM; chegar ao fim = pop-up de vitória + desbloqueio do
   próximo mundo (recompensa explícita — a transição atual pareceu
   "entardeceu, continuo na mesma fase"). Transição visual pode até ficar,
   mas o FIM DE FASE com pop-up animado é o essencial. Só se chega à fase 3
   jogando a 2; cada fase ligeiramente mais difícil (fase 1 pode ficar um
   pouco MAIS FÁCIL que o atual, mas não muito).
5. **"FIM DO MUNDO" no HUD:** contagem REGRESSIVA de distância durante a fase
   (senso de "cheguei tão perto do fim, na próxima eu consigo"). Distância
   percorrida fica para o ranking.
6. **Estrelas + multiplicador de score:** fim de fase dá classificação:
   ⭐ morreu no caminho ("chegue até o final p/ 2-3 estrelas") · ⭐⭐ chegou ao
   fim vivo com um mínimo de coletáveis ("colete todos p/ 3") · ⭐⭐⭐ chegou ao
   fim com TODOS os coletáveis (escolha gema-vs-voto na barra NÃO penaliza).
   Multiplicador: 2⭐ = score ×2, 3⭐ = score ×3. (Impacto técnico: fórmula da
   Edge Function e schema de scores precisam de versão 2.)
7. **Skins:** desbloqueio ficou fácil demais (rosa saiu rápido). Máximo
   1 skin desbloqueável POR MUNDO (por votos/gemas naquele mundo). Menu:
   botão com desenho de personagem + palavra "skins" → galeria; skin clicada
   fica GRANDE com nome do personagem; bloqueadas em TONS DE CINZA
   ("offline"), não cadeado.
8. **Conexões da economia (modelo do dono):**
   - Distância → desbloqueia MUNDOS (chegando ao fim da fase)
   - Votos → desbloqueiam SKINS (exceto as de compra)
   - Gemas → MOEDA (compra continues e skins)

**Perguntas fechadas em 2026-07-10 (viraram D-16…D-20 no DECISIONS.md):**
só 3 fases com fim na v1.0 (sem modo infinito — risco de empate no teto do
ranking aceito conscientemente pelo dono; modo infinito no backlog); layouts
FIXOS confirmados; SP 600m / RJ 900m / Brasília 1200m; loja futura = comprar
GEMAS com dinheiro real (Fase 9). Implementação: seção 7C do specs/tasks.md.

**Feedback do dono em 2026-07-10 (após aprovar T07C-01/02) — virou D-21…D-24:**
1. **A gema agora se chama PROPINA** 💵: nota verde com $ no centro (era o
   losango roxo). Todos os textos do jogo passam a dizer propina/propinas.
   (No código-fonte os identificadores continuam `gem` — convenção técnica.)
2. **Bloco flutuante vira obstáculo-plataforma:** mais espesso; o player PODE
   subir em cima (e pegar a propina); bater nas LATERAIS ou no FUNDO do bloco
   MATA (igual aos obstáculos verticais). Referência: imagem enviada pelo dono.
3. **Marcador do recorde vira "fantasma":** a barra do recorde é substituída
   pela skin do player com 10% de opacidade parada no ponto do recorde.
4. **Menu hub (mockup do dono):** botão JOGAR fixo no canto inferior,
   pressionável a qualquer momento; acima dele os menus na ordem
   Fases · Ranking · Skins · Continue; o menu Continue treme a cada 1s
   quando o jogador tem 3+ propinas.
> Obs.: um texto colado na mensagem do dono ("[Pasted text #1]", 3 linhas) não
> chegou ao assistente — se continha algo além do digitado, precisa ser reenviado.

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
