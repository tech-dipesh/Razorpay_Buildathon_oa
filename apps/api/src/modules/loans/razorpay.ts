import { createHmac, timingSafeEqual } from "node:crypto"
import Razorpay from "razorpay"
import { env } from "../../env"

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET
})

export async function createRazorpayOrder(
  amountInRupees: number,
  receipt: string
): Promise<string> {
  const order = await razorpay.orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt
  })

  return order.id
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const expectedSignature = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex")

  const expectedBuffer = Buffer.from(expectedSignature, "hex")
  const actualBuffer = Buffer.from(signature, "hex")

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, actualBuffer)
}
