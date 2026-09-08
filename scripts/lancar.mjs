// Lançar uma versão, inteira, num comando só:
//
//   npm run lancar          (0.2.0 -> 0.2.1, correções)
//   npm run lancar minor    (0.2.1 -> 0.3.0, features novas)
//
// Existe porque a sequência manual tem cinco passos e eu já errei dois deles:
// publiquei uma release que ficou como rascunho — e rascunho o atualizador do
// app não enxerga — e passei o token do GitHub à mão. Um passo esquecido aqui
// significa alguém abrindo o app e não recebendo a correção.
//
// A ordem importa: nada é publicado antes da bateria passar. Uma versão
// quebrada no ar é pior que uma versão atrasada, porque o app se atualiza
// sozinho e leva o defeito junto.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TIPOS = ['patch', 'minor', 'major'];
const tipo = process.argv[2] ?? 'patch';

if (!TIPOS.includes(tipo)) {
  console.error(`tipo de versão inválido: ${tipo} (use ${TIPOS.join(', ')})`);
  process.exit(1);
}

/** Roda mostrando a saída; qualquer falha derruba o lançamento. */
function rodar(comando, argumentos, opcoes = {}) {
  execFileSync(comando, argumentos, { stdio: 'inherit', shell: true, ...opcoes });
}

function capturar(comando, argumentos) {
  return execFileSync(comando, argumentos, { encoding: 'utf8', shell: true }).trim();
}

function passo(numero, texto) {
  console.log(`\n[${numero}/5] ${texto}`);
}

const versaoAtual = JSON.parse(readFileSync('package.json', 'utf8')).version;

passo(1, 'a árvore precisa estar limpa');
if (capturar('git', ['status', '--porcelain'])) {
  console.error('há mudanças não commitadas. Commite ou descarte antes de lançar.');
  process.exit(1);
}

passo(2, 'bateria completa — nada sobe vermelho');
rodar('npm', ['run', 'check']);

passo(3, `versão: ${versaoAtual} -> ${tipo}`);
rodar('npm', ['version', tipo, '-m', 'Versao %s']);
const versao = JSON.parse(readFileSync('package.json', 'utf8')).version;

passo(4, `empacotar e publicar a ${versao}`);
// O token sai do gh, que já está autenticado nesta máquina. Ele nunca aparece
// na linha de comando nem no histórico do shell: vai só no ambiente do filho.
const token = capturar('gh', ['auth', 'token']);
rodar('npm', ['run', 'publicar'], { env: { ...process.env, GH_TOKEN: token } });

passo(5, 'notas da versão e envio do commit');
// O que mudou desde a versão anterior, direto dos assuntos dos commits. É o
// texto que o app mostra quando avisa que há atualização.
const anterior = `v${versaoAtual}`;
const notas = capturar('git', ['log', `${anterior}..HEAD`, '--no-merges', '--format=- %s'])
  .split('\n')
  .filter((linha) => linha.length > 2 && !linha.startsWith('- Versao '))
  .join('\n');

rodar('gh', ['release', 'edit', `v${versao}`, '--draft=false', '--notes', JSON.stringify(notas || `Ardósia ${versao}`)]);
rodar('git', ['push', '--follow-tags']);

console.log(`\nArdósia ${versao} publicada: https://github.com/erikgds2/Nameless_text_editor/releases/tag/v${versao}`);
console.log('Quem já tem o app instalado recebe na próxima vez que abrir.');
