// O que pertence à janela, e não às notas.

export type ModoDeFundo = 'acrilico' | 'vidro';

/**
 * Fosco (o acrílico do Windows) ou transparente de verdade. Só o aplicativo
 * instalado tem uma janela para trocar; no navegador a janela é do navegador.
 */
export async function trocarModoDeFundo(modo: ModoDeFundo): Promise<void> {
  await window.ardosia?.trocarModoDeFundo(modo);
}

/**
 * Onde a janela realmente nasceu. O material do sistema e decidido na criacao
 * dela, entao o processo principal guarda essa escolha em disco e os ajustes
 * sao so a memoria dela. Quando os dois discordam — uma troca interrompida no
 * meio — quem manda e a janela, senao o CSS pinta para um modo que nao existe.
 */
export async function modoDeFundoDaJanela(): Promise<ModoDeFundo | null> {
  return (await window.ardosia?.modoDeFundo()) ?? null;
}

/**
 * O acrilico do Windows so e desenhado enquanto a janela esta ATIVA: perdeu o
 * foco, o sistema troca o material por um cinza chapado. Uma janela que conta
 * com ele para ser vista fica ilegivel nesse intervalo. Marcamos o foco no
 * documento para o CSS poder pintar o nosso proprio fundo enquanto isso dura.
 */
export function acompanharFoco(raiz: HTMLElement = document.documentElement): () => void {
  const marcar = (temFoco: boolean) => () => {
    raiz.dataset.foco = temFoco ? 'sim' : 'nao';
  };
  const ganhou = marcar(true);
  const perdeu = marcar(false);

  marcar(document.hasFocus())();
  window.addEventListener('focus', ganhou);
  window.addEventListener('blur', perdeu);
  return () => {
    window.removeEventListener('focus', ganhou);
    window.removeEventListener('blur', perdeu);
  };
}

export type EstadoDaAtualizacao = 'baixando' | 'pronta' | 'atual' | 'falhou';

export type Atualizacao = { estado: EstadoDaAtualizacao; versao?: string };

/**
 * O app instalado pergunta ao GitHub se há versão nova toda vez que abre e
 * baixa em segundo plano. Trocar a versão só acontece quando você mandar:
 * reiniciar sozinho no meio de uma nota escrita seria pior que ficar atrasado.
 */
export function aoAtualizar(callback: (dados: Atualizacao) => void): () => void {
  return window.ardosia?.aoAtualizar(callback) ?? (() => {});
}

export async function instalarAtualizacao(): Promise<void> {
  await window.ardosia?.instalarAtualizacao();
}

export async function versaoInstalada(): Promise<string | null> {
  return (await window.ardosia?.versao()) ?? null;
}
