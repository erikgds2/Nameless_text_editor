---
model: qwen3-coder:30b
context: DESIGN.md, src/components/Sidebar.tsx, src/components/Editor.tsx, src/App.tsx
allow: src/styles.css, src/main.tsx
verify: node .agent/check-design.mjs && npm run build
attempts: 4
num_ctx: 16384
---

# Tarefa: reescrever o visual seguindo o DESIGN.md

O `src/styles.css` atual esta na estetica errada (escuro, acento ciano, cantos
arredondados, sombras, gradiente). Reescreva o arquivo inteiro na direcao
**editorial, papel e tinta** definida no DESIGN.md, que esta no contexto e e lei.

Um verificador automatico (`node .agent/check-design.mjs`) confere o resultado.
Ele reprova gradiente, sombra, blur, cor literal fora dos tokens, cor fora da
paleta, `border-radius` acima de 2px, `font-size` fora da escala e transicao de
propriedade que nao seja cor ou opacidade.

## Regras que o verificador aplica — leia com atencao

1. Toda cor literal (`#hex`, `rgba(`, `hsl(`) so pode aparecer em linhas que
   definem uma custom property, ou seja, linhas comecando com `--`.
   Em qualquer outro lugar use `var(--nome)`. Isto vale inclusive para
   scrollbars, `::selection` e estados de hover.
2. Os unicos hex permitidos sao exatamente os 16 da paleta do DESIGN.md.
   Se precisar de um tom intermediario, crie um token novo reaproveitando
   um hex que ja existe na paleta — nao invente cor nova.
3. `font-size` so pode ser 10, 12, 14, 16, 19 ou 24 px.
4. `border-radius`: 0 em tudo, 2px apenas em campo de busca e botao de icone.
   Nada de `50%` nem `999px`.
5. `transition` apenas de `color`, `background-color`, `background`, `opacity`
   ou `border-color`, com duracao de 120ms.

## Tema

- **Claro e o padrao**: defina a paleta clara em `:root`.
- O escuro entra em `@media (prefers-color-scheme: dark)` redefinindo os mesmos
  tokens com os valores da secao escura do DESIGN.md. Nunca defina uma cor
  apenas dentro do bloco escuro.

## Tipografia

Declare os tokens `--serif` e `--mono`:

    --serif: 'Literata', 'Source Serif 4', Georgia, serif;
    --mono: 'IBM Plex Mono', 'Cascadia Mono', Consolas, monospace;

- Corpo da nota (`.editor__area`) e titulos: `--serif`.
- Rotulos, datas, contadores, busca, nome do app: `--mono`, 10px,
  `letter-spacing: 0.14em`, `text-transform: uppercase` onde for rotulo.
- `.editor__area`: 16px, `line-height: 1.7`, largura maxima de leitura de 68ch
  (use `max-width: 68ch` e centralize o bloco de texto).

## Em src/main.tsx

Adicione, antes do `import './styles.css'`, os imports das fontes ja instaladas:

    import '@fontsource/literata/400.css';
    import '@fontsource/literata/600.css';
    import '@fontsource/ibm-plex-mono/400.css';
    import '@fontsource/ibm-plex-mono/500.css';

Nao mude mais nada nesse arquivo.

## Classes que precisam continuar existindo

O CSS e consumido por componentes que voce NAO pode editar. Toda classe abaixo
precisa continuar estilizada, com o mesmo papel de hoje:

app, titlebar, titlebar__mark, titlebar__name, workspace, sidebar, sidebar__top,
search, btn, btn--new, btn--danger, btn--armed, notelist, noterow, pin, pin--on,
noteitem, noteitem--active, noteitem__title, noteitem__preview, noteitem__date,
sidebar__empty, sidebar__footer, editor, editor__header, editor__meta,
editor__title, editor__time, editor__area, editor__footer, editor--empty,
editor__hint

Comportamentos de layout que devem ser preservados:
- `.app` e uma grade de duas linhas: barra de titulo de 38px e o resto.
- `.workspace` e uma grade de duas colunas: lateral de 284px e o editor.
- `.titlebar` mantem `-webkit-app-region: drag`.
- `.pin` fica escondido (`opacity: 0`) e aparece no hover da `.noterow` ou quando
  tem a classe `pin--on`; a `.noteitem__date` some nessas mesmas situacoes.
- `.notelist` rola sozinha; a pagina nunca rola.
- Item ativo: barra de 2px em `--accent` na borda esquerda e fundo `--paper-sunk`.

## Estetica alvo

Pense em pagina impressa: bastante ar, reguas finas separando areas, nenhuma
caixa flutuante, nenhum brilho. A lateral e uma faixa `--paper-sunk` separada do
editor por uma regua de 1px. O acento ocre aparece em pouquissimos lugares — item
ativo, alfinete ligado, foco de campo — e nunca como fundo de area grande.
