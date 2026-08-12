export function normalizePlayerName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').slice(0, 32);
}
