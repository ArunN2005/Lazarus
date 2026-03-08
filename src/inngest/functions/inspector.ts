import { inngest } from '@/lib/inngest-client'
import { createJob, updateJob } from '@/lib/dynamodb'
import { uploadRepoFile, uploadRepoBinaryAsset } from '@/lib/s3'
import { invokeBedrockSync } from '@/lib/bedrock'
import type { TechStack, FileTreeNode } from '@/types'
import path from 'path'

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '__pycache__',
  '.venv',
  'venv',
  'vendor',
  'webfonts',  // SVG font files are massive and useless for modernization
  'fonts',
])

const IGNORED_EXTENSIONS = new Set([
  '.min.js',
  '.min.css',
  '.map',
  '.lock',
  // binary images — handled separately by readBinaryAssets
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  // SVG — font SVGs are massive and tokenize extremely poorly; not needed for modernization
  '.svg',
  // fonts & media — not useful in WebContainers
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp3',
  '.mp4',
  '.zip',
  '.tar',
  '.gz',
])

// Binary image formats we extract and pass through unchanged
const BINARY_IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp',
])

const BINARY_IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
}

function shouldIgnoreFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  if (IGNORED_EXTENSIONS.has(ext)) return true
  if (filePath.endsWith('.min.js') || filePath.endsWith('.min.css')) return true
  return false
}

interface GitHubTreeItem {
  path: string
  type: string
  size?: number
  sha: string
}

