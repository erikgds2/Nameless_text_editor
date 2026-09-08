// A unica ponte entre a nota na tela e o arquivo em disco. Tudo que passa por
// aqui e nome de nota e texto — nunca um caminho.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ardosia', {
  pasta: () => ipcRenderer.invoke('ardosia:pasta'),
  escolherPasta: () => ipcRenderer.invoke('ardosia:escolher-pasta'),
  abrirPasta: () => ipcRenderer.invoke('ardosia:abrir-pasta'),
  listar: () => ipcRenderer.invoke('ardosia:listar'),
  escrever: (id, texto) => ipcRenderer.invoke('ardosia:escrever', id, texto),
  renomear: (de, para) => ipcRenderer.invoke('ardosia:renomear', de, para),
  apagar: (id) => ipcRenderer.invoke('ardosia:apagar', id),

  // Só o aviso atravessa: o objeto de evento do IPC fica deste lado da ponte.
  aoMudarPasta: (callback) => {
    const ouvinte = () => callback();
    ipcRenderer.on('ardosia:pasta-mudou', ouvinte);
    return () => ipcRenderer.off('ardosia:pasta-mudou', ouvinte);
  },
});
