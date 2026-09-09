/**
 * Procurar dentro da nota aberta.
 *
 * É diferente da busca da barra lateral, que responde "em quais notas isto
 * aparece". Aqui a nota já é a certa e a pergunta é "onde, nesta página". Numa
 * nota de estudo com uma dúzia de blocos espalhados pelo canvas, achar a
 * palavra a olho é justamente o que se quer evitar.
 *
 * A ordem das ocorrências é a ordem de leitura — de cima para baixo, e da
 * esquerda para a direita no empate —, a mesma que `textoDaNota` usa para
 * escrever o arquivo. Andar de uma para a outra tem de seguir a página, não a
 * ordem em que os blocos foram criados.
 */
import type { Bloco } from './canvas';
import { normalize } from './search';

export type Ocorrencia = {
  blocoId: string;
  /** Índices no texto ORIGINAL do bloco, não no normalizado. */
  inicio: number;
  fim: number;
};

/**
 * Os índices do texto normalizado valem no original porque tirar as marcas de
 * acentuação não muda a contagem de caracteres — é a mesma propriedade de que
 * `trechoDoResultado` depende, e é o que permite digitar "acao" e realçar
 * "ação" no lugar certo.
 */
export function acharNaNota(blocos: Bloco[], termo: string): Ocorrencia[] {
  const alvo = normalize(termo);
  if (alvo.trim() === '') return [];

  return emOrdemDeLeitura(blocos).flatMap((bloco) =>
    posicoesEm(bloco.texto, alvo).map(({ inicio, fim }) => ({ blocoId: bloco.id, inicio, fim })),
  );
}

/** As ocorrências de um bloco só, na ordem em que aparecem no texto dele. */
export function achadosDoBloco(ocorrencias: Ocorrencia[], blocoId: string): Ocorrencia[] {
  return ocorrencias.filter((ocorrencia) => ocorrencia.blocoId === blocoId);
}

/**
 * O texto do bloco em HTML, com as ocorrências envolvidas em `<mark>`. Tudo o
 * mais é escapado: o que entra aqui foi digitado por quem escreve a nota.
 *
 * `atual` é a ocorrência em que a navegação está parada — ela ganha destaque
 * próprio, senão não dá para saber qual das doze o `Enter` vai visitar agora.
 */
export function realcarAchados(
  texto: string,
  achados: Ocorrencia[],
  atual: Ocorrencia | null = null,
): string {
  if (achados.length === 0) return escapar(texto);

  const partes: string[] = [];
  let cursor = 0;

  for (const achado of achados) {
    partes.push(escapar(texto.slice(cursor, achado.inicio)));
    const ehAtual = atual !== null && atual.blocoId === achado.blocoId && atual.inicio === achado.inicio;
    partes.push(
      `<mark class="achado${ehAtual ? ' achado--atual' : ''}">`,
      escapar(texto.slice(achado.inicio, achado.fim)),
      '</mark>',
    );
    cursor = achado.fim;
  }

  partes.push(escapar(texto.slice(cursor)));
  return partes.join('');
}

/** De cima para baixo; empatou na altura, da esquerda para a direita. */
function emOrdemDeLeitura(blocos: Bloco[]): Bloco[] {
  return [...blocos].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Ocorrências que não se sobrepõem: procurar "aa" em "aaa" acha uma, como em
 * qualquer editor. Sobrepor faria a contagem crescer sozinha e o realce virar
 * um borrão.
 */
function posicoesEm(texto: string, alvo: string): { inicio: number; fim: number }[] {
  const onde = normalize(texto);
  const achados: { inicio: number; fim: number }[] = [];

  let de = onde.indexOf(alvo);
  while (de >= 0) {
    achados.push({ inicio: de, fim: de + alvo.length });
    de = onde.indexOf(alvo, de + alvo.length);
  }
  return achados;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
