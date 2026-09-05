import { z } from "zod"
import { baseEnvSchema, loadEnv } from "@repo/config/env"

const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.url(),
  FRONTEND_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().positive(),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().positive(),
  RAZORPAY_KEY_ID: z.string(),
  RAZORPAY_KEY_SECRET: z.string(),
  RAZORPAY_WEBHOOK_SECRET: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  KIMI_API_KEY: z.string().optional()
})

export const env = loadEnv(apiEnvSchema)
