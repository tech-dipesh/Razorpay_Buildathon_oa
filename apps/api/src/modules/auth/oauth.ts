import { createHash, randomBytes } from "node:crypto"
import { z } from "zod"

export type OAuthProviderId = "google" | "github"

export type OAuthEnvConfig = {
  googleClientId: string
  googleClientSecret: string
  githubClientId: string
  githubClientSecret: string
  apiBaseUrl: string
}

type ProviderEndpoints = {
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl: string
  scopes: string[]
  clientId: string
  clientSecret: string
  redirectUri: string
}

function getProviderEndpoints(
  provider: OAuthProviderId,
  config: OAuthEnvConfig
): ProviderEndpoints {
  if (provider === "google") {
    return {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scopes: ["openid", "email", "profile"],
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      redirectUri: `${config.apiBaseUrl}/api/v1/auth/oauth/google/callback`
    }
  }

  return {
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scopes: ["read:user", "user:email"],
    clientId: config.githubClientId,
    clientSecret: config.githubClientSecret,
    redirectUri: `${config.apiBaseUrl}/api/v1/auth/oauth/github/callback`
  }
}

export function generateState(): string {
  return randomBytes(32).toString("hex")
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("hex")
}

export function createCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url")
}

export function buildAuthorizationUrl(
  provider: OAuthProviderId,
  state: string,
  codeChallenge: string,
  config: OAuthEnvConfig
): string {
  const endpoints = getProviderEndpoints(provider, config)
  const url = new URL(endpoints.authorizationUrl)

  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", endpoints.clientId)
  url.searchParams.set("redirect_uri", endpoints.redirectUri)
  url.searchParams.set("code_challenge", codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("scope", endpoints.scopes.join(" "))
  url.searchParams.set("state", state)

  return url.toString()
}

const tokenResponseSchema = z.object({
  access_token: z.string()
})

export async function exchangeCodeForAccessToken(
  provider: OAuthProviderId,
  code: string,
  codeVerifier: string,
  config: OAuthEnvConfig
): Promise<string> {
  const endpoints = getProviderEndpoints(provider, config)

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: endpoints.redirectUri,
    client_id: endpoints.clientId,
    client_secret: endpoints.clientSecret,
    code_verifier: codeVerifier
  })

  const response = await fetch(endpoints.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  })

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed for ${provider}`)
  }

  const data = tokenResponseSchema.parse(await response.json())

  return data.access_token
}

const googleProfileSchema = z.object({
  sub: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
  name: z.string()
})

const githubUserSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  login: z.string()
})

const githubEmailSchema = z.object({
  email: z.string(),
  primary: z.boolean(),
  verified: z.boolean()
})

export type OAuthProfile = {
  providerAccountId: string
  email: string
  name: string
}

async function fetchGitHubVerifiedPrimaryEmail(
  accessToken: string
): Promise<string> {
  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  })

  if (!response.ok) {
    throw new Error("Fetching GitHub email addresses failed")
  }

  const emails = z.array(githubEmailSchema).parse(await response.json())
  const verifiedPrimary = emails.find(
    (entry) => entry.primary && entry.verified
  )

  if (!verifiedPrimary) {
    throw new Error("GitHub account has no verified primary email")
  }

  return verifiedPrimary.email
}

export async function fetchOAuthProfile(
  provider: OAuthProviderId,
  accessToken: string,
  config: OAuthEnvConfig
): Promise<OAuthProfile> {
  const endpoints = getProviderEndpoints(provider, config)

  const response = await fetch(endpoints.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  })

  if (!response.ok) {
    throw new Error(`Fetching OAuth profile failed for ${provider}`)
  }

  const body = await response.json()

  if (provider === "google") {
    const profile = googleProfileSchema.parse(body)

    if (!profile.email_verified) {
      throw new Error("Google account email is not verified")
    }

    return {
      providerAccountId: profile.sub,
      email: profile.email,
      name: profile.name
    }
  }

  const profile = githubUserSchema.parse(body)
  const verifiedEmail = await fetchGitHubVerifiedPrimaryEmail(accessToken)

  return {
    providerAccountId: String(profile.id),
    email: verifiedEmail,
    name: profile.name ?? profile.login
  }
}
