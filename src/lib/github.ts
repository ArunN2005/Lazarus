import { Octokit } from '@octokit/rest'

type GitHubApiError = Error & {
  status?: number
  response?: {
    data?: {
      message?: string
    }
    headers?: {
      'x-oauth-scopes'?: string
    }
  }
}

export class GitHubPRCreationError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = 'GitHubPRCreationError'
    this.statusCode = statusCode
  }
}

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token })
}

export function parseRepoUrl(url: string): {
  owner: string
  repo: string
} | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/\s#?]+)/,
    /^([^/]+)\/([^/\s]+)$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      }
    }
  }

  return null
}

export async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> {
  const { data } = await octokit.repos.get({ owner, repo })
  return data.default_branch
}

async function getRepoDetails(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<{ defaultBranch: string; isPrivate: boolean }> {
  const { data } = await octokit.repos.get({ owner, repo })
  return {
    defaultBranch: data.default_branch,
    isPrivate: data.private,
  }
}

function hasWriteScope(error: GitHubApiError, isPrivateRepo: boolean): boolean {
  const scopesHeader = error.response?.headers?.['x-oauth-scopes'] ?? ''
  const scopes = scopesHeader
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)

  if (scopes.includes('repo')) {
    return true
  }

  if (!isPrivateRepo && scopes.includes('public_repo')) {
    return true
  }

  return false
}

function hasWriteScopeFromList(scopes: string[], isPrivateRepo: boolean): boolean {
  if (scopes.includes('repo')) {
    return true
  }

  if (!isPrivateRepo && scopes.includes('public_repo')) {
    return true
  }

  return false
}

function headerValueToString(value: string | string[] | undefined): string {
  if (!value) return ''
  return Array.isArray(value) ? value.join(',') : value
}

function parseScopes(scopeHeader: string | string[] | undefined): string[] {
  return headerValueToString(scopeHeader)
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
}

function missingWriteScopeMessage(isPrivateRepo: boolean): string {
  if (isPrivateRepo) {
    return 'GitHub token is missing repo permission for private repository write access. Reconnect GitHub in Clerk with repo scope, then retry PR creation.'
  }

  return 'GitHub token is missing write permission for this repository. Reconnect GitHub in Clerk with public_repo (or repo) scope, then retry PR creation.'
}

async function repoExists(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    await octokit.repos.get({ owner, repo })
    return true
  } catch (error) {
    const githubError = error as GitHubApiError
    if (githubError.status === 404) {
      return false
    }
    throw error
  }
}

export async function createPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  jobId: string,
  files: Map<string, string>
): Promise<string> {
  const { defaultBranch, isPrivate } = await getRepoDetails(octokit, owner, repo)
  const actorResponse = await octokit.users.getAuthenticated()
  const actor = actorResponse.data
  const grantedScopes = parseScopes(actorResponse.headers['x-oauth-scopes'])

  if (!hasWriteScopeFromList(grantedScopes, isPrivate)) {
    throw new GitHubPRCreationError(missingWriteScopeMessage(isPrivate), 403)
  }

  const branchName = `lazarus-resurrection-${jobId.slice(0, 8)}`
  let head = branchName

  try {
    await upsertBranchWithFiles(
      octokit,
      owner,
      repo,
      defaultBranch,
      branchName,
      files
    )
  } catch (error) {
    const githubError = error as GitHubApiError

    // If we cannot push directly to upstream, attempt fork-based PR flow.
    if (githubError.status === 403 || githubError.status === 404) {
      if (!hasWriteScope(githubError, isPrivate)) {
        throw new GitHubPRCreationError(missingWriteScopeMessage(isPrivate), 403)
      }

      try {
        await octokit.repos.createFork({ owner, repo })
      } catch (forkError) {
        const forkApiError = forkError as GitHubApiError
        if (!hasWriteScope(forkApiError, isPrivate)) {
          throw new GitHubPRCreationError(missingWriteScopeMessage(isPrivate), 403)
        }

        // 422 can happen if a fork already exists.
        if (forkApiError.status !== 422) {
          const forkAlreadyExists = await repoExists(octokit, actor.login, repo)
          if (!forkAlreadyExists) {
            throw new GitHubPRCreationError(
              'Unable to create or access a fork for PR creation. Ensure forking is allowed and this account has repository write permissions.',
              403
            )
          }
        }
      }

      await waitForFork(octokit, actor.login, repo)

      const forkDefaultBranch = await getDefaultBranch(octokit, actor.login, repo)
      await upsertBranchWithFiles(
        octokit,
        actor.login,
        repo,
        forkDefaultBranch,
        branchName,
        files
      )

      head = `${actor.login}:${branchName}`
    } else {
      throw error
    }
  }

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: 'Lazarus: Modernize legacy codebase',
    body: [
      '## Lazarus Resurrection',
      '',
      'This PR was automatically generated by [Lazarus](https://lazarus.dev) — the legacy code resurrection engine.',
      '',
      '### What changed',
      '- Updated deprecated packages to modern equivalents',
      '- Converted to TypeScript where applicable',
      '- Modernized framework patterns (hooks, composition API, etc.)',
      '- Added security improvements (helmet, CORS, rate limiting)',
      '',
      '> All original functionality has been preserved.',
    ].join('\n'),
    head,
    base: defaultBranch,
  })

  return pr.html_url
}

async function upsertBranchWithFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  baseBranch: string,
  branchName: string,
  files: Map<string, string>
): Promise<void> {
  const { data: baseRefData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  })

  let parentSha = baseRefData.object.sha

  try {
    const { data: existingBranchRef } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    })
    parentSha = existingBranchRef.object.sha
  } catch (error) {
    const githubError = error as GitHubApiError
    if (githubError.status !== 404) {
      throw error
    }

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: parentSha,
    })
  }

  const blobs = await Promise.all(
    Array.from(files.entries()).map(async ([path, content]) => {
      const { data } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(content).toString('base64'),
        encoding: 'base64',
      })
      return { path, sha: data.sha, mode: '100644' as const, type: 'blob' as const }
    })
  )

  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: parentSha,
    tree: blobs,
  })

  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: `Lazarus: modernize codebase\n\nAutomatically modernized by Lazarus resurrection engine.`,
    tree: tree.sha,
    parents: [parentSha],
  })

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
    sha: commit.sha,
    force: true,
  })
}

async function waitForFork(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<void> {
  const maxAttempts = 12
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await octokit.repos.get({ owner, repo })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  throw new GitHubPRCreationError(
    'GitHub fork is not ready yet. Please try creating the PR again in a few seconds.',
    409
  )
}

export async function getUserRepos(
  octokit: Octokit
): Promise<
  Array<{
    fullName: string
    name: string
    owner: string
    private: boolean
    language: string | null
    updatedAt: string
  }>
> {
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 50,
  })

  return data.map((repo) => ({
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner.login,
    private: repo.private,
    language: repo.language,
    updatedAt: repo.updated_at ?? '',
  }))
}
