import { describe, expect, it } from 'vitest';
import { gerarHtmlAutonomo } from './exportacao';
import { criarBloco } from './canvas';

describe('gerarHtmlAutonomo', () => {
  it('gera documento HTML completo com titulo e markdown renderizado', () => {
    const bloco = { ...criarBloco(0, 0), texto: '# Subtitulo\n\nTexto com **negrito** e ==grifo==.' };
    const html = gerarHtmlAutonomo('Nota de Estudo', [bloco], 'markdown');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Nota de Estudo</title>');
    expect(html).toContain('<h1 class="titulo-nota">Nota de Estudo</h1>');
    expect(html).toContain('<h1>Subtitulo</h1>');
    expect(html).toContain('<strong>negrito</strong>');
    expect(html).toContain('<mark class="md-grifo">grifo</mark>');
  });

  it('escapa caracteres especiais no titulo', () => {
    const bloco = { ...criarBloco(0, 0), texto: 'conteudo' };
    const html = gerarHtmlAutonomo('Titulo <Especial> & Importante', [bloco]);

    expect(html).toContain('<title>Titulo &lt;Especial&gt; &amp; Importante</title>');
    expect(html).toContain('<h1 class="titulo-nota">Titulo &lt;Especial&gt; &amp; Importante</h1>');
  });

  it('renderiza texto puro dentro de pre', () => {
    const bloco = { ...criarBloco(0, 0), texto: 'Texto puro sem **markdown**' };
    const html = gerarHtmlAutonomo('Nota Pura', [bloco], 'texto');

    expect(html).toContain('<pre class="texto-puro">Texto puro sem **markdown**</pre>');
  });
});
