import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUserId } from '@/lib/dev-auth'
import { inngest } from '@/lib/inngest-client'
import { getJob } from '@/lib/dynamodb'
import { storeEnvVars } from '@/lib/secrets'

const resurrectSchema = z.object({
  jobId: z.string().uuid(),
  answers: z.record(z.string()).default({}),
  envVars: z.record(z.string()).default({}),
  migrationOptions: z.array(z.string()).default([]),
  additionalRequirements: z.string().default(''),
})

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = resurrectSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const job = await getJob(parsed.data.jobId)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (Object.keys(parsed.data.envVars).length > 0) {
    await storeEnvVars(parsed.data.jobId, parsed.data.envVars)
  }

  // Merge migration options + additional requirements into answers
  const mergedAnswers = { ...parsed.data.answers }
  if (parsed.data.migrationOptions.length > 0) {
    mergedAnswers['__migrationOptions'] = parsed.data.migrationOptions.join(', ')
  }
  if (parsed.data.additionalRequirements.trim()) {
    mergedAnswers['__additionalRequirements'] = parsed.data.additionalRequirements.trim()
  }

  await inngest.send({
    name: 'lazarus/resurrection.requested',
    data: {
      jobId: parsed.data.jobId,
      answers: mergedAnswers,
    },
  })

  return NextResponse.json({ status: 'started' })
}
