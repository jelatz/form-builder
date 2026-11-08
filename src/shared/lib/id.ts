export function generateId(prefix = 'field'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
