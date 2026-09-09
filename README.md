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

O instalador sai em `%TEMP%/ardosia-build` — fora do projeto de propósito: o
antivírus segura os executáveis recém-copiados e o empacotamento falha com
`EPERM` se a saída ficar aqui dentro.

Instale o `.exe` e o app aparece no menu Iniciar como **Ardósia**. A partir daí
ele pergunta ao GitHub, toda vez que abre, se há versão nova; baixa em segundo
plano e espera você clicar em **Atualizar** na barra de título. Nunca reinicia
sozinho no meio de uma nota.

Para publicar uma versão: suba `version` no `package.json`, defina `GH_TOKEN` e
rode `npm run publicar`.

## Atalhos

- `Ctrl + N` — nova nota
- `Ctrl + F` — buscar dentro da nota aberta
- `Ctrl + Shift + F` — buscar entre as notas
- `Ctrl + K` — paleta de comandos
- **Duplo clique** em qualquer ponto vazio da nota — novo bloco de texto ali

## Escrever pela linha de comando

`ardosia` lê e escreve as mesmas notas do aplicativo, na mesma pasta. Serve para
um programa qualquer — uma IA, um script, um atalho — escrever aqui dentro sem
abrir o app. Não há servidor nem API: a interface é o disco, e o app aberto
mostra o que chegou porque já vigia a pasta.

```
ardosia listar [--json]
ardosia ler <nota> [--json]
ardosia criar <título> [--tipo texto]
ardosia escrever <nota> [texto] [--criar]
ardosia buscar <termo>
ardosia anexar <nota> <arquivo> [--fonte <url>]
ardosia pasta [--definir <caminho>]
```

`<nota>` é o id (o nome do arquivo, sem `.md`) ou o título por extenso. Sem
`[texto]`, `escrever` lê da entrada padrão — é assim que um agente manda um
parágrafo inteiro sem se preocupar com aspas:

```
echo "o que eu apurei hoje" | ardosia escrever "Aula de 9 de setembro"
ardosia escrever "Notas do dia" "primeira ideia" --criar --json
```

Toda saída tem versão `--json`, e erro sai com código ≠ 0: quem chama não
precisa interpretar prosa para saber se deu certo. `ARDOSIA_PASTA` no ambiente
tem prioridade sobre a pasta configurada — é como se trabalha numa pasta de
teste sem tocar no caderno de verdade. Nada é apagado por este comando.

Enquanto o projeto não está publicado no npm, `npm link` põe o `ardosia` no
PATH; `node cli/ardosia.mjs` funciona sempre.

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
- `cli/ardosia.mjs` — o comando: o que um agente enxerga
- `cli/notas.mjs` — as notas em disco, do lado da linha de comando
- `cli/formato.mjs` — o mesmo `.md`, em Node puro; `formato.test.ts` prova que não divergiu
- `build/gerar-icone.py` — gera o ícone a partir dos tokens do design

## Documentos que mandam no projeto

- `PROJETO.md` — o que é, os princípios e as fases
- `DESIGN.md` — a direção visual, com verificação executável
- `.agent/ROTEAMENTO.md` — qual modelo faz o quê, e como isso se ajusta
