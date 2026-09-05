import type { Redis } from "ioredis"

export async function checkRateLimit(
  client: Redis,
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const count = await client.incr(key)

  if (count === 1) {
    await client.expire(key, windowSeconds)
  }

  return count <= maxRequests
}
