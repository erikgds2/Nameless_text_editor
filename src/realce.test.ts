import { describe, expect, it } from 'vitest';
import { realcar } from './realce';

/** Remove tags HTML e desescapa entidades, para comparar com o texto original. */
function textoVisivel(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

describe('realcar', () => {
  it('preserva cada caractere do texto original', () => {
    const texto = '# Titulo\n\n- [x] tarefa\n> citacao\n`codigo` e **negrito** e ==grifo==';
    expect(textoVisivel(realcar(texto))).toBe(texto);
  });

  it('realca titulos com marcador e corpo estilizados', () => {
    const html = realcar('# Meu Titulo');
    expect(html).toContain('<span class="md-marcador">#</span>');
    expect(html).toContain('<span class="md-titulo">Meu Titulo</span>');
  });

  it('realca grifo com marcador == e classe md-grifo', () => {
    const html = realcar('palavra ==grifada== aqui');
    expect(html).toContain('<span class="md-marcador">==</span>');
    expect(html).toContain('<span class="md-grifo">grifada</span>');
  });

  it('realca ligacoes entre notas [[Nota]]', () => {
    const html = realcar('veja [[Conceito]]');
    expect(html).toContain('<span class="md-marcador">[[</span>');
    expect(html).toContain('<span class="md-ligacao">Conceito</span>');
    expect(html).toContain('<span class="md-marcador">]]</span>');
  });
});
