'use client'

import { Zap, ExternalLink, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
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

  const activePhase = getActivePhaseIndex(status)
  const showStartButton = status === 'scanned'

  const handleCreatePR = async () => {
    if (!jobId) return
    const res = await fetch(`/api/jobs/${jobId}/pr`, { method: 'POST' })
    if (res.ok) {
      const { prUrl } = await res.json()
      window.open(prUrl, '_blank')
    }
  }

  return (
    <div className="h-12 bg-bg-panel border-b border-border-subtle flex items-center px-4 gap-3">
      {/* Left: Brand + repo */}
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-accent" />
        <span className="font-semibold text-text-primary text-sm">
          LAZARUS
        </span>
      </div>

      {techStack?.frontend && (
        <>
          <div className="w-px h-4 bg-border-subtle" />
          <span className="text-xs px-1.5 py-0.5 bg-bg-elevated border border-border-subtle rounded text-text-secondary">
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
                'rounded-full transition-all',
                i < activePhase
                  ? 'w-2 h-2 bg-accent'
                  : i === activePhase
                    ? 'w-2.5 h-2.5 bg-accent-light animate-pulse shadow-[0_0_8px_var(--accent-glow)]'
                    : 'w-2 h-2 bg-text-muted'
              )}
            />
            {i < PHASES.length - 1 && (
              <div className="w-3 h-px bg-border-subtle" />
            )}
          </div>
        ))}
      </div>

      {/* Right: Start Resurrection / Cost / timer / PR / avatar */}
      <div className="flex items-center gap-3">
        {showStartButton && onStartResurrection && (
          <>
            <button
              onClick={onStartResurrection}
              disabled={resurrectionLoading}
              className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-semibold text-xs px-4 py-1.5 rounded-md transition-all duration-150 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-glow"
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
            <div className="w-px h-4 bg-border-subtle" />
          </>
        )}

        <span className="font-mono text-sm text-text-secondary">
          ${totalCost.toFixed(2)}
        </span>
        <div className="w-px h-4 bg-border-subtle" />
        <div className="flex items-center gap-1 text-text-muted text-sm">
          <Clock className="w-3 h-3" />
          <span className="font-mono">{formatTime(elapsed)}</span>
        </div>

        {status === 'complete' && (
          <>
            <div className="w-px h-4 bg-border-subtle" />
            <button
              onClick={handleCreatePR}
              className="flex items-center gap-1.5 border border-accent text-accent text-xs font-medium px-3 py-1.5 rounded-md hover:bg-accent-dim transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Create PR
            </button>
          </>
        )}

        <div className="w-px h-4 bg-border-subtle" />
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  )
}
