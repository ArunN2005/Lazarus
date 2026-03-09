import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getJob } from '@/lib/dynamodb'
import { getAllGeneratedFiles } from '@/lib/s3'
import { createOctokit, createPR } from '@/lib/github'

export async function POST(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  // Always use real Clerk auth for PR creation — we need the actual GitHub OAuth token
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = await getJob(params.jobId)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.status !== 'complete') {
    return NextResponse.json(
      { error: 'Resurrection must be complete before creating a PR' },
      { status: 400 }
    )
  }

  const clerk = clerkClient()

  // Get GitHub OAuth token from Clerk
  const tokenResponse = await clerk.users.getUserOauthAccessToken(
    userId,
    'oauth_github'
  )
  const githubToken = tokenResponse.data[0]?.token

  if (!githubToken) {
    return NextResponse.json(
      { error: 'No GitHub token found — make sure your GitHub account is connected in Clerk' },
      { status: 400 }
    )
  }

  const octokit = createOctokit(githubToken)

  // Get the generated (modernized) files from S3
  const generatedFiles = await getAllGeneratedFiles(params.jobId)

  if (generatedFiles.size === 0) {
    return NextResponse.json(
      { error: 'No generated files found for this job' },
      { status: 400 }
    )
  }

  const prUrl = await createPR(
    octokit,
    job.repoOwner,
    job.repoName,
    job.jobId,
    generatedFiles
  )

  return NextResponse.json({ prUrl })
}
