import type { Job } from "bullmq"
import { database } from "@repo/database"
import { createQueues, type WebhookProcessingJob } from "@repo/queue"
import { getRedisClient } from "@repo/redis"
import { razorpayWebhookPayloadSchema } from "@repo/shared"
import { env } from "../env"

const redis = getRedisClient(env.REDIS_URL)
const queues = createQueues(redis)

type ConfirmOutcome = {
  justRepaid: boolean
  loanId: string
  borrowerId: string
  lenderId: string
}

async function markRepaymentConfirmed(
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<ConfirmOutcome | null> {
  return database.$transaction(async (tx) => {
    const repayment = await tx.repayment.findUnique({
      where: { razorpayOrderId }
    })

    if (!repayment) {
      throw new Error(`No repayment found for order ${razorpayOrderId}`)
    }

    const updateResult = await tx.repayment.updateMany({
      where: { id: repayment.id, status: "PENDING" },
      data: {
        status: "CONFIRMED",
        razorpayPaymentId,
        confirmedAt: new Date()
      }
    })

    if (updateResult.count === 0) {
      return null
    }

    const loan = await tx.loan.findUnique({ where: { id: repayment.loanId } })

    if (!loan) {
      throw new Error(`No loan found for repayment ${repayment.id}`)
    }

    const confirmedRepayments = await tx.repayment.findMany({
      where: { loanId: loan.id, status: "CONFIRMED" }
    })

    const totalConfirmed = confirmedRepayments.reduce(
      (sum, current) => sum + Number(current.amount),
      0
    )

    const totalOwed =
      Number(loan.principalAmount) *
      (1 + Number(loan.interestRate) / 100)

    const isFullyRepaid = totalConfirmed >= totalOwed
    const justRepaid = isFullyRepaid && loan.status !== "REPAID"

    if (justRepaid) {
      await tx.loan.update({
        where: { id: loan.id },
        data: { status: "REPAID" }
      })
    }

    return {
      justRepaid,
      loanId: loan.id,
      borrowerId: loan.borrowerId,
      lenderId: loan.lenderId
    }
  })
}

async function markRepaymentFailed(razorpayOrderId: string): Promise<void> {
  const repayment = await database.repayment.findUnique({
    where: { razorpayOrderId }
  })

  if (!repayment) {
    throw new Error(`No repayment found for order ${razorpayOrderId}`)
  }

  await database.repayment.updateMany({
    where: { id: repayment.id, status: "PENDING" },
    data: { status: "FAILED" }
  })
}

export async function handleWebhookProcessing(
  job: Job<WebhookProcessingJob>
): Promise<void> {
  const { webhookEventId } = job.data

  const webhookEvent = await database.webhookEvent.findUnique({
    where: { id: webhookEventId }
  })

  if (!webhookEvent) {
    throw new Error(`Webhook event ${webhookEventId} not found`)
  }

  if (webhookEvent.status === "PROCESSED") {
    return
  }

  const parseResult = razorpayWebhookPayloadSchema.safeParse(
    webhookEvent.payload
  )

  if (!parseResult.success) {
    await database.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "FAILED" }
    })
    throw new Error(
      `Webhook event ${webhookEventId} payload no longer matches expected shape`
    )
  }

  const { event, payload } = parseResult.data

  if (event === "payment.captured") {
    const outcome = await markRepaymentConfirmed(
      payload.payment.entity.order_id,
      payload.payment.entity.id
    )

    if (outcome?.justRepaid) {
      await queues.enqueueTrustScoreRecalculation({
        userId: outcome.borrowerId
      })
      await queues.enqueueTrustScoreRecalculation({
        userId: outcome.lenderId
      })
    }
  } else if (event === "payment.failed") {
    await markRepaymentFailed(payload.payment.entity.order_id)
  }

  await database.webhookEvent.update({
    where: { id: webhookEvent.id },
    data: { status: "PROCESSED", processedAt: new Date() }
  })
}
