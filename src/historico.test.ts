import { describe, expect, it } from 'vitest';
import { criarBloco, type Bloco } from './canvas';
import {
  LIMITE,
  PAUSA,
  atual,
  desfazer,
  iniciar,
  podeDesfazer,
  podeRefazer,
  refazer,
  registrar,
} from './historico';

/** Um bloco com id previsível, para poder falar dele nos testes. */
function bloco(id: string, texto = '', extras: Partial<Bloco> = {}): Bloco {
  return { ...criarBloco(48, 48), id, texto, ...extras };
}

const A = bloco('a', 'primeiro');
const B = bloco('b', 'segundo', { x: 420, y: 300 });

/** Digitar `texto` no bloco `id`, sem mexer em mais nada. */
function digitar(blocos: Bloco[], id: string, texto: string): Bloco[] {
  return blocos.map((b) => (b.id === id ? { ...b, texto } : b));
}

describe('histórico do documento', () => {
  it('começa sem nada para desfazer nem refazer', () => {
    const h = iniciar([A]);
    expect(atual(h)).toEqual([A]);
    expect(podeDesfazer(h)).toBe(false);
    expect(podeRefazer(h)).toBe(false);
  });

  it('registrar o mesmo documento não cria passo', () => {
    const h = iniciar([A]);
    expect(registrar(h, [{ ...A }])).toBe(h);
    expect(podeDesfazer(registrar(h, [A]))).toBe(false);
  });

  it('desfazer devolve o documento como estava antes', () => {
    const h = registrar(iniciar([A]), [A, B]);
    expect(podeDesfazer(h)).toBe(true);
    expect(atual(desfazer(h))).toEqual([A]);
  });

  it('refazer traz de volta o que foi desfeito', () => {
    const h = registrar(iniciar([A]), [A, B]);
    const voltou = refazer(desfazer(h));
    expect(atual(voltou)).toEqual([A, B]);
    expect(podeRefazer(voltou)).toBe(false);
  });

  it('desfazer no começo e refazer no fim não quebram nada', () => {
    const h = iniciar([A]);
    expect(desfazer(h)).toBe(h);
    expect(refazer(h)).toBe(h);
  });

  it('escrever depois de desfazer descarta o caminho abandonado', () => {
    const h = registrar(iniciar([A]), [A, B]);
    const outro = registrar(desfazer(h), digitar([A], 'a', 'outra coisa'), 9000);

    expect(podeRefazer(outro)).toBe(false);
    expect(atual(outro)).toEqual(digitar([A], 'a', 'outra coisa'));
    // e o desfazer ainda alcança o estado original
    expect(atual(desfazer(outro))).toEqual([A]);
  });
});

describe('o que conta como um passo', () => {
  it('digitação seguida no mesmo bloco vira um passo só', () => {
    let h = iniciar([A]);
    h = registrar(h, digitar([A], 'a', 'Kan'), 1000);
    h = registrar(h, digitar([A], 'a', 'Kant'), 1100);
    h = registrar(h, digitar([A], 'a', 'Kant '), 1200);

    // um desfazer volta a rajada inteira, não letra por letra
    expect(atual(desfazer(h))).toEqual([A]);
    expect(podeDesfazer(desfazer(h))).toBe(false);
  });

  it('a pausa fecha o passo: depois dela, começa outro', () => {
    let h = iniciar([A]);
    h = registrar(h, digitar([A], 'a', 'Kant'), 1000);
    h = registrar(h, digitar([A], 'a', 'Kant e Hume'), 1000 + PAUSA);

    expect(atual(desfazer(h))).toEqual(digitar([A], 'a', 'Kant'));
    expect(podeDesfazer(desfazer(h))).toBe(true);
  });

  it('trocar de bloco fecha o passo, mesmo sem pausa', () => {
    let h = iniciar([A, B]);
    h = registrar(h, digitar([A, B], 'a', 'no primeiro'), 1000);
    h = registrar(h, digitar(atual(h), 'b', 'no segundo'), 1050);

    expect(atual(desfazer(h))).toEqual(digitar([A, B], 'a', 'no primeiro'));
  });

  it('mover um bloco é sempre um passo próprio', () => {
    let h = iniciar([A]);
    h = registrar(h, digitar([A], 'a', 'texto'), 1000);
    h = registrar(h, [{ ...atual(h)[0], x: 500, y: 200 }], 1050);

    expect(atual(desfazer(h))).toEqual(digitar([A], 'a', 'texto'));
  });

  it('redimensionar um bloco é sempre um passo próprio', () => {
    let h = iniciar([A]);
    h = registrar(h, digitar([A], 'a', 'texto'), 1000);
    h = registrar(h, [{ ...atual(h)[0], largura: 640, altura: 400 }], 1050);

    expect(atual(desfazer(h))[0].largura).toBe(A.largura);
  });

  it('apagar um bloco pode ser desfeito, com texto e geometria', () => {
    const h = registrar(iniciar([A, B]), [A], 1000);
    expect(atual(h)).toHaveLength(1);
    expect(atual(desfazer(h))).toEqual([A, B]);
  });

  it('duas edições no mesmo instante em blocos diferentes não fundem', () => {
    let h = iniciar([A, B]);
    const dois = [
      { ...A, texto: 'mudou aqui' },
      { ...B, texto: 'e aqui' },
    ];
    h = registrar(h, dois, 1000);
    // mudou mais de um bloco: passo próprio, e desfazer volta os dois juntos
    expect(atual(desfazer(h))).toEqual([A, B]);
  });

  it('depois de desfazer, digitar não funde com o passo reaberto', () => {
    let h = iniciar([A]);
    h = registrar(h, digitar([A], 'a', 'Kant'), 1000);
    h = desfazer(h);
    h = registrar(h, digitar([A], 'a', 'Hume'), 1050);

    // se tivesse fundido, este desfazer não teria para onde voltar
    expect(atual(desfazer(h))).toEqual([A]);
  });
});

describe('o histórico não cresce sem fim', () => {
  it('além do limite, o passo mais antigo cai e o resto continua alcançável', () => {
    let h = iniciar([A]);
    for (let i = 1; i <= LIMITE + 20; i += 1) {
      h = registrar(h, digitar([A], 'a', `versão ${i}`), i * (PAUSA + 100));
    }

    expect(h.passos).toHaveLength(LIMITE);
    expect(podeDesfazer(h)).toBe(true);

    let voltando = h;
    while (podeDesfazer(voltando)) voltando = desfazer(voltando);
    expect(podeDesfazer(voltando)).toBe(false);
    expect(atual(voltando)).toBeDefined();
  });
});

describe('o histórico não estraga o que recebe', () => {
  it('registrar não mexe na lista nem nos blocos passados', () => {
    const original = [A, B];
    const copia = original.map((b) => ({ ...b }));
    registrar(iniciar(original), digitar(original, 'a', 'novo texto'), 1000);
    expect(original).toEqual(copia);
  });

  it('desfazer devolve um histórico novo, sem mexer no anterior', () => {
    const h = registrar(iniciar([A]), [A, B], 1000);
    const antes = h.indice;
    desfazer(h);
    expect(h.indice).toBe(antes);
  });
});
