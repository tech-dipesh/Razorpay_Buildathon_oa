import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { verifyWebhookSignature } from "./razorpay"

const WEBHOOK_SECRET = "test-webhook-secret"

function signBody(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ event: "payment.captured" })
    const signature = signBody(body)

    expect(verifyWebhookSignature(body, signature)).toBe(true)
  })

  it("rejects a body signed with the wrong secret", () => {
    const body = JSON.stringify({ event: "payment.captured" })
    const wrongSignature = createHmac("sha256", "wrong-secret")
      .update(body)
      .digest("hex")

    expect(verifyWebhookSignature(body, wrongSignature)).toBe(false)
  })

  it("rejects a body that was altered after signing", () => {
    const originalBody = JSON.stringify({ event: "payment.captured" })
    const signature = signBody(originalBody)
    const alteredBody = JSON.stringify({ event: "payment.failed" })

    expect(verifyWebhookSignature(alteredBody, signature)).toBe(false)
  })

  it("rejects a malformed, non-hex signature without throwing", () => {
    const body = JSON.stringify({ event: "payment.captured" })

    expect(() => verifyWebhookSignature(body, "not-hex-at-all")).not.toThrow()
    expect(verifyWebhookSignature(body, "not-hex-at-all")).toBe(false)
  })
})
