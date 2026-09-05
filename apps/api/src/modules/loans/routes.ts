import { ORPCError } from "@orpc/server"
import { database } from "@repo/database"
import { checkRateLimit, getRedisClient } from "@repo/redis"
import {
  amendmentParamSchema,
  compoundingFrequencySchema,
  createLoanInputSchema,
  createRepaymentInputSchema,
  disputeIdParamSchema,
  listLoansInputSchema,
  loanIdParamSchema,
  loanStatusSchema,
  proposeAmendmentInputSchema,
  raiseDisputeInputSchema,
  repaymentTypeSchema
} from "@repo/shared"
import { z } from "zod"
import { env } from "../../env"
import { adminProcedure, authedProcedure } from "../auth/procedures"
import {
  loadLoanForBorrower,
  loadLoanForLender,
  loadLoanForParty
} from "./authorization"
import { createRazorpayOrder } from "./razorpay"

const redis = getRedisClient(env.REDIS_URL)

const LOAN_CREATE_LIMIT = 10
const LOAN_CREATE_WINDOW_SECONDS = 60 * 60
const DISPUTE_CREATE_LIMIT = 5
const DISPUTE_CREATE_WINDOW_SECONDS = 60 * 60

const createLoan = authedProcedure
  .route({ method: "POST", path: "/loans" })
  .input(createLoanInputSchema)
  .output(z.object({ loanId: z.string() }))
  .handler(async ({ input, context }) => {
    const withinLimit = await checkRateLimit(
      redis,
      `rate-limit:create-loan:${context.userId}`,
      LOAN_CREATE_LIMIT,
      LOAN_CREATE_WINDOW_SECONDS
    )

    if (!withinLimit) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many loans created recently, please try again later"
      })
    }

    const borrower = await database.user.findUnique({
      where: { email: input.borrowerEmail }
    })

    if (!borrower) {
      throw new ORPCError("NOT_FOUND", {
        message: "No user found with that email"
      })
    }

    if (borrower.id === context.userId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "You cannot lend to yourself"
      })
    }

    const loan = await database.loan.create({
      data: {
        lenderId: context.userId,
        borrowerId: borrower.id,
        principalAmount: input.principalAmount,
        interestRate: input.interestRate,
        compoundingFrequency: input.compoundingFrequency,
        repaymentType: input.repaymentType,
        tenureMonths: input.tenureMonths,
        dueDate: new Date(input.dueDate),
        relationship: input.relationship,
        escalationState: {
          create: {
            maxSteps: input.maxSteps,
            cooldownHours: input.cooldownHours
          }
        }
      }
    })

    return { loanId: loan.id }
  })

const listLoans = authedProcedure
  .route({ method: "GET", path: "/loans" })
  .input(listLoansInputSchema)
  .output(
    z.array(
      z.object({
        id: z.string(),
        role: z.enum(["LENDER", "BORROWER"]),
        principalAmount: z.string(),
        status: loanStatusSchema,
        dueDate: z.iso.datetime()
      })
    )
  )
  .handler(async ({ input, context }) => {
    const loans = await database.loan.findMany({
      where: {
        OR: [{ lenderId: context.userId }, { borrowerId: context.userId }],
        status: input.status
      },
      orderBy: { createdAt: "desc" }
    })

    return loans.map((loan) => ({
      id: loan.id,
      role:
        loan.lenderId === context.userId
          ? ("LENDER" as const)
          : ("BORROWER" as const),
      principalAmount: loan.principalAmount.toString(),
      status: loan.status,
      dueDate: loan.dueDate.toISOString()
    }))
  })

const getLoan = authedProcedure
  .route({ method: "GET", path: "/loans/{loanId}" })
  .input(loanIdParamSchema)
  .output(
    z.object({
      id: z.string(),
      lenderId: z.string(),
      borrowerId: z.string(),
      principalAmount: z.string(),
      interestRate: z.string(),
      compoundingFrequency: compoundingFrequencySchema,
      repaymentType: repaymentTypeSchema,
      tenureMonths: z.number(),
      dueDate: z.iso.datetime(),
      status: loanStatusSchema,
      relationship: z.string().nullable()
    })
  )
  .handler(async ({ input, context }) => {
    const loan = await loadLoanForParty(input.loanId, context.userId)

    return {
      id: loan.id,
      lenderId: loan.lenderId,
      borrowerId: loan.borrowerId,
      principalAmount: loan.principalAmount.toString(),
      interestRate: loan.interestRate.toString(),
      compoundingFrequency: loan.compoundingFrequency,
      repaymentType: loan.repaymentType,
      tenureMonths: loan.tenureMonths,
      dueDate: loan.dueDate.toISOString(),
      status: loan.status,
      relationship: loan.relationship
    }
  })

const acceptLoan = authedProcedure
  .route({ method: "POST", path: "/loans/{loanId}/accept" })
  .input(loanIdParamSchema)
  .output(z.object({ status: loanStatusSchema }))
  .handler(async ({ input, context }) => {
    const loan = await loadLoanForBorrower(input.loanId, context.userId)

    if (loan.status !== "REQUESTED") {
      throw new ORPCError("CONFLICT", {
        message: "This loan is not awaiting acceptance"
      })
    }

    const updated = await database.loan.update({
      where: { id: loan.id },
      data: { status: "ACTIVE", lockedAt: new Date() }
    })

    return { status: updated.status }
  })

