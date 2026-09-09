// Verifica as regras de arquitetura que este projeto adotou, para elas nao
// dependerem da memoria de ninguem. A lista vem de METODOLOGIA.md, e cada
// regra aqui aponta o livro de onde saiu.
//
//   node .agent/check-arquitetura.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const erros = [];
const erro = (arquivo, msg) => erros.push(`${relative(RAIZ, arquivo).replace(/\\/g, '/')}  ${msg}`);

function arquivosDe(pasta, extensoes) {
  const achados = [];
  for (const entrada of readdirSync(pasta)) {
    const caminho = join(pasta, entrada);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivosDe(caminho, extensoes));
    } else if (extensoes.some((ext) => entrada.endsWith(ext)) && !entrada.includes('.test.')) {
      achados.push(caminho);
    }
  }
  return achados;
}

const naRaizDeSrc = arquivosDe(join(RAIZ, 'src'), ['.ts']).filter(
  (caminho) => !caminho.includes(`${'components'}`),
);
const componentes = arquivosDe(join(RAIZ, 'src', 'components'), ['.tsx', '.ts']);

// ---------------------------------------------------------------------------
// Regra 1 — a regra da dependencia (Arquitetura Limpa, Robert C. Martin).
// O nucleo do Ardosia e o formato das notas e as decisoes sobre elas. Ele nao
// pode saber que existe React, Electron ou DOM: e o que permite testar tudo em
// milissegundos e trocar a casca sem tocar no miolo.
const PROIBIDOS_NO_NUCLEO = [
  { padrao: /from\s+'react/, oQue: "React" },
  { padrao: /from\s+'electron/, oQue: 'Electron' },
  { padrao: /\bdocument\.[a-z]/i, oQue: 'o DOM (document)' },
  { padrao: /\bwindow\.(?!ardosia)[a-z]/i, oQue: 'a janela (window)' },
];

// Estes tres sao a casca de dentro: falam com o navegador de proposito.
const CASCA = ['src/janela.ts', 'src/pasta.ts', 'src/deposito.ts', 'src/diagrama.ts', 'src/ajustes.ts'];

for (const arquivo of naRaizDeSrc) {
  const relativo = relative(RAIZ, arquivo).replace(/\\/g, '/');
  if (CASCA.includes(relativo)) continue;

  const texto = readFileSync(arquivo, 'utf8');
  for (const { padrao, oQue } of PROIBIDOS_NO_NUCLEO) {
    if (padrao.test(texto)) {
      erro(arquivo, `o nucleo nao pode depender de ${oQue} (regra da dependencia)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Regra 2 — varredura dentro de varredura (Entendendo Algoritmos, Bhargava).
// Construir um indice do caderno inteiro dentro de um map/filter e quadratico:
// com mil notas o app para de responder. O indice se constroi uma vez, fora.
const CAROS = ['construirIndice', 'tagsDoCaderno', 'saveNotes', 'loadNotes'];
const DENTRO_DE_LACO = new RegExp(
  `\\.(map|filter|forEach|some|every|find|flatMap|reduce)\\([^)]*=>[^;]{0,200}?\\b(${CAROS.join('|')})\\(`,
  's',
);

for (const arquivo of [...naRaizDeSrc, ...componentes]) {
  const texto = readFileSync(arquivo, 'utf8');
  if (DENTRO_DE_LACO.test(texto)) {
    erro(arquivo, 'varredura do caderno inteiro dentro de um laco: construa o indice uma vez, fora');
  }
}

// ---------------------------------------------------------------------------
// Regra 3 — modulo que cresce demais (Refatoracao, Fowler: "classe grande").
// Nao e um numero sagrado; e o ponto em que vale parar e perguntar se ali nao
// moram duas responsabilidades.
const TETO = { '.ts': 400, '.tsx': 700 };

// Divida declarada: o que ja passou do teto antes desta regra existir, com o
// item do BACKLOG que a paga. Aparece como aviso a cada rodada — o que nao se
// ve nao se paga —, mas nao derruba o portao por algo que ninguem acabou de
// escrever. Nada entra aqui sem numero de item.
const DIVIDAS = { 'src/markdown.ts': 111 };

for (const arquivo of [...naRaizDeSrc, ...componentes]) {
  const linhas = readFileSync(arquivo, 'utf8').split('\n').length;
  const teto = arquivo.endsWith('.tsx') ? TETO['.tsx'] : TETO['.ts'];
  if (linhas <= teto) continue;

  const relativo = relative(RAIZ, arquivo).replace(/\\/g, '/');
  const item = DIVIDAS[relativo];
  if (item) {
    console.warn(`aviso: ${relativo} tem ${linhas} linhas (teto ${teto}) — item ${item} do BACKLOG`);
  } else {
    erro(arquivo, `${linhas} linhas (teto ${teto}): ha duas responsabilidades aqui dentro?`);
  }
}

// ---------------------------------------------------------------------------
// Regra 4 — codigo novo sem teste (Feathers: codigo legado e codigo sem teste).
// Todo modulo do nucleo tem de ter um .test ao lado.
for (const arquivo of naRaizDeSrc) {
  const relativo = relative(RAIZ, arquivo).replace(/\\/g, '/');
  if (['src/main.tsx', 'src/test-setup.ts', 'src/deposito.contrato.ts'].includes(relativo)) continue;
  const teste = arquivo.replace(/\.ts$/, '.test.ts');
  try {
    statSync(teste);
  } catch {
    erro(arquivo, 'modulo do nucleo sem arquivo de teste ao lado');
  }
}

if (erros.length > 0) {
  console.error('arquitetura:\n' + erros.map((linha) => `  ${linha}`).join('\n'));
  process.exit(1);
}
console.log('arquitetura ok');
