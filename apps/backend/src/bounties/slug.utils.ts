/**
 * Generate a URL-friendly slug from a title string.
 * - Lowercases, replaces spaces with hyphens, removes non-alphanumeric chars
 * - Truncates to 70 chars to leave room for the 6-char suffix
 * - Appends a 6-char random suffix for uniqueness
 */
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);

  const suffix = randomSuffix(6);
  return `${base}-${suffix}`;
}

function randomSuffix(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}