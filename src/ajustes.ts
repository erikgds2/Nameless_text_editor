// Preferências do app. Ficam sempre no navegador/Electron local — não são
// conteúdo, então não viram arquivo na pasta de notas.
import type { TipoDoc } from './notes';

export type TemaId = 'acrilico' | 'carvao' | 'papel';

export type Ajustes = {
  tema: TemaId;
  tipoPadrao: TipoDoc;
  preview: boolean;
  corpo: 13 | 15 | 17;
  /** A cor de destaque, em #rrggbb. */
  acento: string;
  /** Quanto do fundo é sólido, de 0 (transparente) a 100 (opaco). */
  opacidade: number;
  /**
   * Acrílico é o vidro fosco do Windows: borra o que está atrás. Vidro é
   * transparência de verdade, como o Terminal com opacidade baixa. Só vale no
   * aplicativo instalado, e trocar reabre a janela.
   */
  fundo: 'acrilico' | 'vidro';
  /** Quanto da largura fica com o editor quando há pré-visualização, em %. */
  divisoria: number;
};

export const TEMAS: { id: TemaId; rotulo: string }[] = [
  { id: 'acrilico', rotulo: 'Acrílico' },
  { id: 'carvao', rotulo: 'Carvão' },
  { id: 'papel', rotulo: 'Papel' },
];

export const TAMANHOS: Ajustes['corpo'][] = [13, 15, 17];

// Cores de acento sem neon: a escolha é sua, mas nenhuma das oferecidas briga
// com o texto ao lado. O seletor livre aceita qualquer outra.
export const ACENTOS: { hex: string; rotulo: string }[] = [
  { hex: '#d8934a', rotulo: 'Ocre' },
  { hex: '#cf7455', rotulo: 'Terracota' },
  { hex: '#c9a227', rotulo: 'Âmbar' },
  { hex: '#7fa06a', rotulo: 'Sálvia' },
  { hex: '#6f9ac4', rotulo: 'Aço' },
  { hex: '#a781b8', rotulo: 'Ameixa' },
];

const HEX = /^#[0-9a-f]{6}$/i;

export const PADRAO: Ajustes = {
  tema: 'acrilico',
  tipoPadrao: 'markdown',
  preview: true,
  corpo: 15,
  acento: '#d8934a',
  // Quem abre pela primeira vez precisa enxergar. A janela nasce solida e a
  // transparencia vira escolha, nao heranca.
  opacidade: 100,
  fundo: 'acrilico',
  divisoria: 50,
};

const CHAVE = 'ardosia:ajustes:v2';
const CHAVE_V1 = 'ardosia:ajustes:v1';
const CHAVE_ANTIGA = 'editor-sem-nome:tema';

function ehTema(valor: unknown): valor is TemaId {
  return valor === 'acrilico' || valor === 'carvao' || valor === 'papel';
}

// O tema escuro opaco se chamava "tinta" antes da virada visual.
function migrarNome(valor: string): string {
  return valor === 'tinta' ? 'carvao' : valor;
}

/**
 * A v1 nascia com opacidade 0. Zero no acrilico e uma janela que quase nao se
 * enxerga, e quem tem zero guardado provavelmente nunca escolheu — era so o
 * padrao de fabrica passando adiante. Na migracao ele vira solido; o resto do
 * que a pessoa ajustou atravessa intacto.
 */
function migrarDaV1(guardado: Partial<Ajustes>): Ajustes {
  const ajustes = completar(guardado);
  return ajustes.opacidade === 0 ? { ...ajustes, opacidade: PADRAO.opacidade } : ajustes;
}

function lerObjeto(chave: string): Partial<Ajustes> | null {
  const bruto = localStorage.getItem(chave);
  if (!bruto) return null;
  const guardado: unknown = JSON.parse(bruto);
  return guardado && typeof guardado === 'object' ? (guardado as Partial<Ajustes>) : null;
}

export function carregarAjustes(): Ajustes {
  try {
    const atual = lerObjeto(CHAVE);
    if (atual) return completar(atual);

    const daV1 = lerObjeto(CHAVE_V1);
    if (daV1) return migrarDaV1(daV1);

    const temaAntigo = localStorage.getItem(CHAVE_ANTIGA);
    if (temaAntigo) return completar({ tema: migrarNome(temaAntigo) as TemaId });
  } catch (err) {
    console.error('Não foi possível ler os ajustes:', err);
  }
  return { ...PADRAO };
}

/** Um campo estragado não pode derrubar os outros: cada um cai no seu padrão. */
function completar(parcial: Partial<Ajustes>): Ajustes {
  return {
    tema: ehTema(parcial.tema) ? parcial.tema : PADRAO.tema,
    tipoPadrao: parcial.tipoPadrao === 'texto' ? 'texto' : PADRAO.tipoPadrao,
    preview: typeof parcial.preview === 'boolean' ? parcial.preview : PADRAO.preview,
    corpo: TAMANHOS.includes(parcial.corpo as Ajustes['corpo'])
      ? (parcial.corpo as Ajustes['corpo'])
      : PADRAO.corpo,
    acento: typeof parcial.acento === 'string' && HEX.test(parcial.acento)
      ? parcial.acento.toLowerCase()
      : PADRAO.acento,
    opacidade: typeof parcial.opacidade === 'number' && Number.isFinite(parcial.opacidade)
      ? Math.min(100, Math.max(0, Math.round(parcial.opacidade)))
      : PADRAO.opacidade,
    fundo: parcial.fundo === 'vidro' ? 'vidro' : PADRAO.fundo,
    // nem tudo para um lado: abaixo de 20% nao sobra onde escrever nem onde ler
    divisoria: typeof parcial.divisoria === 'number' && Number.isFinite(parcial.divisoria)
      ? Math.min(80, Math.max(20, Math.round(parcial.divisoria)))
      : PADRAO.divisoria,
  };
}

export function salvarAjustes(ajustes: Ajustes): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(ajustes));
  } catch (err) {
    console.error('Não foi possível salvar os ajustes:', err);
  }
}
