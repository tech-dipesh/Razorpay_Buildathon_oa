import { ORPCError } from "@orpc/server"
import { database } from "@repo/database"
import { getOrSetCache, getRedisClient } from "@repo/redis"
import { z } from "zod"
import { env } from "../../env"
import { authedProcedure } from "../auth/procedures"

const redis = getRedisClient(env.REDIS_URL)

const TRUST_SCORE_CACHE_TTL_SECONDS = 300

const getMe = authedProcedure
  .route({ method: "GET", path: "/users/me" })
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.enum(["USER", "ADMIN"]),
      trustScore: z.string().nullable()
    })
  )
  .handler(async ({ context }) => {
    const user = await database.user.findUnique({
      where: { id: context.userId }
    })

    if (!user) {
      throw new ORPCError("NOT_FOUND")
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      trustScore: user.trustScore?.toString() ?? null
    }
  })

const userIdParamSchema = z.object({
  userId: z.string()
})

async function loadTrustScoreFromDatabase(
  userId: string
): Promise<string | null> {
  const user = await database.user.findUnique({ where: { id: userId } })
  return user?.trustScore?.toString() ?? null
}

const getTrustScore = authedProcedure
  .route({ method: "GET", path: "/users/{userId}/trust-score" })
  .input(userIdParamSchema)
  .output(z.object({ trustScore: z.string().nullable() }))
  .handler(async ({ input }) => {
    const trustScore = await getOrSetCache(
      redis,
      `trust-score:${input.userId}`,
      TRUST_SCORE_CACHE_TTL_SECONDS,
      () => loadTrustScoreFromDatabase(input.userId)
    )

    return { trustScore }
  })

export const usersRouter = {
  getMe,
  getTrustScore
}
