// Desfazer do documento inteiro, dirigido por teclado DE VERDADE dentro da
// janela do Electron. O teste em jsdom prova a lógica do histórico; o que ele
// não alcança é a corrente inteira — tecla, React, textarea controlada,
// flushSync — e foi nessa corrente que nasceram os dois piores bugs até agora
// (letras comidas ao digitar rápido, seleção restaurada fora de hora).
//
//   npx electron .agent/fumaca-desfazer.cjs
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// maior que a PAUSA do historico (600ms), para fechar o passo de proposito
const PAUSA_FOLGADA = 900;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await espera(2000);

  // começa de uma nota nova e vazia, sem herdar nada de execuções anteriores
  await win.webContents.executeJavaScript('localStorage.clear()');
  await win.webContents.reload();
  await espera(2000);

  const digitar = async (texto) => {
    for (const letra of texto) {
      win.webContents.sendInputEvent({ type: 'char', keyCode: letra });
      await espera(25);
    }
  };

  const atalho = async (tecla, comShift = false) => {
    const modificadores = comShift ? ['control', 'shift'] : ['control'];
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: tecla, modifiers: modificadores });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: tecla, modifiers: modificadores });
    await espera(400);
  };

  const texto = () =>
    win.webContents.executeJavaScript("document.querySelector('textarea')?.value ?? '(sem campo)'");

  const quantosBlocos = () =>
    win.webContents.executeJavaScript("document.querySelectorAll('textarea').length");

  // pasta limpa nao tem nota, e sem nota nao ha onde escrever
  await atalho('N');
  await espera(800);
  await win.webContents.executeJavaScript("document.querySelector('textarea')?.focus()");
  await espera(300);
  console.log('0) nota criada, campos:', await quantosBlocos());

  await digitar('Kant');
  await espera(PAUSA_FOLGADA);
  await digitar(' e Hume');
  await espera(300);
  console.log('1) escrito:            ', JSON.stringify(await texto()));

  await atalho('Z');
  console.log('2) depois de Ctrl+Z:   ', JSON.stringify(await texto()));

  await atalho('Z');
  console.log('3) outro Ctrl+Z:       ', JSON.stringify(await texto()));

  await atalho('Y');
  console.log('4) Ctrl+Y refaz:       ', JSON.stringify(await texto()));

  await atalho('Z', true);
  console.log('5) Ctrl+Shift+Z refaz: ', JSON.stringify(await texto()));

  // A promessa do item: desfazer alcanca o que o Ctrl+Z do navegador nunca
  // alcancou — apagar um bloco inteiro, que nao e edicao de campo nenhum.
  await win.webContents.executeJavaScript(`
    (() => {
      const canvas = document.querySelector('.canvas');
      const r = canvas.getBoundingClientRect();
      const evento = (tipo) => canvas.dispatchEvent(new MouseEvent(tipo, {
        bubbles: true, clientX: r.left + 620, clientY: r.top + 380,
      }));
      evento('dblclick');
    })()
  `);
  await espera(600);
  console.log('6) segundo bloco criado:', await quantosBlocos());

  await win.webContents.executeJavaScript(
    "document.querySelectorAll('.bloco__excluir')[1]?.click()",
  );
  await espera(600);
  console.log('7) depois de excluir:  ', await quantosBlocos());

  await atalho('Z');
  console.log('8) Ctrl+Z traz de volta:', await quantosBlocos(), '| texto:', JSON.stringify(await texto()));

  app.quit();
});
