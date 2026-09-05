import { z } from "zod"
import { authRouter } from "./modules/auth/routes"
import { publicProcedure } from "./modules/auth/procedures"
import { loansRouter } from "./modules/loans/routes"
import { aiRouter } from "./modules/ai/routes"
import { notificationsRouter } from "./modules/notifications/routes"
import { usersRouter } from "./modules/users/routes"
import { reportsRouter } from "./modules/reports/routes"

const ping = publicProcedure
  .route({ method: "GET", path: "/ping" })
  .output(z.object({ status: z.string() }))
  .handler(async () => {
    return { status: "ok" }
  })

export const router = {
  ping,
  auth: authRouter,
  loans: loansRouter,
  ai: aiRouter,
  notifications: notificationsRouter,
  users: usersRouter,
  reports: reportsRouter
}

export type AppRouter = typeof router
