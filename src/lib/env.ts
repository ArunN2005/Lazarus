import { z } from 'zod'

const envSchema = z.object({
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),

  // AWS — credentials and region are provided automatically by the Amplify compute role at runtime

  // Bedrock
  BEDROCK_MODEL_SONNET: z.string().min(1),
  BEDROCK_MODEL_HAIKU: z.string().min(1),

  // DynamoDB
  DYNAMODB_TABLE_NAME: z.string().min(1),

  // S3
  S3_BUCKET_REPOS: z.string().min(1),
  S3_BUCKET_GENERATED: z.string().min(1),

  // Secrets Manager — only needed for user ENV vars in resurrected apps
  SECRETS_MANAGER_PREFIX: z.string().default('lazarus'),

  // GitHub — only needed for PR creation; optional so app boots without a GitHub OAuth App
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),

  // Inngest
  INNGEST_EVENT_KEY: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Sarvam (speech-to-text) — optional, has fallback default
  SARVAM_API_KEY: z.string().default('sk_e7m6dxrd_CvVbrXUZrtqyp3HwAo7QESKK'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Missing or invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables — check .env.local')
}

export const env = parsed.data
