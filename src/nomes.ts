const RESERVADOS = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

const DIACRITICOS = /[\u0300-\u036f]/g;

export function slugDeTitulo(titulo: string): string {
  let slug = titulo
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length > 60) slug = slug.slice(0, 60).replace(/-+$/g, '');
  if (!slug) slug = 'nota';
  if (RESERVADOS.has(slug)) slug = `${slug}-nota`;

  return slug;
}

export function nomeDisponivel(base: string, existentes: string[], atual?: string): string {
  const baseMin = base.toLowerCase();
  if (atual !== undefined && baseMin === atual.toLowerCase()) return base;

  const ocupados = new Set(existentes.map((nome) => nome.toLowerCase()));
  if (!ocupados.has(baseMin)) return base;

  let n = 2;
  while (ocupados.has(`${baseMin}-${n}`)) n++;
  return `${base}-${n}`;
}
