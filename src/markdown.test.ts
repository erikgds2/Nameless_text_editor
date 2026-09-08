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
  ];

  it.each(casos)('preserva o texto original caractere a caractere: %s', (texto) => {
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
