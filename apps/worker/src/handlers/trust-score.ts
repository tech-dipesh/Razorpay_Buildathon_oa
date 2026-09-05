import type { Job } from "bullmq"
import { database } from "@repo/database"
import type { TrustScoreJob } from "@repo/queue"
import { getRedisClient, invalidateCache } from "@repo/redis"
import { env } from "../env"
import { calculateTrustScore } from "./trust-score-calculation"

const redis = getRedisClient(env.REDIS_URL)

export async function handleTrustScoreRecalculation(
  job: Job<TrustScoreJob>
): Promise<void> {
  const { userId } = job.data

  const completedLoans = await database.loan.findMany({
    where: {
      borrowerId: userId,
      status: { in: ["REPAID", "DEFAULTED"] }
    }
  })

  const repaidCount = completedLoans.filter(
    (loan) => loan.status === "REPAID"
  ).length
  const defaultedCount = completedLoans.filter(
    (loan) => loan.status === "DEFAULTED"
  ).length
  const totalCompleted = completedLoans.length

  const disputeCount = await database.dispute.count({
    where: { loan: { borrowerId: userId } }
  })

  const finalScore = calculateTrustScore({
    repaidCount,
    defaultedCount,
    totalCompleted,
    disputeCount
  })

  await database.user.update({
    where: { id: userId },
    data: {
      trustScore: finalScore,
      trustScoreUpdatedAt: new Date()
    }
  })

  await invalidateCache(redis, `trust-score:${userId}`)
}
