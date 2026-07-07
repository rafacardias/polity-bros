# 🎮 Polity Bros

> Auto-runner satírico-político onde arquétipos políticos correm pelo Brasil desviando de fake news, CPIs e buracos na estrada.

## 📋 Sobre

Polity Bros é um jogo web/mobile construído com Phaser 3, hospedado em uma plataforma multi-jogos. O primeiro jogo é um auto-runner no estilo Geometry Dash / Jetpack Joyride, com sátira política leve e cômica.

## 🏗️ Stack

| Camada | Tecnologia |
|---|---|
| Game Engine | Phaser 3 + Vite + TypeScript |
| Shell/UI | React + Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, Realtime) |
| Hosting | Vercel |
| Ads | Google AdSense |
| Analytics | Vercel Analytics + Google Analytics |

## 📁 Estrutura

```
/polity-bros
  /specs          # Specs SDD — fonte da verdade
  /game           # Phaser 3 game
  /web            # React platform shell
  /supabase       # Migrations
  /assets-raw     # Assets brutos (não deploya)
  /docs           # Documentação
```

## 🚀 Setup

```bash
# Instalar dependências do jogo
cd game && npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build
```

## 📖 Documentação

- [Game Design Document](docs/GDD.md)
- [Specs Técnicas](specs/)
- [Como Adicionar Novos Jogos](docs/adding-games.md)
- [Como Adicionar Personagens](docs/adding-characters.md)

## 🔧 Desenvolvimento

Este projeto usa Spec-Driven Development. Toda feature começa como spec em `/specs` antes de ser codada. Veja `CLAUDE.md` para contexto completo do projeto.

## 📄 Licença

Proprietary — © 2026 Polity Bros
