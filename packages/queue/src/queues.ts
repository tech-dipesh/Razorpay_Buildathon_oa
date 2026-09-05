import { Queue } from "bullmq"
import type { Redis } from "@repo/redis"
import { QUEUE_NAMES } from "./names"
import { type EscalationJob, escalationJobSchema } from "./jobs/escalation"
import { type TrustScoreJob, trustScoreJobSchema } from "./jobs/trust-score"
import {
  type WebhookProcessingJob,
  webhookProcessingJobSchema
} from "./jobs/webhook-processing"

const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 5000
  }
}

export function createQueues(connection: Redis) {
  const escalationQueue = new Queue<EscalationJob>(QUEUE_NAMES.escalation, {
    connection,
    defaultJobOptions
  })

  const trustScoreQueue = new Queue<TrustScoreJob>(QUEUE_NAMES.trustScore, {
    connection,
    defaultJobOptions
  })

  const webhookProcessingQueue = new Queue<WebhookProcessingJob>(
    QUEUE_NAMES.webhookProcessing,
    { connection, defaultJobOptions }
  )

  return {
    enqueueEscalationCheck: (payload: EscalationJob) =>
      escalationQueue.add("check", escalationJobSchema.parse(payload)),

    enqueueTrustScoreRecalculation: (payload: TrustScoreJob) =>
      trustScoreQueue.add("recalculate", trustScoreJobSchema.parse(payload)),

    enqueueWebhookProcessing: (payload: WebhookProcessingJob) =>
      webhookProcessingQueue.add(
        "process",
        webhookProcessingJobSchema.parse(payload)
      )
  }
}
