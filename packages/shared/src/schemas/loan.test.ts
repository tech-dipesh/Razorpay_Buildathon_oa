import { describe, expect, it } from "vitest"
import { createLoanInputSchema, escalationConfigSchema } from "./loan"

describe("escalationConfigSchema", () => {
  it("rejects more than 6 max steps", () => {
    expect(
      escalationConfigSchema.safeParse({ maxSteps: 7, cooldownHours: 24 })
        .success
    ).toBe(false)
  })

  it("rejects zero or fewer max steps", () => {
    expect(
      escalationConfigSchema.safeParse({ maxSteps: 0, cooldownHours: 24 })
        .success
    ).toBe(false)
  })

  it("rejects a cooldown under 24 hours", () => {
    expect(
      escalationConfigSchema.safeParse({ maxSteps: 4, cooldownHours: 12 })
        .success
    ).toBe(false)
  })

  it("accepts values within bounds", () => {
    expect(
      escalationConfigSchema.safeParse({ maxSteps: 4, cooldownHours: 72 })
        .success
    ).toBe(true)
  })

  it("accepts the maximum allowed steps and no cooldown ceiling", () => {
    expect(
      escalationConfigSchema.safeParse({ maxSteps: 6, cooldownHours: 8760 })
        .success
    ).toBe(true)
  })
})

describe("createLoanInputSchema", () => {
  const baseInput = {
    borrowerEmail: "borrower@example.com",
    principalAmount: 25000,
    interestRate: 5,
    compoundingFrequency: "MONTHLY" as const,
    repaymentType: "LUMP_SUM" as const,
    tenureMonths: 6,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    maxSteps: 4,
    cooldownHours: 72
  }

  it("accepts a well-formed loan request", () => {
    expect(createLoanInputSchema.safeParse(baseInput).success).toBe(true)
  })

  it("rejects a negative principal amount", () => {
    expect(
      createLoanInputSchema.safeParse({ ...baseInput, principalAmount: -100 })
        .success
    ).toBe(false)
  })

  it("rejects an interest rate over 999.99", () => {
    expect(
      createLoanInputSchema.safeParse({ ...baseInput, interestRate: 1000 })
        .success
    ).toBe(false)
  })

  it("rejects a due date already in the past", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    expect(
      createLoanInputSchema.safeParse({ ...baseInput, dueDate: pastDate })
        .success
    ).toBe(false)
  })
})
