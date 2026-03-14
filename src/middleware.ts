import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Protect everything inside /workspace
const isProtectedRoute = createRouteMatcher(['/workspace(.*)'])

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect()
  }
})

export const config = {
  // Excludes Next.js internals, static files, and explicit image types completely
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
