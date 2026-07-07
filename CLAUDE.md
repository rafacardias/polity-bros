# CLAUDE.md — Polity Bros (na plataforma Polity Games)

> Entrypoint. Carregue a spec ou o doc da tarefa — não escaneie o repo inteiro.
> Projeto vibe-coding / spec-driven: o dono NÃO é técnico. Seja explícito,
> explique decisões em linguagem clara e sinalize riscos proativamente.

## O que é este projeto
**Polity Bros** é um auto-runner satírico-político (web/mobile) onde arquétipos
políticos correm pelo Brasil desviando de obstáculos (fake news, CPIs, buracos).
Vive dentro da **Polity Games** — plataforma multi-jogos com menu principal,
extensível a novos títulos.

> **Nomenclatura:** *Polity Bros* = o jogo. *Polity Games* = a plataforma/shell.

## Arquitetura em uma frase
Phaser roda em um **container div** no mesmo documento do React (**nunca iframe**).
Comunicação React ↔ Phaser via **CustomEvents** (só funcionam no mesmo `window`).
Este é o contrato para plugar qualquer jogo novo na Polity Games.

## Stack
| Camada | Tecnologia |
|---|---|
| Game Engine | Phaser 3 + Vite + TypeScript (`strict`) |
| Shell/UI | React + TypeScript + Tailwind CSS |
| Backend/DB | Supabase (PostgreSQL, Auth, Realtime, RLS, Edge Functions) |
| Hosting | Vercel |
| Ads | Google AdSense (web) / AdMob (PWA) |
| Analytics | Vercel Analytics + Google Analytics |
| AI Coding | Claude Code (principal) + Cursor IDE |
| AI Revisora | GLM-4.7-Flash (segunda opinião, gratuito) |

---

## Estrutura de pastas

```
/polity-bros
│
├── /specs                      # Specs SDD (a fonte da verdade)
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
│
├── /game                       # Código do jogo (Phaser + Vite + TS)
│   ├── /src
│   │   ├── main.ts             # ⭐ ponto de entrada (cria o Game, registra scenes)
│   │   ├── /scenes             # Boot, Preload, Game, GameOver  (SEM Menu → D-07)
│   │   ├── /entities           # Player, Obstacle, Collectible   (SEM Enemy → D-06)
│   │   ├── /systems            # Input, Physics, Spawner, Score, Progression, Audio (SEM Ads → D-06)
│   │   ├── /config             # GameConfig, constants, balance
│   │   └── /data               # ⭐ manifests de assets, tabelas de config (JSON)
│   ├── /public
│   │   └── /assets             # ⭐ Sprites, áudio, fonts (assets OTIMIZADOS servidos)
│   ├── index.html
│   ├── vite.config.ts          # ⭐ bundler (essencial pra Phaser moderno)
│   ├── tsconfig.json           # ⭐ TypeScript strict (RN-06)
│   └── package.json
│
├── /web                        # Landing page + plataforma multi-jogos
│   ├── /src
│   │   ├── /components          # GameShell, MenuScreen, Leaderboard  (MenuScreen aqui → D-07)
│   │   ├── /pages
│   │   └── /lib                # supabase client (só anon key) + submitScore (chama Edge Fn → D-08)
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── /supabase                   # Migrations, schemas e Edge Functions
│   ├── /migrations             # scores (coluna votes), RLS, índices → D-04, D-08
│   └── /functions
│       └── /submit-score       # ⭐ caminho ÚNICO de escrita (service role) → D-08
│
├── /assets-raw                 # Assets brutos (antes de otimizar) — NÃO vai pro deploy
│
├── /docs                       # Documentação de entrega + manuais
│   ├── DECISIONS.md            # ⭐ ADR (D-01…D-08)
│   └── adding-games.md         # contrato de CustomEvents p/ novos jogos
│
├── CLAUDE.md                   # Contexto do projeto para a IA
├── .cursorrules                # Padrões de código
├── .gitignore                  # ⭐ ignora node_modules, .env, dist
├── .env.example                # ⭐ modelo de variáveis (Supabase anon; SERVICE_ROLE só na Edge Fn → D-08)
└── README.md

```
---

