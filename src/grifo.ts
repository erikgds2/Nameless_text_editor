/**
 * O marca-texto da folha de caderno.
 *
 * Grifar não escreve nada no texto: não há `==assim==` nem `<mark>` no meio da
 * frase. O trecho grifado é uma propriedade DA SEÇÃO — um par de posições no
 * marcador do bloco —, do mesmo jeito que a figura e a caneta são. Uma nota de
 * texto puro pode ter trecho grifado, e o texto continua sendo só o texto.
 *
 * O preço disso é este arquivo: posições envelhecem quando se digita antes
 * delas, e alguém precisa envelhecê-las junto. É `ajustarGrifos` quem faz isso,
 * a cada tecla, e é o que impede o grifo de escorregar para a palavra errada.
 */
export type Grifo = { inicio: number; fim: number };

/**
 * Grifa o trecho, ou o desgrifa quando ele já está inteiro grifado — o mesmo
 * atalho serve de ida e de volta, como o negrito.
 */
export function alternarGrifo(grifos: Grifo[], inicio: number, fim: number): Grifo[] {
  if (fim <= inicio) return grifos;

  if (jaEstaGrifado(grifos, inicio, fim)) {
    return normalizar(
      grifos.flatMap((grifo) => [
        { inicio: grifo.inicio, fim: Math.min(grifo.fim, inicio) },
        { inicio: Math.max(grifo.inicio, fim), fim: grifo.fim },
      ]),
    );
  }

  return normalizar([...grifos, { inicio, fim }]);
}

/** Verdadeiro quando cada letra do trecho já está sob algum grifo. */
function jaEstaGrifado(grifos: Grifo[], inicio: number, fim: number): boolean {
  let alcance = inicio;
  for (const grifo of normalizar(grifos)) {
    if (grifo.inicio > alcance) break;
    alcance = Math.max(alcance, grifo.fim);
  }
  return alcance >= fim;
}

/**
 * Os grifos depois de o texto mudar, para que continuem sobre as mesmas
 * palavras. O que se compara é o começo e o fim iguais entre os dois textos: o
 * que sobra no meio é o trecho que a pessoa acabou de trocar.
 *
 * Grifo que ficava dentro do trecho trocado desaparece — quem apagou a palavra
 * apagou o grifo dela, e ressuscitá-lo noutro lugar seria pior.
 */
export function ajustarGrifos(grifos: Grifo[], antes: string, depois: string): Grifo[] {
  if (grifos.length === 0 || antes === depois) return grifos;

  let prefixo = 0;
  const menor = Math.min(antes.length, depois.length);
  while (prefixo < menor && antes[prefixo] === depois[prefixo]) prefixo++;

  let sufixo = 0;
  while (
    sufixo < menor - prefixo &&
    antes[antes.length - 1 - sufixo] === depois[depois.length - 1 - sufixo]
  ) {
    sufixo++;
  }

  const fimAntes = antes.length - sufixo;
  const delta = depois.length - antes.length;
  const mover = (posicao: number) => {
    if (posicao <= prefixo) return posicao;
    if (posicao >= fimAntes) return posicao + delta;
    return prefixo;
  };

  return normalizar(grifos.map((grifo) => ({ inicio: mover(grifo.inicio), fim: mover(grifo.fim) })));
}

/** Em ordem, sem trecho vazio e sem dois grifos encostados ou sobrepostos. */
export function normalizar(grifos: Grifo[]): Grifo[] {
  const validos = grifos
    .filter((grifo) => grifo.fim > grifo.inicio && grifo.inicio >= 0)
    .sort((a, b) => a.inicio - b.inicio);

  const juntos: Grifo[] = [];
  for (const grifo of validos) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && grifo.inicio <= ultimo.fim) {
      ultimo.fim = Math.max(ultimo.fim, grifo.fim);
      continue;
    }
    juntos.push({ ...grifo });
  }
  return juntos;
}

/** `12-30,44-60` — o que vai para o marcador do bloco. */
export function grifosParaTexto(grifos: Grifo[]): string {
  return normalizar(grifos)
    .map((grifo) => `${grifo.inicio}-${grifo.fim}`)
    .join(',');
}

/** A volta, aguentando o que um arquivo editado à mão possa trazer. */
export function grifosDeTexto(bruto: string): Grifo[] {
  const grifos: Grifo[] = [];
  for (const parte of bruto.split(',')) {
    const [inicio, fim] = parte.split('-').map(Number);
    if (Number.isInteger(inicio) && Number.isInteger(fim)) grifos.push({ inicio, fim });
  }
  return normalizar(grifos);
}
