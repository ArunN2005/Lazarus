import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime'

const REGION = process.env.AWS_REGION ?? 'us-east-1'
const TABLE = process.env.DYNAMODB_TABLE_NAME ?? 'lazarus-jobs'
const S3_REPOS = process.env.S3_BUCKET_REPOS ?? 'lazarus-repos-519010179949'
const S3_GENERATED = process.env.S3_BUCKET_GENERATED ?? 'lazarus-generated-519010179949'
const MODEL_SONNET = process.env.BEDROCK_MODEL_SONNET ?? 'us.anthropic.claude-sonnet-4-6'

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }))
const s3 = new S3Client({ region: REGION })
const bedrock = new BedrockRuntimeClient({ region: REGION })

// ── DynamoDB helpers ──────────────────────────────────────────────────────────

let _seq = 0

async function pushStreamEvent(jobId: string, event: Record<string, unknown>): Promise<void> {
  _seq++
  const sk = `EVT#${Date.now().toString().padStart(15, '0')}_${_seq.toString().padStart(8, '0')}`
  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: `EVTBUF#${jobId}`, SK: sk, ...event },
    })
  )
}

async function updateJob(jobId: string, updates: Record<string, unknown>): Promise<void> {
  const entries = Object.entries(updates)
  if (entries.length === 0) return

  const parts: string[] = []
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {}

  entries.forEach(([key, value], i) => {
    parts.push(`#k${i} = :v${i}`)
    names[`#k${i}`] = key
    values[`:v${i}`] = value
  })

  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `JOB#${jobId}`, SK: 'meta' },
      UpdateExpression: `SET ${parts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  )
}

async function putFileRecord(
  jobId: string,
  filePath: string,
  generatedContent: string | null,
  status: 'streaming' | 'complete'
): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `JOB#${jobId}`,
        SK: `FILE#${filePath}`,
        jobId,
        filePath,
        originalContent: null,
        generatedContent,
        status,
      },
    })
  )
}

// ── S3 helpers ────────────────────────────────────────────────────────────────

async function getPromptFile(jobId: string, name: 'system' | 'user'): Promise<string> {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: S3_REPOS,
      Key: `prompts/${jobId}/${name}.txt`,
    })
  )
  return (await result.Body?.transformToString()) ?? ''
}

async function uploadGeneratedFile(
  jobId: string,
  filePath: string,
  content: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_GENERATED,
      Key: `generated/${jobId}/${filePath}`,
      Body: content,
      ContentType: 'text/plain',
    })
  )
}

async function listRepoBinaryAssets(jobId: string): Promise<string[]> {
  const prefix = `repos/${jobId}/binary/`
  const result = await s3.send(
    new ListObjectsV2Command({ Bucket: S3_REPOS, Prefix: prefix })
  )
  return (result.Contents ?? [])
    .map((obj) => obj.Key?.replace(prefix, '') ?? '')
    .filter(Boolean)
}

async function getRepoBinaryAsset(jobId: string, filePath: string): Promise<Uint8Array> {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: S3_REPOS,
      Key: `repos/${jobId}/binary/${filePath}`,
    })
  )
  return (await result.Body?.transformToByteArray()) ?? new Uint8Array(0)
}

// ── Bedrock streaming ─────────────────────────────────────────────────────────

async function streamBedrock(opts: {
  system: string
  userMessage: string
  maxTokens: number
  onToken: (token: string) => Promise<void>
  onComplete?: (usage: { inputTokens: number; outputTokens: number }) => void
}): Promise<void> {
  const response = await bedrock.send(
    new InvokeModelWithResponseStreamCommand({
      modelId: MODEL_SONNET,
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: 'user', content: opts.userMessage }],
      }),
      contentType: 'application/json',
      accept: 'application/json',
    })
  )

  let inputTokens = 0
  let outputTokens = 0

  if (response.body) {
    for await (const chunk of response.body) {
      if (chunk.chunk?.bytes) {
        const parsed = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes))
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          await opts.onToken(parsed.delta.text)
        }
        if (parsed.type === 'message_delta' && parsed.usage) {
          outputTokens = parsed.usage.output_tokens
        }
        if (parsed.type === 'message_start' && parsed.message?.usage) {
          inputTokens = parsed.message.usage.input_tokens
        }
      }
    }
  }

  opts.onComplete?.({ inputTokens, outputTokens })
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // Sonnet pricing: $3/M input, $15/M output
  return (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000
}

