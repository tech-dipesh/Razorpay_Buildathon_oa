import type {} from "@fastify/cookie"
import type { FastifyReply } from "fastify"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/"
}

export function setSessionCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string
): void {
  reply.setCookie("access_token", accessToken, COOKIE_OPTIONS)
  reply.setCookie("refresh_token", refreshToken, COOKIE_OPTIONS)
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie("access_token", { path: "/" })
  reply.clearCookie("refresh_token", { path: "/" })
}
