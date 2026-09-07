# Ardósia

Caderno de estudo local-first. Escreva em qualquer ponto da página: cada trecho
é um bloco que você move e redimensiona, como numa folha de rascunho.

App desktop (Electron, com o material acrílico do Windows 11) rodando o mesmo
código no navegador.

## Comandos

| Comando           | O que faz                                          |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Dev server + janela desktop                        |
| `npm run dev:web` | Só o navegador, em http://localhost:5173           |
| `npm run check`   | Tipos, testes e build — o portão antes de commitar |
| `npm run test`    | Só os testes                                       |
| `npm run dist`    | Gera o instalador do Windows em `release/`         |

Depois de `npm run dist`, instale o `.exe` de `release/` para o app aparecer no
menu Iniciar como **Ardósia**.

## Atalhos

- `Ctrl + N` — nova nota
- `Ctrl + F` — buscar
- **Duplo clique** em qualquer ponto vazio da nota — novo bloco de texto ali

## Estrutura

- `electron/main.cjs` — janela nativa e material acrílico
- `src/notes.ts` — modelo das notas e persistência (única camada que toca o storage)
- `src/canvas.ts` — blocos de texto posicionados
- `src/search.ts` — busca que ignora acentos
- `src/theme.ts` — temas acrílico, papel e tinta
- `src/components/` — lista lateral, editor e canvas
- `build/gerar-icone.py` — gera o ícone a partir dos tokens do design

## Documentos que mandam no projeto

- `PROJETO.md` — o que é, os princípios e as fases
- `DESIGN.md` — a direção visual, com verificação executável
- `.agent/ROTEAMENTO.md` — qual modelo faz o quê, e como isso se ajusta
