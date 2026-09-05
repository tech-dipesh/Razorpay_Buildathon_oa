import { ORPCError } from "@orpc/server"
import { database } from "@repo/database"
import { z } from "zod"
import { adminProcedure } from "../auth/procedures"

const getLatestBatchReport = adminProcedure
  .route({ method: "GET", path: "/reports/batch/latest" })
  .output(
    z.object({
      id: z.string(),
      totalLoans: z.number(),
      totalRecoveredAmount: z.string(),
      recoveryRate: z.string(),
      averageResolutionDays: z.string(),
      escalationStepDistribution: z.unknown(),
      generatedAt: z.iso.datetime()
    })
  )
  .handler(async () => {
    const report = await database.batchReport.findFirst({
      orderBy: { generatedAt: "desc" }
    })

    if (!report) {
      throw new ORPCError("NOT_FOUND", {
        message: "No batch report has been generated yet"
      })
    }

    return {
      id: report.id,
      totalLoans: report.totalLoans,
      totalRecoveredAmount: report.totalRecoveredAmount.toString(),
      recoveryRate: report.recoveryRate.toString(),
      averageResolutionDays: report.averageResolutionDays.toString(),
      escalationStepDistribution: report.escalationStepDistribution,
      generatedAt: report.generatedAt.toISOString()
    }
  })

const listOpenDisputes = adminProcedure
  .route({ method: "GET", path: "/disputes/open" })
  .output(
    z.array(
      z.object({
        id: z.string(),
        loanId: z.string(),
        trigger: z.enum(["MANUAL", "AUTOMATIC"]),
        reason: z.string(),
        createdAt: z.iso.datetime()
      })
    )
  )
  .handler(async () => {
    const disputes = await database.dispute.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" }
    })

    return disputes.map((dispute) => ({
      id: dispute.id,
      loanId: dispute.loanId,
      trigger: dispute.trigger,
      reason: dispute.reason,
      createdAt: dispute.createdAt.toISOString()
    }))
  })

export const reportsRouter = {
  getLatestBatchReport,
  listOpenDisputes
}
