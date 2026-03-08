import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { getAuthUserId } from '@/lib/dev-auth'
import { getJob } from '@/lib/dynamodb'
import { getAllRepoFiles } from '@/lib/s3'
import { createOctokit, createPR } from '@/lib/github'

export async function POST(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const userId = getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = await getJob(params.jobId)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (job.status !== 'complete') {
    return NextResponse.json(
      { error: 'Resurrection must be complete before creating a PR' },
      { status: 400 }
    )
  }

  const clerk = await clerkClient()
  const user = await clerk.users.getUser(userId)
  const githubAccount = user.externalAccounts.find(
    (a) => a.provider === 'oauth_github'
  )

  if (!githubAccount) {
    return NextResponse.json(
      { error: 'No GitHub account connected' },
      { status: 400 }
    )
  }

  // Get GitHub OAuth token from Clerk
  const tokenResponse = await clerk.users.getUserOauthAccessToken(
    userId,
    'oauth_github'
  )
  const githubToken = tokenResponse.data[0]?.token

  if (!githubToken) {
    return NextResponse.json(
      { error: 'Could not get GitHub token' },
      { status: 400 }
    )
  }

  const octokit = createOctokit(githubToken)

  // Get all generated files from S3
  const generatedFiles = await getAllRepoFiles(params.jobId)

  const prUrl = await createPR(
    octokit,
    job.repoOwner,
    job.repoName,
    job.jobId,
    generatedFiles
  )

  return NextResponse.json({ prUrl })
}
