export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function matchesQuery(text: string, query: string): boolean {
  if (query.trim() === '') return true;

  const normalizedText = normalize(text);
  const normalizedQuery = normalize(query);
  const terms = normalizedQuery.split(/\s+/);

  return terms.every((term) => normalizedText.includes(term));
}
