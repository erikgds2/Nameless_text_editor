# DESIGN.md — Editor Sem Nome

Direção: **editorial, papel e tinta**. A referência é um caderno de estudo bem
impresso, não um dashboard. Tudo aqui é decisão fechada — não invente tokens,
não improvise cores, não "melhore" a paleta.

## Proibido (marcas do visual genérico de IA)

- `linear-gradient` / `radial-gradient` em qualquer lugar
- `backdrop-filter`, `blur`, glassmorphism
- `box-shadow` e qualquer brilho/glow
- `border-radius` acima de 2px
- Fonte Inter, e qualquer fonte sem-serifa no corpo do texto
- Roxo, violeta, ciano neon, magenta
- Emoji usado como ícone
- Três ou mais cards idênticos lado a lado
- Animação com `transform`, bounce, scale no hover

## Obrigatório

- **Um único acento** (ocre). Nunca dois acentos competindo.
- Fundo suave de estado usa `--accent-wash` / `--alert-wash`. Nunca `rgba()` avulso:
  toda cor precisa ser um token.
- Cor nunca é o único portador de significado: sempre acompanha peso, posição ou rótulo.
- Hierarquia vem de **tipografia, espaço e régua de 1px** — nunca de sombra ou cor de fundo.
- Corpo do texto em **serifa**. Rótulos, números e metadados em **monoespaçada**.
- Cantos retos. Superfícies chapadas.

## Tokens

```css
:root {
  /* claro — padrão */
  --paper:        #F7F4ED;  /* fundo */
  --paper-sunk:   #F1EDE3;  /* faixa lateral, rodapés */
  --ink:          #1A1714;  /* texto */
  --ink-soft:     #6B645C;  /* metadados, texto secundário */
  --rule:         #DDD6C7;  /* réguas de 1px */
  --accent:       #A4551A;  /* ocre queimado — o único acento */
  --marker:       #F0E2C0;  /* fundo de grifo */
  --alert:        #8C2F1D;  /* destrutivo */
  --accent-wash:  #F0E5D6;  /* fundo suave em estado ativo/hover do acento */
  --alert-wash:   #F0DFD9;  /* idem para o destrutivo */
}

/* escuro — "tinta", não "neon": quente, nunca azulado */
--paper:      #14120F;
--paper-sunk: #191612;
--ink:        #E8E2D6;
--ink-soft:   #948C80;
--rule:       #2C2822;
--accent:     #D08A3E;
--marker:     #3A2F1A;
--alert:      #C25B44;
--accent-wash: #2A2118;
--alert-wash:  #2A1A16;
```

## Tipografia

| Papel | Família | Uso |
| --- | --- | --- |
| `--serif` | Literata → Source Serif 4 → Georgia → serif | corpo da nota, títulos |
| `--mono` | IBM Plex Mono → Cascadia Mono → Consolas → monospace | rótulos, datas, contadores, busca |

- Escala: **10 · 12 · 14 · 16 · 19 · 24 px**. Nada fora dela.
- Corpo da nota: 16px / `line-height: 1.7` / medida máxima **68ch**.
- Rótulos em mono: 10px, `letter-spacing: 0.14em`, `text-transform: uppercase`.
- Títulos: serifa, peso 600, `letter-spacing: -0.01em`.

## Espaço e forma

- Escala de espaçamento: **4 · 8 · 12 · 16 · 24 · 32 · 48 px**.
- `border-radius`: **0**, exceto campos de entrada e botões de ícone, que usam **2px**.
- Separação entre áreas: `1px solid var(--rule)`. Nunca sombra.
- Estado ativo: barra de 2px em `--accent` na borda esquerda + fundo `--paper-sunk`.

## Movimento

- Só `color`, `background-color`, `opacity` e `border-color`.
- Duração **120ms**, `ease`. Nada além disso.

## Tema

Claro é o padrão. O escuro existe e respeita `prefers-color-scheme`, mas o app
não é "dark-first" — isso é justamente a marca registrada do visual genérico.
