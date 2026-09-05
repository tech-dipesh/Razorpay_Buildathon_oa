import { generateObject, type LanguageModel } from "ai"
import { z } from "zod"
import type { Redis } from "@repo/redis"
import { isProviderHealthy, recordProviderFailure, recordProviderSuccess } from "./circuit-breaker"
import type { ProviderId } from "./providers"

const consensusResponseSchema = z.object({
  decision: z.boolean(),
  reasoning: z.string()
})

type ConsensusResponse = z.infer<typeof consensusResponseSchema>

type ConsensusResult = {
  agreementReached: boolean
  requiresHumanReview: boolean
  responses: Array<{ providerId: ProviderId; response: ConsensusResponse }>
}

export async function runConsensusCheck(
  redis: Redis,
  registry: Partial<Record<ProviderId, LanguageModel>>,
  prompt: string
): Promise<ConsensusResult> {
  const candidateProviders = Object.keys(registry) as ProviderId[]
  const healthyProviders: ProviderId[] = []

  for (const providerId of candidateProviders) {
    if (await isProviderHealthy(redis, providerId)) {
      healthyProviders.push(providerId)
    }
  }

  const chosenProviders = healthyProviders.slice(0, 2)

  if (chosenProviders.length < 2) {
    return { agreementReached: false, requiresHumanReview: true, responses: [] }
  }

  const responses: Array<{ providerId: ProviderId; response: ConsensusResponse }> = []

  for (const providerId of chosenProviders) {
    const model = registry[providerId]

    if (!model) {
      continue
    }

    try {
      const result = await generateObject({
        model,
        schema: consensusResponseSchema,
        prompt
      })

      await recordProviderSuccess(redis, providerId)
      responses.push({ providerId, response: result.object })
    } catch {
      await recordProviderFailure(redis, providerId)
    }
  }

  if (responses.length < 2) {
    return { agreementReached: false, requiresHumanReview: true, responses }
  }

  const [first, second] = responses

  if (!first || !second) {
    return { agreementReached: false, requiresHumanReview: true, responses }
  }

  const agreementReached = first.response.decision === second.response.decision

  return {
    agreementReached,
    requiresHumanReview: !agreementReached,
    responses
  }
}
