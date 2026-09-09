// Quanto custa o caderno crescer. Nao mede velocidade absoluta — mede COMO o
// custo cresce quando o numero de notas dobra: linear dobra, quadratico
// quadruplica.
//
// Fica fora do `npm run check` de proposito. Medicao por relogio oscila com a
// maquina ocupada, e um portao que derruba por motivo errado e pior do que nao
// medir; a bateria guarda o que da o mesmo numero em qualquer lugar.
//
//   node .agent/check-escala.mjs
import { createRequire } from 'node:module';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// o codigo do app e TypeScript: o vitest sabe carrega-lo, este script nao.
// Entao aqui se mede pelo proprio vitest, num arquivo so de medicao.
const require = createRequire(import.meta.url);
const { execFileSync } = require('node:child_process');

const ARQUIVO = 'src/escala.medicao.test.ts';

console.log('medindo o crescimento do custo (pode levar alguns segundos)...\n');
try {
  // MEDIR=1 desliga a exclusao do vitest.config, que tira a medicao da
  // bateria: aqui ela e justamente o que se quer rodar
  execFileSync('npx', ['vitest', 'run', ARQUIVO, '--reporter=verbose'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, MEDIR: '1' },
  });
} catch {
  console.error('\na medicao acusou crescimento maior que o aceitavel');
  process.exit(1);
}
