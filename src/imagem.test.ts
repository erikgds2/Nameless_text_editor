import { describe, expect, it } from 'vitest';
import {
  enderecoDaImagem,
  imagemDoBloco,
  LADO_MAXIMO,
  marcarImagem,
  origemDoHtml,
  tamanhoDoBloco,
} from './imagem';
import { ALTURA_MINIMA, LARGURA_MINIMA } from './canvas';

describe('imagemDoBloco', () => {
  it('reconhece o bloco que é só uma imagem', () => {
    expect(imagemDoBloco('![](anexos/abc.png)')).toEqual({ src: 'anexos/abc.png', fonte: null });
  });

  it('espaço em volta não atrapalha', () => {
    expect(imagemDoBloco('\n  ![](anexos/abc.png)  \n')).toEqual({
      src: 'anexos/abc.png',
      fonte: null,
    });
  });

  it('imagem com origem devolve a origem junto', () => {
    expect(imagemDoBloco('[![](anexos/abc.png)](https://pt.wikipedia.org/wiki/Femur)')).toEqual({
      src: 'anexos/abc.png',
      fonte: 'https://pt.wikipedia.org/wiki/Femur',
    });
  });

  it('texto junto da imagem continua sendo texto', () => {
    expect(imagemDoBloco('olha isto: ![](anexos/abc.png)')).toBeNull();
    expect(imagemDoBloco('![](anexos/abc.png)\nlegenda')).toBeNull();
  });

  it('bloco vazio ou de texto puro não é figura', () => {
    expect(imagemDoBloco('')).toBeNull();
    expect(imagemDoBloco('Kant e o dever')).toBeNull();
  });

  it('caminho que sai da pasta de anexos é recusado', () => {
    expect(imagemDoBloco('![](anexos/../segredo.png)')).toBeNull();
    expect(imagemDoBloco('![](../fora.png)')).toBeNull();
    expect(imagemDoBloco('![](/etc/passwd)')).toBeNull();
  });

  it('esquema que não é http nem https é recusado, na imagem e na origem', () => {
    expect(imagemDoBloco('![](javascript:alert(1))')).toBeNull();
    expect(imagemDoBloco('![](data:image/png;base64,AAAA)')).toBeNull();
    expect(imagemDoBloco('[![](anexos/abc.png)](javascript:alert(1))')).toBeNull();
  });

  it('imagem da web aberta é aceita', () => {
    expect(imagemDoBloco('![](https://exemplo.org/a.png)')).toEqual({
      src: 'https://exemplo.org/a.png',
      fonte: null,
    });
  });
});

describe('marcarImagem', () => {
  it('sem origem, é a marcação simples', () => {
    expect(marcarImagem('abc.png', null)).toBe('![](anexos/abc.png)');
  });

  it('com origem, a marcação vira link para ela', () => {
    expect(marcarImagem('abc.png', 'https://exemplo.org/femur')).toBe(
      '[![](anexos/abc.png)](https://exemplo.org/femur)',
    );
  });

  it('origem que não é endereço da web é ignorada', () => {
    expect(marcarImagem('abc.png', 'javascript:alert(1)')).toBe('![](anexos/abc.png)');
    expect(marcarImagem('abc.png', 'C:\\Users\\foto.png')).toBe('![](anexos/abc.png)');
  });

  it('o que sai daqui volta inteiro em imagemDoBloco', () => {
    expect(imagemDoBloco(marcarImagem('abc.png', 'https://exemplo.org/x'))).toEqual({
      src: 'anexos/abc.png',
      fonte: 'https://exemplo.org/x',
    });
  });
});

describe('origemDoHtml', () => {
  it('acha o endereço da imagem no HTML que o navegador copia junto', () => {
    const html = `<meta charset='utf-8'><img src="https://exemplo.org/femur.png" alt="">`;
    expect(origemDoHtml(html)).toBe('https://exemplo.org/femur.png');
  });

  it('aspas simples também', () => {
    expect(origemDoHtml("<img src='https://exemplo.org/a.png'>")).toBe('https://exemplo.org/a.png');
  });

  it('print da Ferramenta de Captura não traz HTML nenhum', () => {
    expect(origemDoHtml('')).toBeNull();
  });

  it('HTML sem imagem não inventa origem', () => {
    expect(origemDoHtml('<p>um parágrafo copiado</p>')).toBeNull();
  });

  it('imagem embutida em base64 não é origem', () => {
    expect(origemDoHtml('<img src="data:image/png;base64,AAAA">')).toBeNull();
  });

  it('arquivo local do navegador não é origem', () => {
    expect(origemDoHtml('<img src="file:///C:/foto.png">')).toBeNull();
  });
});

describe('enderecoDaImagem', () => {
  it('anexo vira endereço do protocolo do aplicativo', () => {
    expect(enderecoDaImagem('anexos/abc.png')).toBe('ardosia://anexos/abc.png');
  });

  it('imagem da web fica como está', () => {
    expect(enderecoDaImagem('https://exemplo.org/a.png')).toBe('https://exemplo.org/a.png');
  });

  it('o que não é nem um nem outro não vira endereço', () => {
    expect(enderecoDaImagem('../fora.png')).toBeNull();
    expect(enderecoDaImagem('javascript:alert(1)')).toBeNull();
  });
});

describe('tamanhoDoBloco', () => {
  it('imagem que cabe entra no tamanho natural', () => {
    expect(tamanhoDoBloco(400, 300)).toEqual({ largura: 400, altura: 300 });
  });

  it('imagem grande encolhe mantendo a proporção', () => {
    expect(tamanhoDoBloco(1920, 1080)).toEqual({ largura: LADO_MAXIMO, altura: 270 });
  });

  it('o teto vale para o lado maior, seja ele qual for', () => {
    expect(tamanhoDoBloco(600, 1200)).toEqual({ largura: 240, altura: LADO_MAXIMO });
  });

  it('imagem miúda não faz um bloco impossível de pegar', () => {
    expect(tamanhoDoBloco(16, 16)).toEqual({ largura: LARGURA_MINIMA, altura: ALTURA_MINIMA });
  });

  it('dimensão desconhecida cai no mínimo, sem NaN', () => {
    expect(tamanhoDoBloco(0, 0)).toEqual({ largura: LARGURA_MINIMA, altura: ALTURA_MINIMA });
    expect(tamanhoDoBloco(Number.NaN, 100)).toEqual({ largura: LARGURA_MINIMA, altura: ALTURA_MINIMA });
  });
});
