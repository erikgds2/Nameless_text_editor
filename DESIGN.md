# DESIGN.md — Ardósia

Direção: **Fluent quente**. A referência é o Notepads e o Windows 11 — superfície
translúcida do sistema, tipografia de tela, cantos macios, movimento curto — com
uma cor só de acento: ocre. Tudo aqui é decisão fechada. Não invente tokens, não
improvise cores, não "melhore" a paleta.

## Por que esta direção substituiu a anterior

A primeira versão do projeto era editorial: serifa no corpo, cantos retos, zero
sombra, régua de 1px, transição só de cor. Executada à risca, ela produziu uma
tela que o dono do projeto descreveu assim: *muito branco e muito brilho, dói os
olhos, não é smooth, parece sistema antigo feito em Delphi*.

O diagnóstico, medido:

| Causa | Antes | Agora |
| --- | --- | --- |
| Contraste do corpo no escuro | `#EDEAE4` sobre `#171512` = **13,5:1** | **9,5:1** |
| Serifa fina no escuro | Literata 16px — as hastes finas reluzem (*halation*) | monoespaçada, traço de espessura uniforme |
| `-webkit-font-smoothing` | `antialiased` global — afina ainda mais o texto claro sobre fundo escuro | só onde o texto é grande |
| Forma | cantos 0px, sem sombra, sem profundidade | cantos 4px, sombra só no que flutua |
| Movimento | 120ms, só cor | 150ms com curva de desaceleração, cor + opacidade + deslocamento curto |

A lição que fica: **contraste máximo não é legibilidade máxima**. Em tela escura,
texto quase branco vibra na borda das letras. O conforto mora entre 7:1 e 11:1.

## Proibido

- `linear-gradient` / `radial-gradient` em qualquer lugar
- `backdrop-filter` / `filter: blur()` — o acrílico vem do sistema operacional,
  atrás de tudo, uma vez só. Vidro empilhado dentro da interface é slop.
- Fonte Inter, e qualquer fonte com serifa no corpo do texto
- Ciano neon, magenta, qualquer cor de saturação alta como acento. As opções
  oferecidas são todas dessaturadas; o seletor livre existe porque a decisão
  final é de quem usa, não do documento.
- Dois acentos competindo. É um.
- Emoji usado como ícone
- Três ou mais cards idênticos lado a lado
- Animação com `scale`, bounce, mola, ou qualquer coisa acima de 250ms
- Texto de corpo com contraste acima de 11:1 no tema escuro
- Cor literal fora dos tokens: nada de `#hex` ou `rgba()` solto numa regra

## Obrigatório

- Toda cor é um token. Estado de fundo usa `--accent-wash` / `--alert-wash`.
- Cor nunca é o único portador de significado: sempre acompanha peso, posição ou rótulo.
- Hierarquia vem de **tipografia, espaço e superfície** — sombra só separa o que
  realmente flutua sobre o conteúdo.
- Corpo da nota em **monoespaçada**. Interface em **Segoe UI**.
- Alvo de clique com no mínimo 28px de altura.
- Foco visível por teclado em tudo que é clicável: contorno de 2px em `--accent`.

## Tokens

```css
/* escuro — "carvão", o padrão. Quente, nunca azulado. */
--base:        #1A1714;  /* fundo sólido; no tema acrílico quem pinta é o SO */
--surface:     rgba(255, 255, 255, 0.035);  /* faixa lateral, rodapé */
--surface-alt: rgba(255, 255, 255, 0.065);  /* item sob o cursor, campo */
--ink:         #C2BCB2;  /* corpo — 9,5:1 */
--ink-strong:  #DED8CE;  /* títulos — 12,6:1, confortável porque é grande */
--ink-soft:    #8E8880;  /* metadados — 5,1:1 */
--ink-faint:   #6E675E;  /* dica, placeholder — 3,2:1, nunca informação essencial */
--rule:        rgba(255, 255, 255, 0.07);
--accent:      #D8934A;  /* ocre — 7,0:1 */
--accent-wash: rgba(216, 147, 74, 0.13);
--alert:       #E08672;
--alert-wash:  rgba(224, 134, 114, 0.13);
--marker:      rgba(216, 147, 74, 0.20);  /* grifo */
--sombra:      0 8px 24px rgba(0, 0, 0, 0.32);
```

