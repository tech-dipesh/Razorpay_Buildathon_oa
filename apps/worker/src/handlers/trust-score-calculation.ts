const DEFAULT_PENALTY = 15
const DISPUTE_PENALTY = 5
const NEUTRAL_SCORE = 50
const MAX_SCORE = 99.99
const MIN_SCORE = 0

export type TrustScoreInputs = {
  repaidCount: number
  defaultedCount: number
  totalCompleted: number
  disputeCount: number
}

export function calculateTrustScore(inputs: TrustScoreInputs): number {
  const baseScore =
    inputs.totalCompleted > 0
      ? (inputs.repaidCount / inputs.totalCompleted) * 100
      : NEUTRAL_SCORE

  const penalized =
    baseScore -
    inputs.defaultedCount * DEFAULT_PENALTY -
    inputs.disputeCount * DISPUTE_PENALTY

  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, penalized))
}
