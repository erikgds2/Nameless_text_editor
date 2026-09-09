// A ordem das notas fixadas é escolhida à mão: fixar é dizer "isto importa", e
// o que importa raramente segue a ordem em que foi editado pela última vez.
import { deriveTitle, textoDaNota, type Note } from './notes';

/** Tira o item da posição `de` e o enfia na posição `para`. Lista nova. */
export function mover<T>(lista: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) {
    return [...lista];
  }
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/** As fixadas na ordem escolhida; quem ainda não tem ordem vai para o fim. */
export function fixadasEmOrdem(notas: Note[]): Note[] {
  return [...notas]
    .filter((nota) => nota.pinned)
    .sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity) || a.createdAt - b.createdAt);
}

/**
 * Arrasta uma nota fixada para a posição de outra e renumera todas. A
 * renumeração é o que faz a ordem sobreviver ao arquivo: `ordem` vira 0, 1,
 * 2..., sem buracos e sem empate.
 */
export function reordenarFixadas(notas: Note[], idArrastada: string, idAlvo: string): Note[] {
  const fixadas = fixadasEmOrdem(notas);
  const de = fixadas.findIndex((nota) => nota.id === idArrastada);
  const para = fixadas.findIndex((nota) => nota.id === idAlvo);
  if (de === -1 || para === -1) return notas;

  const posicoes = new Map(mover(fixadas, de, para).map((nota, indice) => [nota.id, indice]));
  return notas.map((nota) => {
    const posicao = posicoes.get(nota.id);
    return posicao === undefined || nota.ordem === posicao ? nota : { ...nota, ordem: posicao };
  });
}

/** Uma nota recém-fixada entra no fim da lista, não no meio dela. */
export function proximaOrdem(notas: Note[]): number {
  const fixadas = notas.filter((nota) => nota.pinned && typeof nota.ordem === 'number');
  return fixadas.length === 0 ? 0 : Math.max(...fixadas.map((nota) => nota.ordem ?? 0)) + 1;
}

/** Por que critério a lista das não-fixadas se organiza. */
export type Criterio = 'edicao' | 'criacao' | 'titulo';

export const CRITERIOS: Record<Criterio, string> = {
  edicao: 'Edição mais recente',
  criacao: 'Criação mais recente',
  titulo: 'Título, de A a Z',
};

/**
 * As soltas na ordem escolhida. As fixadas não entram aqui: a ordem delas é a
 * que foi arrastada à mão, e trocar o critério não pode desmanchá-la.
 *
 * O título é comparado com `localeCompare` em pt-BR: sem isso "Ácido" cairia
 * depois de "Zebra", que é o que acontece quando se ordena por código de
 * caractere numa língua com acento.
 */
export function ordenarSoltas(notas: Note[], criterio: Criterio): Note[] {
  const soltas = notas.filter((nota) => !nota.pinned);
  if (criterio === 'titulo') {
    return soltas.sort((a, b) =>
      deriveTitle(textoDaNota(a.blocos)).localeCompare(deriveTitle(textoDaNota(b.blocos)), 'pt-BR'),
    );
  }
  if (criterio === 'criacao') return soltas.sort((a, b) => b.createdAt - a.createdAt);
  return soltas.sort((a, b) => b.updatedAt - a.updatedAt);
}
