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
- (1x) num campo controlado, nunca guarde posicao de texto em estado do React para usar depois: quem digita rapido passa na frente da reconciliacao e a substituicao parte o texto ao meio. Recalcule do proprio campo no momento de aplicar
- (1x) acrilico do Windows nao e transparencia: e vidro fosco, borra o que esta atras e nunca deixa ver. Transparencia de verdade exige transparent:true na criacao da janela, e os dois nao convivem
- (1x) duplo de teste complacente esconde bug: a ponte falsa tolerava renomear arquivo inexistente e o disco de verdade lanca ENOENT. Duplo tem de recusar o que o original recusa
- (1x) escreva o arquivo antes de renomea-lo: na primeira gravacao o nome provisorio ainda nao existe no disco
- (1x) o jsdom nao implementa scrollIntoView: preencha no test-setup, e nao com uma guarda no componente — defesa no codigo de producao para limitacao do ambiente de teste mente sobre o que o codigo precisa
- (1x) pagina de fumaca sem a arvore de layout do app da tamanho errado ao container, e elementFromPoint com coordenada chutada mede o lugar errado: ancore o ponto no getBoundingClientRect do proprio elemento
- (1x) `npm run lancar` em segundo plano falha nesta maquina e o erro chega truncado (so `pid/stdout/stderr null`): lance em primeiro plano, mesmo demorando
- (1x) decisao de comportamento visual escolhida por descricao escrita nao vale: o usuario aprovou "a figura nasce abaixo" no texto e recusou ao ver funcionando. Ofereca a escolha depois de mostrar, ou implemente o caminho que ele descreveu com as proprias palavras
- (1x) area de transferencia pode trazer mais de uma versao da mesma imagem (miniatura + original): pegar a primeira cola a miniatura. Escolha a maior
- (1x) fumaca de Electron sem try/catch em volta do executeJavaScript trava para sempre quando um seletor nao casa: a promessa fica pendurada e o app nunca sai
- (1x) conteudo da nota nunca pode depender do TIPO dela: a foto amarrada a `tipo === 'markdown'` sumia em nota de texto puro, e o app dizia que estava tudo bem. O que a secao guarda vai no marcador do bloco, nao no texto
- (1x) teste de modulo nao pega bug de integracao: a colagem tinha 37 testes de unidade verdes e gravava a foto sem escrever na nota. Cubra o caminho inteiro (App -> componente -> deposito -> arquivo)
- (1x) id de bloco gerado por randomUUID a cada leitura do arquivo faz TODA releitura da pasta trocar a identidade de todos os blocos: quem estava com o cursor num bloco, ou no meio de um await, perde o bloco de vista. Preserve os ids casando por posicao
- (1x) `agora.map(b => b.id === alvo.id ? mudar(b) : b)` que nao casa nenhum id nao falha: devolve a lista inalterada e o trabalho some em silencio. Depois de um await, sempre trate o caso de o alvo ter deixado de existir
- (1x) medir DESENHO nao e medir CARREGAMENTO: passei tres rodadas conferindo tamanho de imagem enquanto o defeito era a foto nunca chegar ao bloco. Quando o usuario diz 'quebrada', teste o onerror, nao o layout
- (1x) teste que mede tempo com entrada pequena e instavel: o caso quadratico com 120 itens cabia no ruido do relogio e acusava por sorte. Base grande o bastante para a diferenca sair do ruido
