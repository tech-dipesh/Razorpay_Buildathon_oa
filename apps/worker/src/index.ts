import { Worker } from "bullmq"
import { QUEUE_NAMES } from "@repo/queue"
import { database } from "@repo/database"
import { getRedisClient } from "@repo/redis"
import { env } from "./env"
import { handleEscalationCheck } from "./handlers/escalation"
import { handleTrustScoreRecalculation } from "./handlers/trust-score"
import { handleWebhookProcessing } from "./handlers/webhook-processing"

const connection = getRedisClient(env.REDIS_URL)

const escalationWorker = new Worker(
  QUEUE_NAMES.escalation,
  handleEscalationCheck,
  { connection, concurrency: 1 }
)

const trustScoreWorker = new Worker(
  QUEUE_NAMES.trustScore,
  handleTrustScoreRecalculation,
  { connection, concurrency: 10 }
)

const webhookProcessingWorker = new Worker(
  QUEUE_NAMES.webhookProcessing,
  handleWebhookProcessing,
  { connection, concurrency: 10 }
)

for (const worker of [escalationWorker, trustScoreWorker, webhookProcessingWorker]) {
  worker.on("failed", (job, error) => {
    console.error(`job ${job?.id} failed on queue ${worker.name}`, error)
  })
}

webhookProcessingWorker.on("failed", async (job, error) => {
  const attemptsExhausted =
    job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1)

  if (!attemptsExhausted || job === undefined) {
    return
  }

  const webhookEventId: unknown = job.data?.webhookEventId

  if (typeof webhookEventId !== "string") {
    return
  }

  await database.webhookEvent
    .update({
      where: { id: webhookEventId },
      data: { status: "FAILED" }
    })
    .catch((updateError: unknown) => {
      console.error(
        `failed to mark webhook event ${webhookEventId} as permanently failed`,
        updateError
      )
    })

  console.error(
    `webhook event ${webhookEventId} permanently failed after all retry attempts`,
    error
  )
})

console.log("worker process started, listening on all three queues")
