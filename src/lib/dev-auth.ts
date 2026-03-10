import { verifyToken } from '@clerk/backend'
import { cookies } from 'next/headers'

const DEV_USER_ID = 'dev_user_local'

/**
 * Verifies the Clerk session token directly from cookies.
 * Required because Amplify's middleware Lambda does not receive CLERK_SECRET_KEY,
 * so we skip clerkMiddleware() and verify the token per-route instead.
 */
export async function getAuthUserId(): Promise<string | null> {
  if (process.env.NODE_ENV === 'development') {
    return DEV_USER_ID
  }

  try {
    const cookieStore = cookies()
    // Clerk dev instances use __clerk_db_jwt; production instances use __session
    const token =
      cookieStore.get('__session')?.value ??
      cookieStore.get('__clerk_db_jwt')?.value

    if (!token) return null

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? '',
    })
    return payload.sub ?? null
  } catch {
    return null
  }
}
