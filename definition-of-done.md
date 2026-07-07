# Definition of Done (DoD) — Polity Bros

## O que significa "pronto"?

Uma tarefa (task da spec) só é considerada **PRONTA** quando TODOS os critérios abaixo são atendidos:

## Critérios Obrigatórios

### 1. Implementação
- [ ] Código implementado exatamente conforme a spec correspondente
- [ ] Nenhuma funcionalidade extra (não-especada) foi adicionada
- [ ] Tipos TypeScript corretos (sem `any` desnecessário)

### 2. Teste
- [ ] Testado no celular real (não só no desktop)
- [ ] Sem erros de console no navegador (F12 → Console)
- [ ] Não quebra funcionalidades existentes

### 3. Versionamento
- [ ] Commitado no Git com conventional commit message
- [ ] Um commit = uma tarefa (atômico)
- [ ] Branch feature/ correspondente mergeada para dev

### 4. Documentação
- [ ] Comentários JSDoc em funções públicas
- [ ] README atualizado se necessário
- [ ] Spec marcada como [x] no tasks.md

## Níveis de Bug

| Nível | Definição | Ação |
|---|---| Corrigir antes de avançar |
| P0 | Quebra o jogo (crash, tela branca, impossível jogar) | Corrigir antes de avançar |
| P1 | Afeta experiência significativamente (lag visível, áudio bugado) | Corrigir antes do lançamento |
| P2 | Cosmético ou edge case raro | Pode ir para pós-launch |
| P3 | Nice-to-have polish | Backlog v2 |

## Exceções

- Assets placeholder (retângulos coloridos) são aceitáveis até a Fase 3 de assets
- Durante o Vertical Slice (Fase 4), P1s podem ser tolerados temporariamente
- Após o Gate de Diversão, P1s devem ser corrigidos antes de escalar

## Fluxo de Aprovação

```
Task implementada → Auto-verificação (DoD checklist) → Teste no celular → Commit → Marcar [x] na spec
```

Nenhuma fase avança para a próxima sem que TODAS as tasks P0 da fase anterior estejam [x].
