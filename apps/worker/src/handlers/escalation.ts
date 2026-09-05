import type { Job } from "bullmq"
import { generateText } from "ai"
import { createProviderRegistry, isProviderHealthy, PROVIDER_IDS } from "@repo/ai"
import { database } from "@repo/database"
import type { EscalationJob } from "@repo/queue"
import { createMailer } from "@repo/mail"
import { getRedisClient } from "@repo/redis"
import { env } from "../env"
import {
  buildFallbackReminderMessage,
  hasReachedMaxSteps,
  isCooldownElapsed,
  selectReminderLanguage
} from "./escalation-rules"

const redis = getRedisClient(env.REDIS_URL)

const registry = createProviderRegistry({
  claude: env.ANTHROPIC_API_KEY,
  openai: env.OPENAI_API_KEY,
  gemini: env.GOOGLE_API_KEY,
  grok: env.XAI_API_KEY,
  kimi: env.KIMI_API_KEY
})

const sendEmail = createMailer({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  user: env.SMTP_USER,
  password: env.SMTP_PASSWORD
})

async function pickHealthyProvider() {
  for (const providerId of PROVIDER_IDS) {
    const model = registry[providerId]

    if (model && (await isProviderHealthy(redis, providerId))) {
      return { providerId, model }
    }
  }

  return null
}

type ReminderDraft = {
  message: string
  language: string
  reasoning: string
}

async function draftReminder(
  relationship: string | null,
  principalAmount: unknown,
  escalationStep: number
): Promise<ReminderDraft> {
  const chosen = await pickHealthyProvider()

  const fallback: ReminderDraft = {
    message: buildFallbackReminderMessage(principalAmount),
    language: "en",
    reasoning: "No healthy AI provider available, used a plain fallback template."
  }

  if (!chosen) {
    return fallback
  }

  const relationshipContext = relationship
    ? `The lender described their relationship to the borrower as: "${relationship}".`
    : "No relationship context was given."

  const prompt = `You are drafting a short, respectful payment reminder for a personal loan between two people who know each other, not a bank collections message. Principal amount: ${String(principalAmount)}. This is escalation step ${escalationStep}, so tone should get incrementally firmer with each step while staying respectful. ${relationshipContext} If the relationship suggests a casual/family tone, write in natural Hinglish (Hindi-English mix, romanized). Otherwise write in plain English. Respond with just the message text, nothing else.`

  try {
    const result = await generateText({ model: chosen.model, prompt })

    return {
      message: result.text,
      language: selectReminderLanguage(relationship),
      reasoning: `Drafted by ${chosen.providerId} at escalation step ${escalationStep}, tone informed by relationship context.`
    }
  } catch {
    return fallback
  }
}

async function transitionOverdueLoans(): Promise<number> {
  const result = await database.loan.updateMany({
    where: {
      status: "ACTIVE",
      dueDate: { lt: new Date() }
    },
    data: { status: "OVERDUE" }
  })

  return result.count
}

async function runEscalationSweep(): Promise<void> {
  const transitioned = await transitionOverdueLoans()

  if (transitioned > 0) {
    console.log(`transitioned ${transitioned} loan(s) to OVERDUE`)
  }

  const now = new Date()

  const eligibleLoans = await database.loan.findMany({
    where: {
      status: "OVERDUE",
      escalationState: {
        isHalted: false
      }
    },
    include: {
      escalationState: true,
      borrower: true
    }
  })

  const notificationsToCreate: Array<{
    loanId: string
    type: "ESCALATION"
    channel: string
    language: string
    reasoning: string
    escalationStep: number
    traceId: string
  }> = []

  const escalationUpdates: Array<{
    loanId: string
    currentStep: number
    lastSentAt: Date
  }> = []

  for (const loan of eligibleLoans) {
    const state = loan.escalationState

    if (!state) {
      continue
    }

    if (hasReachedMaxSteps(state.currentStep, state.maxSteps)) {
      await database.escalationState.update({
        where: { loanId: loan.id },
        data: {
          isHalted: true,
          haltedReason: "MAX_ATTEMPTS_REACHED",
          haltedAt: now
        }
      })
      continue
    }

    const cooldownOk = isCooldownElapsed(state.lastSentAt, state.cooldownHours, now)

    if (!cooldownOk) {
      continue
    }

    const nextStep = state.currentStep + 1
    const draft = await draftReminder(
      loan.relationship,
      loan.principalAmount,
      nextStep
    )

    await sendEmail({
      to: loan.borrower.email,
      subject: "Payment reminder",
      html: `<p>${draft.message}</p>`
    }).catch((error: unknown) => {
      console.error(`failed to send escalation email for loan ${loan.id}`, error)
    })

    notificationsToCreate.push({
      loanId: loan.id,
      type: "ESCALATION",
      channel: "email",
      language: draft.language,
      reasoning: draft.reasoning,
      escalationStep: nextStep,
      traceId: `escalation-sweep-${now.toISOString()}`
    })

    escalationUpdates.push({
      loanId: loan.id,
      currentStep: nextStep,
      lastSentAt: now
    })
  }

  if (notificationsToCreate.length > 0) {
    await database.notification.createMany({ data: notificationsToCreate })
  }

  if (escalationUpdates.length > 0) {
    await database.$transaction(
      escalationUpdates.map((update) =>
        database.escalationState.update({
          where: { loanId: update.loanId },
          data: {
            currentStep: update.currentStep,
            lastSentAt: update.lastSentAt
          }
        })
      )
    )
  }
}

export async function handleEscalationCheck(
  _job: Job<EscalationJob>
): Promise<void> {
  await runEscalationSweep()
}
