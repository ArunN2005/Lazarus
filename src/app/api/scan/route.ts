import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { inngest } from '@/lib/inngest-client'
import { parseRepoUrl } from '@/lib/github'
import { getAuthUserId } from '@/lib/dev-auth'
import crypto from 'crypto'

const scanSchema = z.object({
  repoUrl: z.string().url().refine(
    (url) => url.includes('github.com'),
    'Must be a GitHub URL'
  ),
})

export async function POST(req: NextRequest) {
  const userId = getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = scanSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const repoInfo = parseRepoUrl(parsed.data.repoUrl)
  if (!repoInfo) {
    return NextResponse.json(
      { error: 'Could not parse GitHub URL' },
      { status: 400 }
    )
  }

  const jobId = crypto.randomUUID()

  // Always use the canonical clone URL — strips /tree/branch, /blob/..., query params, etc.
  const cloneUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}`

  await inngest.send({
    name: 'lazarus/scan.requested',
    data: {
      jobId,
      repoUrl: cloneUrl,
      userId,
      repoOwner: repoInfo.owner,
      repoName: repoInfo.repo,
    },
  })

  return NextResponse.json({ jobId })
}
