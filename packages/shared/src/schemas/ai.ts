import { z } from "zod"

export const consensusActionTypeSchema = z.enum([
  "DECLARE_DEFAULT",
  "DEMAND_NOTICE"
])

export const triggerConsensusCheckInputSchema = z.object({
  loanId: z.string(),
  actionType: consensusActionTypeSchema
})