async function fetchRepoViaGitHubAPI(
  owner: string,
  repo: string,
): Promise<{
  files: Map<string, string>
  binaryAssets: Map<string, { data: Buffer; contentType: string }>
}> {
  const headers = {
    'User-Agent': 'lazarus-app',
    'Accept': 'application/vnd.github+json',
  }

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
  if (!repoRes.ok) throw new Error(`GitHub API error ${repoRes.status}: ${await repoRes.text()}`)
  const repoData = await repoRes.json() as { default_branch: string }
  const defaultBranch = repoData.default_branch

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers }
  )
  if (!treeRes.ok) throw new Error(`GitHub tree API error ${treeRes.status}: ${await treeRes.text()}`)
  const treeData = await treeRes.json() as { tree: GitHubTreeItem[]; truncated: boolean }

  const blobs = treeData.tree.filter((item) => item.type === 'blob')

  const files = new Map<string, string>()
  const binaryAssets = new Map<string, { data: Buffer; contentType: string }>()

  const BATCH_SIZE = 20
  for (let i = 0; i < blobs.length; i += BATCH_SIZE) {
    const batch = blobs.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (item) => {
        const filePath = item.path
        const parts = filePath.split('/')
        if (parts.some((p) => IGNORED_DIRS.has(p))) return

        const ext = path.extname(filePath).toLowerCase()
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${filePath}`

        if (BINARY_IMAGE_EXTENSIONS.has(ext)) {
          if ((item.size ?? 0) > 5_000_000) return
          const res = await fetch(rawUrl)
          if (!res.ok) return
          const buf = Buffer.from(await res.arrayBuffer())
          const contentType = BINARY_IMAGE_CONTENT_TYPES[ext] ?? 'application/octet-stream'
          binaryAssets.set(filePath, { data: buf, contentType })
          return
        }

        if (shouldIgnoreFile(filePath)) return
        if ((item.size ?? 0) > 500_000) return

        const res = await fetch(rawUrl)
        if (!res.ok) return
        const content = await res.text()
        files.set(filePath, content)
      })
    )
  }

  return { files, binaryAssets }
}

function detectTechStack(files: Map<string, string>): TechStack {
  const hasFile = (name: string) => files.has(name)
  const anyFileContains = (pattern: string) =>
    Array.from(files.values()).some((content) => content.includes(pattern))

  // Package manager
  let packageManager: TechStack['packageManager'] = 'unknown'
  if (hasFile('bun.lockb')) packageManager = 'bun'
  else if (hasFile('pnpm-lock.yaml')) packageManager = 'pnpm'
  else if (hasFile('yarn.lock')) packageManager = 'yarn'
  else if (hasFile('package-lock.json')) packageManager = 'npm'

  // Frontend framework
  let frontend: string | null = null
  if (hasFile('next.config.js') || hasFile('next.config.ts') || hasFile('next.config.mjs'))
    frontend = 'nextjs'
  else if (hasFile('nuxt.config.ts') || hasFile('nuxt.config.js'))
    frontend = 'nuxt'
  else if (hasFile('svelte.config.js')) frontend = 'sveltekit'
  else if (hasFile('angular.json')) frontend = 'angular'
  else if (anyFileContains('createRoot(')) frontend = 'react-18'
  else if (anyFileContains('ReactDOM.render(')) frontend = 'react-legacy'
  else if (anyFileContains('createApp(') && Array.from(files.keys()).some((k) => k.endsWith('.vue')))
    frontend = 'vue3'
  else if (Array.from(files.keys()).some((k) => k.endsWith('.vue')))
    frontend = 'vue2'
  else if (
    !hasFile('package.json') &&
    Array.from(files.keys()).some((k) => k.endsWith('.html'))
  )
    frontend = 'plain-html'

  // Backend
  let backend: string | null = null
  if (anyFileContains('FastAPI()')) backend = 'fastapi'
  else if (anyFileContains('Flask(')) backend = 'flask'
  else if (hasFile('manage.py')) backend = 'django'
  else if (anyFileContains('app.listen(')) backend = 'express'
  else if (hasFile('config/routes.rb')) backend = 'rails'
  else if (Array.from(files.keys()).some((k) => k.endsWith('.php'))) backend = 'php'
  else if (hasFile('go.mod')) backend = 'go'
  else if (hasFile('pom.xml') || hasFile('build.gradle')) backend = 'java'

  // Language
  let language: TechStack['language'] = 'unknown'
  if (hasFile('tsconfig.json')) language = 'typescript'
  else if (hasFile('package.json')) language = 'javascript'
  else if (Array.from(files.keys()).some((k) => k.endsWith('.py')))
    language = 'python'
  else if (Array.from(files.keys()).some((k) => k.endsWith('.rb')))
    language = 'ruby'
  else if (Array.from(files.keys()).some((k) => k.endsWith('.js') || k.endsWith('.html')))
    language = 'javascript'

  // Database
  let database: string | null = null
  const pkgJson = files.get('package.json') ?? ''
  if (pkgJson.includes('mongoose') || pkgJson.includes('mongodb'))
    database = 'mongodb'
  else if (pkgJson.includes('pg') || pkgJson.includes('postgres'))
    database = 'postgresql'
  else if (pkgJson.includes('mysql')) database = 'mysql'
  else if (pkgJson.includes('sqlite')) database = 'sqlite'
  else if (pkgJson.includes('prisma')) database = 'prisma'

  // CSS
  let cssFramework: string | null = null
  if (pkgJson.includes('tailwindcss') || hasFile('tailwind.config.js'))
    cssFramework = 'tailwind'
  else if (pkgJson.includes('bootstrap')) cssFramework = 'bootstrap'
  else if (pkgJson.includes('styled-components'))
    cssFramework = 'styled-components'
  else if (pkgJson.includes('node-sass') || pkgJson.includes('sass'))
    cssFramework = 'sass'

  // Test
  let testFramework: string | null = null
  if (pkgJson.includes('jest')) testFramework = 'jest'
  else if (pkgJson.includes('vitest')) testFramework = 'vitest'
  else if (pkgJson.includes('mocha')) testFramework = 'mocha'
  else if (hasFile('pytest.ini') || hasFile('setup.cfg'))
    testFramework = 'pytest'

  return {
    packageManager,
    frontend,
    backend,
    language,
    database,
    cssFramework,
    testFramework,
  }
}

interface ValidationResult {
  rejected: boolean
  reason: string | null
}

function validateRepo(files: Map<string, string>): ValidationResult {
  const fileKeys = Array.from(files.keys())

  // Unity
  if (
    fileKeys.some((k) => k.startsWith('Assets/')) &&
    fileKeys.some((k) => k.endsWith('.unity'))
  )
    return { rejected: true, reason: 'Unity projects are not supported.' }

  // Unreal
  if (fileKeys.some((k) => k.endsWith('.uproject')))
    return { rejected: true, reason: 'Unreal Engine projects are not supported.' }

  // iOS
  if (
    fileKeys.some((k) => k.endsWith('.xcodeproj') || k.includes('.xcodeproj/')) &&
    fileKeys.some((k) => k.endsWith('.swift')) &&
    !fileKeys.some((k) => k.includes('server') || k.includes('api'))
  )
    return { rejected: true, reason: 'iOS-only apps are not supported.' }

  // Android
  if (
    fileKeys.some((k) => k.includes('AndroidManifest.xml')) &&
    fileKeys.some((k) => k.includes('build.gradle')) &&
    !fileKeys.some((k) => k.includes('server') || k.includes('api'))
  )
    return { rejected: true, reason: 'Android-only apps are not supported.' }

  // Electron
  const pkgJson = files.get('package.json') ?? ''
  if (pkgJson.includes('BrowserWindow') || pkgJson.includes('"electron"'))
    return { rejected: true, reason: 'Electron apps are not supported.' }

  // Browser extension
  const manifest = files.get('manifest.json')
  if (manifest && manifest.includes('manifest_version'))
    return { rejected: true, reason: 'Browser extensions are not supported.' }

  // React Native
  if (
    pkgJson.includes('react-native') ||
    (files.has('app.json') && (files.get('app.json') ?? '').includes('expo'))
  )
    return { rejected: true, reason: 'React Native apps are not supported.' }

  // WordPress
  const styleCSS = files.get('style.css') ?? ''
  if (
    styleCSS.includes('Theme Name:') ||
    Array.from(files.values()).some((c) => c.includes('Plugin Name:'))
  )
    return { rejected: true, reason: 'WordPress themes/plugins are not supported.' }

  // Too few files
  if (files.size < 3)
    return { rejected: true, reason: 'Repository has fewer than 3 source files.' }

  return { rejected: false, reason: null }
}

interface RepoAnalysis {
  legacyScore: number
  weaknesses: string[]
}

function analyzeRepo(techStack: TechStack, files: Map<string, string>, envVars: string[]): RepoAnalysis {
  const weaknesses: string[] = []
  let score = 0

  const pkgJson = files.get('package.json') ?? ''

  // Frontend framework age
  if (techStack.frontend === 'plain-html') {
    score += 30; weaknesses.push('No framework — raw HTML / CSS / jQuery')
  } else if (techStack.frontend === 'react-legacy') {
    score += 20; weaknesses.push('React 16/17 — deprecated ReactDOM.render() API')
  } else if (techStack.frontend === 'angular') {
    score += 20; weaknesses.push('Angular — heavily legacy framework')
  } else if (techStack.frontend === 'vue2') {
    score += 15; weaknesses.push('Vue 2 — unsupported since December 2023')
  }

  // Language
  if (techStack.language !== 'typescript') {
    score += 15; weaknesses.push('No TypeScript — no static type safety')
  }

  // CSS
  if (techStack.cssFramework === 'bootstrap') {
    score += 10; weaknesses.push('Bootstrap CSS — heavy, non-utility-first styling')
  } else if (techStack.cssFramework === 'sass') {
    score += 5; weaknesses.push('Sass/SCSS only — no utility classes')
  } else if (!techStack.cssFramework) {
    score += 8; weaknesses.push('No CSS framework detected')
  }

  // Tests
  if (!techStack.testFramework) {
    score += 8; weaknesses.push('No test framework found')
  }

  // WebContainer incompatible native dependency
  if (pkgJson.includes('"bcrypt"')) {
    score += 20; weaknesses.push('bcrypt — native binary, incompatible with WebContainers')
  }

  // Backend
  if (techStack.backend === 'php') {
    score += 15; weaknesses.push('PHP backend — requires full language rewrite')
  }

  // No lockfile
  if (techStack.packageManager === 'unknown' && files.has('package.json')) {
    score += 5; weaknesses.push('No lockfile — dependency versions not pinned')
  }

  // No README
  if (!files.has('README.md') && !files.has('readme.md')) {
    score += 5; weaknesses.push('No README — documentation missing')
  }

  // Many env vars
  if (envVars.length >= 5) {
    score += 5; weaknesses.push(`${envVars.length} environment variables require configuration`)
  }

  return { legacyScore: Math.min(score, 100), weaknesses }
}

function scanEnvVars(files: Map<string, string>): string[] {
  const envVarNames = new Set<string>()
  const patterns = [
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /os\.environ\.get\(['"]([A-Z_][A-Z0-9_]*)['"]/g,
    /os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  ]

  for (const content of Array.from(files.values())) {
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const varName = match[1]
        if (
          !varName.startsWith('NODE_') &&
          !varName.startsWith('npm_') &&
          varName !== 'PATH' &&
          varName !== 'HOME'
        ) {
          envVarNames.add(varName)
        }
      }
    }
  }

  return Array.from(envVarNames).sort()
}

function buildFileTree(files: Map<string, string>): FileTreeNode[] {
  const root: FileTreeNode[] = []

  for (const filePath of Array.from(files.keys()).sort()) {
    const parts = filePath.split('/')
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      const existing = currentLevel.find((n) => n.name === part)

      if (existing) {
        if (existing.children) {
          currentLevel = existing.children
        }
      } else {
        const node: FileTreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          ...(isFile ? {} : { children: [] }),
        }
        currentLevel.push(node)
        if (node.children) {
          currentLevel = node.children
        }
      }
    }
  }

  return root
}

export const inspector = inngest.createFunction(
  { id: 'inspector', name: 'Inspect Repository' },
  { event: 'lazarus/scan.requested' },
  async ({ event, step }) => {
    const { jobId, repoUrl, userId, repoOwner, repoName } = event.data as {
      jobId: string
      repoUrl: string
      userId: string
      repoOwner: string
      repoName: string
    }

    await step.run('create-job', async () => {
      await createJob({
        jobId,
        userId,
        repoUrl,
        repoOwner,
        repoName,
        status: 'scanning',
        techStack: null,
        s3KeyPrefix: `repos/${jobId}`,
        totalCostUSD: 0,
        rejectionReason: null,
        envVars: [],
        clarificationQuestions: [],
        clarificationAnswers: {},
        createdAt: new Date().toISOString(),
        completedAt: null,
        legacyScore: 0,
        weaknesses: [],
      })
    })

    const files = await step.run('fetch-repo', async () => {
      const { files: repoFiles, binaryAssets } = await fetchRepoViaGitHubAPI(repoOwner, repoName)

      // Upload binary images separately — they cannot go through the text pipeline
      await Promise.all(
        Array.from(binaryAssets.entries()).map(([filePath, { data, contentType }]) =>
          uploadRepoBinaryAsset(jobId, filePath, data, contentType)
        )
      )

      return Object.fromEntries(repoFiles)
    })

    const filesMap = new Map(Object.entries(files))

    const techStack = await step.run('detect-stack', async () => {
      return detectTechStack(filesMap)
    })

    const validation = await step.run('validate-repo', async () => {
      return validateRepo(filesMap)
    })

    if (validation.rejected) {
      await step.run('mark-rejected', async () => {
        await updateJob(jobId, {
          status: 'rejected',
          rejectionReason: validation.reason,
        })
      })
      return { rejected: true, reason: validation.reason }
    }

    const envVars = await step.run('scan-env-vars', async () => {
      return scanEnvVars(filesMap)
    })

    const questions = await step.run('generate-questions', async () => {
      const hasReadme = filesMap.has('README.md') || filesMap.has('readme.md')
      const hasGenericName =
        repoName.length <= 3 ||
        ['app', 'project', 'test', 'demo', 'example'].includes(
          repoName.toLowerCase()
        )

      if (hasReadme && !hasGenericName) return []

      const fileList = Array.from(filesMap.keys()).slice(0, 50).join('\n')
      const readme = filesMap.get('README.md') ?? filesMap.get('readme.md') ?? ''

      const prompt = `Given this repository "${repoOwner}/${repoName}":

File list:
${fileList}

${readme ? `README:\n${readme.slice(0, 2000)}` : 'No README found.'}

Generate 2-4 short, focused clarifying questions to understand the user's modernization preferences. Each question should help decide between concrete options.

Output ONLY a JSON array of question strings, nothing else. Example:
["Modernize the UI completely or preserve the original look?", "Output in TypeScript or keep JavaScript?"]`

      const result = await invokeBedrockSync('haiku', 'You generate clarifying questions for code modernization. Output only valid JSON.', prompt, 1024)

      try {
        return JSON.parse(result.trim())
      } catch {
        return []
      }
    })

    const { legacyScore, weaknesses } = await step.run('analyze-repo', async () => {
      return analyzeRepo(techStack, filesMap, envVars)
    })

    await step.run('store-files', async () => {
      await Promise.all(
        Array.from(filesMap.entries()).map(([filePath, content]) =>
          uploadRepoFile(jobId, filePath, content)
        )
      )

      const fileTree = buildFileTree(filesMap)

      await updateJob(jobId, {
        status: questions.length > 0 ? 'clarifying' : 'scanned',
        techStack,
        envVars,
        clarificationQuestions: questions,
        legacyScore,
        weaknesses,
      })

      return { fileTree }
    })

    return {
      jobId,
      techStack,
      fileCount: filesMap.size,
      envVars,
      questions,
      fileTree: buildFileTree(filesMap),
      rejected: false,
      rejectionReason: null,
    }
  }
)
