# Editor Sem Nome

Notebook pessoal — app desktop (Electron) que roda o mesmo código no navegador.

## Comandos

| Comando           | O que faz                                          |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Dev server + janela desktop                        |
| `npm run dev:web` | Só o navegador, em http://localhost:5173           |
| `npm run build`   | Checa os tipos e gera `dist/`                      |

## Atalhos

- `Ctrl + N` — nova nota
- `Ctrl + F` — buscar

## Estrutura

- `electron/main.cjs` — janela nativa
- `src/notes.ts` — modelo das notas e persistência (única camada que toca o storage)
- `src/components/` — lista lateral e editor
