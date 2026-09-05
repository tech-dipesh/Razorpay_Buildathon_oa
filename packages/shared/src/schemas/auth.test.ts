import { describe, expect, it } from "vitest"
import { emailSchema, passwordSchema, signupInputSchema } from "./auth"

describe("passwordSchema", () => {
  it("rejects passwords under 10 characters", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false)
  })

  it("rejects passwords with no number", () => {
    expect(passwordSchema.safeParse("noNumbersHere").success).toBe(false)
  })

  it("accepts a password meeting both rules", () => {
    expect(passwordSchema.safeParse("longEnough1").success).toBe(true)
  })
})

describe("emailSchema", () => {
  it("rejects a malformed email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false)
  })

  it("accepts a valid email", () => {
    expect(emailSchema.safeParse("person@example.com").success).toBe(true)
  })
})

describe("signupInputSchema", () => {
  it("requires name, email, and password but not phone", () => {
    const result = signupInputSchema.safeParse({
      name: "Priya Sharma",
      email: "priya@example.com",
      password: "longEnough1"
    })

    expect(result.success).toBe(true)
  })

  it("rejects a missing name", () => {
    const result = signupInputSchema.safeParse({
      email: "priya@example.com",
      password: "longEnough1"
    })

    expect(result.success).toBe(false)
  })
})
