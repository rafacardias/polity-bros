# Como Adicionar Novos Jogos na Plataforma

> Manual para adicionar jogos futuros à plataforma multi-jogos Polity Bros

## Arquitetura

Cada jogo é um módulo independente que roda dentro do GameShell React:

```
/web/src/components/GameShell.tsx   → Container que carrega o jogo
/web/src/games/
  ├── runner/                        → Jogo 1: Polity Bros Runner
  │   └── index.tsx
  ├── castle-crush/                  → Jogo 2: Castelos do Poder (futuro)
  │   └── index.tsx
  └── quiz/                          → Jogo 3: Quiz do Voto (futuro)
      └── index.tsx
```

## Passos para Adicionar um Novo Jogo

1. Criar pasta em `web/src/games/[nome-do-jogo]/`
2. Criar `index.tsx` que renderiza o container do Phaser
3. Adicionar entrada no grid de jogos do menu principal
4. Criar spec em `/specs/[nome-do-jogo]-*.md`
5. Segir o mesmo padrão de comunicação via CustomEvents

## Padrão de Comunicação

Todos os jogos comunicam com o shell via CustomEvents:
- `game:score` → jogo emite, shell atualiza leaderboard
- `game:gameover` → jogo emite, shell mostra ad
- `menu:play` → shell emite, jogo inicia
