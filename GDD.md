# 📜 Game Design Document (GDD) — Polity Bros

> Versão: 1.0 | Status: RASCUNHO | Data: 03/07/2026
> Este é um documento vivo. Atualize conforme as decisões evoluírem.

---

## 1. Pitch (1 frase)

Um auto-runner satírico-político onde arquétipos políticos correm pelo Brasil desviando de fake news, CPIs e buracos na estrada, competindo por votos e posição no ranking.

## 2. Visão Geral

| Atributo | Valor |
|---|---|
| **Nome** | Polity Bros |
| **Gênero** | Auto-runner / Endless runner |
| **Plataforma** | Web/Mobile (PWA) |
| **Engine** | Phaser 3 + Vite + TypeScript |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime) |
| **Hosting** | Vercel |
| **Modelo** | Free-to-play + Ads + Rewarded |
| **Tom** | Cômico, satírico leve (sem ódio, sem agressão) |
| **Inspirações** | Geometry Dash, Jetpack Joyride, Flappy Bird |

## 3. Core Loop

```
Menu → Selecionar Personagem → Correr (auto) → Pular (tap) → Coletar Votos
→ Desviar de Obstáculos → Morrer → Ver Score → Tentar de novo → Subir no Ranking
```

### Loop de Retenção (sessão)
1. Jogador toca "Jogar"
2. Corre automaticamente, pula obstáculos, coleta votos
3. Morre → vê score + posição no ranking
4. Rewarded ad opcional para reviver
5. "Tentar de novo" (loop) ou "Compartilhar"

### Loop de Retenção (diária)
1. Volta para subir no ranking
2. Desbloqueia novo personagem ao atingir X votos totais
3. Vê novos obstáculos (atualização semanal)
4. Compartilha com amigos para competir

## 4. Público-Alvo

- Brasileiros 18-45, engajados politicamente (dos dois lados)
- Consumidores de humor político (meme, charge, sátira)
- Jogadores casuais mobile (sessões curtas, competitividade social)

## 5. Mecânicas de Gameplay

### 5.1 Controles
- **Tap na tela** = Pular (um toque = um pulo)
- **Tap durante o pulo** = Pulo duplo (se o personagem tiver a habilidade)
- Não há botão de correr — o player se move automaticamente

### 5.2 Física
- Gravidade constante
- Pulo com arco parabólico (altura e duração fixos por personagem)
- Velocidade de corrida aumenta gradualmente (dificuldade progressiva)

### 5.3 Sistema de Pontuação

| Elemento | Pontos |
|---|---|
| Voto coletado | 10 pts |
| Distância (por metro) | 1 pt |
| Combo (3 votos seguidos sem morrer) | x2 multiplicador |
| Near miss (passar perto de obstáculo) | 5 pts bônus |

### 5.4 Dificuldade Progressiva
- Velocidade aumenta a cada 500m
- Frequência de obstáculos aumenta a cada 300m
- Novos tipos de obstáculos introduzidos a cada 1000m
- Boss aparece a cada 2000m

## 6. Personagens (Arquétipos)

> ⚠️ NÃO usar imagens reais de políticos. Usar caricaturas/arquétipos reconhecíveis.
> Validar legalmente conforme STF (sátira protegida) e TSE (Res. 23.748/2026).

### Jogáveis (MVP: 3)

| Personagem | Arquétipo | Habilidade Especial | Desbloqueio |
|---|---|---|---|
| O Conservador | Terno, gravata, pose rígida | Pulo duplo | Início |
| O Progressista | Camiseta de movimento, bandana | Dash (avança rápido) | 5.000 votos totais |
| O Centrão | Obeso, sorriso maroto | Escudo temporário (3s) | 15.000 votos totais |

### Bosses / Antagonistas (MVP: 2-3)

| Boss | Aparência | Comportamento | Quando aparece |
|---|---|---|---|
| O Sistema | Monstro amorfo, muitos braços | Regenera HP a cada turno | A cada 2000m |
| A CPI | Mesa de julgamento voadora | Lança "acusações" (projéteis) | A cada 5000m |

## 7. Obstáculos e Inimigos

### Obstáculos Estáticos
- Buraco na estrada (caminho)
- Caixa de Promessa (bloqueia caminho)
- Muro de Polêmica (precisa pular)

### Obstáculos Dinâmicos
- Fake News voadora (voa em arco)
- CPI que persegue (segue do topo)
- Manifestação (bloqueia trecho, precisa timing)

### Coletáveis
- 🗳️ Voto (moeda, 10 pts)
- ⭐ Estrela (combo, ativa multiplicador)
- 📦 Baú (rewarded ad opcional)

## 8. Cenários / Fases

| Tema | Visual | Obstáculos Específicos |
|---|---|---|
| Brasília | Congresso, Esplanada dos Ministérios | Muro de Polêmica, CPI |
| Favela | Comunidade, becos, lajes | Buraco, Manifestação |
| Estrada | BR-101 esburacada, postes | Buraco, Fake News |
| Congresso | Corredores, gabinetes, plenário | CPI, Caixa de Promessa |

### Parallax
- 3-4 layers por cenário (background, midground, foreground, UI)
- Velocidade diferente por layer para dar profundidade

## 9. Monetização

### 9.1 Ads

| Tipo | Quando | Detalhe |
|---|---|---|
| Intersticial | Após 3 game overs | Full-screen, skip após 5s |
| Rewarded | Game over | "Assista para reviver" (1x por run) |
| Banner | Menu principal | Discreto, nunca no jogo ativo |

### 9.2 Monetização V2 (pós-MVP)
- Skins de personagens
- Novos personagens premium
- Remove ads (R$ 9,90)

## 10. Plataforma Multi-Jogos

- Menu principal com grid de jogos (hoje: 1 slot ativo)
- Slots futuros: Castle Crush-like (jogo 2), Quiz (jogo 3)
- Ranking unificado entre jogos
- Share cross-game ("Joguei X jogos no Polity Bros!")

## 11. Viralização

### Mecânicas Embutidas
- Share com score + link após game over
- "Desafie um amigo no WhatsApp" (abre WhatsApp com mensagem)
- Leaderboard com mensagens provocativas
- Conteúdo "clipável" (momentos engraçados para TikTok/Reels)

### Estratégia de Conteúdo
- "Obstáculo da semana" baseado em evento político real
- Novo personagem a cada 2 semanas
- Eventos sazonais (debate = boss especial)

## 12. Métricas de Sucesso do MVP

| Métrica | Meta |
|---|---|
| Jogadores na 1ª semana | 1.000 |
| Sessão média | > 3 min |
| Retenção D1 | > 30% |
| Share rate | > 5% |
| Ad impression rate | > 80% |

## 13. Aspectos Legais

- ✅ Arquétipos genéricos, não pessoas reais
- ✅ Disclaimer de sátira visível no menu
- ✅ Sem uso de imagens reais de políticos
- ✅ Conformidade com Resolução 23.748/2026 do TSE
- ✅ STF liberou sátiras políticas (2018)
- ⚠️ Tom cômico, não agressivo (evita configurar difamação)

## 14. Referências Visuais

- Geometry Dash (auto-runner + precisão de timing)
- Jetpack Joyride (progressão + coletáveis)
- Flappy Bird (simplicidade mobile + frustração viciante)
- Charges brasileiras (Ziraldo, Angeli — inspiração de estilo)

---

> **Princípio deste documento:** Ele é a fonte da verdade. Se algo não está aqui, não existe no MVP. Ideias novas vão para o backlog v2.
