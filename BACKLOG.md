# BACKLOG — 100 melhorias

Cem itens, agrupados por tema e ordenados por valor dentro de cada
grupo. Marcados assim:

- `[ ]` a fazer · `[~]` em andamento · `[x]` pronto
- **P1** dói agora · **P2** melhora muito · **P3** quando sobrar tempo

Regras que valem para todos: nada entra sem teste automático ou verificação
executável; nada entra que viole o `DESIGN.md`; e nenhuma feature entra só
porque é possível — cada uma paga o próprio peso na interface (princípio nº 6).

---

## A. Escrita e edição (1–18)

| # | | Item |
| --- | --- | --- |
| 1 | `[ ]` **P1** | Desfazer/refazer do documento inteiro (`Ctrl+Z`/`Ctrl+Y`), não só dentro de um bloco |
| 2 | `[x]` **P1** | Duplo `Enter` em lista encerra a lista, como em todo editor de Markdown |
| 3 | `[x]` **P1** | Continuação automática de lista: `Enter` numa linha `- ` cria o próximo `- ` |
| 4 | `[x]` **P1** | `Tab`/`Shift+Tab` aninham e desaninham item de lista |
| 5 | `[x]` **P2** | `Ctrl+B` / `Ctrl+I` / `Ctrl+K` envolvem a seleção em negrito, itálico e link |
| 6 | `[ ]` **P2** | Arrastar bloco com guias de alinhamento entre blocos vizinhos |
| 7 | `[ ]` **P2** | Selecionar vários blocos e mover em conjunto |
| 8 | `[x]` **P2** | Colar imagem da área de transferência: salva ao lado do `.md` e insere `![](...)` |
| 9 | `[ ]` **P2** | Colar URL sobre texto selecionado vira `[texto](url)` |
| 10 | `[ ]` **P2** | Bloco encolhe sozinho quando se apaga texto (hoje só cresce) |
| 11 | `[ ]` **P2** | Modo foco: some tudo menos o bloco em edição (`Ctrl+Shift+F`) |
| 12 | `[ ]` **P2** | Largura máxima de leitura configurável no bloco (medida em ch) |
| 13 | `[ ]` **P3** | Grade opcional de alinhamento no canvas, de 8px |
| 14 | `[ ]` **P3** | Duplicar bloco com `Ctrl+D` |
| 15 | `[ ]` **P3** | Ordenar blocos automaticamente numa coluna ("arrumar a página") |
| 16 | `[ ]` **P3** | Cor de fundo por bloco, escolhida entre os tokens do tema |
| 17 | `[ ]` **P3** | Zoom do canvas (`Ctrl` + roda) para ver a página inteira |
| 18 | `[ ]` **P3** | Bloco de desenho à mão livre, para diagrama rápido |

## B. Markdown (19–30)

