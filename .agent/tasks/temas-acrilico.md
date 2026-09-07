---
model: qwen2.5-coder:14b
context: DESIGN.md, src/theme.test.ts, src/components/Editor.tsx
allow: src/theme.ts, src/styles.css, src/App.tsx, src/components/Sidebar.tsx
verify: node .agent/check-design.mjs && npm run test && npm run build
num_ctx: 16384
attempts: 4
---

# Tarefa: tres temas, com acrilico translucido como padrao

O app passa a ter tres temas. O padrao e o **acrilico**: dentro do Electron a
janela usa o material acrilico do Windows 11 (o mesmo do Windows Terminal), entao
o fundo da pagina precisa ser transparente para o sistema aparecer atras.

O DESIGN.md esta no contexto com os tres blocos de tokens **ja escritos**.
Copie-os exatamente como estao — nao invente cor, nao ajuste tom.

## 1. Crie src/theme.ts

Os testes em `src/theme.test.ts` sao o contrato e voce nao pode edita-los.
Exporte:

    export type TemaId = 'acrilico' | 'papel' | 'tinta';
    export const TEMAS: { id: TemaId; rotulo: string }[]
    export function carregarTema(): TemaId
    export function salvarTema(tema: TemaId): void

- `TEMAS` nesta ordem: acrilico ("Acrilico"), papel ("Papel"), tinta ("Tinta").
- Chave do localStorage: `editor-sem-nome:tema`.
- `carregarTema` devolve 'acrilico' quando nao ha nada guardado **ou** quando o
  valor guardado nao e um dos tres ids validos.
- Envolva os acessos ao localStorage em try/catch, como `notes.ts` ja faz.

## 2. src/styles.css

- Defina os tokens de cada tema em `:root, [data-theme="acrilico"]`,
  `[data-theme="papel"]` e `[data-theme="tinta"]`, copiando do DESIGN.md.
- Remova o bloco `@media (prefers-color-scheme: dark)`: agora quem manda e a
  escolha explicita do usuario.
- O `body` usa `background: var(--paper-solid)` por padrao. Somente quando o
  documento tem `data-native="true"` o fundo passa a ser `var(--paper)`:

      html[data-native="true"] body { background: var(--paper); }

  Isso e o que deixa o acrilico do sistema aparecer no app nativo sem quebrar a
  versao de navegador.
- Estilize o seletor de tema com as classes `.temas`, `.tema` e `.tema--on`:
  uma linha de tres rotulos em `--mono` 10px maiusculo com `letter-spacing`,
  separados por espaco, sem borda e sem fundo; o ativo usa `color: var(--accent)`,
  os outros `var(--ink-soft)`; hover leva a `var(--ink)`.
- Mantenha todo o resto do arquivo como esta. Nao mexa em nenhuma outra regra.

## 3. src/App.tsx

- Estado `tema` iniciado com `carregarTema()`.
- Um `useEffect` aplica no documento e persiste:

      document.documentElement.dataset.theme = tema;
      salvarTema(tema);

- Outro `useEffect`, rodando uma vez, marca o ambiente nativo:

      if (navigator.userAgent.includes('Electron')) {
        document.documentElement.dataset.native = 'true';
      }

- Passe `tema` e `onTrocarTema` para o `Sidebar`.

## 4. src/components/Sidebar.tsx

No rodape (`.sidebar__footer`), ao lado da contagem de notas, adicione o seletor:

    <div className="temas">
      {TEMAS.map((t) => (
        <button
          key={t.id}
          className={`tema${t.id === tema ? ' tema--on' : ''}`}
          onClick={() => onTrocarTema(t.id)}
        >
          {t.rotulo}
        </button>
      ))}
    </div>

Ajuste `.sidebar__footer` para acomodar as duas coisas na mesma linha, com a
contagem a esquerda e os temas a direita.

## Restricoes

- Nao edite `src/theme.test.ts`, `src/notes.ts`, `src/search.ts` nem `Editor.tsx`.
- Proibido `backdrop-filter` e `filter: blur()`: a translucidez vem do sistema
  operacional, nunca de efeito na pagina.
- TypeScript strict, sem `any`, sem variavel nao usada.
