import { beforeEach, describe, expect, it } from 'vitest';
import { depositoEmDisco, depositoNoNavegador, type PonteDisco } from './deposito';
import { createNote, saveNotes, textoDaNota } from './notes';
import { criarBloco } from './canvas';

/** Uma pasta de mentira, com as mesmas regras da de verdade. */
function pontefalsa(inicial: Record<string, string> = {}) {
  const arquivos = new Map(Object.entries(inicial));
  // quem testa dispara isto para simular alguém mexendo nos arquivos por fora
  let avisar: (() => void) | null = null;
  const ponte: PonteDisco = {
    pasta: async () => 'C:/notas',
    escolherPasta: async () => null,
    abrirPasta: async () => {},
    listar: async () =>
      [...arquivos].map(([id, texto]) => ({ id, texto, atualizadoEm: 0 })),
    escrever: async (id, texto) => void arquivos.set(id, texto),
    renomear: async (de, para) => {
      if (de === para || arquivos.has(para)) return de;
      arquivos.set(para, arquivos.get(de) ?? '');
      arquivos.delete(de);
      return para;
    },
    apagar: async (id) => void arquivos.delete(id),
    fecharCaptura: async () => {},
    salvarAnexo: async () => 'imagem.png',
    modoDeFundo: async () => 'acrilico' as const,
    trocarModoDeFundo: async () => {},
    aoMudarPasta: (callback) => {
      avisar = callback;
      return () => {
        avisar = null;
      };
    },
  };
  return { ponte, arquivos, mexerPorFora: () => avisar?.() };
}

function notaCom(texto: string) {
  return { ...createNote(), id: 'nota-abc123', blocos: [{ ...criarBloco(48, 48), texto }] };
}

beforeEach(() => localStorage.clear());

describe('deposito em disco', () => {
  it('grava a nota como .md e a le de volta inteira', async () => {
    const { ponte, arquivos } = pontefalsa();
    const deposito = depositoEmDisco(ponte);
    const salva = await deposito.salvar(notaCom('Revisão de Cálculo\n\ncorpo'));

    expect([...arquivos.keys()]).toEqual([salva.id]);
    const [lida] = await deposito.listar();
    expect(textoDaNota(lida.blocos)).toBe('Revisão de Cálculo\n\ncorpo');
  });

  it('batiza o arquivo provisorio com o titulo na primeira gravacao', async () => {
    const { ponte, arquivos } = pontefalsa();
    const salva = await depositoEmDisco(ponte).salvar(notaCom('Revisão de Cálculo I'));
    expect(salva.id).toBe('revisao-de-calculo-i');
    expect(arquivos.has('revisao-de-calculo-i')).toBe(true);
    expect(arquivos.has('nota-abc123')).toBe(false);
  });

  it('nao renomeia um arquivo que ja tem nome proprio, mesmo se o titulo mudar', async () => {
    const { ponte } = pontefalsa();
    const deposito = depositoEmDisco(ponte);
    const nota = { ...notaCom('Título antigo'), id: 'nome-que-eu-escolhi' };
    const salva = await deposito.salvar({
      ...nota,
      blocos: [{ ...nota.blocos[0], texto: 'Título novo' }],
    });
    expect(salva.id).toBe('nome-que-eu-escolhi');
  });

  it('nao confunde o titulo "Nota sem titulo" com um nome provisorio', async () => {
    const { ponte } = pontefalsa();
    const deposito = depositoEmDisco(ponte);
    const primeira = await deposito.salvar(notaCom('Nota sem título'));
    expect(primeira.id).toBe('nota-sem-titulo');
    const segunda = await deposito.salvar({ ...primeira, blocos: primeira.blocos });
    expect(segunda.id).toBe('nota-sem-titulo');
  });

  it('desvia quando o nome do titulo ja esta ocupado, sem sobrescrever a outra nota', async () => {
    const { ponte, arquivos } = pontefalsa({ kant: 'nota que ja existia' });
    const salva = await depositoEmDisco(ponte).salvar(notaCom('Kant'));
    expect(salva.id).toBe('kant-2');
    expect(arquivos.get('kant')).toBe('nota que ja existia');
  });

  it('mantem a nota sem titulo com o nome provisorio', async () => {
    const { ponte } = pontefalsa();
    const salva = await depositoEmDisco(ponte).salvar(notaCom('   '));
    expect(salva.id).toBe('nota-abc123');
  });

  it('apaga o arquivo da nota apagada', async () => {
    const { ponte, arquivos } = pontefalsa({ kant: 'corpo' });
    await depositoEmDisco(ponte).apagar('kant');
    expect(arquivos.size).toBe(0);
  });

  it('le um .md que alguem escreveu na pasta sem passar pelo app', async () => {
    const { ponte } = pontefalsa({ 'lista-de-compras': '# Feira\n\npão\nleite\n' });
    const [nota] = await depositoEmDisco(ponte).listar();
    expect(nota.id).toBe('lista-de-compras');
    expect(textoDaNota(nota.blocos)).toBe('# Feira\n\npão\nleite');
  });
});

describe('migracao do localStorage para o disco', () => {
  it('leva as notas antigas para a pasta na primeira abertura', async () => {
    saveNotes([notaCom('Aula de Kant'), notaCom('Aula de Hume')]);
    const { ponte, arquivos } = pontefalsa();
    const notas = await depositoEmDisco(ponte).listar();

    expect(notas).toHaveLength(2);
    expect([...arquivos.keys()].sort()).toEqual(['aula-de-hume', 'aula-de-kant']);
  });

  it('nao deixa duas notas antigas de mesmo titulo se sobrescreverem', async () => {
    saveNotes([notaCom('Aula'), notaCom('Aula')]);
    const { ponte, arquivos } = pontefalsa();
    await depositoEmDisco(ponte).listar();
    expect([...arquivos.keys()].sort()).toEqual(['aula', 'aula-2']);
  });

  it('nao repete a migracao na abertura seguinte', async () => {
    saveNotes([notaCom('Aula de Kant')]);
    const { ponte, arquivos } = pontefalsa();
    const deposito = depositoEmDisco(ponte);
    await deposito.listar();
    await deposito.listar();
    expect(arquivos.size).toBe(1);
  });

  it('preserva o localStorage: migrar copia, nao muda de lugar', async () => {
    saveNotes([notaCom('Aula de Kant')]);
    const { ponte } = pontefalsa();
    await depositoEmDisco(ponte).listar();
    expect(localStorage.getItem('editor-sem-nome:notes:v1')).toContain('Aula de Kant');
  });

  it('marca como migrado mesmo sem nada a migrar, e nao inventa arquivo', async () => {
    const { ponte, arquivos } = pontefalsa();
    await depositoEmDisco(ponte).listar();
    expect(arquivos.size).toBe(0);
  });
});

describe('deposito no navegador', () => {
  it('salva, atualiza no lugar e apaga', async () => {
    const deposito = depositoNoNavegador();
    const nota = await deposito.salvar(notaCom('primeira versão'));
    await deposito.salvar({ ...nota, blocos: [{ ...nota.blocos[0], texto: 'segunda versão' }] });

    const todas = await deposito.listar();
    expect(todas).toHaveLength(1);
    expect(textoDaNota(todas[0].blocos)).toBe('segunda versão');

    await deposito.apagar(nota.id);
    expect(await deposito.listar()).toHaveLength(0);
  });

  it('nao promete pasta nenhuma', async () => {
    expect(await depositoNoNavegador().pasta()).toBeNull();
  });
});
