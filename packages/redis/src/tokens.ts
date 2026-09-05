import type { Redis } from "ioredis"

export const EMAIL_VERIFICATION_TTL_SECONDS = 300
export const PASSWORD_RESET_TTL_SECONDS = 300

function temporaryTokenKey(prefix: string, token: string): string {
  return `${prefix}:${token}`
}

export async function issueTemporaryToken(
  client: Redis,
  prefix: string,
  token: string,
  userId: string,
  ttlSeconds: number
): Promise<void> {
  await client.set(temporaryTokenKey(prefix, token), userId, "EX", ttlSeconds)
}

export async function consumeTemporaryToken(
  client: Redis,
  prefix: string,
  token: string
): Promise<string | null> {
  const key = temporaryTokenKey(prefix, token)
  const userId = await client.get(key)

  if (userId) {
    await client.del(key)
  }

  return userId
}
