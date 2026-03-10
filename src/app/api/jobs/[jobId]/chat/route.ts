import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/dev-auth'
import { z } from 'zod'
import { getJob, addChatMessage } from '@/lib/dynamodb'
import { getAllRepoFiles } from '@/lib/s3'
import { invokeBedrockSync, streamBedrock, calculateCost } from '@/lib/bedrock'
import { updateJob } from '@/lib/dynamodb'
import { uploadGeneratedFile } from '@/lib/s3'
import { pushEvent } from '@/inngest/functions/resurrector'
import type { ChatMessage } from '@/types'

const chatSchema = z.object({
  message: z.string().min(1).max(5000),
  generatedFiles: z.record(z.string()).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = chatSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const job = await getJob(params.jobId)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: parsed.data.message,
    timestamp: new Date().toISOString(),
  }
  await addChatMessage(params.jobId, userMsg)

  // Use client-provided generated files if available, otherwise fall back to S3
  const clientFiles = parsed.data.generatedFiles
  const clientFileCount = clientFiles ? Object.keys(clientFiles).length : 0
  console.log(`[chat] Client provided ${clientFileCount} files`)
  const generatedFiles = clientFileCount > 0
    ? new Map(Object.entries(clientFiles!))
    : await getAllRepoFiles(params.jobId)
  const fileList = Array.from(generatedFiles.keys()).join('\n')
  console.log(`[chat] File list (${generatedFiles.size} files):\n${fileList}`)

  // Step 1: Classify intent — question vs code change
  const classifyResult = await invokeBedrockSync(
    'haiku',
    'You classify user messages. Output only one word: "question" or "edit".',
    `The user sent this message to an AI coding assistant: "${parsed.data.message}"\n\nIs this a question/inquiry, or a request to edit/change/add/fix code?\nOutput only: "question" or "edit"`,
    10
  )
  const isQuestion = classifyResult.trim().toLowerCase().includes('question')
  console.log(`[chat] Intent: ${isQuestion ? 'question' : 'edit'}`)

  // If it's a question, answer it using the codebase context — no file modifications
  if (isQuestion) {
    const codeContext = Array.from(generatedFiles.entries())
      .slice(0, 20)
      .map(([path, content]) => `<file path="${path}">\n${content.slice(0, 800)}\n</file>`)
      .join('\n\n')

    const answer = await invokeBedrockSync(
      'sonnet',
      'You are a helpful assistant that answers questions about a codebase. Be concise and clear.',
      `Here is the codebase:\n\n${codeContext}\n\nUser question: ${parsed.data.message}`,
      1024
    )

    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: answer.trim(),
      timestamp: new Date().toISOString(),
    }
    await addChatMessage(params.jobId, aiMsg)
    return NextResponse.json({ message: aiMsg })
  }

  // Step 2 (edit path): Identify which files need to change
  const identifyPrompt = `Given these files in a web application:
${fileList}

The user wants: "${parsed.data.message}"

Which files need to be modified? Return ONLY a JSON array of file paths. Example: ["src/App.tsx", "src/styles.css"]`

  const identifyResult = await invokeBedrockSync(
    'haiku',
    'You identify which files need modification. Output only valid JSON arrays.',
    identifyPrompt,
    1024
  )

  console.log(`[chat] Haiku raw response: ${identifyResult}`)
  let filesToChange: string[] = []
  try {
    // Extract JSON array from response (Haiku sometimes wraps it in markdown)
    const jsonMatch = identifyResult.match(/\[[\s\S]*\]/)
    filesToChange = jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    console.log(`[chat] Failed to parse Haiku response as JSON`)
    filesToChange = []
  }
  console.log(`[chat] Files to change: ${JSON.stringify(filesToChange)}`)

  if (filesToChange.length === 0) {
    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: "I couldn't identify which files need to change. Could you be more specific?",
      timestamp: new Date().toISOString(),
    }
    await addChatMessage(params.jobId, aiMsg)
    return NextResponse.json({ message: aiMsg })
  }

  // Get current content of those files
  const fileContents = filesToChange
    .map((f) => {
      const content = generatedFiles.get(f)
      return content ? `<file path="${f}">\n${content}\n</file>` : null
    })
    .filter(Boolean)
    .join('\n\n')

  // Stream changes via Sonnet
  const changePrompt = `Here are the current files:

${fileContents}

The user requests: "${parsed.data.message}"

Modify ONLY the files that need changes. Output each modified file in the XML format:
<file path="...">
[complete file contents]
</file>`

  let responseText = ''
  await streamBedrock({
    model: 'sonnet',
    system:
      'You are a code editor. Modify the files as requested. Preserve all existing functionality.',
    userMessage: changePrompt,
    maxTokens: 32000,
    onToken: async (token) => {
      responseText += token
    },
    onComplete: ({ inputTokens, outputTokens }) => {
      const cost = calculateCost('sonnet', inputTokens, outputTokens)
      const newCost = (job.totalCostUSD ?? 0) + cost
      updateJob(params.jobId, { totalCostUSD: newCost })
      pushEvent(params.jobId, {
        jobId: params.jobId,
        type: 'cost_update',
        totalUSD: newCost,
      })
    },
  })

  // Parse response for file outputs
  const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g
  let match
  const updatedFiles: Array<{ path: string; content: string }> = []

  while ((match = fileRegex.exec(responseText)) !== null) {
    const filePath = match[1]
    const content = match[2].trim()
    updatedFiles.push({ path: filePath, content })

    await uploadGeneratedFile(params.jobId, filePath, content)
    pushEvent(params.jobId, {
      jobId: params.jobId,
      type: 'file_complete',
      file: filePath,
      content,
    })
  }

  // Signal the frontend whether package.json changed so it knows to re-install
  const needsInstall = updatedFiles.some(
    (f) => f.path === 'package.json' || f.path.endsWith('/package.json')
  )
  pushEvent(params.jobId, {
    jobId: params.jobId,
    type: 'chat_complete',
    needsInstall,
  })

  const aiMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: `Updated ${updatedFiles.length} file${updatedFiles.length !== 1 ? 's' : ''}: ${updatedFiles.map((f) => f.path).join(', ')}`,
    timestamp: new Date().toISOString(),
  }
  await addChatMessage(params.jobId, aiMsg)

  return NextResponse.json({
    message: aiMsg,
    updatedFiles,
  })
}
