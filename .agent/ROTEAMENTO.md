# Roteamento de modelos

Cada tipo de ação tem um modelo atribuído de antemão. O critério é
**assertividade**, não velocidade: tarefa que erra sai cara mesmo quando o token
é barato, porque custa revisão, correção e uma segunda rodada.

## Modelos

| Modelo | Papel | Quando |
| --- | --- | --- |
| **Fable 5.1** | **proibido neste projeto** | nunca — decisão do dono do projeto |
| **Opus 5** | orquestrador | decide, especifica, revisa e assume o que tem risco |
| **Sonnet 5** | implementador | escreve features com contrato claro |
| **Haiku 4.5** | operário | trabalho mecânico e verificável de imediato |

## Tabela de ações

| Ação | Modelo | Por quê |
| --- | --- | --- |
| Decisão de arquitetura, escolha de dependência | Opus | erro aqui contamina tudo que vem depois |
| Design visual, tokens, `DESIGN.md` | Opus | julgamento estético não delega |
| Escrever a spec de uma tarefa | Opus | é o contrato; spec ruim gera trabalho ruim |
| Escrever testes que servem de contrato | Opus | quem define o critério não pode ser quem o cumpre |
| Fronteira de segurança (IPC, `contextBridge`, disco) | Opus | falha vira vulnerabilidade, não bug |
| Depuração de causa desconhecida | Opus | exige hipótese, não repetição |
| Revisão final antes de commit | Opus | último filtro humano-equivalente |
| Implementar feature com spec e testes prontos | Sonnet | trabalho substancial, contrato fechado |
| Refatoração com comportamento preservado por testes | Sonnet | volume médio, risco contido pelos testes |
| Corrigir bug já diagnosticado | Sonnet | o difícil (diagnóstico) já foi feito |
| Revisão de código em busca de defeitos | Sonnet | bom custo-benefício, segunda opinião real |
| Aplicar padrão repetitivo em vários arquivos | Haiku | mecânico, verificável, alto volume |
| Escrever testes a partir de casos já enumerados | Haiku | transcrição, não julgamento |
| Ampliar verificador com regra já especificada | Haiku | regra fechada, saída testável |
| Atualizar documentação factual | Haiku | sem decisão envolvida |

## Regras que valem para toda delegação

1. **Nada é delegado sem verificação automática.** O subagente precisa poder
   rodar `npm run check` (ou parte dele) e saber sozinho se acertou.
2. **Escopo declarado.** A spec diz quais arquivos podem mudar. Fora disso, não.
3. **O resultado é registrado.** Toda delegação vira uma linha em
   `.agent/registro.jsonl` — acertou, errou, precisou de quantas correções.
4. **Opus revisa o diff antes do commit.** Nenhum modelo mais barato tem a
   palavra final.

## Como a atribuição muda com o tempo

O `registro.jsonl` acumula o desempenho real por modelo e por tipo de ação.
Rode `node .agent/relatorio.mjs` para ver a taxa de acerto.

Critério de promoção ou rebaixamento — só com **amostra de 5 ou mais** tarefas
do mesmo tipo:

- Acerto abaixo de 60% → sobe um nível (Haiku vira Sonnet, Sonnet vira Opus).
- Acerto igual ou acima de 90% em 8 ou mais tarefas → tenta descer um nível,
  e volta atrás se cair abaixo de 75%.

Nunca mudar a atribuição por causa de um caso isolado. Uma falha é ruído; um
padrão de falhas é informação.
