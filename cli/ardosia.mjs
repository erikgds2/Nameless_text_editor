#!/usr/bin/env node
/**
 * `ardosia` — escrever no caderno sem abrir o caderno.
 *
 * Existe para que outro programa possa escrever aqui dentro: uma IA que anota
 * o que apurou, um script que despeja o resumo do dia, um atalho do sistema. A
 * interface é o disco, e não um servidor — a CLI grava o mesmo `.md` na mesma
 * pasta, e o aplicativo aberto mostra o que chegou porque já vigia a pasta.
 *
 * Duas regras que valem para quem chama daqui:
 *
 *   - toda saída tem versão `--json`, e erro sai pelo código de saída ≠ 0.
 *     Um agente não deve precisar interpretar prosa para saber se deu certo;
 *   - nada é apagado por este comando. Escrever é reversível pelo desfazer do
 *     app e pelo histórico da pasta; apagar não seria.
 */
import process from 'node:process';
import {
  anexar,
  buscar,
  criar,
  definirPasta,
  ErroDaCli,
  escrever,
  ler,
  listar,
  pastaDasNotas,
  resolver,
} from './notas.mjs';
import { textoDaNota } from './formato.mjs';

const AJUDA = `ardosia — escrever no caderno pela linha de comando

  ardosia listar [--json]
  ardosia ler <nota> [--json]
  ardosia criar <título> [--tipo texto] [--json]
  ardosia escrever <nota> [texto] [--criar] [--json]
  ardosia buscar <termo> [--json]
  ardosia anexar <nota> <arquivo> [--fonte <url>] [--json]
  ardosia pasta [--definir <caminho>] [--json]

<nota> é o id (o nome do arquivo, sem .md) ou o título por extenso.
Sem <texto>, "escrever" lê da entrada padrão — é como um agente manda
um parágrafo inteiro sem se preocupar com aspas.

Exemplos para um agente:

  ardosia listar --json
  ardosia criar "Aula de 9 de setembro" --json
  echo "o que eu apurei" | ardosia escrever aula-de-9-de-setembro
  ardosia escrever "Notas do dia" "primeira ideia" --criar
  ardosia buscar fêmur --json
  ardosia anexar aula-de-9-de-setembro grafico.png --fonte https://exemplo.org

A pasta é a mesma do aplicativo. ARDOSIA_PASTA no ambiente tem prioridade
sobre ela — é assim que se trabalha numa pasta de teste sem tocar no caderno.
`;

function separar(argv) {
  const opcoes = {};
  const soltos = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      soltos.push(arg);
      continue;
    }
    const nome = arg.slice(2);
    const proximo = argv[i + 1];
    if (proximo !== undefined && !proximo.startsWith('--')) {
      opcoes[nome] = proximo;
      i++;
    } else {
      opcoes[nome] = true;
    }
  }
  return { opcoes, soltos };
}

/** O texto vem do argumento ou da entrada padrão, nunca dos dois. */
async function textoDaEntrada(argumento) {
  if (argumento !== undefined) return argumento;
  if (process.stdin.isTTY) return '';

  const pedacos = [];
  for await (const pedaco of process.stdin) pedacos.push(pedaco);
  return Buffer.concat(pedacos).toString('utf8').trim();
}

function responder(opcoes, dados, texto) {
  console.log(opcoes.json ? JSON.stringify(dados, null, 2) : texto);
}

const COMANDOS = {
  async listar(_soltos, opcoes) {
    const notas = await listar();
    responder(
      opcoes,
      notas,
      notas.length === 0
        ? 'nenhuma nota nesta pasta'
        : notas
            .map((nota) => `${nota.id}\t${nota.titulo}\t${nota.atualizadaEm.slice(0, 16).replace('T', ' ')}`)
            .join('\n'),
    );
  },

  async ler([alvo], opcoes) {
    if (!alvo) throw new ErroDaCli('falta dizer qual nota: ardosia ler <nota>');
    const id = await resolver(alvo);
    const nota = await ler(id);
    const texto = textoDaNota(nota.blocos);
    responder(opcoes, { id, tipo: nota.tipo, texto }, texto);
  },

  async criar([titulo], opcoes) {
    if (!titulo) throw new ErroDaCli('falta o título: ardosia criar <título>');
    const id = await criar(titulo, opcoes.tipo === 'texto' ? 'texto' : 'markdown');
    responder(opcoes, { id, titulo }, `criada: ${id}`);
  },

  async escrever([alvo, texto], opcoes) {
    if (!alvo) throw new ErroDaCli('falta dizer em qual nota: ardosia escrever <nota> [texto]');
    const conteudo = await textoDaEntrada(texto);
    if (conteudo.trim() === '') throw new ErroDaCli('nada para escrever: passe o texto ou mande pela entrada padrão');

    let id;
    try {
      id = await resolver(alvo);
    } catch (err) {
      if (!opcoes.criar) throw err;
      id = await criar(alvo);
    }

    const feito = await escrever(id, conteudo);
    responder(opcoes, feito, `escrito em ${feito.id}`);
  },

  async buscar([termo], opcoes) {
    if (!termo) throw new ErroDaCli('falta o que procurar: ardosia buscar <termo>');
    const achados = await buscar(termo);
    responder(
      opcoes,
      achados,
      achados.length === 0
        ? `nada com "${termo}"`
        : achados.map((achado) => `${achado.id}\t${achado.trecho}`).join('\n'),
    );
  },

  async anexar([alvo, arquivo], opcoes) {
    if (!alvo || !arquivo) throw new ErroDaCli('uso: ardosia anexar <nota> <arquivo>');
    const id = await resolver(alvo);
    const fonte = typeof opcoes.fonte === 'string' ? opcoes.fonte : null;
    const feito = await anexar(id, arquivo, fonte);
    responder(opcoes, { id, ...feito }, `anexado em ${id}: ${feito.nome}`);
  },

  async pasta(_soltos, opcoes) {
    const caminho =
      typeof opcoes.definir === 'string' ? await definirPasta(opcoes.definir) : await pastaDasNotas();
    responder(opcoes, { pasta: caminho }, caminho);
  },

  async ajuda() {
    console.log(AJUDA);
  },
};

const { opcoes, soltos } = separar(process.argv.slice(2));
const [nome, ...resto] = soltos;
const comando = COMANDOS[nome ?? 'ajuda'] ?? (opcoes.ajuda || opcoes.help ? COMANDOS.ajuda : null);

if (!comando) {
  console.error(`comando desconhecido: ${nome}\n`);
  console.error(AJUDA);
  process.exit(1);
}

try {
  await comando(resto, opcoes);
} catch (err) {
  if (err instanceof ErroDaCli) {
    console.error(err.message);
    process.exit(1);
  }
  console.error(`falhou: ${err.message}`);
  process.exit(2);
}
