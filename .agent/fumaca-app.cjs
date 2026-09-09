// O teste de ponta a ponta que faltava, e que teria pego o defeito das imagens
// em minutos: sobe o APP DE VERDADE — com o nome de verdade, o main.cjs de
// verdade, o protocolo de verdade — e pergunta a ele se a imagem carrega.
//
// O bug: o Electron monta o User-Agent com o nome do app, e o nosso tem acento
// ("Ardósia"). O Chromium entrega esse cabecalho corrompido, e toda requisicao
// ao protocolo ardosia:// morria dentro do Electron, antes do nosso handler.
// Nenhum teste de modulo alcanca isso, e nenhum fumaca alcancava tambem —
// porque script solto roda com o nome "Electron", sem acento.
//
//   node .agent/fumaca-app.cjs
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const RAIZ = path.resolve(__dirname, '..');
// pasta com acento de proposito: e a pasta padrao do app, e o acento importa
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ardosia-e2e-'));
const NOTAS = path.join(TEMP, 'Ardósia');
// porta alta e pouco provavel: 9222 e vizinhas costumam estar ocupadas por
// outro Chrome com depuracao ligada, e ai o teste pergunta a janela errada
const PORTA = 9417;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAHElEQVQI12P8z8DAwMDAxMDAwMDAwMTAwMDAAAAeAAlEZ6ThAAAAAElFTkSuQmCC',
  'base64',
);

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

function prepararPasta() {
  fs.mkdirSync(path.join(NOTAS, 'anexos'), { recursive: true });
  fs.writeFileSync(path.join(NOTAS, 'anexos', 'foto.png'), PNG);
  fs.writeFileSync(path.join(TEMP, 'config.json'), JSON.stringify({ pasta: NOTAS }), 'utf8');
  fs.writeFileSync(
    path.join(NOTAS, 'com-foto.md'),
    [
      '---',
      'ardosia: 1',
      'tipo: texto',
      'criada: 2026-09-09T12:00:00.000Z',
      'atualizada: 2026-09-09T12:00:00.000Z',
      'fixada: false',
      '---',
      '',
      '<!-- ardosia:bloco x=15 y=15 w=320 h=300 img=anexos/foto.png -->',
      'Uma nota de texto puro com foto',
      '',
    ].join('\n'),
    'utf8',
  );
}

/** Pergunta a janela do app, pelo protocolo de depuracao do Chrome. */
async function perguntar(expressao) {
  const alvos = await (await fetch(`http://127.0.0.1:${PORTA}/json`)).json();
  // a janela do app, e nao qualquer aba que responda na porta: o alvo certo e
  // o que carregou o index do proprio Ardosia
  const pagina = alvos.find(
    (a) => a.type === 'page' && /index\.html|localhost:5173/.test(a.url ?? ''),
  );
  if (!pagina) {
    throw new Error(
      'a janela do app nao apareceu; alvos: ' + alvos.map((a) => a.url).join(' | '),
    );
  }

  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  return new Promise((pronto, falhou) => {
    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: expressao, returnByValue: true, awaitPromise: true },
        }),
      );
    });
    ws.addEventListener('message', (evento) => {
      const dados = JSON.parse(evento.data);
      if (dados.id === 1) {
        ws.close();
        pronto(dados.result?.result?.value);
      }
    });
    ws.addEventListener('error', falhou);
  });
}

(async () => {
  prepararPasta();

  const electron = path.join(RAIZ, 'node_modules', 'electron', 'dist', 'electron.exe');
  const app = spawn(
    electron,
    [RAIZ, `--user-data-dir=${TEMP}`, `--remote-debugging-port=${PORTA}`],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let erros = '';
  app.stderr.on('data', (pedaco) => (erros += pedaco.toString()));

  let falhou = false;
  try {
    await esperar(9000);

    const ua = await perguntar('navigator.userAgent');
    const soAscii = /^[\x20-\x7e]*$/.test(ua ?? '');
    console.log('User-Agent:', ua);
    console.log('  so ASCII:', soAscii ? 'ok' : 'RUIM — o protocolo vai morrer por causa disto');
    if (!soAscii) falhou = true;

    const carregou = await perguntar(`
      new Promise((ok) => {
        const img = new Image();
        img.onload = () => ok('CARREGOU ' + img.naturalWidth + 'x' + img.naturalHeight);
        img.onerror = () => ok('QUEBRADA');
        img.src = 'ardosia://anexos/foto.png?t=' + Date.now();
      })
    `);
    console.log('imagem pelo protocolo:', carregou);
    if (!String(carregou).startsWith('CARREGOU')) falhou = true;

    const naTela = await perguntar(
      `[...document.querySelectorAll('img.bloco__imagem')].map((i) => i.naturalWidth).join(',')`,
    );
    console.log('figuras desenhadas na nota (larguras):', naTela || '(nenhuma)');
    if (!naTela) falhou = true;

    // clicar NA FOTO tem de levar o cursor para o texto: e onde a mao vai
    const cliqueNaFoto = await perguntar(`
      (() => {
        const foto = document.querySelector('.bloco__figura');
        if (!foto) return 'sem figura na tela';
        foto.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        const campo = document.querySelector('.bloco .bloco__texto');
        return document.activeElement === campo ? 'cursor foi para o texto' : 'clique nao fez nada';
      })()
    `);
    console.log('clicar na foto:', cliqueNaFoto);
    if (cliqueNaFoto !== 'cursor foi para o texto') falhou = true;

    // escrever na secao que tem foto: era o que travava depois de colar
    const escreveu = await perguntar(`
      (() => {
        const campo = document.querySelector('.bloco .bloco__texto');
        if (!campo) return 'SEM CAMPO DE ESCRITA na secao com foto';
        campo.focus();
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value',
        ).set;
        setter.call(campo, 'legenda escrita pelo teste');
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        return document.activeElement === campo ? 'escreveu e manteve o foco' : 'perdeu o foco';
      })()
    `);
    console.log('escrita na secao com foto:', escreveu);
    if (!String(escreveu).startsWith('escreveu')) falhou = true;

    const erroDeCabecalho = erros.includes('ByteString');
    console.log('erro de cabecalho no main:', erroDeCabecalho ? 'RUIM' : 'nao');
    if (erroDeCabecalho) falhou = true;
  } catch (err) {
    console.error('fumaca falhou:', err.message);
    falhou = true;
  }

  app.kill();
  console.log(falhou ? '\nFALHOU' : '\napp de ponta a ponta ok');
  process.exit(falhou ? 1 : 0);
})();
