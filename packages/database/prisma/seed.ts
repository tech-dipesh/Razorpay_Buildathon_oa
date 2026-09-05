import "dotenv/config"
import { randomUUID } from "node:crypto"
import { argon2id, hash } from "argon2"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@generated/client";
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

const adapter = new PrismaPg({ connectionString })
const database = new PrismaClient({ adapter })

const RELATIONSHIPS = [
  "cousin",
  "college friend",
  "neighbour",
  "coworker",
  "childhood friend"
]

const TARGET_COUNTS: Record<string, number> = {
  REPAID: 20,
  DEFAULTED: 8,
  ACTIVE: 12,
  OVERDUE: 6,
  REQUESTED: 4
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(items: T[]): T {
  const item = items[randomBetween(0, items.length - 1)]

  if (item === undefined) {
    throw new Error("pick called on an empty array")
  }

  return item
}

type SeededLoan = {
  id: string
  status: string
  principalAmount: number
  createdAt: Date
}

async function createSeedUsers() {
  const passwordHash = await hash("SeedPassword123", { type: argon2id })

  const lenders = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      database.user.create({
        data: {
          name: `Lender ${index + 1}`,
          email: `lender${index + 1}@seed.vaada.test`,
          passwordHash,
          emailVerifiedAt: new Date()
        }
      })
    )
  )

  const borrowers = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      database.user.create({
        data: {
          name: `Borrower ${index + 1}`,
          email: `borrower${index + 1}@seed.vaada.test`,
          passwordHash,
          emailVerifiedAt: new Date()
        }
      })
    )
  )

  return { lenders, borrowers }
}

async function createSeedLoans(
  lenders: Array<{ id: string }>,
  borrowers: Array<{ id: string }>
): Promise<SeededLoan[]> {
  const createdLoans: SeededLoan[] = []

  for (const [status, count] of Object.entries(TARGET_COUNTS)) {
    for (let i = 0; i < count; i++) {
      const lender = pick(lenders)
      const borrower = pick(borrowers)
      const principal = randomBetween(2, 50) * 1000
      const daysAgo = randomBetween(10, 180)
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
      const dueDate = new Date(
        createdAt.getTime() + randomBetween(30, 180) * 24 * 60 * 60 * 1000
      )

      const loan = await database.loan.create({
        data: {
          lenderId: lender.id,
          borrowerId: borrower.id,
          principalAmount: principal,
          interestRate: randomBetween(0, 12),
          compoundingFrequency: "MONTHLY",
          repaymentType: "LUMP_SUM",
          tenureMonths: randomBetween(3, 12),
          dueDate,
          relationship: pick(RELATIONSHIPS),
          status: status as
            | "REQUESTED"
            | "ACTIVE"
            | "OVERDUE"
            | "REPAID"
            | "DEFAULTED",
          lockedAt: status === "REQUESTED" ? null : createdAt,
          createdAt,
          escalationState: {
            create: { maxSteps: 4, cooldownHours: 72 }
          }
        }
      })

      if (status === "REPAID") {
        const confirmedAt = new Date(
          createdAt.getTime() + randomBetween(5, 60) * 24 * 60 * 60 * 1000
        )

        await database.repayment.create({
          data: {
            loanId: loan.id,
            amount: principal,
            razorpayOrderId: `seed_order_${randomUUID()}`,
            razorpayPaymentId: `seed_pay_${randomUUID()}`,
            status: "CONFIRMED",
            confirmedAt
          }
        })
      }

      createdLoans.push({
        id: loan.id,
        status,
        principalAmount: principal,
        createdAt
      })
    }
  }

  return createdLoans
}

async function generateBatchReport(createdLoans: SeededLoan[]): Promise<void> {
  const repaidLoans = createdLoans.filter((loan) => loan.status === "REPAID")
  const totalRecoveredAmount = repaidLoans.reduce(
    (sum, loan) => sum + loan.principalAmount,
    0
  )
  const recoveryRate = (repaidLoans.length / createdLoans.length) * 100

  const resolutionDaysList = await Promise.all(
    repaidLoans.map(async (loan) => {
      const repayment = await database.repayment.findFirst({
        where: { loanId: loan.id }
      })

      if (!repayment?.confirmedAt) {
        return 0
      }

      return (
        (repayment.confirmedAt.getTime() - loan.createdAt.getTime()) /
        (1000 * 60 * 60 * 24)
      )
    })
  )

  const averageResolutionDays =
    resolutionDaysList.reduce((sum, days) => sum + days, 0) /
    (resolutionDaysList.length || 1)

  const overdueCount = TARGET_COUNTS.OVERDUE ?? 0

  await database.batchReport.create({
    data: {
      totalLoans: createdLoans.length,
      totalRecoveredAmount,
      recoveryRate,
      averageResolutionDays,
      escalationStepDistribution: {
        step0: createdLoans.length - overdueCount,
        step1: Math.floor(overdueCount * 0.6),
        step2: Math.floor(overdueCount * 0.3),
        step3: Math.floor(overdueCount * 0.1)
      }
    }
  })

  console.log(
    `seeded ${createdLoans.length} loans — recovery rate ${recoveryRate.toFixed(1)}%, avg resolution ${averageResolutionDays.toFixed(1)} days`
  )
}

async function main(): Promise<void> {
  console.log("seeding vaada demo data...")

  const { lenders, borrowers } = await createSeedUsers()
  const createdLoans = await createSeedLoans(lenders, borrowers)
  await generateBatchReport(createdLoans)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await database.$disconnect()
  })
