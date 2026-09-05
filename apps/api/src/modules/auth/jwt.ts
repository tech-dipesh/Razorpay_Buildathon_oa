import { jwtVerify, SignJWT } from "jose"
import { z } from "zod"

const accessTokenPayloadSchema = z.object({
  userId: z.string(),
  role: z.enum(["USER", "ADMIN"])
})

type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>

export async function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
  ttlMinutes: number
): Promise<string> {
  const encodedSecret = new TextEncoder().encode(secret)

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlMinutes}m`)
    .sign(encodedSecret)
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<AccessTokenPayload> {
  const encodedSecret = new TextEncoder().encode(secret)
  const { payload } = await jwtVerify(token, encodedSecret)

  return accessTokenPayloadSchema.parse(payload)
}
