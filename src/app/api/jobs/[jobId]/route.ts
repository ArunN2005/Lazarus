import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/dev-auth'
import { getJob, getFileRecords } from '@/lib/dynamodb'
import { listRepoFiles } from '@/lib/s3'

export async function GET(
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

  const files = await getFileRecords(params.jobId)

  // Get file paths from S3 for file tree building
  let filePaths: string[] = []
  if (job.status !== 'scanning' && job.status !== 'idle') {
    try {
      filePaths = await listRepoFiles(params.jobId)
    } catch {
      // S3 might not have files yet
    }
  }

  return NextResponse.json({ job, files, filePaths })
}
