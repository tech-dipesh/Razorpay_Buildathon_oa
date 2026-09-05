import { z } from "zod"

export const compoundingFrequencySchema = z.enum([
  "MONTHLY",
  "QUARTERLY",
  "ANNUALLY"
])

export const repaymentTypeSchema = z.enum(["LUMP_SUM", "INSTALLMENTS"])

export const escalationConfigSchema = z.object({
  maxSteps: z.number().int().min(1).max(6),
  cooldownHours: z.number().int().min(24)
})

const futureDateSchema = z.iso.datetime().refine(
  (value) => new Date(value).getTime() > Date.now(),
  { message: "Due date must be in the future" }
)

export const createLoanInputSchema = z
  .object({
    borrowerEmail: z.email(),
    principalAmount: z.number().positive(),
    interestRate: z.number().min(0).max(999.99),
    compoundingFrequency: compoundingFrequencySchema,
    repaymentType: repaymentTypeSchema,
    tenureMonths: z.number().int().positive(),
    dueDate: futureDateSchema,
    relationship: z.string().max(100).optional()
  })
  .extend(escalationConfigSchema.shape)

export const loanIdParamSchema = z.object({
  loanId: z.string()
})

export const proposeAmendmentInputSchema = z.object({
  loanId: z.string(),
  principalAmount: z.number().positive(),
  interestRate: z.number().min(0).max(999.99),
  compoundingFrequency: compoundingFrequencySchema,
  tenureMonths: z.number().int().positive(),
  dueDate: futureDateSchema
})

export const amendmentParamSchema = z.object({
  loanId: z.string(),
  amendmentId: z.string()
})

export const createRepaymentInputSchema = z.object({
  loanId: z.string(),
  amount: z.number().positive()
})

export const documentParamSchema = z.object({
  loanId: z.string(),
  documentId: z.string()
})

export const raiseDisputeInputSchema = z.object({
  loanId: z.string(),
  reason: z.string().min(10).max(2000)
})

export const disputeIdParamSchema = z.object({
  disputeId: z.string()
})

export const loanStatusSchema = z.enum([
  "REQUESTED",
  "ACTIVE",
  "OVERDUE",
  "REPAID",
  "DEFAULTED"
])

export const listLoansInputSchema = z.object({
  status: loanStatusSchema.optional()
})
