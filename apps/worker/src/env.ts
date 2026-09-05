import { z } from "zod"
import { baseEnvSchema, loadEnv } from "@repo/config/env"

const workerEnvSchema = baseEnvSchema.extend({
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  KIMI_API_KEY: z.string().optional()
})

export const env = loadEnv(workerEnvSchema)
