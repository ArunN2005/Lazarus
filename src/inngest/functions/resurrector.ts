import { inngest } from '@/lib/inngest-client'
import { getJob, updateJob, putFileRecord } from '@/lib/dynamodb'
import { getAllRepoFiles, uploadGeneratedFile, listRepoBinaryAssets, getRepoBinaryAssetUrl, getRepoBinaryAsset } from '@/lib/s3'
import { streamBedrock, calculateCost } from '@/lib/bedrock'
import {
  buildResurrectionPrompt,
  buildSystemPromptWithContext,
} from '@/lib/migration-prompt'

interface StreamEvent {
  jobId: string
  type: string
  file?: string
  token?: string
  content?: string
  base64?: string
  totalUSD?: number
  message?: string
  recoverable?: boolean
  needsInstall?: boolean
}

// In-memory event buffer per job — polled by SSE route
// Must use globalThis so the Map is shared across Next.js webpack bundles
// (api/inngest and api/stream routes compile into separate bundles)
const globalForBuffers = globalThis as typeof globalThis & {
  __lazarusEventBuffers?: Map<string, StreamEvent[]>
}
if (!globalForBuffers.__lazarusEventBuffers) {
  globalForBuffers.__lazarusEventBuffers = new Map()
}
const eventBuffers = globalForBuffers.__lazarusEventBuffers

export function getEvents(jobId: string, since: number): StreamEvent[] {
  const buffer = eventBuffers.get(jobId) ?? []
  return buffer.slice(since)
}

export function pushEvent(jobId: string, event: StreamEvent): void {
  if (!eventBuffers.has(jobId)) {
    eventBuffers.set(jobId, [])
  }
  eventBuffers.get(jobId)!.push(event)
}

function parseFileStream(
  onFileStart: (path: string) => void,
  onFileComplete: (path: string, content: string) => void
) {
  let buffer = ''
  let currentFile: string | null = null
  let currentContent = ''

  return {
    feed(token: string) {
      buffer += token

      // Check for file_start
      if (!currentFile) {
        const startMatch = buffer.match(/<file path="([^"]+)">/)
        if (startMatch) {
          currentFile = startMatch[1]
          const afterTag = buffer.indexOf('>') + 1
          currentContent = buffer.slice(afterTag)
          buffer = ''
          onFileStart(currentFile)

          // Check if content already contains closing tag
          const endIdx = currentContent.indexOf('</file>')
          if (endIdx !== -1) {
            const finalContent = currentContent.slice(0, endIdx).trim()
            onFileComplete(currentFile, finalContent)
            buffer = currentContent.slice(endIdx + '</file>'.length)
            currentContent = ''
            currentFile = null
          }
          return
        }
      }

      // Currently streaming file content
      if (currentFile) {
        currentContent += token
        buffer = ''

        // Check for closing tag
        const endIdx = currentContent.indexOf('</file>')
        if (endIdx !== -1) {
          const finalContent = currentContent.slice(0, endIdx).trim()
          onFileComplete(currentFile, finalContent)
          buffer = currentContent.slice(endIdx + '</file>'.length)
          currentContent = ''
          currentFile = null
        }
      }
    },
    getCurrentFile(): string | null {
      return currentFile
    },
  }
}

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
      await updateJob(jobId, { status: 'resurrecting' })
    })

    // Only return small metadata from this step — file contents stay in S3
    // Returning file contents as a step result hits Inngest's ~4MB response limit
    // Generate 7-day presigned URLs so Bedrock can embed them directly in generated code
    const binaryAssets = await step.run('load-files', async () => {
      const paths = await listRepoBinaryAssets(jobId)
      const entries = await Promise.all(
        paths.map(async (p) => [p, await getRepoBinaryAssetUrl(jobId, p)] as [string, string])
      )
      return Object.fromEntries(entries) as Record<string, string>
    })

    await step.run('generate', async () => {
      // Fetch files directly inside the step so they never flow through Inngest's response body
      const repoFiles = await getAllRepoFiles(jobId)
      const filesMap = repoFiles
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
        filesMap,
        techStackStr,
        job.clarificationAnswers,
        new Map(Object.entries(binaryAssets))
      )

      const completedFiles = new Map<string, string>()

      const parser = parseFileStream(
        (filePath) => {
          pushEvent(jobId, { jobId, type: 'file_start', file: filePath })
          putFileRecord({
            jobId,
            filePath,
            originalContent: filesMap.get(filePath) ?? null,
            generatedContent: null,
            status: 'streaming',
          })
        },
        (filePath, content) => {
          completedFiles.set(filePath, content)
          pushEvent(jobId, {
            jobId,
            type: 'file_complete',
            file: filePath,
            content,
          })
          uploadGeneratedFile(jobId, filePath, content)
          putFileRecord({
            jobId,
            filePath,
            originalContent: filesMap.get(filePath) ?? null,
            generatedContent: content,
            status: 'complete',
          })
        }
      )

      await streamBedrock({
        model: 'sonnet',
        system: systemPrompt,
        userMessage,
        maxTokens: 128000,
        onToken: async (token) => {
          parser.feed(token)
          const currentFile = parser.getCurrentFile()
          if (currentFile) {
            pushEvent(jobId, {
              jobId,
              type: 'token',
              file: currentFile,
              token,
            })
          }
        },
        onComplete: ({ inputTokens, outputTokens }) => {
          const cost = calculateCost('sonnet', inputTokens, outputTokens)
          pushEvent(jobId, { jobId, type: 'cost_update', totalUSD: cost })
          updateJob(jobId, { totalCostUSD: cost })
        },
      })

      return { fileCount: completedFiles.size }
    })

    await step.run('copy-assets', async () => {
      const paths = Object.keys(binaryAssets)
      if (paths.length === 0) return
      await Promise.all(
        paths.map(async (filePath) => {
          try {
            const bytes = await getRepoBinaryAsset(jobId, filePath)
            const base64 = Buffer.from(bytes).toString('base64')
            pushEvent(jobId, { jobId, type: 'asset_complete', file: filePath, base64 })
          } catch {
            // skip assets that fail to fetch
          }
        })
      )
    })

    await step.run('finalize', async () => {
      await updateJob(jobId, {
        status: 'complete',
        completedAt: new Date().toISOString(),
      })
      pushEvent(jobId, { jobId, type: 'complete' })
    })
  }
)
