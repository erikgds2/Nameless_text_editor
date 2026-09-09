/**
 * Juntar o que está na tela com o que está no disco.
 *
 * A pasta é aberta: o Bloco de Notas, o `ardosia` da linha de comando, uma IA
 * ou um programa de sincronização podem reescrever uma nota enquanto ela está
 * aberta aqui. Reler a pasta e sobrescrever a tela perderia o que a pessoa
 * acabou de digitar; ignorar o disco perderia o que veio de fora.
 *
 * Então: o que está na tela e ainda não foi gravado sempre ganha — mas, quando
 * as duas versões diferem, isso vira um conflito declarado. Ninguém perde
 * trabalho em silêncio; quem escolhe é quem está escrevendo.
 */
import { textoDaNota, type Note } from './notes';

export type Conflito = {
  id: string;
  /** A versão que está no arquivo agora. A da tela continua em `notas`. */
  doDisco: Note;
};

export type Juncao = {
  notas: Note[];
  conflitos: Conflito[];
};

export function juntarComDisco(
  anteriores: Note[],
  doDisco: Note[],
  sujas: ReadonlySet<string>,
): Juncao {
  // Nota nova que ainda não chegou ao disco não pode sumir da lista por não
  // estar lá; e o que está sendo escrito agora tem prioridade sobre o arquivo.
  const preservadas = anteriores.filter(
    (nota) => sujas.has(nota.id) || textoDaNota(nota.blocos).trim() === '',
  );
  const porId = new Map(preservadas.map((nota) => [nota.id, nota]));

  const conflitos: Conflito[] = [];
  const juntas = doDisco.map((doArquivo) => {
    const naTela = porId.get(doArquivo.id);
    // a nota em branco só é preservada enquanto não existe arquivo dela: se o
    // arquivo existe e tem texto, o texto é a novidade, e é ele que aparece
    if (!naTela || !sujas.has(doArquivo.id)) return doArquivo;

    if (textoDaNota(naTela.blocos) !== textoDaNota(doArquivo.blocos)) {
      conflitos.push({ id: doArquivo.id, doDisco: doArquivo });
    }
    return naTela;
  });

  const idsEmDisco = new Set(doDisco.map((nota) => nota.id));
  return {
    notas: [...preservadas.filter((nota) => !idsEmDisco.has(nota.id)), ...juntas],
    conflitos,
  };
}
