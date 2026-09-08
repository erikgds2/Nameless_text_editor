import { describe, expect, it } from 'vitest';
import { realcar, renderizar } from './markdown';

/** Remove tags HTML e desescapa entidades, para comparar com o texto original. */
function textoVisivel(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

describe('renderizar', () => {
  it('reconhece títulos de nível 1 a 6', () => {
    expect(renderizar('# Título')).toBe('<h1>Título</h1>');
    expect(renderizar('###### Seis')).toBe('<h6>Seis</h6>');
  });

  it('sete cerquilhas não formam título, vira parágrafo', () => {
    expect(renderizar('####### Sete')).toBe('<p>####### Sete</p>');
  });

  it('cerquilha sem espaço não é título', () => {
    expect(renderizar('#Sem espaço')).toBe('<p>#Sem espaço</p>');
  });

  it('marcações inline básicas', () => {
    expect(renderizar('**a**')).toBe('<p><strong>a</strong></p>');
    expect(renderizar('*a*')).toBe('<p><em>a</em></p>');
    expect(renderizar('_a_')).toBe('<p><em>a</em></p>');
    expect(renderizar('`a`')).toBe('<p><code>a</code></p>');
    expect(renderizar('~~a~~')).toBe('<p><del>a</del></p>');
  });

  it('aninha ênfase dentro de negrito', () => {
    expect(renderizar('**a *b* c**')).toBe('<p><strong>a <em>b</em> c</strong></p>');
  });

  it('ênfase não fecha através de linha em branco', () => {
    expect(renderizar('*a\n\nb*')).toBe('<p>*a</p><p>b*</p>');
  });

  it('agrupa itens de lista não ordenada em um único ul', () => {
    expect(renderizar('- um\n- dois\n- três')).toBe('<ul><li>um</li><li>dois</li><li>três</li></ul>');
  });

  it('agrupa itens de lista ordenada em um único ol', () => {
    expect(renderizar('1. um\n2. dois\n3. três')).toBe('<ol><li>um</li><li>dois</li><li>três</li></ol>');
  });

  it('agrupa linhas de citação consecutivas em um único blockquote', () => {
    expect(renderizar('> primeira\n> segunda')).toBe('<blockquote>primeira<br>segunda</blockquote>');
  });

  it('bloco de código preserva marcadores como texto literal', () => {
    const html = renderizar('```\n# isto\n**aquilo**\n```');
    expect(html).toBe('<pre><code># isto\n**aquilo**</code></pre>');
  });

  it('bloco de código não fechado até o fim do texto ainda renderiza', () => {
    const html = renderizar('```\ncódigo sem fim');
    expect(html).toBe('<pre><code>código sem fim</code></pre>');
  });

  it('escapa html do usuário, nunca vira tag', () => {
    const html = renderizar('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('rejeita url javascript: em link', () => {
    const html = renderizar('[x](javascript:alert(1))');
    expect(html).not.toContain('<a ');
    expect(html).toContain('[x](javascript:alert(1))');
  });

  it('aceita link http(s) e #, com target e rel', () => {
    const html = renderizar('[x](https://exemplo.com)');
    expect(html).toBe('<p><a href="https://exemplo.com" target="_blank" rel="noreferrer">x</a></p>');
    const ancora = renderizar('[x](#topo)');
    expect(ancora).toBe('<p><a href="#topo" target="_blank" rel="noreferrer">x</a></p>');
  });

  it('régua horizontal', () => {
    expect(renderizar('---')).toBe('<hr>');
  });

  it('texto com acentuação e emoji atravessa intacto', () => {
    const texto = 'Não é? Café com açaí 🎉✨';
    expect(renderizar(texto)).toBe(`<p>${texto}</p>`);
  });

  it('texto vazio devolve string vazia', () => {
    expect(renderizar('')).toBe('');
  });

  it('tabela simples com cabeçalho e uma linha', () => {
    const texto = '| Conceito | Definição |\n| --- | --- |\n| Limite | valor de aproximação |';
    expect(renderizar(texto)).toBe(
      '<div class="preview__tabela"><table><thead><tr><th>Conceito</th><th>Definição</th></tr></thead>' +
        '<tbody><tr><td>Limite</td><td>valor de aproximação</td></tr></tbody></table></div>',
    );
  });

  it('tabela com alinhamento à esquerda, à direita e ao centro', () => {
    const texto = '| A | B | C |\n| :--- | ---: | :---: |\n| a | b | c |';
    expect(renderizar(texto)).toBe(
      '<div class="preview__tabela"><table><thead><tr>' +
        '<th style="text-align:left">A</th><th style="text-align:right">B</th><th style="text-align:center">C</th>' +
        '</tr></thead><tbody><tr>' +
        '<td style="text-align:left">a</td><td style="text-align:right">b</td><td style="text-align:center">c</td>' +
        '</tr></tbody></table></div>',
    );
  });

  it('formatação inline funciona dentro de célula de tabela', () => {
    const texto = '| Nome | Nota |\n| --- | --- |\n| **negrito** | `código` |';
    expect(renderizar(texto)).toBe(
      '<div class="preview__tabela"><table><thead><tr><th>Nome</th><th>Nota</th></tr></thead>' +
        '<tbody><tr><td><strong>negrito</strong></td><td><code>código</code></td></tr></tbody></table></div>',
    );
  });

  it('linha de tabela com número de colunas irregular é completada ou cortada', () => {
    const texto = '| A | B |\n| --- | --- |\n| um |\n| um | dois | três |';
    expect(renderizar(texto)).toBe(
      '<div class="preview__tabela"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody>' +
        '<tr><td>um</td><td></td></tr>' +
        '<tr><td>um</td><td>dois</td></tr>' +
        '</tbody></table></div>',
    );
  });

  it('sem a linha separadora não vira tabela, viram parágrafos comuns', () => {
    const texto = '| A | B |\n| um | dois |';
    expect(renderizar(texto)).toBe('<p>| A | B |<br>| um | dois |</p>');
  });

  it('pipe escapado dentro de uma célula é literal, não separador', () => {
    const texto = '| A | B |\n| --- | --- |\n| a\\|b | c |';
    expect(renderizar(texto)).toBe(
      '<div class="preview__tabela"><table><thead><tr><th>A</th><th>B</th></tr></thead>' +
        '<tbody><tr><td>a|b</td><td>c</td></tr></tbody></table></div>',
    );
  });

  it('tabela seguida de parágrafo sem linha em branco entre eles', () => {
    const texto = '| A | B |\n| --- | --- |\n| a | b |\nDepois da tabela.';
    expect(renderizar(texto)).toBe(
      '<div class="preview__tabela"><table><thead><tr><th>A</th><th>B</th></tr></thead>' +
        '<tbody><tr><td>a</td><td>b</td></tr></tbody></table></div><p>Depois da tabela.</p>',
    );
  });

  it('tarefa desmarcada e marcada, incluindo X maiúsculo', () => {
    expect(renderizar('- [ ] fazer')).toBe(
      '<ul><li class="tarefa"><input type="checkbox" disabled> fazer</li></ul>',
    );
    expect(renderizar('- [x] feito')).toBe(
      '<ul><li class="tarefa"><input type="checkbox" checked disabled> feito</li></ul>',
    );
    expect(renderizar('- [X] feito')).toBe(
      '<ul><li class="tarefa"><input type="checkbox" checked disabled> feito</li></ul>',
    );
  });

  it('lista mista com itens comuns e itens de tarefa', () => {
    expect(renderizar('- normal\n- [ ] tarefa\n- [x] outra')).toBe(
      '<ul><li>normal</li>' +
        '<li class="tarefa"><input type="checkbox" disabled> tarefa</li>' +
        '<li class="tarefa"><input type="checkbox" checked disabled> outra</li></ul>',
    );
  });

  it('imagem simples', () => {
    expect(renderizar('![alt](https://exemplo.com/a.png)')).toBe(
      '<p><img src="https://exemplo.com/a.png" alt="alt"></p>',
    );
  });

  it('imagem com alt vazio', () => {
    expect(renderizar('![](https://exemplo.com/a.png)')).toBe(
      '<p><img src="https://exemplo.com/a.png" alt=""></p>',
    );
  });

  it('imagem com alt contendo aspas e < é escapado como atributo', () => {
    expect(renderizar('![a "b" <c>](https://exemplo.com/a.png)')).toBe(
      '<p><img src="https://exemplo.com/a.png" alt="a &quot;b&quot; &lt;c&gt;"></p>',
    );
  });

  it('imagem dentro de item de lista', () => {
    expect(renderizar('- ![alt](https://exemplo.com/a.png)')).toBe(
      '<ul><li><img src="https://exemplo.com/a.png" alt="alt"></li></ul>',
    );
  });

  it('imagem dentro de célula de tabela', () => {
    const texto = '| A |\n| --- |\n| ![alt](https://exemplo.com/a.png) |';
    expect(renderizar(texto)).toBe(
      '<div class="preview__tabela"><table><thead><tr><th>A</th></tr></thead>' +
        '<tbody><tr><td><img src="https://exemplo.com/a.png" alt="alt"></td></tr></tbody></table></div>',
    );
  });

  it('imagem dentro de link', () => {
    expect(renderizar('[![alt](https://exemplo.com/a.png)](https://destino.com)')).toBe(
      '<p><a href="https://destino.com" target="_blank" rel="noreferrer">' +
        '<img src="https://exemplo.com/a.png" alt="alt"></a></p>',
    );
  });

  it('rejeita origem javascript: em imagem', () => {
    const html = renderizar('![x](javascript:alert(1))');
    expect(html).not.toContain('<img');
    expect(html).toContain('![x](javascript:alert(1))');
  });

  it('rejeita origem data: em imagem', () => {
    const html = renderizar('![x](data:image/png;base64,AAA)');
    expect(html).not.toContain('<img');
    expect(html).toContain('![x](data:image/png;base64,AAA)');
  });

  it('rejeita caminho relativo fora de anexos/ em imagem', () => {
    const html = renderizar('![x](../fora.png)');
    expect(html).not.toContain('<img');
    expect(html).toContain('![x](../fora.png)');
  });

  it('aceita caminho relativo anexos/ em imagem', () => {
    expect(renderizar('![x](anexos/foto.png)')).toBe('<p><img src="anexos/foto.png" alt="x"></p>');
  });

  it('aceita origem ardosia:// em imagem', () => {
    expect(renderizar('![x](ardosia://anexos/foto.png)')).toBe(
      '<p><img src="ardosia://anexos/foto.png" alt="x"></p>',
    );
  });

  it('cerca de código com linguagem gera classe linguagem-X', () => {
    const html = renderizar('```js\nconst a = 1;\n```');
    expect(html).toBe('<pre><code class="linguagem-js">const a = 1;</code></pre>');
  });

  it('cerca com linguagem em maiúsculo é normalizada para minúsculo', () => {
    const html = renderizar('```JS\nconst a = 1;\n```');
    expect(html).toBe('<pre><code class="linguagem-js">const a = 1;</code></pre>');
  });

  it('cerca com linguagem mermaid vira <pre class="diagrama"> sem classe no <code>', () => {
    const html = renderizar('```mermaid\ngraph TD\nA --> B\n```');
    expect(html).toBe('<pre class="diagrama"><code>graph TD\nA --&gt; B</code></pre>');
  });

  it('cerca com mermaid maiúsculo também vira diagrama', () => {
    const html = renderizar('```MERMAID\ngraph TD\n```');
    expect(html).toBe('<pre class="diagrama"><code>graph TD</code></pre>');
  });

  it('conteúdo de cerca mermaid não é interpretado como Markdown', () => {
    const html = renderizar('```mermaid\n**não vira negrito**\n```');
    expect(html).toBe('<pre class="diagrama"><code>**não vira negrito**</code></pre>');
  });

  it('cerca com linguagem válida contendo + e -', () => {
    const html = renderizar('```c++\ncodigo\n```');
    expect(html).toBe('<pre><code class="linguagem-c++">codigo</code></pre>');
  });

  it('cerca com linguagem inválida vira cerca sem linguagem', () => {
    const html = renderizar('```c#$\ncodigo\n```');
    expect(html).toBe('<pre><code>codigo</code></pre>');
  });

  it('cerca sem linguagem continua gerando <pre><code> simples', () => {
    const html = renderizar('```\ncodigo\n```');
    expect(html).toBe('<pre><code>codigo</code></pre>');
  });
});

describe('realcar', () => {
  it('texto vazio devolve string vazia', () => {
    expect(realcar('')).toBe('');
  });

  it('mantém o # visível, envolto em span', () => {
    const html = realcar('# Título');
    expect(html).toContain('<span');
    expect(html).toMatch(/<span[^>]*>#<\/span>/);
    expect(textoVisivel(html)).toBe('# Título');
  });

  const casos = [
    '# Título',
    '###### Seis',
    '####### Sete',
    '#Sem espaço',
    '**a**',
    '*a*',
    '_a_',
    '`a`',
    '~~a~~',
    '**a *b* c**',
    '*a\n\nb*',
    '- um\n- dois\n- três',
    '1. um\n2. dois\n3. três',
    '> primeira\n> segunda',
    '```\n# isto\n**aquilo**\n```',
    '```\ncódigo sem fim',
    '<script>alert(1)</script>',
    '[x](javascript:alert(1))',
    '[x](https://exemplo.com)',
    '---',
    'Não é? Café com açaí 🎉✨',
    '| A | B |\n| --- | --- |\n| a | b |',
    '| A | B |\n| :--- | ---: |\n| a\\|b | **c** |',
    '- [ ] tarefa',
    '- [x] feita',
    '- [X] feita maiúscula',
    '- normal\n- [ ] tarefa\n- [x] outra',
  ];

  it.each(casos)('preserva o texto original caractere a caractere: %s', (texto) => {
    expect(textoVisivel(realcar(texto))).toBe(texto);
  });

  const casosImagem = [
    '![alt](https://exemplo.com/a.png)',
    '![](https://exemplo.com/a.png)',
    '![a "b" <c>](https://exemplo.com/a.png)',
    '- ![alt](https://exemplo.com/a.png)',
    '| A |\n| --- |\n| ![alt](https://exemplo.com/a.png) |',
    '[![alt](https://exemplo.com/a.png)](https://destino.com)',
    '![x](javascript:alert(1))',
    '![x](data:image/png;base64,AAA)',
    '![x](../fora.png)',
    '![x](anexos/foto.png)',
    '![x](ardosia://anexos/foto.png)',
    '```js\nconst a = 1;\n```',
    '```MERMAID\ngraph TD\n```',
    '```c++\ncodigo\n```',
    '```c#$\ncodigo\n```',
  ];

  it.each(casosImagem)('preserva imagens e cercas com linguagem caractere a caractere: %s', (texto) => {
    expect(textoVisivel(realcar(texto))).toBe(texto);
  });

  it('preserva um texto longo com todos os elementos misturados', () => {
    const texto = [
      '# Título principal',
      '',
      'Parágrafo com **negrito**, *itálico*, _itálico2_, `código`, ~~riscado~~',
      'e um [link](https://exemplo.com) e outro [ruim](javascript:x) no meio.',
      '',
      '- item um',
      '- item dois',
      '- item três',
      '',
      '1. primeiro',
      '2. segundo',
      '',
      '> uma citação',
      '> que continua',
      '',
      '---',
      '',
      '```',
      '# não vira título aqui',
      '**nem isto**',
      '```',
      '',
      'Última linha com <html> escapado & acentos: café, ação, emoji 🚀.',
    ].join('\n');

    expect(textoVisivel(realcar(texto))).toBe(texto);
  });

  it('classes md- aparecem nos elementos esperados', () => {
    expect(realcar('# t')).toContain('md-marcador');
    expect(realcar('# t')).toContain('md-titulo');
    expect(realcar('**t**')).toContain('md-forte');
    expect(realcar('*t*')).toContain('md-enfase');
    expect(realcar('`t`')).toContain('md-codigo');
    expect(realcar('> t')).toContain('md-citacao');
    expect(realcar('- t')).toContain('md-lista');
    expect(realcar('[t](https://x.com)')).toContain('md-link');
    expect(realcar('~~t~~')).toContain('md-riscado');
    expect(realcar('- [ ] t')).toContain('md-tarefa');
  });

  it('nunca deixa <script> virar tag real', () => {
    const html = realcar('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });
});

describe('desempenho', () => {
  it('renderiza 5000 linhas em menos de 1 segundo', () => {
    const linhas: string[] = [];
    for (let i = 0; i < 5000; i++) {
      linhas.push(`- item ${i} com **negrito**, *itálico* e [link](https://exemplo.com/${i})`);
    }
    const texto = linhas.join('\n');

    const inicio = performance.now();
    renderizar(texto);
    realcar(texto);
    const duracao = performance.now() - inicio;

    expect(duracao).toBeLessThan(1000);
  });
});
