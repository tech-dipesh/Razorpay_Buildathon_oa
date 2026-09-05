import { ORPCError } from "@orpc/server"
import {
  createProviderRegistry,
  isProviderHealthy,
  PROVIDER_IDS,
  runConsensusCheck
} from "@repo/ai"
import { database } from "@repo/database"
import { getRedisClient } from "@repo/redis"
import {
  consensusActionTypeSchema,
  triggerConsensusCheckInputSchema
} from "@repo/shared"
import { z } from "zod"
import { env } from "../../env"
import { authedProcedure } from "../auth/procedures"
import { loadLoanForLender } from "../loans/authorization"

const redis = getRedisClient(env.REDIS_URL)

const registry = createProviderRegistry({
  claude: env.ANTHROPIC_API_KEY,
  openai: env.OPENAI_API_KEY,
  gemini: env.GOOGLE_API_KEY,
  grok: env.XAI_API_KEY,
  kimi: env.KIMI_API_KEY
})

const listProviders = authedProcedure
  .route({ method: "GET", path: "/ai/providers" })
  .output(
    z.array(
      z.object({
        providerId: z.string(),
        available: z.boolean(),
        healthy: z.boolean()
      })
    )
  )
  .handler(async () => {
    const results = []

    for (const providerId of PROVIDER_IDS) {
      const available = registry[providerId] !== undefined
      const healthy = available
        ? await isProviderHealthy(redis, providerId)
        : false

      results.push({ providerId, available, healthy })
    }

    return results
  })

function buildConsensusPrompt(
  actionType: z.infer<typeof consensusActionTypeSchema>,
  loan: { principalAmount: unknown; dueDate: Date; status: string }
): string {
  const daysPastDue = Math.floor(
    (Date.now() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const context = `A personal loan of principal amount ${String(loan.principalAmount)} was due on ${loan.dueDate.toISOString()}, which is ${daysPastDue} days ago. The loan is currently ${loan.status}.`

  if (actionType === "DECLARE_DEFAULT") {
    return `${context} Should this loan be formally declared in default? Respond with a boolean decision and your reasoning.`
  }

  return `${context} Should a formal demand notice be sent to the borrower now? Respond with a boolean decision and your reasoning.`
}

const triggerConsensusCheck = authedProcedure
  .route({ method: "POST", path: "/loans/{loanId}/consensus-check" })
  .input(triggerConsensusCheckInputSchema)
  .output(
    z.object({
      consensusCheckId: z.string(),
      agreementReached: z.boolean(),
      requiresHumanReview: z.boolean()
    })
  )
  .handler(async ({ input, context }) => {
    const loan = await loadLoanForLender(input.loanId, context.userId)

    if (loan.status !== "ACTIVE" && loan.status !== "OVERDUE") {
      throw new ORPCError("CONFLICT", {
        message: "Consensus checks only apply to active or overdue loans"
      })
    }

    const prompt = buildConsensusPrompt(input.actionType, loan)
    const result = await runConsensusCheck(redis, registry, prompt)

    const reasoning =
      result.responses
        .map((entry) => `${entry.providerId}: ${entry.response.reasoning}`)
        .join(" | ") ||
      "Not enough healthy providers available to reach consensus"

    const consensusCheck = await database.consensusCheck.create({
      data: {
        loanId: loan.id,
        actionType: input.actionType,
        providerResponses: result.responses as unknown as object,
        agreementReached: result.agreementReached,
        requiresHumanReview: result.requiresHumanReview,
        reasoning,
        traceId: context.requestId
      }
    })

    return {
      consensusCheckId: consensusCheck.id,
      agreementReached: result.agreementReached,
      requiresHumanReview: result.requiresHumanReview
    }
  })

export const aiRouter = {
  listProviders,
  triggerConsensusCheck
}
