import { createHash, randomUUID } from "node:crypto"
import { database } from "@repo/database"
import { cacheSession, consumeTemporaryToken, issueTemporaryToken } from "@repo/redis"
import type { Redis } from "@repo/redis"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { env } from "../../env"
import { signAccessToken } from "./jwt"
import { setSessionCookies } from "./session-cookies"
import {
  buildAuthorizationUrl,
  createCodeChallenge,
  exchangeCodeForAccessToken,
  fetchOAuthProfile,
  generateCodeVerifier,
  generateState,
  type OAuthEnvConfig,
  type OAuthProviderId
} from "./oauth"

const OAUTH_STATE_TTL_SECONDS = 600
const REFRESH_TOKEN_TTL_SECONDS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60

const providerParamsSchema = z.object({
  provider: z.enum(["google", "github"])
})

const callbackQuerySchema = z.object({
  code: z.string(),
  state: z.string()
})

function toOAuthEnvConfig(): OAuthEnvConfig {
  return {
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,
    apiBaseUrl: env.API_BASE_URL
  }
}

function toProviderEnum(provider: OAuthProviderId): "GOOGLE" | "GITHUB" {
  return provider === "google" ? "GOOGLE" : "GITHUB"
}

export function registerOAuthRoutes(app: FastifyInstance, redis: Redis): void {
  app.get("/api/v1/auth/oauth/:provider/start", async (request, reply) => {
    const { provider } = providerParamsSchema.parse(request.params)

    const state = generateState()
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = createCodeChallenge(codeVerifier)

    await issueTemporaryToken(
      redis,
      "oauth-state",
      state,
      codeVerifier,
      OAUTH_STATE_TTL_SECONDS
    )

    const authorizationUrl = buildAuthorizationUrl(
      provider,
      state,
      codeChallenge,
      toOAuthEnvConfig()
    )

    return reply.redirect(authorizationUrl)
  })

  app.get("/api/v1/auth/oauth/:provider/callback", async (request, reply) => {
    const { provider } = providerParamsSchema.parse(request.params)
    const { code, state } = callbackQuerySchema.parse(request.query)

    const codeVerifier = await consumeTemporaryToken(redis, "oauth-state", state)

    if (!codeVerifier) {
      return reply.status(400).send("Invalid or expired OAuth state")
    }

    const config = toOAuthEnvConfig()
    const providerAccessToken = await exchangeCodeForAccessToken(
      provider,
      code,
      codeVerifier,
      config
    )
    const profile = await fetchOAuthProfile(provider, providerAccessToken, config)
    const providerEnum = toProviderEnum(provider)

    const existingAccount = await database.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: providerEnum,
          providerAccountId: profile.providerAccountId
        }
      },
      include: { user: true }
    })

    const user =
      existingAccount?.user ??
      (await linkOrCreateOAuthUser(profile, providerEnum))

    const appAccessToken = await signAccessToken(
      { userId: user.id, role: user.role },
      env.JWT_ACCESS_SECRET,
      env.JWT_ACCESS_TOKEN_TTL_MINUTES
    )

    const refreshTokenValue = randomUUID()
    const refreshTokenHash = createHash("sha256")
      .update(refreshTokenValue)
      .digest("hex")

    await database.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)
      }
    })

    await cacheSession(redis, refreshTokenHash, user.id, REFRESH_TOKEN_TTL_SECONDS)

    setSessionCookies(reply, appAccessToken, refreshTokenValue)

    return reply.redirect(env.FRONTEND_URL)
  })
}

async function linkOrCreateOAuthUser(
  profile: { providerAccountId: string; email: string; name: string },
  providerEnum: "GOOGLE" | "GITHUB"
) {
  const existingByEmail = await database.user.findUnique({
    where: { email: profile.email }
  })

  const user =
    existingByEmail ??
    (await database.user.create({
      data: {
        name: profile.name,
        email: profile.email,
        emailVerifiedAt: new Date()
      }
    }))

  await database.oAuthAccount.create({
    data: {
      userId: user.id,
      provider: providerEnum,
      providerAccountId: profile.providerAccountId
    }
  })

  return user
}
