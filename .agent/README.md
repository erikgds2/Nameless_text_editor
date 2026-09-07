# Agente local

Divisao de trabalho: o Claude escreve a spec e revisa o resultado; o modelo do
Ollama escreve o codigo. Nenhum token remoto e gasto no meio do caminho.

## Uso

    node .agent/run.mjs .agent/tasks/<spec>.md
    AGENT_MODEL=qwen2.5-coder:14b node .agent/run.mjs .agent/tasks/<spec>.md

## Formato da spec

Frontmatter + instrucoes em markdown:

    ---
    model: qwen3-coder:30b
    context: arquivos que o modelo precisa ler
    allow: arquivos que ele pode escrever (qualquer outro e recusado)
    verify: npm run build
    attempts: 3
    ---

## O que o run.mjs faz

1. Monta o prompt com o conteudo atual dos arquivos de contexto.
2. Pede a resposta em blocos `<<<FILE caminho ... >>>END`.
3. Recusa qualquer arquivo fora de `allow`.
4. Aplica, roda `verify` e, se falhar, devolve o erro ao modelo — ate `attempts` vezes.
5. Se todas falharem, reverte tudo (backup em `.agent/.backup`).
6. Escreve `.agent/report.json` e imprime um resumo de 4 linhas.
