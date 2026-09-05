import { describe, expect, it } from "vitest"
import { signAccessToken, verifyAccessToken } from "./jwt"

const secret = "test-secret-at-least-32-characters-long"

describe("signAccessToken / verifyAccessToken", () => {
  it("round-trips the payload correctly", async () => {
    const token = await signAccessToken(
      { userId: "user_123", role: "USER" },
      secret,
      10
    )
    const payload = await verifyAccessToken(token, secret)

    expect(payload).toEqual({ userId: "user_123", role: "USER" })
  })

  it("rejects a token signed with a different secret", async () => {
    const token = await signAccessToken(
      { userId: "user_123", role: "USER" },
      secret,
      10
    )

    await expect(
      verifyAccessToken(token, "a-completely-different-secret-value")
    ).rejects.toThrow()
  })

  it("rejects a tampered token", async () => {
    const token = await signAccessToken(
      { userId: "user_123", role: "USER" },
      secret,
      10
    )
    const tampered = `${token.slice(0, -4)}abcd`

    await expect(verifyAccessToken(tampered, secret)).rejects.toThrow()
  })
})
