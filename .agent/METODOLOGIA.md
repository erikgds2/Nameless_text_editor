# Metodologia

Régua que toda implementação neste projeto atravessa antes de ser considerada
pronta. Ela nasceu de um pedido de 2026-09-09: usar as duas seções da
[BibliotecaDev](https://github.com/KAYOKG/BibliotecaDev) — *Algoritmos e
Estruturas de Dados* e *Arquitetura de Software* — como base metodológica.

**O que aquelas seções são, para não haver mal-entendido:** listas de livros.
Não há texto lá para "seguir" — há Cormen, Bhargava, *Arquitetura Limpa*,
*Refatoração*, *Trabalho Eficaz com Código Legado*, *The Software Craftsman*,
*Mergulho nos Padrões de Projeto*, entre outros. O que este documento faz é
destilar desses livros as regras que **mordem neste projeto** e transformá-las
em verificação executável sempre que possível. Regra que só existe em prosa
depende da memória de quem escreve, e memória é justamente o que falha.

A hierarquia é a mesma que o projeto já usava para as lições:

1. Se a regra pode virar código de verificação, vira (`.agent/check-*.mjs`).
2. Se só pode ser escrita em prosa, vira item desta lista, consultado antes de
   implementar.
3. Só o resto chega à revisão humana.

---

## O que é cobrado por máquina

`npm run check` roda tipos, testes e build. Além dele:

| Comando | O que cobra | De onde vem |
| --- | --- | --- |
| `node .agent/check-design.mjs` | escala tipográfica, raio, sombra, cor fora dos tokens, contraste WCAG | `DESIGN.md` |
| `node .agent/check-arquitetura.mjs` | regra da dependência, varredura dentro de varredura, módulo grande demais, módulo sem teste | *Arquitetura Limpa*, *Entendendo Algoritmos*, *Refatoração*, *Trabalho Eficaz com Código Legado* |
| `src/escala.test.ts` | contagem de operações: o que dá o mesmo número em qualquer máquina | Cormen, *Entendendo Algoritmos* |
| `node .agent/check-escala.mjs` | a medição por relógio, sob demanda — fora do portão porque oscila | Cormen, *Entendendo Algoritmos* |

---

## 1. A regra da dependência

*Arquitetura Limpa*, Robert C. Martin.

O núcleo do Ardósia é **o formato das notas e as decisões sobre elas**:
`formato.ts`, `canvas.ts`, `notes.ts`, `links.ts`, `busca.ts`, `imagem.ts`,
`tags.ts`, `conflito.ts`, `edicao.ts`, `markdown.ts`, `ordenacao.ts`,
`nomes.ts`, `search.ts`, `sugestoes.ts`, `historico.ts`. Nenhum deles pode
saber que existe React, Electron ou DOM.

É o que permite testar tudo em milissegundos e trocar a casca sem tocar no
miolo — foi assim que a CLI nasceu sem servidor nem API: ela fala com o mesmo
formato por outra casca.

A casca de dentro (`janela.ts`, `pasta.ts`, `deposito.ts`, `diagrama.ts`,
`ajustes.ts`) fala com o navegador **de propósito**, e está declarada como
exceção no verificador. Acrescentar arquivo a essa lista é decisão de
arquitetura: não se faz para calar o verificador.

**Cobrado por:** `check-arquitetura.mjs`, regra 1.

## 2. Custo que cresce com o caderno, não com o quadrado dele

Cormen; *Entendendo Algoritmos*, Bhargava.

Antes de escrever um laço, a pergunta é o que acontece com mil notas. Índice,
contagem e busca se constroem **uma vez, fora do laço**.

Erro real que originou a regra (2026-09-09): o filtro de notas órfãs chamava
`construirIndice(notes)` dentro de um `filter` — o caderno inteiro varrido uma
vez por nota. Com mil notas, um milhão de varreduras. O app continuaria
"funcionando" nos testes e travaria na mão de quem tem caderno grande.

**Cobrado por:** `check-arquitetura.mjs` regra 2 (varredura em laço) e
`src/escala.test.ts`, que conta operações — e que tem um caso propositalmente
quadrático para provar que a régua acusa.

A medição por **relógio** saiu da bateria e virou `node .agent/check-escala.mjs`.
O motivo é uma lição desta sessão: com a máquina ocupada, o tempo oscilava e o
portão derrubava por motivo errado. Portão que falha sem defeito treina a gente
a ignorá-lo, o que é pior do que não medir.

## 3. Refatorar só com o teste verde dos dois lados

*Refatoração*, Martin Fowler.

Mudar estrutura e mudar comportamento são dois trabalhos, e nunca no mesmo
passo. Antes de mexer, a bateria passa; depois de mexer, a mesma bateria passa
sem que nenhum teste tenha sido reescrito. Se um teste precisou mudar, aquilo
não era refatoração: era mudança de comportamento, e ela se anuncia.

Quando o comportamento muda de propósito — como a foto colada que passou a
ficar no bloco onde se colou —, os testes que fixavam a regra antiga são
**reescritos e citados no commit**, não apagados em silêncio.

## 4. Cheiros que este projeto já pagou caro

*Refatoração*, Fowler; *Princípios de Design e Padrões de Projeto*, Martin.

- **Módulo grande demais** — teto de 400 linhas (`.ts`) e 700 (`.tsx`). Não é
  número sagrado: é o ponto de parar e perguntar se ali não moram duas
  responsabilidades. O que já passou disso vira dívida declarada com número de
  item no BACKLOG, e aparece como aviso a cada rodada.
- **Estado espalhado** — posição de texto guardada em estado do React parte a
  frase de quem digita rápido. Recalcule do campo no momento de aplicar.
- **Duplo de teste complacente** — o falso que aceita o que o verdadeiro
  recusa esconde bug. Duplo recusa o que o original recusa.

**Cobrado por:** `check-arquitetura.mjs` regra 3, e pelas lições em
`.agent/licoes.md`.

## 5. Costura antes de mexer no que não se pode testar

*Trabalho Eficaz com Código Legado*, Michael Feathers.

Código que só roda dentro do Electron, do navegador ou do disco não é
intocável: separa-se a **decisão** da **execução**, e a decisão vira função
pura testável. Foi assim com `electron/geometria.cjs` (aceitar ou não a
posição guardada da janela, cortar o log de erros) e com
`canvas.ts:alturaAjustada` (crescer ou encolher o bloco), que o jsdom jamais
poderia medir.

Corolário: "código legado é código sem teste". Todo módulo do núcleo tem um
`.test.ts` ao lado — **cobrado por** `check-arquitetura.mjs` regra 4.

## 6. Padrão só quando o problema aparece

*Mergulho nos Padrões de Projeto*, Alexander Shvets.

Nada de abstração para um caso só. Quando um padrão for usado, ele é nomeado
no comentário — quem lê depois merece saber que aquilo tem nome e onde estudá-lo.

## 7. Não entregar o que não se viu funcionando

*The Software Craftsman*, Sandro Mancuso.

Teste verde não é prova de que a tela está certa. Mudança visual se confere na
tela, com o CSS de verdade, e a captura entra na conversa: é para isso que
existem os `.agent/fumaca-*.cjs`.

E a lição mais cara desta sessão, que nenhum livro pega: **decisão de
comportamento visual aprovada por descrição escrita não vale**. A opção "a
figura nasce num quadrado abaixo" foi aprovada por texto e recusada ao ser
vista funcionando. Mostre antes de perguntar, ou implemente o que o usuário
descreveu com as próprias palavras — ele disse "no quadrado onde eu colei"
desde o começo.

---

## Antes de dizer que está pronto

1. `npm run check` — tipos, 700+ testes, build.
2. `node .agent/check-design.mjs` — a direção visual.
3. `node .agent/check-arquitetura.mjs` — as regras acima.
4. Mudou a tela? Um `.agent/fumaca-*.cjs` desenha e mede, e eu olho a captura.
   Mexeu em algo que só existe no aplicativo instalado — protocolo, janela,
   ponte, nome do app? Então `node .agent/fumaca-app.cjs`, que sobe o app **de
   verdade**: foi um defeito invisível a todos os outros testes (o acento no
   nome do app quebrando o protocolo) que obrigou a criá-lo.
5. Mudou comportamento? O commit diz o que mudou e por quê, e os testes da
   regra antiga foram reescritos, não apagados.
6. Errou? A lição entra em `.agent/licoes.md` com o contador, para não voltar.
