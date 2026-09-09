// O app de verdade, com uma imagem de verdade na area de transferencia do
// Windows, e um Ctrl+V de verdade. Nao simula nada: registra os mesmos canais
// do main.cjs, carrega o mesmo dist, poe a imagem no clipboard do sistema e
// manda a janela colar. Depois olha a nota no disco e tira uma foto da tela.
//
// Existe porque eu passei tres rodadas testando PARTES do caminho e o defeito
// estava na juncao delas.
//
//   npx electron .agent/fumaca-colar-real.cjs
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const RAIZ = path.resolve(__dirname, '..');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ardosia-real-'));
const NOTAS = path.join(TEMP, 'Ardósia');
fs.mkdirSync(NOTAS, { recursive: true });

const { app, BrowserWindow, ipcMain, protocol, net, clipboard, nativeImage } = require('electron');

app.setPath('userData', TEMP);
fs.writeFileSync(path.join(TEMP, 'config.json'), JSON.stringify({ pasta: NOTAS }), 'utf8');

const notas = require('../electron/notas.cjs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'ardosia', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** Uma nota de texto puro com uma linha escrita, como a do usuario. */
const NOTA = [
  '---',
  'ardosia: 1',
  'tipo: texto',
  'criada: 2026-09-09T12:00:00.000Z',
  'atualizada: 2026-09-09T12:00:00.000Z',
  'fixada: false',
  '---',
  '',
  '<!-- ardosia:bloco x=15 y=15 w=320 h=185 -->',
  '# Fase 2 no disco',
  '',
];

const esperar = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

app.whenReady().then(async () => {
  const soAbrir = process.argv.includes('--so-abrir');
  try {
    if (soAbrir) {
      // o estado exato da nota do usuario: figura na secao, sem a medida dela
      fs.mkdirSync(path.join(NOTAS, 'anexos'), { recursive: true });
      fs.copyFileSync(process.argv[2], path.join(NOTAS, 'anexos', 'foto.png'));
      const comFoto = [...NOTA];
      comFoto[9] = '<!-- ardosia:bloco x=15 y=15 w=524 h=392 img=anexos/foto.png -->';
      fs.writeFileSync(path.join(NOTAS, 'fase-2.md'), comFoto.join('\n'), 'utf8');
    } else {
      fs.writeFileSync(path.join(NOTAS, 'fase-2.md'), NOTA.join('\n'), 'utf8');
    }
    console.log('--- nota escrita para o teste ---');
    console.log(fs.readFileSync(path.join(NOTAS, 'fase-2.md'), 'utf8'));

    protocol.handle('ardosia', async (requisicao) => {
      try {
        return await net.fetch(pathToFileURL(await notas.anexoDaUrl(requisicao.url)).toString());
      } catch {
        return new Response('anexo nao encontrado', { status: 404 });
      }
    });

    // os mesmos canais do main.cjs
    ipcMain.handle('ardosia:pasta', () => notas.pasta());
    ipcMain.handle('ardosia:listar', () => notas.listar());
    ipcMain.handle('ardosia:escrever', (_e, id, texto) => notas.escrever(id, texto));
    ipcMain.handle('ardosia:renomear', (_e, de, para) => notas.renomear(de, para));
    ipcMain.handle('ardosia:apagar', (_e, id) => notas.apagar(id));
    ipcMain.handle('ardosia:salvar-anexo', (_e, bytes, tipo) => notas.salvarAnexo(bytes, tipo));
    ipcMain.handle('ardosia:modo-de-fundo', () => notas.modoDeFundo());
    ipcMain.handle('ardosia:versao', () => app.getVersion());
    ipcMain.handle('ardosia:mostrar-na-pasta', () => {});
    ipcMain.handle('ardosia:registrar-erro', (_e, m) => console.log('[janela] erro:', m));
    ipcMain.handle('ardosia:instalar-atualizacao', () => {});
    ipcMain.handle('ardosia:abrir-pasta', () => {});
    ipcMain.handle('ardosia:escolher-pasta', () => null);
    ipcMain.handle('ardosia:trocar-modo-de-fundo', () => {});
    ipcMain.handle('ardosia:fechar-captura', () => {});

    const vidro = process.argv.includes('--vidro');
    console.log('modo de fundo:', vidro ? 'vidro (transparent)' : 'acrilico');
    const win = new BrowserWindow({
      width: 900,
      height: 700,
      show: false,
      backgroundColor: '#00000000',
      ...(vidro ? { transparent: true } : { backgroundMaterial: 'acrylic' }),
      webPreferences: {
        preload: path.join(RAIZ, 'electron', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    win.webContents.on('console-message', (_e, _nivel, mensagem) => {
      if (/erro|error|fail/i.test(mensagem)) console.log('[console]', mensagem);
    });

    await win.loadFile(path.join(RAIZ, 'dist', 'index.html'));
    await esperar(1200);

    // a imagem entra na area de transferencia do Windows, como um print
    const arquivo = process.argv[2] || path.join(RAIZ, 'build', 'icone.png');
    if (soAbrir) {
      await esperar(1500);
      console.log('--- so abrindo a nota que ja tinha foto ---');
      const antes = fs.readFileSync(path.join(NOTAS, 'fase-2.md'), 'utf8');
      console.log('imgh logo ao abrir:', antes.includes('imgh=') ? 'sim' : 'NAO');
      await win.webContents.reload();
      await esperar(2500);
      const depois = fs.readFileSync(path.join(NOTAS, 'fase-2.md'), 'utf8');
      const pintada = await win.webContents.executeJavaScript(`
        [...document.querySelectorAll('img.bloco__imagem')].map((i) =>
          Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height))
      `);
      console.log('imgh depois de reabrir (cache):', depois.includes('imgh=') ? 'sim' : 'NAO');
      console.log('foto pintada em:', JSON.stringify(pintada));
      const dom = await win.webContents.executeJavaScript(`
        [...document.querySelectorAll('.bloco')].map((b) => ({
          classe: b.className,
          filhos: [...b.children].map((f) => f.className || f.tagName),
          texto: (b.querySelector('textarea') || {}).value,
        }))
      `);
      console.log('blocos na tela:', JSON.stringify(dom, null, 2));
      const tiro2 = await win.webContents.capturePage();
      fs.writeFileSync(path.join(os.tmpdir(), 'ardosia-so-abrir.png'), tiro2.toPNG());
      console.log('captura em:', path.join(os.tmpdir(), 'ardosia-so-abrir.png'));
      win.destroy();
      return app.quit();
    }
    clipboard.writeImage(nativeImage.createFromPath(arquivo));
    const noClipboard = clipboard.readImage().getSize();
    console.log('no clipboard:', `${noClipboard.width}x${noClipboard.height}`, `(${path.basename(arquivo)})`);

    // o cursor vai para o campo de escrita, e a janela cola
    await win.webContents.executeJavaScript(`
      (() => {
        const campo = document.querySelector('textarea.bloco__texto');
        if (!campo) return 'sem campo de escrita na tela';
        campo.focus();
        return 'campo focado: ' + JSON.stringify(campo.value.slice(0, 40));
      })()
    `).then((r) => console.log('antes de colar:', r));

    win.webContents.paste();
    await esperar(2500);

    const naTela = await win.webContents.executeJavaScript(`
      [...document.querySelectorAll('img.bloco__imagem')].map((i) => ({
        src: i.getAttribute('src'),
        completa: i.complete,
        natural: i.naturalWidth + 'x' + i.naturalHeight,
        pintada: Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height),
      }))
    `);
    const avisos = await win.webContents.executeJavaScript(
      `[...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent)`,
    );

    console.log('imagens na tela:', JSON.stringify(naTela, null, 2));
    console.log('avisos na tela:', JSON.stringify(avisos));

    const anexos = fs.existsSync(path.join(NOTAS, 'anexos'))
      ? fs.readdirSync(path.join(NOTAS, 'anexos'))
      : [];
    console.log('anexos gravados:', anexos.join(', ') || '(nenhum)');
    console.log('--- a nota no disco ---');
    console.log(fs.readFileSync(path.join(NOTAS, 'fase-2.md'), 'utf8'));

    // segunda abertura: e aqui que a imagem vem do cache e o onLoad nao dispara
    await win.webContents.reload();
    await esperar(2500);
    const depoisDeReabrir = fs.readFileSync(path.join(NOTAS, 'fase-2.md'), 'utf8');
    const naTela2 = await win.webContents.executeJavaScript(`
      [...document.querySelectorAll('img.bloco__imagem')].map((i) => ({
        completa: i.complete,
        pintada: Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height),
      }))
    `);
    console.log('--- depois de reabrir a nota ---');
    console.log('imagens na tela:', JSON.stringify(naTela2));
    console.log('tem imgh no arquivo:', depoisDeReabrir.includes('imgh=') ? 'sim' : 'NAO');

    const tiro = await win.webContents.capturePage();
    const destino = path.join(os.tmpdir(), 'ardosia-colagem-real.png');
    fs.writeFileSync(destino, tiro.toPNG());
    console.log('captura em:', destino);

    win.destroy();
  } catch (err) {
    console.error('fumaca falhou:', err && err.stack ? err.stack : err);
  }
  app.quit();
});
