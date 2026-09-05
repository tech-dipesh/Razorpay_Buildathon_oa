import type { Redis } from "ioredis"

function sessionKey(tokenHash: string): string {
  return `session:${tokenHash}`
}

export async function cacheSession(
  client: Redis,
  tokenHash: string,
  userId: string,
  ttlSeconds: number
): Promise<void> {
  await client.set(sessionKey(tokenHash), userId, "EX", ttlSeconds)
}

export async function readSession(client: Redis, tokenHash: string): Promise<string | null> {
  return client.get(sessionKey(tokenHash))
}

export async function revokeSession(client: Redis, tokenHash: string): Promise<void> {
  await client.del(sessionKey(tokenHash))
}
