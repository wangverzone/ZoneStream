export interface CachedBanEntry {
  role: 'member' | 'founder';
  isBanned: boolean;
  banReason: string;
  checkedAt: number;
}

const banCache = new Map<string, CachedBanEntry>();

export function getCachedBanEntry(uid: string, maxAgeMs = 4000): CachedBanEntry | null {
  const entry = banCache.get(uid);
  if (!entry) return null;
  if (Date.now() - entry.checkedAt > maxAgeMs) {
    return null;
  }
  return entry;
}

export function setCachedBanEntry(
  uid: string,
  entry: { role: 'member' | 'founder'; isBanned: boolean; banReason?: string }
): void {
  if (!uid) return;
  banCache.set(uid, {
    role: entry.role,
    isBanned: Boolean(entry.isBanned && entry.role !== 'founder'),
    banReason: String(entry.banReason || ''),
    checkedAt: Date.now(),
  });
}

export function clearBanCache(): void {
  banCache.clear();
}