```css
/* claro — "papel". Nunca #FFF: papel de verdade não é branco. */
--base:        #F2EFE9;
--surface:     rgba(26, 23, 20, 0.030);
--surface-alt: rgba(26, 23, 20, 0.060);
--ink:         #33302B;  /* 11,4:1 — no claro não há halation, pode subir */
--ink-strong:  #1A1714;
--ink-soft:    #6B645C;
--ink-faint:   #948C82;
--rule:        rgba(26, 23, 20, 0.10);
--accent:      #A4551A;  /* 4,7:1 */
--accent-wash: rgba(164, 85, 26, 0.10);
--alert:       #8C2F1D;
--alert-wash:  rgba(140, 47, 29, 0.10);
--marker:      rgba(164, 85, 26, 0.16);
--sombra:      0 8px 24px rgba(26, 23, 20, 0.14);
```

Faixa de contraste do corpo, verificada por `.agent/check-design.mjs`:
**7:1 a 11:1 no escuro**, **10:1 a 16:1 no claro**.

## Tipografia

| Papel | Família | Uso |
| --- | --- | --- |
| `--mono` | Cascadia Mono → Cascadia Code → Consolas → IBM Plex Mono → monospace | corpo da nota, código, números |
| `--ui` | Segoe UI Variable Text → Segoe UI → system-ui → sans-serif | tudo que é interface |

- Escala: **11 · 12 · 13 · 15 · 17 · 21 · 28 px**. Nada fora dela.
- Corpo da nota: 15px / `line-height: 1.65` / medida máxima 80ch.
- Rótulo de seção: 11px, `letter-spacing: 0.08em`, maiúsculas — só em cabeçalho
  de seção, nunca espalhado pela tela como era antes.
- Títulos: `--ui`, peso 600, `letter-spacing: -0.01em`.
- `-webkit-font-smoothing: antialiased` **só** acima de 17px. No texto pequeno
  ele afina o traço e devolve o brilho que estamos combatendo.

## Espaço e forma

- Espaçamento: **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 px**.
- `border-radius`: **4px** no geral, **6px** em painéis e sobreposições,
  **2px** em marcas minúsculas. Máximo 6px, e nada de 50% ou 999px.
- Separação entre áreas: `1px solid var(--rule)` ou mudança de superfície.
- Sombra: **só** em coisa que flutua sobre o conteúdo (painel de ajustes, menu,
  diálogo), sempre `var(--sombra)`. Superfície fixa não tem sombra.
- Estado ativo: barra de 2px em `--accent` na borda esquerda + `--surface-alt`.

## Movimento

- Duração **150ms**; **250ms** só para algo que entra na tela.
- Curva `cubic-bezier(0.16, 1, 0.3, 1)` — desacelera, não balança.
- Propriedades permitidas: `color`, `background-color`, `border-color`,
  `opacity`, `box-shadow` e `transform` **apenas como `translate` de até 8px**.
- Proibido: `scale`, rotação, mola, qualquer coisa que chame atenção para si.
- Tudo isso desaparece sob `prefers-reduced-motion: reduce`.

## Temas

Três temas fechados. O usuário escolhe em **Ajustes → Aparência** — nunca mais
solto num canto da barra lateral. A escolha persiste.

### `acrilico` — padrão

Translucidez do material acrílico do Windows 11, o mesmo do Windows Terminal.
A janela é transparente e quem pinta é o sistema operacional. Usa a paleta
escura, com `--base` aplicado só quando não há acrílico (navegador).

Quanto do acrílico aparece é regulado em Ajustes → Aparência: `--opacidade` vai
de 0% (o material do sistema passa inteiro) a 100% (fundo sólido). A camada é
o próprio `background` do `body`, via `color-mix` — nunca `setOpacity` da janela,
que deixaria o texto transparente junto.

O `body` recebe `background: var(--base)` sempre; dentro do Electron
(`data-native="true"`) ele passa a `transparent` para o acrílico aparecer.

### `carvao` — escuro opaco

A mesma paleta escura, com fundo sólido. Para quem não quer translucidez ou está
fora do Windows.

### `papel` — claro

A paleta clara. Continua sendo papel, não folha de sulfite: `#F2EFE9`, não branco.

## Translucidez: o que vale e o que não vale

A janela ser translúcida é o **sistema operacional** pintando atrás do app. Isso
é permitido e é a identidade do tema padrão.

Continua proibido: `backdrop-filter` em qualquer elemento, painéis "de vidro"
flutuando sobre o conteúdo, e brilho para simular elevação. A diferença é que o
acrílico está atrás de tudo, uma vez só, e vem do SO.

## O que é verificado por código

`node .agent/check-design.mjs` falha se encontrar: gradiente, blur, sombra fora
dos tokens, raio acima de 6px, tamanho de fonte fora da escala, cor literal fora
da lista de tokens, transição em propriedade proibida ou acima de 250ms, e
contraste de corpo fora da faixa de cada tema.

Regra que pode virar código de verificação vira código. O que só pode ser dito em
prosa vira instrução escrita. Só o que sobra chega à revisão humana.
