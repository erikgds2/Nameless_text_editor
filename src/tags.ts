/**
 * Tags `#assunto` escritas no meio do texto.
 *
 * A regra difícil aqui é uma só: em Markdown, `#` no começo da linha é
 * cabeçalho, não tag. "# Anatomia" é um título; "revisar #anatomia" é uma
 * marca. Confundir os dois encheria a barra lateral com o título de toda nota.
 *
 * Dentro de código — cerca ou crase — nada é tag: `#include` é o que está
 * escrito, e a mesma defesa já existe em links.ts para as ligações.
 */
import { normalize } from './search';
import { textoDaNota, type Note } from './notes';

/** Letras, números, hífen e sublinhado; acento vale, e a tag guarda o acento. */
const RE_TAG = /#([\p{L}\p{N}_-]{1,50})/gu;
const RE_CERCA = /^```/;

export function extrairTags(texto: string): string[] {
  const achadas: string[] = [];
  const vistas = new Set<string>();
  let dentroDeCodigo = false;

  for (const linha of texto.split('\n')) {
    if (RE_CERCA.test(linha.trim())) {
      dentroDeCodigo = !dentroDeCodigo;
      continue;
    }
    if (dentroDeCodigo) continue;

    // um cabeçalho não é tag: fora o `#` da frente, a linha é texto comum
    const semCabecalho = linha.replace(/^\s{0,3}#{1,6}(\s|$)/, '$1');
    const semCodigo = semCabecalho.replace(/`[^`]*`/g, ' ');

    for (const achada of semCodigo.matchAll(RE_TAG)) {
      // `nota#2` é continuação de palavra, e não uma tag nova
      const antes = semCodigo[achada.index - 1];
      if (antes !== undefined && /[\p{L}\p{N}]/u.test(antes)) continue;

      const chave = normalize(achada[1]);
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      achadas.push(achada[1]);
    }
  }
  return achadas;
}

/** Quais notas carregam esta tag. Comparação sem acento e sem caixa. */
export function notasComTag(notas: Note[], tag: string): Note[] {
  const alvo = normalize(tag);
  return notas.filter((nota) =>
    extrairTags(textoDaNota(nota.blocos)).some((achada) => normalize(achada) === alvo),
  );
}

/**
 * Todas as tags do caderno, da mais usada para a menos usada. Empate resolve
 * em ordem alfabética, para a barra lateral não dançar a cada tecla digitada.
 */
export function tagsDoCaderno(notas: Note[]): { tag: string; quantas: number }[] {
  const contagem = new Map<string, { tag: string; quantas: number }>();

  for (const nota of notas) {
    for (const tag of extrairTags(textoDaNota(nota.blocos))) {
      const chave = normalize(tag);
      const atual = contagem.get(chave);
      if (atual) atual.quantas += 1;
      else contagem.set(chave, { tag, quantas: 1 });
    }
  }

  return [...contagem.values()].sort(
    (a, b) => b.quantas - a.quantas || a.tag.localeCompare(b.tag, 'pt-BR'),
  );
}
