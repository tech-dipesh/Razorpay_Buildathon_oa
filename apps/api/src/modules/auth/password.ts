import { argon2id, hash, verify } from "argon2"

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, { type: argon2id })
}

export async function verifyPassword(
  passwordHash: string,
  plainPassword: string
): Promise<boolean> {
  return verify(passwordHash, plainPassword)
}
