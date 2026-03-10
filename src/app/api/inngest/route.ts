import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest-client'
import { functions } from '@/inngest'

export const maxDuration = 900

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  // Explicit fallback so sync works even if INNGEST_SIGNING_KEY isn't in Lambda env
  signingKey: process.env.INNGEST_SIGNING_KEY ?? 'signkey-prod-47413fd16e6d60625d7e56ec4646d29de9a6b6bd5c28023a5c396a7a4b07de36',
})
