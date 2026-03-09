'use client'

import { ExternalLink, Clock, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

const PHASES = [
  'scan',
  'clarify',
  'resurrect',
  'install',
  'preview',
  'iterate',
  'ship',
] as const

function getActivePhaseIndex(status: string): number {
  switch (status) {
    case 'scanning':
      return 0
    case 'clarifying':
      return 1
    case 'resurrecting':
      return 2
    case 'complete':
      return 6
    default:
      return -1
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

interface TopBarProps {
  onStartResurrection?: () => void
  resurrectionLoading?: boolean
}

export function TopBar({ onStartResurrection, resurrectionLoading }: TopBarProps) {
  const status = useWorkspaceStore((s) => s.status)
  const totalCost = useWorkspaceStore((s) => s.totalCostUSD)
  const elapsed = useWorkspaceStore((s) => s.elapsedSeconds)
  const techStack = useWorkspaceStore((s) => s.techStack)
  const jobId = useWorkspaceStore((s) => s.jobId)

  const [prLoading, setPrLoading] = useState(false)
  const [prError, setPrError] = useState<string | null>(null)

  const activePhase = getActivePhaseIndex(status)
  const showStartButton = status === 'scanned'

  const handleCreatePR = async () => {
    if (!jobId) return
    setPrLoading(true)
    setPrError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/pr`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        window.open(data.prUrl, '_blank')
      } else {
        setPrError(data.error ?? 'Failed to create PR')
      }
    } catch {
      setPrError('Network error — could not create PR')
    } finally {
      setPrLoading(false)
    }
  }

  return (
    <div className="h-12 backdrop-blur-xl border-b border-white/[0.07] flex items-center px-4 gap-3 relative z-20"
      style={{ background: 'rgba(3,7,18,0.7)' }}
    >
      {/* Left: Brand */}
      <span className="font-semibold text-text-primary text-sm tracking-wide">
        LAZARUS
      </span>

      {techStack?.frontend && (
        <>
          <div className="w-px h-4 bg-white/[0.08]" />
          <span className="text-[11px] px-2 py-0.5 backdrop-blur-sm bg-white/[0.05] border border-white/[0.1] rounded-md text-text-secondary">
            {techStack.frontend}
          </span>
        </>
      )}

      {/* Center: Phase dots */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {PHASES.map((phase, i) => (
          <div key={phase} className="flex items-center gap-1" title={phase}>
            <div
              className={cn(
                'rounded-full transition-all duration-300',
                i < activePhase
                  ? 'w-2 h-2 bg-accent'
                  : i === activePhase
                    ? 'w-2.5 h-2.5 bg-accent-light animate-pulse shadow-[0_0_10px_var(--accent-glow)]'
                    : 'w-1.5 h-1.5 bg-white/[0.15]'
              )}
            />
            {i < PHASES.length - 1 && (
              <div className={cn(
                'h-px transition-all duration-300',
                i < activePhase ? 'w-3 bg-accent/50' : 'w-3 bg-white/[0.06]'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {showStartButton && onStartResurrection && (
          <>
            <button
              onClick={onStartResurrection}
              disabled={resurrectionLoading}
              className="flex items-center gap-1.5 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                boxShadow: '0 2px 16px rgba(129,140,248,0.4)',
              }}
            >
              {resurrectionLoading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Start Resurrection
                  <ArrowRight className="w-3 h-3" />
                </>
              )}
            </button>
            <div className="w-px h-4 bg-white/[0.08]" />
          </>
        )}

        <span className="font-mono text-xs text-text-secondary">
          ${totalCost.toFixed(2)}
        </span>
        <div className="w-px h-4 bg-white/[0.08]" />
        <div className="flex items-center gap-1 text-text-muted text-xs">
          <Clock className="w-3 h-3" />
          <span className="font-mono">{formatTime(elapsed)}</span>
        </div>

        {status === 'complete' && (
          <>
            <div className="w-px h-4 bg-white/[0.08]" />
            {prError && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 max-w-[260px]">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span className="truncate" title={prError}>{prError}</span>
              </div>
            )}
            <button
              onClick={handleCreatePR}
              disabled={prLoading}
              className="flex items-center gap-1.5 border border-accent/40 text-accent text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-accent/10 hover:border-accent/60 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ExternalLink className="w-3 h-3" />
              )}
              {prLoading ? 'Creating...' : 'Create PR'}
            </button>
          </>
        )}

        <div className="w-px h-4 bg-white/[0.08]" />
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  )
}
