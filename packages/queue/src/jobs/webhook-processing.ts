import { z } from "zod"

export const webhookProcessingJobSchema = z.object({
  webhookEventId: z.string()
})

export type WebhookProcessingJob = z.infer<typeof webhookProcessingJobSchema>