// ── File stream parser ────────────────────────────────────────────────────────

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

      if (!currentFile) {
        const startMatch = buffer.match(/<file path="([^"]+)">/)
        if (startMatch) {
          currentFile = startMatch[1]
          const afterTag = buffer.indexOf('>') + 1
          currentContent = buffer.slice(afterTag)
          buffer = ''
          onFileStart(currentFile)

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

      if (currentFile) {
        currentContent += token
        buffer = ''

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
  }
}

// ── Lambda handler ────────────────────────────────────────────────────────────

export const handler = async (event: { jobId: string }): Promise<void> => {
  const { jobId } = event
  console.log(`[generate-lambda] Starting generation for job ${jobId}`)

  try {
    const [systemPrompt, userMessage] = await Promise.all([
      getPromptFile(jobId, 'system'),
      getPromptFile(jobId, 'user'),
    ])

    console.log(`[generate-lambda] Prompts loaded, starting Bedrock stream`)

    const completedFiles = new Map<string, string>()
    const seenFiles = new Set<string>()

    const parser = parseFileStream(
      (filePath) => {
        if (seenFiles.has(filePath)) {
          console.log(`[generate-lambda] Duplicate file_start ignored: ${filePath}`)
          return
        }
        console.log(`[generate-lambda] Streaming: ${filePath}`)
        void pushStreamEvent(jobId, { type: 'file_start', file: filePath })
        void putFileRecord(jobId, filePath, null, 'streaming')
      },
      (filePath, content) => {
        if (seenFiles.has(filePath)) {
          console.log(`[generate-lambda] Duplicate file_complete ignored: ${filePath}`)
          return
        }
        seenFiles.add(filePath)
        console.log(`[generate-lambda] Complete: ${filePath}`)
        completedFiles.set(filePath, content)
        void pushStreamEvent(jobId, { type: 'file_complete', file: filePath, content })
        void uploadGeneratedFile(jobId, filePath, content)
        void putFileRecord(jobId, filePath, content, 'complete')
      }
    )

    await streamBedrock({
      system: systemPrompt,
      userMessage,
      maxTokens: 128000,
      onToken: async (token) => {
        parser.feed(token)
      },
      onComplete: ({ inputTokens, outputTokens }) => {
        const cost = calculateCost(inputTokens, outputTokens)
        void pushStreamEvent(jobId, { type: 'cost_update', totalUSD: cost })
        void updateJob(jobId, { totalCostUSD: cost })
      },
    })

    console.log(`[generate-lambda] Generation complete. ${completedFiles.size} files produced.`)

    // Copy binary assets (images etc.) as base64 to the frontend
    const assetPaths = await listRepoBinaryAssets(jobId)
    await Promise.all(
      assetPaths.map(async (filePath) => {
        try {
          const bytes = await getRepoBinaryAsset(jobId, filePath)
          const base64 = Buffer.from(bytes).toString('base64')
          void pushStreamEvent(jobId, { type: 'asset_complete', file: filePath, base64 })
        } catch (err) {
          console.warn(`[generate-lambda] Failed to copy asset ${filePath}:`, err)
        }
      })
    )

    // Signal Inngest polling loop
    await updateJob(jobId, { status: 'generation_complete' })
  } catch (err) {
    console.error('[generate-lambda] Fatal error:', err)
    await updateJob(jobId, { status: 'generation_failed' })
    await pushStreamEvent(jobId, {
      type: 'error',
      message: String(err),
      recoverable: false,
    })
  }
}
