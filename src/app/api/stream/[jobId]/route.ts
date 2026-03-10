import { NextRequest } from 'next/server'
import { getAuthUserId } from '@/lib/dev-auth'
import { getEvents } from '@/inngest/functions/resurrector'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const userId = await getAuthUserId()
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

      const ping = () => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          closed = true
        }
      }

      const poll = setInterval(() => {
        if (closed) {
          clearInterval(poll)
          clearInterval(pingInterval)
          return
        }

        const events = getEvents(jobId, eventIndex)
        for (const event of events) {
          send(JSON.stringify(event))
          eventIndex++

          if (event.type === 'complete' || event.type === 'error') {
            closed = true
            clearInterval(poll)
            clearInterval(pingInterval)
            controller.close()
            return
          }
        }
      }, 100)

      const pingInterval = setInterval(ping, 15000)

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(poll)
        clearInterval(pingInterval)
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
