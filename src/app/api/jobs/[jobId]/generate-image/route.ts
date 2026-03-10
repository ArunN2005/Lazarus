import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { getAuthUserId } from '@/lib/dev-auth'
import { getJob } from '@/lib/dynamodb'
import { uploadGeneratedImage } from '@/lib/s3'
import crypto from 'crypto'

const schema = z.object({
  prompt: z.string().min(1).max(500),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const userId = await getAuthUserId()
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

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

  let response
  try {
    response = await client.send(
      new InvokeModelCommand({
        modelId: 'amazon.titan-image-generator-v2:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          taskType: 'TEXT_IMAGE',
          textToImageParams: {
            text: parsed.data.prompt,
          },
          imageGenerationConfig: {
            numberOfImages: 1,
            quality: 'standard',
            height: 512,
            width: 512,
            cfgScale: 8.0,
            seed: Math.floor(Math.random() * 2147483647),
          },
        }),
      })
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-image] Bedrock error:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const result = JSON.parse(
    new TextDecoder().decode(response.body as Uint8Array)
  ) as { images: string[] }

  const base64 = result.images[0]
  const filename = `${crypto.randomUUID()}.png`
  const imageBuffer = Buffer.from(base64, 'base64')

  await uploadGeneratedImage(params.jobId, filename, imageBuffer)

  return NextResponse.json({
    imagePath: `/generated-images/${filename}`,
    filename,
    base64,
  })
}
