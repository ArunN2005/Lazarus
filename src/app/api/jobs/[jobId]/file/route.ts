import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/dev-auth'
import { getJob } from '@/lib/dynamodb'
import { getRepoFile, getGeneratedFile } from '@/lib/s3'

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filePath = req.nextUrl.searchParams.get('path')
  if (!filePath) {
    return NextResponse.json({ error: 'Missing path param' }, { status: 400 })
  }

  const job = await getJob(params.jobId)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Try generated file first, then fall back to original repo file
  try {
    const content = await getGeneratedFile(params.jobId, filePath)
    return NextResponse.json({ content })
  } catch {
    try {
      const content = await getRepoFile(params.jobId, filePath)
      return NextResponse.json({ content })
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
  }
}
