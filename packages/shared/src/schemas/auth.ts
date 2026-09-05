import { z } from "zod"

export const emailSchema = z.email()
export const passwordSchema = z
  .string()
  .min(10)
  .regex(/[0-9]/, "Password must include at least one number")
export const nameSchema = z.string().min(2).max(100)
export const phoneSchema = z.string().min(7).max(20)

export const signupInputSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema
})

export const loginInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema
})

export const verifyEmailInputSchema = z.object({
  token: z.string()
})

export const passwordResetRequestInputSchema = z.object({
  email: emailSchema
})

export const passwordResetConfirmInputSchema = z.object({
  token: z.string(),
  newPassword: passwordSchema
})
