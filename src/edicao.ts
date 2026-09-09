/**
 * Regras de teclado do editor de Markdown, como funções puras: recebem o
 * estado do texto (conteúdo + seleção) e devolvem o novo estado. Nada de
 * DOM ou eventos aqui — quem liga isso a um campo de texto real fica de
 * fora deste arquivo.
 */

export type Estado = { texto: string; inicio: number; fim: number };

type Marcador = { prefixo: string; conteudo: string };

const RE_TAREFA = /^(\s*)([-*+]) \[([ xX])\] (.*)$/;
const RE_ORDENADA = /^(\s*)(\d+)\. (.*)$/;
const RE_CITACAO = /^(\s*)> (.*)$/;
const RE_LISTA = /^(\s*)([-*+]) (.*)$/;

function detectarMarcador(linha: string): Marcador | null {
  const tarefa = linha.match(RE_TAREFA);
  if (tarefa) {
    const [, recuo, marca, , resto] = tarefa;
    return { prefixo: `${recuo}${marca} [ ] `, conteudo: resto };
  }

  const ordenada = linha.match(RE_ORDENADA);
  if (ordenada) {
    const [, recuo, numero, resto] = ordenada;
    return { prefixo: `${recuo}${Number(numero) + 1}. `, conteudo: resto };
  }

  const citacao = linha.match(RE_CITACAO);
  if (citacao) {
    const [, recuo, resto] = citacao;
    return { prefixo: `${recuo}> `, conteudo: resto };
  }

  const lista = linha.match(RE_LISTA);
  if (lista) {
    const [, recuo, marca, resto] = lista;
    return { prefixo: `${recuo}${marca} `, conteudo: resto };
  }

  return null;
}

function limitesDaLinha(texto: string, posicao: number): { inicio: number; fim: number } {
  const inicio = texto.lastIndexOf('\n', posicao - 1) + 1;
  let fim = texto.indexOf('\n', posicao);
  if (fim === -1) fim = texto.length;
  return { inicio, fim };
}

export function aoTeclarEnter(estado: Estado): Estado | null {
  if (estado.inicio !== estado.fim) return null;

  const cursor = estado.inicio;
  const { texto } = estado;
  const { inicio: inicioLinha, fim: fimLinha } = limitesDaLinha(texto, cursor);
  if (cursor !== fimLinha) return null;

  const linha = texto.slice(inicioLinha, fimLinha);
  const marcador = detectarMarcador(linha);
  if (!marcador) return null;

  if (marcador.conteudo === '') {
    // Item vazio: apaga o marcador e encerra a lista, sem inserir linha nova.
    const textoNovo = texto.slice(0, inicioLinha) + texto.slice(fimLinha);
    return { texto: textoNovo, inicio: inicioLinha, fim: inicioLinha };
  }

  const textoNovo = texto.slice(0, cursor) + '\n' + marcador.prefixo + texto.slice(cursor);
  const posicao = cursor + 1 + marcador.prefixo.length;
  return { texto: textoNovo, inicio: posicao, fim: posicao };
}

function contarEspacosIniciais(linha: string): number {
  let n = 0;
  while (n < linha.length && linha[n] === ' ') n++;
  return n;
}

/**
 * Indenta ou desindenta todas as linhas tocadas por [inicioSel, fimSel) e
 * recalcula a seleção para que continue cobrindo as mesmas linhas/colunas
 * relativas.
 */
