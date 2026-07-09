# 🎮 Polity Bros

> Auto-runner satírico-político onde arquétipos políticos correm pelo Brasil desviando de fake news, CPIs e buracos na estrada.

## 📋 Sobre

Polity Bros é um jogo web/mobile construído com Phaser 3, hospedado na **Polity Games** — plataforma multi-jogos com menu principal em React. O primeiro jogo é um auto-runner no estilo Geometry Dash / Jetpack Joyride, com sátira política leve e cômica.

## 🏗️ Stack

| Camada | Tecnologia |
|---|---|
| Game Engine | Phaser 3 + Vite + TypeScript (`strict`) |
| Shell/UI | React + Vite + Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth anônima, Edge Functions) |
| Hosting | Vercel |
| Analytics | Vercel Analytics + Google Analytics |

## 📁 Estrutura

Monorepo com npm workspaces (`game` + `web`):

```
/game           # Pacote do jogo (Phaser 3 + Vite + TS) — exporta createGame()
/web            # Shell da plataforma (React) — menu, ranking, monta o Phaser
/supabase       # Migrations + Edge Functions (submit-score)
/specs          # Specs SDD — fonte da verdade (requirements/design/tasks)
/docs           # Documentação de entrega e manuais
/assets-raw     # Assets brutos (não vai pro deploy)
```

## 🚀 Setup

```bash
# Instalar dependências (raiz — resolve game + web via workspaces)
npm install

# Variáveis de ambiente: copie .env.example → .env na raiz e preencha
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (projeto Supabase "Polity Bros")
cp .env.example .env

# Rodar o jogo dentro da plataforma (React shell + Phaser)
npm run dev:web

# Rodar só o jogo, isolado (sem o shell React)
npm run dev:game
```

Não é preciso rodar Supabase localmente: tudo aponta pro projeto remoto via
`.env`. A auth é anônima (RF-14) e a Edge Function `submit-score` — único
caminho de escrita de score (D-08) — já está deployada nesse projeto.

### Qualidade

```bash
npm run typecheck   # game + web
npm run lint        # game + web + supabase/functions
npm run build       # game + web
```

## 📖 Documentação

- [Game Design Document](GDD.md)
- [Specs Técnicas](specs/)
- [Decisões de Arquitetura (ADR)](docs/DECISIONS.md)
- [Como Adicionar Novos Jogos](docs/adding-games.md)
- [Como Adicionar Personagens](docs/adding-characters.md)

## 🔧 Desenvolvimento

Este projeto usa Spec-Driven Development. Toda feature começa como spec em `/specs` antes de ser codada. Veja `CLAUDE.md` para contexto completo do projeto.

## 📄 Licença

Proprietary — © 2026 Polity Bros
