export function formatTableName(name: string | number | undefined | null): string {
  if (!name && name !== 0) return "";
  const trimmed = name.toString().trim();
  if (/^mesa\b/i.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return `Mesa ${trimmed}`;
}
