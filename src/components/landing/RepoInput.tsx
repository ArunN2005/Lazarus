'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Zap, ArrowRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

interface RepoInputProps {
  onFillRef?: (fill: (url: string) => void) => void
}

export function RepoInput({ onFillRef }: RepoInputProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { isSignedIn } = useAuth()

  const fillUrl = useCallback((repoUrl: string) => {
    setUrl(repoUrl)
  }, [])

  // Expose fill function to parent
  if (onFillRef) onFillRef(fillUrl)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || loading) return

    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to scan repository')
        return
      }

      const { jobId } = await res.json()
      // Full navigation (not client-side) so COOP/COEP headers apply for WebContainers
      window.location.href = `/workspace/${jobId}`
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className="w-full max-w-[680px] mx-auto mt-12 px-4"
    >
      <form onSubmit={handleSubmit}>
        <div
          className={`flex items-center bg-bg-elevated border rounded-xl p-1 pl-4 transition-all duration-200 ${
            error
              ? 'border-error'
              : 'border-border focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-dim)]'
          }`}
        >
          <Zap className="w-4 h-4 text-text-muted flex-shrink-0" />
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
            }}
            placeholder="https://github.com/username/repo"
            className="flex-1 bg-transparent font-mono text-sm text-text-primary placeholder:text-text-muted px-3 py-2.5 outline-none"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-all duration-150 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Resurrect
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-error text-sm mt-2 text-center">{error}</p>
      )}
    </motion.div>
  )
}