function aplicarTab(texto: string, inicioSel: number, fimSel: number, recuar: boolean): Estado {
  const inicioLinha = texto.lastIndexOf('\n', inicioSel - 1) + 1;

  // Se a seleção termina exatamente no começo de uma linha, essa linha não
  // foi de fato "tocada" (nenhum caractere dela está selecionado).
  let fimEfetivo = fimSel;
  if (fimSel > inicioSel && (fimSel === 0 || texto[fimSel - 1] === '\n')) {
    fimEfetivo = fimSel - 1;
  }
  let fimLinha = texto.indexOf('\n', fimEfetivo);
  if (fimLinha === -1) fimLinha = texto.length;

  const linhas = texto.slice(inicioLinha, fimLinha).split('\n');
  const offsets: number[] = [];
  let cursor = inicioLinha;
  for (const linha of linhas) {
    offsets.push(cursor);
    cursor += linha.length + 1;
  }

  const deltas: number[] = [];
  const novasLinhas = linhas.map((linha) => {
    if (recuar) {
      const removidos = Math.min(2, contarEspacosIniciais(linha));
      deltas.push(-removidos);
      return linha.slice(removidos);
    }
    deltas.push(2);
    return `  ${linha}`;
  });

  const textoNovo = texto.slice(0, inicioLinha) + novasLinhas.join('\n') + texto.slice(fimLinha);
  const deltaTotal = deltas.reduce((soma, d) => soma + d, 0);

  const novaPosicao = (posicao: number): number => {
    if (posicao < inicioLinha) return posicao;
    if (posicao > fimLinha) return posicao + deltaTotal;

    let indice = 0;
    for (let i = 0; i < offsets.length; i++) {
      const fimDaLinha = offsets[i] + linhas[i].length;
      if (posicao >= offsets[i] && posicao <= fimDaLinha) {
        indice = i;
        break;
      }
    }

    const coluna = posicao - offsets[indice];
    const deltaAntes = deltas.slice(0, indice).reduce((soma, d) => soma + d, 0);
    const colunaAjustada = recuar ? Math.max(0, coluna + deltas[indice]) : coluna + 2;
    return offsets[indice] + deltaAntes + colunaAjustada;
  };

  return { texto: textoNovo, inicio: novaPosicao(inicioSel), fim: novaPosicao(fimSel) };
}

export function aoTeclarTab(estado: Estado, recuar: boolean): Estado | null {
  const { texto, inicio, fim } = estado;

  if (inicio === fim) {
    const { inicio: inicioLinha, fim: fimLinha } = limitesDaLinha(texto, inicio);
    const linha = texto.slice(inicioLinha, fimLinha);
    if (!detectarMarcador(linha)) return null;
  }

  return aplicarTab(texto, inicio, fim, recuar);
}

export function alternarMarca(estado: Estado, marca: string): Estado {
  const { texto, inicio, fim } = estado;

  if (inicio !== fim) {
    const selecionado = texto.slice(inicio, fim);
    const antes = texto.slice(Math.max(0, inicio - marca.length), inicio);
    const depois = texto.slice(fim, fim + marca.length);

    if (antes === marca && depois === marca) {
      const textoNovo = texto.slice(0, inicio - marca.length) + selecionado + texto.slice(fim + marca.length);
      return { texto: textoNovo, inicio: inicio - marca.length, fim: fim - marca.length };
    }

    const textoNovo = texto.slice(0, inicio) + marca + selecionado + marca + texto.slice(fim);
    return { texto: textoNovo, inicio: inicio + marca.length, fim: fim + marca.length };
  }

  const textoNovo = texto.slice(0, inicio) + marca + marca + texto.slice(inicio);
  const posicao = inicio + marca.length;
  return { texto: textoNovo, inicio: posicao, fim: posicao };
}

export function inserirLink(estado: Estado, url: string): Estado {
  const { texto, inicio, fim } = estado;

  if (inicio !== fim) {
    const selecionado = texto.slice(inicio, fim);
    const inserto = `[${selecionado}](${url})`;
    const textoNovo = texto.slice(0, inicio) + inserto + texto.slice(fim);
    const posicao = inicio + inserto.length;
    return { texto: textoNovo, inicio: posicao, fim: posicao };
  }

  const inserto = `[](${url})`;
  const textoNovo = texto.slice(0, inicio) + inserto + texto.slice(inicio);
  const posicao = inicio + 1;
  return { texto: textoNovo, inicio: posicao, fim: posicao };
}

/**
 * A URL de uma colagem, quando o que veio da área de transferência é um
 * endereço e nada mais. Serve para transformar `texto selecionado` + colar num
 * link, que é o que todo editor faz e o que ninguém quer digitar à mão.
 *
 * Exige endereço inteiro e sozinho: um parágrafo que menciona um link continua
 * sendo texto, e colar por cima da seleção tem de substituí-la como sempre.
 */
export function urlColada(bruto: string): string | null {
  const limpo = bruto.trim();
  if (limpo === '' || /\s/.test(limpo)) return null;
  return /^https?:\/\/[^\s]+$/i.test(limpo) ? limpo : null;
}
