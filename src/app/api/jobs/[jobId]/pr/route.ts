import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getJob } from '@/lib/dynamodb'
import { getAllGeneratedFiles } from '@/lib/s3'
import { createOctokit, createPR, GitHubPRCreationError } from '@/lib/github'

type GitHubApiError = Error & {
  status?: number
  response?: {
    data?: {
      message?: string
    }
    headers?: {
      'x-oauth-scopes'?: string
      'x-accepted-oauth-scopes'?: string
    }
  }
}

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

  let githubToken: string | undefined
  try {
    const clerk = await clerkClient()
    const tokenResponse = await clerk.users.getUserOauthAccessToken(
      userId,
      'oauth_github'
    )
    githubToken = tokenResponse.data[0]?.token
  } catch (error) {
    console.error('Clerk OAuth Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: `Clerk OAuth Error: ${message}` },
      { status: 500 }
    )
  }

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

  try {
    const prUrl = await createPR(
      octokit,
      job.repoOwner,
      job.repoName,
      job.jobId,
      generatedFiles
    )

    return NextResponse.json({ prUrl })
  } catch (error) {
    if (error instanceof GitHubPRCreationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

    const githubError = error as GitHubApiError
    const acceptedScopes = githubError.response?.headers?.['x-accepted-oauth-scopes'] ?? ''
    const grantedScopes = githubError.response?.headers?.['x-oauth-scopes'] ?? ''
    const missingRepoScope =
      acceptedScopes.includes('repo') && !grantedScopes.includes('repo')

    if (missingRepoScope) {
      return NextResponse.json(
        {
          error:
            'GitHub token is missing repo permission. Reconnect GitHub in Clerk with repo scope, then retry PR creation.',
        },
        { status: 403 }
      )
    }

    if (githubError.status === 403 || githubError.status === 404) {
      return NextResponse.json(
        {
          error:
            'Unable to create PR due to GitHub repository access restrictions. Ensure this account can push or fork the repository and has repo scope.',
        },
        { status: 403 }
      )
    }

    console.error('PR creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create pull request' },
      { status: 500 }
    )
  }
}
