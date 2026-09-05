export function hasReachedMaxSteps(currentStep: number, maxSteps: number): boolean {
  return currentStep >= maxSteps
}

export function isCooldownElapsed(
  lastSentAt: Date | null,
  cooldownHours: number,
  now: Date
): boolean {
  if (!lastSentAt) {
    return true
  }

  const cooldownElapsedMs = cooldownHours * 60 * 60 * 1000

  return now.getTime() - lastSentAt.getTime() >= cooldownElapsedMs
}

export function selectReminderLanguage(relationship: string | null): string {
  return relationship ? "hi-en" : "en"
}

export function buildFallbackReminderMessage(principalAmount: unknown): string {
  return `This is a reminder that your loan of ${String(principalAmount)} is overdue. Please arrange repayment at your earliest convenience.`
}
