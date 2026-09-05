import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { createOpenAI } from "@ai-sdk/openai"
import { createXai } from "@ai-sdk/xai"
import type { LanguageModel } from "ai"

export const PROVIDER_IDS = ["claude", "openai", "gemini", "grok", "kimi"] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

type ProviderKeys = Record<ProviderId, string | undefined>
type ProviderModelIds = Partial<Record<ProviderId, string>>

const DEFAULT_MODEL_IDS: Record<ProviderId, string> = {
  claude: "claude-sonnet-5",
  openai: "gpt-5.4",
  gemini: "gemini-3-flash",
  grok: "grok-4",
  kimi: "kimi-k3"
}

export function createProviderRegistry(
  keys: ProviderKeys,
  modelIds: ProviderModelIds = {}
): Partial<Record<ProviderId, LanguageModel>> {
  const registry: Partial<Record<ProviderId, LanguageModel>> = {}

  if (keys.claude) {
    registry.claude = createAnthropic({ apiKey: keys.claude })(
      modelIds.claude ?? DEFAULT_MODEL_IDS.claude
    )
  }

  if (keys.openai) {
    registry.openai = createOpenAI({ apiKey: keys.openai })(
      modelIds.openai ?? DEFAULT_MODEL_IDS.openai
    )
  }

  if (keys.gemini) {
    registry.gemini = createGoogleGenerativeAI({ apiKey: keys.gemini })(
      modelIds.gemini ?? DEFAULT_MODEL_IDS.gemini
    )
  }

  if (keys.grok) {
    registry.grok = createXai({ apiKey: keys.grok })(
      modelIds.grok ?? DEFAULT_MODEL_IDS.grok
    )
  }

  if (keys.kimi) {
    registry.kimi = createOpenAICompatible({
      name: "kimi",
      apiKey: keys.kimi,
      baseURL: "https://api.moonshot.ai/v1"
    })(modelIds.kimi ?? DEFAULT_MODEL_IDS.kimi)
  }

  return registry
}
