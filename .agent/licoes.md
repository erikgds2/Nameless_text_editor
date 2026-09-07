# Lições aprendidas

Erros que a validação já pegou neste projeto. Cada linha entra no prompt das
próximas tarefas. Gerado pelo run.mjs — pode editar e reescrever à mão.

- (3x) font-size Npx fora da escala 10/12/14/16/19/24
- (3x) border-radius Npx: o maximo e 2px
- (2x) cantos arredondados proibidos: nada de 50% nem 999px, inclusive em scrollbar
- (2x) cor literal "rgba(" fora dos tokens: use var(--...), inclusive em hover e ::selection
- (1x) gradiente proibido pelo DESIGN.md
- (1x) cor nao pertence a paleta do DESIGN.md
- (1x) textarea com max-width e margin auto dentro de flex-column encolhe para a largura intrinseca de 20 caracteres: sempre acrescente width: 100%
