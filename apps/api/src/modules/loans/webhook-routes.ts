import { database } from "@repo/database"
import { Prisma } from "@repo/database"
import { createQueues, type WebhookProcessingJob } from "@repo/queue"
import type { Redis } from "@repo/redis"
import { razorpayWebhookPayloadSchema } from "@repo/shared"
import type { FastifyInstance, FastifyRequest } from "fastify"
import { verifyWebhookSignature } from "./razorpay"

function readRawBody(request: FastifyRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ""

    request.raw.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8")
    })

    request.raw.on("end", () => resolve(data))
    request.raw.on("error", reject)
  })
}

export function registerWebhookRoutes(app: FastifyInstance, redis: Redis): void {
  const queues = createQueues(redis)

  app.post("/webhooks/razorpay", async (request, reply) => {
    const rawBody = await readRawBody(request)
    const signature = request.headers["x-razorpay-signature"]
    const eventId = request.headers["x-razorpay-event-id"]

    if (typeof signature !== "string" || typeof eventId !== "string") {
      return reply.status(400).send("Missing required webhook headers")
    }

    if (!verifyWebhookSignature(rawBody, signature)) {
      request.log.warn("razorpay webhook signature verification failed")
      return reply.status(400).send("Invalid signature")
    }

    const existing = await database.webhookEvent.findUnique({
      where: { razorpayEventId: eventId }
    })

    if (existing) {
      return reply.status(200).send({ received: true, duplicate: true })
    }

    const parsedBody: unknown = JSON.parse(rawBody)
    const parseResult = razorpayWebhookPayloadSchema.safeParse(parsedBody)

    if (!parseResult.success) {
      request.log.error(
        { issues: parseResult.error.issues },
        "razorpay webhook payload did not match expected shape"
      )
      return reply.status(400).send("Unrecognized payload shape")
    }

    let webhookEvent: { id: string }

    try {
      webhookEvent = await database.webhookEvent.create({
        data: {
          razorpayEventId: eventId,
          eventType: parseResult.data.event,
          payload: parsedBody as object,
          traceId: request.id
        }
      })
    } catch (error) {
      const isDuplicateKey =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"

      if (isDuplicateKey) {
        return reply.status(200).send({ received: true, duplicate: true })
      }

      throw error
    }

    const jobPayload: WebhookProcessingJob = { webhookEventId: webhookEvent.id }
    await queues.enqueueWebhookProcessing(jobPayload)

    return reply.status(200).send({ received: true })
  })
}
