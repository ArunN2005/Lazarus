import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const upstream = await fetch('https://api.sarvam.ai/speech-to-text-translate', {
    method: 'POST',
    headers: { 'api-subscription-key': env.SARVAM_API_KEY },
    body: formData,
  })

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}))
    return NextResponse.json(err, { status: upstream.status })
  }

  const data = await upstream.json()
  return NextResponse.json({ transcript: (data.transcript as string) ?? '' })
}
