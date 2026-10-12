export class QueryError extends Error {}
export function parseQuery(search: URLSearchParams) {
  const integer = (name: string, fallback: number, max: number, min: number) => {
    const value = search.get(name);
    if (value === null) return fallback;
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new QueryError(`Invalid ${name}`);
    return Number(value);
  };
  const reserved = new Set(['apikey', 'key', 'limit', 'offset', 'select', 'order']);
  const operators = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is']);
  const filters = [...search.entries()].filter(([key]) => !reserved.has(key)).map(([column, raw]) => {
    const dot = raw.indexOf('.');
    const candidate = dot < 0 ? '' : raw.slice(0, dot);
    const op = operators.has(candidate) ? candidate : 'eq';
    return { column, op, value: operators.has(candidate) ? raw.slice(dot + 1).replace(/^not\.null$/, 'notnull') : raw };
  });
  const order = search.has('order') ? search.get('order')!.split(',').map(part => {
    const [column, direction = 'asc', extra] = part.split('.');
    if (!column || extra || !['asc', 'desc'].includes(direction)) throw new QueryError('Invalid order');
    return { column, direction };
  }) : [];
  const select = search.has('select') && search.get('select') !== '*' ? search.get('select')!.split(',').map(c => c.trim()) : null;
  if (filters.length > 20 || order.length > 5 || select?.some(c => !c)) throw new QueryError('Invalid query');
  return { p_filters: filters, p_order: order, p_select: select, p_limit: integer('limit', 50, 200, 1), p_offset: integer('offset', 0, 1000000, 0) };
}
export async function hashKey(key: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
