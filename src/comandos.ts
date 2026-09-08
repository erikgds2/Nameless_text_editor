// A paleta de comandos: tudo que o app faz, alcançável por teclado.
import { normalize } from './search';

export type Comando = {
  id: string;
  titulo: string;
  secao: string;
  atalho?: string;
  executar: () => void;
};

// Quanto melhor o casamento, maior o número. Zero é "não casa".
const COMECA = 3;
const CONTEM = 2;
const ESPALHADO = 1;

/**
 * Casa por subsequência, não só por pedaço contínuo: "nn" acha "Nova nota" e
 * "trtm" acha "Trocar tema". É o que permite chegar a qualquer comando com duas
 * ou três teclas, que é a razão de existir a paleta.
 */
function pontuar(texto: string, consulta: string): number {
  if (texto.startsWith(consulta)) return COMECA;
  if (texto.includes(consulta)) return CONTEM;

  let posicao = 0;
  for (const letra of consulta) {
    posicao = texto.indexOf(letra, posicao);
    if (posicao === -1) return 0;
    posicao += 1;
  }
  return ESPALHADO;
}

export function filtrar(comandos: Comando[], consulta: string): Comando[] {
  const alvo = normalize(consulta.trim());
  if (!alvo) return [...comandos];

  return [...comandos]
    .map((comando, ordem) => {
      const titulo = pontuar(normalize(comando.titulo), alvo);
      const secao = pontuar(normalize(comando.secao), alvo);
      // Qualquer casamento no título vale mais que o melhor casamento na seção:
      // quem digita "nota" quer o comando chamado nota, não todo o grupo dela.
      return { comando, ordem, ponto: titulo > 0 ? titulo * 10 : secao };
    })
    .filter((item) => item.ponto > 0)
    // empate mantém a ordem em que os comandos foram registrados: a lista não
    // pode dançar embaixo do dedo de quem está digitando
    .sort((a, b) => b.ponto - a.ponto || a.ordem - b.ordem)
    .map((item) => item.comando);
}
