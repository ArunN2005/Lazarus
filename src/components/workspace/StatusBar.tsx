'use client'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

function getStatusMessage(status: string): string {
  switch (status) {
    case 'scanning':
      return 'Analyzing repository...'
    case 'scanned':
      return 'Scan complete — ready to resurrect'
    case 'clarifying':
      return 'Waiting for your preferences...'
    case 'resurrecting':
      return 'Generating modernized codebase...'
    case 'complete':
      return 'Resurrection complete'
    case 'failed':
      return 'Resurrection failed'
    case 'rejected':
      return 'Repository rejected'
    default:
      return 'Idle'
  }
}

function getStatusAccent(status: string): string {
  switch (status) {
    case 'scanning':
      return 'bg-info/[0.08]'
    case 'resurrecting':
      return 'bg-accent/[0.08]'
    case 'complete':
      return 'bg-success/[0.08]'
    case 'failed':
    case 'rejected':
      return 'bg-error/[0.08]'
    default:
      return ''
  }
}

function getDotColor(status: string): string {
  switch (status) {
    case 'scanning':
      return 'bg-info animate-pulse'
    case 'resurrecting':
      return 'bg-accent animate-pulse'
    case 'complete':
      return 'bg-success'
    case 'failed':
    case 'rejected':
      return 'bg-error'
    default:
      return 'bg-white/20'
  }
}

export function StatusBar() {
  const status = useWorkspaceStore((s) => s.status)
  const fileStatuses = useWorkspaceStore((s) => s.fileStatuses)
  const totalCost = useWorkspaceStore((s) => s.totalCostUSD)

  const totalFiles = fileStatuses.size
  const completeFiles = Array.from(fileStatuses.values()).filter(
    (s) => s === 'complete'
  ).length

  return (
    <div
      className={cn(
        'h-6 backdrop-blur-md border-t border-white/[0.06] flex items-center px-3 gap-3 font-mono text-[11px] transition-colors',
        getStatusAccent(status)
      )}
      style={{ background: 'rgba(3,7,18,0.5)' }}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', getDotColor(status))} />
      <span className="text-text-secondary">{getStatusMessage(status)}</span>

      {totalFiles > 0 && (
        <>
          <div className="w-px h-3 bg-white/[0.07]" />
          <span className="text-text-muted">
            {completeFiles}/{totalFiles} files
          </span>
        </>
      )}

      {status === 'resurrecting' && (
        <>
          <div className="w-px h-3 bg-white/[0.07]" />
          <span className="text-text-muted">Bedrock: streaming</span>
        </>
      )}

      <div className="flex-1" />

      <span className="text-text-muted">${totalCost.toFixed(2)}</span>
      <div className="w-px h-3 bg-white/[0.07]" />
      <span className="text-text-muted">Claude Sonnet 4.6</span>
    </div>
  )
}
