import { NextRequest } from 'next/server'
import { getAuthUserId } from '@/lib/dev-auth'
import { getStreamEvents } from '@/lib/dynamodb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const userId = await getAuthUserId(req)
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { jobId } = params
  let eventIndex = 0
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (data: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          closed = true
        }
      }

      let pollTimeout: ReturnType<typeof setTimeout> | null = null

      const poll = async () => {
        if (closed) return
        try {
          const events = await getStreamEvents(jobId, eventIndex)
          for (const event of events) {
            send(JSON.stringify(event))
            eventIndex++
            if (event.type === 'complete' || event.type === 'error') {
              closed = true
              controller.close()
              return
            }
          }
        } catch {
          // DynamoDB error — keep polling
        }
        if (!closed) {
          pollTimeout = setTimeout(poll, 500)
        }
      }

      void poll()

      req.signal.addEventListener('abort', () => {
        closed = true
        if (pollTimeout) clearTimeout(pollTimeout)
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
