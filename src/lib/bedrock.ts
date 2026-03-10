import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { env } from '@/lib/env'
import { PRICING, type BedrockModel } from '@/types'

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

interface StreamOptions {
  model: 'sonnet' | 'haiku'
  system: string
  userMessage: string
  maxTokens?: number
  onToken: (token: string) => Promise<void>
  onComplete?: (usage: { inputTokens: number; outputTokens: number }) => void
}

export async function streamBedrock({
  model,
  system,
  userMessage,
  maxTokens = 128000,
  onToken,
  onComplete,
}: StreamOptions): Promise<void> {
  const modelId =
    model === 'sonnet' ? env.BEDROCK_MODEL_SONNET : env.BEDROCK_MODEL_HAIKU

  const response = await bedrockClient.send(
    new InvokeModelWithResponseStreamCommand({
      modelId,
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
      contentType: 'application/json',
      accept: 'application/json',
    })
  )

  let inputTokens = 0
  let outputTokens = 0

  if (response.body) {
    for await (const chunk of response.body) {
      if (chunk.chunk?.bytes) {
        const parsed = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes))

        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          await onToken(parsed.delta.text)
        }

        if (parsed.type === 'message_delta' && parsed.usage) {
          outputTokens = parsed.usage.output_tokens
        }

        if (parsed.type === 'message_start' && parsed.message?.usage) {
          inputTokens = parsed.message.usage.input_tokens
        }
      }
    }
  }

  onComplete?.({ inputTokens, outputTokens })
}

export function calculateCost(
  model: BedrockModel,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
): number {
  const pricing = PRICING[model]
  return (
    (inputTokens * pricing.input +
      outputTokens * pricing.output +
      cachedTokens * pricing.cached) /
    1_000_000
  )
}

export async function invokeBedrockSync(
  model: 'sonnet' | 'haiku',
  system: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<string> {
  let result = ''
  await streamBedrock({
    model,
    system,
    userMessage,
    maxTokens,
    onToken: async (token) => {
      result += token
    },
  })
  return result
}
