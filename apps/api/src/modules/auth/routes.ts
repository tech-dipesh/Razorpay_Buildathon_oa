import { createHash, randomUUID } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { database } from "@repo/database"
import {
  cacheSession,
  consumeTemporaryToken,
  EMAIL_VERIFICATION_TTL_SECONDS,
  getRedisClient,
  issueTemporaryToken,
  PASSWORD_RESET_TTL_SECONDS,
  readSession,
  revokeSession
} from "@repo/redis"
import {
  loginInputSchema,
  passwordResetConfirmInputSchema,
  passwordResetRequestInputSchema,
  signupInputSchema,
  verifyEmailInputSchema
} from "@repo/shared"
import { z } from "zod"
import { env } from "../../env"
import { sendEmail } from "../mail/mailer"
import { signAccessToken } from "./jwt"
import { hashPassword, verifyPassword } from "./password"
import { authedProcedure, publicProcedure } from "./procedures"
import { clearSessionCookies, setSessionCookies } from "./session-cookies"

const REFRESH_TOKEN_TTL_SECONDS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60

const redis = getRedisClient(env.REDIS_URL)

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

async function issueSession(userId: string): Promise<string> {
  const refreshTokenValue = randomUUID()
  const refreshTokenHash = hashToken(refreshTokenValue)

  await database.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)
    }
  })

  await cacheSession(redis, refreshTokenHash, userId, REFRESH_TOKEN_TTL_SECONDS)

  return refreshTokenValue
}

const signup = publicProcedure
  .route({ method: "POST", path: "/auth/signup" })
  .input(signupInputSchema)
  .output(z.object({ userId: z.string() }))
  .handler(async ({ input }) => {
    const existing = await database.user.findUnique({
      where: { email: input.email }
    })

    if (existing) {
      throw new ORPCError("CONFLICT", {
        message: "An account with this email already exists"
      })
    }

    const passwordHash = await hashPassword(input.password)

    const user = await database.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash
      }
    })

    const verificationToken = randomUUID()
    await issueTemporaryToken(
      redis,
      "email-verify",
      verificationToken,
      user.id,
      EMAIL_VERIFICATION_TTL_SECONDS
    )

    await sendEmail({
      to: user.email,
      subject: "Verify your email",
      html: `<p>This link expires in 5 minutes: <a href="${env.FRONTEND_URL}/verify-email?token=${verificationToken}">Verify email</a></p>`
    })

    return { userId: user.id }
  })

const verifyEmail = publicProcedure
  .route({ method: "POST", path: "/auth/verify-email" })
  .input(verifyEmailInputSchema)
  .output(z.object({ verified: z.boolean() }))
  .handler(async ({ input }) => {
    const userId = await consumeTemporaryToken(redis, "email-verify", input.token)

    if (!userId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Invalid or expired verification token"
      })
    }

    await database.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() }
    })

    return { verified: true }
  })

const login = publicProcedure
  .route({ method: "POST", path: "/auth/login" })
  .input(loginInputSchema)
  .output(z.object({ userId: z.string() }))
  .handler(async ({ input, context }) => {
    const user = await database.user.findUnique({
      where: { email: input.email }
    })

    if (!user || !user.passwordHash) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid email or password"
      })
    }

    const validPassword = await verifyPassword(user.passwordHash, input.password)

    if (!validPassword) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid email or password"
      })
    }

    if (!user.emailVerifiedAt) {
      throw new ORPCError("FORBIDDEN", {
        message: "Please verify your email before signing in"
      })
    }

    const accessToken = await signAccessToken(
      { userId: user.id, role: user.role },
      env.JWT_ACCESS_SECRET,
      env.JWT_ACCESS_TOKEN_TTL_MINUTES
    )
    const refreshToken = await issueSession(user.id)

    setSessionCookies(context.reply, accessToken, refreshToken)

    return { userId: user.id }
  })

const refresh = publicProcedure
  .route({ method: "POST", path: "/auth/refresh" })
  .output(z.object({ refreshed: z.boolean() }))
  .handler(async ({ context }) => {
    const refreshTokenValue = context.refreshTokenCookie

    if (!refreshTokenValue) {
      throw new ORPCError("UNAUTHORIZED", { message: "No refresh token" })
    }

    const tokenHash = hashToken(refreshTokenValue)
    const storedToken = await database.refreshToken.findUnique({
      where: { tokenHash }
    })

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Refresh token is invalid or expired"
      })
    }

    const user = await database.user.findUnique({
      where: { id: storedToken.userId }
    })

    if (!user) {
      throw new ORPCError("UNAUTHORIZED")
    }

    await database.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() }
    })
    await revokeSession(redis, tokenHash)

    const accessToken = await signAccessToken(
      { userId: user.id, role: user.role },
      env.JWT_ACCESS_SECRET,
      env.JWT_ACCESS_TOKEN_TTL_MINUTES
    )
    const newRefreshToken = await issueSession(user.id)

    setSessionCookies(context.reply, accessToken, newRefreshToken)

    return { refreshed: true }
  })

const logout = authedProcedure
  .route({ method: "POST", path: "/auth/logout" })
  .output(z.object({ loggedOut: z.boolean() }))
  .handler(async ({ context }) => {
    const refreshTokenValue = context.refreshTokenCookie

    if (refreshTokenValue) {
      const tokenHash = hashToken(refreshTokenValue)

      await database.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() }
      })
      await revokeSession(redis, tokenHash)
    }

    clearSessionCookies(context.reply)

    return { loggedOut: true }
  })

const passwordResetRequest = publicProcedure
  .route({ method: "POST", path: "/auth/password-reset/request" })
  .input(passwordResetRequestInputSchema)
  .output(z.object({ sent: z.boolean() }))
  .handler(async ({ input }) => {
    const user = await database.user.findUnique({
      where: { email: input.email }
    })

    if (user) {
      const resetToken = randomUUID()
      await issueTemporaryToken(
        redis,
        "password-reset",
        resetToken,
        user.id,
        PASSWORD_RESET_TTL_SECONDS
      )

      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: `<p>This link expires in 5 minutes: <a href="${env.FRONTEND_URL}/reset-password?token=${resetToken}">Reset password</a></p>`
      })
    }

    return { sent: true }
  })

const passwordResetConfirm = publicProcedure
  .route({ method: "POST", path: "/auth/password-reset/confirm" })
  .input(passwordResetConfirmInputSchema)
  .output(z.object({ reset: z.boolean() }))
  .handler(async ({ input }) => {
    const userId = await consumeTemporaryToken(redis, "password-reset", input.token)

    if (!userId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Invalid or expired reset token"
      })
    }

    const passwordHash = await hashPassword(input.newPassword)

    await database.user.update({
      where: { id: userId },
      data: { passwordHash }
    })

    await database.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    })

    return { reset: true }
  })

export const authRouter = {
  signup,
  verifyEmail,
  login,
  refresh,
  logout,
  passwordResetRequest,
  passwordResetConfirm
}
