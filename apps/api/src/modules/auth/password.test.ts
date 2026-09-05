import { describe, expect, it } from "vitest"
import { hashPassword, verifyPassword } from "./password"

describe("hashPassword / verifyPassword", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correctHorseBattery1")
    const result = await verifyPassword(hash, "correctHorseBattery1")

    expect(result).toBe(true)
  })

  it("rejects the wrong password against a real hash", async () => {
    const hash = await hashPassword("correctHorseBattery1")
    const result = await verifyPassword(hash, "wrongPassword1")

    expect(result).toBe(false)
  })

  it("produces a different hash each time, even for the same password", async () => {
    const hashOne = await hashPassword("samePassword1")
    const hashTwo = await hashPassword("samePassword1")

    expect(hashOne).not.toBe(hashTwo)
  })
})
