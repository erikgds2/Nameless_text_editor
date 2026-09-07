export type TemaId = 'acrilico' | 'papel' | 'tinta';

export const TEMAS: { id: TemaId; rotulo: string }[] = [
  { id: 'acrilico', rotulo: 'Acrilico' },
  { id: 'papel', rotulo: 'Papel' },
  { id: 'tinta', rotulo: 'Tinta' },
];

export function carregarTema(): TemaId {
  try {
    const tema = localStorage.getItem('editor-sem-nome:tema') as TemaId;
    if (tema === 'acrilico' || tema === 'papel' || tema === 'tinta') {
      return tema;
    }
  } catch (error) {
    console.error('Erro ao carregar tema do localStorage:', error);
  }
  return 'acrilico';
}

export function salvarTema(tema: TemaId): void {
  try {
    localStorage.setItem('editor-sem-nome:tema', tema);
  } catch (error) {
    console.error('Erro ao salvar tema no localStorage:', error);
  }
}
