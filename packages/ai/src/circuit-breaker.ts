import type { Redis } from "@repo/redis"
import type { ProviderId } from "./providers"

const FAILURE_WINDOW_SECONDS = 300
const FAILURE_THRESHOLD = 3

function failureKey(providerId: ProviderId): string {
  return `ai-provider-failures:${providerId}`
}

export async function recordProviderFailure(
  client: Redis,
  providerId: ProviderId
): Promise<void> {
  const key = failureKey(providerId)
  const count = await client.incr(key)

  if (count === 1) {
    await client.expire(key, FAILURE_WINDOW_SECONDS)
  }
}

export async function recordProviderSuccess(
  client: Redis,
  providerId: ProviderId
): Promise<void> {
  await client.del(failureKey(providerId))
}

export async function isProviderHealthy(
  client: Redis,
  providerId: ProviderId
): Promise<boolean> {
  const count = await client.get(failureKey(providerId))
  return Number(count ?? 0) < FAILURE_THRESHOLD
}
