import { z } from "zod"

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url()
})

export function loadEnv<T>(schema: z.ZodType<T>, source: NodeJS.ProcessEnv = process.env): T {
  const result = schema.safeParse(source)

  if (!result.success) {
    console.error("Invalid environment variables:")
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}
