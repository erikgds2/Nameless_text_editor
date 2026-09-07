# Tarefa: escrita livre em blocos, como no OneNote

Hoje a nota é um `<textarea>` único que ocupa a coluna inteira. Ela passa a ser
uma **tela livre**: o usuário dá um duplo clique em qualquer ponto e começa a
escrever ali; cada bloco de texto pode ser movido e redimensionado.

Os testes em `src/canvas.test.ts` e `src/notes.test.ts` são o contrato e **não
podem ser editados**. Faça o código passar neles.

## 1. `src/canvas.ts` (novo)

```ts
export type Bloco = {
  id: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  texto: string;
};

export const LARGURA_PADRAO = 320;
export const ALTURA_PADRAO = 120;
export const LARGURA_MINIMA = 120;
export const ALTURA_MINIMA = 60;

export function criarBloco(x: number, y: number): Bloco;
export function textoDaNota(blocos: Bloco[]): string;
```

- `criarBloco` usa `crypto.randomUUID()`, nunca deixa `x` ou `y` negativos
  (use `Math.max(0, ...)`) e começa com texto vazio.
- `textoDaNota` ordena por `y` e, em empate, por `x`; descarta blocos cujo texto
  só tenha espaço em branco; junta com `\n`. Não mute o array recebido — copie
  antes de ordenar.

## 2. `src/notes.ts`

O tipo `Note` troca `body: string` por `blocos: Bloco[]`. Reexporte `textoDaNota`
a partir de `./canvas` (os testes importam de `./notes`).

- `createNote()` nasce com **um** bloco vazio em `criarBloco(48, 48)`.
- `loadNotes()` migra o formato antigo: nota que tem `body` e não tem `blocos`
  vira uma nota com um único bloco em `criarBloco(48, 48)` cujo texto é o `body`.
  Preserve `id`, `createdAt`, `updatedAt` e `pinned` exatamente como estavam, e
  continue aplicando `pinned ?? false`. Nota que já tem `blocos` passa intacta.
- `deriveTitle(texto: string)` continua igual, recebendo texto.

## 3. `src/components/Canvas.tsx` (novo)

```tsx
type Props = {
  blocos: Bloco[];
  onChange: (blocos: Bloco[]) => void;
};
```

Comportamento:

- **Criar**: duplo clique numa área vazia da tela cria um bloco naquele ponto
  (coordenadas relativas ao canvas, via `getBoundingClientRect`) e coloca o foco
  no `<textarea>` dele.
- **Escrever**: cada bloco tem um `<textarea>` que preenche o bloco inteiro.
- **Mover**: arrastar pela **alça** no topo do bloco (`.bloco__alca`).
- **Redimensionar**: arrastar pelo canto inferior direito (`.bloco__canto`),
  respeitando `LARGURA_MINIMA` e `ALTURA_MINIMA`.
- **Limpar**: bloco cujo texto está vazio ao perder o foco é removido — mas
  só se houver mais de um bloco na nota. A nota nunca fica sem nenhum bloco.
- Mover e redimensionar usam eventos de ponteiro (`onPointerDown`,
  `setPointerCapture`, `onPointerMove`, `onPointerUp`). Não use eventos de mouse
  soltos no `window`, e não deixe listener sem remoção.
- `x` e `y` nunca ficam negativos.

## 4. `src/components/Editor.tsx`

- Substitua o `<textarea className="editor__area">` pelo `<Canvas>`.
- Mantenha o cabeçalho (título, data, botão excluir) e o rodapé de contadores.
- Título e contadores passam a usar `textoDaNota(note.blocos)`.
- A prop muda de `onChange: (body: string) => void` para
  `onChange: (blocos: Bloco[]) => void`.

## 5. `src/App.tsx` e `src/components/Sidebar.tsx`

- `App`: `handleChangeBody` vira `handleChangeBlocos(blocos: Bloco[])`, gravando
  `blocos` e atualizando `updatedAt`. A busca passa a usar
  `matchesQuery(textoDaNota(note.blocos), query)`.
- `Sidebar`: título e prévia saem de `textoDaNota(note.blocos)`.

## 6. `src/styles.css` — duas coisas

### a) Restaure o bloco do editor, que sumiu numa reescrita anterior

Estas classes estão sendo usadas pelos componentes e **não têm regra nenhuma**
no CSS hoje: `editor`, `editor--empty`, `editor__header`, `editor__meta`,
`editor__title`, `editor__time`, `editor__footer`, `editor__hint`.

- `.editor`: flex column, `min-height: 0`.
- `.editor__header`: flex, espaço entre os lados, `padding: 18px 32px 14px`.
- `.editor__title`: `--serif`, 19px, peso 600, corta com reticências.
- `.editor__time`: `--mono`, 10px, maiúsculo, `letter-spacing: 0.14em`, `--ink-soft`.
- `.editor__footer`: régua de 1px em cima, `--mono` 10px maiúsculo, `--ink-soft`.
- `.editor--empty`: centraliza o conteúdo. `.editor__hint`: `--mono`, centralizado.
- `.editor__area` **não existe mais** — foi substituída pelo canvas.

### b) Estilize o canvas e os blocos

**Esta é a parte mais importante da tarefa.** O usuário reclamou que o bloco de
escrita ficava branco, destruindo a translucidez do tema acrílico. O bloco tem
que ser invisível até você interagir com ele.

- `.canvas`: `flex: 1`, `position: relative`, `overflow: auto`, `min-height: 0`.
- `.bloco`: `position: absolute`, **fundo totalmente transparente**, borda de
  1px transparente, `border-radius: 0`.
- `.bloco:hover`, `.bloco--ativo`: a borda passa a `1px solid var(--rule)`.
  Nada além disso muda — sem fundo, sem sombra, sem brilho.
- `.bloco__texto` (o `<textarea>`): `background: none`, `border: 0`,
  `outline: none`, `resize: none`, largura e altura 100%, `--serif` 16px,
  `line-height: 1.7`, cor `var(--ink)`. **Obrigatório `width: 100%`** — sem isso
  o textarea encolhe para 20 caracteres.
- `.bloco__alca`: faixa de 14px no topo do bloco, `cursor: move`, `opacity: 0`;
  vira `opacity: 1` no hover do bloco. Fundo `var(--paper-sunk)`.
- `.bloco__canto`: 12px no canto inferior direito, `cursor: nwse-resize`,
  `opacity: 0`, vira `opacity: 1` no hover; use `var(--rule)` como fundo.

**Proibido em qualquer parte desta tarefa**: cor literal fora dos tokens
(`#hex`, `rgba(`), `background: white`, `var(--paper-solid)` dentro do bloco,
sombra, gradiente, blur, `border-radius` acima de 2px, `font-size` fora da
escala 10/12/14/16/19/24.

## Verificação obrigatória

    node .agent/check-design.mjs
    npm run check

Os dois precisam passar. `check-design.mjs` agora também acusa classe usada nos
componentes sem regra no CSS, então ele cobre a parte (a).
