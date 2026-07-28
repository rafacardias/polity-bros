# Como Adicionar Novos Personagens

> Manual para adicionar personagens ao Polity Bros Runner

> ⚠️ **Este documento está defasado.** O `characters.json` descrito abaixo não
> existe mais: o catálogo real vive em `game/src/lib/skins.ts` (`SKINS`) e os
> assets em `game/src/data/assets-manifest.ts`. A seção "Assets por
> personagem", logo abaixo, é a que vale hoje. O restante fica como histórico
> até alguém reescrever o manual.

## Assets por personagem (fonte da verdade, 2026-07-28)

Todo personagem novo precisa de **4** arquivos em `game/public/assets/sprites/`:

| Arquivo | O que é | Onde aparece |
|---|---|---|
| `<char>.png` | retrato de frente, parado | **só** na galeria de skins do menu |
| `<char>-run.png` | sheet de 4 frames da corrida | correndo no chão |
| `<char>-slide.png` | sheet de 4 frames da corrida agachada | esquiva (deve ser MAIS BAIXO e MAIS ESTREITO que a corrida) |
| `<char>-air.png` | frame único do pulo/queda — **D-29** | no ar |

O `-air` **não é desenhado à mão**: é o frame 1 do próprio `-run`, recortado.
Sem ele o personagem salta no retrato de frente, encarando a câmera (o bug que
o dono pegou em 2026-07-28). Extração:

```bash
# frameWidth/frameHeight vêm de SPRITESHEET_ASSETS no assets-manifest
ffmpeg -y -i <char>-run.png -vf "crop=<fW>:<fH>:<fW>:0" <char>-air.png
```

Registre os 4 keys no `assets-manifest.ts` (estáticos em `SPRITE_ASSETS`,
sheets em `SPRITESHEET_ASSETS`) e valide o agachado com:

```bash
node scripts/measure-slide-arms.mjs <char>   # braços precisam ANIMAR
```

A hitbox nunca muda (`SIZES.PLAYER`, RN-07): personagens trocam de arte, não
de tamanho.

---

## Estrutura de Dados (histórico — não reflete o código atual)

Cada personagem era definido em `/game/src/data/characters.json`:

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
