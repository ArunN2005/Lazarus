import { z } from 'zod'

const envSchema = z.object({
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().default(''),
  CLERK_SECRET_KEY: z.string().default(''),

  // AWS — credentials and region are provided automatically by the Amplify compute role at runtime

  // Bedrock
  BEDROCK_MODEL_SONNET: z.string().default('anthropic.claude-sonnet-4-6'),
  BEDROCK_MODEL_HAIKU: z.string().default('anthropic.claude-haiku-4-5-20251001-v1:0'),

  // DynamoDB
  DYNAMODB_TABLE_NAME: z.string().default('lazarus-jobs'),

  // S3
  S3_BUCKET_REPOS: z.string().default('lazarus-repos-519010179949'),
  S3_BUCKET_GENERATED: z.string().default('lazarus-generated-519010179949'),

  // Secrets Manager
  SECRETS_MANAGER_PREFIX: z.string().default('lazarus'),

  // GitHub — only needed for PR creation
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),

  // Inngest
  INNGEST_EVENT_KEY: z.string().default(''),
  INNGEST_SIGNING_KEY: z.string().default(''),

  // App
  NEXT_PUBLIC_APP_URL: z.string().default(''),

  // Sarvam (speech-to-text)
  SARVAM_API_KEY: z.string().default('sk_e7m6dxrd_CvVbrXUZrtqyp3HwAo7QESKK'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  // Should never happen since all fields have defaults
  console.error('env parse error:', parsed.error.flatten().fieldErrors)
}

const data = parsed.success ? parsed.data : ({} as z.infer<typeof envSchema>)

// Warn about missing critical vars (don't throw — let the app boot so Inngest can sync)
const missing = [
  'INNGEST_EVENT_KEY', 'INNGEST_SIGNING_KEY',
  'DYNAMODB_TABLE_NAME', 'S3_BUCKET_REPOS', 'S3_BUCKET_GENERATED',
  'BEDROCK_MODEL_SONNET', 'BEDROCK_MODEL_HAIKU',
].filter((k) => !process.env[k])
if (missing.length > 0) {
  console.warn('[env] Missing env vars (using defaults):', missing.join(', '))
}

export const env = data
