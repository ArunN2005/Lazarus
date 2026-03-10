import { headers } from 'next/headers'
import { NextRequest } from 'next/server'

const DEV_USER_ID = 'dev_user_local'

/**
 * Extracts the user ID from the Clerk JWT.
 * Checks Authorization header first, then ?token= query param (for EventSource/SSE).
 * Decodes the JWT payload directly — avoids JWKS network call in Amplify Lambda.
 */
export async function getAuthUserId(req?: NextRequest): Promise<string | null> {
  if (process.env.NODE_ENV === 'development') {
    return DEV_USER_ID
  }

  let token: string | undefined

  // Try Authorization header first
  try {
    const headersList = headers()
    const authorization = headersList.get('Authorization')
    if (authorization) token = authorization.replace('Bearer ', '')
  } catch {
    // headers() may throw outside request context — fall through to query param
  }

  // Fallback: ?token= query param for EventSource (can't send custom headers)
  if (!token && req) {
    token = req.nextUrl.searchParams.get('token') ?? undefined
  }

  if (!token) return null

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8')
    const payload = JSON.parse(payloadJson) as { sub?: string; exp?: number }

    // Reject expired tokens
    if (payload.exp && Date.now() / 1000 > payload.exp) return null

    return payload.sub ?? null
  } catch {
    return null
  }
}