const proposeAmendment = authedProcedure
  .route({ method: "POST", path: "/loans/{loanId}/amendments" })
  .input(proposeAmendmentInputSchema)
  .output(z.object({ amendmentId: z.string() }))
  .handler(async ({ input, context }) => {
    const loan = await loadLoanForLender(input.loanId, context.userId)

    if (loan.status !== "ACTIVE") {
      throw new ORPCError("CONFLICT", {
        message: "Only an active loan can be amended"
      })
    }

    const lastAmendment = await database.loanAmendment.findFirst({
      where: { loanId: loan.id },
      orderBy: { version: "desc" }
    })

    const amendment = await database.loanAmendment.create({
      data: {
        loanId: loan.id,
        proposedByUserId: context.userId,
        version: (lastAmendment?.version ?? 0) + 1,
        principalAmount: input.principalAmount,
        interestRate: input.interestRate,
        compoundingFrequency: input.compoundingFrequency,
        tenureMonths: input.tenureMonths,
        dueDate: new Date(input.dueDate)
      }
    })

    return { amendmentId: amendment.id }
  })

const amendmentSchema = z.object({
  id: z.string(),
  version: z.number(),
  principalAmount: z.string(),
  interestRate: z.string(),
  compoundingFrequency: compoundingFrequencySchema,
  tenureMonths: z.number(),
  dueDate: z.iso.datetime(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
  proposedByUserId: z.string(),
  createdAt: z.iso.datetime()
})

const listAmendments = authedProcedure
  .route({ method: "GET", path: "/loans/{loanId}/amendments" })
  .input(loanIdParamSchema)
  .output(z.array(amendmentSchema))
  .handler(async ({ input, context }) => {
    await loadLoanForParty(input.loanId, context.userId)

    const amendments = await database.loanAmendment.findMany({
      where: { loanId: input.loanId },
      orderBy: { version: "desc" }
    })

    return amendments.map((amendment) => ({
      id: amendment.id,
      version: amendment.version,
      principalAmount: amendment.principalAmount.toString(),
      interestRate: amendment.interestRate.toString(),
      compoundingFrequency: amendment.compoundingFrequency,
      tenureMonths: amendment.tenureMonths,
      dueDate: amendment.dueDate.toISOString(),
      status: amendment.status,
      proposedByUserId: amendment.proposedByUserId,
      createdAt: amendment.createdAt.toISOString()
    }))
  })

async function respondToAmendment(
  loanId: string,
  amendmentId: string,
  userId: string,
  accept: boolean
): Promise<void> {
  const loan = await loadLoanForBorrower(loanId, userId)

  const amendment = await database.loanAmendment.findUnique({
    where: { id: amendmentId }
  })

  if (!amendment || amendment.loanId !== loan.id) {
    throw new ORPCError("NOT_FOUND", { message: "Amendment not found" })
  }

  if (amendment.status !== "PENDING") {
    throw new ORPCError("CONFLICT", {
      message: "This amendment has already been responded to"
    })
  }

  if (accept && loan.status !== "ACTIVE") {
    throw new ORPCError("CONFLICT", {
      message: "This loan is no longer active, so its terms can't be changed"
    })
  }

  if (accept) {
    await database.$transaction([
      database.loanAmendment.update({
        where: { id: amendment.id },
        data: { status: "ACCEPTED", respondedAt: new Date() }
      }),
      database.loan.update({
        where: { id: loan.id },
        data: {
          principalAmount: amendment.principalAmount,
          interestRate: amendment.interestRate,
          compoundingFrequency: amendment.compoundingFrequency,
          tenureMonths: amendment.tenureMonths,
          dueDate: amendment.dueDate
        }
      })
    ])
    return
  }

  await database.loanAmendment.update({
    where: { id: amendment.id },
    data: { status: "REJECTED", respondedAt: new Date() }
  })
}

const acceptAmendment = authedProcedure
  .route({
    method: "POST",
    path: "/loans/{loanId}/amendments/{amendmentId}/accept"
  })
  .input(amendmentParamSchema)
  .output(z.object({ accepted: z.boolean() }))
  .handler(async ({ input, context }) => {
    await respondToAmendment(input.loanId, input.amendmentId, context.userId, true)
    return { accepted: true }
  })

const rejectAmendment = authedProcedure
  .route({
    method: "POST",
    path: "/loans/{loanId}/amendments/{amendmentId}/reject"
  })
  .input(amendmentParamSchema)
  .output(z.object({ rejected: z.boolean() }))
  .handler(async ({ input, context }) => {
    await respondToAmendment(
      input.loanId,
      input.amendmentId,
      context.userId,
      false
    )
    return { rejected: true }
  })

const createRepayment = authedProcedure
  .route({ method: "POST", path: "/loans/{loanId}/repayments" })
  .input(createRepaymentInputSchema)
  .output(z.object({ repaymentId: z.string(), razorpayOrderId: z.string() }))
  .handler(async ({ input, context }) => {
    const loan = await loadLoanForBorrower(input.loanId, context.userId)

    if (loan.status !== "ACTIVE" && loan.status !== "OVERDUE") {
      throw new ORPCError("CONFLICT", {
        message: "This loan is not accepting repayments"
      })
    }

    const receipt = `loan-${loan.id}-${Date.now()}`
    const razorpayOrderId = await createRazorpayOrder(input.amount, receipt)

    const repayment = await database.repayment.create({
      data: {
        loanId: loan.id,
        amount: input.amount,
        razorpayOrderId
      }
    })

    return { repaymentId: repayment.id, razorpayOrderId }
  })

const listRepayments = authedProcedure
  .route({ method: "GET", path: "/loans/{loanId}/repayments" })
  .input(loanIdParamSchema)
  .output(
    z.array(
      z.object({
        id: z.string(),
        amount: z.string(),
        status: z.string(),
        createdAt: z.iso.datetime()
      })
    )
  )
  .handler(async ({ input, context }) => {
    await loadLoanForParty(input.loanId, context.userId)

    const repayments = await database.repayment.findMany({
      where: { loanId: input.loanId },
      orderBy: { createdAt: "desc" }
    })

    return repayments.map((repayment) => ({
      id: repayment.id,
      amount: repayment.amount.toString(),
      status: repayment.status,
      createdAt: repayment.createdAt.toISOString()
    }))
  })

const timelineEventSchema = z.object({
  type: z.enum(["CONSENSUS_CHECK", "DISPUTE_BRIEF", "NOTIFICATION"]),
  occurredAt: z.iso.datetime(),
  summary: z.string(),
  reasoning: z.string()
})

const getTimeline = authedProcedure
  .route({ method: "GET", path: "/loans/{loanId}/timeline" })
  .input(loanIdParamSchema)
  .output(z.array(timelineEventSchema))
  .handler(async ({ input, context }) => {
    await loadLoanForParty(input.loanId, context.userId)

    const [consensusChecks, disputes, notifications] = await Promise.all([
      database.consensusCheck.findMany({ where: { loanId: input.loanId } }),
      database.dispute.findMany({
        where: { loanId: input.loanId },
        include: { brief: true }
      }),
      database.notification.findMany({ where: { loanId: input.loanId } })
    ])

    const events: Array<{
      type: "CONSENSUS_CHECK" | "DISPUTE_BRIEF" | "NOTIFICATION"
      occurredAt: Date
      summary: string
      reasoning: string
    }> = []

    for (const check of consensusChecks) {
      events.push({
        type: "CONSENSUS_CHECK",
        occurredAt: check.createdAt,
        summary: `${check.actionType} — ${check.agreementReached ? "agreement reached" : "review required"}`,
        reasoning: check.reasoning
      })
    }

    for (const dispute of disputes) {
      if (dispute.brief) {
        events.push({
          type: "DISPUTE_BRIEF",
          occurredAt: dispute.brief.createdAt,
          summary: dispute.brief.summary,
          reasoning: dispute.brief.reasoning
        })
      }
    }

    for (const notification of notifications) {
      events.push({
        type: "NOTIFICATION",
        occurredAt: notification.sentAt,
        summary: `${notification.type} sent via ${notification.channel}`,
        reasoning: notification.reasoning
      })
    }

    events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())

    return events.map((event) => ({
      ...event,
      occurredAt: event.occurredAt.toISOString()
    }))
  })

