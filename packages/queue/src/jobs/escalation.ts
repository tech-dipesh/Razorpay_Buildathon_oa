import { z } from "zod"

export const escalationJobSchema = z.object({
  loanId: z.string()
})

export type EscalationJob = z.infer<typeof escalationJobSchema>
