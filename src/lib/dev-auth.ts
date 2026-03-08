import { auth } from '@clerk/nextjs/server'

const DEV_USER_ID = 'dev_user_local'

/**
 * Wraps Clerk's auth() with a development fallback.
 * In development, always uses a consistent dev user ID to avoid
 * intermittent Clerk clock skew issues causing userId mismatches.
 */
export function getAuthUserId(): string | null {
  // In dev mode, always use consistent dev user to avoid clock skew issues
  if (process.env.NODE_ENV === 'development') {
    return DEV_USER_ID
  }

  try {
    const { userId } = auth()
    return userId
  } catch {
    return null
  }
}
