import { Redis } from "ioredis"

let sharedClient: Redis | undefined

export function getRedisClient(url: string): Redis {
  if (!sharedClient) {
    sharedClient = new Redis(url, {
      maxRetriesPerRequest: null
    })
  }

  return sharedClient
}

export type { Redis }
export * from "./cache"
export * from "./session"
export * from "./tokens"
export * from "./rate-limit"
