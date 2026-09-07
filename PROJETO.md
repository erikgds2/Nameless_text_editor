# Ardósia

Caderno de estudo local-first. Ferramenta interna, feita para uma pessoa só.

## O que é e o que não é

**É** um lugar para capturar, reler e memorizar. Notas curtas, fichas de leitura,
resumos de matéria — e um jeito de transformar isso em conhecimento retido.

**Não é** um editor de código. Nada de abas de arquivo, painel de projeto,
terminal integrado ou LSP. Se uma feature faria sentido no VS Code, ela
provavelmente não pertence aqui.

## Princípios

Cada um destes veio de uma reclamação recorrente nas comunidades, não de intuição.

1. **A busca é a organização.** Quem usa notas de verdade abandona hierarquias e
   acha tudo por busca. Pastas e tags são opcionais; a busca nunca é.
2. **Os arquivos são seus.** Markdown legível em disco, sem banco proprietário.
   Lock-in de formato é a queixa nº 1 sobre Evernote e Notion.
3. **Captura em dois segundos.** O motivo de o Apple Notes vencer apps melhores é
   que ele abre e escreve antes de você mudar de ideia.
4. **Offline sempre, privado por padrão.** Nada sai da máquina sem pedido explícito.
5. **Aprender, não só arquivar.** Um caderno de estudo que não ajuda a lembrar é
   um cemitério de notas. É isso que separa este projeto de mais um app de notas.
6. **Sem bloat.** Toda feature nova precisa justificar seu peso na interface.
   Bloat é o que empurra as pessoas para fora dos apps, não a falta de recursos.

## Arquitetura

```
Electron (janela nativa)  ─┐
                           ├─ mesmo app React + TypeScript
Navegador (npm run dev:web)┘

src/notes.ts        camada de dados — o resto do app não sabe onde as notas moram
src/components/     UI
electron/main.cjs   janela e, a partir da fase 2, o acesso ao disco
```

A camada de dados é a única que conhece o armazenamento. Trocar localStorage por
arquivos em disco muda um arquivo, não o app.

## Fases

### Fase 1 — Bloco de notas ✅

Lista, editor, busca, autosave, fixar notas. Guardado em `localStorage`.

### Fase 2 — Fundação: arquivos de verdade

O `localStorage` é uma prótese: ele não sobrevive ao empacotamento e ninguém
consegue abrir as notas fora do app.

- Cada nota vira um `.md` numa pasta escolhida por você, com frontmatter mínimo.
- Acesso ao disco via IPC do Electron (`contextBridge`, sem `nodeIntegration`).
- Migração automática do que já está no `localStorage`.
- Busca que **ignora acentos e maiúsculas** — o terceiro pedido mais discutido do
  fórum do Obsidian, e obrigatório em português.
- Na web, degrada para File System Access API ou segue em `localStorage`.

*Pronto quando:* fechar o app, editar a nota no Bloco de Notas do Windows, reabrir
e ver a edição.

### Fase 3 — Escrita

- **Escrita livre em blocos** ✅ — duplo clique em qualquer ponto da nota cria um
  bloco de texto ali; cada bloco se move e se redimensiona, como no OneNote.
  Os blocos são transparentes: o material da janela aparece através deles.
- Markdown renderizado enquanto se digita (títulos, listas, negrito, citação, código).
- Paleta de comandos em `Ctrl+K`: tudo alcançável sem mouse.
- **Captura rápida global**: um atalho do sistema abre uma janelinha, você escreve,
  ela some. O princípio nº 3 vive ou morre aqui.
- Modo foco: some tudo menos o texto.

*Pronto quando:* dá para escrever uma sessão inteira sem tocar no mouse.

### Fase 4 — Conexão

- `[[links]]` entre notas com autocompletar.
- Backlinks: "o que aponta para esta nota".
- Nota do dia, criada sozinha ao abrir.

*Pronto quando:* uma nota de aula referencia três conceitos e você navega entre eles.

### Fase 5 — Estudo (o que torna o projeto meu, e não mais um app de notas)

- Grifar um trecho e transformá-lo em pergunta sem sair da nota.
- Agendamento por **FSRS** (o algoritmo que RemNote, Mochi e Anki moderno usam).
- Fila diária: quantos cartões hoje, e nada além disso na tela.
- O cartão sempre linka de volta ao parágrafo de origem.

*Pronto quando:* uma semana de revisões acontece sem abrir outro aplicativo.

### Fase 6 — Distribuição

- Empacotar `.exe` com electron-builder.
- Publicar a versão web (a feature nº 1 mais pedida do Obsidian, com 256 mil
  visualizações no fórum — e que nossa arquitetura já dá de graça).
- Sincronização, se ainda fizer falta. Provavelmente não fará.

## Fora de escopo

Colaboração em tempo real · comentários · IA escrevendo suas notas por você ·
banco de dados relacional · kanban · calendário · gráfico de conhecimento
tridimensional bonito e inútil.

## Como este projeto é construído

Trabalho dividido entre modelos, por tipo de ação, com o mais caro reservado
para o que erra caro. A política está em `.agent/ROTEAMENTO.md` e o desempenho
real de cada atribuição é medido em `.agent/registro.jsonl`.

Três documentos mandam em tudo:

- `DESIGN.md` — lei para qualquer coisa visual, com verificação executável
  em `.agent/check-design.mjs`
- `.agent/ROTEAMENTO.md` — qual modelo faz o quê, e quando trocar
- `.agent/licoes.md` — erros já cometidos aqui, reinjetados em toda tarefa

O princípio por trás dos três: **regra que pode virar código de verificação vira
código**; o que só pode ser dito em prosa vira instrução escrita; e só o que
sobra chega à revisão humana.
