// Lançar uma versão, inteira, num comando só:
//
//   npm run lancar          (0.2.1 -> 0.2.2, correções)
//   npm run lancar minor    (0.2.2 -> 0.3.0, features novas)
//
// Existe porque a sequência manual tem seis passos e eu já errei três: uma
// release ficou como rascunho — e rascunho o atualizador do app não enxerga —,
// o token do GitHub foi passado à mão, e a release nasceu sem o instalador
// dentro. Um passo esquecido aqui significa alguém abrindo o app e não
// recebendo a correção.
//
// A ordem importa duas vezes:
//
//   - nada é publicado antes da bateria passar. Uma versão quebrada no ar é
//     pior que uma versão atrasada, porque o app se atualiza sozinho e leva o
//     defeito junto;
//   - a release é criada ANTES de os arquivos subirem. O electron-builder envia
//     o instalador e o mapa em paralelo e, se a release não existir, os dois
//     tentam criá-la: um cria, o outro leva 422 e derruba o envio pela metade.
//     Foi assim que a 0.2.1 nasceu sem o .exe dentro.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TIPOS = ['patch', 'minor', 'major'];
const tipo = process.argv[2] ?? 'patch';

if (!TIPOS.includes(tipo)) {
  console.error(`tipo de versão inválido: ${tipo} (use ${TIPOS.join(', ')})`);
  process.exit(1);
}

// git e gh são executáveis de verdade: chamados direto, cada argumento chega
// inteiro e nenhum espaço precisa de aspas. npm é um .cmd, e o Windows só o
// executa através do shell — por isso ele tem a própria função, e é a única
// onde as aspas importam.
function git(...argumentos) {
  return execFileSync('git', argumentos, { encoding: 'utf8' }).trim();
}

function gh(...argumentos) {
  return execFileSync('gh', argumentos, { encoding: 'utf8' }).trim();
}

function npm(argumentos, opcoes = {}) {
  execFileSync(`npm ${argumentos}`, { stdio: 'inherit', shell: true, ...opcoes });
}

function passo(numero, texto) {
  console.log(`\n[${numero}/6] ${texto}`);
}

/** As tags de versão nascem no GitHub quando o electron-builder publica; sem
 *  trazê-las, o histórico daqui não sabe onde a versão anterior terminou. */
function intervaloDesde(tag) {
  try {
    git('fetch', '--tags', '--quiet');
  } catch {
    // sem rede: seguimos com o que já existe aqui
  }
  try {
    git('rev-parse', '--verify', '--quiet', `${tag}^{commit}`);
    return [`${tag}..HEAD`];
  } catch {
    // primeira versão marcada, ou tag perdida: os últimos commits bastam
    return ['-n', '20'];
  }
}

const versaoAtual = JSON.parse(readFileSync('package.json', 'utf8')).version;

passo(1, 'a árvore precisa estar limpa');
if (git('status', '--porcelain')) {
  console.error('há mudanças não commitadas. Commite ou descarte antes de lançar.');
  process.exit(1);
}

passo(2, 'bateria completa — nada sobe vermelho');
npm('run check');

passo(3, `versão: ${versaoAtual} -> ${tipo}`);
npm(`version ${tipo} -m "Versao %s"`);
const versao = JSON.parse(readFileSync('package.json', 'utf8')).version;

passo(4, 'marcar a versão no GitHub');
git('push', '--follow-tags');

passo(5, 'abrir a release com as notas do que mudou');
// O que mudou desde a versão anterior, direto dos assuntos dos commits. É o
// texto que aparece na release e no aviso de atualização.
const notas = git('log', ...intervaloDesde(`v${versaoAtual}`), '--no-merges', '--format=%s')
  .split('\n')
  .map((assunto) => assunto.trim())
  .filter((assunto) => assunto.length > 0 && !assunto.startsWith('Versao '))
  .map((assunto) => `- ${assunto}`)
  .join('\n');

// Texto com quebra de linha não atravessa a linha de comando do Windows.
const arquivoDasNotas = join(tmpdir(), `ardosia-notas-${versao}.md`);
writeFileSync(arquivoDasNotas, notas || `Ardósia ${versao}`, 'utf8');

const titulo = `Ardósia ${versao}`;
try {
  gh('release', 'view', `v${versao}`);
  gh('release', 'edit', `v${versao}`, '--draft=false', '--title', titulo, '--notes-file', arquivoDasNotas);
} catch {
  gh('release', 'create', `v${versao}`, '--title', titulo, '--notes-file', arquivoDasNotas);
}

passo(6, `empacotar e enviar os arquivos da ${versao}`);
// O token sai do gh, que já está autenticado nesta máquina. Ele nunca aparece
// na linha de comando nem no histórico do shell: vai só no ambiente do filho.
npm('run publicar', { env: { ...process.env, GH_TOKEN: gh('auth', 'token') } });

console.log(`\nArdósia ${versao} publicada: https://github.com/erikgds2/Nameless_text_editor/releases/tag/v${versao}`);
console.log('Quem já tem o app instalado recebe na próxima vez que abrir.');
