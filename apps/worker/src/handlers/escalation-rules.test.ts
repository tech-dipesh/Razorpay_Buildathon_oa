import { describe, expect, it } from "vitest"
import {
  buildFallbackReminderMessage,
  hasReachedMaxSteps,
  isCooldownElapsed,
  selectReminderLanguage
} from "./escalation-rules"

describe("hasReachedMaxSteps", () => {
  it("is false while under the limit", () => {
    expect(hasReachedMaxSteps(2, 4)).toBe(false)
  })

  it("is true once the current step reaches the max", () => {
    expect(hasReachedMaxSteps(4, 4)).toBe(true)
  })

  it("is true if somehow past the max", () => {
    expect(hasReachedMaxSteps(5, 4)).toBe(true)
  })
})

describe("isCooldownElapsed", () => {
  const now = new Date("2026-01-10T12:00:00Z")

  it("is true when nothing has been sent yet", () => {
    expect(isCooldownElapsed(null, 72, now)).toBe(true)
  })

  it("is false when the cooldown window hasn't passed", () => {
    const lastSentAt = new Date("2026-01-10T11:00:00Z")

    expect(isCooldownElapsed(lastSentAt, 72, now)).toBe(false)
  })

  it("is true exactly at the cooldown boundary", () => {
    const lastSentAt = new Date(now.getTime() - 72 * 60 * 60 * 1000)

    expect(isCooldownElapsed(lastSentAt, 72, now)).toBe(true)
  })

  it("is true once the cooldown window has passed", () => {
    const lastSentAt = new Date("2025-12-01T12:00:00Z")

    expect(isCooldownElapsed(lastSentAt, 72, now)).toBe(true)
  })
})

describe("selectReminderLanguage", () => {
  it("picks Hinglish when a relationship is given", () => {
    expect(selectReminderLanguage("cousin")).toBe("hi-en")
  })

  it("picks plain English when no relationship is given", () => {
    expect(selectReminderLanguage(null)).toBe("en")
  })
})

describe("buildFallbackReminderMessage", () => {
  it("includes the principal amount in the message", () => {
    expect(buildFallbackReminderMessage(25000)).toContain("25000")
  })
})
