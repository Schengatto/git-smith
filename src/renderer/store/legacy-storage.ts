/**
 * Read a localStorage value, falling back to the key used before the
 * GitSmith -> GitPress rename. A legacy value is copied to the new key so
 * existing users keep their settings.
 */
export function getItemWithLegacy(key: string, legacyKey: string): string | null {
  const current = localStorage.getItem(key);
  if (current !== null) return current;
  const legacy = localStorage.getItem(legacyKey);
  if (legacy !== null) localStorage.setItem(key, legacy);
  return legacy;
}
