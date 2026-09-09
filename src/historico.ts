/**
 * Desfazer e refazer o documento inteiro.
 *
 * O `Ctrl+Z` do navegador só enxerga a caixa de texto onde o cursor está: ele
 * não desfaz apagar um bloco, arrastar um bloco, nem uma edição feita no bloco
 * ao lado. Numa página com vários blocos isso é quase pior que não ter, porque
 * dá a impressão de que o desfazer existe até a hora em que se precisa dele.
 *
 * Aqui o passo é o documento todo — a lista de blocos — e não o texto de um
 * campo. O preço é ter de decidir o que conta como UM passo, e a resposta não
 * pode ser "cada tecla": cinquenta teclas viram cinquenta desfazeres e ninguém
 * consegue voltar ao parágrafo anterior. A regra está em `registrar`.
 */
import type { Bloco } from './canvas';

export type Historico = {
  /** Os estados do documento, do mais antigo ao mais novo. */
  readonly passos: Bloco[][];
  /** Onde estamos. Desfazer anda para trás, refazer para a frente. */
  readonly indice: number;
  /** Quando o passo do topo foi registrado — decide se o próximo funde nele. */
  readonly quando: number;
  /** Que bloco o passo do topo estava editando; `null` quando não foi digitação. */
  readonly bloco: string | null;
};

/**
 * Digitação contínua no mesmo bloco vira um passo só até esta pausa. Meio
 * segundo é o intervalo em que alguém para para pensar na frase seguinte — é
 * essa parada que a pessoa espera reencontrar ao desfazer, não a letra.
 */
export const PAUSA = 600;

/** Passos guardados por nota. Além disso, o mais antigo cai. */
export const LIMITE = 100;

export function iniciar(blocos: Bloco[]): Historico {
  return { passos: [blocos], indice: 0, quando: 0, bloco: null };
}

export function atual(historico: Historico): Bloco[] {
  return historico.passos[historico.indice];
}

export function podeDesfazer(historico: Historico): boolean {
  return historico.indice > 0;
}

export function podeRefazer(historico: Historico): boolean {
  return historico.indice < historico.passos.length - 1;
}

/**
 * Guarda um estado novo do documento.
 *
 * Funde com o passo anterior quando as três forem verdade: mudou só o texto de
 * um bloco, é o mesmo bloco de antes, e faz menos que `PAUSA`. Qualquer outra
 * coisa — mover, redimensionar, criar, apagar, ou trocar de bloco — começa um
 * passo novo, porque é uma ação que a pessoa reconhece e vai querer desfazer
 * inteira.
 */
export function registrar(historico: Historico, blocos: Bloco[], agora = Date.now()): Historico {
  const anteriores = atual(historico);
  if (iguais(anteriores, blocos)) return historico;

  const editado = blocoUnicoEditado(anteriores, blocos);
  const funde =
    editado !== null &&
    editado === historico.bloco &&
    agora - historico.quando < PAUSA &&
    !podeRefazer(historico);

  if (funde) {
    const passos = [...historico.passos];
    passos[historico.indice] = blocos;
    return { ...historico, passos, quando: agora };
  }

  // O que estava à frente deixa de existir: escrever depois de desfazer abre um
  // caminho novo, e o antigo não tem mais como ser alcançado.
  const passos = [...historico.passos.slice(0, historico.indice + 1), blocos];
  const excedente = Math.max(0, passos.length - LIMITE);
  return {
    passos: passos.slice(excedente),
    indice: passos.length - excedente - 1,
    quando: agora,
    bloco: editado,
  };
}

/**
 * Depois de desfazer, `bloco` volta a `null` de propósito: se a pessoa
 * continuar digitando no mesmo bloco, isso é um caminho novo e merece o próprio
 * passo — fundir com o estado que ela acabou de reabrir apagaria o desfazer que
 * ela pediu.
 */
export function desfazer(historico: Historico): Historico {
  if (!podeDesfazer(historico)) return historico;
  return { ...historico, indice: historico.indice - 1, bloco: null };
}

export function refazer(historico: Historico): Historico {
  if (!podeRefazer(historico)) return historico;
  return { ...historico, indice: historico.indice + 1, bloco: null };
}

/**
 * O id do único bloco cujo TEXTO mudou, ou `null` se mudou mais coisa: outro
 * número de blocos, outra ordem, outra geometria, ou mais de um bloco.
 */
function blocoUnicoEditado(antes: Bloco[], depois: Bloco[]): string | null {
  if (antes.length !== depois.length) return null;

  let achado: string | null = null;
  for (let i = 0; i < antes.length; i += 1) {
    const a = antes[i];
    const b = depois[i];
    if (a.id !== b.id) return null;
    if (a.x !== b.x || a.y !== b.y || a.largura !== b.largura || a.altura !== b.altura) return null;
    if (a.texto === b.texto) continue;
    if (achado !== null) return null;
    achado = a.id;
  }
  return achado;
}

function iguais(antes: Bloco[], depois: Bloco[]): boolean {
  if (antes === depois) return true;
  if (antes.length !== depois.length) return false;
  return antes.every((a, i) => {
    const b = depois[i];
    return (
      a.id === b.id &&
      a.texto === b.texto &&
      a.x === b.x &&
      a.y === b.y &&
      a.largura === b.largura &&
      a.altura === b.altura
    );
  });
}
