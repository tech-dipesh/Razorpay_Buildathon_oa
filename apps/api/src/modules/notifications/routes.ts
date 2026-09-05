import { database } from "@repo/database"
import { loanIdParamSchema } from "@repo/shared"
import { z } from "zod"
import { authedProcedure } from "../auth/procedures"
import { loadLoanForParty } from "../loans/authorization"

const listNotifications = authedProcedure
  .route({ method: "GET", path: "/loans/{loanId}/notifications" })
  .input(loanIdParamSchema)
  .output(
    z.array(
      z.object({
        id: z.string(),
        type: z.enum(["REMINDER", "ESCALATION"]),
        channel: z.string(),
        language: z.string(),
        reasoning: z.string(),
        escalationStep: z.number().nullable(),
        sentAt: z.iso.datetime()
      })
    )
  )
  .handler(async ({ input, context }) => {
    await loadLoanForParty(input.loanId, context.userId)

    const notifications = await database.notification.findMany({
      where: { loanId: input.loanId },
      orderBy: { sentAt: "desc" }
    })

    return notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      channel: notification.channel,
      language: notification.language,
      reasoning: notification.reasoning,
      escalationStep: notification.escalationStep,
      sentAt: notification.sentAt.toISOString()
    }))
  })

export const notificationsRouter = {
  list: listNotifications
}
