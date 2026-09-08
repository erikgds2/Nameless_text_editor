// "ele tem de lembrar sempre das configuracoes feitas". No navegador o
// localStorage vive na origem http://localhost:5173; no app instalado a pagina
// vem de file://. Sao origens diferentes, e file:// nem sempre pode guardar
// nada. Este script escreve na primeira execucao e le na segunda, carregando o
// dist/ pelo mesmo caminho do app empacotado.
//
//   npx electron .agent/fumaca-lembrar.cjs gravar
//   npx electron .agent/fumaca-lembrar.cjs ler
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const acao = process.argv[2] === 'ler' ? 'ler' : 'gravar';
const CHAVE = 'ardosia:ajustes:v1';

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await new Promise((r) => setTimeout(r, 1500));

  const script =
    acao === 'gravar'
      ? `(() => { try { localStorage.setItem(${JSON.stringify(CHAVE)}, JSON.stringify({ tema: 'papel', opacidade: 73 })); return 'gravou: ' + localStorage.getItem(${JSON.stringify(CHAVE)}); } catch (e) { return 'ERRO ao gravar: ' + e.message; } })()`
      : `(() => { try { return 'leu: ' + String(localStorage.getItem(${JSON.stringify(CHAVE)})); } catch (e) { return 'ERRO ao ler: ' + e.message; } })()`;

  console.log('origem:', await win.webContents.executeJavaScript('location.origin'));
  console.log(await win.webContents.executeJavaScript(script));
  app.quit();
});
