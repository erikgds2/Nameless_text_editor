// Preferências do app. Ficam sempre no navegador/Electron local — não são
// conteúdo, então não viram arquivo na pasta de notas.
import type { TipoDoc } from './notes';

export type TemaId = 'acrilico' | 'carvao' | 'papel';

export type Ajustes = {
  tema: TemaId;
  tipoPadrao: TipoDoc;
  preview: boolean;
  corpo: 13 | 15 | 17;
};

export const TEMAS: { id: TemaId; rotulo: string }[] = [
  { id: 'acrilico', rotulo: 'Acrílico' },
  { id: 'carvao', rotulo: 'Carvão' },
  { id: 'papel', rotulo: 'Papel' },
];

export const TAMANHOS: Ajustes['corpo'][] = [13, 15, 17];

export const PADRAO: Ajustes = {
  tema: 'acrilico',
  tipoPadrao: 'markdown',
  preview: true,
  corpo: 15,
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
  };
}

export function salvarAjustes(ajustes: Ajustes): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(ajustes));
  } catch (err) {
    console.error('Não foi possível salvar os ajustes:', err);
  }
}
