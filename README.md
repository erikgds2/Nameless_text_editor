# Ardósia

Caderno de estudo local-first. Escreva em qualquer ponto da página: cada trecho
é um bloco que você move e redimensiona, como numa folha de rascunho.

Cada nota é um arquivo `.md` numa pasta sua — em `Documentos\Ardósia`, até você
escolher outra. Dá para editar no Bloco de Notas, versionar no git ou fazer
backup como qualquer outro arquivo de texto.

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
- `electron/preload.cjs` — a única ponte entre a nota na tela e o arquivo em disco
- `electron/notas.cjs` — acesso ao disco, com a pasta validada aqui e em nenhum outro lugar
- `src/deposito.ts` — onde as notas moram: disco no desktop, `localStorage` no navegador
- `src/formato.ts` — a nota escrita como `.md` e lida de volta
- `src/nomes.ts` — o título virando nome de arquivo
- `src/notes.ts` — modelo das notas
- `src/canvas.ts` — blocos de texto posicionados
- `src/search.ts` — busca que ignora acentos
- `src/theme.ts` — temas acrílico, papel e tinta
- `src/components/` — lista lateral, editor e canvas
- `build/gerar-icone.py` — gera o ícone a partir dos tokens do design

## Documentos que mandam no projeto

- `PROJETO.md` — o que é, os princípios e as fases
- `DESIGN.md` — a direção visual, com verificação executável
- `.agent/ROTEAMENTO.md` — qual modelo faz o quê, e como isso se ajusta
