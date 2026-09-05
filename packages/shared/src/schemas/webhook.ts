import { z } from "zod"

export const razorpayWebhookPayloadSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string(),
        amount: z.number(),
        status: z.string()
      })
    })
  })
})

export type RazorpayWebhookPayload = z.infer<typeof razorpayWebhookPayloadSchema>
