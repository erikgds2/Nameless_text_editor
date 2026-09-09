// Decisoes sobre a janela e sobre o registro de erros, sem depender do
// Electron: e o que permite testa-las com o resto da bateria. O main.cjs
// fornece os dados (monitores, texto do log) e obedece ao que sai daqui.

const MINIMA = { largura: 760, altura: 480 };

/**
 * A posicao guardada ainda serve? Quem trabalha com dois monitores e desliga um
 * deles reabre o app numa area que nao existe mais — a janela nasce invisivel e
 * parece que o programa nao abriu. Basta uma parte razoavel dela cair dentro de
 * algum monitor para valer; senao, volta ao tamanho padrao, centralizada.
 */
function boundsVisiveis(bounds, monitores) {
  if (!bounds || typeof bounds !== 'object') return null;

  const { x, y, width, height } = bounds;
  if (![x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  if (width < MINIMA.largura || height < MINIMA.altura) return null;

  // uma faixa do alto da janela basta: e por ela que se arrasta a janela de
  // volta, e sem ela nao ha como resgatar o que ficou fora da tela
  const visivel = monitores.some((monitor) => {
    const area = monitor.workArea ?? monitor.bounds;
    if (!area) return false;
    const sobrepoeX = x + width - 80 > area.x && x + 80 < area.x + area.width;
    const sobrepoeY = y + 40 > area.y && y < area.y + area.height - 40;
    return sobrepoeX && sobrepoeY;
  });

  return visivel ? { x, y, width, height } : null;
}

/**
 * O registro de erros nao pode crescer sem fim numa pasta que nao e nossa. Fica
 * so o fim do arquivo: um erro de tres meses atras nao diagnostica nada, e o
 * que interessa e sempre o que acabou de acontecer.
 */
function cortarLog(texto, maximoDeLinhas = 500) {
  const linhas = texto.split('\n').filter((linha) => linha !== '');
  return linhas.slice(-maximoDeLinhas).join('\n') + (linhas.length > 0 ? '\n' : '');
}

/** Uma linha de log: quando, de onde veio e o que aconteceu, em uma linha so. */
function linhaDeErro(quando, origem, mensagem) {
  const limpa = String(mensagem).replace(/\s+/g, ' ').trim().slice(0, 500);
  return `${quando.toISOString()} [${origem}] ${limpa}`;
}

module.exports = { boundsVisiveis, cortarLog, linhaDeErro, MINIMA };
