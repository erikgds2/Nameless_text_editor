export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function matchesQuery(text: string, query: string): boolean {
  if (query.trim() === '') return true;

  const normalizedText = normalize(text);
  const normalizedQuery = normalize(query);
  const terms = normalizedQuery.split(/\s+/);

  return terms.every((term) => normalizedText.includes(term));
}

const RETICENCIA = '…';
const MARGEM = 15;

/**
 * O trecho onde o termo apareceu — é o que a lista mostra no lugar do começo
 * da nota, que quase nunca é onde está o que se procurou.
 *
 * Os índices da versão normalizada valem na original porque remover marcas de
 * acentuação não muda a contagem de caracteres: "ação" tem quatro letras antes
 * e depois. É por isso que dá para procurar sem acento e recortar com acento.
 */
export function trechoDoResultado(texto: string, consulta: string, tamanho = 90): string {
  if (!texto) return '';

  const linha = texto.replace(/\s+/g, ' ').trim();
  const posicao = primeiraOcorrencia(linha, consulta);

  if (posicao < 0) {
    return linha.length <= tamanho ? linha : linha.slice(0, tamanho) + RETICENCIA;
  }

  const bruto = Math.max(0, posicao - Math.floor(tamanho / 2));
  const inicio = recuarAtePalavra(linha, bruto);
  const fim = avancarAtePalavra(linha, Math.min(linha.length, inicio + tamanho));

  return (
    (inicio > 0 ? RETICENCIA : '') +
    linha.slice(inicio, fim) +
    (fim < linha.length ? RETICENCIA : '')
  );
}

/** Posição do termo que aparece primeiro no texto — não o primeiro digitado. */
function primeiraOcorrencia(linha: string, consulta: string): number {
  if (consulta.trim() === '') return -1;
  const alvo = normalize(linha);
  const posicoes = normalize(consulta)
    .split(/\s+/)
    .filter(Boolean)
    .map((termo) => alvo.indexOf(termo))
    .filter((posicao) => posicao >= 0);
  return posicoes.length > 0 ? Math.min(...posicoes) : -1;
}

// Cortar no meio de uma palavra atrapalha mais do que os poucos caracteres que
// se ganha — mas só vale a pena procurar o espaço aqui perto.
function recuarAtePalavra(linha: string, posicao: number): number {
  if (posicao <= 0) return 0;
  const espaco = linha.lastIndexOf(' ', posicao);
  return espaco >= 0 && posicao - espaco <= MARGEM ? espaco + 1 : posicao;
}

function avancarAtePalavra(linha: string, posicao: number): number {
  if (posicao >= linha.length) return linha.length;
  const espaco = linha.indexOf(' ', posicao);
  return espaco >= 0 && espaco - posicao <= MARGEM ? espaco : posicao;
}
