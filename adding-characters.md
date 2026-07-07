# Como Adicionar Novos Personagens

> Manual para adicionar personagens ao Polity Bros Runner

## Estrutura de Dados

Cada personagem é definido em `/game/src/data/characters.json`:

```json
{
  "id": "conservador",
  "name": "O Conservador",
  "archetype": "direita",
  "ability": "double_jump",
  "unlock_votes": 0,
  "sprite": "player-conservador.png",
  "frames": {
    "idle": [0],
    "run": [1, 2, 3, 4],
    "jump": [5],
    "fall": [6],
    "hurt": [7],
    "victory": [8],
    "defeat": [9]
  },
  "physics": {
    "gravity": 800,
    "jump_velocity": -400,
    "run_speed": 200
  }
}
```

## Passos para Adicionar um Personagem

1. Adicionar entrada em `characters.json`
2. Adicionar sprite em `game/public/assets/sprites/`
3. Adicionar spec de habilidades em `specs/`
4. Testar no celular (DoD)
5. Commit com `feat: add character [nome]`

## Habilidades Disponíveis

| ID | Nome | Efeito |
|---|---|---|
| `double_jump` | Pulo Duplo | Permite segundo pulo no ar |
| `dash` | Dash | Avança rapidamente por 1s |
| `shield` | Escudo | Imune a obstáculos por 3s |
