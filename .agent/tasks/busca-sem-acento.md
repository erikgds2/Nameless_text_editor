---
model: qwen3-coder:30b
context: src/search.test.ts, src/notes.ts
allow: src/search.ts, src/App.tsx
verify: npm run test && npm run build
num_ctx: 16384
attempts: 3
---

# Tarefa: busca que ignora acentos

Buscar "categorico" precisa encontrar "categórico". Hoje a busca e um
`includes` cru, inutil em portugues.

Os testes ja existem em `src/search.test.ts` e estao no contexto. Eles sao o
contrato: seu trabalho e fazer os testes passarem sem alterar o arquivo de teste
(voce nem tem permissao para escreve-lo).

## 1. Crie src/search.ts

Exporte exatamente estas duas funcoes:

    export function normalize(text: string): string
    export function matchesQuery(text: string, query: string): boolean

- `normalize` devolve o texto em minusculas e sem diacriticos. Use
  `text.normalize('NFD').replace(/[̀-ͯ]/g, '')` — e a forma correta,
  nao troque letra por letra na mao.
- `matchesQuery` normaliza os dois lados, quebra a busca em termos por espaco em
  branco e exige que **todos** os termos aparecam no texto. Busca vazia ou so com
  espacos devolve `true`.

## 2. Use em src/App.tsx

No `useMemo` de `visibleNotes`, troque o filtro atual
(`note.body.toLowerCase().includes(term)`) por `matchesQuery(note.body, query)`.
Importe de `./search`. Nao mude a ordenacao nem qualquer outra coisa no arquivo.

## Restricoes

- Nao edite `src/search.test.ts` nem `src/notes.ts`.
- Sem dependencias novas.
- TypeScript strict, sem `any`.