| # | | Item |
| --- | --- | --- |
| 19 | `[x]` **P1** | Tabelas: `\| a \| b \|` no motor e no preview |
| 20 | `[x]` **P1** | Lista de tarefas `- [ ]` / `- [x]`, clicável direto na pré-visualização |
| 21 | `[ ]` **P2** | Cerca de código com linguagem (` ```ts `) e realce de sintaxe no preview |
| 22 | `[ ]` **P2** | Rolagem sincronizada entre editor e pré-visualização |
| 23 | `[ ]` **P2** | Cabeçalho `#` aumenta de tamanho no próprio editor, não só no preview |
| 24 | `[ ]` **P2** | Exportar a nota como HTML e como PDF |
| 25 | `[x]` **P3** | Imagens no preview, lendo o arquivo da pasta da nota |
| 26 | `[ ]` **P3** | Notas de rodapé `[^1]` |
| 27 | `[ ]` **P3** | Fórmula matemática (`$...$`), útil para as notas de cálculo |
| 28 | `[ ]` **P3** | Sumário automático a partir dos títulos |
| 29 | `[ ]` **P3** | Colar HTML converte para Markdown |
| 30 | `[x]` **P3** | Diagrama Mermaid no preview |

## C. Organização e busca (31–43)

| # | | Item |
| --- | --- | --- |
| 31 | `[x]` **P1** | Busca dentro da nota aberta, com realce das ocorrências |
| 32 | `[x]` **P1** | Paleta de comandos (`Ctrl+K`): abrir nota, trocar tema, tudo sem mouse |
| 33 | `[x]` **P1** | Busca mostra o trecho onde o termo apareceu, não só o começo da nota |
| 34 | `[ ]` **P2** | Tags `#assunto` no texto viram filtro na barra lateral |
| 35 | `[ ]` **P2** | Ordenar a lista por título, criação ou edição |
| 36 | `[ ]` **P2** | Lixeira: apagar move para `.lixeira/` e dá 30 dias de arrependimento |
| 37 | `[ ]` **P2** | Duplicar nota |
| 38 | `[ ]` **P2** | Renomear a nota (e o arquivo) pela interface |
| 39 | `[ ]` **P3** | Subpastas na pasta de notas, refletidas na lista |
| 40 | `[ ]` **P3** | Busca por operadores: `titulo:`, `criada:>2026-01` |
| 41 | `[ ]` **P3** | Histórico de versões da nota, lendo o git da pasta se houver |
| 42 | `[ ]` **P3** | Notas favoritas separadas das fixadas |
| 43 | `[ ]` **P3** | Estatísticas: quanto se escreveu por dia |

## D. Conexão entre notas — Fase 4 (44–50)

| # | | Item |
| --- | --- | --- |
| 44 | `[ ]` **P1** | `[[links]]` entre notas, com autocompletar enquanto digita |
| 45 | `[ ]` **P1** | Clicar num `[[link]]` abre a nota; `[[link]]` para nota inexistente a cria |
| 46 | `[ ]` **P1** | Backlinks: "o que aponta para esta nota", no rodapé do editor |
| 47 | `[ ]` **P2** | Nota do dia, criada sozinha ao abrir o app |
| 48 | `[ ]` **P2** | Autocompletar de `[[` mostra o trecho inicial da nota candidata |
| 49 | `[ ]` **P3** | Renomear nota atualiza os `[[links]]` que apontam para ela |
| 50 | `[ ]` **P3** | Notas órfãs: quais não são referenciadas por ninguém |

## E. Estudo — Fase 5, o que torna o projeto dele (51–60)

| # | | Item |
| --- | --- | --- |
| 51 | `[ ]` **P1** | Grifar um trecho e transformá-lo em pergunta sem sair da nota |
| 52 | `[ ]` **P1** | Agendamento por FSRS, o algoritmo do Anki moderno e do RemNote |
| 53 | `[ ]` **P1** | Fila diária: quantos cartões hoje, e nada além disso na tela |
| 54 | `[ ]` **P1** | O cartão sempre linka de volta ao parágrafo de origem |
| 55 | `[ ]` **P2** | Cartões guardados no próprio `.md`, para não criar banco paralelo |
| 56 | `[ ]` **P2** | Cloze: esconder um trecho no meio da frase |
| 57 | `[ ]` **P2** | Cartão de mão dupla (frente↔verso) para vocabulário |
| 58 | `[ ]` **P3** | Painel de progresso: acertos, intervalo médio, previsão da semana |
| 59 | `[ ]` **P3** | Importar/exportar baralho em formato do Anki |
| 60 | `[ ]` **P3** | Sugerir cartões a partir de trechos grifados que ainda não viraram pergunta |

## F. Arquivos e confiança (61–72)

| # | | Item |
| --- | --- | --- |
| 61 | `[x]` **P1** | Recarregar a nota quando o arquivo muda em disco, com o app aberto |
| 62 | `[ ]` **P1** | Aviso de conflito quando o arquivo mudou por fora e por dentro ao mesmo tempo |
| 63 | `[x]` **P1** | Indicador de "salvo / salvando / erro ao salvar" visível |
| 64 | `[ ]` **P2** | Backup automático diário da pasta, em zip, com retenção curta |
| 65 | `[ ]` **P2** | Abrir a nota na pasta pelo Explorer (menu de contexto na lista) |
| 66 | `[ ]` **P2** | Importar uma pasta de `.md` existente (Obsidian, Notion exportado) |
| 67 | `[ ]` **P2** | Exportar tudo em zip |
| 68 | `[ ]` **P3** | Anexos: arrastar arquivo para dentro da nota |
| 69 | `[ ]` **P3** | Detectar e reparar `.md` com frontmatter corrompido |
| 70 | `[ ]` **P3** | Suporte a File System Access API no navegador |
| 71 | `[ ]` **P3** | Criptografar notas marcadas como privadas |
| 72 | `[ ]` **P3** | Sincronização opcional por pasta compartilhada, sem servidor |

## G. Interface e visual (73–83)

| # | | Item |
| --- | --- | --- |
| 73 | `[x]` **P1** | Blocos fora da área visível quando a pré-visualização abre: reposicionar ou avisar |
| 74 | `[x]` **P1** | Divisória arrastável entre editor e pré-visualização |
| 75 | `[ ]` **P2** | Barra lateral recolhível (`Ctrl+\`) |
| 76 | `[ ]` **P2** | Escolher a fonte do corpo entre as monoespaçadas instaladas |
| 77 | `[ ]` **P2** | Acompanhar o tema claro/escuro do Windows automaticamente |
| 78 | `[ ]` **P2** | Estado vazio da primeira abertura que ensine o básico em três linhas |
| 79 | `[ ]` **P3** | Lembrar tamanho e posição da janela entre sessões |
| 80 | `[ ]` **P3** | Ícone na bandeja do sistema, com captura rápida |
| 81 | `[ ]` **P3** | Abas, como no Notepads, para várias notas abertas |
| 82 | `[ ]` **P3** | Tema de alto contraste, para quando a vista cansa de vez |
| 83 | `[ ]` **P3** | Animação de entrada da nota ao trocar de seleção (dentro do limite de 250ms) |

## H. Teclado, acesso e captura (84–90)

| # | | Item |
| --- | --- | --- |
| 84 | `[x]` **P1** | Captura rápida global: atalho do sistema abre uma janelinha, escreve, some |
| 85 | `[x]` **P1** | Navegar a lista de notas pelo teclado (setas, Enter abre) |
| 86 | `[ ]` **P2** | Todos os atalhos configuráveis nos Ajustes |
| 87 | `[ ]` **P2** | Leitor de tela: rótulos e regiões corretas em toda a interface |
| 88 | `[ ]` **P2** | `Esc` sai do bloco para a lista sem usar o mouse |
| 89 | `[ ]` **P3** | Ajuda de atalhos sobreposta com `Ctrl+/` |
| 90 | `[ ]` **P3** | Modo de comando estilo Vim, opcional |

## I. Qualidade, testes e ferramentas (91–100)

| # | | Item |
| --- | --- | --- |
| 91 | `[x]` **P1** | Testes de componente (React Testing Library): hoje só há testes de módulo |
| 92 | `[ ]` **P1** | Teste de ponta a ponta do Electron: abrir, escrever, fechar, reabrir |
| 93 | `[ ]` **P1** | Teste do IPC: nenhum caminho fora da pasta é aceito, em nenhuma rota |
| 94 | `[ ]` **P2** | Teste de propriedade no formato: qualquer nota sobrevive à ida e volta |
| 95 | `[ ]` **P2** | Medir desempenho com 1.000 notas e 10.000 linhas numa nota |
| 96 | `[ ]` **P2** | Verificador de acessibilidade no `npm run check` |
| 97 | `[ ]` **P2** | Cobertura de testes reportada, com piso que não pode cair |
| 98 | `[ ]` **P3** | Atualização automática do app instalado |
| 99 | `[ ]` **P3** | Registro de erros em arquivo, para diagnosticar sem console aberto |
| 100 | `[ ]` **P3** | Publicar a versão web, que a arquitetura já dá de graça |

---

## Ordem sugerida de ataque

1. **Escrever sem atrito** — 1, 2, 3, 4, 5 (o editor ainda perde para o Bloco de Notas em desfazer)
2. **Achar as coisas** — 32, 31, 33
3. **Confiar no que foi salvo** — 63, 61, 62
4. **Ligar as notas** — 44, 45, 46
5. **Estudar de verdade** — 51, 52, 53, 54
6. **Capturar em dois segundos** — 84
