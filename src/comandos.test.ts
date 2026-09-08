import { describe, expect, it, vi } from 'vitest';
import { filtrar, type Comando } from './comandos';

function comando(titulo: string, secao = 'Notas'): Comando {
  return { id: titulo, titulo, secao, executar: vi.fn() };
}

const lista = [
  comando('Nova nota'),
  comando('Buscar'),
  comando('Trocar tema', 'Aparência'),
  comando('Aumentar o texto', 'Aparência'),
  comando('Abrir a pasta das notas', 'Arquivos'),
];

const titulos = (resultado: Comando[]) => resultado.map((c) => c.titulo);

describe('filtrar', () => {
  it('consulta vazia devolve tudo na ordem em que foi registrado', () => {
    expect(titulos(filtrar(lista, ''))).toEqual(titulos(lista));
    expect(titulos(filtrar(lista, '   '))).toEqual(titulos(lista));
  });

  it('nao muta a lista recebida', () => {
    const original = [...lista];
    filtrar(lista, 'nota');
    expect(lista).toEqual(original);
  });

  it('acha por pedaco do titulo', () => {
    expect(titulos(filtrar(lista, 'busc'))).toEqual(['Buscar']);
  });

  it('acha por subsequencia espalhada: duas teclas bastam', () => {
    expect(titulos(filtrar(lista, 'nn'))).toContain('Nova nota');
    expect(titulos(filtrar(lista, 'trtm'))).toContain('Trocar tema');
  });

  it('a secao tambem entra na busca', () => {
    expect(titulos(filtrar(lista, 'apar'))).toEqual(['Trocar tema', 'Aumentar o texto']);
  });

  it('ignora acento e caixa, nos dois sentidos', () => {
    expect(titulos(filtrar(lista, 'APARENCIA'))).toEqual(['Trocar tema', 'Aumentar o texto']);
    expect(titulos(filtrar(lista, 'aparência'))).toEqual(['Trocar tema', 'Aumentar o texto']);
  });

  it('quem comeca com a consulta vem antes de quem so a contem', () => {
    const resultado = titulos(filtrar([comando('Abrir nota'), comando('Nova nota')], 'nova'));
    expect(resultado[0]).toBe('Nova nota');
  });

  it('casamento contiguo vence casamento espalhado', () => {
    const resultado = titulos(filtrar([comando('Nova nota'), comando('Notas fixadas')], 'nota'));
    expect(resultado[0]).toBe('Notas fixadas');
  });

  it('empate preserva a ordem original', () => {
    const resultado = titulos(filtrar([comando('Tema claro'), comando('Tema escuro')], 'tema'));
    expect(resultado).toEqual(['Tema claro', 'Tema escuro']);
  });

  it('consulta que nao casa com nada devolve lista vazia', () => {
    expect(filtrar(lista, 'zzzz')).toEqual([]);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(filtrar([], 'qualquer')).toEqual([]);
    expect(filtrar([], '')).toEqual([]);
  });

  it('a ordem das letras importa na subsequencia', () => {
    // "vz": o v aparece em "Nova", mas nao ha z depois dele
    expect(filtrar([comando('Nova nota')], 'vz')).toEqual([]);
  });

  it('casamento no titulo vence casamento na secao', () => {
    const resultado = filtrar(
      [comando('Buscar', 'Notas'), comando('Nova nota', 'Aparência')],
      'nota',
    );
    expect(titulos(resultado)[0]).toBe('Nova nota');
  });
});
