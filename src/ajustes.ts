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
  /** Quanto do fundo é sólido, de 0 (só o acrílico) a 100 (opaco). */
  opacidade: number;
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
  opacidade: 0,
  divisoria: 50,
};

const CHAVE = 'ardosia:ajustes:v1';
const CHAVE_ANTIGA = 'editor-sem-nome:tema';

function ehTema(valor: unknown): valor is TemaId {
  return valor === 'acrilico' || valor === 'carvao' || valor === 'papel';
}

// O tema escuro opaco se chamava "tinta" antes da virada visual.
function migrarNome(valor: string): string {
  return valor === 'tinta' ? 'carvao' : valor;
}

export function carregarAjustes(): Ajustes {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const guardado: unknown = JSON.parse(bruto);
      if (guardado && typeof guardado === 'object') return completar(guardado as Partial<Ajustes>);
    }

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
