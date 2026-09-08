import { describe, expect, it } from 'vitest';
import { esquecerDiagramas, reporDiagramas } from './diagrama';

function preview(html: string): HTMLElement {
  const raiz = document.createElement('div');
  raiz.innerHTML = html;
  return raiz;
}

const DIAGRAMA = '<pre class="diagrama"><code>flowchart TD\n  A --> B</code></pre>';

describe('reporDiagramas', () => {
  it('avisa que falta desenhar um diagrama que nunca foi desenhado', () => {
    expect(reporDiagramas(preview(DIAGRAMA))).toBe(true);
  });

  it('nao ha nada a fazer quando a nota nao tem diagrama', () => {
    expect(reporDiagramas(preview('<p>só texto</p>'))).toBe(false);
  });

  it('ignora o que ja esta marcado como pronto', () => {
    const raiz = preview('<pre class="diagrama diagrama--feito"><svg></svg></pre>');
    expect(reporDiagramas(raiz)).toBe(false);
  });
});

describe('esquecerDiagramas', () => {
  it('desmarca todos, para que sejam desenhados de novo', () => {
    const raiz = preview(
      '<pre class="diagrama diagrama--feito"><svg></svg></pre>' +
        '<pre class="diagrama diagrama--feito"><svg></svg></pre>',
    );
    esquecerDiagramas(raiz);
    expect(raiz.querySelectorAll('pre.diagrama--feito')).toHaveLength(0);
    expect(raiz.querySelectorAll('pre.diagrama')).toHaveLength(2);
  });

  it('depois de esquecer, ha o que desenhar outra vez', () => {
    const raiz = preview('<pre class="diagrama diagrama--feito"><svg></svg></pre>');
    expect(reporDiagramas(raiz)).toBe(false);
    esquecerDiagramas(raiz);
    expect(reporDiagramas(raiz)).toBe(true);
  });

  it('nao reclama quando nao ha diagrama nenhum', () => {
    expect(() => esquecerDiagramas(preview('<p>nada</p>'))).not.toThrow();
  });
});
