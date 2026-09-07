# Como este projeto e construido

Duas vias de delegacao convivem aqui:

1. **Modelos proprios do Claude**, roteados por tipo de acao — e a via principal.
   A politica esta em `ROTEAMENTO.md`, o desempenho em `registro.jsonl`.
2. **Modelo local via Ollama** (`run.mjs`), mantido para trabalho em lote
   assincrono e para quando o codigo nao puder sair da maquina.

A regra comum as duas: **nada e delegado sem verificacao automatica**, e o
Opus revisa o diff antes de qualquer commit.

## Via 1 — modelos proprios

    Agent(subagent_type: general-purpose, model: "haiku" | "sonnet")

Consulte `ROTEAMENTO.md` para saber qual modelo recebe qual acao. Depois de cada
delegacao, registre o resultado:

    node .agent/registro.mjs add '{"tarefa":"...","tipo":"...","modelo":"sonnet","resultado":"acerto"}'
    node .agent/registro.mjs relatorio

`resultado` e um de: `acerto`, `acerto-com-correcao`, `erro`. O relatorio diz
quando a amostra ja justifica trocar de modelo.

## Via 2 — agente local (Ollama)

O Claude decide o que fazer e revisa; o modelo do Ollama escreve o codigo.

### Uso

    node .agent/run.mjs .agent/tasks/<spec>.md
    AGENT_MODEL=qwen2.5-coder:14b node .agent/run.mjs .agent/tasks/<spec>.md

## Quando delegar (a regra de roteamento)

Vale mandar para o modelo local quando **as quatro** forem verdade:

1. **Contrato fechado** — dá para escrever o "pronto" numa frase objetiva.
2. **Alavancagem ≥ 3:1** — o código gerado é pelo menos três vezes maior que a
   spec necessária para descrevê-lo. Se descrever custa quase o mesmo que fazer,
   não delegue: não há economia nenhuma.
3. **Verificável por máquina** — existe comando que aprova ou reprova sozinho.
   Sem isso, o Claude precisa ler todo o diff, e a economia evapora.
4. **Pouco julgamento** — não depende de gosto, arquitetura ou segurança.

Fica com o Claude, sempre:

- Design visual e escolha de tokens (mas *aplicar* tokens já decididos delega bem)
- Arquitetura, dependências novas, fronteira de processos do Electron
- Qualquer coisa que toque segurança (IPC, `contextBridge`, acesso a disco)
- Correções de uma a cinco linhas — descrever custa mais que fazer
- Escrever a própria spec e revisar o diff no fim

## A técnica que faz a conta fechar

**Transforme a regra em verificador.** `.agent/check-design.mjs` traduz o
DESIGN.md em código: proíbe gradiente, sombra, cor fora da paleta, `font-size`
fora da escala. Com ele no `verify`, o modelo local itera sozinho até acertar, e
o Claude lê quatro linhas em vez de quatrocentas.

Mesma lógica vale para os testes: quanto mais o `verify` cobre, menos diff
precisa ser lido, e maior a economia. Um `verify` fraco anula a delegação.

## Memoria: o orquestrador aprende com os proprios erros

Errar uma vez e informacao; errar de novo e desperdicio. Toda vez que o `verify`
reprova, o `run.mjs` normaliza as mensagens (tira arquivo, linha e valores
especificos) e grava em `.agent/licoes.md` com um contador de ocorrencias.

Nas execucoes seguintes, essas licoes entram no prompt de **toda** tarefa, na
secao "ERROS JA COMETIDOS NESTE PROJETO - NAO REPITA", com destaque para os que
ja se repetiram. O modelo local chega sabendo onde os outros tropecaram.

O arquivo e texto simples e pode ser editado a mao: quando voce descobre uma
armadilha que nenhuma validacao pega (largura intrinseca de `textarea`, por
exemplo), acrescente a linha e ela passa a valer para sempre.

Ha tres niveis de aprendizado, e o barato precisa vir primeiro:

1. **Verificador** — se da para escrever a regra em codigo, escreva. O modelo
   corrige sozinho, custo zero de token remoto. (`check-design.mjs`)
2. **Licao** — se da para escrever a regra em portugues mas nao em codigo, vai
   para `licoes.md` e entra no prompt.
3. **Revisao humana** — so o que sobrar. Foi assim que a coluna de 28 caracteres
   apareceu: passava em toda validacao automatica e so um olho pegou.

## Formato da spec

    ---
    model: qwen3-coder:30b
    context: arquivos que o modelo precisa ler (entram inteiros no prompt)
    allow: arquivos que ele pode escrever — qualquer outro é recusado
    verify: comando que aprova ou reprova o resultado
    attempts: 3
    num_ctx: 32768
    ---

## O que o run.mjs faz

1. Monta o prompt com o conteúdo atual dos arquivos de contexto.
2. Exige resposta em blocos `<<<FILE caminho ... >>>END`.
3. Recusa qualquer arquivo fora de `allow`.
4. Aplica, roda `verify` e, se falhar, devolve o erro ao modelo — até `attempts` vezes.
5. Se todas falharem, reverte tudo (backup em `.agent/.backup`).
6. Escreve `.agent/report.json` e imprime um resumo de quatro linhas.

O histórico não cresce entre tentativas: cada retentativa manda system + spec +
última resposta + erro. Isso evita o contexto inflar e a qualidade cair.

## Proteção de hardware

Antes de cada chamada o orquestrador lê `nvidia-smi`:

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `GPU_PAUSE_TEMP` | 78 °C | acima disso, não inicia; espera esfriar |
| `GPU_RESUME_TEMP` | 68 °C | temperatura para retomar |
| `GPU_ABORT_TEMP` | 86 °C | corta a geração em andamento |
| `GPU_COOLDOWN_MS` | 15000 | pausa entre tentativas |

A GPU já faz throttle sozinha por volta de 83 °C — o risco de dano real é baixo.
Estes limites existem para manter a placa longe do teto em sessões longas, o que
poupa ventoinha e pasta térmica, e para que uma tarefa em laço não deixe a
máquina fervendo sem ninguém olhando. O pico de cada execução vai no
`report.json`. Sem GPU NVIDIA, a guarda simplesmente não se aplica.

O modelo é descarregado da VRAM 5 minutos após o último uso (`keep_alive`).
