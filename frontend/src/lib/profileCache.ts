// In-memory snapshots of visited profiles, keyed by username. Same rationale
// as lib/feedCache.ts: module state survives client-side navigation but not a
// hard reload. A profile renders instantly from its snapshot while a
// background refetch brings it up to date — switching feed ↔ profile should
// feel immediate, not wait three network round-trips behind a skeleton.
interface ProfileCacheEntry<P, T, C> {
  profile: P;
  posts: T[];
  clubs: C[];
  savedAt: number;
}

const MAX_AGE_MS = 10 * 60 * 1000;

const cache = new Map<string, ProfileCacheEntry<unknown, unknown, unknown>>();

export function saveProfileCache<P, T, C>(
  username: string,
  entry: Omit<ProfileCacheEntry<P, T, C>, "savedAt">
): void {
  cache.set(username, { ...entry, savedAt: Date.now() });
}

export function getProfileCache<P, T, C>(username: string): ProfileCacheEntry<P, T, C> | null {
  const entry = cache.get(username);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > MAX_AGE_MS) {
    cache.delete(username);
    return null;
  }
  return entry as ProfileCacheEntry<P, T, C>;
}

// After a mutation the snapshot no longer reflects reality (profile edit,
// avatar change) — drop it so the next visit fetches fresh.
export function clearProfileCache(username: string): void {
  cache.delete(username);
}

export function clearProfileCaches(): void {
  cache.clear();
}
