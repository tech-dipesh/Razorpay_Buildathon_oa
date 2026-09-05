import type { Redis } from "ioredis"

export async function getOrSetCache<T>(
  client: Redis,
  key: string,
  ttlSeconds: number,
  loadFresh: () => Promise<T>
): Promise<T> {
  const cached = await client.get(key)

  if (cached) {
    return JSON.parse(cached) as T
  }

  const fresh = await loadFresh()
  await client.set(key, JSON.stringify(fresh), "EX", ttlSeconds)

  return fresh
}

export async function invalidateCache(client: Redis, key: string): Promise<void> {
  await client.del(key)
}
