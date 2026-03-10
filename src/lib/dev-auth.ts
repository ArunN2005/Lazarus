import { verifyToken } from '@clerk/backend'
import { headers } from 'next/headers'

const DEV_USER_ID = 'dev_user_local'

/**
 * Verifies the Clerk session token from the Authorization header.
 * Required because Amplify's middleware Lambda does not receive CLERK_SECRET_KEY,
 * so the frontend passes the token explicitly and we verify it per-route.
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

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? '',
    })
    return payload.sub ?? null
  } catch {
    return null
  }
}
