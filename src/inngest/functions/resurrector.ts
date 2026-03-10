import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { inngest } from '@/lib/inngest-client'
import { getJob, updateJob, pushStreamEvent, clearStreamEvents } from '@/lib/dynamodb'
import { getAllRepoFiles, listRepoBinaryAssets, getRepoBinaryAssetUrl, uploadPromptFile } from '@/lib/s3'
import {
  buildResurrectionPrompt,
  buildSystemPromptWithContext,
} from '@/lib/migration-prompt'

export const resurrector = inngest.createFunction(
  {
    id: 'resurrector',
    name: 'Resurrect Repository',
    retries: 2,
    cancelOn: [{ event: 'lazarus/resurrection.cancelled', match: 'data.jobId' }],
  },
  { event: 'lazarus/resurrection.requested' },
  async ({ event, step }) => {
    const { jobId } = event.data as {
      jobId: string
      answers: Record<string, string>
    }

    const job = await step.run('load-job', async () => {
      const j = await getJob(jobId)
      if (!j) throw new Error(`Job ${jobId} not found`)
      return j
    })

    await step.run('update-status', async () => {
      await clearStreamEvents(jobId)
      await updateJob(jobId, { status: 'resurrecting' })
    })

    // Only return small metadata — file contents stay in S3
    const binaryAssets = await step.run('load-files', async () => {
      const paths = await listRepoBinaryAssets(jobId)
      const entries = await Promise.all(
        paths.map(async (p) => [p, await getRepoBinaryAssetUrl(jobId, p)] as [string, string])
      )
      return Object.fromEntries(entries) as Record<string, string>
    })

    // Build the Bedrock prompts and upload to S3 so the Lambda can read them.
    // This runs well within the 29s API Gateway limit (string-building only).
    await step.run('prepare-prompt', async () => {
      const repoFiles = await getAllRepoFiles(jobId)
      const techStackStr = job.techStack
        ? Object.entries(job.techStack)
            .filter(([, v]) => v !== null && v !== 'unknown')
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        : 'Unknown'

      const systemPrompt = buildSystemPromptWithContext(
        techStackStr,
        job.clarificationAnswers
      )
      const userMessage = buildResurrectionPrompt(
        repoFiles,
        techStackStr,
        job.clarificationAnswers,
        new Map(Object.entries(binaryAssets))
      )

      await Promise.all([
        uploadPromptFile(jobId, 'system', systemPrompt),
        uploadPromptFile(jobId, 'user', userMessage),
      ])
    })

    // Fire the generation Lambda asynchronously — returns in ~100ms.
    // The Lambda runs Bedrock streaming (up to 15 min) and writes results to DynamoDB/S3.
    await step.run('invoke-generation', async () => {
      const lambdaClient = new LambdaClient({
        region: process.env.AWS_REGION ?? 'us-east-1',
      })
      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: process.env.GENERATION_LAMBDA_ARN ?? 'lazarus-generate',
          InvocationType: 'Event', // async — does not wait for result
          Payload: Buffer.from(JSON.stringify({ jobId })),
        })
      )
    })

    // Poll DynamoDB every 30s until the Lambda signals completion (max 15 min = 30 × 30s).
    // step.sleep() suspends the Inngest function without holding a Lambda connection open.
    let generationComplete = false
    for (let i = 0; i < 30 && !generationComplete; i++) {
      await step.sleep(`poll-generation-${i}`, '30s')
      generationComplete = await step.run(`check-generation-${i}`, async () => {
        const j = await getJob(jobId)
        if (j?.status === 'generation_failed') {
          throw new Error('Generation Lambda failed — check Lambda CloudWatch logs')
        }
        return j?.status === 'generation_complete'
      })
    }

    if (!generationComplete) {
      throw new Error('Generation timed out after 15 minutes')
    }

    await step.run('finalize', async () => {
      await updateJob(jobId, {
        status: 'complete',
        completedAt: new Date().toISOString(),
      })
      void pushStreamEvent(jobId, { type: 'complete' })
    })
  }
)
