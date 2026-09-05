import { ORPCError, os } from "@orpc/server"
import type { FastifyReply } from "fastify"
import { env } from "../../env"
import { verifyAccessToken } from "./jwt"

type InitialContext = {
  authorizationHeader: string | undefined
  accessTokenCookie: string | undefined
  refreshTokenCookie: string | undefined
  requestId: string
  reply: FastifyReply
}

const contextBase = os.$context<InitialContext>()

const requireAuth = contextBase.middleware(async ({ context, next }) => {
  const bearerToken = context.authorizationHeader?.replace("Bearer ", "")
  const token = bearerToken ?? context.accessTokenCookie

  if (!token) {
    throw new ORPCError("UNAUTHORIZED")
  }

  const payload = await verifyAccessToken(token, env.JWT_ACCESS_SECRET).catch(
    () => null
  )

  if (!payload) {
    throw new ORPCError("UNAUTHORIZED")
  }

  return next({
    context: {
      userId: payload.userId,
      role: payload.role
    }
  })
})

type AuthedContext = {
  role: "USER" | "ADMIN"
}

const authedBase = os.$context<AuthedContext>()

const requireAdmin = authedBase.middleware(async ({ context, next }) => {
  if (context.role !== "ADMIN") {
    throw new ORPCError("FORBIDDEN")
  }

  return next({ context })
})

export const publicProcedure = contextBase
export const authedProcedure = contextBase.use(requireAuth)
export const adminProcedure = authedProcedure.use(requireAdmin)