## Non-negotiables
- **Nada é codado sem spec** em `/specs`. A IA implementa a partir da spec, não inventa escopo.
- Cada task da spec = **1 commit atômico** (conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`).
- TypeScript `strict: true` — sem `any` implícito.
- **Entities não acessam Supabase** e **não emitem/escutam CustomEvents** — quem faz a ponte são Scenes/Systems.
- **Object pooling obrigatório** para entidades spawnadas em loop (Obstacle, Collectible, Enemy). Proibido `new`/`destroy` dentro do game loop.
- **RLS ativada** em toda tabela de negócio. Leitura de ranking pública; escrita restrita a `auth.uid() = player_id`.
- **Scores do cliente são não-confiáveis** — validação de plausibilidade (sanity check + rate limit) em **Edge Function** antes do insert. RLS sozinho não previne cheat.
- Nunca comitar `.env`, `node_modules`, `/assets-raw`, `/game/dist`.
- Fail fast em secrets ausentes — nunca `process.env.KEY || 'fallback'`.
---

---

## Convenções de código
- **TypeScript em modo estrito** (`strict: true`) — sem `any` implícito.
- Cada arquivo = uma responsabilidade.
- Funções puras onde possível (especialmente em `/systems`).
- **Entities não acessam Supabase diretamente** — passam por Systems.
- **Entities não emitem/escutam CustomEvents** — quem faz a ponte React↔Phaser são as Scenes/Systems.
- Nomes de arquivos: **PascalCase** para classes (`Player.ts`), **kebab-case** para configs (`game-config.ts`).
- Commits: **conventional commits** (`feat:`, `fix:`, `docs:`, `refactor:`).
- **Object pooling obrigatório** para entidades spawnadas em loop (Obstacle, Collectible, Enemy) — proibido `new`/`destroy` dentro do game loop.
- Não comitar `.env`, `node_modules`, `/assets-raw`, ou `/game/dist`.

## Systems (lógica pura)
| Sistema | Responsabilidade |
|---|---|
| InputSystem | Única fonte de input (tap/click/tecla → ação de "pulo") |
| PhysicsSystem | Gravidade, velocidade, jump arc |
| SpawnerSystem | Geração procedural + object pooling |
| ScoreSystem | Pontos, combos, multiplicadores |
| ProgressionSystem | Dificuldade progressiva (velocidade, densidade de spawn) |
| AudioSystem | SFX/música, mute/volume, respeita autoplay policy |
| AdsSystem | Intersticiais e rewarded ads |

## Regras de desenvolvimento (Spec-Driven)
1. Nada é codado sem spec correspondente em `/specs`.
2. A IA implementa a partir da spec — não inventa escopo. Se faltar spec, PARE e peça.
3. Cada task da spec = 1 commit atômico.
4. Placeholder art (retângulos coloridos) até a Fase 3 de assets.
5. Congelar escopo: ideias novas vão para backlog, não para o MVP.

## Segurança (Supabase)
- Todas as tabelas (`scores`, `unlocks`) têm **RLS ativada**.
- Leitura de ranking é pública; escrita é restrita a `auth.uid() = player_id`.
- **Scores do cliente são não-confiáveis:** validação de plausibilidade (sanity check, rate limit) deve ocorrer em **Edge Function** antes do insert. RLS sozinho não previne cheat.
- Índices em `scores (game_id, score desc)` e `scores (created_at desc)` para performance de ranking.
- Fail fast em secrets ausentes — nunca `process.env.KEY || 'fallback'`.
- Chaves de serviço (service_role) nunca em variáveis expostas ao cliente (`VITE_`/`NEXT_PUBLIC_`).

## Princípios do projeto
- **Spec primeiro, código depois.**
- **Vertical slice primeiro** — UMA fase 100% jogável antes de escalar.
- **Congelar escopo** — tudo fora da spec do MVP = backlog v2.

---

## Filtro Permanente (checar antes de cada entrega)
1. Existe spec correspondente em `/specs`?
2. RLS respeitada + score passa por validação server-side?
3. Loop do jogo mantém ~60fps no **celular real** (pooling, sem travadas)?
4. Feature está no escopo do MVP + atende a Definition of Done?

---

## Reference Map
| Necessidade | Arquivo |
|---|---|
| Requisitos do MVP | `specs/requirements.md` |
| Arquitetura & design técnico | `specs/design.md` |
| Tasks / backlog do MVP | `specs/tasks.md` |
| Como adicionar um jogo novo à plataforma | `docs/adding-games.md` |
| Como adicionar um personagem | `docs/adding-characters.md` |
| Definition of Done | `docs/definition-of-done.md` |
| Schema SQL + RLS | `supabase/migrations/` |
| Regras do Cursor | `.cursorrules` |

---

## Tooling Index
> Índice tarefa → ferramenta. Ferramentas realmente disponíveis no ambiente do dono.

### CLIs (instaladas)
| CLI | Origem | Quando usar |
|---|---|---|
| `supabase` | Homebrew | Migrations, RLS, DB local, deploy de Edge Functions |
| `vercel` | npm | Deploy, env vars, logs de produção |
| `gh` | Homebrew | PRs, issues, releases no GitHub |
| `ffmpeg` | Homebrew | Otimização/conversão de áudio e vídeo (assets) |
| `puppeteer` | npm | Screenshot da landing/menu para revisão visual |
| _(libtiff, lima — libs de sistema, não usadas diretamente no fluxo)_ | Homebrew | — |

### MCPs conectados (relevantes ao projeto)
| MCP | Uso no Polity Bros |
|---|---|
| **Supabase** | Query de schema, checar tabelas/RLS, inspecionar migrations |
| **Vercel** | Status de deploy, env vars, logs |
| **Cloudflare Developer Platform** | Se usar CDN/DNS/Workers para assets ou domínio |
| **Notion** | Backlog v2, notas de produto, roadmap |
| **Atlassian Rovo (Jira)** | Só se adotar Jira para tasks (hoje as tasks vivem em `/specs`) |
| **Google Drive / Gmail / Calendar** | Entrega de arquivos, comunicação, prazos — apoio, não código |

> MCPs "Needs authentication" (Tavily, Canva, Miro, Airtable, ClickUp, etc.)
> NÃO estão ativos. Não assuma disponibilidade — se precisar de um, avise o dono
> para autenticar primeiro.

### Skills
<!-- PREENCHER: listar `.claude/skills/` (projeto) e `~/.claude/skills/` (global).
     Só listar skills que existirem de fato. Não inventar. -->

---

## Definition of Done (resumo — completo em docs/definition-of-done.md)
- [ ] Implementado conforme spec
- [ ] TypeScript compila sem erros (`strict`), sem `any` implícito
- [ ] Testado no **celular real** (não só desktop) — ~60fps estável
- [ ] Sem erros/warnings de console no navegador
- [ ] RLS respeitada; nenhuma escrita burlando policies
- [ ] Commitado com conventional commits
- [ ] Documentado no README ou `/docs`

---

## Regras Hard

### ❌ DOWN migrations proibidas em produção
Nunca `supabase db reset` / `migration down` no banco de produção.
Rollback = **nova migration UP** que desfaz a mudança.
Confirmar com o dono antes de qualquer migration em produção.
Ambiente local é livre.

### Git — paths com caracteres especiais
```bash
git add -- "assets-raw/arquivo.ext"
```

<!-- Writeback substituído pela seção "📓 Segundo Cérebro" ativa (abaixo). -->