const raiseDispute = authedProcedure
  .route({ method: "POST", path: "/loans/{loanId}/disputes" })
  .input(raiseDisputeInputSchema)
  .output(z.object({ disputeId: z.string() }))
  .handler(async ({ input, context }) => {
    const withinLimit = await checkRateLimit(
      redis,
      `rate-limit:create-dispute:${context.userId}`,
      DISPUTE_CREATE_LIMIT,
      DISPUTE_CREATE_WINDOW_SECONDS
    )

    if (!withinLimit) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many disputes raised recently, please try again later"
      })
    }

    await loadLoanForParty(input.loanId, context.userId)

    const dispute = await database.dispute.create({
      data: {
        loanId: input.loanId,
        raisedByUserId: context.userId,
        trigger: "MANUAL",
        reason: input.reason
      }
    })

    return { disputeId: dispute.id }
  })

const resolveDispute = adminProcedure
  .route({ method: "POST", path: "/disputes/{disputeId}/resolve" })
  .input(disputeIdParamSchema)
  .output(z.object({ resolved: z.boolean() }))
  .handler(async ({ input }) => {
    await database.dispute.update({
      where: { id: input.disputeId },
      data: { status: "RESOLVED", resolvedAt: new Date() }
    })

    return { resolved: true }
  })

export const loansRouter = {
  create: createLoan,
  list: listLoans,
  get: getLoan,
  accept: acceptLoan,
  proposeAmendment,
  listAmendments,
  acceptAmendment,
  rejectAmendment,
  createRepayment,
  listRepayments,
  getTimeline,
  raiseDispute,
  resolveDispute
}
