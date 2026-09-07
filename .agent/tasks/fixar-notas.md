---
model: qwen3-coder:30b
context: src/notes.ts, src/App.tsx, src/components/Sidebar.tsx
allow: src/notes.ts, src/App.tsx, src/components/Sidebar.tsx
verify: npm run build
attempts: 3
---

# Tarefa: fixar notas no topo da lista

Implemente a possibilidade de fixar uma nota. Notas fixadas aparecem antes de todas as
outras na lista lateral. O CSS ja existe e nao deve ser alterado.

## 1. src/notes.ts

- Adicione o campo obrigatorio `pinned: boolean` ao tipo `Note`.
- `createNote()` cria a nota com `pinned: false`.
- `loadNotes()` normaliza notas antigas gravadas antes deste campo existir: ao ler do
  localStorage, mapeie cada nota para `{ ...nota, pinned: nota.pinned ?? false }`.
  Sem isso as notas ja salvas quebram.

## 2. src/App.tsx

- Crie `handleTogglePin(id: string)` que inverte o `pinned` da nota com aquele id.
  Atencao: NAO altere `updatedAt` ao fixar — fixar nao e editar.
- Em `visibleNotes`, mude a ordenacao para: fixadas primeiro; dentro de cada grupo,
  a mais recentemente editada primeiro. Ou seja, compare primeiro por `pinned` e
  so depois por `updatedAt` decrescente.
- Passe `onTogglePin={handleTogglePin}` para o `Sidebar`.

## 3. src/components/Sidebar.tsx

- Adicione `onTogglePin: (id: string) => void` ao tipo `Props` e ao destructuring.
- Cada `<li>` da lista passa a ter `className="noterow"` e contem DOIS elementos irmaos.
  O botao do alfinete NAO pode ficar dentro do botao da nota (botao dentro de botao e
  HTML invalido). A estrutura exata e esta:

<li key={note.id} className="noterow">
  <button className={...botao da nota como ja esta hoje...} onClick={() => onSelect(note.id)}>
    ...os tres spans que ja existem, sem mudanca...
  </button>
  <button
    className={`pin${note.pinned ? ' pin--on' : ''}`}
    onClick={() => onTogglePin(note.id)}
    title={note.pinned ? 'Desafixar' : 'Fixar'}
  >
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4.5 1.5h3l-.5 3 2 2v1H3v-1l2-2-.5-3Z" fill="currentColor" />
      <path d="M6 7.5V11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  </button>
</li>

## Restricoes

- Nao mexa em `src/styles.css`, `src/components/Editor.tsx` nem em nenhum outro arquivo.
- Nao renomeie nada que ja existe e nao mude comportamento que nao foi pedido.
- TypeScript strict: sem `any`, sem variaveis ou parametros nao usados.
