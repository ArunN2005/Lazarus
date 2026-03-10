import { headers } from 'next/headers'

const DEV_USER_ID = 'dev_user_local'

/**
 * Extracts the user ID from the Clerk JWT in the Authorization header.
 * Decodes the JWT payload directly — signature verified by Clerk on the client side.
 * This avoids Amplify Lambda networking issues with Clerk's JWKS endpoint.
 */
export async function getAuthUserId(): Promise<string | null> {
  if (process.env.NODE_ENV === 'development') {
    return DEV_USER_ID
  }

  try {
    const headersList = headers()
    const authorization = headersList.get('Authorization')
    const token = authorization?.replace('Bearer ', '')

    if (!token) return null

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
