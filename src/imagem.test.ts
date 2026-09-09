import { describe, expect, it } from 'vitest';
import {
  ALTURA_MINIMA_DA_FIGURA,
  alturaDaFigura,
  enderecoDaImagem,
  figurasDoBloco,
  textoSemFiguras,
  imagemDoBloco,
  LADO_MAXIMO,
  marcarImagem,
  melhorImagem,
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

describe('figurasDoBloco', () => {
  it('acha a figura na linha própria, com texto em volta', () => {
    expect(figurasDoBloco('Anatomia\n![](anexos/a.png)\nresto')).toEqual([
      { src: 'anexos/a.png', fonte: null },
    ]);
  });

  it('mais de uma figura, na ordem em que aparecem', () => {
    const texto = 'Aula\n![](anexos/a.png)\nmeio\n[![](anexos/b.png)](https://exemplo.org)';
    expect(figurasDoBloco(texto).map((f) => f.src)).toEqual(['anexos/a.png', 'anexos/b.png']);
  });

  it('marcação no meio de uma frase não é figura', () => {
    expect(figurasDoBloco('olha ![](anexos/a.png) aqui')).toEqual([]);
  });

  it('bloco sem imagem nenhuma devolve lista vazia', () => {
    expect(figurasDoBloco('só texto')).toEqual([]);
    expect(figurasDoBloco('')).toEqual([]);
  });
});

describe('textoSemFiguras', () => {
  it('tira as linhas que são só figura e deixa o resto intacto', () => {
    expect(textoSemFiguras('Anatomia\n![](anexos/a.png)\nresto')).toBe('Anatomia\nresto');
  });

  it('bloco que é só figura não sobra texto nenhum', () => {
    expect(textoSemFiguras('![](anexos/a.png)').trim()).toBe('');
  });

  it('texto sem figura passa inteiro', () => {
    expect(textoSemFiguras('uma linha\noutra')).toBe('uma linha\noutra');
  });
});

describe('melhorImagem', () => {
  const arquivo = (nome: string, tipo: string, bytes: number) =>
    new File([new Uint8Array(bytes)], nome, { type: tipo });

  it('entre a miniatura e o original, fica o original', () => {
    const miniatura = arquivo('mini.png', 'image/png', 300);
    const original = arquivo('print.png', 'image/png', 90000);

    expect(melhorImagem([miniatura, original])?.name).toBe('print.png');
    expect(melhorImagem([original, miniatura])?.name).toBe('print.png');
  });

  it('o que não é imagem fica de fora', () => {
    const planilha = arquivo('dados.xlsx', 'application/vnd.ms-excel', 90000);
    const imagem = arquivo('print.png', 'image/png', 500);

    expect(melhorImagem([planilha, imagem])?.name).toBe('print.png');
  });

  it('arquivo vazio não é imagem: colar isso gravaria um anexo quebrado', () => {
    expect(melhorImagem([arquivo('vazio.png', 'image/png', 0)])).toBeNull();
  });

  it('colagem sem imagem nenhuma devolve nada', () => {
    expect(melhorImagem([])).toBeNull();
    expect(melhorImagem([arquivo('texto.txt', 'text/plain', 100)])).toBeNull();
  });
});

describe('alturaDaFigura', () => {
  it('foto que cabe na largura da seção aparece na altura natural dela', () => {
    // o caso real: seção de 320, print de 260x402 — antes ele era espremido a 164
    expect(alturaDaFigura(320, 260, 402)).toBe(402);
  });

  it('foto mais larga que a seção encolhe na proporção', () => {
    // 296 de largura útil; 1600x900 vira 296x167
    expect(alturaDaFigura(320, 1600, 900)).toBe(167);
  });

  it('nunca amplia além do tamanho original: print esticado borra', () => {
    expect(alturaDaFigura(800, 100, 60)).toBe(ALTURA_MINIMA_DA_FIGURA);
    expect(alturaDaFigura(800, 400, 200)).toBe(200);
  });

  it('respeita o mesmo teto de uma seção só de figura', () => {
    expect(alturaDaFigura(2000, 1000, 3000)).toBe(LADO_MAXIMO);
  });

  it('foto minúscula ainda ganha altura que dê para ver', () => {
    expect(alturaDaFigura(320, 16, 16)).toBe(ALTURA_MINIMA_DA_FIGURA);
  });

  it('dimensão desconhecida não vira NaN na altura da seção', () => {
    expect(alturaDaFigura(320, 0, 0)).toBe(ALTURA_MINIMA_DA_FIGURA);
    expect(alturaDaFigura(320, Number.NaN, 100)).toBe(ALTURA_MINIMA_DA_FIGURA);
  });
});
