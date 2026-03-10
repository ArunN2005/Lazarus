import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/dev-auth'
import { getStreamEvents } from '@/lib/dynamodb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  let userId: string | null = null
  try {
    userId = await getAuthUserId(req)
  } catch (err) {
    console.error('[stream] auth error:', err)
    return new NextResponse('Internal error', { status: 500 })
  }

  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { jobId } = params
  const since = parseInt(req.nextUrl.searchParams.get('since') ?? '0', 10)

  try {
    const events = await getStreamEvents(jobId, isNaN(since) ? 0 : since)
    const done = events.some((e) => e['type'] === 'complete' || e['type'] === 'error')

    return NextResponse.json({
      events,
      nextIndex: (isNaN(since) ? 0 : since) + events.length,
      done,
    })
  } catch (err) {
    console.error('[stream] getStreamEvents error:', err)
    return new NextResponse('Internal error', { status: 500 })
  }
}
