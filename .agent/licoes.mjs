// Memória entre execuções.
//
// Sem isto o orquestrador é amnésico: cada tarefa começa ignorante e o modelo
// local pode repetir na terça o mesmo erro que cometeu na segunda. Aqui todo
// erro que a validação pega vira uma regra escrita, que entra no prompt das
// próximas tarefas — errar uma vez é aprendizado, errar de novo é desperdício.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function caminhoLicoes(root) {
  return join(root, '.agent', 'licoes.md');
}

export function lerLicoes(root) {
  const arquivo = caminhoLicoes(root);
  if (!existsSync(arquivo)) return [];
  return readFileSync(arquivo, 'utf8')
    .split(/\r?\n/)
    .map((linha) => linha.match(/^- \((\d+)x\) (.+)$/))
    .filter(Boolean)
    .map((m) => ({ vezes: Number(m[1]), texto: m[2] }));
}

// Tira o que é específico de uma ocorrência (arquivo, linha, valor) para que
// duas manifestações do mesmo erro contem como uma lição só.
function normalizar(linha) {
  return linha
    .replace(/^[\w./\\-]+:\d+\s*/, '')
    .replace(/^[\w./\\-]+\(\d+,\d+\):\s*/, '')
    .replace(/\d+px/g, 'Npx')
    .replace(/^[-*]\s*/, '')
    .trim();
}

const RELEVANTE =
  /proibid|fora da escala|nao pertence|não pertence|maximo e|máximo é|error TS|Expected|AssertionError|nao foi declarada|não foi declarada|fora dos tokens/i;

export function registrarLicoes(root, saidaDaValidacao) {
  const novas = saidaDaValidacao
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => RELEVANTE.test(l))
    .map(normalizar)
    .filter((l) => l.length > 12 && l.length < 160);

  if (novas.length === 0) return;

  const contagem = new Map(lerLicoes(root).map((l) => [l.texto, l.vezes]));
  for (const texto of new Set(novas)) contagem.set(texto, (contagem.get(texto) ?? 0) + 1);

  const ordenadas = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);

  writeFileSync(
    caminhoLicoes(root),
    [
      '# Lições aprendidas',
      '',
      'Erros que a validação já pegou neste projeto. Cada linha entra no prompt das',
      'próximas tarefas. Gerado pelo run.mjs — pode editar e reescrever à mão.',
      '',
      ...ordenadas.map(([texto, vezes]) => `- (${vezes}x) ${texto}`),
      '',
    ].join('\n'),
    'utf8',
  );
}

export function secaoLicoes(root) {
  const licoes = lerLicoes(root);
  if (licoes.length === 0) return '';

  const repetidas = licoes.filter((l) => l.vezes >= 2);
  const linhas = [
    '',
    '## ERROS JA COMETIDOS NESTE PROJETO - NAO REPITA',
    '',
    'A validacao ja reprovou os pontos abaixo em tarefas anteriores.',
    'Confira cada um antes de responder:',
    '',
    ...licoes.slice(0, 25).map((l) => `- ${l.texto}${l.vezes >= 2 ? `  [ja aconteceu ${l.vezes}x]` : ''}`),
  ];

  if (repetidas.length > 0) {
    linhas.push('', `Atencao redobrada aos ${repetidas.length} itens marcados como repetidos.`);
  }

  return linhas.join('\n');
}
