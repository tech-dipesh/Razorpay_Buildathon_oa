import { describe, expect, it } from "vitest"
import { calculateTrustScore } from "./trust-score-calculation"

describe("calculateTrustScore", () => {
  it("gives a new borrower with no history a neutral score of 50", () => {
    const score = calculateTrustScore({
      repaidCount: 0,
      defaultedCount: 0,
      totalCompleted: 0,
      disputeCount: 0
    })

    expect(score).toBe(50)
  })

  it("caps a perfect repayment record at the 99.99 ceiling, not 100", () => {
    const score = calculateTrustScore({
      repaidCount: 5,
      defaultedCount: 0,
      totalCompleted: 5,
      disputeCount: 0
    })

    expect(score).toBe(99.99)
  })

  it("applies a 15 point penalty per default", () => {
    const withoutDefault = calculateTrustScore({
      repaidCount: 4,
      defaultedCount: 0,
      totalCompleted: 4,
      disputeCount: 0
    })
    const withOneDefault = calculateTrustScore({
      repaidCount: 4,
      defaultedCount: 1,
      totalCompleted: 5,
      disputeCount: 0
    })

    expect(withoutDefault - withOneDefault).toBeCloseTo(15 + 20, 1)
  })

  it("applies a 5 point penalty per dispute", () => {
    const score = calculateTrustScore({
      repaidCount: 4,
      defaultedCount: 0,
      totalCompleted: 4,
      disputeCount: 2
    })

    expect(score).toBe(90)
  })

  it("never goes below 0, even with heavy penalties", () => {
    const score = calculateTrustScore({
      repaidCount: 0,
      defaultedCount: 10,
      totalCompleted: 10,
      disputeCount: 20
    })

    expect(score).toBe(0)
  })

  it("never exceeds the 99.99 ceiling", () => {
    const score = calculateTrustScore({
      repaidCount: 100,
      defaultedCount: 0,
      totalCompleted: 100,
      disputeCount: 0
    })

    expect(score).toBeLessThanOrEqual(99.99)
  })
})
