# Lições aprendidas

Erros que a validação já pegou neste projeto. Cada linha entra no prompt das
próximas tarefas. Gerado pelo run.mjs — pode editar e reescrever à mão.

- (3x) font-size Npx fora da escala 10/12/14/16/19/24
- (3x) border-radius Npx: o maximo e 2px
- (3x) error TS1484: 'TemaId' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
- (3x) error TS2552: Cannot find name 'TEMAS'. Did you mean 'tema'?
- (3x) error TS7006: Parameter 't' implicitly has an 'any' type.
- (3x) error TS2686: 'React' refers to a UMD global, but the current file is a module. Consider adding an import instead.
- (2x) cantos arredondados proibidos: nada de 50% nem 999px, inclusive em scrollbar
- (2x) cor literal "rgba(" fora dos tokens: use var(--...), inclusive em hover e ::selection
- (2x) error TS2304: Cannot find name 'searchRef'.
- (1x) gradiente proibido pelo DESIGN.md
- (1x) cor nao pertence a paleta do DESIGN.md
- (1x) textarea com max-width e margin auto dentro de flex-column encolhe para a largura intrinseca de 20 caracteres: sempre acrescente width: 100%
- (1x) error TS2304: Cannot find name 'useMemo'.
- (1x) nunca chame .sort() direto em estado do React: sort() muta o array, sempre copie antes com [...lista]
- (1x) arquivo .md editado no Windows volta com CRLF e as vezes BOM: normalize antes de procurar frontmatter, senao ele vira texto da nota
- (1x) nunca mande um subagente "nao deixar rastro": ele resolve com git restore e apaga trabalho de outro agente. Peca para trabalhar fora do repositorio
- (1x) textarea controlado: depois de mudar o texto no keydown, aplique a selecao com flushSync e nao com requestAnimationFrame, senao quem digita rapido perde letras
- (1x) efeito que ajusta altura a partir de scrollHeight precisa de folga: sem margem, o scrollHeight volta 1px maior que a altura recem-aplicada e o efeito se realimenta ate travar a aba
- (1x) efeito que projeta algo sobre HTML injetado por dangerouslySetInnerHTML precisa rodar a cada render, sem lista de dependencias: o React reescreve esse HTML em rerrenderizacoes que nada tem a ver com o conteudo, e leva junto o que foi injetado por fora
- (1x) ao reprocessar um elemento ja transformado, leia a fonte guardada em data-*, nunca o textContent: depois da primeira vez o textContent e o resultado, nao a entrada
- (1x) teste de interface que procura um botao dentro de um painel fechado passa sem testar nada; confirme que o elemento existe antes de medir o efeito do clique
