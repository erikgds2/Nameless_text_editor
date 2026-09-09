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

/**
 * O id de um bloco nasce de `crypto.randomUUID()` toda vez que o arquivo é
 * lido — ou seja, **toda releitura da pasta troca a identidade de todos os
 * blocos**. Quem estava com o cursor num bloco, ou no meio de colar uma foto
 * nele, perdia o bloco de vista: o id que tinha em mãos deixava de existir.
 *
 * Aqui os ids da tela são reaproveitados pelos blocos do disco que ocupam o
 * mesmo lugar na página. A posição é o que identifica uma seção para quem está
 * olhando, e é o que sobrevive a uma ida e volta pelo arquivo.
 */
export function preservarIdsDosBlocos(doDisco: Note, naTela: Note | undefined): Note {
  if (!naTela) return doDisco;

  const disponiveis = new Map(naTela.blocos.map((bloco) => [`${bloco.x}:${bloco.y}`, bloco.id]));
  const blocos = doDisco.blocos.map((bloco) => {
    const chave = `${bloco.x}:${bloco.y}`;
    const id = disponiveis.get(chave);
    if (id === undefined) return bloco;
    // cada id só é reaproveitado uma vez: dois blocos com o mesmo id seriam o
    // mesmo bloco para o React
    disponiveis.delete(chave);
    return { ...bloco, id };
  });

  return { ...doDisco, blocos };
}

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

  const antesPorId = new Map(anteriores.map((nota) => [nota.id, nota]));

  const conflitos: Conflito[] = [];
  const juntas = doDisco.map((doArquivoCru) => {
    // a nota volta do disco com os ids de bloco que já estavam na tela
    const doArquivo = preservarIdsDosBlocos(doArquivoCru, antesPorId.get(doArquivoCru.id));
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
