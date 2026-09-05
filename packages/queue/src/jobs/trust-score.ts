import { z } from "zod"

export const trustScoreJobSchema = z.object({
  userId: z.string()
})

export type TrustScoreJob = z.infer<typeof trustScoreJobSchema>
