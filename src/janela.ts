// O que pertence à janela, e não às notas.

export type ModoDeFundo = 'acrilico' | 'vidro';

/**
 * Fosco (o acrílico do Windows) ou transparente de verdade. Só o aplicativo
 * instalado tem uma janela para trocar; no navegador a janela é do navegador.
 */
export async function trocarModoDeFundo(modo: ModoDeFundo): Promise<void> {
  await window.ardosia?.trocarModoDeFundo(modo);
}
