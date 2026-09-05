import { describe, expect, it } from "vitest"
import { computeContentHash } from "./pdf"

describe("computeContentHash", () => {
  it("is deterministic for the same content", () => {
    const content = "This loan is for ₹25,000, due in 6 months."

    expect(computeContentHash(content)).toBe(computeContentHash(content))
  })

  it("changes when the content changes by even one character", () => {
    const original = "This loan is for ₹25,000, due in 6 months."
    const altered = "This loan is for ₹25,001, due in 6 months."

    expect(computeContentHash(original)).not.toBe(computeContentHash(altered))
  })

  it("produces a 64-character hex string (SHA-256)", () => {
    const hash = computeContentHash("any content")

    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})
