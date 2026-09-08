// O que pertence à janela, e não às notas.

export type ModoDeFundo = 'acrilico' | 'vidro';

/**
 * Fosco (o acrílico do Windows) ou transparente de verdade. Só o aplicativo
 * instalado tem uma janela para trocar; no navegador a janela é do navegador.
 */
export async function trocarModoDeFundo(modo: ModoDeFundo): Promise<void> {
  await window.ardosia?.trocarModoDeFundo(modo);
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
